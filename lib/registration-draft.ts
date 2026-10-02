/**
 * Kahade — draft registrasi non-rahasia (Batch 139, A05).
 *
 * Registrasi multi-langkah: nama lengkap, username, dan tipe akun dipulihkan
 * bila app tertutup di tengah jalan.
 *
 * ATURAN KEAMANAN KERAS: tipe `RegistrationDraft` HANYA berisi field
 * non-rahasia. Kata sandi dan OTP TIDAK PERNAH disimpan di sini — tidak ada
 * field untuk itu, dan fungsi save menolak diam-diam bila dipanggil dengan
 * objek yang mengandung kunci terlarang (defense in depth bila pemanggil
 * salah mengisi).
 */

import {
  deleteSecureItem,
  getSecureItem,
  SecureKeys,
  setSecureItem,
} from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

export type RegistrationDraft = {
  fullName?: string
  username?: string
  accountType?: string
}

/** Kunci yang DILARANG masuk draft — kata sandi & OTP tidak boleh persist. */
const FORBIDDEN_KEYS = new Set(["password", "confirmPassword", "otp", "code", "pin"])

function sanitize(draft: RegistrationDraft): RegistrationDraft {
  const clean: RegistrationDraft = {}
  if (typeof draft.fullName === "string" && draft.fullName.length > 0) {
    clean.fullName = draft.fullName.slice(0, 100)
  }
  if (typeof draft.username === "string" && draft.username.length > 0) {
    // SYS-C-201: batas username 3–30 (DBL-006 backend) — dulu slice 20.
    clean.username = draft.username.slice(0, 30)
  }
  if (typeof draft.accountType === "string" && draft.accountType.length > 0) {
    clean.accountType = draft.accountType.slice(0, 32)
  }
  return clean
}

export async function getRegistrationDraft(): Promise<RegistrationDraft> {
  try {
    const raw = await getSecureItem(SecureKeys.registrationDraft)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as RegistrationDraft
    if (typeof parsed !== "object" || parsed === null) return {}
    return sanitize(parsed)
  } catch (error) {
    logWarn("registration-draft:read", error)
    return {}
  }
}

/**
 * Simpan draft non-rahasia. Melempar TIDAK PERNAH untuk data rahasia:
 * bila objek mengandung kunci terlarang, penyimpanan DIBATALKAN total
 * (fail-closed) dan false dikembalikan.
 */
export async function saveRegistrationDraft(draft: RegistrationDraft): Promise<boolean> {
  for (const key of Object.keys(draft)) {
    if (FORBIDDEN_KEYS.has(key)) {
      logWarn("registration-draft:refused-secret", new Error(`kunci terlarang: ${key}`))
      return false
    }
  }
  const clean = sanitize(draft)
  try {
    if (Object.keys(clean).length === 0) {
      await deleteSecureItem(SecureKeys.registrationDraft)
    } else {
      await setSecureItem(SecureKeys.registrationDraft, JSON.stringify(clean))
    }
    return true
  } catch (error) {
    logWarn("registration-draft:write", error)
    return false
  }
}

/** Hapus draft — dipanggil saat registrasi BERHASIL (bukan saat logout). */
export async function clearRegistrationDraft(): Promise<void> {
  try {
    await deleteSecureItem(SecureKeys.registrationDraft)
  } catch (error) {
    logWarn("registration-draft:clear", error)
  }
}
