# Audit Mendalam Endpoint & API — Kahade Mobile

**Tanggal audit:** 2026-09-09
**Sumber kontrak:** `docs/api/openapi.json` (export penuh backend) dan `docs/api/kahade-api-mobile.json` (subset mobile)
**Permukaan yang diaudit:** `lib/api/*` (24 modul adapter), `lib/api/client.ts` (transport), 86 layar di `app/`
**Cabang:** `arena/01a085e5-frontend` @ `9e93949`

> Semua angka di dokumen ini dihasilkan oleh perintah yang tercatat di [§8 Log verifikasi](#8-log-verifikasi).
> Tidak ada angka yang diperkirakan.

---

## 1. Ringkasan eksekutif

Kontrak **method + path** antara aplikasi dan backend **bersih total**: 238 pemanggilan
adapter, semuanya cocok dengan spec, 0 penyimpangan. Tooling repo
(`check:spec`, `check:api`, `check:retry`, `typecheck`, `lint`) lolos.

Yang **tidak** bersih adalah lapisan di bawahnya — **isi request, kontrak response,
metadata keamanan, dan metadata parameter** — karena `npm run check:api` memang
hanya membandingkan method + path (skrip itu sendiri mencetak
*"This is NOT authenticated endpoint verification"*). Audit ini menutup celah tersebut
dengan membandingkan **body, query, header, security, dan enum** per operasi.

Kolom **"Saat audit"** adalah kondisi ketika audit pertama dijalankan; kolom
**"Sekarang"** adalah kondisi setelah putaran perbaikan §10–§15. Keduanya
dibiarkan berdampingan supaya jelas apa yang berubah dan apa yang masih terbuka.

| Dimensi | Saat audit | Sekarang | Status |
|---|---|---|---|
| Path & method adapter vs spec | 238 / 238 cocok | 238 / 238 cocok | ✅ |
| Query key vs spec (type-resolved) | 1 penyimpangan (`sort` di `/v1/users/discover`) | **0** — `sort` dihapus (API-08) | ✅ |
| Interpolasi path tanpa `seg()` | 0 dari 94 | 0 | ✅ |
| `retry` pada mutasi non-GET | 0 | 0 | ✅ |
| Drift properti DTO spec ↔ `types.ts` | 0 dari 90 DTO yang cocok | 0 | ✅ |
| **Body request vs DTO spec** | **13 ketidakcocokan** | **0 pelanggaran**, 12 peringatan terjaga `check:api-body` | ⚠️ |
| **Response schema di spec** | **3 dari 260 operasi** | 3 dari 260 — **celah backend**, tak bisa ditutup dari klien | ❌ |
| **Kontrak error (4xx/5xx) di spec** | **0 operasi** | 0 — **celah backend** | ❌ |
| **Metadata `security` di spec** | 50 operasi kosong, 2 skema dangling | sama — **celah backend** | ❌ |
| **Header request terdokumentasi** | 0 dari 6 header yang dikirim | sama — **celah backend** | ❌ |
| Test otomatis (unit/e2e) | **0 berkas test** → `npm run check` gagal | **7 berkas / 76 test**, `npm run check` hijau | ✅ |
| Cakupan endpoint spec oleh aplikasi | 238 / 260 = 91,5 % *(salah hitung)* | **239 / 260 operasi unik = 91,9 %** (§13) | ⚠️ |
| Verifikasi terhadap backend hidup | **tidak dapat dijalankan** | tetap tidak dapat dijalankan (§7) | ⛔ |

**Temuan:** **5 S1** (API-01…05), **8 S2** (API-06…13), **9 S3** (API-14…22) —
total 22, ditambah **API-23** (§12.3) dan **API-24** (§15) yang ditemukan pada
putaran lanjutan.

> **Catatan koreksi.** Angka "7 S3" dan "238/260 = 91,5 %" pada versi awal
> ringkasan ini keliru; keduanya sudah dibetulkan (§13.1 menjelaskan sebabnya).
> Ringkasan ini juga sempat tertinggal dari §10–§15 karena semua perbaikan
> masuk di bagian akhir dokumen.

---

## 2. Permukaan yang diaudit

### 2.1 Skala kontrak

| Ukuran | Nilai | Sumber |
|---|---|---|
| Path di export penuh backend | **318** (364 operasi) | `docs/api/openapi.json` |
| Path admin yang dibuang | **93** | `gen-mobile-spec.mjs --check` |
| Path di spec mobile | **225** (260 operasi) | `docs/api/kahade-api-mobile.json` |
| Skema di `components` | **118** | spec |
| Pemanggilan adapter (`http.*`) | **238** | `audit-inventory --check` |
| Layar Expo | **86** dari 89 berkas sumber | `audit-inventory --check` |

### 2.2 Cakupan per domain (spec → aplikasi)

| Tag / domain | Operasi di spec | Dipanggil aplikasi | Tidak dipakai |
|---|---|---|---|
| users | 59 | 47 | 12 |
| orders | 31 | 31 | 0 |
| auth | 28 | 27 | 1 |
| wallet | 19 | 18 | 1 |
| disputes | 17 | 17 | 0 |
| notifications | 13 | 13 | 0 |
| settings | 10 | 9 | 1 |
| chat | 7 | 7 | 0 |
| subscriptions | 7 | 7 | 0 |
| referral | 6 | 6 | 0 |
| ratings | 6 | 6 | 0 |
| public | 6 | 6 | 0 |
| DeepLinks | 5 | 5 | 0 |
| transaction-templates | 5 | 5 | 0 |
| kyc | 4 | 4 | 0 |
| upload | 4 | 4 | 0 |
| bank-accounts | 4 | 4 | 0 |
| withdrawals | 4 | 4 | 0 |
| help-center | 4 | 4 | 0 |
| support | 4 | 4 | 0 |
| Health | 4 | 0 | 4 |
| sessions | 3 | 3 | 0 |
| vouchers | 3 | 3 | 0 |
| badges | 2 | 2 | 0 |
| Search | 2 | 2 | 0 |
| payments | 1 | 0 | 1 |
| config | 1 | 0 | 1 |
| app | 1 | 0 | 1 |
| **TOTAL** | **260** | **238** | **22** |

### 2.3 22 operasi spec yang tidak dipakai aplikasi — diklasifikasikan

| Kelas | Operasi | Penilaian |
|---|---|---|
| **Benar tidak dipakai** (server-to-server) | `POST /v1/payments/midtrans-webhook` | ✅ tepat — tidak boleh dipanggil klien |
| **Dipakai, tapi di luar jangkauan auditor** | `POST /v1/auth/refresh` | ⚠️ dipanggil `client.ts:refreshAccessToken()` lewat `exchange()` langsung, bukan `http.*` → tak terlihat `audit-inventory` (lihat **API-20**) |
| **Duplikat fungsional** (risiko drift) | `GET /v1/app/version` ↔ `GET /v1/public/app-version` (dipakai)<br>`GET /v1/config/exchange-rates` ↔ `GET /v1/public/exchange-rates` (dipakai)<br>`GET /v1/settings/blocked-users` ↔ `GET /v1/users/me/blocked` (dipakai)<br>`POST`/`DELETE /v1/users/{userId}/block` ↔ `POST`/`DELETE /v1/settings/block/{userId}` (dipakai)<br>`POST /v1/users/{userId}/report` ↔ `POST /v1/settings/report` (dipakai)<br>`GET /v1/users/search` ↔ `GET /v1/search` (dipakai)<br>`GET /v1/wallet/export` ↔ `GET /v1/wallet/export/csv` + `/pdf` (dipakai)<br>`GET`/`POST`/`DELETE /v1/users/{username}/saved` ↔ `GET /v1/users/saved` + `/v1/users/favorites` (dipakai)<br>`PUT /v1/users/me/avatar` + `/header` ↔ `POST /v1/users/me/avatar` + `/header` (dipakai) | ⚠️ **11 operasi** — dua jalur untuk fungsi yang sama; bila backend mengubah satu, yang lain diam-diam basi |
| **Fitur perangkat belum tersambung penuh** | `GET /v1/users/me/devices`, `DELETE /v1/users/me/devices/{deviceId}` | ⚠️ `PATCH …/trust` & `…/untrust` **sudah** dipakai (`sessions.ts:90,101`), tapi daftar & cabut perangkat tidak — layar Keamanan memakai `GET /v1/sessions` dan `DELETE /v1/sessions/{id}` sebagai gantinya |
| **SEO web saja** | `GET /v1/users/{username}/og` | ✅ wajar tidak dipanggil aplikasi |
| **Health probe** | `GET /v1/health`, `/internal-ready`, `/webhooks`, `/crons` | ⚠️ aplikasi tidak punya probe kesehatan/konektivitas sama sekali; `NETWORK` hanya diketahui setelah request gagal |

---

## 3. Temuan S1 — harus diperbaiki

### API-01 · `POST /v1/auth/2fa/backup-codes/regenerate` mengirim body yang tidak valid → 400

**Bukti spec:**
```
requestBody: RegenerateBackupCodesDto
  properties: { password (maxLength 72), code (minLength 6, maxLength 6) }
  required: ["password", "code"]
```
**Bukti kode:** `lib/api/auth.ts:449-452` mengirim `Setup2faDto` (hanya `password`);
`app/two-factor.tsx:250` memanggil `api.auth.regenerateBackupCodes({ password: regenPassword })`.
Komentar di `lib/api/auth.ts:448` (*"Spec memakai `Setup2faDto` (password) sebagai body regenerate"*)
dan header `app/two-factor.tsx:10` (*`regenerate { password } → { backupCodes }`*) keduanya
**tidak lagi benar** terhadap spec saat ini.

**Dampak:** validasi class-validator menolak dengan 400 → pengguna **tidak bisa** membuat ulang
kode cadangan. Gagalnya tepat di alur pemulihan 2FA, dan `setCodes(res?.backupCodes ?? [])`
tidak pernah terisi sehingga layar tetap kosong.

**Perbaikan:** tambahkan input kode TOTP 6 digit di panel regenerate (`app/two-factor.tsx`),
ubah signature menjadi `regenerateBackupCodes(dto: RegenerateBackupCodesDto)`, perbarui kedua komentar.
Bila backend ternyata memang hanya butuh `password`, yang salah adalah **spec** — putuskan satu arah
dan kunci dengan test (lihat API-05).

---

### API-02 · 4 endpoint auth mengirim field yang tidak dideklarasikan DTO

| Operasi | Field yang dikirim klien | Ada di DTO spec? |
|---|---|---|
| `POST /v1/auth/register` | `deviceId`, `deviceInfo` | ❌ keduanya tidak ada (`RegisterDto`: fullName, username, email, password, confirmPassword, phoneNumber, dateOfBirth, gender, referralCode, captchaId, captchaAnswer) |
| `POST /v1/auth/request-otp` | `deviceInfo` | ❌ (`RequestOtpDto`: phoneNumber, method, deviceId) |
| `POST /v1/auth/forgot-password` | `deviceId`, `deviceInfo` | ❌ (`ForgotPasswordDto`: email, captchaId, captchaAnswer) |
| `POST /v1/auth/reset-password` | `deviceId`, `deviceInfo` | ❌ (`ResetPasswordDto`: email, otp, newPassword, confirmPassword) |

Sumber: `lib/api/auth.ts:121-125` (`withDevice`) dipakai di `register` (baris 163),
`requestOtp`, `forgotPassword`, `resetPassword`.

**Pembanding penting:** `LoginDto` **memang** mendeklarasikan `deviceId` (**required**) + `deviceInfo`.
Artinya backend punya konsep identitas perangkat saat login, tetapi DTO registrasi/lupa-sandi tidak.

**Dampak — dua kemungkinan, keduanya buruk:**
1. `ValidationPipe` dengan `whitelist: true` → field **dibuang diam-diam**: perangkat tidak tercatat
   saat registrasi, sehingga sesi pertama tidak muncul di "Perangkat tepercaya" dan jejak keamanan
   (`/v1/users/me/security-log`) kehilangan konteks perangkat.
2. `ValidationPipe` dengan `forbidNonWhitelisted: true` → **400**: registrasi, minta OTP, lupa sandi,
   dan reset sandi **gagal total** di production.

**Perbaikan:** putuskan kontraknya. Rekomendasi: tambahkan `deviceId`/`deviceInfo` ke keempat DTO
(konsisten dengan `LoginDto`), lalu regenerasi spec. Alternatif: hentikan pengiriman field itu dari
`withDevice()` untuk endpoint yang DTO-nya tidak mendeklarasikannya.

---

### API-03 · 3 endpoint panggilan sengketa: spec mewajibkan body, klien tidak mengirim apa pun

| Operasi | `requestBody` di spec | Yang dikirim `lib/api/disputes.ts` |
|---|---|---|
| `POST /v1/disputes/{disputeId}/call/accept` | `required: true` → `CallActionDto` | `undefined` (baris 159) |
| `POST /v1/disputes/{disputeId}/call/reject` | `required: true` → `CallActionDto` | `undefined` (baris 165) |
| `POST /v1/disputes/{disputeId}/call/end` | `required: true` → `CallActionDto` | `undefined` (baris 171) |

**Preseden di repo sendiri:** cacat kelas ini **sudah pernah ditemukan dan diperbaiki** untuk
`POST /v1/upload/cleanup` — lihat komentar panjang di `lib/api/upload.ts:116-126`
(*"Versi lama mengirim `undefined` … backend yang memvalidasi `required` akan menolak dengan
400/415. Kirim objek kosong eksplisit agar sesuai kontrak."*). Ketiga endpoint sengketa adalah
pola yang sama persis dan **terlewat**.

**Dampak:** terima/tolak/akhiri panggilan video di dalam sengketa bisa gagal dengan 400/415 —
fitur eskalasi sengketa yang paling time-sensitive.

**Perbaikan:** kirim `{}` eksplisit (`http.post(path, {} as CallActionDto, …)`), sama seperti
`cleanupUploads()`. `CallActionDto` sendiri kosong di spec, jadi `{}` sudah sesuai kontrak.

---

### API-04 · `POST /v1/wallet/withdraw/cancel` — klien mengirim `txId`, spec tidak punya requestBody

**Bukti:** spec untuk operasi ini **tidak punya blok `requestBody` sama sekali**;
`lib/api/wallet.ts:335-339` mengirim `{ txId }`.

**Dampak:** ini endpoint **keuangan**. Bila backend membaca identitas penarikan dari sumber lain
(path/query/body tak terdokumentasi), ada risiko pembatalan menimpa penarikan yang salah — atau
sebaliknya `txId` diabaikan dan pembatalan selalu gagal. Apa pun yang terjadi, kontraknya tidak
terekam di satu-satunya dokumen yang dimiliki kedua tim.

**Perbaikan:** deklarasikan `CancelWithdrawDto { txId }` di backend dan regenerasi spec.
Sampai itu selesai, jangan mengubah perilaku klien.

---

### API-05 · Tidak ada satu pun berkas test → `npm run check` gagal

**Bukti:** `npm test` → `No test files found, exiting with code 1`.
`git ls-tree -r HEAD` tidak memuat berkas `*.test.*`/`*.spec.*` mana pun, dan tidak ada
`vitest.config.*` maupun `playwright.config.*`.

**Konsekuensi berantai:**
1. `npm run check` (baris `check` di `package.json`) **selalu merah** di langkah terakhir, sehingga
   seluruh sinyal di atasnya (typecheck, lint, tokens, a11y, screens, inventory, spec, api, weblinks,
   push) kehilangan artinya — tim akan terbiasa mengabaikan pipeline merah.
2. `scripts/gen-inventory.mjs:6` menyatakan `docs/audit/inventory.json` dipakai
   `tests/e2e/regression.spec.ts` — **berkas itu tidak ada**.
3. DevDependencies `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test` terpasang tetapi
   tidak dipakai.
4. Bug sekelas **API-01** (body tidak cocok DTO) tidak mungkin tertangkap tanpa test atau tanpa
   pemeriksa body — dan memang tidak tertangkap.

**Perbaikan (urutan termurah lebih dulu):**
1. Tambahkan pemeriksa statis **body vs DTO** ke `check:api` (logikanya sudah terbukti di audit ini:
   13 temuan). Ini menutup celah terbesar tanpa menulis satu pun test runtime.
2. Tambahkan test unit untuk lapisan murni yang sudah ada: `buildUrl`, `seg`, `unwrapResponse`,
   `readPage`, `parseErrorBody`, `resolveApiConfiguration`, `normalizeSession`.
3. Barulah e2e Playwright.

---

## 4. Temuan S2 — kontrak perlu diperbaiki

### API-06 · 257 dari 260 operasi tidak punya skema response

Hanya **3** operasi yang punya skema response: `GET /v1/health`, `GET /v1/health/webhooks`,
`GET /v1/health/crons`. Sisanya **257** hanya berisi `"200": { "description": "" }`.

Distribusi kode response di seluruh spec: **194 operasi → `200`**, **63 → `201`**, **3 → `200,503`**.

**Dampak:** `lib/api/*` terpaksa menulis normalizer defensif (`normalizeOrder`, `normalizeSession`,
`normalizeWallet`, `readList` dengan banyak kunci alternatif seperti `["securityLog","logs"]`,
`["users","profiles","saved"]`). Setiap kunci alternatif itu adalah tebakan terhadap bentuk response
yang tidak pernah didokumentasikan. Tidak ada cara memverifikasi apakah tebakan itu benar tanpa
backend hidup.

**Perbaikan:** mulai dari 10 endpoint paling banyak dipakai (`/v1/users/me`, `/v1/wallet`,
`/v1/wallet/transactions`, `/v1/orders`, `/v1/orders/{id}`, `/v1/notifications`, `/v1/chat/rooms`,
`/v1/sessions`, `/v1/subscriptions/status`, `/v1/kyc/status`) — tambahkan `@ApiResponse({ schema })`.

---

### API-07 · Tidak ada kontrak error sama sekali

**0** operasi mendokumentasikan response 4xx. Yang ada hanya `200`, `201`, dan `503` (health).
Tidak ada `error_code`, tidak ada skema `400/401/403/404/409/422/429`.

`lib/api/errors.ts:10-16` mengakui hal ini secara jujur:
*"docs/api/kahade-api-mobile.json TIDAK mendokumentasikan response error apa pun … Yang kita pegang
adalah format standar NestJS (`{ statusCode, message, error }`) karena spec ini dihasilkan oleh
@nestjs/swagger."*

**Dampak:** `codeFromStatus()` memetakan status → kode UI berdasarkan asumsi. Kode bisnis yang
benar-benar menentukan copy UI (mis. `SEARCH_INVALID_TYPES` yang disebut di `lib/api/search.ts:24`,
saldo tidak cukup, PIN salah, KYC belum lolos) tidak punya daftar resmi, sehingga UI tidak bisa
membedakan "PIN salah" dari "server error" secara andal.

**Perbaikan:** daftarkan kode error per operasi (minimal untuk auth, wallet, orders, kyc) dan
tambahkan skema `ErrorResponse`. `parseErrorBody` **sudah** membaca `code`/`errorCode`/`error_code`
ke `backendCode`, jadi backend hanya perlu mulai mengirimnya — tidak ada perubahan klien.

---

### API-08 · `GET /v1/users/discover`: klien mengirim `sort` yang tidak ada di spec

**Bukti:** `lib/api/users.ts:389-395` — `options: { page?, limit?, sort? }` dikirim apa adanya;
spec hanya mendeklarasikan `q, page, limit, minRating, minTransactions, isKycVerified, membershipRank`.

**Dampak:** bila backend memakai `whitelist` untuk query DTO, `sort` dibuang → urutan hasil Discover
tidak pernah berubah meski UI menawarkannya. Ini satu-satunya penyimpangan query dari 238 pemanggilan.

**Perbaikan:** tambahkan `sort` ke query DTO backend (dengan enum nilai yang diizinkan), atau hapus
dari `discoverUsers()`.

---

### API-09 · 36 operasi menandai **semua** query param `required: true` — termasuk yang jelas opsional

Total: **125 query param**, **85** di antaranya `required`, hanya **40** yang eksplisit opsional.
**36 operasi** menandai *seluruh* query param-nya wajib.

**Contoh konkret dengan dampak nyata** — `GET /v1/users/discover`:
```
q, page, limit, minRating, minTransactions, isKycVerified, membershipRank → SEMUA "required": true
```
Padahal `app/discover.tsx:33` memanggil `discoverUsers({ page, limit: 20 })` **tanpa `q`**.
Menurut kontrak tertulis, request layar Discover **tidak valid**.

**Penyebab umum:** DTO query NestJS tanpa `@IsOptional()` membuat `@nestjs/swagger` menandai semua
field wajib.

**Dampak:** spec tidak bisa dipakai untuk menghasilkan klien (openapi-generator akan memaksa semua
parameter), dan review kontrak menjadi tidak berarti — "required" tidak lagi membawa informasi.

**Perbaikan:** tambahkan `@IsOptional()` di DTO query backend; verifikasi ulang dengan
`gen:spec` lalu bandingkan angka 85/40 di atas.

---

### API-10 · Metadata `security` tidak lengkap dan ada skema dangling

| Fakta | Nilai |
|---|---|
| Operasi dengan blok `security` | 210 dari 260 |
| Operasi **tanpa** `security` | **50** |
| Pemakaian skema `access-token` | 208 operasi |
| Pemakaian skema **`bearer`** | **2 operasi** — `GET /v1/search`, `GET /v1/search/suggestions` |
| Skema yang didefinisikan di `components.securitySchemes` | `access-token`, `cookie` |
| Operasi yang memakai skema `cookie` | **0** |

**Dua cacat:**
1. **`bearer` tidak didefinisikan** di `components.securitySchemes`. Alat seperti openapi-generator
   dan sebagian validator akan menolak spec ini outright.
2. **`cookie` dideklarasikan tapi tak pernah dipakai**, padahal seluruh refresh bergantung pada
   cookie HttpOnly `kahade_refresh_token` (`lib/api/config.ts:REFRESH_COOKIE_NAME`,
   `credentials: "include"` di `client.ts`). Kontrak refresh tidak terdokumentasi di operasi mana pun.

**Operasi yang seharusnya protected tetapi tidak punya `security`** (dipilih yang paling berisiko):
`POST /v1/auth/2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/2fa/backup-codes/regenerate`,
`/2fa/request-disable-otp`, `/2fa/verify-login`, `POST /v1/auth/change-password`,
`/auth/logout`, `/auth/phone-change/request`, `/auth/phone-change/confirm`,
`/auth/set-username`, `/auth/correct-email`, `/auth/verify-password`, `GET /v1/auth/2fa/status`.

**Dampak di sisi klien:** karena spec tidak menandai operasi-operasi itu protected, adapter memakai
`auth` default `"optional"` (bukan `"required"`), artinya tidak ada refresh proaktif sebelum request
— setiap panggilan 2FA/password memulai dengan token yang mungkin sudah kedaluwarsa dan baru pulih
setelah 401 pertama. Bukan bug fatal (`client.ts` menangani 401 → refresh → ulang), tetapi menambah
satu round-trip dan satu peluang race pada alur sensitif.

**Perbaikan:** perbaiki `bearer` → `access-token` di dua operasi Search; tambahkan `security` ke
operasi protected; dokumentasikan `cookie` pada `POST /v1/auth/refresh` dan `POST /v1/auth/logout`.
Setelah itu, selaraskan `auth: "required"` di adapter.

---

### API-11 · 6 header wajib klien tidak terdokumentasi sama sekali

Spec mendeklarasikan **0** parameter `in: header`. Klien mengirim:

| Header | Di mana | Wajib? |
|---|---|---|
| `X-Device-Id` | `client.ts:deviceHeaders()` | ya, semua request |
| `X-Device-Info` | idem | ya |
| `X-App-Version` | idem | ya — dipakai server untuk gate versi minimum |
| `X-Platform` | idem | ya |
| `Idempotency-Key` | `client.ts:349-350`, semua non-GET | ya untuk mutasi |
| `X-Refresh-Token` | `client.ts:244`, hanya `/v1/auth/refresh` | opsional |

**Dampak paling serius: `Idempotency-Key`.** Seluruh jaminan anti-dobel pada mutasi keuangan
bergantung pada header yang tidak muncul di kontrak. Bila backend tidak membacanya (atau membaca
nama lain), tidak ada perlindungan terhadap pengiriman ganda — dan tidak ada dokumen yang
menyebutkannya.

**Perbaikan:** deklarasikan keenam header (minimal `Idempotency-Key` dan `X-App-Version`) sebagai
`parameters` di spec, idealnya lewat `@ApiHeader`/`addApiKey` global di NestJS.

---

### API-12 · Tidak ada penanganan `Retry-After` untuk 429

`lib/api/errors.ts:161` memetakan 429 → `RATE_LIMITED` dengan pesan tetap
*"Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."* Header `Retry-After` tidak pernah
dibaca (0 kemunculan di seluruh `lib/`).

**Dampak:** pada throttling OTP/login, UI tidak bisa menampilkan hitung mundur yang benar; pengguna
mencoba lagi terlalu cepat dan memperpanjang masa throttle.

**Perbaikan:** simpan `Retry-After` di `ApiError` (mis. `retryAfterMs`) dan pakai di
`<Countdown>` layar OTP/login.

---

### API-13 · 8 operasi duplikat + 2 endpoint perangkat menggantung

Lihat tabel §2.3. Risiko utamanya adalah **drift senyap**: dua jalur untuk satu fungsi berarti
perbaikan bug di satu jalur tidak otomatis berlaku di jalur lain, dan aplikasi bisa memakai jalur
yang sudah tidak dirawat.

**Perbaikan:** tandai 11 operasi duplikat sebagai `@deprecated` di backend (muncul sebagai
`deprecated: true` di spec), lalu tambahkan aturan di `check:api` yang menolak adapter memanggil
operasi ber-flag `deprecated`.

---

## 5. Temuan S3 — kebersihan & dokumentasi

| ID | Temuan | Bukti | Saran |
|---|---|---|---|
| **API-14** | **10 skema DTO kosong** di spec: `CallActionDto`, `CleanupFilesDto`, `CreateTemplateDto`, `UpdateTemplateDto`, `DisputeMessageDto`, `MutualResolutionProposeDto`, `MutualResolutionRespondDto`, `ReplyTicketDto`, `RefreshTokenDto`, `TrustDeviceDto` | `components.schemas[*].properties` = `{}` | Isi propertinya. Klien saat ini mengirim payload penuh ke DTO kosong — mis. `CreateTemplateDto` menerima 12 field dari klien (`id,name,role,title,description,orderType,orderValue,deliveryDeadlineDays,feeResponsibility,counterpartUsername,usageCount,lastUsedAt`) yang semuanya tak terdokumentasi |
| **API-15** | `CreateTicketDto` hanya mendeklarasikan `attachments`; klien mengirim `subject` + `message` | `lib/api/support.ts` vs spec | Tambahkan `subject`/`message` ke DTO |
| **API-16** | **28 skema admin** ikut terbawa ke spec mobile (`BanUserDto`, `WalletAdjustDto`, `CreateVoucherDto`, `AdminLoginDto`, …) dan **30 skema** tidak direferensikan path mana pun | keputusan terdokumentasi di `gen-mobile-spec.mjs` (*"Skema di components sengaja TIDAK dipangkas"*) | Terima sebagai keputusan sadar, atau pangkas skema yang tidak direferensikan path mobile |
| **API-17** | `.env.example` merujuk `docs/audit/OTA.md` yang **tidak ada** | `test -f docs/audit/OTA.md` → tidak ada | Tulis berkasnya atau hapus rujukannya |
| **API-18** | Komentar basi di skrip: `gen-mobile-spec.mjs:4` menulis *"313 path"* (aktual **318**); `verify-live-api.mjs:5` menulis *"231 pemanggilan adapter"* (aktual **238**) | bandingkan dengan output `gen:spec --check` dan `audit:inventory` | Perbarui angka, atau ganti dengan teks tanpa angka agar tidak basi lagi |
| **API-19** | `Idempotency-Key` dibuat **baru tiap percobaan** (`client.ts:349-350` berada di dalam `send()`), termasuk pada jalur 401 → refresh → kirim ulang. Backend tidak bisa mengorelasikan percobaan ulang dengan permintaan asal | `client.ts:335-380` | Pindahkan pembuatan kunci ke luar `send()` (satu kunci per panggilan logis) — aman karena mutasi tetap tidak di-`retry` otomatis (`check-retry` menjaganya) |
| **API-20** | **Blind spot tooling:** `audit-inventory.mjs` hanya memindai pemanggilan `http.*` di `lib/api/`. Dua jalur HTTP nyata tak terlihat: `refreshAccessToken()` (`exchange()` langsung) dan `uploadToPresignedUrl()` (`fetch()` langsung ke object storage) | `scripts/audit-inventory.mjs:28-45` | Tambahkan keduanya ke inventaris sebagai pengecualian eksplisit, agar "238 cocok" tidak terbaca sebagai "semua HTTP teraudit" |
| **API-21** | **121 dari 260 operasi tanpa `summary`** | spec | Lengkapi minimal di domain keuangan (wallet, orders, withdrawals, disputes) |
| **API-22** | **0 enum tingkat skema**; enum hanya ada di tingkat properti (**38 properti di 31 skema**). Tidak ada `nullable` sama sekali (**0 properti**), padahal klien defensif terhadap `null` di banyak normalizer | spec + `lib/api/*-contract.ts` | Tandai `nullable: true` pada field yang memang bisa null, agar normalizer tidak menebak |

---

## 6. Yang sudah benar (jangan diubah)

Temuan negatif yang diverifikasi sama pentingnya dengan temuan positif:

1. **0 pemanggilan adapter di luar spec.** 238/238 cocok method + path (`audit-inventory --check`).
2. **0 query key tak terdokumentasi** selain `sort` (API-08), dan **0 ketidakcocokan jumlah path
   param** — diverifikasi dengan TypeScript type-checker, bukan regex, termasuk 29 objek query dinamis.
3. **0 interpolasi path tanpa `seg()`** dari 94 pemanggilan berparameter. `seg()` sendiri menolak
   `""`, `"undefined"`, `"null"`, `"."`, `".."` lalu meng-encode — perlindungan path traversal nyata.
4. **0 `retry` pada mutasi non-GET** dari 74 pemanggilan ber-`retry`. Dijaga `check-retry.mjs` dengan
   alasan yang terdokumentasi baik (mutasi keuangan tidak idempoten di sisi klien).
5. **0 drift properti** antara 90 DTO spec dan `lib/api/types.ts` — termasuk kecocokan
   required/optional per field. Ini hasil yang sangat baik untuk codebase berukuran ini.
6. **19/19 kode metode pembayaran** di `lib/payment-methods.ts` cocok persis dengan gabungan enum
   `TopupDto.method` (18) dan `SubscribeDto.paymentMethod` (19, termasuk `KAHADE_WALLET`).
7. **Semua nilai enum spec muncul di source** aplikasi (38 properti enum dipindai terhadap 3,1 juta
   karakter source).
8. `typecheck` (`tsc --noEmit`) dan `lint` (`eslint .`) **bersih tanpa satu pun warning**.
9. **Transport aman:** `buildUrl()` menolak URL absolut/protokol-relatif sehingga kredensial tidak
   pernah bocor ke URL presigned; unggah presigned memakai `credentials: "omit"` dan memvalidasi
   HTTPS lewat `safeHttpsUrl()`; timeout unggah terpisah 60 s.
10. **Rahasia di tempat yang benar:** `lib/secure-storage.ts` memakai Keychain/Keystore dengan
    `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, dan di web sengaja **tidak** menyimpan token ke `localStorage`
    (hanya memori proses) — hanya preferensi non-rahasia yang persisten.
11. **Refresh single-flight + revision guard:** `refreshInFlight` per revisi sesi, `expireSession()`
    tidak memicu event kedaluwarsa untuk login baru, dan 429/offline/5xx tidak melogout pengguna.
12. **Dedupe GET** di-key dengan `getSessionRevision()` — tidak ada cache lintas akun.
13. **Polling bertanggung jawab:** `usePolling` menjadwalkan setelah selesai (tidak pernah tumpang
    tindih), berhenti saat layar tidak fokus/aplikasi latar. Interval: order 3 s (hanya saat QRIS
    belum final), topup 5 s, chat 8 s, unread 60 s.
14. **`resolveApiConfiguration`** menolak URL non-HTTPS, URL berkredensial, `/v1` di base, dan
    `localhost` di web — konfigurasi deployment tidak bisa salah secara diam-diam.

---

## 7. Verifikasi terhadap backend hidup — TIDAK DAPAT DIJALANKAN

Repo menyediakan `npm run verify:api` (`scripts/verify-live-api.mjs`, default GET-only dengan
BLOCKLIST untuk operasi merusak) untuk menutup celah *"This is NOT authenticated endpoint
verification"*. **Skrip itu tidak bisa dijalankan dari lingkungan audit ini** karena egress jaringan
diblokir:

```
curl  https://api.kahade.id/v1/health  →  curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL
node  fetch(...)                       →  fetch failed
python urllib                          →  TLS/SSL connection has been closed (EOF)
```

**Artinya, secara jujur:** seluruh temuan di dokumen ini adalah **audit kontrak statis** —
perbandingan spec ↔ kode. Yang **belum** terbukti dan membutuhkan backend hidup:
bentuk response sebenarnya (API-06), kode error sebenarnya (API-07), apakah
`forbidNonWhitelisted` aktif (menentukan apakah API-02 berakibat 400 atau kehilangan data),
dan apakah `Idempotency-Key` benar-benar dihormati (API-11).

**Cara menutupnya** (dari mesin dengan akses ke backend):
```bash
export KAHADE_API_URL=http://localhost:3000   # backend lokal, JANGAN production
node scripts/verify-live-api.mjs --out docs/audit/live-api.json
node scripts/verify-live-api.mjs --login <user> <pass> --allow=post --out docs/audit/live-api.json
```

---

## 8. Log verifikasi

Perintah yang benar-benar dijalankan di lingkungan audit, dan hasilnya:

| Perintah | Hasil |
|---|---|
| `npm ci` | EXIT=0, 639 paket |
| `npm run typecheck` (`tsc --noEmit`) | bersih, 0 error |
| `npm run lint` (`eslint .`) | bersih, 0 error |
| `npm run check:spec` | `Mobile spec sinkron: 225 path (buang 93 path admin).` |
| `npm run check:api` | `API inventory OK: 238 adapter calls match documented HTTP methods/paths; 86 screens inventoried.` + `check:retry OK` |
| `npm run check:inventory` | `gen-inventory: 85 route … OK` |
| `npm run check:weblinks` | `OK — 18 rute dinamis punya rewrite` |
| `npm run check:push` | `OK — konfigurasi native push siap` |
| `npm test` (`vitest run`) | **`No test files found, exiting with code 1`** |
| `npm run check` (pipeline penuh) | lolos sampai langkah terakhir, **gagal di `npm test`** |
| `npm run audit:inventory` | menulis `docs/audit/inventory.json` + `ROUTES.md` (86 layar, 238 adapter call) |
| Analisis AST khusus audit ini | body vs DTO (13), kehadiran body (3+1), query type-resolved (1), security vs `auth` (32), DTO vs `types.ts` (28 admin, 0 drift nyata) |

Analisis tambahan ditulis sebagai skrip TypeScript-compiler sekali pakai (di luar repo, tidak
di-commit) yang membaca `docs/api/kahade-api-mobile.json` dan `lib/api/*.ts` lewat
`ts.createProgram` — jadi perbandingan body/query memakai **tipe yang sudah di-resolve**, bukan regex.

---

## 9. Rencana perbaikan berurutan

**Gelombang 1 — hentikan pendarahan (perubahan kecil, risiko rendah)**
1. **API-03**: kirim `{}` di tiga endpoint `disputes/…/call/*` (3 baris, ada preseden di repo).
2. **API-01**: tambahkan input kode TOTP di regenerate backup codes + perbaiki 2 komentar basi.
3. **API-05 (langkah 1)**: tambahkan pemeriksa **body vs DTO** ke `check:api` — menutup celah yang
   meloloskan API-01/02/03/04, tanpa perlu test runtime.
4. **API-18, API-17**: perbaiki angka basi dan referensi `docs/audit/OTA.md`.

**Gelombang 2 — putuskan kontrak dengan tim backend**
5. **API-02**: putuskan nasib `deviceId`/`deviceInfo` di `RegisterDto`, `RequestOtpDto`,
   `ForgotPasswordDto`, `ResetPasswordDto` (cek lebih dulu apakah `forbidNonWhitelisted` aktif —
   itu menentukan apakah ini bug 400 atau bug kehilangan data).
6. **API-04**: deklarasikan `CancelWithdrawDto`.
7. **API-10**: perbaiki skema `bearer` dangling + lengkapi `security`.
8. **API-09**: `@IsOptional()` di DTO query.
9. **API-11**: deklarasikan `Idempotency-Key` + header perangkat di spec.

**Gelombang 3 — kualitas kontrak jangka panjang**
10. **API-06/07**: skema response untuk 10 endpoint teratas + katalog kode error.
11. **API-13**: tandai operasi duplikat `@deprecated` + tolak di `check:api`.
12. **API-05 (langkah 2-3)**: test unit lapisan murni, lalu e2e.
13. **API-12, API-19, API-22**: `Retry-After`, kunci idempotensi stabil, `nullable`.

---

*Dokumen ini dihasilkan oleh audit statis. Klaim tentang perilaku runtime backend ditandai eksplisit
sebagai belum terverifikasi di §7.*

---

## 10. Tambahan 2026-09-09 — bug runtime yang ditemukan & diperbaiki

Audit statis di atas membandingkan spec ↔ kode. Setelah laporan pengguna
("blokir & laporkan gagal dengan *user tidak tersedia*", "kirim uang harusnya bisa
tanpa KYC"), lapisan runtime ikut dibedah. Ternyata penyebabnya **bukan** di
path/method (yang memang bersih), melainkan di **asumsi klien terhadap bentuk
respons** dan **gerbang yang diciptakan klien sendiri tanpa dasar kontrak**.

| ID | Gejala yang dilihat pengguna | Akar penyebab | Perbaikan |
|---|---|---|---|
| **RUN-01** | Transfer tidak bisa memilih penerima siapa pun | `components/ui/transfer-recipient-picker.tsx:112` — `const disabled = recipient.kycVerified !== true`. `TransferDto` di spec **tidak** mensyaratkan KYC, dan `GET /v1/wallet/transfer/lookup` tidak punya skema respons, jadi `kycVerified` sering `undefined` → `!== true` → **semua** baris nonaktif tanpa pesan apa pun | Gerbang dihapus. KYC kini Badge informasi; baris selalu bisa dipilih; server yang memutuskan |
| **RUN-02** | "Tidak dapat bertransaksi / Pengguna ini tidak tersedia untuk transaksi dengan Anda" untuk **semua** lawan transaksi | `validateCounterpart` hanya me-*cast* respons. Bila backend mengirim `isValid`/`is_valid`/`{data:{…}}`, `res.valid` menjadi `undefined` → layar memetakannya ke state `blocked` | `normalizeCounterpartValidation()` di `lib/api/orders.ts`: banyak alias flag, buka pembungkus bersarang, **tidak pernah** menyimpulkan "diblokir" dari ketiadaan flag, hormati penanda blokir eksplisit, bedakan `notFound` vs `blocked` |
| **RUN-03** | Blokir & Laporkan gagal "user tidak tersedia" di halaman profil orang itu sendiri | Endpoint memakai `{userId}` sedangkan layar profil publik hanya pasti punya username; `profile.id` bisa kosong → `if (!profile?.id) return` (diam total) atau id tak dikenal → 404 | `pickUserId()` memindai `id`/`userId`/`_id` + satu tingkat sarang; `blockUser`/`unblockUser`/`reportUser` kini mencoba id lalu **username** bila 404 (aman: 404 = tidak ada data dibuat, laporan tidak ganda); `return` diam diganti toast yang menjelaskan |
| **RUN-04** | Seluruh layar list bisa mati dengan "Respons tidak dapat dibaca" | `readList()` melempar bila kunci koleksi tidak ada di daftar alias, padahal spec tidak mendokumentasikan bentuk respons list mana pun | Fallback ke **array pertama** yang bukan metadata (`meta`/`pagination`/…); tetap melempar bila tidak ada array — "kosong" tidak disulap jadi sukses |
| **RUN-05** | Toggle "Perangkat tepercaya" buntu: "Status perangkat belum tersedia" | `normalizeSession` hanya membaca `deviceId` dan `device.id` | Alias tambahan: `device.deviceId`, `userDeviceId` |

**Bug kontrak dari §3 yang ikut diperbaiki sekarang:**

- **API-01** — `regenerateBackupCodes` kini mengirim `{ password, code }` sesuai
  `RegenerateBackupCodesDto`; `app/two-factor.tsx` menambah input TOTP 6 digit
  (tombol baru aktif bila keduanya terisi).
- **API-03** — `POST /v1/disputes/{id}/call/accept|reject|end` mengirim `{}`
  eksplisit (spec: `requestBody.required: true`).
- **API-05** — 3 berkas test + `vitest.config.ts` ditambahkan: **36 test lolos**,
  `npm run check` kini **EXIT=0** (sebelumnya selalu gagal di `npm test`).
- **Celah tooling ditutup** — `scripts/check-api-body.mjs` baru, terpasang di
  `check:api` dan `check:api:soft`: membandingkan **body request vs DTO spec**
  lewat type-checker. Skrip inilah yang akan menangkap API-01/03/04 secara
  otomatis. `POST /v1/wallet/withdraw/cancel` didaftarkan sebagai
  `KNOWN_DEVIATION` beralasan (celah spec di sisi backend); entri itu otomatis
  dilaporkan usang begitu spec diperbaiki.

**Yang belum bisa diverifikasi** tetap sama (§7): egress jaringan diblokir, jadi
bentuk respons backend yang sebenarnya belum dikonfirmasi. Semua normalizer di
atas ditulis toleran terhadap banyak bentuk **justru** karena itu — dan masing-masing
dikunci test di `tests/`.

### Hasil verifikasi setelah perbaikan

```
npm run check  →  EXIT=0
  typecheck        bersih
  lint             bersih
  check:spec       Mobile spec sinkron: 225 path (buang 93 path admin)
  check:api        238 adapter calls match; check:retry OK;
                   check:api-body — 84 pemanggilan ber-DTO, 0 pelanggaran, 12 peringatan
  check:weblinks   OK — 18 rute dinamis
  check:push       OK
  npm test         3 berkas, 36 test lolos
```

---

## 11. Putaran kedua — sisa temuan yang bisa ditutup dari sisi klien

Dilanjutkan setelah putaran pertama. Fokusnya dua hal: menutup **kelas bug
RUN-02** di endpoint lain yang keputusannya dibaca UI, dan menutup temuan §4/§5
yang perbaikannya memang berada di frontend (bukan di backend).

### 11.1 Kelas RUN-02 di endpoint lain — semua sudah dinormalisasi

Pola yang sama: respons di-*cast*, UI membaca satu field, nama field berbeda →
keputusan salah. Ditutup dengan helper bersama `readVerdict()` di
`lib/api/response.ts` (banyak alias flag + fallback eksplisit + buka pembungkus
`data`/`result`).

| Endpoint | Field yang dibaca UI | Akibat sebelum diperbaiki | Fallback |
|---|---|---|---|
| `POST /v1/vouchers/validate` | `res.valid` | voucher valid selalu "tidak berlaku" | `false` |
| `POST /v1/wallet/verify-pin` | `res.valid === false` | **PIN salah lolos sebagai benar** | `false` |
| `POST /v1/auth/verify-password` | `res.valid === false` | re-auth aksi sensitif lolos dengan password salah | `false` |
| `GET/POST/DELETE /v1/users/{username}/favorite` | `r?.favorited` | ikon favorit selalu kosong → pengguna menekan lagi dan malah membatalkan | sesuai aksinya |
| `GET /v1/orders/{id}/payment-status` | `res.status` | polling 3 detik tidak pernah berhenti, layar tidak tahu pembayaran sudah masuk | `"PENDING"` |
| `POST /v1/wallet/withdraw/resend-otp` | (di-`await` saja) | HTTP 200 dengan `{ success: false }` (cooldown belum lewat) tetap diklaim "OTP dikirim ulang" — pengguna menunggu OTP yang tidak datang | `true` |

Sapuan terakhir mengonfirmasi **tidak ada lagi** adapter yang me-*cast* respons
ber-field boolean/enum tanpa normalizer: dari 238 pemanggilan, tersisa 0
(sebelumnya 6).

Arah fallback sengaja **tidak seragam** dan itu keputusannya: untuk gerbang
keamanan (PIN, password, voucher) fallback-nya `false` — bentuk respons tak
dikenal tidak boleh meloloskan verifikasi. Untuk favorit fallback-nya mengikuti
aksi, supaya keadaan UI tidak berbalik sendiri.

### 11.2 Temuan §4/§5 yang ditutup di frontend

| ID | Perbaikan |
|---|---|
| **API-19** | `Idempotency-Key` kini dibuat **satu kali per panggilan logis** di `performRequest`, bukan di dalam `send()`. Jalur 401 → refresh → kirim-ulang memakai kunci yang **sama**, sehingga backend bisa mengenali keduanya sebagai satu permintaan — persis gunanya kunci ini pada mutasi keuangan. GET tetap tanpa kunci. Dikunci test. |
| **API-12** | `Retry-After` dibaca untuk 429/503 → `ApiError.retryAfterMs`. Parser menangani **kedua** bentuk sah RFC 9110 (delta-detik dan tanggal HTTP), dibatasi 24 jam. Sebelumnya 0 kemunculan di seluruh `lib/`. |
| **API-08** | Opsi `sort` dihapus dari `discoverUsers()` — tidak pernah dikirim layar mana pun dan tidak ada di spec. |
| **API-17** | Rujukan `docs/audit/OTA.md` yang tidak ada dihapus dari `.env.example`, diganti kalimat yang menjelaskan syaratnya langsung. |
| **API-18** | Angka basi di komentar skrip dihapus (`313 path`, `231 pemanggilan adapter`) — diganti kalimat tanpa angka supaya tidak basi lagi tiap spec berubah. |

### 11.3 Yang TIDAK diubah, dan alasannya

- **API-02** (klien mengirim `deviceId`/`deviceInfo` ke DTO yang tidak
  mendeklarasikannya). **Sengaja dibiarkan.** Menghapusnya berisiko memutus
  pencatatan perangkat bila backend ternyata membacanya tanpa mendokumentasikan;
  mempertahankannya tidak mengubah perilaku apa pun yang hari ini bekerja —
  dan registrasi memang tidak dilaporkan bermasalah, yang berarti backend
  memakai `whitelist` (membuang), bukan `forbidNonWhitelisted` (menolak).
  Tetap tercatat sebagai pekerjaan backend, dan `check:api-body` menampilkannya
  sebagai peringatan setiap kali dijalankan.
- **API-04, API-06, API-07, API-09, API-10, API-11, API-13, API-14, API-15,
  API-16, API-21, API-22** semuanya berada di sisi **backend** (spec/DTO/
  skema respons/metadata). Tidak ada perubahan frontend yang bisa menutupnya
  tanpa menebak; menebak justru yang menyebabkan bug di §10.

### 11.4 Hasil verifikasi akhir

```
npm run check  →  EXIT=0
  typecheck      bersih
  lint           bersih
  check:spec     Mobile spec sinkron: 225 path (buang 93 path admin)
  check:api      238 adapter calls match; check:retry OK;
                 check:api-body — 84 pemanggilan ber-DTO, 0 pelanggaran, 12 peringatan
  check:weblinks OK — 18 rute dinamis
  check:push     OK
  npm test       6 berkas, 66 test lolos
```

Test yang ada: `tests/counterpart-validation.test.ts` (11),
`tests/response-helpers.test.ts` (16), `tests/user-identity.test.ts` (9),
`tests/verdict-responses.test.ts` (16), `tests/idempotency-key.test.ts` (4),
`tests/security-gates.test.ts` (10) — yang terakhir mengunci arah fallback
gerbang keamanan: PIN, password re-auth, dan status favorit.

Verifikasi tambahan: `npm run build:web` (expo export --platform web) sukses
**EXIT=0**, jadi perubahan ini terbukti tidak memutus bundling/runtime-import.

### 11.5 Ringkasan dampak terhadap keluhan pengguna

| Keluhan | Status |
|---|---|
| "Blokir user tidak bisa, alasannya user tidak tersedia" | **Diperbaiki** (RUN-03) — id lalu username, plus pesan jelas bila keduanya tak ada |
| "Laporkan tidak bisa di halaman user itu sendiri" | **Diperbaiki** (RUN-03) — `targetId` diisi `profile.id \|\| username`, adapter punya jalur cadangan |
| "Kirim uang harusnya bisa tanpa KYC" | **Diperbaiki** (RUN-01) — gerbang KYC di pemilih penerima dihapus; KYC jadi informasi |
| "Banyak endpoint tidak sama dengan backend" | **Diperbaiki untuk 11 titik** (RUN-01…05 + 6 normalizer verdict); sisanya celah **spec backend** yang tercantum di §3–§5 dan tidak bisa ditutup dari frontend tanpa menebak |
| "Masih banyak yang error" | **Dipersempit**: 0 adapter tersisa yang me-*cast* respons ber-field keputusan; `check:api-body` kini menjaga kontrak body di CI |

---

## 12. Putaran ketiga — parameter query yang ditandai `required` di spec

**Sumbu audit:** spec menandai 36 operasi dengan setidaknya satu query param
`required: true`. Sebuah sweep AST membandingkan setiap pemanggilan adapter
dengan daftar `required` operasi yang ditujunya, memakai tipe yang di-*resolve*
TypeScript (bukan teks mentah), sehingga `query` yang di-*spread* dari sebuah
objek tetap terbaca.

**Hasil: 9 pemanggilan berisiko, dan 8 di antaranya BUKAN bug.**

### 12.1 Bukti bahwa `required` pada query tidak ditegakkan backend

Semua parameter `required` itu **tidak punya `default`** di spec. Namun
`discoverUsers` (`lib/api/users.ts`) hanya mengirim `{ page, limit }`, padahal
`GET /v1/users/discover` menandai **tujuh** param sebagai wajib — termasuk `q`,
yang justru tidak boleh dikirim karena layar Discover adalah daftar *blusukan*,
bukan hasil pencarian. Layar itu berfungsi di produksi.

Kesimpulan: `required` pada query adalah artefak DTO NestJS tanpa `@IsOptional()`
(sama seperti API-09), bukan kontrak yang ditegakkan. Karena itu mayoritas
temuan di bawah **sengaja tidak diubah**.

### 12.2 Tiga "perbaikan" yang justru akan menjadi regresi

| Endpoint | Param wajib tak dikirim | Mengapa TIDAK diubah |
|---|---|---|
| `GET /v1/users/me/blocked` | `page`, `limit` | `app/blocked-users.tsx` memakai `useApiQuery` **tanpa** `LoadMore`/`onEndReached` — sekali muat. Menyisipkan `limit: 20` akan **memotong** daftar blokir yang hari ini tampil penuh. |
| `GET /v1/users/favorites` | `page`, `limit` | Sama: `app/favorites.tsx` tanpa paginasi. |
| `GET /v1/support/tickets` | `page`, `limit` | Sama: `app/support.tsx` tanpa paginasi. |

Ini keputusan yang disadari: menambahkan `limit` memenuhi huruf spec tetapi
merusak perilaku nyata. Keduanya tidak bisa dilakukan bersamaan tanpa
menambahkan UI paginasi, dan itu di luar cakupan audit endpoint.

Yang juga sengaja dibiarkan:

- `GET /v1/wallet/topup-history` & `/withdraw-history` — `from`/`to` wajib tak
  dikirim. Berbeda dengan `getWalletTransactions`, kedua endpoint ini **tidak**
  punya batas rentang 90 hari yang terdokumentasi, jadi mengarang tanggal
  `from`/`to` akan menyaring riwayat pengguna tanpa dasar.
- `GET /v1/users/{username}/ratings` — `filter` sengaja dihilangkan saat
  `ratingFilter === "all"`; komentar di `lib/api/ratings.ts:71-73` mencatat
  produksi **menolak** `all` dan `with_comment`. Mengirimnya akan merusak.
- `GET /v1/wallet/transactions` — `type` dihilangkan saat `"ALL"` dengan alasan
  yang sama.

### 12.3 Satu-satunya perubahan (API-23)

`getSearchSuggestions` (`lib/api/search.ts`) mengirim `q` saja, padahal spec
menandai `q` **dan** `limit` wajib. Saudaranya di berkas yang sama,
`globalSearch`, sudah mengirim `limit: 20` untuk endpoint sejenis — jadi
selisihnya tidak disengaja. Disamakan: `query: { limit: 20, ...query }`, dengan
`limit` tetap bisa ditimpa pemanggil.

Berbeda dari tiga kasus di atas, di sini tidak ada daftar yang terpotong:
`app/search.tsx:126` merender saran sebagai daftar chip yang memang pendek, dan
batas 20 mengikuti konvensi `globalSearch` di sebelahnya.

### 12.4 Verifikasi putaran ketiga

```
npm run typecheck   → EXIT=0
npm run lint        → EXIT=0
npm run check       → EXIT=0 (6 berkas / 66 test)
npm run build:web   → EXIT=0
```

---

## 13. Putaran keempat — koreksi angka cakupan & 21 operasi tak-terpakai

### 13.1 Angka cakupan sebelumnya SALAH, dan ini sebabnya

Laporan ini semula menulis **"238 / 260 = 91,5 %"**. Angka itu keliru dua kali:

1. **Mencampur satuan.** `238` adalah jumlah *pemanggilan* `http.*` di `lib/api/`
   (angka yang dicetak `npm run check:api`), sedangkan `260` adalah jumlah
   *operasi unik* di spec. Keduanya bukan pembilang dan penyebut dari hal yang
   sama.
2. **Melewatkan satu endpoint yang benar-benar dipakai.** `POST /v1/auth/refresh`
   tercatat "tak terpakai" karena sweep hanya membaca literal string di tempat
   pemanggilan. Jalur itu sebenarnya disimpan di konstanta
   `REFRESH_PATH = "/v1/auth/refresh"` (`lib/api/client.ts:243`) dan dipakai
   sebagai `exchange(REFRESH_PATH, buildUrl(REFRESH_PATH), { method: "POST" })`
   (baris 259-263).

**Angka yang benar: 239 operasi unik dari 260 = 91,9 %.**

Dua jebakan teknis yang membuat perhitungan pertama meleset, keduanya sudah
diperbaiki dan perlu diingat bila sweep ini diulang:

- **Urutan normalisasi.** `${seg(id)}` harus diubah jadi `{}` **lebih dulu**,
  baru `{…}` → `{}`. Bila terbalik, hasilnya `${}` (sisa tanda `$`) dan
  pemanggilan itu gagal dicocokkan — sweep pertama melaporkan **70 panggilan di
  luar spec**, semuanya palsu. `scripts/audit-inventory.mjs:44` melakukan
  `.replace(/\$\{[^}]+\}/g,"{}")` sebelum `normalize()`, dan urutan itu yang
  dipakai ulang di sini.
- **Pencocokan harus sadar-metode.** Sweep pertama mencocokkan path tanpa metode,
  sehingga `PUT /v1/users/me/avatar` sempat ditandai "dipanggil" — padahal klien
  hanya memanggil **`DELETE`** di path itu (`lib/api/users.ts:172`). Tanpa
  metode, `DELETE` dan `PUT` pada path yang sama tertukar.

Verifikasi silang: sweep yang sudah diperbaiki menghitung **238** pemanggilan
`http.*` di `lib/api/` — persis angka yang dicetak `npm run check:api` — dan
**0** pemanggilan di luar spec.

### 13.2 Klasifikasi 21 operasi tak-terpakai

Tidak ada fitur yang hilang. Setiap operasi punya penjelasan:

**A. Bukan urusan klien (6).**

| Operasi | Alasan |
|---|---|
| `GET /v1/health`, `/health/crons`, `/health/internal-ready`, `/health/webhooks` | Probe infra/orkestrator. |
| `POST /v1/payments/midtrans-webhook` | Dipanggil Midtrans, server-to-server. |
| `GET /v1/users/{username}/og` | Gambar Open Graph untuk pratinjau tautan; diambil crawler media sosial, bukan aplikasi. |

**B. Klien memakai padanan yang berbeda (15).**

| Operasi tak-terpakai | Padanan yang dipakai klien |
|---|---|
| `POST /v1/users/{userId}/block` | `POST /v1/settings/block/{identifier}` — `settings.ts:107` |
| `DELETE /v1/users/{userId}/block` | `DELETE /v1/settings/block/{identifier}` — `settings.ts:115` |
| `POST /v1/users/{userId}/report` | `POST /v1/settings/report` — `settings.ts:125` |
| `GET /v1/settings/blocked-users` | `GET /v1/users/me/blocked` — `settings.ts:48` |
| `GET /v1/users/search` | `GET /v1/search` — `search.ts:23` |
| `GET /v1/app/version` | `GET /v1/public/app-version` — `public.ts:24` |
| `GET /v1/config/exchange-rates` | `GET /v1/public/exchange-rates` — `public.ts:40` |
| `GET /v1/wallet/export` | `GET /v1/wallet/export/csv` + `/export/pdf` — `wallet.ts:447,457` |
| `GET /v1/users/me/devices` | `GET /v1/sessions` — `sessions.ts:81` |
| `DELETE /v1/users/me/devices/{deviceId}` | `DELETE /v1/sessions/{sessionId}` — `sessions.ts:86` |
| `GET /v1/users/{username}/saved` | `GET /v1/users/{username}/favorite` — `users.ts:531` |
| `POST /v1/users/{username}/saved` | `POST /v1/users/{username}/favorite` — `users.ts:537` |
| `DELETE /v1/users/{username}/saved` | `DELETE /v1/users/{username}/favorite` — `users.ts:543` |
| `PUT /v1/users/me/avatar` | `POST /v1/users/me/avatar/direct` + `/confirm`, `DELETE /v1/users/me/avatar` — `users.ts:147,160,172` |
| `PUT /v1/users/me/header` | `POST /v1/users/me/header/direct` + `/confirm`, `DELETE /v1/users/me/header` — `users.ts:203,212,222` |

Catatan yang layak diteruskan ke tim backend: keberadaan **dua** jalur untuk
block/report/saved/avatar (`/v1/users/...` dan `/v1/settings/...` atau
`/direct`+`/confirm`) adalah duplikasi permukaan API. Klien konsisten memakai
satu sisi, jadi tidak ada cacat — tetapi duplikasi itu menambah peluang kedua
sisi berperilaku berbeda tanpa terlihat.

### 13.3 Verifikasi putaran keempat

Putaran ini **tidak mengubah kode aplikasi**; yang berubah hanya angka dan
penjelasan di laporan ini. Verifikasi tetap dijalankan penuh:

```
npm run check       → EXIT=0 (6 berkas / 66 test)
npm run check:api   → 238 pemanggilan cocok, 0 di luar spec
```

---

## 14. Putaran kelima — satu perubahan audit ini sendiri DIKOREKSI

Bagian ini mencatat cacat pada **pekerjaan audit ini**, bukan pada kode aplikasi.
Perlu ditulis karena commit `8173df3` sudah terlanjur memuat klaim yang salah.

### 14.1 Klaim yang salah

Commit `8173df3` ("fix(subscriptions): tolak kode metode pembayaran di luar
enum SubscribeDto") menambahkan penjaga enum di `app/subscriptions.tsx` dengan
alasan:

> "Cast `as` melewati type-check tanpa memeriksa apa pun, jadi satu kode di luar
> enum membuat request 400 dan pengguna hanya melihat pesan validasi NestJS
> mentah di langkah PIN."

**Klaim itu salah di dua titik**, dan keduanya terbukti lewat test:

1. **Request tidak pernah mencapai backend.** `subscribe()` memanggil
   `assertDtoConstraints(dto, API_CONSTRAINTS.SubscribeDto)` sebagai baris
   pertamanya (`lib/api/subscriptions.ts:88`), dan helper itu memang
   memvalidasi enum (`lib/financial.ts:50`). Nilai di luar enum melempar
   `ApiError` **secara sinkron** — test memastikan `fetch` tidak terpanggil
   sama sekali.
2. **Pesannya sudah bahasa Indonesia.** `ApiError` itu membawa
   `"Isian paymentMethod tidak sesuai ketentuan layanan."`, dan
   `app/subscriptions.tsx` merendernya lewat `userMessage(err)`
   (`lib/api/errors.ts:196-207`). Tidak ada body NestJS mentah yang muncul.

Selain itu penjaga tersebut **tak terjangkau**: daftar metode sudah disaring
terhadap enum yang sama saat data dimuat (`app/subscriptions.tsx:155-157`), dan
`methodId` hanya bisa diisi dari daftar tersaring itu — baik lewat `useEffect`
pemilih awal (baris 207-211) maupun `onChange` `PaymentMethodSelector`
(baris 403).

### 14.2 Yang dilakukan

Penjaga redundan itu **dicabut**. Cast `as SubscribeDto["paymentMethod"]`
dipertahankan (memang aman), disertai komentar yang menjelaskan mengapa tidak
boleh ditambah penjaga di situ — agar pola yang sama tidak diulang.

Perilaku yang *sesungguhnya* melindungi alur ini sekarang dikunci di
`tests/api-contract-guards.test.ts` (10 test), termasuk sifat yang paling mudah
regresi: `subscribe()` melempar **sinkron**, bukan mengembalikan promise yang
*reject*. Versi pertama test itu sendiri salah di titik ini — memakai
`.rejects`/`.catch()` pada fungsi non-`async` — dan baru benar setelah
diganti `expect(() => …).toThrow()`.

### 14.3 Pelajaran yang berlaku untuk seluruh audit ini

Dua perubahan lain pada putaran yang sama lolos tanpa koreksi, tapi keduanya
sempat hampir salah dengan cara yang serupa:

- `getSearchSuggestions` menambah `limit: 20`. Aman karena `app/search.tsx:126`
  merender saran sebagai chip pendek dan `globalSearch` di sebelahnya sudah
  memakai batas yang sama — **bukan** karena spec menandainya wajib.
- Tiga layar (`blocked-users`, `favorites`, `support`) sengaja **tidak** diberi
  `page`/`limit` walau spec menandainya wajib (§12.2), karena ketiganya tanpa
  paginasi dan batas itu akan memotong daftar yang hari ini tampil penuh.

Polanya: **"spec menandai X wajib" bukan alasan untuk mengirim X.** Yang
menentukan adalah apakah backend menegakkannya dan apa efeknya pada layar.

### 14.4 Verifikasi putaran kelima

```
npm run typecheck   → EXIT=0
npm run lint        → EXIT=0
npm run check       → EXIT=0 (7 berkas / 76 test)
npm run build:web   → EXIT=0
```

---

## 15. Putaran keenam — API-24: tiket dukungan bisa terkirim tanpa isi

### 15.1 Temuan

`check:api-body` melaporkan 12 peringatan. Lima di antaranya berjenis
`EXTRA_FIELD`; empat sudah tercakup API-02 (field perangkat di alur auth).
Yang kelima **belum pernah dicatat** dan lebih berbahaya:

| Operasi | Dikirim klien | DTO di spec |
|---|---|---|
| `POST /v1/support/tickets` | `subject`, `message`, `attachments` | `CreateTicketDto` = **hanya** `attachments` |
| `POST /v1/support/tickets/{ticketId}/reply` | `message` | `ReplyTicketDto` = **`{}` kosong** |

Sumber: `lib/api/support.ts:43` (create) dan `:51` (reply); pemanggil di
`app/contact.tsx:36-37` dan `app/support/[ticketId].tsx:55`.

### 15.2 Mengapa ini lebih parah dari API-02

API-02 kehilangan `deviceId`/`deviceInfo` — data pelengkap. Di sini yang
terancam adalah **isi tiket itu sendiri**. Dua kemungkinan, dan keduanya buruk:

- **`forbidNonWhitelisted` aktif** → `400`. Pembuatan tiket mati total.
- **`whitelist` aktif tanpa `forbid`** → `subject` dan `message` **dibuang
  diam-diam**. Tiket tetap terbuat, `app/contact.tsx:41` tetap menampilkan
  *"Tiket terkirim"*, pengguna menganggap keluhannya tersampaikan — padahal tim
  dukungan menerima tiket kosong.

Skenario kedua adalah **kehilangan data tanpa gejala**. Untuk `reply` lebih
parah lagi: `ReplyTicketDto` benar-benar kosong, jadi seluruh isi balasan
bergantung pada field yang tidak dideklarasikan spec sama sekali.

### 15.3 Yang sengaja TIDAK dilakukan

**`subject`/`message` tidak dihapus dari body.** Menghapusnya akan *menjamin*
tiket kosong — memperburuk satu-satunya skenario yang berbahaya. Klien
mengirimnya, dan itu pilihan yang benar; yang salah adalah spec-nya.

Ini tidak bisa ditutup dari sisi klien tanpa menebak bentuk DTO yang sebenarnya,
dan menebak adalah penyebab bug §10. Yang dibutuhkan adalah konfirmasi backend:

1. Apakah `CreateTicketDto` seharusnya punya `subject` + `message`?
2. Apakah `ReplyTicketDto` seharusnya punya `message`?
3. Apakah validasi global memakai `whitelist` saja atau `whitelist` +
   `forbidNonWhitelisted`? (Jawaban ini sekaligus menutup API-02.)

Sampai terjawab, celah ini tetap tampil sebagai peringatan `EXTRA_FIELD` setiap
`npm run check:api:body` dijalankan.

### 15.4 Verifikasi putaran keenam

```
npm run check           → EXIT=0 (7 berkas / 76 test)
npm run check:api:body  → 84 pemanggilan, 0 pelanggaran, 12 peringatan
npm run build:web       → EXIT=0
```
