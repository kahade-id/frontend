# Kahade — Rencana Refactor Bertahap (G-01/G-02/G-03/G-10/G-11)

Dokumen ini menindaklanjuti temuan audit `issues & improvement.md` (2026-09-20)
untuk butir-butir yang sarannya sendiri bersifat **bertahap** ("3–5 layar per
sprint", "codemod + ratchet", "split saat regenerasi"). Prinsipnya: mekanisme
penjaga (ratchet di `scripts/check-screens.mjs`) dipasang SEKARANG sehingga
angka tidak bisa memburuk; pemindahannya dikerjakan berurutan tanpa big-bang.

## G-01 · 29 komponen UI tanpa pemakaian — KEPUTUSAN: DIPERTAHANKAN

Audit menyarankan "pasang atau hapus". Riwayat repo mencatat keputusan
pemilik proyek: klaster ini **sengaja dipulihkan** setelah sempat dihapus,
karena memetakan fitur roadmap yang adapter backend-nya sudah ada (captcha,
pemilihan metode 2FA, tanda tangan bukti terima, UI panggilan sengketa, dsb.).
Penjaga yang berlaku:

- `UNUSED_UI_BASELINE` di `scripts/check-screens.mjs` hanya boleh menyusut —
  komponen mati BARU langsung gagal CI.
- Sebelum memakai salah satunya: baca ulang & adaptasi ke design system
  terkini (komponen ini tidak teruji layar mana pun), lalu hapus dari baseline
  di commit yang sama.
- `biometric-prompt-trigger` secara khusus TIDAK boleh dipasang kembali tanpa
  menyelesaikan z-order Portal/BottomSheet (catatan A-02 di audit).

## G-02 · 27 layar menyalin kerangka Screen+Header+PullToRefresh

Ratchet: baseline S3 (hanya boleh menyusut). Sprint 1 (commit ini):
`app/order-links.tsx` dimigrasi ke `<DataScreen>` — sisa 26.

Urutan migrasi berikutnya (list murni dulu, hybrid terakhir):

1. `app/reports.tsx` — butuh keputusan: seksi form `targetId` harus tetap
   tampil saat list error (DataScreen menyembunyikan children saat error →
   pindah form ke sheet, atau terima perilakunya).
2. `app/transaction-templates.tsx`, `app/referral.tsx` — periksa dulu apakah
   form inline-nya bisa pindah ke `<Dialog>`/`<BottomSheet>`.
3. `app/questions.tsx`, `app/ratings.tsx` — segmented control cocok dengan
   prop `above`; sheet balasan/hide sudah terpisah.
4. `app/security-activity.tsx` — tiga query; migrasi setelah query-nya
   digabung atau DataScreen menerima state sekunder.
5. Hybrid list+form (`bank-accounts`, `withdrawal-schedules`, `kyc`,
   `edit-profile`, `create-transaction`, `two-factor`, `rate/[orderId]`,
   `extension/[orderId]`, `order-link/[token]`, dst.) — `<DataScreen>`
   memang BUKAN untuk layar form (lihat docblock-nya); layar-layar ini
   keluar dari baseline S3 saat diperiksa satu per satu, dengan catatan
   alasan di baseline.

## G-03 · 2 layar merakit state async manual (S1)

`app/create-transaction.tsx` dan `app/user/[username].tsx`. Ratchet: baseline
S1 = 2, hanya boleh menyusut. Prasyarat: pola "useApiQuery untuk form"
(fetcher live `calculate-fee`/`validate-counterpart` yang di-debounce dengan
guard draft-key) — rancang sebagai hook baru `useLiveQuote()` di lib/, uji
terpisah, baru migrasikan `create-transaction`; `user/[username]` menyusul
setelah pecahan G-11-nya mendarat (seksi yang fetch-nya manual ikut pindah).

## G-10 · types.ts (1.559 baris) & constraints.ts (1.157 baris) generated

KEPUTUSAN: TIDAK dipecah sekarang. Alasan teknis: generator
(`scripts/gen-api-types.mjs`) meratakan semua schema yang direferensikan path
tanpa informasi domain — spec OpenAPI backend tidak men-tag schema per modul,
jadi pemecahan butuh heuristik nama (rawan salah kelompok untuk schema lintas
domain seperti `PaginationMeta`). Kedua file adalah OUTPUT generator: diff
raksasa hanya muncul saat regenerasi, bukan saat konsumsi. Bila backend
menambahkan `x-domain`/tag per schema, split per domain + barrel
`lib/api/types.ts` (re-export, semua import site tetap hidup) menjadi murah —
catat sebagai dependensi eksternal.

## G-11 · Lima layar "god component"

Ratchet BARU (commit ini): aturan **S9** di `scripts/check-screens.mjs` —
plafon baris per file, hanya boleh turun; file yang tumbuh langsung gagal.
Plafon saat ini: `user/[username]` 1534 · `chat/[roomId]` 1296 ·
`order/[id]` 1146 · `dispute/[id]` 919 · `showcase/[id]` 916.

Urutan ekstraksi yang disarankan (seksi dengan seam paling bersih dulu):

1. `app/order/[id].tsx` — sheet aksi (pay/reject/shipping/dispute/cancel)
   masing-masing sudah hampir self-contained → `components/order/…`.
2. `app/dispute/[id].tsx` — timeline pesan + form bukti.
3. `app/showcase/[id].tsx` — daftar komentar + sheet hide/report.
4. `app/chat/[roomId].tsx` — header room + composer.
5. `app/user/[username].tsx` — tab profil (showcase/ratings/questions).

Setiap ekstraksi: pindahkan state via props (bukan context baru) kecuali
>4 prop drilling; jalankan `npm run check` penuh; turunkan plafon S9 di
commit yang sama.

## J-03 · Action center sticky di detail order (temuan audit 💡)

Ditunda SEBAGAI redesign terencana, bukan dilupakan — `app/order/[id].tsx`
sudah menghitung `canPay/canShip/…` terpusat (satu sumber kebenaran), jadi
memindahkan aksi ke sticky bar per role+status adalah refactor presentasi.
Risiko sedang pada layar escrow terpenting → kerjakan berpasangan dengan
ekstraksi sheet aksi (item 1 daftar G-11 di atas) dalam satu PR, dengan uji
komponen untuk tiap state (`tests/*.test.tsx`, pola money-components).
Kriteria selesai: satu bar aksi sticky + countdown seragam; plafon S9
`order/[id]` turun di commit yang sama.
