# Deep linking Kahade

App Links (Android), Universal Links (iOS), custom scheme, dan Smart App
Banner web. Preflight: `npm run check:weblinks` (ikut berjalan di `npm run check`).

Dua berkas masih menunggu kredensial Anda — lihat "Yang masih perlu dilengkapi".

---

## Struktur path final

Kahade memakai expo-router, jadi **web dan native berbagi satu pohon rute yang
sama**: `app/order/[id].tsx` adalah `/order/123` di browser dan screen yang sama
di aplikasi. Kesamaan 1:1 bukan sesuatu yang perlu dijaga manual di sini — ia
konsekuensi struktural dari file-based routing. Yang perlu dijaga adalah
`_redirects` dan daftar `paths` di AASA agar ikut bergerak saat rute bertambah;
itulah tugas `check:weblinks`.

### 18 rute dinamis

| Path | Berkas |
|---|---|
| `/order/:id` | `app/order/[id].tsx` |
| `/order-link/:token` | `app/order-link/[token].tsx` |
| `/dispute/:id` | `app/dispute/[id].tsx` |
| `/user/:username` | `app/user/[username].tsx` |
| `/user/:username/ratings` | `app/user/[username]/ratings.tsx` |
| `/user/:username/questions` | `app/user/[username]/questions.tsx` |
| `/user/:username/showcase` | `app/user/[username]/showcase.tsx` |
| `/profile/:id` | `app/profile/[id].tsx` — **alias**, lihat bawah |
| `/notification/:id` | `app/notification/[id].tsx` — **placeholder**, lihat bawah |
| `/chat/:roomId` | `app/chat/[roomId].tsx` |
| `/support/:ticketId` | `app/support/[ticketId].tsx` |
| `/invoice/:orderId` | `app/invoice/[orderId].tsx` |
| `/rate/:orderId` | `app/rate/[orderId].tsx` |
| `/extension/:orderId` | `app/extension/[orderId].tsx` |
| `/delivery-proof/:orderId` | `app/delivery-proof/[orderId].tsx` |
| `/followers/:username` | `app/followers/[username].tsx` |
| `/help/:slug` | `app/help/[slug].tsx` |
| `/wallet-transaction/:txId` | `app/wallet-transaction/[txId].tsx` |

Rute statis (`/wallet`, `/notifications`, `/home`, `/transactions`,
`/discover`, `/kyc`, `/referral`, dan 60-an lainnya) tidak butuh aturan apa pun:
`expo export` menghasilkan berkas HTML sendiri untuk masing-masing.

### `/profile/:id` adalah alias, bukan layar kedua

Profil publik sudah punya layar di `app/user/[username].tsx`, dan
`routeForNotificationReference` memetakan `USER`/`PROFILE` ke sana. Membuat
layar kedua di `/profile/:id` berarti dua URL kanonik untuk halaman yang sama —
buruk untuk SEO dan membuat klaim "1:1" jadi ambigu.

Jadi `/profile/budi` adalah `<Redirect>` ke `/user/budi`. Tautan lama tetap
hidup, URL kanonik tetap satu.

### `/notification/:id` adalah placeholder

Backend baru punya `GET /v1/notifications` (list), belum per-id, sehingga tidak
ada yang bisa dirender. Rute ini mengalihkan ke `/notifications` supaya tautan
yang beredar tidak berakhir 404. **TODO**: ganti dengan layar detail bila
endpoint per-id tersedia.

Arah yang disarankan: deep link push sebaiknya menunjuk **entitasnya**
(`/order/123`, `/dispute/9`) lewat `routeForPushData` yang sudah ada — pengguna
ingin melihat ordernya, bukan barisan notifikasinya.

---

## Cold start & warm start: sudah ditangani expo-router

Tidak ada kode kustom yang ditambahkan, karena menambahnya justru akan
menduplikasi mekanisme yang sudah jalan. Diverifikasi langsung di
`node_modules/expo-router/build/`:

| Skenario | Mekanisme |
|---|---|
| Cold start (app belum jalan) | `getLinkingConfig().getInitialURL()` → iOS `Linking.getLinkingURL()`, Android `getInitialURLWithTimeout()` |
| Warm start (app di background) | `subscribe()` → `Linking.addEventListener("url", …)` |

Yang juga penting: `prefixes: []` — expo-router **tidak** memfilter berdasarkan
daftar prefix. Untuk URL `https://`, ia memakai `href.replace(origin, "")`,
sehingga host apa pun otomatis menjadi path. Itu sebabnya App Links bekerja
tanpa perlu mendaftarkan `https://kahade.id` di mana pun dalam kode JS.

Terkunci oleh tes (`tests/deep-linking.test.ts`):

```
kahade://order/123              -> /order/123
https://kahade.id/order/123     -> /order/123
https://www.kahade.id/order/123 -> /order/123
kahade://dispute/9?tab=chat     -> /dispute/9?tab=chat
```

---

## Konfigurasi native (terverifikasi lewat prebuild)

`app.json` → hasil `expo prebuild`:

```
AndroidManifest.xml
  intent-filter #1  scheme="kahade"                         (autoVerify: false)
  intent-filter #2  scheme="https" host="kahade.id"         autoVerify="true"
                    scheme="https" host="www.kahade.id"
                    category BROWSABLE + DEFAULT

Kahade.entitlements
  aps-environment = development
  com.apple.developer.associated-domains
    applinks:kahade.id
    applinks:www.kahade.id

Info.plist CFBundleURLSchemes: kahade, id.kahade
```

`autoVerify: false` pada filter scheme kustom memang benar — hanya `https` yang
bisa diverifikasi. Expo memisahkan keduanya secara otomatis.

---

## Cloudflare Pages

### Kenapa `_redirects` wajib ada

`expo export --platform web` (output `static`) menulis rute dinamis sebagai
berkas **harfiah berkurung**: `dist/order/[id].html`. Cloudflare menyajikan
berkas apa adanya, jadi tanpa rewrite `/order/123` berakhir **404** — dan itu
persis merusak syarat "app belum terinstall → link terbuka sebagai web app".

Dipakai placeholder `:param`, bukan splat `*`, karena ada rute bersarang
(`/user/:username/ratings`). Aturan bersarang ditaruh **di atas** induknya
karena Cloudflare memakai kecocokan pertama; `check:weblinks` memverifikasi
urutan ini.

**Tidak ada catch-all SPA** (`/* /index.html 200`), dan itu disengaja: setiap
rute statis sudah punya HTML sendiri, dan catch-all justru akan menelan
`/.well-known/*` sehingga berkas verifikasi terkirim sebagai HTML — penyebab
paling umum App Links/Universal Links gagal tanpa pesan error.

Berkas final ada di `public/_redirects` (18 aturan) dan `public/_headers`.
Keduanya otomatis tersalin ke `dist/` oleh `expo export` — sudah diverifikasi,
termasuk folder `.well-known` yang berawalan titik.

### `_headers` — satu baris yang menentukan

```
/.well-known/apple-app-site-association
  Content-Type: application/json
```

AASA sengaja tanpa ekstensi berkas (aturan Apple), jadi Cloudflare tidak bisa
menebak tipenya dan mengirimkannya sebagai `application/octet-stream`. iOS
menolak AASA yang bukan `application/json`, dan **penolakannya senyap**: tidak
ada error, Universal Link hanya "tidak bekerja".

### Server preview kini setia pada Cloudflare

`scripts/serve-web.mjs` dulu mengembalikan `index.html` untuk semua path tanpa
ekstensi. Itu membuat preview selalu terlihat sehat sementara produksi 404.
Sekarang ia membaca `_redirects` dan `_headers` dari hasil export dan memakai
urutan resolusi yang sama dengan Cloudflare, lalu **404 seperti Cloudflare**.

