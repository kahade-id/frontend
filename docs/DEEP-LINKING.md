# Deep Linking — Kahade

Dokumen ini menjawab satu pertanyaan: **kenapa tautan `https://kahade.id/...`
kadang membuka browser, bukan aplikasi**, dan apa yang harus diisi supaya
selalu membuka aplikasi langsung ke halaman yang dituju.

Dipakai bersama `npm run check:weblinks` (penjaga mesin) dan `public/_headers`.

---

## 1. Tiga lapis yang harus SEJAJAR

Deep link native hanya bekerja kalau ketiganya cocok. Gagal di salah satu
saja gejalanya selalu sama dan selalu **tanpa pesan error**: browser yang
membuka.

| Lapis | Android (App Links) | iOS (Universal Links) |
| --- | --- | --- |
| Aplikasi | `expo.android.intentFilters[].autoVerify: true` + `android.package` | `expo.ios.associatedDomains` + `ios.bundleIdentifier` |
| Domain | `https://kahade.id/.well-known/assetlinks.json` | `https://kahade.id/.well-known/apple-app-site-association` |
| Penandatanganan | SHA-256 sertifikat penandatanganan | Team ID Apple + bundle id |

`app.json` sudah berisi sisi aplikasinya:

```jsonc
"scheme": "kahade",
"ios":  { "bundleIdentifier": "id.kahade",
          "associatedDomains": ["applinks:kahade.id", "applinks:www.kahade.id"] },
"android": { "package": "id.kahade",
             "intentFilters": [{ "action": "VIEW", "autoVerify": true,
                                 "data": [{ "scheme": "https", "host": "kahade.id" },
                                          { "scheme": "https", "host": "www.kahade.id" }],
                                 "category": ["BROWSABLE", "DEFAULT"] }] }
```

Yang tersisa — dan ini isi dokumen ini — adalah **sisi domain**.

---

## 2. `/.well-known/assetlinks.json` (Android)

Berkas ada di `public/.well-known/assetlinks.json`. Isinya sudah benar untuk
package `id.kahade`, tetapi **hanya memuat satu fingerprint**:

```
DA:10:6E:7F:99:07:89:4C:29:F4:DE:9A:CC:E9:0C:E2:54:9F:23:08:B5:CC:DD:AA:ED:68:FB:37:3B:04:00:99
```

Itu fingerprint sertifikat **lokal/upload** (`certificates/certificate.pem`,
`CN=Kahade`). Artinya App Links terverifikasi untuk build debug/preview yang
ditandatangani sertifikat itu.

> ### WAJIB sebelum rilis Play Store
>
> Play **App Signing** menandatangani ulang APK/AAB dengan sertifikat
> MILIK GOOGLE. Fingerprint di atas tidak akan cocok, sehingga build
> production dari Play **tetap membuka browser**.
>
> Ambil SHA-256 sertifikat penandatanganan aplikasi dari
> **Play Console → Setup → App signing → App signing key certificate
> (SHA-256)**, lalu tambahkan ke array
> `sha256_cert_fingerprints`. Jangan menghapus yang lama — dua entri
> sekaligus membuat debug **dan** production sama-sama terverifikasi.

Verifikasi di perangkat:

```bash
adb shell pm get-app-links id.kahade
#   id.kahade:
#     ID: …
#     Domain: kahade.id          ← status harus "verified", bukan "ask"/"none"
adb shell am start -a android.intent.action.VIEW -d "https://kahade.id/o/ABC123"
```

Uji mandiri tanpa perangkat:

```bash
curl -sI https://kahade.id/.well-known/assetlinks.json | head
# Content-Type: application/json   ← selain ini, Android menolaknya
```

---

## 3. `/.well-known/apple-app-site-association` (iOS)

Berkas ada di `public/.well-known/apple-app-site-association`, **tanpa
ekstensi** — itu yang diminta Apple. `public/_headers` memaksa
`Content-Type: application/json`, karena tanpa itu iOS menolak AASA secara
senyap (Cloudflare mengirim berkas tanpa ekstensi sebagai
`application/octet-stream`).

