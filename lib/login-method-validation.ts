/** Validation kept deliberately method-specific: login never accepts the old
 * generic "username / email / phone" identifier field. */
export type PasswordLoginMethod = "email" | "username"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALIDATION_MESSAGES = {
  emailRequired: "Masukkan alamat email.",
  usernameRequired: "Masukkan username.",
  emailInvalid: "Format email tidak valid. Contoh: nama@email.com.",
  usernameInvalid: "Username tidak boleh mengandung spasi atau karakter @.",
} as const

export function validateLoginIdentifier(
  method: PasswordLoginMethod,
  value: string,
): string | null {
  if (!value.trim()) {
    return method === "email" ? VALIDATION_MESSAGES.emailRequired : VALIDATION_MESSAGES.usernameRequired
  }

  if (method === "email") {
    return EMAIL_PATTERN.test(value.trim()) ? null : VALIDATION_MESSAGES.emailInvalid
  }

  return /[\s@]/u.test(value) ? VALIDATION_MESSAGES.usernameInvalid : null
}
