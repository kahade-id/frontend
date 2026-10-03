# Audit UI/UX Frontend Kahade — 2026-10-03

**Repo:** `kahade-id/frontend` · **Basis:** `origin/main @ 1b1797c` · **Branch laporan:** `docs/uiux-audit-2026-10-03`
**Metode:** 6 auditor spesialis, read-only, bukti konkret file:line per temuan. Satu issue = satu root cause.

## Ringkasan Eksekutif

| Severity | Jumlah | Artinya |
|----------|--------|---------|
| P0 | 1 | Merusak / membingungkan parah |
| P1 | 36 | Mengganggu nyata |
| P2 | 92 | Polish / inkonsistensi |
| **Total unik** | **129** | (133 mentah − 4 duplikat digabung) |

| Area | Jumlah |
|------|--------|
| A. Konsistensi Visual | 24 |
| B. Alur UX & Intuitifitas | 19 |
| C. Performance | 20 |
| D. Form & Input | 18 |
| E. Aksesibilitas & Copy | 17 |
| F. Layar Dagang & Chat | 31 |

**Duplikat yang digabung:** "Lawan" (E-002→F-008), "Voice note" (E-004→F-019), "Foto standar/asli" (E-018→F-018), "Swipe reply tak terdiscover" (B-014→F-021).

**Catatan keputusan produk:** F-001 (harga dihapus dari feed), F-015 (banner anti-tipu di menu ⋮), F-023 (label lampiran generik) adalah keputusan user yang disengaja — tetap dilaporkan karena berdampak ke orang awam; keputusan akhir di tangan user.

---

## A. Konsistensi Visual (24)

| ID | Sev | File:Line | Masalah | Dampak | Saran Fix |
|----|-----|-----------|---------|--------|-----------|
| UIUX-001 | P1 | `components/ui/order-counterparty-card.tsx:51,74` + `app/scan.tsx:36,37` | `rounded-xl`/`rounded-2xl` tidak ada di theme (borderRadius di-override `tailwind.config.js:18`) → class diabaikan NativeWind, sudut jadi kotak | Kartu counterparty & frame scan QR tampil bersudut tajam, tidak sesuai maksud desain | Ganti ke `rounded-lg` (12px) atau daftarkan `xl=16px` di `tokens.radius` |
| UIUX-002 | P1 | `components/ui/chat-cards.tsx:80,127`, `chat-location-card.tsx:53,114`, `chat-poll-card.tsx:84,146,155`, `badge.tsx:103` + ~25 lokasi | Ukuran ikon 12/14/18/22px di luar skala resmi §7 (16/20/24/28/32) | Ikon antar layar tidak sejajar ritme visual | Petakan ke skala terdekat (12→16, 14→16, 18→20, 22→24) atau dokumentasikan pengecualian di `tokens.icon` |
| UIUX-003 | P1 | `app/settings.tsx` + `app/wallet.tsx:390,403,416` + `app/transfer.tsx` + `app/referral.tsx` + `app/vouchers.tsx` + `app/wallet-history.tsx` + `app/withdraw.tsx` + 5 layar lain (12 file) | Screen padding `px-4` (16px) vs standar `px-5` (20px, `tokens.layout.screenPaddingX`); `app/settings.tsx:291` bahkan mengakui px-4 salah | Gutter kiri-kanan tidak rata antar layar — "layar ini lebih sempit" | Samakan ke `px-5` (atau `<Screen padded>`) |
| UIUX-004 | P1 | `components/ui/chat-room-list-item.tsx:197` | Baris chat pakai `px-4` + `py-2.5` (10px, di luar skala) + `min-h-16` | Baris daftar chat 4px lebih sempit dari ListItem standar, padding vertikal tidak kelipatan 4 | Ganti ke `px-5 py-3` agar sejajar ListItem |
| UIUX-005 | P1 | `components/ui/otp-input.tsx:126-133` | Kotak OTP resting pakai `border-transparent` (tak terlihat) + `border-[1.5px]` arbitrary; form control lain resting = border terlihat | Kotak OTP terlihat "tanpa bingkai" dibanding Input/Select | Resting → `border-border-control`; 1.5px hanya untuk focus/error sesuai token |
| UIUX-006 | P1 | `app/scan.tsx:39` | Satu-satunya `<Text>` RN mentah di `app/` + class `text-sm` (bypass skala DS) | Teks "Menyiapkan kamera…" tidak ikut font family/weight/allowFontScaling DS | Pakai `<Text variant="caption">` dari `components/ui/text` |
| UIUX-007 | P2 | `components/ui/showcase-gallery-grid.tsx:195`, `components/ui/transaction-progress-overlay.tsx:199,201` | Ikon Phosphor dirender mentah tanpa wrapper `<Icon>` — melanggar aturan AGENTS.md | Kehilangan guard glyph-undefined, tone mode-aware, konsistensi weight | Bungkus dengan `<Icon icon={...} size tone>` |
| UIUX-008 | P2 | `components/ui/count-badge.tsx:88` | `leading-[16px]` menimpa line-height caption (18px) | Teks angka badge sedikit lebih rapat dari caption standar | Hapus `leading-[16px]`, biarkan `text-caption` (18px) |
| UIUX-009 | P2 | 8+ file `components/ui/chat-*.tsx` (`gap-1.5`), `chat-room-list-item.tsx:197`, `chat-ephemeral-sheet.tsx:62`, `onboarding-checklist.tsx:137`, `showcase-feed-item.tsx:441` (`px-2.5`) | Nilai fraksional Tailwind (6px, 10px) di luar skala space 4px-base | Ritme spacing tidak kelipatan 4 — deviasi kecil tapi sistemik | Petakan ke skala (6px→gap-2/gap-1, 10px→p-2/py-3) atau tambah langkah resmi ke `tokens.space` |
| UIUX-010 | P2 | `components/ui/typography.tsx:30-54` | Komentar drift: `<Paragraph>` disebut "body 14/22", `<Label>` "13/18" — token aktual body 15/24, label 14/19 | Developer meniru angka yang salah | Perbaiki komentar ke angka token aktual |
| UIUX-011 | P2 | `components/ui/section.tsx:12-13` | Komentar drift: h2 "22/700", h3 "18/600" — token aktual h2 24/33/700, h3 20/29/600 | Dokumentasi vs implementasi beda | Perbaiki komentar |
| UIUX-012 | P2 | `components/ui/text.tsx:40-41` vs `lib/tokens.ts:413` | Klaim bertolak belakang soal Dynamic Type OS ("mengikuti" vs "fixed") | Tidak jelas apakah teks boleh membesar mengikuti aksesibilitas OS | Samakan satu pernyataan yang benar (cek allowFontScaling aktual) |
| UIUX-013 | P2 | `components/ui/button.tsx:18-19` | Komentar drift: secondary disebut border gray.400/#3A3A3A — sejak retint v2.2, border-border = #D1D5DB/#3F3F3F | Komentar menyesatkan soal warna outline button | Perbarui ke nilai token mode-aware aktual |
| UIUX-014 | P2 | `components/ui/menu-list.tsx:81` | Section menu pakai `px-4` sedangkan ListItem standar `px-5` | Baris menu 4px lebih masuk dari baris list lain di layar yang sama | Ganti ke `px-5` |
| UIUX-015 | P2 | `components/ui/card.tsx:120` | Card selected pakai `p-[19.5px]` (hack fraksional kompensasi border 1px) | Padding tidak di skala; konten bergeser 0.5px saat selected — rapuh | Pakai border di dalam (box-sizing) atau outline, bukan padding fraksional |
| UIUX-016 | P2 | `components/ui/switch.tsx:110` | Switch berlabel pakai `gap-4` (16px); Checkbox (:140) dan Radio (:180) pakai `gap-3` (12px) | Jarak label tidak konsisten antar kontrol form | Samakan ke `gap-3` |
| UIUX-017 | P2 | `components/ui/tabs.tsx:272` | Indikator tab aktif pakai `rounded-t-[2px]` arbitrary | Radius 2px tidak di skala radius token | Ganti ke `rounded-xs` (4px) atau dokumentasikan |
| UIUX-018 | P2 | `components/ui/segmented-control.tsx:117,162` | `p-[2px]` dan `min-h-[38px]` arbitrary (padahal 2px = space[0.5]) | Sintaks arbitrary menyembunyikan hubungan ke token | Ganti `p-[2px]`→`p-0.5`; 38px → dokumentasikan turunan atau token |
| UIUX-019 | P2 | `components/ui/referral-reward.tsx:182`, `app/(auth)/whatsapp-trigger.tsx:543`, `components/ui/transaction-summary.tsx:59` | Letter-spacing arbitrary Tailwind vs token `letterSpacing.mono` = 0.5px | Spasi huruf kode referral/mono tidak seragam | Pakai `tracking-mono` dari token |
| UIUX-020 | P2 | `components/ui/action-sheet.tsx:115` | Baris aksi `min-h-[52px]` vs ListItem standar `min-h-14` (56px) | Baris action sheet 4px lebih pendek — sentuhan terasa beda | Samakan ke `min-h-14` |
| UIUX-021 | P2 | `components/ui/action-sheet.tsx:115` vs `list-item.tsx:133` | Action sheet `gap-2` (8px) tapi ListItem `gap-3` (12px) | Jarak ikon–teks beda antar pola baris | Putuskan satu nilai (token = 8px) dan samakan |
| UIUX-022 | P2 | `app/privacy-settings.tsx:166,569` | Pressed feedback pakai `active:opacity-70` manual, bukan token pressed | Umpan balik sentuh beda dari pola DS | Ganti ke pola pressed standar (`active:bg-surface` atau token pressed) |
| UIUX-023 | P2 | `components/ui/divider.tsx:5` | Komentar drift: "bg-border (gray.400/#3A3A3A)" — nilai pra-retint v2.2 | Dokumentasi warna divider salah | Perbarui ke nilai token aktual |
| UIUX-024 | P2 | `components/ui/amount-keypad.tsx:483`, `chat-system-card.tsx:69`, `chat-format-bar.tsx:60` + ~12 lokasi | `tone="tertiary"` pada variant kecil — Text otomatis downgrade ke secondary, intent di call-site salah walau visual aman | Menutupi pelanggaran aturan hierarki §2.2 | Ganti ke `tone="secondary"` di variant < 18px |

