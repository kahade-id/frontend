# Audit Mekanis <PullToRefresh> — "ga bisa di scroll"

- Tanggal : 2026-09-08
- Pemicu : laporan pengguna — layar dengan pull-to-refresh tidak bisa di-scroll.
- Cakupan : `components/ui/pull-to-refresh.tsx` (satu-satunya implementasi
  pull-to-refresh custom), `lib/use-api-query.ts`, `lib/use-paginated-query.ts`,
  `components/ui/data-screen.tsx`, `components/ui/paginated-list.tsx`, dan
  seluruh 48 layar yang memakai kerangka tersebut, di tiga target (Android,
  iOS, web).
- Metode : setiap temuan punya bukti `file:baris`. Klaim tentang perilaku
  pustaka diverifikasi terhadap sumber paket yang TERPASANG (RNGH 2.28.0,
  Reanimated 4.1.7, RN 0.81.5, react-native-web, expo-router), bukan terhadap
  dokumentasi. Temuan yang terbukti BUKAN bug tetap dicatat (Bagian C) —
  laporan ini memuat hasil negatif, termasuk satu temuan yang saya tarik
  kembali karena dibantah checker repo sendiri.

## Ringkasan diagnosis

Gejalanya satu ("tidak bisa di-scroll"), jalurnya empat, dan ketiganya punya
bentuk yang sama: **komponen gesture mencoba melumpuhkan scroll supaya tidak
berebut.** Mekanisme pelumpuhan itulah yang bocor, bukan gesture-nya.

| # | Temuan | Platform | Dampak | Status |
|---|---|---|---|---|
| F1 | `scrollEnabled={!refreshing && …}` — scroll dimatikan selama refresh berjalan | Android, iOS, web | Layar beku 20–40 detik per refresh (bisa ±61 dtk) | **DI PERBAIKI** |
| F2 | Di web, `scrollEnabled={false}` = `overflow:hidden`, bukan "abaikan sentuhan" | web | Scroll mati + posisi scroll hilang | **DI PERBAIKI** (ikut F1) |
| F3 | `<GestureDetector>` tanpa `touchAction` → RNGH memasang `touch-action:none` pada elemen yang bisa di-scroll | web | Daftar tidak bisa digeser dengan sentuhan | **DI PERBAIKI** |
| F4 | "Di puncak" diuji `scrollOffset > 0` tanpa toleransi | Android, iOS | Tarikan tidak pernah memicu refresh (offset sub-piksel) | **DI PERBAIKI** |
| F5 | `decided` hanya di-reset di `onTouchesDown`; `scrollLocked` hanya dilepas di `onFinalize`/`onUpdate` | Android, iOS | Sentuhan mati permanen sampai tap berikutnya; konten tertinggal tergeser | **DI PERBAIKI** |
| F6 | Identitas objek gesture berubah tiap render (20 layar mengirim `onRefresh={() => …}`) | semua | RNGH menulis ulang config handler di tengah tarikan | **DI PERBAIKI** (diperketat) |

