/**
 * Kahade — penyimpanan rahasia (§14 Keamanan & Sesi).
 *
 * SATU-SATUNYA tempat yang menyentuh expo-secure-store. Access token, refresh
 * token, hash PIN, dan flag "biometrik aktif" WAJIB lewat sini — TIDAK lewat
 * AsyncStorage (plaintext di sandbox app; terbaca oleh backup/root).
 *
 * Kenapa expo-secure-store, bukan AsyncStorage (non-obvious):
 *   - iOS: Keychain (dienkripsi Secure Enclave). Android: EncryptedSharedPreferences
 *     berbasis Keystore. Kedua-duanya TIDAK ikut cloud backup untuk key yang
 *     memakai `*_THIS_DEVICE_ONLY` — sesi tidak "berpindah" ke ponsel baru
 *     saat restore iCloud, yang memang perilaku yang kita inginkan (§14:
 *     perangkat baru = login ulang + 2FA).
 *   - Batas nilai 2048 byte/entri: cukup untuk JWT biasa, TIDAK untuk payload
 *     besar. Jangan simpan objek user/profil di sini — hanya rahasia.
 *
 * Keputusan non-obvious:
 *   - Key dipusatkan di `SecureKeys` (bukan string bebas) supaya logout bisa
 *     menghapus SEMUA rahasia lewat `clearSession()` tanpa ada yang terlewat.
 *   - `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` untuk token: token
 *     tidak perlu dibaca saat layar terkunci (kita tidak punya background
 *     sync yang butuh auth), dan tidak ikut backup.
 *   - Hash PIN memakai `requireAuthentication`? TIDAK. Kalau di-set, membaca
 *     hash PIN akan memicu prompt biometrik OS — padahal PIN justru fallback
 *     saat biometrik gagal. Lihat <BiometricPromptTrigger>.
 *   - Web: expo-secure-store tidak tersedia. Fallback ke memori proses
 *     (hilang saat reload) — sengaja BUKAN localStorage, supaya token tidak
 *     pernah tersimpan plaintext di browser. Sesi web bertumpu pada cookie
 *     HttpOnly dari backend; di web modul ini efektif hanya cache.
 */
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

export const SecureKeys = {
  themePreference: "kahade.theme.preference",
  sessionSignedOut: "kahade.session.signedOut",
  accessToken: "kahade.auth.accessToken",
  refreshToken: "kahade.auth.refreshToken",
  /** Hash PIN (argon2/bcrypt dari backend, atau salted SHA lokal) — BUKAN PIN mentah */
  pinHash: "kahade.security.pinHash",
  /** "1" bila pengguna mengizinkan biometrik menggantikan PIN */
  biometricEnabled: "kahade.security.biometricEnabled",
  /** Fingerprint per-install untuk RegisterDeviceDto.deviceId */
  deviceId: "kahade.device.id",
  /** Push token terakhir yang berhasil didaftarkan ke backend */
  pushToken: "kahade.push.token",
  /**
   * "1" bila user sudah melewati onboarding (slide intro). BUKAN rahasia —
   * pengecualian yang disengaja, sama seperti `deviceId`: repo ini tidak
   * memasang AsyncStorage dan SecureStore adalah satu-satunya storage
   * persisten yang tersedia (lihat package.json). Nilai 1 byte, tidak ikut
   * backup, dan TIDAK dihapus `clearSession()` — logout bukan alasan untuk
   * menampilkan intro lagi.
   */
  onboardingSeen: "kahade.onboarding.seen",
} as const

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys]

const isWeb = Platform.OS === "web"
const memory = new Map<string, string>()
// Only non-secret preferences may persist in browser storage. Never JWT/PIN/push tokens.
const WEB_PERSISTENT_KEYS = new Set<SecureKey>([
  SecureKeys.deviceId,
  SecureKeys.onboardingSeen,
  SecureKeys.themePreference,
  SecureKeys.sessionSignedOut,
])
function webStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null
  }
}

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function getSecureItem(key: SecureKey): Promise<string | null> {
  if (isWeb) {
    if (WEB_PERSISTENT_KEYS.has(key)) {
      try {
        return webStorage()?.getItem(key) ?? memory.get(key) ?? null
      } catch {
        /* private browsing */
      }
    }
    return memory.get(key) ?? null
  }
  return SecureStore.getItemAsync(key, OPTIONS)
}

export async function setSecureItem(key: SecureKey, value: string): Promise<void> {
  if (isWeb) {
    memory.set(key, value)
    if (WEB_PERSISTENT_KEYS.has(key)) {
      try {
        webStorage()?.setItem(key, value)
      } catch {
        /* memory fallback */
      }
    }
    return
  }
  await SecureStore.setItemAsync(key, value, OPTIONS)
}

export async function deleteSecureItem(key: SecureKey): Promise<void> {
  if (isWeb) {
    memory.delete(key)
    if (WEB_PERSISTENT_KEYS.has(key)) {
      try {
        webStorage()?.removeItem(key)
      } catch {
        /* storage disabled */
      }
    }
    return
  }
  await SecureStore.deleteItemAsync(key, OPTIONS)
}

/**
 * Hapus SEMUA rahasia sesi saat logout / "keluar dari semua perangkat".
 * `deviceId` sengaja dipertahankan: backend memakainya untuk mengenali
 * perangkat yang sama saat login berikutnya (daftar perangkat §9, trust).
 */
export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteSecureItem(SecureKeys.accessToken),
    deleteSecureItem(SecureKeys.refreshToken),
    deleteSecureItem(SecureKeys.pinHash),
    deleteSecureItem(SecureKeys.biometricEnabled),
    deleteSecureItem(SecureKeys.pushToken),
  ])
}

/**
 * Apakah perangkat bisa memakai biometrik untuk MELINDUNGI entri SecureStore
 * (bukan sekadar punya sensor). Dipakai untuk memutuskan apakah opsi
 * "Buka dengan biometrik" layak ditawarkan di pengaturan.
 */
export function canUseBiometricStorage(): boolean {
  if (isWeb) return false
  return SecureStore.canUseBiometricAuthentication()
}

/**
 * ID perangkat stabil per-install (RegisterDeviceDto.deviceId, maks 128).
 * Dibuat sekali lalu disimpan; hilang hanya saat uninstall — sesuai definisi
 * "stable per-install device fingerprint" di API.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getSecureItem(SecureKeys.deviceId)
  if (existing) return existing
  const id = generateId()
  await setSecureItem(SecureKeys.deviceId, id)
  return id
}

function generateId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  // Fallback RN lama tanpa crypto.randomUUID — cukup unik untuk fingerprint
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}
