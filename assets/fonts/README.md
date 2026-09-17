# Kahade — Font assets (offline bundle)

Taruh 7 file berikut di folder ini. Nama file HARUS sama persis dengan
value di `fontFamilyByWeight` (`lib/tokens.ts`) + ekstensi `.ttf`, karena
`lib/fonts.ts` me-`require()` path ini secara statis dan key registrasinya
menjadi `fontFamily` yang dipakai di seluruh app.

| File                          | Role  | Weight | Sumber (unduh manual, static TTF)   |
|-------------------------------|-------|--------|-------------------------------------|
| Kanit-Regular.ttf             | sans  | 400    | Google Fonts → Kanit                |
| Kanit-Medium.ttf              | sans  | 500    | Google Fonts → Kanit                |
| Kanit-SemiBold.ttf            | sans  | 600    | Google Fonts → Kanit                |
| Kanit-Bold.ttf                | sans  | 700    | Google Fonts → Kanit                |
| EBGaramond-Medium.ttf         | serif | 500    | Google Fonts → EB Garamond          |
| AzeretMono-Medium.ttf         | mono  | 500    | Google Fonts → Azeret Mono (static) |
| AzeretMono-SemiBold.ttf       | mono  | 600    | Google Fonts → Azeret Mono (static) |

Catatan:
- Pakai **static instance** per-weight, BUKAN variable font (`[wght].ttf`).
  RN native tidak bisa memilih axis weight dari satu file variable font.
  Azeret Mono di Google Fonts berupa variable font — instance static di
  folder ini di-generate via fontTools `instancer` (wght 500/600), lalu
  name table-nya dirapikan (family "Azeret Mono Medium"/"Azeret Mono
  SemiBold", subfamily Regular) supaya registrasi expo-font unik per file.
- Kenapa mono pindah dari JetBrains Mono: nol JetBrains Mono memakai
  diakritik titik (0•) yang terbaca sebagai "matahari" di deret nominal;
  nol Azeret Mono polos (lihat §3.1 lib/tokens.ts).
- Kanit, EB Garamond, dan Azeret Mono berlisensi OFL — sertakan file
  lisensinya (`OFL.txt`, `OFL-AzeretMono.txt`) untuk kepatuhan lisensi.
- Jangan menambahkan `@expo-google-fonts/*` — paket itu memang offline juga,
  tapi nama registrasinya (`Kanit_700Bold`) tidak cocok dengan tokens.
