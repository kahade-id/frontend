# Redesign Kahade Design System v2 — "Soft & Presisi"

Ring eksekusi `prompt-redesign-kahade-v2.md` (Fase 0–6). Satu sumber kebenaran
visual tetap `lib/tokens.ts`; file ini hanya peta keputusan agar pengembang
berikutnya tidak perlu membaca ulang seluruh diff.

## Keputusan warna (Fase 0 — dipilih user: Pinus + semua ya)

| Token | Light | Dark | Pakai untuk |
|---|---|---|---|
| `accent` (Pinus) | `#0C6B4E` / fill `#0A5C43` / soft `#E8F3ED` | `#3ECF8E` / on `#10241B` | HANYA trust & escrow: saldo ditahan, skor, badge sukses OTP/PIN, info escrow |
| `info` (Sungai) | `#1D5FB0` / fill `#174E92` / soft `#EBF2FA` | `#7FB3E8` / on `#131E2A` | Info berwarna (dulu netral): alert info, empty-state ikon |
| Netral Kertas | bg `#FAF9F7`… (lihat `tokens.ts`) | `#2E2A24` (bukan `#2A2620` — gagal kontras 1.24 vs 1.31) | Latar seluruh app |

Aturan yang dipertahankan: teks `tertiary` → `secondary` untuk varian kecil;
`accent` tidak pernah dipakai untuk CTA/uang umum; di kartu inverted semua teks
tetap `inverse` (accent/semantic tidak dijamin AA di atas bg-primary).

Peta accent final (permukaan trust, BUKAN status transaksi — status tetap
semantik: COMPLETED/RESOLVED/APPROVED/Terverifikasi tetap `success`):
skor trust (TrustScoreCard + profil), dana ditahan (hint Beranda,
WalletBalanceCard, DisputeCard), artefak escrow onboarding, sukses OTP/PIN,
thumb slider aktif. Ikon tab & system bubble chat tetap monokrom (terlalu
sering terlihat — accent harus langka agar bermakna).

## Elevasi (v2 §5.2)

Satu-satunya jalan memakai shadow: `elevationStyle(level, mode)` dari
`lib/elevation.ts` (nilai mentah di `tokens.shadow`). Level: `flat` (struktural,
border saja), `low` (kartu interaktif), `medium` (toast/FAB/popover), `high`
(sheet/modal). Jangan tulis `shadow*`/`elevation`/`boxShadow` manual.

## Motion (v2 § motion)

- Easing: `enter [0.33,1,0.68,1]` (soft-decelerate, reveal masuk), `exit
  [0.32,0,0.67,0]` (keluar cepat), `standard` (rutin). Durasi: fast 250 / base
  300 / slow 350 / moment 800 (`duration-moment` untuk count-up).
- Spring: `spring` utilitarian (20/200/1 — bottom-sheet & settle PTR & layout
  list) vs `springPlayful` (14/170/0.9 — FAB, ikon tab aktif, settle PTR).
- Primitif: `<FadeIn>`/`<Stagger>`/`<Crossfade>` (`components/ui/fade-in.tsx`).
  Variasikan durasi/jarak/step per konteks — JANGAN tempel FadeIn identik ke
  semua layar. `<Stagger>` hanya untuk ≤6 anak; JANGAN untuk item FlatList.
- Signature moments: OTP/PIN success, achievement celebrate, progress-ring
  mengisi, count-up `use-count-up.ts` (Amount/saldo), PTR logo, empty-state
  breath, skeleton→konten `<Crossfade>`, toast spring.
- Semua animasi WAJIB instan tanpa translate/scale saat `useReducedMotion()`.
  Di worklet Reanimated, cerminkan via shared value (pola `reducedSV` di
  slider/range-slider).
- Transisi antar screen (`lib/screen-transitions.ts`): push biasa
  `slide_from_right`, alur singkat modal-like `slide_from_bottom`
  (create-transaction, topup, transfer, withdraw, rate, search), pasangan
  list→detail `fade_from_bottom` (order, notifikasi, chat, sengketa, tiket,
  profil, invoice…). Daftar eksplisit — screen baru otomatis default push.

## Rollout layar (Fase 4)

- Komponen bersama mengangkat puluhan layar sekaligus: `<DataScreen>`
  (crossfade, 17 layar), `<PaginatedList>` (Layout animation saat
  tambah/hapus, semua list), `<StatCard>` (crossfade nilai + `hintTone`).
- Beranda (redesign 2026-09-10, referensi pola "beranda super app" di
  `docs/image/Screenshot_20260910-134637.jpg`, dipetakan ke produk Kahade):
  bar identitas (avatar + salam + badge tipe akun; Cari + Pesan — notifikasi
  sudah di tab bar) → `<HomeOverviewCard>` (saldo + aksi dompet, Aktif ·
  Selesai · Sengketa, notice kaki kartu; satu-satunya `elevation="medium"`)
  → `<PromoCarousel>` sorotan fitur (palet soft accent/info/warning, radius lg)
  → `<QuickActionGrid layout="row">` ikon bulat + "Buat transaksi" inverted →
  3 `<OrderCard>` aktif (`GET /v1/orders?status=ACTIVE&limit=3`).
