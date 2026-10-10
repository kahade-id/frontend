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
