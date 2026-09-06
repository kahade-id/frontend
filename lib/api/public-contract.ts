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
  const stores = asRecord(data.storeUrl ?? data.store_url)
  return {
    minVersion: string(target?.minimumVersion ?? target?.minimum_version ?? target?.minVersion ?? target?.min_version ?? data.minVersion ?? data.min_version),
    latestVersion: string(target?.latestVersion ?? target?.latest_version ?? data.latestVersion ?? data.latest_version),
    message: string(target?.message ?? data.message),
    storeUrl: {
      ios: string(ios?.storeUrl ?? ios?.store_url ?? stores?.ios),
      android: string(android?.storeUrl ?? android?.store_url ?? stores?.android),
      web: string(asRecord(data.web)?.storeUrl ?? asRecord(data.web)?.store_url ?? stores?.web),
    },
    checkIntervalMs: isNumber(data.checkIntervalMs ?? data.check_interval_ms) ? (data.checkIntervalMs ?? data.check_interval_ms) as number : undefined,
  }
}

export function normalizeBanks(raw: unknown): Bank[] {
  const banks = readList<Bank>(raw, ["banks"])
  if (banks.some((b) => !b || !string(b.code) || !string(b.name))) throw invalidResponse("banks")
  return banks
}

export function normalizeFeeSchedule(raw: unknown): FeeSchedule {
  const data = asRecord(raw)
  const schedule = asRecord(data?.feeSchedule ?? data?.fee_schedule) ?? data
  if (!schedule) throw invalidResponse("fee-schedule")
  if (Array.isArray(schedule.tiers)) return schedule as FeeSchedule
  
  const standardFeeRate = schedule.standardFeeRate ?? schedule.standard_fee_rate
  const orderMinValue = schedule.orderMinValue ?? schedule.order_min_value
  const orderMaxValue = schedule.orderMaxValue ?? schedule.order_max_value
  const standardFeeMin = schedule.standardFeeMin ?? schedule.standard_fee_min
  const standardFeeMax = schedule.standardFeeMax ?? schedule.standard_fee_max
  const kahadePlusFeeRate = schedule.kahadePlusFeeRate ?? schedule.kahade_plus_fee_rate
  const standardFeeDescription = schedule.standardFeeDescription ?? schedule.standard_fee_description
  const kahadePlusFeeDescription = schedule.kahadePlusFeeDescription ?? schedule.kahade_plus_fee_description

  if (
    !isNumber(standardFeeRate) ||
    !isNumber(orderMinValue) ||
    !isNumber(orderMaxValue)
  )
    throw invalidResponse("fee-schedule")
  return {
    tiers: [
      {
        minValue: orderMinValue,
        maxValue: orderMaxValue,
        feePercent: standardFeeRate,
      },
    ],
    minFee: isNumber(standardFeeMin) ? standardFeeMin : undefined,
    maxFee: isNumber(standardFeeMax) ? standardFeeMax : undefined,
    plusFeePercent: isNumber(kahadePlusFeeRate) ? kahadePlusFeeRate : undefined,
    description: string(standardFeeDescription),
    plusDescription: string(kahadePlusFeeDescription),
  }
}

export function normalizeSubscriptionPlans(raw: unknown): SubscriptionPlan[] {
  return readList<unknown>(raw, ["plans"]).map((item) => {
    const plan = asRecord(item)
    const key = plan?.plan ?? plan?.key
    if (
      !plan ||
      (key !== "MONTHLY" && key !== "ANNUAL") ||
      !isNumber(plan.price) ||
      (plan.price as number) < 0
    )
      throw invalidResponse("subscription-plans")
    const benefits = plan.features ?? plan.benefits
    const duration = plan.durationDays ?? plan.duration_days
    return {
      id: string(plan.id) ?? (key as string),
      key: key as "MONTHLY" | "ANNUAL",
      // Production `/subscriptions/plans` returns plan/price/durationDays
      // without a display name; keep the screen usable with a stable label.
      name: string(plan.name) ?? (key === "MONTHLY" ? "Bulanan" : "Tahunan"),
      price: plan.price as number,
      durationDays: isNumber(duration) ? duration : undefined,
      periodLabel: string(plan.period ?? plan.period_label ?? plan.periodLabel),
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
    !string(data.baseCurrency ?? data.base_currency ?? data.base) ||
    !string(data.updatedAt ?? data.updated_at)
  )
    throw invalidResponse("exchange-rates")
  return {
    base: (data.baseCurrency ?? data.base_currency ?? data.base) as string,
    rates: data.rates as Record<string, number>,
    updatedAt: (data.updatedAt ?? data.updated_at) as string,
    isFallback: data.isFallback === true || data.is_fallback === true,
    source: string(data.source),
  }
}
