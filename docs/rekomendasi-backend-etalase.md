# Rekomendasi Backend — Etalase (Showcase)

Tanggal: 2026-10-09 — hasil audit etalase (lihat `SHOWCASE_AUDIT_2026-10-09.md`).
Prinsip frontend: **kontrak API tidak diubah sepihak** — bila frontend butuh
field/endpoint baru, didokumentasikan di file ini untuk Tim A. Tidak ada
rekomendasi di sini yang mengubah perilaku endpoint yang sudah berjalan.

---

## RK-01 — Respons 409 race suka seharusnya membawa state akhir

**Endpoint:** `POST /v1/showcase/:id/like` (toggle)

**Kondisi:** saat dua request suka dari perangkat/user yang sama bertabrakan,
backend menjawab `409` dengan `backendCode: "SHOWCASE_ALREADY_LIKED"`. Respons
tersebut **tidak membawa state akhir** (`{liked, likeCount}`).

**Dampak frontend** (bukti: `lib/use-showcase-social-actions.ts`, branch race
`runLike`):
1. Frontend harus me-refetch `GET /v1/showcase/:id` (detail) untuk menyinkronkan
   flag + jumlah suka.
2. `GET /v1/showcase/:id` menaikkan `viewCount` (keputusan D-08) → path race
   yang langka ini **menggelembung hitungan tayang** satu item.
3. Jika refetch gagal, frontend harus membatalkan toggle yang tertahan dan
   menampakkan toast error untuk kondisi yang sebenarnya sudah benar di server.

**Usulan:** respons `409 SHOWCASE_ALREADY_LIKED` menyertakan state akhir,
mis. `{ code, message, data: { liked: true, likeCount: N } }`. Frontend cukup
menulis state lokal — tanpa GET tambahan, tanpa inflasi viewCount, tanpa
jendela gagal-rusak. Alternatif minimal: endpoint `GET /v1/showcase/:id/like`
(hanya state suka, tidak menaikkan viewCount).

**Prioritas:** rendah (path langka, sudah fail-safe di client) — tapi murah
dan menghilangkan satu class bug.

---

## RK-02 — `docs/api/openapi.json` usang vs implementasi

**Kondisi:** spec yang dipakai pipeline `gen:spec` / `check:api`
(`scripts/gen-mobile-spec.mjs`, `scripts/check-api.mjs`) masih bentuk kerangka:
skema respons kosong dan sejumlah path yang DIGUNAKAN frontend tidak
tercantum:

| Path yang dipakai frontend (bukti: `lib/api/showcase.ts`, `lib/api/users.ts`) | Status di spec |
|---|---|
| `GET /v1/showcase` dengan param `sort=foryou\|popular\|latest`, `location`, `minPrice`, `maxPrice`, `condition`, `minSellerRating` | param lama saja |
| `POST /v1/showcase/:id/save` + `DELETE /v1/showcase/:id/save` + `GET /v1/showcase/saved` (+ cursor) | tidak ada |
| `GET /v1/showcase/categories` | tidak ada |
| `GET /v1/showcase/:id/likers` / `savers` | tidak ada |
| `POST /v1/showcase/comments/:commentId/like` | tidak ada |
| `GET /v1/users/me/showcase/deleted` (SS-012) | tidak ada |
| `POST /v1/users/me/showcase/:id/restore` | tidak ada |
| `GET /v1/users/me/following-ids` | tidak ada |
| `POST /v1/commerce/products/:id/click` + `/stats` + slot jasa | tidak lengkap |

Sumber kebenaran kontrak untuk frontend saat ini = komentar kode terverifikasi
(per event September/Oktober 2026, "confirmed against backend source") + test
`tests/showcase-api-contract.test.ts`. Ini bekerja, tapi CI `check:api` tidak
lagi memvalidasi apa pun yang bermakna.

**Usulan:** ekspor ulang OpenAPI dari backend (bukan tulisan tangan) dan
commit hasilnya; biarkan `check:api` kembali berfungsi sebagai gerbang.
Tidak ada perubahan perilaku — murni dokumentasi/CI.

**Prioritas:** menengah (kualitas CI; tidak memblokir fitur).

---

