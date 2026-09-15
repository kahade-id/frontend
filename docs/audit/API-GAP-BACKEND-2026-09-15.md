# Audit Gap Frontend ↔ Backend — 2026-09-15

**Pertanyaan:** endpoint backend mana yang belum terhubung ke aplikasi mobile?
**Sumber data:**
- Backend: ekstraksi route langsung dari 48 controller NestJS di `kahade-id/backend` @ `dbfa1ff` (main), termasuk inheritance `WithdrawalsControllerBase`.
- Frontend: `docs/audit/inventory.json` (`npm run audit:inventory`) — 238 pemanggilan adapter di `lib/api/*`, 91 layar.

> Angka di bawah hasil pembandingan statis method+path (param dinamis
> dinormalisasi `:id` ↔ `{id}`, slash akhir dibuang, global prefix `/v1`).
> Bukan verifikasi live — verifikasi autentik tetap via `npm run verify:api`
> terhadap backend yang hidup.

---

## 1. Ringkasan eksekutif

| Metrik | Nilai |
|---|---|
| Total route backend saat ini | **454** = 326 mobile + 128 admin |
| Pemanggilan adapter frontend (unik method+path) | **238** (+2 out-of-band: `auth/refresh`, presigned upload) |
| Pemanggilan frontend yang **TIDAK ada** di backend | **0** ✅ — tidak ada fitur yang rusak karena backend berubah |
| Route mobile backend yang **TIDAK dipanggil** aplikasi | **86** (dari 326) = **26,4 %** permukaan mobile belum terhubung |
| Spec di repo (`docs/api/kahade-api-mobile.json`) | 225 path / **260 operasi** — **basi** terhadap backend (322 route mobile) |

**Kesimpulan:** tidak ada pemanggilan yang "mati" — semua 238 adapter masih
valid. Yang terjadi adalah **backend bertambah ±62 operasi baru** sejak spec
di-export, dan dari total permukaan mobile, **86 route belum punya koneksi UI
aplikasi** — terkonsentrasi di beberapa fitur (chat lanjutan, showcase sosial,
profil sosial, business verification, jadwal withdraw, langganan, tiket support).

---

## 2. 86 route mobile belum terhubung, per fitur

Klasifikasi:
- **[FITUR HILANG]** — backend menyediakan, aplikasi tidak punya UI/koneksi sama sekali.
- **[TIDAK DIPAKAI SAJA]** — ada alternatif yang sudah dipakai aplikasi, atau sengaja dilewati.
- **[ALIAS BAKU]** — backend punya prefix baru; aplikasi masih memakai prefix lama (tetap valid).

### 2.1 Chat — 16 route `[SELESAI P1 — sesi ini]`

Sebelumnya aplikasi hanya: list pesan, kirim pesan, tanda-baca, hapus pesan,
upload lampiran (5 endpoint). Backend menyediakan lapisan sosial penuh. **Putaran
P1 (sesi ini) mengoneksikan ke-16 route:** 13 terwiring UI (reaksi, pin, edit,
forward, read-receipt, presence, mute, arsip, inquiry) + 3 adapter-ready
(global search, in-room search, tandai-baca per-pesan). Detail di §7.


| Method + path | Fungsi |
|---|---|
| `POST /v1/chat/rooms/{roomId}/messages/{messageId}/reactions` | beri reaksi emoji |
| `DELETE /v1/chat/rooms/{roomId}/messages/{messageId}/reactions/{emoji}` | tarik reaksi |
| `POST /v1/chat/rooms/{roomId}/messages/{messageId}/pin` + `DELETE …/pin` | pin pesan |
| `GET /v1/chat/rooms/{roomId}/pins` | daftar pin |
| `POST /v1/chat/rooms/{roomId}/messages/{messageId}/forward` | forward pesan |
| `PATCH /v1/chat/rooms/{roomId}/messages/{messageId}` | edit pesan |
| `POST /v1/chat/rooms/{roomId}/messages/{messageId}/read` | read-receipt per pesan |
| `GET /v1/chat/rooms/{roomId}/read-receipts` | siapa-siapa yang sudah baca |
| `GET /v1/chat/rooms/{roomId}/presence` | presence online |
| `POST /v1/chat/rooms/{roomId}/typing` | indikator mengetik |
| `POST /v1/chat/rooms/{roomId}/messages/{messageId}/read` | tandai pesan dibaca |
| `GET /v1/chat/rooms/{roomId}/search` + `GET /v1/chat/search` | cari pesan |
| `PUT /v1/chat/rooms/{roomId}/archive` + `PUT …/mute` | arsip/bisukan room |
| `POST /v1/chat/inquiries` | mulai chat "inquiry" (mis. dari pesanan) |

