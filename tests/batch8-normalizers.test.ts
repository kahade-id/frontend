/**
 * Batch 8 — test kontrak normalizer SUBSCRIPTION / VOUCHER / REFERRAL.
 *
 * Mengunci bentuk respons backend yang dulu salah dibaca frontend:
 *  - SP-029: `GET /v1/public/subscription-plans` mengirim plan `YEARLY`
 *    (normalizer lama me-throw `invalidResponse` untuk key selain ANNUAL).
 *  - SP-036: `GET /v1/vouchers/my-usage` bersarang
 *    `{ id, orderId, discountAmount, usedAt, voucher: { code, name } }`.
 *  - SP-037: daftar voucher tersedia memakai `name`/`discountPercent`/
 *    `discountAmount` (bukan `title`/`discountValue`).
 *  - SP-038: `POST /v1/vouchers/validate` menjawab datar (tanpa `voucher.*`).
 *  - SP-035: `GET /v1/referral/leaderboard` bersarang
 *    `{ rank, user: { username, fullName, avatarUrl },
 *       totalReferrals, successfulReferrals, totalRewardEarned }`.
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/session", () => ({
  getAccessToken: () => Promise.resolve("token"),
  getRefreshToken: () => Promise.resolve(null),
  setAccessToken: () => Promise.resolve(),
  setRefreshToken: () => Promise.resolve(),
  getSessionRevision: () => 1,
  clearSession: () => Promise.resolve(),
  emitSessionExpired: () => undefined,
  getDeviceId: () => Promise.resolve("device-1"),
  getDeviceInfo: () => "Kahade/test",
  getAppVersion: () => "0.0.0",
}))

const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

function jsonOk(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

import {
  normalizeSubscriptionPlans,
} from "@/lib/api/public-contract"
import {
  normalizeVoucher,
  normalizeVoucherUsage,
  normalizeVoucherValidation,
} from "@/lib/api/vouchers"
import { getReferralLeaderboard } from "@/lib/api/referrals"
import { KAHADE_PLUS_BENEFITS } from "@/lib/kahade-plus-benefits"

describe("SP-029 — normalizer subscription-plans menerima YEARLY", () => {
  it("memetakan YEARLY ke key ANNUAL legacy tanpa me-throw", () => {
    const plans = normalizeSubscriptionPlans({
      plans: [
        { plan: "MONTHLY", name: "Kahade Plus Monthly", price: 99000, period: "1 month" },
        { plan: "YEARLY", name: "Kahade Plus Yearly", price: 899000, period: "12 months" },
      ],
    })
    expect(plans).toHaveLength(2)
    expect(plans[0]!.key).toBe("MONTHLY")
    expect(plans[1]!.key).toBe("ANNUAL")
    expect(plans[1]!.price).toBe(899000)
    expect(plans[1]!.periodLabel).toBe("12 months")
  })
})

describe("SP-036/SP-037 — normalizer voucher", () => {
  it("normalizeVoucher memetakan name/discountPercent backend ke title/discountValue", () => {
    const v = normalizeVoucher({
      code: "HEMAT10",
      name: "Hemat 10%",
      discountPercent: 10,
      validUntil: "2026-12-31",
      isActive: true,
    })
    expect(v).not.toBeNull()
    expect(v!.code).toBe("HEMAT10")
    expect(v!.title).toBe("Hemat 10%")
    expect(v!.discountType).toBe("PERCENT")
    expect(v!.discountValue).toBe(10)
  })

  it("normalizeVoucher memakai discountAmount untuk tipe FIXED", () => {
    const v = normalizeVoucher({
      code: "POTONG50",
      name: "Potong 50rb",
      discountAmount: 50000,
    })
    expect(v!.discountType).toBe("FIXED")
    expect(v!.discountValue).toBe(50000)
  })

  it("normalizeVoucherUsage membaca bentuk bersarang + orderId (tidak crash toUpperCase)", () => {
    const u = normalizeVoucherUsage({
      id: "usage-1",
      orderId: "order-9",
      discountAmount: 25000,
      usedAt: "2026-09-26T10:00:00Z",
      voucher: { voucherId: "v-1", code: "HEMAT10", name: "Hemat 10%" },
    })
    expect(u).not.toBeNull()
    expect(u!.code).toBe("HEMAT10")
    expect(u!.title).toBe("Hemat 10%")
    expect(u!.orderId).toBe("order-9")
    expect(u!.discountValue).toBe(25000)
    // pemanggil lama memanggil code.toUpperCase() — pastikan terdefinisi.
    expect(() => u!.code.toUpperCase()).not.toThrow()
  })
})

describe("SP-038 — normalizer validasi voucher respons datar", () => {
  it("membaca bentuk datar tanpa objek voucher.*", () => {
    const res = normalizeVoucherValidation({
      valid: true,
      code: "HEMAT10",
      discountPercent: 10,
      maxDiscountAmount: 100000,
      minOrderValue: 50000,
    })
    expect(res.valid).toBe(true)
    expect(res.voucher).toBeDefined()
    expect(res.voucher!.code).toBe("HEMAT10")
  })
})

describe("SP-035 — leaderboard referral kontrak bersarang", () => {
  it("membaca user.* dan totalReferrals/totalRewardEarned", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonOk({
        leaderboard: [
          {
            rank: 1,
            user: { username: "budi", fullName: "Budi S", avatarUrl: null },
            totalReferrals: 12,
            successfulReferrals: 10,
            totalRewardEarned: 500000,
          },
        ],
      }),
    )
    const rows = await getReferralLeaderboard(10)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.username).toBe("budi")
    expect(rows[0]!.fullName).toBe("Budi S")
    expect(rows[0]!.invitedCount).toBe(12)
    expect(rows[0]!.totalReward).toBe(500000)
    expect(rows[0]!.rank).toBe(1)
  })
})

describe("SP-010 — daftar benefit Kahade+ frontend (7 item produk)", () => {
  it("tetap memuat 7 benefit ber-copy Indonesia", () => {
    expect(KAHADE_PLUS_BENEFITS).toHaveLength(7)
    for (const b of KAHADE_PLUS_BENEFITS) {
      expect(b.title.length).toBeGreaterThan(0)
      expect(b.description.length).toBeGreaterThan(0)
    }
  })
})
