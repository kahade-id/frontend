/**
 * Kahade — Shared authentication constants.
 *
 * Shared between create-security.tsx and reset-password.tsx to avoid duplication.
 */
import type { PasswordCriterion } from "@/components/ui/password-strength"

/** Panjang minimum password sesuai PhoneRegisterDto (12 char, bukan 8 default) */
export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 72

/**
 * Criteria password disesuaikan dengan validasi backend PhoneRegisterDto:
 * min 12 char, uppercase, lowercase, digit, special character.
 * Override dari DEFAULT_PASSWORD_CRITERIA (yang memakai min 8).
 */
export const SECURITY_CRITERIA: readonly PasswordCriterion[] = [
  {
    key: "length",
    label: `Minimal ${PASSWORD_MIN} karakter`,
    test: (p) => p.length >= PASSWORD_MIN,
  },
  {
    key: "case",
    label: "Huruf besar dan kecil",
    test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  },
  {
    key: "digit",
    label: "Mengandung angka",
    test: (p) => /\d/.test(p),
  },
  {
    key: "symbol",
    label: "Mengandung simbol",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
]

/** Validasi password sesuai kontrak PhoneRegisterDto */
export function isPasswordValid(pw: string): boolean {
  return SECURITY_CRITERIA.every((c) => c.test(pw)) && pw.length <= PASSWORD_MAX
}
