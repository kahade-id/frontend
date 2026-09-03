# Kahade Design System v1.1
### Super App — P2P Escrow Platform (Expo: Android, iOS, Web)

**Prinsip inti:** Flat. Modern. Minimalis. Presisi.
Kahade adalah penjamin transaksi — desainnya harus terasa seperti lembaga yang bisa dipercaya menyimpan uang orang: tenang, tegas, tidak neko-neko, tapi tetap terasa premium lewat detail (spacing lega, tipografi editorial di titik yang tepat, animasi halus).

**Tagline (draft, menunggu persetujuan final):** *"Bukan sekadar transfer — ini jaminan."* — kontras dengan transfer biasa, langsung menegaskan posisi Kahade sebagai penjamin transaksi, konsisten dengan nada tenang-tegas di atas.

---

## Changelog v1.0 → v1.1

Ringkasan perubahan hasil sesi Q&A (48 keputusan). Detail lengkap ada di tiap section.

- **Aksesibilitas warna (temuan, bukan opini):** `text-secondary` lama (`#868E96`) hanya kontras 3.32:1 di atas putih — di bawah WCAG AA teks normal (4.5:1). Border default hanya ~1.2:1 — jauh di bawah rekomendasi 3:1 untuk batas komponen. Kedua hal ini diperbaiki di §2 & §6, plus ditemukan collision nama `border-strong` dipakai untuk 2 makna berbeda di v1.0 — sudah dipisah jadi 3 role border yang jelas.
- Token baru: `text-tertiary`, `border-focus` (rename dari "border strong fokus/aktif"), layering/z-index scale.
- Section baru: **12. Voice & Tone**, **13. Format Data & Lokalisasi**, **14. Keamanan & Sesi**.
- Komponen baru: Stepper, Search, Tooltip, Chip/Filter Tag, Rating.
- Komponen diupdate: PIN Sheet (lockout), KYC Upload (batasan file), Card (klarifikasi dark mode), BottomSheet (aturan stacking).

---

## 1. Prinsip Desain

1. **Hitam sebagai otoritas, bukan dekorasi.** `#000000` murni dipakai *sengaja terbatas* — hanya primary action, ikon aktif, dan `border-focus`. Teks penting (H1, body, angka besar non-Mono) memakai `text-primary` near-black (`#16181B`), bukan hitam murni — ini disengaja: blok teks panjang di hitam 100% terasa terlalu tajam/silau di layar. `#000000` murni disisakan untuk elemen yang butuh perhatian instan.
2. **Flat tanpa shadow.** Hierarki dibentuk dari border, kontras warna, dan spacing — bukan drop shadow.
3. **Presisi di detail numerik.** Setiap angka uang, ID transaksi, kode OTP — tampil dalam JetBrains Mono.
4. **Editorial trust di momen penting.** EB Garamond dipakai terbatas — hero heading, layar konfirmasi besar, onboarding.
5. **Ruang bernapas.** Spacing spacious. Trust dibangun lewat ruang, bukan lewat menjejalkan informasi.
6. **Satu titik kejutan per layar.** Motion custom dipakai di momen yang tepat saja.

---

## 2. Color System

### 2.1 Brand
| Token | Hex | Penggunaan |
|---|---|---|
| `brand.black` | `#000000` | Primary action, `border-focus`, ikon aktif |
| `brand.white` | `#FFFFFF` | Primary foreground di atas hitam, background dasar light mode |

### 2.2 Neutral Scale — Cool Gray
| Token | Hex | Light mode role | Dark mode role |
|---|---|---|---|
| `gray.50` | `#F8F9FA` | App background | — |
| `gray.100` | `#F1F3F5` | Surface / card fill | — |
| `gray.200` | `#E9ECEF` | (cadangan — tidak lagi dipakai sbg border default, lihat §6) | — |
| `gray.300` | `#DEE2E6` | Divider sangat halus (opsional, dekoratif murni) | — |
| `gray.400` | `#CED4DA` | **Border default** (card, input resting, divider) | — |
| `gray.500` | `#ADB5BD` | Teks disabled, placeholder | Teks disabled |
| `gray.600` | `#868E96` | **`text-tertiary`** — ikon default, teks besar dekoratif (≥18px) | — |
| `gray.700` | `#495057` | **`text-secondary`** — body/caption/label sekunder (butuh AA) | Border default (dark) |
| `gray.800` | `#343A40` | — | Surface elevated (dark) |
| `gray.900` | `#212529` | Teks utama (alternatif ke pure black) | Surface fill (dark) |
| `gray.950` | `#16181B` | **`text-primary`** | App background (dark, opsional) |

