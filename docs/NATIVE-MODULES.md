# Inventaris native module Kahade

Expo SDK **54.0.37** (`expo@~54.0.0`). Semua versi diambil dari
`node_modules/expo/bundledNativeModules.json`, yaitu peta versi resmi untuk
SDK ini — bukan `@latest`.

Tujuan: semua modul native sudah ter-link sekarang, sehingga mengaktifkan
fitur terkait nanti **tidak perlu rebuild**. Logic JS sengaja belum di-wire.

## Terpasang & ter-autolink (18 modul)

Terverifikasi lewat `expo-modules-autolinking resolve` untuk **android dan
ios**: 36 modul native di Android, 37 di iOS, dan seluruh 18 modul yang
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
| 17 | expo-task-manager | 14.0.9 | otomatis | prasyarat background task |
| 17 | expo-background-task | 1.0.10 | ya | cek status background — lihat poin 17 |

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

## Poin "perlu perhatian khusus" — hasil keputusan

### 17. Background service → `expo-background-task`, bukan foreground service

Terpasang: **expo-task-manager 14.0.9** + **expo-background-task 1.0.10**
(WorkManager di Android, `BGProcessingTask` di iOS). Izin
`FOREGROUND_SERVICE` **dihapus** dari `app.json`.

Dua temuan yang mendasari:

1. Kebutuhan *"reschedule reminder setelah reboot"* **sudah tercakup**:
   `expo-notifications` mendeklarasikan `RECEIVE_BOOT_COMPLETED` sendiri di
   manifest modulnya dan menjadwal ulang notifikasi secara native.
2. `FOREGROUND_SERVICE` ada di `app.json` tetapi **tidak dipakai modul mana
   pun**. Sejak Android 14 setiap foreground service wajib punya
   `foregroundServiceType`, dan sebagian tipe butuh justifikasi di Play
   Console — beban review untuk izin yang mati.

Hanya plugin `expo-background-task` yang didaftarkan di `app.json`. Ia
menambahkan ke Info.plist:

```
UIBackgroundModes += 'processing'
BGTaskSchedulerPermittedIdentifiers = ['com.expo.modules.backgroundtask.processing']
```

Terverifikasi setelah prebuild: `UIBackgroundModes` akhir berisi
`['remote-notification', 'fetch', 'processing']` — jadi plugin **menambah**,
tidak menimpa `remote-notification` yang datang dari `ios.infoPlist`.

**Dari mana `fetch` datang?** Bukan dari saya. `expo prebuild` menerapkan
sebagian config plugin **secara otomatis** untuk paket yang terpasang, tanpa
perlu terdaftar di `plugins`. Terlihat dari `_internal.pluginHistory` hasil
`expo config --type introspect`, yang memuat `expo-task-manager`,
`expo-updates`, `expo-system-ui`, `expo-navigation-bar`, dan lainnya.
`expo-task-manager` menambahkan `fetch`. Itu juga penjelasan kenapa
`expo-updates` ikut terkonfigurasi tanpa entri plugin.

Yang penting: **`expo-tracking-transparency` TIDAK ikut auto-apply** —
diverifikasi ulang setelah semua pemasangan, `AD_ID` tetap nol di
AndroidManifest. Keputusan di bagian ATT di atas tetap berlaku.

Batasan iOS yang perlu diketahui sebelum merancang fiturnya: `BGProcessingTask`
dijadwalkan oleh OS, bukan oleh aplikasi. Tidak ada jaminan interval — iOS
mempertimbangkan pola pemakaian, baterai, dan status pengisian daya. Jangan
pakai untuk apa pun yang butuh ketepatan waktu; status escrow yang mendesak
tetap harus lewat push notification.

### 18. NFC e-KTP — tidak dipasang, izin dihapus

`react-native-nfc-manager` **tidak dipasang** dan izin `NFC` +
`NFCReaderUsageDescription` dibuang.

Alasannya bukan kompatibilitas Expo (v3.17.2 punya config plugin dan
`@expo/config-plugins` sebagai peer). Alasannya fiturnya **tidak mungkin**:
data di chip e-KTP terenkripsi dan hanya bisa dibuka lewat Security Access
Module (SAM) yang tertanam pada reader resmi bersertifikat Kemendagri. NFC
ponsel hanya bisa mendeteksi keberadaan chip dan UID-nya, bukan data
identitas.

Menambah modul native pihak ketiga untuk fitur yang tidak bisa jalan berarti
menambah risiko build tanpa imbalan apa pun. KYC tetap kamera + OCR + liveness.

### 19. `READ_PHONE_STATE` — dihapus

Sejak Android 10 (API 29) `getImei`, `getDeviceId`, `getSubscriberId`, dan
`getSimSerialNumber` dibatasi ke `READ_PRIVILEGED_PHONE_STATE`, yang hanya
diberikan pada aplikasi sistem. Project ini `targetSdk 35`, jadi izin tersebut
**tidak memberi identifier device sama sekali** — hanya nama operator, info
SIM, dan status panggilan. Untuk fraud detection nilainya nol, sementara
Android menampilkannya sebagai grup izin "Telepon" pada aplikasi finansial.

Digantikan `expo-device` (nol izin): `brand`, `modelName`,
`osBuildFingerprint`, `deviceYearClass`, plus `isRootedExperimentalAsync()` dan
`isSideLoadingEnabledAsync()` — sinyal yang justru lebih relevan untuk
penipuan.

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
