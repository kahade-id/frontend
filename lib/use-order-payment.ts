/**
 * Kahade — alur pembayaran order via DANA di detail order (Mode Tanpa Wallet
 * Internal, BI-safe).
 *
 * Wrapper kompatibel di atas `lib/use-dana-intent.ts` (siklus intent generik
 * untuk SEMUA metode DANA — buat intent (`POST /v1/orders/{id}/payments`),
 * polling status tiap 3 detik, batas 15 menit, rekonsiliasi setelah kegagalan
 * tak pasti). Seluruh proteksi audit yang dulu menempel di jalur QRIS (A-13,
 * A-14, C-05, C-10, C-11, G-04, I-07, J-02, J-04, M-04, M-05, M-07, M-08,
 * M-13, M-14, M-1) kini hidup di hook generik — kontrak return hook ini TIDAK
 * berubah, jadi layar & `use-qris-payment.ts` tidak perlu disentuh.
 *
 * Layar tetap memiliki presentasi (panel per metode) dan navigasi.
 */
import { useMemo } from "react"

import { api } from "@/lib/api"
import { useDanaIntent, type DanaIntentAdapter } from "@/lib/use-dana-intent"

export type UseOrderPaymentOptions = {
  /** Order yang sedang dibuka, `null` saat parameter rute belum siap. */
  orderId: string | null
  /** Kode metode DANA (mis. "QRIS", "VA_BCA", "DANA"). */
  methodCode: string
  /** Label metode untuk copy error/banner (mis. "QRIS"). Default = methodCode. */
  methodLabel?: string
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

export function useOrderPayment({
  orderId,
  methodCode,
  methodLabel,
  fallbackAmount,
  active,
  canCreate,
  onPaid,
  onError,
}: UseOrderPaymentOptions) {
  const adapter = useMemo<DanaIntentAdapter | null>(
    () =>
      orderId
        ? {
            actionKey: orderId,
            pendingKind: "order-payment",
            createIntent: (code, idempotencyKey) =>
              api.orders.createOrderPayment(orderId, code, idempotencyKey),
            getStatus: () =>
              api.orders
                .getPaymentStatus(orderId)
                // MFE-006: teruskan info refund async (refundedAmount /
                // refundReference) dari `normalizePaymentStatus` ke hook —
                // panel merender "Dana dikembalikan RpX" dari sini.
                .then((s) => ({
                  status: s.status,
                  isPaid: s.isPaid === true,
                  refundedAmount: s.refundedAmount ?? 0,
                  refundReference: s.refundReference ?? null,
                })),
          }
        : null,
    [orderId],
  )

  return useDanaIntent({
    adapter,
    methodCode,
    methodLabel,
    fallbackAmount,
    active,
    canCreate,
    onPaid,
    onError,
  })
}
