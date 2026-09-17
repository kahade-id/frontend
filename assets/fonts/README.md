# Kahade — Font assets (offline bundle)

Taruh 7 file berikut di folder ini. Nama file HARUS sama persis dengan
value di `fontFamilyByWeight` (`lib/tokens.ts`) + ekstensi `.ttf`, karena
`lib/fonts.ts` me-`require()` path ini secara statis dan key registrasinya
menjadi `fontFamily` yang dipakai di seluruh app.

| File                          | Role  | Weight | Sumber (unduh manual, static TTF)   |
|-------------------------------|-------|--------|-------------------------------------|
| Chivo-Regular.ttf             | sans  | 400    | Google Fonts → Chivo                |
| Chivo-Medium.ttf              | sans  | 500    | Google Fonts → Chivo                |
| Chivo-SemiBold.ttf            | sans  | 600    | Google Fonts → Chivo                |
| Chivo-Bold.ttf                | sans  | 700    | Google Fonts → Chivo                |
| EBGaramond-Medium.ttf         | serif | 500    | Google Fonts → EB Garamond          |
| AzeretMono-Medium.ttf         | mono  | 500    | Google Fonts → Azeret Mono (static) |
| AzeretMono-SemiBold.ttf       | mono  | 600    | Google Fonts → Azeret Mono (static) |

Catatan:
- Pakai **static instance** per-weight, BUKAN variable font (`[wght].ttf`).
  RN native tidak bisa memilih axis weight dari satu file variable font.
  Chivo di Google Fonts berupa variable font (wght 100–900, default 500);
  instance static di folder ini di-generate via fontTools `instancer`
  (wght 400/500/600/700), lalu name table-nya dirapikan: family
  "Chivo"/"Chivo Medium"/"Chivo SemiBold"/"Chivo Bold", subfamily Regular,
  PostScript = nama file, dan bit OS/2 `fsSelection` (italic/bold/regular)
  di-set ulang sesuai weight — tanpa itu font bisa terdaftar sebagai
  "Regular" di sistem dan bold/semibold tidak terpakai.
- Sans berganti Kanit → Chivo (keputusan produk 2026-09-17). Kanit adalah
  geometric sans yang dioptimasi untuk Thai sehingga huruf Latin-nya lebih
  lebar; Chivo (grotesque, Latin + Latin-ext) lebih rapat di kolom sempit
  seperti nominal, caption, dan baris list. Keduanya OFL.
- Kenapa mono memakai Azeret Mono, bukan JetBrains Mono: nol JetBrains Mono
  memakai diakritik titik (0•) yang terbaca sebagai "matahari" di deret
  nominal; nol Azeret Mono polos (lihat §3.1 lib/tokens.ts).
- Chivo, EB Garamond, dan Azeret Mono berlisensi OFL — satu file lisensi
  per keluarga (`OFL-Chivo.txt`, `OFL-EBGaramond.txt`,
  `OFL-AzeretMono.txt`) untuk kepatuhan lisensi.
- Jangan menambahkan `@expo-google-fonts/*` — paket itu memang offline juga,
  tapi nama registrasinya (`Chivo_700Bold`) tidak cocok dengan tokens.