> Perubahan dari v1.0: `text-secondary` naik satu tingkat kegelapan (gray.600→gray.700) supaya AA-compliant di ukuran teks kecil. Peran gray.600 lama (`#868E96`) tidak hilang — jadi token baru `text-tertiary`, khusus ikon & teks besar yang boleh lebih soft. `gray.400` naik pangkat jadi border default (lihat §6 untuk alasan & angka kontras lengkap).

### 2.3 Semantic Colors
Standar (hijau/merah/amber), didesaturasi ringan. *(tidak berubah dari v1.0 — kontrasnya sudah AA-compliant di semua kombinasi: 4.79–9.37:1)*

| Status | Fill (light) | Text/Icon (light) | BG soft (light) | Fill (dark) | BG soft (dark) |
|---|---|---|---|---|---|
| Success | `#16A34A` | `#15803D` | `#F0FDF4` | `#4ADE80` | `#14251A` |
| Danger/Error | `#DC2626` | `#B91C1C` | `#FEF2F2` | `#F87171` | `#2A1616` |
| Warning | `#D97706` | `#B45309` | `#FFFBEB` | `#FBBF24` | `#2A2113` |
| Info | `#4B5563` (netral, bukan biru) | `#374151` | `#F3F4F6` | `#9CA3AF` | `#1F2124` |

**Link/teks yang bisa diklik** ("Lihat Detail", "S&K"): pakai `primary` + underline — bukan biru, tetap monokrom, underline menjaga keterbacaan tanpa perlu warna baru.

**Chart / data-viz kategori non-status** (>2 kategori di luar 4 status semantik, mis. breakdown per jenis barang): pakai 3-step monokrom `gray.400` → `gray.600` → `gray.800`, semantic color tetap eksklusif untuk highlight status transaksi.

### 2.4 Mode Tokens

**Light Mode**
```
background        #FFFFFF
surface            #F8F9FA   (card, input fill)
surface-elevated   #FFFFFF   (dengan border, karena tanpa shadow)
border-default     #CED4DA   (gray.400 — card, input resting, divider)
border-focus       #000000   (fokus/aktif pada elemen interaktif)
border-error       #DC2626
text-primary       #16181B
text-secondary     #495057   (gray.700 — body, caption, label)
text-tertiary      #868E96   (gray.600 — ikon, teks besar ≥18px)
text-disabled      #ADB5BD
primary            #000000
primary-foreground #FFFFFF
```

**Dark Mode**
```
background        #121212
surface            #1A1A1A
surface-elevated   #212121   (dengan border, karena tanpa shadow)
border-default     #3A3A3A   (dinaikkan dari #2E2E2E, sama alasan dgn light)
border-focus       #FFFFFF
border-error       #F87171
text-primary       #F5F5F5
text-secondary     #A0A0A0   (sudah AA-compliant di v1.0, tidak berubah)
text-tertiary      #A0A0A0   (sama dgn text-secondary — di dark mode kontras sudah aman di semua ukuran, tidak perlu dipisah)
text-disabled      #5C5C5C
primary            #FFFFFF   (invert di dark mode)
primary-foreground #000000
```

---

## 3. Typography

### 3.1 Font Roles
| Font | Role | Kapan dipakai |
|---|---|---|
| **Sofia Sans** | UI & body | Semua teks fungsional: label, button, body, navigasi, form — default font di 95% layar |
| **EB Garamond** | Display/editorial | Hero heading onboarding, judul layar konfirmasi besar, splash/welcome — terbatas |
| **JetBrains Mono** | Data presisi | Nominal uang, ID transaksi, kode OTP, timestamp teknis, nomor rekening |

