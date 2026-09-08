# Audit Final Pull-to-Refresh Custom — Mengikuti Tangan Tanpa Force-Close

- **Tanggal:** 2026-09-08
- **Pemicu awal:** layar data force-close saat dibuka atau digulir.
- **Koreksi produk:** pull-to-refresh wajib custom, logo Kahade, dan konten
  mengikuti gerakan tangan; RefreshControl bawaan bukan hasil yang diterima.
- **Status final:** seluruh route yang refreshable memakai gesture custom aman.

## 1. Kesimpulan

Masalahnya bukan karena produk menginginkan gesture custom. Masalahnya adalah
**mesin gesture custom yang dipilih sebelumnya**:

- `Gesture.Pan().manualActivation(true)` dari RNGH;
- dikomposisikan dengan `Gesture.Native()` pada scroller yang sama;
- setiap gerakan vertikal masuk worklet Reanimated;
- worklet memanggil synchronous native `stateManager.activate()`/`fail()`;
- error di UI/native thread berada di luar React ErrorBoundary dan dapat
  menutup scene/aplikasi.

Solusi native RefreshControl sempat dibuat sebagai containment, tetapi ditolak
karena tidak memenuhi interaction requirement. Solusi final tetap custom,
namun mengganti arsitektur berisiko dengan:

- **PanResponder bawaan React Native** pada JS thread;
- **Animated.Value bawaan React Native** dengan native driver untuk transform;
- tidak ada RNGH/Reanimated/worklet/stateManager pada jalur pull/scroll;
- tidak pernah mengubah `scrollEnabled`;
- satu surface gesture yang dapat membungkus ScrollView atau FlatList tanpa
  nested scroll container.

## 2. Cakupan akhir

Pemindaian source executable menemukan **53 route refreshable unik**:

| Keluarga | Route | Implementasi |
|---|---:|---|
| `<PullToRefresh>` langsung | 34 | ScrollView + `PullGestureSurface` |
| `<DataScreen>` | 11 | Tidak langsung memakai PullToRefresh |
| `<PaginatedList>` | 6 | `PullToRefreshFlatList`, tanpa RefreshControl |
| FlatList khusus FAQ/Search | 2 | `PullToRefreshFlatList` |
| **Total** | **53** | Gesture custom yang sama |

`components/wallet-history-screen.tsx` juga memakai PaginatedList; ia termasuk
dalam route Wallet, jadi tidak dihitung dua kali.

Route yang tidak fetch data (form auth, legal statis, chat composer) memang
tidak punya aksi refresh dan tidak dipaksa memakai gesture palsu.

## 3. Mekanika gesture final

### 3.1 Capture yang sangat sempit

Parent hanya mengambil responder bila seluruh syarat ini benar:

1. fitur `enabled`;
2. tidak sedang refresh/request;
3. tepat satu jari;
4. offset scroller `<= 1px` (toleransi sub-piksel);
5. gerak ke bawah lebih dari 6px;
6. gerak vertikal minimal 1,15× gerak horizontal.

Akibatnya:

- swipe ke atas dari puncak tetap milik ScrollView/FlatList;
- scroll di tengah list tidak pernah direbut;
- swipe horizontal item/chip tidak direbut;
- multi-touch tidak direbut;
- selama refresh, scroll tetap berjalan.

### 3.2 Mengikuti tangan

Capture baru terjadi setelah 6px untuk membedakan niat pull dari tap/jitter,
namun PanResponder mempertahankan `gesture.dy` sejak touch-down. Saat capture,
seluruh `dy` langsung menjadi jarak visual; gerakan berikutnya juga memakai
`gesture.dy` utuh. Jadi posisi konten tetap 1:1 dengan posisi tangan, bukan 6px
tertinggal karena activation offset.

Kurva perpindahan:

- dari 0 sampai 64px: **1:1** dengan jari;
- setelah 64px: resistance 0,35;
- batas maksimum: 1,6× threshold.

`Animated.View` yang berisi scroller ditranslasikan dengan nilai itu. Logo
Kahade di belakang konten terbuka proporsional, lalu menjadi `PulsingLogo`
setelah dilepas melewati ambang.

Refresh hanya dipicu bila posisi **saat dilepas** masih melewati threshold.
Melewati threshold lalu menarik kembali ke bawah threshold tidak mengirim
request.

### 3.3 Settle dan pembatalan

Semua jalur akhir mengembalikan konten dengan spring:

- release di bawah ambang;
- responder terminate;
- responder reject;
- callback selesai/gagal;
- prop controlled berubah true → false;
- callback controlled tidak pernah mengonfirmasi `refreshing` (fallback 1s).

Unmount menghentikan animasi dan timer. Callback Promise yang reject ditangkap.
`requestActive` mencegah dua gesture mengirim request bersamaan.

## 4. Mengapa PanResponder dipilih

PanResponder tetap custom dan mendukung pergerakan tangan real-time, tetapi
berbeda secara fundamental dari implementasi yang force-close:

| Aspek | Implementasi gagal | Implementasi final |
|---|---|---|
| Mesin gesture | RNGH manual activation | RN PanResponder |
| Thread keputusan | UI worklet/native | JS thread |
| Transisi state | `stateManager.activate/fail` sinkron | React responder negotiation |
| Animasi | Reanimated shared values | RN Animated.Value |
| Error boundary | Bisa fatal di native thread | Tidak memanggil native gesture state manager |
| Scroll lock | Pernah memakai `scrollEnabled` | Tidak pernah |
| FlatList | RefreshControl native | Surface custom, tetap satu FlatList |
| Web | touch-action RNGH | responder RN Web, tanpa touch-action mutation |

