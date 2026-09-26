/**
 * Batch 8 — FX-010: batas nominal dompet dari server (`GET /v1/wallet/limits`).
 *
 * Perilaku yang dikunci:
 * 1. Nilai server yang valid dipakai apa adanya (mis. maksimum withdraw
 *    efektif 25jt, bukan salinan statis 50jt yang drift).
 * 2. Field yang hilang/tak valid fallback PER-FIELD ke salinan statis
 *    `AMOUNT_LIMITS` — validasi client tidak boleh lebih longgar dari
 *    sebelumnya hanya karena respons server aneh.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock("@/lib/api/client", () => ({
  http: httpMock,
  seg: (value: string) => encodeURIComponent(String(value)),
}))

import { AMOUNT_LIMITS } from "@/lib/financial"
import { getWalletLimits } from "@/lib/api/wallet"

beforeEach(() => {
  httpMock.get.mockReset()
})

describe("getWalletLimits (FX-010)", () => {
  it("memakai nilai server yang valid apa adanya", async () => {
    httpMock.get.mockResolvedValue({
      withdraw: { minimum: 50000, maximum: 25000000 },
      topup: { minimum: 10000, maximum: 50000000 },
      transfer: { minimum: 1000, maximum: 25000000 },
      currency: "IDR",
    })
    const limits = await getWalletLimits()
    expect(limits.withdraw).toEqual({ minimum: 50000, maximum: 25000000 })
    // Bukan salinan statis yang drift:
    expect(limits.withdraw.maximum).not.toBe(AMOUNT_LIMITS.withdraw.maximum)
    expect(httpMock.get).toHaveBeenCalledWith(
      "/v1/wallet/limits",
      expect.objectContaining({ auth: "required" }),
    )
  })

  it("fallback per-field bila field server hilang/tak valid", async () => {
    httpMock.get.mockResolvedValue({
      withdraw: { minimum: 75000 }, // maximum hilang
      topup: { minimum: -5, maximum: Number.NaN }, // tak valid
      // transfer hilang total
    })
    const limits = await getWalletLimits()
    expect(limits.withdraw).toEqual({
      minimum: 75000,
      maximum: AMOUNT_LIMITS.withdraw.maximum,
    })
    expect(limits.topup).toEqual(AMOUNT_LIMITS.topup)
    expect(limits.transfer).toEqual(AMOUNT_LIMITS.transfer)
  })

  it("fallback penuh bila respons bukan objek", async () => {
    httpMock.get.mockResolvedValue(null)
    const limits = await getWalletLimits()
    expect(limits.withdraw).toEqual(AMOUNT_LIMITS.withdraw)
    expect(limits.topup).toEqual(AMOUNT_LIMITS.topup)
    expect(limits.transfer).toEqual(AMOUNT_LIMITS.transfer)
  })
})
