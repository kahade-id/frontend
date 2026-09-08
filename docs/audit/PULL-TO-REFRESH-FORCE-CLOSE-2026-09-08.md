# Audit Insiden Pull-to-Refresh — Force-Close Saat Buka/Scroll Layar

- **Tanggal:** 2026-09-08
- **Pemicu:** laporan bahwa membuka layar baru dan menggulir layar yang memakai
  pull-to-refresh menyebabkan force-close.
- **Status:** implementasi berisiko sudah diganti total dengan primitive native.
- **Cakupan:** 83 route, seluruh primitive scroll, dua hook query, dependency
  native Expo, serta histori perubahan pull-to-refresh.

> Dokumen ini menyupersesi kesimpulan implementasi dalam
> `PULL-TO-REFRESH-2026-09-08.md`. Audit lama berguna sebagai histori, tetapi
> solusi custom gesture-nya tidak lagi dianggap aman.

## 1. Ringkasan eksekutif

Ada **satu blast radius bersama**: `components/ui/pull-to-refresh.tsx` dipakai
langsung oleh 34 route dan tidak langsung lewat `<DataScreen>` oleh 11 route.
Jadi satu cacat primitive menyentuh **45 route** tanpa perlu ada bug pada route
masing-masing.

Versi sebelum perbaikan menumpuk dua state machine pada sentuhan vertikal yang
sama:

1. `ScrollView` native dari React Native Gesture Handler; dan
2. `Gesture.Pan().manualActivation(true)` custom yang pada setiap gerakan
   memanggil synchronous native state manager `activate()` atau `fail()` dari
   worklet UI-thread.

Arsitektur tersebut gagal secara tidak aman. Error React biasa bisa ditangkap
`ErrorBoundary`; error worklet/gesture state manager berjalan di UI/native
thread dan dapat menutup scene/aplikasi. Unit test aritmetika, TypeScript, lint,
dan keberhasilan Metro membuat bundle **tidak pernah mengeksekusi jalur native
itu**. Karena itu semua gate lama dapat hijau sementara perangkat tetap
force-close saat jari mulai bergerak.

Perbaikannya bukan menambah cabang/epsilon baru pada gesture custom. Seluruh
mesin gesture custom dihapus dan diganti dengan:

- `ScrollView` resmi React Native;
- `RefreshControl` resmi React Native pada Android/iOS;
- scroll browser biasa pada web (RN Web `RefreshControl` adalah no-op, sehingga
  tidak dipasang);
- tidak ada `scrollEnabled` yang berubah mengikuti request;
- tidak ada RNGH/Reanimated/worklet pada jalur pull-to-refresh.

Ini menghilangkan kelas kegagalan, bukan hanya satu manifestasinya.

## 2. Bukti blast radius

Pemindaian source executable (komentar dihapus) menemukan:

| Jalur | Jumlah route | Mekanisme |
|---|---:|---|
| Langsung | 34 | Route merender `<PullToRefresh>` |
| Tidak langsung | 11 | Route merender `<DataScreen>`, lalu `DataScreen` merender `<PullToRefresh>` |
| **Total unik** | **45** | Berbagi primitive yang sama |

Route dengan `FlatList`/`PaginatedList` memakai refresh native milik list dan
bukan sumber primitive custom ini. Route form dengan `<Screen scroll>` juga
memakai `ScrollView` React Native biasa. Pembagian ini cocok dengan laporan:
force-close tampak luas, tetapi terkonsentrasi pada keluarga layar data yang
memakai primitive bersama.

## 3. Rekonstruksi jalur kegagalan lama

### 3.1 Saat layar di-mount

`PullToRefresh` lama membuat:

- tujuh lebih `SharedValue`;
- animated wrapper atas `GHScrollView`;
- `Gesture.Native()` untuk scroller;
- `Gesture.Pan()` manual;
- komposisi `Gesture.Simultaneous(pan, nativeScroll)`;
- callback touch yang diserialisasi sebagai worklet.

Semua terjadi pada setiap instance route. Membuka route data baru berarti
mendaftarkan pasangan native handler baru dan worklet baru.

### 3.2 Saat jari mulai menggulir

Pada setiap `onTouchesMove`, pan custom:

1. membaca absolute coordinate touch;
2. membaca offset animated scroller;
3. memanggil helper worklet lintas modul;
4. memutuskan `hold`, `activate`, atau `fail`;
5. memanggil `stateManager.activate()` atau `stateManager.fail()` secara
   sinkron ke native gesture state.

