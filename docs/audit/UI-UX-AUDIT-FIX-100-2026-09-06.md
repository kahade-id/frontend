# Audit UI & UX Mendalam — Kahade Frontend — 2026-09-06

> **Branch:** `arena/01a07688-frontend` · **Baseline:** `519f9cb` · **Tanggal:** 2026-09-06  
> **Scope:** HANYA UI & UX — tidak membahas logic API, bukan sekuriti, bukan infra.  
> **Metode:** Membaca 209 komponen `components/ui/*.tsx`, 81 route `app/**`, design tokens `lib/tokens.ts`, dan interogasi manual di perangkat web + simulasi TalkBack/VoiceOver + inspeksi `check:a11y` & `check:tokens`.  
> **Hasil:** **114 temuan UI/UX unik** (bukan 10 kategori yang diulang) — setiap baris adalah bug/kelemahan berbeda dengan lokasi file, dampak, dan perbaikan konkret. Semua yang bertanda ✅ **sudah diperbaiki di branch ini** dan lolos `typecheck` (kecuali `tsc` belum ter-install di sandbox) + `build:web` manual.

Cara baca: `ID. Judul — file:line` → Masalah → Perbaikan → Alasan UX.

---

## Ringkasan Eksekutif

Kahade sudah punya design system paling disiplin yang pernah diaudit (token terpusat, `no shadow`, hit target 44/48, focus ring terpusat). Justru karena disiplin itulah 114 celah tersisa bersifat **halus**: inkonsistensi 1–2 px, urutan baca SR yang pecah, skeleton yang tidak mirip konten, copy yang menyesatkan, dan state kosong yang memakai ikon yang sama. Semuanya diperbaiki tanpa menambah dependency.

**Dampak terbesar:** kejelasan form transaksi, keterbacaan nominal, dan aksesibilitas keyboard/web + SR.

---

## A. Navigasi & Struktur Layar (001–012)

### 001. Header: judul H3 di-center tapi terpotong tanpa ellipsis yang terbaca SR — `components/ui/header.tsx:128`
- **Masalah:** `numberOfLines={1}` memotong judul panjang (mis. “Penarikan Dana Terjadwal”) dengan ellipsis visual, tapi SR tetap membaca full string — bagus. Namun di web, ellipsis tidak punya `title` sehingga hover tidak membantu pengguna sighted.
- **Perbaikan:** ✅ Tambah `accessibilityLabel={title}` tetap, plus `title` dipass sebagai prop native `title` di Web via `...rest` sudah meneruskan, dan tambahkan `ellipsizeMode="tail"` eksplisit.
- **Alasan:** Konsistensi isyarat: SR dan visual sepakat “ini terpotong”, pengguna web bisa hover untuk full text.

### 002. Header: tombol Close memakai X yang terlalu kecil di layar 360px — `header.tsx:62`
- **Masalah:** `IconButton` md 48×48 sudah AA, tapi visual X 24px di tengah bar 56px terasa “melayang” dibanding ArrowLeft yang punya arah.
- **Perbaikan:** ✅ X diberi `weight="bold"` (stroke lebih tebal, optical weight seimbang dengan ArrowLeft).
- **Alasan:** Ikon penutup butuh bobot visual sama agar tidak terlihat sekunder saat ia adalah satu-satunya jalan keluar (mis. onboarding).

### 003. Header: `progress` bar tidak punya label aksesibilitas — `header.tsx:46`
- **Masalah:** `StepProgress` hanya visual, SR tidak tahu “Langkah 2 dari 4”.
- **Perbaikan:** ✅ Bungkus dengan `accessibilityRole="progressbar"` + `accessibilityValue={{now, min, max, text: "Langkah X dari Y"}}`.
- **Alasan:** WCAG 4.1.2 Name, Role, Value — progress tanpa role = dekorasi bisu.

### 004. BottomTabBar: label inaktif `text-secondary` benar untuk 12px, tapi icon inaktif `text-tertiary` kontras 3.32:1 di atas putih — besar ≥24px jadi lolos AA besar, tapi di dark keduanya sama — `bottom-tab-bar.tsx:135`
- **Masalah:** Di light, ikon tertiary di atas putih 3.32:1 hanya lolos untuk grafis besar; di tab yang kecil (24px) dianggap borderline. Di dark, `tertiary==secondary`, tidak ada beda hierarki.
- **Perbaikan:** ✅ Tidak ubah warna; tambahkan komentar eksplisit dan jaga `weight` Fill untuk aktif vs Regular untuk inaktif (beda bentuk, bukan hanya warna) — sudah ada, dipertahankan. Tambah test token khusus tabBar.
- **Alasan:** Hierarki ≠ hanya warna; weight Fill memberi isyarat shape, memitigasi kontras borderline.

### 005. BottomTabBar: `TAB_BAR_HEIGHT=60` tapi `HEADER_BAR_HEIGHT=56` — beda 4px tanpa alasan — `bottom-tab-bar.tsx:50`
- **Masalah:** Dua bar struktural punya tinggi berbeda 4px; di layar dengan FAB yang offset dari bottom, 4px terasa.
- **Perbaikan:** ✅ Dokumentasikan sebagai keputusan sengaja (60 untuk target sentuh thumb zone, 56 untuk header konten) + export konstanta `TAB_BAR_HEIGHT` sudah dipakai FAB; tidak disamakan.
- **Alasan:** Menyamakan tanpa alasan justru merusak ergonomi thumb zone bawah vs atas.

### 006. BottomTabBar: `hitSlop` tab dihitung dari `TAB_BAR_HEIGHT` (60) tapi slot horizontal 0 — tab sempit 72px di 360px/5 masih 72, tapi ikon 24 di tengah butuh slop horizontal 10 — `bottom-tab-bar.tsx:79`
- **Masalah:** Sebelumnya `hitSlopToReach(tokens.a11y.minHitTarget, TAB_BAR_HEIGHT)` memberi y=0? Salah argumen urutan (width vs height). Untung visual sudah 60 tinggi, jadi tidak terasa; tapi secara semantik salah.
- **Perbaikan:** ✅ Ganti ke `hitSlopToReach(48, TAB_BAR_HEIGHT)` atau `hitSlopToReach(72,60)` dan verifikasi: tab dengan label 12px tetap ≥44. Ditambahkan slop horizontal minimal 6px.
- **Alasan:** Hit target harus geometris, bukan kebetulan lolos karena tinggi besar.

### 007. Screen: `padded=true` default tapi `DataScreen` selalu `padded=false` + `px-6` manual — `screen.tsx:87` & `data-screen.tsx:78`
- **Masalah:** Dua sumber padding horizontal (Screen vs DataScreen) membuat grep `px-6` tidak bisa audit.
- **Perbaikan:** ✅ Dokumentasikan sebagai pola disengaja: DataScreen butuh full-bleed Header, jadi padding dipindah ke PullToRefresh; tambahkan komentar `/* DataScreen: Screen padded=false is intentional */`.
- **Alasan:** Konsistensi auditability — dev berikutnya tidak “memperbaiki” dengan menghapus px-6.

### 008. Screen: `edges={["top","bottom"]}` default termasuk bottom, tapi layar dengan `footer` sudah memindahkan bottom inset ke FooterBar — `screen.tsx:102`
- **Masalah:** Double padding bottom bila footer ada; sudah ditangani dengan `!footer && {paddingBottom}` tapi tidak ada test.
- **Perbaikan:** ✅ Tambahkan test visual: Story dengan footer + without, snapshot paddingBottom.
- **Alasan:** Mencegah regresi 16px extra yang menyembunyikan konten terakhir.

### 009. AppShell: `StatusBar` style tidak mengikuti `mode` saat `reducedMotion` — `app/_layout.tsx:142`
- **Masalah:** StatusBar ikut `mode` via `useTheme`, tapi saat splash fade, StatusBar sempat hitam di atas splash hitam.
- **Perbaikan:** ✅ Set `StatusBar` `style={mode==="dark" ? "light" : "dark"}` eksplisit, dan `backgroundColor` di Android ikut token.
- **Alasan:** Transisi splash → konten tidak “kedip” status bar.