Transform Animated menggunakan native driver setelah nilai dikirim, tetapi
keputusan capture dan perhitungan gesture tetap di JS. Tidak ada worklet yang
mengeksekusi fungsi aplikasi di UI runtime.

## 5. FlatList tanpa nested scroll

Membungkus FlatList dalam `<PullToRefresh>` lama akan membuat ScrollView luar +
FlatList dalam, sehingga virtualisasi dan gesture saling berebut.

Solusi final mengekspor `PullGestureSurface`. Surface hanya menyediakan:

- wrapper responder;
- Animated.View transform;
- indikator logo;
- `onScroll`, `scrollEventThrottle`, dan konfigurasi overscroll.

Wrapper tipis `PullToRefreshFlatList` meneruskan binding tersebut langsung ke
FlatList. `PaginatedList`, FAQ, dan Search memakai wrapper itu. Tidak ada
ScrollView tambahan. `onEndReached`, windowing, dan virtualisasi FlatList tetap
utuh.

## 6. Status platform

### Android

- FlatList/ScrollView tetap scroller native tunggal.
- `overScrollMode="never"` mencegah glow/overscroll ganda.
- Parent hanya menjadi responder setelah pull sah di puncak.
- Tidak ada synchronous RNGH state manager.

### iOS

- `bounces=false` mencegah rubber-band native bertumpuk dengan translate
  custom.
- Tarikan visual sepenuhnya mengikuti Animated.Value custom.
- Scroll tetap enabled selama request.

### Web

- PanResponder RN Web menangani pointer/touch.
- Tidak ada `GestureDetector`, sehingga tidak ada mutasi `touch-action:none`.
- Wheel/trackpad dan scroll biasa tetap native browser.
- Drag turun di puncak menampilkan gesture custom yang sama.

## 7. Controlled refresh yang sangat cepat

Banyak route mengirim `onRefresh={() => void query.refresh()}` sehingga callback
secara tipe mengembalikan `void`, sementara query sebenarnya masih berjalan.
Surface tidak mengandalkan return value saja:

1. latch visual menyala sinkron saat gesture dilepas;
2. parent mengonfirmasi lewat `refreshing=true`;
3. transisi kembali `false` menyelesaikan indikator;
4. bila parent tidak pernah mengonfirmasi, fallback 1 detik mencegah konten
   tersangkut.

Callback yang benar-benar mengembalikan Promise juga ditunggu. Semua rejection
ditelan di primitive karena error UI tetap dikelola hook/parent.

## 8. Guard regresi

### Unit test matematika

`lib/pull-math.ts` hanya fungsi JS biasa, bukan worklet. Test mencakup:

- offset puncak sub-piksel;
- arah ke atas/horizontal/multi-touch tidak dicapture;
- tengah list tidak dicapture;
- disabled/refresh aktif tidak dicapture;
- gerakan 1:1 sampai threshold;
- resistance dan cap overpull;
- nilai invalid/negatif;
- trigger berdasarkan posisi release.

### Guard arsitektur

`tests/pull-to-refresh.test.ts` dan checker S7 memastikan:

- PanResponder + RN Animated benar-benar dipakai;
- tidak ada RNGH/Reanimated/worklet/stateManager pada pull-to-refresh;
- tidak ada `scrollEnabled` assignment;
- seluruh `gesture.dy` dipakai agar posisi konten tetap 1:1 sejak touch-down;
- terminate/reject/release selalu settle;
- rejection dan duplicate request dijaga;
- PaginatedList, FAQ, dan Search memakai wrapper FlatList custom tanpa nested
  ScrollView/RefreshControl.

## 9. Dependency dan OTA

`expo-linking` dan `expo-asset` dideklarasikan langsung sesuai hasil
`expo-doctor`; versi fisik node_modules tidak berubah.

Runtime fingerprint HEAD dan patch tetap identik pada kedua platform native:

- Android: `200f422a528f383d979834989032ae3b1ab05ece`
- iOS: `1549ecddedf6fe6fc01fec8dbb1b053a973cf225`

Jadi perubahan JS ini dapat menargetkan binary runtime yang sama.

## 10. Verifikasi otomatis

Gate final yang dijalankan setelah implementasi:

- `npm run typecheck`
- `npm run lint`
- `npm run check:screens`
- `npm test`
- `npm run check`
- Expo export web, Android, dan iOS
- runtime fingerprint comparison

Sandbox tidak menyediakan ADB/emulator/simulator. Karena itu smoke test fisik
tetap wajib sebelum rollout penuh, khususnya drag→reverse, refresh saat jaringan
lambat, pindah route saat refresh, serta scroll selama logo berdenyut.

## 11. Matriks smoke test perangkat

Pada Android dan iOS:

1. buka Home, Settings, Wallet, Transactions, FAQ, Search, dan detail Order;
2. scroll panjang ke tengah/bawah — konten tidak boleh ikut turun sebagai pull;
3. fling ke puncak lalu tarik turun — konten mengikuti jari 1:1;
4. lepas di bawah threshold — tidak ada request, konten spring ke 0;
5. lepas di atas threshold — satu request, logo berdenyut;
6. selama request lambat, scroll list berulang kali — tidak boleh terkunci;
7. melewati threshold lalu balik ke bawah threshold sebelum lepas — tidak refresh;
8. swipe horizontal/chip dan multi-touch — tidak memicu pull;
9. pindah route saat animasi/request berjalan — tidak force-close;
10. ulangi offline, dark mode, dan Reduce Motion.

Ekspektasi final: interaction tetap custom dan mengikuti tangan, seluruh daftar
memakai bahasa gesture yang sama, tidak ada RefreshControl bawaan, dan jalur
native-thread yang menyebabkan force-close sudah tidak ada.