---
## B. Alur UX & Intuitifitas (19)

| ID | Sev | File:Line | Masalah | Dampak | Saran Fix |
|----|-----|-----------|---------|--------|-----------|
| UIUX-025 | P1 | `app/support.tsx:84` | `DataScreen empty` hanya aktif bila `tickets.length===0`; bila pencarian/filter menghasilkan 0 hasil (`visible` kosong) area list blank tanpa umpan balik | User mengira tiketnya hilang | Tambah cabang: `visible` kosong → EmptyState "Tidak ada hasil" + aksi "Hapus pencarian" |
| UIUX-026 | P1 | `app/(auth)/login.tsx:338` + `lib/passkey.ts:303` | `setFormError(err.message)` untuk PasskeyError; cabang UNKNOWN meneruskan pesan browser mentah (bisa Inggris/teknis) | User awam bingung | Petakan UNKNOWN ke copy Indonesia generik |
| UIUX-027 | P1 | `app/returns/new.tsx:92` | Empty state "Pesanan tidak ditemukan" pakai `router.back()` mentah — dari deep link rusak (stack kosong) itu no-op → layar buntu | Layar buntu tanpa jalan keluar | Pakai `goBackOrNavigate(ROUTES.transactions)` |
| UIUX-028 | P2 | `app/(auth)/onboarding.tsx:29` | `handleRegister` memanggil `markOnboardingSeen()` lalu replace ke register — tombol back di "Buat Akun" mendarat di "Masuk", bukan pilihan Daftar/Masuk | User yang berubah pikiran tak bisa kembali ke pilihan awal | Jangan tandai seen sebelum auth selesai, atau set `onBack` eksplisit ke onboarding |
| UIUX-029 | P2 | `lib/notification-routing.ts:253` | `logicalParentForPath` default → home untuk SEMUA head tak dikenal termasuk login/register — back dari cold-start /login me-replace ke tab Etalase yang langsung di-guard auth | Tombol back terasa mati | Petakan head auth ke `ROUTES.login` |
| UIUX-030 | P2 | `app/payment/finish.tsx:215` | Layar sukses hanya punya "Lihat Transaksi"; tidak ada "Lihat pesanan" menuju order yang baru dibayar | User harus mencari manual ordernya | Bila `verifyKind==="order" && verifyId`, tampilkan "Lihat pesanan" → `ROUTES.orderDetail(verifyId)` |
| UIUX-031 | P2 | `app/tracking/[shipmentId].tsx:190` | "Belum ada event tracking." sebagai `<Text>` polos, bukan `<EmptyState>` | Terlihat seperti teks nyasar/bug | Ganti compact `EmptyState` + ikon |
| UIUX-032 | P2 | `components/receipt/shareReceipt.ts:49,88` | `Alert.alert` platform mentah saat gagal bagikan/unduh struk, padahal app memakai Dialog/toast bermerek | Inkonsisten & off-brand | Kembalikan error ke pemanggil, tampilkan via toast/Dialog |
| UIUX-033 | P2 | `lib/device-integrity.ts:86` | `Alert.alert` mentah berteks panjang untuk pemblokiran perangkat ter-root pada aksi finansial | Sulit dibaca, off-brand, tanpa aksi lanjutan | Ganti `<Dialog>` bermerek + tombol tutup yang jelas |
| UIUX-034 | P2 | `app/(auth)/verify-otp.tsx:273` | `otpRef.current?.focus()` di `catch` setiap kegagalan — keyboard dipaksa muncul lagi walau user sudah menutupnya | Fokus dicuri, mengganggu | Hapus auto-focus atau hanya focus bila input memang aktif |
| UIUX-035 | P2 | `app/index.tsx:113` | `gate===null → return null` (blank total) selama baca SecureStore; splash hanya menutupi boot pertama | Bila keychain lambat, user menatap layar kosong | Tampilkan skeleton/label setelah timeout singkat |
| UIUX-036 | P2 | `app/(tabs)/showcase.tsx`, `app/(tabs)/chat.tsx`, `app/(tabs)/notifications.tsx` | Fallback `Suspense` hanya skeleton list tanpa header — header + judul "pop-in" setelah modul lazy termuat | Layout shift | Sertakan placeholder header di fallback |
| UIUX-037 | P2 | `app/(auth)/onboarding.tsx:37` | Tagline: "Jual beli aman dengan escrow." — "escrow" jargon bagi awam | Melanggar "langsung paham tanpa penjelasan" | Ganti bahasa polos: "Uang pembeli disimpan aman sampai barang diterima." |
| UIUX-038 | P2 | `app/(auth)/register.tsx:91` | `useLeaveConfirm` aktif padahal user baru mengetik digit nomor HP (satu field, mudah diketik ulang) | Friksi keluar tak proporsional | Naikkan ambang (aktif setelah langkah kata sandi) |
| UIUX-039 | P2 | `components/screens/showcase-detail-screen.tsx:979` | Double-tap media = suka (`onDoubleTap`), tanpa petunjuk discoverability | User tak tahu cara pintas ini ada | Tooltip/hint sekali-tampil |
| UIUX-040 | P2 | `components/ui/chat-composer.tsx:193` | Picker template balasan cepat hanya muncul bila mengetik `/`; satu-satunya petunjuk di subtitle settings, tidak ada hint di composer | Fitur tersembunyi | Tambah hint di placeholder atau tombol akses template di composer |
| UIUX-041 | P2 | `app/delete-account.tsx:155-175` | Layar sukses tampilkan kode referensi + tombol "Ke Layar Masuk" tanpa gate pengakuan — user bisa pergi tanpa menyimpan kode WAJIB untuk pembatalan | Risiko kehilangan satu-satunya jalan pembatalan | Wajibkan centang "Saya sudah menyimpan kode" sebelum tombol aktif |
| UIUX-042 | P2 | `components/ui/chat-room-header.tsx:240` | Identitas ruang (avatar+nama) bisa diketuk buka profil tapi tanpa affordance visual | User tak tahu area itu interaktif | Tambahkan chevron kecil |
| UIUX-043 | P2 | `app/payment/finish.tsx:209-218` | Status `unknown` tanpa target: tombol "Cek status di Transaksi" pakai `router.replace` — konteks hilang, back tak bisa kembali | Back tak bisa kembali ke layar status | Pakai `router.push` agar back kembali, atau tampilkan ringkasan orderId di layar |

