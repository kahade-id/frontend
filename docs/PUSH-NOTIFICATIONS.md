# Push Notifications — Native & Web

Tiga jalur push, satu kontrak backend (`POST /v1/notifications/register-device`
dengan `platform: "android" | "ios" | "web"`):

| Jalur | Token | Pengirim | Kode |
|---|---|---|---|
| Android native | Expo push token (`ExponentPushToken[…]`) | Backend → Expo Push API → FCM | `lib/push-notifications.ts` |
| iOS native | Expo push token | Backend → Expo Push API → APNs | `lib/push-notifications.ts` |
| Web (browser) | Token FCM Web | Backend → FCM HTTP v1 langsung | `lib/web-push.web.ts` + SW |

Keputusan non-obvious: native memakai **Expo push token**, bukan FCM/APNs
mentah — backend cukup memukul satu API (Expo Push) untuk kedua platform.
Web tidak bisa memakai Expo (Expo tidak mendukung push browser), jadi web
memakai **FCM Web langsung** dengan service worker sendiri.

## 1. Native (Android & iOS) — status: siap, dengan 2 langkah server

Konfigurasi repo sudah benar (`npm run check:push` OK):

- `google-services.json` + `GoogleService-Info.plist` ASLI project
  `kahade-fcm` (bukan placeholder), `package_name`/`BUNDLE_ID` = `id.kahade`.
- `aps-environment: development` — BENAR untuk dev/preview. Jangan diganti
  `production` manual: Xcode/EAS mempromosikannya otomatis saat archive
  App Store, dan nilai `production` justru mematikan push di build
  development/simulator (token sandbox vs endpoint produksi).
- Plugin `expo-notifications` (icon, color, `defaultChannel: "default"`) +
  permission `POST_NOTIFICATIONS` terpasang.
- `NOTIFICATION_CHANNELS` (`default`, `transaksi`) dibuat saat boot di
  `setupNotifications()` — channel Android bersifat sekali-tulis; mengubah
  importance di kode tidak berpengaruh ke pengguna lama (buat ID baru).

Alur: Welcome (tap tombol, user gesture) → `registerPushDevice()` (izin →
token → `register-device` + `deviceId`) → tap notifikasi →
`subscribeNotificationOpened()` → `routeForPushData()` → layar tujuan.
Logout/hapus akun → `unregisterPushDevice()` SEBELUM `clearSession()`.

**Yang masih harus dilakukan di sisi server/EAS (di luar repo):**

1. **FCM V1 service account** — Firebase Console > Project settings >
   Service accounts > Generate new private key → unggah ke EAS:
   `eas credentials --platform android` → … → FCM V1 service account key.
   Tanpa ini Expo Push API menolak pengiriman ke Android dengan
   `InvalidCredentials`.
2. **APNs key (.p8)** — Apple Developer > Keys > buat key Apple Push
   Notifications → unggah ke EAS: `eas credentials --platform ios` →
   Push Notifications. Tanpa ini push iOS tidak terkirim (Android tidak
   terpengaruh).

Cara uji (setelah 2 langkah di atas + build preview di HP fisik —
emulator/simulator tidak punya push token):

```bash
# Ambil Expo token dari log dev (atau endpoint debug bila ada),
# lalu kirim langsung via Expo Push API:
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Content-Type: application/json" \
  -d '{"to":"ExponentPushToken[xxx]","title":"Tes","body":"Halo Kahade",
       "data":{"referenceType":"ORDER","referenceId":"abc"}}'
```

Tap notifikasi harus membuka detail order `abc` (cold start maupun warm).

## 2. Web (FCM browser) — status: kode siap, butuh env Firebase Web

Arsitektur (lihat komentar di tiap file untuk rationale):

- `lib/web-push-config.ts` — baca 7 env `EXPO_PUBLIC_FIREBASE_*`.
  **Akses HARUS literal** (`process.env.EXPO_PUBLIC_FIREBASE_API_KEY`),
  bukan dinamis — Metro hanya meng-inline akses literal (ada test regresi
  `tests/web-push-config.test.ts`).
