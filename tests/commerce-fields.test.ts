/**
 * CR-01 (audit etalase 2026-10-10): "Ubah detail" tidak boleh menimpa field
 * commerce yang tidak terlihat di form.
 *
 * Bug lama: editor memprefill `EMPTY_COMMERCE_FORM` (LAINNYA + null) saat
 * cache sesi kosong, lalu mem-PATCH seluruh form setiap simpan → ganti judul
 * saja menghapus tipe produk, harga coret, tenggat jasa, dan jadwal publish.
 */
import { describe, expect, it } from "vitest"

import {
  EMPTY_COMMERCE_VALUES,
  buildCommercePatch,
  commerceFormFromFields,
  commerceFormFromShowcaseItem,
} from "@/lib/commerce-fields"

describe("buildCommercePatch — hanya field yang berubah", () => {
  it("tidak ada perubahan → null (jangan PATCH sama sekali)", () => {
    const values = { ...EMPTY_COMMERCE_VALUES, productType: "JASA" as const, serviceDeadlineDays: 7 }
    expect(buildCommercePatch(values, { ...values })).toBeNull()
  })

  it("cache kosong + pengguna hanya ganti judul → null (bug lama: kirim LAINNYA + null)", () => {
    expect(buildCommercePatch(EMPTY_COMMERCE_VALUES, { ...EMPTY_COMMERCE_VALUES })).toBeNull()
  })

  it("hanya tipe produk yang diubah → DTO hanya berisi productType", () => {
    expect(buildCommercePatch(EMPTY_COMMERCE_VALUES, { ...EMPTY_COMMERCE_VALUES, productType: "FISIK" })).toEqual({
      productType: "FISIK",
    })
  })

  it("menghapus harga coret / jadwal mengirim null eksplisit (kontrak backend: null = hapus)", () => {
    const initial = { ...EMPTY_COMMERCE_VALUES, originalPriceIdr: 200000, scheduledAt: "2026-12-01T10:00:00+07:00" }
    expect(buildCommercePatch(initial, { ...initial, originalPriceIdr: null, scheduledAt: null })).toEqual({
      originalPriceIdr: null,
      scheduledAt: null,
    })
  })

  it("info pengiriman digital: spasi saja = kosong; kosong dari terisi → null", () => {
    const initial = { ...EMPTY_COMMERCE_VALUES, digitalDeliveryInfo: "Kirim via email" }
    expect(buildCommercePatch(initial, { ...initial, digitalDeliveryInfo: "Kirim via email  " })).toBeNull()
    expect(buildCommercePatch(initial, { ...initial, digitalDeliveryInfo: "   " })).toEqual({ digitalDeliveryInfo: null })
  })
})

describe("commerceFormFromShowcaseItem — prefill dari GET /me/showcase", () => {
  it("backend lama tanpa productType → known=false (pemanggil jatuh ke cache)", () => {
    expect(commerceFormFromShowcaseItem({ id: "a", title: "x" })).toEqual({ values: EMPTY_COMMERCE_VALUES, known: false })
  })

  it("productType null dari server = diketahui kosong (bukan tidak diketahui)", () => {
    const out = commerceFormFromShowcaseItem({ id: "a", productType: null, originalPrice: null })
    expect(out.known).toBe(true)
    expect(out.values.productType).toBe("LAINNYA")
  })

  it("memakai originalPriceIdr (BE-1) bila ada; originalPrice lama (sen) dikonversi", () => {
    expect(
      commerceFormFromShowcaseItem({ productType: "FISIK", originalPriceIdr: 250000, originalPrice: 25000000 }).values
        .originalPriceIdr,
    ).toBe(250000)
    expect(commerceFormFromShowcaseItem({ productType: "FISIK", originalPrice: 25000000 }).values.originalPriceIdr).toBe(
      250000,
    )
  })

  it("mengisi tenggat jasa, info digital, dan jadwal; nilai asing diabaikan", () => {
    const out = commerceFormFromShowcaseItem({
      productType: "JASA",
      serviceDeadlineDays: 7,
      digitalDeliveryInfo: "Link drive",
      scheduledAt: "2026-12-01T03:00:00.000Z",
    })
    expect(out.values).toEqual({
      productType: "JASA",
      originalPriceIdr: null,
      serviceDeadlineDays: 7,
      digitalDeliveryInfo: "Link drive",
      scheduledAt: "2026-12-01T03:00:00.000Z",
    })
    expect(commerceFormFromShowcaseItem({ productType: "MAKANAN" }).known).toBe(false)
  })
})

describe("commerceFormFromFields — prefill dari hasil PATCH (cache sesi)", () => {
  it("memetakan null ke default form", () => {
    expect(
      commerceFormFromFields({
        id: "a",
        productType: null,
        originalPriceIdr: null,
        serviceDeadlineDays: null,
        digitalDeliveryInfo: null,
        scheduledAt: null,
        isActive: true,
      }),
    ).toEqual(EMPTY_COMMERCE_VALUES)
  })
})
