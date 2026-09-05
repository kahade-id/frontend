import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { assertDtoConstraints } from "@/lib/financial"
import { readList } from "@/lib/api/response"
/**
 * Kahade — domain `subscriptions` (paket premium bulanan/tahunan).
 */
import { http } from "@/lib/api/client"
import type { RenewDto, SubscribeDto } from "@/lib/api/types"

export type { SubscriptionPlan } from "@/lib/api/public-contract"
import { normalizeSubscriptionPlans } from "@/lib/api/public-contract"

/** Status langganan aktif — UNVERIFIED. */
export type SubscriptionStatus = {
  active: boolean
  plan?: string
  expiresAt?: string | null
  autoRenew?: boolean
}

export type SubscriptionHistoryEntry = {
  id: string
  plan: string
  amount: number
  status: string
  createdAt: string
  expiresAt?: string | null
}

export function getSubscriptionStatus() {
  return http.get<SubscriptionStatus>("/v1/subscriptions/status", { auth: "required", retry: 1 })
}

export function getSubscriptionHistory(query?: { page?: number; limit?: number }) {
  return http
    .get<Array<SubscriptionHistoryEntry>>("/v1/subscriptions/history", {
      query,
      auth: "required",
      retry: 1,
    })
    .then((raw) => readList<SubscriptionHistoryEntry>(raw, ["history", "subscriptions"]))
}

export function getSubscriptionBenefits() {
  return http
    .get<
      Array<{ key: string; title: string; description?: string }>
    >("/v1/subscriptions/benefits", { auth: "required", retry: 1 })
    .then((raw) =>
      readList<{ key: string; title: string; description?: string }>(raw, ["benefits"]),
    )
}

export function getSubscriptionPlans() {
  return http
    .get<unknown>("/v1/subscriptions/plans", { auth: "required", retry: 1 })
    .then(normalizeSubscriptionPlans)
}

export function subscribe(dto: SubscribeDto) {
  assertDtoConstraints(dto, API_CONSTRAINTS.SubscribeDto)
  return http.post<SubscriptionStatus, SubscribeDto>("/v1/subscriptions/subscribe", dto, {
    auth: "required",
  })
}

export function renewSubscription(dto: RenewDto) {
  return http.post<SubscriptionStatus, RenewDto>("/v1/subscriptions/renew", dto, {
    auth: "required",
  })
}

export function cancelSubscription() {
  return http.post<SubscriptionStatus>("/v1/subscriptions/cancel", undefined, { auth: "required" })
}
