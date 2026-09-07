import { describe, expect, it } from "vitest"
import {
  formatRupiah,
  parseRupiah,
  formatNumber,
  formatDecimal,
  formatDate,
  formatDateTime,
  formatTime,
  formatCountdown,
  formatPhoneId,
  formatFileSize,
  truncateMiddle,
} from "@/lib/format"

/**
 * Regresi audit #5 — enam bug format yang terkonfirmasi lewat output runtime
 * sebelum diperbaiki. Semua kasus di sini dulunya menghasilkan string yang
 * salah (bukan hanya tidak rapi), dan tiga di antaranya mengubah arti data
 * keuangan/nomor pelanggan.
 */
describe("audit #5 — regresi format", () => {
  it("formatPhoneId membuang trunk 0 dan kode negara 62 dalam urutan apa pun", () => {
    // Sebelum: "+62 628-1234-56789" — "62" ikut terbaca sebagai nomor pelanggan.
    expect(formatPhoneId("0628123456789")).toBe("+62 812-3456-789")
    expect(formatPhoneId("006281234567890")).toBe("+62 812-3456-7890")
    // Perilaku lama yang sudah benar tidak boleh berubah.
    expect(formatPhoneId("081234567890")).toBe("+62 812-3456-7890")
    expect(formatPhoneId("+6281234567890")).toBe("+62 812-3456-7890")
    expect(formatPhoneId("6281234567890")).toBe("+62 812-3456-7890")
    expect(formatPhoneId("08123456789012")).toBe("+62 812-3456-789012")
    expect(formatPhoneId("")).toBe("")
  })

  it("formatFileSize menaikkan tingkat satuan, bukan menumpuk 1024", () => {
    // Sebelum: "1024,0 MB" / "1024 KB" / "1048576,0 MB" / "1023.5 B".
    expect(formatFileSize(1073741824)).toBe("1,0 GB")
    expect(formatFileSize(1048575)).toBe("1,0 MB")
    expect(formatFileSize(1099511627776)).toBe("1,0 TB")
    expect(formatFileSize(1023.5)).toBe("1 KB")
    expect(formatFileSize(0)).toBe("0 B")
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(2516582)).toBe("2,4 MB")
  })

  it("tidak pernah menampilkan -0", () => {
    // Sebelum: "-0" untuk ketiganya.
    expect(formatDecimal(-0.4, 0)).toBe("0")
    expect(formatDecimal(-0.04, 1)).toBe("0")
    expect(formatNumber(-0.4)).toBe("0")
    // Tanda negatif asli tetap dipertahankan.
    expect(formatDecimal(-4.5)).toBe("-4,5")
    expect(formatNumber(-1500)).toBe("-1.500")
  })

  it('sign:"never" menyembunyikan "+", bukan "-"', () => {
    // Sebelum: "Rp50.000" — debet tidak bisa dibedakan dari kredit di chart.
    expect(formatRupiah(-50000, { sign: "never" })).toBe("-Rp50.000")
    expect(formatRupiah(50000, { sign: "never" })).toBe("Rp50.000")
    expect(formatRupiah(0, { sign: "never" })).toBe("Rp0")
    // Nol tidak bertanda meski sign:"always".
    expect(formatRupiah(0, { sign: "always" })).toBe("Rp0")
  })

  it("compact menaikkan tingkat saat pembulatan menyentuh 1000", () => {
    // Sebelum: "Rp1000,0 rb" dan "Rp1000,0 jt".
    expect(formatRupiah(999999, { compact: true })).toBe("Rp1 jt")
    expect(formatRupiah(999999999, { compact: true })).toBe("Rp1 M")
    expect(formatRupiah(999999999999, { compact: true })).toBe("Rp1 T")
    // Nilai yang sudah benar tidak berubah.
    expect(formatRupiah(1500000, { compact: true })).toBe("Rp1,5 jt")
    expect(formatRupiah(1000000, { compact: true })).toBe("Rp1 jt")
    expect(formatRupiah(50000, { compact: true })).toBe("Rp50 rb")
    expect(formatRupiah(500, { compact: true })).toBe("Rp500")
    expect(formatRupiah(-999999, { compact: true })).toBe("-Rp1 jt")
  })

  it("truncateMiddle dengan tail 0 tidak mengulang seluruh string", () => {
    // Sebelum: "abcdefgh…abcdefghij" — slice(-0) === slice(0).
    expect(truncateMiddle("abcdefghij", 8, 0)).toBe("abcdefgh…")
    expect(truncateMiddle("KHD-2026-0903-ABCDEF")).toBe("KHD-2026…CDEF")
    expect(truncateMiddle("pendek")).toBe("pendek")
    expect(truncateMiddle("", 8, 4)).toBe("")
  })
})

describe("financial formatting never fabricates valid data", () => {
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe money %s",
    (value) => expect(formatRupiah(value)).toBe("—"),
  )
  it("preserves direction and zero", () => {
    expect(formatRupiah(-50000)).toBe("-Rp50.000")
    expect(formatRupiah(0)).toBe("Rp0")
    expect(formatRupiah(50000, { sign: "always" })).toBe("+Rp50.000")
  })
  it("does not turn a negative pasted transfer into a positive one", () => {
    expect(Number.isNaN(parseRupiah("-Rp100.000"))).toBe(true)
    expect(parseRupiah("Rp100.000")).toBe(100000)
    expect(Number.isNaN(parseRupiah("999999999999999999"))).toBe(true)
  })
  it("handles invalid numeric data", () => {
    expect(formatNumber(NaN)).toBe("—")
    expect(formatDecimal(1.5, Infinity)).toBe("1,5")
    expect(formatFileSize(-10)).toBe("—")
  })
})
describe("dates and identity formatting", () => {
  it.each(["invalid", "", "2026-02-30"])("does not render invalid date %s", (value) => {
    expect(formatDate(value)).toBe("—")
    expect(formatDateTime(value)).toBe("—")
    expect(formatTime(value)).toBe("—")
  })
  it("preserves calendar-only dates without UTC conversion", () =>
    expect(formatDate("2026-09-05")).toBe("5 Sep 2026"))
  it("handles countdown boundaries", () => {
    expect(formatCountdown(NaN)).toBe("—")
    expect(formatCountdown(-3)).toBe("00:00")
    expect(formatCountdown(3661)).toBe("1:01:01")
  })
  it("never truncates trailing Indonesian phone digits", () => {
    expect(formatPhoneId("08123456789012")).toBe("+62 812-3456-789012")
    expect(formatPhoneId("+6281234567890")).toBe("+62 812-3456-7890")
  })
})

it("does not inflate pasted fractional or scientific money", () => {
  expect(parseRupiah("Rp 10.000,00")).toBe(10000)
  for (const value of ["Rp 10.000,50", "10000.50", "1e6", "+10000", "USD10000", "1..000"])
    expect(Number.isNaN(parseRupiah(value))).toBe(true)
})