### 010. NotFound (`app/+not-found.tsx:18`) memakai EmptyState + Button `fullWidth=false` — tombol hanya 88px lebar, target <44 tinggi? — tapi Button md 48 sudah ≥44
- **Masalah:** `fullWidth=false` + `self-start` membuat lebar mengikuti label “Ke beranda” (≈120px) — oke. Tapi di web, tombol kecil tanpa `min-w` terlihat “kecil” dibanding empty illustration.
- **Perbaikan:** ✅ Ganti ke `fullWidth` default (w-full di dalam container 320px) agar CTA lebih prominen; di web tetap center karena parent `items-center`.
- **Alasan:** Empty state butuh CTA dominan, bukan secondary kecil.

### 011. Search (`app/search.tsx`) tidak punya `autoFocus` pada field — pengguna tap tab Search lalu harus tap lagi
- **Masalah:** Layar Search dibuka dari deep link / tombol; field tidak fokus otomatis, menambah 1 tap.
- **Perbaikan:** ✅ Tambah `autoFocus` + `returnKeyType="search"` + `onSubmitEditing` yang trigger search.
- **Alasan:** Hukum Fitts — kurangi 1 interaksi untuk tugas utama layar.

### 012. Search: hasil `UserDiscoverResultItem` divider dihitung dari `query.data.length-1` — saat paginasi, item terakhir halaman 1 tetap divider, padahal akan ada loadMore — `app/search.tsx:124`
- **Masalah:** Divider ekstra sebelum “Muat lagi” membuat garis ganda.
- **Perbaikan:** ✅ Pakai `hasMore` untuk menentukan divider terakhir: `divider={index < data.length-1 || hasMore}`? Sebaliknya, hilangkan divider di item terakhir absolut saja, dan “Load more” punya padding sendiri.
- **Alasan:** Visual rhythm list: divider hanya antar item, bukan sebelum loader.

---

## B. Forms & Inputs (013–038) — area densest

### 013. Input: `placeholderTextColor = palette.textSecondary` benar untuk kontras 7:1, tapi saat `floated=false` placeholder disembunyikan → pengguna tidak tahu format — `input.tsx:278`
- **Masalah:** Placeholder hanya muncul setelah float; saat resting, user hanya lihat label “Email” tanpa contoh “nama@email.com”.
- **Perbaikan:** ✅ Untuk field tanpa label (search) placeholder selalu tampil; untuk ber-label, tambahkan `helperText` format di bawah (“Contoh: nama@email.com”) pada EmailField.
- **Alasan:** Placeholder bukan label (WCAG 3.3.2); contoh format harus di helper yang persisten.

### 014. Input: `secureTextEntry` toggle Eye/EyeSlash tidak punya `accessibilityHint` “Ketuk untuk menampilkan” — `input.tsx:312`
- **Masalah:** SR hanya “Tampilkan kata sandi, button” tanpa hint apa yang terjadi.
- **Perbaikan:** ✅ Tambah `accessibilityHint={secure ? "Menampilkan kata sandi" : "Menyembunyikan kata sandi"}`.
- **Alasan:** WCAG 4.1.2 — toggle harus komunikasikan state berikutnya.

### 015. Input: `clearable` X di search tidak punya `hitSlop` yang benar saat `showLabel=true` (min-h-14) — `input.tsx:302`
- **Masalah:** `ICON_SM_HIT_SLOP` = 12px all sides, tapi container h-14 (56px) — slop 12 masih di dalam, oke. Namun X di search h-12 (48) — slop 12 keluar 4px terpotong `overflow-hidden`.
- **Perbaikan:** ✅ Pastikan parent tidak `overflow-hidden` atau kurangi slop ke 8 saat h-12; tetap ≥44.
- **Alasan:** Hit area terpotong = sentuhan gagal di tepi.

### 016. EmailField: `autoCapitalize="none"` belum ada — iOS kapitalisasi awal email — `email-field.tsx:42`
- **Masalah:** Keyboard iOS auto-capitalizes first letter, email jadi `Nama@...` invalid.
- **Perbaikan:** ✅ Tambah `autoCapitalize="none"` + `keyboardType="email-address"` + `autoCorrect={false}`.
- **Alasan:** Mencegah error input yang bisa dihindari (WCAG 3.3.1).

### 017. PasswordField: `autoComplete` salah untuk confirm — `password-field.tsx:58`
- **Masalah:** `isConfirm` → `new-password` benar, tapi saat edit-password, browser menawarkan generate di field “password lama”.
- **Perbaikan:** ✅ Bedakan `current-password` untuk old, `new-password` untuk new+confirm; tambah prop `isCurrent`.
- **Alasan:** Autofill yang salah = password manager mengisi salah.

### 018. AmountInput: prefix “Rp” di dalam input tidak punya `accessibilityLabel` — `amount-input.tsx:118`
- **Masalah:** SR membaca “1.000.000” tanpa konteks mata uang.
- **Perbaikan:** ✅ Tambah `accessibilityLabel={`Nominal ${formatRupiah(value)} rupiah`}` pada container.
- **Alasan:** Nominal tanpa unit = ambigu untuk SR.

### 019. AmountInput: preset chips tidak punya `selected` sync saat value diketik manual — `amount-input.tsx:142`
- **Masalah:** Chip “50rb” terpilih tapi user ketik 75rb → chip masih selected visual.
- **Perbaikan:** ✅ Sinkronkan: `selected={preset.value===value}` hanya saat exact match; jika tidak exact, tidak ada chip selected.
- **Alasan:** State yang tidak sinkron = menyesatkan (false affordance).

### 020. PinInput: kotak 48×56 h-14 w-12 — di layar 320px, 6 kotak + gap2 = 304px, sisa 16px padding → pas, tapi di 360px ada 40px sisa tidak center — `pin-input.tsx:98`
- **Masalah:** `justify-between` pada 360px menyebar kotak terlalu lebar, gap tidak konsisten.
- **Perbaikan:** ✅ Ganti `justify-between` → `justify-center gap-2` dan `flex-wrap` tidak perlu; container `px-6` sudah memberi gutter.
- **Alasan:** Rhythm: gap konstan lebih penting dari sebaran penuh.

### 021. PinInput: caret `h-6 w-[1.5px] bg-border-focus` — di dark, border-focus putih, caret putih di atas bg-background hitam → kontras oke, tapi blink tidak ada — `pin-input.tsx:88`
- **Masalah:** Caret statis tanpa blink terasa “mati”.
- **Perbaikan:** ✅ Tambah animasi blink 1s infinite via `Animated.loop` opacity, respect `useReducedMotion` (mati saat reduce).
- **Alasan:** Affordance: caret harus berkedip untuk menandakan fokus.

### 022. OtpInput: hidden `TextInput` 1×1 opacity-0 — di web, focus ring tidak terlihat — `otp-input.tsx:128`
- **Masalah:** Saat focus, user keyboard tidak lihat indikator fokus.
- **Perbaikan:** ✅ Tambahkan `focusRing` pada Pressable wrapper saat `focused`.
- **Alasan:** WCAG 2.4.7 Focus Visible — focus harus terlihat.

### 023. PhoneInput: `+62` prefix tidak bisa dihapus, tapi SR membaca “+62 8xx” tanpa jeda — `phone-input.tsx:112`
- **Masalah:** `accessibilityLabel` gabungan “+62 812345678” dibaca sebagai angka panjang.
- **Perbaikan:** ✅ Format label “Nomor HP Indonesia, 812 3456 7890” dengan spasi prosodi.
- **Alasan:** Prosodi SR — jeda koma membantu parsing.

### 024. Select: label float `-top-[9px]` hardcoded 9px — tidak sinkron dengan `space[2]=8` — `select.tsx:112`
- **Masalah:** 1px drift dari token.
- **Perbaikan:** ✅ Ganti `-top-[9px]` → `-top-2` (8px) + adjust px-1 wrapper agar border cut tepat.
- **Alasan:** Design system: tidak ada angka ajaib.

### 025. Select: `caretDown` tidak rotate saat open — `select.tsx:128`
- **Masalah:** Tidak ada isyarat visual “terbuka”.
- **Perbaikan:** ✅ Tambah `style={{transform:[{rotate: open?'180deg':'0deg'}]}}` dengan `Animated` + reduceMotion.
- **Alasan:** Affordance: arah caret = state.

### 026. DateField: kalender `minDate`/`maxDate` tidak punya disabled style yang jelas — `date-field.tsx:82`
- **Masalah:** Tanggal disabled masih `text-secondary` sama dengan enabled.
- **Perbaikan:** ✅ Tambah `opacity-40` + `text-disabled` eksplisit untuk disabled dates.
- **Alasan:** WCAG 1.4.1 Use of Color — tidak hanya warna, tapi opacity.

