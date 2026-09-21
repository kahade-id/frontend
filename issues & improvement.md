# Issues & Improvement — Audit Mendalam Frontend Kahade

**Tanggal audit:** 2026-09-20
**Branch / commit:** `arena/01a0bf24-frontend` @ `dcc76b1` (main)
**Cakupan:** seluruh `app/` (99 layar), `components/` (231 komponen UI), `lib/` (60+ modul), `scripts/`, `tests/`, `e2e/`, konfigurasi Expo/EAS/web, dan dokumen audit yang ada.
**Metode:** pemeriksaan baris-per-baris pada alur uang/auth/chat, diff rute vs registri proteksi, eksekusi seluruh quality gate repo (`typecheck`, `lint`, `test`, `check:*`), `npm audit`, pemindaian pola (timer tanpa cleanup, openURL tanpa validasi, string tak diterjemahkan, dead code), dan verifikasi silang terhadap kontrak OpenAPI di `docs/api/`.

> **Catatan kejujuran:** semua temuan di bawah disertai bukti `file:line` atau keluaran perintah yang bisa direproduksi. Temuan yang bergantung pada perilaku backend/perangkat nyata ditandai *"perlu verifikasi runtime"*. Audit ini **melengkapi** (bukan mengulang) `docs/audit/FRONTEND-AUDIT-2026-09-19.md` — item warisan yang masih terbuka dirangkum di §K.

---

## Ringkasan eksekutif

| Kategori | Jumlah | 🔴 Krit | 🟠 Tinggi | 🟡 Sedang | 🔵 Rendah | 💡 Improve |
|---|---:|---:|---:|---:|---:|---:|
| A. Bug fungsional — aliran uang & transaksi | 18 | 3 | 8 | 5 | 1 | 1 |
| B. Auth, sesi & proteksi rute | 14 | 2 | 6 | 5 | 1 | 0 |
| C. Chat & realtime | 10 | 0 | 3 | 5 | 1 | 1 |
| D. Keamanan & privasi | 14 | 1 | 5 | 6 | 1 | 1 |
| E. i18n & lokalisasi | 10 | 0 | 2 | 5 | 2 | 1 |
| F. Kesegaran data, performa & jaringan | 14 | 0 | 4 | 7 | 2 | 1 |
| G. Dead code, duplikasi & konsistensi | 14 | 0 | 1 | 6 | 7 | 0 |
| H. Testing & QA | 9 | 0 | 3 | 4 | 1 | 1 |
| I. Build, release & operasional | 11 | 0 | 3 | 5 | 2 | 1 |
| J. Improvement fitur & UX produk | 14 | 0 | 0 | 0 | 0 | 14 |
| K. Warisan audit sebelumnya yang masih terbuka | 7 | 1 | 4 | 2 | 0 | 0 |
| **Total** | **135** | **7** | **39** | **50** | **18** | **21** |

Baseline tooling saat audit (semua dijalankan, bukan diasumsikan):

```
npm run typecheck   → PASS (0 error)
npm run lint        → PASS (0 error)
npm test            → PASS (136 test / 11 file)
npm run check       → PASS, dengan catatan:
  check:i18n        → katalog 1.596 string, terjemah 1.574 (98,6%), BELUM 22
  check:screens     → S1 sisa 2 · S3 sisa 27 · S5 sisa 29 (komponen UI mati)
  check:api         → 8 KNOWN_DEVIATION (celah spec backend)
  check:weblinks    → PERINGATAN assetlinks.json & AASA kosong
  check:push        → CATATAN env Firebase Web kosong (web push nonaktif)
npm audit           → 27 vulnerability (8 high, 19 moderate)
```

Artinya: **pipa CI lokal hijau, tetapi hijau ≠ benar**. Mayoritas temuan di bawah adalah bug logika, celah kontrak, dan fitur yang "terlihat selesai" yang tidak terdeteksi oleh gate statis mana pun.

---

## A. Bug fungsional — aliran uang & transaksi

### A-01 🔴 Biometrik "sukses" tidak melakukan apa pun di layar Transfer
**Bukti:** `app/transfer.tsx:121-135`. `handleBiometric()` memanggil `authenticateBiometric()`; cabang yang ditangani hanya `failed`/`lockout` (set `pinError`). Untuk outcome `success`, `cancelled`, dan `fallback` fungsi **berakhir tanpa efek** — tidak mengisi PIN, tidak men-submit, tidak menutup sheet.
**Dampak:** pengguna menempelkan sidik jari, prompt OS menutup, dan… sheet PIN tetap menunggu 6 digit. `TransferDto` memang mewajibkan `pin` (`app/transfer.tsx:246-251`), jadi biometrik **tidak mungkin** menggantikan PIN dengan kontrak sekarang. Tombol biometrik di PinPad adalah placebo.
**Saran:** (a) hapus tombol biometrik sampai backend mendukung konfirmasi biometrik (mis. `biometricToken`/ticket yang ditukar server), ATAU (b) implementasikan backend flow "biometric → short-lived confirmation token" dan pakai `BiometricPromptTrigger` yang sudah ada. Jangan biarkan UI menjanjikan "konfirmasi transaksi tanpa mengetik PIN" (`app/biometric-settings.tsx:124`) yang tidak terjadi.

### A-02 🔴 Bug biometrik no-op yang sama di layar Withdraw
**Bukti:** `app/withdraw.tsx:127-139` — kode identik dengan A-01; `onBiometric` dipasang di `app/withdraw.tsx:522`.
**Dampak/Saran:** sama dengan A-01, untuk penarikan dana (nilai risiko lebih tinggi).

### A-03 🔴 Bug biometrik no-op yang sama di pembayaran escrow (Detail Order)
**Bukti:** `app/order/[id].tsx:244-256`; `onBiometric` di `app/order/[id].tsx:808`.
**Dampak/Saran:** sama dengan A-01, untuk pembayaran pesanan. Tiga layar uang mewarisi bug yang sama karena copy-paste (lihat G-05).

### A-04 🟠 "Kunci aplikasi / buka dengan biometrik" tidak pernah ada
**Bukti:** `app/biometric-settings.tsx:80` ("Kahade akan memakai biometrik untuk membuka aplikasi") dan `:124` ("Untuk membuka aplikasi…"). Pencarian seluruh repo: tidak ada satu pun pemakaian `AppState` untuk re-auth setelah background (satu-satunya pemakai `AppState` adalah `lib/use-polling.ts:2,44` dan `lib/unread-count.ts` untuk poll). `lib/biometrics.ts:3` mengklaim "§14 re-autentikasi setelah background > 1 menit" — **tidak diimplementasikan di mana pun**.
**Dampak:** pengaturan menjual fitur app-lock yang tidak ada; aplikasi finansial yang kembali dari background langsung menampilkan saldo tanpa re-auth.
**Saran:** implementasikan lock screen (PIN/biometrik) dengan timer background, atau ubah copy sehingga tidak menjanjikan fitur yang belum ada.

### A-05 🟠 Slot `SecureKeys.pinHash` mati — "hash PIN lokal" tidak pernah ditulis/dibaca
**Bukti:** `lib/secure-storage.ts:40` mendeklarasikan `pinHash` dengan komentar "Hash PIN (argon2/bcrypt dari backend, atau salted SHA lokal)"; satu-satunya referensi lain adalah penghapusan di `clearSession()` (`lib/secure-storage.ts:159`). Tidak ada kode yang menulis atau membacanya (grep `pinHash` = 2 hit, keduanya di file yang sama).
**Dampak:** dokumen desain (§9.21/§14) mengasumsikan PIN lokal untuk app-lock/offline-PIN; kenyataannya tidak ada. Dead API yang menyesatkan pemelihara berikutnya.
**Saran:** hapus slot + komentarnya, atau implementasikan bersama A-04.

### A-06 🟠 Withdraw: menutup sheet OTP membiarkan penarikan PENDING_OTP menggantung
**Bukti:** `app/withdraw.tsx:476-481` — `onRequestClose` sheet verifikasi hanya `setStep("amount")`; tidak ada panggilan `cancelWithdraw` maupun peringatan bahwa `txId` sudah dibuat (`app/withdraw.tsx:180-186` membuat withdraw lalu masuk mode OTP).
**Dampak:** pengguna yang menutup sheet (backdrop/Android back) meninggalkan transaksi penarikan berstatus PENDING_OTP di server tanpa tahu; saldo bisa tertahan sampai TTL server. `handleCancelOtp` (`app/withdraw.tsx:249`) hanya reachable lewat tombol di dalam sheet.
**Saran:** saat sheet OTP ditutup dan `txId` ada → dialog "Penarikan masih menunggu OTP. Batalkan sekarang?" atau otomatis `cancelWithdraw`.

### A-07 🟠 Resend OTP withdraw tanpa cooldown/rate-limit sisi klien
**Bukti:** `app/withdraw.tsx:238-247, 499-506` — tombol "Kirim ulang OTP" tidak punya countdown/`disabled` selain `submitting`. Bandingkan dengan alur auth yang disiplin: `app/(auth)/verify-otp.tsx:76-77,109-112,235-243` (Countdown 60 d + `cooldownSeconds` backend).
**Dampak:** spam SMS/OTP (biaya per pesan!) dan memperpanjang throttle backend; inkonsistensi antar-alur OTP.
**Saran:** pakai `<Countdown>` yang sama + hormati `cooldownSeconds` dari respons resend.

### A-08 🟠 Pesan gagal withdraw menyesatkan untuk SEMUA jenis error
**Bukti:** `app/withdraw.tsx:193,197` — `${userMessage(err)} Periksa riwayat sebelum mengirim ulang.` ditempel tanpa syarat, termasuk untuk error pasti seperti "PIN salah" atau validasi. Bandingkan `app/transfer.tsx:262-268` yang membedakan `uncertain = !isApiError(err) || err.isTransient || err.code === "ABORTED"` dan hanya menambah peringatan riwayat untuk kasus tidak pasti.
**Dampak:** pengguna PIN salah disuruh memeriksa riwayat (tidak ada apa pun di sana) → kebingungan di momen paling sensitif.
**Saran:** salin pola `uncertain` transfer.tsx ke withdraw (dan ke topup/order bila relevan).

### A-09 🟡 Gagal memuat saldo disamarkan menjadi "Rp0" di Transfer & Withdraw
**Bukti:** `app/transfer.tsx:77-85` dan `app/withdraw.tsx:82-90` — fetcher wallet menangkap error dan `return { balance: 0 }`. Konsumennya: `maxAmount = balance && balance > 0 ? Math.min(MAX, balance) : MAX` (`app/transfer.tsx:288-289`) dan `AmountKeypad balance={balance}`.
**Dampak:** saat `GET /v1/wallet` gagal (jaringan/5xx), keypad menampilkan saldo Rp0 (angka salah untuk layar uang) dan batas maksimal jadi MAX_AMOUNT (tidak dibatasi saldo). Tidak ada error state/retry untuk bagian saldo.
**Saran:** biarkan error terlihat (state `balanceError`), tampilkan "saldo tidak diketahui" + retry, dan jangan pakai `0` sebagai nilai fallback.

### A-10 🟡 `bankName` undefined dirender literal di langkah selesai Withdraw
**Bukti:** `app/withdraw.tsx:368` — subtitle `${selected.bankName} ${maskAccountNumber(...)}` tanpa fallback; padahal di tempat lain fallback-nya ada: `app/withdraw.tsx:311` (`selected.bankName ?? selected.bankCode`) dan `:429`.
**Dampak:** bila backend hanya mengirim `bankCode`, layar hasil menampilkan "undefined •••• 1234" pada konfirmasi penarikan.
**Saran:** `selected.bankName ?? selected.bankCode` konsisten di semua titik render.

### A-11 🟠 QRIS: polling berhenti diam-diam setelah 15 menit, tanpa status ke pengguna
**Bukti:** `app/order/[id].tsx:261,379-391` — `MAX_QRIS_POLLS = 300`; saat tercapai, `usePolling` di-disable tetapi tidak ada state UI "pemantauan berhenti". Tidak ada countdown kedaluwarsa QR juga — hanya teks statis "Berlaku sampai {formatDateTime(qris.expiresAt)}" (`app/order/[id].tsx:823`).
**Dampak:** pembeli yang membiarkan sheet QR terbuka >15 menit tidak tahu status tidak lagi dipantau; pembayaran yang masuk setelahnya tidak memicu toast/refresh otomatis. Tanpa countdown, pengguna tidak merasa dikejar tenggat (dan `expiresAt` dirender dengan jam perangkat — lihat F-13).
**Saran:** tampilkan `<Countdown until={qris.expiresAt}>` hidup, dan saat poll cap/expire tercapai ubah CTA jadi "Periksa status" manual + tampilkan status EXPIRED.

### A-12 🟡 Top-up: polling status berhenti diam-diam setelah 15 menit
**Bukti:** `app/topup.tsx:102,135-143` — `MAX_POLL_COUNT = 180`; sama seperti A-11 tanpa pesan. `TopupStatusCard` punya `onRefresh` manual, tetapi tidak ada indikator "pemantauan otomatis dihentikan".
**Saran:** state eksplisit + pesan "Status tidak lagi dipantau otomatis — ketuk Periksa status".

