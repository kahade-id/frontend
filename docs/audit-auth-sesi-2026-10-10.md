# Audit Keamanan Auth & Sesi — 10 Oktober 2026

Branch `claude-auth` (frontend, backend, admin). Scope: login, register, OTP,
2FA, PIN, manajemen sesi, refresh token, logout semua perangkat, deteksi login
mencurigakan. Tanpa perubahan schema Prisma / app.json / eas.json / native.

Metode: baca langsung controller/service/guard inti + 3 sub-audit paralel
(backend auth.service; backend OTP/passkey/guard; layar frontend). Setiap
temuan diverifikasi ulang terhadap kode saat diperbaiki. Nomor baris mengacu
pada keadaan SEBELUM fix.

Legenda status: **FIXED** (diperbaiki di branch ini) · **PARTIAL** · **OPEN**
(butuh keputusan produk / schema / infra) · **NOTE** (observasi, bukan bug).

---

## A. Backend — token, refresh, sesi

| ID | Sev | Lokasi | Temuan | Status |
|---|---|---|---|---|
| BE-01 | High | `auth.service.ts:2836-2922` refreshToken | Deteksi reuse refresh token mati: rotasi mengganti `jti` baris sesi yang sama, sehingga token lama yang di-replay jatuh ke cabang `!session` (hanya log + notifikasi), bukan cabang "cabut semua sesi". `TOKEN_BLACKLIST(oldJti)` ditulis tapi tidak pernah dibaca. Token curian yang sudah dirotasi penyerang → sesi penyerang bertahan. | FIXED — cabang `!session` kini cek blacklist jti lama → cabut seluruh sesi user + notifikasi reuse. |
| BE-02 | Med | `auth.service.ts:2868-2894` | Binding perangkat refresh bisa dilewati dengan tidak mengirim `deviceId` di body (jalur "transisi"). | FIXED — bila token datang dari body (mobile) dan klaim `deviceId` ada, `deviceId` request WAJIB dan harus cocok. Cookie web tetap jalur klaim JWT. |
| BE-03 | Med | `auth.service.ts:2924-2930` | Refresh tidak memeriksa suspend ringan (`USER_SUSPENDED_KEY`) & `lockedUntil` → akun ditangguhkan tetap login 7 hari. | FIXED — `assertNotSuspended` + tolak saat terkunci. |
| BE-04 | Med | `auth.service.ts:2840-2855` | `notifyUnknownRefreshSession` tanpa throttle & terpicu pada balapan refresh yang sah (pemilik dapat alert "mencurigakan" untuk app-nya sendiri). | FIXED — dedupe per user 1 jam (SET NX). |
| BE-05 | Med | `sessions.service.ts:460-465` | `DELETE /v1/sessions` menghapus `pushToken` SEMUA perangkat termasuk perangkat sesi saat ini (yang sesinya dipertahankan) → perangkat ini diam-diam berhenti menerima notifikasi. | FIXED — perangkat sesi saat ini dikecualikan. |
| BE-06 | Low | `sessions.service.ts:451-458` | `GET /v1/sessions/devices` mengembalikan IP penuh; `GET /v1/sessions` memasker. | FIXED — dimasker. |
| BE-07 | Med | `auth.service.ts:3006-3066` logout | Logout server tidak memutus push token perangkat; bila `unregister-device` klien gagal (offline), perangkat yang sudah logout tetap menerima pratinjau chat akun lama. | FIXED — logout (per sesi) men-null-kan `pushToken` perangkat sesi; `logoutAll` men-null-kan semua. |
| BE-08 | Low | `auth.service.ts:2924` | Refresh tidak menolak `deletedAt` (guard JWT menolak). | FIXED — ikut ditolak. |
| BE-09 | Note | `token.service.ts:185-194` | `extra` di-spread setelah `sub/scope` pada temp token — pemanggil bisa menimpa `scope`. Semua pemanggil internal; dicatat agar tidak dipakai dengan input user. | FIXED — `sub/scope/deviceId` ditempatkan setelah `extra`. |
| BE-10 | Note | `sessions.service.ts` | Masa hidup refresh sliding 7 hari tanpa TTL absolut — keputusan produk terdokumentasi (P3). | NOTE |

