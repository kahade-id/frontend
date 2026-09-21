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

---

# v2.3 — Lapisan interaksi: sentuh, pilih, dan header (2026-09-21)

v2.1/v2.2 menyelesaikan *warna dan optik*. v2.3 menyelesaikan **apa yang
terasa di jari**: umpan balik tekan, cara memilih banyak hal, dan hierarki
bar atas. Pemicunya satu putaran umpan balik pemilik produk pada lima layar
(daftar chat, detail chat, bottom navigation, top up, notifikasi, profil).
Struktur sistem tidak berubah — semua keputusan baru tetap satu sumber di
`lib/tokens.ts` dan satu primitif di `components/ui/pressable-scale.tsx`.

> v2.2 (retint monokrom palet brand: Pinus hijau → hitam `#000000`, surface
> `#F3F4F6`, ramp gray HEX) tidak punya bagian sendiri di dokumen ini;
> rationale lengkapnya hidup di komentar `lib/tokens.ts` §2.2–2.3b karena di
> sanalah angkanya dibaca orang.

## 1. Umpan balik sentuh: token `pressed` + prop `ripple`

Keputusan lama "scale 0.97 seragam, **tanpa ripple Android**" dibatalkan
sebagian — bukan karena salah, karena salah *kategori*. Scale cocok untuk
benda yang diangkat dan ditekan (Button, Chip, Card). Untuk **permukaan yang
disapu jari** — baris list chat/notifikasi dan item bottom navigation — scale
justru merusak: baris yang menekan mengecil, tepi daftar tampak "bernapas",
dan pada baris setinggi 72px perubahan 3% tidak terbaca sebagai konfirmasi.

Jadi `<PressableScale>` kini punya prop opt-in `ripple` (default OFF), dan
satu token baru mewadahi dua mekanisme:

| Platform | Mekanisme | Catatan |
| --- | --- | --- |
| Android | `android_ripple` native (Material) | digambar di *belakang* isi baris agar teks tetap tajam; otomatis terpotong radius kontainer |
| iOS / web | underlay `bg-pressed` — lapisan absolut seukuran kontainer yang menyala saat ditekan | pola `TouchableHighlight`; kontainer diberi `overflow-hidden` supaya lapisan mengikuti radius, bukan menonjol keluar |

`tokens.colors[mode].pressed` = `rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.12)`
dark. Alpha rendah disengaja: baris notifikasi belum-dibaca dan kartu terpilih
*sudah* berfill, sehingga underlay pekat akan menutupi informasi status. Ini
bukan warna teks/latar, jadi tidak diuji kontrasnya oleh `check-tokens` — ia
lapisan sementara di atas permukaan, dan dicatat demikian di token.

Batasan yang dijaga: `ripple` HANYA untuk baris list dan tab bar. Button,
IconButton, Chip, Card, dan kontrol form tetap scale/underlay — ripple di dalam
kartu beradius kecil terlihat berminyak. Menyalakannya di luar kategori itu
butuh keputusan produk baru (docblock `pressable-scale.tsx`).

## 2. Mode pilih sebagai satu-satunya jalan multi-select

Sebelum v2.3 ada dua pola bersaing: tekan lama → **ActionSheet** (chat) dan
tekan lama → **mode pilih** (notifikasi). Dua pola untuk gestur yang sama
membuat pengguna harus mengingat layar mana memakai yang mana, dan ActionSheet
menyembunyikan aksi di balik satu ketukan ekstra setiap kali.

Keputusan: **tekan lama selalu masuk mode pilih**, ActionSheet per-item
dihapus. Satu komponen baru, `<SelectionBar>`, menggantikan header selama mode
aktif: `X` di kiri, jumlah pilihan, lalu deretan aksi sebagai **ikon
berlabel** di baris kedua yang bisa digulir horizontal.

- Ikon + label caption 12px, bukan ikon saja: enam aksi (reaksi, pin, salin,
  teruskan, edit, hapus) tidak bisa dibedakan dari siluetnya dalam sekali
  lihat. Lebar 360dp memuat ±5 ubin sebelum menggulir, jadi jumlah aksi tidak
  lagi dibatasi layar.
- Tinggi bar ±104px (judul `h-12` + aksi ±52px) dibayar hanya selama mode
  aktif; kembali ke header biasa begitu `X` ditekan atau pilihan habis.
- Aksi destruktif memakai ikon + label `danger` — satu-satunya tempat ikon ikut
  merah selain menu, mengikuti §7.