Sementara itu `Gesture.Native()` dan `ScrollView` juga memproses sentuhan yang
sama. Jadi **scroll biasa sekalipun** selalu melewati mesin pull-to-refresh,
bahkan ketika list berada jauh dari puncak. Cabang `fail` tetap merupakan
panggilan native; ia bukan jalur tanpa efek.

### 3.3 Mengapa gejalanya force-close, bukan pesan error

- Callback Gesture/Reanimated berjalan di UI thread.
- Synchronous state transition native tidak melewati render React.
- `AppErrorBoundary` hanya dapat menangkap error render/lifecycle React.
- Force-close bisa muncul sebelum state error atau toast sempat digambar.

Tanpa logcat/crash report perangkat, audit ini tidak mengklaim nama exception
native yang spesifik. Namun kategori penyebabnya terisolasi kuat: 45 route yang
terdampak berbagi primitive custom ini, dan jalur berisiko sekarang dihapus
seluruhnya. Perbaikan tidak bergantung pada tebakan exception tertentu.

## 4. Mengapa perbaikan lama belum cukup

Audit sebelumnya memperbaiki beberapa bug nyata: `scrollEnabled` selama
request, touch-action web, offset epsilon, reset state, dan callback identity.
Tetapi ia tetap mempertahankan arsitektur paling berisiko:

- custom pan tetap membungkus scroller;
- setiap scroll tetap masuk callback UI-thread;
- manual activation tetap memakai state manager native;
- unit test hanya menguji hasil fungsi matematika;
- `expo export --platform android` hanya membuktikan bundle dapat dibuat, bukan
  handler dapat dijalankan oleh binary/perangkat.

Menambah test `"worklet"` juga hanya membuktikan transformasi Babel. Itu tidak
membuktikan kompatibilitas runtime JS/native atau transisi state gesture pada
perangkat. Karena laporan produksi sudah berupa force-close, mempertahankan
mekanisme tersebut bukan risiko yang dapat diterima.

## 5. Implementasi baru

### 5.1 Android/iOS

`RefreshControl` ditempel melalui prop resmi `ScrollView.refreshControl`.
Konsekuensinya:

- platform sendiri menentukan apakah offset berada di puncak;
- tidak ada pan handler kedua;
- scroll/fling tetap milik satu scroller;
- `enabled=false` mematikan refresh, bukan scroll;
- status `refreshing` tidak pernah dipakai untuk `scrollEnabled`;
- konten pendek tetap dapat refresh di iOS melalui `alwaysBounceVertical`.

### 5.2 Web

Source `react-native-web/src/exports/RefreshControl/index.js` menunjukkan
`RefreshControl` hanya merender `View` kosong dan tidak menyediakan pull
native. Karena itu kontrol tidak dipasang di web. Browser mempertahankan scroll
native tanpa `GestureDetector`, `touch-action` mutation, pointer capture, atau
wrapper animated.

Trade-off ini disengaja: web tidak mendapat gesture pull custom, tetapi tidak
ada lagi primitive global yang dapat mematikan scroll/menutup layar. Refresh
web dapat disediakan kelak sebagai tombol eksplisit yang aksesibel, bukan
intersepsi gesture vertikal global.

### 5.3 Kompatibilitas API

- `onRefresh`, `refreshing`, `enabled`, `contentContainerClassName`, dan
  `scrollViewProps` tetap kompatibel dengan seluruh call site.
- `threshold` dipertahankan sebagai deprecated no-op karena ambang kini milik
  platform native; prop tidak bocor ke `View`.
- `onThresholdReached` dipanggil ketika native telah memutuskan refresh.
- callback sinkron yang melempar dan Promise yang reject ditangkap agar tidak
  menjadi unhandled rejection.
- ref `inFlight` mencegah dua event dalam render yang sama mengirim dua request.
- `refreshControl` dipasang setelah spread `scrollViewProps`, sehingga object
  runtime tidak dapat mengganti kontrol aman walau melewati TypeScript.

## 6. Dependency native dan navigasi

`expo-doctor` menemukan dua peer dependency native tidak dideklarasikan
langsung:

- `expo-linking`, dibutuhkan `expo-router`;
- `expo-asset`, dibutuhkan `expo-audio`/resource pipeline.

Keduanya sebelumnya hanya hadir transitif. Expo memperingatkan kondisi ini
dapat crash di build di luar Expo Go. Keduanya kini menjadi dependency langsung
dengan versi SDK 54 (`expo-linking ~8.0.12`, `expo-asset ~12.0.13`). Setelah
perubahan, pemeriksaan required peer dependencies lulus.

