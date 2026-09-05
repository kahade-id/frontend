# Audit performa frontend

**Tanggal:** 5 September 2026 · **Lingkup:** runtime render, list, jaringan, boot, bundle
**Basis:** commit `e39cba0` (setelah [DEEP-AUDIT-2026-09-05.md](DEEP-AUDIT-2026-09-05.md))

Audit ini mencari biaya yang **tidak terlihat sebagai bug**. Semua temuan di
bawah lolos typecheck, lolos `npm run check`, dan menghasilkan tampilan yang
benar — yang salah hanya berapa kali pekerjaan itu dilakukan.

Angka di dokumen ini hasil pengukuran, bukan perkiraan. Yang tidak terukur
disebut apa adanya di §6.

---

## 1. Temuan utama

### P1 (kritis) — Setiap overlay yang terbuka memicu render loop tak terbatas

`<PortalProvider>` menyimpan `nodes`, `blockingCount`, dan fungsi
`mount/unmount/registerBlocking` dalam **satu** context value. Akibatnya setiap
overlay yang memanggil `useBlockingOverlay` ikut berlangganan `nodes`. Itu
menutup siklus:

```
overlay render
  → <Portal> menerima elemen `children` BARU (objek baru tiap render)
  → effect Portal jalan (deps: [children])
  → mount() → setNodes → context value berubah
  → overlay (konsumen context) render lagi
  → elemen `children` baru lagi → ...
```

**Terukur:** satu overlay terbuka = **502 render dalam 50 ms**, dan React
melempar `Maximum update depth exceeded`. Overlay tetap tampil benar — itu
sebabnya ini tidak pernah terlihat sebagai bug. Yang terjadi hanya React
membakar CPU terus-menerus selama overlay terbuka: baterai habis, animasi
sheet tersendat, dan di perangkat lambat interaksi berhenti merespons.

Terdampak: `<Modal>`/`<Dialog>`, `<BottomSheet>`, `<SearchOverlay>`,
`<LoadingScreen>` — termasuk `<Dialog>` force-update yang dirender di root
layout.

**Perbaikan.** Context dipecah dua:
- `PortalApiContext` — `mount`/`unmount`/`registerBlocking`, semuanya
  `useCallback([])` sehingga identitasnya **stabil selamanya**. Ini yang
  dikonsumsi `<Portal>` dan `useBlockingOverlay`. Siklus putus di sini.
- `PortalStateContext` — `nodes` + `blockingCount`. Hanya `<PortalHost>` (yang
  memang harus menggambar ulang) dan `<PortalScene>` yang berlangganan.

Pelepasan node juga dipindah ke effect unmount tersendiri, supaya perubahan
isi tidak lagi berarti dua `setNodes` (hapus lalu pasang) dengan satu frame
di antaranya tanpa node itu.

**Hasil: 502 render → 1.**

Dijaga oleh `tests/portal.test.tsx`. Guard-nya diverifikasi: dengan
`portal.tsx` dikembalikan ke versi lama, test gagal dengan `Maximum update
depth exceeded`; dengan perbaikan terpasang, lulus.

### P2 — Mengetik di kolom cari menggambar ulang seluruh daftar

Layar Transaksi dan Pencarian menyimpan teks input di state **layar**:

```tsx
const [search, setSearch] = useState("")
const debounced = useDebouncedValue(search.trim())
<SearchField value={search} onChangeText={setSearch} />
<PaginatedList renderItem={({ item }) => <OrderCard … />} />
```

Setiap ketukan huruf merender ulang layar. Karena `renderItem` ditulis inline,
identitasnya berubah dan FlatList menggambar ulang semua baris yang terlihat —
padahal request-nya sendiri baru jalan setelah debounce.

**Terukur** (`tests/list-render.test.tsx`, 20 baris terlihat):

| Pola | mount | 1× state induk berubah |
|---|---:|---:|
| A — baris tanpa memo (pola repo) | 20 | **20** |
| B — baris di-`memo`, callback inline | 20 | **20** |
| C — baris di-`memo` + callback stabil | 20 | **0** |

