/**
 * Test Batch 139 A05 — draft registrasi non-rahasia.
 *
 * - Field non-rahasia (nama, username, tipe akun) disimpan & dipulihkan.
 * - Upaya menyimpan kata sandi/OTP DITOLAK (fail-closed).
 * - Draft dibersihkan setelah registrasi berhasil.
 */
import { describe, expect, it } from "vitest"

import {
  clearRegistrationDraft,
  getRegistrationDraft,
  saveRegistrationDraft,
} from "@/lib/registration-draft"

describe("registration-draft (A05)", () => {
  it("menyimpan & memulihkan field non-rahasia", async () => {
    await clearRegistrationDraft()
    expect(await saveRegistrationDraft({ fullName: "Budi Santoso", username: "budi" })).toBe(true)
    expect(await getRegistrationDraft()).toEqual({ fullName: "Budi Santoso", username: "budi" })
  })

  it("MENOLAK menyimpan bila ada kunci rahasia (password/otp)", async () => {
    await clearRegistrationDraft()
    const ok = await saveRegistrationDraft({
      fullName: "Budi",
      password: "Rahasia123",
    } as never)
    expect(ok).toBe(false)
    // Tidak ada yang tersimpan — termasuk field non-rahasianya.
    expect(await getRegistrationDraft()).toEqual({})
  })

  it("dibersihkan setelah registrasi berhasil", async () => {
    await saveRegistrationDraft({ fullName: "Budi" })
    await clearRegistrationDraft()
    expect(await getRegistrationDraft()).toEqual({})
  })

  it("tahan terhadap JSON rusak", async () => {
    await clearRegistrationDraft()
    // Simulasi data korup: tulis mentah via modul (bypass sanitize)
    const { setSecureItem, SecureKeys } = await import("@/lib/secure-storage")
    await setSecureItem(SecureKeys.registrationDraft, "{bukan json")
    expect(await getRegistrationDraft()).toEqual({})
    await clearRegistrationDraft()
  })
})
