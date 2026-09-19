# Audit Frontend Kahade — 2026-09-19

## 1. Kesimpulan eksekutif

Frontend ini **sudah sangat luas dan fondasi engineering-nya di atas rata-rata**, tetapi belum bisa disebut siap produksi penuh. Masalah terbesar bukan kekurangan halaman; justru sebaliknya: ada 95 route terinventarisasi, 231 komponen UI, dan permukaan fitur yang besar, sementara beberapa alur penting masih belum mempunyai bukti runtime end-to-end, sebagian kontrak backend masih diasumsikan, dan beberapa fitur terlihat selesai padahal transport-nya belum nyata.

### Penilaian ringkas

| Area | Penilaian | Catatan |
| --- | ---: | --- |
| Arsitektur & maintainability | **8/10** | API boundary, normalizer, abort, retry GET, idempotency, route registry, token design sudah bagus. |
| Cakupan fitur | **8/10** | Escrow, wallet, order, dispute, KYC, social showcase, chat, support, subscription, referral, 2FA sudah tersedia. |
| Kedalaman/ketahanan fitur utama | **6/10** | Banyak alur belum diverifikasi di perangkat nyata atau backend hidup; chat dan live support belum production-grade. |
| UX & information architecture | **7/10** | Design system kuat, tetapi 95 route berisiko membuat fitur penting tersembunyi dan home melakukan terlalu banyak request. |
| Accessibility & i18n | **6.5/10** | Guard statis baik, tetapi katalog i18n sedang stale dan sekitar 252 string belum diterjemahkan ke English. |
| Web/native release readiness | **5/10** | Web build sukses, tetapi Web Push sengaja mati tanpa env, App/Universal Links masih placeholder, EAS production belum siap. |
| Observability & QA runtime | **4.5/10** | Unit test baik; E2E belum ada/belum dapat dijalankan; belum ada crash/performance monitoring yang nyata. |

**Prioritas utama saya:** jangan menambah banyak halaman baru terlebih dahulu. Tutup dulu gap kepercayaan pengguna pada uang, auth, support, notifikasi, dan release. Setelah itu baru memperluas fitur growth/social.

---

## 2. Ruang lingkup dan cara audit

Yang diperiksa:

- seluruh `app/`, `components/`, `lib/`, `lib/api/`, `scripts/`, `tests/`, konfigurasi Expo/EAS, dan dokumen audit yang ada;
- auth, sesi, refresh token, secure storage, push, deep link, web guest mode;
- seluruh route dan entry point navigasi;
- API adapter, response normalizer, retry, cancellation, idempotency, body-vs-DTO;
- accessibility statis, design tokens, reduced motion, i18n;
- build web statis, static routes, bundle size, dan script QA;
- baseline lint/typecheck/unit test serta keterbatasan verifikasi backend hidup.

### Ukuran proyek saat audit

- **99** file `.tsx` di bawah `app/` termasuk layout dan file khusus.
- **95** page route di `docs/audit/inventory.json`, **19** di antaranya dinamis.
- **97** layar dipindai `check:screens`.
- **231** komponen UI; **36** modul API.
- Sekitar **86 ribu baris** TypeScript/TSX pada `app`, `components`, dan `lib`.
- Expo SDK `54`, React Native `0.81.5`, Expo Router `6.0.x`, New Architecture aktif.

---

## 3. Baseline pemeriksaan yang benar-benar dijalankan

| Pemeriksaan | Hasil | Interpretasi |
| --- | --- | --- |
| `npm run typecheck` | PASS | Tidak ada error TypeScript. |
| `npm run lint` | PASS | Tidak ada error ESLint. |
| `npm test` | **135 test, 11 file PASS** | Unit/kontrak murni cukup baik. |
| `npm run test:i18n-render` | **4 test PASS** | Jalur render i18n dasar terjaga. |
| `npm run check` | PASS (baseline sebelum remediation) | Snapshot audit awal; setelah remediation pipeline juga menjalankan `check:i18n` dan seluruh quality gates tetap hijau. |
| `npm run check:a11y` | PASS, 330 file | Hanya static guard; belum menggantikan VoiceOver/TalkBack/manual keyboard test. |
| `npm run check:screens` | PASS | Tidak ada regresi baru pada guard. Masih ada 27 screen dengan kerangka manual dan 30 komponen UI tidak terpakai menurut baseline. |
| `npm run check:api` | PASS | 310 pemanggilan adapter cocok dengan method/path yang terdokumentasi; 0 body violation; 8 `KNOWN_DEVIATION`. Ini bukan verifikasi backend hidup. |
| `npm run check:weblinks` | PASS | 19 rute dinamis memiliki rewrite. |
| `npm run check:push` | PASS | Native push siap secara konfigurasi; Web Push nonaktif karena env Firebase kosong. |
| `npm run build:web` | PASS | 113 static routes; bundle JS web sekitar **4.32 MB** sebelum kompresi. |
| `npm run check:i18n` | **FAIL (baseline)** | Setelah remediation katalog sinkron pada 1.574 string dan gate masuk ke `npm run check`; cakupan English yang tercatat kini 1.275/1.574 (81.0%), dengan 299 string masih fallback Bahasa Indonesia. |
| `npm run test:e2e` | **FAIL (baseline)** | Setelah remediation sudah ada config + 4 smoke test; eksekusi browser lokal masih terblokir karena binary Chromium Playwright tidak tersedia/unduhan CDN terputus di environment audit. |
| `npm run verify:api` | **TIDAK TERVERIFIKASI** | Default menunjuk `http://localhost:3000`; 91 GET berakhir NETWORK dan endpoint terproteksi tidak mendapat auth. |
| `npm audit` | **28 vulnerability** | 8 high, 20 moderate; banyak berasal dari stack Expo/Metro dan membutuhkan rencana upgrade major. |

