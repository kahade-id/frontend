/**
 * Kahade — siklus hidup intent pembayaran DANA yang generik (Mode Tanpa
 * Wallet Internal, BI-safe).
 *
 * Diekstrak dari `lib/use-order-payment.ts`: SELURUH proteksi audit yang dulu
 * menempel di jalur pembayaran order (A-13, A-14, C-05, C-10, C-11, G-04,
 * I-07, J-02, J-04, M-04, M-05, M-07, M-08, M-13, M-14, M-1) dipertahankan di
 * sini — satu tempat untuk semua konteks pembayaran (order, langganan, …).
 *
 * Perbedaan antar konteks disuntik lewat `adapter`:
 * - `key`: pengenal untuk pending-actions (`orderId` / `"subscription"`),
 * - `pendingKind`: jenis aksi menggantung,
 * - `createIntent(methodCode, idempotencyKey)`: buat intent di backend,
 * - `getStatus()`: baca status intent berjalan ({ status, isPaid }).
 *
 * Layar tetap memiliki presentasi (panel per metode) dan navigasi.
 */
import { useCallback, useRef, useState } from "react"

import { isApiError, userMessage } from "@/lib/api"
import { assertDeviceNotCompromised } from "@/lib/device-integrity"
import { createIdempotencyKey } from "@/lib/api/client"
import type { OrderPaymentIntent } from "@/lib/api/orders"
import {
  recordPendingAction,
  resolvePendingAction,
  toEpochMs,
  type PendingAction,
} from "@/lib/pending-actions"
import { serverNow } from "@/lib/server-time"
import { usePolling } from "@/lib/use-polling"

/**
 * PERF-FIX (network P0): polling adaptif dua fase.
 *
 * Fase cepat: 3 detik selama ~60 detik pertama — responsif saat pengguna baru
 * membayar (mayoritas pembayaran DANA selesai < 60 dtk).
 * Fase lambat: 12 detik setelahnya — 4× lebih hemat saat menunggu lama.
 * Dulu flat 3 dtk hingga 300×/sheet; saat insiden DANA tiap sheet checkout
 * yang terbuka ikut memperkuat badai 429 (lihat C-09 di lib/use-polling.ts).
 */
const POLL_MS_FAST = 3_000
const POLL_MS_SLOW = 12_000
/** Jumlah poll fase cepat sebelum melambat (20 × 3 dtk = 60 dtk). */
const FAST_POLLS = 20
/**
 * Cap jumlah poll: 20 cepat + 70 lambat ≈ 15 menit (60 + 840 dtk) — anggaran
 * wall-clock SAMA seperti sebelumnya (300 × 3 dtk), tapi 3,3× lebih sedikit
 * request. C-10 (audit escrow 2026-09-24): setelah cap, UI berhenti polling
 * TETAPI tetap menyediakan "Cek status sekarang" + "Bayar metode lain"
 * (bukan berhenti tanpa jalan keluar).
 */
const MAX_POLLS = 90
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

/**
 * Adapter backend per konteks pembayaran. `null` = konteks belum siap
 * (orderId belum ada, dsb.) — hook nonaktif total sampai adapter tersedia.
 */
export type DanaIntentAdapter = {
  /** Kunci unik aksi (order id / kunci paket langganan) untuk pending-actions. */
  actionKey: string
  /** Jenis catatan aksi menggantung. */
  pendingKind: Extract<PendingAction["kind"], "qris-payment" | "order-payment" | "subscription-payment">
  /**
   * Buat intent pembayaran di backend. Kunci idempotensi dipegang pemanggil
   * (hook) — adapter meneruskannya apa adanya.
   */
  createIntent: (methodCode: string, idempotencyKey: string) => Promise<OrderPaymentIntent>
  /** Satu kali baca status intent berjalan. */
  getStatus: () => Promise<{ status: string; isPaid: boolean }>
}

