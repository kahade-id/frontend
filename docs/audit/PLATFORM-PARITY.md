# Audit Paritas Web vs Native (Android/iOS)

Tanggal: 2026-09-11 · Stack: Expo SDK 54, RN 0.81.5 (Fabric/New Arch aktif),
Reanimated 4.1.7, RNGH 2.28.0, NativeWind v4.

Latar: satu basis kode dirender tiga target — browser (`react-native-web`),
Android, iOS. Tim menemukan beberapa interaksi yang jalan di web tetapi mati
di Android (mis. aksi di BottomSheet, pull-to-refresh pada daftar panjang).
Dokumen ini menjelaskan AKAR MASALAHNYA, perbaikan yang sudah dilakukan, dan
daftar perbedaan yang MEMANG harus ada (fitur per-platform).

## Prinsip dasar: kenapa satu kode bisa beda perilaku

RN memetakan satu komponen ke tiga dunia yang sangat berbeda:

| Hal | Web (react-native-web) | Android native | iOS native |
| --- | --- | --- | --- |
| Sentuhan/gesture | Event DOM (`touchmove` bisa `preventDefault` di fase capture) | Negosiasi responder + klaim gesture native (`onInterceptTouchEvent`), dan native view (ScrollView) bisa MEMBATALKAN responder JS | Responder JS bisa mengambil alih UIScrollView di posisi atas |
| Hit-test tombol | `getBoundingClientRect` DOM = posisi NYATA | Fabric: `Pressable` memvalidasi gerak jari terhadap "responder region" hasil `UIManager.measure` dari SHADOW TREE | Umumnya native/UI tree sinkron |
| Animasi | DOM style yang benar-benar diubah | Reanimated jalan di UI thread dan TIDAK menulis nilai akhir ke shadow tree | Sama arsitekturnya, tapi pola responder lebih toleran |
| Scroll | Scroll browser + overscroll CSS | NestedScrolling API native + RNGH Native gesture | bounces/UIScrollView |
| Fokus/kunci | Tab, Escape, outline | TalkBack, tombol Back, ripple | VoiceOver, swipe back |

Selain itu, CI proyek (`vitest`, `check:a11y`, `check:screens`, `expo export
web`) berjalan di Node/jsdom/browser — jalur gesture NATIVE (RNGH native,
PanResponder vs ScrollView Android) tidak pernah dieksekusi di CI, sehingga
regresi Android tidak tertangkap sebelum device test.

## Bug-1: Aksi di dalam subtree ber-transform Reanimated mati di Android (FIXED)

Gejala: di Android, item ActionSheet seperti "Hapus notifikasi", tombol
"Batal", dan tombol X sheet kadang/tidak bisa ditekan; di web normal. Kelas
yang sama juga berlaku untuk baris `SwipeableListItem` yang tersnap terbuka.

Rantai sebab:

1. `BottomSheet` menganimasikan `translateY` kartu sheet dengan Reanimated
   (UI thread), mulai dari `translateY = tinggiWindow` (di luar layar) lalu
   spring ke `0`. `SwipeableListItem` menganimasikan `translateX` baris saat
   digeser dan bisa tersnap pada posisi non-identitas (terbuka).
