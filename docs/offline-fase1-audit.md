# Audit offline — Fase 1 (UI lokal & konten statis)

Tanggal audit: 2026-10-06. Cakupan: 121 berkas `.tsx` di `app/`. Semua 121 path sudah dicocokkan dengan inventaris filesystem. Kategori ditetapkan dari perilaku route; alias navigasi lokal dicatat sebagai alias, bukan dianggap sebagai layar tujuannya.

Ringkasan route unik: A 14 (termasuk lima alias lokal dan gate awal `app/index.tsx`), B 4, C 103. Dua alias (`app/saved.tsx` dan `app/subscriptions.tsx`) juga disebut lagi di Kategori C untuk menjelaskan tujuan dinamisnya; hitungan unik tetap 121.

## Hasil klasifikasi

### Kategori A — UI lokal / navigasi lokal

Layar ini tidak perlu data server agar bisa dibuka. Menu keamanan tidak lagi memuat status akun lewat GET; versi aplikasi menampilkan informasi runtime lokal; preferensi tampilan dan biometrik dibaca dari perangkat.

- `app/(auth)/onboarding.tsx` — pilihan masuk/daftar; navigasi lokal.
- `app/+not-found.tsx` — layar tautan tidak ditemukan.
- `app/about.tsx` — identitas aplikasi, tautan, versi lokal.
- `app/app-version.tsx` — versi/build/runtime lokal; pemeriksaan OTA hanya aksi tombol eksplisit.
- `app/appearance.tsx` — tema, hemat data, dan skala teks lokal.
- `app/biometric-settings.tsx` — preferensi dan kapabilitas perangkat lokal.
- `app/security.tsx` — hub menu keamanan lokal; alur pengaturan tetap ditautkan. Keluar hanya dijalankan setelah konfirmasi pengguna.
- `app/login-required.tsx` — ajakan masuk lokal.
- Alias navigasi lokal (render alias sendiri tidak membutuhkan jaringan): `app/home.tsx`, `app/more.tsx`, `app/notification-settings.tsx`, `app/saved.tsx`, `app/subscriptions.tsx`.
- `app/index.tsx` — gate awal berbasis SecureStore (navigasi lokal, bukan data API; bukan konten layar statis).

### Kategori B — konten statis yang dibundel

Konten ini tersedia dari JavaScript bundle, tanpa perlu pembukaan online sebelumnya.

- `app/faq.tsx` — kategori dan pencarian Pusat Bantuan memakai konten bantuan lokal.
- `app/help/[slug].tsx` — daftar kategori dan isi artikel bantuan lokal; feedback lokal tetap dapat dibaca offline.
- `app/terms.tsx` — Syarat & Ketentuan (`lib/legal/terms-content.ts`).
- `app/privacy-policy.tsx` — Kebijakan Privasi (`lib/legal/privacy-content.ts`).

## Rute lain — kategori C (data server / alur aksi)

Rute berikut menampilkan data server, menjalankan alur akun/transaksi, atau merupakan alias dinamis ke layar data. Tetap bisa dinavigasi ke rute tersebut; penanganan cache-first dan affordance aksi offline adalah cakupan fase lanjutan, bukan bagian Fase 1.

