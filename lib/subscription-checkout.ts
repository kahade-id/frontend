/**
 * Kahade — resolver daftar metode checkout langganan (Mode Tanpa Wallet
 * Internal, BI-safe).
 *
 * KONTRAK FINAL (2026-09-29): backend TIDAK menyediakan
 * `GET /v1/subscriptions/payment-methods`. Daftar metode = cerminan
 * `DanaDirectPayKind` backend (QRIS | VA | BALANCE) + bank VA yang
 * didokumentasikan di kontrak — `DANA_PAYMENT_METHODS_FALLBACK`
 * (lib/dana-payment.ts) memuat tepat daftar itu. Metode saldo internal
 * TIDAK PERNAH muncul — langganan selalu dibayar langsung via DANA.
 */

import type { OrderPaymentMethod } from "@/lib/api/orders-endpoints"
import {
  DANA_PAYMENT_METHODS_FALLBACK,
  isWalletCheckoutMethod,
  selectDefaultCheckoutMethod,
} from "@/lib/dana-payment"

export { selectDefaultCheckoutMethod }

/**
 * Daftar metode bayar langganan: cerminan kontrak backend (QRIS/VA/BALANCE).
 * Metode dompet internal selalu disaring keluar — langganan tidak bisa
 * dibayar dari saldo. `fromFallback` kini selalu false (tidak ada endpoint
 * backend yang dikejar); dipertahankan agar signature pemanggil stabil.
 */
export async function resolveSubscriptionPaymentMethods(_opts: {
  signal?: AbortSignal
}): Promise<{ methods: OrderPaymentMethod[]; fromFallback: boolean }> {
  // BI-safe: metode dompet internal tidak boleh muncul di checkout
  // langganan — disaring tanpa peduli sumber daftar.
  const noWallet = [...DANA_PAYMENT_METHODS_FALLBACK]
    .filter((m) => m.enabled)
    .filter((m) => !isWalletCheckoutMethod(m.code))
  return { methods: noWallet, fromFallback: false }
}
