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
import type { QrisPayment } from "@/lib/api/orders"
import { recordPendingAction, resolvePendingAction, toEpochMs } from "@/lib/pending-actions"
import { serverNow } from "@/lib/server-time"
import { usePolling } from "@/lib/use-polling"

/** Interval polling status pembayaran (dulu konstanta di layar). */
const POLL_MS = 3_000
/** 300 × 3 detik = 15 menit; setelah cap tercapai UI mengaku berhenti (A-11 lama). */
const MAX_POLLS = 300
/** Status yang tidak perlu dipoll lagi (terminal). */
const TERMINAL = ["PAID", "EXPIRED", "FAILED", "CANCELLED"] as const

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
    try {
      const res = await api.orders.getPaymentStatus(orderId)
      setPollError(null)
      setStatus(res.status)
      if (res.status === "PAID") {
        // J-02: status final — aksi menggantung diselesaikan.
        resolvePendingAction("qris-payment", orderId)
        onPaidRef.current()
      } else if ((TERMINAL as readonly string[]).includes(res.status)) {
        resolvePendingAction("qris-payment", orderId)
      }
      return res.status
    } catch (error) {
      setPollError(userMessage(error))
      return null
    }
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
    Boolean(
      orderId &&
        active &&
        qris &&
        !(TERMINAL as readonly string[]).includes(status ?? "") &&
        pollCount.current < MAX_POLLS,
    ),
  )

  /** Buat intent QRIS (atau sinkronkan dulu bila masih ada intent aktif). */
  const createIntent = useCallback(async () => {
    if (!orderId || !canCreate || creatingRef.current) return
    // A-13 (audit lama, dipertahankan): jangan buat intent kedua selagi intent
    // aktif belum terminal — sinkronkan statusnya lebih dulu.
    if (qris && !(TERMINAL as readonly string[]).includes(status ?? "")) {
      await syncStatus()
      return
    }
    creatingRef.current = true
    setCreating(true)
    try {
      const res = await api.orders.payOrderQris(orderId)
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
      onErrorRef.current(userMessage(err))
      /*
       * Kegagalan tidak pasti (jaringan/timeout): intent mungkin TERBUAT di
       * server meski respons hilang. Sinkronkan status SEKARANG — bukan lewat
       * polling yang masih terkunci pada state render (A-14).
       */
      if (!isApiError(err) || err.isTransient || err.code === "ABORTED") {
        await syncStatus()
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
  }, [])

  /** Dipakai panel saat countdown QR habis: status lokal jadi EXPIRED. */
  const expireLocally = useCallback(
    () => setStatus((prev) => (prev === "PENDING" || prev == null ? "EXPIRED" : prev)),
    [],
  )

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
