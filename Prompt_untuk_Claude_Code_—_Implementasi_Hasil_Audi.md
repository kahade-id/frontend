# Prompt untuk Claude Code — Implementasi Hasil Audit Integrasi Backend–Frontend Kahade

Anda bekerja di repository Expo/React Native Kahade frontend:

```text
/home/ubuntu/work-frontend
```

Repository backend read-only snapshot untuk referensi kontrak tersedia di:

```text
/home/ubuntu/server-backend-src
```

## Konteks penting

Commit yang diaudit adalah:

```text
bf6858557a2bdfeea173e93b490ad94375b279d4
```

Frontend saat ini memiliki sekitar 86 screen dan 234 adapter calls. Pemeriksaan static API menemukan 0 adapter call yang memakai method/path tidak terdokumentasi. Jangan menganggap semua route backend yang tidak dipakai sebagai bug frontend. Setiap route harus diklasifikasikan sebagai salah satu dari:

1. **Missing user-facing feature** — memang perlu dihubungkan ke screen.
2. **Intentional alternate** — frontend memakai endpoint pengganti yang lebih tepat untuk mobile.
3. **Backend-only** — webhook, health, scheduler, atau internal transport.
4. **Stale contract** — backend dan mobile OpenAPI tidak sinkron.

Laporan audit lengkap tersedia di:

```text
/home/ubuntu/work-frontend/docs/audit/FULL-BACKEND-FRONTEND-AUDIT-2026-09-09.md
```

## Prioritas utama: perbaiki phone change

Backend menyediakan workflow keamanan:

```text
POST /v1/auth/phone-change/request
POST /v1/auth/phone-change/confirm
```

Controller backend menerima:

- nomor telepon baru,
- password saat ini,
- metode OTP,
- MFA code opsional,
- kode OTP konfirmasi.

Frontend saat ini salah karena `app/change-phone.tsx` langsung menjalankan:

```text
PUT /v1/users/me
{ phoneNumber, currentPassword }
```

Implementasikan workflow yang benar:

1. Tambahkan DTO/type yang diperlukan ke `lib/api/types.ts` melalui generator bila kontrak sudah diperbarui.
2. Tambahkan adapter typed di `lib/api/auth.ts` untuk request phone change dan confirm phone change.
3. Gunakan `auth: "required"` pada kedua request.
4. Tambahkan support untuk `deviceId` bila diwajibkan oleh server contract.
5. Ubah `app/change-phone.tsx` menjadi dua tahap: request OTP lalu confirm OTP.
6. Tampilkan cooldown/resend hanya bila backend menyediakan atau mengembalikan nilainya.
7. Jangan menyimpan OTP atau password ke persistent storage.
8. Tangani kode salah, expired, cooldown, rate limit, MFA required, dan session expired tanpa menjatuhkan screen.
9. Setelah berhasil, refresh profile dan arahkan kembali dengan pesan sukses.
10. Jangan lagi mengirim perubahan nomor melalui `PUT /v1/users/me`.

## Prioritas kedua: verifikasi fitur yang belum terhubung

Audit menemukan kandidat berikut. Jangan langsung mengimplementasikan semuanya. Verifikasi backend source, OpenAPI, dan UX sebelum coding.

### A. User availability

Route:

```text
GET /v1/users/availability?username=...
```

Cari apakah username validation di register/setup/edit profile memerlukan endpoint ini. Jika ya:

- tambahkan adapter typed,
- debounce request,
- batalkan request lama dengan AbortSignal,
- bedakan username kosong, invalid, taken, dan available,
- jangan menampilkan error network sebagai “username sudah dipakai”,
- tambahkan tests.

Jika tidak dibutuhkan oleh UX saat ini, dokumentasikan sebagai deferred feature, bukan dead code.

### B. User search

Route:

```text
GET /v1/users/search?q=...&page=...&limit=...
```

Bandingkan dengan:

- `GET /v1/search` untuk global users/orders/transactions,
- `GET /v1/users/discover` untuk discovery/filter,
- `GET /v1/wallet/transfer/lookup` untuk penerima transfer.

Tentukan apakah `/v1/users/search` memang diperlukan sebagai autocomplete user. Jika diperlukan, sambungkan hanya ke screen yang tepat. Jangan mengganti global search atau transfer lookup tanpa bukti kontrak.

### C. Devices versus sessions

Backend memiliki:

```text
GET /v1/sessions
DELETE /v1/sessions/{sessionId}
DELETE /v1/sessions/others
GET /v1/users/me/devices
DELETE /v1/users/me/devices/{deviceId}
PATCH /v1/users/me/devices/{deviceId}/trust
PATCH /v1/users/me/devices/{deviceId}/untrust
```

Frontend memakai `lib/api/sessions.ts` dan sebagian device trust endpoint. Audit dan satukan sumber kebenaran:

- tentukan apakah screen keamanan memakai session atau device;
- pastikan ID yang dihapus adalah ID yang dikembalikan endpoint yang sama;
- pastikan `current`, `trusted`, platform, browser, dan lastActiveAt dinormalisasi;
- jangan menghapus resource device memakai session ID tanpa bukti ekuivalensi;
- tambahkan contract tests untuk list, revoke, revoke-all, trust, dan untrust.

### D. Blocked users

