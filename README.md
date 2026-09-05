# Kahade frontend

Expo Router / React Native / NativeWind. API default: **https://api.kahade.id**.

## Menjalankan

```bash
npm ci
npm run web
# atau: npm run android / npm run ios
```

Gunakan Node 22. `package-lock.json` menjadi satu-satunya lockfile; lockfile pnpm yang tidak sinkron sudah dihapus. Lihat `.env.example` untuk konfigurasi. Tidak ada demo account, token, PIN, atau fixture API yang disuntikkan ke aplikasi.

Web memakai token sesi **memory-only**, bukan localStorage. Preferensi non-rahasia (tema, onboarding, device ID, tanda logout eksplisit) boleh dipersistenkan. Pemulihan web bergantung pada kontrak refresh/cookie server yang benar; kebijakan CORS, SameSite, dan cookie third-party tetap perlu diverifikasi pada deployment asli.

## Pemeriksaan

```bash
npm run check            # TypeScript, token desain, a11y statis, kontrak path/DTO, unit/hook tests
npm run audit:inventory  # Inventaris semua screen dan pemanggilan API
npm run gen:api          # Regenerasi tipe dan constraint request dari OpenAPI lokal
npx playwright install chromium
npm run test:e2e         # Browser regression terhadap production web export, API intercepted
```

Fixture protected API hanya ada dalam `tests/`; pengujian ini **bukan** bukti endpoint protected produksi sudah bekerja. Tidak ada transaksi atau penghapusan akun produksi dilakukan oleh test suite.

Untuk memeriksa bundle yang benar-benar akan dihosting:

```bash
npm run build:web
npm run preview:web     # 0.0.0.0:8081; PORT dan WEB_ROOT opsional
```

Server preview hanya melayani static export, bukan backend/proxy API. Binding `0.0.0.0` dan tanpa host allowlist membuatnya dapat ditampilkan melalui preview Arena. Browser tidak boleh memakai localhost untuk mengakses backend lain. Gunakan API HTTPS atau reverse proxy deployment yang dikonfigurasi dengan benar.

## Audit dan rilis

- [Laporan audit, bukti, dan pekerjaan yang masih memerlukan verifikasi](docs/audit/REPORT.md)
- [Inventaris seluruh halaman](docs/audit/ROUTES.md)
- [Status dan prosedur Expo OTA](docs/audit/OTA.md)

**OTA belum diterbitkan.** Bundle audit memerlukan native build yang kompatibel karena perubahan dependency native. Project ID, identitas aplikasi, akses EAS, minimum versi, environment/channel, dan runtime binary terpasang harus diverifikasi sebelum release.
