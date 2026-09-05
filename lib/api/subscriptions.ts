/**
 * Kahade — domain `subscriptions` (paket premium bulanan/tahunan).
 */
import { http } from "@/lib/api/client"
import type { RenewDto, SubscribeDto } from "@/lib/api/types"

/** Paket langganan — konsisten dengan public.subscription-plans. */
export type SubscriptionPlan = {
  id: string
  name: string
  price: number
  durationDays: number
  benefits?: string[]
  key?: "MONTHLY" | "ANNUAL"
  monthly?: boolean
}

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
  return http.get<Array<SubscriptionHistoryEntry>>("/v1/subscriptions/history", {
    query,
    auth: "required",
    retry: 1,
  })
}

export function getSubscriptionBenefits() {
  return http.get<Array<{ key: string; title: string; description?: string }>>(
    "/v1/subscriptions/benefits",
    { auth: "required", retry: 1 },
  )
}

export function getSubscriptionPlans() {
  return http.get<Array<SubscriptionPlan>>("/v1/subscriptions/plans", { auth: "required", retry: 1 })
}

export function subscribe(dto: SubscribeDto) {
  return http.post<SubscriptionStatus, SubscribeDto>("/v1/subscriptions/subscribe", dto, {
    auth: "required",
  })
}

export function renewSubscription(dto: RenewDto) {
  return http.post<SubscriptionStatus, RenewDto>("/v1/subscriptions/renew", dto, { auth: "required" })
}

export function cancelSubscription() {
  return http.post<SubscriptionStatus>("/v1/subscriptions/cancel", undefined, { auth: "required" })
}

