/**
 * Stub paket Expo untuk Vitest.
 *
 * Rantai impor lapisan API menyentuh `expo-constants`, `expo-device`,
 * `expo-application`, dan `expo-secure-store`. Keempatnya memanggil
 * `expo-modules-core` yang butuh global native (`globalThis.expo.EventEmitter`)
 * — di Node nilainya undefined dan pengumpulan modul gagal sebelum test jalan.
 *
 * Nilai di sini adalah nilai "tidak ada perangkat": cukup untuk logika yang
 * diuji (normalizer respons, helper URL, fallback identitas), tidak dipakai
 * untuk mengambil keputusan apa pun di test.
 */
const memory = new Map<string, string>()

export const expoConfig = { extra: {} }
/** `expo-constants` dipakai sebagai default import: `Constants.expoConfig`. */
export default { expoConfig }

export const osName = null as string | null
export const osVersion = null as string | null
export const brand = null as string | null
export const modelName = null as string | null
export const nativeApplicationVersion = null as string | null
export const nativeAppVersion = null as string | null

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 1
export const KeychainAccessible = { WHEN_UNLOCKED_THIS_DEVICE_ONLY }

export async function getItemAsync(key: string): Promise<string | null> {
  return memory.get(key) ?? null
}
export async function setItemAsync(key: string, value: string): Promise<void> {
  memory.set(key, value)
}
export async function deleteItemAsync(key: string): Promise<void> {
  memory.delete(key)
}
