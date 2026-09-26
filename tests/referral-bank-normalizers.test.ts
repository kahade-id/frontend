/**
 * DRIFT-REF / DRIFT-BA-01 (2026-09-26): contract drift referral & bank-accounts.
 *
 * Backend mengirim key/bentuk berbeda dari ekspektasi lama frontend:
 * - stats:   { totalReferrals, successfulReferrals, totalRewardEarned (IDR),
 *              pendingRewardCount, ... }
 * - rewards: { id, feeAmount (IDR), rewardAmount (IDR), isCredited, ... }
 * - history: relasi mentah { referrer{...}, referee{...}, rewards[],
 *              viewerRole, isRewardActive, appliedAt, ... }
 * - bank-accounts: tanpa accountNumber mentah, hanya maskedAccountNumber.
 *
 * Test ini mengunci normalizer dengan fixture berbentuk persis output
 * backend (disalin dari serializer referral.service.ts &
 * bank-accounts.service.ts).
 */
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({ http: {}, seg: (x: string) => x }))

import {
  normalizeReferralHistoryEntry,
  normalizeReferralReward,
  normalizeReferralStats,
} from "@/lib/api/referrals"
import { normalizeBankAccount } from "@/lib/api/bank-accounts"

describe("normalizeReferralStats — DRIFT-REF-01", () => {
  it("memetakan key backend ke bentuk UI (nilai IDR tidak diubah)", () => {
    const out = normalizeReferralStats({
      code: "KAHADE-AB12",
      totalReferrals: 5,
      successfulReferrals: 3,
      totalRewardEarned: 75000,
      pendingRewardCount: 2,
      remainingSlots: 95,
      maxSlots: 100,
    })
    expect(out).toEqual({ totalInvited: 5, completed: 3, pending: 2, totalReward: 75000 })
  })

  it("response kosong (belum punya kode) → nol semua, tidak crash", () => {
    expect(
      normalizeReferralStats({
        code: null,
        totalReferrals: 0,
        successfulReferrals: 0,
        totalRewardEarned: 0,
        pendingRewardCount: 0,
        remainingSlots: 100,
        maxSlots: 100,
      }),
    ).toEqual({ totalInvited: 0, completed: 0, pending: 0, totalReward: 0 })
    expect(normalizeReferralStats(null)).toEqual({
      totalInvited: 0,
      completed: 0,
      pending: 0,
      totalReward: 0,
    })
  })
})

describe("normalizeReferralReward — DRIFT-REF-02", () => {
  it("rewardAmount (IDR) → amount; isCredited true → CREDITED", () => {
    const out = normalizeReferralReward({
      id: "rw1",
      feeAmount: 500000,
      rewardAmount: 25000,
      isCredited: true,
      creditedAt: "2026-09-20T10:00:00.000Z",
      createdAt: "2026-09-19T10:00:00.000Z",
    })
    expect(out).toEqual({
      id: "rw1",
      amount: 25000,
      status: "CREDITED",
      createdAt: "2026-09-19T10:00:00.000Z",
    })
  })

  it("isCredited false → PENDING (nominal tetap tampil, tidak NaN)", () => {
    const out = normalizeReferralReward({
      id: "rw2",
      feeAmount: 500000,
      rewardAmount: 25000,
      isCredited: false,
      creditedAt: null,
      createdAt: "2026-09-21T10:00:00.000Z",
    })
    expect(out?.status).toBe("PENDING")
    expect(out?.amount).toBe(25000)
  })

  it("tanpa id → null (baris rusak dibuang, bukan blank)", () => {
    expect(normalizeReferralReward({ rewardAmount: 1 })).toBeNull()
  })
})

describe("normalizeReferralHistoryEntry — DRIFT-REF-03", () => {
  const base = {
    id: "rel1",
    referrerId: "u1",
    refereeId: "u2",
    referrer: { userId: "USR-AAAA", username: "budi", fullName: "Budi Santoso" },
    referee: { userId: "USR-BBBB", username: null, fullName: "Andi" },
    appliedAt: "2026-09-18T10:00:00.000Z",
  }

  it("viewer REFERRER → nama yang diundang (fallback fullName bila username null)", () => {
    const out = normalizeReferralHistoryEntry({
      ...base,
      viewerRole: "REFERRER",
      isRewardActive: false,
      rewards: [],
    })
    expect(out?.invitedUsername).toBe("Andi")
    expect(out?.status).toBe("PENDING")
    expect(out?.createdAt).toBe("2026-09-18T10:00:00.000Z")
  })

  it("reward credited → REWARDED + nominal & tanggal cair", () => {
    const out = normalizeReferralHistoryEntry({
      ...base,
      viewerRole: "REFERRER",
      isRewardActive: true,
      rewards: [
        { id: "rw9", feeAmount: 500000, rewardAmount: 25000, isCredited: true, creditedAt: "2026-09-20T10:00:00.000Z", createdAt: "2026-09-19T10:00:00.000Z" },
      ],
    })
    expect(out?.status).toBe("REWARDED")
    expect(out?.reward).toBe(25000)
    expect(out?.completedAt).toBe("2026-09-20T10:00:00.000Z")
  })

  it("isRewardActive tanpa credited → QUALIFIED", () => {
    const out = normalizeReferralHistoryEntry({
      ...base,
      viewerRole: "REFERRER",
      isRewardActive: true,
      rewards: [
        { id: "rw9", feeAmount: 500000, rewardAmount: 25000, isCredited: false, creditedAt: null, createdAt: "2026-09-19T10:00:00.000Z" },
      ],
    })
    expect(out?.status).toBe("QUALIFIED")
    expect(out?.reward).toBeUndefined()
  })

  it("viewer REFEREE → counterpart adalah pengundang", () => {
    const out = normalizeReferralHistoryEntry({
      ...base,
      viewerRole: "REFEREE",
      isRewardActive: false,
      rewards: [],
    })
    expect(out?.invitedUsername).toBe("budi")
  })
})

describe("normalizeBankAccount — DRIFT-BA-01", () => {
  const base = {
    id: "ba1",
    bankCode: "BCA",
    bankName: "BCA",
    accountName: "Budi Santoso",
    isPrimary: true,
    isVerified: true,
    createdAt: "2026-09-01T10:00:00.000Z",
  }

  it("maskedAccountNumber dipakai sebagai accountNumber", () => {
    const out = normalizeBankAccount({ ...base, maskedAccountNumber: "****1234" } as never)
    expect(out.accountNumber).toBe("****1234")
  })

  it("accountNumber mentah (legacy) tetap didukung bila ada", () => {
    const out = normalizeBankAccount({ ...base, accountNumber: "1234567890" } as never)
    expect(out.accountNumber).toBe("1234567890")
  })

  it("response POST/PATCH tanpa nomor → string kosong (bukan undefined)", () => {
    const out = normalizeBankAccount({ ...base } as never)
    expect(out.accountNumber).toBe("")
  })
})
