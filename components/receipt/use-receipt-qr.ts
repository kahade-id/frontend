/**
 * Kahade — hook QR verifikasi struk (defensif).
 *
 * Mengambil token via `POST /v1/receipts/token` lalu meng-encode `verifyUrl`
 * menjadi data URL PNG. Mengembalikan `null` bila endpoint belum ada / gagal —
 * pemanggil merender tiket TANPA QR (tanpa crash, tanpa blokir).
 */
import { useCallback, useEffect, useState } from "react"

import {
  fetchReceiptToken,
  receiptQrDataUrl,
  type ReceiptKind,
} from "@/lib/receipt"

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
): ReceiptQrState {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!referenceId) return
    let alive = true
    const controller = new AbortController()
    void (async () => {
      const token = await fetchReceiptToken(kind, referenceId, controller.signal)
      if (!alive) return
      if (!token) {
        setFailed(true)
        return
      }
      const url = await receiptQrDataUrl(token.verifyUrl)
      if (!alive) return
      if (url) setDataUrl(url)
      else setFailed(true)
    })()
    return () => {
      alive = false
      controller.abort()
    }
  }, [kind, referenceId, attempt])

  return { dataUrl, failed, retry }
}

/** Kompatibilitas mundur: pemanggil lama hanya butuh data URL. */
export function useReceiptQr(
  kind: ReceiptKind,
  referenceId: string | null | undefined,
): string | null {
  return useReceiptQrState(kind, referenceId).dataUrl
}
