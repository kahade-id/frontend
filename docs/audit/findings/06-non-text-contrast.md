# Findings #6 — Kontras non-teks & warna semantik (WCAG 1.4.11 / 1.4.3)

Dikerjakan dalam dua PR: PR #36 (token `borderControl`, placeholder, 15
komponen input inti, guard `check:tokens` #10) dan PR lanjutan ini (sisa
kontrol yang masih memakai `border-border`, laporan, status backlog).

## Ringkasan

Akar masalah tunggal: sistem v1.1 hanya punya **satu** role border resting
(`border-default` = gray.400 `#CED4DA`, 1.49:1 vs putih) yang dipakai
sekaligus untuk kartu/divider **dan** outline form control. WCAG 1.4.11
mengecualikan pembatas dekoratif, tapi mewajibkan >= 3:1 untuk "visual
information required to identify UI components and states". Menaikkan
`border-default` ke 3:1 akan membuat semua kartu tampak "berbingkai tebal"
dan bertentangan dengan §6 (flat, hierarki lewat border halus). Jadi
keputusannya **memisahkan role**, bukan menaikkan nilai:

| Role | Light | Dark | Pemakaian |
|---|---|---|---|
| `border-default` | `#CED4DA` (1.49:1) | `#3A3A3A` (1.65:1) | kartu, divider, separator, pill/badge yang sudah berteks — **dekoratif, dikecualikan** |
| `border-control` (baru) | `#868E96` gray.600 (3.32:1 / 3.15:1 di surface) | `#6B6B6B` (3.52:1 / 3.27:1 di surface) | outline resting form control & indikator state non-teks |

`border-control` ditambahkan ke ketiga sumber sekaligus (tokens → Tailwind
`colors.border.control` → CSS var `--color-border-control`) dan dijaga
`check:tokens` #1/#3 seperti token lain.

## Pasangan yang diperiksa (mesin, `check:tokens` #10)

Semua nilai berikut dihitung dari `lib/tokens.ts` saat `pnpm check:tokens`;
mengubah satu hex hingga jatuh di bawah ambang → FAIL.

| Pasangan | Ambang | Light | Dark | Catatan |
|---|---|---|---|---|
| textPrimary / background, surface | 4.5 | ✓ | ✓ | |
| textSecondary / background, surface | 4.5 | ✓ | ✓ | juga placeholder Input (sebelumnya `textDisabled`, 2.07:1 — gagal) |
| textTertiary / background, surface | 3 | ✓ | ✓ | ikon & teks besar; teks kecil sudah di-remap ke secondary di `Text` (audit #0) |
| borderControl / background, surface | 3 | 3.32 / 3.15 | 3.52 / 3.27 | **baru** |
| borderFocus, borderError / background | 3 | ✓ | ✓ | |
| primary / background | 3 | ✓ | ✓ | Switch on, Radio selected, Checkbox checked |
| primaryForeground / primary | 4.5 | ✓ | ✓ | label Button primary |
| semantic.\*.text / bgSoft | 4.5 | ✓ | ✓ | label Badge/Alert soft (success/warning/info/danger) |
| semantic.\*.fill / surface | 3 | ✓ | ✓ | ikon/dot status |
| borderDefault / background | 1.3 (jaga) | 1.49 | 1.65 | dekoratif — dijaga agar tidak turun lagi |
| surfaceElevated / background (dark) | 1.3 (jaga) | — | 1.31 | dinaikkan `#212121` → `#2A2A2A` (dari findings #13, skeleton tak terlihat) |

`textDisabled` (`#ADB5BD`, 2.07:1) **sengaja tidak diuji ke 3:1/4.5:1** —
WCAG 1.4.3 & 1.4.11 mengecualikan komponen inactive/disabled. Yang
diperbaiki adalah pemakaian salahnya sebagai warna placeholder.

## Komponen yang dipindah ke `border-control`

**PR #36 (15):** `input`, `select`, `search-field`, `phone-input`,
`amount-input`, `tag-input`, `otp-input`, `chat-composer`, `checkbox`,
`radio`, `switch` (track off), `chip` (outline), `rating` (bintang kosong),
`signature-pad`, `upload-field`.

**PR ini (11):**

| File | Elemen | Alasan (kenapa bukan dekoratif) |
|---|---|---|
| `date-field` | trigger resting | field input, sejajar Select |
| `number-stepper` | kotak −/nilai/+ resting | kontrol angka |
| `checkbox-group` | kartu opsi varian `card` belum terpilih | kartunya sendiri Pressable/checkable |
| `toggle-group` | opsi belum terpilih | tombol tanpa fill; outline satu-satunya penanda |
| `segmented-control` | container | outline kontrol radiogroup |
| `pin-input` | dot kosong | state "digit tersisa" |
| `biometric-prompt-trigger` | dot PIN kosong | idem |
| `schedule-field` | radio hari belum terpilih | opsi form |
| `order-summary-strip` | tab belum terpilih | kontrol tab |
| `evidence-grid` | tile "Tambah" dashed | tombol tanpa fill |
| `slider`, `range-slider` | track (`bg-border` → `bg-border-control`) | sisa rentang = informasi non-teks |

Setiap perubahan diberi komentar `WCAG 1.4.11, audit #6` di dekat kode
(pola pengecualian terdokumentasi dari BACKLOG "Aturan umum").

## Tetap `border-default` (dekoratif, diputuskan sadar)

- **Kartu, list item, sheet, modal, toast, tooltip, accordion, header/footer,
  tab bar, divider** (±70 file) — struktural; konten di dalamnya yang
  membawa informasi.
- **`Button` secondary / `IconButton` secondary** (`bg-transparent border
  border-border`) — WCAG 1.4.11 Understanding: boundary tidak wajib 3:1 bila
  komponen sudah dikenali dari teks/ikonnya (label ≥ 4.5:1). Menaikkannya
  akan membuat secondary bersaing dengan primary — bertentangan dengan
  hierarki tombol §9.1. **Keputusan tim bila ingin lebih tegas:** pindah ke
  `border-control` hanya untuk IconButton secondary (ikon saja, tanpa teks).
- **Pill/count di `tabs` inaktif, tag pemilik di `evidence-grid`, tag
  `chat-attachment-item`** — berisi teks yang sudah kontras.
- **`copyable-field`, `captcha-field`** — read-only display, bukan kontrol
  input.
- **`bank-select` tile logo, `qr-code-display`** — border memisahkan tile
  putih dari background dark (11.37:1 di dark); di light tile = background,
  pemisah tidak diperlukan.

## Keputusan yang perlu konfirmasi tim

1. **Dampak visual:** semua form control resting kini gray.600 alih-alih
   gray.400 — terlihat "lebih tegas" dibanding mock v1.1. Ini konsekuensi
   langsung 1.4.11; alternatifnya (naikkan `border-default` global) ditolak
   di atas. Perlu update mock Figma/§6.1 spek: "4 role border" (default,
   control, focus, error).
2. **IconButton secondary** — lihat di atas.
3. Tidak ada `scripts/contrast.mjs` terpisah seperti disarankan BACKLOG;
   matriks digabung ke `check:tokens` #10 supaya satu perintah di CI.

## Uji visual

Sama seperti #8/#13: `app/` belum punya screen. Saat screen pertama ada,
cek khusus: Input/Select resting terlihat jelas di atas `bg-surface` (card)
maupun `bg-background`, dan border kartu tetap terasa "halus" bukan bingkai.
