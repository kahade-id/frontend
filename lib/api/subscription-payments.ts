/**
 * Kahade — pembayaran langganan Kahade+ via DANA (Mode Tanpa Wallet Internal,
 * BI-safe).
 *
 * KONTRAK PENDING (2026-09-29): tim backend `arsitektur/tanpa-wallet` BELUM
 * mendefinisikan endpoint pembayaran langganan. Path di bawah ANALOG dengan
 * kontrak pembayaran order yang sudah kanonis:
 *   GET  /v1/orders/{id}/payment-methods  →  GET  /v1/subscriptions/payment-methods
 *   POST /v1/orders/{id}/payments          →  POST /v1/subscriptions/payments
 *   GET  /v1/orders/{id}/payment-status    →  GET  /v1/subscriptions/payment-status
 *
 * Bila backend memakai path berbeda, cukup ubah tiga konstanta PATH di sini —
 * layar & hook tidak perlu disentuh. Respons dinormalisasi dengan normalizer
 * yang SAMA dengan checkout order (toleran bentuk, fail-closed).
 *
 * Langganan TIDAK memakai PIN dompet: tidak ada metode "Saldo Kahade" —
 * daftar metode difilter di `lib/subscription-checkout.ts`.
 */

import { http } from "@/lib/api/client"
import { asRecord, invalidResponse, pickString } from "@/lib/api/response"
import {
  normalizeOrderPaymentIntent,
  normalizeOrderPaymentMethods,
  type OrderPaymentIntent,
  type OrderPaymentMethod,
} from "@/lib/api/orders-endpoints"
import {
  deviceLocationOnlyBody,
} from "@/lib/api/device-location"
import type { LocationDto } from "@/lib/api/types"
import type { KahadePlusPlanKey } from "@/lib/api/subscriptions"

export const SUBSCRIPTION_PAYMENT_METHODS_PATH = "/v1/subscriptions/payment-methods"
export const SUBSCRIPTION_PAYMENTS_PATH = "/v1/subscriptions/payments"
export const SUBSCRIPTION_PAYMENT_STATUS_PATH = "/v1/subscriptions/payment-status"

/**
 * GET /v1/subscriptions/payment-methods — daftar metode DANA yang boleh
 * dipakai membayar langganan (render dinamis, jangan hardcode). Gagal parse
 * → lempar (fail-closed), bukan daftar kosong yang diam.
 */
export async function getSubscriptionPaymentMethods(
  signal?: AbortSignal,
): Promise<OrderPaymentMethod[]> {
  return http
    .get<unknown>(SUBSCRIPTION_PAYMENT_METHODS_PATH, { auth: "required", signal })
    .then((raw) => {
      const methods = normalizeOrderPaymentMethods(raw)
      if (!methods) throw invalidResponse("subscription-payment-methods")
      return methods
    })
}

/**
 * POST /v1/subscriptions/payments { plan, paymentMethod } — buat intent
 * pembayaran DANA untuk langganan. Body membawa deviceLocation (kontrak
 * lintas tim 2026-09-27) + Idempotency-Key bila diberikan pemanggil.
 */
export async function createSubscriptionPayment(
  plan: KahadePlusPlanKey,
  methodCode: string,
  idempotencyKey?: string,
): Promise<OrderPaymentIntent> {
  const body = await deviceLocationOnlyBody()
  const raw = await http.post<
    unknown,
    { deviceLocation: LocationDto | null; plan: KahadePlusPlanKey; paymentMethod: string }
  >(
    SUBSCRIPTION_PAYMENTS_PATH,
    { ...body, plan, paymentMethod: methodCode },
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
  const intent = normalizeOrderPaymentIntent(raw)
  if (!intent) throw invalidResponse("subscription-payment")
  return { ...intent, method: methodCode }
}

export type SubscriptionPaymentStatus = {
  status: string
  /** Boolean server yang dinormalisasi strict (alias is_paid|paid|1/0). */
  isPaid: boolean
}

/** GET /v1/subscriptions/payment-status — status pembayaran langganan berjalan. */
export async function getSubscriptionPaymentStatus(
  signal?: AbortSignal,
): Promise<SubscriptionPaymentStatus> {
  return http
    .get<unknown>(SUBSCRIPTION_PAYMENT_STATUS_PATH, { auth: "required", signal })
    .then((raw) => {
      const record = asRecord(raw)
      const nested =
        asRecord(record?.data) ?? asRecord(record?.payment) ?? asRecord(record?.result) ?? record
      const status = nested ? pickString(nested, ["status", "paymentStatus"]) : null
      if (!status) throw invalidResponse("subscription-payment-status")
      const paidRaw = nested?.isPaid ?? nested?.paid ?? nested?.is_paid
      const isPaid =
        paidRaw === true || paidRaw === 1 || (typeof paidRaw === "string" && paidRaw.trim().toLowerCase() === "true")
      return { status, isPaid: isPaid || status === "PAID" }
    })
}