### A-13 🟡 `handlePayQris` tidak mencegah pembuatan intent QRIS kedua
**Bukti:** `app/order/[id].tsx:394` — guard hanya `submitLock` (anti-konkurensi sesaat). Setelah QRIS pertama tampil (`setQris(res)`), tidak ada cek `if (qris) return` di jalur pembuatan; tiap POST adalah mutasi baru dengan `Idempotency-Key` baru (kunci dibuat per panggilan logis di `lib/api/client.ts:349-362`), sehingga backend tidak bisa mendedupe.
**Dampak:** dua intent pembayaran aktif untuk satu order bila UI mengizinkan tap kedua (perlu verifikasi runtime apakah backend menolak saat sudah ada intent PENDING).
**Saran:** disable CTA "Bayar dengan QRIS" selama `qris != null && status PENDING`, atau pakai ulang intent yang ada.

### A-14 🟡 `setTimeout` hasil transaksi tidak dibersihkan saat unmount (8 tempat)
**Bukti:** `app/transfer.tsx:274-277,285-288`; `app/withdraw.tsx:187-190,198-201,219-222,229-232`; `app/order/[id].tsx:339-343,348-352`; `app/subscriptions.tsx:347-352,358-361`. Semua `setTimeout(..., RESULT_HOLD_MS)` tanpa `clearTimeout` di cleanup; beberapa memanggil `router.replace`/`query.refresh()` di dalamnya.
**Dampak:** setState setelah unmount; jika pengguna menekan back dalam jendela 1,4 detik, navigasi paksa ke layar "done" tetap terjadi dari layar lain.
**Saran:** simpan id timer di ref dan bersihkan di `useEffect` unmount (pola yang sudah dipakai `app/create-transaction.tsx` dan `app/edit-profile.tsx`).

### A-15 🟡 Pratinjau biaya admin top-up dihitung di klien, bisa menyimpang dari tagihan server
**Bukti:** `app/topup.tsx:147-166` — `selectedFee` menghitung `percent`, `combined`, `minFee/maxFee/freeLimit` secara lokal dengan `Math.round`, tepat di bawah komentar "sumber kebenaran: server". Tidak ada endpoint preview-fee topup yang dipanggil.
**Dampak:** "Total yang dibayar" (`app/topup.tsx:333`) bisa berbeda beberapa rupiah/persen dari yang ditagih channel — untuk produk uang, selisih kecil pun merusak kepercayaan.
**Saran:** minta backend mengembalikan `fee` di `GET /v1/wallet/payment-methods` per metode ATAU endpoint preview; jika tetap dihitung klien, tandai "estimasi" dan rekonsiliasi di layar instruksi.

### A-16 🟡 `toLocaleString("id-ID")` dipakai di topup padahal repo melarang Intl untuk format angka
**Bukti:** `app/topup.tsx:257` — `Rp{AMOUNT_LIMITS.topup.minimum.toLocaleString("id-ID")}`. `lib/format.ts:11-15` secara eksplisit mendokumentasikan bahwa Intl tidak andal di Hermes/Android dan menyediakan `groupThousands()` untuk kasus persis ini.
**Dampak:** di sebagian perangkat Android format bisa jatuh ke locale default ("Rp10,000") — inkonsisten dengan seluruh app yang memakai titik ribuan.
**Saran:** ganti ke `formatRupiah(AMOUNT_LIMITS.topup.minimum)` atau `groupThousands()`.

### A-17 🔵 `NOTE_MAX` transfer (200) tidak ada di kontrak yang di-generate
**Bukti:** `app/transfer.tsx:61` (`NOTE_MAX = 200`) vs `lib/api/constraints.ts:941-946` — `TransferDto` hanya punya `amount` (min/max), tidak ada aturan `note`. `app/order/[id].tsx:99` memakai `NOTE_MAX = 500` untuk konteks lain.
**Dampak:** batas 200 adalah asumsi klien; bila backend membolehkan/menolak batas lain, UI dan server tidak sinkron (perlu verifikasi runtime).
**Saran:** tambahkan `note` ke DTO backend sehingga `gen:api` menuliskan batasnya ke constraints.

### A-18 💡 Change-PIN: gagal di langkah akhir melempar pengguna kembali ke langkah password
**Bukti:** `app/change-pin.tsx:92-100` — `catch` pada `setWalletPin` melakukan `setStep("password")`, membuang PIN baru yang sudah diketik dua kali.
**Dampak:** untuk error transient (jaringan), pengguna mengulang seluruh alur 3 langkah.
**Saran:** tetap di langkah "new" untuk error transient; kembali ke password hanya untuk error autentikasi (password/PIN salah).

---

## B. Auth, sesi & proteksi rute

### B-01 🔴 5 rute TIDAK terdaftar di `AUTHENTICATED_SCREENS` (guard native bolong)
**Bukti:** diff `app/**` vs `lib/protected-routes.ts:2-70`. Yang absen: `settings`, `receive`, `saved`, `showcase-management`, `profile/[id]`. Semua layar ini memanggil endpoint `auth: "required"` (mis. `app/receive.tsx:45` `api.users.getMe`, `app/saved.tsx:30-32` `getSavedProfiles`).
**Dampak:** di native, deep link (`kahade://…` / App Link) ke rute ini tanpa sesi tidak ditahan `Stack.Protected`; layar terbuka lalu menampilkan error 401 satu per satu (dan memicu rantai refresh/expire — lihat B-03). `settings` adalah hub akun (logout, keamanan, hapus akun) — seharusnya tidak pernah bisa dibuka tanpa sesi.
**Saran:** daftarkan kelimanya (kecuali `profile/[id]` bila memang dimaksud publik — putuskan eksplisit, lihat B-02), dan tambahkan guard test yang membandingkan `inventory.json` vs `AUTHENTICATED_SCREENS` agar tidak bolong lagi.

### B-02 🟠 `profile/[id]` vs `user/[username]`: dua layar profil, proteksi berbeda
**Bukti:** `lib/protected-routes.ts` — `user/[username]` terdaftar protected; `profile/[id]` tidak. Keduanya menampilkan profil pengguna.
**Dampak:** kebijakan akses profil publik tidak konsisten; rute yang sama maksudnya punya dua perilaku auth.
**Saran:** tentukan satu kebijakan (profil = publik untuk SEO/share, atau = protected) dan terapkan ke keduanya.

### B-03 🔴 `emitSessionExpired` tidak punya SATU pun subscriber — mekanisme redirect login mati
**Bukti:** `lib/api/session.ts:194-208` mendefinisikan `emitSessionExpired`/`onSessionExpired`; grep seluruh `app/`, `components/`, `lib/`, `tests/` → **nol pemanggilan `onSessionExpired(...)`**. `app/_layout.tsx:168-171` hanya berisi komentar yang mengklaim "redirect ke login dipasang di sini" tanpa kode. `lib/unread-count.ts:28-29` juga merujuk perilaku yang tidak ada ini ("client.ts sudah memanggil emitSessionExpired → root layout redirect ke login").
**Dampak:** saat sesi kedaluwarsa di tengah pemakaian (401 tak terpulihkan), `clearSession()` berjalan tetapi **tidak ada navigasi ke login**. Pengguna tetap berdiri di layar yang semua request-nya mulai 401; pemulihan bergantung pada efek samping re-render `Stack.Protected` yang tidak dijamin untuk rute yang tidak terdaftar (B-01) dan tidak ada di web guest.
**Saran:** pasang `onSessionExpired(() => router.replace(ROUTES.login))` di `AppShell` (setelah Stack mount), atau hapus mekanisme + komentar yang mengklaimnya.

### B-04 🟠 Tamu web di Beranda memicu badai 401 + refresh + clearSession
**Bukti:** `app/index.tsx` (web → langsung `/home`), `app/(tabs)/home.tsx:157-196` — 5 query `auth:"required"` (profil, wallet, summary, orders ×2) tanpa gate sesi; `lib/api/client.ts:405-420` — tiap 401 "required" memicu `refreshAccessToken()` lalu `expireSession()` → `clearSession()` (`lib/api/session.ts:139-155`) yang menulis `sessionSignedOut=1` dan menghapus item storage. Ditambah poll unread 60 detik (B-05).
**Dampak:** setiap tamu web menghasilkan siklus 401→refresh→expire berulang tiap buka/fokus tab; Beranda tamu menampilkan "Gagal memuat profil/transaksi aktif" (error merah) padahal `discover.tsx:216-257` sudah punya pola guest-aware yang benar. Inkonsistensi + request sampah.
**Saran:** gate semua query home dengan `session.token` (`enabled: Boolean(token)`) dan render varian tamu (hero publik + CTA masuk) seperti discover.

### B-05 🟠 `useUnreadCount` dipoll tanpa syarat login — tamu/guest ikut menembak endpoint `auth:"required"`
**Bukti:** `app/(tabs)/_layout.tsx:107` memanggil `useUnreadCount()` tanpa opsi; `lib/unread-count.ts:127-141` (`enabled ?? true`) → poll 60 d + AppState; `lib/api/notifications.ts:83-86` `getUnreadCount` memakai `auth: "required"`.
**Dampak:** sama dengan B-04 untuk tamu web; di native, jika sesi berakhir saat app di background, poll pertama saat foreground memicu rantai expire sebelum UI sempat redirect.
**Saran:** `useUnreadCount({ enabled: Boolean(session.token) })` di tab layout.

### B-06 🟠 Gate web guest tidak memblokir `receive`, `saved`, `showcase-management`
**Bukti:** `lib/protected-routes.ts:104-137` — `PROTECTED_PATTERNS` dibangun dari `AUTHENTICATED_SCREENS`; rute yang tidak terdaftar di sana (B-01) juga lolos `isProtectedPath()`, sehingga `GuestLoginPrompt` tidak muncul; `WEB_GUEST_ALLOWED_PATHS` tidak menyebutnya.
**Dampak:** tamu web membuka `/receive` → layar QR dengan error 401, bukan ajakan login.
**Saran:** perbaiki B-01 maka ini ikut tertutup; tambahkan test `isProtectedPath` untuk seluruh rute inventaris.

### B-07 🟡 PII & kredensial alur OTP dilewatkan sebagai query parameter URL
**Bukti:** `lib/routes.ts:37` (`verifyOtp` → `params: { phoneNumber, method }`), `lib/routes.ts:43-49` + `app/(auth)/whatsapp-trigger.tsx:47-56` (`phoneNumber`, `refCode`, `whatsappUrl`, `triggerText`, `expiresAt` semua di URL).
**Dampak:** di web, nomor HP + refCode masuk history browser, berpotensi masuk log hosting/CDN dan header Referer saat `Linking.openURL(params.whatsappUrl)` keluar aplikasi. Repo sudah punya preseden benar: tempToken 2FA disimpan di memori, "BUKAN lewat param URL (kredensial tidak boleh lewat route params)" (`app/(auth)/login.tsx:38-40`).
**Saran:** pindahkan state alur OTP ke store memori (pola `lib/registration.ts`/`lib/two-factor-login.ts`) dan kirim hanya ref non-sensitif di URL.

### B-08 🟡 `whatsapp-trigger` membuka URL dari parameter rute tanpa validasi skema
**Bukti:** `app/(auth)/whatsapp-trigger.tsx:132-135` — `Linking.openURL(params.whatsappUrl)`; tidak ada `safeHttpsUrl`/whitelist `wa.me`. Rute ini deep-linkable (`/whatsapp-trigger?whatsappUrl=…`).
**Dampak:** open-redirect / peluncuran skema arbitrary dari URL yang bisa ditempel pihak lain (di web: `window.location` ke tujuan apa pun). Bandingkan disiplin di `lib/api/upload.ts:63-65` yang menolak URL non-HTTPS.
**Saran:** validasi `^https://(wa\.me|api\.whatsapp\.com)/` sebelum openURL; selain itu tolak dan tampilkan fallback salin-teks.

### B-09 🟡 Gate boot: kegagalan baca SecureStore dianggap "belum login"
**Bukti:** `app/index.tsx:45-47` — `getAccessToken().catch(() => null)`; hasil `null` → `gate="login"`.
**Dampak:** error transien Keychain/Keystore (bisa terjadi saat OS sibuk) melempar pengguna login ke layar login alih-alih retry; token-nya masih ada.
**Saran:** bedakan `null` (tidak ada token) dari reject (error baca) — untuk reject, tampilkan retry seperti `session.error` di `use-auth-session`.

### B-10 🟡 Force-update hanya dicek sekali saat boot
**Bukti:** `app/_layout.tsx:227-263` — effect bergantung `[versionCheck]` yang hanya naik lewat tombol "Periksa kembali"; tidak ada re-check saat app kembali foreground.
**Dampak:** app yang hidup berhari-hari di background tidak pernah tahu versi minimum naik.
**Saran:** re-check pada transisi AppState `active` (throttle mis. 6 jam).

