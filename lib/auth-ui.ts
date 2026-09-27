/**
 * Helper UI khusus area auth (audit UI/UX 2026-09-27, TIM AUTH).
 *
 * Pure function — bisa di-unit-test tanpa RN.
 */

/**
 * Panjang maksimum kode MFA yang diterima backend untuk re-auth
 * (TOTP 6 digit ATAU kode cadangan 10–16 karakter, alfanumerik).
 */
export const MFA_CODE_MAX_LENGTH = 16

/**
 * Normalisasi kode MFA (TOTP / kode cadangan) dari input pengguna.
 *
 * Hanya membuang whitespace dan memotong ke batas maksimum — TIDAK membuang
 * non-digit. Kode cadangan bersifat alfanumerik; sanitizer lama
 * (`replace(/\D/g, "")`) menghancurkannya sehingga pengguna 2FA yang memakai
 * kode cadangan tidak pernah bisa lolos re-auth (UI-A001).
 */
export function normalizeMfaCode(raw: string): string {
  return raw.replace(/\s+/g, "").slice(0, MFA_CODE_MAX_LENGTH)
}

/**
 * Apakah ada perubahan profil yang bermakna untuk disimpan di layar
 * setup-profile (UI-A003).
 *
 * Upload avatar bersifat non-blocking dan langsung tersimpan di server,
 * jadi foto yang terunggah dihitung sebagai perubahan — pengguna yang hanya
 * menambah foto tetap bisa memakai CTA utama "Simpan".
 */
export function hasProfileChanges(bio: string, avatarUrl: string | null): boolean {
  return bio.trim().length > 0 || avatarUrl !== null
}