### Arti penting hasil di atas

Pipeline CI hijau **tidak sama dengan aplikasi production-ready**. Yang terbukti saat ini adalah source sehat secara static/type/unit dan web dapat dibuild. Yang belum terbukti adalah:

1. login, refresh, top-up, withdraw, transfer, escrow, dispute, push, dan deep-link berhasil pada backend staging/production;
2. gesture, keyboard, permission, camera, biometric, push, dan background behavior berhasil pada Android/iOS fisik;
3. semua error response backend yang sebenarnya sudah ternormalisasi benar;
4. performa web/mobile di jaringan lambat dan device low-end;
5. alur support benar-benar menyimpan dan ditindaklanjuti.

---

## 3A. Status remediation setelah audit

Perubahan berikut benar-benar sudah diterapkan di checkout ini. Status **fixed** berarti perubahan frontend dan guard lokal sudah ada; status tersebut **bukan** klaim bahwa backend, credential, store, atau device runtime sudah tersedia.

| Finding | Status | Bukti / batasan tersisa |
| --- | --- | --- |
| P0-01 — live support menyesatkan | **Fixed (frontend)** | `app/live-support.tsx` sekarang bernama Asisten Bantuan Otomatis, memberi disclaimer bukan tiket resmi, tidak mengaku admin, dan punya CTA tiket resmi. Percakapan tetap sesi lokal sampai backend live support tersedia. |
| P0-02 — authenticated runtime | **Blocked external** | Tidak ada backend staging/credential hidup di workspace. `check:api` tetap hanya contract/static verification; tidak diklaim sebagai authenticated smoke. |
| P1-01 — i18n gate/catalog | **Fixed gate; partial coverage** | `check:i18n` terhubung ke `check`, catalog 1.574 string sinkron, test 135/135. Cakupan English 81.0%; 299 string belum diterjemahkan dan harus menjadi backlog terukur. |
| P1-02 — E2E tidak ada | **Implemented; environment blocked** | `playwright.config.ts` mengisolasi `e2e/`, preview server deterministik, dan 4 web smoke tests. Request/deep-link smoke dapat berjalan; browser UI belum dijalankan karena binary Chromium belum tersedia dan download CDN gagal. |
| P1-03 — realtime chat | **Blocked external** | Belum diubah menjadi WebSocket karena gateway/auth/reconnect contract backend belum tersedia; polling tetap fallback saat ini. |
| P1-04 — push/deep link/PWA | **Partial** | Manifest, 192/512 icons, metadata, privacy-safe static shell service worker, safe web headers, dan static route smoke sudah ditambahkan. Well-known App/Universal Links sekarang kosong secara eksplisit (bukan TEAMID/fingerprint palsu), dengan warning gate; Firebase env, signing key, Team ID, dan store release tetap blocker eksternal. |
| P1-05 — dependency vulnerability | **Not fixed; accepted blocker** | `npm ci` tetap melaporkan 28 vulnerability (8 high, 20 moderate). Tidak menjalankan upgrade major secara membabi buta; perlu migration branch dan review dependency. |
| P1-06 — home request fan-out | **Open** | Belum diubah; memerlukan endpoint aggregate dan measurement backend/performance. |
| P1-07 — permission/privacy | **Partial, improved** | Queue feedback kini TTL 7 hari, bounded, sanitized, dan dihapus oleh `clearSession()` saat logout. Unused camera/media/contacts/location/audio/WebRTC/tracking configuration sudah dipangkas dan didokumentasikan di `docs/PERMISSIONS.md`; physical-device permission testing dan server retention consent masih open. |

**Quality-gate post-remediation:** `npm run check` (termasuk `check:permissions`), `npm run typecheck`, `npm run lint`, `npm test` (135 pass), `npm run test:i18n-render` (4 pass), `npm run build:web` (113 static routes), dan `npm run check:weblinks` berhasil. `npm run test:e2e` masih menunggu browser binary lokal/CI image.

## 4. Hal-hal yang sudah kuat dan sebaiknya dipertahankan

### 4.1 API boundary
`lib/api/client.ts` sudah menjadi satu boundary yang jelas untuk:

- auth mode `none`, `optional`, dan `required`;
- timeout dan pembatalan melalui `AbortSignal`;
- single-flight refresh;
- retry hanya untuk GET;
- idempotency key pada mutation yang memerlukannya;
- parsing error dan `userMessage()`;
- device/app/platform headers;
- validasi path segment agar `undefined`, `null`, `.` dan `..` tidak terkirim.

Ini adalah fondasi yang benar untuk aplikasi finansial. Jangan mengembalikan `fetch()` langsung ke screen.

### 4.2 Response normalizer defensif
Banyak response backend tidak memiliki schema yang kuat. Normalizer seperti `readList`, `pickUserId`, `normalizeCounterpartValidation`, status payment, wallet, notification, KYC, dan support mengurangi risiko UI mengambil keputusan dari field yang salah. Pola ini perlu dilanjutkan, tetapi jangka panjang backend harus menyediakan response schema yang formal.

