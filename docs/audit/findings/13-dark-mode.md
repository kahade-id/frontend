# Findings #13 — Kelengkapan dark mode

## Ringkasan

Model dark mode repo ini adalah **token, bukan class**: semua utility warna
mode-aware (`bg-background`, `text-text-primary`, `border-border`, `bg-primary`,
`bg-success-soft`, …) merujuk `var(--color-*)` yang nilainya di-inject
`ThemeProvider` lewat `vars(toCssVariables(mode))`. Karena itu kriteria
pertama backlog ("setiap var `:root` punya pasangan `.dark`") **sudah
terpenuhi secara struktural** — `toCssVariables("light")` dan `("dark")`
menghasilkan set key identik (25/25) dan dijaga `check:tokens` #1/#3 sejak
PR #34. Skrip `diff` di BACKLOG §13 tidak relevan: `global.css` tidak punya
blok `:root`/`.dark` sama sekali (temuan #12).

Yang tersisa dan dikerjakan di sini:

1. Audit semua class `dark:` dan warna literal non-mode-aware.
2. Splash dark (keputusan terbuka dari findings 08-09).
3. Guard mesin agar pengecualian tidak bertambah diam-diam.

## 1. Audit `dark:` dan warna literal

Hasil deteksi (`components/`, `app/`, komentar dikecualikan):

| Pola | File | Kasus | Alasan (sudah ada di komentar kode) | Verifikasi kontras |
|---|---|---|---|---|
| `text-white dark:text-gray-950` | `button.tsx` (destructive), `count-badge.tsx` (danger), `swipeable-list-item.tsx` (aksi destruktif) | 3 | `danger.fill` dark `#F87171` terlalu terang untuk teks putih | putih/fill dark **2.77:1** (gagal AA) → gray-950/fill dark **6.43:1** ✓; light putih/fill light 4.83:1 ✓ |
| `bg-gray-400/600/800 dark:bg-gray-700/500/300` | `bar-chart.tsx` | 3 | skala `chartMono` dibalik di dark supaya urutan kontras terang→gelap tetap | gray-300/surface dark 13.37, gray-500 8.39, gray-700 2.13 (batang paling redup — dekoratif berurutan, sama seperti gray-400 di light) |
| `bg-gray-300 dark:bg-border` | `divider.tsx` (subtle) | 1 | gray-300 dekoratif murni (§2.2, 1.30:1 di light — memang sengaja "sangat halus"); di dark jatuh ke token border | — dekoratif |
| `bg-surface dark:bg-surface-elevated` | `skeleton.tsx` | 1 | surface dark (`#1A1A1A`) terlalu dekat background (`#121212`) | 1.08:1 → 1.16:1. **Masih sangat rendah** — lihat "Keputusan" |
| `dark:font-sans-600` | `text.tsx` (h1, h2) | 2 | §3.2 `fontWeightDark`: H1/H2 700 → 600 di dark | bukan warna |
| `bg-white` | `bank-select.tsx` (tile logo) | 1 | §7 pengecualian logo bank berwarna; tile punya `border-border` | border dark/putih 11.37:1 ✓ — tile terpisah jelas di dark |
| `text-white` di atas `bg-overlay` | `showcase-gallery-grid.tsx` (+N) | 1 | scrim `overlay` selalu hitam-alpha di kedua mode (token `overlay`), jadi putih satu-satunya yang terbaca | ✓ |
| `brand.white`/`brand.black` inline | `qr-code-display.tsx` | 4 | QR harus hitam-di-putih untuk scanner; kartu punya `border-border` | border dark/putih 11.37:1 ✓ |

**Total: 9 file, semuanya pengecualian yang disengaja dan sudah berkomentar
§spek.** Tidak ada `dark:` liar dan tidak ada `text-white` yang hilang di
dark. Tidak ada `useColorScheme` react-native di komponen (semua lewat
`useTheme()`), kecuali `animated-splash` — lihat di bawah.

`bg-white`/`text-white` kelas Tailwind dan `brand.white` dari tokens
mengarah ke nilai yang sama (`#FFFFFF`); dua jalur ini dipertahankan karena
`bank-select` di-style via className sedangkan `qr-code-display` butuh nilai
untuk `<Svg fill>`.

## 2. Splash dark (menutup keputusan terbuka findings 08-09)

Sebelumnya splash native maupun `<AnimatedSplash>` selalu light meskipun
`userInterfaceStyle: "automatic"` — pengguna dark mode melihat flash putih
lalu app gelap. Diperbaiki:

- `app.json` → `expo-splash-screen.dark.backgroundColor: "#121212"`
  (= `tokens.colors.dark.background`).
- `<AnimatedSplash>` membaca `useColorScheme()` **react-native** (bukan
  `useTheme()` — ThemeProvider belum mount saat boot) dan memakai
  `tokens.colors[mode]` untuk background, border logo, dan fill logo.
  Saat boot belum ada preferensi manual yang mencemari `Appearance`
  (kekhawatiran di header `theme-provider.tsx`), jadi nilainya = OS = yang
  dipakai native splash. `StyleSheet.create` tetap dipakai untuk bagian
  statis; warna per-mode di-set inline.
- `check:tokens` #8: `dark.backgroundColor` kini **wajib** (sebelumnya
  hanya divalidasi bila ada). Uji mutasi: menghapusnya → FAIL.

