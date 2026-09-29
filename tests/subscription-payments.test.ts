/**
 * Test checkout langganan Kahade+ tanpa wallet (Mode Tanpa Wallet Internal).
 *
 * Mengunci KONTRAK FINAL (2026-09-29, docs/no-wallet-api-contract.md):
 * - `toDanaPayKind`: QRIS→QRIS, VA_*→VA+bankCode, DANA→BALANCE; kode tak
 *   dikenal → lempar (fail-closed).
 * - `createSubscriptionPayment`: POST /v1/subscriptions/subscribe-dana dengan
 *   body { plan, payKind, bankCode?, promoCode? } (+ Idempotency-Key bila
 *   diberikan); intent dinormalisasi (termasuk `paymentCode` VA DANA);
 *   subscriptionId dibawa untuk polling; tanpa payload yang bisa
 *   ditindaklanjuti → lempar (fail-closed).
 * - `getSubscriptionPaymentStatus`: GET /v1/subscriptions/dana-status/:id;
 *   ACTIVE → isPaid true; tanpa status → lempar (fail-closed).
 * - `renewSubscriptionDana`: POST /v1/subscriptions/renew-dana.
 * - `resolveSubscriptionPaymentMethods`: daftar = cerminan kontrak backend
 *   (QRIS/VA/BALANCE); metode dompet internal SELALU disaring; tidak ada
 *   endpoint payment-methods yang dikejar.
 */
import { describe, expect, it, vi, beforeEach } from "vitest"

const { mockHttpGet, mockHttpPost } = vi.hoisted(() => ({
  mockHttpGet: vi.fn(),
  mockHttpPost: vi.fn(),
}))

vi.mock("@/lib/api/client", () => ({
  http: { get: mockHttpGet, post: mockHttpPost },
  createIdempotencyKey: () => "test-key",
  seg: (v: string | number) => encodeURIComponent(String(v)),
}))

vi.mock("@/lib/api/device-location", () => ({
  deviceLocationOnlyBody: async () => ({ deviceLocation: null }),
}))

