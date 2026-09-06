# Status & prosedur Expo OTA (Kahade frontend)

Dokumen ringkas ini menjelaskan posisi dan prosedur OTA Kahade. Isinya
diturunkan dari konfigurasi repo (`app.json`, `.env.example`, `eas.json`) dan
pemeriksaan `scripts/check-ota.mjs` — bukan kebijakan baru.

## Status saat ini

**Belum ada update OTA yang diterbitkan.** Bundle hasil audit ini tidak boleh
dipublikasikan ke runtime lama; lihat bagian "Syarat sebelum publish" di bawah.
Verifikasi kesiapan rilis dijalankan dengan:

```bash
npm run ota:preflight   # = node scripts/check-ota.mjs
```

Skrip itu tidak menerbitkan apa pun; ia hanya memblokir bila konfigurasi belum
aman dan mencetak arahan ke dokumen ini.

## Syarat sebelum publish (dari `scripts/check-ota.mjs`)

1. `EAS_PROJECT_ID` benar-benar terhubung ke proyek Kahade (di repo ini sudah
   diisi `app.json → extra.eas.projectId`, bukan nilai tebakan).
2. `IOS_BUNDLE_IDENTIFIER` dan `ANDROID_APPLICATION_ID` sudah ditentukan
   (`app.json → ios.bundleIdentifier = id.kahade`, `android.package = id.kahade`).
3. EAS Update aktif dan URL-nya cocok dengan project ID:
   `https://u.expo.dev/<projectId>` (`app.json → updates.url`).
4. `runtimeVersion.policy` harus `fingerprint` agar OTA tidak terkirim lintas
   native binary yang tidak kompatibel (sudah `{"policy":"fingerprint"}`).
5. `app.json → version` harus `x.y.z` dan **tidak boleh lebih rendah dari
   minimum versi server** (`GET /v1/public/app-version` dibandingkan saat
   preflight). Lebih rendah = butuh native release, bukan OTA bypass.
6. `EXPO_PUBLIC_API_URL` pada build harus `https://` eksplisit (default
   `https://api.kahade.id`); jangan pernah memakai proxy lokal untuk release.

## Catatan lingkungan `.env.example`

- `EAS_PROJECT_ID`, `EAS_OWNER`, `IOS_BUNDLE_IDENTIFIER`,
  `ANDROID_APPLICATION_ID`, dan `APP_VERSION` harus diisi dari proyek EAS yang
  SUDAH ADA — bukan proyek baru/tebakan.
- `APP_VERSION` harus sama dengan native release tujuan dan minimum server.
- Gunakan environment yang sama untuk native build dan OTA berikutnya.

## Aturan rilis

- Jangan publish bundle audit ke runtime yang lebih lama (lihat README bagian
  OTA dan komentar `docs/audit/OTA.md` di `scripts/check-ota.mjs`).
- Tidak ada skrip di repo ini yang memublikasikan update; publish dilakukan
  manual lewat EAS setelah preflight hijau.
