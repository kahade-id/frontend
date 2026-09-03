# Kahade — Font assets (offline bundle)

Taruh 7 file berikut di folder ini. Nama file HARUS sama persis dengan
value di `fontFamilyByWeight` (`lib/tokens.ts`) + ekstensi `.ttf`, karena
`lib/fonts.ts` me-`require()` path ini secara statis dan key registrasinya
menjadi `fontFamily` yang dipakai di seluruh app.

| File                          | Role  | Weight | Sumber (unduh manual, static TTF) |
|-------------------------------|-------|--------|-----------------------------------|
| SofiaSans-Regular.ttf         | sans  | 400    | Google Fonts → Sofia Sans         |
| SofiaSans-Medium.ttf          | sans  | 500    | Google Fonts → Sofia Sans         |
| SofiaSans-SemiBold.ttf        | sans  | 600    | Google Fonts → Sofia Sans         |
| SofiaSans-Bold.ttf            | sans  | 700    | Google Fonts → Sofia Sans         |
| EBGaramond-Medium.ttf         | serif | 500    | Google Fonts → EB Garamond        |
| JetBrainsMono-Medium.ttf      | mono  | 500    | jetbrains.com/mono atau GF        |
| JetBrainsMono-SemiBold.ttf    | mono  | 600    | jetbrains.com/mono atau GF        |

Catatan:
- Pakai **static instance** per-weight, BUKAN variable font (`[wght].ttf`).
  RN native tidak bisa memilih axis weight dari satu file variable font.
- Sofia Sans dan EB Garamond berlisensi OFL; JetBrains Mono OFL. Sertakan
  file LICENSE masing-masing di folder ini untuk kepatuhan lisensi.
- Jangan menambahkan `@expo-google-fonts/*` — paket itu memang offline juga,
  tapi nama registrasinya (`SofiaSans_700Bold`) tidak cocok dengan tokens.