import {
  createSubscriptionPayment,
  getSubscriptionPaymentStatus,
  renewSubscriptionDana,
  toDanaPayKind,
  SUBSCRIBE_DANA_PATH,
  RENEW_DANA_PATH,
  danaStatusPath,
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

beforeEach(() => {
  mockHttpGet.mockReset()
  mockHttpPost.mockReset()
})

describe("toDanaPayKind", () => {
  it("QRIS → QRIS; DANA → BALANCE; VA_BCA → VA + bankCode BCA", () => {
    expect(toDanaPayKind("QRIS")).toEqual({ payKind: "QRIS" })
    expect(toDanaPayKind("DANA")).toEqual({ payKind: "BALANCE" })
    expect(toDanaPayKind("VA_BCA")).toEqual({ payKind: "VA", bankCode: "BCA" })
    expect(toDanaPayKind("VA_MANDIRI")).toEqual({ payKind: "VA", bankCode: "MANDIRI" })
  })

  it("kode tak dikenal → lempar (fail-closed, jangan menebak metode)", () => {
    expect(() => toDanaPayKind("GOPAY")).toThrow()
    expect(() => toDanaPayKind("KAHADE_WALLET")).toThrow()
    expect(() => toDanaPayKind("")).toThrow()
  })
})

describe("createSubscriptionPayment (kontrak final)", () => {
  it("QRIS: POST subscribe-dana { plan, payKind: QRIS } + idempotency key", async () => {
    mockHttpPost.mockResolvedValue({
      subscriptionId: "sub-1",
      qrString: "QR-123",
      amount: 50000,
      expiredAt: "2026-09-30T00:00:00Z",
    })
    const intent = await createSubscriptionPayment("MONTHLY", "QRIS", "key-1")
    expect(mockHttpPost).toHaveBeenCalledTimes(1)
    const [path, body, options] = mockHttpPost.mock.calls[0]!
    expect(path).toBe(SUBSCRIBE_DANA_PATH)
    expect(body).toMatchObject({ plan: "MONTHLY", payKind: "QRIS" })
    expect(body).not.toHaveProperty("paymentMethod")
    expect((options as { headers: Record<string, string> }).headers).toMatchObject({
      "Idempotency-Key": "key-1",
    })
    expect(intent.method).toBe("QRIS")
    expect(intent.qrString).toBe("QR-123")
    expect(intent.subscriptionId).toBe("sub-1")
  })

  it("VA: payKind VA + bankCode dari kode metode", async () => {
    mockHttpPost.mockResolvedValue({
      subscriptionId: "sub-2",
      paymentCode: "887771234567890",
      amount: 50000,
    })
    const intent = await createSubscriptionPayment("YEARLY", "VA_BNI")
    const [, body] = mockHttpPost.mock.calls[0]!
    expect(body).toMatchObject({ plan: "YEARLY", payKind: "VA", bankCode: "BNI" })
    // paymentCode DANA dinormalisasi ke vaNumber (panel VA tetap tampil).
    expect(intent.vaNumber).toBe("887771234567890")
    expect(intent.subscriptionId).toBe("sub-2")
  })

  it("DANA: payKind BALANCE; promoCode diteruskan bila ada", async () => {
    mockHttpPost.mockResolvedValue({
      subscriptionId: "sub-3",
      webRedirectUrl: "https://dana.id/auth",
      amount: 50000,
    })
    const intent = await createSubscriptionPayment("MONTHLY", "DANA", undefined, "GRATIS1")
    const [, body] = mockHttpPost.mock.calls[0]!
    expect(body).toMatchObject({ plan: "MONTHLY", payKind: "BALANCE", promoCode: "GRATIS1" })
    expect(intent.redirectUrl).toBe("https://dana.id/auth")
  })

  it("intent tanpa payload yang bisa ditindaklanjuti → lempar (fail-closed)", async () => {
    mockHttpPost.mockResolvedValue({ status: "ok" })
    await expect(createSubscriptionPayment("YEARLY", "QRIS")).rejects.toThrow()
  })

  it("metode tak dikenal → lempar sebelum request", async () => {
    await expect(createSubscriptionPayment("MONTHLY", "GOPAY")).rejects.toThrow()
    expect(mockHttpPost).not.toHaveBeenCalled()
  })
})

describe("getSubscriptionPaymentStatus", () => {
  it("GET dana-status/:id; ACTIVE → isPaid true", async () => {
    mockHttpGet.mockResolvedValue({ status: "ACTIVE" })
    await expect(getSubscriptionPaymentStatus("sub-1")).resolves.toEqual({
      status: "ACTIVE",
      isPaid: true,
    })
    expect(mockHttpGet).toHaveBeenCalledWith(
      danaStatusPath("sub-1"),
      expect.objectContaining({ auth: "required" }),
    )
  })

  it("PENDING → isPaid false", async () => {
    mockHttpGet.mockResolvedValue({ data: { status: "PENDING" } })
    await expect(getSubscriptionPaymentStatus("sub-1")).resolves.toEqual({
      status: "PENDING",
      isPaid: false,
    })
  })

  it("tanpa subscriptionId atau tanpa status → lempar (fail-closed)", async () => {
    await expect(getSubscriptionPaymentStatus("")).rejects.toThrow()
    mockHttpGet.mockResolvedValue({})
    await expect(getSubscriptionPaymentStatus("sub-1")).rejects.toThrow()
  })
})

describe("renewSubscriptionDana", () => {
  it("POST renew-dana { payKind, bankCode? }", async () => {
    mockHttpPost.mockResolvedValue({
      paymentTxId: "pay-1",
      paymentCode: "887778888888",
      amount: 50000,
    })
    const intent = await renewSubscriptionDana("VA_BRI", "key-9")
    const [path, body, options] = mockHttpPost.mock.calls[0]!
    expect(path).toBe(RENEW_DANA_PATH)
    expect(body).toMatchObject({ payKind: "VA", bankCode: "BRI" })
    expect((options as { headers: Record<string, string> }).headers).toMatchObject({
      "Idempotency-Key": "key-9",
    })
    expect(intent.vaNumber).toBe("887778888888")
  })
})

describe("resolveSubscriptionPaymentMethods", () => {
  it("daftar = cerminan kontrak (QRIS/VA/BALANCE); dompet disaring; tanpa request backend", async () => {
    const { methods, fromFallback } = await resolveSubscriptionPaymentMethods({})
    expect(mockHttpGet).not.toHaveBeenCalled()
    expect(fromFallback).toBe(false)
    expect(methods.map((m) => m.code)).toEqual(
      DANA_PAYMENT_METHODS_FALLBACK.map((m) => m.code),
    )
    expect(methods.every((m) => !isWalletCheckoutMethod(m.code))).toBe(true)
  })

  it("metode dompet dari sumber mana pun tetap disaring", async () => {
    // Simulasi: bila suatu saat backend mengirim daftar, filter tetap berlaku.
    const mixed = [...DANA_PAYMENT_METHODS_FALLBACK, WALLET_METHOD]
    const filtered = mixed.filter((m) => m.enabled && !isWalletCheckoutMethod(m.code))
    expect(filtered.some((m) => m.code === "KAHADE_WALLET")).toBe(false)
  })

  it("selectDefaultCheckoutMethod: recommended dulu, lalu pertama yang aktif", () => {
    const { methods } = { methods: DANA_PAYMENT_METHODS_FALLBACK } as {
      methods: OrderPaymentMethod[]
    }
    expect(selectDefaultCheckoutMethod(methods)?.code).toBe("QRIS")
    expect(selectDefaultCheckoutMethod([])).toBeNull()
  })
})
