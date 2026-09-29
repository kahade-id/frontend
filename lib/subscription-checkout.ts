/**
 * Kahade — resolver daftar metode checkout langganan (Mode Tanpa Wallet
 * Internal, BI-safe).
 *
 * Cerminan `resolveCheckoutPaymentMethods` (lib/dana-payment.ts) untuk jalur
 * langganan: backend dulu (`GET /v1/subscriptions/payment-methods`), fallback
 * DANA statis bila endpoint belum tersedia (404/network). Metode saldo
 * internal TIDAK PERNAH muncul — langganan selalu dibayar langsung via DANA,
 * kill-switch tidak relevan di jalur ini.
 */

import { getSubscriptionPaymentMethods } from "@/lib/api/subscription-payments"
import type { OrderPaymentMethod } from "@/lib/api/orders-endpoints"
import {
  DANA_PAYMENT_METHODS_FALLBACK,
  isWalletCheckoutMethod,
  selectDefaultCheckoutMethod,
} from "@/lib/dana-payment"

export { selectDefaultCheckoutMethod }

/**
 * Ambil daftar metode bayar langganan: backend menang; gagal total → fallback
 * statis DANA (ditandai). Metode dompet internal selalu disaring keluar —
 * langganan tidak bisa dibayar dari saldo, apa pun kata backend.
 */
export async function resolveSubscriptionPaymentMethods(opts: {
  signal?: AbortSignal
}): Promise<{ methods: OrderPaymentMethod[]; fromFallback: boolean }> {
  let raw: OrderPaymentMethod[]
  let fromFallback = false
  try {
    raw = await getSubscriptionPaymentMethods(opts.signal)
  } catch {
    raw = [...DANA_PAYMENT_METHODS_FALLBACK]
    fromFallback = true
  }
  // BI-safe: metode dompet internal tidak boleh muncul di checkout
  // langganan — disaring tanpa peduli respons backend (lama).
  const noWallet = raw
    .filter((m) => m.enabled)
    .filter((m) => !isWalletCheckoutMethod(m.code))
  const methods = noWallet.length > 0 ? noWallet : fromFallback ? [...DANA_PAYMENT_METHODS_FALLBACK] : []
  return { methods, fromFallback }
}
