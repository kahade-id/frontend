# Audit Mendalam: Screen Onboarding & Register

**Tanggal audit:** 2026-09-04
**Branch:** `arena/01a06e35-frontend`
**Cakupan:** Screen 1 (Onboarding) + Screen 2 (Register) + seluruh infrastruktur pendukung

---

## Ringkasan Eksekutif

**Status: ✅ LOLOS AUDIT — Tidak ada bug kritis atau pelanggaran design system.**

Kedua screen sudah diimplementasikan dengan kualitas tinggi:
- Kontrak API persis dengan `kahade-api-mobile.json` (nama field, tipe, enum)
- Design system v1.1 dipatuhi secara konsisten (token warna, tipografi, spacing, radius)
- Aksesibilitas (WCAG) diperhatikan: hit target 44px, screen reader labels, live regions, Reduce Motion
- Komentar "keputusan non-obvious" sangat baik — memudahkan maintenance
- Error handling konsisten via `ApiError` dengan kode stabil
- deviceId utility **sudah ada** di `lib/secure-storage.ts` + `lib/api/session.ts` (lihat §4)

---

## 1. deviceId — Status: SUDAH ADA ✅

**Tidak perlu membuat `lib/device.ts` baru.**

Implementasi yang ada:

| Layer | File | Fungsi |
|---|---|---|
| Storage | `lib/secure-storage.ts` | `getOrCreateDeviceId()` — generate UUID sekali, simpan di SecureStore |
| Session | `lib/api/session.ts` | `getDeviceId()` — memoized Promise, retry bila SecureStore gagal |
| Auth API | `lib/api/auth.ts` | `withDevice()` helper — otomatis注入 `deviceId` + `deviceInfo` ke DTO |
| HTTP Client | `lib/api/client.ts` | Header `X-Device-Id` di SETIAP request |

**Konfigurasi per endpoint (sesuai spec):**

| Endpoint | `deviceId` di body? | Implementasi |
|---|---|---|
| `POST /v1/auth/otp-methods` | Tidak | ✅ `GET /v1/auth/otp-methods` (tidak butuh) |
| `POST /v1/auth/request-otp` | Tidak (DTO: `phoneNumber` + `method` saja) | ✅ `requestOtp(dto: RequestOtpDto)` — tidak pakai `withDevice` |
| `POST /v1/auth/verify-otp` | **Ya** (required) | ✅ `verifyOtp()` pakai `withDevice()` |
| `POST /v1/auth/phone-register` | Ya (optional di spec, tapi dikirim) | ✅ `phoneRegister()` inject otomatis |
| `POST /v1/auth/login` | **Ya** (required) | ✅ `login()` pakai `withDevice()` |
| `POST /v1/auth/2fa/verify-login` | **Ya** (required) | ✅ `verify2faLogin()` pakai `withDevice()` |

**Keamanan penyimpanan:**
- Key: `kahade.device.id` di SecureStore
- iOS: Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) — tidak ikut backup iCloud
- Android: EncryptedSharedPreferences via Keystore
- Web: memori proses (hilang saat reload — diterima, web bukan target v1)
- Tidak ikut `clearSession()` — deviceId bertahan saat logout (sesuai definisi "stable per-install fingerprint")

---

## 2. Audit Screen 1: Onboarding

### File yang diaudit
- `app/(auth)/onboarding.tsx` — route screen
- `components/onboarding/onboarding-carousel.tsx` — pager horizontal
- `components/onboarding/slides.tsx` — konten 3 slide
- `lib/onboarding.ts` — flag persistence

### 2.1 Kontrak API
**N/A** — Onboarding tidak memanggil API. ✅

### 2.2 Design System Compliance

| Aspek | Status | Catatan |
|---|---|---|
| Font Display (EB Garamond 34/42) | ✅ | `<DisplayHeading>` di tiap slide — satu dari sedikit tempat yang diizinkan §1.4/§3.1 |
| Font body (Sofia Sans) | ✅ | `<Text variant="bodyLarge" tone="secondary">` |
| Screen padding 24px | ✅ | `px-6` di header row dan footer |
| Logo lockup | ✅ | `<Logo variant="lockup" size="sm" />` |
| Radius button sm (6px) | ✅ | Default `<Button>` = `rounded-sm` |
| Page indicator | ✅ | `<PageIndicator>` — dot aktif pill, inaktif round |
| Link monokrom + underline | ✅ | `<TextLink>` — "Lewati", "Masuk" |
| Tone tenang, formal "Anda" | ✅ | Copy konsisten §12 |
| Spacing spacious | ✅ | `gap-6`, `gap-4`, `gap-3`, `gap-2` — tidak padat |
| Tidak ada shadow | ✅ | Hierarki lewat border dan kontras |
| Motion halus | ✅ | `<FadeIn duration="slow">` — satu reveal saat masuk |