## Status verifikasi akhir

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint .` | 0 error |
| `npm run check` (tokens, a11y, screens, inventory, spec, api, weblinks, push) | exit 0 |
| `check-screens` | S1 2 · S2 0 · S3 31 · S4 0 · S5 30 · S6 0 · **S7 0** (aturan baru) |
| `vitest` | 23 berkas / **261** tes lolos (245 → 261, +16 tes mekanika pull) |
| `expo export --platform web` | sukses |
| `npm run test:e2e` | TIDAK dijalankan — tidak ada browser di sandbox |
| Perangkat keras/emulator | TIDAK dijalankan — Bagian F = daftar uji manual untuk QA |

---

## Bagian A — Temuan dan perbaikannya

### F1. Scroll dimatikan selama refresh (akar keluhan utama)

`components/ui/pull-to-refresh.tsx` (sebelum audit, baris 399):

```tsx
scrollEnabled={!refreshing && !scrollLocked}
```

`refreshing` di 48 layar bukan state lokal — ia mengalir dari
`useApiQuery.refreshing` / `usePaginatedQuery.refreshing` (mis.
`components/ui/data-screen.tsx:145`, `app/ratings.tsx:263`). Jadi selama
request penyegaran berlangsung, seluruh isi layar tidak bisa digulir.

Berapa lama? Durasinya adalah durasi request, dan request di repo ini:
- `lib/api/config.ts:19` → `API_TIMEOUT_MS = 20_000`;
- `lib/api/client.ts:419` → `retry = method === "GET" ? Math.min(2, options.retry ?? 0) : 0`,
  dan **72 pemanggilan adapter GET mengirim `retry: 1`** (mis.
  `lib/api/wallet.ts:95`) → 2 percobaan;
- jeda backoff `400 * (count + 1)` (`lib/api/client.ts:426`).

Angka nyata: **±40,4 detik** layar terkunci per refresh di jaringan yang
memecet (2 × 20 s + 0,4 s), maksimum **±61,2 detik** bila `retry: 2`.
Pada layar dengan beberapa request paralel (`app/analytics.tsx`,
`app/(tabs)/wallet.tsx`) window-nya sama karena request berjalan paralel.

Ini juga menjelaskan sifat "kadang-kadang"-nya: di WiFi, refresh selesai
±300 ms sehingga penguncian tidak terlihat; di jaringan seluler, layar
terasa mati total.

**Perbaikan.** `scrollEnabled` dilepas sama sekali dari kendali komponen. Yang
menjaga tarikan tidak berebut dengan scroll bukan lagi kunci, melainkan
fakta bahwa tarikan **hanya boleh aktif di puncak**, dan di puncak scroll
native memang tidak punya tempat untuk pergi: `bounces={false}` (iOS) dan
`overScrollMode="never"` (Android) sudah dipasang komponen ini. Tidak ada yang
perlu dilindungi dari scroll → tidak ada yang boleh dikunci dari scroll.

### F2. Di web, `scrollEnabled={false}` berarti `overflow:hidden`

`react-native-web/dist/exports/ScrollView/ScrollViewBase.js:127,135-138`:

```js
style: [style, !scrollEnabled && styles.scrollDisabled, …]
// styles.scrollDisabled = { overflowX:'hidden', overflowY:'hidden', touchAction:'none' }
```

Di native `scrollEnabled={false}` masih berarti "elemen ada, posisinya
dipertahankan". Di web elemen itu berhenti menjadi scroll container:
bilah scroll hilang dan posisi gulir tidak dapat dipertahankan secara andal.
Perbaikan F1 menghapus sumbernya; aturan S7 (Bagian D) mencegah varian
lainnya masuk lagi.

### F3. `touch-action: none` dipasang LANGSUNG di scroll container (web)

RNGH menerapkan `touch-action` ke elemen tempat detector dipasang — dan
detector kita dipasang tepat di `<AnimatedScrollView>`:

```js
// react-native-gesture-handler/lib/commonjs/web/tools/GestureHandlerWebDelegate.js:101-106
this.view.style['touchAction'] = isHandlerEnabled ? touchAction ?? 'none' : …
```

Default-nya terdokumentasi di tipe detector itu sendiri
(`…/GestureDetector/index.d.ts`): *"Default value is set to `none`"*.
`touch-action: none` pada elemen yang bisa di-scroll = browser tidak akan
pernah menggesernya dengan sentuhan.

Kenapa ini tidak selalu terlihat mati: `Gesture.Native()` yang ikut
dikomposisikan memakai `NativeViewGestureHandler`, yang pada web
MENULIS ULANG `touch-action:'auto'` ke elemen yang sama
(`…/web/handlers/NativeViewGestureHandler.ts:41-56`, dipanggil di `init()` dan
setiap `updateGestureConfig()`). Jadi nilainya bergantian `none` ↔ `auto`
tergantung urutan init/update — persis ciri "di web kadang bisa kadang tidak".
Komentar lama file ini mengklaim manual-activation sudah melindungi web
("scroll roda/drag native browser tidak pernah terganggu"); klaim itu salah:
`touch-action` dipasang saat handler *terdaftar & aktif*, bukan saat gesture
*diaktifkan*.

**Perbaikan.** `<GestureDetector gesture={composed} touchAction="pan-y">`.
Scroll sentuhan browser kembali utuh, dan tarikan tetap bekerja karena di
puncak tidak ada scroll yang bisa dimulai sehingga browser tidak mengirim
`pointercancel`. Ditambah `overscroll-behavior-y: contain` pada scroller agar
tarikan di puncak tidak dirantingkan ke dokumen — aman di app ini karena
`ScrollViewStyleReset` sudah memasang `body{overflow:hidden}`
(`expo-router/build/static/html.js:21`), sehingga tidak ada scroll halaman
yang bisa "mencuri" gesture.

### F4. "Di puncak" diuji tanpa toleransi

Sebelum: `if (scrollOffset.value > 0) { …fail… }` (baris 248 & 276).
`contentOffset.y` bukan 0 genap di perangkat nyata — 0.33/0.997 lazim
setelah fling berhenti atau setelah tinggi `contentContainerStyle` berubah.
Offset 0.33 sudah cukup untuk menyimpulkan "belum di puncak" → tarikan tidak
pernah aktif, dan (gabungan F1/F5) layar bisa tertinggal dalam keadaan
terkunci.

**Perbaikan:** `isAtTop(offsetY)` dengan `AT_TOP_EPSILON = 1` di
`lib/pull-math.ts`, dikunci tes "menerima offset sub-piksel sebagai puncak".

### F5. State per-gesture yang bisa bocor

Dua kebocoran di kode lama:

1. `decided.value = false` hanya di `onTouchesDown` (baris 236).
   `onTouchesDown` adalah event yang boleh tidak datang (sentuhan dimulai saat
   `enabled` masih false; handler belum terpasang). Kalau `decided` tertinggal
   `true`, `onTouchesMove` langsung `return` selamanya → pan tidak pernah bisa
   memutuskan lagi → **pull-to-refresh mati untuk sisa hidup layar**, tanpa
   pesan.
2. `scrollLocked` hanya dilepas di `onFinalize` (329) dan dua cabang `onUpdate`
   (279, 290). `onFinalize` tidak dijamin datang untuk handler yang
   dinonaktifkan di tengah gesture (`enabled={refreshable && !loading}`
   berbalik saat `loading` menyala → `DataScreen` mengganti isi dengan
   `<LoadingScreen>`). `runOnJS(setState)` yang tertunda + render berikutnya =
   `scrollEnabled` bisa tertinggal `false` → **layar terkunci sampai sentuhan
   berikutnya**, persis keluhan yang dilaporkan.

**Perbaikan:** seluruh state per-gesture (`decided`, `reached`, `pulling`,
`anchor`) di-reset di `onFinalize` **dan** di effect `enabled` (yang kini juga
men-settle `pull` agar konten tidak tertinggal tergeser). `scrollLocked`
dihapus — tidak ada lagi kunci yang bisa bocor, dan tidak ada setState per
gerakan jari.

### F6. Objek gesture dibuat ulang setiap render layar

`pan` adalah `useMemo` dengan deps yang memuat `startRefresh`, dan
`startRefresh` bergantung pada prop `onRefresh`. **20 layar** menulis
`onRefresh={() => void query.refresh()}` (mis. `app/ratings.tsx:262`,
`app/bank-accounts.tsx:158`, `app/kyc.tsx:208`) — fungsi baru setiap render.
Render di tengah tarikan dijamin terjadi (tarikan memicu `setRefreshing(true)`
di induk), jadi objek `Gesture.Pan()` baru dibuat *saat gesture aktif*.

Catatan jujur tingkat keparahannya: RNGH **tidak** me-reattach handler untuk ini
(`needsToReattach.js` hanya memicu reattach bila jumlah/`handlerName`/thread
berubah), ia memanggil `updateHandlers` — efeknya konfigurasi handler ditulis
ulang di tengah gesture (`GestureDetector/index.js:97-103`:
`useEffect(…, [props])`), bukan scroll dimatikan. Ini bukan penyebab utama
F1–F5, jadi masuk kategori "diperketat", bukan "diperbaiki".

**Perbaikan:** `onRefresh`, `onThresholdReached`, `controlled`, `threshold`
dibaca dari satu ref `handlers`, sehingga deps `pan` hanya berisi shared value
+ primitif (`enabled`, `threshold`) dan identitas gesture tidak pernah berubah
lagi saat layar render.

---

## Bagian B — Perubahan

| Berkas | Isi |
|---|---|
| `components/ui/pull-to-refresh.tsx` | F1–F6. Blok "ATURAN EMAS" di kepala file menjelaskan kenapa komponen ini tidak boleh pernah menyentuh `scrollEnabled`. |
| `lib/pull-math.ts` | **baru** — `isAtTop`, `decidePull`, `pullDistance`, `reachedThreshold` + konstanta ambang. Murni, tanpa React, bisa diuji di Node. |
| `tests/pull-to-refresh.test.ts` | **baru** — 16 tes kontrak keputusan gesture. |
| `scripts/check-screens.mjs` | Aturan **S7** (baseline kosong, tidak boleh ada pengecualian). |
| `app/(tabs)/wallet.tsx` | Docblock menyatakan layar ini memakai `<PullToRefresh>` logo Kahade — padahal yang dirender `<PaginatedList>` (RefreshControl FlatList). Komentar dikoreksi + alasan desain ditulis supaya tidak "diperbaiki" jadi dua ScrollView bertingkat. |

`components/ui/data-screen.tsx` sengaja tidak berubah: `enabled=` dan
`refreshing=` tetap prop yang benar, hanya maknanya yang berubah (indikator,
bukan rem scroll) — didokumentasikan di `PullToRefreshProps.refreshing`.

---

## Bagian C — Diperiksa dan BUKAN bug (hasil negatif)

Dicatat supaya audit berikutnya tidak mengulang pekerjaan yang sama.

1. **Hook data tidak meninggalkan `refreshing` tersangkut.** `useApiQuery`
   membersihkan flag di `finally` dengan guard `!controller.signal.aborted`
   (`lib/use-api-query.ts:54-59`). Saya coba konstruksi jalur di mana request
   terakhir di-abort dan tidak ada penerusnya: semua jalur abort
   (`key` berubah, `enabled` berubah, `reload()`, fokus) selalu diikuti
   request baru yang membersihkan flag; satu-satunya tanpa penerus adalah
   unmount, dan state komponen itu sudah tidak dibacakan. Guard
   `if (active.current === controller)` pada `usePaginated-query.ts:62`
   justru sudah bentuk yang benar. **Tidak diubah** — dengan F1 hilang,
   flag yang tersangkut tinggal menyisakan logo berdenyut, bukan layar terkunci.
2. **`<PaginatedList>` tidak kehilangan indikator refresh.** Ia mengirim
   `refreshing`/`onRefresh` ke `FlatList` tanpa `refreshControl` eksplisit
   (`components/ui/paginated-list.tsx:185-186`). RN 0.81.5
   (`@react-native/virtualized-lists` `Lists/VirtualizedList.js:1290-1304`)
   masih membuat `<RefreshControl>` sendiri bila `refreshControl == null`.
   Berfungsi, dengan konsekuensi yang disengaja: spinner OS, bukan logo (§8).
3. **`contentContainerClassName` tidak menimpa `contentContainerStyle` milik
   pemanggil.** `DataScreen` mengirim keduanya
   (`components/ui/data-screen.tsx:149-150`). NativeWind memakai
   `assignToTarget(…, { arrayMergeStyle: "push" })`
   (`react-native-css-interop/dist/shared.js:41-69`) → nilainya digabung ke
   array, `paddingBottom` inset bawah tetap hidup.
4. **`lib/api/client.ts` tidak membocorkan timer/listener.** `bounded()`
   memanggil `clearTimeout(timer)` dan `removeEventListener("abort", interrupt)`
   di `finally` (baris 159-161).
5. **Tidak ada scroll container bertingkat.** Pemindaian seluruh rentang
   `<PullToRefresh>…</PullToRefresh>` di `app/` + `components/`: 0 kemunculan
   `ScrollView`/`FlatList`/`PaginatedList` di dalamnya. 0 layar
   `<Screen scroll>` + `<PullToRefresh>`. Kelas bug "dua scroll parent
   berebut gesture" tidak ada di repo ini.
6. **Temuan saya sendiri yang DITARIK: `pointerEvents`.** Saya sempat
   memindahkan `pointerEvents:"none"` dari `style` ke prop dengan alasan
   "di native itu bukan kunci style". `npm run check:a11y` menolaknya
   (aturan H, `scripts/check-a11y.mjs:37-38,388-402`): RN menandai prop itu
   deprecated dan react-native-web mengenalnya justru hanya lewat StyleSheet
   compiler (`react-native-web/dist/exports/StyleSheet/compiler/index.js:348`).
   Bentuk lama sudah benar; komentar di kode kini mencatat alasannya supaya
   tidak "dirapikan" orang berikutnya.

---

## Bagian D — Penjaga regresi

**Aturan S7** di `npm run check:screens` menandai dua bentuk pelumpuhan scroll
di `components/` + `lib/` (komentar dikecualikan, seperti aturan lain):

```
scrollEnabled={…(refreshing|loading|isValidating)…}
<GestureDetector> + JSX scroll container tanpa touchAction=
```

Baseline `[]` — tidak ada pengecualian, dan baseline tidak boleh bertambah.
Bukti aturan ini tidak kosong-kosong (dijalankan terhadap `git show HEAD`):

```
LAMA (HEAD)  clauseA=true  clauseB=true  => MELANGGAR
BARU         clauseA=false clauseB=false => lolos
```

16 tes di `tests/pull-to-refresh.test.ts` mengunci kontrak `lib/pull-math.ts`:
toleransi sub-piksel, fail-permanent di tengah list (bukan handler
menggantung), ketiadaan lompatan di titik ambang, cap overpull, larangan nilai
negatif, dan `threshold=0` yang tidak boleh jadi tarik-bebas.

---

## Bagian E — Yang sengaja dibiarkan (butuh keputusan produk)

1. **`onThresholdReached` belum dipakai satu layar pun.** expo-haptics sudah
   terpasang dan `lib/haptics.ts:12` sudah menempatkan threshold
   pull-to-refresh di nada `warning`. Satu baris per layar (`DataScreen`) akan
   membuatnya konsisten; tidak saya pasang karena ini keputusan rasa, bukan
   cacat.
2. **Dua keluarga kerangka, dua indikator.** 48 layar memakai logo Kahade
   via `<PullToRefresh>`, 9 layar daftar panjang memakai spinner OS via
   `FlatList`. Menyeragamkan = membungkus FlatList dengan ScrollView →
   justru membuka lagi kelas bug F1/F5. Kalau §8 memang menuntut logo di
   mana-mana, jalurnya adalah `refreshControl={<RefreshControl …/>}` kustom,
   bukan Nested ScrollView.
3. **`useApiQuery` — flash `<LoadingScreen>` saat refresh menimpa muat-awal.**
   Bila `load(true)` datang saat muat awal masih berjalan, muat awal di-abort
   dan tidak membersihkan `loading`, sementara `load(true)` tidak menyetelnya
   ulang (`lib/use-api-query.ts:46-47`). `loading` benar kembali saat request
   selesai, jadi ini kedipan ±durasi request, bukan keadaan terkunci.
   Perbaikannya mengubah arti `loading` menjadi "belum ada data" — dampak
   luas ke 55 layar, perlu sesi sendiri.
4. **31 layar masih menyalin kerangka `Screen+Header+PullToRefresh`** (S3).
   Tidak terkait gejala ini; migrasi ke `<DataScreen>` justru memperkecil
   permukaan bug gesture karena `enabled`/`refreshing` dirakit di satu tempat.

## Bagian F — Uji manual di perangkat (belum dilakukan di sandbox)

Tidak ada emulator/browser di lingkungan ini, jadi bagian ini adalah daftar
untuk QA. Setiap baris adalah satu temuan di atas; semuanya harus **lolos**
setelah perbaikan:

1. **F1** — Daftar 40+ baris, tahan tarikan sampai logo berdenyut, dan *saat
   denyut masih berjalan* coba gulir ke bawah. Sebelum: terkunci sampai
   request selesai. Sesudah: gulir langsung jalan.
2. **F1 (jaringan buruk)** — DevTools → network throttling / airplane mode
   sesaat setelah menarik; refresh akan menggantung sampai timeout 20 s.
   Daftar harus tetap bisa digulir selama itu.
3. **F2/F3 (web)** — di HP (Chrome Android & Safari iOS) pada layar Dompet
   atau Transaksi: gulir biasa dengan sentuhan, lalu gulir dari posisi
   pertengahan daftar ke paling bawah. Tidak boleh ada wilayah yang mati sentuhan.
4. **F4** — Setelah fling cepat ke atas (list berhenti di puncak), langsung
   tarik turun satu kali. Refresh harus terpicu; sebelum perbaikan fling
   terakhir sering meninggalkan offset sub-piksel sehingga tarikan pertama
   "tidak mempan".
5. **F5** — Tarik setengah jalan lalu biarkan layar pindah ke `<LoadingScreen>`
   (mis. memicu refresh dari tempat lain / `refreshOnFocus`). Lepas jari:
   konten harus sudah kembali ke 0 dan scroll normal, tanpa perlu tap dulu.
6. **Semua** — putar layar, dark mode, Reduce Motion aktif: tidak ada regresi
   posisi konten (indikator tertinggal di ambang).
