# Audit — Force close saat splash screen (2026-10-01)

Penyelidikan atas keluhan "crash/force close saat di splash screen" pada aplikasi
Android `id.kahade` (Expo SDK 54, New Architecture, Hermes, APK EAS).

**Status: penyebab ditemukan.** `expo-document-picker@57.0.2` — paket jalur
**SDK 57** — terpasang di aplikasi **SDK 54**. Expo mengirim modul native sebagai
**AAR prebuilt** di dalam paket npm dan gradle **memakai AAR itu secara default**,
sehingga build tetap hijau meski bytecode-nya dikompilasi terhadap
`expo-modules-core` SDK 57. Modul itu diinisialisasi **saat startup, sebelum
frame JS pertama**, dan panggilan API-nya menabrak kelas core yang tidak ada di
SDK 54 → `NoClassDefFoundError` di main thread → **force close saat splash**,
tanpa JS terlibat dan tanpa bisa ditangkap error boundary.

> Koreksi: draf pertama audit ini menyimpulkan "build Android mustahil karena
> `OptimizedRecord` tidak ada di core SDK 54". Itu **salah** — kompilasi sumber
> memang akan gagal, tetapi build tidak pernah mengompilasi sumber modul: yang
> ditautkan adalah AAR prebuilt (§2.2). Kesimpulan final ada di §1 dan §3.

---

## 1. Penyebab (ringkas, berurutan)

1. `package.json` memakai `expo: ~54.0.0` **dan** `expo-document-picker: ^57.0.2`
   (jalur SDK 57). Tabel kontrak §2.1.
2. Expo mempublikasikan tiap modul Expo sebagai **AAR prebuilt** di
   `node_modules/<paket>/local-maven-repo/…`, dan build memakainya **default**
   (`SettingsManager.evaluateShouldUsePublicationScript()` →
   `shouldUsePublication = true` bila tidak ada skrip penentu) — §2.2.
3. AAR `expo.modules.documentpicker-57.0.2.aar` dikompilasi terhadap
   `expo-modules-core` **SDK 57**, sementara aplikasi memakai core **SDK 54
   (3.0.30)**. Bytecode-nya benar-benar memanggil kelas core yang **tidak ada**
   di 3.0.30: `types.AnyTypeCache`, `types.descriptors.TypeDescriptor`,
   `types.descriptors.TypeDescriptorKt`, `types.descriptors.TypeDescriptorOfKt`
   — §2.3 (dengan kontrol pembanding, jadi bukan artefak alat ukur).
4. Modul Expo diinisialisasi **saat startup**: `ModuleRegistry.register(provider)`
   membuat instance tiap modul (`type.getDeclaredConstructor().newInstance()`),
   lalu `ModuleHolder` **langsung** memanggil `module.definition()`
   (`ModuleHolder.kt:22`). Ini berjalan saat React instance dibangun — **sebelum
   render/frame JS pertama** — §2.4.
5. Saat `definition()` modul document-picker dieksekusi, ART menyelelesaikan
   rujukan kelas yang hilang → `NoClassDefFoundError` / `NoSuchMethodError` di
   main thread → `FATAL EXCEPTION` → **force close**, tepat saat splash masih
   terlihat. Tidak ada satu baris JS yang berjalan, sehingga:
   - error boundary JS (`export { AppErrorBoundary as ErrorBoundary }`) tidak
     bisa menangkapnya;
   - semua branch canary yang hanya mengubah JS (`diag/canary-minimal`) tetap
     crash — modul native-nya identik;
   - aplikasi tampak "normal" di web/Node (di sana tidak ada modul native).

## 2. Bukti

### 2.1 Tiga paket di luar kontrak SDK 54

Kontrak = `node_modules/expo/bundledNativeModules.json` (SDK 54).

| paket | dipatok repo (sebelum perbaikan) | kontrak SDK 54 | jalur SDK |
|---|---|---|---|
| `expo-document-picker` | `^57.0.2` | `~14.0.8` | SDK 57 (`npm view … dist-tags` → `sdk-57: 57.0.3`) |
| `expo-video` | `~2.2.3` | `~3.0.16` | SDK 53 (`sdk-53: 2.2.3`) |
| `@react-native-community/netinfo` | `^12.0.1` | `11.4.1` | — (modul RN biasa, dikompilasi dari sumber) |