- Shell: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`; dokumen web: `app/+html.tsx`.
- Auth & verifikasi: `app/(auth)/forgot-password.tsx`, `app/(auth)/login.tsx`, `app/(auth)/phone-migration.tsx`, `app/(auth)/register-security.tsx`, `app/(auth)/register.tsx`, `app/(auth)/reset-password.tsx`, `app/(auth)/setup-profile.tsx`, `app/(auth)/social-link-confirm.tsx`, `app/(auth)/verify-2fa.tsx`, `app/(auth)/verify-otp.tsx`, `app/(auth)/whatsapp-trigger.tsx`, `app/verify-email.tsx`.
- Tab/data sosial: `app/(tabs)/chat.tsx`, `app/(tabs)/notifications.tsx`, `app/(tabs)/showcase.tsx`, `app/(tabs)/transactions.tsx`, `app/discover.tsx`, `app/favorites.tsx`, `app/followers/[username].tsx`, `app/ratings.tsx`, `app/questions.tsx`, `app/search.tsx`, `app/saved.tsx` (tujuan alias: Etalase tersimpan), `app/showcase-management.tsx`, `app/showcase/[id].tsx`, `app/showcase/create.tsx`, `app/user/[username].tsx`, `app/user/[username]/questions.tsx`, `app/user/[username]/ratings.tsx`, `app/user/[username]/showcase.tsx`, `app/[username].tsx`.
- Chat & bantuan interaktif: `app/chat/[roomId].tsx`, `app/chat/settings.tsx`, `app/feedback.tsx`, `app/support-chat.tsx`, `app/support.tsx`, `app/support/[ticketId].tsx`.
- Profil/akun & keamanan berbasis server: `app/addresses.tsx`, `app/analytics.tsx`, `app/badges.tsx`, `app/bank-accounts.tsx`, `app/blocked-users.tsx`, `app/business-verification.tsx`, `app/change-email.tsx`, `app/change-password.tsx`, `app/change-phone.tsx`, `app/change-pin.tsx`, `app/delete-account.tsx`, `app/deletion-status.tsx`, `app/edit-profile.tsx`, `app/kyc.tsx`, `app/notification-preferences.tsx`, `app/notification/[id].tsx`, `app/passkeys.tsx`, `app/privacy-settings.tsx`, `app/profile/[id].tsx`, `app/reports.tsx`, `app/security-activity.tsx`, `app/social-providers.tsx`, `app/trust-score.tsx`, `app/two-factor.tsx`, `app/vouchers.tsx`, `app/onboarding-checklist.tsx`.
- Transaksi, pengiriman, retur, dan sengketa: `app/create-transaction.tsx`, `app/delivery-proof/[orderId].tsx`, `app/dispute/[id].tsx`, `app/disputes.tsx`, `app/extension/[orderId].tsx`, `app/invoice/[orderId].tsx`, `app/milestones/[id].tsx`, `app/order-link/[token].tsx`, `app/order-links.tsx`, `app/order/[id].tsx`, `app/prepare-navigation.tsx`, `app/rate/[orderId].tsx`, `app/returns/[id].tsx`, `app/returns/index.tsx`, `app/returns/new.tsx`, `app/tracking/[shipmentId].tsx`, `app/transaction-templates.tsx`, `app/o/[token].tsx`, `app/p/[id].tsx`, `app/r/[code].tsx`.
- Dompet & langganan: `app/kahade-plus/manage.tsx`, `app/kahade-plus/plans.tsx`, `app/kahade-plus/theme.tsx` (pilihan lokal, tetapi akses bergantung status langganan), `app/payment/finish.tsx`, `app/receive.tsx`, `app/referral.tsx`, `app/seller/vouchers.tsx`, `app/topup-history.tsx`, `app/topup.tsx`, `app/transfer.tsx`, `app/v/[code].tsx`, `app/wallet-history.tsx`, `app/wallet-transaction/[txId].tsx`, `app/wallet.tsx`, `app/withdraw-history.tsx`, `app/withdraw.tsx`, `app/withdrawal-schedules.tsx`.
- Kamera/tautan dinamis: `app/scan.tsx`, `app/subscriptions.tsx` (tujuan alias: paket Kahade+).

Catatan audit: beberapa nama alias muncul pula di daftar Kategori A karena file alias-nya sendiri hanya melakukan navigasi; baris ini mengingatkan bahwa layar tujuan bisa berada di Kategori C. `app/saved.tsx` dan `app/subscriptions.tsx` sengaja dicatat dengan makna tujuan tersebut.

## Verifikasi Fase 1

Test komponen `tests/offline-static-screens.test.tsx` merender 19 route/state Kategori A/B di bawah status konektivitas offline dan banner offline yang sama dengan aplikasi (18 test case; satu case merender dua layar). Setiap layar diuji tanpa state UI bertajuk "Terjadi kesalahan", "Gagal memuat", atau "Tidak ada koneksi internet". Gate awal dan kelima alias juga diuji; Pusat Bantuan diuji pada daftar, detail kategori, dan isi artikel; kedua dokumen legal diuji dengan konten lengkap.
