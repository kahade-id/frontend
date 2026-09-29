/**
 * UI-UX T1-002, FE-040: progress per purpose + per layar di OTP/trigger
 * WhatsApp bersama.
 *
 * FE-040: dua layar berurutan (trigger → OTP) tidak boleh memakai angka
 * yang sama — bar harus bergerak di tiap langkah nyata:
 *   nomor (1/4) → kirim pesan WA (2/4) → masukkan OTP (3/4) → kata sandi (4/4)
 * Layar nomor (1/4) dan kata sandi (4/4) memakai konstanta lokal di
 * layarnya masing-masing, bukan helper ini.
 */
import { describe, expect, it } from "vitest"

import { otpStepProgress } from "@/lib/auth-progress"

describe("otpStepProgress", () => {
  it("register: trigger → 2/4, otp → 3/4 (langkah berbeda, angka berbeda)", () => {
    expect(otpStepProgress("register", "trigger")).toBe(2 / 4)
    expect(otpStepProgress("register", "otp")).toBe(3 / 4)
  })

  it("forgot_password: trigger → 2/4, otp → 3/4 (skala 4 langkah, bukan 3)", () => {
    expect(otpStepProgress("forgot_password", "trigger")).toBe(2 / 4)
    expect(otpStepProgress("forgot_password", "otp")).toBe(3 / 4)
  })

  it("login → disembunyikan di kedua layar (bukan bagian wizard pendaftaran)", () => {
    expect(otpStepProgress("login", "trigger")).toBeUndefined()
    expect(otpStepProgress("login", "otp")).toBeUndefined()
  })

  it("migrate_phone → disembunyikan di kedua layar", () => {
    expect(otpStepProgress("migrate_phone", "trigger")).toBeUndefined()
    expect(otpStepProgress("migrate_phone", "otp")).toBeUndefined()
  })
})
