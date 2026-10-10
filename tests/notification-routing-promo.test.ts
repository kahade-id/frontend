/**
 * Audit Voucher & Referral 2026-10-10 (F30): notifikasi promo/referral HARUS
 * membuka layar yang relevan, bukan tab Notifikasi.
 *
 * Payload backend:
 *   - VOUCHER_ISSUED (campaign.service, admin-disputes, dormant-winback):
 *     pushData `{ type: 'VOUCHER_ISSUED', campaignId?, voucherCode }`
 *   - REFERRAL_REWARD_RECEIVED (referral.service B13):
 *     pushData `{ type: 'REFERRAL_REWARD_RECEIVED', orderId }`
 *   - TOPUP_BONUS_CREDITED / CAMPAIGN_CASHBACK_CREDITED (wallet.service)
 */
import { afterEach, describe, expect, it } from "vitest"

import {
  labelForNotificationReference,
  routeForNotificationReference,
  routeForPushData,
} from "@/lib/notification-routing"
import { __resetWalletFlagForTests, __setWalletServerStatusForTests } from "@/lib/wallet-flag"

function hrefPath(href: unknown): string | null {
  if (typeof href === "string") return href
  if (href && typeof href === "object") {
    const o = href as { pathname?: string }
    return typeof o.pathname === "string" ? o.pathname : null
  }
  return null
}

function hrefParams(href: unknown): Record<string, string> | undefined {
  if (href && typeof href === "object") return (href as { params?: Record<string, string> }).params
  return undefined
}

afterEach(() => {
  __resetWalletFlagForTests()
})

describe("VOUCHER_ISSUED → Promo dengan kode terisi", () => {
  it("push kampanye (campaignId + voucherCode) → /vouchers?code=<kode>", () => {
    const href = routeForPushData({ type: "VOUCHER_ISSUED", campaignId: "cmp-1", voucherCode: "HEMAT10" })
    expect(hrefPath(href)).toBe("/vouchers")
    expect(hrefParams(href)?.code).toBe("HEMAT10")
  })

  it("push win-back (hanya voucherCode) → /vouchers?code=<kode>", () => {
    const href = routeForPushData({ type: "VOUCHER_ISSUED", voucherCode: "WINBACK-7" })
    expect(hrefPath(href)).toBe("/vouchers")
    expect(hrefParams(href)?.code).toBe("WINBACK-7")
  })

  it("item inbox referenceType VOUCHER_ISSUED tanpa id → /vouchers", () => {
    expect(hrefPath(routeForNotificationReference({ referenceType: "VOUCHER_ISSUED" }))).toBe("/vouchers")
    expect(labelForNotificationReference({ referenceType: "VOUCHER_ISSUED" })).toBe("Lihat voucher")
  })
})

describe("REFERRAL_REWARD_RECEIVED → layar referral", () => {
  it("push dengan orderId TIDAK nyasar ke detail order", () => {
    const href = routeForPushData({ type: "REFERRAL_REWARD_RECEIVED", orderId: "ORD-1" })
    expect(hrefPath(href)).toBe("/referral")
  })

  it("alias lama `referral` tetap bekerja + label", () => {
    expect(hrefPath(routeForNotificationReference({ referenceType: "REFERRAL" }))).toBe("/referral")
    expect(labelForNotificationReference({ referenceType: "REFERRAL_REWARD_RECEIVED" })).toBe("Lihat referral")
  })
})

describe("TOPUP_BONUS_CREDITED / CAMPAIGN_CASHBACK_CREDITED → dompet (hormati kill-switch)", () => {
  it("dompet aktif → /wallet", () => {
    __setWalletServerStatusForTests(true)
    expect(hrefPath(routeForPushData({ type: "TOPUP_BONUS_CREDITED" }))).toBe("/wallet")
    expect(hrefPath(routeForPushData({ type: "CAMPAIGN_CASHBACK_CREDITED" }))).toBe("/wallet")
    expect(labelForNotificationReference({ referenceType: "TOPUP_BONUS_CREDITED" })).toBe("Lihat dompet")
  })

  it("dompet nonaktif → fallback kill-switch, bukan layar blokir", () => {
    __setWalletServerStatusForTests(false)
    const href = routeForPushData({ type: "TOPUP_BONUS_CREDITED" })
    expect(hrefPath(href)).not.toBe("/wallet")
  })
})
