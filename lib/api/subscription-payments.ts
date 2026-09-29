/**
 * Kahade — pembayaran langganan Kahade+ via DANA (Mode Tanpa Wallet Internal,
 * BI-safe).
 *
 * KONTRAK FINAL (2026-09-29, `docs/no-wallet-api-contract.md` branch
 * `arsitektur/tanpa-wallet`):
 *   POST /v1/subscriptions/subscribe-dana { plan, payKind, bankCode?, promoCode? }
 *     → { subscriptionId, subscription, qrString, paymentCode, webRedirectUrl, expiredAt }
 *   GET  /v1/subscriptions/dana-status/:id
 *     → { status: PENDING|ACTIVE, qrString, paymentCode, webRedirectUrl, expiredAt }
 *   POST /v1/subscriptions/renew-dana { payKind, bankCode? }
 *     → { paymentTxId, qrString, paymentCode, webRedirectUrl, expiredAt }
 *
 * payKind ∈ { QRIS, VA, BALANCE } — TIDAK di-hardcode di layar; kode metode
 * UI ("QRIS", "VA_BCA", "DANA") dipetakan di `toDanaPayKind` (fail-closed).
 * Langganan TIDAK memakai PIN dompet: tidak ada metode "Saldo Kahade".
 */

import { http, seg } from "@/lib/api/client"
import { asRecord, invalidResponse, pickString } from "@/lib/api/response"
import {
  normalizeOrderPaymentIntent,
  type OrderPaymentIntent,
} from "@/lib/api/orders-endpoints"
import { deviceLocationOnlyBody } from "@/lib/api/device-location"
import type { LocationDto } from "@/lib/api/types"
import type { KahadePlusPlanKey } from "@/lib/api/subscriptions"

/** Path kanonis kontrak no-wallet (bukan analogi). */
export const SUBSCRIBE_DANA_PATH = "/v1/subscriptions/subscribe-dana"
export const RENEW_DANA_PATH = "/v1/subscriptions/renew-dana"
export const danaStatusPath = (subscriptionId: string) =>
  `/v1/subscriptions/dana-status/${seg(subscriptionId)}`

/** payKind backend: QRIS | VA | BALANCE. */
export type DanaDirectPayKind = "QRIS" | "VA" | "BALANCE"

/**
 * Petakan kode metode UI → { payKind, bankCode }.
 * Kode tak dikenal → lempar (fail-closed): jangan menebak metode bayar.
 */
export function toDanaPayKind(methodCode: string): {
  payKind: DanaDirectPayKind
  bankCode?: string
} {
  const code = methodCode.trim().toUpperCase()
  if (code === "QRIS") return { payKind: "QRIS" }
  if (code === "DANA" || code === "BALANCE" || code === "SALDO_DANA")
    return { payKind: "BALANCE" }
  const va = code.match(/^VA[_-]?(BCA|BNI|BRI|MANDIRI|CIMB|PERMATA)$/)
  if (va) return { payKind: "VA", bankCode: va[1] }
  throw invalidResponse(`subscription-pay-kind:${methodCode}`)
}

export type SubscriptionPaymentIntent = OrderPaymentIntent & {
  /** ID subscription PENDING — dipakai polling `dana-status/:id`. */
  subscriptionId?: string
}

/**
 * POST /v1/subscriptions/subscribe-dana — buat subscription PENDING +
 * intent checkout DANA. Idempoten via Idempotency-Key.
 */
export async function createSubscriptionPayment(
  plan: KahadePlusPlanKey,
  methodCode: string,
  idempotencyKey?: string,
  promoCode?: string,
): Promise<SubscriptionPaymentIntent> {
  const { payKind, bankCode } = toDanaPayKind(methodCode)
  const body = await deviceLocationOnlyBody()
  const raw = await http.post<
    unknown,
    {
      deviceLocation: LocationDto | null
      plan: KahadePlusPlanKey
      payKind: DanaDirectPayKind
      bankCode?: string
      promoCode?: string
    }
  >(
    SUBSCRIBE_DANA_PATH,
    {
      ...body,
      plan,
      payKind,
      ...(bankCode ? { bankCode } : {}),
      ...(promoCode ? { promoCode } : {}),
    },
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
  const intent = normalizeOrderPaymentIntent(raw)
  if (!intent) throw invalidResponse("subscription-payment")
  const subscriptionId = pickString(asRecord(raw) ?? {}, ["subscriptionId", "subscription_id"])
  return { ...intent, method: methodCode, subscriptionId: subscriptionId ?? undefined }
}

export type SubscriptionPaymentStatus = {
  status: string
  /** ACTIVE = webhook DANA sukses = langganan aktif. */
  isPaid: boolean
}

/**
 * GET /v1/subscriptions/dana-status/:id — polling status (PENDING/ACTIVE).
 * Tanpa subscriptionId atau tanpa status → lempar (fail-closed).
 */
export async function getSubscriptionPaymentStatus(
  subscriptionId: string,
  signal?: AbortSignal,
): Promise<SubscriptionPaymentStatus> {
  if (!subscriptionId) throw invalidResponse("subscription-payment-status")
  const raw = await http.get<unknown>(danaStatusPath(subscriptionId), {
    auth: "required",
    signal,
  })
  const record = asRecord(raw)
  const nested =
    asRecord(record?.data) ?? asRecord(record?.payment) ?? asRecord(record?.result) ?? record
  const status = nested ? pickString(nested, ["status", "paymentStatus"]) : null
  if (!status) throw invalidResponse("subscription-payment-status")
  const paidFlag = nested?.isPaid ?? nested?.paid ?? nested?.is_paid
  const isPaid =
    status === "ACTIVE" ||
    paidFlag === true ||
    paidFlag === 1 ||
    (typeof paidFlag === "string" && paidFlag.trim().toLowerCase() === "true")
  return { status, isPaid }
}

/**
 * POST /v1/subscriptions/renew-dana — perpanjangan via DANA langsung.
 * Periode diperpanjang webhook setelah bayar sukses.
 */
export async function renewSubscriptionDana(
  methodCode: string,
  idempotencyKey?: string,
): Promise<SubscriptionPaymentIntent> {
  const { payKind, bankCode } = toDanaPayKind(methodCode)
  const body = await deviceLocationOnlyBody()
  const raw = await http.post<
    unknown,
    { deviceLocation: LocationDto | null; payKind: DanaDirectPayKind; bankCode?: string }
  >(
    RENEW_DANA_PATH,
    { ...body, payKind, ...(bankCode ? { bankCode } : {}) },
    {
      auth: "required",
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
    },
  )
  const intent = normalizeOrderPaymentIntent(raw)
  if (!intent) throw invalidResponse("subscription-renew")
  return { ...intent, method: methodCode }
}
