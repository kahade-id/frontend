/**
 * Kahade — metadata aplikasi (leaf module).
 *
 * PERF-FIX (bundle): file ini SENGAJA tanpa import apa pun. `APP_TITLE`
 * sebelumnya diekspor dari `@/components/ui/header` (308 baris) yang ikut
 * menarik rantai UI (safe-area-context, phosphor, expo-router hooks,
 * stepper, screen, theme-provider, notification-routing, i18n) ke evaluasi
 * boot hanya demi satu konstanta — dipakai `app/_layout.tsx` untuk
 * `document.title`. Jangan menambahkan import ke file ini.
 */

/** Nama aplikasi untuk judul dokumen web — satu sumber dengan app.json (`expo.name`). */
export const APP_TITLE = "Kahade"
