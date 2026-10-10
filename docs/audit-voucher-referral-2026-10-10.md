# Audit Voucher & Referral — 10 Oktober 2026

Cakupan: daftar voucher, cek/klaim kode, pakai saat checkout, kode referral,
reward referral. Tiga repo (backend `claude-voucher`, frontend `claude-voucher`,
admin `claude-voucher`). Baris mengacu ke keadaan SEBELUM fix.

Legenda: **K** kritis · **S** sedang · **R** rendah · **i18n/kosmetik**.
Kolom "Fix" diisi setelah commit.

## Backend (`backend/src`)

| # | Tingkat | Lokasi | Temuan | Fix |
|---|---|---|---|---|
| B01 | K | `modules/vouchers/vouchers.service.ts:54-72` | `GET /v1/vouchers/available` tidak menyaring `sellerId: null` — voucher toko SEMUA penjual tampil di daftar voucher platform setiap user; dipakai → ditolak saat create order. | ✅ |
| B02 | S | `vouchers.service.ts:54-72` | Daftar tidak menyaring kuota habis (`currentUsage >= maxUsageTotal`) → voucher habis tampil "Aktif". | ✅ |
| B03 | S | `vouchers.service.ts:88-107` | Daftar tidak memberi info pemakaian per user; voucher sekali-pakai yang sudah dipakai tetap tampil "Aktif" (FE `usedAt` tak pernah terisi). | ✅ `usedCount`/`remainingUses`; `maxUsagePerUser=1` + sudah dipakai → tidak tampil |
| B04 | kosmetik | `vouchers.service.ts:125-127, 134-136` | Early-return NEW_USER ganda (kode mati). | ✅ |
| B05 | S | `vouchers.service.ts:300-306` | Validate tanpa `userRole` menolak BUYER_ONLY/SELLER_ONLY ("Please specify your role") — halaman Promo (tanpa konteks order) selalu gagal untuk voucher per-peran. | ✅ preview murni (tanpa orderValue & role) lewati cek peran, kirim `applicableTo` |
| B06 | R | `vouchers.service.ts:242-247` | Validate tidak cek `sellerId` → voucher toko lolos validasi platform lalu ditolak saat create order dengan pesan berbeda. | ✅ |
| B07 | R | `vouchers.service.ts:366-379` | Response validate tanpa `applicableTo`/`validUntil` → FE tidak bisa memberi tahu syarat peran/kedaluwarsa. | ✅ |
| B08 | R | `vouchers.service.ts:148-176`, `orders/orders.service.ts:959-985`, `wallet/wallet.service.ts:897-905` | Cache daftar per user (TTL 300 dtk) tidak diinvalidasi saat voucher ditebus → setelah checkout voucher sekali-pakai masih tampil "Aktif" hingga 5 menit. | ✅ |
| B09 | S | `orders/orders.service.ts:1651-1657` | `calculate-fee` preview: voucher tidak ada / nonaktif / kedaluwarsa DIABAIKAN diam-diam (findFirst null) → ringkasan biaya tampil tanpa potongan, lalu create order 404/VOUCHER_EXPIRED. | ✅ |
| B10 | R | `vouchers/vouchers.controller.ts:455-456` | Throttle validate 5/menit per user — salah ketik 5× (Promo + checkout berbagi kuota) terkunci 1 menit. | ✅ 10/menit |
| B11 | K | `commerce/services/seller-vouchers.service.ts:247-256` | Estimasi diskon voucher toko: PERSEN dihitung dari nilai order, FLAT di-cap ke nilai order — padahal saat create order (`orders.service.ts:252-270`) basisnya FEE platform. Preview "Diskon Rp50.000" vs realisasi Rp2.500. | ✅ basis fee standar (sama dengan create) |
| B12 | S | `referral/referral.service.ts:444-575` | Reward dibayar meski lawan transaksi referee adalah referrer sendiri (A ajak B, A↔B transaksi fee Rp2.500 → payout 2×Rp5.000; rugi bersih platform). | ✅ |
| B13 | S | `referral.service.ts:535-552` | Tidak ada notifikasi `REFERRAL_REWARD_RECEIVED` (template ada di `notification-copy.service.ts:583`, tidak pernah di-enqueue). | ✅ post-commit di 3 jalur completion |
| B14 | S | `referral.service.ts:396-437` | `GET /referral/history` membocorkan `flaggedForReview`, `reviewReason`, `referralCodeId`, id internal lawan. | ✅ whitelist |
| B15 | R | `referral.service.ts:100-107` | Leaderboard mengekspos `code` referral user lain (bisa dipanen untuk membanjiri relasi → flag review korban). | ✅ |
| B16 | kosmetik | `referral.service.ts:274-282` | Stats tanpa kode: `remainingSlots/maxSlots` hardcode 100, abaikan `app.maxReferralsPerCode`. | ✅ |
| B17 | R | `auth/auth.service.ts:255-258, 1226-1229` | Kode referral registrasi tidak di-`trim()` → " KHXXXX" (paste) diabaikan diam-diam. | ✅ |
| B18 | S | `auth/auth.service.ts:300-318, 1291-1309` | Relasi referral dari REGISTRASI (jalur utama) tidak lewat deteksi lonjakan ≥5/24 jam — hanya `/referral/apply` yang diperiksa. | ✅ util bersama |
| B19 | R | `referral.service.ts:169-266` | Apply code tidak mensyaratkan akun belum bertransaksi; user dengan order selesai bisa apply tapi tak pernah memenuhi `=== 1` → "Menunggu syarat" selamanya. | ✅ tolak `REFERRAL_NOT_NEW_USER` |
| B20 | R | `referral/referral.controller.ts:741-744, 777-779` | `my-code`/`regenerate` mengembalikan seluruh row (`userId` internal, `totalRewardEarned` dalam sen). | ✅ `{code,isActive,createdAt}` |
| B21 | R | `admin/vouchers/admin-vouchers.service.ts:306-330` | `campaignId` tidak divalidasi ada → FK P2003 → 500. | ✅ |
| B22 | R | `admin-vouchers.service.ts:235-246` | `validUntil` di masa lalu diterima → voucher lahir kedaluwarsa. | ✅ |
| B23 | R | `referral.service.ts:312-341` | `GET /referral/rewards` tidak membedakan reward pengundang vs bonus sambutan referee; FE memberi label sama. | ✅ `kind` |