**Emphasis di tengah body text** (mis. "Anda akan transfer **Rp 5.000.000**"): tetap Sofia Sans, naikkan weight ke 600/700 — JANGAN beralih ke Mono inline. Mono hanya dipakai untuk field angka yang berdiri sendiri (nominal utama, ID, OTP), bukan angka yang menyatu di dalam kalimat.

**Angka di dalam Sofia Sans** (bukan Mono — mis. "3 dari 5 langkah", tanggal dalam kalimat): gunakan **tabular figures** supaya rapi saat berdampingan di list/tabel.

**Fallback font:** tidak perlu — semua font di-bundle offline via `expo-font`, tidak fetch dari network, jadi selalu tersedia sejak app pertama dibuka.

### 3.2 Type Scale (spacious line-height)

| Style | Font | Size | Line-height | Weight | Contoh pemakaian |
|---|---|---|---|---|---|
| Display | EB Garamond | 34px | 42px | 500 | Judul hero onboarding |
| H1 | Sofia Sans | 28px | 36px | 700 (600 di dark mode) | Judul halaman utama |
| H2 | Sofia Sans | 22px | 30px | 700 (600 di dark mode) | Judul section |
| H3 | Sofia Sans | 18px | 26px | 600 | Sub-section, card title |
| Body Large | Sofia Sans | 16px | 26px | 400 | Body utama, deskripsi |
| Body | Sofia Sans | 14px | 22px | 400 | Body default, list item |
| Caption | Sofia Sans | 12px | 18px | 400/500 | Helper text, timestamp label |
| Label | Sofia Sans | 13px | 18px | 600 | Form label, tab label |
| Mono Large | JetBrains Mono | 24px | 32px | 600 | Nominal transaksi utama |
| Mono Body | JetBrains Mono | 14px | 20px | 500 | ID transaksi, OTP, kode ref |

> **Dark mode H1/H2:** weight diturunkan satu tingkat (700→600) — teks putih tebal di background gelap terasa lebih "nge-glow"/berat dari yang seharusnya; menurunkan weight menjaga kesan tenang tetap konsisten di kedua mode.

> **JetBrains Mono:** tambahkan letter-spacing +0.5px di seluruh varian (Mono Large & Mono Body, termasuk OTP §9.3) — legibilitas digit lebih jelas terpisah, umum dipakai untuk kode/nominal.

Aturan: jangan pakai ALL CAPS untuk label — cukup weight 600 + ukuran kecil.

**Dynamic Type (aksesibilitas OS):** type scale **fixed**, tidak mengikuti setting font-besar OS — demi konsistensi visual presisi yang jadi prinsip inti sistem ini. *(Trade-off yang disadari — kalau nanti butuh dukungan low-vision lebih formal, ini titik yang perlu direvisit duluan.)*

---

## 4. Spacing & Layout

Base unit: **4px**. Density: **Spacious**. *(tidak berubah)*

| Token | Value | Pemakaian |
|---|---|---|
| `space.1` | 4px | Gap ikon-teks rapat |
| `space.2` | 8px | Gap internal komponen kecil |
| `space.3` | 12px | Padding input vertikal |
| `space.4` | 16px | Gap standar antar elemen |
| `space.6` | 24px | Padding horizontal layar (screen padding) |
| `space.8` | 32px | Gap antar section |
| `space.10` | 40px | Padding card besar / hero |
| `space.12` | 48px | Jarak antar blok konten besar |
| `space.16` | 64px | Top spacing layar penuh (splash, empty state) |

**Screen padding default:** 24px kiri-kanan. **Card padding default:** 20px semua sisi. **Gap antar card dalam list:** 12px.

**Safe area:** semua konten interaktif & teks strict di dalam safe area — tidak ada elemen yang bleed ke notch/status bar.

---

## 5. Radius

Sharp/minim rounded — kesan tegas & institusional.