### 4.3 Design system dan interaction guard
Tokens, typography, elevation, reduced motion, `PressableScale`, `GesturePressable`, `PullToRefresh`, focus ring, skeleton, error state, empty state, live region, dan komponen form menunjukkan perhatian detail yang baik. Perbaikan parity Android di `docs/audit/PLATFORM-PARITY.md` juga sangat bernilai.

### 4.4 Security dasar
Hal-hal yang sudah tepat:

- token native lewat SecureStore, bukan AsyncStorage;
- refresh single-flight dan session revision untuk mencegah response akun lama menimpa akun baru;
- PIN tidak disimpan mentah;
- token web tidak dipersistenkan ke localStorage;
- logout membersihkan session walau request logout gagal;
- re-auth password untuk trust/untrust device;
- captcha lazy dan tidak selalu ditampilkan;
- 2FA dan backup code punya alur terpisah.

### 4.5 Cakupan produk inti
Kahade sudah memiliki permukaan yang jarang tersedia sekaligus pada satu frontend: order escrow, wallet/top-up/withdraw/transfer, order link, delivery proof, dispute dengan evidence/mutual resolution/escalation, KYC, business verification, chat sosial, showcase feed, ratings, referral, subscription, notification center, support ticket, security activity, biometric, 2FA, dan web guest mode.

Masalah berikutnya adalah **depth dan reliability**, bukan sekadar menambah menu.

---

## 5. Temuan prioritas tinggi

## P0 — harus ditutup sebelum fitur ini diposisikan sebagai production

### P0-01 — [FIXED FRONTEND] “Dukungan Langsung” menampilkan bot lokal sebagai admin nyata

**Bukti:** `app/live-support.tsx:2-12`, `:44-50`, dan `:64-107`.

**Status remediation:** temuan ini berasal dari baseline sebelum perubahan. UI sekarang tidak lagi menyebut kanal resmi/admin; ia menampilkan Asisten Bantuan Otomatis, menjelaskan bahwa sesi lokal tidak membuka tiket, melarang pengiriman rahasia, dan menyediakan link ke form tiket resmi. Balasan keyword tetap hanya panduan dan tidak boleh diposisikan sebagai keputusan transaksi.

Ini lebih serius daripada placeholder visual karena menyentuh masalah finansial dan kepercayaan:

- pengguna bisa mengira keluhannya sudah diterima manusia;
- pesan hilang saat app ditutup/reload;
- balasan “admin” dapat salah untuk kasus pembayaran/dispute;
- tidak ada ticket ID, SLA, transcript server, atau audit trail;
- pengguna bisa membagikan informasi sensitif kepada kanal yang sebenarnya tidak menyimpan apa pun.

**Rekomendasi:**

1. **Selesai di frontend:** copy dan identitas sudah menjadi **“Asisten Bantuan Otomatis”**.
2. **Selesai di frontend:** banner tetap menyatakan jawaban otomatis, tidak membuka tiket, dan melarang PIN/OTP/password.
3. **Selesai sebagian:** CTA **“Buat tiket resmi”** menuju form tiket; penerusan draft/kategori otomatis menunggu kontrak backend yang jelas.
4. Implementasikan endpoint support real dengan `conversationId`, `messageId`, delivery state, attachment, server timestamp, retry, dan transcript.
5. Untuk kasus uang/dispute, jangan memberi jawaban faktual berdasarkan keyword tanpa mengambil status transaksi dari backend.
6. Tambahkan test bahwa menutup/reopen app tidak menghilangkan percakapan yang diklaim resmi.

**Definition of done:** tidak ada teks yang mengklaim admin manusia sebelum data benar-benar tersimpan di backend dan bisa ditemukan kembali dari perangkat lain.

### P0-02 — Tidak ada bukti authenticated runtime terhadap backend hidup

`npm run check:api` sendiri menyatakan “This is NOT authenticated endpoint verification”. `npm run verify:api` pada checkout ini menunjuk ke `http://localhost:3000` dan menghasilkan 91 NETWORK, sehingga tidak dapat membuktikan login maupun operasi finansial.

Audit kontrak statis yang ada sangat membantu, tetapi tidak cukup untuk aplikasi escrow. Response types di banyak adapter masih diberi label `UNVERIFIED`, terutama auth, wallet, order, notifications, support, KYC, dan social.

**Rekomendasi release gate:**

- sediakan environment staging yang dapat diakses CI dengan data seed;
- gunakan akun test untuk buyer, seller, business, KYC approved/rejected, 2FA, dan dispute;
- jalankan smoke test read-only setiap PR/deploy;
- jalankan mutation test pada staging dengan cleanup otomatis;
- simpan hasil contract probe sebagai artifact CI;
- verifikasi refresh cookie vs body, CORS, 401→refresh→replay, 429/Retry-After, idempotency, presigned upload, dan response envelope.

Tanpa ini, status yang jujur adalah **“source verified, runtime belum verified”**.

---

## P1 — prioritas sprint terdekat

### P1-01 — [FIXED GATE / PARTIAL TRANSLATION] Gate i18n tidak terhubung ke pipeline utama

