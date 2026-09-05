# Inventaris native module Kahade

Expo SDK **54.0.37** (`expo@~54.0.0`). Semua versi diambil dari
`node_modules/expo/bundledNativeModules.json`, yaitu peta versi resmi untuk
SDK ini — bukan `@latest`.

Tujuan: semua modul native sudah ter-link sekarang, sehingga mengaktifkan
fitur terkait nanti **tidak perlu rebuild**. Logic JS sengaja belum di-wire.

## Terpasang & ter-autolink (16/16 diminta)

Terverifikasi lewat `expo-modules-autolinking resolve` untuk **android dan
ios**: 33 modul native di Android, 34 di iOS, dan seluruh 16 modul yang
diminta ada di kedua daftar.

| # | Modul | Versi | Config plugin | Permission/fitur |
|---|---|---|---|---|
| 1 | expo-camera | 17.0.10 | ya, dgn opsi | CAMERA, RECORD_AUDIO — KTP/selfie/bukti transfer |
| 2 | expo-image-picker | 17.0.11 | ya, dgn opsi | galeri |
| 3 | expo-media-library | 18.2.1 | ya, dgn opsi | READ_MEDIA_IMAGES/VIDEO |
| 4 | expo-local-authentication | 17.0.9 | ya, dgn opsi | USE_BIOMETRIC, Face ID |
| 5 | expo-secure-store | 15.0.8 | ya | token & PIN |
| 6 | expo-file-system | 19.0.24 | ya | invoice/receipt lokal |
| 7 | expo-notifications | 0.32.17 | ya, dgn opsi | POST_NOTIFICATIONS |
| 8 | expo-updates | 29.0.20 | otomatis | OTA |
| 9 | expo-audio | 1.1.1 | ya, dgn opsi | RECORD_AUDIO — voice note dispute |
| 10 | expo-contacts | 15.0.11 | ya, dgn opsi | READ_CONTACTS |
| 11 | expo-location | 19.0.8 | ya, dgn opsi | ACCESS_FINE/COARSE_LOCATION |
| 12 | expo-haptics | 15.0.8 | tidak perlu | VIBRATE |
| 13 | expo-keep-awake | 15.0.8 | tidak perlu | WAKE_LOCK |
| 14 | expo-tracking-transparency | 6.0.8 | **sengaja tidak dipasang** | ATT iOS — lihat catatan |
| 15 | expo-device | 8.0.10 | tidak perlu | fraud detection, **nol permission** |
| 16 | expo-network | 8.0.8 | tidak perlu | ACCESS_NETWORK_STATE |

Ditambahkan pada pekerjaan ini: **expo-keep-awake, expo-tracking-transparency,
expo-network** (+ dua peer dependency di bawah). Sisanya sudah terpasang dari
pekerjaan permission sebelumnya.

### expo-av tidak dipasang — dan itu memang benar

Permintaan menyebut "expo-av atau expo-audio kalau sudah migrasi". SDK 54
sudah memakai **expo-audio 1.1.1**, penerus resmi expo-av. Memasang keduanya
berarti dua stack audio native dalam satu binary tanpa manfaat apa pun.
expo-av (~16.0.8) masih ada di SDK 54 tetapi berstatus warisan.

### Dua peer dependency native yang hilang — ditemukan expo-doctor

`expo-doctor` menemukan `expo-asset` (dibutuhkan expo-audio) dan
`expo-linking` (dibutuhkan expo-router) tidak terdaftar sebagai dependensi
langsung. Keduanya kebetulan ada di `node_modules` sebagai dependensi
transitif, jadi tidak terlihat bermasalah saat pengembangan — tetapi hoisting
npm tidak dijamin, dan peer dependency native yang hanya transitif bisa gagal
ter-autolink pada build bersih. Peringatan expo-doctor: *"Your app may crash
outside of Expo Go without these dependencies."*

Sudah dinaikkan menjadi dependensi langsung pada pin yang sama:
`expo-asset@~12.0.13`, `expo-linking@~8.0.12`.

### Kenapa plugin expo-tracking-transparency TIDAK dipasang

Pluginnya melakukan dua hal, dan yang kedua tidak diinginkan sekarang:

```js
// node_modules/expo-tracking-transparency/plugin/build/…
NSUserTrackingUsageDescription: props?.userTrackingPermission,
…
AndroidConfig.Permissions.withPermissions(config, [
  'com.google.android.gms.permission.AD_ID',   // ← ini
])
```

1. Menulis `NSUserTrackingUsageDescription` — **sudah ada** di
   `ios.infoPlist` dengan teks Indonesia. Memasang plugin membuat string yang
   sama hidup di dua tempat.
2. Menambah permission Android `com.google.android.gms.permission.AD_ID`.
   Advertising ID memicu kewajiban deklarasi di formulir Data Safety Play
   Console. Kahade belum memakai SDK iklan/analitik, jadi menambahkannya
   sekarang berarti menjawab pertanyaan Play Store tentang sesuatu yang tidak
   dipakai.

Modul tetap **ter-autolink penuh** tanpa pluginnya, dan ATT iOS tetap
berfungsi karena usage string sudah ada. Terverifikasi: `AD_ID` **tidak** ada
di AndroidManifest hasil prebuild.

Kalau nanti benar-benar memakai SDK iklan/analitik, barulah tambahkan
`"expo-tracking-transparency"` ke `plugins`.

### expo-updates tanpa entri plugin

`expo-updates` tidak ada di array `plugins`, tetapi konfigurasi native-nya
tetap ditulis — prebuild menerapkannya otomatis. Terverifikasi di
AndroidManifest: `expo.modules.updates.ENABLED`, `EXPO_UPDATE_URL`,
`EXPO_RUNTIME_VERSION`, `EXPO_UPDATES_CHECK_ON_LAUNCH`,
`EXPO_UPDATES_LAUNCH_WAIT_MS`.

## Hasil expo-doctor

`15/18` lolos. Tiga sisanya:

| Gagal | Nyata? |
|---|---|
| Check Expo config schema | **Tidak** — `fetch failed`, butuh api.expo.dev yang diblokir sandbox |
| Validate packages against React Native Directory | **Tidak** — `unexpected server response`, sumber jaringan yang sama |
| `.expo` directory is not ignored by Git | **Ya** — tetapi disengaja tidak diubah, lihat bawah |

`.expo/` **sudah** ada di `.gitignore` (baris 26), namun tiga berkas terlanjur
ter-track sebelum aturan itu ada, dan `.gitignore` tidak berlaku surut:
`.expo/README.md`, `.expo/static-tmp/_error.js`, `.expo/types/router.d.ts`.

Saya sudah menguji bahwa `npx tsc --noEmit` tetap **exit 0** tanpa
`router.d.ts`, jadi `git rm --cached -r .expo` aman. Tidak dilakukan di sini
karena di luar cakupan permintaan modul native — silakan jalankan terpisah.

Dua kegagalan jaringan itu perlu diulang di mesin dengan akses internet
sebelum rilis, karena keduanya belum pernah benar-benar berjalan.