Ini bukan pengganti fix pull-to-refresh, tetapi relevan dengan bagian laporan
"buka halaman baru force-close": navigasi/linking tidak boleh mengandalkan
native peer transitif.

## 7. Guard regresi

### 7.1 Vitest

`tests/pull-to-refresh.test.ts` sekarang mengunci arsitektur keselamatan:

- wajib memakai `ScrollView` + `RefreshControl` RN;
- melarang RNGH, `GestureDetector`, `Gesture.Pan/Native`, PanResponder,
  manual activation, dan state manager;
- melarang Reanimated/worklet pada jalur ini;
- melarang setiap `scrollEnabled` assignment;
- memastikan `enabled=false` memblokir refresh saja;
- memastikan rejection ditangkap dan duplicate request dijaga;
- memastikan prop aman tidak dapat ditimpa oleh spread.

### 7.2 Checker repository

Aturan S7 di `scripts/check-screens.mjs` diperketat. Selain pola lama, checker
sekarang menolak apabila `pull-to-refresh.tsx` mengimpor Gesture Handler,
Reanimated, atau memakai PanResponder. Baseline tetap kosong.

## 8. Matriks risiko setelah perbaikan

| Risiko | Sebelum | Sesudah |
|---|---|---|
| Pan custom ikut setiap scroll | Ya | Tidak |
| Synchronous stateManager pada touch | Ya | Tidak |
| Worklet dapat crash di luar ErrorBoundary | Ya | Tidak pada pull-to-refresh |
| Scroll dimatikan selama request | Pernah/berisiko regresi | Dilarang test + S7 |
| Dua state machine pada gesture vertikal | Ya | Tidak |
| Pull native Android/iOS | Tidak | Ya |
| Scroll web native | Dipengaruhi RNGH/touch-action | Murni browser |
| Duplicate native refresh event | Celah render | Dijaga `inFlight` |
| Peer native router/asset hanya transitif | Ya | Tidak |

## 9. Verifikasi

| Gate | Hasil |
|---|---|
| `npm run check` | **Lulus** — typecheck, lint, token, a11y, screen, inventory, spec, API, web-link, push, dan test |
| Vitest | **23 file / 252 test lulus** |
| `check:screens` S7 | **0 pelanggaran**, baseline kosong |
| `expo export --platform web` | **Lulus**, 98 static route |
| `expo export --platform android` | **Lulus**, 2.382 module → Hermes bundle |
| `expo export --platform ios` | **Lulus**, 2.383 module → Hermes bundle |
| `expo-doctor` required peers | **Lulus** setelah deklarasi `expo-linking`/`expo-asset` |
| Expo runtime fingerprint | **Tidak berubah**: HEAD dan hotfix sama-sama `e9273fb9bbac3d7d1ac94bc3f5c4dc8575e6899e` — aman menargetkan binary runtime yang sama |
| `expo-doctor` keseluruhan | 16/18; dua pemeriksaan online tidak dapat menghubungi Expo/RN Directory karena TLS `ECONNRESET`, bukan validasi source yang gagal |
| Playwright browser | Tidak tersedia; CDN browser Playwright gagal TLS `ECONNRESET` setelah 5 percobaan |

Keterbatasan lingkungan dicatat jujur: sandbox ini tidak menyediakan ADB,
emulator Android, atau simulator iOS. Karena itu klaim “tidak force-close di
perangkat” harus ditutup oleh smoke test build nyata/logcat setelah deploy.
Berbeda dari perbaikan lama, smoke test tersebut sekarang menguji primitive
native standar, bukan state machine custom yang tidak dapat dicakup unit test.

## 10. Smoke test perangkat wajib

Pada Android dan iOS, jalankan minimal:

1. buka Home, Settings, detail Order, Profile, dan satu layar `<DataScreen>`;
2. scroll pendek, scroll panjang, fling ke dua arah, lalu kembali ke route lain;
3. tarik refresh pada konten pendek dan panjang;
4. saat request refresh lambat, terus gulir berulang kali;
5. refresh dua kali cepat — request tidak boleh ganda;
6. pindah route saat refresh berjalan, lalu kembali;
7. ulangi dengan jaringan offline/timeout, dark mode, dan Reduce Motion;
8. pastikan tidak ada fatal log native dan posisi scroll tetap dapat digunakan.

Ekspektasi setelah fix: indikator native tampil pada Android/iOS, request
berjalan sekali, scroll tidak pernah dikunci, dan tidak ada custom touch
callback pull-to-refresh yang dapat menutup aplikasi.
