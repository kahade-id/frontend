/**
 * Audit Voucher & Referral 2026-10-10 — pengunci regresi lapisan lib:
 *   - F08/F12 normalizeVoucher: `remainingUses` (null ≠ 0 ≠ undefined),
 *     `applicableTo`.
 *   - F10/F11 voucherKindOf / voucherRoleOf.
 *   - F21 voucherErrorMessage: kode VOUCHER_* → copy Indonesia spesifik,
 *     NOT_APPLICABLE dibedakan dari kata kunci pesan backend.
 *   - F22 referralApplyMessage + isReferralCodeFormat.
 *   - F01/F02 lib/pending-referral: normalisasi, TTL, bersih setelah dipakai.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({ http: {}, seg: (x: string) => x }))

const store = new Map<string, string>()
vi.mock("@/lib/secure-storage", () => ({
  getRawItem: async (key: string) => store.get(key) ?? null,
  setRawItem: async (key: string, value: string) => {
    store.set(key, value)
  },
  deleteRawItem: async (key: string) => {
    store.delete(key)
  },
}))

import { ApiError } from "@/lib/api/errors"
import { isReferralCodeFormat, referralApplyMessage } from "@/lib/api/referrals"
import {
  normalizeVoucher,
  normalizeVoucherValidation,
  voucherErrorMessage,
  voucherKindOf,
  voucherRoleOf,
} from "@/lib/api/vouchers"
import {
  clearPendingReferralCode,
  getPendingReferralCode,
  normalizeReferralCode,
  savePendingReferralCode,
} from "@/lib/pending-referral"

function apiError(backendCode: string, message: string, status = 400) {
  return new ApiError({
    code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
    message,
    status,
    backendCode,
    raw: { success: false, errors: { code: backendCode, message } },
  })
}

describe("normalizeVoucher — F08/F12 (bentuk GET /v1/vouchers/available)", () => {
  const base = {
    id: "v1",
    code: "HEMAT10",
    name: "Hemat 10 ribu",
    voucherType: "FEE_DISCOUNT_FLAT",
    discountAmount: 10000,
    discountPercent: null,
    applicableTo: "BUYER_ONLY",
    validUntil: "2026-12-31T16:59:59.000Z",
    isActive: true,
  }

  it("remainingUses null (tanpa batas per user) tetap null — bukan 0/undefined", () => {
    const out = normalizeVoucher({ ...base, usedCount: 2, remainingUses: null })
    expect(out?.remainingUses).toBeNull()
    expect(out?.usedCount).toBe(2)
  })

  it("remainingUses 0 (sudah habis untuk user ini) → 0", () => {
    expect(normalizeVoucher({ ...base, usedCount: 1, remainingUses: 0 })?.remainingUses).toBe(0)
  })

  it("backend lama tanpa remainingUses → undefined (tidak diketahui)", () => {
    expect(normalizeVoucher(base)?.remainingUses).toBeUndefined()
  })

  it("applicableTo dibaca & dipetakan ke badge peran", () => {
    const out = normalizeVoucher(base)
    expect(out?.applicableTo).toBe("BUYER_ONLY")
    expect(voucherRoleOf(out?.applicableTo)).toBe("BUYER")
    expect(voucherRoleOf("SELLER_ONLY")).toBe("SELLER")
    expect(voucherRoleOf("NEW_USER")).toBe("ALL")
    expect(voucherRoleOf(undefined)).toBe("ALL")
  })

  it("validate (bentuk datar) membawa applicableTo & validUntil (B07)", () => {
    const out = normalizeVoucherValidation({
      valid: true,
      code: "HEMAT10",
      name: "Hemat",
      voucherType: "FEE_DISCOUNT_PERCENT",
      discountPercent: 50,
      discountAmount: null,
      applicableTo: "SELLER_ONLY",
      validUntil: "2026-12-31T16:59:59.000Z",
    })
    expect(out.valid).toBe(true)
    expect(out.voucher?.discountType).toBe("PERCENT")
    expect(out.voucher?.discountValue).toBe(50)
    expect(out.voucher?.applicableTo).toBe("SELLER_ONLY")
    expect(out.voucher?.expiresAt).toBe("2026-12-31T16:59:59.000Z")
  })
})

describe("voucherKindOf — F10/F11", () => {
  it("memetakan kosakata backend ke jenis manfaat", () => {
    expect(voucherKindOf("FEE_DISCOUNT_FLAT")).toBe("FEE_DISCOUNT")
    expect(voucherKindOf("FEE_DISCOUNT_PERCENT")).toBe("FEE_DISCOUNT")
    expect(voucherKindOf("WALLET_CASHBACK")).toBe("CASHBACK")
    expect(voucherKindOf("TOPUP_BONUS")).toBe("TOPUP_BONUS")
    expect(voucherKindOf("topup_bonus")).toBe("TOPUP_BONUS")
    expect(voucherKindOf(undefined)).toBe("UNKNOWN")
    expect(voucherKindOf("SOMETHING_NEW")).toBe("UNKNOWN")
  })
})

describe("voucherErrorMessage — F21", () => {
  it("bukan error voucher → undefined (jalur error biasa)", () => {
    expect(voucherErrorMessage(new Error("x"))).toBeUndefined()
    expect(voucherErrorMessage(apiError("ORDER_NOT_FOUND", "Order not found", 404))).toBeUndefined()
  })

  it("kode NOT_FOUND / EXPIRED / USAGE_LIMIT → copy spesifik", () => {
    expect(voucherErrorMessage(apiError("VOUCHER_NOT_FOUND", "Voucher not found", 404))).toBe(
      "Kode voucher tidak ditemukan.",
    )
    expect(voucherErrorMessage(apiError("VOUCHER_EXPIRED", "Voucher is expired or inactive"))).toBe(
      "Voucher sudah kedaluwarsa atau tidak aktif.",
    )
    expect(
      voucherErrorMessage(apiError("VOUCHER_USAGE_LIMIT_REACHED", "Voucher has reached its maximum usage limit")),
    ).toBe("Kuota voucher sudah habis.")
    expect(
      voucherErrorMessage(
        apiError("VOUCHER_USAGE_LIMIT_REACHED", "You have reached the per-user usage limit for this voucher"),
      ),
    ).toBe("Anda sudah mencapai batas pemakaian voucher ini.")
  })

  it("NOT_APPLICABLE dibedakan dari kata kunci pesan backend (tidak pernah dirender mentah)", () => {
    const cases: Array<[string, string]> = [
      ["This is a seller voucher — apply it in the seller voucher field", "Ini voucher toko — masukkan di kolom voucher toko penjual."],
      ["Top-up bonus vouchers can only be used for wallet top-ups", "Kode ini untuk bonus top-up saldo, bukan untuk transaksi."],
      ["This voucher cannot be used for wallet top-ups", "Voucher ini tidak berlaku untuk top-up saldo."],
      ["This voucher is only available for buyers", "Voucher ini hanya untuk pembeli."],
      ["This voucher is only for sellers. Please specify your role.", "Voucher ini hanya untuk penjual."],
      ["This voucher is only available for new users", "Voucher ini hanya untuk pengguna baru."],
      ["This voucher is only available for dormant users", "Voucher ini khusus akun yang lama tidak bertransaksi."],
      ["Order value does not meet the minimum requirement for this voucher", "Nilai transaksi belum memenuhi minimum voucher ini."],
      ["This voucher is assigned to a different user", "Voucher ini ditujukan untuk akun lain."],
      ["Something new", "Voucher tidak berlaku untuk transaksi ini."],
    ]
    for (const [backendMessage, expected] of cases) {
      const out = voucherErrorMessage(apiError("VOUCHER_NOT_APPLICABLE", backendMessage))
      expect(out, backendMessage).toBe(expected)
      expect(out).not.toMatch(/voucher is|only available|please specify/i)
    }
  })
})

describe("referralApplyMessage / isReferralCodeFormat — F22", () => {
  it("format kontrak KH + 6–8 alfanumerik", () => {
    expect(isReferralCodeFormat("KHABC123")).toBe(true)
    expect(isReferralCodeFormat(" khabc123 ")).toBe(true)
    expect(isReferralCodeFormat("KHABCDEFGH")).toBe(true)
    expect(isReferralCodeFormat("KHABC12")).toBe(false)
    expect(isReferralCodeFormat("KHABCDEFGHI")).toBe(false)
    expect(isReferralCodeFormat("ABCDEF12")).toBe(false)
    expect(isReferralCodeFormat("KH-ABC12")).toBe(false)
  })

  it("semua kode backend referral.service terpetakan; tak dikenal → undefined", () => {
    for (const code of [
      "REFERRAL_CODE_NOT_FOUND",
      "REFERRAL_SELF",
      "REFERRAL_ALREADY_APPLIED",
      "REFERRAL_NOT_NEW_USER",
      "REFERRAL_LIMIT_REACHED",
      "CIRCULAR_REFERRAL",
    ]) {
      expect(referralApplyMessage(code), code).toBeTruthy()
      expect(referralApplyMessage(code.toLowerCase()), code).toBeTruthy()
    }
    expect(referralApplyMessage("USER_NOT_FOUND")).toBeUndefined()
    expect(referralApplyMessage(undefined)).toBeUndefined()
  })
})

describe("lib/pending-referral — F01/F02", () => {
  beforeEach(() => {
    store.clear()
    vi.useRealTimers()
  })

  it("normalizeReferralCode: trim + uppercase; kosong/terlalu panjang/karakter aneh → null", () => {
    expect(normalizeReferralCode("  khAbc123 ")).toBe("KHABC123")
    expect(normalizeReferralCode("")).toBeNull()
    expect(normalizeReferralCode("   ")).toBeNull()
    expect(normalizeReferralCode("A".repeat(21))).toBeNull()
    expect(normalizeReferralCode("KH ABC")).toBeNull()
    expect(normalizeReferralCode("<script>")).toBeNull()
    expect(normalizeReferralCode(undefined)).toBeNull()
  })

  it("simpan → baca → bersih setelah dipakai", async () => {
    await savePendingReferralCode("khabc123")
    expect(await getPendingReferralCode()).toBe("KHABC123")
    await clearPendingReferralCode()
    expect(await getPendingReferralCode()).toBeNull()
  })

  it("kode tidak valid tidak disimpan", async () => {
    await savePendingReferralCode("bad code!")
    expect(await getPendingReferralCode()).toBeNull()
  })

  it("kedaluwarsa setelah 7 hari (tautan lama tidak menempel di perangkat bersama)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"))
    await savePendingReferralCode("KHABC123")
    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"))
    expect(await getPendingReferralCode()).toBe("KHABC123")
    vi.setSystemTime(new Date("2026-10-09T00:00:01Z"))
    expect(await getPendingReferralCode()).toBeNull()
  })

  it("isi penyimpanan rusak → null, tidak melempar", async () => {
    store.set("kahade.referral.pendingCode", "{not json")
    expect(await getPendingReferralCode()).toBeNull()
  })
})