### B-11 🟡 `Stack.Protected` guard `true` permanen di web menyembunyikan fakta rute tak terdaftar
**Bukti:** `app/_layout.tsx:334-336` — `guard={Platform.OS === "web" ? true : Boolean(session.token)}`.
**Dampak:** di web, satu-satunya lapisan adalah `GuestLoginPrompt` (B-06); layar ber-auth yang lolos daftar tetap terbuka penuh bagi tamu (mis. `/settings` — terselamatkan hanya karena `PROTECTED_TABS` hardcode `"settings"`, `lib/protected-routes.ts:124-126`).
**Saran:** daftar `PROTECTED_TABS` berisi nama tab, tetapi `settings` bukan tab (tab aktif: home/transactions/wallet/showcase/discover) — pindahkan ke sumber yang sama dengan B-01 agar tidak bergantung hardcode.

### B-12 🟡 Login tidak menawarkan jalur cepat biometrik/PIN untuk pengguna kembali
**Bukti:** `app/(auth)/login.tsx` (308 baris) — hanya email+password+captcha; grep `biometric|pinHash` di file ini = 0.
**Dampak:** setiap login ulang mengetik password 12 karakter di mobile; fitur biometrik yang sudah di-toggle pengguna (A-04) tidak mempercepat apa pun.
**Saran:** setelah A-04 beres, tambahkan "Masuk dengan Face ID/sidik jari" (menukar re-auth lokal → refresh session) sesuai praktik aplikasi finansial.

### B-13 🔵 Docblock login basi + terminologi campur ("password" vs "kata sandi")
**Bukti:** `app/(auth)/login.tsx:14,51` menulis `TextLink "Lupa password?"`; yang dirender `app/(auth)/login.tsx:295` adalah "Lupa kata sandi?". Docblock yang sama melarang pencampuran istilah ("jangan campur 'Password'/'Kata sandi' antar layar (§12)"), sementara repo memakai keduanya (±477 kemunculan literal "password" di teks UI vs 23 "kata sandi").
**Saran:** pilih satu istilah (KBBI: "kata sandi"), sapu dengan kamus i18n, dan perbarui docblock.

### B-14 🟡 `verify-2fa`/`verify-otp` dapat ditempuh dengan parameter URL yang bisa dipalsukan
**Bukti:** `app/(auth)/verify-otp.tsx:199-249` — resend memakai `phoneNumber` dari route params (B-07); siapa pun yang membuka `/verify-otp?phoneNumber=<nomor korban>` di web dapat memicu `POST /v1/auth/request-otp` ke nomor tersebut (rate-limit backend adalah satu-satunya penahan — perlu verifikasi runtime).
**Dampak:** vektor gangguan (OTP bombing) bila backend tidak membatasi per-IP/per-nomor.
**Saran:** simpan nomor di state memori alur registrasi (B-07) sehingga layar ini tidak bisa dipakai standalone; pastikan backend membatasi request-otp per IP+nomor.

---

## C. Chat & realtime

### C-01 🟠 Pesan baru dari hasil POST ditambahkan tanpa dedupe terhadap poll
**Bukti:** `app/chat/[roomId].tsx:381` — `setMessages((prev) => [...prev, msg])` tanpa cek id; poll 8 detik (`:266`) bisa saja sudah memasukkan pesan yang sama (server mengembalikan pesan sendiri di halaman terbaru) sebelum respons POST diproses.
**Dampak:** gelembung ganda + React duplicate key warning; berisiko makin sering saat latensi tinggi.
**Saran:** `mergeIncoming([msg])` (fungsi dedupe yang sudah ada di `:236-258`) alih-alih append mentah.

### C-02 🟠 `loadOlder` mengirim SEMUA id pesan sebagai `excludeIds` di query string
**Bukti:** `app/chat/[roomId].tsx:288-292` — `excludeIds: messages.map((m) => m.id)`.
**Dampak:** thread panjang (ratusan pesan setelah beberapa load-more) → URL ribuan karakter; risiko 414/ditolak proxy, dan biaya parse backend. `buildUrl` meng-encode tiap id sebagai pasangan key terpisah (`lib/api/client.ts:78-88`).
**Saran:** andalkan cursor saja (`nextCursor` sudah dikirim), atau batasi excludeIds ke N id terakhir, atau pindahkan ke body POST search.

### C-03 🟠 Race dedupe di `loadOlder`: set `known` dihitung dari closure, bukan state terkini
**Bukti:** `app/chat/[roomId].tsx:293-295` — `known` dari `messages` saat callback dibuat; merge `setMessages((prev) => sortByTime([...fresh, ...prev]))` memakai `prev` terkini. Bila poll menyisipkan pesan di antara request dan setState, `fresh` bisa berisi id yang sudah ada di `prev`.
**Dampak:** duplikat pesan (jarang, tapi nyata saat poll dan load-more bertepatan).
**Saran:** lakukan filter dedupe DI DALAM updater `setMessages` terhadap `prev`.

### C-04 🟡 Poll presence memakai `setInterval` mentah — tetap jalan saat app background
**Bukti:** `app/chat/[roomId].tsx:225-231` — `setInterval(() => void refreshPresence(), PRESENCE_POLL_MS)` tanpa cek AppState/visibility; repo sudah punya `usePolling` yang melakukan itu (`lib/use-polling.ts:15-19`) dan dipakai untuk pesan di file yang sama (`:266`).
**Dampak:** request presence 30 detikan terus berjalan saat app di background (baterai/kuota), dan dua mekanisme polling dalam satu layar.
**Saran:** ganti ke `usePolling(refreshPresence, PRESENCE_POLL_MS, Boolean(roomId))`.

### C-05 🟡 `pollNewMessages` tidak meneruskan AbortSignal
**Bukti:** `app/chat/[roomId].tsx:260-264` — `api.chat.getChatMessages(roomId, { limit })` tanpa signal; bandingkan `fetchMessages` (`:150-183`) yang membuat controller. `usePolling` juga tidak membatalkan callback yang sedang terbang saat unmount.
**Dampak:** respons yang datang setelah pindah ruang/pustaka tetap menjalankan `mergeIncoming` → setState pada komponen unmount / pesan ruang lama masuk ke ruang baru (kunci layar berbeda tidak membatalkan fetch).
**Saran:** teruskan signal per-tick (usePolling bisa diperluas mengirim signal) atau guard `roomId` terkini di mergeIncoming.

### C-06 🟡 Judul ruang & nama lawan bicara hilang untuk ruang di luar 30 pertama
**Bukti:** `app/chat/[roomId].tsx:157-171` — `room` dicari dari `listChatRooms({page:1, limit: CHAT_PAGE_SIZE})` (`CHAT_PAGE_SIZE = 30`, `lib/api/chat.ts:18`); docblock mengakui "GET /rooms tidak punya endpoint detail".
**Dampak:** pengguna dengan >30 percakapan melihat header "Percakapan" tanpa nama/avatar lawan bicara — konteks identitas hilang di layar yang dipakai transaksi.
**Saran:** endpoint `GET /v1/chat/rooms/{id}` di backend (celah kontrak), sementara itu kirim nama lewat params saat navigasi dari daftar.

### C-07 🟡 Reaksi/pin/read-receipt pihak lain tidak pernah segar selama ruang terbuka
**Bukti:** `app/chat/[roomId].tsx:249-251` (komentar eksplisit: "poll tidak memperbarui reaksi pesan yang sudah ada di thread"); `refreshReadReceipts`/`refreshPinned` hanya dipanggil di mount (`:225-231`) dan setelah aksi sendiri (`:390,467`).
**Dampak:** emoji reaksi balasan, pin baru, dan tanda baca dari lawan bicara tidak muncul sampai keluar-masuk ruang — chat terasa mati.
**Saran:** ikutkan refresh receipts/pinned periodik (murah) atau — lebih baik — selesaikan P1-03 warisan (WebSocket, lihat K-03).

### C-08 🟡 Indikator mengetik tidak dihentikan saat meninggalkan ruang
**Bukti:** `app/chat/[roomId].tsx:597-601` — cleanup unmount hanya `clearTimeout(typingTimer.current)`; tidak mengirim `sendChatTyping(roomId, false)`.
**Dampak:** lawan bicara melihat "sedang mengetik…" tersisa sampai TTL server (perlu verifikasi runtime berapa lama).
**Saran:** kirim `typing=false` fire-and-forget di cleanup unmount.

### C-09 🔵 Optimistic rollback reaksi salah saat melepas reaksi tunggal
**Bukti:** `app/chat/[roomId].tsx:435-438` — saat melepas reaksi sendiri dengan `count === 1`, optimistic update memakai `Math.max(1, count - 1)` → tetap 1 dengan `reactedByMe:false`, dan `filter(r => r.count > 0)` (`:443`) mempertahankannya.
**Dampak:** chip emoji tetap tampil (seolah orang lain bereaksi) selama request berjalan, lalu hilang saat respons tiba — flicker yang membingungkan.
**Saran:** untuk kasus `mine`, hitung `count - 1` dan biarkan filter membuang chip saat 0.

### C-10 💡 Forward pesan dibatasi 50 ruang dan hanya ke "lawan bicara yang sama"
**Bukti:** `app/chat/[roomId].tsx:527-548` — `listChatRooms({page:1, limit:50})` lalu filter `counterpart?.id === room.counterpart?.id`.
**Dampak:** fitur forward nyaris tak berguna (kapan ada 2 ruang dengan orang yang sama?) dan melewatkan target bila ruang >50.
**Saran:** picker ruang penuh (paginasi) seperti WhatsApp; endpoint forward sudah menerima array `targetRoomIds`.

---

## D. Keamanan & privasi

### D-01 🔴 27 dependency vulnerability (8 high) masih terpasang
**Bukti:** `npm audit` (2026-09-20): 8 high — rantai `expo → @expo/cli → @expo/config(-plugins)`, `metro → image-size` (DoS parser ICNS infinite loop + JXL/HEIF), `metro-config`, `metro-transform-worker`, `@expo/metro(-config)`; total 27 (19 moderate). Cocok dengan catatan audit sebelumnya (P1-05) yang belum dieksekusi.
**Dampak:** mayoritas build-time (Metro), tetapi `expo` direct-dependency; supply-chain dan scanner store akan menandainya.
**Saran:** jadwalkan upgrade SDK/patch, `npm audit --audit-level=high` sebagai gate CI (setelah CI ada — I-01), dan dokumentasikan mana yang build-time vs runtime.

### D-02 🟠 Tidak ada proteksi screenshot/screen-recording untuk layar sensitif
**Bukti:** grep `FLAG_SECURE|screenshot|secure-screen` di `app/`, `lib/`, `components/`, `app.json` → 0 implementasi. Layar PIN sheet (`components/ui/pin-input.tsx`), KYC NIK+KTP (`app/kyc.tsx:101,262`), backup codes 2FA (`components/ui/backup-codes-display.tsx`), dan saldo (`app/(tabs)/home.tsx`) semuanya bebas direkam.
**Dampak:** standar aplikasi finansial Indonesia (mobile banking/e-wallet) memakai FLAG_SECURE di Android dan deteksi screen-capture iOS untuk layar PIN/OTP/KTP; absennya ini adalah gap kepatuhan/trust.
**Saran:** expo plugin/konfig `FLAG_SECURE` untuk sheet PIN/OTP/backup-code/KYC; toggle "sembunyikan saldo" sudah ada untuk privasi kasual.

### D-03 🟠 Tidak ada crash reporting / error telemetry sama sekali
**Bukti:** `app/_layout.tsx:96-98` — `console.error("[kahade/fonts] …")` dengan komentar "(nanti) ke Sentry/observability"; grep `Sentry|sentry|bugsnag|crashlytics` = 0; `components/app-error-boundary.tsx` hanya UI.
**Dampak:** 96 layar produksi tanpa visibilitas error; bug seperti A-01…A-03 tidak akan pernah terdeteksi dari lapangan.
**Saran:** pasang Sentry/Expo crash reporter + kirim context (route, appVersion, platform, request-id dari `ApiError`) tanpa payload sensitif.

### D-04 🟠 Captcha slider dapat dijawab mesin tanpa interaksi (desain protokol)
**Bukti:** `components/ui/captcha-slider.tsx:4-9` — backend mengirim `targetX` di respons generate; jawaban adalah posisi slider (persen) dengan toleransi ±4; satu-satunya jebakan adalah "solusi <800 ms dianggap bot".
**Dampak:** bot cukup memanggil generate lalu POST `captchaAnswer = targetX` dengan delay 1 detik — captcha tidak menambah biaya serangan. (Akar di backend, tetapi klien yang mengirim `targetX` apa adanya.)
**Saran:** backend: jangan kirim target polos (kirim gambar/proof-of-work atau pakai provider); klien: siap berintegrasi.

### D-05 🟡 `Linking.openURL` tanpa validasi protokol di 3 titik lain
**Bukti:** `components/ui/media-viewer.tsx:109` (URL lampiran dari data lawan bicara/server), `app/privacy-settings.tsx:86` (URL hasil export, hanya `canOpenURL`), `components/legal-document-screen.tsx:42` (URL dokumen dari API publik). Repo punya `safeHttpsUrl()` (`lib/version.ts:20-27`) tetapi hanya dipakai di upload & force-update.
**Dampak:** bila backend/penyerang (lewat filename/URL lampiran) menyuntik skema `intent:`/`file:`/`javascript:` (web), aplikasi membukanya.
**Saran:** bungkus semua openURL keluar data dengan `safeHttpsUrl` (atau whitelist skema).

