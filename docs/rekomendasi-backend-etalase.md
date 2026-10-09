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