### 2.3 Aksesibilitas

| Check | Status | Detail |
|---|---|---|
| 1 heading per slide | ✅ | `<DisplayHeading>` (accessibilityRole="header"), slide non-aktif di-hide dari SR |
| Slide SR navigation | ✅ | `accessibilityRole="adjustable"`, swipe actions (increment/decrement) |
| Hit target ≥ 44px | ✅ | `<TextLink>` hitSlop, `<Button>` md = 48px |
| Reduce Motion | ✅ | `scrollToIndex` animated=false saat Reduce Motion aktif |
| Artefak SR grouping | ✅ | `accessibilityLabel` ringkas per kartu (summarize helper) |

### 2.4 Routing & State

| Check | Status | Detail |
|---|---|---|
| Flag disimpan SEBELUM navigasi | ✅ | `markOnboardingSeen()` dipanggil sebelum `router.replace()` |
| `router.replace` bukan `push` | ✅ | Onboarding tidak di back stack |
| Gate `app/index.tsx` | ✅ | `<Redirect>` deklaratif berdasarkan `hasSeenOnboarding()` |
| Routes di-centralize | ✅ | `ROUTES` di `lib/routes.ts` |

### 2.5 Temuan Minor (bukan bug)

1. **Route `ROUTES.login` target belum ada** — Sudah terdokumentasi di `lib/routes.ts`. Akan ada saat screen #7 dibuat.

2. **`FadeIn` wrapping carousel** — Durasi "slow" (350ms) tepat untuk reveal pertama. Tidak ada masalah.

3. **`extraData={index}` di FlatList** — Perlu agar slide non-aktif re-render saat halaman berganti (karena `renderItem` menutup `index` lama). Sudah benar.

---

## 3. Audit Screen 2: Register

### File yang diaudit
- `app/(auth)/register.tsx` — route screen
- `components/register/otp-method-selector.tsx` — komponen pilihan OTP
- `components/register/use-otp-methods.ts` — hook fetch metode

### 3.1 Kontrak API

**`GET /v1/auth/otp-methods`:**
- Spec: `200: { description: "" }` (tidak ada schema response)
- Implementasi: `normalizeOtpMethods()` — toleran terhadap `[...]`, `{ methods: [...] }`, `{ data: [...] }`, array objek
- Fallback: `[...OTP_METHODS]` (= `["SMS", "WHATSAPP"]`) saat request gagal
- ✅ Benar: `source` diekspos untuk logging, UI tidak membedakan

**`POST /v1/auth/request-otp`:**
- Spec DTO: `RequestOtpDto { phoneNumber: string (max 20), method: "SMS" | "WHATSAPP" }` — required: `[phoneNumber, method]`
- Implementasi: `api.auth.requestOtp({ phoneNumber: toE164Id(digits), method })` 
- ✅ `phoneNumber` dikirim E.164 (`+62xxx`) — sesuai spec ("08xx or +628xx")
- ✅ `method` PERSIS enum `"SMS" | "WHATSAPP"`
- ✅ **TIDAK** mengirim `deviceId` — sesuai spec (DTO tidak punya field ini)

### 3.2 Design System Compliance

| Aspek | Status | Catatan |
|---|---|---|
| Header dengan progress bar | ✅ | `<Header title="Buat Akun" progress={1/4}>` — §9.22 bar tipis |
| H1 Sofia Sans 28/36 | ✅ | `<Heading level={1}>` — satu H1 di layar (header = H3) |
| Body text secondary | ✅ | `<Text variant="body" tone="secondary">` |
| PhoneInput Mono font | ✅ | JetBrains Mono, prefix +62, format "812-3456-7890" |
| Radio card variant | ✅ | `<OtpMethodSelector>` pakai `<RadioGroup variant="card">` |
| Ikon monokrom (§7) | ✅ | ChatText, WhatsappLogo — tone default, BUKAN warna brand |
| Alert danger | ✅ | `<Alert tone="danger">` untuk error generic |
| Alert dengan action | ✅ | Conflict → `TextLink` "Masuk dengan akun tersebut" |
| Footer border-t | ✅ | Manual `border-t border-border` — konsisten dengan slot footer Screen |
| Keyboard avoiding | ✅ | `<KeyboardAvoiding>` membungkus form + footer |
| Loading state | ✅ | `<Button loading>` + `<SkeletonGroup>` untuk OTP methods |