### D-06 🟡 58 `.catch(() => undefined)` / silent-catch tanpa logging
**Bukti:** `grep -rn "\.catch(() => \(undefined\|null\|{}\))"` → 58; ditambah `catch {}` kosong berpola `catch { /* komentar */ }` (mis. `app/chat/[roomId].tsx:203-208,216-218,221-223`).
**Dampak:** kegagalan register-device, markChatRoomRead, refreshReceipts, dsb. tidak pernah terlihat — debugging produksi buta total (memperparah D-03).
**Saran:** saluran `logWarn(scope, err)` tunggal yang no-op di produksi sampai Sentry terpasang, tetapi setidaknya terhitung di dev.

### D-07 🟡 Firebase API key & konfigurasi ter-commit tanpa bukti pembatasan
**Bukti:** `google-services.json` (api_key `AIzaSy…KXIQ`), `GoogleService-Info.plist` (api_key `AIzaSy…bWY`). `.env.example:20-23` benar menyatakan nilai ini public-by-design dan "batasi lewat Firebase Console (API restrictions / App Check)" — tidak ada artefak/checklist yang membuktikan pembatasan itu sudah dilakukan.
**Dampak:** tanpa App Check/restriction, sender id proyek bisa dipakai pihak lain untuk mengirim push/web-push palsu (biaya & phishing).
**Saran:** checklist release: aktifkan App Check (Play Integrity/DeviceCheck), batasi key, dan dokumentasikan di `docs/PUSH-NOTIFICATIONS.md`.

### D-08 🟡 Tidak ada validasi NIK melebihi panjang 16 digit
**Bukti:** `app/kyc.tsx:62-63,173` — `formValid = … nik.length === NIK_LENGTH`; constraints backend juga hanya `^\d{16}$` (dikutip `lib/financial.ts:73-76`).
**Dampak:** NIK struktural mustahil (mis. digit tanggal 99) lolos klien dan server → antrian review KYC penuh sampah.
**Saran:** validasi struktur (provinsi 2 digit ∈ daftar, tanggal lahir ≤31 + aturan +40 perempuan, dsb.) di klien; tolak dini dengan pesan jelas.

### D-09 🟡 `trustScore` fallback 100/100 saat data tidak ada
**Bukti:** `app/user/[username].tsx:1255` — `{profile.trustScore ?? 100} / 100`.
**Dampak:** profil yang datanya gagal dimuat/tidak dikirim backend tampil sebagai pengguna paling tepercaya — sinyal trust palsu di marketplace.
**Saran:** fallback "—" + label "belum ada skor".

### D-10 🟡 Ekspor data privat (`exportPrivacy`) membuka URL tanpa cek HTTPS
**Bukti:** `app/privacy-settings.tsx:84-86` — `canOpenURL(res.url)` lalu `openURL`. URL ekspor = data pribadi lengkap; bila backend salah mengembalikan URL/http biasa, data terkirim cleartext.
**Saran:** wajib `safeHttpsUrl(res.url)`; tolak selain itu.

### D-11 🔵 89 cast `as any` di lapisan API
**Bukti:** `grep -rn "as any" lib/` → 89 (mayoritas `lib/api/auth.ts:184-405` dst. untuk fallback snake_case). ESLint sengaja mematikannya (`eslint.config.mjs:70-72`).
**Dampak:** normalizer defensif bagus, tetapi `as any` ganda menandakan kontrak respons yang belum diverifikasi (selaras API-06: hanya 3/260 operasi punya response schema).
**Saran:** ganti `as any` dengan `asRecord()`/`pickString()` (sudah ada di `lib/api/response.ts`) agar akses properti tak dikenal type-safe.

### D-12 🟡 Feedback queue menyimpan email/konteks transaksi (walau dibatasi)
**Bukti:** `lib/feedback.ts:40-45,54-55` — antrian offline di SecureStore berisi `message` (≤2000) + `contact` (≤254), TTL 7 hari; `lib/secure-storage.ts:57-64` mengakui "Feedback dapat berisi email/konteks transaksi". Di web memory-only (benar).
**Dampak:** PII menetap 7 hari di perangkat tanpa persetujuan eksplisit; entri >2 KB tetap ditolak diam-diam (pengguna merasa feedback terkirim).
**Saran:** tampilkan status antrian di layar feedback ("1 ulasan menunggu dikirim"), dan minta consent penyimpanan lokal.

### D-13 💡 Token web bergantung penuh pada cookie HttpOnly — tidak ada CSRF token terlihat
**Bukti:** `lib/api/client.ts:264-269` — refresh web via cookie `credentials:"include"`; mutasi juga `credentials:"include"` (`:392`). Tidak ada header CSRF di seluruh repo (grep `csrf` = hanya `csrfToken` milik captcha `lib/api/auth.ts:202`).
**Dampak:** bila backend tidak menyetel `SameSite=Strict/Lax` + origin check (perlu verifikasi runtime — di luar repo ini), mutasi ber-cookie rentan CSRF di web.
**Saran:** verifikasi header `Set-Cookie` produksi; tambahkan double-submit token bila SameSite tidak cukup.

### D-14 🟡 `deviceInfo` header membocorkan model+OS ke setiap request termasuk publik
**Bukti:** `lib/api/session.ts:160-172` — `X-Device-Info: Kahade/x (iOS 17.5; Apple iPhone 15)` dikirim `deviceHeaders()` di SEMUA request (`lib/api/client.ts:100-107`), termasuk endpoint publik (`auth:"none"`).
**Dampak:** fingerprinting perangkat ke endpoint yang tidak memerlukannya (prinsip minimalisasi data).
**Saran:** kirim header device hanya untuk `auth !== "none"` atau endpoint yang kontraknya membutuhkan.

---

## E. i18n & lokalisasi

### E-01 🟠 22 string UI belum punya terjemahan English (98,6% — gate ratchet menahan di sini)
**Bukti:** `npm run check:i18n` → "belum 22". Daftar lengkap + lokasi (dihitung dari `lib/i18n/catalog.json` vs `lib/i18n/en/*`):

| String | Layar |
|---|---|
| "Lupa kata sandi?" | `app/(auth)/login.tsx:295`, `app/live-support.tsx` |
| "Ubah nomor HP akun" | `app/edit-profile.tsx` |
| "Mengganti nomor HP akun membutuhkan verifikasi keamanan OTP." | `app/edit-profile.tsx` |
| "Tarik Saldo Terlebih Dahulu" | `app/delete-account.tsx` |
| "Alasan Laporan" | `app/(tabs)/discover.tsx:636` |
| "Laporkan Karya" | `app/(tabs)/discover.tsx:622` |
| "Spam atau penipuan" | `app/(tabs)/discover.tsx:638` |
| "Pelecehan atau ujaran kebencian" | `app/(tabs)/discover.tsx:640` |
| "Jelaskan secara singkat detail pelanggaran..." | `app/(tabs)/discover.tsx` |
| "Keterangan tambahan (opsional)" | `app/(tabs)/discover.tsx` |
| "Terima kasih telah membantu menjaga keamanan komunitas Kahade." | `app/(tabs)/discover.tsx` |
| "Tambah rekening bank" | `app/withdrawal-schedules.tsx` |
| "Pilih rekening bank tujuan" | `app/withdrawal-schedules.tsx` |
| "Pilih Rekening Tujuan" | `app/withdrawal-schedules.tsx` |
| "Rekening Bank Tujuan" | `app/withdrawal-schedules.tsx` |
| "Pilih rekening bank untuk penarikan otomatis terjadwal." | `app/withdrawal-schedules.tsx` |
| "Tambahkan atau pilih rekening bank untuk penarikan." | `app/withdrawal-schedules.tsx` |
| "Belum ada rekening bank terdaftar." | `app/withdrawal-schedules.tsx` |
| "Dihapus dari favorit" | `app/favorites.tsx` |
| "Gagal menghapus favorit" | `app/favorites.tsx` |
| "Lampiran" | `app/chat/[roomId].tsx`, `app/delivery-proof/[orderId].tsx`, `app/dispute/[id].tsx`, `app/support/[ticketId].tsx` |
| "Pengguna ini akan dapat melihat profil Anda dan memulai percakapan kembali." | `app/blocked-users.tsx` |

**Dampak:** mode English menampilkan campuran EN/ID persis di alur sensitif (laporan, rekening bank, favorit).
**Saran:** tambahkan ke `lib/i18n/en/screens-*.json`; coverage naik ke 100% dan ratchet otomatis mengunci.

### E-02 🟠 Label aksesibilitas TIDAK diterjemahkan di hampir semua primitif interaktif
**Bukti:** `components/ui/text.tsx` menerjemahkan children & `accessibilityLabel` (via `localizeChildren`/`translateProp`), tetapi grep `translate` di `components/ui/pressable-scale.tsx`, `icon-button.tsx`, `button.tsx`, `list-item.tsx` → **0**. `ListItem` bahkan membangun `accessibilityLabel` dari `title` mentah (`components/ui/list-item.tsx:181-183`). 20 `accessibilityLabel={`…`}` template-literal di `app/` juga tak tersentuh kamus.
**Dampak:** pengguna VoiceOver/TalkBack berbahasa Inggris mendengar navigasi campur bahasa — aksesibilitas + i18n gagal bersamaan.
**Saran:** terapkan `translateProp()` pada `accessibilityLabel` di keempat primitif (satu perubahan, efek global).

### E-03 🟡 Teks campur ekspresi JSX tetap Indonesia permanen di mode EN
**Bukti:** `lib/i18n/translate.ts:108-113` (dokumentasi sendiri: "Children campuran (`Halo {name}`) sengaja TIDAK digabung"); contoh pemakai: `app/transfer.tsx:436` ("Kirim ke @{username}"), `app/(tabs)/home.tsx:334`.
**Dampak:** kalimat dengan nilai runtime tidak pernah ter-translate kecuali penulis layar memakai `t("…{x}…")` manual — tidak ada yang memaksa.
**Saran:** tambahkan aturan check:i18n yang menandai template-literal di dalam `<Text>` dan wajibkan pola `t()` berslot untuk string ber-runtime-value.

### E-04 🟡 Kunci i18n = teks sumber: mengganti copy mematikan terjemahan secara sunyi
**Bukti:** `lib/i18n/translate.ts:5-15` (trade-off terdokumentasi); `scripts/check-i18n.mjs` mendeteksi kunci yatim hanya saat CI dijalankan — yang tidak ada (I-01).
**Dampak:** tanpa CI, rename copy Indonesia menghapus terjemahan EN tanpa terdeteksi sampai pengguna komplain.
**Saran:** jalankan `check:i18n` di CI apa pun (GitHub Actions/EAS hook) — murah (skrip node, <2 dtk).

### E-05 🟡 `<html lang="id">` statis untuk aplikasi dwibahasa
**Bukti:** `app/+html.tsx:8`.
**Dampak:** SEO & screen reader web selalu memakai pelafalan Indonesia, termasuk untuk pengguna EN; hreflang tidak ada.
**Saran:** karena output statis, minimal tambah `<meta http-equiv="content-language">` dinamis via i18n store di client + pertimbangkan path `/en/` bila SEO EN serius.

### E-06 🟡 `greetingByHour()` mengembalikan salam Indonesia mentah ke `accessibilityLabel`
**Bukti:** `app/(tabs)/home.tsx:110-116,334` — "Selamat pagi" dll. dirender via `<Text>` (ter-translate) tetapi juga disisipkan ke `accessibilityLabel` PressableScale (tidak ter-translate — E-02).
**Saran:** perbaiki E-02 maka ini ikut beres; atau hitung salam lewat `t()`.

### E-07 🔵 Katalog 1.596 string dikelola generator AST — string dinamis (toast `title: userMessage(err)`) tak terkatalog
**Bukti:** `scripts/gen-i18n-catalog.mjs` memindai literal; pesan error backend dari `DEFAULT_ERROR_MESSAGES`/`userMessage` (`lib/api/errors.ts`) berbahasa Indonesia dan tidak melalui kamus EN.
**Dampak:** saat backend/transport error, pengguna EN melihat pesan Indonesia.
**Saran:** terjemahkan `DEFAULT_ERROR_MESSAGES` per bahasa (tabel kecil, dampak besar).

### E-08 🔵 `formatDate/formatTime` tidak pernah menampilkan penanda zona waktu
**Bukti:** `lib/format.ts:352-370` — "3 Sep 2026, 14:30" dari jam perangkat; Indonesia punya 3 zona (WIB/WITA/WIT).
**Dampak:** untuk tenggat escrow/dispute lintas pulau, "14:30" ambigu — sengketa "terlambat konfirmasi" bisa berakar dari sini.
**Saran:** tampilkan zona server (WIB) untuk tenggat, atau konversi eksplisit + label.

### E-09 💡 Tidak ada bahasa ketiga padahal arsitektur mendukung
**Bukti:** `lib/i18n/languages.ts` + `system-language.ts:9-12` — "English adalah satu-satunya kamus yang ada"; OS berbahasa Jawa/Sunda/Arab/Mandarin jatuh ke EN/ID.
**Saran:** roadmap: `zh`, `ar` (pasar TKI/ekspat), struktur `DICTS` sudah siap.

