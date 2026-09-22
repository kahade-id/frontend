/**
 * Tests untuk lib/nik.ts (K-08)
 * Memverifikasi validasi struktur NIK Indonesia: panjang, karakter angka, provinsi, tanggal lahir, dan nomor seri.
 */
import { describe, expect, it } from "vitest"
import { validateNikStructure, nikRejectionMessage } from "@/lib/nik"

describe("validateNikStructure", () => {
  it("menolak panjang yang bukan 16 digit (LENGTH)", () => {
    expect(validateNikStructure("123456")).toEqual({ valid: false, reason: "LENGTH" })
    expect(validateNikStructure("12345678901234567")).toEqual({ valid: false, reason: "LENGTH" })
  })

  it("menolak karakter non-angka (NOT_DIGITS)", () => {
    expect(validateNikStructure("317101010190000a")).toEqual({ valid: false, reason: "NOT_DIGITS" })
    expect(validateNikStructure("317101-101900001")).toEqual({ valid: false, reason: "NOT_DIGITS" })
  })

  it("menolak kode provinsi yang tidak valid (PROVINCE)", () => {
    // 00 bukan kode provinsi yang sah
    expect(validateNikStructure("0001010101900001")).toEqual({ valid: false, reason: "PROVINCE" })
    // 99 bukan kode provinsi yang sah
    expect(validateNikStructure("9901010101900001")).toEqual({ valid: false, reason: "PROVINCE" })
  })

  it("menolak tanggal lahir atau bulan yang tidak valid (BIRTH_DATE)", () => {
    // Bulan 13
    expect(validateNikStructure("3171010113900001")).toEqual({ valid: false, reason: "BIRTH_DATE" })
    // Bulan 00
    expect(validateNikStructure("3171010100900001")).toEqual({ valid: false, reason: "BIRTH_DATE" })
    // Tanggal 32
    expect(validateNikStructure("3171013201900001")).toEqual({ valid: false, reason: "BIRTH_DATE" })
    // Tanggal 30 Februari (bukan kabisat)
    expect(validateNikStructure("3171013002910001")).toEqual({ valid: false, reason: "BIRTH_DATE" })
  })

  it("menolak nomor seri 0000 (SERIAL)", () => {
    expect(validateNikStructure("3171010101900000")).toEqual({ valid: false, reason: "SERIAL" })
  })

  it("menerima NIK pria yang valid", () => {
    // 31 (DKI Jakarta), 71 (Jakarta Selatan), 01 (Kecamatan), 15 (Tgl 15), 08 (Agustus), 95 (1995), 0001 (Seri)
    const res = validateNikStructure("3171011508950001")
    expect(res).toEqual({ valid: true, encodedGender: "MALE" })
  })

  it("menerima NIK wanita yang valid (tanggal lahir + 40)", () => {
    // 31 (DKI), 71, 01, 55 (Tgl 15 wanita: 15+40=55), 08, 95, 0001
    const res = validateNikStructure("3171015508950001")
    expect(res).toEqual({ valid: true, encodedGender: "FEMALE" })
  })

  it("menerima tanggal 29 Februari untuk tahun kabisat", () => {
    // Tahun 96 (1996 - kabisat)
    const res = validateNikStructure("3171012902960001")
    expect(res.valid).toBe(true)
  })

  it("nikRejectionMessage mengembalikan pesan yang sesuai", () => {
    expect(nikRejectionMessage("LENGTH")).toContain("16 digit")
    expect(nikRejectionMessage("NOT_DIGITS")).toContain("angka")
    expect(nikRejectionMessage("PROVINCE")).toContain("wilayah")
    expect(nikRejectionMessage("BIRTH_DATE")).toContain("Tanggal lahir")
    expect(nikRejectionMessage("SERIAL")).toContain("Nomor urut")
  })
})
