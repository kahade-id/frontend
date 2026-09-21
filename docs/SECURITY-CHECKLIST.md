# Kahade — Security Checklist (release & hardening)

Dokumen ini menutup temuan audit `issues & improvement.md` yang **tidak bisa
diselesaikan murni di kode klien** — semuanya butuh aksi di backend, konsol
pihak ketiga, atau verifikasi runtime produksi. Centang & isi tanggal setiap
kali item dikerjakan; reviewer release wajib memeriksa dokumen ini sebelum
build store.

Status per 2026-09-21: semua item di bawah MASIH TERBUKA kecuali dinyatakan.

---

## 1. Proteksi layar sensitif (D-02)

**Sudah di klien (selesai):**
- [x] Android: `plugins/with-flag-secure.js` memasang `FLAG_SECURE` di
  MainActivity via `app.json` → screenshot & screen-recording diblokir di
  SELURUH app (standar mobile banking ID). Diverifikasi lewat
  `npx expo prebuild --platform android` (lihat `window.setFlags(…FLAG_SECURE…)`
  di `MainActivity.kt` hasil generate).

**Masih terbuka:**
- [ ] iOS: Apple tidak mengizinkan blokir capture — hanya DETEKSI
  (`UIScreen.main.isCaptured` + `capturedDidChangeNotification`). Butuh modul
  native (Swift) atau paket pihak ketiga; rencana: overlay peringatan saat
  rekaman layar terdeteksi di sheet PIN/KYC/backup codes.
- [ ] Keputusan produk bila nanti butuh screenshot marketplace: plugin
  menerima `{ "enabled": false }` per-build; granularitas per-layar butuh
  native module dengan toggle runtime (belum dibuat).

## 2. Firebase / push (D-07 + I-03)

`google-services.json` & `GoogleService-Info.plist` berisi API key yang
memang public-by-design — keamanannya bergantung pada pembatasan di konsol:

- [ ] Firebase Console → Project Settings → API keys: aktifkan **App Check**
  (Play Integrity untuk Android, DeviceCheck/App Attest untuk iOS).
- [ ] Batasi api key per platform/app (Android apps / iOS bundle id), bukan
  "unrestricted".
- [ ] FCM: pastikan sender id tidak dipakai proyek lain; aktifkan rate limit
  default Firebase + monitoring volume kirim.
- [ ] Web push (I-03): set `VAPID` env produksi di hosting (lihat
  `.env.example` baris 20–23) dan dokumentasikan di `docs/PUSH-NOTIFICATIONS.md`.
- [ ] Setelah selesai: isi tanggal + nama di sini dan tautkan bukti (screenshot
  konsol disimpan di drive release, bukan repo).

### Source of truth Firebase (I-09) — satu halaman, jangan menyebar

| Platform | Sumber konfigurasi | Lokasi | Boleh di git? |
| -------- | ------------------ | ------ | ------------- |
| Android native | `google-services.json` (1 client: `id.kahade`) | root repo | ya — API key public-by-design |
| iOS native | `GoogleService-Info.plist` | root repo | ya — idem |
| Web/PWA | env `EXPO_PUBLIC_FIREBASE_*` (appId web TIDAK ada di file json repo) | hosting env / `.env` lokal | nilai non-rahasia saja; VAPID private key TIDAK pernah ke klien |

Aturan: bila salah satu sumber berganti proyek Firebase, SEMUA baris tabel di
atas harus berganti bersamaan; `npm run check:push` memvalidasi `project_id`
native ↔ web tetap sama — pertahankan gate itu di CI.

## 3. CSRF & cookie web (D-13)

Klien web bergantung penuh pada cookie HttpOnly (`credentials: "include"` di
`lib/api/client.ts`); tidak ada header CSRF dari sisi app.

- [ ] Verifikasi produksi: `Set-Cookie` sesi harus `SameSite=Strict` (atau
  minimal `Lax` untuk cookie refresh) + `Secure` + `HttpOnly`.
- [ ] Verifikasi backend menolak mutasi cross-origin (cek header `Origin`).
- [ ] Bila SameSite tidak cukup (mis. kebutuhan SSO lintas subdomain):
  terapkan double-submit CSRF token; klien siap menambahkan header
  `X-CSRF-Token` di `lib/api/client.ts` bila kontrak diterbitkan.

## 4. Captcha (D-04 — akar di backend)

`captcha-slider` saat ini menerima `targetX` polos di respons generate, jadi
bot bisa menjawab tanpa interaksi (delay >800 ms saja cukup).

- [ ] Backend: ganti proof-of-work/gambar/provider (mis. hCaptcha/Turnstile);
  JANGAN kirim koordinat target di payload.
- [ ] Klien: `components/ui/captcha-slider.tsx` sudah diisolasi — integrasi
  provider baru hanya menyentuh komponen itu + `LoginDto.captcha*`.

## 5. Rate-limit OTP (B-14 — sisi server)

Klien sudah menutup vektor param-URL (`lib/otp-flow.ts`: `/verify-otp` tidak
lagi bisa dipakai standalone untuk memicu resend ke nomor korban).

