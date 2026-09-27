/**
 * Regresi audit UI/UX auth 2026-09-27 (TIM AUTH).
 *
 * Mengunci dua normalizer/at-uran logika yang diperbaiki:
 *
 *  1. `normalizeMfaCode` (UI-A001): kolom MFA di layar konfirmasi tautan
 *     sosial dulu memakai `t.replace(/\D/g, "").slice(0, 8)` — kode cadangan
 *     alfanumerik (10–16 karakter, diterima backend sebagai `mfaCode`
 *     "Kode TOTP/backup") dihancurkan sehingga pengguna 2FA yang memakai
 *     kode cadangan TIDAK PERNAH bisa menautkan akun sosial. Normalizer baru
 *     hanya membuang whitespace dan memotong ke 16.
 *
 *  2. `hasProfileChanges` (UI-A003): tombol "Simpan" di setup-profile dulu
 *     hanya aktif bila bio terisi — padahal upload avatar non-blocking dan
 *     langsung tersimpan di server. Pengguna yang hanya menambah foto tidak
 *     bisa memakai CTA utama.
 */
import { describe, expect, it } from "vitest"

import {
  MFA_CODE_MAX_LENGTH,
  hasProfileChanges,
  normalizeMfaCode,
} from "../lib/auth-ui"

describe("normalizeMfaCode (UI-A001)", () => {
  it("membiarkan TOTP 6 digit apa adanya", () => {
    expect(normalizeMfaCode("123456")).toBe("123456")
  })

  it("MELESTARIKAN kode cadangan alfanumerik (regresi utama)", () => {
    // Sanitizer lama mengubah ini menjadi "" — pengguna terkunci dari re-auth.
    expect(normalizeMfaCode("AB12-CD34-EF56")).toBe("AB12-CD34-EF56")
    expect(normalizeMfaCode("abcd1234ef")).toBe("abcd1234ef")
  })

  it("membuang semua whitespace (spasi, tab, newline)", () => {
    expect(normalizeMfaCode("123 456")).toBe("123456")
    expect(normalizeMfaCode("  AB CD\t12\n34  ")).toBe("ABCD1234")
  })

  it("memotong ke batas maksimum backend (16)", () => {
    expect(MFA_CODE_MAX_LENGTH).toBe(16)
    expect(normalizeMfaCode("12345678901234567890")).toBe("1234567890123456")
    expect(normalizeMfaCode("12345678901234567890")).toHaveLength(16)
  })

  it("menangani input kosong", () => {
    expect(normalizeMfaCode("")).toBe("")
    expect(normalizeMfaCode("   ")).toBe("")
  })

  it("tidak mengubah huruf kecil menjadi besar (backend case-insensitive sendiri)", () => {
    expect(normalizeMfaCode("ab12cd")).toBe("ab12cd")
  })
})

describe("hasProfileChanges (UI-A003)", () => {
  it("bio terisi → ada perubahan", () => {
    expect(hasProfileChanges("Halo, saya penjual.", null)).toBe(true)
  })

  it("hanya avatar terunggah (tanpa bio) → ada perubahan (regresi utama)", () => {
    expect(hasProfileChanges("", "https://cdn/avatar.jpg")).toBe(true)
    expect(hasProfileChanges("   ", "https://cdn/avatar.jpg")).toBe(true)
  })

  it("bio kosong dan tanpa avatar → tidak ada perubahan", () => {
    expect(hasProfileChanges("", null)).toBe(false)
    expect(hasProfileChanges("   \n  ", null)).toBe(false)
  })

  it("bio + avatar → ada perubahan", () => {
    expect(hasProfileChanges("Bio", "https://cdn/avatar.jpg")).toBe(true)
  })
})