## Frontend (`frontend`)

| # | Tingkat | Lokasi | Temuan | Fix |
|---|---|---|---|---|
| F01 | K | `lib/api/auth.ts:482-500`, `lib/api/types.ts:65-90` | `phoneRegister` tidak mengirim `referralCode` padahal backend `PhoneRegisterDto` menerimanya → undangan via `kahade.id/r/<kode>` ke user BARU tidak tercatat kecuali user manual buka /referral dan menekan "Terapkan". | ✅ `lib/pending-referral.ts` + kirim saat register |
| F02 | K | `app/r/[code].tsx:437-449` | Kode dari deeplink tidak disimpan sebelum redirect ke rute protected (hanya hidup di `pendingNext` memori). | ✅ |
| F03 | S | `app/referral.tsx:302-324` | Form "Punya kode dari teman?" tetap tampil setelah user punya pengundang → selalu REFERRAL_ALREADY_APPLIED. | ✅ tampilkan "Diundang oleh …" |
| F04 | S | `lib/api/referrals.ts:314-345` | Normalizer history membuang `viewerRole` → pengundang saya tampil sebagai "undangan" berstatus "Menunggu syarat". | ✅ `role` |
| F05 | R | `app/referral.tsx:398-399` | Copy regenerate salah: relasi lama TETAP tercatat (backend tidak menghapus relasi); hanya tautan lama yang mati. | ✅ |
| F06 | R | `app/referral.tsx:253`, `app/vouchers.tsx:619` | Subtitle papan peringkat "undangan terbanyak (bulan ini)" — backend mengurutkan total reward sepanjang waktu. | ✅ |
| F07 | i18n | `app/referral.tsx:213`, `app/vouchers.tsx:416`, `:437-438` | Pesan error/toast dengan variabel tanpa `translate()`. | ✅ |
| F08 | S | `app/vouchers.tsx:141-149` | Status "used" tidak pernah terjadi → voucher sekali-pakai yang sudah dipakai tampil "Aktif" + tombol Pakai (server menolak). | ✅ pakai `remainingUses` |
| F09 | R | `app/vouchers.tsx:155-165` | `urgencyKeyOf` menandai voucher yang SUDAH lewat sebagai "segera berakhir" (selisih negatif < 3 hari) → diurut paling atas. | ✅ |
| F10 | S | `app/vouchers.tsx:385-397, 508-521` | Hasil cek kode promo: voucher TOPUP_BONUS ditawarkan "Pakai di transaksi baru" (create order menolak); cashback dilabeli potongan. | ✅ cabang per `voucherType` |
| F11 | S | `components/ui/voucher-redeem-box.tsx:54-64, 165-167` | `AppliedVoucher` tanpa jenis → cashback/bonus top-up dirender "-Rp…" seolah potongan tagihan. | ✅ `kind` |
| F12 | R | `lib/api/vouchers.ts:61-81` | Normalizer tidak membaca `applicableTo` → badge Pembeli/Penjual di `VoucherCard` tidak pernah tampil. | ✅ |
| F13 | S | `app/create-transaction.tsx:928-957, 1040-1080` | Nilai order diubah SETELAH voucher terpasang → `calculate-fee` gagal karena voucher (min. order/kuota) dan SELURUH ringkasan biaya error tanpa menyebut voucher; nominal voucher basi. | ✅ error `VOUCHER_*` → lepas voucher + pesan spesifik |
| F14 | R | `app/create-transaction.tsx:1718` | `initialCode` dari halaman Promo hanya mengisi kolom (langkah terakhir); user masih harus menekan "Pakai". | ✅ auto-apply sekali |
| F15 | R | `app/v/[code].tsx:716`, `app/vouchers.tsx:309` | Deeplink `/v/<kode>` meneruskan `code` ke `/vouchers`, tetapi layar tidak pernah membacanya. | ✅ prefill + auto-cek |
| F16 | kosmetik | `lib/api/referrals.ts:422-424` | `applyReferralCode` bertipe `ReferralCode` padahal backend mengembalikan relasi. | ✅ |
| F17 | kosmetik | `app/referral.tsx:179` | Dependensi `code` tak dipakai di `handleRegenerate`. | ✅ |
| F18 | R | `lib/api/vouchers.ts:40-48` | `listAvailableVouchers` tanpa `limit` (default 20) — voucher ke-21 dst. tidak pernah tampil. | ✅ limit 100 |
| F19 | R | `app/referral.tsx:342-388` | Bonus sambutan referee ditampilkan sebagai "Reward" pengundang. | ✅ label per `kind` |

## Admin (`admin`)

| # | Tingkat | Lokasi | Temuan | Fix |
|---|---|---|---|---|
| A01 | R | `src/app/(panel)/campaigns/lib.ts:95-100` | `dayToISO` memakai zona waktu browser → admin di luar WIB membuat voucher/kampanye berlaku geser beberapa jam. | ✅ `+07:00` |
| A02 | R | `src/app/(panel)/vouchers/page.tsx:140-180` | Form tidak memvalidasi "tepat satu dari nominal/persen" dan "persen wajib maks. diskon" — backend menolak dengan pesan Inggris. | ✅ validasi klien |
| A03 | R | `src/lib/api/admin/vouchers.ts:36-56`, `vouchers/page.tsx:608-620` | Daftar admin mencampur voucher TOKO penjual (`sellerId`) tanpa penanda. | ✅ badge "Voucher toko" |

## Dibiarkan (butuh keputusan produk / endpoint baru)

- Antrean review relasi yang di-flag (`flaggedForReview`) belum punya endpoint admin.
- Cashback `WALLET_CASHBACK` dikredit ke pembuat order (bisa penjual) — semantik bisnis belum jelas.
- `calculate-fee` preview melewati cek `sellerId` (tanpa konteks seller) — disengaja (komentar M1).
