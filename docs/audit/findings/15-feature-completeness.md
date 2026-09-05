# Audit #15: Kelengkapan Fitur per Layar, Navigasi Orphan & Hardcode

**Tanggal audit:** 2026-09-05
**Branch:** `arena/01a06fa4-frontend`
**Cakupan:** SELURUH `app/` (79 → 81 route), `components/ui` yang terdampak, `lib/api/*`, `lib/routes.ts`, `lib/*` pendukung.
**Kontrak:** `docs/api/kahade-api-mobile.json` (OpenAPI; banyak respons `200: ""` tanpa schema → ditandai **UNVERIFIED** di kode).

---

## Ringkasan Eksekutif

**Status: ✅ `tsc --noEmit` 0 error · `check:tokens` OK · `check:a11y` OK · 0 route literal · 0 `Alert.alert` · 0 `console.log` · 0 format lokal manual di layar.**

Baseline (#14) sudah bersih dari hardcode dasar dan error TS, tetapi audit mendalam menemukan bahwa **kelengkapan fitur** jauh dari kontrak API:

| Kategori | Temuan (sebelum) | Sesudah |
|---|---|---|
| Navigasi | **36 route di `ROUTES` tidak pernah dirujuk** (layar ada tapi tidak bisa dicapai: KYC, 2FA, keamanan, sengketa, chat, showcase, referral, voucher, analitik, dsb.) | 0 orphan nyata (`settings` = tab; `phoneNumber/method` = field tipe param) |
| API tak dipakai | **73 fungsi `lib/api`** tanpa pemakaian UI, 8 di antaranya alur inti order (QRIS, resi, sengketa, perpanjangan, bukti kirim, order link) | 27 tersisa — semuanya wajar/internal (lihat §9) |
| Auth | Login menolak akun 2FA ("belum didukung") padahal `verify2faLogin` ada; gate `/` tidak cek sesi; OTP user lama → dilempar ke login; reset password tanpa umpan balik/resend | 2FA login lengkap (TOTP + backup code), gate sesi, welcome user lama, toast + cooldown resend, verifikasi email |
| Bug fungsional | Order detail: dialog Terima & Batalkan berbagi state; cancel selalu `MUTUAL_AGREEMENT`; hardcode PIN `"000000"` di subscriptions; `getMyAnalytics()` tanpa `period` (REQUIRED); `getMyQuestions()`/`getPublicRatings()` tanpa query REQUIRED; legal pages tidak scroll | Semua diperbaiki |
| Duplikasi | Dua store unread (`(tabs)/_layout` lokal vs `lib/unread-count.ts`) | Satu store; layar Notifikasi menurunkan badge seketika |
| Hardcode | Skema deep link `kahade://` literal di layar, `expo-image-picker` dipanggil langsung di tiap layar, alias status/metode bayar tersebar | `lib/deeplinks.ts`, `lib/image-picker.ts`, `lib/payment-methods.ts` |

---

## 1. Navigasi — 36 layar tanpa pintu masuk

**Akar masalah.** Layar dibuat per-audit sebelumnya, tetapi entry point (menu/tombol) tidak pernah ditambahkan; `ROUTES` memiliki kunci tapi tidak ada `router.push` yang memakainya.

**Perbaikan.**
- `app/(tabs)/settings.tsx` — MENU_GROUPS diperluas menjadi 8 grup: Akun (+KYC, Langganan, Referral, Bahasa), **Profil publik** (Showcase, Tanya Jawab, Ulasan, Lencana, Skor Kepercayaan, Analitik), **Transaksi** (Order Link, Template, Voucher, Sengketa, Favorit, Jelajahi), Keamanan (+2FA, Perangkat & Aktivitas, Privasi, Diblokir), Notifikasi, Bantuan (+Tiket Bantuan), Tentang, **Zona berbahaya** (Hapus Akun, `destructive`). `MenuItem.destructive` baru.
- `app/(tabs)/home.tsx` — komponen baru **`<QuickActionGrid>`** (`components/ui/quick-action-grid.tsx`): 8 pintasan (Isi Saldo, Order Link, Chat, Sengketa *dengan badge jumlah dari `summary.DISPUTED`*, Jelajahi, Voucher, Referral, Analitik).
- `app/(tabs)/wallet.tsx` — chip navigasi Riwayat Top-up / Riwayat Penarikan / Jadwal Penarikan.
- `app/(tabs)/transactions.tsx` — Header kanan: Template transaksi + Pencarian global.
- Order detail → Invoice, Chat, Perpanjang tenggat, Bukti kirim, Sengketa, Profil lawan (lihat §3).

---

## 2. Auth

| Layar | Sebelum | Sesudah |
|---|---|---|
| `login.tsx` | `requiresTwoFactor` → error "belum didukung" | simpan `tempToken` di `lib/two-factor-login.ts` (memori, **bukan** route param — kredensial), `push(ROUTES.verify2fa)` |
| **`(auth)/verify-2fa.tsx` (baru)** | — | `POST /v1/auth/2fa/verify-login` `{tempToken, code}`; mode TOTP 6 digit (`OtpInput`) / backup code 10–16 (`Input`), batas dari DTO; tempToken kedaluwarsa → arahkan login ulang |
| `index.tsx` | hanya cek onboarding | `getAccessToken()` ∥ `hasSeenOnboarding()` → home / login / onboarding |
| `verify-otp.tsx` | user lama → `ROUTES.login` (TODO) | → `ROUTES.welcome()` |
| `reset-password.tsx` | tanpa toast sukses, resend tanpa cooldown/umpan balik (2 TODO) | toast sukses → login; resend dengan `Countdown` 60 d + toast + reset OTP |
| `register.tsx` + `profile-data.tsx` | deep link `register?ref=` tidak dibaca | `setPendingReferralCode(ref)` (lib/registration) → prefill "Kode referral" di screen #5 |
| **`verify-email.tsx` (baru)** | `verifyEmail/resendVerification/correctEmail` tidak dipakai | OTP 6 digit + kirim/kirim ulang (cooldown) + sheet "Perbaiki alamat email" (`correct-email` dengan password). Entry: banner `Alert warning` di Edit Profil bila `me.emailVerified === false` |

Catatan: `app/(auth)/animated-splash` logo masih placeholder (aset `assets/images/logo-kahade.png` belum ada di repo) — di luar cakupan kode.

---

## 3. Order detail (`app/order/[id].tsx`) — ditulis ulang

**Sebelum:** bayar hanya saldo; batalkan hardcode `reason: MUTUAL_AGREEMENT`; dialog Terima & Batalkan **berbagi satu state** (bug: konfirmasi salah aksi); tanpa QRIS, sengketa, resi, invoice, chat, perpanjangan, bukti kirim.

**Sesudah:**
- Bayar: BottomSheet dengan `SegmentedControl` **Saldo** (PIN → `payOrder`; PIN salah → `errorText` PinInput) / **QRIS** (`payOrderQris` → `QRCodeDisplay` + polling `getPaymentStatus` tiap 3 d, `clearInterval` saat unmount/tutup; EXPIRED/FAILED → "Buat Ulang QRIS").
- Batalkan: `ReasonPicker` dengan enum `CancelOrderDto.reason` (OTHER wajib catatan ≤500).
- Penjual: Terima (dialog terpisah) / Tolak (`confirmOrder REJECT` + alasan) / Proses / **Resi** (`updateShipping`; wajib jika `orderType === PHYSICAL_GOODS`) / Unggah bukti kirim.
- Pembeli: Tandai selesai, Periksa bukti kirim, **Ajukan sengketa** (`submitDispute`, klaim ≥20), Beri ulasan (COMPLETED).
- Sekunder: Invoice, Chat (cari room via `listChatRooms().find(r => r.orderId === id)` — **tidak ada endpoint buat ruang** di spec), Perpanjang tenggat (PAID/PROCESSING/SHIPPED), Lihat sengketa (DISPUTED), profil lawan.
- Timeline: `expectedNext` dari `getAverageDurations()` — **asumsi**: `Record<status, jam>`, key = status berikutnya (UNVERIFIED).

`QrisPayment`/`PaymentStatus` tipe lokal UNVERIFIED (spec tanpa schema).

---

## 4. Perpanjangan tenggat (`app/extension/[orderId].tsx`) — ditulis ulang

Sebelum: hanya daftar (limit 50 hardcode) + respon pembeli; **penjual tidak bisa mengajukan** (`requestExtension` tidak dipakai). Sesudah: penjual → BottomSheet `NumberStepper` 1–14 hari + alasan 10–500 (batas dari `RequestExtensionDto`), pratinjau tenggat baru; disembunyikan bila ada PENDING atau status di luar PAID/PROCESSING/SHIPPED. Paginasi 20 + `LoadMore`. Peran dari `myRole`, fallback bandingkan `me.id` dengan `seller.id/buyer.id`.

---

## 5. Notifikasi

- **Store unread tunggal** — `app/(tabs)/_layout.tsx` kini `useUnreadCount()` dari `lib/unread-count.ts` (hapus hook lokal duplikat 40 baris). Tandai dibaca / semua dibaca → `refreshUnreadCount()` / `setUnreadCount(0)` → badge tab turun seketika.
- **Tap notifikasi membuka entitas** — modul baru `lib/notification-routing.ts` (`routeForNotificationReference`, `routeForPushData`): pemetaan tunggal `referenceType/referenceId` → `ROUTES.*` (order, order-link, dispute, wallet tx, chat room, tiket, profil, KYC, langganan, referral, ulasan, keamanan). Dipakai list Notifikasi **dan** tap push (`subscribeNotificationOpened` baru di `lib/push-notifications.ts`, termasuk cold start via `getLastNotificationResponseAsync`, diproses sekali). Bentuk referensi **UNVERIFIED** — pencocokan toleran (case/underscore).
- Fitur baru sesuai spec: filter **Belum dibaca** (`isRead=false`), long-press → ActionSheet (tandai dibaca / pilih beberapa / hapus `DELETE /notifications/{id}` optimistic+rollback), **mode pilih** maks 50 (`BatchNotificationIdsDto`) → `read-batch` / `delete-batch`, menu ⋮ → **Hapus yang sudah dibaca** (`delete-read`).

---

## 6. Profil publik & konten saya

| Layar | Perubahan |
|---|---|
| `ratings.tsx` | Segmen **Diterima / Diberikan**; balas, **ubah balasan** (`PUT /ratings/replies/{replyId}`), **hapus balasan**, **ubah ulasan saya** (`PUT /ratings/{id}` via `RatingForm editing`); paginasi. Arah dari `direction`/`isMine`, fallback `authorId/authorUsername` vs `me`. Edit/hapus balasan hanya bila `replyId` ada (UNVERIFIED). |
| `user/[username]/ratings.tsx` | Query REQUIRED `page&limit&filter` kini dikirim; chip filter Semua/Positif/Negatif/Berkomentar — **nilai `filter` asumsi** (spec tanpa enum). |
| `questions.tsx` | `GET /users/me/questions` **wajib `type,page,limit`** (dulu tanpa query → pasti 400); segmen received/asked (nilai `type` asumsi dari summary), hapus pertanyaan, paginasi; batas jawaban dari `AnswerQuestionDto`. |
| `user/[username]/questions.tsx` | `page&limit` REQUIRED dikirim; komentar dipaginasi; **hapus pertanyaan/komentar milik saya**; `AddCommentDto` (content ≤1000, `parentId?`); min pertanyaan 5 (`AskQuestionDto`) bukan 10. |
| `showcase.tsx` | `createShowcase/updateShowcase` (dulu tak dipakai): unggah → bila respons bukan item → form judul/deskripsi/harga (`AmountInput`, validasi max ≥ min) → `createShowcase`; tap item → ActionSheet **Ubah detail / Sembunyikan-Tampilkan (`isActive`) / Hapus**. Tipe `ShowcaseItem` diselaraskan ke DTO. Reorder manual (`sortOrder`) → backlog. |
| `badges.tsx` | Gabung **katalog `GET /badges`** + `GET /badges/my` (dulu hanya "my" → lencana terkunci tak pernah tampil); paginasi katalog berurutan (limit 100 = max spec); urut diraih → progres. |
| `privacy-settings.tsx` | **Minta salinan data** (`POST /settings/privacy/export`, `exportPrivacy` dulu tak dipakai); respons UNVERIFIED: `url` → buka browser, selain itu pesan diproses. |
| `dispute/[id].tsx` | Log panggilan kini punya aksi **Terima/Tolak** (permintaan lawan) dan **Akhiri/Batalkan** (`/call/accept|reject|end`, dulu tak dipakai). Tanpa sesi WebRTC di app (react-native-webrtc terpasang tapi tidak ada layar/signaling di spec). |
| `create-transaction.tsx` | Sheet **Skema biaya platform** (`GET /public/fee-schedule`, dulu tak dipakai) — transparansi tier sebelum memilih pembayar biaya. |
| `terms.tsx`, `privacy-policy.tsx` | `Screen scroll` — sebelumnya konten terpotong di layar kecil. Teks = ringkasan; spec tanpa endpoint legal → butuh versi final tim legal. |

---

## 7. Perubahan sebelumnya dalam audit ini (ringkas, sudah di tree)

- **Keamanan akun:** `two-factor.tsx` (setup/enable/disable/backup codes), `biometric-settings.tsx`, `delete-account.tsx` (`DeleteAccountForm`), `change-pin.tsx`, `security.tsx` (sesi + log; `action` REQUIRED tanpa enum → asumsi `"ALL"`; trust/untrust device), `edit-profile.tsx` (avatar hapus, social links `getLinks/updateLinks`).
- **Dompet:** `withdraw.tsx` (cancel penarikan), `transfer.tsx` (verifikasi PIN dompet; tidak auto-copy txId), `topup.tsx` (STATUS_MAP alias asumsi), `lib/payment-methods.ts` mapper tunggal.
- **KYC:** `kyc.tsx` + `lib/api/kyc.ts` (resubmit; enum status KYC tidak ada di spec → alias map; `KycDocumentViewer` tidak dipakai karena spec tidak mengembalikan URL dokumen).
- **Analitik/Trust/Referral/Langganan:** `period` REQUIRED (asumsi 7d/30d/90d/1y); trust endpoint PATCH; referral `applyReferralCode` (kelayakan di backend); subscriptions: **hapus hardcode PIN `"000000"`**, `paymentMethod` bertipe `SubscribeDto["paymentMethod"]`, history/renew, `planPeriod` fallback `durationDays ≥ 300`, EXPIRED bila `!active && expiresAt`.
- **Transaksi:** `create-transaction.tsx` kini navigasi ke detail & bisa **buat Order Link** (`createOrderLink`), voucher hanya untuk order langsung; `order-links.tsx` share via `lib/deeplinks.ts`.
- **Profil publik `user/[username].tsx`:** follow/unfollow, share, CTA transaksi, tab showcase/ulasan/Q&A; tidak ada endpoint is-following → fallback; hitungan followers = halaman pertama; `GET /users/{username}` respons kosong di spec.
- **Sengketa `dispute/[id].tsx`:** DTO propose/respond/message/call **kosong di spec** → body lokal UNVERIFIED; role tidak lagi hardcode buyer; bukti via `MediaViewer` (baru, tanpa pinch-zoom; PDF via `Linking`); composer pesan; hapus bukti; mutual resolution propose/respond/withdraw.
- **Bukti kirim `delivery-proof/[orderId].tsx`:** sisi penjual (unggah, deskripsi ≥10, `fileUrls` = S3 key) + pembeli (konfirmasi/tolak ≥10).
- **Chat:** `lib/api/chat.ts` — pesan memakai **cursor/limit/excludeIds** sesuai spec (dulu `page/before` salah); bentuk respons tidak didokumentasikan → normalisasi `array | {items,nextCursor}`; rooms `page/limit`; lampiran (`uploadChatAttachment`); hapus pesan.
- **lib baru:** `image-picker.ts` (satu-satunya pemanggil `expo-image-picker`), `deeplinks.ts` (satu-satunya literal skema), `payment-methods.ts`, `format.ts` (+`formatDecimal`), `lib/api/transaction-templates.ts` (UNVERIFIED).

---

## 8. Asumsi yang perlu konfirmasi backend (semua ditandai `UNVERIFIED` di kode)

1. `GET /v1/orders/average-durations` → `Record<status, jam>`; key = status berikutnya.
2. `POST /v1/orders/{id}/pay/qris` & `GET /pay/status` → `{qrString, expiresAt, amount}` / `{status}`.
3. `GET /v1/users/me/questions?type=` → nilai `received | asked`.
4. `GET /v1/users/{username}/ratings?filter=` → nilai `all | positive | negative | with_comment`.
5. `GET /v1/analytics/me?period=` → `7d | 30d | 90d | 1y`.
6. `GET /v1/security/log?action=` → `"ALL"` untuk semua.
7. Referensi notifikasi (`referenceType/referenceId`) & payload push `data`.
8. `POST /v1/settings/privacy/export` → `{url}` vs pesan.
9. `POST /v1/users/me/showcase/upload` → item lengkap vs `{imageUrl}`.
10. Field `replyId`, `direction/isMine` pada rating; `target` pada pertanyaan "asked"; `authorId` pada komentar.
11. Dispute: body `MutualResolutionProposeDto/RespondDto/DisputeMessageDto/CallActionDto` kosong di spec.
12. Status KYC & metode top-up: alias map lokal.
13. Tidak ada endpoint: buat ruang chat per order, is-following, dokumen legal, dokumen KYC (URL), signaling WebRTC.

---

## 9. API yang masih tidak dipakai UI (27) — dinilai wajar

- **Internal/infra:** `getCsrfToken`, `generateCaptcha`, `normalizeOtpMethods`, `getPublicConfig`, `resolve*Deeplink` (5; resolusi dilakukan oleh backend saat link universal — belum ada handler `Linking` di app → backlog), `requestPresignedUrl/putToPresignedUrl/confirmUpload/uploadDirect/cleanupUploads/fileKeyToUrl` (dipakai lewat `uploadPresigned`).
- **Tanpa UI yang masuk akal:** `verifyEmailByLink` (varian tautan email — perlu handler universal link), `verifyPassword` (dipakai backend sebelum aksi sensitif; app memakai form password langsung), `getMyDashboard` (respons `Record<string, unknown>` tanpa schema — analitik sudah memakai `/analytics/me`), `getExchangeRates` (tidak ada fitur multi-mata uang), `getChatAttachments` (lampiran sudah inline di pesan), `getNotification` (detail = item list), `getTransactionTemplate` (list sudah membawa detail), `getFeeSchedule` kini dipakai.

---

## 10. Backlog lanjutan (di luar cakupan / butuh keputusan)

- Handler **universal link / `Linking.getInitialURL`** → `resolve*Deeplink` (butuh domain & konfigurasi asosiasi app).
- **Reorder showcase** (`sortOrder`) dengan drag.
- **WebRTC** panggilan sengketa (butuh signaling di spec).
- Konten legal final; aset logo splash.
- `lib/api/config.ts` host staging/prod (TODO backend, sengaja dibiarkan).

---

## Verifikasi

```bash
npx tsc --noEmit          # 0 error
npm run check:tokens      # OK
npm run check:a11y        # OK (288 file)
grep -rn "Alert\.alert\|console\.log" app components lib --include=*.ts*   # hanya komentar
grep -rln "expo-image-picker" app components lib   # lib/image-picker.ts (+1 komentar)
grep -rn "kahade://" app components lib | grep -v lib/deeplinks.ts          # hanya komentar
```