---
## C. Performance (20)

| ID | Sev | File:Line | Masalah | Dampak | Saran Fix |
|----|-----|-----------|---------|--------|-----------|
| UIUX-044 | P1 | `components/showcase-related-card.tsx:31,46` | `ShowcaseRelatedCard` tidak di-`memo`; di-render via `.map()` di ScrollView horizontal; `onPress` inline; tiap kartu memanggil `useShowcaseSocialActions` + `useLanguage` | Setiap render layar detail (ketik komentar, dsb.) me-render ulang semua kartu "Karya terkait" | Bungkus `memo` + `useCallback` untuk onPress |
| UIUX-045 | P1 | `lib/use-showcase-social-actions.ts:173` | `useLoginNextPath` memanggil `usePathname()` + `useGlobalSearchParams()` di SETIAP kartu (via `useShowcaseSocialActions`); `router.setParams({kind})` saat ganti tab membangunkan ulang SEMUA kartu ter-mount | Ganti tab/filter = re-render massal seluruh kartu feed | Hitung nextPath lazy hanya saat `requireLogin()` dipanggil, atau baca params sekali di induk |
| UIUX-046 | P1 | `app/order-links.tsx:195` | `renderLinkItem` membuat 4 closure inline per baris + komputasi meta di dalam renderItem; `OrderLinkShareCard` tidak di-memo; dep `cancelTarget?.token` mengganti identitas renderItem | Membatalkan satu tautan me-render ulang semua baris | Ekstrak komponen baris `memo` dengan handler stabil per-id |
| UIUX-047 | P1 | `components/ui/showcase-likers-sheet.tsx:233,253` | Daftar likers/savers via `.map()` non-virtualisasi di BottomSheet; "Muat lebih banyak" 20/halaman tanpa batas; `formatRelativeTime` per baris per render; onPress inline | Sheet lag/patah saat karya viral (100+ penyuka) | Ganti FlatList virtualisasi + baris memo + precompute label waktu |
| UIUX-048 | P1 | `components/ui/profile-etalase-tab.tsx:141` | Tab etalase profil me-render `.map()` + `renderLimit` (+20 per ketuk, tanpa batas) di dalam ScrollView — tidak tervirtualisasi | Profil dengan ratusan karya: mount massal, boros memori & jank | Hard-cap + tautan "lihat semua" ke layar penuh bervirtualisasi |
| UIUX-049 | P2 | `components/showcase-detail-comments.tsx:75` | `ShowcaseDetailComments` tidak di-memo; komentar via `.map()` (40 per "muat lagi") di ScrollView; onPress inline per baris | Utas 100+ komentar: scroll berat, toggle balasan me-render ulang semua | Ekstrak baris memo + handler stabil per id |
| UIUX-050 | P2 | `components/ui/showcase-gallery-grid.tsx:96,243` + `components/screens/showcase-management-screen.tsx:937` | Grid tidak di-memo; onPress inline per sel; pemanggil juga inline onPressItem | Tiap render layar kelola me-render ulang seluruh grid | Memo grid + sel memo |
| UIUX-051 | P2 | `components/ui/feed-video.tsx:532` (lih. `:89`) | `require("expo-video")` di body `ExpoVideoPlayerInner` — dieksekusi tiap render tiap player | Overhead per-render | Hoist ke module scope via `getExpoVideoModule()` yang sudah ada |
| UIUX-052 | P2 | `components/ui/image-viewer.tsx:145` | `renderItem` ber-dep pada `current`; tiap ganti halaman identitas renderItem baru → FlatList me-render ulang semua slide ter-mount tiap swipe | Swipe terasa berat di galeri banyak foto | Baca `current` via ref di dalam renderItem, atau memo-kan slide |
| UIUX-053 | P2 | `components/ui/chat-day-separator.tsx:49` | `ChatDaySeparator` tidak di-memo; dipakai tiap pemisah hari sticky di thread | Re-render tak perlu saat thread berubah | Bungkus `memo` |
| UIUX-054 | P2 | `components/ui/chat-message-row.tsx:536` | `areRowPropsEqual` mengabaikan `votingPollId`, `closingPollId`, `onVotePoll`, `onClosePoll`, `onRefreshAttachmentUrl` | Perubahan state voting/refresh URL tak me-render ulang → risiko UI basi (spinner voting tak muncul) | Tambahkan ke komparator atau pindahkan state ke store per-pesan |
| UIUX-055 | P2 | `components/ui/picture.tsx:102` | Prop `placeholder` (blurhash) tidak pernah dipakai satu pun pemanggil di seluruh repo | Tak ada progressive image placeholder, gambar pop-in setelah skeleton | Kirim blurhash/thumb sebagai placeholder dari backend |
| UIUX-056 | P2 | `components/screens/chat-tab-screen.tsx:1017` | `renderChatRoomItem` ber-dep pada `typingRooms`/`selected`/`selecting` → indikator "mengetik" di satu room mengganti identitas renderItem | Aktivitas mengetik lawan bicara memicu kerja list | Baca status typing via store per-baris (pola selectionStore) |
| UIUX-057 | P2 | `components/screens/chat-room-screen.tsx:3256` | `stickyHeaderIndices` di FlatList chat inverted — sticky header di RN Android memicu layout pass ekstra | Jank saat scroll thread panjang di Android | Ukur dampak; pertimbangkan pemisah hari non-sticky |
| UIUX-058 | P2 | `components/ui/showcase-media-gallery.tsx:105,185` | `media.map(m=>m.id).join("\|")` dihitung dua kali per render hanya sebagai dep effect | O(n) alokasi string ganda tiap render galeri | Hitung sekali via useMemo |
| UIUX-059 | P2 | `components/ui/progress-bar.tsx:1` | Mode determinate menganimasikan `width` via RN Animated dengan `useNativeDriver:false` (JS thread); update tiap chunk upload | Upload file besar membebani JS thread | Throttle update progres atau pakai `scaleX` + native driver |
| UIUX-060 | P2 | `lib/use-clock-tick.ts:34` | Satu interval 1 Hz membangunkan tiap subscriber via `setNowMs` masing-masing → N commit React/detik untuk N countdown ter-mount | Puluhan countdown = puluhan re-render/detik | Pastikan konsisten memakai `useFocusedClockTick` agar hanya layar fokus yang berdetak |
| UIUX-061 | P2 | `components/showcase-feed-tab.tsx:423` | `onScroll` JS (throttle 16ms) dan `onScrollWorklet` (runOnJS) keduanya memanggil `trackScrollOffset` → `setShowScrollTop` dievaluasi 2x per event scroll di Android | Kerja redundan per frame scroll | Panggil hanya satu jalur per platform |
| UIUX-062 | P2 | `app/extension/[orderId].tsx:427` + `components/ui/order-extension-card.tsx:145` | `items.map` menghitung nama pihak per item tiap render; `OrderExtensionCard` tidak di-memo | Tiap render layar me-render ulang semua kartu perpanjangan | Precompute view-model via useMemo + memo kartu |
| UIUX-063 | P2 | `app/saved.tsx:86` | `refreshOnFocus: true` TANPA `refreshOnFocusStaleMs` (satu-satunya dari 38 pemakaian) → tiap kembali ke "Tersimpan" selalu tembak `GET users/saved-profiles` | Request jaringan redundan tiap bolak-balik layar | Tambah `refreshOnFocusStaleMs: 30_000` |