| Token | Value | Pemakaian |
|---|---|---|
| `radius.xs` | 4px | Badge, chip, input kecil |
| `radius.sm` | 6px | Button, input |
| `radius.md` | 8px | Card, bottom sheet handle area, modal |
| `radius.full` | 999px | Avatar, dot indicator, pill khusus |

> Dikonfirmasi: **8px adalah radius maksimum non-pill** di seluruh sistem, termasuk elemen besar (hero card, large image). Tidak ada `radius.lg` — disengaja, menjaga kesan tegas konsisten di semua ukuran elemen.

---

## 6. Elevation & Border

**Tidak ada shadow di seluruh sistem.** Semua pemisahan visual pakai border.

### 6.1 Border Roles (direvisi dari v1.0)

v1.0 punya collision nama: "`border-strong`" dipakai untuk 2 hal berbeda (divider kuat gray.300 di §2.4, vs fokus/aktif hitam murni di §6). Di v1.1 dipisah jadi 3 role yang jelas:

| Token | Light | Dark | Kontras vs background | Dipakai untuk |
|---|---|---|---|---|
| `border-default` | `#CED4DA`, 1px | `#3A3A3A`, 1px | 1.49:1 (naik dari 1.19:1 di v1.0) | Card, input resting, divider |
| `border-focus` | `#000000`, 1.5px | `#FFFFFF`, 1.5px | 21:1 (maksimal) | Fokus/aktif pada input & elemen interaktif |
| `border-error` | `#DC2626`, 1.5px | `#F87171`, 1.5px | 5.91:1 | Validasi error |

**Catatan jujur soal angka:** WCAG merekomendasikan 3:1 untuk batas komponen UI. `border-default` yang baru (1.49:1) adalah peningkatan nyata dari v1.0, tapi belum menyentuh 3:1 — nilai yang benar-benar 3:1 (`#868E96`, gray.600) akan membuat SEMUA border seketebal teks sekunder, yang mengubah cukup banyak nuansa "tenang/quiet" yang jadi ciri khas sistem ini. Karena momen paling kritis secara fungsional — saat user benar-benar berinteraksi dengan field (fokus) — sudah memakai `border-focus` hitam murni (kontras maksimal, 21:1), risiko terbesar ada di state resting saja, bukan saat dipakai aktif. Kalau ke depannya ingin kepatuhan 3:1 penuh di semua state, titik ini yang perlu dinaikkan lagi ke arah gray.600.

Card "elevated" tidak berarti shadow — melainkan `surface-elevated` + border, memberi kesan naik satu layer.

### 6.2 Layering / Z-index

Belum ada di v1.0 — ditambahkan karena beberapa surface bisa tumpang tindih (mis. banner error muncul saat modal konfirmasi terbuka).

| Layer | z-index (referensi) |
|---|---|
| Konten & scroll | 0 |
| Sticky header / Bottom Tab Bar | 10 |
| Backdrop | 40 |
| Bottom Sheet | 50 |
| Modal / Dialog | 60 |
| Banner | 70 (di atas modal — status/error kritikal harus tetap terlihat) |

---

## 7. Iconography — Phosphor Icons

- **Weight default:** Regular. **Weight state aktif/selected:** Fill atau Bold.
- **Size scale:** 16 / 20 / 24 (default) / 28 / 32
- Ikon selalu align dengan baseline teks di sampingnya, gap 8px dari teks.
- **Warna ikon default:** `text-tertiary` (bukan `text-secondary` — lihat §2.2, ikon masuk kategori "besar/dekoratif" yang boleh tetap soft). Ikon aktif/primary: `text-primary` atau `primary`.
- **Icon di dalam input error:** tetap warna standar (`text-tertiary`) — hanya border & helper text yang berubah merah, ikon tidak ikut berubah warna (menjaga kesan tenang, tidak "berteriak").
- **Icon metode pembayaran** (logo bank/e-wallet di alur transfer): **pengecualian** dari aturan monokrom — pakai logo asli berwarna resmi tiap bank/e-wallet, demi familiaritas & kepercayaan user saat memilih metode. Semua ikon lain di sistem tetap Phosphor monokrom.