### 3.3 Validasi & Error Handling

| Skenario | Penanganan | Status |
|---|---|---|
| Nomor kosong | Error "Nomor HP wajib diisi." | ✅ |
| Nomor tidak valid | Error dengan panduan format | ✅ |
| Metode belum tersedia | Error "Metode pengiriman kode belum tersedia" | ✅ |
| 409 Conflict (nomor terdaftar) | Alert + link "Masuk" | ✅ |
| Validasi backend (field phone) | Error ditempel ke field | ✅ |
| Validasi backend (lain) | Alert generic | ✅ |
| Network error | `userMessage(err)` → pesan default per kode | ✅ |
| Error hilang saat user mengubah input | `setPhoneError(undefined)` di `handleDigits` | ✅ |
| Double-submit protection | `if (submitting) return` | ✅ |

### 3.4 State Management

| Aspek | Status | Detail |
|---|---|---|
| Default method = item pertama backend | ✅ | `useMemo` — bukan state, tidak ada frame "belum terpilih" |
| Method fallback saat refetch | ✅ | Kalau pilihan hilang dari daftar baru → jatuh ke pilihan pertama |
| Form error dismissal | ✅ | `onDismiss={() => setFormError(null)}` |
| Phone ref focus on error | ✅ | `phoneRef.current?.focus()` |

### 3.5 Aksesibilitas

| Check | Status | Detail |
|---|---|---|
| Header H3 + H1 konten = 2 heading logis | ✅ | Header = kerangka (H3), body = konten (H1) |
| PhoneInput a11y label | ✅ | `accessibilityLabel="Nomor HP"` |
| Error live region | ✅ | `<FieldHelper accessibilityLiveRegion="polite">` + iOS announce |
| Radio group role | ✅ | `accessibilityRole="radiogroup"` |
| Alert role | ✅ | `accessibilityRole="alert"`, danger = `assertive` |
| Skeleton SR | ✅ | `SkeletonGroup` → satu label "Memuat" |
| Button busy state | ✅ | `accessibilityState={{ busy: loading }}` |
| Form label required indicator | ✅ | "Nomor HP *" (asterisk merah) |

### 3.6 Temuan Minor (bukan bug)