Catatan: backend juga punya gateway WebSocket (`src/modules/realtime`) —
streaming realtime bukan bagian audit REST ini; chat aplikasi saat ini berbasis
polling REST.

### 2.2 Profil sosial & perangkat — 22 route

| Method + path | Klasifikasi |
|---|---|
| `GET/POST/DELETE /v1/users/{username}/saved` (3) | FITUR HILANG — "simpan postingan" |
| `POST/DELETE /v1/users/{userId}/block` (2) | TIDAK DIPAKAI SAJA — aplikasi memakai `settings/block/{userId}` (duplikat endpoint di backend) |
| `POST /v1/users/{userId}/report` | FITUR HILANG — laporkan pengguna |
| `GET /v1/users/search` | FITUR HILANG — cari pengguna |
| `GET /v1/users/{username}/badges` | FITUR HILANG — badge di profil publik |
| `GET /v1/users/{username}/og` | TIDAK DIPAKAI SAJA — untuk preview kartu sosial (OG), bukan UI app |
| `GET /v1/users/me/devices` | TIDAK DIPAKAI SAJA — app memakai `sessions` + `users.me.devices` (trust/untrust) |
| `DELETE /v1/users/me/devices/{deviceId}` | FITUR HILANG — hapus satu perangkat (app hanya punya hapus-satu-sesi & logout-seluruhnya-lain) |
| `PUT /v1/users/me/avatar`, `PUT /v1/users/me/header` (2) | TIDAK DIPAKAI SAJA — disengaja; app memakai `updateProfile` (lihat komentar `lib/api/users.ts`) |
| `POST /v1/users/me/showcase/{id}/images`, `DELETE /v1/users/me/showcase/images/{imageId}`, `PUT /v1/users/me/showcase/{id}/images/order` (3) | FITUR HILANG — kelola banyak gambar per showcase |
| `POST/DELETE /v1/users/questions/{questionId}/upvote` (2) | FITUR HILANG — upvote tanya-jawab |
| `POST /v1/users/questions/{questionId}/hide` + `unhide` (2) | FITUR HILANG — sembunyikan tanya-jawab |
| `POST /v1/users/comments/{commentId}/hide` + `unhide` (2) | FITUR HILANG — moderasi komentar |

### 2.3 Showcase sosial — 12 route `[FITUR HILANG]`

App hanya memakai showcase CRUD lama (`users/me/showcase/*`). Backend menambah
permukaan sosial baru:

`GET /v1/showcase/feed`, `GET /v1/showcase/{showcaseId}`,
`GET /v1/showcase/{showcaseId}/comments`, `POST /v1/showcase/{showcaseId}/comments`,
`GET /v1/showcase/{showcaseId}/share`, `POST/DELETE /v1/showcase/{showcaseId}/like` (2),
`POST /v1/showcase/{showcaseId}/report`, `PATCH /v1/showcase/comments/{commentId}`,
`POST /v1/showcase/comments/{commentId}/hide` + `unhide` (2),
`DELETE /v1/showcase/comments/{commentId}`.

### 2.4 Wallet — 5 route

| Method + path | Klasifikasi |
|---|---|
| `GET/POST /v1/wallet/favorite-recipients` (2), `DELETE …/{id}` | FITUR HILANG — penerima favorit |
| `GET /v1/wallet/export` | TIDAK DIPAKAI SAJA — app memakai `export/csv` + `export/pdf` |
| `GET /v1/wallet/export/html` | TIDAK DIPAKAI SAJA — format cadangan backend |

### 2.5 Business verification — 4 route `[FITUR HILANG]`

`POST /v1/business-verification/submit`, `GET …/status`, `GET …/history`,
`POST …/resubmit` — fitur verifikasi usaha belum ada di aplikasi.

### 2.6 Jadwal penarikan — 4 route `[ALIAS BAKU]`