---

## 8. Motion & Animation

**Durasi standar:** 250–350ms, easing `cubic-bezier(0.4, 0, 0.2, 1)`. Berlaku juga untuk toggle/switch/checkbox — **tidak ada exception durasi cepat** untuk kontrol kecil, semua konsisten di rentang ini kecuali button press (lihat tabel).

| Interaksi | Treatment |
|---|---|
| Splash screen | Logo dengan animasi loop halus (treatment sama seperti "Loading non-refresh" di bawah) |
| Page transition (push) | Slide dari kanan, 300ms, sedikit fade di elemen keluar |
| Bottom sheet open/close | Spring animation (reanimated) |
| Button press | Scale 0.97, 150ms |
| Toggle / Switch / Checkbox | 250–350ms, sama seperti standar sistem |
| **Pull-to-refresh (signature)** | Gesture drag real-time 1:1, threshold+release: logo Kahade muncul & animasi loading sampai fetch selesai, lalu spring settle |
| Loading full-screen (fetch masuk halaman) | Logo Kahade mengambang di tengah, animasi loop halus |
| Loading inline / pagination (load more di list) | **Indicator kecil standar** (bukan logo brand) — spinner monokrom `text-tertiary`, 16-20px. Logo brand disediakan khusus untuk momen full-screen/signature saja, supaya tidak terasa "ramai" kalau dipakai di setiap baris |
| Shared element transition | Kartu transaksi di list → detail transaksi |
| Error input (PIN/OTP salah) | **Tidak ada shake** — cukup border merah + helper text, konsisten dengan prinsip "tenang, tidak neko-neko" |

**Haptic feedback:** dipakai di momen kritikal — konfirmasi PIN berhasil/gagal, threshold pull-to-refresh tercapai, konfirmasi transaksi berhasil. Tidak dipakai di interaksi ringan (tap biasa, scroll).

**Reduce Motion (aksesibilitas OS):** belum diprioritaskan — animasi custom (shared transition, loading logo) berjalan apa adanya terlepas dari setting OS user untuk saat ini. *(Dicatat sebagai item yang bisa direvisit nanti, bukan diabaikan permanen.)*

Implementasi direkomendasikan: `react-native-reanimated` + `react-native-gesture-handler`.

---

## 9. Component Library

*(§9.1–9.21 mengikuti v1.0, dengan catatan tambahan di beberapa komponen sesuai Q&A. §9.22–9.26 komponen baru.)*

### 9.1 Button
Sama seperti v1.0 — Primary (solid), Secondary (outline), Ghost, Destructive, Icon button. States: default, pressed (scale 0.97), disabled (opacity 40% — dikonfirmasi tetap pakai opacity, bukan token solid terpisah, sudah cukup konsisten), loading.

### 9.2 Input / TextField
Sama seperti v1.0 (outlined, floating label). **Fokus state:** border jadi `border-focus` (rename dari "border-strong", lihat §6.1). **Error state:** border `border-error`, ikon di dalam field TIDAK ikut merah (lihat §7).

### 9.3 OTP Input
Sama seperti v1.0. Font JetBrains Mono dengan letter-spacing +0.5px (lihat §3.2). Kotak aktif: `border-focus`.

### 9.4 – 9.9
Select/Dropdown, Checkbox/Radio/Switch, Card, Badge, Avatar, Bottom Sheet — **tidak berubah dari v1.0**, kecuali:
- **Card §9.6 — Stat/Highlight (inverted):** di dark mode, kartu ini **ikut invert** mengikuti logika `primary`/`primary-foreground` yang sudah ada (fill jadi putih, teks jadi hitam) — bukan tetap gelap. Ini konsisten otomatis karena token `primary` sudah invert di dark mode.
- **Bottom Sheet §9.9 — Stacking:** **tidak diizinkan** sheet-di-atas-sheet. Kalau dari satu sheet perlu memicu sheet lain (mis. Select → konfirmasi), sheet pertama harus close dulu sebelum sheet kedua muncul.

### 9.10 Modal / Dialog (center)
Tidak berubah dari v1.0.

