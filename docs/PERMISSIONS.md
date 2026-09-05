# Permission Kahade — dikonfigurasi lewat Expo config plugin

Semua izin dideklarasikan sekarang, sebelum build native pertama, supaya
fitur roadmap bisa diaktifkan lewat OTA tanpa build ulang. Tidak ada native
code manual: seluruhnya lewat `app.json` (`plugins`, `android.permissions`,
`ios.infoPlist`).

Diverifikasi terhadap `AndroidManifest.xml` dan `Info.plist` hasil
`expo prebuild` — bukan hanya terhadap app.json.

---

## Syarat yang sering terlewat: izin saja tidak cukup untuk OTA

Mengaktifkan fitur lewat OTA butuh **dua** hal di dalam binary:

1. izin ada di manifest / Info.plist, **dan**
2. modul native-nya sudah ter-compile di build.

Poin 2 yang biasanya terlupakan. Karena itu empat paket berikut dipasang
sekarang walaupun belum dipakai satu baris pun di JS — autolinking memasukkan
modul native-nya ke build berdasarkan `package.json`, bukan berdasarkan
`import` di JS:

| Paket | Versi (SDK 54) | Untuk |
|---|---|---|
| `expo-location` | `~19.0.8` | Verifikasi lokasi COD, fraud detection |
| `expo-contacts` | `~15.0.11` | Undang teman / referral |
| `expo-media-library` | `~18.2.1` | Simpan invoice ke galeri, pilih video bukti |
| `expo-audio` | `~1.1.1` | Voice note sengketa |

`expo-audio` dipilih, bukan `expo-av` — `expo-av` sudah deprecated di SDK 54.

Versi diambil dari `node_modules/expo/bundledNativeModules.json` (peta versi
offline milik Expo) karena `npx expo install` butuh `api.expo.dev` yang
diblokir di lingkungan ini.

**Konsekuensi:** `runtimeVersion.policy` adalah `fingerprint`, jadi menambah
paket-paket ini mengubah fingerprint. Build lama tidak akan menerima OTA dari
build baru — memang harus satu kali build ulang setelah perubahan ini.

---

## Android — 20/20 izin yang diminta terverifikasi di manifest

| # | Permission | Sumber | Fitur |
|---|---|---|---|
| 1 | `CAMERA` | plugin `expo-camera` | Foto KTP/selfie KYC, bukti transfer, foto sengketa |
| 2 | `READ_MEDIA_IMAGES` | plugin `expo-media-library` | Pilih foto dari galeri (Android 13+) |
| 3 | `READ_MEDIA_VIDEO` | plugin `expo-media-library` | Upload video bukti sengketa (roadmap) |
| 4 | `READ_EXTERNAL_STORAGE` | plugin `expo-media-library` | Fallback Android < 13 |
| 5 | `WRITE_EXTERNAL_STORAGE` | plugin `expo-media-library` | Simpan invoice/receipt, fallback Android < 10 |
| 6 | `POST_NOTIFICATIONS` | `permissions` + `expo-audio` | Notifikasi status order/escrow |
| 7 | `USE_BIOMETRIC` | plugin `expo-local-authentication` | Login biometric |
| 8 | `USE_FINGERPRINT` | plugin `expo-local-authentication` | Backward compat Android lama |
| 9 | `READ_CONTACTS` | plugin `expo-contacts` | Invite/referral |
| 10 | `ACCESS_FINE_LOCATION` | plugin `expo-location` | Verifikasi lokasi COD, fraud detection |
| 11 | `ACCESS_COARSE_LOCATION` | plugin `expo-location` | Fallback lokasi kasar |
| 12 | `RECORD_AUDIO` | plugin `expo-camera` / `expo-audio` | Voice note sengketa (roadmap) |
| 13 | `VIBRATE` | `android.permissions` | Haptic saat notifikasi transaksi |
| 14 | `WAKE_LOCK` | `android.permissions` | Layar tetap on saat verifikasi/pembayaran |
| 15 | `FOREGROUND_SERVICE` | `android.permissions` | Cek status transaksi background (roadmap) — **lihat catatan** |
| 16 | `RECEIVE_BOOT_COMPLETED` | `android.permissions` | Reschedule reminder setelah restart |
| 17 | `READ_PHONE_STATE` | `android.permissions` | Fraud prevention — **lihat trade-off** |
| 18 | `NFC` | `android.permissions` | Baca chip e-KTP (roadmap) — **lihat catatan** |
| 19 | `INTERNET` | `android.permissions` (RN juga menambah otomatis) | Jaringan |
| 20 | `ACCESS_NETWORK_STATE` | `android.permissions` | Deteksi status jaringan |