Pada baseline audit, `npm run check:i18n` gagal karena katalog stale (1.550 vs 1.582 string). Remediation sekarang menjalankan generator AST dalam mode check, membuang entri English yang sudah mati, dan menjaga catalog sinkron pada **1.574 string**. Cakupan yang tercatat menjadi **1.275/1.574 (81.0%)**; **299 string** masih fallback ke Bahasa Indonesia sehingga gate sudah benar tetapi pekerjaan terjemahan belum selesai.

Dampaknya:

- layar dapat menjadi campuran Indonesia/English;
- copy baru bisa masuk tanpa terdeteksi oleh `npm run check` karena script `check` tidak memanggil `check:i18n`;
- accessibility label, placeholder, error, dan CTA tidak selalu konsisten bahasanya.

**Perbaikan:**

1. **Selesai:** regenerasi katalog secara resmi; katalog kini sinkron pada 1.574 string.
2. **Selesai:** `npm run check:i18n` sudah masuk ke `scripts.check`;
3. pilih target cakupan bertahap, misalnya 95% untuk auth, payment, error, support, dan navigation terlebih dahulu;
4. pindahkan label/status yang masih hardcoded ke kamus;
5. uji perubahan bahasa pada seluruh route utama, bukan hanya komponen `Text`.

### P1-02 — [IMPLEMENTED, BROWSER BLOCKED] Script E2E ada di `package.json`, tetapi E2E belum ada dan script rusak

Pada baseline, `npm run test:e2e` gagal karena tidak ada config/suite dan Playwright memindai file Vitest. Remediation sudah menambahkan `playwright.config.ts` dengan `testDir: "./e2e"`, preview server statis, dan 4 smoke test untuk shell/manifest, dynamic rewrite, serta well-known JSON. Di environment audit ini browser UI belum dapat dieksekusi karena Chromium belum terpasang dan unduhan CDN gagal; CI harus menggunakan image yang sudah memiliki browser atau menjalankan `npx playwright install --with-deps chromium`. Untuk frontend seluas ini, unit test tetap tidak cukup.

**Minimal E2E yang perlu ditambahkan:**

- web guest → protected route → login → kembali ke `next`;
- register email/phone → OTP → profile setup;
- login password → 2FA → home;
- home → create transaction → counterpart validation → fee → submit;
- transaction detail → pay/confirm/delivery proof/dispute;
- wallet top-up/transfer/withdraw dengan double-click dan refresh;
- notification tap ke order/dispute/chat;
- dynamic route web (`/order/:id`, `/user/:username`, `/order-link/:token`);
- keyboard/focus/error state di desktop dan mobile viewport.

**Perbaikan script:** buat `playwright.config.ts` dengan `testDir: "e2e"`, webServer preview yang deterministik, mock API atau staging base URL, dan jalankan `playwright test e2e` secara eksplisit.

### P1-03 — Chat masih polling, padahal backend memiliki gateway realtime

`app/chat/[roomId].tsx` menggunakan polling presence/pesan; dokumen platform menyebut interval chat 8 detik. Untuk chat transaksi, delay ini terasa dan dapat menimbulkan konflik saat dua perangkat mengedit, mengirim reaksi, atau menandai pesan.

**Improve:**

- gunakan WebSocket gateway untuk new message, typing, presence, read receipt, reactions, dan pin;
- pertahankan REST sebagai initial fetch/fallback;
- tambahkan reconnect dengan exponential backoff dan connection state yang terlihat;
- offline outbox: pesan memiliki `clientMessageId`, status queued/sending/sent/failed;
- deduplicate event berdasarkan message ID;
- optimistic UI harus bisa rollback tanpa menghapus draft.

Polling tetap boleh sebagai fallback, bukan transport utama.

### P1-04 — [PARTIAL] Web Push, App Links, Universal Links, dan PWA belum benar-benar selesai

Arsitektur sudah ada, tetapi status release belum selesai:

- `gen-fcm-sw` melewati penulisan service worker bila env Firebase Web kosong (`scripts/gen-fcm-sw.mjs`); hal ini tetap menjadi blocker konfigurasi, bukan error build;
- manifest PWA, metadata, link manifest, dan smoke route sudah ditambahkan;
- `public/.well-known/assetlinks.json` dan AASA sekarang kosong secara eksplisit, bukan fingerprint/`TEAMID` palsu; check memberi warning dan web fallback tetap aman;
- iOS/Android signing, Firebase/VAPID, dan store submission tetap membutuhkan credential/runtime eksternal.

Konsekuensinya: link share tetap bisa dibuka sebagai web, tetapi belum otomatis membuka app terpasang; push web tidak aktif; push native belum terbukti pada device fisik.

**Definition of done:**

- link order/profile/showcase tested pada Android fisik dan iPhone fisik;
- cold start dan warm start sama-sama menavigasi ke entitas benar;
- token push register/unregister setelah login/logout;
- notification tap menandai unread dan tidak membuka route ganda;
- semua well-known file production sudah memakai fingerprint/Team ID nyata;
- CI menolak placeholder ketika profile production dibuild.

### P1-05 — Dependency/security maintenance perlu dijadwalkan

Hasil audit dependency terbaru melaporkan **28 vulnerability: 8 high dan 20 moderate**; production-only menjadi **26: 8 high dan 18 moderate**. Penghapusan plugin native yang tidak memiliki entry point aktif menurunkan exposure, tetapi stack Expo/Metro tetap membutuhkan review.