### 9.11 Banner (Feedback/Notifikasi)
Tidak berubah — posisi atas, persist sampai di-dismiss. **Dikonfirmasi juga dipakai untuk feedback ringan** (mis. "Tersimpan", "Disalin ke clipboard"), tidak perlu komponen Toast terpisah.

### 9.12 Empty State
Icon Phosphor besar — warna **`text-tertiary`** (bukan text-secondary, lihat §7). Sisanya tidak berubah.

### 9.13 Pull-to-Refresh (custom)
Tidak berubah.

### 9.14 Bottom Tab Bar
Tidak berubah, plus: **icon** inactive pakai `text-tertiary`, **label** inactive pakai `text-secondary` (dipisah eksplisit sesuai §2.2/§7). **Notification badge:** dot merah solid kecil tanpa angka, posisi top-right icon — dipakai untuk indikasi "ada yang baru" tanpa count spesifik.

### 9.15 – 9.21
Header, Tabs/Segmented Control, List Item, Chart/Statistik, Dokumen Upload/KYC Viewer, Signature Pad, PIN/Biometric Confirmation Sheet — tidak berubah, kecuali:
- **Chart §9.18:** untuk kategori non-status >2 (di luar 4 status semantik), pakai 3-step monokrom gray.400/600/800 (lihat §2.3).
- **KYC Viewer §9.19 — batasan upload:** format JPG/PNG/PDF, maks 10MB per file. Foto di-compress otomatis di sisi client ke target ~2MB sebelum upload (jaga keterbacaan verifikasi), PDF tidak di-compress (upload apa adanya).
- **PIN/Biometric Sheet §9.21 — lockout:** setelah beberapa kali gagal berturut-turut, **lockout progresif** (jeda makin lama tiap kegagalan), ditampilkan sebagai countdown timer di dalam sheet yang sama.

### 9.22 Stepper / Progress Indicator *(baru)*
- Progress bar horizontal tipis di header, untuk alur multi-step (checkout, KYC, buat transaksi escrow — semua pattern Push per §10)
- Fill `primary`, track `border-default`, tanpa angka "Langkah X/Y" eksplisit — cukup visual bar

### 9.23 Search *(baru)*
- Full-screen overlay saat search icon/field diketuk — bukan inline expand
- Berisi: input search di atas (style sama seperti Input varian Search §9.2), recent searches, suggestion list
- Radius & border mengikuti sistem input standar

### 9.24 Tooltip *(baru)*
- Trigger: tap pada info icon "ⓘ" (bukan hover — mobile-first, tidak ada hover)
- Muncul sebagai popover kecil dekat trigger, radius `xs`, border `border-default`, background `surface-elevated`
- Dismiss: tap di luar area tooltip

### 9.25 Chip / Filter Tag *(baru)*
- Pelengkap BottomSheet filter (§10) — shortcut cepat di halaman utama (mis. riwayat transaksi)
- Multi-select, radius `full`, outline style konsisten dengan Badge (§9.7) tapi bisa di-tap toggle
- Selected state: fill `primary`, teks `primary-foreground`

### 9.26 Rating / Review *(baru)*
- Dipakai untuk rating antar-user pasca transaksi escrow selesai
- **Tetap monokrom** (bukan bintang kuning/emas standar) — konsisten dengan aturan brand: ikon `Star`/`StarFill` Phosphor, filled state `primary`, unfilled `border-default`
- Skala 1-5, tampil sebagai baris ikon bintang + opsional skor angka Mono di sampingnya

---

## 10. Aturan Navigasi: BottomSheet vs Push vs Modal

Tidak berubah dari v1.0, plus:

| Situasi | Pattern |
|---|---|
| Alur panjang/multi-step (checkout, buat transaksi escrow, KYC) | **Push** halaman baru |
| Detail lengkap dengan banyak data | **Push** halaman baru |
| Form pendek, pilihan/filter, preview cepat, action menu | **BottomSheet** |
| Konfirmasi PIN/biometric | **BottomSheet** |
| Konfirmasi destruktif atau alert wajib | **Modal/Dialog** center |
| Sheet perlu memicu sheet lain | **Tidak diizinkan** — sheet pertama close dulu (lihat §9.9) |

