# Audit — Force close saat splash screen (2026-10-01)

Penyelidikan atas keluhan "crash/force close saat di splash screen" pada aplikasi
Android `id.kahade` (Expo SDK 54, New Architecture, Hermes, release).

Status: **penyebab pasti belum bisa dipastikan dari repo**, tetapi satu cacat
pembangunan yang menghalangi seluruh diagnosa berhasil dibuktikan dan sudah
diperbaiki di branch ini (lihat §3). Sisa hipotesis yang hidup ada di §4, dan
cara memutuskannya ada di §5.

---

## 1. Ringkasan untuk pengambil keputusan

1. **Repo ini tidak bisa menghasilkan APK Android sama sekali.** `expo` dipatok
   `~54.0.0` sementara `expo-document-picker` dipatok `^57.0.2` — paket jalur
   SDK 57 yang memakai API Kotlin yang tidak ada di `expo-modules-core@3.0.30`
   (versi yang dipatok persis oleh `expo@54.0.37`). Kompilasi Android gagal di
   `:expo-document-picker:compileKotlin` (`unresolved reference: OptimizedRecord`).
2. Karena itu, **APK yang crash di perangkat tidak berasal dari state repo
   sekarang**. Ia build lama (sebelum dependensi melenceng) atau build dari
   mesin/state lain.
3. Kandidat penyebab terkuat yang tersisa: **JS yang berjalan tidak sepadan
   dengan binary native yang menampungnya** (JS SDK-54 + modul native versi lain,
   atau sebaliknya). Ketidaksepadanan semacam ini mematikan aplikasi *sebelum
   render pertama* — tepat saat splash masih terlihat — dan tidak bisa dicegat
   error boundary. Tiga paket di luar kontrak SDK 54 (§2) adalah sumbernya.
4. Langkah yang memutuskan: perbaiki versi (sudah dikerjakan di branch ini),
   **build APK baru**, pasang, lalu ambil logcat kalau masih crash (§5).

---

## 2. Bukti (dapat direproduksi)

### 2.1 Tiga paket di luar kontrak SDK 54

Sumber kontrak: `node_modules/expo/bundledNativeModules.json`.

| paket | dipatok repo | kontrak SDK 54 | jalur SDK |
|---|---|---|---|
| `expo-document-picker` | `^57.0.2` | `~14.0.8` | SDK 57 (dist-tag npm `sdk-57`) |
| `expo-video` | `~2.2.3` | `~3.0.16` | SDK 53 (dist-tag npm `sdk-53`) |
| `@react-native-community/netinfo` | `^12.0.1` | `11.4.1` | — |

Cek: `node -e "const b=require('./node_modules/expo/bundledNativeModules.json'); …"`
dan `npm view <paket> dist-tags`.

`expo install --check` / `expo-doctor` tidak bisa dijalankan dari sandbox ini
(ekspo.dev tidak terjangkau), jadi perbandingan dilakukan langsung terhadap
`bundledNativeModules.json`.

### 2.2 `expo-document-picker@57.0.2` mematahkan kompilasi Android

```
$ grep -rn "OptimizedRecord" node_modules/expo-modules-core/
(tidak ada hasil)

$ grep -rn "OptimizedRecord" node_modules/expo-document-picker/android/src/
…/DocumentPickerOptions.kt:5:import expo.modules.kotlin.types.OptimizedRecord
…/DocumentPickerOptions.kt:7:@OptimizedRecord
…/DocumentPickerResults.kt:6:import expo.modules.kotlin.types.OptimizedRecord
…/DocumentPickerResults.kt:8:@OptimizedRecord
…/DocumentPickerResults.kt:17:@OptimizedRecord
```

`grep -ral "OptimizedRecord" node_modules/` hanya menemukan berkas Kotlin milik
`expo-document-picker` sendiri: **tidak ada satu pun paket di tree ini yang
menyediakan tipe itu**. Tidak ada AAR/JAR biner di `expo-modules-core` yang bisa
menyembunyikannya (`find node_modules/expo-modules-core -name "*.aar" -o -name "*.jar"` → kosong).

`expo-document-picker` ikut autolinking Android:

```
$ cat node_modules/expo-document-picker/expo-module.config.json
{ "platforms": ["apple", "android"],
  "android": { "modules": ["expo.modules.documentpicker.DocumentPickerModule"], … } }
```

⇒ `:expo-document-picker:compileReleaseKotlin` **gagal**; tidak ada APK/AAB yang
bisa dihasilkan dari state ini, baik lewat EAS maupun `./gradlew assembleRelease`.