Fix yang ditawarkan npm terutama upgrade major ke Expo 57, sehingga jangan menjalankan `npm audit fix --force` secara membabi buta. Buat migration branch dan uji:

1. Expo SDK 54 patch terbaru yang kompatibel;
2. Metro/image-size/xcode/uuid/transitive fix;
3. dependency native yang benar-benar diperlukan saja, dengan permission/plugin yang sesuai;
4. baru kemudian rencanakan Expo major upgrade.

Tambahkan `npm audit --audit-level=high`, `npm outdated`, dan EAS build smoke ke release process. Dokumentasikan mana vulnerability build-time dan mana yang masuk bundle runtime.

### P1-06 — Home melakukan terlalu banyak request untuk layar pertama

`app/(tabs)/home.tsx` melakukan query terpisah untuk profile, wallet, order summary, active orders, dan completed count. Ini rapi dari sisi isolasi error, tetapi membuat first-open dan refresh mahal, terutama di device lambat atau jaringan seluler.

**Perbaikan:**

- sediakan endpoint dashboard/home aggregate yang mengembalikan profile summary, wallet summary, order counts, active preview, dan notices dalam satu response;
- tetap pertahankan query granular untuk retry per section bila diperlukan;
- cache stale-while-revalidate agar data terakhir langsung terlihat;
- jangan request `completedCount` terpisah jika summary backend bisa diperluas;
- ukur TTFB, time-to-interactive, request count, dan bytes per screen.

### P1-07 — Permission surface terlalu lebar untuk tahap produk saat ini

Pada baseline, `app.json` mendeklarasikan kamera, media, contacts, location, audio, WebRTC, tracking, storage lama Android, wake lock, dan lainnya walaupun sebagian tidak mempunyai entry point aktif. Remediation memangkas plugin/permission yang tidak terpakai; matriks keputusan disimpan di `docs/PERMISSIONS.md`.

Yang masih perlu di release:

- minta permission hanya tepat sebelum fitur digunakan, bukan saat boot;
- uji allow/deny/restricted/revoked pada perangkat Android/iOS fisik;
- jangan menambahkan kembali `NSUserTrackingUsageDescription` tanpa tracking/analytics ATT yang benar-benar didisclose;
- perjelas retention dan tujuan KTP/selfie/media pada privacy policy;
- **Selesai sebagian:** feedback queue kini memiliki TTL 7 hari, batas jumlah/ukuran, sanitasi, dan dihapus saat logout; kebijakan consent/retention server tetap perlu disepakati.

---

## 6. Review fungsional per domain

### 6.1 Auth & account

**Sudah ada:** email/password, phone OTP SMS/WhatsApp, captcha, 2FA TOTP/backup code, password reset, change email/phone/password/PIN, biometric, session activity.

**Yang perlu di-improve:**

- pemulihan akun ketika email dan nomor sudah tidak aktif;
- recovery code download/copy/print dengan konfirmasi bahwa user sudah menyimpannya;
- device risk explanation: lokasi/IP/perangkat baru, sesi aktif, revoke all;
- passkey/WebAuthn untuk login web dan fallback mobile;
- email/Google/Apple social login. Kontrak backend sudah memiliki enum/provider, tetapi tidak ada adapter/UI social login yang selesai;
- onboarding yang lebih singkat untuk user yang hanya ingin menerima order link;
- persist intended route dengan aman, termasuk deep link dan 2FA tanpa menaruh token pada URL.

### 6.2 Order & escrow — area paling bernilai bisnis

Fondasi order sudah kuat, tetapi screen detail perlu selalu menjawab satu pertanyaan: **“Apa tindakan saya sekarang dan apa risiko/tenggatnya?”**

Tambahkan/perbaiki:

- action center sticky sesuai role + status: bayar, kirim, upload bukti, konfirmasi terima, ajukan dispute, accept extension;
- timeline dengan timestamp server, actor, dan alasan perubahan;
- countdown berbasis server time, bukan hanya device time;
- payment/settlement state yang eksplisit: pending, processing, paid, failed, reversed, refunded;
- retry aman untuk action mutation dengan idempotency key dan disabled state;
- receipt/invoice yang menampilkan fee payer, fee amount, escrow hold, release date, refund path;
- reminder/notification yang dapat ditunda atau diatur;
- offline read-only detail agar user tetap dapat melihat bukti dan nomor transaksi saat jaringan putus;
- status screen setelah mutation agar user tidak menekan ulang karena tidak tahu request sedang diproses.

### 6.3 Wallet, top-up, withdraw, transfer

**Sudah ada:** metode pembayaran, top-up status/history, bank account, withdraw OTP/cancel, transfer dengan recipient lookup, favorite recipient, wallet history/export.

**Peningkatan yang paling penting:**

- fee breakdown sebelum konfirmasi, termasuk biaya payment channel dan withdrawal;
- limit harian/bulanan dan sisa limit sebelum submit;
- reconciliation view: `client request ID`, server transaction ID, reference/payment code, status terakhir, last updated;
- pending action recovery setelah app killed/background;
- filter tanggal yang konsisten dan timezone Indonesia;
- anti-double-submit dan confirmation screen yang menyebut penerima + nominal + saldo setelah;
- bank account verification/ownership state yang terlihat;
- auto-refresh terkontrol untuk payment pending, bukan refresh seluruh screen;
- multi-currency hanya setelah IDR flow solid. Adapter exchange rate sudah ada, tetapi UI masih praktis IDR-only.