## Catatan (bukan rekomendasi perubahan)

- **Feed "Untuk Anda"** — personalisasi ranking di server (`sort=foryou`,
  keputusan produk 2026-09-28). Frontend tidak bisa memvalidasi isi ranking;
  bila ada keluhan "rekomendasi tidak relevan", ukur di server.
- **Feed "Populer"** — skor `sort=popular` (klik + tayang + suka, reset harian,
  keputusan produk 2026-10-01) dihitung server.
- **Cari** — relevansi hasil = `ILIKE` judul/deskripsi/kategori/username di
  server; frontend hanya mem-forward kata kunci (debounce + abort di client).
- **Ekscerpt feed** — payload feed sengaja tanpa `viewCount`/`updatedAt`
  (NP-007); frontend sudah menangani (fail-closed di parser).

---

# Tambahan 2026-10-10 — audit etalase (lihat `SHOWCASE_AUDIT_2026-10-10.md` §F)

Kebutuhan backend yang ditemukan saat perbaikan frontend. Status diisi oleh
sesi yang sama yang mengerjakan repo backend (`kahade-id/backend`).

| ID | Kebutuhan | Endpoint | Status |
|---|---|---|---|
| BE-1 | Serialisasi `productType`, `originalPriceIdr` (IDR, bukan sen), `digitalDeliveryInfo`, `scheduledAt` di `GET /me/showcase` & detail pemilik; `originalPriceValid` memakai satuan yang sama | `GET /v1/users/me/showcase`, `GET /v1/showcase/:id` | **Selesai** (backend `4330c48`) — frontend sudah membaca `originalPriceIdr` (CR-01, DT-10) |
| BE-2 | `visibility` & `condition` selalu ada di `GET /me/showcase` | `GET /v1/users/me/showcase` | **Sudah terpenuhi** di backend; frontend tetap defensif (CR-08: visibility absen tidak ditulis balik) |
| BE-3 | Idempotency unggah media: `Idempotency-Key` pada `POST /v1/upload/direct` tidak cukup (fingerprint body multipart) → idempotency internal `(userId, key, sha256)` | `POST /v1/upload/direct` | Dicatat — frontend tidak lagi memakai `retry` pada mutasi (AP-05) |
| BE-4 | Restore idempoten: ulang `POST /me/showcase/:id/restore` setelah sukses → 200 `alreadyRestored`, bukan 404; 410 bila lewat 30 hari | `POST /v1/users/me/showcase/:id/restore` | Frontend menangani 404/410 sebagai entri basi (CR-06); backend dikerjakan di repo backend |
| BE-5 | Aset digital `FILE`: purpose upload `DIGITAL_ASSET` + unduhan bertanda tangan untuk pembeli (`GET /v1/commerce/digital-assets/:id/download`) | commerce digital delivery | Frontend menyembunyikan tipe FILE sampai tersedia (DT-07); backend dikerjakan di repo backend |
| BE-6 | `POST /me/showcase` + `@Idempotency` (header sudah dikirim frontend; semantik kunci diulang dengan payload berbeda = 409) | `POST /v1/users/me/showcase` | Frontend memakai kunci yang sama untuk retry (CR-02/CR-03); backend dikerjakan di repo backend |
| BE-7 | `blurhash`/`dominantColor` per gambar untuk placeholder progresif | serializer `images[]` | Dicatat (migrasi aditif) |
| BE-8 | `DELETE /showcase/comments/:id` mengembalikan `commentCount`; author komentar membawa `badges`/`sealTier`/`isKycVerified` | komentar | Frontend memakai ledger lokal (SO-07) & membaca badges bila ada (AP-03); backend dikerjakan di repo backend |
| BE-9 | "Tidak tertarik" (`POST /v1/showcase/:id/not-interested`) agar feed Untuk Anda belajar | feed | Dicatat — frontend menyembunyikan lokal |
| BE-10 | Spec OpenAPI backend diekspor ulang (36 path hilang di salinan frontend) agar `check:api` bermakna | — | Dikerjakan: generator backend harus bisa jalan tanpa Redis (`OPENAPI_GENERATE=true` melewati QueueModule) |
| RK-01 | 409 `SHOWCASE_ALREADY_LIKED/SAVED` membawa state akhir `{liked, likeCount}` / `{saved, saveCount}` | like/save | Frontend sudah membaca `data` bila ada (SO-04); backend dikerjakan di repo backend |

