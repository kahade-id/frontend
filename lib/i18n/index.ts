/**
 * Kahade — i18n (lapisan terjemahan).
 *
 * Ringkas:
 *   - Bahasa sumber app = Indonesia; string di kode ADALAH kuncinya.
 *   - `t(str)` dipakai di titik render (dan otomatis di <Text>), `useI18n()`
 *     untuk komponen yang butuh tahu bahasa aktif.
 *   - Bahasa aktif dipilih dari: preferensi akun → cache perangkat → locale OS.
 *
 * File ini sengaja satu-satunya yang diimport layar: implementasinya tersebar
 * di translate.ts / store.ts / en/ dan boleh dipecah tanpa menyentuh pemakaian.
 */
export {
  LANGUAGES,
  LANGUAGE_CODES,
  SOURCE_LANGUAGE,
  isLanguageCode,
  languageLabel,
  toLanguageCode,
  type LanguageCode,
  type LanguageMeta,
} from "./languages"
export {
  adoptAccountLanguage,
  applyLanguage,
  getLanguage,
  getLanguageRevision,
  initLanguage,
  persistLanguage,
  readCachedLanguage,
  setLanguage,
  subscribeLanguage,
} from "./store"
export {
  clearTranslationCache,
  hasTranslation,
  localizeChildren,
  translate,
  translateProp,
  type TranslateVars,
} from "./translate"
export { resolveSystemLanguage, systemLanguage } from "./system-language"
export { useI18n, useLanguage, useSetLanguage, useT } from "./react"
export { shapeOf, maskNumbers, interpolate, SHAPE_TOKEN } from "./shape"