Baris B penting: **`memo` saja tidak menolong sama sekali**. Prop
`onPress={() => …}` adalah fungsi baru tiap render, jadi pembandingan dangkal
milik `memo` selalu gagal. Menambal per-baris berarti harus benar di dua
tempat sekaligus, di setiap layar, selamanya.

**Perbaikan.** Bukan menambal baris, tapi mengurung state yang berubah cepat:
`components/ui/debounced-search-field.tsx` menyimpan teks di dalam dirinya
sendiri dan hanya mengabarkan kata kunci yang sudah tenang. Layar tidak pernah
melihat teks mentah, jadi daftarnya diam saat pengguna mengetik. Mengetik
"pembayaran" berubah dari 10 × 20 = 200 render kartu menjadi 0.

Bonus: `<SearchField>` **sudah** punya debounce bawaan (`onSearch`) yang
selama ini dilewati kedua layar.

### P3 — `<PaginatedList>` membatalkan optimasinya sendiri

`FlatList` adalah `PureComponent`: ia membandingkan prop secara dangkal untuk
memutuskan perlu-tidaknya menggambar ulang. Enam prop dikirim sebagai objek
baru setiap render, sehingga perbandingan itu **selalu** gagal:
`ItemSeparatorComponent`, `ListHeaderComponent`, `ListEmptyComponent`,
`ListFooterComponent`, `contentContainerStyle`, `style`, plus empat callback.

`ItemSeparatorComponent` paling merugikan: nilainya adalah **tipe komponen**.
Arrow baru = tipe baru = React meng-unmount lalu me-mount ulang setiap
pemisah, bukan sekadar merender ulangnya.

**Perbaikan.** Semuanya di-`useMemo`/`useCallback`, style konstan diangkat ke
module scope. Satu perbaikan, tujuh layar ikut terbawa.

### P4 — Avatar men-serialisasi sumbernya di setiap render, dan tidak punya cache

```tsx
const sourceKey = typeof src === "number" ? src : JSON.stringify(src)
```

`JSON.stringify` di badan render, untuk setiap avatar, di daftar yang justru
sedang di-scroll.

Lebih mahal lagi: `<Avatar>` memakai `Image` dari react-native. Docblock
`<Picture>` sudah menjelaskan panjang lebar kenapa app ini memilih expo-image
(disk cache yang bisa diatur, decode di background thread) — lalu
mengecualikan Avatar dengan alasan "karena selalu lingkaran", yang tidak ada
hubungannya dengan biaya. Padahal avatar justru gambar remote yang **paling
sering berulang**: daftar pengikut, hasil pencarian, kartu pesanan, daftar
chat, ulasan — orang yang sama muncul lagi dan lagi.

**Perbaikan.** `sourceKey` diambil langsung dari URL. Avatar pindah ke
expo-image dengan `cachePolicy="memory-disk"` dan `recyclingKey` (tanpa itu
sel FlatList yang dipakai ulang sempat menampilkan foto orang sebelumnya).
`transition={0}` menjaga tampilan tetap sama — ini soal biaya, bukan animasi
baru.

---

## 2. Yang diperiksa dan ternyata sudah baik

Penting untuk tidak "memperbaiki" hal yang sudah benar:

| Area | Temuan |
|---|---|
| **Polling** | `usePolling` menjadwalkan **setelah** request selesai (bukan `setInterval`), berhenti saat layar tidak fokus, saat app ke background, dan saat tab browser tersembunyi. Tidak pernah menumpuk request. Polling QRIS 3 detik hanya hidup selama sheet bayar terbuka dan status masih menggantung. |
| **Animasi** | 34 dari 36 animasi memakai native driver. Yang `useNativeDriver: false` semuanya animasi `width`/layout yang memang tidak didukung native driver, dan alasannya sudah ditulis di file masing-masing. |
| **Formatter** | Tidak ada `Intl.NumberFormat`/`DateTimeFormat` sama sekali — pemformatan rupiah dan tanggal ditulis tangan di atas array statis. Ini menghindari biaya konstruksi `Intl` yang berulang di dalam list. |
| **Tree-shaking ikon** | 124 ikon dipakai dari 1.512 yang tersedia di phosphor-react-native (paket 77 MB). Diperiksa dengan mencari nama ikon yang tidak diimpor di bundle produksi: tidak ada. Tree-shaking bekerja. |
| **Virtualisasi** | `initialNumToRender`, `maxToRenderPerBatch`, `windowSize` sudah disetel eksplisit. Hanya 7 berkas memakai `.map()` di dalam `<ScrollView>`, semuanya daftar pendek terbatas (metode bank, tab, chip). |
| **Pembatalan request** | `useApiQuery` memakai satu `AbortController` per generasi, jadi respons lambat tidak bisa menimpa data yang lebih baru. |

