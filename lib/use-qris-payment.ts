/**
 * Kahade — alur pembayaran QRIS di detail order (A-14/A-15, S9 audit 2026-09-22).
 *
 * Mode Tanpa Wallet Internal (2026-09-29): logika dipindah ke
 * `lib/use-order-payment.ts` (generik untuk semua metode DANA); modul ini
 * tinggal wrapper kompatibilitas untuk pemanggil lama — kontrak return
 * (`{ qris, status, … }`) tidak berubah. QRIS kini dibuat lewat
 * `POST /v1/orders/{id}/payments` (DANA) dengan fallback transisi ke
 * `POST /v1/orders/{id}/pay-qris` bila endpoint baru belum live (404).
 */
import { useMemo } from "react"

import type { QrisPayment } from "@/lib/api/orders"
import { useOrderPayment, type UseOrderPaymentOptions } from "@/lib/use-order-payment"

export type UseQrisPaymentOptions = Omit<
  UseOrderPaymentOptions,
  "methodCode" | "methodLabel"
>

export function useQrisPayment(options: UseQrisPaymentOptions) {
  const { intent, ...rest } = useOrderPayment({
    ...options,
    methodCode: "QRIS",
    methodLabel: "QRIS",
  })
  // Intent QRIS selalu membawa qrString (normalizer fail-closed bila tidak).
  const qris: QrisPayment | null = useMemo(
    () =>
      intent?.qrString
        ? {
            qrString: intent.qrString,
            qrUrl: intent.qrUrl,
            expiresAt: intent.expiresAt,
            amount: intent.amount,
            paymentTxId: intent.paymentTxId,
          }
        : null,
    [intent],
  )
  return { ...rest, qris }
}
