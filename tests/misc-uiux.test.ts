/**
 * Regresi audit UI/UX TIM LAINNYA 2026-09-27.
 *
 * 1. Kontrak password (UI-M002): layar Ubah Password dulu memakai
 *    `next.length < 12` padahal keputusan produk menetapkan minimum 8
 *    (disimpan di `lib/auth-constants.ts`). Tes ini mengunci kontrak bersama
 *    yang kini dipakai layar — bila minimum berubah, layar ikut berubah
 *    tanpa perlu mengedit ulang setiap pemakaian.
 *
 * 2. `buildResultMessage` (UI-M005): pesan pengumuman <LiveRegion> pencarian
 *    dulu hardcoded Indonesia dan logikanya inline di komponen. Helper yang
 *    diekstrak ke `lib/search-ui.ts` kini melewati `translate()` sehingga
 *    ikut bahasa aktif, dan cabangnya teruji di sini.
 */
import { describe, expect, it } from "vitest"

import { PASSWORD_MAX, PASSWORD_MIN, PASSWORD_TOO_COMMON_MESSAGE, isCommonPassword, isPasswordValid, passwordValidationMessage } from "../lib/auth-constants"
import { buildResultMessage } from "../lib/search-ui"

describe("kontrak password (UI-M002)", () => {
  it("minimum 8 karakter sesuai keputusan produk", () => {
    expect(PASSWORD_MIN).toBe(8)
  })

  it("menolak password di bawah minimum", () => {
    expect(isPasswordValid("a".repeat(7))).toBe(false)
    expect(isPasswordValid("")).toBe(false)
  })

  it("menerima 8–11 karakter yang dulu diblokir layar", () => {
    // Sanitizer lama: `next.length < 12` → password valid ini tidak bisa disimpan.
    expect(isPasswordValid("a".repeat(8))).toBe(true)
    expect(isPasswordValid("a".repeat(11))).toBe(true)
  })

  it("menerima tepat batas atas dan menolak di atasnya", () => {
    expect(isPasswordValid("a".repeat(PASSWORD_MAX))).toBe(true)
    expect(isPasswordValid("a".repeat(PASSWORD_MAX + 1))).toBe(false)
  })

  // DBL-015 (audit integrasi 2026-10-01): blocklist password umum — mirror
  // backend `password-policy.ts`. Klien menolak apa yang pasti ditolak server.
  it("menolak password umum walau panjangnya cukup (mirror backend)", () => {
    expect(isPasswordValid("kahade123")).toBe(false)
    expect(isPasswordValid("password123")).toBe(false)
    expect(isPasswordValid("bismillah")).toBe(false)
    expect(isPasswordValid("12345678")).toBe(false)
    expect(isCommonPassword("Kahade123")).toBe(true) // case-insensitive
    expect(isCommonPassword("katasandi unik 42!")).toBe(false)
  })

  it("pesan untuk password umum SAMA PERSIS dengan backend", () => {
    expect(passwordValidationMessage("kahade123")).toBe(PASSWORD_TOO_COMMON_MESSAGE)
    expect(PASSWORD_TOO_COMMON_MESSAGE).toBe("Password terlalu umum. Gunakan kombinasi yang lebih unik.")
    expect(passwordValidationMessage("katasandi unik 42!")).toBe(null)
    expect(passwordValidationMessage("pendek")).toBe("Kata sandi minimal 8 karakter.")
  })
})

describe("buildResultMessage (UI-M005)", () => {
  it("kosong saat pencarian tidak aktif", () => {
    expect(buildResultMessage({ enabled: false, error: null, loading: false, count: 5 })).toBe("")
  })

  it("kosong saat masih memuat", () => {
    expect(buildResultMessage({ enabled: true, error: null, loading: true, count: 5 })).toBe("")
  })

  it("error diprioritaskan dan diteruskan apa adanya", () => {
    expect(
      buildResultMessage({ enabled: true, error: "Jaringan bermasalah", loading: false, count: 5 }),
    ).toBe("Jaringan bermasalah")
  })

  it('"Tidak ada hasil" saat daftar kosong', () => {
    expect(buildResultMessage({ enabled: true, error: null, loading: false, count: 0 })).toBe(
      "Tidak ada hasil",
    )
  })

  it("jumlah hasil diformat dan diterjemahkan", () => {
    expect(buildResultMessage({ enabled: true, error: null, loading: false, count: 5 })).toBe(
      "5 hasil ditemukan",
    )
  })
})