- [ ] Backend: pastikan `POST /v1/auth/request-otp` & `/otp-trigger` dibatasi
  per IP + per nomor (contoh: 3/menit per nomor, 10/jam per IP) — verifikasi
  runtime dengan uji manual.

## 6. Dependensi (D-01/K-04)

**Sudah dikerjakan 2026-09-21:** `npm audit fix` (non-force) + `overrides`
di `package.json` (`decode-uri-component ^0.5.0`, `uuid ^11.1.1`,
`postcss ^8.5.23`) + vitest 5 → **27 kerentanan (19 moderate, 8 high) turun
menjadi 8 high dari SATU akar**: `image-size@1.2.1` via `metro@0.83.3`
(build-time only, input aset proyek sendiri). Override ke image-size v2
yang sudah dipatch MEMATAHKAN `build:web` (metro 0.83 memakai API
string-path yang dihapus v2) — diverifikasi, lalu dikembalikan. Pengecualian
sadar ini dijaga gate nightly `npm run audit:check`
(`scripts/check-audit.mjs`): temuan high/critical BARU = CI merah, dan
pengecualian yang basi wajib dihapus.

- [ ] Upgrade Expo SDK (≥55) begitu tersedia metro yang kompatibel
  image-size v2 → hapus pengecualian di `scripts/check-audit.mjs` →
  `npm audit` high/critical = 0 tanpa catatan.
- [ ] Renovate/Dependabot aktif di repo `kahade-id/frontend` (CI nightly
  `audit:check` sudah berjalan; bot update masih manual).
- [ ] Sebelum release store: tinjau `npm run audit:check` + tanggal
  `ditinjauTerakhir` tiap pengecualian.

## 7. Telemetry & crash reporting (D-03/D-06)

- [x] `lib/telemetry.ts` (logWarn/logError + ring buffer diagnostik) terpasang
  di alur kritis.
- [ ] Pasang crash reporter nyata (Sentry/Bugsnag) — `lib/telemetry.ts`
  dirancang sebagai titik sambung tunggal (`installTelemetry`).
- [ ] Sapu sisa `.catch(() => undefined)` menjadi `logWarn` bertahap per batch
  (dipantau via grep `catch(() =>`).

## 8. Rilis native & infrastruktur web (I-02 + I-04)

Klien sudah menyiapkan seluruh sisinya: `eas.json` memuat TODO kredensial
per langkah, `public/.well-known/*` adalah placeholder valid-JSON, dan
`npm run check:weblinks` menolak placeholder terisi nilai palsu.

- [ ] I-04 Android: akun Google Play Developer → `eas credentials
  --platform android` → Play App Signing → salin SHA-256 fingerprint ke
  `public/.well-known/assetlinks.json` (paket `id.kahade`).
- [ ] I-04 iOS: Apple Developer Program → distribution certificate +
  provisioning profile via `eas credentials --platform ios`; hapus
  `"simulator": true` di profil rilis; ubah `aps-environment` ke
  `production` di build store (saat ini `development`).
- [ ] I-02 Apple: isi Team ID + app id di
  `public/.well-known/apple-app-site-association` (universal links mati
  sampai ini terisi).
- [ ] CI produksi menolak placeholder: gate `check:weblinks` sudah
  memperingatkan; saat kredensial terisi, ubah peringatan menjadi error
  bila isi masih contoh (lihat `scripts/check-weblinks.mjs`).
- [ ] I-10/K-01: staging backend tersedia → jalankan `npm run verify:api`
  per deploy (register: `docs/audit/BACKEND-DEPENDENCIES.md`).

## 9. Uji perangkat fisik & consent retention (K-06)

Belum ada artefak hasil uji perangkat di repo; `docs/PERMISSIONS.md` tetap
matriks rencana. Jalankan matriks ini di Android fisik (min. 1 perangkat
API 34) + iOS bila perangkat tersedia, lalu simpan hasilnya (tanggal,
model, OS, hasil per permission) di drive release dan tautkan di sini.

- [ ] Kamera/QRIS: izin ditolak → UI fallback manual; izin dicabut di
  Settings → app tidak crash saat membuka scanner.
- [ ] Notifikasi: tolak izin → tab notifikasi tetap berfungsi; grant via
  deep-link Settings.
- [ ] FLAG_SECURE (D-02): screenshot & screen-recording benar-benar
  diblokir di layar PIN/KYC.
- [ ] Biometrik: enrolled & tidak enrolled; rotasi kunci perangkat.
- [ ] Deep link & App Links: `kahade://` + `https://kahade.id/order-link/…`
  membuka app terpasang (butuh item §8 lebih dulu).
- [ ] Consent retention server: konfirmasi backend menyimpan bukti consent
  KYC/privasi sesuai `docs/PERMISSIONS.md` (sisi server, bukan klien).

---

Format bukti: `[x]` + tanggal + inisial + tautan artefak (issue/ticket/screenshot
di drive release). Dokumen ini dirujuk oleh gate release di `.github` (bila CI
release ditambahkan) dan oleh `issues & improvement.md` (item D-01/D-02/D-04/
D-07/D-13/B-14/I-02/I-03/I-04/I-09/I-10/K-01/K-06 ditandai "client-complete +
external dependency"; dependensi backend murni ada di
`docs/audit/BACKEND-DEPENDENCIES.md`).
