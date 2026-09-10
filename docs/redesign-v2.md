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
- 5 tab: Beranda stagger section; Transaksi kontrol fade tanpa geser; Dompet
  kartu-saldo reveal hero; Notifikasi chip reveal; Pengaturan stagger rapat
  (jarak 4px, tombol Keluar statis).
- Auth: tiap form reveal satu kesatuan; welcome stagger; onboarding tak
  disentuh (carousel sudah punya motion).
- Layar statis tanpa pola loading (terms, privacy, dsb.) SENGAJA tak
  disentuh — FadeIn identik di semua layar = monoton versi baru.
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
- Web: `/`, `/welcome`, `/login`, `/transactions`, `/wallet` → 200, bundle
  tanpa error (hanya warning pre-existing expo-notifications di web).
- Manual di perangkat (di luar sandbox): iOS/Android + reduced-motion ON/OFF
  + dark mode per token baru — checklist untuk QA manusia sebelum rilis.