### 6.4 Dispute, evidence, dan call

Dispute punya surface yang kaya: evidence, messages, calls, mutual resolution, escalation. Karena ini high-risk, perlu:

- indikator siapa yang dapat melihat evidence dan kapan;
- ukuran/jenis file, virus scan state, upload resume, dan progress per file;
- audit timeline immutable;
- call consent, recording policy, device permission fallback, dan state “call ended” yang jelas;
- SLA countdown dan escalation eligibility yang diambil dari server;
- export bundle bukti untuk support/admin;
- larangan mengirim PIN/OTP/password melalui composer dengan detection/copy warning.

### 6.5 Chat & social/showcase

Showcase/feed/discover sudah luas. Prioritas berikutnya bukan lebih banyak engagement, melainkan trust & moderation:

- UI **Laporkan pengguna** belum menjadi entry point yang jelas meskipun adapter `reportUser` sudah ada;
- moderation state untuk report, block, hidden content, dan appeal perlu feedback yang jelas;
- rate limit harus tampil sebagai cooldown, bukan generic error;
- upload multi-image perlu progress, cancel, retry, dan cleanup orphan yang bisa diaudit;
- search global perlu filter per jenis dan pagination yang konsisten;
- feed perlu skeleton, pagination cursor, dedup, pull-to-refresh, dan empty state berbeda antara “belum mengikuti siapa pun” vs “tidak ada postingan”.

### 6.6 Support & feedback

Ticket support sudah lebih serius daripada live support: ada list, detail, reply, close/reopen, rate. Yang masih perlu:

- form kategori/urgency dan attachment progress;
- SLA/response estimate dan status owner;
- push notification untuk reply staff;
- search/filter ticket;
- reopen reason dan duplicate ticket detection;
- semua pesan live support otomatis menjadi ticket jika belum tersambung real-time;
- feedback jangan diberi copy “terkirim” jika sebenarnya baru antre lokal; tampilkan “tersimpan di perangkat, belum terkirim” dengan detail yang jujur.

### 6.7 Notifications

Notification center sudah memiliki kategori, unread filter, batch read/delete, action sheet, dan routing. Improve:

- notification preferences per event type, bukan hanya channel umum;
- “mark read” saat detail target berhasil dibuka, bukan hanya saat baris disentuh;
- dedup push vs in-app event;
- deep link error fallback yang menjelaskan entitas sudah dihapus/akses ditolak;
- inbox retention dan pagination cursor;
- push test button di setting untuk memastikan device token benar;
- badge count yang berasal dari event realtime/push, dengan poll sebagai fallback.

---

## 7. UX dan information architecture

### 7.1 Terlalu banyak route, belum tentu terlalu banyak fitur

95 route bukan masalah dengan sendirinya, tetapi saat ini banyak fitur tingkat lanjut hanya ditemukan lewat menu pengaturan atau deep link. Saya menyarankan struktur prioritas berikut:

- **Beranda:** status uang/order + action center, bukan katalog fitur.
- **Transaksi:** semua order dengan filter role/status, upcoming action, search.
- **Dompet:** balance, pending money, add/withdraw/transfer, ledger.
- **Showcase/Discover:** sosial dan acquisition.
- **Akun/Pengaturan:** identity, security, support, legal.

Fitur seperti KYC, business verification, device sessions, reports, subscription, referral, vouchers, badge, saved profile tetap dapat hidup di secondary navigation, tetapi yang berhubungan dengan uang atau keamanan harus memiliki entry point contextual dari order/wallet, bukan hanya menu Settings.

### 7.2 Home perlu memprioritaskan exception

Home sudah memiliki notice sengketa/order aktif, tetapi versi berikutnya sebaiknya menjadikan **“Needs attention”** sebagai modul paling atas setelah identitas. Urutkan:

1. fraud/security alert;
2. payment/withdraw gagal atau pending terlalu lama;
3. dispute deadline;
4. order action due;
5. saldo/quick action;
6. edukasi/promo.

Promo carousel sebaiknya tidak mengambil ruang di atas tindakan uang yang belum selesai.

### 7.3 Empty/error/loading harus memiliki recovery path

Design system sudah menyediakan komponen yang baik. Standarkan isi setiap state:

- **loading:** apa yang sedang dimuat;
- **empty:** kenapa kosong + CTA pertama;
- **error:** apa yang gagal + retry + reference ID bila relevan;
- **permission denied:** tombol buka pengaturan atau alternatif;
- **offline:** lihat data terakhir + retry saat online;
- **stale:** label “diperbarui X menit lalu”.

---

## 8. Web, performance, SEO, dan PWA

### 8.1 Bundle web 4.32 MB

Build web berhasil, tetapi satu bundle entry sekitar 4.32 MB raw cukup berat. Ada 95 route dan banyak screen/komponen yang ikut masuk entry. Prioritas pengurangan:

- route-level lazy loading/code splitting jika stabil di Expo static export;
- jangan load library/fitur berat (WebRTC, Firebase messaging, QR, media viewer) pada route yang tidak membutuhkannya;
- audit Phosphor imports dan ensure import tree-shakable;
- kompres/generate responsive image dan batasi full-resolution KTP/showcase di feed;
- ukur JS gzip/brotli, LCP, INP, CLS pada mobile 4G, bukan hanya ukuran raw.