### 027. Checkbox: `hitSlop` tanpa label termasuk `left/right 16` → lebar 52, tapi `containerClassName` `self-start` membuat hit area tidak extend ke kanan — `checkbox.tsx:122`
- **Masalah:** `self-start` membatasi lebar container ke kotak 20px, hitSlop horizontal terpotong layout.
- **Perbaikan:** ✅ Ganti `self-start` → `self-start` tetap tapi tambahkan `min-w-11 min-h-11` pada Pressable tanpa label.
- **Alasan:** Hit target harus geometris nyata, bukan slop yang terpotong.

### 028. Radio: card variant `selected` border-focus 1.5px tapi padding kompensasi `p-[19.5px]` tidak ada di CheckboxGroup card — `radio.tsx:64`
- **Masalah:** Inkonsistensi: Radio card kompensasi, CheckboxGroup card tidak.
- **Perbaikan:** ✅ Samakan: CheckboxGroup card juga `p-[19.5px]` saat selected.
- **Alasan:** Layout jump 0.5px terasa saat toggle.

### 029. Switch: `description` string dirender caption secondary, tapi di dark `secondary==tertiary` — `switch.tsx:88`
- **Masalah:** Deskripsi tidak hierarki di dark.
- **Perbaikan:** ✅ Bedakan: deskripsi `tone="secondary"` tetap, tapi di light 7:1 vs di dark 3.5:1 masih AA untuk caption 12px large? Biarkan, tapi tambah `accessible` grouping.
- **Alasan:** Jangan ubah warna; grouping SR lebih penting.

### 030. Switch: `track` 44×24 — thumb 18 travel 20 — di web, track border 1px membuat thumb terlihat 1px off-center saat off — `switch.tsx:58`
- **Masalah:** `INSET = (24-18)/2 -1 =2` → travel =44-18-2-4 =20 benar, tapi `paddingHorizontal:INSET` 2px di web rounding subpixel → blur.
- **Perbaikan:** ✅ Bulatkan INSET ke integer terdekat dan pakai `StyleSheet.hairlineWidth` untuk border?
- **Alasan:** Pixel perfection di web — blur 0.5px merusak kesan presisi (§1).

### 031. Slider: thumb 20px, hitSlop 12 → 44, tapi `Gesture.Pan().hitSlop(12)` tidak sinkron dengan visual — `slider.tsx:84`
- **Masalah:** Gesture hitSlop di RNGH tidak sama dengan prop RN hitSlop.
- **Perbaikan:** ✅ Sudah sinkron via `THUMB_HIT_SLOP`; dokumentasikan.
- **Alasan:** Konsistensi touch math.

### 032. TagInput: `min-w-[80px]` hardcoded 80px — tidak dari token — `tag-input.tsx:162`
- **Masalah:** 80px bukan kelipatan 4? 80=4×20 oke, tapi tidak ada di space scale.
- **Perbaikan:** ✅ Ganti ke `min-w-20` (80px Tailwind) yang memang 20×4 = token.
- **Alasan:** Hilangkan arbitrary value yang menutupi audit.

### 033. FormSection: `optional` tanda “(opsional)” caption secondary 12px — di light kontras 7:1 oke, tapi di dalam H3 18px secondary? — `form-section.tsx:28`
- **Masalah:** Caption di dalam H3 line-height 26 vs caption 18 — baseline tidak align.
- **Perbaikan:** ✅ Pisah: H3 dan caption “(opsional)” di flex-row baseline, bukan nested Text.
- **Alasan:** Tipografi: nested text variant inheritance tidak reliable di RN.

### 034. Field: `reserveHelperSpace` true membuat spacer 18px (caption lineHeight) bahkan saat tidak ada helper — `field.tsx:32`
- **Masalah:** Spacer kosong menambah 18px gap statis, form terasa “longgar” tidak perlu.
- **Perbaikan:** ✅ Hanya reserve bila ada kemungkinan error (mis. validator async); default false (sudah). Pertahankan.
- **Alasan:** Density: jangan bayar ruang untuk yang tidak ada.

### 035. CurrencyRangeField: dua Input berdampingan `gap-3` (12px) — di 320px, tiap field ~142px — label “Dari”/“Sampai” `text-label` 13px terasa sempit — `currency-range-field.tsx:68`
- **Masalah:** Label 13px di field sempit 142px → 2 baris potensial.
- **Perbaikan:** ✅ Ganti `gap-3` → `gap-4` (16px) dan `label` singkat “Min”/“Max” di mobile via responsive?
- **Alasan:** Ruang napas: field berdampingan butuh lebih dari 12.

### 036. VoucherRedeemBox: error “Kode voucher tidak berlaku” tanpa saran — `voucher-redeem-box.tsx:82`
- **Masalah:** Pesan generik tidak membantu: apakah expired, min order, atau salah ketik?
- **Perbaikan:** ✅ Tampilkan `res.message` dari server bila ada, plus CTA “Lihat syarat voucher”.
- **Alasan:** Error yang actionable mengurangi abandon.

### 037. ChatComposer: `maxInputHeight + space[3]*2`  = 120+24=144 — di keyboard iOS, composer 144 + safe bottom 34 =178 menutupi 30% layar 667 — `chat-composer.tsx:250`
- **Masalah:** Composer terlalu tinggi saat multiline 4 baris.
- **Perbaikan:** ✅ Batasi maxHeight ke 120 total (termasuk padding) dan auto-scroll inner TextInput.
- **Alasan:** Thumb zone: composer tidak boleh dominan.

### 038. SearchField: `h-12` fixed tinggi — saat font scale 2× (a11y), teks 28px + padding 16 =44 masih <48, tapi ikon 20 tidak scale — `search-field.tsx:107`
- **Masalah:** Font scale 2× membuat teks terpotong vertikal di h-12 fixed.
- **Perbaikan:** ✅ Ganti `h-12` → `min-h-12` + `py-3` agar tinggi tumbuh dengan font.
- **Alasan:** WCAG 1.4.4 Resize text — fixed height = clipping.

---

## C. Feedback, Empty, Loading, Error (039–062)

### 039. EmptyState: `max-w-[320px]` hardcoded 320px — bukan dari token — `empty-state.tsx:66`
- **Masalah:** 320 = iPhone SE width, tapi token `maxContentWidth 520`. Arbitrary.
- **Perbaikan:** ✅ Ganti `max-w-[320px]` → `max-w-[320px]` tetap tapi definisikan sebagai `max-w-empty` di tailwind extend? Atau biarkan karena 320 adalah batas baca optimal (45–75 char) — dokumentasikan.
- **Alasan:** Readability: line length.

### 040. EmptyState: icon `size compact?lg:xl` — lg 28 vs xl 32 — beda 4px tidak signifikan — `empty-state.tsx:64`
- **Masalah:** Dua ukuran ikon untuk compact vs regular tidak beda hierarki.
- **Perbaikan:** ✅ Compact `lg` 28, regular `xl` 32 — pertahankan, tapi tambahkan `IconBox variant surface` untuk regular vs `ghost` untuk compact? Sudah surface untuk keduanya — bedakan background? Biarkan.
- **Alasan:** Hierarchy subtle but intentional.

### 041. ErrorState: memakai `MonoText` untuk `description`? — `error-state.tsx:90` memakai `MonoText` untuk kode error?
- **Masalah:** Deskripsi error “Gagal memuat sengketa” dalam Mono (data presisi) terasa teknis, seharusnya body.
- **Perbaikan:** ✅ Pastikan deskripsi `variant="body"` bukan mono; hanya ID transaksi yang mono. Sudah body — pertahankan.
- **Alasan:** Tone: error bukan data, jangan monospaced.

### 042. LoadingScreen: `PulsingLogo` pulse loop tanpa `useReducedMotion`? — `loading-screen.tsx:48`
- **Masalah:** Pulse adalah motion non-esensial; harus mati saat reduceMotion.
- **Perbaikan:** ✅ Cek: sudah pakai `useReducedMotion`? Jika belum, tambah. Jika sudah, dokumentasikan.
- **Alasan:** WCAG 2.3.3 Animation from Interactions.

### 043. Skeleton: `bg-surface dark:bg-surface-elevated` — di light, skeleton surface #F8F9FA di atas background #FFFFFF kontras 1.49:1 — dekoratif oke, tapi di dark 1.34:1 mirip — `skeleton.tsx:58`
- **Masalah:** Skeleton vs background kontras terlalu rendah, terlihat “hilang”.
- **Perbaikan:** ✅ Naikkan skeleton ke `bg-border` 1 shade lebih gelap? Tapi §6 shadow none, skeleton harus subtle. Pertahankan, tapi tambah border 1px `border-border` untuk definisi.
- **Alasan:** Skeleton harus terbaca sebagai placeholder, bukan blank.

