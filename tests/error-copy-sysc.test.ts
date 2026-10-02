/**
 * SYS-C-202 / SYS-C-204 (audit konsistensi 2026-10-03): pemetaan pesan
 * penolakan server yang spesifik ke copy Indonesia yang jelas.
 */
import { describe, expect, it } from "vitest"

import {
  ApiError,
  emailFormatMessage,
  passwordTooCommonMessage,
  userMessage,
} from "@/lib/api/errors"

function apiError(message: string, validationMessages?: string[]) {
  return new ApiError({
    code: "VALIDATION",
    status: 400,
    backendCode: "VALIDATION_ERROR",
    message,
    validationMessages,
  })
}

describe("SYS-C-202: password ditolak blocklist server", () => {
  it("pesan backend 'Password terlalu umum...' → copy Indonesia jelas", () => {
    const err = apiError("Password terlalu umum. Gunakan kombinasi yang lebih unik.")
    expect(passwordTooCommonMessage(err)).toBe(
      "Kata sandi terlalu umum. Pilih kata sandi yang lain.",
    )
    expect(userMessage(err)).toBe("Kata sandi terlalu umum. Pilih kata sandi yang lain.")
  })

  it("terdeteksi juga dari validationMessages", () => {
    const err = apiError("Bad Request", ["Password terlalu umum."])
    expect(passwordTooCommonMessage(err)).toBe(
      "Kata sandi terlalu umum. Pilih kata sandi yang lain.",
    )
  })

  it("error validasi lain tidak ikut terpetakan", () => {
    const err = apiError("Password minimal 8 karakter")
    expect(passwordTooCommonMessage(err)).toBeUndefined()
  })
})

describe("SYS-C-204: email ditolak @IsEmail() backend", () => {
  it("pesan class-validator Inggris → copy Indonesia jelas", () => {
    const err = apiError("Bad Request", ["email must be an email"])
    expect(emailFormatMessage(err)).toBe(
      "Format email tidak valid. Periksa kembali alamat email Anda.",
    )
    expect(userMessage(err)).toBe(
      "Format email tidak valid. Periksa kembali alamat email Anda.",
    )
  })

  it("pesan kustom 'Invalid contact email format' ikut terpetakan", () => {
    const err = apiError("Invalid contact email format")
    expect(emailFormatMessage(err)).toBe(
      "Format email tidak valid. Periksa kembali alamat email Anda.",
    )
  })

  it("error validasi lain tidak ikut terpetakan", () => {
    const err = apiError("Bad Request", ["username must be at least 3 characters"])
    expect(emailFormatMessage(err)).toBeUndefined()
  })
})
