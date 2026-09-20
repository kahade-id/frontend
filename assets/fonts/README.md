# Kahade — Font assets (offline bundle)

Taruh 7 file berikut di folder ini. Nama file HARUS sama persis dengan
value di `fontFamilyByWeight` (`lib/tokens.ts`) + ekstensi `.ttf`, karena
`lib/fonts.ts` me-`require()` path ini secara statis dan key registrasinya
menjadi `fontFamily` yang dipakai di seluruh app.

| File                          | Role  | Weight | Sumber (unduh manual, static TTF)   |
|-------------------------------|-------|--------|-------------------------------------|
| PlusJakartaSans-Regular.ttf   | sans  | 400    | Google Fonts → Plus Jakarta Sans    |
| PlusJakartaSans-Medium.ttf    | sans  | 500    | Google Fonts → Plus Jakarta Sans    |
| PlusJakartaSans-SemiBold.ttf  | sans  | 600    | Google Fonts → Plus Jakarta Sans    |
| PlusJakartaSans-Bold.ttf      | sans  | 700    | Google Fonts → Plus Jakarta Sans    |
| EBGaramond-Medium.ttf         | serif | 500    | Google Fonts → EB Garamond          |
| AzeretMono-Medium.ttf         | mono  | 500    | Google Fonts → Azeret Mono (static) |
| AzeretMono-SemiBold.ttf       | mono  | 600    | Google Fonts → Azeret Mono (static) |

Catatan:
- Pakai **static instance** per-weight, BUKAN variable font (`[wght].ttf`).
  RN native tidak bisa memilih axis weight dari satu file variable font.
- Sans memakai Plus Jakarta Sans (geometric sans yang modern, bersih, dan proporsional untuk fintech).
- Kenapa mono memakai Azeret Mono, bukan JetBrains Mono: nol JetBrains Mono
  memakai diakritik titik (0•) yang terbaca sebagai "matahari" di deret
  nominal; nol Azeret Mono polos (lihat §3.1 lib/tokens.ts).
- Plus Jakarta Sans, EB Garamond, dan Azeret Mono berlisensi OFL — satu file lisensi
  per keluarga (`OFL-PlusJakartaSans.txt`, `OFL-EBGaramond.txt`,
  `OFL-AzeretMono.txt`) untuk kepatuhan lisensi.