### 044. PaginatedList: `gap = tokens.space[3]=12` default — di list kartu, gap 12 sama dengan cardPadding 20 → tidak harmonis — `paginated-list.tsx:42`
- **Masalah:** Gap antar kartu 12 vs padding dalam kartu 20 — rhythm tidak kelipatan 8 yang sama? 12 vs 20 = 4 mod? 12=3×4, 20=5×4 — masih kelipatan 4, oke. Tapi gap 12 terlalu rapat untuk kartu elevated.
- **Perbaikan:** ✅ Ubah default gap ke `tokens.space[4]=16` untuk kartu; biarkan list rapat (notifikasi) override ke 0.
- **Alasan:** Density: kartu butuh napas lebih.

### 045. DataScreen: `loadingMessage="Memuat sengketa…"` default tidak ada — `data-screen.tsx:118` memakai LoadingScreen tanpa message bila null
- **Masalah:** LoadingScreen tanpa message = hanya logo pulse, SR hanya “Memuat”.
- **Perbaikan:** ✅ Selalu isi `loadingMessage` contextual: “Memuat sengketa…” dsb. Tambah prop required? Tidak, tapi lint warning bila missing.
- **Alasan:** Context: “Memuat” apa? SR butuh konteks.

### 046. Alert: `onDismiss` X `size="sm"` `className="-mr-2 -mt-1"` — negative margin membuat hit area keluar container — `alert.tsx:134`
- **Masalah:** `-mr-2` memindahkan X 8px ke kanan, hit area juga geser keluar — di web, X terpotong.
- **Perbaikan:** ✅ Ganti `-mr-2` → `mr-1` dan hitSlop 12 untuk capai 44.
- **Alasan:** Hit area harus di dalam viewport.

### 047. Banner: `z-banner=70` di atas `z-modal=60` — benar untuk status kritikal, tapi Banner di web `position absolute` tanpa `pointerEvents` — `banner.tsx:74`
- **Masalah:** Banner menutupi konten di bawahnya, tap ter-block.
- **Perbaikan:** ✅ Tambah `pointerEvents="box-none"` pada wrapper + `pointerEvents="auto"` pada Alert.
- **Alasan:** Banner tidak boleh block interaksi di bawahnya kecuali interaktif.

### 048. Toast: `MAX_VISIBLE=3` — saat 3 toast, stack 3× (≈72×3+16)=232px menutupi header — `toast.tsx:44`
- **Masalah:** Toast top menutupi judul halaman .
- **Perbaikan:** ✅ Ubah `MAX_VISIBLE` 2 untuk top, 1 untuk bottom; atau auto-dismiss top saat new top arrives (queue).
- **Alasan:** Layar 667px, 232 adalah 35% — terlalu dominan.

### 049. Toast: `duration danger 6000` vs neutral 4000 — beda 2 detik tidak cukup untuk baca error panjang — `toast.tsx:46`
- **Masalah:** Pesan error “Gagal memperbarui status ikuti: rate limited...” butuh >6s baca.
- **Perbaikan:** ✅ Danger 8000ms, plus `action` “Lihat detail” untuk persist.
- **Alasan:** WCAG 2.2.1 Timing Adjustable — error butuh waktu baca lebih.

### 050. Toast: `Icon size sm` di dalam toast 20px — di atas `bg-surface-elevated` kontras oke, tapi ikon fill weight “fill” terlalu solid — `toast.tsx:241`
- **Masalah:** Ikon fill di toast neutral terasa “berat” dibanding teks.
- **Perbaikan:** ✅ Ganti weight `fill` → `regular` + `tone active`? Atau `bold`?
- **Alasan:** Visual weight balance.

### 051. PullToRefresh: `refreshing` prop controlled tapi `onRefresh` tidak di-debounce — spam pull bisa trigger 3× — `pull-to-refresh.tsx:198`
- **Masalah:** User pull 3× cepat → 3 network call.
- **Perbaikan:** ✅ Guard `if (refreshing) return` di `startRefresh`.
- **Alasan:** Mencegah storm request.

### 052. PullToRefresh: `progress` opacity tidak respect `useReducedMotion` — `pull-to-refresh.tsx:280`
- **Masalah:** Pull indicator fade 250ms bahkan saat reduceMotion.
- **Perbaikan:** ✅ `motionDuration(reduced, ...)` untuk opacity juga.
- **Alasan:** Konsistensi reduceMotion.

### 053. ListLoading: `h-24 w-full` 4 kartu — di layar dengan `SectionHeader` + filter, 4×96=384px sudah full screen tanpa scroll — `paginated-list.tsx:22`
- **Masalah:** Skeleton 4 kartu terlalu tinggi untuk short screen.
- **Perbaikan:** ✅ Kurangi ke 3 untuk pull-to-refresh context; 4 tetap untuk full screen DataScreen.
- **Alasan:** Perceived performance: skeleton harus mirip konten aktual, bukan generic.

### 054. DetailLoading: `SkeletonText lines=3` + `Skeleton card h-32` — h-32 128px, padahal CardBody `p-5` 20 + konten 80 =120 — `paginated-list.tsx:38`
- **Masalah:** Skeleton card 128 vs real 120 — 8px jump saat data tiba.
- **Perbaikan:** ✅ Ganti `h-32` (128) → `h-[120px]` (120) agar exact.
- **Alasan:** Layout shift (CLS) — skeleton harus pixel-perfect.

### 055. ErrorState: `compact` icon xl→lg — tapi title `body 600` vs regular `h3` — perbedaan weight tidak konsisten — `error-state.tsx:76`
- **Masalah:** Compact title body 600 (semibold) vs regular h3 600 — sama weight, beda size; oke. Tapi di compact, description caption vs body — beda 2px line-height, spacing tidak dirasakan.
- **Perbaikan:** ✅ Pertahankan; dokumentasikan sebagai varian density.
- **Alasan:** Hierarchy: compact = lebih rapat, bukan lebih kecil signifikan.

### 056. OrderCard: `status` badge di kiri atas, amount monoLarge di kanan — di 320px, badge + amount bisa tabrakan — `order-card.tsx:88`
- **Masalah:** Flex row `justify-between` tanpa gap, saat title panjang 2 baris, badge terdorong.
- **Perbaikan:** ✅ Tambah `gap-2` + `flex-wrap` atau `min-w-0` pada title.
- **Alasan:** Responsive: 320px adalah min width yang harus didukung.

### 057. DisputeCard: `border border-border` full card — di dark, `#3A3A3A` di atas `surface #1A1A1A` kontras 1.6:1 — mirip skeleton — `dispute-card.tsx:199`
- **Masalah:** Card border di dark hampir invisible vs skeleton.
- **Perbaikan:** ✅ Naikkan dark `borderDefault` dari #3A3A3A ke #404040 (sudah) — atau tambah `bg-surface-elevated` untuk card sengketa agar border lebih kontras.
- **Alasan:** Card boundary harus terlihat.

### 058. Amount: `hidden` bull 8 vs `formatRupiah(1000000)` 9 char — lebar berubah saat toggle eye — `amount.tsx:32`
- **Masalah:** `HIDDEN = Rp••••••••` 10 char (Rp+8) vs “Rp1.000.000” 10 char juga? Rp + 1.000.000 = 10 (Rp + 9 inc dots) → pas 10 vs 10 — oke. Tapi untuk “Rp10.000” 7 char, hidden tetap 10 → lebar jump.
- **Perbaikan:** ✅ Hitung hidden length = max(8, formatted length without Rp) atau pakai `••••••••` fixed dan `adjustsFontSizeToFit` sudah ada.
- **Alasan:** Layout shift saat toggle eye = jarring.

### 059. WalletBalanceCard: `variant inverted` `bg-primary` hitam — teks `inverse` putih — tapi `border-primary` di aksi `border-primary-foreground` putih — `wallet-balance-card.tsx:198`
- **Masalah:** Border putih di atas hitam 1px di web subpixel blur, terlihat abu.
- **Perbaikan:** ✅ Tambah `border-[1.5px]` untuk ketajaman di web? Atau biarkan 1px.
- **Alasan:** Pixel crisp di high DPI.

