# Kontrak Auth: OAuth Sosial & Passkey (klien mobile)

Dokumen ini mencatat **apa yang dikirim dan diharapkan klien mobile** untuk
masuk dengan Google, Apple, dan passkey setelah overhaul auth 2026-10-10, plus
daftar hal yang perlu dikonfirmasi tim backend.

Prinsip yang dipegang di overhaul ini: **tidak ada endpoint baru yang
dikarang**. Semua alur memakai endpoint yang sudah ada dan sudah teruji di
`lib/api/social.ts` / `lib/api/passkey.ts`. Yang berubah di sisi klien adalah
arsitektur layar (hub Masuk + satu metode per halaman), posisi tombol, dan
kejujuran dukungan platform.

---

## 1. Matriks platform

| Metode | Android | iOS | Web (expo web) |
| --- | --- | --- | --- |
| Google (`expo-auth-session`) | ✅ | ✅ | ✅ |
| Apple (`expo-apple-authentication`) | ❌ tombol tidak dirender | ✅ native | ⚠️ jalur kode ada, tombol disembunyikan |
| Passkey — WebAuthn | ❌ | ❌ | ✅ bila browser mendukung |
| Passkey — provider native | ⛔ seam terpasang, sengaja mati | ⛔ seam terpasang, sengaja mati | — |
| Nomor HP / Email / Username | ✅ | ✅ | ✅ |

Kenapa Apple hanya iOS: permintaan Apple sendiri (Sign in with Apple ditawarkan
lewat mekanisme native di iOS) dan kebijakan produk 2026-10-10. Baris yang
tidak bisa dipakai tidak dirender sama sekali — bukan `disabled`, bukan "segera
hadir". Lihat `isAppleButtonSupported()` di `lib/social-oauth.ts` (satu tempat;
dilonggarkan di sana bila suatu permukaan web memang membutuhkannya).

Kenapa passkey native masih mati: lihat §5.

---

## 2. Google

```
klien                                  backend
─────                                  ───────
GET  /v1/auth/social/providers    →    [{ provider, enabled, appId }]
AuthRequest(expo-auth-session)
  responseType: id_token
  scopes: openid profile email
  extraParams: { nonce }                ← nonce ACAK KLIEN (32 byte hex)
promptAsync() → id_token
POST /v1/auth/social/login        →    sesi / twoFactor / phoneMigration /
  { provider: "google",                 linkRequired / confirmLink
    idToken, nonce,
    deviceId, deviceInfo, location }
```

Catatan klien (sudah terpasang, perlu konfirmasi backend):

1. `provider` dikirim **lowercase** (`"google"`/`"apple"`). Kode di
   `lib/api/social.ts` menormalkan ke lowercase karena backend pernah menolak
   UPPERCASE dengan 400 (BFI-035). Mohon dipastikan ini masih berlaku.
2. `nonce` Google adalah nonce klien. Klien mengirimnya supaya server bisa
   memverifikasi anti-replay (G011). **Pertanyaan:** apakah backend
   memverifikasi `nonce` di dalam `id_token` Google, atau hanya menyimpannya?
   Bila tidak diverifikasi, klien tetap mengirimnya (tidak merugikan), tapi
   klaim anti-replay-nya harus dicabut dari dokumentasi internal.
3. Tombol hanya dirender bila `enabled === true` **dan** `appId` terisi — tanpa
   OAuth client id, alur tidak bisa dimulai, jadi tombol disembunyikan alih-alih
   gagal setelah diketuk (`getProviders()` di `lib/api/social.ts`).

---

## 3. Apple

```
klien                                  backend
─────                                  ───────
POST /v1/auth/apple/nonce         →    { nonce }        (WAJIB terbitan server)
iOS  : AppleAuthentication.signInAsync({ requestedScopes, nonce })
web  : browser → https://appleid.apple.com/auth/authorize
         response_type=id_token, response_mode=fragment, nonce, state
POST /v1/auth/social/login        →    sama seperti Google
  { provider: "apple", idToken, nonce }
```

Catatan klien:

1. **Nonce Apple harus terbitan server** (kontrak Wave 1, 2026-09-28): nonce
   buatan klien ditolak 100%. Klien memanggil `/v1/auth/apple/nonce` SEBELUM
   dialog Apple muncul, karena Apple menanam nonce ke `identityToken`.
2. Pembatalan pengguna (iOS `ERR_CANCELED`, browser `cancel`/`dismiss`)
   dipetakan ke `SocialCancelledError` dan UI **diam** — tidak ada Alert merah
   untuk pengguna yang memang sengaja membatalkan (konvensi T4-011).
3. Jalur Apple berbasis browser dipertahankan di kode walau tombolnya
   disembunyikan, supaya kontrak `response_mode=fragment` + nonce server tetap
   teruji (`tests/social-oauth-platform.test.ts`).

---

## 4. Hasil `/v1/auth/social/login` (5 cabang)