2. Di Fabric Android, Reanimated TIDAK menyinkronkan nilai akhir animasi ke
   shadow tree. Sementara itu `Pressable` bawaan RN, saat ditekan, mengukur
   "responder region" lewat `UIManager.measure` yang membaca shadow tree —
   jadi region-nya masih di posisi AWAL. Lihat
   [facebook/react-native#51621](https://github.com/facebook/react-native/issues/51621)
   dan isu terkait (#44768, #36504, #36710, #48387; RNGH Pressable secara
   eksplisit direkomendasikan sebagai solusi karena menghitung target dari
   hierarki view NATIVE).
3. Gerakan jari wajar saat tap langsung dianggap keluar region
   (`LEAVE_PRESS_RECT`) → `onPress` tidak pernah dipanggil. Di web ukur
   memakai DOM yang posisinya nyata, sehingga selalu benar.

Catatan: `Modal`/`Dialog`/`Toast`/`Tooltip` TIDAK terdampak karena
animasinya memakai RN `Animated` (`useNativeDriver`) yang men-sync nilai
akhir ke shadow tree saat animasi selesai (RN PR #43374). FAB dan PulseRing
juga aman: transform saat diam = identitas (0/skala 1) dan/atau view yang
berdenyut `pointerEvents="none"` sehingga region tombol statis.

Perbaikan (otomatis, tanpa mengubah call site):

- `components/ui/reanimated-pressable-context.ts` — context
  `InsideReanimatedTransformContext`, penanda "subtree ini dipindahkan
  transform Reanimated yang tidak tercermin di shadow tree".
- `components/ui/gesture-pressable.tsx` — `GesturePressable`: `Pressable`
  RNGH (berbasis gesture-handler native; target dihitung dari view native)
  yang sudah di-`cssInterop` agar `className` NativeWind tetap jalan, plus
  hook `useTransformAwarePressable()` yang mengembalikan `GesturePressable`
  HANYA di dalam subtree bertanda pada native, dan `Pressable` RN di tempat
  lain (web tidak berubah sama sekali). Ripple Android default transparan
  (sesuai keputusan tanpa-ripple); `unstable_pressDelay=50`, `hitSlop`,
  `onLongPress`, style-function `{ pressed }` tetap didukung.
- Komponen yang berisi interaksi kini memakai hook tersebut:
  `pressable-scale.tsx` (seluruh Button/IconButton/baris/Select/BankSelect/
  PinPad/NumberStepper/Calendar/Checkbox/Radio/SegmentedControl/dst. yang
  dibangun di atasnya), ikon clear/secure/right di `input.tsx`, ikon X di
  `chip.tsx`, tombol clear di `date-field.tsx`, `switch.tsx`, dan proxy
  fokus OTP di `otp-input.tsx`.
- Provider dipasang melingkupi kartu `BottomSheet` dan melingkupi baris
  konten `SwipeableListItem` (tombol aksi di belakang baris tidak dibungkus
  karena posisinya statis).

Keterbatasan yang diterima: RNGH `Pressable` 2.28 belum meneruskan `ref`;
seluruh `returnFocusRef` di proyek menunjuk ke PEMICU di belakang sheet
(bukan elemen di dalam sheet), jadi tidak ada fungsionalitas yang hilang.

## Bug-2: Pull-to-refresh custom mati di Android saat konten panjang (FIXED)

Gejala: di web (dan iOS) tarik-untuk-segar dengan indikator logo Kahade
bekerja; di Android hanya bekerja bila konten pendek. Begitu daftar
memenuhi/melewati layar, tarikan tidak melakukan apa-apa.

Rantai sebab (versi lama berbasis PanResponder):

1. `PullGestureSurface` adalah `PanResponder` JS yang membungkus
   ScrollView/FlatList, dan hanya mengklaim gesture bila `offsetY <= 1` serta
   jari bergerak turun (`lib/pull-math.ts`).
2. Di Android, `ReactScrollView` (framework `ScrollView`) yang kontennya
   bisa di-scroll meng-KLAIM gesture begitu gerakan melewati touch slop,
   lalu memanggil `NativeGestureUtil.notifyNativeGestureStarted` → root
   MEMBATALKAN responder JS. PanResponder induk tidak pernah jadi pemenang —
   keterbatasan fundamental negosiasi gesture Android
   ([RN #25226](https://github.com/facebook/react-native/issues/25226);
   di web capture-listener + `preventDefault` menang, di iOS responder bisa
   mengambil alih UIScrollView).

Perbaikan final (Android) — pola resmi RNGH, logo Kahade DIPERTAHANKAN
(`components/ui/pull-to-refresh.tsx`, `NativePullGestureSurface`):

- `Gesture.Simultaneous(Gesture.Native(), Gesture.Pan())`. Scroller
  (ScrollView/FlatList) adalah anak LANGSUNG `GestureDetector` berisi
  `Gesture.Native()`, sehingga gerak scroll native tetap jalan apa adanya
  dan RNGH mengenal pemenang native-nya.
- `Gesture.Pan()` dengan `.activeOffsetY(PULL_CAPTURE_OFFSET)` (8px),
  `.failOffsetX([-12, 12])`, dan
  `.simultaneousWithExternalGesture(nativeGesture)`. `useAnimatedScrollHandler`
  melacak offset scroll di UI thread; pan hanya menerjemahkan konten saat
  `scrollOffset <= 1` (dijaga di worklet onChange — tanpa
  `manualActivation`/`stateManager.activate`, yang dilarang karena riwayat
  force-close). Resistensi & rasio maksimum memakai konstanta
  `lib/pull-math.ts`; pelepasan di-snap dengan spring
  `tokens.motion.springPlayful`; ambang memanggil `onRefresh` via
  `runOnJS`. State `refreshing` controlled maupun uncontrolled didukung.
- Indikator tetap indikator logo Kahade (View setinggi threshold,
  `pointerEvents="none"`, `PulsingLogo` saat me-refresh) — tidak ada spinner
  `SwipeRefreshLayout`, sehingga branding & perilaku parity penuh dengan
  web/iOS. `bounces={false}` + `overScrollMode="never"` agar glow karet
  native tidak dobel dengan gerak logo. `touchAction="pan-y"` untuk web.
- Web & iOS tetap memakai `PullGestureSurface` PanResponder + RN
  `Animated` seperti semula; ~40 layar pemakai tidak berubah.

Aturan gesture turunan yang ikut diperbaiki:

- Scroller HORIZONTAL di dalam permukaan PTR (yang bisa berebut sumbu dengan
  pan vertikal induk) dibungkus `GestureDetector` dengan
  `Gesture.Native()` per-instance (useMemo — gesture instance RNGH tidak
  boleh dibagi antar detector) plus `touchAction="pan-x"`:
  `scroll-row.tsx`, `promo-carousel.tsx`, `order-summary-strip.tsx`,
  `tabs.tsx`.
- `SignaturePad`/`Slider`/`RangeSlider` sudah memakai
  `.blocksExternalGesture(scrollGesture)` dan tiap layar pemasangnya
  membungkus scroller dengan `Gesture.Native()` sendiri
  (`showcase`, `profile-form`, `order/[id]`, `new-product`, `product-edit`,
  `chat/[id]`, `ratings`).
- Pengunci statis `scripts/check-screens.mjs` (S7): setiap implementasi
  pull kustom Android WAJIB memuat `Gesture.Native()` +
  `.simultaneousWithExternalGesture(` dan DILARANG memuat
  `manualActivation`/`stateManager.activate|fail`.

Temuan paritas terkait (FIXED): `keyboardDismissMode="on-drag"` hanya
didukung iOS — di Android prop itu no-op (hanya `DrawerLayoutManager` yang
memilikinya). Padanannya `lib/keyboard.ts` →
`dismissKeyboardOnDragProps` (`onScrollBeginDrag` → `Keyboard.dismiss`,
Android saja), dipasang di `transfer.tsx`, `search-overlay.tsx`, dan
otomatis pada binding scroll `NativePullGestureSurface`.

## Perbedaan yang MEMANG benar (jangan diubah)

Ini daftar divergensi yang berasal dari KEMAMPUAN platform — persis seperti
ekspektasi tim ("cuma FCM dkk. yang beda"):

- **Push**: FCM Service Worker + VAPID hanya web (`lib/web-push*`,
  `scripts/gen-fc-sw.mjs`, `SmartAppBanner` tidak ikut); native memakai
  expo-notifications + channel Android (`lib/push-notifications.ts`).
- **Penyimpanan sesi**: SecureStore (Keychain/Keystore) native; localStorage
  di web (`lib/secure-storage.ts`).
- **Biometrik**: hanya native; web selalu `available: false`
  (`lib/biometrics.ts`, biometric-prompt).
- **Berbagi & ekspor file**: Share Sheet / penyimpanan media native vs
  unduhan DOM di web (`lib/share.ts`, `lib/export-file.ts`).
- **Image picker**: galeri/kamera native vs `<input type=file>` web
  (`lib/image-picker.ts`).
- **Versi aplikasi/OTA/EAS**: gate versi & Updates hanya native
  (`app/app-version.tsx`, dialog force-update di `_layout.tsx`).
- **Ajakan install app** hanya web, berupa kartu mengalir di Beranda di
  bawah kartu saldo (`smart-app-install-card.tsx`; banner fixed di atas
  viewport sudah dihapus; deteksi OS/store URLs di `lib/smart-app-banner.ts`).
- **Keyboard**: `KeyboardAvoidingView` padding iOS; Android mengandalkan
  adjustResize (`components/ui/keyboard-avoiding.tsx`); tutup-keyboard-saat-
  drag dijembatani `lib/keyboard.ts` (lihat Bug-2).
- **Haptics** hanya perangkat; polling memakai `visibilitychange`/fokus
  dokumen di web (`lib/haptics.ts`, `lib/use-polling.ts`).
- **Visual interaksi**: tanpa ripple Android & tanpa hover web (keputusan
  desain terdokumentasi di `pressable-scale.tsx`); `unstable_pressDelay=50`
  khusus Android; shadow iOS vs elevation Android vs box-shadow web
  (`lib/elevation.ts`); focus ring/outline hanya web; `bounces`/`overScrollMode`
  per platform; tombol Back Android vs Escape (overlay, semua sheet punya
  `onRequestClose`).
- **Long-press** tidak ada di web → semua aksi kontekstual juga punya ikon
  ⋮ terlihat (mis. NotificationListItem).
- **Aksesibilitas**: `announceForAccessibility` hanya diperlukan di iOS;
  Android/web mengandalkan `accessibilityLiveRegion` (`field.tsx`,
  `live-region.tsx`).

## Rekomendasi lanjutan

1. **Smoke test di device Android** untuk alur: buka ActionSheet di tiap
   daftar (notifikasi, transaksi, chat), tap semua aksi + Batal + X;
   pull-to-refresh pada daftar PANJANG dan pendek (termasuk setelah
   scroll); geser carousel/baris horizontal di dalam layar PTR;
   buka `SwipeableListItem` lalu tap isinya; sheet form
   (transfer/tarik dana/buat transaksi) termasuk buka-tutup keyboard saat
   scroll; OTP di sheet verifikasi email.
2. Tambahkan jalur UI test Android (Maestro/Detox) — CI sekarang tidak
   menyentuh jalur gesture native sama sekali.
3. Pantau RN #51621; bila fix measure-on-native-hierarchy masuk,
   `useTransformAwarePressable` bisa dicabut (semua kembali ke Pressable RN).
4. Pertimbangkan API pengujian gesture berbasis RNGH mock (RNGH menyediakan
   `fireGestureHandler`) agar pola Native+Pan pada PTR mendapat uji unit.