---

# Integrasi 2026-10-10 — status akhir FE ↔ BE ↔ Admin

Backend `kahade-id/backend` `main@0e322bc`, admin `kahade-id/admin` `main@307c8e9`,
frontend = commit yang memuat bagian ini. Semua baris "Selesai" diverifikasi
dengan membaca kode kedua sisi, bukan asumsi.

## Status kebutuhan (pembaruan tabel di atas)

| ID | Backend | Frontend |
|---|---|---|
| BE-1 / BE-2 | **Selesai** — `moderationStatus` (TAKEDOWN/RESTRICTED), `moderationReason`, `moderatedAt`, `moderationReportId`, `moderationUntil` di `GET /v1/users/me/showcase` & detail pemilik; enforcement dibaca dari event moderasi terbaru per item (RESTORED membersihkan) | `lib/showcase-moderation.ts`: status `takedown`/`restricted` (+ `until`), `isModerationLocked()`; Kelola Etalase menyembunyikan Ubah/Foto/Aktifkan/Slot untuk item terkunci dan menjelaskan sebabnya; notice di editor tanpa tombol "Ajukan ulang" (tidak ada endpoint banding pengguna di spec) |
| BE-4 | **Selesai** — restore idempoten: item yang sudah tayang → `{ alreadyRestored: true }` | Toast "Etalase sudah aktif kembali" (jujur: dipulihkan dari perangkat lain), bukan "dipulihkan" |
| BE-5 | **Selesai** — `UploadPurpose.DIGITAL_ASSET` (privat; PDF/JPG/PNG/WebP/MP4 ≤ 50 MB), `GET /v1/commerce/digital-assets/:id/download` → URL bertanda tangan 15 menit (pemilik atau pembeli dengan order lunas; 403 `DIGITAL_ASSET_FORBIDDEN`) | Tipe **Berkas** tersedia lagi: pilih berkas (document picker, validasi lokal = batas server) → `POST /v1/upload/direct` purpose `DIGITAL_ASSET` via transport terpusat → `fileKey` jadi payload; unduhan pembeli/pemilik memakai URL bertanda tangan (bukan lagi `GET /v1/upload/my-file` yang hanya berhasil untuk pemilik) |
| BE-6 | **Selesai** — `@Idempotency()` pada `POST /v1/users/me/showcase` | Sudah mengirim `Idempotency-Key` (CR-02/03) |
| BE-8 | **Selesai** — `DELETE /v1/showcase/comments/:id` → `{ message, commentCount }`; author komentar membawa `badges` | Layar detail memakai `commentCount` server sebagai nilai absolut (fallback −1 untuk backend lama) |
| BE-10 | **Selesai** — generator berjalan tanpa `app.init()` (`npm run openapi:generate`, offline) | `docs/api/openapi.json` + `kahade-api-mobile.json` diperbarui dari export itu (+ patch produksi `scripts/sync-spec-production.mjs`), `lib/api/constraints.ts` diregenerasi (`ReportShowcaseDto` menggantikan `CreateShowcaseReportDto`) |
| RK-01 | **Selesai** — 409 `SHOWCASE_ALREADY_LIKED/NOT_LIKED/ALREADY_SAVED/NOT_SAVED` membawa `errors.data` (`{liked, likeCount}` / `{saved, saveCount}`); 403 `SHOWCASE_MODERATED` membawa `{ reportId }` | `ApiError.data` (dari `errors.data`, `parseErrorBody`), `lib/showcase-conflict-state.ts`: balapan tap memakai state server tanpa `GET` detail tambahan |
| BES-05 | **Selesai** — koleksi tersimpan mengirim placeholder `{ id, unavailable: true, savedAt }` untuk item yang hilang | Baris "Etalase tidak tersedia lagi" yang bisa dilepas (tidak lagi hilang diam-diam) |
| BEC-01 / BEC-02 | **Selesai** — ubah/aktifkan/jadwalkan item yang ditindak → 403 `SHOWCASE_MODERATED` (+ `reportId`) | Kode terdaftar di `lib/api/error-codes.ts`; `userMessage` memberi copy khusus, bukan "tidak punya akses" |
| BES-04 / BES-06 / BES-10 | **Selesai** — like komentar memverifikasi item terlihat + blokir; booking jasa klaim baris dulu lalu kapasitas; slot lampau / etalase nonaktif ditolak | Tidak perlu perubahan klien |
| ADM-09 | **Selesai** — `PATCH /v1/admin/showcase/comments/:id` `action=delete` wajib `X-Step-Up-Token` (aksi `showcase-comment.delete`) | (admin web: sudah mengirim token; RBAC/envelope error/identitas reviewer diperbaiki di repo admin) |