---

## 11. Web App

Layout & komponen sama persis dengan mobile, responsive.

- **Breakpoint:** tunggal di ~768px. Di atas breakpoint, konten di-cap **max-width 520px**, center di layar — tetap terasa seperti mobile app, bukan layout desktop terpisah.
- **Tablet:** belum jadi prioritas — untuk saat ini ikut treatment sama seperti breakpoint mobile/di bawah 768px, di-scale/center. Penyesuaian grid 2-kolom bisa menyusul kalau dibutuhkan.
- **Grid multi-elemen** (mis. dashboard dengan beberapa stat card sejajar): grid 12 kolom formal — lebih scalable untuk layout kompleks ke depan dibanding flex-wrap sederhana.
- **Bottom tab bar** tetap dipertahankan di breakpoint mobile-width pada web.
- **Hover state:** **tidak didefinisikan secara khusus** — web mengikuti behavior yang sama seperti versi tap di mobile, tanpa treatment hover terpisah (cursor tetap default pointer di elemen interaktif, tapi tanpa perubahan visual saat hover).

---

## 12. Voice & Tone

*(Baru — belum ada di v1.0)*

- **Tone:** formal, pakai **"Anda"** — konsisten dengan kesan institusional/lembaga terpercaya yang jadi prinsip inti visual sistem ini juga.
- **Bahasa:** Bahasa Indonesia untuk v1, tapi struktur copy disiapkan i18n-ready (key-based, bukan hardcoded string) supaya gampang ditambah bahasa lain nanti tanpa refactor besar.
- **Tagline:** lihat draft di bagian atas dokumen — menunggu persetujuan final.

---

## 13. Format Data & Lokalisasi

*(Baru — belum ada di v1.0)*

- **Mata uang:** titik sebagai pemisah ribuan, **tanpa desimal** (Rupiah umumnya bulat) — format: `Rp1.000.000`.
- **Tanggal & waktu:** selalu format lengkap eksplisit (mis. "3 Sep 2026, 14:30") — **tidak pakai relative time** ("2 jam lalu"), demi presisi yang konsisten dengan prinsip data akurat.
- **Cakupan escrow:** uang Rupiah konvensional (transfer bank/e-wallet) — tidak termasuk crypto/aset digital, jadi tidak perlu komponen wallet address/QR khusus di scope ini.

---

## 14. Keamanan & Sesi

*(Baru — belum ada di v1.0)*

- **Session timeout:** re-autentikasi (PIN/biometric) diperlukan setiap kembali dari background, **dengan grace period** — kalau app di background kurang dari 1 menit, tidak perlu re-auth; di atas itu, minta PIN/biometric lagi.
- **PIN/Biometric lockout:** lihat §9.21 — lockout progresif dengan countdown.

---

## 15. Rekomendasi Tech Stack

Tidak berubah dari v1.0.

- **Styling:** NativeWind
- **Routing:** Expo Router (file-based)
- **Animasi:** `react-native-reanimated` + `react-native-gesture-handler`
- **Bottom Sheet:** `@gorhom/bottom-sheet`
- **Icon:** `phosphor-react-native` (mobile) / `phosphor-react` (web)

---

## 16. Langkah Selanjutnya

1. ~~Review dokumen ini~~ — **selesai**, v1.1 ini hasil review lewat 48 keputusan
2. **Selanjutnya:** `tokens.ts` — semua nilai di atas (warna, spacing, radius, typography, motion, z-index) dalam format reusable untuk `tailwind.config.js` (NativeWind) & web
3. Komponen dasar satu per satu sesuai prioritas (Button, Input, Card, BottomSheet dulu)
4. Komponen khusus escrow (OTP, KYC viewer, Signature Pad, PIN sheet) menyusul, termasuk 5 komponen baru di §9.22–9.26
5. Logo final (dikonfirmasi sudah ada) — perlu dilampirkan untuk diintegrasikan ke splash & pull-to-refresh custom
