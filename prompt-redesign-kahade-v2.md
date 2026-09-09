# Promt untuk Claude Code — Kahade Design System v2 (Soft & Presisi)

> **Cara pakai:** paste seluruh isi file ini sebagai pesan pertama ke Claude Code
> di dalam root folder repo `frontend-main` (Kahade). Ini adalah inisiatif besar
> (85 screen, 209 file komponen) — jangan dieksekusi sekaligus dalam satu balasan.
> Ikuti urutan Fase di bagian bawah, dan **berhenti di akhir Fase 0** untuk
> menunggu keputusan saya soal arah warna sebelum menyentuh apa pun yang lain.

---

## 1. Peran & konteks

Kamu bekerja di codebase **Kahade** — super app P2P escrow (Expo Router,
NativeWind, TypeScript, New Architecture aktif). Sebelum mengubah apa pun,
pahami dulu arsitektur yang sudah ada:

- **Satu sumber kebenaran**: `lib/tokens.ts` — semua warna, tipografi, spacing,
  radius, shadow, motion diekspor dari sini, lalu dikonsumsi lewat dua adapter:
  `toTailwindTheme()` (ke `tailwind.config.js`) dan `toCssVariables(mode)` (ke
  CSS variable yang disuntik `ThemeProvider` lewat `vars()` dari NativeWind).
  **Jangan bikin sumber kebenaran kedua** — semua nilai baru masuk lewat file
  ini, bukan warna/angka hardcode di komponen atau screen.
- `tailwind.config.js` sengaja **meng-override** (bukan extend) `screens`,
  `borderRadius`, `boxShadow` bawaan Tailwind supaya utility yang melanggar
  design system (`rounded-lg`, `shadow-md` generik, breakpoint `sm/lg/xl`)
  tidak pernah tersedia. Pola ini harus dipertahankan — kamu akan mengisi
  `boxShadow` dengan nilai sungguhan (lihat §5.2), bukan menghapus override-nya.
- Skala saat ini: **85 route screen** di `app/` dan **209 file** di
  `components/ui`. Sudah ada infrastruktur a11y matang yang **wajib
  dipertahankan**: `lib/use-reduced-motion.ts`, `lib/hit-slop.ts` +
  `a11y.minHitTarget`, `lib/haptics.ts`, `lib/focus-ring.ts`, dan script
  `npm run check:tokens` / `check:a11y` / `check:screens` / `check:inventory`.
- Ada `app/showcase.tsx` — screen showcase/style-guide komponen yang sudah ada.
  **Pakai ini sebagai kanvas preview** untuk mengusulkan arah v2, jangan bikin
  playground baru.

---

## 2. Kenapa redesign ini diperlukan (baca dulu sebelum mengusulkan apa pun)

Design System v1.1 di `lib/tokens.ts` menyatakan filosofinya secara eksplisit di
komentar header: *"Flat. Modern. Minimalis. Presisi. Tidak ada shadow di
seluruh sistem."* Warna dibatasi ke hitam/putih + skala abu netral (`info`
sengaja abu-abu, bukan biru, "menjaga sistem tetap monokrom"). Motion dibatasi
lewat prinsip *"satu titik kejutan per layar"* di komentar `fade-in.tsx`.

Setelah dipakai di build sungguhan, itu terasa **terlalu monoton** — dan ini
bukan asumsi, ini terverifikasi langsung dari kode:

- Dari 305 file `.tsx` di `app/` + `components/`, hanya **8 file** yang
  memakai `react-native-reanimated` — dan hampir semuanya karena *kebutuhan
  gesture* (bottom-sheet, slider, range-slider, signature-pad,
  swipeable-list-item), bukan untuk delight.
- **Nol** pemakaian `entering=` / `exiting=` / `LinearTransition` /
  `FadingTransition` di seluruh codebase — layout animation Reanimated sama
  sekali belum disentuh.
- Primitif `<FadeIn>`/`<Stagger>` yang sudah ada hanya di-import di **1 dari
  85 screen** (`onboarding.tsx`).
- Transisi antar screen 100% memakai satu preset default
  (`animation: "slide_from_right"` di `app/_layout.tsx`) — tidak ada
  pembedaan push biasa vs modal vs continuity list→detail.
- `PressableScale` (feedback tekan) dipakai **57 kali** — jadi feedback tekan
  dasar sudah konsisten, tapi itu-lah **satu-satunya** bahasa gerak yang
  benar-benar tersebar luas di seluruh app.