### 8.2 Static SEO per route masih dangkal

`app/+html.tsx` sudah memiliki description/icon/theme-color, tetapi hampir semua static page memulai dari title dasar Kahade. Untuk halaman publik (`/order-link`, `/user`, `/showcase`, `/help`):

- title/description/OG image harus mengikuti entitas publik;
- jangan expose informasi privat dalam prerender/metadata;
- gunakan canonical URL;
- buat `robots.txt` dan sitemap publik yang benar-benar memuat route publik;
- pastikan 404 dynamic route tidak menampilkan title sukses.

### 8.3 PWA

Manifest, icon installability, dan metadata dasar PWA sekarang sudah ditambahkan. `public/sw.js` hanya memberi resilience untuk shell/assets statis; ia tidak mencache response API, request ber-cookie/auth, atau path `/v1/` dan `/api/`. Yang masih perlu: installability/device check, update prompt, cache invalidation berbasis release, dan validasi di browser/device nyata. Service worker FCM tetap bukan pengganti PWA service worker secara keseluruhan.

---

## 9. Security, privacy, dan operational hardening

### 9.1 Yang perlu segera dilakukan

- review 28 vulnerability dan lock versi dependency; jangan hanya mengejar CI hijau;
- verifikasi production build iOS/Android menghasilkan APNs/FCM entitlement yang benar;
- validasi CORS, cookies `Secure`, `HttpOnly`, `SameSite`, HSTS, CSP, dan referrer policy pada web;
- jangan log token, password, PIN, OTP, PII, payload KTP, atau URL presigned;
- redaksi error telemetry: request ID boleh, response body sensitif tidak;
- gunakan short-lived presigned URL, revoke/expire, dan cleanup orphan upload;
- TTL untuk feedback queue dan validasi ukuran JSON agar SecureStore tidak melewati batas;
- threat model untuk order link/token: jangan menaruh access token/data sensitif di URL.

### 9.2 Permission minimization

`app.json` sekarang dipangkas ke capability aktif. Matriks `docs/PERMISSIONS.md` menjadi guard review sebelum plugin baru ditambahkan:

- permission wajib untuk core order/wallet;
- permission hanya untuk KYC/media;
- permission hanya untuk dispute call;
- permission opsional untuk contacts/invite/location.

Sediakan matriks `feature → permission → alasan → kapan diminta → fallback` dan uji fresh install dengan semua permission ditolak.

### 9.3 Observability

Saat ini ada `console.warn/error` dan catatan “nanti ke Sentry”, tetapi belum ada integrasi observability yang terlihat. Tambahkan:

- crash reporting native dan web;
- error boundary event dengan route, app version, platform, request ID;
- performance tracing untuk boot, login, home, upload, payment polling;
- funnel analytics privacy-conscious untuk auth → first transaction → payment → completion;
- feature flags untuk rollout payment, push, WebRTC, dan live support;
- alert untuk mutation failure rate, refresh failure, push delivery failure, dan stuck pending transactions.

---

## 10. Fitur yang saya sarankan ditambahkan

Urutan ini berdasarkan value, risk reduction, dan dependency—bukan sekadar jumlah halaman.

| Prioritas | Fitur | Nilai | Dependency |
| --- | --- | --- | --- |
| P0 | Support assistant yang jujur + eskalasi ke ticket | Menghindari misleading support dan kehilangan kasus | Backend ticket/live transport atau ubah positioning menjadi bot |
| P0 | Transaction action center | Mengurangi gagal bayar/terlambat konfirmasi/dispute | Status/action contract server |
| P0 | Staging contract + E2E smoke | Membuktikan uang/auth benar-benar bekerja | Backend staging + seed data |
| P1 | Realtime chat & notification events | Respons cepat dan mengurangi polling | WebSocket auth/reconnect protocol |
| P1 | Account recovery + passkey/social login | Mengurangi lockout dan friction | OAuth/passkey backend + provider credentials |
| P1 | Report user / report transaction yang mudah ditemukan | Safety dan trust marketplace | UI adapter `reportUser`, moderation SLA |
| P1 | Payment reconciliation center | Membantu user dan support melacak uang pending | Transaction/event contract |
| P1 | PWA + SEO/OG per public route | Acquisition dan shareability web | Web manifest, metadata, cache policy |
| P1 | Push preference matrix + push test | Kontrol user dan debug delivery | Backend event taxonomy |
| P2 | Auto top-up / scheduled transfer | Retention dan convenience | Risk/limit/consent backend |
| P2 | Multi-currency/FX display | Ekspansi use case | FX contract dan ledger rules |
| P2 | Seller storefront/order-link analytics | Monetisasi seller | Event analytics dan aggregate API |
| P2 | Dispute evidence export dan call transcript | Operasional dispute lebih kuat | Storage/privacy/retention policy |
| P2 | Referral anti-fraud dashboard | Growth yang tidak mudah disalahgunakan | Attribution and fraud rules |
| P3 | Gamification/lebih banyak social engagement | Retention sekunder | Trust, moderation, analytics sudah siap |

### Fitur yang sebaiknya belum ditambah

