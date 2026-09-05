vi.mock("phosphor-react-native", () => ({
  CreditCard: () => null,
  Receipt: () => null,
  Storefront: () => null,
}))
import { describe, expect, it, vi } from "vitest"
import {
  AMOUNT_LIMITS,
  isValidAmount,
  assertValidAmount,
  assertDtoConstraints,
} from "@/lib/financial"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { toPaymentMethods } from "@/lib/payment-methods"

describe.each(Object.entries(AMOUNT_LIMITS))(
  "%s amount limits from the backend DTO",
  (_, limits) => {
    it("accepts inclusive integer boundaries", () => {
      expect(isValidAmount(limits.minimum, limits)).toBe(true)
      expect(isValidAmount(limits.maximum, limits)).toBe(true)
    })
    it("rejects outside boundaries, fractions and non-finite input", () => {
      for (const value of [
        limits.minimum - 1,
        limits.maximum + 1,
        limits.minimum + 0.5,
        NaN,
        Infinity,
      ]) {
        expect(isValidAmount(value, limits)).toBe(false)
        expect(() => assertValidAmount(value, limits)).toThrow()
      }
    })
  },
)
it("does not let casts bypass top-up method enums", () =>
  expect(() =>
    assertDtoConstraints({ amount: 10000, method: "KAHADE_WALLET" }, API_CONSTRAINTS.TopupDto),
  ).toThrow())
it("validates order title and description boundaries", () => {
  expect(() => assertDtoConstraints({ title: "ab" }, API_CONSTRAINTS.CreateOrderDto)).toThrow()
  expect(() =>
    assertDtoConstraints({ description: "a".repeat(501) }, API_CONSTRAINTS.CreateOrderDto),
  ).toThrow()
})
it("accepts the server subscription period but not invented annual aliases", () => {
  expect(() => assertDtoConstraints({ plan: "YEARLY" }, API_CONSTRAINTS.SubscribeDto)).toThrow()
  expect(() => assertDtoConstraints({ plan: "ANNUAL" }, API_CONSTRAINTS.SubscribeDto)).not.toThrow()
})
it("preserves combined fees, bounds and availability; no invented recommendations", () => {
  const [method] = toPaymentMethods([
    {
      id: "qris",
      code: "QRIS",
      name: "QRIS",
      enabled: false,
      minAmount: 10000,
      maxAmount: 50000,
      fee: { fixed: 1000, percent: 0.7, minFee: 1500, maxFee: 10000, freeLimit: 20000 },
    },
  ])
  expect(method.fee).toEqual({
    type: "combined",
    fixed: 1000,
    percent: 0.7,
    minFee: 1500,
    maxFee: 10000,
    freeLimit: 20000,
  })
  expect(method.unavailable).toBe(true)
  expect(method.recommended).toBe(false)
  expect(method.minAmount).toBe(10000)
  expect(method.maxAmount).toBe(50000)
})
it("an absent fee is not labeled free", () =>
  expect(
    toPaymentMethods([{ id: "qris", code: "QRIS", name: "QRIS", enabled: true }])[0].fee,
  ).toBeUndefined())