Isinya sekarang **kosong**:

```json
{ "applinks": { "apps": [], "details": [] } }
```

Alasannya: belum ada akun Apple Developer Program, jadi **Team ID belum
ada**, dan `appID` berbentuk `<TEAMID>.id.kahade` tidak bisa diisi.
`npm run check:weblinks` hanya memberi peringatan untuk kondisi ini, dan
akan gagal bila `appID` tidak berakhir dengan `.id.kahade`.

Begitu Team ID tersedia (App Store Connect → Membership), isi:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["TEAMID1234.id.kahade"],
        "components": [
          { "/": "/o/*",      "comment": "Tautan order pendek" },
          { "/": "/r/*",      "comment": "Undangan referral" },
          { "/": "/v/*",      "comment": "Voucher" },
          { "/": "/p/*" },
          { "/": "/order/*" },
          { "/": "/chat/*" },
          { "/": "/showcase/*" },
          { "/": "/user/*" },
          { "/": "*" }
        ]
      }
    ]
  }
}
```

Verifikasi:

* https://search.developer.apple.com/appsearch-validation-tool/
* `curl -s https://kahade.id/.well-known/apple-app-site-association` harus
  mengembalikan JSON (bukan HTML — kalau HTML, ada catch-all rewrite yang
  menelan `/.well-known/*`).

---

## 4. Jaring pengaman: jangan ada catch-all SPA

`public/_redirects` **sengaja tidak punya** aturan `/* /index.html 200`.
Catch-all seperti itu menelan `/.well-known/*`, sehingga berkas verifikasi
terkirim sebagai HTML dan kedua platform gagal verifikasi tanpa pesan.
`npm run check:weblinks` akan gagal bila aturan itu muncul tanpa
pengecualian.

Aturan yang ada memetakan **setiap rute dinamis** ke berkas HTML hasil
`expo export --platform web` (namanya harfiah, mis. `/order/[id].html`).
Tanpanya, `/order/123` di web berakhir 404 — padahal web-adalah jatuh
tempo bagi pengguna yang belum memasang aplikasi.

Urutan aturan penting: yang lebih spesifik di atas. `/:username`
(vanity profile, satu segmen apa saja) harus **paling bawah**, di bawah
tautan pendek `/o/:token`, `/r/:code`, `/v/:code`, `/p/:id`.

---

## 5. Sisi aplikasi (sudah beres)

* `app/_layout.tsx` tidak mendeklarasikan `linking` — expo-router memakai
  prefix otomatis dari `scheme` + `associatedDomains`, jadi tidak ada
  konfigurasi yang bisa melenceng.
* `app/o/[token].tsx`, `app/r/[code].tsx`, `app/v/[code].tsx`,
  `app/p/[id].tsx` mendaratkan tautan pendek lalu `<Redirect>` ke rute
  internal — tidak ada `Linking.openURL()` yang bisa melempar ke browser.
* Cold start dari push/deep link menang atas pemulihan rute terakhir
  (`suppressLastRouteRestore()`), jadi tautan selalu menang.
* Back pada rute non-tab tanpa riwayat jatuh ke "induk logis"
  (`logicalParentForPath`), bukan ke Etalase.

---

## 6. Daftar periksa rilis

- [ ] `assetlinks.json` memuat SHA-256 **App Signing** dari Play Console
      (fingerprint lokal saja tidak cukup untuk build production).
- [ ] `apple-app-site-association` terisi `appIDs: ["<TEAMID>.id.kahade"]`.
- [ ] `curl -sI https://kahade.id/.well-known/apple-app-site-association`
      → `Content-Type: application/json`.
- [ ] `adb shell pm get-app-links id.kahade` → `verified` untuk `kahade.id`.
- [ ] `npm run check:weblinks` → OK.
- [ ] Buka `https://kahade.id/o/<token>` dari aplikasi Catatan/WhatsApp →
      aplikasi terbuka di halaman order, bukan Chrome/Safari.
