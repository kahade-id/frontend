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

## 6. Dependensi (D-01)

- [ ] Jalankan `npm audit fix` (non-force) tiap sprint; `npm audit` level
  high/critical = 0 sebelum release.
- [ ] Renovate/Dependabot aktif di repo `kahade-id/frontend`.

## 7. Telemetry & crash reporting (D-03/D-06)

- [x] `lib/telemetry.ts` (logWarn/logError + ring buffer diagnostik) terpasang
  di alur kritis.
- [ ] Pasang crash reporter nyata (Sentry/Bugsnag) — `lib/telemetry.ts`
  dirancang sebagai titik sambung tunggal (`installTelemetry`).
- [ ] Sapu sisa `.catch(() => undefined)` menjadi `logWarn` bertahap per batch
  (dipantau via grep `catch(() =>`).

---

Format bukti: `[x]` + tanggal + inisial + tautan artefak (issue/ticket/screenshot
di drive release). Dokumen ini dirujuk oleh gate release di `.github` (bila CI
release ditambahkan) dan oleh `issues & improvement.md` (item D-02/D-04/D-07/
D-13/B-14/D-01 ditandai "client-complete + external dependency").