- 5 tab: Beranda stagger section; Transaksi kontrol fade tanpa geser; Dompet
  kartu-saldo reveal hero; Notifikasi chip reveal; Pengaturan stagger rapat
  (jarak 4px, tombol Keluar statis).
- Auth: tiap form reveal satu kesatuan; welcome stagger; onboarding tak
  disentuh (carousel sudah punya motion).
- Layar legal (terms, privacy) crossfade via `LegalDocumentScreen` bersama;
  showcase publik & edit-profile juga crossfade (audit prompt — ketiganya
  punya swap loading→isi yang sebelumnya keras).
- Form utilitas statis TANPA pola loading (change-email/password/phone/pin,
  contact, two-factor, verify-email, biometric) SENGAJA tak disentuh —
  FadeIn identik di semua layar = monoton versi baru; yang tenang tetap
  tenang.
- Tooltip dapat elevasi low (bubble melayang di atas scrim).
- Chat bubble SENGAJA tanpa animasi per-item (auto-scroll + poll = jitter).
- Sapuan polish: easing ambient (splash, skeleton, empty-state breath) →
  kurva `standard` token; splash fade-out → kurva `exit`; denyut
  incoming-call → kurva `enter` + `duration.fast`. Nilai ambient custom
  (BREATH_HALF_MS, PULSE_MS) dipertahankan — bukan durasi standar.

## QA (Fase 5)

- `npm run check` hijau (typecheck, lint, check-tokens 31/31, a11y,
  screens, tests 82).
- Audit reduced-motion: semua file v2 dengan `Animated`/Reanimated ter-cover
  (`useReducedMotion` langsung atau via hook bersama `useOverlayPresence` /
  `useCountUp`).
- Web: `/`, `/welcome`, `/login`, `/transactions`, `/wallet`, `/terms`,
  `/privacy-policy`, `/edit-profile`, `/user/demo/showcase` → 200, bundle
  tanpa error (hanya warning pre-existing expo-notifications di web +
  `Premature close` dari dev server).
- Manual di perangkat (di luar sandbox): iOS/Android + reduced-motion ON/OFF
  + dark mode per token baru — checklist untuk QA manusia sebelum rilis.

---

# v2.1 — Penyempurnaan optis (2026-09-17)

Revisi kecil-angka, besar-dampak. Struktur sistem tidak berubah: satu sumber
kebenaran tetap `lib/tokens.ts`, semua komponen mengonsumsinya lewat class
Tailwind / `elevationStyle()` / token runtime.

## 1. Netral: "Kertas" → "Porselen" (kenapa warna lama terasa coklat)

