/**
 * UI-UX T1-002: progress per purpose di layar OTP/trigger WhatsApp bersama.
 */
import { describe, expect, it } from "vitest"

import { otpStepProgress } from "@/lib/auth-progress"

describe("otpStepProgress", () => {
  it("register → 2/4 (registrasi via HP = 4 langkah)", () => {
    expect(otpStepProgress("register")).toBe(2 / 4)
  })

  it("forgot_password → 2/3 (lupa kata sandi = 3 langkah)", () => {
    expect(otpStepProgress("forgot_password")).toBe(2 / 3)
  })

  it("login → disembunyikan (bukan bagian wizard pendaftaran)", () => {
    expect(otpStepProgress("login")).toBeUndefined()
  })

  it("migrate_phone → disembunyikan", () => {
    expect(otpStepProgress("migrate_phone")).toBeUndefined()
  })
})