### 2.2 AAR prebuilt dipakai secara default (kenapa EAS hijau)

```kotlin
// expo-modules-autolinking/.../expo-autolinking-settings-plugin/.../SettingsManager.kt
private fun configurePublication(config: ExpoAutolinkingConfig) {
  config.allProjects.forEach { project ->
    if (project.publication != null) {
      val forceBuildFromSource = config.configuration.buildFromSourceRegex.any { it.matches(project.name) }
      project.configuration.shouldUsePublication = !forceBuildFromSource && evaluateShouldUsePublicationScript(project)
    }
  }
}
private fun evaluateShouldUsePublicationScript(project: GradleProject): Boolean {
  // If the path to the script is not defined, we assume that the publication should be used.
  val scriptPath = project.shouldUsePublicationScriptPath ?: return true
  …
}
```

`app.json` tidak punya `expo.autolinking.buildFromSourceRegex` → modul Expo
ditautkan sebagai AAR dari `local-maven-repo` paketnya. Karena itu
`expo-document-picker@57.0.2` **tidak** dikompilasi dari sumber (kalau
dikompilasi, build akan gagal: sumbernya memakai
`expo.modules.kotlin.types.OptimizedRecord` yang tidak ada di core 3.0.30 —
bukti pendukung `grep -rn OptimizedRecord node_modules/expo-modules-core/` kosong).

### 2.3 Bytecode AAR menabrak kelas core yang tidak ada

Metode: parse `classes.jar` di dalam AAR → ambil semua `CONSTANT_Methodref` →
cek apakah **kelas pemilik panggilan** ada di sumber core SDK yang dituju.

| AAR | core | kelas core yang dipanggil tapi HILANG |
|---|---|---|
| `expo.modules.documentpicker-57.0.2.aar` | 3.0.30 (SDK 54) ← dipakai repo | `types.AnyTypeCache`, `types.descriptors.TypeDescriptor`, `types.descriptors.TypeDescriptorKt`, `types.descriptors.TypeDescriptorOfKt` |
| `expo.modules.documentpicker-57.0.3.aar` | 57.0.20 (SDK 57) | (hanya artefak penamaan, 0 nyata) |
| `expo.modules.documentpicker-14.0.8.aar` | 3.0.30 (SDK 54) | (0 nyata) — sesudah perbaikan §4 |

Paket `expo.modules.kotlin.types.descriptors.*` dan `AnyTypeCache` **tidak ada
sama sekali** di `expo-modules-core@3.0.30` (hasil `ls`/`grep` atas
`android/src/main/java/expo/modules/kotlin/types/`), tetapi dipanggil oleh
bytecode AAR 57.0.2. Perbandingan dengan 57.0.3 vs core 57.0.20 dipakai sebagai
**kontrol**: bila metode analisis salah, kontrol ini juga akan melaporkan
banyak kelas hilang — ternyata bersih.

### 2.4 Modul diinisialisasi di native, saat startup, sebelum JS (rantai lengkap)

```kotlin
// ModuleRegistry.kt:44-48
fun register(provider: ModulesProvider) = apply {
  provider.getModulesList().forEach { type ->
    val module = type.getDeclaredConstructor().newInstance()   // instansiasi SEMUA modul
    register(module)
  }
}
// ModuleHolder.kt:22  (properti → jalan dari konstruktor ModuleHolder)
val definition = module.definition()                            // jalankan definition() modul
```

```kotlin
// AppContext.kt:120  (dipanggil dari blok init AppContext)
registry.register(modulesProvider)
```

Rantai lengkapnya (semuanya native, main thread):

```
RN membuat React instance
  └─ ModuleRegistryAdapter.createNativeModules()          // ReactPackage, dipanggil RN di init instance
       └─ new NativeModulesProxy(...)
            └─ new KotlinInteropModuleRegistry(...)
                 └─ AppContext(...)                        // blok init
                      └─ registry.register(modulesProvider) // AppContext.kt:120
                           └─ type.newInstance() + ModuleHolder(module)
                                └─ module.definition()      // ModuleHolder.kt:22
                                     └─ (AAR SDK 57) memanggil
                                        expo.modules.kotlin.types.descriptors.TypeDescriptor / AnyTypeCache
                                          => NoClassDefFoundError / NoSuchMethodError
```