Diukur dari hex v2: netral lama duduk di hue 36–42° dengan chroma 20–33%
(`gray.50` #FAF8F5 = S 33%, `light.surface` #F7F5F1 = S 27%, `borderDefault`
#D9D3C5 = S 21%). Di atas background putih, chroma setinggi itu tidak lagi
terbaca "hangat" — ia terbaca **beige / kertas kraft**: kartu tampak kusam,
garis pembatas terlihat kotor, dan karena latarnya menguning, aksen Pinus
(#0C6B4E) ikut bergeser ke zaitun. Untuk aplikasi uang, latar yang menguning
membaca "kurang presisi".

v2.1 mempertahankan hue hangat (~40°) agar tidak jatuh ke abu kebiruan yang
dingin/klinis (kelemahan v1.1), tetapi chroma dipangkas ke **S 5–9%**:

| Token | v2 (Kertas) | v2.1 (Porselen) | Chroma |
|---|---|---|---|
| `gray.50` | `#FAF8F5` S 33% | `#FAFAF9` | S 9% |
| `light.surface` | `#F7F5F1` S 27% | `#F7F6F4` | S 16% |
| `light.borderDefault` | `#D9D3C5` S 21% | `#DCDAD5` | S 9% |
| `light.textPrimary` | `#1C1917` | `#1A1917` | — |
| `dark.background` | `#141210` S 11% | `#141412` | S 5% |
| `dark.surfaceElevated` | `#2E2A24` | `#2E2C28` | 1.32 vs bg |

**Tangga lightness sengaja tidak diubah**, karena rasio kontras WCAG hampir
seluruhnya fungsi lightness. Hasil verifikasi `npm run check:tokens`
(dihitung dari token terkirim, bukan dari asumsi):

- light: textPrimary 17.57 · textSecondary 9.26 · textTertiary 5.32 ·
  borderControl 5.32 (ambang 4.5 / 4.5 / 3 / 3)
- dark: textPrimary 16.77 · textSecondary 7.50 · borderControl 4.51 ·
  surfaceElevated 1.32 vs background (ambang 1.3)

Yang **tidak** diubah: semantic (`success/danger/warning/info`) dan `accent`
Pinus. Alasannya terukur, bukan selera: `success.text` di atas
`success.bgSoft` = **4.58:1** — hanya 0.08 di atas ambang AA. Setiap
penggelapan soft background atau hue shift langsung menjatuhkannya. Aksen
justru terlihat lebih bersih sekarang karena latarnya berhenti menguning.

## 2. Elevasi: shadow lebih difus + tinta netral

`shadow.color.light` #1C1917 → **#1B1A18** (mengikuti netral baru; shadow
coklat di atas kartu netral terlihat seperti noda). Blur dinaikkan dan opacity
light diturunkan tipis — low 8/0.06 → 10/0.055, medium 16/0.10 → 18/0.09,
high 32/0.16 → 36/0.15. Shadow kecil-pekat terbaca sebagai garis abu di
bawah kartu; blur lebar + alpha rendah meniru cahaya ruang. Offset TIDAK
diubah (offset = arah cahaya). `lib/elevation.ts` kini menurunkan triplet RGB
web dari `shadow.color` — sebelumnya `"28,25,23"` ditulis manual dan akan
diam-diam menyimpang.

## 3. Irama horizontal: screen padding 24 → 20px

Di ponsel 360dp (lebar Android paling umum) gutter 24px + card padding 20px
menyisakan kolom teks **272dp = 75,6%** lebar layar — hampir seperempat layar
hilang untuk margin, dan nominal + status + waktu jadi terdesak. 20px adalah
margin halaman standar iOS HIG; kolom kembali ke **280dp (77,8%)**. 16px
ditolak: di kartu finansial konten menempel tepi dan terasa sempit.

Ikut disesuaikan (bukan sekadar sed):

- `layout.screenPaddingX` = `space[5]`; semua gutter `px-6` → `px-5`
  (102 file), termasuk `Bleed`/`ScrollRow` (`-mx-6` → `-mx-5`), `Divider
  inset` (`mx-6` → `mx-5`) — margin negatif & inset harus sama persis dengan
  gutter atau konten full-bleed bocor/terpotong.
- `layout.maxContentWidth` 520 dipertahankan (kolom web tidak berubah).
- **Bug alignment diperbaiki**: `rowDividerInset` lama diturunkan dari anatomi
  yang sudah tidak dipakai (`avatar: 64` mengasumsikan Avatar sm 32 + gap-2,
  padahal semua pemakai memakai Avatar md 40 + gap-3). Divider di daftar chat
  & hasil pencarian mulai 12px di kiri teks. Nilai baru dihitung dari baris
  yang benar-benar dirender: `icon 72` · `avatar 72` · `listItem 56` ·
  `leading 52` (kunci baru: baris yang parent-nya sudah ber-gutter, supaya
  gutter tidak dihitung dua kali — dipakai `UserDiscoverResultItem` dan
  `UserListItem padded={false}`).

## 4. Tipografi: tracking optis untuk headline

Ukuran tidak diubah (tangga 12/13/14/16/18/22/28/34 tetap); yang ditambah
adalah letter-spacing negatif proporsional: `display` −0.5 · `h1` −0.4 ·
`h2` −0.3. Di ≥22px jarak antar-huruf bawaan font membuat headline terasa
"mengeja"; di ≤16px tracking negatif justru menurunkan keterbacaan, jadi
body/caption/label tetap 0. Mono tetap +0.5. Di Android RN 0.81 menerima
`letterSpacing` dalam dp lalu mengonversinya ke em
(`TextAttributeProps.getLetterSpacing()`), jadi −0.4 di H1 28px = −0.014em —
persis yang dimaksud, bukan −0.4em.

## QA v2.1

- `npm run check` hijau penuh: typecheck, lint, `check:tokens` (31 var
  light/dark + seluruh pasangan kontras dihitung dari token terkirim),
  `check:a11y` (326 file), `check:screens`, `check:inventory`, `check:spec`
  (288 path), `check:api`, `check:weblinks`, `check:push`, `npm test`
  (129 tes), `test:i18n-render` (4 tes).
- Web export (`npm run build:web`) berhasil; preview statis `npm run
  preview:web`.
- Belum bisa diverifikasi di sandbox ini: render di perangkat iOS/Android
  fisik (tidak ada emulator/browser di lingkungan CI ini). Checklist QA
  manusia: dark mode, reduced-motion, font scaling 200% pada H1/H2
  (letterSpacing ikut skala via SP), dan alignment divider di daftar
  chat/pencarian/perangkat.
