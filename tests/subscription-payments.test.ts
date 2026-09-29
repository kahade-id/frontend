/**
 * Test checkout langganan Kahade+ tanpa wallet (Mode Tanpa Wallet Internal).
 *
 * Mengunci:
 * - `resolveSubscriptionPaymentMethods`: backend menang; metode dompet
 *   internal SELALU disaring (langganan tak bisa dibayar dari saldo); backend
 *   gagal → fallback DANA statis (ditandai).
 * - `selectDefaultCheckoutMethod`: recommended → pertama yang aktif.
 * - `createSubscriptionPayment`: body membawa plan + paymentMethod (+
 *   Idempotency-Key bila diberikan); intent dinormalisasi; tanpa payload yang
 *   bisa ditindaklanjuti → lempar (fail-closed).
 * - `getSubscriptionPaymentMethods`: respons tak bisa diparse → lempar
 *   (bukan daftar kosong yang diam).
 * - `getSubscriptionPaymentStatus`: normalisasi status + isPaid dari berbagai
 *   alias; tanpa status → lempar (fail-closed).
 */
import { describe, expect, it, vi, beforeEach } from "vitest"

const { mockHttpGet, mockHttpPost } = vi.hoisted(() => ({
  mockHttpGet: vi.fn(),
  mockHttpPost: vi.fn(),
}))

vi.mock("@/lib/api/client", () => ({
  http: { get: mockHttpGet, post: mockHttpPost },
  createIdempotencyKey: () => "test-key",
}))

vi.mock("@/lib/api/device-location", () => ({
  deviceLocationOnlyBody: async () => ({ deviceLocation: null }),
}))

import {
  getSubscriptionPaymentMethods,
  createSubscriptionPayment,
  getSubscriptionPaymentStatus,
  SUBSCRIPTION_PAYMENTS_PATH,
  SUBSCRIPTION_PAYMENT_METHODS_PATH,
} from "@/lib/api/subscription-payments"
import {
  resolveSubscriptionPaymentMethods,
  selectDefaultCheckoutMethod,
} from "@/lib/subscription-checkout"
import type { OrderPaymentMethod } from "@/lib/api/orders-endpoints"
import { DANA_PAYMENT_METHODS_FALLBACK, isWalletCheckoutMethod } from "@/lib/dana-payment"

const WALLET_METHOD: OrderPaymentMethod = {
  id: "KAHADE_WALLET",
  code: "KAHADE_WALLET",
  name: "Saldo Kahade",
  category: "wallet",
  enabled: true,
}

const BACKEND_METHODS: OrderPaymentMethod[] = [
  { id: "QRIS", code: "QRIS", name: "QRIS", category: "qris", enabled: true, recommended: true },
  { id: "VA_BCA", code: "VA_BCA", name: "Virtual Account BCA", category: "va", enabled: true },
  WALLET_METHOD,
]

beforeEach(() => {
  mockHttpGet.mockReset()
  mockHttpPost.mockReset()
})

describe("resolveSubscriptionPaymentMethods", () => {
  it("backend menang; metode dompet internal disaring keluar", async () => {
    mockHttpGet.mockResolvedValue({ methods: BACKEND_METHODS })
    const { methods, fromFallback } = await resolveSubscriptionPaymentMethods({})
    expect(mockHttpGet).toHaveBeenCalledWith(
      SUBSCRIPTION_PAYMENT_METHODS_PATH,
      expect.objectContaining({ auth: "required" }),
    )
    expect(fromFallback).toBe(false)
    expect(methods.map((m) => m.code)).toEqual(["QRIS", "VA_BCA"])
    expect(methods.every((m) => !isWalletCheckoutMethod(m.code))).toBe(true)
  })

  it("metode disabled dibuang", async () => {
    mockHttpGet.mockResolvedValue({
      methods: [{ id: "X", code: "X", name: "X", enabled: false }, ...BACKEND_METHODS],
    })
    const { methods } = await resolveSubscriptionPaymentMethods({})
    expect(methods.some((m) => m.code === "X")).toBe(false)
  })

  it("backend gagal → fallback DANA statis yang ditandai", async () => {
    mockHttpGet.mockRejectedValue(new Error("404"))
    const { methods, fromFallback } = await resolveSubscriptionPaymentMethods({})
    expect(fromFallback).toBe(true)
    expect(methods.map((m) => m.code)).toEqual(DANA_PAYMENT_METHODS_FALLBACK.map((m) => m.code))
    expect(methods.every((m) => !isWalletCheckoutMethod(m.code))).toBe(true)
  })

  it("selectDefaultCheckoutMethod: recommended dulu, lalu pertama yang aktif", () => {
    expect(selectDefaultCheckoutMethod(BACKEND_METHODS)?.code).toBe("QRIS")
    expect(selectDefaultCheckoutMethod([])).toBeNull()
  })
})

describe("createSubscriptionPayment (kontrak path)", () => {
  it("memakai path langganan + body plan/paymentMethod + idempotency key", async () => {
    mockHttpPost.mockResolvedValue({
      qrString: "QR-123",
      amount: 50000,
      expiresAt: "2026-09-30T00:00:00Z",
    })
    const intent = await createSubscriptionPayment("MONTHLY", "QRIS", "key-1")
    expect(mockHttpPost).toHaveBeenCalledTimes(1)
    const [path, body, options] = mockHttpPost.mock.calls[0]!
    expect(path).toBe(SUBSCRIPTION_PAYMENTS_PATH)
    expect(body).toMatchObject({ plan: "MONTHLY", paymentMethod: "QRIS" })
    expect((options as { headers: Record<string, string> }).headers).toMatchObject({
      "Idempotency-Key": "key-1",
    })
    expect(intent.method).toBe("QRIS")
    expect(intent.qrString).toBe("QR-123")
    expect(intent.amount).toBe(50000)
  })

  it("intent tanpa payload yang bisa ditindaklanjuti → lempar (fail-closed)", async () => {
    mockHttpPost.mockResolvedValue({ status: "ok" })
    await expect(createSubscriptionPayment("YEARLY", "VA_BCA")).rejects.toThrow()
  })
})

describe("getSubscriptionPaymentMethods", () => {
  it("respons tak bisa diparse → lempar, bukan daftar kosong yang diam", async () => {
    mockHttpGet.mockResolvedValue({ nope: true })
    await expect(getSubscriptionPaymentMethods()).rejects.toThrow()
  })
})

describe("getSubscriptionPaymentStatus", () => {
  it("menormalisasi status + isPaid dari berbagai alias", async () => {
    const cases: Array<[unknown, { status: string; isPaid: boolean }]> = [
      [{ status: "PAID", isPaid: true }, { status: "PAID", isPaid: true }],
      [{ data: { paymentStatus: "PENDING", paid: 0 } }, { status: "PENDING", isPaid: false }],
      [{ result: { status: "EXPIRED", is_paid: false } }, { status: "EXPIRED", isPaid: false }],
    ]
    for (const [raw, expected] of cases) {
      mockHttpGet.mockReset()
      mockHttpGet.mockResolvedValue(raw)
      await expect(getSubscriptionPaymentStatus()).resolves.toEqual(expected)
    }
  })

  it("tanpa status → lempar (fail-closed)", async () => {
    mockHttpGet.mockResolvedValue({})
    await expect(getSubscriptionPaymentStatus()).rejects.toThrow()
  })
})
