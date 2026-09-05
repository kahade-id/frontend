/** Public contracts verified against api.kahade.id on 2026-09-05; see tests/fixtures. */
import { Platform } from "react-native"
import { http } from "@/lib/api/client"
import {
  normalizeAppVersion,
  normalizeBanks,
  normalizeExchangeRates,
  normalizeFeeSchedule,
  normalizePublicConfig,
  normalizeSubscriptionPlans,
} from "@/lib/api/public-contract"
export type {
  AppVersionInfo,
  Bank,
  ExchangeRates,
  FeeSchedule,
  PublicConfig,
  SubscriptionPlan,
} from "@/lib/api/public-contract"
const opts = { auth: "none" as const, retry: 1 }

export function getAppVersion() {
  return http
    .get<unknown>("/v1/public/app-version", opts)
    .then((body) => normalizeAppVersion(body, Platform.OS))
}
export function getPublicConfig() {
  return http.get<unknown>("/v1/public/config", opts).then(normalizePublicConfig)
}
export function getFeeSchedule() {
  return http.get<unknown>("/v1/public/fee-schedule", opts).then(normalizeFeeSchedule)
}
export function getBanks() {
  return http.get<unknown>("/v1/public/banks", opts).then(normalizeBanks)
}
export function getSubscriptionPlans() {
  return http.get<unknown>("/v1/public/subscription-plans", opts).then(normalizeSubscriptionPlans)
}
export function getExchangeRates() {
  return http.get<unknown>("/v1/public/exchange-rates", opts).then(normalizeExchangeRates)
}