Sebelum P0/P1 selesai, saya tidak menyarankan menambah banyak badge, promo, variasi feed, atau menu community baru. Mereka menambah surface area dan moderation cost, tetapi tidak menyelesaikan risiko terbesar: uang pending, support yang tidak persisten, auth recovery, dan belum adanya runtime proof.

---

## 11. Roadmap implementasi praktis

### Sprint 0 — Release confidence, 1–2 minggu

1. **Selesai frontend:** hentikan positioning live-support sebagai admin; sekarang assistant dan route ke ticket.
2. **Selesai gate:** regenerate katalog dan masukkan `check:i18n` ke `check`; terjemahan English yang masih kurang tetap backlog.
3. **Selesai implementasi:** config, `e2e/`, dan preview server sudah ada dengan 4 smoke test; CI harus memasang browser Playwright.
4. Tambah staging contract smoke dan seed accounts.
5. Jalankan audit permission dan PII/local queue.
6. Tambahkan telemetry minimal: crash/error boundary, API request ID, boot timing.
7. **Selesai frontend:** tautan komunitas hardcoded yang belum terverifikasi dihapus dari Settings; social URL hanya boleh muncul bila dikirim oleh konfigurasi resmi yang tervalidasi.
8. Buat dependency upgrade plan untuk vulnerability high.

### Sprint 1 — Core trust, 2–4 minggu

1. Transaction action center dan status/timeline server-based.
2. Payment reconciliation + pending recovery.
3. WebSocket chat + push/event dedup.
4. Surface `report user` dan report transaction.
5. Account recovery/social login/passkey discovery.
6. Push preference matrix dan push test.
7. Tambahkan 8–12 E2E critical-path tests pada web; smoke device matrix untuk Android/iOS.

### Sprint 2 — Growth yang aman, 4–8 minggu

1. Seller storefront analytics.
2. PWA + public SEO/OG.
3. Referral anti-fraud + referral analytics.
4. Auto top-up/scheduled transfer bila risk rules siap.
5. Multi-currency bila ledger/FX contract sudah final.
6. Moderation dashboard/appeal flow untuk social content.

---

## 12. Checklist acceptance sebelum production

### Auth/session

- [ ] Login benar, salah, rate limit, captcha, logout offline.
- [ ] Refresh 401 single-flight; refresh gagal tidak menghapus session secara salah.
- [ ] 2FA TOTP dan backup code; token tidak masuk URL/log.
- [ ] Ganti password/email/phone memaksa session policy yang benar.
- [ ] Device revoke/trust dengan re-auth.
- [ ] Account recovery bila email/phone hilang.

### Money/order

- [ ] Top-up, payment pending, success, expired, failed, retry.
- [ ] Transfer recipient valid/invalid, saldo kurang, PIN salah, double tap.
- [ ] Withdraw OTP, cancel, pending, failed, bank account mismatch.
- [ ] Escrow pay → ship/proof → confirm → release/refund.
- [ ] Dispute claim/evidence/message/mutual resolution/escalation.
- [ ] Semua mutation aman terhadap retry/idempotency.
- [ ] Receipt/invoice dan transaction ID konsisten di semua screen.

### Platform

- [ ] Android physical device: permission denied, back button, keyboard, gesture, long list.
- [ ] iOS physical device: biometric, APNs, universal link, camera, background.
- [ ] Web desktop, mobile browser, slow 4G, private browsing, blocked notification.
- [ ] Cold/warm notification tap ke route benar.
- [ ] Dynamic web routes 200; unknown route 404; OG/metadata benar.

### Quality

- [ ] `npm run check` + `npm run check:i18n` wajib hijau.
- [ ] `npm run test:e2e` benar-benar mengeksekusi test, bukan “No tests found”.
- [ ] No high vulnerability tanpa accepted risk.
- [ ] Crash/error/performance dashboard aktif.
- [ ] Source map/upload symbol production aman dan tidak membocorkan secret.

---

## 13. Keputusan produk yang saya sarankan sekarang

1. **Posisikan Kahade sebagai trust/payment product terlebih dahulu**, bukan social network yang kebetulan punya wallet. Order, money movement, dispute, dan support harus menjadi pengalaman paling dalam.
2. **Jangan mengejar 100% feature parity hanya dari jumlah route.** Satu status pending yang jelas lebih bernilai daripada tiga screen engagement baru.
3. **Jadikan backend contract dan staging fixture sebagai produk internal.** Frontend sudah memiliki tooling yang bagus; langkah berikutnya adalah menghubungkannya ke response nyata dan E2E.
4. **Hapus atau ubah semua UI yang tampak production padahal masih lokal/mock**, terutama live support dan feedback queue.
5. **Setelah core confidence tercapai, tambahkan passkey/social login, realtime, PWA/SEO, dan seller analytics** karena tiga area tersebut paling berpotensi meningkatkan activation, retention, dan shareability.

### Putusan akhir

Frontend ini layak dilanjutkan dan tidak membutuhkan rewrite. Fondasinya justru cukup baik untuk iterasi cepat. Yang dibutuhkan adalah satu fase **hardening + proof**, lalu baru fase penambahan fitur. P0-01, P1-01 gate, dan P1-02 implementasi frontend sudah ditutup/diturunkan risikonya. P0-02, P1-03, dan bagian credential/runtime P1-04 tetap blocker eksternal; kualitas keseluruhan akan naik lebih besar bila blocker ini dibuktikan daripada menambahkan 20 route baru.
