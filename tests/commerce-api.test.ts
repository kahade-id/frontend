import { describe, expect, it } from "vitest"
import {
  addressLabelText,
  normalizeAddress,
  normalizeJastipTrip,
  normalizeOrderAgreement,
  normalizePatunganGroup,
  normalizeProductBadges,
  normalizeProductCommerceFields,
  normalizeProductStats,
  normalizeSearchTrend,
  normalizeSellerVoucher,
  normalizeServiceSlot,
  normalizeDigitalAsset,
  normalizeSlotBooking,
  senToIdr,
} from "@/lib/api/commerce"

describe("commerce normalizers", () => {
  it("senToIdr mengonversi sen → IDR", () => {
    expect(senToIdr(15000000)).toBe(150000)
    expect(senToIdr("2500000")).toBe(25000)
    expect(senToIdr(null)).toBeNull()
    expect(senToIdr("abc")).toBeNull()
  })

  it("normalizeProductCommerceFields membaca PATCH commerce", () => {
    const f = normalizeProductCommerceFields({
      id: "sc1",
      productType: "JASA",
      originalPrice: 20000000,
      serviceDeadlineDays: 7,
      scheduledAt: "2026-10-01T10:00:00+07:00",
      isActive: true,
    })
    expect(f?.productType).toBe("JASA")
    expect(f?.originalPriceIdr).toBe(200000)
    expect(f?.serviceDeadlineDays).toBe(7)
    expect(normalizeProductCommerceFields({ id: "x", productType: "ANEH" })?.productType).toBeNull()
    expect(normalizeProductCommerceFields(null)).toBeNull()
  })

  it("normalizeProductStats memetakan angka statistik", () => {
    const s = normalizeProductStats({ showcaseId: "sc1", views: 10, saves: 2, purchases: 3 })
    expect(s).toMatchObject({ showcaseId: "sc1", views: 10, saves: 2, purchases: 3, clicks: 0 })
    expect(normalizeProductStats({})).toBeNull()
  })

  it("normalizeProductBadges hanya menerima TERLARIS/DISKON", () => {
    const b = normalizeProductBadges({ showcaseId: "sc1", badges: ["TERLARIS", "X", "DISKON"], completedOrders90d: 12 })
    expect(b?.badges).toEqual(["TERLARIS", "DISKON"])
    expect(b?.completedOrders90d).toBe(12)
  })

  it("normalizeAddress + addressLabelText", () => {
    const a = normalizeAddress({
      id: "a1",
      label: "LAINNYA",
      customLabel: "Kos",
      recipientName: "Budi",
      phone: "0812",
      addressLine: "Jl. Mawar",
      city: "Bandung",
      postalCode: "40111",
      isDefault: true,
    })
    expect(a?.isDefault).toBe(true)
    expect(addressLabelText(a!)).toBe("Kos")
    expect(addressLabelText({ label: "RUMAH", customLabel: null })).toBe("Rumah")
  })

  it("normalizeSellerVoucher memetakan tipe persen/nominal", () => {
    const v = normalizeSellerVoucher({ id: "v1", code: "HEMAT10", voucherType: "PERSEN", discountPercent: 10, isActive: true })
    expect(v?.voucherType).toBe("PERSEN")
    expect(v?.discountPercent).toBe(10)
  })

  it("normalizeServiceSlot menghitung sisa kapasitas", () => {
    const s = normalizeServiceSlot({ id: "s1", capacity: 5, bookedCount: 2, slotDate: "2026-10-02", startTime: "09:00", endTime: "10:00" })
    expect(s?.remaining).toBe(3)
  })

  it("normalizeSlotBooking membaca booking", () => {
    const b = normalizeSlotBooking({ id: "b1", slotId: "s1", status: "BOOKED" })
    expect(b?.status).toBe("BOOKED")
  })

  it("normalizeOrderAgreement memetakan status SPK", () => {
    const a = normalizeOrderAgreement({ id: "ag1", orderId: "KHD-1", text: "sepakat", status: "AGREED" })
    expect(a?.status).toBe("AGREED")
    const w = normalizeOrderAgreement({ id: "ag2", orderId: "KHD-2", text: "x", status: "??? " })
    expect(w?.status).toBe("WAITING_COUNTERPART")
  })

  it("normalizeDigitalAsset memetakan tipe aset", () => {
    const d = normalizeDigitalAsset({ id: "d1", assetType: "LICENSE", payload: "ABC-123" })
    expect(d?.assetType).toBe("LICENSE")
    expect(d?.payload).toBe("ABC-123")
  })

  it("normalizeSearchTrend membaca trending", () => {
    expect(normalizeSearchTrend({ keyword: "kopi", searchCount: 42 })).toEqual({ keyword: "kopi", searchCount: 42 })
    expect(normalizeSearchTrend({})).toBeNull()
  })

  it("normalizeJastipTrip membaca trip + peserta", () => {
    const t = normalizeJastipTrip({
      id: "t1",
      title: "Trip Jepang",
      status: "OPEN",
      participants: [{ id: "p1", status: "PRICE_LOCKED", goodsAmountIdr: 100000 }],
    })
    expect(t?.status).toBe("OPEN")
    expect(t?.participants[0]?.goodsAmountIdr).toBe(100000)
    expect(t?.participants[0]?.status).toBe("PRICE_LOCKED")
  })

  it("normalizePatunganGroup membaca agregat transparan", () => {
    const g = normalizePatunganGroup({
      id: "g1",
      status: "OPEN",
      targetAmountIdr: 1000000,
      totalPaidIdr: 250000,
      remainingIdr: 750000,
      slotsLeft: 3,
      participants: [{ id: "pp1", amount: 25000000, status: "PAID" }],
    })
    expect(g?.targetAmountIdr).toBe(1000000)
    expect(g?.participants[0]?.amountIdr).toBe(250000)
    expect(g?.slotsLeft).toBe(3)
  })
})