---
## D. Form & Input (18)

| ID | Sev | File:Line | Masalah | Dampak | Saran Fix |
|----|-----|-----------|---------|--------|-----------|
| UIUX-064 | P1 | `app/bank-accounts.tsx:114` (duplikat `app/change-email.tsx:175`, `app/change-password.tsx:149`) | Field MFA fallback "Kode autentikator / kode cadangan" pakai keyboard QWERTY penuh untuk kode 6-digit | User TOTP harus ganti keyboard manual ke angka setiap kali | Tambah `keyboardType="number-pad"` + `inputMode="numeric"`; idealnya pisah dua mode seperti `verify-2fa.tsx` |
| UIUX-065 | P1 | `app/change-password.tsx:149` (+ `app/change-email.tsx:175`) | Field MFA muncul dinamis setelah server jawab TWO_FA_REQUIRED tapi tidak pernah mengambil fokus — keyboard bahkan tertutup pasca-submit | User 2FA tidak sadar ada field baru yang wajib diisi | useEffect: saat mfaRequired true → `mfaRef.current?.focus()` |
| UIUX-066 | P1 | `app/patungan/index.tsx:273` | Sheet "Buat grup" berisi 4–5 Input tanpa satu pun returnKeyType/onSubmitEditing/ref | Di BottomSheet, tombol aksi keyboard tidak melakukan apa-apa di semua field | Tambah chaining next antar field + done di terakhir → handleCreate |
| UIUX-067 | P1 | `app/ratings.tsx:508` | TextArea "Tulis balasan" di Dialog tanpa autoFocus | Keyboard tidak muncul — harus tap area teks dulu | Tambah autoFocus pada TextArea |
| UIUX-068 | P1 | `app/(auth)/verify-2fa.tsx:224` (+ `app/verify-email.tsx:207`) | OtpInput TOTP tanpa onComplete → tidak auto-submit saat 6 digit lengkap, padahal pola auto-submit sudah mapan (withdraw, two-factor, change-pin, transfer) | User mengetik 6 digit lalu menunggu tanpa tahu harus tap "Verifikasi" | Tambah `onComplete={(c) => void handleVerify(c)}` |
| UIUX-069 | P1 | `app/create-transaction.tsx:991` | AmountInput "Nilai transaksi" wajib tapi tanpa prop `required` → tanpa tanda "*" | User tidak tahu nominal itu wajib sampai tombol mati | Tambah `required` pada AmountInput |
| UIUX-070 | P2 | `app/bank-accounts.tsx:109` | PasswordField `returnKeyType={mfaRequired ? "next" : "done"}` tanpa onSubmitEditing | Saat field MFA tampil, tombol "Lanjut" di keyboard tidak memindahkan fokus (terasa mati) | Tambah ref ke Input MFA + onSubmitEditing focus |
| UIUX-071 | P2 | `app/change-password.tsx:123,130,138` | Tiga PasswordField tanpa returnKeyType/onSubmitEditing sama sekali | Tidak ada "Lanjut" antar field; harus tap tiap field manual | Terapkan chaining seperti `register-security.tsx:323-389` |
| UIUX-072 | P2 | `app/change-email.tsx:147,163` | EmailField pertama tanpa autoFocus dan tanpa returnKeyType="next"; PasswordField tanpa "next" | Layar dibuka keyboard tidak muncul; tidak ada navigasi keyboard antar field | Tambah autoFocus + returnKeyType next/done dengan onSubmitEditing |
| UIUX-073 | P2 | `app/create-transaction.tsx:943,991` | Input "Judul" tanpa returnKeyType="next"/onSubmitEditing ke deskripsi; AmountInput tanpa returnKeyType="done" | Tombol aksi keyboard tidak berfungsi di form utama | Tambah returnKeyType next + onSubmitEditing; "done" di AmountInput |
| UIUX-074 | P2 | `app/kyc.tsx:344` | Input NIK `returnKeyType="done"` tanpa onSubmitEditing | Tombol "Selesai" hanya menutup keyboard — menyesatkan bila dikira submit | Tambah onSubmitEditing ke langkah berikutnya, atau hapus returnKeyType |
| UIUX-075 | P2 | `app/security-activity.tsx:631` | Input "Kata sandi akun" di Dialog tanpa autoFocus dan tanpa returnKeyType="done" | Dialog terbuka tapi keyboard tidak muncul | Tambah autoFocus + returnKeyType="done" + onSubmitEditing |
| UIUX-076 | P2 | `app/extension/[orderId].tsx:499` | TextArea "Catatan untuk penjual" di Dialog tanpa label — hanya placeholder | Placeholder hilang saat diketik; field tidak bernama saat terisi | Tambah `label="Catatan (opsional)"` |
| UIUX-077 | P2 | `components/ui/pin-pad.tsx:96` | Tombol "Hapus" hanya menghapus 1 digit per tap, tanpa long-press untuk hapus semua | PIN 6 digit salah ketik harus dihapus 6× tap | Tambah onLongPress → kosongkan seluruh PIN |
| UIUX-078 | P2 | `app/receive.tsx:120,211` | Layar "Terima Saldo" berisi Input nominal tanpa KeyboardAvoidingView — satu-satunya layar form tanpa penanganan keyboard | Di layar kecil keyboard menutupi field | Bungkus dengan `<KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>` |
| UIUX-079 | P2 | `app/verify-email.tsx:207` | OtpInput tanpa autoFocus, padahal `verify-otp.tsx:473` memilikinya | User harus tap kotak digit dulu sebelum mengetik | Tambah autoFocus |
| UIUX-080 | P2 | `components/ui/amount-input.tsx:78` | rangeError di-skip saat value===0: submit dengan nominal kosong → CTA disabled tanpa pesan inline | User tidak tahu kenapa tombol "Buat transaksi" mati | Tampilkan "Nominal wajib diisi" saat field tersentuh/submit dicoba |
| UIUX-081 | P2 | `app/milestones/[id].tsx:457` | DateField "Tenggat baru (opsional)" tanpa helperText rentang tanggal | Hari di luar [besok, +14 hari] disabled tanpa penjelasan kenapa | Tambah helperText="Tanggal yang bisa dipilih: besok hingga 14 hari ke depan." |