Implikasi riwayat: branch `diag/canary-minimal` (6b05f4c, 2026-10-01 13:34) masih
memakai `expo: ~54.0.0` + `expo-document-picker: ^57.0.2` (`git show
origin/diag/canary-minimal:package.json`) — yaitu eksperimen kunci "apakah
masalahnya di kode aplikasi?" **tidak pernah bisa ter-build**. Ini menjelaskan
mengapa tidak ada satu pun hasil canary yang tercatat. `diag/canary-bare` dan
`upgrade/sdk57` sudah pindah ke SDK 57 (`expo: ~57.0.0`, doc-picker `~57.0.3`),
di situ pasangan itu konsisten lagi.

### 2.3 CI tidak pernah membangun Android

`.github/workflows/ci.yml` hanya menjalankan `npm run check` (typecheck, lint,
skrip check, vitest) + smoke web Playwright. Tidak ada job native/gradle, jadi
cacat §2.2 tidak pernah terdeteksi otomatis.

### 2.4 Yang sudah dikecualikan (jangan diulang)

| dugaan | hasil | bukti |
|---|---|---|
| Modul scope melempar di jalur boot | bersih | AST scan seluruh `app/**` + `lib/**`; satu-satunya throw di module scope adalah validasi env `lib/api/config.ts` yang punya default aman (`https://api.kahade.id`, `prod`) |
| Import cycle | bersih | hanya `session.ts ↔ query-cache.ts` (dynamic import sengaja) |
| Metro/bundling | bersih | `EXPO_OFFLINE=1 npx expo export --platform android` → 3082 modul, `.hbc` 10,3 MB |
| Boot web (evaluasi modul + render pertama + provider) | bersih | 5 chunk entry dimuat ke jsdom (`/tmp/web-boot.mjs`): 0 error/warning |
| Transform worklet Reanimated mati | **keliru** | Babel tangan atas `app/_layout.tsx` dengan preset repo justru menghasilkan `__workletHash`/`__initData` (`/tmp/babel-check.cjs`) |
| OTA code signing | bersih | verifikasi tanda tangan hanya di jalur unduhan remote (`FileDownloader.kt:266,459`); update embedded selalu `isVerified=true` |
| Bitmap splash/ikon kebesaran | bersih | IHDR: splash-icon 2048², icon 1024²; `splashscreen_logo.png` 288²–1152² (2,4–13,8 KB) |
| R8/minify memotong kelas | bersih | `android.enableMinifyInReleaseBuilds` tidak di-set → `minifyEnabled=false`, `shrinkResources=false` |
| ABI tidak lengkap | bersih | `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` |
| `expo-modules-core` salah versi | bersih | `expo@54.0.37` memang mematok `expo-modules-core@3.0.30` |
| `expo-video@2.2.3` mematahkan build | tidak | seluruh `import expo.modules.*`-nya resolvable di core 3.0.30 |
| TurboModule `RNCNetInfo` tidak terdaftar | belum terbukti, kemungkinan kecil | autolinking netinfo bersih; `getEnforcing` hanya melempar bila modul native benar-benar tidak ada |

---

## 3. Perbaikan yang diterapkan di branch ini

`package.json` + `package-lock.json` disetel kembali ke kontrak SDK 54:

```
npx expo install --fix        # di mesin yang punya akses ekspo.dev
# setara dengan (dijalankan di sini):
npm install expo-document-picker@~14.0.8 expo-video@~3.0.16 \
            @react-native-community/netinfo@11.4.1
```

Verifikasi setelah perubahan:

- `OptimizedRecord` tidak lagi ditemukan di `node_modules/`;
- seluruh `import expo.modules.*` milik `expo-document-picker@14.0.8`
  (`records.IsNotEmpty`, `records.Field`, `records.Record`, `Promise`,
  `modules.ModuleDefinition`, `core.utilities.FileUtilities`, …) ada di
  `expo-modules-core@3.0.30` ⇒ pasangan SDK-54 konsisten;
- pemakaian di aplikasi cocok dengan API versi baru:
  `DocumentPicker.getDocumentAsync({type, copyToCacheDirectory, multiple})`
  (`components/screens/chat-room-screen.tsx:1650`,
  `components/screens/dispute-detail-screen.tsx:716`) dan
  `NetInfo.addEventListener/fetch`, `type NetInfoState` (`lib/connectivity.ts:17,91,94`);
- `npx tsc --noEmit` bersih;
- `EXPO_OFFLINE=1 npx expo export --platform android` sukses
  (`entry-b63f65ec….hbc`, 10,3 MB);
- test terkait lulus: `tests/feed-video-wifi-autoplay.test.tsx` (12),
  `tests/offline-queue.test.ts` (4), `tests/st-001-scan-shell.test.ts` (3).

Catatan: kalau nanti pindah ke SDK 57 (`upgrade/sdk57`), `expo-document-picker@57`
justru versi yang benar — yang salah adalah **mencampur** jalur SDK 54 dengan
paket jalur SDK 57.