Backend memindahkan ke prefix baru `scheduled-withdrawals` (tetap alias di
`withdrawals` via class base). Aplikasi masih memanggil alias lama
`/v1/withdrawals/schedules*` (POST/PUT/DELETE) — **masih valid**, tapi:
- alias lama bisa dihapus backend kapan-kapan → migrasikan adapter ke
  `/v1/scheduled-withdrawals/schedules*`;
- `GET /v1/scheduled-withdrawals/schedules` (list jadwal) tidak dipanggil —
  tidak ada UI daftar jadwal.

### 2.7 Langganan — 3 route `[FITUR HILANG]`

`POST /v1/subscriptions/pause`, `POST …/resume`, `POST …/upgrade` —
app hanya subscribe/renew/cancel/status.

### 2.8 Tiket support — 3 route `[FITUR HILANG]`

`POST /v1/support/tickets/{ticketId}/close`, `…/reopen`, `…/rate` —
app hanya buat tiket, lihat detail, balas.

### 2.9 Lainnya — 17 route

| Method + path | Klasifikasi |
|---|---|
| `POST /v1/auth/social-login` | FITUR HILANG — login Google/Apple belum di-UI |
| `PATCH /v1/bank-accounts/{id}` | FITUR HILANG — edit rekening (app hanya tambah/hapus/set-primary) |
| `GET /v1/config/exchange-rates` | FITUR HILANG — kurs (untuk tampilan konversi?) |
| `GET /v1/deeplinks/showcase/{showcaseId}` | FITUR HILANG — deep link showcase (app sudah punya deep link order/profil/user) |
| `POST /v1/disputes/{disputeId}/escalate` | FITUR HILANG — eskalasi sengketa oleh pengguna |
| `POST /v1/help-center/items/{id}/feedback` | FITUR HILANG — umpan balik artikel bantuan |
| `GET /v1/orders/{orderId}/invoice/pdf` | FITUR HILANG — invoice PDF (app memakai `invoice` HTML) |
| `POST /v1/ratings/{ratingId}/helpful` | FITUR HILANG — tombol "berguna" |
| `DELETE /v1/ratings/{ratingId}` | FITUR HILANG — hapus rating sendiri |
| `POST /v1/transaction-templates/{id}/use` | FITUR HILANG — pakai template → transaksi |
| `GET /v1/referral/leaderboard` | FITUR HILANG — papan peringkat referral |
| `GET /v1/search/history` | FITUR HILANG — riwayat pencarian |
| `GET /v1/search/history/clear` | FITUR HILANG — hapus riwayat pencarian |
| `GET /v1/settings/blocked-users` | FITUR HILANG — daftar pengguna yang diblokir |
| `DELETE /v1/sessions` | TIDAK DIPAKAI SAJA — app memakai `DELETE /v1/sessions/others` (fungsi setara) |
| `GET /v1/sessions/devices` | TIDAK DIPAKAI SAJA — app memakai `users.me.devices` |
| `GET /v1/app/version` | TIDAK DIPAKAI SAJA — versi app dibaca dari konstanta Expo |

**Total: 16 + 22 + 12 + 5 + 4 + 4 + 3 + 3 + 17 = 86.** Dari 86: 64 fitur hilang
sebenarnya, 22 sengaja tidak dipakai/ada alternatif (termasuk 4 alias
scheduled-withdrawals yang tetap valid).

Daftar mesin-baca: `gap-missing.json` (86 route), `backend-mobile.json` (322),
`frontend-calls.json` (238) di root workspace.

---

## 3. Spec basi di repo frontend

`docs/api/openapi.json` + `kahade-api-mobile.json` (225 path / 260 operasi)
di-export dari backend versi lama. Backend sekarang punya **322 route mobile**.
Konsekuensi:

1. `lib/api/types.ts` (generated) tidak punya DTO operasi baru (showcase sosial,
   chat reactions, business verification, scheduled-withdrawals, …) —
   menambah koneksi fitur baru **wajib** regenerasi spec dulu.
2. `npm run check:spec` membandingkan adapter terhadap spec lama, bukan
   terhadap backend sebenarnya.

**Regenerasi** (butuh mesin yang bisa menjangkau `binaries.prisma.sh` —
sandbox ini terblok di TLS):
```bash
cd backend && npx prisma generate && npm run openapi:generate
cp openapi.json <frontend>/docs/api/openapi.json
cd frontend && npm run gen:api
```

## 4. Temuan tambahan (di luar angka 86)