- `shadow` di tokens hanya berisi `shadow.none` (diekspor eksplisit "untuk
  mencegah pemakaian tidak sengaja") — literally nol depth di seluruh UI.

Kesimpulan: ini bukan bug, ini konsekuensi wajar dari prinsip v1.1 yang
sekarang dirasa terlalu menahan diri. Tugasmu **bukan** membuang kerja yang
sudah ada — arsitektur token, rigor aksesibilitas (rasio kontras AA
terdokumentasi sampai 2 desimal, hit target 44/48pt), dan performa gesture
yang sudah diperbaiki (Slider, Range Slider, Bottom Sheet, Pull-to-Refresh,
Picture) itu semua level kerja yang bagus dan harus tetap. Yang berubah adalah
**nilai** di dalam sistem itu: dari monokrom-flat-menahan-diri menjadi
soft-berwarna-hidup, dengan disiplin yang sama presisinya.

---

## 3. Prinsip Design System v2

**Dipertahankan:** Modern. Minimalis. Presisi. — termasuk tipografi 3-keluarga
yang sudah tepat (Sofia Sans UI, EB Garamond untuk momen display terbatas,
JetBrains Mono untuk nominal/OTP/ID — jangan diutak-atik kecuali ada alasan
kuat), dan disiplin "tidak ada angka sembarang" (semua token yang derived,
seperti `layout.rowDividerInset`, harus tetap didokumentasikan alasannya,
bukan ditebak).

**Dievolusikan:**
| Dari (v1.1) | Menjadi (v2) |
|---|---|
| Flat, nol shadow | Depth lembut, bertingkat sesuai hierarki |
| Monokrom + semantic seadanya | Palet soft yang hangat + 1 accent warna yang matang |
| "Satu titik kejutan per layar" | Motion lebih kaya, tapi tetap disengaja per konteks — lihat §5.4 |
| Radius maksimum 8px | Boleh dipertimbangkan ulang jika arah "soft" memerlukan, tapi tetap diusulkan dulu (lihat §5.3) |

**Elegan/eksklusif = disiplin, bukan ramai.** Setiap warna dan setiap gerakan
baru harus punya alasan. Kalau semua elemen didekorasi sama kerasnya, tidak
ada yang terasa istimewa lagi — sisakan satu-dua momen yang benar-benar
"berbicara" per alur, sisanya tetap tenang dan cepat.

**Hindari klise "hasil AI" yang justru bikin terasa generik**, bukan
eksklusif:
- Krem hangat + aksen terracotta (~`#D97757`) — ini kombinasi paling sering
  muncul dari asisten AI, langsung terbaca sebagai default, bukan pilihan.
- Semua card dapat radius yang sama + shadow abu-abu tipis yang sama +
  gradient dekoratif "kit SaaS" — shadow harus bertingkat sesuai hierarki
  (lihat §5.2), bukan satu nilai yang ditempel ke semua card.
- Label ALL CAPS, eyebrow di atas setiap heading, tombol yang selalu diakhiri
  "→" — sistem ini sudah benar menghindari ALL CAPS untuk label
  (`fontWeight 600` + ukuran kecil, bukan uppercase), pertahankan itu.

Lintas platform (Android/iOS/Web via Expo + react-native-web + Metro static
export) harus terasa satu keluarga visual, tapi tetap idiomatis: ripple Android
vs highlight iOS, cara shadow di-render beda total di tiga platform ini (lihat
§5.2), haptics (`expo-haptics`, lewat `lib/haptics.ts`) hanya native, dsb.

---

## 4. Yang WAJIB dipertahankan — jangan dirusak demi visual

1. **Zero perubahan logika bisnis/pemanggilan API.** ini murni lapisan visual +
   motion.
2. Arsitektur `tokens.ts → toTailwindTheme()/toCssVariables()` — extend, jangan
   bikin sistem token paralel.
3. Semua kerja aksesibilitas: kontras AA (dan dokumentasikan rasio kontras
   pasangan warna baru dengan gaya komentar yang sama seperti §2.3–2.4 di
   `lib/tokens.ts`), hit target 44pt/48dp, dan **setiap** animasi baru wajib
   punya fallback instan lewat `useReducedMotion()`/`motionDuration()` dari
   `lib/use-reduced-motion.ts` — tidak ada pengecualian.
4. Kerja performa yang sudah selesai di komponen gesture-berat (Slider, Range
   Slider, Bottom Sheet, Pull-to-Refresh, Picture) — **tingkatkan expressiveness
   motion-nya, jangan tulis ulang dari nol.**
5. Script `npm run check` (typecheck, lint, check:tokens, check:a11y,
   check:screens, check:inventory, dst) harus tetap lulus. Kalau ada assersi
   yang memang sengaja jadi usang karena redesign ini (misalnya larangan
   shadow di `check-tokens.mjs`, kalau memang ada), update assersinya secara
   sadar dan jelaskan kenapa — jangan dihapus diam-diam.
6. **Jangan tambah library animasi baru** (Moti, Lottie, Framer Motion, dsb).
   `react-native-reanimated ~4.1` + `react-native-worklets` +
   `react-native-gesture-handler ~2.28` sudah terpasang dan lebih dari cukup
   untuk semua yang diminta di sini.

---

## 5. Arahan konkret per aspek

### 5.1 Warna

- Hitam/putih (`brand.black/white`) boleh tetap jadi anchor primary
  action/teks — itu sudah accessible dan sudah jadi identitas. Yang berubah
  adalah **basis netral** dan **kehadiran accent color**.
- Ganti basis abu dingin (`gray.50 #F8F9FA` dst) dengan skala netral yang
  terasa lebih hangat/soft — tanpa kehilangan rasa "presisi/finansial".
- Tambahkan **satu** accent color yang matang untuk aksi/state penting,
  cocok untuk produk trust & escrow finansial Indonesia (bukan warna generik
  SaaS). **Usulkan 2–3 opsi konkret** (hex + rationale singkat kenapa cocok
  untuk konteks Kahade) di Fase 0, jangan langsung memutuskan sendiri satu
  warna final — ini keputusan yang paling sulit dibalik.
- Semantic (`success`/`danger`/`warning`) boleh sedikit lebih hidup dari versi
  desaturasi saat ini, tapi tetap AA-compliant di light **dan** dark mode.
  `info` saat ini sengaja abu-abu supaya sistem tetap monokrom — sekarang
  boleh dipertimbangkan warna sendiri, tapi ini juga diusulkan dulu, bukan
  diputuskan sepihak.
- Setiap pasangan warna baru wajib dihitung & didokumentasikan rasio
  kontrasnya (gaya komentar sama seperti yang sudah ada). Periksa apakah
  `scripts/check-tokens.mjs` sudah memvalidasi ini secara otomatis; kalau
  belum mencakup token baru, perluas scriptnya.

### 5.2 Depth & elevation

- Ganti `shadow` dari satu-satunya `shadow.none` menjadi skala bertingkat
  (mis. flat / low / medium / high) yang **soft** — pikirkan "terangkat
  lembut", bukan drop-shadow tebal ala skeuomorphic.
- Implementasi per platform wajib benar secara native, bukan cuma di web:
  iOS (`shadowColor/Offset/Opacity/Radius`), Android (`elevation` — catat:
  Android tidak bisa mewarnai shadow, selalu netral), Web (CSS `box-shadow`
  asli via NativeWind/react-native-web — ini paling gampang karena Metro
  static export web memang render CSS sungguhan). Definisikan lewat satu
  titik terpusat di adapter tokens, jangan tersebar `Platform.select` di
  tiap komponen.
- Jangan tempel level shadow yang sama ke semua card ("kit SaaS" generik).
  Putuskan per konteks: elemen struktural datar (list row, divider) tetap
  flat + border seperti sekarang; elemen yang secara fungsi "mengambang" di
  atas konten lain (Card interaktif, FloatingActionButton, handle Bottom
  Sheet, Modal, Toast) dapat level elevation sesuai urutan pentingnya.

### 5.3 Spacing

- Skala 4px "spacious" yang ada (`space[0..16]`) sudah presisi dan punya
  turunan terdokumentasi (`layout.rowDividerInset`) — tugas utama di sini
  adalah **validasi lintas platform**, bukan menulis ulang: cek perbedaan
  safe-area/StatusBar height, kuirk box-model NativeWind di web, dan
  pembulatan `PixelRatio` di Android yang sering bikin border 1px meleset.
- Kalau arah "lebih lega/soft" butuh 1–2 step baru di skala spacing, boleh
  ditambahkan — tapi harus derived & terdokumentasi seperti pola yang sudah
  ada, bukan angka bebas.

### 5.4 Motion — fokus utama redesign ini

- Perluas token `motion`: lebih dari satu easing sesuai tujuan (masuk yang
  soft-decelerate, keluar yang lebih cepat/accelerate, standar untuk
  transisi rutin), dan pertimbangkan konfigurasi spring kedua yang lebih
  "hidup/playful" — terpisah dari spring bottom-sheet yang sifatnya
  utilitarian (`damping 20/stiffness 200/mass 1`), untuk momen yang memang
  layak terasa lebih ekspresif.
- **Prioritaskan motion yang menjawab aksi user** (buka, expand, konfirmasi,
  selesai) — di sinilah "soft tapi hidup" paling terasa dan paling murah
  risikonya. Motion ambient/non-triggered (reveal saat load) tetap dipakai
  sengaja dan bervariasi per konteks — jangan tempel `<FadeIn>` yang identik
  ke semua 85 screen, itu sendiri akan jadi monoton versi baru. Variasikan
  durasi/jarak translate/stagger-step sesuai densitas konten tiap screen.
- Migrasi bertahap dari RN `Animated` (dipakai `fade-in.tsx`/
  `pressable-scale.tsx` saat ini) ke Reanimated 4 di tempat yang memang
  butuh: `entering`/`exiting` layout animation, shared-value untuk efek yang
  nempel ke scroll (header collapse, scale icon tab aktif), `Layout`
  animation untuk insert/remove item list.
- Longgarkan aturan "satu titik kejutan per layar": pakai `<FadeIn>`/
  `<Stagger>` (atau padanan Reanimated-nya) jauh lebih luas di screen yang
  isinya list — `transactions.tsx`, `notifications.tsx`, wallet-history,
  dsb — yang saat ini nol motion sama sekali.
- Desain ulang transisi antar screen di `app/_layout.tsx`: saat ini semua
  push memakai satu preset (`slide_from_right`). Bedakan minimal: push biasa
  vs alur modal-like (mis. `create-transaction`) vs pasangan list→detail yang
  butuh rasa kontinuitas (order list → `order/[id]`, notifications →
  `notification/[id]`, chat room list → `chat/[roomId]`).
- **Momen bertanda tangan** (signature moments) yang layak animasi khusus —
  diambil dari komponen yang sudah ada, bukan wishlist baru:
  - Sukses OTP/PIN (`otp-input`, `pin-input`) → transisi ke state berhasil.
  - Transaksi/escrow selesai, unlock `achievement-badge`.
  - `progress-ring` (trust score/KYC) animasi mengisi, bukan langsung penuh.
  - Angka di `wallet-balance-card`/`amount` count-up saat saldo berubah,
    bukan lompat langsung.
  - `pull-to-refresh` custom dengan logo brand (sudah theme-adaptive
    putih/hitam) — bukan spinner generik.
  - `empty-state` dengan gerak idle yang sangat halus, bukan ilustrasi statis.
  - `skeleton` → konten: crossfade, bukan swap keras.
  - `toast`/banner masuk-keluar yang sedikit lebih hidup dari fade polos.
- Semua di atas **wajib** lolos dengan `useReducedMotion()` aktif (instan,
  tanpa translate/scale) — cek manual satu per satu, jangan asumsi.

---

## 6. Rencana eksekusi bertahap (checkpoint wajib sebelum lanjut)

| Fase | Isi | Berhenti untuk approval? |
|---|---|---|
| **0. Audit + Proposal** | Baca ulang §2–§5. Usulkan 2–3 opsi palet (hex + rationale) dan arah shadow/motion secara konkret, terapkan **hanya** di `app/showcase.tsx` sebagai preview. Jangan sentuh screen/komponen lain. | **Ya — tunggu keputusan saya soal warna & arah sebelum lanjut.** |
| 1. Tokens | Update `lib/tokens.ts` (extend, bukan tulis ulang arsitektur), `tailwind.config.js`, CSS variables. | Tidak, lanjut otomatis setelah Fase 0 disetujui |
| 2. Primitif inti | Button, Card, Input, dll di `components/ui` konsumsi token baru. | Tidak |
| 3. Komponen gesture/kompleks | Bottom Sheet, Slider, Range Slider, Pull-to-Refresh, Picture — tambah motion tanpa regresi performa. | Tidak |
| 4. Rollout screen | Prioritas: 5 tab utama dulu (Beranda/Transaksi/Dompet/Notifikasi/Pengaturan — paling sering dilihat), lalu alur auth, lalu sisanya. | Laporkan progres per batch |
| 5. QA lintas platform | `npm run check`, cek manual iOS/Android/Web, reduced-motion ON/OFF, dark mode utk tiap token baru. | Laporkan temuan |
| 6. Polish & dokumentasi | Rapikan komentar rationale (gaya sama seperti existing), update `docs/` bila perlu. | — |

Untuk Fase 4 yang volumenya besar (85 screen), pertimbangkan buat rencana
kerja/checklist per screen dan kerjakan bertahap per batch (bisa didelegasikan
ke sub-task/sub-agent per batch) — bukan satu commit raksasa yang susah
di-review.

Di tiap akhir fase, laporkan singkat: file apa yang berubah, apa yang sengaja
belum disentuh, dan temuan mana yang butuh keputusan saya (bukan dieksekusi
sepihak) — terutama apa pun yang menyangkut pilihan warna final.
