/**
 * Kahade — alur pembayaran QRIS di detail order (A-14/A-15, S9 audit 2026-09-22).
 *
 * Diekstrak dari `app/order/[id].tsx` yang sudah melewati plafon S9 ("layar god
 * component hanya boleh menyusut"). Semua yang berpindah ke sini adalah satu
 * kohesi yang jelas: siklus hidup intent QRIS — buat intent, polling status
 * tiap 3 detik, batas 15 menit, dan rekonsiliasi setelah kegagalan tak pasti.
 * Layar tetap memiliki presentasi (`<QrisPaymentPanel>`) dan navigasi.
 *
 * Dua cacat yang diperbaiki di sini (keduanya tercatat di issues.md):
 *   - A-14: jaring pengaman "sinkronkan status dulu" sebelumnya memanggil
 *     `pollPayment()`, yang menolak jalan selama `activePayment.current !==
 *     order.id` — dan ref itu diisi dari RENDER (`sheet === "pay" && qris`).
 *     Pada kegagalan pembuatan intent PERTAMA `qris` masih null, jadi fungsi
 *     itu keluar di baris pertama tanpa satu pun request `getPaymentStatus`.
 *     Sekarang rekonsiliasi memanggil `syncStatus()` langsung.
 *   - A-02: `createdAt` aksi menggantung kini memakai `serverNow()` — sebelumnya
 *     `Date.now()` perangkat dibandingkan dengan `expiresAt` dari server.
 */
import { useCallback, useRef, useState } from "react"

import { api, isApiError, userMessage } from "@/lib/api"
import { createIdempotencyKey } from "@/lib/api/client"
import type { QrisPayment } from "@/lib/api/orders"
import { recordPendingAction, resolvePendingAction, toEpochMs } from "@/lib/pending-actions"
import { serverNow } from "@/lib/server-time"
import { usePolling } from "@/lib/use-polling"

/** Interval polling status pembayaran (dulu konstanta di layar). */
const POLL_MS = 3_000
/**
 * 300 × 3 detik = 15 menit. C-10 (audit escrow 2026-09-24): setelah cap,
 * UI berhenti polling TETAPI tetap menyediakan "Cek status sekarang" +
 * "Bayar metode lain" (bukan berhenti tanpa jalan keluar).
 */
const MAX_POLLS = 300
/** Status yang menghentikan polling — PAID ikut (sheet ditutup via onPaid). */
const TERMINAL: readonly string[] = ["PAID", "EXPIRED", "FAILED", "CANCELLED", "UNKNOWN"]

/**
 * M-04 (audit escrow 2026-09-24): cast `(TERMINAL as readonly string[])`
 * (3 tempat) adalah kebocoran type-safety di jalur pembayaran — dihapus;
 * `TERMINAL` kini `readonly string[]` sehingga `includes(status)` sah tanpa
 * menurunkan tipe secara paksa.
 *
 * M-05 (audit end-to-end 2026-09-24, issue #11): dua pertanyaan berbeda
 * DIPISAHKAN — (a) "boleh polling berhenti?" (PAID = ya) vs (b) "apakah
 * intent ini sudah selesai-tanpa-dibayar?" (PAID = TIDAK). Dulu satu
 * `isTerminalStatus` dipakai untuk keduanya, sehingga intent berstatus PAID
 * dianggap "selesai" dan tombol Bayar lolos membuat INTENT KEDUA di atas
 * order yang sudah lunas.
 */
function isPollStopStatus(status: string | null | undefined): boolean {
  return status != null && TERMINAL.includes(status)
}

/** Intent selesai tanpa sukses bayar — PAID BUKAN di sini (lihat M-05).
 *  UNKNOWN juga bukan: nasibnya belum jelas, jangan disimpulkan. */
function isTerminalStatus(status: string | null | undefined): boolean {
  return status != null && status !== "PAID" && status !== "UNKNOWN" && TERMINAL.includes(status)
}

