/**
 * Kahade — hook React untuk i18n.
 *
 * Kenapa `useSyncExternalStore` dan bukan context (non-obvious):
 *   Perubahan bahasa harus mengenai SETIAP simpul teks yang sudah ter-render.
 *   Context hanya menjangkau komponen yang memanggil `useContext`; satu
 *   primitif yang lupa (mis. label di dalam <Badge>) membuat teksnya tertinggal
 *   dalam bahasa lama sampai layar itu di-mount ulang. Dengan store eksternal,
 *   setiap pemakai hook — dan <Text>, yang menjadi satu-satunya jalan render
 *   teks di app ini — ikut ter-render ulang, TANPA me-remount Stack
 *   (remount = posisi navigasi user hilang).
 *
 * `getServerSnapshot` = snapshot yang sama: export web statis merender tree di
 * Node sebelum hidrasi, dan tanpa argumen ini React melempar "Missing
 * getServerSnapshot". Bahasa aktif saat prerender = nilai bawaan modul
 * (Indonesia); hidrasi langsung menyesuaikan, sama seperti dark mode.
 */
import { useCallback, useSyncExternalStore } from "react"

import {
  applyLanguage,
  getLanguage,
  getLanguageRevision,
  setLanguage as persistLanguageChoice,
  subscribeLanguage,
} from "./store"
import { translate, type TranslateVars } from "./translate"
import type { LanguageCode } from "./languages"

/** Bahasa aktif (menandai komponen ini ikut ter-render saat bahasa berganti). */
export function useLanguage(): LanguageCode {
  useSyncExternalStore(subscribeLanguage, getLanguageRevision, getLanguageRevision)
  return getLanguage()
}

/** Ganti bahasa aktif di perangkat ini. Persistensi = pemanggil (layar Bahasa). */
export function useSetLanguage(): (code: LanguageCode) => void {
  return useCallback((code: LanguageCode) => {
    persistLanguageChoice(code)
  }, [])
}

/** Terapkan bahasa tanpa menulis cache (dipakai sinkronisasi dari backend). */
export function useApplyRemoteLanguage(): (code: LanguageCode) => void {
  return useCallback((code: LanguageCode) => {
    applyLanguage(code)
  }, [])
}

/** `t` yang terikat ke render aktif. */
export function useT(): (source: unknown, vars?: TranslateVars) => string {
  useSyncExternalStore(subscribeLanguage, getLanguageRevision, getLanguageRevision)
  return useCallback((source: unknown, vars?: TranslateVars) => translate(source, vars), [])
}

export function useI18n() {
  const language = useLanguage()
  const t = useT()
  const setLanguage = useSetLanguage()
  return { language, t, setLanguage }
}
