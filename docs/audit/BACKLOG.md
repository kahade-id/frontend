# Audit Backlog — Aksesibilitas & Konsistensi Token

Dokumen ini adalah **brief kerja untuk agent/engineer** yang melanjutkan audit
`components/ui` (dan `app/`). Setiap item ditulis agar bisa dikerjakan mandiri:
lingkup, cara deteksi, kriteria lolos, dan aturan perbaikan.

Referensi spek: `kahade-design-system-v1.1.md` (disebut "§X.Y" di bawah).
Sumber token: `lib/tokens.ts` → `tailwind.config.js` → `global.css`.

## Status

| # | Area | Item | Status |
|---|------|------|--------|
| 0 | a11y + token | Kontras `tone="tertiary"` pada teks kecil; error form iOS; label `rightIcon` Input | **Selesai** (PR #27) |
| 1 | a11y | Hit target ≥ 44pt | Belum |
| 2 | a11y | Reduce Motion | Belum |
| 3 | a11y | Fokus & modalitas overlay | Belum |
| 4 | a11y | Grouping & urutan baca kartu | Belum |
| 5 | a11y | Kebenaran `accessibilityValue` | Belum |
| 6 | a11y | Kontras non-teks & warna semantik | Belum |
| 7 | a11y | Font scaling / Dynamic Type | Belum |
| 8 | a11y + token | Layar di `app/` | Belum |
| 9 | token | Komponen di luar `components/ui` | Belum |
| 10 | token | Inline `style={}` numerik | Belum |
| 11 | token | Konsistensi nama prop/varian antar komponen | Belum |
| 12 | token | Sinkronisasi `tokens.ts` ↔ `tailwind.config.js` ↔ `global.css` | Belum |
| 13 | token | Kelengkapan dark mode | Belum |

Prioritas yang disarankan: **2 → 3 → 1 → 12 → 8/9**, lalu sisanya.

## Aturan umum perbaikan

- Perbaiki di **primitif** bila mungkin (Text, Pressable wrapper, Icon), bukan
  di ratusan call site. Contoh preseden: `Text` me-resolve `tertiary` →
  `secondary` pada varian kecil; `Label` tidak punya opsi uppercase.
- Jangan tambah warna/spacing baru di luar `lib/tokens.ts`. Bila token tidak
  ada, tambahkan ke ketiga sumber sekaligus (lihat #12).
- Jalankan `pnpm exec tsc --noEmit` sebelum commit. Satu PR per item (atau
  per kelompok item kecil), judul `audit(#N): ...`.
- Bila menemukan pengecualian yang disengaja, **dokumentasikan di komentar
  dekat kode** dengan rujukan §spek (pola yang sudah dipakai untuk `text-white`
  di Button destructive dan `bg-white` tile logo bank §7).

---

## 1. Hit target ≥ 44pt

**Masalah.** Elemen interaktif kecil (chip close, stepper ±, page-indicator
dot, rating star, tab-bar item, ikon clear di input, checkbox 20px) mungkin
< 44×44pt meski sudah ada `hitSlop` di sebagian tempat.

**Deteksi.**
```bash
# Pressable tanpa hitSlop dan tanpa min-h/min-w
grep -rnE '<(Pressable|PressableScale)\b' components/ui/*.tsx | wc -l
grep -rlE 'hitSlop' components/ui/*.tsx | wc -l
# Kandidat: ikon interaktif kecil
grep -rnE 'size=\{?(12|14|16|18|20)\}?' components/ui/*.tsx | grep -iE 'press|button|onPress'
```
Periksa manual setiap komponen di daftar: `chip`, `stepper`, `page-indicator`,
`rating`, `bottom-tab-bar`, `input` (clear/toggle), `checkbox`, `radio`,
`switch`, `tag-input`, `otp-input`, `pin-pad`, `calendar` (sel tanggal),
`segmented-control`, `toggle-group`, `swipeable-list-item` (aksi), `toast`
(tombol tutup), `banner` (dismiss), `data-table` (sort header).

**Kriteria lolos.** Area sentuh efektif (ukuran visual + `hitSlop`) ≥ 44×44pt,
kecuali item dalam daftar padat yang sudah ≥ 44 tinggi (§ukuran min di spek).

**Perbaikan.** Tambah `hitSlop={tokens.space[N]}` (jangan angka literal) atau
`min-h-11 min-w-11`. Untuk ikon 20px di dalam tombol 44px, cukup pastikan
container-nya yang menerima `onPress`.

## 2. Reduce Motion

**Masalah.** Animasi (scale on press, shimmer skeleton, slide toast, spring
bottom-sheet, splash, confetti/celebration, progress animasi) tidak mengecek
preferensi "Kurangi Gerakan". Pengguna dengan vestibular disorder terkena
dampak. Saat ini **nol** pemakaian `isReduceMotionEnabled`/`useReducedMotion`
di `components/`, `lib/`, `app/`.

**Deteksi.**
```bash
grep -rlE 'react-native-reanimated|Animated\.|withSpring|withTiming|withRepeat|LayoutAnimation' components/ui/*.tsx
grep -rlE 'isReduceMotionEnabled|useReducedMotion' components lib app   # harus > 0 setelah fix
```

**Kriteria lolos.** Semua animasi non-esensial dinonaktifkan atau diganti
fade/instan saat Reduce Motion aktif. Animasi esensial (progress indikator
loading) boleh tetap tapi tanpa gerakan besar/berulang.

**Perbaikan.** Buat satu hook `lib/use-reduced-motion.ts` (Reanimated
`useReducedMotion()` bila tersedia, fallback `AccessibilityInfo`). Terapkan
di primitif animasi (`pressable-scale`, `skeleton`, `toast`, `bottom-sheet`,
`modal`, `animated-splash`, `celebration`/confetti, `progress`). Komponen
turunan otomatis ikut.

## 3. Fokus & modalitas overlay

**Masalah.** Saat overlay terbuka, screen reader harus (a) tidak bisa
menjangkau konten di belakangnya, (b) fokus pindah ke overlay, (c) fokus
kembali ke pemicu saat tutup. Saat ini `accessibilityViewIsModal` hanya ada
di 5 file: `bottom-sheet`, `incoming-call-prompt`, `loading-screen`, `modal`,
`search-overlay`.

**Deteksi.**
```bash
# Semua overlay
ls components/ui | grep -iE 'sheet|modal|dialog|overlay|popover|drawer|menu|dropdown|picker|prompt|tooltip'
grep -rlE 'accessibilityViewIsModal' components/ui/*.tsx
grep -rlE 'setAccessibilityFocus|focus\(\)' components/ui/*.tsx
```

**Kriteria lolos.** Setiap overlay yang memblokir interaksi: `accessibilityViewIsModal`
(iOS) + `importantForAccessibility="no-hide-descendants"` pada konten latar
(Android), fokus SR pindah ke judul/konten pertama saat buka, `Backdrop`
punya `accessibilityRole="button"` + label "Tutup" (sudah ada — verifikasi),
dan fokus kembali ke pemicu saat tutup. Popover/tooltip non-blocking: cukup
`accessibilityLiveRegion` atau announce.

**Perbaikan.** Pusatkan di `modal.tsx` / `bottom-sheet.tsx` / `dialog.tsx`;
pastikan `action-sheet`, `filter-sheet-content`, `date-picker`, `select`
(dropdown), `menu` menggunakan primitif itu, bukan `View` absolut sendiri.

## 4. Grouping & urutan baca kartu

**Masalah.** Kartu kompleks membaca 5–8 fragmen terpisah (judul, nominal,
tanggal, status, ID) alih-alih satu item. Pengguna SR harus swipe berulang
dan kehilangan konteks.

**Deteksi.**
```bash
# Kartu/list item tanpa `accessible` di root
for f in components/ui/*-card.tsx components/ui/*-item.tsx components/ui/*-row.tsx; do
  grep -qE 'accessible(=\{true\}|\s|>)|accessibilityLabel=' "$f" || echo "$f"
done
```

**Kriteria lolos.** Root kartu/list item non-interaktif punya `accessible`
+ `accessibilityLabel` ringkas yang merangkum konten dalam urutan logis
("Pesanan #123, Rp 1.500.000, Selesai, 3 Sep"). Kartu **interaktif** sudah
otomatis group via `Pressable` — pastikan label ringkasannya ada. Aksi
sekunder di dalam kartu (tombol "Bayar", ikon favorit) tetap fokusable
terpisah (jangan tertelan oleh group).

**Perbaikan.** Tambah helper `lib/a11y.ts` → `summarize(parts: (string|undefined)[])`
untuk merangkai label dengan koma dan membuang bagian kosong. Ikon murni
dekoratif di dalam kartu: `accessibilityElementsHidden` /
`importantForAccessibility="no"` (cek `icon.tsx` sudah default demikian).

## 5. Kebenaran `accessibilityValue`

**Masalah.** Kehadiran `accessibilityValue` sudah dihitung, **nilainya belum
diverifikasi**: `min/max/now` harus angka konsisten, `text` harus
manusiawi ("3 dari 5 bintang", bukan "3").

**Deteksi.**
```bash
grep -rnE -A3 'accessibilityValue' components/ui/{progress,slider,stepper,rating,otp-input,pin-input,page-indicator,upload-field,storage-meter,countdown}.tsx
grep -rnE 'accessibilityRole="(adjustable|progressbar)"' components/ui/*.tsx
```

**Kriteria lolos.** `adjustable` wajib punya `accessibilityActions`
`increment`/`decrement` + `onAccessibilityAction`; `progressbar` punya
`min:0,max:100,now` atau `text`. Nilai persen dibulatkan, mata uang
diformat via helper yang sama dengan tampilan (`formatCurrency`).

## 6. Kontras non-teks & warna semantik

**Masalah.** WCAG 1.4.11 mensyaratkan 3:1 untuk border input, fokus ring,
ikon status, indikator switch/checkbox terhadap latar sekitarnya. Juga
teks `success`/`warning`/`info` di atas surface tint (mis. `bg-success-subtle`)
belum dihitung.

**Deteksi.** Ambil nilai dari `lib/tokens.ts` (light & dark), hitung dengan
skrip:
```bash
node scripts/contrast.mjs   # buat: baca tokens.ts, cetak matriks fg×bg < 3:1 dan < 4.5:1
```
Pasangan wajib dicek: `border-default`/`bg-surface`, `border-focus`/`bg-surface`,
`text-warning`/`bg-warning-subtle`, `text-success`/`bg-success-subtle`,
`text-info`/`bg-info-subtle`, `text-disabled`/`bg-surface`, thumb & track
`switch` off-state, `placeholder`/`bg-input`.

**Kriteria lolos.** Teks ≥ 4.5:1 (kecil) / 3:1 (≥18px); komponen UI & ikon
informatif ≥ 3:1. Dekoratif dikecualikan dan diberi komentar.

**Perbaikan.** Ubah nilai token (bukan override lokal). Bila
`text-warning` di atas tint gagal, gelapkan `text-warning` atau terangkan
tint — lalu propagasi ke ketiga sumber (#12).

## 7. Font scaling / Dynamic Type

**Masalah.** Teks di container tinggi tetap (badge, count-badge, tab bar,
tombol `h-*`, chip, OTP box) terpotong atau overflow pada Dynamic Type
besar (iOS "Larger Accessibility Sizes", Android font 1.3×+).

**Deteksi.**
```bash
grep -rnE 'allowFontScaling|maxFontSizeMultiplier' components/ui/*.tsx
grep -rnE '\bh-(5|6|7|8|9|10|11|12)\b' components/ui/*.tsx | grep -vE 'Icon|Skeleton|Divider'
grep -rnE 'numberOfLines=\{1\}' components/ui/*.tsx | wc -l
```

**Kriteria lolos.** Tidak ada `allowFontScaling={false}` tanpa alasan
tertulis. Container teks memakai `min-h-*` bukan `h-*`. Teks dalam elemen
sempit (badge, tab label) memakai `maxFontSizeMultiplier={1.3}` (set di
primitif `Text` via prop varian, bukan per call site). Uji di simulator
dengan ukuran font terbesar: tidak ada teks terpotong atau tumpang tindih.

## 8. Layar di `app/`

**Masalah.** Audit sebelumnya hanya `components/ui`. Layar route di `app/`
bisa memakai class mentah, warna literal, `Text` RN langsung (bukan
primitif), dan `TouchableOpacity` tanpa role.

**Deteksi.** Jalankan ulang seluruh skrip audit #0 dengan path `app/`:
```bash
grep -rnE '#[0-9A-Fa-f]{3,8}\b' app --include=*.tsx
grep -rnoE '\b(bg|text|border)-(white|black|gray|slate|red|green|blue|yellow|orange)(-[0-9]+)?\b' app --include=*.tsx | sort | uniq -c
grep -rnE "from ['\"]react-native['\"]" app --include=*.tsx | grep -E '\bText\b|TouchableOpacity|TextInput'
grep -rnE '<(Pressable|TouchableOpacity)\b' app --include=*.tsx  # cek accessibilityRole
grep -rnE 'tone="tertiary"' app --include=*.tsx
```
Plus a11y layar: setiap screen punya satu `Heading` level 1 (`accessibilityRole="header"`),
`ScrollView` konten utama, `SafeArea`, dan tombol back berlabel.

**Kriteria lolos.** Sama dengan `components/ui`. `Text`/`TextInput`/`Pressable`
RN mentah dilarang di `app/` — pakai primitif.

## 9. Komponen di luar `components/ui`

**Masalah.** `components/*` (non-`ui`), `lib/`, provider, layout belum
dipindai.

**Deteksi.** Skrip #8 dengan path `components --exclude-dir=ui` dan `lib`.
Tambahan: `grep -rnE 'StyleSheet.create' components lib app` — objek style
statis sering menyimpan warna/spacing literal.

**Kriteria lolos.** Sama dengan #8.

## 10. Inline `style={}` numerik

**Masalah.** Audit #0 hanya memeriksa warna di inline style. Spacing,
radius, ukuran literal (`width: 36`, `borderRadius: 8`, `padding: 12`)
lolos.

**Deteksi.**
```bash
grep -rnE 'style=\{\{?[^}]*\b(width|height|padding[A-Za-z]*|margin[A-Za-z]*|borderRadius|gap|top|left|right|bottom|fontSize|lineHeight|borderWidth):\s*[0-9]+' components app --include=*.tsx
```

**Kriteria lolos.** Angka literal hanya untuk nilai yang dihitung runtime
(layout measure, animasi). Statis → class Tailwind atau `tokens.space[N]`,
`tokens.radius.*`. `fontSize`/`lineHeight` inline **dilarang** — pakai
varian `Text`.

## 11. Konsistensi nama prop/varian antar komponen

**Masalah.** Konsep yang sama bisa punya nama berbeda antar komponen:
`size="sm"` vs `size="small"`, `tone` vs `variant` vs `color` vs `intent`,
`disabled` vs `isDisabled`, `loading` vs `isLoading`, `onChange` vs
`onValueChange`, `label` vs `title`.

**Deteksi.**
```bash
grep -rhoE '\b(size|tone|variant|color|intent|status)\??:\s*"[^"]+"(\s*\|\s*"[^"]+")*' components/ui/*.tsx | sort | uniq -c | sort -rn
grep -rhoE '\b(is)?(disabled|loading|selected|checked|active|open|visible)\??:' components/ui/*.tsx | sort | uniq -c
grep -rhoE '\bon[A-Z][A-Za-z]+\??:' components/ui/*.tsx | sort | uniq -c | sort -rn | head -40
```

**Kriteria lolos.** Satu kosakata terdokumentasi di bagian baru spek
(§"Kontrak Prop"): `size: "sm"|"md"|"lg"`, `tone` untuk warna semantik,
`variant` untuk bentuk/gaya, boolean tanpa prefix `is`, handler
`onValueChange(value)` untuk kontrol nilai / `onPress` untuk aksi.
Penyimpangan diperbaiki dengan alias deprecated satu rilis, lalu dihapus.

## 12. Sinkronisasi tiga sumber token

**Masalah.** Nilai bisa ada di `lib/tokens.ts` tapi tidak di
`tailwind.config.js` (class tidak tergenerate → styling diam-diam hilang),
atau `global.css` punya CSS var yang tak dipakai / berbeda nilai.

**Deteksi.** Buat `scripts/check-tokens.mjs`:
1. Import `tokens.ts`, flatten jadi `{path: value}`.
2. Parse `tailwind.config.js` `theme.extend.{colors,spacing,borderRadius,fontSize,...}`.
3. Parse `global.css` `--*` di `:root` dan `.dark`.
4. Cetak: token di A tak ada di B/C, nilai berbeda, nama yang hanya di CSS.
Tambahkan ke `package.json` sebagai `"check:tokens"` dan ke CI.

**Kriteria lolos.** Skrip keluar 0. Idealnya `tailwind.config.js` dan
`global.css` **digenerate** dari `tokens.ts` (satu sumber kebenaran) —
jika dilakukan, tambahkan `"gen:tokens"` dan commit hasilnya.

## 13. Kelengkapan dark mode

**Masalah.** Token yang dipakai harus punya pasangan `.dark`; class literal
`text-white`/`bg-white` (pengecualian §7 & Button destructive) harus tetap
terbaca di dark; ilustrasi/logo di tile terang harus punya border di dark.

**Deteksi.**
```bash
# CSS var tanpa pasangan dark
diff <(grep -oE '^\s*--[a-z0-9-]+' global.css | sed -n '/:root/,/}/p' | sort -u) \
     <(grep -oE '^\s*--[a-z0-9-]+' global.css | sed -n '/\.dark/,/}/p' | sort -u)
grep -rnE 'text-white|bg-white|bg-black|text-black' components app --include=*.tsx
grep -rnE 'dark:' components/ui/*.tsx | wc -l   # seharusnya ~0: dark ditangani token, bukan class dark:
```

**Kriteria lolos.** Setiap var `:root` punya pasangan `.dark`. Tidak ada
`dark:` di komponen (kecuali terdokumentasi). Uji visual 5 layar utama
di dark mode: tidak ada teks hilang, border tak terlihat, atau tile putih
tanpa batas.

---

## Cara melaporkan

Setelah menyelesaikan item, update tabel Status di atas (nomor PR), dan
tulis ringkasan temuan di `docs/audit/findings/NN-<slug>.md`: jumlah
kasus, pola akar masalah, keputusan yang perlu dikonfirmasi tim (mis.
perubahan nilai token yang berdampak visual).