---
## E. Aksesibilitas & Copy (17)

| ID | Sev | File:Line | Masalah | Dampak | Saran Fix |
|----|-----|-----------|---------|--------|-----------|
| UIUX-082 | P1 | `components/auth/login-method-sheet.tsx:79` | 5 opsi metode login (PressableScale) tanpa `accessibilityRole="button"` | TalkBack/VoiceOver membacanya sebagai teks biasa — tunanetra tidak tahu bisa diketuk | Tambah `accessibilityRole="button"` |
| UIUX-083 | P1 | `components/screens/transactions-tab-screen.tsx:374` | Empty state seller: "...untuk mulai menerima **order**." — kata Inggris di tengah kalimat Indonesia | Inkonsisten, kesan belum diterjemahkan | Ganti → "menerima pesanan." |
| UIUX-084 | P1 | `components/patungan-jastip/how-it-works-screen.tsx:67,69` | "Buyer" dipakai 2× padahal kanonis "Pembeli" (38×) dan "Penjual" (51×) | Inkonsisten istilah | Ganti semua "Buyer" → "pembeli" |
| UIUX-085 | P1 | `components/patungan-jastip/how-it-works-screen.tsx` (seluruh file) | Semua copy di-hardcode — 0× `translate()`; pengguna English dapat layar Indonesia penuh | Lubang i18n di layar edukasi | Bungkus semua string dengan `translate()` |
| UIUX-086 | P1 | `components/pending-actions-banner.tsx:64,66,76,84,90` | String meta mentah tanpa `translate()` ("Periksa status pembayaran pesanan Anda", "nominal belum diketahui", dll.) — title-nya translate, meta-nya tidak | Pengguna English dapat kalimat Indonesia | Bungkus semua dengan `translate()` |
| UIUX-087 | P1 | `components/ui/notification-preferences-matrix.tsx:71-75` | Channel "Push" (EN) di antara "Di aplikasi"/"Email"; "tenggat **order**", "**Top-up**" (kanonis "Isi saldo"), "**Login** baru" (kanonis "Masuk") | Campuran bahasa di layar pengaturan | Ganti → "Notifikasi push", "tenggat pesanan", "Isi saldo", "Sesi masuk baru" |
| UIUX-088 | P2 | `components/patungan-jastip/how-it-works-screen.tsx:55,58,65,67,69` | Penekanan ALL CAPS: "SEBELUM", "MENGUNCI", "OTOMATIS", "SETELAH" — teriak & melanggar Apple-clean; screen reader mengeja per huruf | Ganti caps dengan `weight={700}`/warna aksen |
| UIUX-089 | P2 | `components/ui/showcase-saved-collection.tsx:307` | "Simpan etalase yang **kamu** suka..." — "kamu" satu-satunya di seluruh UI; app memakai "Anda" | Inkonsisten sapaan | Ganti → "yang Anda suka" |
| UIUX-090 | P2 | `app/(auth)/setup-profile.tsx:379` vs `app/edit-profile.tsx:713` | Field yang sama berlabel "Tentang Anda" (daftar) vs "Bio" (ubah) | Pengguna mengira dua field berbeda | Samakan → "Bio" di keduanya |
| UIUX-091 | P2 | `app/account-type.tsx:69,74` | "Produk dan riwayat penjualan terlihat publik di profil." — "Produk" padahal kanonis "Etalase" | Inkonsisten istilah | Ganti → "Etalase dan riwayat penjualan..." |
| UIUX-092 | P2 | `app/seller/products/[id].tsx:139` | Toast `title: "Produk disimpan"` — tanpa `translate()` DAN istilah "Produk" (bukan "Etalase") | Lubang i18n + inkonsistensi | Ganti → `translate("Etalase disimpan")` |
| UIUX-093 | P2 | `components/ui/profile-edit-sheet.tsx:348` | "...diubah di **Edit** lengkap." — "Edit" satu-satunya; kanonis "Ubah" (21×) | Inkonsisten | Ganti → "di Ubah lengkap." |
| UIUX-094 | P2 | `components/screens/user-profile-screen.tsx:137` | Alasan lapor: "**Link**/jualan tidak relevan" — "Link" EN; kanonis "Tautan" | Inkonsisten | Ganti → "Tautan/jualan tidak relevan" |
| UIUX-095 | P2 | `components/ui/chat-message-bubble.tsx:582,616`, `components/app-lock-gate.tsx:196`, `components/receipt/ReceiptTicket.tsx:325,372`, `components/dana-checkout-sheet.tsx:251` | `accessibilityLabel`/`accessibilityHint` di-hardcode Indonesia tanpa `translate()` | Screen reader English mengumumkan Bahasa Indonesia | Bungkus semua label a11y dengan `translate()` |
| UIUX-096 | P2 | `app/notification-preferences.tsx:533-536` | Alert "Notifikasi **browser** diblokir... Klik ikon kunci di **address bar**" — copy web di aplikasi native-only | Pengguna HP bingung ("address bar" tidak ada) | Sembunyikan di native / tulis ulang untuk izin OS |
| UIUX-097 | P2 | `app/security.tsx:195`, `app/social-providers.tsx:135`, `components/realtime-global-listeners.tsx:36`, `components/ui/notification-preferences-matrix.tsx:75` | "Login Sosial", "Login perangkat baru terdeteksi", "Login baru" — "Login" padahal kanonis "Masuk" | Inkonsisten istilah | Ganti → "Masuk sosial", "Perangkat baru terdeteksi masuk", "Sesi masuk baru" |
| UIUX-098 | P2 | `components/qris-payment-panel.tsx:113` | `translate("Status belum diperbarui: {x}", { x: pollError })` — `pollError` mentah (bisa Inggris/teknis) disuntik ke kalimat Indonesia | Pesan campur bahasa & teknis | Petakan `pollError` lewat `userMessage()`/kunci kamus dulu |

