# Findings #12 — Sinkronisasi tiga sumber token

## Ringkasan

Repo ini **sudah** memakai model satu sumber kebenaran, jadi premis backlog
("nilai bisa ada di `tokens.ts` tapi tidak di `tailwind.config.js`/`global.css`")
sebagian tidak berlaku:

| Sumber | Peran aktual |
|---|---|
| `lib/tokens.ts` | Satu-satunya tempat nilai. Mengekspor `toTailwindTheme()` dan `toCssVariables(mode)`. |
| `tailwind.config.js` | Tidak menyimpan nilai; memanggil `toTailwindTheme()` dan hanya menambah class `font-{role}-{weight}` dari `fontFamilyByWeight`. `screens`/`borderRadius`/`boxShadow` di-override (bukan extend) supaya default Tailwind yang melanggar spek hilang. |
| `global.css` | Hanya `@tailwind` directives. `--color-*` **tidak** dideklarasikan statis — di-inject runtime oleh `ThemeProvider` via `vars(toCssVariables(mode))`. |

Yang bisa drift bukan *nilai*, melainkan **kontrak antar adapter**: theme
Tailwind merujuk `var(--color-x)` yang tidak di-emit `toCssVariables()`
(class ada, warna kosong, gagal diam-diam), atau sebaliknya var di-emit
tapi tidak dipakai (dead token). Ini tidak terdeteksi oleh `tsc`.

## Hasil pemeriksaan (state saat ini)

`pnpm check:tokens`:

```
check-tokens: 25 var dirujuk theme, 25 var di-emit per mode, 5 var dipakai literal di source
check-tokens: OK
```

- 25/25 var yang dirujuk theme di-emit untuk light **dan** dark.
- 0 orphan.
- Key `ModeTokens` light == dark (14 key), semua punya CSS var dengan nilai identik ke sumbernya.
- 4 semantic × {fill, text, soft} lengkap di dua mode.
- Semua nilai valid (`#RRGGBB` / `rgba()`).
- `global.css` bersih dari deklarasi `--color-*`.
- `tailwind.config.js` bersih dari warna literal.
- 5 literal `--color-*` di source (semua di `subscription-plan-card.tsx`, scope
  invert yang disengaja dan terdokumentasi) merujuk var yang valid.

**Tidak ada perubahan nilai token** — item ini murni menambah guard.

## Yang ditambahkan

- `scripts/check-tokens.mjs` — 7 pemeriksaan (lihat header file). Memuat
  `lib/tokens.ts` langsung via Node type-stripping (butuh Node ≥ 22.6; repo
  berjalan di Node 24). Keluar 1 jika ada FAIL, 2 jika Node terlalu tua.
- `package.json` → `"check:tokens"`.
- Uji mutasi: menghapus satu baris `--color-info-soft` dari `toCssVariables`
  menghasilkan 3 FAIL (referenced-not-emitted light/dark + semantic tanpa var).

## Keputusan yang perlu dikonfirmasi tim

1. **`gen:tokens` tidak dibuat.** Backlog menyarankan men-generate
   `tailwind.config.js` dan `global.css` dari `tokens.ts`. Keduanya sudah
   *runtime-derived* (bukan salinan), sehingga generator hanya akan
   menghasilkan file yang identik dengan yang ada. Tidak ada nilai tambah.
2. **CI.** Repo belum punya `.github/workflows`. Skrip siap dipasang
   (`pnpm typecheck && pnpm check:tokens`); pembuatan workflow diserahkan ke
   tim karena menyentuh kebijakan CI yang belum ada.
3. **Cakupan non-warna.** `spacing`, `borderRadius`, `fontSize`, `zIndex`
   di-generate langsung dari objek token lewat `Object.entries`, jadi tidak
   bisa drift — skrip sengaja tidak memeriksanya.

## Catatan untuk item lain

- Peringatan Node `MODULE_TYPELESS_PACKAGE_JSON` dibisukan lewat flag di
  `package.json`, bukan dengan `"type": "module"` — mengubah tipe modul
  package berdampak ke Metro/Expo config yang masih CommonJS.
- #13 (dark mode) bisa memakai `toCssVariables("dark")` dari skrip ini
  sebagai basis: cek pasangan `.dark` sudah otomatis terpenuhi (set var
  light == dark diverifikasi), yang tersisa adalah uji visual + audit class
  `dark:`/`text-white`.