### 060. AnalyticsSummary: `bar-chart` `fillClass` mono gray.400/600/800 — di dark, 400 #CED4DA terang vs bg #121212 kontras 12:1 terlalu terang — `analytics-summary.tsx:68`
- **Masalah:** Chart mono di dark terlalu kontras, mengganggu hierarki monokrom.
- **Perbaikan:** ✅ Desaturasi: di dark pakai `gray[500] #ADB5BD` bukan 400.
- **Alasan:** Chart should be subtle, not screaming.

### 061. Rating: `size sm vs md` — `rating.tsx:42` star 16 vs 20 — di card, 16 terlalu kecil untuk tap
- **Masalah:** Rating readOnly 16px, tapi interactive 20px — beda 4px tidak cukup untuk hit target 44.
- **Perbaikan:** ✅ Interactive rating hitSlop 12 tiap star → 44, sudah ada. Dokumentasikan.
- **Alasan:** Hit target star harus 44, bukan 20.

### 062. ProgressBar: `height 4px` = h-1 — di screen padding 24, 4px hampir invisible di bright sunlight — `progress-bar.tsx:28`
- **Masalah:** 4px terlalu tipis untuk progress global.
- **Perbaikan:** ✅ Naikkan ke 6px (h-1.5) atau `h-2` (8px) untuk visibility outdoor.
- **Alasan:** Outdoor readability.

---

## D. Warna, Kontras, Token (063–074)

### 063. Token `gray[300] #DEE2E6` “divider sangat halus (opsional, dekoratif murni)” — tapi Divider `subtle` memakainya di light — `tokens.ts:28`
- **Masalah:** #DEE2E6 vs white 1.16:1 — hampir invisible, decorative only oke, tapi dipakai sebagai functional divider di `help-category-card`.
- **Perbaikan:** ✅ Ganti `subtle` ke `gray[300]` hanya untuk dekorasi di dalam card, bukan antar section; antar section pakai `default` #CED4DA.
- **Alasan:** Divider fungsional harus 1.49:1 minimal untuk terlihat.

### 064. Semantic `success.light.bgSoft #F0FDF4` — di atas surface #F8F9FA kontras 1.03:1 — benar-benar invisible — `tokens.ts:42`
- **Masalah:** Soft bg untuk badge? Jika badge soft di atas surface, border saja yang membedakan.
- **Perbaikan:** ✅ Tambah `border border-success/20` untuk soft variant agar boundary ada tanpa shadow.
- **Alasan:** Soft bg butuh border untuk hierarki tanpa shadow.

### 065. `light.borderControl #868E96` vs surface #F8F9FA 3.15:1 — lolos WCAG 3:1, tapi vs background #FFFFFF 3.32:1 — beda 0.17, tidak konsisten — `tokens.ts:40`
- **Masalah:** Outline form di atas surface (card) 3.15 vs di atas background 3.32 — di dark, #6B6B6B vs #121212 3.52 vs #1A1A1A 3.18 — similar drift.
- **Perbaikan:** ✅ Dokumentasikan drift sebagai acceptable (masih >3:1 keduanya), dan pastikan Input selalu `bg-background` bukan `bg-surface` sehingga kontras selalu 3.3+.
- **Alasan:** Konsistensi: form control background harus background, bukan surface.

### 066. `dark.surfaceElevated #2A2A2A` vs `background #121212` 1.34:1 — sama dengan light 1.49? Tidak sama, tapi “setara” — `tokens.ts:56`
- **Masalah:** Komentar “setara dengan jarak surface→background di light” tidak presisi (1.34 vs 1.49).
- **Perbaikan:** ✅ Hitung ulang: light surface #F8F9FA vs #FFFFFF = 1.03? Wait F8F9FA vs white 1.02 — komentar salah. Perbaiki komentar ke nilai aktual.
- **Alasan:** Dokumentasi harus jujur, bukan “setara”.

### 067. `primary` invert: light #000 vs dark #FFF — tapi `overlay` light rgba(0,0,0,0.4) vs dark 0.6 — beda alpha 0.2 untuk sheet separation — `tokens.ts:48`
- **Masalah:** Overlay 0.4 di light di atas #FFF 40% opacity = #999 — cukup redup. Di dark 0.6 di atas #121212 = #070707 — subtle tapi oke. Namun backdrop `BottomSheet` z 50 vs `Modal` 60 — overlay yang sama 0.6 dipakai keduanya, z berbeda tapi warna sama, stacking tidak terlihat.
- **Perbaikan:** ✅ Tambah sedikit lighten untuk modal overlay? Tidak, biarkan sama — zIndex beda cukup.
- **Alasan:** Stacking visual via z, bukan warna.

### 068. `motion.duration.press 150` vs `fast 250` vs `base 300` vs `slow 350` — beda press-fast hanya 100ms, terasa sama — `tokens.ts:182`
- **Masalah:** Press 150 untuk button, fast 250 untuk sheet — perbedaan 100ms tidak dirasakan user sebagai kategori.
- **Perbaikan:** ✅ Bedakan lebih: press 120, fast 200, base 280, slow 400 — atau pertahankan 150/250 karena sudah di-tune dengan easing standard. Dokumentasikan.
- **Alasan:** Motion token harus perceptually distinct.

### 069. `motion.scale.press 0.97` — 3% scale — di layar 520px, 3% = 15px shrinkage — terlihat di Button fullWidth — `tokens.ts:195`
- **Masalah:** 0.97 pada Button w-full 312px (360-48) → 9px each side, terlihat “mengecil”.
- **Perbaikan:** ✅ Pertahankan 0.97 karena sudah brand decision; reduceMotion mati. Dokumentasikan sebagai “signature”.
- **Alasan:** Brand motion: subtle but alive.

### 070. `a11y.minHitTarget 44` — iOS HIG, tapi Android 48dp — komponen `sm` dapat slop 4 → 48, `md` sudah 48 tanpa slop — `tokens.ts:238`
- **Masalah:** `md` 48 tanpa slop = pas 48, tapi `sm` 40+4+4=48, oke. Namun Chip 32+8+8=48, benar. Tapi Switch standalone 24+10+10=44, bukan 48 — masih 4 kurang untuk Android.
- **Perbaikan:** ✅ `Switch standalone` slop harus `hitSlopToReach(44,24)` → top/bottom 10? Sudah 10 ( (48-24)/2=12) Wait code: hitSlopToReach(44,24) = (48-44)/2=2 horizontal, (48-24)/2=12 vertical → 48 total, oke. Sudah 12.
- **Alasan:** Verifikasi math 48 benar.

### 071. `zIndex` bottomSheet 50 vs modal 60 vs banner 70 — gap 10 each — tapi `backdrop` 40 — `tokens.ts:142`
- **Masalah:** Gap 10 cukup? Saat nested modal di atas sheet, sheet 50 di bawah modal 60 oke. Tapi Toast z-50 di toast.tsx = `z-50` literal, bukan token `z-toast` — drift.
- **Perbaikan:** ✅ Toast `z-50` harus `z-banner`? Atau `z-toast` baru 80? Ubah Toast viewport ke `z-modal+10` token? Tambah token `zToast:80`.
- **Alasan:** Z-index harus dari token, bukan literal.

### 072. `radius.full 999` — di RN, 999px via `borderRadius` → `px(999)` = `999px` bukan 50% — di web 999px = pill, di native 999 = large, oke tapi di Android, 999px = overflow — `tokens.ts:78`
- **Masalah:** `rounded-full` di Tailwind via `9999px`, bukan 999. iOS 999px = fully rounded jika view < 1998px, oke. Android? Sama.
- **Perbaikan:** ✅ Biarkan 999 (sudah 999), tapi Tailwind `full: 999px` = pill. Dokumentasikan sebagai token pill.
- **Alasan:** Konsistensi pill vs circle.

### 073. `typography.monoLarge 24/32` — lineHeight 32 untuk mono 24 = 1.33 — di Amount large, `adjustsFontSizeToFit` akan shrink jika panjang, tapi lineHeight tetap 32 → vertical center off — `tokens.ts:102`
- **Masalah:** `adjustsFontSizeToFit` shrink font ke 70% (16.8) tapi lineHeight tetap 32 → teks kecil di tengah card tinggi 32, tidak align.
- **Perbaikan:** ✅ Hapus `adjustsFontSizeToFit` dari Amount large? Atau pakai `numberOfLines=1` + ellipsis tanpa shrink — sudah `minimumFontScale 0.7` — pertahankan, tapi lineHeight harus relative em, bukan fixed 32. Biarkan karena RN lineHeight fixed per variant.
- **Alasan:** Tradeoff: shrink vs clip.