---

## Smart App Banner

`components/ui/smart-app-banner.tsx` + logika murni di `lib/smart-app-banner.ts`
(dipisah supaya bisa diuji tanpa DOM).

Tampil **hanya** bila keempat syarat terpenuhi:

| Syarat | Alasan |
|---|---|
| `Platform.OS === "web"` | tidak pernah muncul di dalam aplikasi |
| UA seluler (iOS/Android) | disembunyikan di desktop |
| bukan PWA standalone | yang sudah memasang tidak perlu diajak lagi |
| di luar masa tenang 7 hari | menghormati tombol tutup |

Detail yang tidak kelihatan tetapi menentukan:

- **Render pertama selalu `null`.** Static export menghasilkan HTML di Node
  tanpa `window`; menghitung visibilitas saat render akan memicu hydration
  mismatch. Keputusan ditunda ke `useEffect`.
- **iPadOS menyamar sebagai "Macintosh"** di UA-nya. Dibedakan lewat
  `maxTouchPoints > 1` — tanpa itu iPad dianggap desktop dan banner tidak
  pernah muncul di sana.
- **Nilai `localStorage` rusak dianggap "belum pernah ditutup"**, dan jam
  perangkat yang mundur tidak menyembunyikan banner selamanya. Kegagalan
  condong ke menampilkan, bukan menyembunyikan permanen.
- **`localStorage` dibungkus try/catch** — Safari mode privat melempar
  `SecurityError`.
- **Tinggi banner didorong sebagai `padding-top` pada `<body>`**, bukan margin
  konten: layout Kahade memakai `flex-1` setinggi penuh, menyisipkan elemen di
  atasnya akan memotong tinggi kolom.
- **`z-sticky` (10), bukan `z-banner` (70).** `z-banner` berada di atas Modal
  karena diperuntukkan bagi status kritikal; ajakan pasang aplikasi tidak boleh
  menutupi dialog.

Desain memakai token yang sudah ada (`bg-surface`, `border-border`, `Text`,
`Button`, `IconButton`, `Logo`) — flat, tanpa shadow, monokrom.

---

## Yang masih perlu dilengkapi

### 1. `public/.well-known/assetlinks.json` — fingerprint Android

```json
"sha256_cert_fingerprints": []
```

Isi setelah ada signing key production:

```bash
eas credentials -p android          # atau:
keytool -list -v -keystore <file>.jks | grep SHA256
```

**Masukkan JUGA fingerprint Play App Signing** (Play Console → Setup → App
integrity). Google menandatangani ulang APK yang Anda unggah, jadi fingerprint
keystore lokal saja tidak cukup — ini penyebab App Links gagal yang paling
sering terlewat.

### 2. `public/.well-known/apple-app-site-association` — Team ID

```json
"appID": "TEAMID.id.kahade"
```

Ganti `TEAMID` dengan Team ID dari developer.apple.com → Membership, mis.
`A1B2C3D4E5.id.kahade`. Ada di dua tempat: `applinks.details[0].appID` dan
`webcredentials.apps[0]`.

### 3. Link App Store — `lib/smart-app-banner.ts`

```ts
ios: "https://apps.apple.com/id/app/kahade/id000000000"   // TODO
```

Menunggu numeric App Store ID yang terbit saat app record dibuat di App Store
Connect. URL Android sudah final (`id=id.kahade`), halamannya hidup begitu
aplikasi dipublikasikan. Ada tes yang sengaja gagal saat placeholder iOS diisi,
supaya dokumen ini ikut diperbarui.

### 4. Capability Associated Domains (iOS)

EAS Build menyinkronkan capability dari entitlements otomatis pada setiap
`eas build`. Pastikan akun Apple Developer sudah tertaut; kalau tidak,
aktifkan manual di Certificates, Identifiers & Profiles → identifier
`id.kahade` → Associated Domains.