## Gerbang kontrak `check:api` — apa yang masih merah dan kenapa

- **`audit-inventory --check`**: 100 pemanggilan "undocumented" dengan spec
  lama → **1** setelah spec diperbarui + parser path berbasis AST (template
  bersarang, query string, awalan `basePath`). Yang tersisa **nyata**:
  `POST /v1/search/history` (`lib/api/search.ts` `recordSearchHistory`, audit
  Search 2026-10-10 sisi FE). Backend hanya punya `GET`/`DELETE
  /v1/search/history` (+ `DELETE /history/:id`); `RecordSearchDto` milik
  `POST /v1/commerce/trends/record`. Pilih satu: tambah route backend
  `POST /v1/search/history { query }` ATAU hapus pemanggilan di FE (saat ini
  best-effort → 404 diam-diam, riwayat pencarian produk tidak pernah terisi).
- **`check:api-body`**: 81 pelanggaran (spec lama) → **8** `UNDECLARED_BODY`
  nyata — controller memakai body tanpa class DTO ber-`@ApiProperty`
  sehingga Swagger tidak mendeklarasikan `requestBody`: jastip
  `participants/:id/create-order` & `trips/:id/fail`, patungan
  `participants/:id/create-order`, `milestones/:id/dispute`,
  `notifications/unregister-device`, `search/history` (lihat atas),
  `settings/privacy/export`, langganan DANA (`subscription-payments.ts`).
  Perbaikan di backend (lintas domain, di luar etalase).
- **`lib/api/types.ts` sengaja TIDAK diregenerasi**: hasil generate dari
  export saat ini memutus 11 titik di luar etalase — `MigratePhoneConfirmDto`
  / `OtpTriggerRequestDto` hilang (auth WIP), `ConfirmPhoneChangeDto.newPhoneNumber`
  dan `ChatAttachmentDto.urlExpiresAt` tidak dideklarasikan swagger, rename
  `ShowcaseMediaInput→ShowcaseMediaInputDto`, `BuyerLocation→BuyerLocationDto`.
  Regenerasi menunggu DTO backend tersebut dilengkapi `@ApiProperty`.

## Temuan lintas repo yang memblokir deploy (bukan dari etalase, tidak disentuh)

1. **Backend `main` gagal `npm run typecheck`** — 6 error di
   `src/modules/auth/auth.controller.ts` dari commit WIP `f363ff2`
   ("WIP: auth backend"): `SocialPhoneMigrationRequired` tidak diekspor
   `auth.service.ts`, `socialLogin` dipanggil 3 argumen. Pekerjaan auth yang
   sedang berjalan di sesi lain; deploy backend menunggu ini selesai.
2. **Frontend `check:i18n` merah di upstream** — 546 kunci EN tidak ada di
   katalog (`lib/i18n/en/notifications.json` dll., dari merge sesi lain).
3. **Frontend tes upstream** — merge `claude-search`/`claude-alamat`
   menambah suite gagal di luar etalase (chat, auth, notifikasi); yang
   etalase (`search-api-null-rows`, `showcase-feed-lifecycle`,
   `showcase-comment-count-sync`, `showcase-dismiss-undo`) diperbaiki di
   commit ini, termasuk dua fix (AP-02/AP-06) yang hilang saat merge.
4. **Backend tes** — 26 suite gagal pre-existing (zz-di-check, wallet, auth,
   seller-vouchers, …); tidak bertambah dari perubahan etalase.
