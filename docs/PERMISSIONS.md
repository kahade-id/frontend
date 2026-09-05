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

> **Diperbarui.** Tiga izin di bawah — `FOREGROUND_SERVICE`, `NFC`, dan
> `READ_PHONE_STATE` — **sudah dihapus** dari `app.json`, beserta
> `NFCReaderUsageDescription` di iOS. Alasannya di bagian masing-masing.
> Daftar modul native ada di [NATIVE-MODULES.md](./NATIVE-MODULES.md).

## Android — izin yang terverifikasi di manifest

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
| ~~15~~ | ~~`FOREGROUND_SERVICE`~~ | **DIHAPUS** | Digantikan `expo-background-task` — lihat bawah |
| 16 | `RECEIVE_BOOT_COMPLETED` | `android.permissions` | Reschedule reminder setelah restart |
| ~~17~~ | ~~`READ_PHONE_STATE`~~ | **DIHAPUS** | Nol manfaat di targetSdk 35 — lihat bawah |
| ~~18~~ | ~~`NFC`~~ | **DIHAPUS** | e-KTP tidak bisa dibaca HP — lihat bawah |
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
| ~~`NFCReaderUsageDescription`~~ | **DIHAPUS** | mengikuti pembatalan NFC |

### Dua string berbahasa Inggris yang sempat lolos

`expo-location` memasang `NSLocationAlwaysAndWhenInUseUsageDescription` dan
`NSLocationAlwaysUsageDescription` secara tanpa syarat, dengan teks default
**`"Allow $(PRODUCT_NAME) to access your location"`** — bahasa Inggris di
aplikasi berbahasa Indonesia, dan menjanjikan lokasi *Always* padahal
background location sengaja dimatikan (`isIosBackgroundLocationEnabled: false`).

Keduanya ditimpa lewat `ios.infoPlist` dengan teks Indonesia yang jujur.
Terbukti `ios.infoPlist` menang atas nilai dari plugin.

---

## Tiga izin yang akhirnya DIHAPUS

Awalnya dideklarasikan sesuai permintaan. Setelah ditelusuri, ketiganya tidak
bisa memberi manfaat pada konfigurasi ini, sementara biayanya di review store
nyata. Semuanya sudah dibuang dari `app.json`.

### `FOREGROUND_SERVICE` — DIHAPUS, digantikan `expo-background-task`

Build ini memakai `targetSdkVersion 35` (default Expo SDK 54, dibaca dari
`ExpoRootProjectPlugin.kt`). Sejak Android 14 (API 34), `FOREGROUND_SERVICE`
saja tidak cukup: dibutuhkan **izin subtype** (mis.
`FOREGROUND_SERVICE_DATA_SYNC`) **dan** atribut `android:foregroundServiceType`
pada elemen `<service>` di manifest. Tanpa itu, memanggil
`startForeground()` melempar `MissingForegroundServiceTypeException` saat
runtime.

Subtype tidak ditambahkan karena elemen `<service>`-nya harus datang dari
modul native yang tidak ada — menambah izin subtype tidak membuat fiturnya
jalan, hanya menambah beban form deklarasi di Play Console.

**Kebutuhannya ternyata sudah tercakup tanpa foreground service:**

- *Reschedule reminder setelah reboot* — `expo-notifications` mendeklarasikan
  `RECEIVE_BOOT_COMPLETED` sendiri di manifest modulnya dan menjadwal ulang
  notifikasi secara native. Tidak perlu service.
- *Cek status transaksi berkala di background* — sekarang dipenuhi
  **`expo-background-task`** (WorkManager di Android, `BGProcessingTask` di
  iOS), jalur resmi Expo SDK 54 pengganti `expo-background-fetch` yang sudah
  deprecated. Ia tidak butuh `FOREGROUND_SERVICE` sama sekali.

Foreground service sungguhan baru diperlukan kalau nanti ada proses lama yang
harus terlihat pengguna di notification bar (mis. hitung mundur pembayaran).
Saat itu barulah izin + subtype + `<service>` ditambahkan sekaligus.

### `NFC` — DIHAPUS, e-KTP tidak bisa dibaca lewat HP

Bukan sekadar soal ketiadaan paket Expo. **Data di chip e-KTP terenkripsi dan
hanya bisa dibuka lewat Security Access Module (SAM) yang tertanam di reader
resmi bersertifikat Kemendagri.** NFC pada ponsel hanya mampu mendeteksi
keberadaan chip dan UID-nya; data identitas tidak bisa dibaca aplikasi publik
mana pun, termasuk lewat `react-native-nfc-manager`. Hambatannya otorisasi
kriptografis, bukan kompatibilitas Expo.

Karena itu izin `NFC` dan `NFCReaderUsageDescription` dibuang: menyisakan izin
yang tidak mungkin dipakai hanya mengundang pertanyaan saat review. Verifikasi
KYC tetap lewat kamera + OCR + liveness.

Kalau suatu saat ada kerja sama resmi Dukcapil/penyedia SAM, yang dibutuhkan:

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

### `NSUserTrackingUsageDescription` — dipertahankan, modul kini terpasang

`expo-tracking-transparency` **sudah terpasang dan ter-autolink**, jadi
`requestTrackingPermissionsAsync()` siap dipanggil tanpa rebuild. Config
plugin-nya sengaja tidak didaftarkan karena ikut menambah izin Android
`com.google.android.gms.permission.AD_ID`; detailnya di
[NATIVE-MODULES.md](./NATIVE-MODULES.md).

---

## `READ_PHONE_STATE` — DIHAPUS

Ditambahkan sesuai permintaan awal, ditandai sebagai trade-off, lalu dihapus
setelah dikonfirmasi. Alasannya:

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

**Sudah dihapus** dari `android.permissions`. `expo-device` (terpasang, nol
izin) menutupi kebutuhan fraud detection: `brand`, `modelName`,
`osBuildFingerprint`, `deviceYearClass`, plus `isRootedExperimentalAsync()` dan
`isSideLoadingEnabledAsync()` yang justru sinyal penipuan lebih relevan
daripada apa pun yang bisa diberikan `READ_PHONE_STATE` hari ini.

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