- `lib/web-push.ts` — stub native (no-op). `lib/web-push.web.ts` —
  implementasi browser (satu-satunya file yang import `firebase/*`, sehingga
  package firebase tidak masuk bundle native).
- `scripts/fcm-sw.template.mjs` + `scripts/gen-fcm-sw.mjs` — service worker
  di-bundle dengan esbuild ke `dist/firebase-messaging-sw.js` sebagai bagian
  `npm run build:web`. Tanpa CDN eksternal (tidak bergantung gstatic saat
  runtime).
- Registrasi: Welcome (web) → `registerWebPushDevice()` → izin Notification
  → daftar SW → `getToken(VAPID)` → `register-device` (`platform: "web"`).
- Re-aktivasi: kartu "Notifikasi browser" di Preferensi Notifikasi (web
  only, muncul hanya bila izin masih `default`/`denied`).
- Foreground: system Notification + klik → navigasi (root layout).
  Background/tertutup: SW menampilkan notifikasi (payload data-only) dan
  klik → buka/fokus tab ke path hasil pemetaan `referenceType`/`referenceId`
  (cermin `lib/notification-routing.ts`) atau `data.url` same-origin.

**Mengaktifkan (sekali saja):**

1. Firebase Console, project **`kahade-fcm`** (harus sama dengan native —
   `gen-fcm-sw` gagal bila beda):
   - Project settings > General > Your apps → Add app > Web → catat
     `apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId`.
   - Project settings > Cloud Messaging > Web Push certificates →
     Generate key pair → catat VAPID key.
2. Isi 7 variabel ke environment build (Cloudflare Pages → Settings →
   Environment variables, atau `.env` lokal untuk preview):
   `EXPO_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`,
   `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID`,
   `EXPO_PUBLIC_FIREBASE_VAPID_KEY` (lihat `.env.example`).
3. Redeploy. Verifikasi: `curl …/firebase-messaging-sw.js` → 200
   `application/javascript`.

Tanpa env: build sukses, SW tidak ditulis, `isWebPushConfigured()` false,
semua fungsi web-push no-op — app web fully usable tanpa push.

**Kontrak payload backend untuk web** (FCM HTTP v1):

```json
{
  "message": {
    "token": "<token FCM Web dari register-device>",
    "notification": { "title": "Dana masuk", "body": "Rp500.000 dari @budi" },
    "data": { "referenceType": "ORDER", "referenceId": "abc123" },
    "webpush": { "headers": { "Urgency": "high" } }
  }
}
```

- `notification` → ditampilkan otomatis saat background; saat foreground
  ditampilkan oleh app (`subscribeWebPushMessages`).
- `data.referenceType`/`referenceId` → tujuan klik (daftar tipe di
  `lib/notification-routing.ts` + cerminnya di `fcm-sw.template.mjs` —
  update keduanya bila menambah tipe). `data.url` (path same-origin,
  mis. `/order/abc123`) boleh dipakai untuk override.
- Jangan kirim `notification` TANPA `data`: kliknya jatuh ke `/notifications`.

Batasan platform (bukan bug): Web Push butuh **HTTPS** (localhost OK untuk
dev); Safari iOS mendukung Web Push sejak 16.4 dan mewajibkan PWA terpasang
(Add to Home Screen) untuk notifikasi background — foreground tetap jalan di
tab biasa. `isSupported()` + `isSecureContext` di `getWebPushToken()`
menangani semuanya dengan mengembalikan `null`.

## 3. Checklist "push benar-benar berfungsi"

- [ ] Native: service account FCM V1 + APNs key terunggah ke EAS (§1).
- [ ] Native: build preview di HP fisik menerima notifikasi tes + tap
      membuka layar yang benar (cold start & warm).
- [ ] Web: 7 env Firebase terisi, SW 200 di produksi (§2).
- [ ] Web: setelah login di browser → izin diminta → kartu di Preferensi
      Notifikasi hilang (granted) → kirim tes via FCM API → notifikasi
      muncul → klik membuka path yang benar.
- [ ] Logout di tiap platform menghentikan notifikasi akun lama.
