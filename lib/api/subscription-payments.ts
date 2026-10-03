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
 *   (BFE-073: POST /v1/subscriptions/renew-dana sengaja TIDAK di-wire FE —
 *    perpanjangan = subscribe ulang; fungsi mati `renewSubscriptionDana`
 *    dihapus 2026-10-03.)
 *
 * payKind ∈ { QRIS, VA, BALANCE } — TIDAK di-hardcode di layar; kode metode
 * UI ("QRIS", "VA_BCA", "DANA") dipetakan di `toDanaPayKind` (fail-closed).
 * Langganan TIDAK memakai PIN dompet: tidak ada metode "Saldo Kahade".
 */

import { http, seg } from "@/lib/api/client"
import { asRecord, invalidResponse, pickString } from "@/lib/api/response"
import {
  normalizeOrderPaymentIntent,
  toDanaPayKind,
  type DanaDirectPayKind,
  type OrderPaymentIntent,
} from "@/lib/api/orders-endpoints"
import type { KahadePlusPlanKey } from "@/lib/api/subscriptions"

/** Path kanonis kontrak no-wallet (bukan analogi). */
export const SUBSCRIBE_DANA_PATH = "/v1/subscriptions/subscribe-dana"
export const danaStatusPath = (subscriptionId: string) =>
  `/v1/subscriptions/dana-status/${seg(subscriptionId)}`

// `toDanaPayKind` + `DanaDirectPayKind` dipindahkan ke
// `lib/api/orders-endpoints.ts` (2026-09-30) agar alur order memakai pemetaan
// yang sama — diekspor ulang di sini untuk kompatibilitas pemanggil lama.
export { toDanaPayKind, type DanaDirectPayKind }

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
  fallbackAmount?: number,
): Promise<SubscriptionPaymentIntent> {
  const { payKind, bankCode } = toDanaPayKind(methodCode)
  // BFI-079: body HANYA { plan, payKind, bankCode?, promoCode? } —
  // `SubscribeDanaDto` tidak mengenal `deviceLocation`; ValidationPipe global
  // (forbidNonWhitelisted, 422) menolak seluruh request karenanya.
  const raw = await http.post<
    unknown,
    {
      plan: KahadePlusPlanKey
      payKind: DanaDirectPayKind
      bankCode?: string
      promoCode?: string
    }
  >(
    SUBSCRIBE_DANA_PATH,
    {
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
  const intent = normalizeOrderPaymentIntent(raw, { allowMissingAmount: true })
  if (!intent) throw invalidResponse("subscription-payment")
  // Kontrak kanonis (2026-09-30): `subscribeDana` mengembalikan
  // `{ subscription: { id, … }, qrString, … }` — ID ada di NESTED
  // `subscription.id`, bukan root `subscriptionId`. Keduanya dibaca agar
  // polling `dana-status/:id` bisa jalan; tanpa ini UI melempar
  // "ID langganan belum tersedia."
  const root = asRecord(raw) ?? {}
  const nestedSub = asRecord(root.subscription)
  const subscriptionId =
    pickString(root, ["subscriptionId", "subscription_id"]) ??
    (nestedSub ? pickString(nestedSub, ["id", "subscriptionId", "subscription_id"]) : null)
  // SEC-404: nominal dari fallbackAmount (data plan) bila server tidak mengembalikan amount.
  // Ini nominal paket yang valid, bukan tebakan — berbeda dengan fallbackAmount menyesatkan (SEC-405).
  const amount = intent.amount ?? fallbackAmount
  if (amount == null) throw invalidResponse("subscription-payment")
  return { ...intent, amount, method: methodCode, subscriptionId: subscriptionId ?? undefined }
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

/*
 * BFE-073 (2026-10-03): `renewSubscriptionDana` DIHAPUS — dead code (nol
 * pemanggil di app/lib/components; tidak ada UI perpanjangan). Endpoint
 * backend POST /v1/subscriptions/renew-dana tetap hidup, tapi FE sengaja
 * tidak me-wire-nya: perpanjangan saat ini = subscribe ulang. Bila alur
 * perpanjangan dibutuhkan lagi, tulis ulang mengikuti kontrak backend +
 * polling status (backend tidak menyediakan endpoint status paymentTxId
 * renewal). `RENEW_DANA_PATH` ikut dihapus.
 */