### E-10 🟡 Cache terjemahan dibersihkan total saat penuh (4000 entri)
**Bukti:** `lib/i18n/translate.ts:42-44,88` — `if (cache.size >= CACHE_MAX) cache.clear()`.
**Dampak:** daftar panjang (ribuan baris riwayat unik) memicu clear-all berulang → lookup shape (regex mask) berjalan ulang untuk semua string; jitter kecil tapi bisa dihindari.
**Saran:** LRU sederhana atau naikkan batas (ukuran entri kecil).

---

## F. Kesegaran data, performa & jaringan

### F-01 🟠 Daftar ber-paginasi TIDAK pernah segar saat kembali fokus
**Bukti:** `lib/use-api-query.ts:14-19,77-93` punya `refreshOnFocus` — tetapi hanya dipakai 2 layar (`app/(tabs)/home.tsx`, `app/(tabs)/wallet.tsx`). `lib/use-paginated-query.ts` **tidak punya opsi itu sama sekali**; pemakainya: `app/(tabs)/transactions.tsx:69`, `app/notifications.tsx:121`, `app/wallet-history.tsx:176`, `app/(tabs)/discover.tsx:97`, `app/chat.tsx`, `app/followers/[username].tsx`, `app/search.tsx`.
**Dampak:** bayar pesanan di detail → kembali ke tab Transaksi → status lama "PENDING_PAYMENT" tetap tampil sampai pull-to-refresh manual. Untuk aplikasi escrow ini bug kebenaran (doktrin repo sendiri di `use-api-query.ts:12-13`: "untuk angka uang, tampilan basi adalah bug kebenaran").
**Saran:** tambahkan `refreshOnFocus` ke `usePaginatedQuery` (reset-and-refresh senyap) dan aktifkan di tab money/notification.

### F-02 🟠 `refreshOnFocus` tidak memulihkan layar yang gagal muat
**Bukti:** `lib/use-api-query.ts:87` — `if (!latest.current.enabled || !hasData.current) return`.
**Dampak:** layar yang load awalnya error (data null) tidak pernah di-retry saat pengguna kembali ke tab; error state menetap meski jaringan sudah pulih.
**Saran:** bila `error != null`, fokus ulang memicu `reload()`.

### F-03 🟠 `useApiQuery` tidak punya cache/dedupe lintas layar meski menerima `key`
**Bukti:** `lib/use-api-query.ts:21-63` — `key` hanya dipakai sebagai dep `useCallback`; tidak ada registry global. `app/withdraw.tsx:82` memakai key `"wallet-overview"`, `app/transfer.tsx:77` `"wallet-overview-transfer"` — dua layar berbeda, dua fetch `GET /v1/wallet` terpisah saat berpindah.
**Dampak:** parameter `key` memberi ilusi caching ala react-query; tiap mount layar = request ulang penuh (profil, wallet, dsb.), memperparah F-01 dan kuota pengguna.
**Saran:** cache in-memory TTL pendek per key (mis. 5-10 dtk, stale-while-revalidate) — dedupe in-flight GET sudah ada di `lib/api/client.ts:290-311`, tinggal lapisan cache kecil.

### F-04 🟡 Home melakukan 5 request paralel per buka/fokus, satu di antaranya pemborosan murni
**Bukti:** `app/(tabs)/home.tsx:157-196`; khusus `home-completed-count` (`:186-194`) memanggil `listOrders({limit:1, status:"COMPLETED"})` **hanya untuk membaca `meta.total`**. Semua `refreshOnFocus:true` → diulang tiap kembali ke tab.
**Dampak:** first-open lambat di jaringan seluler; 1 request list penuh hanya untuk 1 angka.
**Saran:** backend tambahkan `completedCount` di `/v1/orders/summary` (sudah direkomendasikan P1-06 audit sebelumnya, belum terjadi) atau endpoint agregat dashboard.

### F-05 🟡 Detail order menarik 4-5 request per buka, termasuk data global yang bisa di-cache
**Bukti:** `app/order/[id].tsx:168-190` — `getOrder` + `getOrderHistory(limit 50)` + `getAverageDurations` (statistik GLOBAL, ditarik per order!) + `getMe` (hanya untuk infer role) + kadang `calculateFee`.
**Dampak:** latensi & kuota; `getMe` redundan bila backend mengisi `myRole` (fallback-nya justru menyembunyikan bug backend).
**Saran:** cache `average-durations` per sesi (nilai berubah harian); hapus `getMe` bila `myRole` sudah terjamin (verifikasi backend).

### F-06 🟡 Chat & komentar showcase dirender tanpa virtualisasi
**Bukti:** `app/chat/[roomId].tsx:27` (ScrollView) + akumulasi pesan via load-more/poll ke satu state array; `app/showcase/[id].tsx:704-716` (`comments.map` + `replies.map` di ScrollView).
**Dampak:** thread 200+ pesan = 200 bubble ter-mount dengan gambar; memori & FPS jatuh di Android low-end; scrollToEnd per content-size change memperparah.
**Saran:** FlashList/FlatList inverted untuk chat; SectionList untuk komentar.

### F-07 🟡 Polling chat 8 detik per ruang terbuka (transport utama, bukan fallback)
**Bukti:** `app/chat/[roomId].tsx:95` (`CHAT_POLL_MS = 8000`), `:266`. Ditambah poll presence 30 d (C-04), poll unread 60 d (B-05) → 3 loop berjalan bersamaan di satu layar.
**Dampak:** baterai & server load; delay pesan terasa (audit sebelumnya P1-03, masih terbuka).
**Saran:** WebSocket/SSE (backend gateway sudah ada per API-GAP doc); sementara: naikkan interval saat idle dan turunkan saat aktif mengetik.

### F-08 🟡 Efek auto-select deep-link transfer berjalan setiap render
**Bukti:** `app/transfer.tsx:214-222` — dep `[presetUsername, results, selected, handleSelect]`; `results` adalah array baru hasil `.map()` di tiap render (`app/transfer.tsx:140-146`).
**Dampak:** body efek + `find` dieksekusi tiap render selama `presetUsername` ada dan `selected` null; ringan tapi pola yang salah dan menutupi bug deps lain.
**Saran:** memo `results` dengan `useMemo([lookup.data])` atau pindahkan logika ke dalam fetcher/effect yang bergantung `lookup.data`.

### F-09 🟡 `hasNewIds` menghentikan paginasi saat satu halaman penuh duplikat
**Bukti:** `lib/use-paginated-query.ts:49-56` — `hasNext = … && (reset || hasNewIds) && page < totalPages`.
**Dampak:** jika backend menggeser urutan (item baru masuk di atas) sehingga halaman berikutnya seluruhnya duplikat, daftar berhenti memuat padahal `totalPages` mengatakan masih ada — item lama tak terjangkau.
**Saran:** andalkan `page < totalPages` saja; duplikat sudah diurus `mergeById`.

### F-10 🔵 `mergeById` mempertahankan posisi lama untuk item yang diperbarui
**Bukti:** `lib/use-paginated-query.ts:5-9` — Map mempertahankan urutan insersi `previous`.
**Dampak:** notifikasi/transaksi yang baru di-refresh tetap di posisi lama sampai reset — untuk feed berbasis waktu bisa terasa "tidak urut".
**Saran:** untuk feed kronologis, sortir ulang setelah merge (atau dokumen bahwa urutan = urutan unduh).

### F-11 🟡 Tidak ada retry/backoff pada `useApiQuery` (hanya 1x percobaan)
**Bukti:** `lib/use-api-query.ts:47-52` — satu `load`, error → berhenti; retry GET di transport maksimal 2 (`lib/api/client.ts:452`) tetapi hanya bila adapter memasang `retry`.
**Dampak:** jaringan seluler goyah sekali = layar error sampai interaksi manual.
**Saran:** retry adaptif (1x, backoff 800ms) untuk GET idempoten di hook, hormati `Retry-After` yang sudah diparse transport (`lib/api/client.ts:203-208`).

### F-12 🔵 Web bundle 4,32 MB (uncompressed) tanpa strategi pemecahan
**Bukti:** angka terverifikasi audit 2026-09-19 (`npm run build:web`); repo tidak punya code-splitting/lazy route (semua 96 layar diekspor statis).
**Dampak:** TTI web lambat di 4G; bounce rate tamu (padahal web = corong akuisisi order-link).
**Saran:** lazy-load layar berat (showcase, chat), audit dependensi (firebase hanya perlu di web-push), kompresi brotli di Cloudflare (sudah?) — ukur ulang.

### F-13 🟡 Semua countdown memakai jam perangkat tanpa koreksi skew
**Bukti:** `components/ui/countdown.tsx:82-100` (`Date.now()`), dipakai OTP resend, lockout PIN, deadline order (`components/ui/order-card.tsx:39,148`), topup expiry (`components/ui/topup-status-card.tsx:280-285`). Grep `serverTime|timeOffset` → 0.
**Dampak:** perangkat dengan jam maju/mundur melihat tenggat salah — di kasus ekstrem, pengguna mengira masih punya waktu untuk konfirmasi penerimaan barang (dana lepas otomatis) atau OTP "kedaluwarsa" padahal valid.
**Saran:** hitung offset sekali per sesi dari header `Date` respons API, terapkan di `useCountdown`.

### F-14 💡 `expo-updates` `checkAutomatically: ON_LOAD` tanpa UI update OTA
**Bukti:** `app.json` (updates ON_LOAD, fallbackToCacheTimeout 0); tidak ada pemanggil `Updates.*` di kode (grep 0) untuk mengumumkan bundle baru.
**Dampak:** pengguna tidak tahu app baru saja diperbarui (perubahan mendadak tanpa catatan rilis).
**Saran:** "What's new" ringan berdasar `runtime-info`/versi bundle.

---

## G. Dead code, duplikasi & konsistensi

### G-01 🟡 29 komponen UI mati (tidak pernah diimpor) dipertahankan sebagai "cadangan roadmap"
**Bukti:** `scripts/check-screens.mjs:445-475` (UNUSED_UI_BASELINE): accordion, banner, biometric-prompt-trigger, box, bullet-list, captcha-field, checkbox-group, count-badge, data-table, dispute-evidence-item, filter-sheet-content, incoming-call-prompt, kyc-document-viewer, menu-list, order-summary-strip, presence, result-state, search-overlay, show, signature-pad, slider, surface, swipeable-list-item, tag-input, tooltip, two-factor-method-selector, typography, wallet-balance-card, z-stack. Skrip sendiri memperingatkan: "TIDAK diuji oleh layar mana pun … pasti menyimpang perlahan".
**Dampak:** ±ribuan baris tak teruji yang membusuk; `biometric-prompt-trigger` dan `captcha-field` khususnya mewakili fitur yang DIKLAIM ada (§9.21) tapi tak terpasang (A-01).
**Saran:** putuskan per komponen: pasang (hapus dari baseline) atau hapus dari repo (riwayat git menyimpannya). Baseline "hanya boleh menyusut" harus dijadwalkan menyusut.

### G-02 🟡 27 layar menyalin manual kerangka Screen+Header+PullToRefresh (S3)
**Bukti:** baseline `scripts/check-screens.mjs` (S3): bank-accounts, create-transaction, delivery-proof, edit-profile, extension, invoice, kyc, order-link, order-links, order/[id], questions, rate, ratings, referral, reports, security-activity, showcase-management, subscriptions, support/[ticketId], transaction-templates, two-factor, user/[username] (+3 sub-route), wallet-transaction, withdrawal-schedules. `<DataScreen>` tersedia tetapi tidak dipakai.
**Dampak:** perubahan pola (mis. safe-area, gesture) harus disalin 27 kali — sumber regresi paritas platform yang sudah pernah terjadi (docs/audit/PLATFORM-PARITY.md Bug-2).
**Saran:** migrasi bertahap 3-5 layar/sprint; ratchet baseline.

### G-03 🔵 2 layar merakit state async manual (S1): `create-transaction.tsx`, `user/[username].tsx`
**Bukti:** baseline S1 `scripts/check-screens.mjs` + komentar audit di `app/order/[id].tsx:147-155` yang menceritakan cacat pola lama (abort hilang, refreshing menggantikan konten dengan skeleton) — pola yang sama masih hidup di dua layar ini.
**Saran:** bentuk "useApiQuery untuk form" (guard draft-key) lalu migrasikan.

### G-04 🔵 `cleanupUploads` dead export (diakui sendiri di komentar)
**Bukti:** `lib/api/upload.ts:115-120` — "belum punya pemanggil di app (dead export)". Konsekuensinya nyata: upload presigned KYC/avatar yang gagal di-confirm meninggalkan orphan di S3 (tidak ada cleanup setelah `confirmAvatar` gagal — `app/edit-profile.tsx:336-340`).
**Saran:** pasang di catch blok upload/confirm (best-effort) atau hapus.

