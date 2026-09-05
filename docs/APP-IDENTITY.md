# Identitas aplikasi Kahade — final sebelum build native pertama

**Ditetapkan:** 5 September 2026 · **Status:** terkunci

Dokumen ini mencatat nilai yang **tidak boleh berubah lagi** setelah rilis
pertama ke Play Store / App Store, beserta alasan keputusan strukturalnya.

## Nilai identitas

| Field | Nilai | Bisa diubah nanti? |
|---|---|---|
| `name` | `Kahade` | Ya (nama tampilan) |
| `slug` | `kahade` | Tidak — terikat proyek EAS |
| `scheme` | `kahade` | Sebaiknya tidak — deep link tertanam di tautan yang beredar |
| `android.package` | `id.kahade` | **TIDAK PERNAH** setelah publish |
| `ios.bundleIdentifier` | `id.kahade` | **TIDAK PERNAH** setelah publish |
| `version` | `1.0.0` | Ya, naik tiap rilis |
| `extra.eas.projectId` | `c3931e6f-c945-44d3-8ae8-1665c54fdf94` | Tidak |
| `updates.url` | `https://u.expo.dev/c3931e6f-c945-44d3-8ae8-1665c54fdf94` | Harus selalu cocok projectId |
| `runtimeVersion.policy` | `fingerprint` | — |

`id.kahade` adalah reverse-DNS dari domain `kahade.id`. Divalidasi terhadap
aturan Android (tiap segmen diawali huruf, ≥2 segmen, tidak bentrok keyword
Java) dan iOS (hanya alfanumerik, titik, hyphen).

## Keputusan 1 — app.json adalah SATU-SATUNYA sumber kebenaran

`app.config.ts` **dihapus**. Sebelumnya kedua file hidup berdampingan: Expo
membaca `app.json` lalu menyerahkannya ke `app.config.ts` sebagai `config`,
sehingga nilai akhir tersebar di dua tempat.

Lebih berbahaya, `app.config.ts` mengambil identitas dari environment:

```ts
...(process.env.ANDROID_APPLICATION_ID ? { package: process.env.ANDROID_APPLICATION_ID } : {})
...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {})
version: process.env.APP_VERSION || config.version,
```

Untuk nilai yang **permanen setelah publish**, ini adalah pola yang salah:
satu environment variable yang salah di mesin CI cukup untuk mengirim binary
dengan package name berbeda — dan itu tidak bisa ditarik kembali. Mekanisme
env itu masuk akal ketika identitas aslinya belum diketahui; setelah
ditetapkan, ia hanya menyisakan risiko.

Semua yang dulu dinamis kini statis dan sudah bisa ditulis apa adanya:
`runtimeVersion`, `updates.url`, dan `extra.eas.projectId`.

## Keputusan 2 — versionCode & buildNumber TIDAK ditulis di app.json

`eas.json` memakai `cli.appVersionSource: "remote"`, artinya nomor build
disimpan di server EAS. [Dokumentasi Expo](https://docs.expo.dev/build-reference/app-versions/)
menyatakan nilai di app config **diabaikan** dalam mode ini — dan lebih buruk:

> "if you have `android.versionCode` set to 1 in app config, when you create a
> new build using the remote version source, it will auto increment to 2"

Jadi menulis `versionCode: 1` justru menghasilkan **2** di build pertama.
Karena app config kosong, EAS menginisialisasi hitungannya sendiri dari **1**.

Konsekuensi yang perlu diingat: `eas.json` mengaktifkan `autoIncrement` pada
profil `preview` **dan** `production`, dan keduanya berbagi satu penghitung
remote. Build preview ikut memakai nomor, sehingga versionCode di produksi
tidak akan berurutan rapat. Itu tidak masalah bagi store (syaratnya hanya
selalu naik), tapi jangan kaget melihat lompatan.

Untuk menyinkronkan nomor secara manual nanti: `eas build:version:set`.

## Keputusan 3 — `/android/` dan `/ios/` masuk .gitignore

Proyek ini memakai Continuous Native Generation: folder native digenerate dari
`app.json` oleh `expo prebuild`. Begitu folder itu ter-commit, Expo
memperlakukan repo sebagai bare workflow dan **berhenti menerapkan app.json ke
native** — identitas diam-diam diambil dari `build.gradle` dan
`project.pbxproj`. Persis situasi yang membuat orang bingung kenapa mengubah
app.json "tidak berpengaruh".

Karena dokumen ini menetapkan app.json sebagai sumber kebenaran, folder native
tidak boleh ikut masuk repo.

## Verifikasi yang dijalankan

`npx expo prebuild` untuk kedua platform, lalu memeriksa file native yang
dihasilkan (folder dihapus lagi setelahnya):

```
android/app/build.gradle      namespace 'id.kahade'
                              applicationId 'id.kahade'
                              versionCode 1
                              versionName "1.0.0"
android .../strings.xml       app_name = Kahade
android AndroidManifest.xml   EXPO_UPDATE_URL = https://u.expo.dev/c3931e6f-…

ios .../project.pbxproj       PRODUCT_BUNDLE_IDENTIFIER = "id.kahade"  (Debug + Release)
ios .../Info.plist            CFBundleDisplayName      = Kahade
                              CFBundleShortVersionString = 1.0.0
                              CFBundleVersion          = 1
ios .../Expo.plist            EXUpdatesURL             = https://u.expo.dev/c3931e6f-…
                              EXUpdatesRuntimeVersion  = file:fingerprint
```

`npm run check` hijau (127 test). `npm run ota:preflight` kini lolos seluruh
pemeriksaan konfigurasi — sebelumnya gagal pada projectId, bundleIdentifier,
package, dan URL update. Sisa kegagalannya hanya panggilan jaringan langsung
ke `api.kahade.id`, yang tidak bisa dijangkau dari sandbox audit.

## BELUM SELESAI — wajib sebelum submit ke store

1. ~~Tidak ada ikon aplikasi.~~ **SELESAI** — lihat `docs/APP-ICON.md`.
   Peringatan `ios: icon: No icon is defined in the Expo config` sudah hilang
   dari output `expo prebuild`.

2. **Slug belum diverifikasi terhadap proyek EAS.** Nilai di repo adalah
   `kahade`, sedangkan proyek EAS `c3931e6f-…` mungkin dibuat dengan slug
   lain. EAS CLI akan menolak build bila keduanya berbeda, dengan pesan
   semacam *"Project config: slug does not match the value currently
   configured on EAS"*. Verifikasi dengan `eas project:info` (butuh login;
   tidak tersedia di sandbox audit).

3. **`owner` tidak diset.** Tidak wajib bila build dijalankan oleh pemilik
   proyek, tetapi diperlukan untuk build CI pada akun organisasi.