Catatan: preferensi manual user (`initialPreference` dari storage) tidak
dibaca splash — jika user memilih "dark" padahal OS light, splash tetap
light lalu app dark. Native splash juga tidak bisa membaca storage, jadi
ini konsisten; menghindarinya butuh membaca SecureStore sebelum render
yang justru menunda splash. Diterima.

## 3. Guard baru: `check:tokens` #9

Pemeriksaan #9 memindai `components/` + `app/` untuk `dark:*` dan
`(bg|text|border|fill|stroke)-(white|black|gray-N)`. File yang memakainya
harus ada di `DARK_ALLOWLIST` (di skrip, dengan alasan ringkas); file baru
→ FAIL, entri allowlist yang tidak lagi terpakai → warn. Komentar
dikecualikan dari pemindaian. Uji mutasi: file baru dengan
`bg-white dark:bg-black` → FAIL dengan pesan yang mengarahkan ke token.

Ini menggantikan "uji visual 5 layar utama" dari kriteria backlog sebagai
definisi selesai yang **bisa diverifikasi mesin**, karena:

## Uji visual: tidak bisa dilakukan sekarang

`app/` masih hanya `_layout.tsx` — belum ada screen (sama seperti temuan #8).
Uji visual dark mode 5 layar utama **wajib dijalankan saat screen pertama
ditambahkan**, bersama checklist #8. Yang perlu dilihat khusus di dark:
skeleton terlihat atau tidak, border kartu/input terlihat atau tidak, tile
logo bank & kartu QR punya batas.

## Keputusan yang perlu konfirmasi tim (→ #6)

Perhitungan kontras di atas menemukan dua nilai token dark yang **bukan
masalah dark mode per se, tapi masalah kontras non-teks** (WCAG 1.4.11 ≥ 3:1),
sehingga diserahkan ke item #6 dan tidak diubah di PR ini:

| Pasangan (dark) | Rasio | Dampak |
|---|---|---|
| `surfaceElevated #212121` / `background #121212` | **1.16:1** | Skeleton hampir tak terlihat; kartu elevated tanpa border tidak terpisah dari latar |
| `surface #1A1A1A` / `background #121212` | **1.08:1** | Input fill / card fill menyatu dengan latar — bergantung sepenuhnya pada border |
| `borderDefault #3A3A3A` / `background #121212` | **1.65:1** | Border kartu/input di dark < 3:1 (light: `#CED4DA`/putih = 1.50:1, juga < 3:1) |

Opsi untuk #6: naikkan `dark.surfaceElevated` ke sekitar `#2A2A2A`
(≈1.45:1) dan `dark.borderDefault` ke `#4A4A4A`–`#555555` (≈2.3–3.0:1),
atau terima bahwa border 1px di sistem ini dekoratif-struktural (spek §6
"hierarki lewat border") dan hanya menaikkan `surfaceElevated` untuk
skeleton. Perubahan mana pun cukup di `lib/tokens.ts` — tidak ada override
lokal yang harus ikut diubah (itulah gunanya model token).