### G-05 🟡 Blok biometrik di-copy-paste 4× (effect ketersediaan + handler)
**Bukti:** effect identik `getSecureItem(biometricEnabled)+getBiometricCapability` di `app/transfer.tsx:104-119`, `app/withdraw.tsx:110-125`, `app/order/[id].tsx:225-242`, variasi di `app/biometric-settings.tsx:51-70`; `handleBiometric` duplikat 3× (A-01..03).
**Saran:** ekstrak `useBiometricAvailability()` + satu `confirmWithBiometricOrPin()` — satu tempat memperbaiki A-01 untuk semua layar.

### G-06 🟡 Tiga wizard uang (topup/transfer/withdraw) menduplikasi struktur langkah, overlay, dan `RESULT_HOLD_MS`
**Bukti:** `app/topup.tsx:59,102` / `app/transfer.tsx:63-65` / `app/withdraw.tsx:66-70` — konstanta & pola identik (stepIndex/progress, TransactionProgressOverlay, submitLock, RESULT_HOLD_MS=1400, footer CTA `paddingBottom: Math.max(...)`).
**Dampak:** perbaikan bug (mis. A-14, A-08) harus diterapkan 3×; sudah terbukti menyimpang (transfer punya `uncertain`, withdraw tidak).
**Saran:** ekstrak `useMoneyWizard()`/`<WizardFooter>`/`<ResultOverlayTimer>`.

### G-07 🔵 56 file memiliki docblock yang tergeser ke bawah import (konvensi repo rusak)
**Bukti:** skrip pemindaian: 56 file `app/`, `components/`, `lib/` diawali `import …` lalu `/** Kahade — … */` (mis. `app/order/[id].tsx:1-3`, `app/(tabs)/wallet.tsx:1-5`, `lib/api/wallet.ts`, `lib/use-polling.ts`). Konvensi repo: docblock = baris pertama (lihat file-file yang benar seperti `lib/api/client.ts`).
**Dampak:** dokumentasi "keputusan non-obvious" tidak lagi menjadi header file; tooling JSDoc/editor melewatinya.
**Saran:** codemod satu kali (pindahkan docblock ke atas) + lint rule custom bila perlu.

### G-08 🔵 `app.json` slug = "frontend"
**Bukti:** `app.json:4` — `"slug": "frontend"` untuk produk bernama Kahade; `package.json:2` `"name": "kahade"`.
**Dampak:** slug dipakai EAS/URL update (`u.expo.dev`) dan identitas proyek developer-facing; "frontend" generik dan membingungkan di dashboard Expo/EAS.
**Saran:** ubah ke `kahade` (perhatikan: slug memengaruhi URL OTA — lakukan sebelum rilis produksi, bukan sesudah).

### G-09 🔵 Komentar konfigurasi basi: eslint.config.mjs merujuk penanda yang sudah tidak ada
**Bukti:** `eslint.config.mjs:5-7` mengklaim `components/ui/toast.tsx` "sudah menulis eslint-disable-next-line react-hooks/exhaustive-deps" — grep seluruh repo: **0** `eslint-disable` di source.
**Saran:** perbarui narasi config (alasan keberadaan aturan tetap valid).

### G-10 🔵 `lib/api/types.ts` monolit 1.559 baris + `constraints.ts` 1.157 baris generated
**Bukti:** `wc -l`. Kedua file generated/d semi-generated; perubahan kecil menghasilkan diff raksasa dan merge conflict luas.
**Saran:** split per domain saat regenerasi (auth/orders/wallet/…) — generator sudah per-modul.

### G-11 🔵 Layar "god component": `user/[username].tsx` 1.520 baris, `order/[id].tsx` 1.077, `chat/[roomId].tsx` 944, `dispute/[id].tsx` 907, `showcase/[id].tsx` 897
**Bukti:** `wc -l` (top-5 layar).
**Dampak:** review mustahil menyeluruh; bug seperti C-01..C-09 bersembunyi di dalamnya.
**Saran:** pecah per seksi (header/sheet/aksi) menjadi komponen bernama; tetap satu route.

### G-12 🔵 Duplikasi label status/kategori lintas layar
**Bukti:** `ORDER_STATUS_LABELS` (`components/ui/order-status-badge.tsx`), `DISPUTE_CATEGORIES` lokal di `app/order/[id].tsx:103-113` vs kategori di `app/dispute/[id].tsx` vs `components/ui/dispute-status-badge.tsx`; `CANCEL_REASONS` lokal `app/order/[id].tsx:115-122` vs `components/ui/reason-picker.tsx` opsi.
**Dampak:** enum backend berubah → beberapa layar tertinggal (sudah terjadi pada report reasons — G-13).
**Saran:** satu modul `lib/labels/` per domain, diimpor semua layar.

### G-13 🟠 Lima implementasi "alasan laporan" dengan enum yang BERBEDA
**Bukti:** (1) `components/ui/report-form.tsx:49-56` — SCAM/HARASSMENT/FAKE_ACCOUNT/INAPPROPRIATE_CONTENT/SPAM/OTHER (dipetakan benar ke backend di `app/reports.tsx:51-59`); (2) `app/(tabs)/discover.tsx:636-644` — SPAM/**INAPPROPRIATE**/HARASSMENT/OTHER inline (tanpa ReportForm, string tak diterjemahkan E-01); (3) `app/questions.tsx:47+` — daftar sendiri; (4) `app/showcase/[id].tsx:87+,882` — daftar sendiri; (5) enum backend `ReportUserDto.category` = FRAUD/FAKE_IDENTITY/INAPPROPRIATE_CONTENT/TNC_VIOLATION/MONEY_LAUNDERING/SPAM/OTHER (`lib/api/constraints.ts:626-636`).
**Dampak:** nilai "INAPPROPRIATE"/"SCAM"/"HARASSMENT"/"FAKE_ACCOUNT" yang dikirim endpoint showcase/question TIDAK ada di enum backend untuk report user (perlu verifikasi per-endpoint mana yang divalidasi) — laporan bisa ditolak 400 atau tersimpan dengan kategori tak dikenal moderasi.
**Saran:** satu sumber `REPORT_REASONS` + peta kategori per endpoint; validasi `assertDtoConstraints` di adapter report.

### G-14 🔵 Ikon tray dipakai sebagai "Pesan" (chat) dengan komentar desain, Bell & Tray berdampingan membingungkan
**Bukti:** `app/(tabs)/home.tsx:405-421` — `{/* Ikon chat diperbesar (tray) sesuai permintaan desain */}` memakai ikon `Tray` (nampan arsip) untuk navigasi chat; pustaka punya `Chats`/`ChatCircleDots` yang dipakai di tempat lain (`app/order/[id].tsx` import `ChatCircleDots`).
**Dampak:** semantik ikon tidak konsisten antar layar untuk tujuan yang sama.
**Saran:** samakan ikon chat di semua titik masuk.

---

## H. Testing & QA

### H-01 🟠 Nol test untuk logika transport paling kritis: 401→refresh→replay, single-flight, retry-backoff, expireSession
**Bukti:** `tests/idempotency-key.test.ts:57-88` hanya menguji pembuatan/reuse kunci; tidak ada test yang mensimulasikan 401 lalu refresh (mock fetch) — grep `refreshAccessToken|401` di `tests/` → hanya idempotency. `lib/api/client.ts` 479 baris dengan state machine rumit (revision, single-flight, abort race) tanpa coverage.
**Dampak:** regresi di jalur yang melindungi semua operasi uang tidak terdeteksi CI.
**Saran:** test dengan `vi.stubGlobal("fetch")`: 401→refresh→replay berbagi kunci; dua 401 paralel → satu refresh; refresh 429 → TIDAK logout; revision naik → respons lama dibuang.

### H-02 🟠 Nol test untuk hook data (`useApiQuery`, `usePaginatedQuery`, `usePolling`)
**Bukti:** `grep -rn "useApiQuery\|usePaginatedQuery\|usePolling" tests/` → 0. Padahal F-02/F-09 adalah bug di hook ini yang test-nya mudah (renderHook + fake timers).
**Saran:** suite hook: abort saat unmount, refreshOnFocus, gating error, mergeById/hasNext.

### H-03 🟠 Fungsi format uang/telepon/tanggal nyaris tak teruji
**Bukti:** `tests/format-count-compact.test.ts` hanya menguji `formatCountCompact` + `formatNumber`. Tidak ada test untuk `formatRupiah`, `parseRupiah`, `parseRupiahPartial`, `amountInputValue`, `formatPhoneId`, `maskAccountNumber`, `formatFileSize`, `truncateMiddle`, `formatDate/Time` — semuanya fungsi uang/PII dengan riwayat bug panjang (komentar "audit #5" di `lib/format.ts` menyebut ≥6 bug masa lalu di fungsi-fungsi ini).
**Saran:** suite tabel (input→output) untuk semua fungsi format; ini test termurah dengan nilai regresi tertinggi di repo.

### H-04 🟡 Vitest utama mengeksklusi `.tsx` — test komponen mustahil tanpa config kedua
**Bukti:** `vitest.config.ts:47-49` — `include: ["tests/**/*.test.ts"]`; hanya `vitest.i18n-render.config.ts` yang merender komponen (4 test). `@testing-library/react` + `jsdom` terpasang tapi menganggur untuk 231 komponen UI.
**Saran:** aktifkan environment jsdom + `include: tests/**/*.test.{ts,tsx}`; mulai dari komponen uang (Amount, PinInput, AmountKeypad, TopupStatusCard).

### H-05 🟡 E2E hanya 6 smoke request-level, nol interaksi UI
**Bukti:** `e2e/web-smoke.spec.ts` — semuanya `request.get`/goto + assert HTML; tidak ada klik, form, atau alur login. Chromium bahkan tak bisa jalan di environment audit sebelumnya (terdokumentasi).
**Saran:** minimal 5 jalur UI: guest→login-prompt, login→home (mock API), create-transaction wizard, topup flow, chat render. Sediakan `msw`/mock server agar deterministik tanpa staging.