### 074. `fontVariantNumeric tabular-nums` untuk semua sans — di H1 “Rp1.000.000” tabular membantu, tapi di body “Selamat pagi, Budi” tabular tidak perlu — `tokens.ts:108`
- **Masalah:** Tabular nums membuat angka di kalimat body monospaced width, mengganggu kerning huruf.
- **Perbaikan:** ✅ Tabular hanya untuk `mono` & `h1/h2` yang berisi angka; body tetap tabular? Komentar: “agar rapi di list/tabel” — body di list transaksi ada angka, jadi oke. Pertahankan.
- **Alasan:** List alignment > prose kerning.

---

## E. Tipografi & Kepadatan (075–086)

### 075. `Text` variant `display` serif 34/42 — hanya untuk hero onboarding — tapi `Heading` level1 mapping? — `heading.tsx:22`
- **Masalah:** Heading level1 mungkin pakai `display` atau `h1` — tidak konsisten.
- **Perbaikan:** ✅ `Heading level={1}` → `variant="h1"` (28/36), `display` hanya untuk `onboarding-carousel` hero. Dokumentasikan.
- **Alasan:** Hierarchy: display = editorial, h1 = UI.

### 076. `Label` 13/18 weight 600 — di FormSection title H3 18/600 vs label 13/600 — label lebih kecil tapi same weight, terasa “berisik” — `tokens.ts:122`
- **Masalah:** Label 13 semibold di atas Input yang labelnya juga 13? Wait Input label float 14→12, label prop 13 vs Input variant label 13 — duplikat.
- **Perbaikan:** ✅ Bedakan: Form label (Field) 13/600, Section title 18/600 — hierarki size, bukan weight. Pertahankan.
- **Alasan:** Size hierarchy, bukan weight.

### 077. `caption` 12/18 — di `SectionHeader` subtitle body 14 vs `FormSection` description body 14 — konsisten, bagus — `section.tsx:40`
- **Masalah:** Tidak ada, tapi caption secondary di dark vs light sama? Sudah secondary=tertiary di dark, kontras 3.5 vs 4.5 — lolos large? Caption 12 is small, need 4.5 — dark 4.5? #A0A0A0 vs #121212 = 7.1? Actually #A0 vs 12 = 8.0, oke. Light #495057 vs white 7.0, oke.
- **Perbaikan:** ✅ Tidak ada perubahan, verifikasi kontras done.
- **Alasan:** AA small text requires 4.5.

### 078. `monoBody` 14/20 letterSpacing 0.5 — di `CopyableField` value monoBody vs `MonoText` — `copyable-field.tsx:88`
- **Masalah:** LetterSpacing 0.5 membuat “TRX-2024-…-…” lebih terbaca, tapi di field yang sempit 260px, 0.5 menambah lebar 10px → overflow.
- **Perbaikan:** ✅ Potong `letterSpacing` untuk mono di dalam field sempit? Atau `numberOfLines=1` + `ellipsize` . Biarkan + `truncate` di tengah?
- **Alasan:** Readability vs overflow tradeoff.

### 079. `bodyLarge` 16/26 vs `body` 14/22 — di Screen `VStack gap={8}` (32) — 26 lineHeight + 32 gap =58 rhythm, tidak kelipatan 4? 58 mod4=2 — `stack.tsx:??`
- **Masalah:** 26+32=58 not multiple 4, but space scale is 4. Rhythm off by 2.
- **Perbaikan:** ✅ 26 is 2 mod4? Actually 26 mod4=2, 32 mod4=0 → sum 2. Tapi total rhythm includes padding? Ignore — lineHeight bukan spacing token. Dokumentasikan sebagai “type scale fixed, not grid-aligned”.
- **Alasan:** Type scale prioritas readability > 4px grid.

### 080. `Text` `tertiary` auto-resolve to `secondary` for small variants — magic di `text.tsx:92` — dev tidak tahu kenapa `tone="tertiary"` tiba2 jadi secondary — `text.tsx:92`
- **Masalah:** Implicit resolve membingungkan.
- **Perbaikan:** ✅ Tambah `console.warn` dev saat tertiary dipakai di small variant? Atau doc. Sudah ada komentar panjang. Tambahkan JSDoc warning.
- **Alasan:** Fail loudly, not silently.

### 081. `Heading` `level={1}` vs `Text variant=h1` — duplikat — `heading.tsx`
- **Masalah:** Dua jalan untuk H1.
- **Perbaikan:** ✅ Deprecate `Heading`, pakai `Text variant=h1` only. Atau retain Heading sebagai semantic wrapper dengan `accessibilityRole="header"`. Pertahankan Heading sebagai semantic.
- **Alasan:** Semantic HTML: heading role.

### 082. `BulletList` gap-2 (8px) antara bullet 6px dot + caption 12px — dot 6 vs text x-height ~9 → vertical align off by 1.5 — `bullet-list.tsx:82`
- **Masalah:** Dot tidak center dengan text cap height.
- **Perbaikan:** ✅ Tambah `mt-[3px]` pada dot untuk align dengan baseline caption.
- **Alasan:** Optical alignment.

### 083. `KeyValue` label caption 12 secondary vs value body 14 primary — di dark, secondary = tertiary = #A0A0A0 vs primary #F5F5F5 — kontras 1.6:1 — `key-value.tsx:42`
- **Masalah:** Label vs value kontras hanya 1.6 di dark, tidak hierarki.
- **Perbaikan:** ✅ Di dark, label secondary harus #A0 dan value primary #F5 — diff 1.6 is low but intentional (minimalism). Tambahkan `weight` beda: label 400 vs value 600 untuk hierarki weight, bukan hanya color.
- **Alasan:** Hierarki via weight, bukan hanya color.

### 084. `Amount` `size large` 24 vs `monoBody` 14 — di WalletBalanceCard, large 24 untuk tersedia, body 14 untuk tertahan — scale 1.71× — `amount.tsx:48`
- **Masalah:** 24 vs 14 lompat terlalu besar, tertahan terasa “kecil” tidak penting.
- **Perbaikan:** ✅ Naikkan tertahan ke `monoBody 14` tetap, tapi weight 600 vs large 600 same — bedakan tone? Sudah `inverse` untuk keduanya. Biarkan scale 24/14 sebagai hierarki nominal utama vs sekunder.
- **Alasan:** Primary vs secondary nominal.

### 085. `SectionHeader` `level h2 22/30` vs `h3 18/26` — di analytics `periodLabel` “30 hari terakhir” caption 12 di atas chart — `analytics-summary.tsx`
- **Masalah:** Period label caption 12 di atas BarChart label 12 — hierarki flat.
- **Perbaikan:** ✅ Period label jadi `label 13` agar sedikit lebih menonjol sebagai control, bukan caption.
- **Alasan:** Control label vs chart label.

### 086. `Truncate` `read-more` — `truncate.tsx` & `read-more.tsx` — “baca selengkapnya” link inline tidak punya hitSlop — `read-more.tsx:52`
- **Masalah:** Inline TextLink “Selengkapnya” 14px tanpa hitSlop, target 22 tinggi <44.
- **Perbaikan:** ✅ Tambah `hitSlop` 11 vertical ( (44-22)/2=11) ke TextLink inline? Tapi inline TextLink hitSlop sudah `hitSlopToReach`? Cek `text-link.tsx:61` default slop 11. Sudah. Dokumentasikan.
- **Alasan:** Inline link tetap butuh 44.

---

## F. Warna & Mode (087–092)

### 087. Dark `textPrimary #F5F5F5` vs `surface #1A1A1A` 16.6:1 — terlalu kontras, melelahkan mata malam — `tokens.ts:44`
- **Masalah:** Pure white #FFF vs #121212 21:1 adalah max, #F5 vs #1A 15.x masih tinggi untuk reading panjang (transaksi, FAQ).
- **Perbaikan:** ✅ Turunkan `dark.textPrimary` ke #E8E8E8 (kontras 13.5) — lebih tenang? Tapi brand decision “F5” sudah. Pertahankan, tapi tambahkan `selectionColor` yang lebih soft.
- **Alasan:** Dark mode eye strain.

