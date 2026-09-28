/**
 * batch 139 — TIM FE139-WALLET, Wave 2 (D03/D04/D05).
 * Helper murni di lib/wallet-batch139.ts.
 */
import { describe, expect, it } from "vitest"
import {
  addressMissingFields,
  breakdownAddsUp,
  ctaUnavailableReasons,
  disabledPresetReason,
  resolveRevalidatedRecipient,
  splitTimelineLatest,
  validateTrackingInput,
} from "../lib/wallet-batch139"

// ---------------------------------------------------------------- D04
describe("D04 resolveRevalidatedRecipient", () => {
  const selected = { id: "u-1", name: "Budi Lama" }

  it("valid + nama diperbarui dari fullName server", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-1", username: "budi", fullName: "Budi Baru" }],
      selected,
    )
    expect(out).toEqual({ valid: true, name: "Budi Baru" })
  })

  it("valid + fallback ke username bila fullName kosong", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-1", username: "budi", fullName: null }],
      selected,
    )
    expect(out).toEqual({ valid: true, name: "budi" })
  })

  it("valid bila id cocok walau username berubah (kunci = id)", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-1", username: "budi_baru", fullName: "Budi Baru" }],
      selected,
    )
    expect(out.valid).toBe(true)
  })

  it("INVALID bila id tidak ada di hasil lookup (fail-closed)", () => {
    const out = resolveRevalidatedRecipient(
      [{ id: "u-9", username: "orang_lain", fullName: "Orang Lain" }],
      selected,
    )
    expect(out).toEqual({ valid: false })
  })

  it("INVALID bila hasil lookup kosong", () => {
    expect(resolveRevalidatedRecipient([], selected)).toEqual({ valid: false })
  })
})

// ---------------------------------------------------------------- D05
describe("D05 disabledPresetReason", () => {
  const fmt = (v: number) => `Rp${v}`

  it("alasan dikembalikan bila ada chip di atas max", () => {
    const reason = disabledPresetReason([50_000, 100_000, 250_000], 100_000, false, fmt)
    expect(reason).toContain("Rp100000")
    expect(reason).toContain("melebihi batas")
  })

  it("null bila semua chip dalam batas", () => {
    expect(disabledPresetReason([50_000, 100_000], 100_000, false, fmt)).toBeNull()
  })

  it("null bila keypad disabled total (alasan berbeda)", () => {
    expect(disabledPresetReason([50_000, 500_000], 100_000, true, fmt)).toBeNull()
  })

  it("null bila max tidak diketahui", () => {
    expect(disabledPresetReason([50_000], undefined, false, fmt)).toBeNull()
  })

  it("null bila tidak ada preset", () => {
    expect(disabledPresetReason([], 100_000, false, fmt)).toBeNull()
    expect(disabledPresetReason(undefined, 100_000, false, fmt)).toBeNull()
  })
})

// ---------------------------------------------------------------- D03
describe("D03 breakdownAddsUp", () => {
  it("true bila tersedia + ditahan = total", () => {
    expect(breakdownAddsUp(80_000, 20_000, 100_000)).toBe(true)
  })

  it("false bila tidak pas (jangan klaim konsistensi)", () => {
    expect(breakdownAddsUp(80_000, 10_000, 100_000)).toBe(false)
  })

  it("false bila tersedia tidak diketahui", () => {
    expect(breakdownAddsUp(undefined, 20_000, 100_000)).toBe(false)
  })

  it("false bila total tidak diketahui", () => {
    expect(breakdownAddsUp(80_000, 20_000, undefined)).toBe(false)
  })

  it("true bila ditahan nol dan tersedia = total", () => {
    expect(breakdownAddsUp(100_000, 0, 100_000)).toBe(true)
  })
})

