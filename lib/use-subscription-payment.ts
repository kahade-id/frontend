/**
 * Kahade — alur pembayaran langganan Kahade+ via DANA (Mode Tanpa Wallet
 * Internal, BI-safe).
 *
 * Wrapper di atas `lib/use-dana-intent.ts` (siklus intent generik: buat
 * intent, polling status tiap 3 detik, batas 15 menit, rekonsiliasi setelah
 * kegagalan tak pasti + catatan aksi menggantung `subscription-payment` yang
 * pulih ke daftar paket). Langganan TIDAK memakai PIN dompet — hanya metode
 * DANA dinamis dari backend.
 */
import { useMemo } from "react"

import {
  createSubscriptionPayment,
  getSubscriptionPaymentStatus,
} from "@/lib/api/subscription-payments"
import type { KahadePlusPlanKey } from "@/lib/api/subscriptions"
import { useDanaIntent, type DanaIntentAdapter } from "@/lib/use-dana-intent"

export type UseSubscriptionPaymentOptions = {
  /** Paket yang dibayar; `null` saat belum dipilih. */
  plan: KahadePlusPlanKey | null
  /** Kode metode DANA (mis. "QRIS", "VA_BCA", "DANA"). */
  methodCode: string
  /** Label metode untuk copy error/banner. Default = methodCode. */
  methodLabel?: string
  /** Nominal paket — fallback bila respons server tidak memuat `amount`. */
  fallbackAmount: number
  /** Sheet pembayaran sedang terbuka; polling hanya hidup saat true. */
  active: boolean
  /** Dipanggil sekali saat status server menjadi PAID. */
  onPaid: () => void
  /** Galat pembuatan intent — layar menampilkannya sebagai toast. */
  onError: (message: string) => void
}

export function useSubscriptionPayment({
  plan,
  methodCode,
  methodLabel,
  fallbackAmount,
  active,
  onPaid,
  onError,
}: UseSubscriptionPaymentOptions) {
  const adapter = useMemo<DanaIntentAdapter | null>(
    () =>
      plan
        ? {
            actionKey: plan,
            pendingKind: "subscription-payment",
            createIntent: (code, idempotencyKey) =>
              createSubscriptionPayment(plan, code, idempotencyKey),
            getStatus: () => getSubscriptionPaymentStatus(),
          }
        : null,
    [plan],
  )

  return useDanaIntent({
    adapter,
    methodCode,
    methodLabel,
    fallbackAmount,
    active,
    // Langganan: user yang login selalu boleh membuat intent (backend yang
    // memutuskan kelayakan paket di server).
    canCreate: plan != null,
    onPaid,
    onError,
  })
}
