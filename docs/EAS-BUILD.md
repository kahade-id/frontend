# Build EAS Kahade — status & cara pakai

Konfigurasi lengkap beserta alasannya ada sebagai komentar di dalam
`eas.json`. Dokumen ini hanya ringkasan operasional.

**Tidak ada satu pun kredensial production yang dibuat atau disimpan.** Belum
ada akun Google Play Developer maupun Apple Developer Program, jadi profil
`production` sengaja dibiarkan kosong dengan catatan TODO.

---

## Yang bisa Anda pakai sekarang

| Profil | Android | iOS | Butuh akun store? |
|---|---|---|---|
| `development` | APK, dev client | Simulator | **Tidak** |
| `preview` | APK, berdiri sendiri | Simulator | **Tidak** |
| `production` | — | — | Ya, belum siap |

### `development` — iterasi harian

```bash
eas build --profile development --platform android
```

Menghasilkan APK berisi cangkang native saja; kode JS diambil dari Metro di
komputer Anda:

```bash
npx expo start --dev-client
```

Konsekuensinya: **perubahan JS tidak perlu build ulang.** Build ulang hanya
diperlukan saat ada perubahan native — menambah paket dengan kode native,
mengubah `app.json`, atau mengganti config plugin.

### `preview` — build uji yang berdiri sendiri

```bash
eas build --profile preview --platform android
```

JS sudah dibundel ke dalam APK, tidak butuh Metro. Inilah yang dikirim ke
penguji: EAS memberi tautan, penguji membukanya di HP Android, unduh, pasang.

Profil ini yang tepat untuk memverifikasi hal-hal yang **tidak bisa** diuji di
Expo Go maupun dev client:

- push notification sungguhan (`google-services.json` asli sudah terpasang;
  FCM V1 key tetap harus diunggah ke EAS)
- App Links / Universal Links
- splash screen dan perilaku cold start
- OTA update lewat channel `preview`

### iOS — hanya simulator, dan hanya di Mac

```bash
eas build --profile development --platform ios
```

`ios.simulator: true` adalah **satu-satunya** build iOS native yang bisa
dilakukan EAS tanpa akun Apple Developer — EAS tidak meminta login Apple sama
sekali karena artefaknya tidak ditandatangani.

Hasilnya `.tar.gz`; pasang ke simulator dengan:

```bash
tar -xzf build-*.tar.gz
xcrun simctl install booted ./Kahade.app
```

**Prasyarat yang tidak bisa diakali:** simulator iOS hanya ada di macOS,
sebagai bagian dari Xcode. Tanpa Mac, profil iOS ini tidak bisa dipakai sama
sekali — bukan karena konfigurasi, melainkan karena Apple tidak menyediakan
simulator di platform lain. Kalau Anda tidak punya Mac, abaikan seluruh jalur
iOS sampai ada akun Apple Developer dan perangkat sungguhan.

---

## Kredensial: apa yang otomatis, apa yang tidak

`credentialsSource: "remote"` (default, ditulis eksplisit agar jelas) berarti
**EAS yang membuat dan menyimpan keystore Android** pada build pertama. Tidak
ada yang perlu Anda siapkan, tidak ada berkas `.jks` di repo.

Build simulator iOS tidak butuh kredensial apa pun.

Sengaja **tidak** dibuat: `credentials.json`, keystore lokal, certificate,
provisioning profile, APNs key.

---

## `eas.json` boleh berkomentar

Terlihat aneh untuk berkas `.json`, tetapi memang didukung: EAS mem-parse-nya
dengan `golden-fleece`, bukan `JSON.parse`. Diverifikasi langsung dengan
parser dan schema yang sama yang dipakai EAS CLI —
`@expo/eas-json/build/schema.js` menerima berkas ini tanpa keluhan, sementara
`JSON.parse` menolaknya.

Karena itu jangan tambahkan `require("../eas.json")` di skrip mana pun; tidak
ada yang melakukannya sekarang, dan itu akan pecah.

---

## `expo-dev-client` — dependensi yang menyertai profil development

`developmentClient: true` tidak berfungsi tanpa paket `expo-dev-client`.
Karena itu ia dipasang bersama pekerjaan ini: **`expo-dev-client@6.0.21`**
(pin SDK 54 dari `bundledNativeModules.json`).

Tidak perlu entri di `app.json`: `expo-dev-client`, `expo-dev-menu`, dan
`expo-dev-launcher` termasuk plugin yang diterapkan otomatis oleh
`expo prebuild` — terlihat di `_internal.pluginHistory`.

---

## Sebelum build production

Empat area perlu diselesaikan. Konfigurasi client Firebase Android pada poin 3
sudah terpasang; kredensial server/store lainnya masih terbuka. Rinciannya ada
sebagai komentar di `eas.json`; ringkasnya:

| # | Butuh | Perintah/status |
|---|---|---|
| 1 | Upload key Android (akun Play Developer, USD 25 sekali) | `eas credentials --platform android` |
| 2 | Distribution Certificate + Provisioning Profile (Apple Developer Program, USD 99/tahun) | `eas credentials --platform ios` |
| 3 | FCM V1 key dan APNs `.p8` | `google-services.json` selesai; lihat [PUSH-NOTIFICATIONS.md](./PUSH-NOTIFICATIONS.md) |
| 4 | SHA-256 fingerprint + Team ID untuk deep link | [DEEP-LINKING.md](./DEEP-LINKING.md) |

Satu jebakan yang mudah terlewat: setelah Play App Signing aktif, Google
menandatangani ulang AAB Anda, sehingga fingerprint SHA-256 untuk
`assetlinks.json` **bukan** milik keystore yang dibuat EAS. Ambil dari Play
Console → Setup → App integrity.

Jangan jalankan `eas build --profile production` sebelum (1) dan (2) selesai —
build akan gagal saat EAS mencari kredensial yang belum ada.