Izin tambahan yang ikut terbawa dan **sengaja dipertahankan**:

- `MODIFY_AUDIO_SETTINGS`, `BLUETOOTH`, `SYSTEM_ALERT_WINDOW` —
  `react-native-webrtc`, dipakai panggilan video sengketa yang sudah ada.
- `READ_MEDIA_VISUAL_USER_SELECTED` — `expo-media-library`. Diperlukan agar
  "Pilih beberapa foto" (partial photo access) Android 14+ berfungsi.

Izin yang ikut terbawa dan **diblokir**:

- `WRITE_CONTACTS` — `expo-contacts` menambahkannya tanpa opsi untuk
  mematikan. Fitur undang teman hanya *membaca* kontak; izin mengubah kontak
  user tidak pernah dipakai dan hanya memperbesar kecurigaan reviewer serta
  user. Dihapus lewat `android.blockedPermissions`, terverifikasi di manifest
  sebagai `tools:node="remove"`.

---

## iOS — 9/9 usage description terverifikasi di Info.plist

| Key | Sumber | Fitur |
|---|---|---|
| `NSCameraUsageDescription` | plugin `expo-camera` | KYC, bukti transaksi |
| `NSPhotoLibraryUsageDescription` | plugin `expo-image-picker` / `expo-media-library` | Pilih KTP, selfie, bukti transfer |
| `NSPhotoLibraryAddUsageDescription` | plugin `expo-media-library` | Simpan invoice ke galeri |
| `NSFaceIDUsageDescription` | plugin `expo-local-authentication` | Login Face ID |
| `NSContactsUsageDescription` | plugin `expo-contacts` | Undang teman |
| `NSLocationWhenInUseUsageDescription` | plugin `expo-location` | Verifikasi COD |
| `NSMicrophoneUsageDescription` | plugin `expo-camera` / `expo-audio` | Voice note pengaduan |
| `NSUserTrackingUsageDescription` | `ios.infoPlist` | ATT — **lihat catatan** |
| `NFCReaderUsageDescription` | `ios.infoPlist` | e-KTP — **lihat catatan** |

### Dua string berbahasa Inggris yang sempat lolos

`expo-location` memasang `NSLocationAlwaysAndWhenInUseUsageDescription` dan
`NSLocationAlwaysUsageDescription` secara tanpa syarat, dengan teks default
**`"Allow $(PRODUCT_NAME) to access your location"`** — bahasa Inggris di
aplikasi berbahasa Indonesia, dan menjanjikan lokasi *Always* padahal
background location sengaja dimatikan (`isIosBackgroundLocationEnabled: false`).

Keduanya ditimpa lewat `ios.infoPlist` dengan teks Indonesia yang jujur.
Terbukti `ios.infoPlist` menang atas nilai dari plugin.

---

## Tiga izin yang TIDAK bisa diaktifkan lewat OTA

Dideklarasikan sesuai permintaan, tetapi harus jujur: ketiganya tetap butuh
build ulang saat fiturnya dikerjakan.

### `FOREGROUND_SERVICE` — inert di `targetSdk` 35

Build ini memakai `targetSdkVersion 35` (default Expo SDK 54, dibaca dari
`ExpoRootProjectPlugin.kt`). Sejak Android 14 (API 34), `FOREGROUND_SERVICE`
saja tidak cukup: dibutuhkan **izin subtype** (mis.
`FOREGROUND_SERVICE_DATA_SYNC`) **dan** atribut `android:foregroundServiceType`
pada elemen `<service>` di manifest. Tanpa itu, memanggil
`startForeground()` melempar `MissingForegroundServiceTypeException` saat
runtime.

Subtype belum ditambahkan karena elemen `<service>`-nya datang dari modul
native yang belum ada — menambah izin subtype sekarang tidak membuat fiturnya
bisa jalan, hanya menambah beban form deklarasi di Play Console.

### `NFC` — perlu modul native + entitlement