export type UseQrisPaymentOptions = {
  /** Order yang sedang dibuka, `null` saat parameter rute belum siap. */
  orderId: string | null
  /** Nominal order — fallback bila respons server tidak memuat `amount`. */
  fallbackAmount: number
  /** Sheet pembayaran sedang terbuka; polling hanya hidup saat true. */
  active: boolean
  /** Hanya pembeli yang boleh membuat intent (dulu cek `order.myRole` di layar). */
  canCreate: boolean
  /** Dipanggil sekali saat status server menjadi PAID (tutup sheet + refresh). */
  onPaid: () => void
  /** Galat pembuatan intent — layar menampilkannya sebagai toast. */
  onError: (message: string) => void
}

export function useQrisPayment({
  orderId,
  fallbackAmount,
  active,
  canCreate,
  onPaid,
  onError,
}: UseQrisPaymentOptions) {
  const [qris, setQris] = useState<QrisPayment | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const [creating, setCreating] = useState(false)
  const pollCount = useRef(0)
  const creatingRef = useRef(false)
  /** G-04: satu request status dalam satu waktu (poll + manual berbagi). */
  const syncInFlight = useRef<Promise<string | null> | null>(null)
  /**
   * M-08 (audit end-to-end, issue #3): `Idempotency-Key` per siklus pembuatan
   * intent — ditahan saat kegagalan tak pasti (retry tombol = intent yang sama
   * di mata server), di-reset setelah intent sukses terbentuk. Dulu tiap tekan
   * "Buat QRIS" memakai kunci baru → ganda saat timeout.
   */
  const intentKeyRef = useRef<string | null>(null)

  // Callback terbaru disimpan di ref: hook ini tidak boleh memaksa pemanggil
  // membungkus semuanya dengan useCallback hanya demi stabilitas.
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  /**
   * Satu kali `GET /orders/{id}/payment-status`. Dipakai polling DAN sebagai
   * jalur rekonsiliasi setelah kegagalan tak pasti (A-14).
   */
  const syncStatus = useCallback(async (): Promise<string | null> => {
    if (!orderId) return null
    // G-04 (audit escrow 2026-09-24): tick poll dan `syncStatus` manual
    // (createIntent/onCheckStatus) tidak boleh berjalan paralel — satu
    // request dalam satu waktu; pemanggil berikutnya membagi hasil yang sama.
    if (syncInFlight.current) return syncInFlight.current
    const run = (async () => {
      try {
        const res = await api.orders.getPaymentStatus(orderId)
        setPollError(null)
        setStatus(res.status)
        // M-06 (audit end-to-end, issue #8): `isPaid` boolean server ikut
        // dipercaya (alias `is_paid|paid|number 1/0` dinormalisasi strict) —
        // dulu hanya `status === "PAID"`; status tak dikenali + `isPaid:true`
        // tidak pernah memicu onPaid.
        if (res.status === "PAID" || res.isPaid === true) {
          setStatus("PAID")
          // J-02: status final — aksi menggantung diselesaikan.
          resolvePendingAction("qris-payment", orderId)
          onPaidRef.current()
        } else if (isTerminalStatus(res.status)) {
          resolvePendingAction("qris-payment", orderId)
        }
        return res.status
      } catch (error) {
        setPollError(userMessage(error))
        return null
      } finally {
        syncInFlight.current = null
      }
    })()
    syncInFlight.current = run
    return run
  }, [orderId])

  usePolling(
    async () => {
      if (pollCount.current >= MAX_POLLS) {
        setStopped(true)
        return
      }
      pollCount.current += 1
      await syncStatus()
    },
    POLL_MS,
    Boolean(orderId && active && qris && !isPollStopStatus(status) && pollCount.current < MAX_POLLS),
  )

  /** Buat intent QRIS (atau sinkronkan dulu bila masih ada intent aktif). */
  const createIntent = useCallback(async () => {
    if (!orderId || !canCreate || creatingRef.current) return
    // A-13 (audit lama, dipertahankan): jangan buat intent kedua selagi intent
    // aktif belum terminal — sinkronkan statusnya lebih dulu.
    //
    // C-11 (audit escrow 2026-09-24): dulu `syncStatus()` lalu `return` tanpa
    // syarat — tombol tidak responsif saat hasil baca kosong. Kini bila hasil
    // sinkronisasi menunjukkan intent sudah terminal, SATU tekan yang sama
    // langsung membuat intent baru (tanpa menuntut tekan kedua).
    // M-05: `isTerminalStatus` TANPA PAID — status PAID masuk cabang ini,
    // tersinkron PAID, lalu BERHENTI (tidak membuat intent kedua di order
    // yang sudah lunas).
    if (qris && !isTerminalStatus(status)) {
      const synced = await syncStatus()
      if (synced == null || synced === "PAID" || !isTerminalStatus(synced)) return
    }
    creatingRef.current = true
    setCreating(true)
    try {
      const res = await api.orders.payOrderQris(
        orderId,
        intentKeyRef.current ?? (intentKeyRef.current = createIdempotencyKey()),
      )
      intentKeyRef.current = null
      setQris(res)
      setStatus("PENDING")
      setStopped(false)
      pollCount.current = 0
      // J-04: pembayaran QRIS yang ditinggalkan bisa dipulihkan dari Beranda.
      recordPendingAction({
        kind: "qris-payment",
        orderId,
        amount: res.amount ?? fallbackAmount,
        createdAt: serverNow(),
        expiresAt: toEpochMs(res.expiresAt),
      })
    } catch (err) {
      /*
       * Kegagalan tidak pasti (jaringan/timeout/PARSE): intent mungkin TERBUAT
       * di server meski respons hilang. Sinkronkan status SEKARANG (A-14).
       * M-13 (audit end-to-end, issue #14): toast error TIDAK muncul duluan —
       * dulu user selalu melihat "gagal" padahal QRIS bisa jadi sudah terbit.
       * Pesan yang tampil netral; kegagalan PASTI tetap memakai pesan error.
       */
      const uncertain =
        !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
      if (uncertain) {
        onErrorRef.current(
          "Koneksi bermasalah — QRIS mungkin sudah dibuat. Memeriksa status…",
        )
        await syncStatus()
      } else {
        intentKeyRef.current = null
        onErrorRef.current(userMessage(err))
      }
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [canCreate, fallbackAmount, orderId, qris, status, syncStatus])

  /** Kembalikan ke keadaan awal (dulu tiga setState + reset hitungan di layar). */
  const reset = useCallback(() => {
    setQris(null)
    setStatus(null)
    setPollError(null)
    setStopped(false)
    pollCount.current = 0
    intentKeyRef.current = null
  }, [])

  /**
   * Dipakai panel saat countdown QR habis.
   *
   * C-05 (audit escrow 2026-09-24): countdown yang habis TIDAK boleh menang
   * atas kenyataan pembayaran. Konfirmasi ke server lebih dulu; hanya bila
   * server MENYATAKAN belum terbayar (`PENDING`) status lokal jadi EXPIRED.
   *
   * M-14 (audit end-to-end, issue #9): `synced == null` (cek GAGAL — jaringan
   * dsb.) TIDAK boleh dipaksa EXPIRED — pembayaran bisa saja sudah masuk.
   * Status jadi `UNKNOWN` (nasib belum jelas; panel menawarkan "Cek status
   * sekarang" + "Bayar metode lain", bukan klaim palsu apa pun).
   */
  const expireLocally = useCallback(() => {
    void (async () => {
      const synced = await syncStatus()
      if (synced === "PENDING") {
        setStatus((prev) => {
          const next = prev === "PENDING" || prev == null ? "EXPIRED" : prev
          // M-07 (audit end-to-end, issue #10): expiry lokal yang final ikut
          // menyelesaikan aksi menggantung — dulu pending "qris-payment"
          // tetap nongol di Beranda sampai expiresAt-nya lewat sendiri.
          if (next === "EXPIRED" && orderId) resolvePendingAction("qris-payment", orderId)
          return next
        })
      } else if (synced == null) {
        setStatus((prev) => (prev == null || prev === "PENDING" ? "UNKNOWN" : prev))
      }
    })()
  }, [syncStatus, orderId])

  return {
    qris,
    status,
    pollError,
    stopped,
    creating,
    createIntent,
    syncStatus,
    reset,
    expireLocally,
  }
}
