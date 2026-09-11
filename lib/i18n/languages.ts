/**
 * Kahade — definisi bahasa yang didukung app.
 *
 * Sumber kebenaran tunggal untuk `LanguageCode` (sebelumnya didefinisikan di
 * <LanguagePicker>, yang bikin layar lain mengimpor tipe dari komponen UI).
 *
 * Aturan:
 *  - "id" adalah BAHASA SUMBER. Seluruh string di kode ditulis dalam Bahasa
 *    Indonesia, dan kamus hanya menerjemahkan ke "en". Karena itu `t()` di
 *    "id" tidak melakukan apa pun (nol biaya, nol risiko).
 *  - Kode harus sama dengan enum backend `UpdateLanguageDto.language`
 *    (`"id" | "en"`) — lihat docs/api/kahade-api-mobile.json.
 *  - Nama bahasa ditulis endonim ("Bahasa Indonesia", "English") supaya user
 *    yang tidak paham bahasa aktif tetap bisa mengenali bahasanya sendiri.
 */
export type LanguageCode = "id" | "en"

/** Bahasa sumber app — semua string kode ditulis dalam bahasa ini. */
export const SOURCE_LANGUAGE: LanguageCode = "id"

export type LanguageMeta = {
  code: LanguageCode
  /** Nama dalam bahasa itu sendiri */
  nativeName: string
  /** Nama dalam bahasa sumber app (Indonesia) */
  localizedName: string
  /** true bila antarmuka sudah punya kamus terjemahan */
  translated: boolean
}

export const LANGUAGES: readonly LanguageMeta[] = [
  { code: "id", nativeName: "Bahasa Indonesia", localizedName: "Indonesia", translated: true },
  { code: "en", nativeName: "English", localizedName: "Inggris", translated: true },
] as const

export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((l) => l.code)

export function isLanguageCode(value: unknown): value is LanguageCode {
  return value === "id" || value === "en"
}

/** Normalisasi nilai apa pun (API, storage, OS) ke kode yang didukung. */
export function toLanguageCode(value: unknown): LanguageCode | null {
  if (typeof value !== "string") return null
  const low = value.trim().toLowerCase()
  if (low === "id" || low.startsWith("id-")) return "id"
  if (low === "en" || low.startsWith("en-")) return "en"
  return null
}

/** Endonim untuk label UI (dipakai baris "Bahasa" di Pengaturan). */
export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.nativeName ?? code
}