- **Duplikasi endpoint blokir pengguna:** `settings/block/{userId}` (dipakai app)
  vs `users/{userId}/block` (baru). Sebaiknya backend alias-kan salah satu atau
  frontend migrasi ke satu.
- **Alias jadwal withdraw** (§2.6) — risiko break sepih jika alias dihapus.
- **Realtime:** `realtime.gateway.ts` (WebSocket) tersedia di backend; chat app
  masih polling REST. Jika target UX-nya realtime, ini workstream terpisah
  dari 86 route REST di atas.
- **2 pemanggilan out-of-band** (bukan via adapter) sudah tercatat di
  `inventory.json`: `POST /v1/auth/refresh` (single-flight di `client.ts`) dan
  PUT presigned ke object storage — keduanya memang tidak lewat `http.*`.

## 5. Rekomendasi urutan koneksi (prioritas)

| Prioritas | Klaster | Route | Alasan |
|---|---|---|---|
| **P0 — SELESAI (sesi ini)** | Migrasi alias `withdrawals/schedules` → `scheduled-withdrawals` (UI list jadwal sudah ada di `app/withdrawal-schedules.tsx`) | 4 | Risiko break sepih; fitur uang |
| **P0 — SELESAI (sesi ini)** | Business verification (submit/status/history/resubmit) + layar + entry menu | 4 | Alur uang (merchant) |
| **P1 — SELESAI (sesi ini)** | Chat lanjutan (edit, reactions, pin, read-receipt, typing, search, mute/archive, inquiry, presence, forward) | 16 | Permukaan terbesar |
| P1 | Showcase sosial (feed, like, komentar, laporkan) | 12 | Fitur sosial utama |
| P1 | Profil sosial (saved, report user, cari user, upvote, moderasi) | 22 (−7 non-fitur) | Kelengkapan profil |
| P2 | Wallet favorite recipients + export html | 3 | Kewenangan transaksi |
| P2 | Langganan pause/resume/upgrade | 3 | Revenue |
| P2 | Support close/rate/reopen, ratings helpful/delete, dispute escalate, invoice PDF, search history, referral leaderboard, blocked users, bank account edit, template use, social login, deep link showcase, help-center feedback, exchange-rates, hapus satu perangkat | 19 | Poles |

## 6. Putaran P0 — yang dikerjakan sesi ini (2026-09-15)

### 6.1 Spec di-regenerasi dari backend saat ini

`docs/api/openapi.json` kini hasil `npm run openapi:generate` dari
`kahade-id/backend` @ main (400 path / 458 operasi / 138 skema), bukan export
lama. Spec mobile ikut (`gen:api`): **283 path / 105 DTO** (sebelumnya 225/87).
Selisih operasi lama→baru: **0 operasi lama hilang, 94 operasi baru** masuk.

Dampak regenerasi terhadap kode frontend (drift nyata, sudah diperbaiki):
1. `SubmitDisputeDto` kini **membutuhkan `category`** (enum 8 nilai). Sheet
   "Ajukan sengketa" di `app/order/[id].tsx` dulu hanya mengirim `{ claim }` —
   pasti 400 di server. Ditambahkan `RadioGroup` kategori + validasi.
2. DTO showcase di-rename backend: `CreateShowcaseDto`→`CreateShowcaseItemDto`,
   `UpdateShowcaseDto`→`UpdateShowcaseItemDto`, dan `imageUrl`→`imageFileKeys`
   (alur presigned `SHOWCASE_IMAGE`). `lib/api/users.ts` + `app/showcase.tsx`
   diselaraskan (upload → ambil `fileKey` → `imageFileKeys: [fileKey]`).
3. Enum `purpose` upload dilengkapi (11 nilai, dulu 7) — `BUSINESS_DOCUMENT`
   kini bagian dari tipe generated, tidak perlu cast.

### 6.2 Migrasi alias scheduled-withdrawals

`lib/api/withdrawals.ts` dipindah dari `/v1/withdrawals/schedules*` ke
`/v1/scheduled-withdrawals/schedules*` (prefix yang diumumkan backend; alias
lama masih dijaga via `WithdrawalsControllerBase` tapi bisa dihapus).
UI (list/buat/edit/hapus jadwal) sudah ada di `app/withdrawal-schedules.tsx` —
cukup path yang berubah.

### 6.3 Business verification (fitur baru penuh)

- `lib/api/business-verification.ts` — status/history/submit/resubmit,
  normalisasi status di satu tempat (mirip `kyc.ts`).
