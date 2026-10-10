import { describe, expect, it } from "vitest"

import {
  isValidAddressPhone,
  isValidPostalCode,
  sanitizePhoneInput,
  sanitizePostalInput,
  validateAddressForm,
} from "@/lib/address-validation"

const base = {
  label: "RUMAH" as const,
  recipientName: "Budi",
  phone: "081234567890",
  addressLine: "Jl. Mawar No. 1",
  city: "Jakarta",
  postalCode: "12345",
}

describe("address-validation (audit alamat & kurir 2026-10-10)", () => {
  it("kode pos harus tepat 5 digit — selaras validator backend", () => {
    expect(isValidPostalCode("12345")).toBe(true)
    expect(isValidPostalCode("1234")).toBe(false)
    expect(isValidPostalCode("123456")).toBe(false)
    expect(isValidPostalCode("12a45")).toBe(false)
  })

  it("nomor HP: + opsional di depan, total 8–20 karakter (regex backend)", () => {
    expect(isValidAddressPhone("081234567890")).toBe(true)
    expect(isValidAddressPhone("+6281234567890")).toBe(true)
    expect(isValidAddressPhone("0812345")).toBe(false)
    expect(isValidAddressPhone("08+12345678")).toBe(false)
    // C16: 20 digit tanpa + diterima backend — klien tidak boleh lebih ketat.
    expect(isValidAddressPhone("12345678901234567890")).toBe(true)
    expect(isValidAddressPhone("123456789012345678901")).toBe(false)
    expect(isValidAddressPhone("+1234567")).toBe(true)
    expect(isValidAddressPhone("+123456")).toBe(false)
  })

  it("sanitasi input: hanya digit, + hanya di awal; kode pos dipotong 5 digit", () => {
    expect(sanitizePhoneInput("+62 812-3456+78")).toBe("+62812345678")
    expect(sanitizePostalInput("12345678")).toBe("12345")
    expect(sanitizePostalInput("1a2b3")).toBe("123")
  })

  it("LAINNYA tanpa nama label ditolak (dulu baru ketahuan 400 dari server)", () => {
    expect(validateAddressForm({ ...base, label: "LAINNYA", customLabel: " " })).toMatch(/nama label/i)
    expect(validateAddressForm({ ...base, label: "LAINNYA", customLabel: "Kos" })).toBeNull()
  })

  it("urutan pesan mengikuti posisi field; alamat lengkap → null", () => {
    expect(validateAddressForm({ ...base, recipientName: "" })).toMatch(/Nama penerima/)
    expect(validateAddressForm({ ...base, phone: "123" })).toMatch(/Nomor HP tidak valid/)
    expect(validateAddressForm({ ...base, postalCode: "1234" })).toMatch(/5 digit/)
    expect(validateAddressForm(base)).toBeNull()
  })
})
