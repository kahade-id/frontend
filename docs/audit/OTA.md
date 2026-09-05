# Expo / OTA — status dan prosedur aman

Tanggal audit: **5 September 2026 (UTC)**. Branch kerja: `arena/01a07001-frontend`.

## Status aktual

**Belum ada OTA yang dipublikasikan.** Tidak ada channel production yang diubah, proyek baru dibuat, binary diunggah, atau identitas toko yang ditebak.

Pemeriksaan yang benar-benar dilakukan:

- `npx --yes eas-cli@latest whoami` mengembalikan **Not logged in**.
- Repositori semula tidak mempunyai project ID EAS, updates URL, bundle identifier iOS, atau application ID Android.
- `npm run ota:preflight` sekarang **gagal secara sengaja** apabila konfigurasi tersebut belum tersedia. Skrip ini hanya memeriksa, tidak mempublikasikan.
- Versi di repositori tetap `0.1.0`; respons publik produksi yang diamati menyatakan minimum **1.0.0** untuk iOS dan Android. Versi tidak dinaikkan diam-diam agar tidak menyamarkan binary lama sebagai binary baru.

## Mengapa bundle audit ini tidak boleh langsung dikirim ke runtime lama

Perubahan termasuk **React Native 0.81.0 → 0.81.5** untuk kesesuaian Expo SDK 54 dan penambahan **expo-application** untuk membaca versi binary yang sebenarnya. Keduanya memengaruhi native runtime. OTA JavaScript tidak dapat memasang modul native atau memperbarui React Native pada perangkat.

Konfigurasi `runtimeVersion` yang semula berada di dalam `updates` dipindah ke tempat yang benar, menggunakan kebijakan **fingerprint**. Perbedaan native harus menghasilkan runtime berbeda. Jangan menghapus perlindungan ini atau menyalin runtime ID lama demi memaksakan update.

**Diperlukan native build baru dengan konfigurasi proyek yang benar terlebih dahulu.** Keberhasilan export JavaScript/Hermes bukan bukti APK/IPA berhasil dibangun, diterima toko, atau kompatibel dengan binary terpasang.

## Konfigurasi yang sudah disiapkan

- `app.config.ts`: menerima identitas proyek yang nyata melalui environment; menolak project ID non-UUID; menonaktifkan Updates selama belum terhubung.
- `eas.json`: profil/channel `preview` dan `production`, dengan version code/build number dikelola EAS.
- `.env.example`: mendokumentasikan nama environment, tanpa token atau credential.
- `scripts/check-ota.mjs`: memeriksa project ID, updates URL, identitas native, fingerprint, format versi; jika konfigurasi dasar lengkap, memeriksa minimum versi dari API HTTPS secara live.
- Halaman Versi Aplikasi: tidak mengklaim channel production jika tidak diketahui, tidak menjalankan check/fetch/reload OTA di web/Expo Go/development, membedakan versi binary dari manifest OTA.
- Gate versi minimum: berlaku untuk native, tidak mengunci web menggunakan minimum iOS/Android; kegagalan membuka toko tidak menutup gate. Tautan hanya dipilih untuk platform yang benar.

Environment yang diperlukan dari proyek **yang sudah ada**:

```dotenv
EXPO_PUBLIC_API_URL=https://api.kahade.id
EAS_PROJECT_ID=<UUID proyek Kahade>
EAS_OWNER=<owner proyek>
IOS_BUNDLE_IDENTIFIER=<identifier yang sudah terdaftar>
ANDROID_APPLICATION_ID=<application ID yang sudah terdaftar>
APP_VERSION=<versi native release yang disetujui dan memenuhi minimum server>
```

Jangan memasukkan token ke `EXPO_PUBLIC_*`, `extra`, file sumber, atau chat. Gunakan koneksi Expo/EAS yang sah atau secret store CI. Project ID dan bundle identifier bukan password, tetapi tetap harus sesuai proyek yang benar.

## Urutan rilis

1. Hubungkan akun Expo/EAS yang berhak atas proyek Kahade. Periksa identitas akun dan proyek; jangan menginisialisasi proyek lain untuk menghindari error akses.
2. Verifikasi identifiers, environment, channel/branch mapping EAS, dan versi release dengan pemilik aplikasi. `preview`/`production` adalah konfigurasi yang disiapkan, bukan bukti mapping yang sudah ada di layanan EAS.
3. Cocokkan respons protected API menggunakan akun staging yang diizinkan: wallet, PIN/OTP, top-up, withdrawal/cancel, transfer, order/payment, refund/dispute, subscription, upload, notifikasi, dan session expiry.
4. Selesaikan dokumen legal resmi dan triage dependency advisories yang masih tersisa. Lihat `REPORT.md`.
5. Jalankan:

   ```bash
   npm ci
   npm run check
   npm run test:e2e
   npm run ota:preflight
   npx eas-cli@latest whoami
   npx eas-cli@latest project:info
   ```

6. Bangun native preview baru pada proyek/environment yang benar:

   ```bash
   npx eas-cli@latest build --profile preview --platform all
   ```

   Pasang binary tersebut, lalu uji perangkat iOS/Android nyata: safe area, keyboard, pembesaran teks, background/resume, SecureStore, biometrik, kamera/galeri, push dan WebRTC. Profil internal iOS memerlukan provisioning yang sah.
7. Periksa fingerprint/runtime build terpasang dan mapping channel EAS. Sesudah hasilnya terverifikasi, update **preview** dapat diterbitkan dengan environment yang sama:

   ```bash
   npx eas-cli@latest update --channel preview --message "Frontend audit verification"
   ```

   Pilih environment EAS yang tepat jika CLI memintanya; jangan menggunakan environment development secara tidak sengaja.
8. Uji cold start, download/apply OTA, offline restart, pemulihan update gagal, dan rollback pada binary itu. Catat update group ID, runtime, commit/patchset dan hasil smoke test.
9. Setelah approval, bangun/rilis native production yang kompatibel. OTA production berikutnya hanya untuk runtime yang kompatibel dan telah diuji. Gunakan staged rollout dan mekanisme rollback EAS yang sudah diverifikasi untuk proyek ini.

## Batas pemeriksaan pra-rilis

`ota:preflight` **bukan sertifikasi rilis**. Skrip tidak memverifikasi akun EAS, kepemilikan proyek, certificate, binary di perangkat, approval toko, channel mapping, remote environment, authenticated business flows, ataupun kemampuan rollback. Jika akses jaringan gagal, pemeriksaan minimum versi juga gagal; jangan menggantinya dengan hasil tebakan.
