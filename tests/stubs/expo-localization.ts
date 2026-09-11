/**
 * Stub `expo-localization` untuk Vitest — lihat tests/stubs/expo.ts.
 *
 * `getLocales()` sengaja mengembalikan satu locale Indonesia: test LAYER i18n
 * tidak boleh bergantung pada bahasa mesin CI. Perilaku resolusi bahasa diuji
 * lewat `resolveSystemLanguage()` yang murni (menerima daftar locale eksplisit).
 */
export function getLocales(): { languageCode: string; regionCode: string }[] {
  return [{ languageCode: "id", regionCode: "ID" }]
}

export default { getLocales }
