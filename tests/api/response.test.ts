import { describe, expect, it } from "vitest"
import fixtures from "../fixtures/public-responses.json"
import { unwrapResponse, readList, readPage } from "@/lib/api/response"
import { parseErrorBody } from "@/lib/api/errors"
import {
  normalizeAppVersion,
  normalizeBanks,
  normalizeFeeSchedule,
  normalizePublicConfig,
  normalizeSubscriptionPlans,
} from "@/lib/api/public-contract"

describe("verified production public contracts (2026-09-05)", () => {
  it("unwraps the actual success envelope once", () => {
    expect(unwrapResponse(fixtures.otpMethods)).toEqual({ methods: ["WHATSAPP"] })
  })
  it("preserves pagination metadata and legacy plain responses", () => {
    const page = { data: [{ id: "a" }], meta: { page: 1, totalPages: 3 } }
    expect(unwrapResponse(page)).toBe(page)
    expect(unwrapResponse({ success: true, data: page })).toBe(page)
  })
  it("retains mutation acknowledgement messages", () =>
    expect(unwrapResponse({ success: true, data: null, message: "Saved" })).toEqual({
      message: "Saved",
    }))
  it("decodes nested errors rather than swallowing backend codes", () => {
    expect(parseErrorBody(fixtures.unauthorized)).toMatchObject({
      backendCode: "UNAUTHORIZED",
      message: "Access token required",
    })
    expect(() => unwrapResponse(fixtures.unauthorized)).toThrow("Access token required")
  })
  it("does not display an HTML proxy error as a user message", () =>
    expect(parseErrorBody("<html>bad gateway</html>").message).toBeUndefined())
  it("reads data.banks", () =>
    expect(normalizeBanks(unwrapResponse(fixtures.banks))).toHaveLength(14))
  it("rejects malformed lists instead of reporting zero records", () =>
    expect(() => readList({ nope: [] }, ["banks"])).toThrow())
  it("maps real fee limits and Plus fees", () => {
    expect(normalizeFeeSchedule(unwrapResponse(fixtures.feeSchedule))).toMatchObject({
      tiers: [{ minValue: 10000, maxValue: 1000000000, feePercent: 2.5 }],
      minFee: 5000,
      maxFee: 250000,
      plusFeePercent: 0.5,
    })
  })
  it("uses the server's plan enum and price, never inferred duration", () => {
    const plans = normalizeSubscriptionPlans(unwrapResponse(fixtures.plans))
    expect(plans.map((p) => [p.key, p.price])).toEqual([
      ["MONTHLY", 29000],
      ["ANNUAL", 299000],
    ])
    expect(plans[0].durationDays).toBeUndefined()
    expect(plans[0].benefits).toHaveLength(4)
  })
  it("does not invent a subscription plan for an unknown key", () =>
    expect(() => normalizeSubscriptionPlans([{ plan: "UNKNOWN", name: "X", price: 1 }])).toThrow())
  it("reads per-platform minimums and does not block web on native minimums", () => {
    const body = unwrapResponse(fixtures.appVersion)
    expect(normalizeAppVersion(body, "ios").minVersion).toBe("1.0.0")
    expect(normalizeAppVersion(body, "android").storeUrl?.android).toContain("id.kahade.frontend")
    expect(normalizeAppVersion(body, "web").minVersion).toBeUndefined()
  })
  it("does not fabricate configs when backend has none", () =>
    expect(normalizePublicConfig(unwrapResponse(fixtures.config))).toEqual({}))
  it("keeps an unpaginated full page open until the end is known", () => {
    expect(readPage([{ id: "a" }], { page: 1, limit: 1 }).meta.totalPages).toBe(2)
    expect(readPage([], { page: 2, limit: 1 }).meta.totalPages).toBe(2)
  })
})

it("never invents a collection total from the first page", () => {
  const page = readPage({ items: [{ id: "one" }] }, { page: 1, limit: 1 })
  expect(page.meta.total).toBeUndefined()
  expect(page.meta.totalPages).toBe(2)
})
it("normalizes safe count strings but does not divide by zero", () => {
  const page = readPage(
    { items: [], meta: { page: 0, limit: 0, total: "40" } },
    { page: 1, limit: 20 },
  )
  expect(page.meta).toEqual({ page: 1, limit: 20, total: 40, totalPages: 2 })
})
