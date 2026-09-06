# Spec OpenAPI (kontrak API frontend ↔ backend)

Direktori ini menyimpan kontrak API yang dipakai audit statis frontend.

| Berkas | Isi | Sumber |
|---|---|---|
| `openapi.json` | Export OpenAPI **penuh** backend (NestJS/@nestjs/swagger) — 313 path, termasuk 93 path admin `/v1/admin/*`. | Disalin apa adanya dari repo backend. |
| `kahade-api-mobile.json` | Subset lingkup **mobile** — path admin dibuang (220 path). Inilah kontrak yang benar-benar dipanggil `lib/api/*`. | **Diturunkan** dari `openapi.json` oleh `scripts/gen-mobile-spec.mjs`. Jangan diedit tangan. |

## Kenapa dua berkas

`gen-api-types.mjs`, `gen-api-constraints.mjs`, dan `audit-inventory.mjs`
membaca `kahade-api-mobile.json`. Kalau yang dipakai export penuh, `gen:api`
ikut memancarkan 28 DTO admin-only (`BanUserDto`, `WalletAdjustDto`,
`CreateVoucherDto`, …) yang tidak pernah dipanggil aplikasi, dan audit kontrak
membandingkan permukaan API mobile terhadap ratusan operasi admin yang bukan
urusannya. Menyaring path `/admin` mengunci lingkup ke mobile (87 DTO request).

> **Riwayat:** berkas `openapi.json` pernah diunggah dengan nama itu saja,
> tanpa turunannya, sehingga `docs/api/kahade-api-mobile.json` hilang. Akibatnya
> `npm run check` memakai `check:api:soft` yang **melewati** audit kontrak —
> tepat pemeriksaan yang seharusnya menangkap endpoint yang tak cocok. Berkas
> turunan kini di-commit dan CI memakai audit ketat lagi.

## Regenerasi (saat backend memperbarui kontrak)

1. Salin `openapi.json` terbaru dari repo backend ke `docs/api/openapi.json`
   (atau `GET {API}/v1/docs-json` bila diaktifkan).
2. `npm run gen:api` — menurunkan `kahade-api-mobile.json`, lalu meregenerasi
   `lib/api/types.ts` (DTO request) dan `lib/api/constraints.ts` (batasan runtime).
3. `npm run check:api` — audit ketat: setiap pemanggilan `http.*` di
   `lib/api/*.ts` harus cocok dengan `METHOD /path` terdokumentasi.

`npm run check` sekarang menjalankan `check:spec` (memastikan
`kahade-api-mobile.json` tidak basi terhadap `openapi.json`) diikuti audit
kontrak ketat — bukan lagi varian `:soft`. `lib/api/types.ts` dan
`lib/api/constraints.ts` dihasilkan dari spec ini; jangan diedit manual.