## B. Backend — login, lockout, enumerasi

| ID | Sev | Lokasi | Temuan | Status |
|---|---|---|---|---|
| BE-11 | High | `auth.service.ts:2596-2615`, `2365-2371`, `auth.controller.ts:847` | Brute force TOTP dibatasi per **tempToken** (5), bukan per akun; `login()` me-refund kuota IP & controller menghapus hitungan captcha SEBELUM 2FA sukses → penyerang pemegang sandi: login → 5 tebakan → ulangi tanpa batas. | FIXED — counter per user `2fa_fail:<userId>` (10/15 menit → `lockedUntil` 30 menit + notifikasi); refund kuota IP & clear captcha dipindah ke setelah sesi terbit. |
| BE-12 | Med | `auth.service.ts:2365-2371`, `auth.controller.ts:847` | Kuota IP login & captcha bisa direset dengan login sukses akun sendiri (password spraying). | FIXED — refund hanya setelah sesi penuh terbit; `clearLoginFailures` tidak lagi dipanggil pada cabang `requires2FA`/migrasi (lihat BE-11). |
| BE-13 | Med | `auth.service.ts:413-447` verifyPhoneOtp | Status akun (inactive/banned/suspended/locked + sisa detik) bocor SEBELUM OTP dicek — oracle status nomor HP tanpa kredensial. | FIXED — preflight dihapus; pemeriksaan status setelah OTP valid (sudah ada) dipertahankan, OTP tidak dikonsumsi bila akun tak bisa login. |
| BE-14 | Med | `auth.service.ts:2264-2280` login | `ACCOUNT_SUSPENDED`/`ACCOUNT_LOCKED` dilempar sebelum validitas sandi dipakai → eksistensi/status akun bocor dengan sandi apa pun. | FIXED — suspended hanya setelah sandi benar; locked tetap dilempar (dibutuhkan UI countdown; sudah butuh 5 kegagalan) tetapi tanpa `lockoutRemainingSeconds` bila sandi salah. |
| BE-15 | Med | `auth.service.ts:2298-2345` | Deaktivasi permanen (`isActive=false`) terpicu input tanpa autentikasi: 25 sandi salah (±8 jam) mengunci akun siapa pun; pemilik lalu gagal OTP (`ACCOUNT_INACTIVE`). | FIXED — siklus ke-N tidak lagi menonaktifkan akun; `lockedUntil` 24 jam + cabut sesi + notifikasi. Admin tetap bisa menonaktifkan manual. |
| BE-16 | Med | `captcha.service.ts:126` | Captcha slider mengirim `targetX` persis ke klien; verifikasi hanya `|Δ|≤4` & ≥800 ms → skrip lolos otomatis. Captcha bukan kontrol brute force nyata. | OPEN — butuh desain puzzle sisi server (produk). Dampak dikurangi oleh BE-11/12/15 (lockout per akun & per user 2FA). |
| BE-17 | Low | `auth.service.ts:2250-2256` | Padding waktu jalur user-tidak-ada tidak menutup perbedaan dengan jalur user-ada+sandi-salah (ada UPDATE DB). | NOTE — noise jaringan > selisih; lockout per akun membatasi. |
| BE-18 | Med | `otp-trigger.service.ts:118-127` | Kuota per nomor 10/jam dikonsumsi saat BUAT trigger (tanpa bukti kepemilikan) → siapa pun bisa mengunci login/daftar/reset nomor korban selama 1 jam berulang. | FIXED — kuota per nomor dikunci per `nomor+IP` saat pembuatan; kuota per nomor murni dihitung saat webhook (kepemilikan terbukti). |
| BE-19 | Med | `otp-trigger.service.ts:157-171, 225-231` | Lokasi kiriman penyerang dicatat di `authLocationLog` atas `userId` korban (forgot_password) sebelum OTP → bisa menyemai heuristik impossible-travel. | FIXED — `userId: null` saat trigger; binding user hanya setelah OTP terverifikasi. |
| BE-20 | Low | `otp-trigger.service.ts:112-116,241-244` | Penolakan rate limit memakai 400 (bukan 429) dan `catch` menghapus cooldown pada SEMUA error → setelah dibatasi, penyerang bisa menembak penuh. | FIXED — 429 + cooldown hanya dihapus pada error infrastruktur. |
| BE-21 | Low | `auth-location.service.ts:37-45` | Heuristik impossible-travel 100% dari koordinat klien; tanpa silang IP. | NOTE — advisory saja; dicatat. |
| BE-22 | Low | DTO `login/verify-2fa/reset-password/social-login/passkey` | `deviceId` tanpa `DEVICE_ID_PATTERN`/`MaxLength` seragam (reset-password tanpa batas sama sekali; refresh 128 vs 255). | FIXED — pola & panjang disamakan (255, pattern). |
| BE-23 | Low | DTO `otp-trigger/phone-register/login/reset-password/change-password` | `location` ber-`@Type` tanpa `@ValidateNested` → `@Min/@Max` tak jalan, `"abc"` → NaN. | FIXED — `@ValidateNested()`. |
| BE-24 | Low | `env.validation.ts:266` vs `app.constants.ts:4` | `OTP_MAX_ATTEMPTS`/`OTP_LENGTH` divalidasi tapi tidak pernah dipakai. | NOTE — dicatat; perubahan konfigurasi bukan scope sesi ini. |

