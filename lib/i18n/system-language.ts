/**
 * Kahade — bahasa awal dari OS (expo-localization).
 *
 * Aturan yang dipilih produk (2026-09-11): pengguna dengan OS non-Indonesia
 * mendapat English, pengguna Indonesia mendapat Bahasa Indonesia. Kenapa
 * English sebagai default global dan bukan Indonesia:
 *   - order link, invoice, dan bukti transfer dibagikan ke lawan transaksi
 *     yang belum tentu berbahasa Indonesia;
 *   - English adalah satu-satunya kamus terjemahan yang ada, jadi memilih
 *     "bahasa lain" (Jawa, Sunda, Arab) tetap jatuh ke Indonesia — menampilkan
 *     bahasa sumber, bukan bahasa asing acak.
 *
 * `resolveSystemLanguage` dipisah murni (tanpa Expo runtime) supaya bisa
 * diuji di Node; hanya `systemLanguage()` yang menyentuh modul native.
 */
import { getLocales } from "expo-localization"

import { SOURCE_LANGUAGE, toLanguageCode, type LanguageCode } from "./languages"

/** Bentuk longgar: `Locale` dari expo-localization memakai `string | null`. */
export type SystemLocale = { languageCode?: string | null; regionCode?: string | null }

/**
 * Resolusi murni: daftar locale OS (prioritas pertama menang) → kode bahasa.
 *
 * Non-obvious: `regionCode === "ID"` diuji TERAKHIR sebagai jangkar, bukan
 * pertama. OS yang melaporkan `jv-ID`/`su-ID` memang perangkat Indonesia, tapi
 * kalau bahasa utamanya `en-US` (mis. periset/ekspat) pilihan user yang harus
 * menang. Jadi: bahasa yang kita dukung dulu, baru wilayah.
 */
export function resolveSystemLanguage(locales: readonly SystemLocale[]): LanguageCode {
  for (const locale of locales) {
    const code = toLanguageCode(locale.languageCode ?? locale.regionCode ?? undefined)
    if (code) return code
  }
  if (locales.some((l) => (l.regionCode ?? "").toUpperCase() === "ID")) return SOURCE_LANGUAGE
  return "en"
}

/** Baca locale perangkat; dipakai sekali saat boot oleh <I18nProvider>. */
export function systemLanguage(): LanguageCode {
  try {
    const locales = getLocales()
    return resolveSystemLanguage(Array.isArray(locales) ? locales : [])
  } catch {
    // Web lama / lingkungan tanpa native module: jangan pernah mengubah bahasa
    // karena kegagalan baca locale.
    return SOURCE_LANGUAGE
  }
}