Tidak ada paket Expo untuk membaca e-KTP. Yang dibutuhkan nanti:

- Android: modul seperti `react-native-nfc-manager` (izin `NFC` sudah siap).
- iOS: entitlement `com.apple.developer.nfc.readersession.formats`, plus
  `com.apple.developer.nfc.readersession.iso7816.select-identifiers` berisi
  AID e-KTP, plus capability NFC di provisioning profile. Entitlement
  sekarang hanya berisi `aps-environment` — diverifikasi di
  `ios/Kahade/Kahade.entitlements`. `NFCReaderUsageDescription` sendirian
  tidak melakukan apa pun.

Entitlement NFC sengaja belum ditambahkan: mengaktifkannya tanpa capability
yang cocok di provisioning profile membuat build iOS **gagal**.

Catatan baik: Expo tidak menambahkan
`<uses-feature android:name="android.hardware.nfc" android:required="true">`,
jadi HP tanpa NFC tetap bisa memasang aplikasi dari Play Store.

### `NSUserTrackingUsageDescription` — perlu paket ATT

String saja tidak memunculkan dialog App Tracking Transparency. Perlu
`expo-tracking-transparency` dan pemanggilan `requestTrackingPermissionsAsync()`
sebelum tracking apa pun. Selama belum ada SDK analytics/ads yang melacak,
string ini tidak berbahaya tetapi juga tidak berfungsi.

---

## Trade-off `READ_PHONE_STATE` (sensitif)

Ditambahkan sesuai permintaan, tetapi **rekomendasinya dihapus**, dengan
alasan konkret:

**Manfaatnya nyaris nol di Android modern.** Sejak Android 10, IMEI, MEID, dan
serial number tidak bisa lagi dibaca aplikasi biasa walau `READ_PHONE_STATE`
diberikan — dibutuhkan `READ_PRIVILEGED_PHONE_STATE` yang hanya untuk aplikasi
sistem. Yang tersisa hanyalah info operator/SIM, dan sebagian besar di antaranya
(`getSimOperatorName`, `getNetworkOperator`) sudah bisa dibaca **tanpa izin
apa pun**. Jadi untuk device fingerprinting, izin ini praktis tidak menambah
sinyal.

**Biayanya nyata.** Android menampilkannya kepada user sebagai grup izin
**"Telepon"** — terdengar jauh lebih invasif daripada fungsinya, di aplikasi
finansial yang justru sedang membangun kepercayaan. Play Console juga
menyorotinya saat review.

**Alternatif yang lebih baik**, semuanya tanpa izin: `expo-application`
`getAndroidId()` (sudah terpasang) dan `expo-device` (sudah terpasang) untuk
model/OS, dikombinasikan dengan sinyal sisi server. Ini adalah pendekatan yang
direkomendasikan Google untuk identifikasi perangkat.

Cara menghapus: buang `"android.permission.READ_PHONE_STATE"` dari
`android.permissions` di `app.json`, lalu build ulang.

---

## Catatan App Review: teks izin vs fitur yang benar-benar ada

`react-native-webrtc` sudah terpasang dan dipakai untuk panggilan video saat
sengketa. Teks kamera dan mikrofon yang sekarang dipakai hanya menyebut
verifikasi identitas, bukti transaksi, dan pesan suara:

- Kamera: *"Kahade butuh akses kamera untuk verifikasi identitas dan upload bukti transaksi."*
- Mikrofon: *"Kahade butuh akses mikrofon untuk kirim pesan suara saat proses pengaduan."*

Apple meminta usage description mencakup **seluruh** penggunaan API tersebut.
Teks sebelumnya menyebut pemindaian QR dan panggilan video. Kalau panggilan
video tetap ada di rilis, pertimbangkan menambahkan itu, mis. *"…dan panggilan
video saat penyelesaian sengketa."*

---

## Cara memverifikasi ulang

```bash
npx expo prebuild --platform android --no-install --clean
grep -oE 'android:name="android.permission.[A-Z_]+"' \
  android/app/src/main/AndroidManifest.xml | sort -u

npx expo prebuild --platform ios --no-install
plutil -p ios/Kahade/Info.plist | grep UsageDescription

rm -rf android ios   # CNG: keduanya di-gitignore, lihat docs/APP-IDENTITY.md
```