Normalisasi ada di `lib/api/social.ts` → `SocialLoginResult`; routing di
`components/auth/login-social-section.tsx`.

| `kind` | Syarat di respons | Aksi klien |
| --- | --- | --- |
| `session` | `accessToken` + `refreshToken` | simpan sesi → `finishLogin()` → target `?next=`/home |
| `twoFactor` | `requiresTwoFactor` + `tempToken` | simpan pending → `/verify-2fa` |
| `phoneMigration` | `requiresPhoneMigration` + `migrationToken` | simpan token → `/phone-migration` |
| `linkRequired` | `requiresLink` + `isNewIdentity` + `linkToken` | dialog "akun belum terdaftar" → `/register` (nomor HP) |
| `confirmLink` | `requiresLink` + `linkToken` + `maskedEmail` | `/social-link-confirm` (buktikan kepemilikan akun lama) |

Bila field wajib cabang itu tidak ada (mis. `requiresTwoFactor` tanpa
`tempToken`), klien melempar `invalidResponse(...)` — **bukan** diam-diam
menganggap sukses. Respons yang tidak lengkap harus gagal keras di klien, bukan
menjadi sesi setengah jadi.

---

## 5. Passkey

### 5.1 Endpoint (tidak berubah)

```
Daftar (butuh sesi + reauth):
POST /v1/auth/passkey/register/options  { reauth…  , deviceName }  → { challengeId, options }
POST /v1/auth/passkey/register/verify   { challengeId, attestation, deviceName } → PasskeySummary

Masuk (tanpa sesi):
POST /v1/auth/passkey/auth/options      { username? }              → { challengeId, options }
POST /v1/auth/passkey/auth/verify       { challengeId, assertion, deviceId, deviceInfo } → LoginResult

Kelola:
GET  /v1/auth/passkey                   → { items: PasskeySummary[] }
POST /v1/auth/passkey/recover           { step, otpCode?, deviceId }
GET  /v1/auth/passkey/policy/required-for
```

`auth/verify` menjawab dengan cabang yang sama seperti login biasa: sesi
langsung, `requiresTwoFactor`, atau `requiresPhoneMigration`.

Bentuk payload mengikuti `@simplewebauthn/server`:
`PublicKeyCredential{Creation,Request}OptionsJSON` ke bawah, dan
`attestation`/`assertion` ke atas sebagai JSON **base64url tanpa padding**.
`deviceInfo` khusus jalur passkey dipotong ke 255 karakter (BFE-045:
`PasskeyAuthVerifyDto.deviceInfo @MaxLength(255)`, bukan 512 seperti `login`) —
bila backend melonggarkan batas ini, kabari supaya potongan itu bisa dicabut.

### 5.2 Seam native: terpasang, SENGAJA mati

WebAuthn adalah API browser. Di Android/iOS dibutuhkan provider (Credential
Manager / `ASAuthorizationPlatformPublicKeyCredentialProvider`). Semua yang
berhubungan dengan provider native dikumpulkan di **satu** modul:
`lib/passkey-native.ts`.

Status hari ini: `NATIVE_PASSKEY_ENABLED = false`. Alasannya bukan "belum
sempat", tapi karena satu-satunya paket publik yang tersedia tidak memenuhi
kontrak:

| Temuan pada `expo-passkeys@0.1.11` | Akibat bila dipaksakan |
| --- | --- |
| API `createPasskey(challenge, user, rp, timeout)` / `getPasskey(challenge, …)` — **posisional** | `pubKeyCredParams`, `excludeCredentials`, `authenticatorSelection`, `attestation` dari server tidak bisa diteruskan |
| Android meng-hardcode `allowCredentials: []`, `userVerification: "required"`, `attestation: "direct"` | assertion/attestation bisa ditolak server; gejalanya "passkey rusak" |
| `peerDependencies.expo: ^52` (repo ini SDK 58 + new architecture) | risiko build |
| README paket menyebut sisi iOS masih dalam pengembangan | kegagalan di perangkat nyata |
| Mengembalikan base64 **standar**, dan `PasskeyUserInfo.id` bertipe GUID | id kredensial tidak cocok dengan user handle base64url dari server |

Karena itu konfigurasi yang dipilih:

```jsonc
// package.json — OPSIONAL, bukan dependencies
"optionalDependencies": { "expo-passkeys": "^0.1.11" }

// app.json — JS-nya bisa di-resolve bundler, native-nya tidak ikut ter-build
"expo": { "autolinking": { "exclude": ["expo-passkeys"] } }
```

Hasilnya: tidak ada risiko build iOS/Android dari paket yang tidak kompatibel,
dan UI **jujur** — `getPasskeyCapability()` menjawab
`{ supported: false, reason: "DISABLED" }`, lalu layar masuk menampilkan
penjelasan + jalan keluar (kata sandi / kode WhatsApp / aplikasi web), bukan
tombol yang mati tanpa alasan dan bukan klaim "passkey native" yang palsu.

