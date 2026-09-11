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
| Scroll | Scroll browser + overscroll CSS | SwipeRefresh/NestedScrolling API native | bounces/UIScrollView |
| Fokus/kunci | Tab, Escape, outline | TalkBack, tombol Back, ripple | VoiceOver, swipe back |

Selain itu, CI proyek (`vitest`, `check:a11y`, `check:screens`, dll.)
berjalan di Node/jsdom/export web — jalur gesture NATIVE (RNGH native,
PanResponder vs ScrollView Android) tidak pernah dieksekusi di CI, sehingga
regresi Android tidak tertangkap sebelum device test.

## Bug-1: Aksi di dalam BottomSheet mati di Android (FIXED)

Gejala: di Android, item ActionSheet seperti "Hapus notifikasi", tombol
"Batal", dan tombol X sheet kadang/tidak bisa ditekan; di web normal.

Rantai sebab:

1. `BottomSheet` menganimasikan `translateY` kartu sheet dengan Reanimated
   (UI thread), mulai dari `translateY = tinggiWindow` (di luar layar) lalu
   spring ke `0`.
2. Di Fabric Android, Reanimated TIDAK menyinkronkan nilai akhir animasi ke
   shadow tree. Sementara itu `Pressable` bawaan RN, saat ditekan, mengukur
   "responder region" lewat `UIManager.measure` yang membaca shadow tree —
   jadi region-nya masih di posisi AWAL sheet (di bawah layar).
   Lihat [facebook/react-native#51621](https://github.com/facebook/react-native/issues/51621)
   dan isu terkait (#44768, #36504, #36710, #48387; RNGH Pressable secara
   eksplisit direkomendasikan sebagai solusi karena menghitung target dari
   hierarki view NATIVE).
3. Gerakan jari wajar saat tap langsung dianggap keluar region
   (`LEAVE_PRESS_RECT`) → `onPress` tidak pernah dipanggil. Di web ukur
   memakai DOM yang posisinya nyata, sehingga selalu benar.

Catatan: `Modal`/`Dialog` TIDAK terdampak karena animasinya memakai RN
`Animated` (`useNativeDriver`) yang men-sync nilai akhir ke shadow tree saat
animasi selesai (RN PR #43374). `SwipeableListItem`, FAB, dan PulseRing juga
aman: transform saat diam = nilai awal yang di-commit (0), sehingga region
tetap benar, dan/atau tombol tidak berada di dalam view yang bertransformasi.

Perbaikan (otomatis untuk semua isi sheet, tanpa mengubah call site):

- `components/ui/overlay-pressable-context.ts` — context penanda "di dalam
  overlay Reanimated".
- `components/ui/gesture-pressable.tsx` — `Pressable` RNGH (berbasis
  `Gesture.Native()`/NativeViewGestureHandler; target dari view native)
  yang sudah di-`cssInterop` agar `className` NativeWind tetap jalan. Ripple
  Android default transparan (sesuai keputusan tanpa-ripple).
- `components/ui/pressable-scale.tsx` — di native (bukan web) saat berada
  dalam BottomSheet, otomatis memakai `GesturePressable`; di luar sheet dan
  di web perilakunya 100% sama seperti sebelumnya. Ini langsung memperbaiki
  ActionSheet (baris aksi + tombol Batal), tombol X sheet, Select/BankSelect
  di dalam sheet, dan tombol/form apa pun yang dirender di dalam BottomSheet.
- `components/ui/bottom-sheet.tsx` — provider dipasang melingkupi kartu sheet.

Keterbatasan yang diterima: RNGH `Pressable` 2.28 belum meneruskan `ref`;
seluruh `returnFocusRef` di proyek menunjuk ke PEMICU di belakang sheet
(bukan elemen di dalam sheet), jadi tidak ada fungsionalitas yang hilang.

## Bug-2: Pull-to-refresh custom mati di Android saat konten panjang (FIXED)

Gejala: di web (dan iOS) tarik-untuk-segar bekerja; di Android hanya bekerja
bila konten pendek. Begitu daftar memenuhi/melewati layar ("konten menyentuh
bawah"), tarikan tidak melakukan apa-apa.

Rantai sebab:

1. `PullGestureSurface` adalah `PanResponder` JS yang membungkus
   ScrollView/FlatList, dan hanya mengklaim gesture bila `offsetY <= 1` serta
   jari bergerak turun (`lib/pull-math.ts`).
2. Di Android, `ReactScrollView` (framework `ScrollView`) yang kontennya
   bisa di-scroll meng-KLAIM gesture begitu gerakan melewati touch slop, lalu
   memanggil `NativeGestureUtil.notifyNativeGestureStarted` → root
   MEMBATALKAN responder JS. PanResponder induk tidak pernah jadi pemenang —
   ini keterbatasan fundamental negosiasi gesture Android (lihat
   [RN #25226](https://github.com/facebook/react-native/issues/25226);
   di web capture-listener + `preventDefault` menang, di iOS responder bisa
   mengambil alih UIScrollView).
3. `SwipeRefreshLayout` (RefreshControl native) menyelesaikan ini karena ia
   adalah `NestedScrollingParent`: scroller anak melaporkan sisa scroll ke
   induk melalui nested-scroll callbacks, sehingga tarikan di posisi atas
   tertangkap tanpa peduli panjang konten.

Perbaikan: di Android (`components/ui/pull-to-refresh.tsx`)
`PullToRefresh`/`PullToRefreshFlatList` memakai `RefreshControl` native
(warnanya dari token, mengikuti mode terang/gelap). Web & iOS tetap memakai
indikator logo custom. Tidak ada perubahan di ~40 layar pemakai.

Trade-off yang harus diketahui produk: di Android spinner-nya spinner
native, BUKAN logo Kahade (RefreshControl Android tidak menerima konten
custom). Bila branding logo wajib di Android, jalur ke depannya adalah
implementasi RNGH (`Gesture.Native()` + `Gesture.Pan()` simultan, pola resmi
RNGH untuk custom PTR) — sengaja TIDAK dipilih sekarang karena riwayat
force-close tercatat di komentar komponen ini dan tidak ada device test di
siklus ini.

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
- **Image picker**: galari/kamera native vs `<input type=file>` web
  (`lib/image-picker.ts`).
- **Versi aplikasi/OTA/EAS**: gate versi & Updates hanya native
  (`app/app-version.tsx`, dialog force-update di `_layout.tsx`).
- **Banner ajakan install app** hanya web (`smart-app-banner.tsx`).
- **Keyboard**: `KeyboardAvoidingView` padding iOS; Android mengandalkan
  adjustResize (`components/ui/keyboard-avoiding.tsx`).
- **Haptics** hanya perangkat; polling memakai `visibilitychange`/fokus
  dokumen di web (`lib/haptics.ts`, `lib/use-polling.ts`).
- **Visual interaksi**: tanpa ripple Android & tanpa hover web (keputusan
  desain terdokumentasi di `pressable-scale.tsx`); `unstable_pressDelay=50`
  khusus Android; shadow iOS vs elevation Android vs box-shadow web
  (`lib/elevation.ts`); focus ring/outline hanya web; `bounces`/`overScrollMode`
  per platform; tombol Back Android vs Escape (overlay).
- **Long-press** tidak ada di web → semua aksi kontekstual juga punya ikon
  ⋮ terlihat (mis. NotificationListItem).

## Rekomendasi lanjutan

1. **Smoke test di device Android** untuk alur: buka ActionSheet di tiap
   daftar (notifikasi, transaksi, chat), tap semua aksi + Batal + X;
   pull-to-refresh pada daftar PANJANG dan pendek; sheet form
   (transfer/tarik dana/buat transaksi) termasuk input keyboard.
2. Tambahkan jalur UI test Android (Maestro/Detox) — CI sekarang tidak
   menyentuh jalur gesture native sama sekali.
3. Pantau RN #51621; bila fix measure-on-native-hierarchy masuk,
   GesturePressable bisa dipertimbangkan untuk dipakai luas/dicabut
   kompatnya.
4. Keputusan branding spinner PTR Android perlu dikonfirmasi produk
   (lihat trade-off Bug-2).
