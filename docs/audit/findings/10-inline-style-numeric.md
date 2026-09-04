# Audit #10 — Inline `style={}` numerik

**Status:** Selesai. Dijaga otomatis oleh `pnpm check:tokens` langkah #11.

## Ringkasan

Grep satu baris dari BACKLOG.md hanya menemukan **1** hit. Deteksi
multi-baris (objek `style` yang dipecah per baris + `StyleSheet.create`)
menemukan **1** hit tambahan. Total 2 literal dan keduanya diperbaiki.
Kondisi awal jauh lebih bersih dari yang diasumsikan backlog karena
komponen sudah lama memakai pola "konstanta bernama di atas file".

| File | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `search-overlay.tsx` | `{ position:"absolute", top:0, right:0, bottom:0, left:0 }` | `StyleSheet.absoluteFill` | Idiom RN, sama dengan `<Backdrop>`; bukan magic number tapi 4 literal berulang. |
| `slider.tsx` | `top: -32` | `LABEL_OFFSET_Y = -tokens.space[8]` | Label nilai melayang 32px di atas track — ada di skala. |

Sekalian dirapikan (bukan hit grep, tapi konstanta yang **persis** ada di
skala token dan ditulis literal):

| File | Sebelum | Sesudah |
|---|---|---|
| `slider.tsx`, `range-slider.tsx` | `THUMB = 24`, `TRACK_H = 4`, `LABEL_MIN_W = THUMB + 48` | `tokens.space[6]`, `tokens.space[1]`, `THUMB + tokens.space[12]` |

## Inventaris konstanta numerik yang SENGAJA dibiarkan literal

Kriteria lolos backlog: angka literal hanya untuk nilai runtime; statis →
Tailwind / token. Konstanta di bawah statis tetapi **tidak ada di skala 4px
atau bukan dimensi layout**, jadi memaksakannya ke aritmetika token
(`72 = space[16] + space[2]`) justru menyembunyikan maksud. Semuanya adalah
konstanta bernama dengan komentar §spek di file masing-masing — itulah bentuk
"terdokumentasi" yang diterima audit ini.

| Kategori | Contoh | Kenapa boleh |
|---|---|---|
| Ukuran gambar / aset | `logo.tsx` markPx 24/40/72, `animated-splash.tsx` LOGO_SIZE 72, `chat-attachment-item.tsx` TILE 72 | "Ukuran gambar" seperti `<Icon size>`; §16.5 menyebut logo bukan token spacing. |
| Geometri kontrol dari spek | `switch.tsx` 44×24 / thumb 18, `floating-action-button.tsx` SIZE 56, `order-summary-strip.tsx` BOX_W 132, `tooltip.tsx` MAX_WIDTH 260, `bar-chart.tsx` DEFAULT_HEIGHT 160 | Dimensi komponen yang ditetapkan §9.x; 18/44/56/132/260 tidak ada di skala. `TRACK_W 44` = `a11y.minHitTarget` secara kebetulan, bukan turunan. |
| Ambang gesture / animasi | `ACTIVE_OFFSET_X 4`, `FAIL_OFFSET_Y 8`, `CLOSE_VELOCITY 500`, `SNAP_RATIO 0.4`, `POP_SCALE 1.25` | Bukan layout; nilai tuning interaksi (rentang "runtime" menurut kriteria). |
| Domain / non-visual | `PIN_DEFAULT_LENGTH 6`, `ROWS 6` (kalender), `QUIET_ZONE 4` (modul QR, bukan px), `USERNAME_MAX 20`, durasi toast | Bukan dimensi. |

## Guard: `check-tokens.mjs` langkah #11

- Memindai **blok** `style={...}` dan `StyleSheet.create(...)` (kurung
  seimbang, multi-baris) di `components/` dan `app/`.
- Key layout (`width|height|min*/max*|padding*|margin*|border*Radius|gap|
  top|left|right|bottom|start|end|inset*|border*Width|translateX/Y`) dengan
  angka literal ≠ 0 → **FAIL**. Referensi variabel (`insets.top`,
  `THUMB`, `trackWidth.value`) otomatis lolos.
- `fontSize` / `lineHeight` / `letterSpacing` inline → **FAIL** kecuali file
  ada di `INLINE_TYPO_ALLOWLIST`. Saat ini hanya `logo.tsx` (§3.1: huruf
  placeholder dan wordmark diskalakan proporsional ke tinggi mark).
  Entri allowlist yang tidak lagi terpakai → warn.
- Diuji negatif: menyuntikkan `style={{\n width: 36,\n fontSize: 12 }}`
  menghasilkan 2 FAIL dengan nomor baris.

## Batasan yang disadari

- Guard tidak memeriksa **konstanta bernama** yang bernilai literal
  (`const X = 36` lalu `style={{ width: X }}`). Ini disengaja: inventaris di
  atas menunjukkan konstanta tersebut sah, dan aturannya adalah "beri nama +
  komentar", bukan "harus token". Kalau tim ingin lebih ketat, langkah
  berikutnya adalah lint konstanta UPPER_CASE numerik yang dipakai di `style`
  dan tidak di-derive dari `tokens.*`.
- Prop numerik komponen (`<Skeleton height={84}>`, `<Picture width={TILE}>`)
  bukan `style` dan tidak dipindai — itu API komponen, wilayah audit #11
  (konsistensi prop).

## Keputusan untuk tim

1. Apakah `switch.tsx` 44×24/18 dan `floating-action-button.tsx` 56 perlu
   diangkat menjadi token komponen (`tokens.control.switchTrackW`, …) supaya
   mock §9.5/§9.12 dan kode punya satu sumber? Saat ini spek dan kode sama
   tetapi tidak terhubung.