## C. Backend — 2FA, re-auth, sosial, passkey, PIN

| ID | Sev | Lokasi | Temuan | Status |
|---|---|---|---|---|
| BE-25 | High | `auth.service.ts:4504-4530, 4686-4702, 4872-4915, 1003-1010` | `confirmSocialLink` = oracle sandi publik tanpa lockout, dapat dicapai dengan email Google **tidak terverifikasi** (`emailVerified` dihitung tapi diabaikan). Juga bocorkan `maskedEmail` (oracle eksistensi email). | FIXED — email provider hanya dianggap bila `emailVerified === true` (selain itu → identitas baru tanpa maskedEmail); jalur sandi di `assertPasskeyReauthenticated` kini menaikkan `failedLoginAttempts`/lockout seperti `login()` + dummy bcrypt untuk akun tanpa sandi. |
| BE-26 | Med | `auth.service.ts:971-996` | `reauthToken` (dari OTP WhatsApp saja) melewati `verifySensitiveMfa` → pemegang sesi + SIM swap bisa taut/lepas provider & kelola passkey tanpa TOTP meski 2FA aktif. | FIXED — setelah klaim reauthToken tetap lanjut ke `verifySensitiveMfa`. |
| BE-27 | Med | `auth.service.ts:1013-1024`, `passkey.service.ts:596-611,645` | Re-auth OTP akun social-only memakai `user.phoneNumber` **ciphertext** (OTP terkirim ke string acak; verifikasi selalu gagal) dan tanpa cek `metadata.purpose` (OTP deletion/phone-change bisa jadi reauth). | FIXED — decrypt + `verifyPhoneOtpWithMetadata` + wajib `purpose==='passkey_recover'` & `userId` cocok (kedua tempat). |
| BE-28 | Med | `auth.service.ts:2375-2388, 2157-2197` | Token `phone_migration` terbit hanya dari sandi (sebelum 2FA) dan `confirmPhoneMigration` menulis nomor HP SEBELUM cek 2FA → penyerang pemegang sandi akun 2FA legacy mengikat nomornya sendiri (lalu reset sandi via OTP). | FIXED — 2FA dicek sebelum mutasi nomor; alur 2FA dulu baru binding; notifikasi keamanan saat nomor terikat. |
| BE-29 | Med | `auth.service.ts:4665-4677, 4776` | Login sosial melewati migrasi nomor HP wajib (`phoneVerified=false`). | FIXED — `issueSocialSession` mengembalikan `requiresPhoneMigration` seperti `login()`. |
| BE-30 | Med | `auth.service.ts:4791-4801` | tempToken 2FA sosial memakai `deviceId || 'social'` → sesi terikat ke literal `'social'`; sesi antar perangkat saling mengusir. | FIXED — `deviceId` wajib di `SocialLoginDto`/`ConfirmSocialLinkDto`; fallback dihapus. |
| BE-31 | Med | `auth.service.ts:890-915` | `verifySensitiveMfa` TOTP tanpa counter percobaan (backup code ada). | FIXED — `sensitive_mfa_attempts:<userId>` 5/15 menit → 429. |
| BE-32 | Low | `auth.service.ts:1925-1975` resetPassword | Token sekali-pakai diklaim SEBELUM cek sandi-sama/riwayat → salah pilih sandi = ulang seluruh alur OTP. | FIXED — cek read-only dulu, klaim tepat sebelum transaksi. |
| BE-33 | Low | `auth.service.ts:705-715` | `requestPhoneChange` oracle nomor terdaftar sebelum MFA. | FIXED — MFA diverifikasi dulu. |
| BE-34 | Low | `auth.service.ts:~3530-3545` disable2fa | OTP email dikonsumsi sebelum TOTP divalidasi → salah ketik TOTP membakar OTP email (3/5 menit). | FIXED — verifikasi `consume:false` → TOTP → consume. |
| BE-35 | Low | `auth.service.ts:3825-3840` | OTP disable-2FA ke email belum terverifikasi; cooldown dihapus `invalidateOtps`. | FIXED — wajib `emailVerified`. |
| BE-36 | Low | `auth.service.ts:4901-4906, 1441-1460, 4917` | Token `social_signup` tidak dicocokkan ke `deviceId`; klaim sebelum `create` (race membakar token). | FIXED — cocokkan deviceId; klaim setelah create. |
| BE-37 | Low | `auth.service.ts:4050-4080` | Backup code: hingga 10 bcrypt per percobaan (CPU amplification). | NOTE — dibatasi 5/15 menit per user; dicatat. |
| BE-38 | Low | `auth.service.ts:4176-4205` | Email lockout memuat IP penuh, body in-app dimasker. | FIXED — dimasker juga. |
| BE-39 | Low | `auth.service.ts:174-350, 378-388` | `register()` lama (jalur lemah) & `shouldExposeDebugOtp()` = kode mati. | FIXED — dihapus. |
| BE-40 | Med | `auth.service.ts` setup2fa/disable2fa/regenerate/requestPhoneChange, `wallet.service.ts:3790` setPin, `users.service.ts:1425` setDeviceTrust | Akun tanpa sandi (social-only) tidak bisa mengaktifkan 2FA, ganti HP, set PIN dompet, trust perangkat. | OPEN — butuh desain re-auth alternatif (OTP WhatsApp) & keputusan produk; dicatat sebagai rekomendasi. |
| BE-41 | Med | `passkey.service.ts:332-342` | `passkey/auth/options` publik: bentuk respons berbeda untuk identifier tak dikenal / ada tanpa passkey / ada dengan passkey + bocor credentialId → oracle eksistensi akun. | FIXED — tanpa `allowCredentials` di jalur publik (resident key `preferred`). |
| BE-42 | Low | `passkey.service.ts:348,389` | Challenge auth tidak diikat ke user yang di-resolve (cek mati). | FIXED — userId disimpan di payload challenge. |
| BE-43 | Low | `passkey.service.ts:439-465` | Cek counter signature tidak atomik (clone authenticator). | FIXED — `updateMany` kondisional `counter: storedCounter`. |
| BE-44 | Low | `passkey.service.ts:596-611` | Recovery passkey mengirim OTP langsung hanya dengan sesi (tanpa re-auth) — 5/menit. | PARTIAL — dibatasi cooldown per user 60 d + 3/jam; jalur push langsung tetap (keputusan produk). |
| BE-45 | Low | `step-up.guard.ts:70-75` | Token step-up dikonsumsi sebelum validasi DTO (422 membakar token). | OPEN — butuh refactor interceptor; dicatat. |
| BE-46 | Low | `email-verified.guard.ts:28` | Mempercayai klaim JWT `emailVerified` (basi hingga 15 menit). | FIXED — klaim shortcut dihapus; cek DB/Redis. |
| BE-47 | Low | `apple-auth.service.ts:37-48` | JWKS cache tidak refetch pada `kid` tak dikenal (rotasi kunci Apple = login Apple mati 24 jam). | FIXED — refetch sekali bila `kid` tak ada. |
| BE-48 | Low | `webauthn.config.ts:21-36` | Default staging rpId `localhost` vs origin `staging.kahade.id`. | FIXED — default staging konsisten. |
| BE-49 | Low | `auth.controller.ts:289`, `legacy-fonnte-webhook.controller.ts:27` | Webhook tanpa throttle rute. | FIXED — 60/menit. |
| BE-50 | Low | `main.ts:159-162` | `TRUSTED_PROXY_CIDR` hanya dicek ada/tidak (`0.0.0.0/0`/`true` lolos → spoof `X-Forwarded-For`). | FIXED — validasi menolak nilai "percaya semua". |
| BE-51 | Low | `csrf.guard.ts:19-25` | Rute `@Public()` yang membaca `@CurrentUser` dari cookie tidak kena CSRF (saat ini hanya `feedback`). | FIXED — CSRF dijalankan bila user berasal dari cookie walau rute publik. |
| BE-52 | Low | `wallet.service.ts:3790-3830` setPin | PIN baru boleh sama dengan PIN lama; tidak ada notifikasi keamanan saat PIN diubah. | FIXED — tolak PIN sama; notifikasi `SECURITY` saat PIN diubah. |
| BE-53 | Note | `wallet.service.ts:1222-1240` | Counter IP PIN read-then-increment (counter per user sudah atomik). | NOTE |
| BE-54 | Low | `auth.service.ts:4212-4240` | Notifikasi "New Device Login" berbahasa Inggris & terkirim juga saat registrasi (perangkat pertama). | FIXED — teks Indonesia; dilewati pada registrasi. |
| BE-55 | Low | `auth.service.ts` verify2faLogin/confirmPhoneMigration/resetPassword | `assertNotSuspended` tidak dipanggil (suspend setelah tempToken terbit tetap bisa login). | FIXED |
| BE-56 | Low | `auth.controller.ts:467` | `apple/nonce` body tanpa DTO (deviceId bertipe bebas). | FIXED — DTO + pattern. |

