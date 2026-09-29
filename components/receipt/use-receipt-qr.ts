/**
 * Kahade — hook QR verifikasi struk (defensif).
 *
 * Mengambil token via `POST /v1/receipts/token` lalu meng-encode `verifyUrl`
 * menjadi data URL PNG. Mengembalikan `null` bila endpoint belum ada / gagal —
 * pemanggil merender tiket TANPA QR (tanpa crash, tanpa blokir).
 *
 * D1-007 (perf 2026-09-29):
 * - Token POST + encode QR HANYA berjalan bila struk benar-benar akan tampil
 *   (`enabled`, default true) — mis. detail order hanya bila sudah dibayar
 *   (sebelumnya POST jalan untuk SEMUA order, termasuk yang belum bayar dan
 *   tidak pernah merender tiket).
 * - Cache sesi per `(kind, referenceId)`: satu struk = SATU POST + SATU
 *   encode per sesi, walau layar dibuka-tutup berulang. Janji in-flight
 *   dipakai bersama agar dua mount bersamaan tidak menggandakan request.
 *   Kegagalan TIDAK di-cache (tombol "Coba lagi" tetap bisa retry).
 */
import { useCallback, useEffect, useState } from "react"

import {
  fetchReceiptToken,
  receiptQrDataUrl,
  type ReceiptKind,
} from "@/lib/receipt"

/** Cache sesi: (kind, referenceId) -> data URL PNG yang sudah berhasil. */
const receiptQrSessionCache = new Map<string, string>()
/** Janji in-flight yang dipakai bersama antar mount. */
const receiptQrInflight = new Map<string, Promise<string | null>>()

function cacheKeyOf(kind: ReceiptKind, referenceId: string): string {
  return `${kind}:${referenceId}`
}

export type ReceiptQrOptions = {
  /**
   * `false` = struk (belum) dibuka/terlihat — JANGAN fetch token maupun
   * encode QR. Default `true` (kompatibel pemanggil lama: tiket struk
   * langsung tampil di layar hasil).
   */
  enabled?: boolean
}

export type ReceiptQrState = {
  /** Data URL PNG; `null` = belum tersedia. */
  dataUrl: string | null
  /**
   * FE-IMP-4 item 29: `true` bila pengambilan token/encode SUDAH mencoba dan
   * gagal (bukan status loading). Membedakan "gagal" dari "belum dimuat"
   * agar UI bisa menampilkan tombol "Coba lagi".
   */
  failed: boolean
  /** Coba ambil lagi. */
  retry: () => void
}

export function useReceiptQrState(
  kind: ReceiptKind,
  referenceId: string | null | undefined,
  options?: ReceiptQrOptions,
): ReceiptQrState {
  const enabled = options?.enabled ?? true
  const key = referenceId ? cacheKeyOf(kind, referenceId) : null
  const [dataUrl, setDataUrl] = useState<string | null>(() =>
    key ? (receiptQrSessionCache.get(key) ?? null) : null,
  )
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    // D1-007: struk belum dibuka/terlihat -> jangan sentuh network/CPU.
    if (!referenceId || !key || !enabled) return
    const cached = receiptQrSessionCache.get(key)
    if (cached) {
      setDataUrl(cached)
      return
    }
    let alive = true
    let promise = receiptQrInflight.get(key)
    if (!promise) {
      // D1-007 (review): janji bersama TIDAK diikat ke AbortController mount
      // pertama — abort mount pertama tidak boleh membatalkan fetch yang
      // masih dipakai mount lain. Ini one-shot (bukan stream); request yang
      // yatim tetap menyelesaikan + mengisi cache sesi.
      promise = (async () => {
        const token = await fetchReceiptToken(kind, referenceId)
        if (!token) return null
        return receiptQrDataUrl(token.verifyUrl)
      })()
      receiptQrInflight.set(key, promise)
    }
    void promise.then(
      (url) => {
        receiptQrInflight.delete(key)
        if (!alive) return
        if (url) {
          receiptQrSessionCache.set(key, url)
          setDataUrl(url)
        } else {
          setFailed(true)
        }
      },
      () => {
        // Penolakan tak terduga: jangan biarkan janji rusak menempel di
        // inflight (retry berikutnya harus fetch ulang).
        receiptQrInflight.delete(key)
        if (alive) setFailed(true)
      },
    )
    return () => {
      alive = false
    }
    // `key` sudah mencakup kind + referenceId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, referenceId, enabled, attempt])

  return { dataUrl, failed, retry }
}

/** Kompatibilitas mundur: pemanggil lama hanya butuh data URL. */
export function useReceiptQr(
  kind: ReceiptKind,
  referenceId: string | null | undefined,
  options?: ReceiptQrOptions,
): string | null {
  return useReceiptQrState(kind, referenceId, options).dataUrl
}