---

## 4. Sisa hipotesis untuk crash-nya sendiri

Fakta yang membingkai semuanya:

- `app.json`: `updates.checkAutomatically = ON_LOAD`, `fallbackToCacheTimeout: 0`,
  `runtimeVersion: { policy: "fingerprint" }`; manifest Android:
  `CHECK_ON_LAUNCH=ALWAYS`, `LAUNCH_WAIT_MS=0`. Jadi JS yang benar-benar berjalan
  bisa berasal dari **update OTA**, bukan dari bundle embedded di APK.
- `components/ui/feed-video.tsx:100` mencatat eksplisit bahwa kode ini dirancang
  untuk hidup di "APK lama (tanpa native module)" — artinya kombinasi
  "JS lebih baru daripada binary" memang sudah dikenal di repo ini.
- Jalur boot native memanggil modul native **sebelum render pertama**:
  `app/_layout.tsx` → `@/lib/connectivity` → `@react-native-community/netinfo`,
  dan netinfo memanggil `TurboModuleRegistry.getEnforcing('RNCNetInfo')` di
  module scope (`node_modules/@react-native-community/netinfo/lib/commonjs/internal/nativeModule.js`).
  Bila binary tidak mendaftarkan TurboModule itu dengan bentuk yang diharapkan,
  galat terjadi sebelum satu frame pun dirender → **force close saat splash**,
  tanpa peluang ditangkap error boundary (`export { AppErrorBoundary }` di
  `app/_layout.tsx:158` hanya membungkus isi router, bukan layout root).

Hipotesis yang konsisten dengan seluruh fakta:

> Perangkat menjalankan **JS hasil tree ini di atas binary yang lebih tua**
> (atau sebaliknya). Selisih versi paket native (netinfo 12 vs 11.4.1,
> expo-video 2 vs 3) membuat panggilan/registrasi modul native gagal di jalur
> boot → fatal → force close di splash. Sumber tree ini tidak bisa dipakai untuk
> membangun binary pembanding karena cacat §2.2.

Hipotesis alternatif yang belum tertutup: crash native murni (di luar JS) pada
binary lama — hanya bisa dibedakan lewat logcat.

## 5. Langkah yang memutuskan (butuh perangkat/akun, tidak bisa dari sandbox)

1. **Pastikan status build terakhir** — apakah build APK terakhir benar-benar
   sukses, dan sejak kapan:
   `npx eas-cli build:list --platform android --limit 10`
   (prediksi dari audit ini: build berbasis SDK 54 **gagal** di tahap gradle).
2. **Bangun APK baru dari branch ini** (dependensi sudah diperbaiki):
   `npx eas-cli build --profile preview --platform android`, lalu pasang.
   - Masih force close → penyebabnya bukan selisih dependensi; lanjut ke (3)
     dengan binary baru (log-nya bersih dari variabel lama).
   - Tidak lagi force close → hipotesis §4 terbukti; akar masalahnya kombinasi
     JS/native yang tak sepadan.
3. **Ambil log crash** (satu perintah, tempel hasilnya):
   ```
   adb logcat -b crash -d
   adb logcat -d | grep -iE "FATAL|AndroidRuntime|hermes|ReactNativeJS|expo|kahade"
   ```
   Yang dicari: `FATAL EXCEPTION: main`, `Unable to load script`,
   `Unsupported bytecode version`, `… could not be found` (TurboModule),
   `java.lang.RuntimeException` dari `MainActivity`/`MainApplication`.
4. **Cek update yang beredar** (apakah ada OTA yang menimpa binary lama):
   `npx eas-cli update:list --branch production --platform android` dan
   `npx eas-cli channel:list`.
5. Kalau mau membuktikan "JS vs binary" tanpa adb: pasang APK baru, matikan
   internet, lalu buka aplikasi (memaksa bundle embedded dipakai). Bila tanpa
   internet aplikasi **tidak** crash tetapi crash saat online, berarti update
   OTA yang bermasalah.

## 6. Catatan untuk branch diagnosa yang sudah ada

- `diag/crash-report` (RootErrorBoundary) berguna, tetapi tidak akan menangkap
  galat yang terjadi saat bundle dievaluasi (sebelum React) — mis. `getEnforcing`
  netinfo. Untuk kasus itu perlu `ErrorUtils.setGlobalHandler` +
  `Updates.reloadAsync`/layar darurat, bukan error boundary.
- `diag/canary-minimal` harus di-rebase ke dependensi SDK 54 yang benar dulu
  (§3), baru bisa dipakai sebagai eksperimen "kode aplikasi vs bukan".
- `upgrade/sdk57` bukan jalan keluar untuk masalah ini (dependensinya memang
  benar untuk SDK 57, tetapi crash harus dijelaskan lebih dulu).
