# App Icon & Splash Screen Kahade — final

Semua aset diturunkan dari satu sumber: `assets/brand/logo.svg`.
Flat, monokrom, tanpa shadow (Design System v1.1).

Regenerasi: `npm i --no-save sharp && npm run gen:brand && npm run qa:icon`

---

## Warna — token yang sudah ada, bukan hex baru

| Peran | Token | Nilai |
|---|---|---|
| Latar app icon, adaptive icon, splash | `tokens.colors.brand.black` | `#000000` |
| Mark di atas latar tersebut | `tokens.colors.brand.white` | `#FFFFFF` |

`brand.black` dipilih, **bukan** `light.primary` (yang nilainya juga
`#000000`). Alasannya token per-mode ikut ter-invert: `dark.primary` adalah
putih. App icon dan splash adalah permukaan brand yang konstan di light maupun
dark, jadi acuannya harus token brand yang tidak bergantung mode.

---

## Aset yang dihasilkan

| Berkas | Ukuran | Isi |
|---|---|---|
| `assets/brand/logo-black.svg` | 1024² | Master hitam (light mode) |
| `assets/brand/logo-white.svg` | 1024² | Master putih (dark mode & semua aset native) |
| `assets/images/icon.png` | 1024² | iOS + fallback. Hitam solid, **tanpa alpha**, padding 9% |
| `assets/images/adaptive-icon.png` | 1024² | Foreground Android, transparan, tinta 45,0dp/108dp |
| `assets/images/splash-icon.png` | 2048² | Logo putih transparan, kotak logo 1/4 kanvas |

Kedua master SVG mendapat `viewBox` yang di sumbernya tidak ada — tanpa itu
SVG tidak bisa diskalakan dengan benar.

---

## Kenapa semua ukuran dihitung dari bounding box tinta

`logo.svg` punya viewBox 1024², tetapi tintanya hanya mengisi **77,49%** dan
**tidak berada di tengah**: margin atas 8,40%, margin bawah 14,70%. Menskalakan
seluruh viewBox akan menghasilkan logo yang terlihat naik ke atas dengan
padding tepi yang tidak sama. Karena itu generator mengukur tinta dulu, lalu
memusatkan tinta itu sendiri.

Diukur juga: radius tinta terjauh dari pusat = **99,81%** dari radius sudut
bounding box-nya. Artinya bentuk logo benar-benar mengisi sudut — tidak ada
ruang gratis yang bisa dipakai untuk memperbesar logo di dalam mask lingkaran.

---

## Android adaptive icon — kenapa logonya lebih kecil dari iOS

Kanvas foreground 108dp, tetapi launcher bebas memilih mask. Yang **dijamin**
terlihat hanya lingkaran ⌀66dp di tengah. Karena tinta mengisi sudutnya,
syaratnya adalah radius tinta ≤ radius lingkaran aman, ditambah margin 4%
supaya anti-aliasing tidak melewati garis:

```
radius_tinta ≤ (66/108) × kanvas/2 × 0,96   →   tinta 45,0dp dari 108dp
```

45,0dp terasa kecil dibanding ikon iOS, dan itu memang benar: setelah masking
yang tampak hanya 72dp, jadi logo mengisi **62%** dari area yang benar-benar
terlihat — proporsi normal. Memperbesarnya berarti menerima logo terpotong di
sebagian launcher.

Background layer terpisah dari foreground, lewat `adaptiveIcon.backgroundColor`
(prebuild menghasilkan `<background android:drawable="@color/iconBackground"/>`
dengan `iconBackground = #000000`).

---

## Splash — jebakan Android 12

