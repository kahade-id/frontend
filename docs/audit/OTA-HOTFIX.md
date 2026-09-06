# Runbook hotfix OTA — Jalur A (tanpa native build)

> Untuk memperbaiki bug di binary yang SUDAH terpasang (fingerprint lama)
> tanpa merilis native build baru. Latar: audit mengubah dependency native &
> `app.json`, sehingga bundle dari `main` sekarang punya runtimeVersion
> fingerprint BARU dan TIDAK akan diunduh binary lama (disengaja — lihat
> `OTA.md`). Jalur A mengambil hanya perbaikan JS dan mempublikasikannya
> dari commit yang fingerprint-nya SAMA dengan binary terpasang.

## Prinsip mutlak

1. Branch hotfix HARUS dibuat dari commit baseline `b4d8c87` ("Delete
   kahade-design-system-v1.1.md") — commit terakhir sebelum audit mengubah
   native config. **Jangan pernah** membuat branch ini dari `main` terkini.
2. `app.json` dan `package.json` di branch hotfix **dibiarkan persis
   `b4d8c87`**. Semua perubahan native (permissions, plugins, dependency)
   adalah ranah native build berikutnya, bukan OTA.
3. Hanya berkas JS murni yang boleh masuk. Saat ini: fix PullToRefresh.

## Langkah eksekusi

```bash
# 0. Mulai dari baseline yang fingerprint-nya cocok dengan binary terpasang.
git fetch origin
git checkout -b hotfix/ota-ptr b4d8c87

# 1. Ambil fix PullToRefresh (berkas tunggal, sudah diverifikasi apply bersih
#    di b4d8c87 — dua cara, pilih satu):
git checkout bdb2873 -- components/ui/pull-to-refresh.tsx
#    atau dari berkas patch di repo: git apply hotfix/pull-to-refresh-ota.patch

# 2. (Opsional, murni JS juga — lihat daftar kelayakan di bawah)
#    Tambahkan perbaikan lain bila ingin sekali angkut, mis.:
#    git checkout bdb2873^..bdb2873 -- <file>   # per berkas
#    JANGAN meng-commit perubahan docs/, app.json, package.json di branch ini.

# 3. Install & verifikasi DENGAN lockfile milik baseline:
npm ci
npm run typecheck && npm run lint && npm test
npm run ota:preflight     # cek project ID + minimum versi live dari server

# 4. Uji dulu ke channel preview (build internal), bukan langsung produksi:
eas update --channel preview --message "fix: pull-to-refresh gesture"

# 5. Setelah diverifikasi di perangkat/channel preview:
eas update --channel production --message "fix: pull-to-refresh gesture"
```

## Kelayakan dimasukkan ke OTA Jalur A (semua dari sesi audit ini)

| Perbaikan | Berkas | Murni JS? |
| --- | --- | --- |
| PullToRefresh (layar ikut tangan, ujung list tak terjangkau) | `components/ui/pull-to-refresh.tsx` | ✅ |
| Chat: poll pesan masuk + auto-scroll + badge | `app/chat/[roomId].tsx` | ✅ |
| Saldo segar saat tab fokus (`refreshOnFocus`) | `lib/use-api-query.ts`, `app/(tabs)/wallet.tsx`, `app/(tabs)/home.tsx`, `lib/api/{users,wallet,orders}.ts` | ✅ |
| Transfer: pad PIN dobel | `app/transfer.tsx` | ✅ |
| Web: `document.title`, favicon/meta | `app/_layout.tsx`, `app/+html.tsx` | ✅ (web) |
| Kompilasi worklet baru (reanimated) di PullToRefresh | — | ✅ dikompilasi ulang saat build update |

Tidak layak OTA: semua perubahan `app.json`, `package.json`, dependency
native, permissions, plugin, dan `GoogleService-Info.plist` — semuanya
ranah native build berikutnya.

## Verifikasi & rollback

- Verifikasi perangkat: tarik-ke-bawah di puncak memicu logo; di tengah list
  scroll tetap ulus sampai ujung atas/bawah; setelah refresh cepat indikator
  tidak tersangkut.
- Rollback: `eas update:rollback --channel production` (dan `--channel
  preview` bila perlu) — klien kembali ke bundle sebelumnya.
- OTA pertama proyek: pastikan `eas update:configure` pernah dijalankan pada
  build terpasang dan channel di `eas.json` cocok dengan profil build yang
  dipakai memasang binary (development/preview/production).
