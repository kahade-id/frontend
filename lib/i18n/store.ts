/**
 * Kahade — store bahasa aktif.
 *
 * Kenapa modul, bukan React context:
 *   Teks di app ini mengalir lewat SATU komponen (<Text> di components/ui) dan
 *   puluhan prop teks di primitif UI. Menaruh bahasa di context berarti SETIAP
 *   pemakai harus memanggil hook-nya agar ikut ter-render ulang; satu yang
 *   lupa = teksnya tetap Bahasa Indonesia setelah user memilih English (cacat
 *   khas i18n yang baru kelihatan di layar kecil). Dengan store +
 *   `useSyncExternalStore` di titik render, semua teks re-render serentak tanpa
 *   mengubah tree navigasi (tidak ada remount Stack → posisi user aman).
 *
 * Sumber nilai, berurutan:
 *   1. Preferensi akun dari backend (GET /v1/settings/language) — menang saat
 *      terbaca, karena preferensi ini milik akun, bukan perangkat.
 *   2. Cache lokal (SecureStore) — dipakai sebelum/offline saat (1) gagal.
 *   3. Bahasa sistem (expo-localization) — "id" hanya bila OS benar-benar
 *      Indonesia; selain itu English, karena English adalah satu-satunya
 *      kamus terjemahan yang ada.
 *
 * Nilai "id" TIDAK pernah ditulis sebagai preferensi eksplisit saat boot
 * (fallback saja), supaya perangkat baru tetap mau mengikuti akun.
 */
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"

import { isLanguageCode, SOURCE_LANGUAGE, type LanguageCode } from "./languages"

let current: LanguageCode = SOURCE_LANGUAGE
let revision = 0
const listeners = new Set<() => void>()

export function getLanguage(): LanguageCode {
  return current
}

/** Bertambah setiap kali bahasa aktif berubah — dipakai useSyncExternalStore. */
export function getLanguageRevision(): number {
  return revision
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function publish(next: LanguageCode): boolean {
  if (current === next) return false
  current = next
  revision += 1
  for (const listener of [...listeners]) listener()
  return true
}

/**
 * Terapkan nilai. `persist: true` menulis cache lokal (juga dipakai untuk
 * menyimpan nilai yang baru saja dikonfirmasi backend).
 */
export function applyLanguage(next: LanguageCode, options: { persist?: boolean } = {}): boolean {
  if (!isLanguageCode(next)) return false
  const changed = publish(next)
  if (options.persist) void writeCache(next)
  return changed
}

/**
 * Antrean tulis tunggal (pola yang sama dengan `lib/api/session.ts`): dua
 * `setLanguage` berurutan harus mendarat dalam urutan yang sama, kalau tidak
 * nilai lama bisa menimpa yang baru.
 */
let writeQueue: Promise<unknown> = Promise.resolve()

function writeCache(next: LanguageCode): Promise<void> {
  const task = () => setSecureItem(SecureKeys.languagePreference, next)
  const run = writeQueue.then(task, task)
  writeQueue = run.catch(() => undefined)
  return run.catch(() => undefined)
}


/** Preferensi tersimpan di perangkat (null = belum pernah dipilih di sini). */
export async function readCachedLanguage(): Promise<LanguageCode | null> {
  try {
    const stored = await getSecureItem(SecureKeys.languagePreference)
    return stored && isLanguageCode(stored) ? stored : null
  } catch {
    return null
  }
}

export async function persistLanguage(next: LanguageCode): Promise<void> {
  await writeCache(next)
}

/**
 * Terapkan + simpan sebagai preferensi eksplisit user (dipanggil dari layar
 * Bahasa setelah backend mengonfirmasi).
 */
export function setLanguage(next: LanguageCode): boolean {
  return applyLanguage(next, { persist: true })
}

/**
 * Boot: pakai cache lokal bila ada; kalau tidak, `fallback` dari pemanggil
 * (bahasa sistem). Sengaja TIDAK mengimpor expo-localization di sini supaya
 * store bisa diuji di Node tanpa stub native.
 */
export async function initLanguage(fallback: LanguageCode): Promise<LanguageCode> {
  const cached = await readCachedLanguage()
  const resolved = cached ?? fallback
  publish(resolved)
  return resolved
}

/**
 * Sinkron dari akun: nilai backend selalu menang bila terbaca, lalu di-cache.
 * Kegagalan (offline / belum login / endpoint error) TIDAK mengubah apa pun.
 */
export async function adoptAccountLanguage(value: unknown): Promise<boolean> {
  if (!isLanguageCode(value)) return false
  const changed = publish(value)
  if (value !== (await readCachedLanguage())) await writeCache(value)
  return changed
}