Android 12+ menggambar `windowSplashScreenAnimatedIcon` pada kanvas **288dp**
dan **memasking apa pun di luar lingkaran 192dp** di tengahnya
([dokumentasi Android](https://developer.android.com/develop/ui/views/launch/splash-screen):
*"App icon without an icon background: this must be 288×288 dp and fit within a
circle 192 dp in diameter. Everything outside the circle turns invisible"*).

`imageWidth` **tidak** mengubah ini. Diuji lewat prebuild: `imageWidth` 72
maupun 200 sama-sama menghasilkan drawable 288dp (mdpi 288px … xxxhdpi 1152px).

Versi pertama aset splash ini menggambar logo memenuhi kanvas — tinta 223dp,
**71% melewati batas**, dan akan terpotong bulat di Android 12+. Perbaikannya:
logo hanya mengisi 1/4 kanvas (`SPLASH_CANVAS_SCALE`), meniru persis kotak
`<LogoMark size={LOGO_SIZE}>` di `<AnimatedSplash>`.

Dengan `imageWidth = LOGO_SIZE × SPLASH_CANVAS_SCALE = 72 × 4 = 288`, ukuran
tinta menjadi identik di tiga tempat — splash native Android, splash native
iOS, dan overlay JS — sehingga logo tidak melompat saat serah terima:

```
tinta native  = 19,38% × 288dp = 55,8dp
tinta overlay = 77,49% × 72dp  = 55,8dp
```

**Ingin logo splash lebih besar?** Naikkan `LOGO_SIZE` di
`components/ui/animated-splash.tsx` dan jalankan ulang `npm run gen:brand`;
`check:tokens` akan memaksa `imageWidth` ikut disesuaikan. Batas atasnya
lingkaran 192dp itu, yaitu tinta ≈135dp (LOGO_SIZE ≈ 175).

---

## Splash sekarang hitam di kedua mode — konsekuensinya

Sebelumnya splash mengikuti tema (putih di light, `#121212` di dark) dan
`check:tokens` #8 memaksa `splash.backgroundColor == light.background`.
Permintaan "splash memakai hitam yang sama dengan app icon" bertabrakan dengan
aturan itu, jadi tiga hal diubah bersamaan — bukan hanya app.json:

1. `app.json` — `backgroundColor` dan `dark.backgroundColor` keduanya `#000000`.
2. `<AnimatedSplash>` — latar `brand.black`, mark `brand.white`, konstan.
   Kalau hanya app.json yang diubah, layar akan **berkedip hitam → putih** di
   light mode tepat saat splash native menyerahkan ke overlay JS.
3. `check:tokens` #8 — aturannya **dialihkan**, bukan dihapus: sekarang
   memaksa `splash.backgroundColor`, `splash.dark.backgroundColor`, dan
   `adaptiveIcon.backgroundColor` sama dengan `brand.black`, memaksa
   `imageWidth == LOGO_SIZE × SPLASH_CANVAS_SCALE`, dan memastikan ketiga
   berkas ikon benar-benar ada.

---

## `<Logo>` sudah theme-adaptive — tidak ada komponen baru

Permintaannya adalah satu komponen `<BrandLogo />` yang memilih putih/hitam
otomatis. Komponen itu **sudah ada** sebagai `components/ui/logo.tsx`, dan
mekanismenya lebih baik daripada menukar dua berkas SVG: ia merender
`LOGO_PATHS` lewat react-native-svg dan mewarnainya dari
`useTheme()` + `tokens.colors[mode].primary` — hitam di light, putih di dark.

Menukar dua berkas SVG justru akan menurunkan kualitas: React Native tidak bisa
merender berkas `.svg` tanpa transformer tambahan, jadi praktiknya harus jadi
bitmap (blur di densitas tinggi) dan geometri jadi tersimpan di dua tempat yang
bisa melenceng. Karena itu `<Logo>` dipertahankan; membuat `<BrandLogo>` hanya
akan menambah nama kedua untuk hal yang sama.

Struktur setelah perubahan ini:

| Komponen | Warna | Dipakai di |
|---|---|---|
| `<Logo>` | dari `useTheme()` — otomatis light/dark | seluruh aplikasi |
| `<LogoMark>` | `fill` eksplisit dari token | hanya `<AnimatedSplash>` |

`<LogoMark>` ada karena `<AnimatedSplash>` dirender sebagai **saudara**
`<ThemeProvider>` (`app/_layout.tsx`: provider tutup di baris 113, splash di
117), sedangkan `useTheme()` sengaja melempar error di luar provider — memakai
`<Logo>` di sana akan crash saat boot. Geometrinya tetap satu sumber
(`LOGO_PATHS`); yang berbeda hanya dari mana `fill` datang.

Tidak ada logo hitam/putih yang di-hardcode di komponen mana pun. Placeholder
lama di `<AnimatedSplash>` (kotak ber-border) sudah diganti mark asli.

---

## Hasil QA (`npm run qa:icon`)

Setiap mask diterapkan ke bagian **72dp tengah** dari kanvas 108dp — bukan ke
kanvas penuh, karena itulah yang benar-benar ditampilkan sistem.

```
ANDROID adaptive icon
  PASS  circle             tinta hilang 0.000%
  PASS  squircle           tinta hilang 0.000%
  PASS  rounded-square     tinta hilang 0.000%
  PASS  teardrop           tinta hilang 0.000%
  PASS  square             tinta hilang 0.000%
  PASS  safe-zone 66dp     radius 225,6 / batas 234,7 px   (headroom 3,9%)

iOS icon
  PASS  squircle iOS       tinta hilang 0.000%
  PASS  tanpa alpha        channels=3 hasAlpha=false
  PASS  ukuran 1024        1024x1024

Splash
  PASS  resolusi >= 2000   2048x2048
  PASS  transparan         hasAlpha=true
  PASS  mask 192dp A12+    radius 291,5 / batas 682,7 px   (headroom 57,3%)
  PASS  handoff native↔JS  tinta native 55,8dp vs overlay JS 55,8dp
```

Pratinjau visual (tidak di-commit, regenerasi dengan `npm run qa:icon`):
`assets/images/__qa__/contact-sheet.png` dan `splash-preview.png`.

### Dua kegagalan senyap yang ditemukan saat menulis QA ini

- **Mask tidak pernah terpasang.** `joinChannel()` *menambah* band, tidak
  mengganti alpha; hasilnya sharp membuang band itu (3ch, `hasAlpha=false`)
  sehingga seluruh angka melaporkan "0% tinta hilang" atas gambar yang belum
  ter-mask. Hanya ketahuan karena pratinjau masih bersudut kotak. Sekarang
  memakai `composite({ blend: "dest-in" })`.
- **Headroom 0%.** Versi pertama menskalakan tinta agar menyentuh persis garis
  lingkaran 66dp; anti-aliasing saja sudah cukup melewatinya. Sekarang ada
  margin 4% yang diperiksa mesin.

---

## Verifikasi native (`expo prebuild`, direktori dihapus lagi setelahnya)

```
ios  AppIcon.appiconset/App-Icon-1024x1024@1x.png   1024x1024, channels=3, hasAlpha=false
ios  SplashScreen.storyboard                        imageView 288x288, centerX/centerY, scaleAspectFit
ios  (tidak ada lagi peringatan "No icon is defined in the Expo config")

android mipmap-anydpi-v26/ic_launcher.xml           background=@color/iconBackground, foreground=@mipmap/ic_launcher_foreground
android values/colors.xml                           splashscreen_background #000000, iconBackground #000000
android values-night/colors.xml                     splashscreen_background #000000
android mipmap-*/ic_launcher_foreground.webp        108px (mdpi) … 432px (xxxhdpi)
android drawable-*/splashscreen_logo.png            288px (mdpi) … 1152px (xxxhdpi)
```

---

## Catatan pemeliharaan

`sharp` **tidak** ada di `package.json`: paket native ~100 MB yang hanya
dibutuhkan saat logo berubah. PNG hasilnya di-commit, jadi CI dan build tidak
pernah memerlukannya. Kedua skrip berhenti dengan pesan jelas bila sharp tidak
terpasang.

`assets/brand/logo-paths.ts` (dipakai `<Logo>`) dan kedua master SVG sama-sama
berasal dari `logo.svg`. Kalau logo berubah, keduanya harus di-generate ulang.