- Haptic "light" di pressIn saat masuk mode dan saat tiap pilihan bertambah:
  tanpa getaran, pergantian header terasa seperti glitch.
- API chat tidak punya batch archive/delete → loop `Promise.allSettled` dengan
  `SELECTION_MAX = 50` (batas yang sama dengan WhatsApp untuk "teruskan").

Dipakai di: `app/notifications.tsx`, `app/chat.tsx`, `app/chat/[roomId].tsx`.
Hapus satu item kini = pilih satu item + tekan Hapus; tidak ada jalur khusus.

## 3. Daftar chat: dua baris, tanpa chevron

Anatomi baris disamakan dengan WhatsApp karena itu model mental yang sudah
dibayar pengguna:

```
[avatar 48] Nama lawan bicara            KHD-2391
            Pesan terakhir dipangkas…       14.32
```

- **Dua baris saja.** Baris 1 = nama (kiri) + order id (kanan); baris 2 =
  pesan terakhir (kiri) + waktu (kanan). Dulu order id + preview + waktu
  bersaing di tiga baris, sehingga tiap baris lebih tinggi dari yang perlu dan
  jumlah percakapan yang terlihat dalam satu layar berkurang.
- Order id tampil **tanpa kata "Pesanan"** (`KHD-2391`, bukan "Pesanan
  KHD-2391"): di layar Chat kata itu redundan, dan ±60px yang dilepasnya
  dikembalikan ke nama. Nomor dipotong **di tengah**
  (`truncateMiddle(orderId, 6, 4)`) supaya kepala dan ekornya tetap terbaca —
  ekor nomor adalah bagian yang membedakan dua pesanan berurutan. Dirender
  mono `caption` `text-secondary`, `max-w-[38%] shrink-0` agar tidak pernah
  mendorong nama.
- **TANPA pemisah antar baris dan tanpa garis di baris pertama.** Garis yang
  menempel di bawah header terbaca sebagai garis bawah header (bukan pemisah
  baris), dan begitu baris pertama dibereskan, sisa garisnya hanya menambah
  tinta di daftar yang sudah punya tiga kolom informasi. Irama dibentuk spasi
  (`py-2.5`) + hierarki tipografi; `gap={0}` di layar. Prop `divider` /
  `dividerTop` tetap tersedia (inset-nya dihitung dari anatomi baris:
  `px-4` 16 + avatar 48 + gap 12) untuk pemakai yang butuh bingkai, mis. di
  bawah kartu ringkasan.
- `CaretRight` dihapus: seluruh baris adalah target ketuk dan daftar chat pola
  yang sudah dipahami; chevron hanya menambah tinta dan menyempitkan preview.
- `ripple` ON (default di komponen), `scaleOnPress` OFF.
- Hierarki berat/warna menggantikan garis:
  - Avatar **48px** — di antara md 40 dan lg 56, titik tempat wajah tetap
    terbaca tanpa membuat baris lebih tinggi dari 68px. **Turun ke 40px di
    layar < 360dp** (`useWindowDimensions`) agar nama tidak terpotong; ini
    satu-satunya breakpoint lebar di baris ini.
  - Nama `bodyLarge` 16 weight 500, naik **600 saat belum dibaca**.
  - Preview `body` 14 `text-secondary`; jadi `text-primary` + 500 saat
    unread/mengetik — pembeda pertama sebelum mata sampai ke badge. Prefix
    "Anda: " ditambahkan bila `lastMessage.fromSelf`; `typing` mengganti
    preview dengan "mengetik…".
  - Waktu `caption` 12 tabular, **ikut naik ke primary/500 saat unread** (pola
    WhatsApp: jam menebal bersama badge).
  - Unread = pill `bg-primary` teks inverse `caption` 600 tabular — bukan
    merah, karena §9.14 memakai merah untuk status bahaya, dan jumlah pesan
    bukan bahaya.
  - Mode pilih: lencana `Check` menumpuk avatar (menggantikan dot online) dan
    baris terpilih diberi `bg-surface`.

## 4. Detail chat: header ruang, pin yang tidak menggeser thread

**Header** (`<ChatRoomHeader>`) tidak memakai `<Header>` standar karena
judulnya bukan satu baris teks — identitas lawan bicara adalah blok dua baris
yang harus duduk di samping foto profil, dan seluruh blok itu satu target
ketuk:

```
[←] [avatar] Nama lengkap                      [⋮]
           ● Online · KHD-2391
```

- Avatar 36px + `Dot` online: wajah adalah penanda percakapan tercepat.
- Status (online / terakhir dilihat / mengetik) lalu **titik tengah** lalu
  order id. Order id tidak dipisah baris — ia metadata, dan titik tengah cukup
  memisahkannya tanpa menambah tinggi header. Tinggi bar tetap `min-h-14`
  (56px) agar perpindahan layar stack tidak menggeser konten.
- Blok identitas pressable → profil publik lawan bicara; order id punya
  `Pressable` **sendiri** → detail pesanan. Dua tujuan tidak boleh berbagi satu
  target ketuk.
- `⋮` membuka `<ChatRoomMenu>` (lihat pesanan, cari pesan, bisukan, arsip, …)
  supaya baris header tetap bersih.
- Multi-select pesan lewat `<SelectionBar>` (lihat §2), bukan ActionSheet.
- Kehadiran API hanya mengirim `{ isOnline, lastSeenAt }` — **tidak ada
  `isTyping`**. Prop `typing` di header tetap opsional dan belum dikabel;
  label "mengetik…" baru hidup begitu backend mengirim event-nya.

**Bug "pin membuat chat turun"**: baris pesan terpin dirender *di atas*
`FlatList`, jadi setiap perubahan tingginya menggeser seluruh thread — konten
melompat tepat saat pengguna sedang membaca. Perbaikannya struktural, bukan
kosmetik: `<ChatPinnedBar>` adalah **satu baris setinggi konstan** (bukan
deretan chip yang bisa digulir), tingginya diukur lewat `onLayout` dan
dilaporkan ke layar untuk dikompensasi pada inset scroll. Chip scroll juga
tidak terlihat bisa digulir, sehingga pin ke-2 praktis tidak pernah ditemukan;
satu baris dengan penghitung "2" lebih jujur. Ketuk = lompat ke pesan, tekan
lama = lepas pin.

Layar ini 1296 baris dan terus tumbuh, jadi dipecah tanpa mengubah perilaku:
`chat-room-header`, `chat-pinned-bar`, `chat-message-row`, `chat-day-separator`,
`chat-room-menu`, `chat-search-sheet`, `chat-edit-sheet`, `chat-forward-sheet`,
`scroll-to-end-button`, `selection-bar`. `app/chat/[roomId].tsx` sekarang 1194
baris dan plafon S9-nya dikunci di angka itu — god component hanya boleh
menyusut (G-11).

## 5. Bottom navigation: 4 tab + tombol (+) di tengah

- **Showcase keluar dari bar** (`HIDDEN_TAB_ROUTES`) dan tetap hidup sebagai
  halaman sendiri. Lima tab membuat label 12px berdesakan di 360dp; yang
  dikeluarkan adalah yang paling jarang *dinavigasi* (showcase dicapai lewat
  profil / pencarian, bukan dipindah-pindah seperti Beranda–Dompet).
- **Tombol (+) di tengah** mengumpulkan aksi *membuat sesuatu* — isi saldo
  dompet, buat transaksi, tambah etalase — ke satu `ActionSheet`. Aksi-aksi itu
  bukan tempat, jadi salah menempatkannya sebagai tab: tab menjawab "saya di
  mana", (+) menjawab "saya mau membuat apa".
- Slot tengah melepas lebar untuk 4 tab yang tersisa, jadi label tetap muat
  tanpa dipangkas.
- `ripple` ON, `scaleOnPress` OFF (item menempel satu sama lain dan menempel
  tepi layar). Sebagai ganti scale, ikon **aktif** membesar halus 1.15x via
  spring playful — transform tidak mereflow, jadi tidak menggeser layout;
  statis 1x saat reduced motion.

## 6. Keypad nominal: terpin, satu baris preset, kartu konteks di atasnya

Tiga keluhan pada `app/topup.tsx` berakar pada satu kesalahan struktur: seluruh
isi layar (termasuk keypad) ada di dalam `ScrollView` yang menyusut saat
keyboard/virtual-keypad muncul, sehingga di layar besar digit 0–9 dan delete
tertutup dan pengguna harus menggulir untuk mengetik angka.

Urutan baru, dari atas ke bawah — dan **tidak ada yang menggulir selain konten
di atas keypad**:

1. Preset nominal cepat: **satu baris penuh** — `flex-row flex-nowrap` dengan
   tiap chip `flex-1` (lebar berbagi rata, `gap-1.5`), bukan grid dua baris
   yang memakan tinggi dan bukan scroll horizontal yang menyembunyikan pilihan
   terakhir. Label memakai `formatRupiah(p, { compact: true })` ("Rp50 rb")
   supaya lima chip tetap muat di 360dp tanpa `numberOfLines` memakan angka.
2. `<AmountKeypad>` **terpin** di luar `ScrollView` (hanya blok nominal +
   metode pembayaran di atasnya yang menggulir). Kepadatan menyesuaikan diri:
   `compact = windowHeight < 760dp` (`COMPACT_BELOW_HEIGHT`) — tuts menyusut
   64px → 56px, tinggi area nominal `min-h-40` → `min-h-24`, dan gap antar
   baris rapat. 56px masih jauh di atas target sentuh minimum 44pt (audit #1),
   jadi yang dikorbankan adalah ruang kosong, bukan ketergunaan. iPhone SE
   (568dp), separuh layar Android, dan jendela web pendek otomatis padat.
3. Slot `slot` di antara preset dan tuts — prop baru yang membuat kartu
   konteks bisa duduk *tepat di atas keypad*: metode pembayaran (top up),
   catatan transfer + rekening tujuan (transfer / tarik dana). Alasannya
   urutan baca: keypad adalah alat, kartu konteks adalah *hasil* yang sedang
   dibentuk; menempelkan keduanya membuat korelasi "angka yang saya ketik →
   rekening yang menerima" terlihat tanpa menggulir. Deskripsi panjang pindah
   ke bawah CTA, bukan di antara nominal dan keypad.
4. Footer CTA tetap terlihat.

Pola yang sama dipakai `app/transfer.tsx` dan `app/withdraw.tsx`.

## 7. Field: border abu-abu saat diam, hitam saat fokus

- `borderControl` diturunkan **gray.600 `#525252` → gray.500 `#6B7280`**
  (4.83:1 vs background, 4.40:1 vs surface). `#525252` di atas putih terbaca
  hampir segelap `borderFocus` `#000000`, sehingga keadaan resting dan fokus
  nyaris tidak berbeda — hierarki state mati. gray.500 tetap jelas "abu-abu"
  sekaligus lolos ambang 3:1 yang dijaga `check-tokens`. gray.400 gagal ambang
  itu, jadi gray.500 adalah titik terbawah yang diizinkan. Dark mode tidak
  berubah: di sana resting memang harus terang (`#9CA3AF`) agar terlihat di
  atas `#000000`.
- **Bug "input jadi transparan saat fokus"** ternyata bukan masalah warna:
  `tailwind-merge` membuang kelas border-width karena `border-2` (fokus) dan
  `border` (resting) tidak dikenali sebagai satu grup, sehingga `border-2`
  menang lalu `border-0` dari state lain ikut menelan lebarnya. Perbaikannya di
  `lib/cn.ts`: classGroup `border-w` (dan `font-size`) didaftarkan eksplisit ke
  `extendTailwindMerge`, plus tes unit `tests/cn-merge.test.ts`.
  *Catatan proses:* komponen yang dirender react-native-web memakai class
  `css-view-*` hasil hash, jadi **tes tidak boleh meng-assert className di
  DOM** — assert di level `cn()` (unit) atau struktur, bukan gaya.
- `<PhoneInput>`: divider antara `+62` dan nomor memakai `h-6 self-center`.
  Tanpa `self-center` divider menempel ke atas (align-items default baris itu
  `flex-start`) dan terbaca sebagai bagian dari label negara.

## 8. Notifikasi: chip ikon, tanpa chevron dan tanpa ⋮

Anatomi baris baru (menggantikan ikon telanjang + `CaretRight` + `⋮`):

- **Chip ikon 32px** di kiri: ikon kategori di dalam lingkaran `bg-*-soft`
  (danger → `bg-danger-soft`), dan berubah menjadi **lingkaran primary + ikon
  `Check` putih** saat baris terpilih. Satu elemen yang sama bertugas sebagai
  penanda kategori *dan* checkbox, jadi tidak ada kolom ekstra.
- `CaretRight` dihapus (alasan sama dengan §3) dan `⋮` dihapus — tekan lama
  sudah memberi mode pilih (§2), dan `⋮` per-baris hanya mengulang aksi yang
  sama lewat jalur yang lebih lambat. Prop `action` ikut hilang dari komponen.
- `gap = 0` antar baris dengan **divider inset** (mulai dari tepi teks, bukan
  tepi layar) — irama vertikal yang sama dengan daftar chat.
- `ripple` ON; skeleton (`NotifSkeletonRow`) disamakan geometrinya dengan
  anatomi baru (chip 32px + tiga baris) supaya tidak ada lompatan saat data
  tiba.
- `NOTIFICATION_CATEGORY_ICON` tetap tinggal di `notification-list-item.tsx`
  karena layar detail notifikasi mengimpornya dari sana.

## 9. Profil: bar atas ghost, username satu kali, Bagikan turun

- Tombol back / `[+]` dan `⋮` jadi `variant="ghost"` — **tanpa kartu
  berborder**. Kartu membuat navigasi terbaca sebagai konten dan menambah dua
  kotak visual di atas sampul yang sudah ramai.
- Bar atas diganti `<Header transparent>` sehingga **`@username` duduk di
  tengah bar** dan hanya di situ. Baris identitas di bawah avatar kini **nama
  saja**: dulu nama + `@handle`, padahal handle sudah ada di bar — username
  tertulis dua kali dalam jarak 80px. Bila profil tanpa nama, handle naik jadi
  nama agar baris itu tidak kosong.
- Tombol **Bagikan pindah ke baris aksi**, sejajar ♡ Favorit dan 🔖 Tersimpan.
  Ia aksi *terhadap profil ini*, bukan navigasi, dan di bar atas ia bersaing
  dengan `⋮` (dua ikon berdampingan dengan makna yang beda tipis).
- Profil sendiri: `[Edit profil]` menempati posisi **kiri** baris aksi, lalu
  Bagikan di kanan — urutan aksinya jadi sama dengan profil orang lain (aksi
  utama paling kiri).
- Plafon S9 `app/user/[username].tsx` turun 1483 → 1481.

## 10. i18n & guardrail

- Katalog: **1667 string, terjemah EN 1667 (100%)**. Naik-turunnya tercatat:
  `ee99ddc` membuang "Tandai dibaca" yang sudah tak terpakai (1669 → 1668),
  `0945d13` melebur "Bagikan Profil" (kapital) jadi "Bagikan profil"
  (1668 → 1667) dan menghapus kunci EN yang usang.
  Nilai `value === key` diizinkan (kognat/merek) dan dihitung terpisah (29).
- **Jebakan generator** yang ditemukan dan dicatat di sini supaya tidak
  diulang: `scripts/gen-i18n-catalog.mjs` TIDAK mengumpulkan template
  literal/ternary yang duduk langsung di dalam kurung atribut JSX, pernyataan
  `const x = cond ? "a" : "b"`, **maupun nilai default parameter**
  (`label = "foo"` di signature fungsi). Tiga-tiganya harus dibungkus
  `translate()`, dipindah ke object literal dengan key `TEXT_PROP`, atau
  dibuat wajib lalu diisi literal di call site. `check-i18n` E-03 menolak
  template literal sebagai anak langsung `<Text>`/`<Heading>`.
- `check-a11y` aturan C: berkas `-(card|item|row).tsx` wajib punya
  `accessibilityLabel` / `<CardSummary>` / `summarize()`. Komponen yang murni
  komposisi wrapper didaftarkan di `NOT_A_CARD` — **jangan mengubah nama
  berkas** untuk menghindari guardrail.
- Plafon S9 sekarang: `app/user/[username].tsx` 1481, `app/chat/[roomId].tsx`
  1194.

## QA v2.3

- `npm run check` hijau penuh di tiap commit putaran ini: typecheck, eslint,
  `check:tokens`, `check:a11y` (344 berkas), `check:screens` (97 layar, 235
  komponen UI), `check:inventory`, `check:spec`, `check:api`, `check:weblinks`,
  `check:push`, `check:permissions`, `check:i18n`, `npm test` (232 tes) +
  `test:i18n-render` (34 tes, 4 berkas).
- Commit putaran ini: `47aaa81` (chat), `d6ae4e0` (bottom nav), `677cf72`
  (keypad), `ee99ddc` (notifikasi + phone-input), `0945d13` (profil).
- Belum terverifikasi di sandbox: render di perangkat fisik. Checklist QA
  manusia — (a) ripple Android vs underlay iOS pada baris chat/notifikasi dan
  tab bar, (b) warna `pressed` di atas baris berfill (belum dibaca / terpilih)
  di light & dark, (c) tinggi `<ChatPinnedBar>` saat pin 1 → 2 → lepas
  (thread tidak boleh bergeser), (d) mode pilih dengan 50 item (batas
  `SELECTION_MAX`), (e) keypad di layar ≥ 6.7" dan saat font scaling 200%,
  (f) border field resting/fokus/error di light & dark, (g) header profil
  dengan username sangat panjang (ellipsize, tetap center).
