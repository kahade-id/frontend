import { describe, expect, it } from "vitest"
import {
  notificationTypeUiCategory,
  notificationUiCategory,
} from "@/lib/notification-category"

describe("notificationTypeUiCategory (CN-010)", () => {
  it("memetakan prefix tipe backend ke ikon yang tepat", () => {
    expect(notificationTypeUiCategory("ORDER_NEW")).toBe("order")
    expect(notificationTypeUiCategory("ORDER_COMPLETED")).toBe("order")
    expect(notificationTypeUiCategory("WALLET_TOPUP_SUCCESS")).toBe("wallet")
    expect(notificationTypeUiCategory("WALLET_REFUND_RECEIVED")).toBe("wallet")
    expect(notificationTypeUiCategory("CHAT_NEW_MESSAGE")).toBe("chat")
    expect(notificationTypeUiCategory("DISPUTE_SUBMITTED")).toBe("dispute")
    expect(notificationTypeUiCategory("DISPUTE_ESCALATED")).toBe("dispute")
    expect(notificationTypeUiCategory("SECURITY_NEW_LOGIN")).toBe("security")
    expect(notificationTypeUiCategory("KYC_APPROVED")).toBe("security")
    expect(notificationTypeUiCategory("BUSINESS_VERIFICATION_REJECTED")).toBe("security")
    expect(notificationTypeUiCategory("REFERRAL_REWARD_RECEIVED")).toBe("referral")
    expect(notificationTypeUiCategory("VOUCHER_ISSUED")).toBe("promo")
    expect(notificationTypeUiCategory("CAMPAIGN_CASHBACK_CREDITED")).toBe("promo")
    expect(notificationTypeUiCategory("SUBSCRIPTION_ACTIVATED")).toBe("promo")
  })

  it("return null untuk tipe tak dikenal / kosong", () => {
    expect(notificationTypeUiCategory("UNKNOWN_TYPE")).toBeNull()
    expect(notificationTypeUiCategory(null)).toBeNull()
    expect(notificationTypeUiCategory(undefined)).toBeNull()
    expect(notificationTypeUiCategory("")).toBeNull()
  })

  it("fallback kategori tetap bekerja", () => {
    expect(notificationUiCategory("TRANSAKSI")).toBe("order")
    expect(notificationUiCategory("PROMOSI")).toBe("promo")
    expect(notificationUiCategory("INFORMASI")).toBe("system")
  })
})
