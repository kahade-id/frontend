/**
 * Kahade — domain `public` (6 endpoint tanpa autentikasi).
 *
 * Dipakai sebelum login: Onboarding (cek versi minimum → force update),
 * kalkulator biaya publik, daftar bank untuk form rekening.
 *
 * Semua `auth: "none"` — jangan sampai 401 aneh di endpoint publik memicu
 * refresh token. Semua GET idempoten → `retry: 1`.
 *
 * Tipe response UNVERIFIED (spec tidak mendefinisikan) — bentuk minimal.
 */
import { http } from "@/lib/api/client"

export type AppVersionInfo = {
  /** Versi minimum yang masih boleh dipakai; di bawah ini → force update */
  minVersion: string
  latestVersion: string
  /** Pesan opsional untuk dialog pembaruan */
  message?: string | null
  storeUrl?: { ios?: string; android?: string } | null
}

export type PublicConfig = Record<string, string | number | boolean | null>

export type FeeSchedule = {
  tiers: Array<{ minValue: number; maxValue: number | null; feePercent?: number; feeFlat?: number }>
  minFee?: number
  maxFee?: number
}

export type Bank = { code: string; name: string; logoUrl?: string | null }

export type SubscriptionPlan = {
  id: string
  name: string
  price: number
  durationDays: number
  benefits?: string[]
}

export type ExchangeRates = { base: string; rates: Record<string, number>; updatedAt: string }

const opts = { auth: "none" as const, retry: 1 }

export function getAppVersion() {
  return http.get<AppVersionInfo>("/v1/public/app-version", opts)
}

export function getPublicConfig() {
  return http.get<PublicConfig>("/v1/public/config", opts)
}

export function getFeeSchedule() {
  return http.get<FeeSchedule>("/v1/public/fee-schedule", opts)
}

export function getBanks() {
  return http.get<Bank[]>("/v1/public/banks", opts)
}

export function getSubscriptionPlans() {
  return http.get<SubscriptionPlan[]>("/v1/public/subscription-plans", opts)
}

export function getExchangeRates() {
  return http.get<ExchangeRates>("/v1/public/exchange-rates", opts)
}