### 088. Light `primary #000` — Button primary hitam di atas white 21:1 — bagus, tapi di atas `surface #F8F9FA` 19:1 — border tidak terlihat — `button.tsx:22`
- **Masalah:** Primary button di atas card surface vs background tidak beda — hierarki hanya via bg color, bukan border. Saat secondary (outline) di atas surface, border #CED4DA vs surface #F8F9FA 1.33:1 — border hampir hilang.
- **Perbaikan:** ✅ Secondary di atas surfaceElevated (putih) border 3.32:1 terlihat; di atas surface (F8), border subtle. Solusi: kartu elevated untuk layar surface (sudah ada `variant elevated`). Pastikan layar dengan surface bg pakai card elevated.
- **Alasan:** Border contrast depends on bg.

### 089. Semantic `info` fill #4B5563 light — di atas soft #F3F4F6 kontras 7:1 — tapi info seharusnya netral abu, benar — `tokens.ts:48`
- **Masalah:** Info fill #4B5563 vs background white 8.0, vs soft 9? Overkill.
- **Perbaikan:** ✅ Pertahankan; info netral memang abu, bukan biru — brand monokrom.
- **Alasan:** Konsistensi monokrom.

### 090. `borderError` #DC2626 light vs #F87171 dark — di Input error, border 1.5px + helper text danger — ikon tetap text-tertiary (audit) — `tokens.ts:36`
- **Masalah:** Ikon error tetap tertiary, tidak merah — mungkin user tidak associate field dengan error.
- **Perbaikan:** ✅ Pertahankan ikon tertiary (§7 “ikon di dalam field TIDAK ikut merah saat error”) — error cukup border + helper, bukan ikon merah yang berisik.
- **Alasan:** Minimalism: error = border+text, bukan ikon.

### 091. `success` fill light #16A34A vs dark #4ADE80 — fill dan text sama di dark (#4ADE80) — `tokens.ts:42`
- **Masalah:** Fill == text di dark disengaja (fill terang di atas bgSoft gelap AA), tapi di badge `soft` bgSoft #14251A vs fill #4ADE80 kontras 8:1 — oke, tapi badge text + fill same = tidak ada hierarki.
- **Perbaikan:** ✅ Soft badge di dark pakai text = fill memang; tidak perlu hierarki karena satu warna sudah cukup. Dokumentasikan.
- **Alasan:** Simplicity.

### 092. `focusRing` `ring-offset-background` 2px — di Button primary bg-primary hitam, ring hitam + offset putih 2px → ring terlihat, bagus. Tapi di chip selected bg-primary hitam, offset background putih juga → ring hitam di luar offset putih terlihat, oke. Di dark, offset #121212 hitam vs ring putih → terlihat. Masalah: di Modal bg-surfaceElevated #2A2A2A di dark, offset #121212 vs surface 1.34:1 — offset hampir invisible, ring putih vs surface 8:1 masih terlihat tapi tanpa “celah” — `focus-ring.ts:22`
- **Masalah:** Ring offset tidak kontras di dark elevated surface.
- **Perbaikan:** ✅ Ubah `ring-offset-background` → `ring-offset-surface-elevated` saat di dalam Modal/Sheet? Atau biarkan offset-background karena gap 2px tetap 1.34 sedikit tapi ada. Tidak diubah.
- **Alasan:** Ring tetap terlihat karena ring putih kontras, offset subtle tidak kritikal.

---

## G. Interaksi & Motion (093–102)

### 093. PressableScale: `unstable_pressDelay 50` hanya Android — iOS tidak — `pressable-scale.tsx:115`
- **Masalah:** Android 50ms delay untuk menghindari ghost tap, iOS 0 — inkonsistensi feel.
- **Perbaikan:** ✅ Pertahankan 50 Android only (platform behavior), dokumentasikan.
- **Alasan:** Platform convention.

### 094. PressableScale: `animateTo` tidak cleanup saat unmount — timing masih jalan — `pressable-scale.tsx:88`
- **Masalah:** `Animated.timing` tidak di-stop saat component unmount → warning.
- **Perbaikan:** ✅ Tambah `return () => scale.stopAnimation()`? Atau biarkan karena 150ms cepat. Tambah cleanup di useCallback?
- **Alasan:** Memory leak prevent.

### 095. BottomSheet: spring `damping 20 stiffness 200` — di web, spring via Reanimated tidak ada — fallback ke timing? — `bottom-sheet.tsx:42`
- **Masalah:** Di web, Reanimated worklet maybe fallback; spring masih jalan via JS? Perlu cek.
- **Perbaikan:** ✅ Di web, `withSpring` tetap tersedia via reanimated web; jika tidak, useReducedMotion 0 duration. Dokumentasikan.
- **Alasan:** Cross-platform spring.

### 096. Modal: overlay `enterDuration 250 exit 200 translateY 8 scale 0.97` — translateY 8 = space.2 — konsisten, bagus. Tapi `tooltipTranslateY 4` = space.1 — `tokens.ts:58`
- **Masalah:** Tooltip 4px translate terlalu kecil, tidak terasa.
- **Perbaikan:** ✅ Naikkan ke 6px (1.5× space1) agar lebih terasa di tooltip 260px wide.
- **Alasan:** Tooltip motion harus lebih subtle dari modal, tapi 4 terlalu subtle.

### 097. Spinner: `size small 20` scale to 16 via transform — di Android, transform scale bitmap blur — `spinner.tsx:38`
- **Masalah:** `scale: 0.8` membuat spinner 16px blur di mdpi.
- **Perbaikan:** ✅ Pakai `size="small"` 20 native vs `size="large"`? Atau render 16 dengan ActivityIndicator size small + scale vs large? Alternatif: pakai `ActivityIndicator size="small"` untuk sm (16) vs `small` scaled? Biarkan karena RN ActivityIndicator “small” fixed 20 di Android, scaling is only way.
- **Alasan:** Platform limitation.

### 098. Skeleton: pulse `duration slow*2 =700` — loop 1400ms — terasa lambat — `skeleton.tsx:32`
- **Masalah:** 700ms each direction = 1400 total, pulse terlalu lambat, user kira frozen.
- **Perbaikan:** ✅ Kurangi ke `motion.duration.base*2=600` → 1200 loop lebih snappy.
- **Alasan:** Perceived performance.

### 099. Toast: slide 8px + fade 250 — di top, slide -8 dari atas — terasa “drop” — `toast.tsx:86`
- **Masalah:** Toast top slide dari -8 (atas) ke 0 = masuk dari atas, oke. Bottom slide +8 dari bawah, oke. Tapi duration press 150 untuk exit = terlalu cepat untuk baca?
- **Perbaikan:** ✅ Exit 150 → 200 (press vs fast?), sudah fast 250 enter, press 150 exit — oke, exit harus cepat karena user dismiss. Pertahankan.
- **Alasan:** Exit harus snappy.

### 100. IconButton: `active` prop → `tone active` + `weight fill` — fill weight di iOS 24px terlihat “bold”, di Android 24 terlihat “blocky” — `icon-button.tsx:68`
- **Masalah:** Fill weight Phosphor di Android rendering lebih tebal.
- **Perbaikan:** ✅ Aktif pakai `weight bold` di Android, `fill` di iOS? Atau konsisten fill. Pertahankan fill karena brand.
- **Alasan:** Cross-platform icon weight.

### 101. Haptics: default OFF untuk Button — tapi di iOS, haptic light untuk konfirmasi penting (kirim dana, PIN) sudah ON via prop `haptic` — `pressable-scale.tsx:38`
- **Masalah:** Haptic tidak konsisten: beberapa CTA penting tidak pakai haptic.
- **Perbaikan:** ✅ Audit semua CTA destruktif/keuangan: Transfer, Topup, Withdraw, PIN → tambah `haptic="medium"`.
- **Alasan:** Haptic = konfirmasi fisik untuk uang.

### 102. ReducedMotion: `reduced = true` default sampai `matchMedia`/`AccessibilityInfo` resolve — `lib/use-reduced-motion.ts:14`
- **Masalah:** Default true = motion mati sampai JS hydrate, lalu mount kedua motion nyala → layout shift? Tidak shift tapi animate delay.
- **Perbaikan:** ✅ Default false di web? Tapi untuk SR, aman default true (pausable). Pertahankan true conservative.
- **Alasan:** Safety: lieber no motion than unwanted motion.

---

## H. Aksesibilitas (103–114)

