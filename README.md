# Kahade frontend

Expo Router / React Native / NativeWind. API default: **https://api.kahade.id**.
Wajib **Node 22** (`engines` di package.json). `package-lock.json` menjadi
satu-satunya lockfile; lockfile pnpm yang tidak sinkron sudah dihapus. Lihat
`.env.example` untuk konfigurasi. Tidak ada demo account, token, PIN, atau
fixture API yang disuntikkan ke aplikasi.

Web memakai token sesi **memory-only**, bukan localStorage. Preferensi
non-rahasia (tema, onboarding, device ID, tanda logout eksplisit) boleh
dipersistenkan. Pemulihan web bergantung pada kontrak refresh/cookie server
yang benar; kebijakan CORS, SameSite, dan cookie third-party tetap perlu
diverifikasi pada deployment asli.

## Menjalankan

```bash
npm ci
npm run web
# atau: npm run android / npm run ios
```

## Pemeriksaan

```bash
npm run lint             # ESLint (react-hooks, typescript-eslint, tanpa aturan gaya)
npm run check            # typecheck + lint + tokens + a11y + screens + inventory + api + weblinks + push + test
npm run audit:inventory  # Inventaris pemanggilan API vs OpenAPI (butuh spec, lihat bawah)
npm run gen:inventory    # Regenerasi docs/audit/inventory.json + ROUTES.md dari app/
npm run gen:api          # Regenerasi tipe dan constraint request dari OpenAPI lokal
npx playwright install chromium
npm run test:e2e         # Browser regression terhadap production web export, API intercepted
```

### Spec OpenAPI backend (`docs/api/kahade-api-mobile.json`) TIDAK ada di repo ini

`npm run check:api` (ketat) dan `npm run gen:api` membandingkan semua
pemanggilan `http.*` di `lib/api/` terhadap spec OpenAPI milik **repo
backend**. Berkas spec itu tidak ikut tersimpan di repo frontend; sampai
disalin kembali:

- `npm run check` memakai `check:api:soft` yang **melewati** audit kontrak
  dengan peringatan jelas (pipeline tetap hijau, bukan merah permanen dengan
  ENOENT yang tidak menjelaskan apa pun);
- `npm run check:api` (ketat) tetap gagal keras tanpa spec — pakai ini setelah
  spec dipulihkan ke `docs/api/kahade-api-mobile.json`;
- `lib/api/types.ts` dan `lib/api/constraints.ts` yang di-commit tetap
  dipakai; jangan edit manual.

`docs/audit/inventory.json` (dipakai `test:e2e`) dan `docs/audit/ROUTES.md`
TIDAK butuh spec — keduanya diturunkan dari `app/` oleh
`npm run gen:inventory`, dan `check:inventory` di dalam `npm run check`
menggagalkan commit yang lupa meregenerasinya.

Fixture protected API hanya ada dalam `tests/`; pengujian ini **bukan** bukti
endpoint protected produksi sudah bekerja. Tidak ada transaksi atau
penghapusan akun produksi dilakukan oleh test suite.

Untuk memeriksa bundle yang benar-benar akan dihosting:

```bash
npm run build:web
npm run preview:web     # 0.0.0.0:8081; PORT dan WEB_ROOT opsional
```

Server preview hanya melayani static export, bukan backend/proxy API. Binding
`0.0.0.0` dan tanpa host allowlist membuatnya dapat ditampilkan melalui
preview Arena. Browser tidak boleh memakai localhost untuk mengakses backend
lain. Gunakan API HTTPS atau reverse proxy deployment yang dikonfigurasi
dengan benar.

## Dokumen audit

- [Inventaris seluruh halaman](docs/audit/ROUTES.md) — dihasilkan
  `npm run gen:inventory` dari `app/` (regenerasi otomatis dijaga
  `check:inventory`).
- [Status dan prosedur Expo OTA](docs/audit/OTA.md).

Laporan audit sebelumnya (`docs/audit/REPORT.md`) tidak lagi berada di repo —
temuan historisnya hidup di riwayat commit dan komentar audit di dalam kode.

**OTA belum diterbitkan.** Bundle audit memerlukan native build yang
kompatibel karena perubahan dependency native (audit terakhir MENGHAPUS
belasan dependency native yang tidak pernah diimpor — lihat daftar di
docs/audit/OTA.md). Project ID, identitas aplikasi, akses EAS, minimum
versi, environment/channel, dan runtime binary terpasang harus diverifikasi
sebelum release. Jalankan `npm run ota:preflight` dan `npm run check:push`
sebelum build EAS.