---

## 3. Ukuran boot & bundle

| | Nilai |
|---|---|
| Bundle JS web | 3,54 MB mentah / **0,90 MB gzip** |
| Font di-load saat boot | **7 file, 1,31 MB** |
| Aset lain | ~150 KB |
| Route ter-prerender | 96 |

Font adalah biaya boot terbesar, dan `app/_layout.tsx` **menahan seluruh tree
app** sampai ketujuhnya selesai (`ready ? <ThemeProvider>… : null`). Itu
keputusan yang disengaja dan didokumentasikan — mencegah FOUT — jadi saya
tidak mengubahnya.

Yang layak ditindaklanjuti adalah isi filenya, bukan gerbangnya:

| Font | Ukuran | Dipakai untuk |
|---|---:|---|
| EBGaramond-Medium | 383 KB | wordmark logo, `<DisplayHeading>`, `<ResultState>` |
| JetBrainsMono-SemiBold | 267 KB | nominal uang |
| JetBrainsMono-Medium | 264 KB | nominal uang |
| SofiaSans × 4 | 432 KB | seluruh teks UI |

EB Garamond dan JetBrains Mono dikirim utuh — termasuk Yunani, Sirilik, dan
ratusan glif yang tidak akan pernah muncul di UI berbahasa Indonesia.
Mono praktis hanya perlu angka, `Rp`, titik, dan koma. **Subset ke Latin +
tanda baca diperkirakan memangkas ~1 MB dari 1,31 MB.**

Saya **tidak** melakukannya: itu mengubah file biner aset, dan kalau ada satu
karakter yang luput (nama pengguna dengan diakritik, mata uang lain nanti)
hasilnya adalah glif kotak di produksi. Perlu keputusan Anda soal cakupan
karakter, dan verifikasi visual yang belum bisa saya jalankan di sini (§6).

---

## 4. Yang tidak saya ubah, dan alasannya

**`useApiQuery` tidak punya cache.** 23 layar memakainya; setiap kali layar
di-mount, request diulang dari nol dengan skeleton penuh. Kembali dari detail
pesanan ke daftar = ambil ulang seluruh halaman pertama. `api.users.getMe()`
saja dipanggil dari 8 layar berbeda tanpa dedup.

Ini nyata, tapi memperbaikinya berarti memperkenalkan lapisan cache
(stale-while-revalidate, invalidasi setelah mutasi, kebijakan TTL per
endpoint). Itu perubahan arsitektur yang menyentuh semua layar dan mengubah
kapan pengguna melihat data basi — bukan sesuatu yang pantas saya putuskan
sendiri lalu selipkan di audit performa. Saya catat sebagai keputusan terbuka.

**Gerbang font di boot** — lihat §3.

**Baris list belum di-`memo`.** Setelah P2, layar dengan kolom cari tidak lagi
merender ulang daftarnya, jadi pemicu paling sering sudah hilang. Sisa kasus
(mis. `<Dialog>` terbuka di atas daftar) sekarang jauh lebih murah karena P1.
Menambal 207 komponen dengan `memo` tanpa merapikan prop callback-nya hanya
menambah biaya perbandingan tanpa hasil — tabel di §1/P2 baris B menunjukkan
kenapa.

---

## 5. Berkas yang berubah

| Berkas | Perubahan |
|---|---|
| `components/ui/portal.tsx` | Context dipecah API/State; effect pelepasan dipisah (P1) |
| `components/ui/paginated-list.tsx` | Sepuluh prop distabilkan (P3) |
| `components/ui/debounced-search-field.tsx` | **Baru** — mengurung state ketikan (P2) |
| `components/ui/avatar.tsx` | expo-image + cache + `recyclingKey`; `JSON.stringify` dibuang (P4) |
| `app/(tabs)/transactions.tsx`, `app/search.tsx` | Pakai `<DebouncedSearchField>` (P2) |
| `tests/portal.test.tsx` | **Baru** — regresi render loop |
| `tests/list-render.test.tsx` | **Baru** — tabel biaya render baris |
| `vitest.config.ts` | Dukungan uji komponen (jsdom + react-native-web) |

