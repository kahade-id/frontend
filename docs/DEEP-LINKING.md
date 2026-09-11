# Deep Linking — Skema Kustom, App Links, Universal Links

Tiga lapis tautan, dari yang paling lama ke yang paling mulus:

| Lapis | Bentuk | Perilaku |
|---|---|---|
| Skema kustom | `kahade://order-link/<token>` | Membuka app bila terpasang; **mati total** bila belum. Hanya untuk tautan lama yang sudah beredar. |
| Web fallback (aktif hari ini) | `https://kahade.id/order-link/<token>` | Selalu terbuka: sebagai **web app** bila app belum terpasang / belum terverifikasi; sebagai **app** bila App Links/Universal Links terverifikasi. Bentuk yang dipakai semua tombol share (`lib/deeplinks.ts`). |
| Terverifikasi penuh (TODO kredensial) | sama (`https://kahade.id/…`) | Seperti di atas, plus OS melewati browser dan langsung membuka app. Butuh §3. |

Keputusan non-obvious: **semua URL share baru memakai https**, bukan
`kahade://`. Penerima tautan sering belum memasang aplikasi — tautan https
tetap berguna (web app), tautan skema kustom tidak membuka apa pun.
Satu bentuk URL melayani kedua kasus setelah verifikasi dilengkapi.

## 1. Yang sudah bekerja hari ini (tanpa kredensial tambahan)

- **Skema `kahade://`** — `app.json` (`scheme`, intent filter Android,
  associated domains iOS). Expo Router memetakannya ke route otomatis.
- **Web fallback semua rute dinamis** — `public/_redirects` (18 aturan,
  dijaga `npm run check:weblinks`) + HTML statis per rute. Menambah
  `app/foo/[id].tsx` tanpa aturan `_redirects` = check gagal, bukan 404
  misterius di produksi.
- **Pemetaan share ↔ route** — `lib/deeplinks.ts` (`orderLinkUrl`,
  `referralUrl`, `profileUrl`) cermin route Expo Router; `ref` referral
  dibaca `register.tsx` untuk https maupun skema kustom.
- **Berkas verifikasi ter-deploy dengan header benar** —
  `public/.well-known/assetlinks.json` +
  `public/.well-known/apple-app-site-association`, disajikan sebagai
  `application/json` lewat `public/_headers` (iOS menolak tipe lain secara
  diam-diam).

## 2. Cara uji hari ini

```bash
WEB=https://kahade.id   # atau domain *.pages.dev untuk preview

# Tautan share harus 200 (web app), bukan 404:
curl -s -o /dev/null -w "%{http_code}\n" $WEB/order-link/TOKENCONTOH
curl -s -o /dev/null -w "%{http_code}\n" $WEB/register?ref=ABC123
curl -s -o /dev/null -w "%{http_code}\n" $WEB/user/budi

# Berkas verifikasi harus JSON valid + Content-Type application/json:
curl -s $WEB/.well-known/assetlinks.json | head -c 200
curl -s $WEB/.well-known/apple-app-site-association | head -c 200
```

Di HP yang sudah memasang build preview: buka tautan https di browser —
sebelum §3 selesai, ia tetap di browser (web app). Itu perilaku yang benar
untuk saat ini, bukan bug.

## 3. TODO: verifikasi App Links & Universal Links (butuh kredensial prod)

**Android — `public/.well-known/assetlinks.json`:**
`sha256_cert_fingerprints` masih `[]` (sengaja — fingerprint hanya valid
dari signing key produksi). Setelah keystore produksi ada:

```bash
keytool -list -v -keystore <upload-key>.jks | grep SHA256
```

Masukkan fingerprint itu **plus** fingerprint Play App Signing (Play Console
→ Setup → App integrity — Google menandatangani ulang AAB sehingga
fingerprint upload key saja tidak cukup). Redeploy, lalu uji di HP:

```bash
adb shell pm verify-app-links --re-verify id.kahade
adb shell pm get-app-links id.kahade   # harus: verified
```

**iOS — `public/.well-known/apple-app-site-association`:**
`appID` masih `TEAMID.id.kahade`. Setelah Apple Developer Program aktif:
ganti `TEAMID` dengan Team ID (developer.apple.com → Membership) di `appID`
dan `webcredentials`. Lalu:

- Pasang app di iPhone fisik (simulator tidak memverifikasi Universal Links
  dengan andal), buka tautan https dari Notes/Mail — harus langsung membuka
  app.
- Debug: `swcutil` di Mac, atau Console.app → proses `swcd` di iPhone.

Setelah keduanya hijau, `npm run check:weblinks` tetap menjadi penjaga
regresi (konsistensi package name, bundle ID, kategori intent, urutan
redirect) — isinya tidak berubah, hanya TODO di berkas well-known yang
terisi.

## 4. Menambah deep link baru (checklist)

1. Buat route di `app/` (Expo Router menangani skema kustom otomatis).
2. Bila rute dinamis: tambah aturan rewrite di `public/_redirects`
   (spesifik di atas umum) — `npm run check:weblinks` memaksa ini.
3. Bila perlu di-share: tambah builder di `lib/deeplinks.ts` (https).
4. Bila perlu dibuka dari push: tambah tipe di `lib/notification-routing.ts`
   **dan** cerminnya di `scripts/fcm-sw.template.mjs` (klik notifikasi web).
5. Bila path baru perlu dibuka app (bukan browser): tambah ke `paths` AASA
   (iOS memakai daftar eksplisit; Android `handle_all_urls` mencakup semua).
