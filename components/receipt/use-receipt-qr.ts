/**
 * Kahade — hook QR verifikasi struk (defensif).
 *
 * Mengambil token via `POST /v1/receipts/token` lalu meng-encode `verifyUrl`
 * menjadi data URL PNG. Mengembalikan `null` bila endpoint belum ada / gagal —
 * pemanggil merender tiket TANPA QR (tanpa crash, tanpa blokir).
 */
import { useEffect, useState } from "react"

import {
  fetchReceiptToken,
  receiptQrDataUrl,
  type ReceiptKind,
} from "@/lib/receipt"

export function useReceiptQr(
  kind: ReceiptKind,
  referenceId: string | null | undefined,
): string | null {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!referenceId) return
    let alive = true
    const controller = new AbortController()
    void (async () => {
      const token = await fetchReceiptToken(kind, referenceId, controller.signal)
      if (!alive || !token) return
      const dataUrl = await receiptQrDataUrl(token.verifyUrl)
      if (alive) setQrDataUrl(dataUrl)
    })()
    return () => {
      alive = false
      controller.abort()
    }
  }, [kind, referenceId])

  return qrDataUrl
}