### Catatan: repo ini belum pernah punya uji komponen

Semua 122 test sebelumnya adalah `.ts` murni (format, financial, api, hooks).
Tidak ada satu pun yang me-render komponen — itulah sebabnya render loop di
`<Portal>` bisa hidup tanpa terdeteksi meskipun `npm run check` hijau.

Dua hambatan yang perlu diketahui sebelum menambah uji komponen baru:

1. `tsconfig` memakai `jsxImportSource: "nativewind"`. Di bawah Vitest, runtime
   itu menarik `react-native` asli yang masih ber-syntax Flow dan gagal
   di-parse Node (`Unexpected token 'typeof'`). Config sekarang meng-override
   ke `jsxImportSource: "react"`; konsekuensinya `className` tidak ikut diuji.
2. Alias `react-native` → `react-native-web` **harus** regex ber-anchor
   (`/^react-native$/`). Alias string di Vite cocok sebagai prefix, sehingga
   kunci `"react-native"` ikut menangkap `"react-native-web"` dan menulisnya
   menjadi `"react-native-web-web"`.

Berkas uji komponen memilih jsdom lewat komentar `@vitest-environment jsdom`
di barisnya sendiri, jadi 122 test lama tetap berjalan di environment `node`
yang lebih cepat.

Komponen yang menarik `react-native-reanimated` / `react-native-gesture-handler`
(mis. `<Button>` lewat `<PressableScale>`) belum bisa di-render di jsdom.
Itu batas nyata dari harness ini.

---

## 6. Verifikasi

```
npm run check     # typecheck, check:tokens, check:a11y, check:screens,
                  # check:api, 127 test (naik dari 122) → semua lolos
npx expo export --platform web   # build produksi berhasil
npm run preview:web              # /, /search, /transactions, /appearance,
                                 # /favorites → HTTP 200
```

**Tidak dijalankan:** `npm run test:e2e`. Unduhan browser Playwright tetap
gagal di sandbox ini (`ECONNRESET` ke `cdn.playwright.dev`). `tests/e2e/`
tidak diubah dan workflow CI tetap menjalankannya.

**Belum diverifikasi secara visual.** Empat perubahan menyentuh hal yang
terlihat dan statusnya lolos typecheck + build + test, **bukan** lolos
pemeriksaan mata:

- `<Avatar>` berpindah ke expo-image — perlu dilihat di daftar pengikut, chat,
  dan kartu pesanan (termasuk saat foto gagal dimuat → harus jatuh ke inisial).
- `<PaginatedList>` — pemisah antarbaris dan header/footer.
- Layar Transaksi & Pencarian — perilaku mengetik, tombol clear, dan chip
  saran (chip me-mount ulang field lewat prop `key`).
- Semua overlay setelah pemecahan context Portal.

**Angka pada P1 dan P2 berasal dari jsdom**, bukan dari perangkat. Yang diukur
adalah **jumlah render** — properti React yang sama di semua platform — bukan
milidetik. Dampak milidetiknya di perangkat Android kelas bawah belum diukur
dan akan lebih besar daripada di jsdom, bukan lebih kecil.

---

## 7. Yang masih terbuka

1. **Cache/dedup lapisan data** (§4) — keputusan arsitektur, perlu persetujuan.
2. **Subset font** (§3) — perkiraan hemat ~1 MB, perlu keputusan cakupan karakter.
3. **Uji komponen untuk tree ber-reanimated** (§5) — butuh mock atau
   `react-native-reanimated/mock`.
4. **Profil di perangkat nyata** — Hermes sampler / Flipper untuk mengubah
   "jumlah render" menjadi milidetik pada perangkat target.
5. Sisa dari audit sebelumnya tetap berlaku: 32 layar pada baseline S1/S2/S3,
   38 komponen UI tanpa pemakaian, dan blocker R01–R09 di [REPORT.md](REPORT.md).