// ---------------------------------------------------------------- D15
describe("D15 ctaUnavailableReasons", () => {
  it("pembeli menunggu konfirmasi penjual (WAITING_CONFIRMATION)", () => {
    const r = ctaUnavailableReasons("WAITING_CONFIRMATION", "BUYER")
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/penjual/i)
  })

  it("penjual menunggu pembayaran pembeli", () => {
    const r = ctaUnavailableReasons("WAITING_PAYMENT", "SELLER")
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/pembeli/i)
  })

  it("pembeli menunggu resi penjual (PROCESSING)", () => {
    const r = ctaUnavailableReasons("PROCESSING", "BUYER")
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/resi/i)
  })

  it("penjual menunggu konfirmasi terima (IN_DELIVERY)", () => {
    const r = ctaUnavailableReasons("IN_DELIVERY", "SELLER")
    expect(r).toHaveLength(1)
  })

  it("sengketa mengunci aksi transaksi", () => {
    const r = ctaUnavailableReasons("DISPUTED", "BUYER")
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/sengketa/i)
  })

  it("status terminal tidak mengarang alasan", () => {
    expect(ctaUnavailableReasons("COMPLETED", "BUYER")).toEqual([])
    expect(ctaUnavailableReasons("CANCELLED", "SELLER")).toEqual([])
    expect(ctaUnavailableReasons("REFUNDED", undefined)).toEqual([])
  })

  it("peran yang bisa beraksi tidak diberi alasan", () => {
    expect(ctaUnavailableReasons("WAITING_CONFIRMATION", "SELLER")).toEqual([])
    expect(ctaUnavailableReasons("WAITING_PAYMENT", "BUYER")).toEqual([])
  })
})

// ---------------------------------------------------------------- D16
describe("D16 validateTrackingInput", () => {
  it("fisik: resi valid lolos", () => {
    expect(validateTrackingInput("JNE", "SPXID0123456789", true)).toEqual({})
  })

  it("fisik: resi kosong ditolak", () => {
    const v = validateTrackingInput("JNE", "  ", true)
    expect(v.trackingError).toMatch(/wajib/i)
  })

  it("fisik: resi berspasi ditolak dengan penjelasan", () => {
    const v = validateTrackingInput("JNE", "SPX 123 456", true)
    expect(v.trackingError).toMatch(/tanpa spasi/i)
  })

  it("fisik: resi terlalu pendek / karakter aneh ditolak", () => {
    expect(validateTrackingInput("JNE", "AB12", true).trackingError).toBeTruthy()
    expect(validateTrackingInput("JNE", "SPX#123456", true).trackingError).toBeTruthy()
  })

  it("fisik: kurir kosong ditolak", () => {
    const v = validateTrackingInput("", "SPXID0123456789", true)
    expect(v.courierError).toMatch(/kurir/i)
  })

  it("jasa/digital: kosong boleh, terisi tetap divalidasi", () => {
    expect(validateTrackingInput("", "", false)).toEqual({})
    expect(validateTrackingInput("", "xx", false).trackingError).toBeTruthy()
  })
})

// ---------------------------------------------------------------- D09
describe("D09 addressMissingFields", () => {
  const full = {
    label: "Rumah",
    recipientName: "Budi",
    phone: "081234567890",
    addressLine: "Jl. Mawar No. 1",
    city: "Jakarta",
    postalCode: "10110",
  }

  it("alamat lengkap tidak ada yang hilang", () => {
    expect(addressMissingFields(full)).toEqual([])
  })

  it("null = belum ada alamat", () => {
    expect(addressMissingFields(null)).toEqual(["alamat"])
  })

  it("field kosong dilaporkan spesifik", () => {
    const missing = addressMissingFields({ ...full, city: "  ", postalCode: "" })
    expect(missing).toContain("kota")
    expect(missing).toContain("kode pos")
    expect(missing).not.toContain("nama penerima")
  })
})

// ---------------------------------------------------------------- D13
describe("D13 splitTimelineLatest", () => {
  it("kejadian terakhir dipisah dari yang lama", () => {
    const { latest, older } = splitTimelineLatest(["a", "b", "c"])
    expect(latest).toBe("c")
    expect(older).toEqual(["a", "b"])
  })

  it("kosong aman", () => {
    const { latest, older } = splitTimelineLatest([])
    expect(latest).toBeNull()
    expect(older).toEqual([])
  })

  it("satu entri = terbaru tanpa riwayat lama", () => {
    const { latest, older } = splitTimelineLatest(["a"])
    expect(latest).toBe("a")
    expect(older).toEqual([])
  })
})