### H-06 🟡 Tidak ada CI di repo — semua gate hanya jalan lokal
**Bukti:** tidak ada `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, atau konfigurasi pipeline apa pun (`find` → 0). `package.json` script `check` lengkap tetapi tidak terhubung ke trigger otomatis; EAS hanya `eas-build-pre-install` (check-permissions/push).
**Dampak:** ratchet i18n (E-04), baseline screens (G-01/02), audit dependency (D-01) semuanya mengandalkan disiplin manual — terbukti baseline S3/S5 berumur panjang.
**Saran:** GitHub Actions: `npm ci && npm run check && npm test && npm run test:e2e (request-only)` per PR; nightly `npm audit`.

### H-07 🔵 Tidak ada pengukuran performa (bundle size budget, TTI, request-count per layar)
**Bukti:** tidak ada artefak/metrik di repo selain angka 4,32 MB di dokumen audit; `build:web` tidak membandingkan ukuran antar build.
**Saran:** simpan ukuran export per build (artefak CI), alarm bila +10%.

### H-08 🟡 `secure-storage` fallback web (memory vs localStorage) tanpa test
**Bukti:** `lib/secure-storage.ts:88-135` — logika `WEB_PERSISTENT_KEYS` adalah keputusan keamanan (token TIDAK boleh ke localStorage); grep tests → 0.
**Saran:** test unit dengan stub localStorage: set accessToken di web → assert memory-only; deviceId → assert persist.

### H-09 💡 Snapshot/golden test untuk katalog i18n & constraints tidak ada
**Bukti:** `check:i18n`/`check:api` bersifat pass/fail tanpa diff artefak; perubahan 1.596 string tidak terlihat di review.
**Saran:** commit `coverage.json` per-domain (sudah) + tampilkan diff katalog di PR (butuh H-06).

---

## I. Build, release & operasional

### I-01 🟠 (duplikat H-06, dihitung di H) — lihat H-06.
### I-02 🟠 `assetlinks.json` & `apple-app-site-association` kosong → App/Universal Links mati
**Bukti:** keluaran `check:weblinks` — "PERINGATAN assetlinks.json kosong… apple-app-site-association kosong"; `public/.well-known/*` placeholder eksplisit.
**Dampak:** tautan `https://kahade.id/order-link/...` yang dibagikan TIDAK membuka app terpasang — seluruh nilai "order link via chat mana pun" berkurang jadi web saja.
**Saran:** blocker kredensial (signing fingerprint + Apple Team ID) — masukkan checklist release dengan pemilik & tanggal; CI menolak placeholder untuk profil production.

### I-03 🟠 Web push mati (env Firebase kosong) padahal kode lengkap
**Bukti:** keluaran `check:push` — "env Firebase Web tidak diisi — web push nonaktif di build ini"; `.env.example:15-29` menunggu 7 variabel.
**Dampak:** pengguna web tidak pernah dapat notifikasi transaksi; fitur tervalidasi setengah.
**Saran:** isi env di Cloudflare Pages + uji end-to-end (dokumen langkah sudah ada di `docs/PUSH-NOTIFICATIONS.md`).

### I-04 🟠 Profil `production` EAS belum siap & tidak ada akun store
**Bukti:** `eas.json:6-12` — "belum ada akun Google Play Developer maupun Apple Developer Program… production BELUM SIAP"; `ios.entitlements["aps-environment"] = "development"` (`app.json`) — push produksi iOS butuh `production`.
**Dampak:** tidak ada jalur rilis native sama sekali saat ini; `aps-environment` development akan menolak APNs produksi bila terlewat saat switch.
**Saran:** roadmap rilis: akun store → kredensial → ubah entitlement → build RC → uji push production.

### I-05 🟡 Metadata web hanya ~10 pola rute; ratusan halaman berbagi judul dasar
**Bukti:** `scripts/gen-web-meta.mjs:23-33` (10 entri match); sisanya fallback `Kahade — Transaksi aman dengan escrow`. E2E sendiri mengunci bahwa `/order/<id-apapun>` berjudul "Detail order — Kahade" (`e2e/web-smoke.spec.ts:58-62`) termasuk untuk order yang tidak ada.
**Dampak:** SEO/share preview lemah untuk rute publik yang justru jadi corong (showcase, profil, help); judul "Detail order" untuk ID 404 menyesatkan crawler.
**Saran:** tambah pola (disputes, notifications?, help/[slug] per kategori); untuk entitas publik pertimbangkan pre-render OG dari backend.

### I-06 🟡 PWA tanpa update prompt & tanpa penanganan install
**Bukti:** `public/sw.js:15-17` (`skipWaiting()` + `clients.claim()` — update senyap); `public/register-sw.js` tanpa event `controllerchange`; tidak ada UI "Update tersedia" / `beforeinstallprompt` selain `SmartAppInstallCard` (banner iOS/Android saja).
**Dampak:** pengguna web bisa menjalankan bundle lama+baru campur dalam satu sesi (asset cache-first + dokumen network-first); tidak ada jalur install terarah.
**Saran:** tunda `skipWaiting` sampai pengguna konfirmasi, atau minimal toast "Versi baru dimuat".

### I-07 🟡 `runtimeVersion: fingerprint` + OTA tanpa kebijakan rollback yang teruji
**Bukti:** `app.json` (updates policy fingerprint, checkAutomatically ON_LOAD); `scripts/check-ota.mjs` ada sebagai preflight tetapi tidak ada prosedur rollback terdokumentasi di `docs/`.
**Dampak:** update OTA yang rusak terdorong ke 100% pengguna saat load; tanpa runbook, respons insiden lambat.
**Saran:** runbook EAS Update (channel, staged rollout, rollback), smoke OTA di profil preview.

### I-08 🔵 `manifest.json`: orientasi portrait & tanpa `shortcuts`/dark theme_color
**Bukti:** `public/manifest.json` — `"orientation": "portrait"`, satu `theme_color` terang (padahal `+html.tsx` punya theme-color gelap media-query).
**Dampak:** web desktop/tablet terkunci portrait (Chrome menghormati di beberapa platform); ikon taskbar gelap tidak konsisten.
**Saran:** hapus orientation (atau `any`), tambah `theme_color` gelap via manifest extension bila didukung.

### I-09 🔵 `google-services.json` hanya berisi 1 client Android; tidak ada client web di repo
**Bukti:** `google-services.json` — `client[]` hanya `package_name: id.kahade`; konfigurasi web (appId web) diminta lewat env (`.env.example`), sehingga dua sumber konfigurasi Firebase untuk satu proyek.
**Dampak:** rawan salah proyek/sender-id antara native (file) dan web (env) — `check:push` sudah memvalidasi project_id sama, bagus; pertahankan gate itu di CI (H-06).
**Saran:** dokumentasikan satu halaman "Firebase source of truth".

### I-10 🟡 `verify:api` menunjuk `localhost:3000` default dan tidak pernah bisa jalan di CI
**Bukti:** warisan audit 2026-09-19 (P0-02) — `scripts/verify-live-api.mjs` default localhost; tidak ada staging yang dapat diakses.
**Dampak:** status jujur tetap "source verified, runtime unverified" untuk aplikasi escrow.
**Saran:** sediakan staging + seed; jalankan smoke read-only per deploy (carryover K-01).

### I-11 💡 `docs/image/IMG_20260917_224056_353.jpg` (156 KB) & `.dummy` ter-commit
**Bukti:** `ls docs/image/`.
**Dampak:** artefak biner mockup di git (kecil, tapi preseden); `.dummy` tanpa penjelasan.
**Saran:** pindahkan aset desain ke wiki/drive atau folder ber-README.

---

## J. Improvement fitur & UX produk

### J-01 💡 Fee breakdown sebelum konfirmasi di Transfer & Withdraw
**Konteks:** topup sudah menampilkan biaya admin (`app/topup.tsx:295-300`); transfer/withdraw tidak menampilkan biaya apa pun (grep `fee` di `app/transfer.tsx`/`app/withdraw.tsx` = 0 hasil UI). Rekomendasi audit sebelumnya (§6.3) belum diimplementasikan.
**Nilai:** transparansi uang keluar = trust; mengurangi dispute "saldo berkurang lebih dari nominal".

### J-02 💡 Pusat rekonsiliasi transaksi pending (client request ID ↔ server txId ↔ status)
**Konteks:** transfer gagal-samar sudah menyuruh "periksa riwayat" (A-08) tetapi riwayat tidak menampilkan korelasi idempotency key; `Idempotency-Key` dibuat klien (`lib/api/client.ts:349-362`) dan tidak pernah ditampilkan/di simpan lokal.
**Nilai:** pengguna & support bisa membuktikan "uang saya sudah keluar atau belum" dalam 1 layar.

### J-03 💡 Action center sticky per role+status di detail order
**Konteks:** `app/order/[id].tsx` sudah menghitung `canPay/canShip/…` (`:455-470`) tetapi aksinya tersebar di sheet; audit sebelumnya (P0 rekomendasi) mengusulkan satu pusat aksi + countdown server.
**Nilai:** menurunkan gagal bayar/terlambat konfirmasi — metrik bisnis inti escrow.

### J-04 💡 Pemulihan aksi menggantung setelah app ditutup (pending QRIS / PENDING_OTP withdraw / topup unpaid)
**Konteks:** A-06/A-11/A-12 meninggalkan state menggantung tanpa jalur kembali; tidak ada "Anda punya 1 pembayaran menunggu" di boot.
**Nilai:** uang tidak "hilang rasa".

### J-05 💡 Persist "sembunyikan saldo" & toggle yang sama di tab Dompet
**Konteks:** `app/(tabs)/home.tsx:145` — `balanceHidden` = useState (reset tiap sesi, diakui docblock); tab Wallet tidak punya toggle sama sekali (grep `hidden` = 0 di `app/(tabs)/wallet.tsx`) padahal memakai `HomeOverviewCard` yang mendukung prop `hidden`.
**Nilai:** privasi bahu-penumpang konsisten antar layar.

### J-06 💡 Riwayat penerima transfer (recent) persisten
**Konteks:** `app/transfer.tsx:92` — `recent` hanya state; hilang tiap masuk layar. Favorit sudah ada (server), "terkini" belum.
**Nilai:** mempercepat transfer berulang (top use-case e-wallet).

### J-07 💡 Pencarian pesan chat (UI) — adapter sudah siap, layar belum ada
**Konteks:** `docs/audit/API-GAP-BACKEND-2026-09-15.md` §2.1 — "3 adapter-ready (global search, in-room search, tandai-baca per-pesan)"; tidak ada UI pencarian di `app/chat.tsx`/`app/chat/[roomId].tsx`.
**Nilai:** chat transaksi tanpa pencarian = sulit menemukan bukti/"tadi katanya berapa".

### J-08 💡 Default tab Transaksi = "Pembeli" untuk mayoritas, atau ingat pilihan terakhir
**Konteks:** `app/(tabs)/transactions.tsx:64` — `useState<RoleTab>("seller")` selalu mulai di Penjual.
**Nilai:** pembeli (mayoritas pengguna escrow) langsung melihat transaksinya.

### J-09 💡 Filter tanggal di Riwayat Dompet (API sudah mendukung `from/to`)
**Konteks:** F/Bukti `app/wallet-history.tsx:176-178` hanya mengirim `type`; `lib/api/wallet.ts:106-113` mendokumentasikan `from/to`.
**Nilai:** rekonsiliasi bulanan; fitur yang sudah dibayar di backend tapi tak terpakai.

### J-10 💡 Export PDF yang benar-benar PDF
**Konteks:** `lib/use-wallet-export.ts:24-33` — "PDF" = HTML siap cetak bernama `.html` (keputusan terdokumentasi, tapi label tombol di layar tetap menjanjikan PDF — periksa `app/wallet-history.tsx`/`app/analytics.tsx`).
**Nilai:** kebutuhan pembukuan/visa/bank; minimal ubah label jadi "Cetak/PDF (HTML)" sampai backend menghasilkan PDF asli.

### J-11 💡 Unduh/cetak kode cadangan 2FA dengan konfirmasi "sudah saya simpan"
**Konteks:** `components/ui/backup-codes-display.tsx` menampilkan + salin; tidak ada langkah konfirmasi penyimpanan/unduh berkas (rekomendasi audit §6.1 belum diterapkan).
**Nilai:** mencegah lockout permanen saat kehilangan perangkat.

### J-12 💡 Penjelasan risiko perangkat baru (lokasi/IP/perangkat) di security-activity
**Konteks:** `app/security-activity.tsx` menampilkan sesi & trust/untrust (re-auth password sudah benar); tidak ada konteks "login dari Jakarta, iPhone 15 — bukan Anda?".
**Nilai:** trust & self-service anti takeover.

### J-13 💡 Halaman status/health publik & in-app ("apakah pembayaran sedang gangguan?")
**Konteks:** spec punya 4 endpoint Health yang TIDAK dipakai aplikasi (`docs/audit/API-ENDPOINT-AUDIT.md` §2.2 — Health 4/0).
**Nilai:** mengurangi tiket support saat insiden backend.

### J-14 💡 Rate/ulasan pasca-transaksi dengan pengingat yang bisa ditunda
**Konteks:** `app/rate/[orderId].tsx` ada; tidak ada snooze/pengingat cerdas (notifikasi kategori sudah ada di `lib/notification-category.ts`).
**Nilai:** meningkatkan volume ulasan (sinyal marketplace) tanpa mengganggu.

---

## K. Warisan audit sebelumnya yang TERBUKTI masih terbuka di checkout ini

### K-01 🔴 P0-02 — Tidak ada bukti runtime terautentikasi terhadap backend hidup
**Status 2026-09-20:** `verify:api` masih default localhost (I-10); 8 `KNOWN_DEVIATION` spec masih sama (keluaran `check:api` hari ini); respons adapter masih berlabel UNVERIFIED. Belum ada staging.

### K-02 🟠 P1-03 — Chat masih polling (belum WebSocket)
**Status:** `CHAT_POLL_MS = 8000` (`app/chat/[roomId].tsx:95`) + komentar "WS realtime belum ada di app" (`:222`). Masih terbuka; diperburuk oleh C-01..C-09.

### K-03 🟠 P1-04 — App Links/Universal Links/Web Push belum berfungsi
**Status:** lihat I-02/I-03 — peringatan gate masih tercetak hari ini.

### K-04 🟠 P1-05 — 27 vulnerability belum ditindaklanjuti dengan rencana upgrade
**Status:** `npm audit` hari ini = angka yang sama persis (D-01).

### K-05 🟠 P1-06 — Fan-out request Home belum berkurang (endpoint agregat belum ada)
**Status:** masih 5 query (F-04); perbaikan `completedCount` sebelumnya adalah kebenaran data, bukan jumlah request.

### K-06 🟡 P1-07 — Uji permission di perangkat fisik & consent retention server belum dilakukan
**Status:** tidak ada artefak hasil uji perangkat di repo; `docs/PERMISSIONS.md` tetap matriks rencana.

### K-07 🟡 Observability (Sentry/crash/perf) belum dipasang
**Status:** D-03 — masih `console.error` + komentar "nanti ke Sentry".

---

## Prioritas perbaikan yang disarankan

**Sprint 0 (1 minggu — bug uang & auth yang terbukti, murah diperbaiki):**
A-01/02/03 (putuskan: cabut tombol biometrik ATAU backend ticket), B-01+B-06 (5 rute ke AUTHENTICATED_SCREENS + test guard), B-03 (pasang subscriber onSessionExpired), B-04/B-05 (gate sesi untuk tamu web), A-06/A-07 (OTP withdraw: cooldown + dialog batalkan), A-14 (cleanup setTimeout), D-05/D-08/D-10 (validasi URL & NIK), E-01 (22 terjemahan).

**Sprint 1 (2-3 minggu — kebenaran data & keamanan):**
F-01/F-02/F-03 (refreshOnFocus paginated + cache key), F-13 (offset jam server), A-11/A-12 (status poll berhenti), D-01 (upgrade dependency terjadwal), H-01/H-02/H-03 (test transport, hook, format), H-06/I (CI GitHub Actions + gate), D-02 (FLAG_SECURE), D-03 (Sentry).

**Sprint 2 (1-2 bulan — platform & produk):**
K-02 (WebSocket chat), K-03 (App Links + web push kredensial), K-04 (EAS production + store), J-01/J-02/J-03/J-04 (fee, rekonsiliasi, action center, pending recovery), G-01/G-02 (susutkan baseline dead code & skeleton), F-06 (virtualisasi chat/komentar), F-12 (bundle web).

---

## Lampiran — reproduksi bukti

```bash
# Semua dijalankan pada commit dcc76b1, 2026-09-20:
npm ci && npm run typecheck && npm run lint && npm test   # PASS
npm run check                                             # PASS + catatan di ringkasan
npm audit                                                 # 27 (8 high, 19 moderate)
node scripts/check-screens.mjs                            # S1=2, S3=27, S5=29
npm run check:i18n                                        # 1.596 katalog, 22 belum diterjemahkan
grep -rn "onSessionExpired(" app components lib tests     # 0 subscriber (B-03)
grep -rn "handleBiometric" app/                           # 3 duplikat no-op (A-01..03)
```

*Dokumen ini dihasilkan sebagai bagian dari branch `arena/01a0bf24-frontend`. Temuan diberi ID stabil (A-01…K-07) agar bisa dilacak ke tiket/commit perbaikan.*

---

## Lampiran — STATUS PERBAIKAN FINAL (2026-09-21)

Seluruh 135 temuan diproses. Legenda status:

- **✅** — diperbaiki di kode klien, dijaga gate (`npm run check` = typecheck + lint + 9 skrip check + 210 test node + 29 test komponen, semuanya hijau).
- **✅+EXT** — sisi klien selesai; sisa aksi butuh konsol/kredensial/backend dan terdaftar di `docs/SECURITY-CHECKLIST.md` atau `docs/audit/BACKEND-DEPENDENCIES.md` dengan pemilik langkah & kriteria terima.
- **📄** — tidak dapat diselesaikan dari klien (butuh kontrak/lingkungan backend); didokumentasikan dengan mitigasi klien saat ini + kriteria terima.
- **⏸** — keputusan sadar: override pemilik proyek (G-01) atau refactor terencana berisiko (J-03), keduanya terdokumentasi & ter-gate.

Commit perbaikan: `4d1ea9f` (batch B1–B11; riwayat per-batch tersquash oleh reset lingkungan) dan `7897d18` (B12: CI, anggaran bundle, gate audit, dokumen dependensi, J-09/J-10).

### A. Benar/salah fungsional di alur inti

| ID | Status | Catatan |
| -- | ------ | ------- |
| A-01 | ✅ | Tiga duplikat no-op `handleBiometric` disatukan ke alur nyata. |
| A-02 | ✅ | Idem A-01. |
| A-03 | ✅ | Idem A-01. |
| A-04 | ✅ |  |
| A-05 | ✅ |  |
| A-06 | ✅ |  |
| A-07 | ✅ |  |
| A-08 | ✅ |  |
| A-09 | ✅ |  |
| A-10 | ✅ |  |
| A-11 | ✅ | Polling QRIS kini menampilkan status saat berhenti, tidak diam-diam. |
| A-12 | ✅ |  |
| A-13 | ✅ |  |
| A-14 | ✅ |  |
| A-15 | ✅ |  |
| A-16 | ✅ |  |
| A-17 | 📄 | Batas `note` transfer = keputusan klien; register `docs/audit/BACKEND-DEPENDENCIES.md` §A-17 (kriteria terima: aturan `note` masuk spec → `gen:api`). |
| A-18 | ✅ |  |

### B. Keamanan sisi klien

| ID | Status | Catatan |
| -- | ------ | ------- |
| B-01 | ✅ |  |
| B-02 | ✅ |  |
| B-03 | ✅ | `onSessionExpired` kini punya subscriber nyata (alur logout paksa). |
| B-04 | ✅ |  |
| B-05 | ✅ |  |
| B-06 | ✅ |  |
| B-07 | ✅ |  |
| B-08 | ✅ |  |
| B-09 | ✅ |  |
| B-10 | ✅ |  |
| B-11 | ✅ |  |
| B-12 | ✅ |  |
| B-13 | ✅ |  |
| B-14 | ✅+EXT | Vektor param-URL ditutup di `lib/otp-flow.ts`; rate-limit server di `docs/SECURITY-CHECKLIST.md` §5. |

### C. State & navigasi

| ID | Status | Catatan |
| -- | ------ | ------- |
| C-01 | ✅ |  |
| C-02 | ✅ |  |
| C-03 | ✅ |  |
| C-04 | ✅ |  |
| C-05 | ✅ |  |
| C-06 | ✅ |  |
| C-07 | ✅ |  |
| C-08 | ✅ |  |
| C-09 | ✅ |  |
| C-10 | ✅ |  |

### D. Keamanan & kepatuhan

| ID | Status | Catatan |
| -- | ------ | ------- |
| D-01 | ✅+EXT | 27 kerentanan → 8 high dari SATU akar build-time (`image-size` via metro; override v2 diverifikasi mematahkan build). Gate nightly `npm run audit:check` + pengecualian sadar bertanggal tinjau — checklist §6. |
| D-02 | ✅+EXT | Android `FLAG_SECURE` via `plugins/with-flag-secure.js` (terverifikasi prebuild); deteksi capture iOS = checklist §1. |
| D-03 | ✅ |  |
| D-04 | ✅+EXT | Komponen captcha diisolasi; proof-of-work provider = backend, checklist §4. |
| D-05 | ✅ |  |
| D-06 | ✅ |  |
| D-07 | ✅+EXT | Konfigurasi native push siap (`check:push` hijau); App Check/restriction di konsol = checklist §2. |
| D-08 | ✅ |  |
| D-09 | ✅ |  |
| D-10 | ✅ |  |
| D-11 | ✅ |  |
| D-12 | ✅ |  |
| D-13 | ✅+EXT | Klien cookie HttpOnly + `credentials: include`; verifikasi SameSite/CSRF server = checklist §3. |
| D-14 | ✅ |  |

### E. i18n & katalog

| ID | Status | Catatan |
| -- | ------ | ------- |
| E-01 | ✅ |  |
| E-02 | ✅ |  |
| E-03 | ✅ | Rule kunci-dobel antar-file EN aktif di `check-i18n` (terbukti menangkap duplikat "{x} hari" saat B12). |
| E-04 | ✅ | Ratchet i18n kini dieksekusi otomatis per PR oleh CI (H-06). |
| E-05 | ✅ |  |
| E-06 | ✅ |  |
| E-07 | ✅ |  |
| E-08 | ✅ |  |
| E-09 | ✅ |  |
| E-10 | ✅ |  |

### F. Performa & data

| ID | Status | Catatan |
| -- | ------ | ------- |
| F-01 | ✅ | `refreshOnFocus` di riwayat dompet/transaksi. |
| F-02 | ✅ |  |
| F-03 | ✅ |  |
| F-04 | 📄 | Butuh endpoint agregat backend — register BACKEND-DEPENDENCIES §F-04/K-05; klien sudah dedupe+cache. |
| F-05 | ✅ |  |
| F-06 | ✅ |  |
| F-07 | ✅ |  |
| F-08 | ✅ |  |
| F-09 | ✅ |  |
| F-10 | ✅ |  |
| F-11 | ✅ | Retry transient teruji (`tests/api-client.test.ts`). |
| F-12 | ✅ | Diukur & dijaga anggaran bundle (H-07); lazy-loading lanjutan terencana di REFACTOR-PLAN. |
| F-13 | ✅ |  |
| F-14 | ✅ |  |

### G. Kebersihan kode & arsitektur

| ID | Status | Catatan |
| -- | ------ | ------- |
| G-01 | ⏸ | KEPUTUSAN PEMILIK PROYEK: 29 komponen 'unused' dipulihkan sebagai cadangan roadmap terpelihara — baseline dijaga gate `check:screens` (docblock `scripts/check-screens.mjs`). |
| G-02 | ✅ |  |
| G-03 | ✅ |  |
| G-04 | ✅ |  |
| G-05 | ✅ |  |
| G-06 | ✅ |  |
| G-07 | ✅ |  |
| G-08 | ✅ |  |
| G-09 | ✅ |  |
| G-10 | ✅ |  |
| G-11 | ✅ | Ratchet plafon baris S9 per file (hanya boleh turun). |
| G-12 | ✅ |  |
| G-13 | ✅ |  |
| G-14 | ✅ |  |

### H. Pengujian & CI

| ID | Status | Catatan |
| -- | ------ | ------- |
| H-01 | ✅ | 10 test transport `lib/api/client.ts`. |
| H-02 | ✅ | 13 test hooks data (retry/fokus/cache/single-flight). |
| H-03 | ✅ | 27 test `lib/format.ts`. |
| H-04 | ✅ | `vitest.components.config.ts` + 12 test komponen uang + 4 test render i18n. |
| H-05 | ✅ | Job `e2e-web-smoke` di CI (Playwright chromium); sandbox lokal tanpa browser — CI jalurnya. |
| H-06 | ✅ | `.github/workflows/ci.yml`: check+e2e+bundle per PR, audit nightly. |
| H-07 | ✅ | `scripts/check-bundle-size.mjs` + baseline 7,89 MB (alarm >10%, guard dist rusak). |
| H-08 | ✅ | 14 test fallback web `lib/secure-storage.ts`. |
| H-09 | ✅ | Artefak (catalog.json, constraints.ts, coverage per-domain) ter-commit → diff terlihat di tiap PR via CI. |

### I. Build, release & operasional

| ID | Status | Catatan |
| -- | ------ | ------- |
| I-01 | ✅ | Duplikat H-06 — selesai bersama CI. |
| I-02 | ✅+EXT | Placeholder valid + gate `check:weblinks`; fingerprint/Team ID = checklist §8. |
| I-03 | ✅+EXT | VAPID via env terdokumentasi; setting produksi = checklist §2. |
| I-04 | ✅+EXT | TODO kredensial per langkah di `eas.json`; akun store = checklist §8. |
| I-05 | ✅ | 14 pola rute baru di `scripts/gen-web-meta.mjs` (discover/disputes/notifications/chat/…/login). |
| I-06 | ✅ | `controllerchange` di register-sw.js + toast "Versi baru Kahade tersedia" (B3). |
| I-07 | ✅ | `docs/OTA-RUNBOOK.md` + `npm run check:ota` (channel, rilis, rollback A/B, smoke test). |
| I-08 | ✅ | `public/manifest.json` orientation `portrait` → `any`. |
| I-09 | ✅ | Tabel source-of-truth Firebase satu halaman — checklist §2. |
| I-10 | 📄 | Butuh staging backend — BACKEND-DEPENDENCIES §K-01/I-10; `verify:api` siap pakai. |
| I-11 | ✅ | `docs/image/README.md`: asal+kegunaan tiap file & kebijakan aset. |

### J. Improvement fitur & UX

| ID | Status | Catatan |
| -- | ------ | ------- |
| J-01 | 📄 | Butuh kontrak fee backend (spec hanya memberi biaya admin top-up) — BACKEND-DEPENDENCIES §J-01; UI sengaja tidak menebak angka. |
| J-02 | ✅ |  |
| J-03 | ⏸ | Refactor presentasi berisiko sedang di layar escrow terpenting — dijadwalkan berpasangan dengan ekstraksi G-11 (REFACTOR-PLAN §J-03). |
| J-04 | ✅ |  |
| J-05 | ✅ |  |
| J-06 | ✅ |  |
| J-07 | ✅ |  |
| J-08 | ✅ |  |
| J-09 | ✅ | Filter rentang tanggal (7/30/90 hari/semua) di riwayat dompet, `from`/`to` diteruskan ke API. |
| J-10 | ✅ | Ekspor = HTML siap-cetak berlabel jujur ("cetak", bukan PDF); ikon FilePdf→Printer. |
| J-11 | ✅ |  |
| J-12 | ✅ |  |
| J-13 | 📄 | Halaman status = keputusan produk + hosting; 4 endpoint Health spec dicatat — BACKEND-DEPENDENCIES §J-13. |
| J-14 | ✅ |  |

### K. Warisan audit sebelumnya

| ID | Status | Catatan |
| -- | ------ | ------- |
| K-01 | 📄 | Verifikasi runtime = butuh staging (BACKEND-DEPENDENCIES §K-01/I-10); 8 deviasi spec tetap dijaga gate `check:api`. |
| K-02 | 📄 | WebSocket = kontrak backend (BACKEND-DEPENDENCIES §K-02); mitigasi klien: polling hanya saat fokus. |
| K-03 | ✅+EXT | Sama dengan I-02/I-03 — checklist §2 & §8. |
| K-04 | ✅ | Gate `npm run audit:check` nightly (lihat D-01). |
| K-05 | 📄 | Sama dengan F-04 — endpoint agregat (BACKEND-DEPENDENCIES). |
| K-06 | ✅+EXT | Matriks uji perangkat fisik dibuat — checklist §9; eksekusinya butuh perangkat nyata. |
| K-07 | ✅+EXT | `lib/telemetry.ts` = titik sambung tunggal (`installTelemetry`); DSN Sentry = BACKEND-DEPENDENCIES §K-07. |

**Total: 135 temuan — 125 ditindak di klien (113 ✅ penuh + 12 ✅+EXT dengan sisa aksi konsol/kredensial terdaftar), 8 📄 dependensi backend/lingkungan ber-register & berkriteria terima, 2 ⏸ keputusan terdokumentasi (override pemilik G-01, refactor terencana J-03).**