Backend memiliki `GET /v1/users/me/blocked`, sementara frontend memakai `GET /v1/settings/blocked-users`. Bandingkan response dan policy. Pilih satu canonical endpoint untuk mobile dan dokumentasikan alternate endpoint bila memang legacy.

### E. Avatar/header upload

Backend menyediakan presigned `PUT /v1/users/me/avatar` dan `PUT /v1/users/me/header`, tetapi frontend memakai direct multipart plus confirm. Pertahankan direct upload bila itu keputusan resmi mobile. Jangan menambah presigned round trip hanya karena route backend ada. Pastikan:

- upload response `avatarKey/headerKey` dinormalisasi;
- confirm dijalankan bila key dikembalikan;
- `uploadUrl` dan `url` keduanya didukung bila presigned path tetap dipakai;
- URL object storage tidak dikirim dengan Bearer/cookie;
- error upload tidak menjatuhkan profile screen.

### F. Subscription benefits

Live GET audit mendapatkan `404` pada:

```text
GET /v1/subscriptions/benefits
```

Verifikasi apakah route benar-benar tersedia di backend deployment. Jika backend route belum dideploy:

- jangan membuat data dummy di frontend;
- buat benefits sebagai dependency nonfatal bila subscription screen masih dapat dirender;
- tampilkan fallback yang jujur;
- tambahkan issue/audit note yang menyebut deployment mismatch.

Jika route sudah tersedia tetapi response shape berbeda, tambahkan normalizer dan fixture.

### G. Wallet export

Frontend sudah memakai CSV/PDF export. Bandingkan dengan generic:

```text
GET /v1/wallet/export
```

Pilih endpoint canonical berdasarkan backend controller dan UX. Jangan membuat dua tombol yang melakukan fungsi sama.

### H. Public profile OG

Route:

```text
GET /v1/users/{username}/og
```

Jangan memanggilnya sebagai dependency wajib screen profile. Route ini kemungkinan untuk metadata/deep-link web. Hanya sambungkan bila ada requirement share preview atau web OG.

## Kontrak dan generator

Jika backend source memiliki route yang memang mobile-ready tetapi tidak ada di `docs/api/kahade-api-mobile.json`:

1. Tentukan apakah route itu user-facing dan aman untuk mobile.
2. Jika ya, update source generator/fixture, bukan hanya edit generated JSON secara manual.
3. Regenerate types dan constraints.
4. Jalankan:

```bash
npm run gen:api
npm run check:spec
npm run check:api
```

Jangan memasukkan webhook, health, admin, atau internal-only route ke mobile spec.

## Testing requirements

Tambahkan atau perbarui tests untuk:

- phone change request/confirm;
- wrong OTP, expired OTP, cooldown, rate limit, MFA required;
- username availability debounce dan cancellation;
- user search normalizer;
- device/session ID consistency;
- blocked-user endpoint choice;
- subscription benefits 404 nonfatal behavior;
- upload response `uploadUrl` versus `url`;
- public profile IDs: `userId → id`, `orderId → id`, `txId → id`;
- error boundary agar setiap response shape yang salah tidak menjatuhkan seluruh screen.

Gunakan redacted fixtures. Jangan commit token, password, cookies, access token, refresh token, atau response yang mengandung PII.

## Production safety

Jangan menjalankan POST, PUT, PATCH, atau DELETE terhadap production selama implementasi atau test otomatis kecuali ada fixture server lokal/mock. GET production boleh digunakan hanya untuk read-only verification dengan data yang sudah ada.

Jangan mengubah server backend. Jangan menghapus data. Jangan mengubah kredensial atau konfigurasi account.

## Acceptance criteria

Pekerjaan dianggap selesai hanya jika semua kondisi berikut terpenuhi:

1. `app/change-phone.tsx` memakai request/confirm OTP backend dan tidak lagi memakai direct phone mutation.
2. Semua operasi baru memiliki adapter typed dan response normalizer.
3. Fitur yang sengaja tidak diimplementasikan memiliki alasan klasifikasi di audit note.
4. Tidak ada adapter call yang keluar dari mobile OpenAPI tanpa keputusan dokumentasi.
5. `npm run typecheck` lulus.
6. `npm run lint` lulus.
7. `npm run check` lulus.
8. `npm test` lulus.
9. Test count dan file yang berubah dilaporkan.
10. Tidak ada secret atau production payload sensitif di diff.
11. Git diff hanya berisi perubahan yang berkaitan dengan audit.
12. Buat ringkasan final dengan tabel: perubahan, endpoint backend, screen caller, test, dan status.

## Workflow yang harus kamu ikuti

1. Baca audit report terlebih dahulu.
2. Buat matrix backend route → mobile spec → adapter → screen → test.
3. Implementasikan P0 phone-change terlebih dahulu.
4. Jalankan static checks dan tests.
5. Lakukan keputusan klasifikasi untuk kandidat P1.
6. Implementasikan hanya kandidat yang terbukti user-facing.
7. Jalankan semua checks lagi.
8. Tampilkan diff ringkas sebelum commit.
9. Jangan membuat OTA atau push ke GitHub dari prompt ini kecuali pengguna meminta release secara terpisah.

Berikan hasil akhir dalam format:

- Executive summary.
- Matrix fitur yang diimplementasikan.
- Matrix fitur yang sengaja tidak diimplementasikan beserta alasannya.
- Tests dan hasil checks.
- File yang berubah.
- Risiko tersisa dan rekomendasi lanjutan.
