import { describe, expect, it } from "vitest"
import {
  notificationCategoryLabel,
  notificationUiCategory,
} from "@/lib/notification-category"
import {
  labelForNotificationReference,
  routeForNotificationReference,
} from "@/lib/notification-routing"

describe("notificationUiCategory", () => {
  it("memetakan enum API ke kategori ikon komponen", () => {
    expect(notificationUiCategory("TRANSAKSI")).toBe("order")
    expect(notificationUiCategory("PROMOSI")).toBe("promo")
    expect(notificationUiCategory("INFORMASI")).toBe("system")
  })
  it("jatuh ke system untuk nilai asing/kosong tanpa crash", () => {
    expect(notificationUiCategory("SPAM")).toBe("system")
    expect(notificationUiCategory("toString")).toBe("system")
    expect(notificationUiCategory(null)).toBe("system")
    expect(notificationUiCategory(undefined)).toBe("system")
  })
})

describe("notificationCategoryLabel", () => {
  it("melabeli enum yang dikenal", () => {
    expect(notificationCategoryLabel("TRANSAKSI")).toBe("Transaksi")
    expect(notificationCategoryLabel("PROMOSI")).toBe("Promosi")
    expect(notificationCategoryLabel("INFORMASI")).toBe("Informasi")
  })
  it("menampilkan nilai asing apa adanya, kosong menjadi Notifikasi", () => {
    expect(notificationCategoryLabel("SPAM")).toBe("SPAM")
    expect(notificationCategoryLabel(null)).toBe("Notifikasi")
    expect(notificationCategoryLabel(undefined)).toBe("Notifikasi")
  })
})

describe("labelForNotificationReference", () => {
  it("sejajar dengan routeForNotificationReference: berlabel bila ada rute", () => {
    const refs = [
      { referenceType: "ORDER", referenceId: "o1" },
      { referenceType: "DISPUTE", referenceId: "d1" },
      { referenceType: "CHAT_ROOM", referenceId: "c1" },
      { referenceType: "WALLET", referenceId: null },
      { referenceType: "KYC", referenceId: null },
      { referenceType: "USER", referenceId: "budi" },
    ]
    for (const ref of refs) {
      expect(routeForNotificationReference(ref)).not.toBeNull()
      expect(labelForNotificationReference(ref)).toBeTruthy()
    }
  })
  it("null untuk referensi tak dikenal/kosong (detail tampil tanpa CTA)", () => {
    expect(labelForNotificationReference({ referenceType: "ALIEN", referenceId: "x" })).toBeNull()
    expect(labelForNotificationReference({})).toBeNull()
    expect(routeForNotificationReference({ referenceType: "ALIEN", referenceId: "x" })).toBeNull()
  })
})
