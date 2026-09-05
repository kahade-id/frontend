import { asRecord, invalidResponse, readList } from "@/lib/api/response"

export type AppVersionInfo = {
  minVersion?: string
  latestVersion?: string
  message?: string | null
  storeUrl?: { ios?: string; android?: string; web?: string } | null
  checkIntervalMs?: number
}
export type PublicConfig = Record<string, unknown>
export type Bank = { code: string; name: string; logoUrl?: string | null }
export type FeeSchedule = {
  tiers: Array<{ minValue: number; maxValue: number | null; feePercent?: number; feeFlat?: number }>
  minFee?: number
  maxFee?: number
  plusFeePercent?: number
  description?: string
  plusDescription?: string
}
export type SubscriptionPlan = {
  id: string
  key: "MONTHLY" | "ANNUAL"
  name: string
  price: number
  durationDays?: number
  periodLabel?: string
  benefits?: string[]
}
export type ExchangeRates = {
  base: string
  rates: Record<string, number>
  updatedAt: string
  isFallback?: boolean
  source?: string
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)
const string = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined)

/** Live response is platform-specific; a web build must never be locked by an iOS minimum. */
export function normalizeAppVersion(raw: unknown, platform: string): AppVersionInfo {
  const data = asRecord(raw)
  if (!data) throw invalidResponse("app-version")
  const target = asRecord(data[platform])
  const ios = asRecord(data.ios)
  const android = asRecord(data.android)
  const stores = asRecord(data.storeUrl)
  return {
    minVersion: string(target?.minimumVersion ?? target?.minVersion ?? data.minVersion),
    latestVersion: string(target?.latestVersion ?? data.latestVersion),
    message: string(target?.message ?? data.message),
    storeUrl: {
      ios: string(ios?.storeUrl ?? stores?.ios),
      android: string(android?.storeUrl ?? stores?.android),
      web: string(asRecord(data.web)?.storeUrl ?? stores?.web),
    },
    checkIntervalMs: isNumber(data.checkIntervalMs) ? data.checkIntervalMs : undefined,
  }
}

export function normalizeBanks(raw: unknown): Bank[] {
  const banks = readList<Bank>(raw, ["banks"])
  if (banks.some((b) => !b || !string(b.code) || !string(b.name))) throw invalidResponse("banks")
  return banks
}

export function normalizeFeeSchedule(raw: unknown): FeeSchedule {
  const data = asRecord(raw)
  const schedule = asRecord(data?.feeSchedule) ?? data
  if (!schedule) throw invalidResponse("fee-schedule")
  if (Array.isArray(schedule.tiers)) return schedule as FeeSchedule
  if (
    !isNumber(schedule.standardFeeRate) ||
    !isNumber(schedule.orderMinValue) ||
    !isNumber(schedule.orderMaxValue)
  )
    throw invalidResponse("fee-schedule")
  return {
    tiers: [
      {
        minValue: schedule.orderMinValue,
        maxValue: schedule.orderMaxValue,
        feePercent: schedule.standardFeeRate,
      },
    ],
    minFee: isNumber(schedule.standardFeeMin) ? schedule.standardFeeMin : undefined,
    maxFee: isNumber(schedule.standardFeeMax) ? schedule.standardFeeMax : undefined,
    plusFeePercent: isNumber(schedule.kahadePlusFeeRate) ? schedule.kahadePlusFeeRate : undefined,
    description: string(schedule.standardFeeDescription),
    plusDescription: string(schedule.kahadePlusFeeDescription),
  }
}

export function normalizeSubscriptionPlans(raw: unknown): SubscriptionPlan[] {
  return readList<unknown>(raw, ["plans"]).map((item) => {
    const plan = asRecord(item)
    const key = plan?.plan ?? plan?.key
    if (
      !plan ||
      (key !== "MONTHLY" && key !== "ANNUAL") ||
      !string(plan.name) ||
      !isNumber(plan.price) ||
      plan.price < 0
    )
      throw invalidResponse("subscription-plans")
    const benefits = plan.features ?? plan.benefits
    return {
      id: string(plan.id) ?? key,
      key,
      name: plan.name as string,
      price: plan.price,
      durationDays: isNumber(plan.durationDays) ? plan.durationDays : undefined,
      periodLabel: string(plan.period),
      benefits: Array.isArray(benefits)
        ? benefits.filter((v): v is string => typeof v === "string")
        : undefined,
    }
  })
}

export function normalizePublicConfig(raw: unknown): PublicConfig {
  const record = asRecord(raw)
  if (!record) throw invalidResponse("public-config")
  if (!Array.isArray(record.configs)) return record
  const entries = record.configs.map(asRecord).filter((v) => v && typeof v.key === "string")
  return Object.fromEntries(entries.map((entry) => [entry!.key, entry!.value]))
}

export function normalizeExchangeRates(raw: unknown): ExchangeRates {
  const data = asRecord(raw)
  if (
    !data ||
    !asRecord(data.rates) ||
    !string(data.baseCurrency ?? data.base) ||
    !string(data.updatedAt)
  )
    throw invalidResponse("exchange-rates")
  return {
    base: (data.baseCurrency ?? data.base) as string,
    rates: data.rates as Record<string, number>,
    updatedAt: data.updatedAt as string,
    isFallback: data.isFallback === true,
    source: string(data.source),
  }
}
