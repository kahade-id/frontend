# Deploy Web App ke Cloudflare

Web app Kahade adalah **situs statis** hasil `expo export` (Metro bundler,
`output: "static"` di app.json). Tidak ada server Node, tidak ada SSR runtime —
Cloudflare hanya menyajikan berkas dari `dist/` + menerapkan `_redirects` dan
`_headers`. Panduan ini membuat deploy pertama berhasil tanpa trial-and-error.

## 1. Konfigurasi Pages (sekali saja)

Workers & Pages → Create → Pages → Connect to Git → pilih repo `frontend`:

| Setting               | Nilai              |
|-----------------------|--------------------|
| Production branch     | `main`             |
| Framework preset      | `None`             |
| Build command         | `npm run build:web`|
| Build output directory| `dist`             |
| Root directory        | *(kosongkan)*      |

Build command di atas menjalankan dua langkah (lihat `package.json`):

1. `expo export --platform web` → menulis `dist/` (HTML per rute + 1 bundle JS).
2. `node scripts/gen-fcm-sw.mjs` → membundle service worker FCM Web ke
   `dist/firebase-messaging-sw.js`, atau dilewati bila env Firebase belum
   diisi (build tetap sukses, web push nonaktif).

## 2. Environment variables (wajib)

Settings → Environment variables. Berlaku untuk Production dan Preview:

| Variable        | Nilai              | Keterangan                          |
|-----------------|--------------------|-------------------------------------|
| `NODE_VERSION`  | `22`               | Wajib: `engines` meminta Node ≥ 22. |

Opsional (bila backend staging dipakai untuk Preview):

| Variable               | Nilai                    |
|------------------------|--------------------------|
| `EXPO_PUBLIC_API_URL`  | `https://api.kahade.id`  |

Tanpa `EXPO_PUBLIC_API_URL`, app memakai default produksi
`https://api.kahade.id` (lihat `lib/api/environment.ts`). Nilai ini di-inline
ke bundle JS saat build — menggantinya butuh redeploy, bukan sekadar restart.

Web push (FCM browser): 7 variabel `EXPO_PUBLIC_FIREBASE_*` — lihat
`docs/PUSH-NOTIFICATIONS.md` dan `.env.example`. Boleh dikosongkan semua saat
deploy pertama; web app tetap jalan penuh tanpa push.

## 3. Yang sudah disiapkan di repo (jangan diubah tanpa membaca ini)

- **`public/_redirects`** — 18 aturan rewrite rute dinamis
  (`/order/:id → /order/[id].html 200`). Tanpa ini `/order/123` 404 karena
  `expo export` menulis rute dinamis sebagai berkas harfiah `[id].html`.
  Dijaga oleh `npm run check:weblinks`: rute dinamis baru tanpa aturan =
  check gagal.
- **`public/_headers`** — `Content-Type: application/json` untuk
  `/.well-known/apple-app-site-association` (wajib, iOS menolak tipe lain)
  + `Cache-Control` singkat untuk berkas verifikasi + header keamanan dasar.
  Semua disalin otomatis ke `dist/` oleh `expo export`.
- **`public/.well-known/`** — `assetlinks.json` (Android) dan
  `apple-app-site-association` (iOS). Keduanya masih PLACEHOLDER
  (fingerprint kosong, Team ID `TEAMID`) — lihat `docs/DEEP-LINKING.md`.
  Aman di-deploy: tautan https terbuka sebagai web app sampai verifikasi
  dilengkapi.
- **`.nvmrc`** (`22`) — sinyal versi Node cadangan bila `NODE_VERSION` lupa
  diisi. Isi keduanya.

## 4. Verifikasi setelah deploy (5 menit)

Ganti `WEB` dengan domain Pages (atau `kahade.id` bila custom domain aktif):

```bash
# 1. Halaman utama + bundle JS
curl -s -o /dev/null -w "%{http_code}\n" https://WEB/

# 2. Rute dinamis (rewrite _redirects) — harus 200, bukan 404
curl -s -o /dev/null -w "%{http_code}\n" https://WEB/order/abc123
curl -s -o /dev/null -w "%{http_code}\n" https://WEB/user/budi/ratings

# 3. Berkas verifikasi deep link — harus 200 + application/json
curl -s -D - -o /dev/null https://WEB/.well-known/assetlinks.json | grep -i content-type
curl -s -D - -o /dev/null https://WEB/.well-known/apple-app-site-association | grep -i content-type

# 4. Service worker FCM (hanya bila env Firebase diisi)
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://WEB/firebase-messaging-sw.js

# 5. Rute ngawur — harus 404 (bukan index.html; tidak ada fallback SPA)
curl -s -o /dev/null -w "%{http_code}\n" https://WEB/jalan-yang-tidak-ada
```

Lalu buka di browser: `/` → onboarding/login harus render. Bila halaman putih,
buka DevTools Console — 99% penyebabnya `EXPO_PUBLIC_API_URL` salah atau
backend mati (lihat §5), bukan build yang rusak.

## 5. Backend belum live? (kondisi saat audit, 2026-09-11)

`https://api.kahade.id` saat ini **tidak melayani TLS** (TCP :443 tersambung,
handshake gagal) — web app bisa dibuka dan dijelajahi sampai layar
onboarding/login, tetapi login/register dan semua data gagal dengan pesan
error jaringan (bukan crash). Ini masalah sisi backend/infra, bukan frontend:

- Pastikan server mendengar di 443 dengan sertifikat valid untuk
  `api.kahade.id` (chain penuh, bukan self-signed — browser menolaknya).
- Pastikan CORS mengizinkan origin web (`https://kahade.id` + domain
  `*.pages.dev` untuk preview) dan `Access-Control-Allow-Credentials` bila
  refresh memakai cookie HttpOnly.

## 6. Troubleshooting build

| Gejala | Penyebab & obat |
|---|---|
| `Error: Expected Node.js >= 22` / sintaks aneh | `NODE_VERSION` belum `22`. Isi di Settings → Environment variables → Retry deployment. |
| `gen-fcm-sw: GAGAL — … setengah jadi` | Sebagian `EXPO_PUBLIC_FIREBASE_*` terisi. Isi SEMUA (7 variabel) atau hapus semuanya. |
| `gen-fcm-sw: GAGAL — … berbeda dengan google-services.json` | `EXPO_PUBLIC_FIREBASE_PROJECT_ID` bukan `kahade-fcm`. Web dan native harus satu project Firebase. |
| Rute dinamis 404 di produksi tapi OK di `expo start` | `_redirects` tidak ikut ke-deploy (cek file ada di repo `public/`), atau output directory bukan `dist`. |
| AASA/assetlinks ter-download sebagai file | Blok `_headers` hilang — pastikan `public/_headers` ada dan output directory `dist`. |
| Build lokal OK, di Cloudflare gagal di `npm ci` | `package-lock.json` tidak sinkron — commit hasil `npm install` lokal, jangan edit `package.json` manual. |

## 7. Preview lokal yang setara produksi

```bash
npm run build:web     # hasil persis yang di-upload Cloudflare
npm run preview:web   # serve dist/ dengan semantik _redirects + _headers
```

`scripts/serve-web.mjs` sengaja meniru Cloudflare (tanpa fallback SPA),
sehingga 404 yang lolos di preview tidak akan muncul tiba-tiba di produksi.