## D. Frontend — sesi, transport, state alur

| ID | Sev | Lokasi | Temuan | Status |
|---|---|---|---|---|
| FE-N1 | Med | `lib/login-redirect.ts:20,78`, `app/(auth)/login*.tsx`, `register.tsx:83,109`, `login-required.tsx:17` | `next` diterima bila `startsWith("/")` → `//evil.tld` (protocol-relative) & `/\evil` lolos; `resolvePostLoginTarget` memakai `?next=` tanpa sanitasi → open redirect pasca-login di web. | FIXED — `sanitizeNextPath` terpusat (tolak `//`, `/\`, skema, kontrol) dipakai di 7 titik + test. |
| FE-S1 | Med | `lib/api/session.ts:216-217` | `clearSession()` hanya membersihkan registrasi + 2FA; tempToken reset sandi, token migrasi, linkToken sosial (taut & signup), identifier login terakhir, dan alur OTP tersimpan (SecureStore) BERTAHAN melewati logout → pengguna berikutnya di perangkat sama bisa buka `/reset-password` untuk nomor sebelumnya, atau akunnya tertaut Google orang lain. | FIXED — semua holder dibersihkan di `clearSession()`. |
| FE-S2 | High | `components/auth/login-social-section.tsx:97`, `register-security.tsx:217-228`, `lib/social-signup.ts` | linkToken signup sosial yang ditinggalkan dipakai diam-diam oleh registrasi berikutnya (akun B tertaut identitas Google A). | FIXED — TTL 10 menit + dibersihkan saat logout & saat "ubah nomor"/keluar alur. |
| FE-S3 | Med | `components/app-lock-gate.tsx:174-176` | "Keluar & masuk ulang" hanya `clearSession()` lokal — sesi server (refresh 7 hari) tetap hidup. | FIXED — via `api.auth.logout()` (cabut server best-effort + bersih lokal). |
| FE-S4 | Low | `lib/api/client.ts:415` | Setelah 3× refresh gagal, `setRefreshToken("")` menyimpan string kosong alih-alih menghapus. | FIXED — `deleteSecureItem`. |
| FE-S5 | Med | `app/security-activity.tsx:356-392` | "Keluar dari semua perangkat": `deleteAllSessions()` (backend hanya cabut sesi LAIN) lalu `logout()` biasa; bila logout gagal (offline) sesi perangkat ini tetap hidup di server; komentar FE menyatakan backend mencabut semua. | FIXED — satu panggilan `logout({ logoutAll: true })` setelah unregister push; navigasi `ROUTES.login`. |
| FE-S6 | Low | `app/security-activity.tsx:391` | `router.replace("/(auth)/login")` hardcode path grup. | FIXED |
| FE-S7 | Low | `components/security/security-logout-control.tsx:46-57` | Saat `logout()` throw, sesi lokal sudah dibersihkan tetapi tidak navigasi; notice menyuruh "keluar sekali lagi" padahal token sudah tidak ada. | FIXED — selalu navigasi ke login; notice dikoreksi. |
| FE-S8 | Low | `lib/api/sessions.ts:98-104` | Komentar/kontrak `deleteAllSessions` keliru ("termasuk sesi saat ini"). | FIXED — dokumentasi diselaraskan. |
| FE-S9 | Low | `lib/api/sessions.ts:106-110` | Komentar trust device "lewati 2FA saat login" sudah tidak benar (AUT-005). | FIXED — komentar + copy layar. |

## E. Frontend — layar auth, OTP, 2FA, PIN

| ID | Sev | Lokasi | Temuan | Status |
|---|---|---|---|---|
| FE-N2 | Med | `app/(auth)/verify-otp.tsx:216,238` | `clearOtpFlow()` sebelum `confirmPhoneMigration()` → bila confirm gagal (timeout/5xx) OTP sudah terbakar, tempToken tidak disimpan, resend kehilangan `migrationToken`. | FIXED — flow dibersihkan setelah langkah terakhir sukses; tempToken migrasi disimpan untuk retry tanpa OTP ulang. |
| FE-N3 | Med | `app/(auth)/verify-otp.tsx:248,260`, `verify-2fa.tsx:166-170` | 2FA di-`push` di atas verify-otp yang alurnya sudah dibersihkan → Back mendarat di layar OTP zombie. | FIXED — `origin:"otp"` di state 2FA; "kembali" dari 2FA asal OTP → hub masuk; navigasi `replace`. |
| FE-N4 | Med | `app/(auth)/whatsapp-trigger.tsx:623,644` | Keluar lintas-alur ("Masuk"/"Daftar") tidak membersihkan alur OTP tersimpan (nomor + refCode + migrationToken bertahan restart). | FIXED — `clearOtpFlow()` pada keluar lintas-alur; alur kedaluwarsa dibuang saat hidrasi. |
| FE-L1 | Med | `components/auth/login-password-form.tsx:150-157` | Cabang countdown `ACCOUNT_LOCKED` mati: `ApiError` tidak punya `lockoutRemainingSeconds`; tombol tetap aktif, ketukan ulang memperpanjang lockout. | FIXED — `ApiError.retryAfterMs` diisi dari `lockoutRemainingSeconds` body; form memakai cooldown terpusat (`useRetryCooldown`). |
| FE-L2 | Med | `register.tsx:181`, `login-whatsapp-form.tsx:68-70`, `login-password-form.tsx:160-162`, `verify-otp.tsx:299-305`, `whatsapp-trigger.tsx:470-472`, `phone-migration.tsx:119`, `verify-2fa.tsx:155` | 429 ditangani sebagai teks tanpa durasi/kunci tombol; `retryAfterMs` tersedia tapi tidak dipakai (melanggar aturan pesan spesifik CLAUDE.md). | FIXED — hook `useRetryCooldown` + `retryAfterMessage()`; tombol dikunci sampai habis. |
| FE-L3 | Med | `whatsapp-trigger.tsx:441-476` | "Minta kode baru" tanpa cooldown klien; timer 60 d di verify-otp per-mount (kosmetik). | FIXED — `lastTriggerAt` dipersist di alur OTP; countdown dari deadline alur, bukan waktu mount. |
| FE-L4 | Low | `app/passkeys.tsx:276-293` | OTP recovery passkey bisa ditembak ulang tanpa cooldown/429 countdown. | FIXED — cooldown yang sama. |
| FE-I1 | Med | `app/passkeys.tsx:64-73` | Field "Kode 2FA" re-auth `number-pad` `maxLength 6` → kode cadangan (10–16 alfanumerik) tidak bisa dimasukkan. | FIXED — `normalizeMfaCode`, `MFA_CODE_MAX_LENGTH`, keyboard default. |
| FE-I2 | Med | `app/change-phone.tsx:137-138` | `<OtpInput>` tanpa `errorText` → kode ditolak tetap terisi 6/6 dan ketikan diabaikan (regresi A-03). | FIXED — `errorText` diteruskan. |
| FE-I3 | Low | `verify-2fa.tsx:148` | Copy "6 digit" juga tampil di mode kode cadangan. | FIXED — per mode. |
| FE-I4 | Med | `verify-2fa.tsx:142` | Kedaluwarsa tempToken dideteksi lewat regex pesan Inggris mentah; backend sebenarnya mengirim `code: TEMP_TOKEN_EXPIRED` dan 403 `TOO_MANY_REQUESTS` (token diblacklist) yang kini salah diklasifikasi sebagai kode salah → retry tanpa akhir. | FIXED — klasifikasi via `backendCode` (`TEMP_TOKEN_EXPIRED`, `TOO_MANY_REQUESTS`, `ACCOUNT_LOCKED`). |
| FE-I5 | Low | `change-password.tsx:139-147`, `change-email.tsx:170-178` | Input MFA tanpa `one-time-code`/normalisasi (kode tempel berspasi gagal). | FIXED — props disamakan dengan social-link-confirm. |
| FE-I6 | Low | `change-pin.tsx:252-261` | Copy menjanjikan larangan PIN berurutan/tanggal lahir tetapi tidak ada validasi klien (backend menolak dengan pesan Inggris). | FIXED — validasi klien selaras backend (`isWeakPin`) + pesan Indonesia. |
| FE-I7 | Low | `change-pin.tsx:157-160` | Setelah sandi ditolak server, state `password` basi tetap terisi saat kembali ke langkah sandi. | FIXED — dikosongkan. |
| FE-I8 | Med | `change-password.tsx:121-128` | Indikator kekuatan memakai kriteria kompleksitas (huruf besar/angka/simbol) — bertentangan dengan kebijakan "tanpa kompleksitas"; sandi di blocklist hanya menonaktifkan tombol tanpa pesan. | FIXED — `SECURITY_CRITERIA` + `errorText` dari `passwordValidationMessage`. |
| FE-I9 | Low | `app/change-email.tsx:93` | Email baru dibawa lewat route param (`verifyEmail(email)`) → history/Referer web. | FIXED — holder memori `lib/email-verify.ts`. |
| FE-I10 | Low | `register-security.tsx`, `reset-password.tsx`, `change-password.tsx`, `social-link-confirm.tsx`, `login-password-form.tsx` | Layar sandi tanpa `ScreenCaptureGuard` (toggle mata membuat sandi terlihat di screenshot/app switcher). | FIXED — dibungkus `ScreenCaptureGuard`. |
| FE-I11 | Low | `change-phone.tsx:134-142` | Langkah konfirmasi tanpa resend/countdown; "Ubah nomor" menghapus sandi. | PARTIAL — countdown kedaluwarsa + cooldown ditambah; resend memakai `requestPhoneChange` ulang (butuh sandi) — dijelaskan di UI. |
| FE-I12 | Low | `reset-password.tsx:113` | Setelah sukses, `forgot-password` tetap di back stack. | FIXED — `dismissAll` lalu replace. |
| FE-I13 | Low | `login-whatsapp-form.tsx:64-66` | 404 → "Nomor belum terdaftar" = oracle pendaftaran bila backend mengirim 404. | FIXED — copy generik anti-enumerasi. |
| FE-I14 | Med | banyak layar auth (lihat daftar di komit) | String Indonesia hardcode/template literal tanpa pasangan EN (`change-pin`, `verify-2fa`, `login-whatsapp-form`, `login-password-form`, `phone-migration`, `forgot-password`, `social-login-buttons`, `whatsapp-trigger`, `change-email`, `change-phone`, `passkeys`, `social-providers`, `biometric-settings`). | FIXED — `translate("… {x} …", { x })` + kunci EN di `lib/i18n/en/auth.json`; katalog diregenerasi. |
| FE-I15 | Low | `change-pin.tsx:107`, `lib/api/errors.ts:509` | Durasi lockout PIN "15 menit" hardcode; `retryAfterMs` diabaikan. | FIXED — `retryAfterMessage()` memakai `retryAfterMs` bila ada. |
| FE-A1 | Low | `components/ui/pin-input.tsx:242-246`, `setup-profile.tsx:387` | Teks error PIN tanpa `accessibilityRole="alert"`/live region. | FIXED |
| FE-A2 | Low | `change-password.tsx:154-161` | Tombol nonaktif tanpa alasan terlihat saat sandi di blocklist. | FIXED — lihat FE-I8. |

## F. Admin

Tidak ada layar admin yang menyentuh sesi/auth pengguna di scope ini; admin
memiliki alur login terpisah (`admin` module) yang tidak diaudit sekarang.
Tidak ada perubahan di worktree admin.

## G. Rekomendasi terbuka (butuh keputusan produk / infra)

1. **BE-16** — ganti captcha slider dengan puzzle yang jawabannya tidak dikirim ke klien, atau hapus kesan "captcha = anti brute force".
2. **BE-40** — desain re-auth untuk akun tanpa sandi (OTP WhatsApp user-initiated) agar bisa 2FA/PIN/ganti HP.
3. **BE-45** — konsumsi token step-up setelah validasi DTO (interceptor).
4. **BE-10** — TTL absolut sesi mobile (mis. 30 hari) — keputusan produk.
5. Pertimbangkan grace window 30 d untuk balapan rotasi refresh (menghindari logout palsu saat respons rotasi hilang) — butuh penyimpanan hash token lama (Redis, tanpa schema).