Poin penting: **tidak ada JS yang berjalan** di rantai ini. JS bundle baru dieksekusi
setelah registry selesai dibangun (`loadReactNative` → bundle dievaluasi → baru
`app/_layout.tsx`). Karena itu crash terjadi saat splash masih tampil dan tidak
mungkin ditangkap `ErrorBoundary` JS.

### 2.5 Penyapuan seluruh modul terpasang

Metode §2.3 dijalankan atas **27 AAR** modul Expo yang terpasang:

- sebelum perbaikan: hanya `expo-document-picker@57.0.2` yang merujuk kelas core
  yang benar-benar tidak ada (`AnyTypeCache`, `types.descriptors.TypeDescriptor`,
  `TypeDescriptorKt`, `TypeDescriptorOfKt`);
- sesudah perbaikan (§4): **0 modul** (sisa temuan hanyalah nested class /
  `$DefaultImpls` / `Companion` yang tidak bisa direpresentasikan alat ukur).

Artinya modul ini satu-satunya sumber mismatch, konsisten dengan crash yang
muncul tepat setelah paket jalur SDK 57 masuk ke dependency.

### 2.5 Yang sudah dikecualikan (jangan diulang)

| dugaan | hasil |
|---|---|
| Modul scope JS melempar di jalur boot | bersih (AST scan + boot web jsdom 0 error) |
| Import cycle | bersih (hanya `session.ts ↔ query-cache.ts` yang disengaja) |
| Metro/bundling | bersih (`expo export --platform android` sukses, 3082 modul) |
| Transform worklet Reanimated mati | keliru (probe Babel justru menghasilkan `__workletHash`) |
| OTA code signing | bersih (verifikasi hanya di jalur unduhan remote) |
| Bitmap splash/ikon kebesaran | bersih (288²–1152², IHDR normal) |
| R8/minify & ABI | bersih (`minifyEnabled=false`, 4 ABI lengkap) |
| `expo-modules-core` versi salah | bersih (`expo@54.0.37` memang mematok `3.0.30`) |
| `expo-video@2.2.3` mematahkan build | tidak — dikompilasi dari sumber, tanpa AAR |

## 3. Kenapa gejalanya "tepat di splash"

Urutan hidup aplikasi Android release:

1. `MainApplication.onCreate` → React instance dibangun;
2. registrasi modul Expo → `definition()` **semua** modul dijalankan di sini;
3. bundle JS dieksekusi, root layout render, `SplashScreen.hideAsync()`;
4. `AnimatedSplash` memudar.

Crash terjadi di langkah **2** — sebelum langkah 3 — sehingga yang terlihat
pengguna selalu "force close saat splash". Inilah sebabnya seluruh penyelidikan
sebelumnya yang berfokus pada JS (canary minimal, error boundary, audit impor,
bundle) tidak pernah menemukan apa pun: bug-nya tidak ada di JS.

## 4. Perbaikan yang diterapkan di branch ini

`package.json` + `package-lock.json` diselaraskan ke kontrak SDK 54:

```
npm install expo-document-picker@~14.0.8 expo-video@~3.0.16 \
            @react-native-community/netinfo@11.4.1
# setara `npx expo install --fix` (butuh akses ekspo.dev)
```

Verifikasi:

- AAR `expo.modules.documentpicker-14.0.8.aar` vs core 3.0.30 → **0 kelas core
  hilang** (sebelumnya 4 nyata dengan 57.0.2);
- AAR `expo.modules.video-3.0.16.aar` vs core 3.0.30 → 0 nyata;
- pemakaian di aplikasi cocok: `DocumentPicker.getDocumentAsync({type,
  copyToCacheDirectory, multiple})` (`chat-room-screen.tsx:1650`,
  `dispute-detail-screen.tsx:716`), `NetInfo.addEventListener/fetch`
  (`lib/connectivity.ts:17,91,94`);
