# Spec OpenAPI mobile (TIDAK ADA di repo ini)

Berkas `kahade-api-mobile.json` yang dibaca `npm run gen:api`,
`npm run check:api`, dan `npm run audit:inventory` adalah **spec OpenAPI milik
repo backend** (NestJS/@nestjs/swagger). Ia tidak ikut tersimpan di repo
frontend, sehingga tiga skrip itu melewati/gagal dengan pesan yang jelas
sampai berkas disalin kembali.

## Cara memulihkan

1. Ambil spec terbaru dari repo backend (atau `GET {API}/v1/docs-json` bila
   diaktifkan) dan simpan sebagai `docs/api/kahade-api-mobile.json`.
2. `npm run gen:api` — regenerasi `lib/api/types.ts` (DTO request) dan
   `lib/api/constraints.ts` (batasan runtime).
3. `npm run check:api` — audit ketat: setiap pemanggilan `http.*` di
   `lib/api/*.ts` harus cocok dengan `METHOD /path` yang terdokumentasi.

Sampai spec dipulihkan: `npm run check` memakai `check:api:soft`
(`scripts/check-api.mjs`) yang mencetak peringatan dan melanjutkan. Ini
disengaja — pipeline yang merah permanen justru menyembunyikan kegagalan
pemeriksaan lain di belakangnya.

`lib/api/types.ts` dan `lib/api/constraints.ts` yang sudah di-commit
dihasilkan dari spec yang sama dan tetap menjadi sumber kebenaran sementara.