- `app/business-verification.tsx` — layar `<DataScreen>`: kartu status
  (memakai `KycStatusCard`), form (nama badan usaha, NPWP 15/16 digit,
  akta|SIUP minimal satu, 1–5 foto dokumen maks 10MB), riwayat, dan gerbang
  UI untuk akun non-BUSINESS (penunjuk ke layar Tipe Akun).
- Entry: menu `Pengaturan → Verifikasi Bisnis` + `ROUTES.businessVerification`
  + proteksi layar.
- Upload: `api.upload.uploadPresigned("BUSINESS_DOCUMENT", …)` (jpg/png;
  backend juga menerima PDF/webp, tapi picker repo berbasis
  expo-image-picker — sama seperti alur KYC & bukti sengketa).

### 6.4 Bug backend yang ditemukan (perbaikan di repo backend)

1. **`orders.service.ts:703` — regex tidak valid (SyntaxError saat modul
   dimuat).** Commit `d94be53` ("51+ audit fixes") meng-over-escape range
   Unicode sehingga `/[\u0000-\u001F\u007F\u200E\u200F\u202A-\\u202E\\u2066-\\u2069]/g`
   melempar `Range out of order in character class` — modul orders (dan
   seluruh app yang mem-importnya) tidak bisa boot. Dikembalikan ke baris
   produksi asli (`f2958d0`).
2. **`openapi:generate` kehilangan metadata DTO tanpa `@ApiProperty`**
   (jalankan dengan `ts-node --transpile-only` → `design:type` tidak
   ter-emit). Terlihat pada `RequestPhoneChangeDto`/`ConfirmPhoneChangeDto`
   yang jadi kosong di spec. Diperbaiki dengan `@ApiProperty` eksplisit di
   kedua DTO itu.
3. Catatan: Prisma `prisma generate` tidak bisa jalan di sandbox
   (binaries.prisma.sh ter-blok); generasi spec di sandbox memakai stub
   client Prisma (hanya node_modules, tidak di-commit). Di mesin normal,
   `npx prisma generate && npm run openapi:generate` tanpa stub.

**Status:** perbaikan sudah di-commit di `kahade-id/backend` @
`arena/fix-orders-regex-esc` (commit `b2f66a2`), tetapi bot Arena **tidak
punya akses push** ke repo backend (403). Patch diikutkan di repo frontend:
`docs/audit/backend-fix-regex-and-dto.patch` — terapkan di repo backend:
```bash
git am docs/audit/backend-fix-regex-and-dto.patch
```
(atau beri bot akses push, lalu `git push origin arena/fix-orders-regex-esc`).

### 6.5 Verifikasi

`typecheck`, `lint`, `check:spec`, `check:api`, `check:inventory`,
`check:screens`, `check:a11y`, `test` (123 test) — **hijau**.
`npm run check` (penuh) **terhenti di `check:tokens` — 12 masalah yang sudah
ada di main** (sebelum perubahan sesi ini; diverifikasi dengan `git stash`):
`components/ui/amount-keypad.tsx` (10× inline style literal),
`components/ui/home-overview-card.tsx` + `components/ui/order-card.tsx`
(×`dark:`/warna literal di luar token). Bukan caused-by sesi ini; perlu
keputusan desain (token vs allowlist) oleh pemilik UI.

**Gap fitur tersisa: 78 dari 86** — 4 business verification + 4 prefix
`scheduled-withdrawals` kini terhubung. (Catatan hitungan: 4 route alias lama
`/v1/withdrawals/schedules*` kini memang TIDAK dipanggil lagi — sengaja, alias
yang sudah didepresiasi; backend memaparkannya dua kali, jadi total route
"tidak dipanggil" secara literal tetap 84, bukan 78.)

### 7.1 Adapter — ke-16 route kini dipanggil (`lib/api/chat.ts`)