Selama ketiga TODO di atas belum diisi, perilakunya **aman**: verifikasi gagal,
dan link `kahade.id` terbuka di browser sebagai web app. Tidak ada error yang
terlihat pengguna.

---

## Hasil pengujian

Dijalankan pada hasil `expo export` sungguhan lewat `scripts/serve-web.mjs`
yang meniru Cloudflare (tanpa fallback SPA).

### `curl` berkas verifikasi

```
/.well-known/assetlinks.json               200  Content-Type: application/json  JSON mentah
/.well-known/apple-app-site-association    200  Content-Type: application/json  JSON mentah
```

Keduanya bukan HTML.

### App belum terinstall → fallback web

26 path diuji, **26 berstatus 200**: seluruh 18 rute dinamis (`/order/123`,
`/user/budi/ratings`, `/profile/budi`, `/notification/5`, …) plus rute statis
dan `/`.

Kontrol negatif berperilaku benar: `/tidak-ada`, `/order/123/extra`, dan
`/user` semuanya **404** — membuktikan hasil 200 di atas datang dari aturan
rewrite, bukan dari fallback yang menutupi segalanya.

> Catatan metodologi: pengujian pertama memberi 26/26 hijau yang **tidak
> bermakna** — versi lama `serve-web.mjs` mengembalikan `index.html` untuk
> semua path tanpa ekstensi, jadi hasilnya akan hijau bahkan tanpa
> `_redirects`. Ke-96 berkas HTML hasil export ternyata hanya punya 2 hash
> unik (semuanya shell klien yang sama), sehingga isi respons tidak bisa
> dijadikan bukti. Server preview diperbaiki lebih dulu, baru angkanya berarti.

### Logika banner

18 tes di `tests/deep-linking.test.ts`: deteksi UA (termasuk iPadOS),
masa tenang 7 hari dan batasnya, nilai storage rusak, jam mundur, matriks
empat syarat tampil, dan kesetaraan `kahade://` vs `https://`.

Teks banner, URL Play Store, dan kunci `localStorage` diverifikasi hadir di
bundle produksi hasil build.

### Yang TIDAK bisa diuji di lingkungan ini

- **`npx uri-scheme open kahade://order/123`** — butuh emulator/simulator.
  Android: `Opening URI … in emulator` lalu gagal tanpa perangkat. iOS: gagal,
  `simctl` tidak ada di Linux. Skema itu sendiri sudah terbukti terdaftar lewat
  `npx uri-scheme list` (`kahade://`, `id.kahade://`, `https://`).
- **Verifikasi App Links/Universal Links sungguhan** — perlu domain
  `kahade.id` yang benar-benar ter-deploy plus fingerprint & Team ID.
- **Render banner di jsdom** — terhalang batasan vitest yang sudah ada di repo
  (`react-native` asli ber-syntax Flow gagal di-parse; `phosphor-react-native`,
  `theme-provider`, `button`, `logo` semuanya tidak bisa diimpor). Logikanya
  diuji penuh secara terpisah; tampilannya perlu dicek lewat device emulation
  di devtools.

### Setelah deploy, jalankan ini

```bash
curl -sSI https://kahade.id/.well-known/apple-app-site-association | grep -i content-type
curl -sS  https://kahade.id/.well-known/assetlinks.json | head
curl -sS -o /dev/null -w '%{http_code}\n' https://kahade.id/order/123

# Verifier resmi Google:
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://kahade.id&relation=delegate_permission/common.handle_all_urls

# Android, pada perangkat:
adb shell pm get-app-links id.kahade      # harus "verified"
adb shell am start -a android.intent.action.VIEW -d "https://kahade.id/order/123"
```

Pastikan tidak ada redirect (301/302) pada kedua berkas `.well-known` — Apple
dan Google sama-sama menolak AASA/assetlinks yang dialihkan.
