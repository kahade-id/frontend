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
 * DBL-015 (audit integrasi 2026-10-01): BLOCKLIST PASSWORD UMUM — mirror
 * backend `src/modules/auth/password-policy.ts` (`COMMON_PASSWORDS`,
 * perbandingan case-insensitive). Disalin verbatim agar klien menolak
 * password yang PASTI ditolak server — dulu `isPasswordValid("kahade123")`
 * = true (checklist "Minimal 8 karakter" hijau) padahal backend menolak
 * dengan "Password terlalu umum. Gunakan kombinasi yang lebih unik."
 *
 * Bila backend menambah entri, daftar ini WAJIB disinkronkan manual
 * (tidak ada endpoint kontrak untuk blocklist).
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
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

/** Pesan error — SAMA PERSIS dengan backend `validatePasswordPolicy`. */
export const PASSWORD_TOO_COMMON_MESSAGE =
  "Password terlalu umum. Gunakan kombinasi yang lebih unik."

/** true bila password masuk blocklist (case-insensitive, mirror backend `isCommonPassword`). */
export function isCommonPassword(pw: string): boolean {
  return COMMON_PASSWORDS.has(pw.toLowerCase().trim())
}

/**
 * Satu-satunya kriteria: panjang minimum. Sengaja tanpa syarat huruf
 * besar/kecil/angka/simbol (keputusan produk — lihat docblock di atas).
 *
 * DBL-015: password yang masuk blocklist umum DITOLAK walau panjangnya cukup
 * (mirror backend) — supaya checklist klien tidak hijau untuk password yang
 * pasti ditolak server.
 */
export const SECURITY_CRITERIA: readonly PasswordCriterion[] = [
  {
    key: "length",
    label: `Minimal ${PASSWORD_MIN} karakter`,
    test: (p) => p.length >= PASSWORD_MIN,
  },
  {
    key: "not-common",
    label: "Bukan kata sandi yang umum dipakai",
    test: (p) => !isCommonPassword(p),
  },
]

/** Validasi kata sandi sesuai kontrak: 8–72 karakter + bukan password umum (mirror backend). */
export function isPasswordValid(pw: string): boolean {
  return pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX && !isCommonPassword(pw)
}

/**
 * Pesan error validasi untuk field kata sandi — null bila valid.
 * DBL-015: untuk password umum memakai pesan yang SAMA PERSIS dengan backend
 * ("Password terlalu umum. Gunakan kombinasi yang lebih unik."), supaya user
 * tahu persis alasan penolakan sebelum submit.
 */
export function passwordValidationMessage(pw: string): string | null {
  if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX)
    return `Kata sandi minimal ${PASSWORD_MIN} karakter.`
  if (isCommonPassword(pw)) return PASSWORD_TOO_COMMON_MESSAGE
  return null
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