| Route | Fungsi | Status UI |
|---|---|---|
| `POST /v1/chat/inquiries` | `createInquiry` — ruang pra-transaksi | ✅ tombol Chat di profil pengguna → sheet (subjek + pesan) → masuk room |
| `GET /v1/chat/search` | `searchAllMessages` | adapter-ready (UI pencarian belum) |
| `GET /rooms/{id}/search` | `searchRoomMessages` | adapter-ready (UI pencarian belum) |
| `PATCH …/messages/{id}` | `editChatMessage` | ✅ menu pesan → "Edit pesan" (teks sendiri, sheet + TextArea) |
| `POST …/reactions` | `addReaction` | ✅ sheet emoji cepat (6 emoji) + ketuk chip reaksi |
| `DELETE …/reactions/{emoji}` | `removeReaction` | ✅ ketuk lagi chip reaksi yang sudah aktif |
| `POST …/pin` | `pinChatMessage` | ✅ menu pesan → "Pin pesan" + baris pin di atas thread |
| `DELETE …/pin` | `unpinChatMessage` | ✅ "Lepas pin" |
| `GET …/pins` | `getPinnedMessages` | ✅ baris chip pin (tap → menu pesan) |
| `POST …/forward` | `forwardChatMessage` | ✅ "Teruskan" → pilih room lain dengan lawan bicara sama |
| `PUT …/archive` | `setRoomArchived` | ✅ tekan-lama room → Arsipkan/Buka arsip (room terarsip disembunyikan) |
| `PUT …/mute` | `setRoomMuted` | ✅ "Bisukan", "Bisukan 1 jam" (durationHours), "Bukakan suara" |
| `GET …/presence` | `getRoomPresence` | ✅ baris "Online / Terakhir dilihat …" di ruang chat (poll 30 dtk) |
| `POST …/typing` | `sendChatTyping` | ✅ kirim saat draft berubah, stop 3 dtk diam / setelah kirim |
| `GET …/read-receipts` | `getReadReceipts` | ✅ ikon centang ganda `read` pada pesan sendiri |
| `POST …/messages/{id}/read` | `markMessageRead` | adapter-ready (room-read via `POST …/read` sudah ada) |

Catatan perilaku:
- **Edit/hapus terkunci** saat order DISPUTED (backend `CHAT_MESSAGE_LOCKED_DISPUTE`);
  error dipetakan ke toast.
- **Forward** hanya ke room dengan lawan bicara sama (dibatasi backend; target
  tidak cocok masuk `skipped` → ditampilkan sebagai error).
- **Presence** di-REST-poll karena app belum menyambungkan gateway WebSocket
  backend; indikator typing TEPAN lawan bicara pun baru bisa tampil setelah
  realtime diimplementasikan (state kirim sudah berfungsi).
- **Reaksi** pakai optimistic update + rollback ke state semula bila request gagal.

### 7.2 Komponen yang disentuh

- `components/ui/chat-message-bubble.tsx` — props baru: `reactions` + `onReact`
  (chip reaksi), `isPinned` (ikon pin), `isEdited` (caption "diedit"), status
  `read` sudah ada → dipakai read-receipt.
- `app/chat/[roomId].tsx` — menu pesan diperluas (Reaksi, Pin, Edit, Teruskan,
  Salin, Hapus), sheet emoji/edit/forward, baris pin, baris presence,
  read-receipt, typing indicator, poll presence 30 dtk.
- `app/chat.tsx` — dot online + ikon bisukan dari payload `GET /rooms`,
  tekan-lama → ActionSheet arsip/mute, room terarsip disembunyikan dari list.
- `app/user/[username].tsx` — tombol "Kirim Pesan" kini membuka sheet inquiry
  (sebelumnya hanya menautkan ke daftar chat generik).

### 7.3 Celah spec baru yang ditemukan

- `POST /v1/chat/rooms/{id}/typing` — controller memakai tipe inline anonim
  `@Body() dto: { isTyping: boolean }` sehingga OpenAPI tidak mendokumentasikan
  requestBody (akar masalah sama dengan bug @ApiProperty di §6.4). Didaftarkan
  di `KNOWN_DEVIATIONS` (scripts/check-api-body.mjs) + perlu
  `TypingIndicatorDto` di backend.

### 7.4 Verifikasi P1

tsc ✓, lint ✓, check:spec ✓, check:api ✓ (1 known deviation baru terdokumentasi),
check:inventory ✓, check:screens ✓, check:a11y ✓, check:weblinks ✓, check:push ✓,
123/123 test ✓. check:tokens tetap merah 12 (pre-existing, terverifikasi baseline
di §6.5).

---

*Dihasilkan 2026-09-15. Ekstraktor route: skrip v2 (multi-class + inheritance),
diverifikasi 450 dekorator method + 4 route warisan = 454 route.
Diperbarui sesi P1 chat: §2.1, §5, §7.*
