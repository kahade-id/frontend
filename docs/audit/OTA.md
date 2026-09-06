# Status & prosedur Expo OTA

> Berkas ini dirujuk `npm run ota:preflight` (`scripts/check-ota.mjs`).

## Status: BELUM ADA update OTA yang diterbitkan

Tidak ada OTA yang dipublikasikan oleh repo ini maupun skripnya. Alasan:
perubahan dependency **native** (audit terakhir menghapus modul yang tidak
pernah diimpor: `@shopify/flash-list`, `@shopify/react-native-skia`,
`expo-asset`, `expo-audio`, `expo-background-task`, `expo-camera`,
`expo-contacts`, `expo-keep-awake`, `expo-linking`, `expo-location`,
`expo-media-library`, `expo-network`, `expo-task-manager`,
`expo-tracking-transparency`, `react-native-webrtc` +
`@config-plugins/react-native-webrtc`) mengubah **runtime fingerprint**.
OTA tidak boleh dikirim ke binary yang fingerprint-nya berbeda.

## Prosedur wajib sebelum rilis OTA / native

1. `npm run ota:preflight` — memverifikasi project ID, bundle id, URL update,
   policy `fingerprint`, versi `x.y.z`, dan minimum versi server (live check).
2. `npm run check:push` — konfigurasi FCM Android (`google-services.json`) &
   iOS (`GoogleService-Info.plist`), entitlement APNs, ikon & channel
   notifikasi. Gagal → build EAS juga gagal (`eas-build-pre-install`).
3. Bangun **native binary baru** (`eas build`) untuk fingerprint berikutnya.
4. Verifikasi environment/channel (`eas.json`), akun EAS owner, dan bahwa
   `EXPO_PUBLIC_API_URL` produksi adalah HTTPS eksplisit.
5. Uji di perangkat native sebelum `eas update`. Siapkan rollback:
   `eas update:rollback` (client memilih bundle sebelumnya saat error).
6. `app.json` → `runtimeVersion.policy: "fingerprint"` TIDAK boleh diubah ke
   `appVersion` tanpa keputusan rilis terpisah.

## Kapan OTA aman dipakai

Hanya perubahan JS/asset murni (teks, styling, logika layar) TANPA perubahan
dependency native, TANPA perubahan plugin/permission di `app.json`, dan versi
tetap ≥ minimum versi server untuk semua platform yang menerima update.