1. **Progress 1/4 = 0.25** — Tepat karena registrasi HP = 4 langkah server-side (nomor → OTP → keamanan → data diri). Setup profil (#6) tidak dihitung karena terjadi SETELAH akun jadi.

2. **`edges={["top"]}`** — Bottom safe area di-handle manual di footer via `tokens.space[4] + insets.bottom`. Ini diperlukan agar footer berada DI DALAM `<KeyboardAvoiding>`.

3. **`safeArea={false}` di Header** — Screen sudah menambah paddingTop inset; kalau keduanya aktif, header turun dua kali. Sudah benar.

4. **`returnKeyType="done"` di PhoneInput** — Tepat untuk field tunggal, bukan "next" karena tidak ada field berikutnya di layar ini.

---

## 4. Audit Infrastruktur Pendukung

### 4.1 `lib/secure-storage.ts`

| Aspek | Status | Detail |
|---|---|---|
| Expo-secure-store | ✅ | Satu-satunya tempat menyentuh SecureStore |
| Key terpusat (`SecureKeys`) | ✅ | Tidak ada string bebas |
| Web fallback = memori | ✅ | Bukan localStorage (token tidak pernah plaintext di browser) |
| `clearSession()` pertahankan deviceId | ✅ | Backend pakai untuk mengenali perangkat |
| `onboardingSeen` di SecureStore | ✅ | Satu-satunya storage persisten yang tersedia |

### 4.2 `lib/api/session.ts`

| Aspek | Status | Detail |
|---|---|---|
| Access token cache | ✅ | Dibaca sekali, di-invalidate saat set/clear |
| `getDeviceId()` memoized | ✅ | Promise di-cache, retry bila SecureStore gagal |
| `getDeviceInfo()` max 512 | ✅ | `.slice(0, 512)` sesuai spec |
| Refresh token via cookie | ✅ | `credentials: "include"` — spec memang pakai cookie HttpOnly |
| Session expired listener | ✅ | Root layout bisa redirect ke login |

### 4.3 `lib/api/client.ts`

| Aspek | Status | Detail |
|---|---|---|
| Refresh single-flight | ✅ | `refreshInFlight` Promise — request paralel ikut refresh yang sama |
| `auth: "none"` untuk endpoint publik | ✅ | Login, register, OTP tidak memicu refresh loop |
| Header device di setiap request | ✅ | `X-Device-Id`, `X-Device-Info`, `X-App-Version`, `X-Platform` |
| Timeout 20s | ✅ | `API_TIMEOUT_MS = 20_000` |
| No retry POST | ✅ | Screen memutuskan retry manual |

### 4.4 `lib/api/errors.ts`

| Aspek | Status | Detail |
|---|---|---|
| Kode stabil (tidak bergantung wording) | ✅ | `NETWORK`, `TIMEOUT`, `VALIDATION`, `CONFLICT`, dll |
| NestJS error format | ✅ | `parseErrorBody` handle `message: string | string[]` |
| Default pesan bahasa Indonesia | ✅ | `DEFAULT_ERROR_MESSAGES` — formal, sesuai §12 |
| `userMessage()` smart | ✅ | Network/server → default; lain → message backend |

### 4.5 `lib/routes.ts`

| Aspek | Status | Detail |
|---|---|---|
| Centralized paths | ✅ | Satu tempat untuk semua path auth |
| Typed `Href` cast | ✅ | Terdokumentasi — hapus saat semua route ada |
| VerifyOtp params builder | ✅ | `phoneNumber` E.164 + `method` — persis yang dibutuhkan verify-otp |

### 4.6 `lib/onboarding.ts`

| Aspek | Status | Detail |
|---|---|---|
| Flag di SecureStore | ✅ | Bukan rahasia, tapi satu-satunya persistent storage |
| Error = false (no-op) | ✅ | Gagal baca flag → intro tampil lagi (safe default) |
| Tidak ikut `clearSession()` | ✅ | Logout bukan alasan untuk intro lagi |

---

## 5. Checklist Persiapan Screen Berikutnya

### Screen 3: OTP Verification

Endpoint: `POST /v1/auth/verify-otp`
```
VerifyPhoneOtpDto {
  phoneNumber: string     // E.164 dari route params (sama dengan yang dikirim ke request-otp)
  code: string            // 6 digit
  deviceId: string        // Auto-inject via withDevice()
  deviceInfo?: string     // Auto-inject via withDevice()
}
```

Response (UNVERIFIED — `VerifyOtpResult`):
- Sudah punya akun → `{ accessToken, ... }` (langsung simpan ke SecureStore)
- User baru → `{ isNewUser: true, tempToken: string }` (lanjut ke screen keamanan/data diri)

**Yang perlu disiapkan:**
- Komponen `<OtpInput>` (sudah ada di `components/ui/otp-input.tsx`)
- Komponen `<Countdown>` (sudah ada di `components/ui/countdown.tsx`)
- Route params: `phoneNumber` + `method` dari `ROUTES.verifyOtp()`

### Screen 4: Buat Keamanan (Password + PIN)

Field dari `PhoneRegisterDto`:
- `password`: minLength 12, maxLength 72, must contain uppercase + lowercase + digit + special
- `pin`: minLength 6, maxLength 6 (6 digit wallet PIN)

**Komponen yang sudah ada:**
- `components/ui/password-field.tsx`
- `components/ui/password-strength.tsx`
- `components/ui/pin-input.tsx`
- `components/ui/pin-pad.tsx`

### Screen 5: Data Diri

Field `PhoneRegisterDto` (sisanya):
- `tempToken`: dari verify-otp
- `fullName`: 2-60 char
- `username`: 3-30 char
- `dateOfBirth`: ISO 8601
- `gender`: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
- `email`: max 254 char
- `address?`: max 500 char
- `referralCode?`: max 20 char

Submit: `api.auth.phoneRegister(dto)` — auto-inject `deviceId`

---

## 6. Kesimpulan

Kedua screen (Onboarding + Register) sudah diimplementasikan dengan kualitas production-ready:

1. **Tidak ada bug** — logika routing, validasi, error handling, state management semua benar
2. **Design system v1.1 dipatuhi** — token, tipografi, spacing, warna, radius, motion
3. **API contract persis** — field name, enum values, required fields sesuai spec JSON
4. **deviceId utility sudah ada** — tidak perlu membuat baru; diimplementasikan di `lib/secure-storage.ts` + `lib/api/session.ts` dengan memoization dan error recovery
5. **Aksesibilitas diperhatikan** — hit targets, SR labels, live regions, Reduce Motion
6. **Kode terdokumentasi sangat baik** — setiap keputusan non-obvious dijelaskan dalam komentar

**Rekomendasi: lanjut ke Screen 3 (OTP Verification) tanpa perlu perbaikan di screen 1-2.**