export type UseDanaIntentOptions = {
  /** Adapter konteks pembayaran, `null` saat belum siap. */
  adapter: DanaIntentAdapter | null
  /** Kode metode DANA (mis. "QRIS", "VA_BCA", "DANA"). */
  methodCode: string
  /** Label metode untuk copy error/banner (mis. "QRIS"). Default = methodCode. */
  methodLabel?: string
  /** Nominal — fallback bila respons server tidak memuat `amount`. */
  fallbackAmount: number
  /** Sheet pembayaran sedang terbuka; polling hanya hidup saat true. */
  active: boolean
  /** Apakah pemanggil boleh membuat intent (mis. hanya pembeli). */
  canCreate: boolean
  /** Dipanggil sekali saat status server menjadi PAID (tutup sheet + refresh). */
  onPaid: () => void
  /** Galat pembuatan intent — layar menampilkannya sebagai toast. */
  onError: (message: string) => void
}

export function useDanaIntent({
  adapter,
  methodCode,
  methodLabel,
  fallbackAmount,
  active,
  canCreate,
  onPaid,
  onError,
}: UseDanaIntentOptions) {
  const label = methodLabel ?? methodCode
  const [intent, setIntent] = useState<OrderPaymentIntent | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [stopped, setStopped] = useState(false)
  const [creating, setCreating] = useState(false)
  // UI-T019 (audit UI/UX 2026-09-27): indikator visual saat sync status
  // berjalan (manual "Cek status sekarang" / tick poll) — display only.
  const [syncing, setSyncing] = useState(false)
  const pollCount = useRef(0)
  /**
   * PERF-FIX (network P0): fase polling. `false` = 3 dtk (60 dtk pertama),
   * `true` = 12 dtk. Berpindah sekali saat poll ke-20; memicu re-render satu
   * kali dan `usePolling` menjadwal ulang dengan interval baru (aman: callback
   * tidak memakai AbortSignal poller, jadi re-arm tidak membatalkan apa pun).
   */
  const [pollSlow, setPollSlow] = useState(false)
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
  const adapterRef = useRef(adapter)
  adapterRef.current = adapter

  // `qris-payment` dipertahankan untuk catatan lama order; langganan selalu
  // memakai `subscription-payment` (banner pemulihan mengarah ke paket,
  // bukan ke detail order).
  const paymentKind: Extract<
    PendingAction["kind"],
    "qris-payment" | "order-payment" | "subscription-payment"
  > =
    adapter?.pendingKind === "subscription-payment"
      ? "subscription-payment"
      : methodCode === "QRIS"
        ? "qris-payment"
        : "order-payment"

  /**
   * Satu kali baca status pembayaran. Dipakai polling DAN sebagai jalur
   * rekonsiliasi setelah kegagalan tak pasti (A-14).
   */
  const syncStatus = useCallback(async (): Promise<string | null> => {
    const current = adapterRef.current
    if (!current) return null
    // G-04 (audit escrow 2026-09-24): tick poll dan `syncStatus` manual
    // (createIntent/onCheckStatus) tidak boleh berjalan paralel — satu
    // request dalam satu waktu; pemanggil berikutnya membagi hasil yang sama.
    if (syncInFlight.current) return syncInFlight.current
    setSyncing(true)
    const run = (async () => {
      try {
        const res = await current.getStatus()
        setPollError(null)
        setStatus(res.status)
        // M-06 (audit end-to-end, issue #8): `isPaid` boolean server ikut
        // dipercaya (alias `is_paid|paid|number 1/0` dinormalisasi strict) —
        // dulu hanya `status === "PAID"`; status tak dikenali + `isPaid:true`
        // tidak pernah memicu onPaid.
        if (res.status === "PAID" || res.isPaid === true) {
          setStatus("PAID")
          // J-02: status final — aksi menggantung diselesaikan.
          resolvePendingAction(paymentKind, current.actionKey)
          onPaidRef.current()
        } else if (isTerminalStatus(res.status)) {
          resolvePendingAction(paymentKind, current.actionKey)
        }
        return res.status
      } catch (error) {
        setPollError(userMessage(error))
        return null
      } finally {
        syncInFlight.current = null
        setSyncing(false)
      }
    })()
    syncInFlight.current = run
    return run
  }, [paymentKind])

  usePolling(
    async () => {
      if (pollCount.current >= MAX_POLLS) {
        setStopped(true)
        return
      }
      pollCount.current += 1
      // PERF-FIX (network P0): tepat sekali, setelah 60 dtk pertama —
      // turunkan laju 3 dtk → 12 dtk untuk sisa masa tunggu.
      if (pollCount.current === FAST_POLLS) setPollSlow(true)
      await syncStatus()
    },
    pollSlow ? POLL_MS_SLOW : POLL_MS_FAST,
    Boolean(adapter && active && intent && !isPollStopStatus(status) && pollCount.current < MAX_POLLS),
  )

  /** Buat intent pembayaran (atau sinkronkan dulu bila masih ada intent aktif). */
  const createIntent = useCallback(async () => {
    const current = adapterRef.current
    if (!current || !canCreate || creatingRef.current) return
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
    if (intent && !isTerminalStatus(status)) {
      const synced = await syncStatus()
      if (synced == null || synced === "PAID" || !isTerminalStatus(synced)) return
    }
    // M-1 (audit ronde-2): blokir pembuatan intent bayar di perangkat
    // rooted/jailbroken — sebelum intent dibuat & dana bergerak.
    if (!(await assertDeviceNotCompromised())) return
    creatingRef.current = true
    setCreating(true)
    try {
      const res = await current.createIntent(
        methodCode,
        intentKeyRef.current ?? (intentKeyRef.current = createIdempotencyKey()),
      )
      intentKeyRef.current = null
      setIntent(res)
      setStatus("PENDING")
      setStopped(false)
      setPollSlow(false)
      pollCount.current = 0
      // J-04: pembayaran yang ditinggalkan bisa dipulihkan dari Beranda.
      const recordBase = {
        amount: res.amount ?? fallbackAmount,
        createdAt: serverNow(),
        expiresAt: toEpochMs(res.expiresAt),
      }
      if (paymentKind === "qris-payment") {
        recordPendingAction({
          kind: "qris-payment",
          orderId: current.actionKey,
          ...recordBase,
        })
      } else if (paymentKind === "subscription-payment") {
        recordPendingAction({
          kind: "subscription-payment",
          plan: current.actionKey,
          methodName: label,
          ...recordBase,
        })
      } else {
        recordPendingAction({
          kind: "order-payment",
          orderId: current.actionKey,
          methodName: label,
          ...recordBase,
        })
      }
    } catch (err) {
      /*
       * Kegagalan tidak pasti (jaringan/timeout/PARSE): intent mungkin TERBUAT
       * di server meski respons hilang. Sinkronkan status SEKARANG (A-14).
       * M-13 (audit end-to-end, issue #14): toast error TIDAK muncul duluan —
       * dulu user selalu melihat "gagal" padahal pembayaran bisa jadi sudah
       * terbit. Pesan yang tampil netral; kegagalan PASTI tetap memakai pesan
       * error.
       */
      const uncertain =
        !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
      if (uncertain) {
        onErrorRef.current(
          `Koneksi bermasalah — ${label} mungkin sudah dibuat. Memeriksa status…`,
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
  }, [canCreate, fallbackAmount, label, methodCode, intent, paymentKind, status, syncStatus])

  /** Kembalikan ke keadaan awal (dulu tiga setState + reset hitungan di layar). */
  const reset = useCallback(() => {
    setIntent(null)
    setStatus(null)
    setPollError(null)
    setStopped(false)
    setPollSlow(false)
    pollCount.current = 0
    intentKeyRef.current = null
  }, [])

  /**
   * Dipakai panel saat countdown habis.
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
    const current = adapterRef.current
    void (async () => {
      const synced = await syncStatus()
      if (synced === "PENDING") {
        setStatus((prev) => {
          const next = prev === "PENDING" || prev == null ? "EXPIRED" : prev
          // M-07 (audit end-to-end, issue #10): expiry lokal yang final ikut
          // menyelesaikan aksi menggantung — dulu pending "qris-payment"
          // tetap nongol di Beranda sampai expiresAt-nya lewat sendiri.
          if (next === "EXPIRED" && current) resolvePendingAction(paymentKind, current.actionKey)
          return next
        })
      } else if (synced == null) {
        setStatus((prev) => (prev == null || prev === "PENDING" ? "UNKNOWN" : prev))
      }
    })()
  }, [syncStatus, paymentKind])

  return {
    intent,
    status,
    pollError,
    stopped,
    creating,
    syncing,
    createIntent,
    syncStatus,
    reset,
    expireLocally,
  }
}