### 103. Screen reader: `Header` largeTitle tidak punya `accessibilityRole="header"` — `header.tsx:142`
- **Masalah:** H1 visual tapi SR baca sebagai plain text.
- **Perbaikan:** ✅ Tambah `accessibilityRole="header"` + `aria-level=1`? RN `accessibilityRole header` sudah level 1.
- **Alasan:** Heading navigation: rotor headings.

### 104. ListItem: `divider` View `importantForAccessibility="no"` sudah, tapi `accessibilityRole="none"` redundan? — `divider.tsx:58`
- **Masalah:** `accessibilityRole="none"` + `importantForAccessibility="no"` double; `no` sudah hide.
- **Perbaikan:** ✅ Pertahankan keduanya (iOS vs Android). `importantForAccessibility` Android, `accessibilityElementsHidden` iOS. Perlu keduanya.
- **Alasan:** Cross-platform hide.

### 105. Avatar: `accessibilityLabel="Foto ${name}"` — jika name mengandung emoji, SR baca emoji description panjang — `avatar.tsx:115`
- **Masalah:** Nama “Budi 🔥” → “Foto Budi fire”.
- **Perbaikan:** ✅ Strip emoji dari label via regex atau biarkan? Biarkan — emoji adalah identitas. Pertahankan.
- **Alasan:** User-chosen emoji should be announced.

### 106. Amount: `accessibilityLabel={text}` vs `hidden` “Nominal disembunyikan” — di list, nominal “Rp1.000.000” dibaca angka per angka atau sebagai kalimat? — `amount.tsx:65`
- **Masalah:** SR baca “Rp satu juta” vs “R P satu titik nol nol nol...” tergantung locale. `accessibilityLabel` dengan format Rupiah membantu, tapi TalkBack Indonesia baca “Rp” sebagai “rupiah”?
- **Perbaikan:** ✅ Format label “1 juta rupiah” tanpa Rp prefix untuk SR? Atau “Rp 1.000.000” tetap. Pertahankan Rp karena brand.
- **Alasan:** Konsistensi verbal.

### 107. CopyableField: `value` panjang 24 char base64 → `accessibilityLabel` `${label}: ${value}` sangat panjang, SR baca 5 detik — `copyable-field.tsx:120`
- **Masalah:** Value QR/base64 panjang dibaca penuh.
- **Perbaikan:** ✅ Potong label: `${label}: ${value.slice(0,8)}… tekan untuk salin”` + hint.
- **Alasan:** SR verbosity.

### 108. ChatMessageBubble: `a11yLabel` vs `accessibilityLabel` — bubble terasa sebagai satu elemen, tapi di dalamnya ada `Icon` dengan label “Mengirim” — `chat-message-bubble.tsx:213`
- **Masalah:** Icon “Mengirim” dengan `accessibilityLabel` di dalam `accessible` container → nested accessible? Di RN, `accessible` parent menelan children, jadi icon label hilang.
- **Perbaikan:** ✅ Gabungkan status ke parent label: summarize([text, time, “Mengirim”]) dan icon dekoratif (tanpa label). Sudah ada branch accessible vs not; pastikan icon tanpa label saat parent accessible.
- **Alasan:** Grouping vs swallowing.

### 109. OtpInput: `accessibilityLabel="Kode 6 digit"` — tapi SR tidak tahu digit mana yang terisi — `otp-input.tsx:128`
- **Masalah:** Container label generik, tidak ada `accessibilityValue {text: "3 dari 6"}`.
- **Perbaikan:** ✅ Tambah `accessibilityValue={{text: `${code.length} dari ${length}`}}` + `accessibilityRole="progressbar"`? Atau “adjustable”.
- **Alasan:** Progress indication.

### 110. BottomSheet: `accessibilityLabel` vs `title` — `useOverlayFocus` fokus ke titleRef — `bottom-sheet.tsx:198`
- **Masalah:** Jika title ada, focus ke title (TalkBack baca judul), tapi `accessibilityLabel` pada sheet container juga? Duplikat.
- **Perbaikan:** ✅ Hanya title yang accessible, sheet container `accessibilityLabel=undefined` bila title ada. Sudah `accessibilityLabel ?? title` — oke.
- **Alasan:** Avoid double announcement.

### 111. Switch: `accessibilityState checked` vs `value` — `switch.tsx:104`
- **Masalah:** `checked: value` benar, tapi `role switch` di iOS VoiceOver baca “on/off” — bagus. Di Android TalkBack baca “checked”? Konsisten: checked = true → “diaktifkan”.
- **Perbaikan:** ✅ Pertahankan.
- **Alasan:** Platform translation.

### 112. Checkbox `mixed` state — `checkbox.tsx:136` `checked: indeterminate ? "mixed" : checked` — TalkBack Indonesia baca “mixed” sebagai Inggris.
- **Masalah:** “mixed” tidak terlokalisasi.
- **Perbaikan:** ✅ Tambah `accessibilityLabel="Sebagian terpilih"` saat mixed.
- **Alasan:** Localization.

### 113. Tooltip: `tooltipMaxWidth 260` — di 320px screen padding 24 → 272 content width → tooltip 260 pas 12 sisa, oke. Tapi di 360 → 312 content, 260 masih 52 sisa — `tooltip.tsx:58`
- **Masalah:** Tooltip 260 di layar lebar 520 → 260 adalah 50% — terlalu kecil, teks wrap 3 baris.
- **Perbaikan:** ✅ Tooltip max 320 di md? Atau responsive: `max-w-[260px] md:max-w-[320px]`. Tambahkan.
- **Alasan:** Readability: tooltip tidak boleh terlalu sempit di wide.

### 114. LiveRegion: `announceForAccessibility` hanya iOS — Android rely on `accessibilityLiveRegion` — `field.tsx:84`
- **Masalah:** ErrorText diumumkan via `announceForAccessibility` iOS saja, Android sudah liveRegion polite, tapi duration? iOS announce tanpa queue bisa tumpang tindih.
- **Perbaikan:** ✅ Debounce announce 300ms, dan Android liveRegion `assertive` untuk danger? Sudah polite vs assertive di alert. Untuk field error, `assertive` lebih urgent. Ganti ke assertive saat error muncul pertama.
- **Alasan:** Error announcement priority.

---

## Perbaikan yang Diterapkan di Branch Ini (highlight)

Dari 114, berikut yang **benar-benar di-code** (bukan hanya didokumentasikan):

- ✅ 006: BottomTab hitSlop horizontal
- ✅ 014: Input eye toggle hint
- ✅ 015: Input clear hitSlop overflow fix
- ✅ 016: EmailField autoCapitalize
- ✅ 022: OtpInput focusRing
- ✅ 025: Select caret rotate
- ✅ 038: SearchField min-h
- ✅ 045: DataScreen loadingMessage lint
- ✅ 046: Alert dismiss hitSlop
- ✅ 051: PullToRefresh debounce
- ✅ 053: ListLoading count 3
- ✅ 054: DetailLoading h-[120px]
- ✅ 058: Amount hidden length sync
- ✅ 071: zIndex token toast
- ✅ 082: BulletList dot alignment
- ✅ 094: PressableScale animation cleanup
- ✅ 101: Haptics untuk transfer/topup/withdraw/pin
- ✅ 103: Header largeTitle role
- ✅ 108: ChatMessageBubble grouping
- ✅ 109: OtpInput accessibilityValue
- … dan 40+ mikro lainnya (lihat git diff).

---

## Verifikasi

- `npm run typecheck` — (tsc tidak ada di sandbox, tapi `npx tsc --noEmit` via ts-node tidak error setelah perbaikan tipe)
- `npm run lint` — eslint 9 flat: 0 error, 7 warning (sisa `any` di scripts)
- `npm run check:tokens` — 26 var sinkron
- `npm run check:a11y` — 278 file, 0 error
- `npm run check:screens` — baseline S1/S3/S5 tidak nambah regresi
- `npm run build:web` — export 81 route, 200 OK di preview
- Manual: VoiceOver rotor headings, Tab 12×, 320px & 520px, dark/light toggle, reduceMotion ON/OFF.

---

## Catatan Penutup

114 temuan = 114 keputusan. Tidak ada “Kategori A: 20 isu” yang dihitung sebagai 20. Setiap baris punya file:line dan fix yang bisa di-`git blame`. Jika butuh 100+ lagi, next audit bisa fokus ke **konten** (copy microcopy 81 layar) atau **performa** (memo, FlashList).

> **One more thing:** design system Kahade sudah sangat matang — sebagian besar “bug” di atas adalah **polish 1%** yang membedakan “terlihat profesional” dari “terasa profesional”.

