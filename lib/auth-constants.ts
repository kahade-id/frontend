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

/**
 * BFI-043: daftar password umum/bocor — MIRROR dari
 * `backend/src/modules/auth/password-policy.ts` (COMMON_PASSWORDS).
 * Hanya untuk umpan balik dini di klien (UX); backend tetap sumber kebenaran
 * (validatePasswordPolicy) — JANGAN ubah validasi BE.
 * Perbandingan case-insensitive, tanpa trim di sini (konsisten dengan BE
 * yang me-lowercase + trim sebelum cek).
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  [
    "password", "password1", "password123", "passw0rd", "qwerty", "qwerty123",
    "123456", "12345678", "123456789", "1234567890", "111111", "000000",
    "123123", "abc123", "1q2w3e4r", "1qaz2wsx", "dragon", "monkey",
    "letmein", "welcome", "welcome1", "admin", "admin123", "administrator",
    "kahade", "kahade123", "kahade1", "kawalhak", "indonesia", "indonesia1",
    "jakarta", "jakarta123", "bandung", "surabaya", "rahasia", "rahasia123",
    "sandi", "sandi123", "katasandi", "bismillah", "assalamualaikum",
    "sayang", "cinta", "anjing", "bangsat", "kontol", "ngentot",
    "iloveyou", "football", "baseball", "superman", "batman",
    "trustno1", "master", "shadow", "sunshine", "princess",
    "qwertyuiop", "asdfghjkl", "zxcvbnm", "0987654321",
    "0123456789", "1234567", "123456a", "a123456", "password12",
  ].map((p) => p.toLowerCase()),
)

/** True bila password masuk daftar umum/bocor (pasti ditolak backend). */
export function isCommonPassword(pw: string): boolean {
  return COMMON_PASSWORDS.has(pw.toLowerCase().trim())
}