**Rekomendasi sistemik (untuk Claude Code):** root cause terbesar = string UI lolos dari `translate()` — sarankan gate lint diperluas (tolak string literal Indonesia di `accessibilityLabel`/`accessibilityHint` dan file screen tanpa `translate()`); root cause kedua = kamus istilah belum dikunci ("Etalase" vs "Produk", "Masuk" vs "Login", "Pembeli" vs "Buyer", "Ubah" vs "Edit", "Tautan" vs "Link", "Isi saldo" vs "Top-up").

---
## F. Layar Dagang & Chat (31)

> Lensa: orang awam harus langsung paham. Tidak menyentuh logika uang/escrow — murni UI/UX/copy.

| ID | Sev | File:Line | Masalah | Dampak | Saran Fix |
|----|-----|-----------|---------|--------|-----------|
| UIUX-099 | P0 | `components/screens/showcase-detail-screen.tsx:901` | CTA utama bertuliskan "Beli via Escrow" — kata "escrow" asing bagi orang awam | Pembeli ragu menekan tombol beli karena tidak paham artinya; tombol paling penting justru paling membingungkan | Ganti jadi "Beli Sekarang" + sub-label ("Uang Anda ditahan Kahade sampai barang diterima") |
| UIUX-100 | P1 | `components/ui/showcase-feed-item.tsx:466` | Harga sengaja DIHAPUS dari kartu feed ("agar bersih") | Pembeli tidak bisa membandingkan harga — harus ketuk satu per satu ke detail | Tampilkan harga di kartu (di bawah judul, single-line, format Rp). Keputusan produk 2026-09-27 — minta user timbang ulang |
| UIUX-101 | P1 | `components/ui/showcase-feed-item.tsx:536-560` | Kartu feed produk commerce tidak punya CTA beli sama sekali — hanya aksi sosial (suka/komentar/share/simpan) | Pembeli harus menebak: ketuk kartu → detail → baru bisa beli; alur dagang 2 ketuk tersembunyi | Tambah tombol "Beli" kecil di baris aksi kartu untuk item commerce |
| UIUX-102 | P1 | `components/screens/showcase-detail-screen.tsx:890` | Catatan di samping CTA: "Dana ditahan escrow sampai barang Anda terima" | Awam tidak tahu "escrow" itu apa — kalimat penjelas justru menambah istilah asing | Tulis ulang: "Uang Anda disimpan Kahade dulu, diteruskan ke penjual setelah barang Anda terima" |
| UIUX-103 | P1 | `app/create-transaction.tsx:118-119` | Langkah 2 wizard berjudul "Lawan" / "Siapa lawan transaksi?" — "lawan" berkonotasi musuh | Awam merasa aneh & tidak ramah | Ganti → "Mitra transaksi" / "Siapa mitra transaksi Anda?" |
| UIUX-104 | P1 | `components/ui/order-form-selectors.tsx:94` | Hint peran pembeli: "Anda membayar ke escrow" di langkah pertama wizard | Istilah asing muncul sebelum user paham konsepnya | Ganti → "Anda membayar ke Kahade dulu, bukan langsung ke penjual" |
| UIUX-105 | P1 | `components/ui/chat-room-list-item.tsx:124,242` | Chat transaksi ditandai badge "Escrow" di daftar chat | Awam tidak tahu badge itu artinya apa / kenapa chat ini beda | Ganti → "Terlindungi" dengan ikon gembok |
| UIUX-106 | P1 | `components/screens/chat-room-screen.tsx:3209,3333` | Peringatan anti-tipu "Chat ini belum dilindungi escrow" dipindah ke dalam menu ⋮ (keputusan user 2026-10-02) | Awam tidak pernah membuka menu ⋮ — chat dengan penjual tak dikenal terlihat sama amannya dengan chat transaksi | Kembalikan banner ringkas 1 baris (bisa ditutup) di atas thread untuk DM tanpa orderId |
| UIUX-107 | P1 | `components/screens/user-profile-screen.tsx:1213-1227` | Rating tampil "4.8 ★ Ulasan" TANPA jumlah ulasan | Rating 5.0 dari 1 ulasan terlihat sama dengan 5.0 dari 500 ulasan — menyesatkan | Tampilkan jumlah: "4.8 ★ (127 ulasan)" |
| UIUX-108 | P1 | `components/screens/user-profile-screen.tsx:1229-1260` | "Skor" kepercayaan tampil sebagai angka polos tanpa skala | Awam tidak tahu 72 itu bagus atau jelek (dari berapa?) | Tampilkan "72/100" atau dengan label tier ("Baik") |
| UIUX-109 | P1 | `components/screens/user-profile-screen.tsx:1301` | Tombol profil penjual "Beli via Escrow" | Sama seperti UIUX-099: kata asing di tombol aksi utama | Ganti → "Beli Sekarang" dengan penjelasan perlindungan di bawahnya |
| UIUX-110 | P2 | `components/ui/showcase-feed-item.tsx:489` | Badge kategori tampil sebagai teks caption biasa tapi ketuknya mem-FILTER feed | Awam kaget feed tiba-tiba berubah tanpa penjelasan | Tambah ikon filter kecil / gaya chip, atau toast "Feed difilter: {kategori}" |
| UIUX-111 | P2 | `components/screens/showcase-detail-screen.tsx:879-901` | Footer sticky mencampur CTA beli + komposer komentar dalam satu blok | Awam bingung: ini layar belanja atau kolom komentar? | Pisahkan: CTA beli tetap sticky, komposer hanya muncul saat scroll ke area komentar |
| UIUX-112 | P2 | `lib/showcase-labels.ts:78` | Produk tanpa harga tampil "Harga lewat diskusi" | Awam tidak tahu caranya: lewat chat? tombol apa? | Ganti → "Harga: chat penjual" + tombol yang langsung membuka DM ke penjual |
| UIUX-113 | P2 | `app/create-transaction.tsx:894` | Teks "Langkah X dari 4" sengaja dihapus — wizard hanya progress bar | Awam tidak tahu di langkah berapa / sisa berapa langkah | Kembalikan label kecil "Langkah 2 dari 4" di bawah header |
| UIUX-114 | P2 | `components/create-transaction-review.tsx:40` vs `:295` | Mode "Tautan pesanan" di pilihan vs "Order Link" di ringkasan | Awam mengira itu dua hal berbeda | Samakan: "Tautan pesanan" di semua tempat |
| UIUX-115 | P2 | `components/create-transaction-review.tsx:303` | Ringkasan memakai label "Tenggat" | Awam tidak familiar; "batas waktu" lebih umum | Ganti → "Batas waktu pengiriman" |
| UIUX-116 | P2 | `app/create-transaction.tsx:934-958` | Dua seksi voucher tampil bersamaan (platform + "Voucher toko penjual") padahal saling eksklusif | Awam bingung harus isi yang mana; takut salah pilih | Satu seksi dengan toggle, atau penjelasan "hanya satu yang bisa dipakai" |
| UIUX-117 | P2 | `components/ui/chat-message-bubble.tsx:38-41` | Status baca monokrom: centang 1 vs centang 2 tebal, tanpa warna biru | Awam sulit membedakan "terkirim" vs "dibaca" — bedanya terlalu halus | Centang baca berwarna (biru ala WhatsApp) atau label mikro "Dibaca" |
| UIUX-118 | P2 | `components/ui/chat-message-row.tsx:253` | Jam hanya tampil di bubble terakhir tiap grup menit | Awam yang ingin tahu jam pesan tertentu harus menebak | Tampilkan jam di semua bubble (kecil) atau saat bubble ditekan |
| UIUX-119 | P2 | `components/ui/chat-attachment-sheet.tsx:64-69` | Pilihan "Foto (standar)" vs "Foto (asli)" tanpa penjelasan | Awam tidak tahu bedanya — "standar" terdengar aman, padahal versi terkompresi | Tambah deskripsi: "dikompresi, lebih cepat" / "ukuran penuh, file besar" |
| UIUX-120 | P2 | `components/ui/chat-composer.tsx:103` + `components/screens/chat-room-screen.tsx:1822` | Istilah Inggris "Rekam voice note" / "Voice note tidak valid" | Sebagian awam tidak paham "voice note" | Samakan jadi "Pesan suara" (istilah WhatsApp Indonesia) |
| UIUX-121 | P2 | `components/screens/chat-room-screen.tsx:2597-2602` | Status header "Tidak aktif" sebagai fallback saat data presence tidak diketahui | Awam mengira lawan benar-benar offline padahal datanya basi — menyesatkan | Fallback netral: kosongkan baris status bila tidak tahu |
| UIUX-122 | P2 | `components/screens/chat-room-screen.tsx:2939,2953-2958` | Balas pesan hanya via swipe kanan bubble — tidak ada petunjuk visual; coach mark hanya di daftar chat, bukan di room | Awam tidak akan pernah menemukan cara membalas pesan | Tambah "Balas" di menu tekan-lama + coach mark sekali-tampil di room |
| UIUX-123 | P2 | `components/ui/chat-message-bubble.tsx:44-52` | Ketuk bubble teks = NO-OP; semua aksi hanya lewat tekan lama | Awam mengetuk berkali-kali menunggu sesuatu terjadi | Ketuk tampilkan menu aksi kecil, atau hint "tekan lama untuk opsi" |
| UIUX-124 | P2 | `lib/api/chat.ts:281-288` | Preview chat berisi lampiran selalu "(lampiran)" untuk semua jenis media | Awam tidak tahu apakah itu foto, video, atau pesan suara sebelum membuka | Bedakan label: "Foto", "Video", "Pesan suara", "Berkas" |
| UIUX-125 | P2 | `components/ui/chat-message-row.tsx:311` | Label "Kartu order" untuk preview pesan kartu | "Order" istilah Inggris; awam lebih paham "pesanan" | Ganti → "Kartu pesanan" |
| UIUX-126 | P2 | `components/screens/user-profile-screen.tsx:1130-1143` | Badge verifikasi hanya menampilkan shortLabel; artinya tersembunyi di balik ketukan | Awam tidak tahu badge itu menandakan apa | Tambah ikon info kecil / tooltip, atau label "Identitas terverifikasi" |
| UIUX-127 | P2 | `components/screens/chat-room-screen.tsx:3384` | Opsi hapus "Hapus untuk semua pihak" | Frasa kaku; WhatsApp memakai "semua orang" | Ganti → "Hapus untuk semua orang" |
| UIUX-128 | P2 | `components/ui/chat-create-order-sheet.tsx:233` | Deskripsi: "Buat order escrow 1-by-1 dari percakapan ini." — tiga istilah asing dalam satu kalimat | Awam tidak paham maksudnya | Tulis ulang: "Buat transaksi aman dari percakapan ini — uang Anda dilindungi Kahade." |
| UIUX-129 | P2 | `components/showcase-author-row.tsx:57-59` | Baris rating penjual disembunyikan total bila 0 ulasan | Awam tidak bisa membedakan "penjual baru" vs "gagal dimuat" | Tampilkan "Penjual baru — belum ada ulasan" |

---

## Verifikasi Auditor

- Foto di detail produk SUDAH zoomable (pinch 1–4× via `ZoomableImage`, `components/ui/image-viewer.tsx:169`) — bukan issue.
- Area bersih: shadow/elevasi (semua via `elevationStyle`), StatusBar terpusat, safe area konsisten, tidak ada `font-bold` mentah, tidak ada hex hardcode di `app/` selain scan, duplikasi Button/IconButton terdokumentasi disengaja.
- Layar berat (feed, chat room, chat tab, notifikasi, transaksi, pencarian, komentar) sudah tervirtualisasi dengan baik — tidak ada P0 performance.
- Paste OTP didukung, resend+countdown 60 dtk ada, focus trap di modal ada, validasi live on-blur ada.
- Bottom tab bar: role tab/tablist, label+hint, badge "99+" — lengkap. Header back button, IconButton, Chip, Switch, OtpInput/PinInput, Dialog — semua berlabel a11y.
- `lib/format.ts`: Rupiah "Rp1.500.000", tanggal "3 Sep 2026, 14:30" — konsisten.
- Tidak ada file yang diubah selama audit (read-only dipatuhi).
