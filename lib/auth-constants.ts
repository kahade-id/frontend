/**
 * Kahade — Shared authentication constants (auth-rework 2026-09-26).
 *
 * Keputusan produk: kata sandi minimal 8 karakter TANPA syarat kompleksitas
 * (huruf besar/kecil, angka, simbol dihapus). Pengguna cenderung malas dengan
 * aturan rumit; keamanan ganda didapat dari OTP WhatsApp + rate limiting +
 * lockout di backend, bukan dari kerumitan password.
 *
 * Dipakai bersama layar yang meminta kata sandi baru (register-security,
 * reset-password) agar checklist dan validasi selalu sinkron.
 */
import type { PasswordCriterion } from "@/components/ui/password-strength"

/** Panjang minimum kata sandi sesuai kontrak auth-rework (8 karakter). */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72

/**
 * Satu-satunya kriteria: panjang minimum. Sengaja tanpa syarat huruf
 * besar/kecil/angka/simbol (keputusan produk — lihat docblock di atas).
 */
export const SECURITY_CRITERIA: readonly PasswordCriterion[] = [
  {
    key: "length",
    label: `Minimal ${PASSWORD_MIN} karakter`,
    test: (p) => p.length >= PASSWORD_MIN,
  },
]

/** Validasi kata sandi sesuai kontrak: 8–72 karakter. */
export function isPasswordValid(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX
}