Alasan (`PasskeyUnsupportedReason`) yang dikenal klien:

| `reason` | Arti | Yang melihat |
| --- | --- | --- |
| `NOT_NATIVE` | platform web → pakai WebAuthn | log |
| `DISABLED` | seam dimatikan sengaja | pengguna (copy native) |
| `MODULE_MISSING` | paket provider tidak terpasang di build | pengguna (copy native) |
| `PROVIDER_INCOMPLETE` | paket ada, bentuk API-nya tak bisa membawa options server | pengguna (copy native) |
| `RUNTIME_ERROR` | provider melempar saat dimuat/dipanggil | pengguna (copy native) |
| `WEB_UNSUPPORTED` | browser tanpa `PublicKeyCredential` | pengguna (copy web) |

Di layar, enam alasan itu sengaja diringkas menjadi **dua** pesan (native vs
browser): perbedaan `MODULE_MISSING` dan `DISABLED` hanya bisa ditindaklanjuti
tim, bukan pengguna. Alasan rincinya tetap dikirim ke telemetri.

### 5.3 Cara menyalakan passkey native

1. Sediakan provider yang menerima **satu objek options server** dan
   mengembalikan attestation/assertion lengkap. `isProviderCapable()` di
   `lib/passkey-native.ts` adalah gerbangnya; bila API provider berbeda, yang
   disesuaikan adalah adaptor `toRegistrationResponse`/`toAuthenticationResponse`,
   bukan gerbangnya.
2. Hapus `"expo-passkeys"` dari `expo.autolinking.exclude` di `app.json` (atau
   ganti `PROVIDER_MODULE` ke modul native sendiri).
3. Set `NATIVE_PASSKEY_ENABLED = true`.
4. Uji di perangkat nyata (docs/auth-security-qa.md) — simulator tidak punya
   authenticator platform.

Kontrak backend **tidak berubah** sama sekali: seam ini hanya menukar siapa yang
menghasilkan attestation/assertion.

### 5.4 Yang dibutuhkan dari backend/infra sebelum passkey native bisa hidup

Ini blocker nyata, bukan formalitas:

1. **`rpId` harus domain**, dan domain itu harus ter-asosiasi dengan aplikasi:
   - iOS: `apple-app-site-association` perlu entri `webcredentials` untuk
     `kahade.id` + Team ID Apple. Saat ini berkas itu masih kosong —
     `npm run check:weblinks` sudah menandainya sebagai PERINGATAN
     ("Universal Links belum diaktifkan sampai Team ID Apple tersedia").
     Passkey iOS butuh hal yang sama.
   - Android: `assetlinks.json` harus memuat sertifikat penandatanganan untuk
     `id.kahade` (sudah dipakai App Links, jadi tinggal dipastikan).
2. **`options.rp.id` yang diterbitkan server harus sama** dengan yang
   diasosiasikan di atas. Bila server menerbitkan `rpId` berbeda per lingkungan
   (mis. `staging.kahade.id`), klien native butuh nilai itu apa adanya — mohon
   jangan diubah per platform.
3. **`authenticatorSelection.residentKey`/`requireResidentCredential`**: hub
   Masuk memanggil `auth/options` TANPA `username` (discoverable credential).
   Bila passkey dibuat sebagai non-resident, login dari hub tidak akan
   menemukan kredensial. Pendaftaran dari web saat ini mengikuti apa pun yang
   server kirim, jadi ini keputusan server.
4. **User handle**: klien mengirim `attestation.response.*` apa adanya dari
   authenticator, dan `user.id` dari `register/options` diperlakukan sebagai
   base64url. Seam native mengonversi GUID → base64url bila provider
   mengembalikan GUID (`toBase64Url`), tapi lebih baik bila server tetap
   menerima handle yang sama seperti saat pendaftaran.

---

## 6. Penjaga regresi

| Berkas | Yang dikunci |
| --- | --- |
| `tests/social-oauth-platform.test.ts` | tombol Apple per platform, nonce server vs klien, pembatalan → `SocialCancelledError`, jalur web Apple tetap hidup |
| `tests/social-login-contract.test.ts` | normalisasi 5 cabang hasil `social/login`, filter `enabled`+`appId`, `/v1/auth/apple/nonce` |
| `tests/passkey-native.test.ts` | probe seam (alasan per platform), gerbang bentuk provider, normalisasi base64url/GUID, adaptor kontrak, pemetaan error native |
| `tests/login-methods.test.tsx` | hub Masuk: 3 aksi besar + pemisah + 3 tautan halaman metode, alur passkey (didukung / tidak / 2FA), deep link lama `?method=` |
| `tests/legal-consent.test.tsx` | satu baris persetujuan, terjemahan English utuh, tautan dokumen in-app |

Endpoint yang dipakai klien ada di `lib/api/social.ts` dan `lib/api/passkey.ts`
— bila backend mengubah salah satunya, ubah di sana, bukan di layar.