- `npx tsc --noEmit` bersih; `EXPO_OFFLINE=1 npx expo export --platform android`
  sukses (10,3 MB); test terkait lulus (12 + 4 + 3).

## 5. Jalur SDK 57 (rekomendasi terpisah)

Branch `upgrade/sdk57` **konsisten** dan aman dipakai sebagai basis:

- 44 dependensi dicocokkan ke `bundledNativeModules.json` milik `expo@57.0.26`
  → **0 mismatch**;
- `expo@57.0.26` mematok `expo-modules-core: ~57.0.20`;
- AAR `expo-document-picker-57.0.3` dan `expo-video-57.0.5` vs core 57.0.20 →
  0 kelas core hilang nyata.

Aturan penting: **jangan mencampur jalur SDK**. Paket jalur SDK 57 (versi 55.x+)
hanya benar bila `expo` juga SDK 57; sebaliknya paket SDK 54 (14.x, 3.x, 17.x, …)
hanya benar di SDK 54. Inilah satu-satunya akar masalah crash ini.

## 6. Langkah verifikasi berikutnya (tanpa adb)

1. **SDK 57**: `npx eas-cli build --profile preview --platform android` dari
   `upgrade/sdk57` (setelah merge/rebase), pasang, buka. Bila tidak force close
   lagi → hipotesis §1 terbukti (perubahan satu-satunya: seluruh paket kembali
   satu jalur SDK).
2. **SDK 54 (branch ini)**: build `preview` dari branch ini, pasang, buka.
3. Tanpa PC/adb, log crash masih bisa diambil lewat **Android bug report**:
   aktifkan Opsi Pengembang → **Bug report** (Settings → System → Developer
   options → Bug report), kirim berkasnya; di dalamnya ada logcat + tombstone.
   Cari `FATAL EXCEPTION`, `NoClassDefFoundError`, `NoSuchMethodError`,
   `expo.modules`.
4. Pencegahan agar tidak terulang: `npm run check` **tidak** menyentuh native.
   Tambahkan gate murah yang membandingkan `package.json` dengan
   `bundledNativeModules.json` (bisa dijalankan offline, tanpa ekspo.dev) ke
   `scripts/` dan ke `npm run check` — sudah dikerjakan:
   `scripts/check-sdk-contract.mjs` + `npm run check:sdk`.

## 7. Prediksi log (falsifiable)

Diagnosis §1 bisa diuji. Crash ini termasuk kelas **native Java/Kotlin**, bukan
JS, jadi di logcat bentuknya:

```
FATAL EXCEPTION: main
java.lang.NoClassDefFoundError: expo.modules.kotlin.types.descriptors.TypeDescriptor
   (atau NoSuchMethodError / NoClassDefFoundError: expo.modules.kotlin.types.AnyTypeCache)
  at expo.modules.documentpicker.DocumentPickerModule.definition(...)
  at expo.modules.kotlin.ModuleHolder.<init>(ModuleHolder.kt:22)
  at expo.modules.kotlin.ModuleRegistry.register(ModuleRegistry.kt:...)
  at expo.modules.kotlin.AppContext.<init>(AppContext.kt:120)
  at expo.modules.kotlin.KotlinInteropModuleRegistry.<init>(...)
  at expo.modules.adapters.react.NativeModulesProxy.<init>(...)
  at expo.modules.adapters.react.ModuleRegistryAdapter.createNativeModules(...)
```

Catatan pembeda: kalau yang muncul justru tombstone (`SIGSEGV`/`SIGABRT`,
`libhermes`/`libjsi`/`libreanimated`/`libworklets`), berarti kelas crash-nya
berbeda (native C++/JSI, bukan ART). Pada kasus itu langkah selanjutnya adalah
log tombstone dari bug report — tetapi mismatch dependensi di §2.3 tetap harus
diperbaiki lebih dulu, karena ia pasti mematikan aplikasi apa pun yang dibangun
dari manifest tersebut.

Jika setelah build ulang (SDK 54 yang sudah diselaraskan, atau SDK 57) aplikasi
**tidak** force close lagi, hipotesis §1 terkonfirmasi; bila masih force close,
prediksi di atas terbantah dan log tombstone-lah yang menentukan arah berikutnya.
