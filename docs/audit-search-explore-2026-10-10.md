# Audit Search & Explore — 10 Oktober 2026

Cakupan: layar Pencarian (`components/screens/search-screen.tsx`), API pencarian
(`lib/api/search.ts`, `lib/api/users.ts`, `lib/api/commerce.ts`), feed Explore
(`components/showcase-feed-tab.tsx`, `lib/showcase-filters.ts`,
`lib/showcase-feed-logic.ts`), tab Temukan (`components/discover-users-tab.tsx`),
dan backend modul search (`src/modules/search/*`), trends
(`src/modules/commerce/*/search-trends.*`), user search (`src/modules/users/*`),
feed etalase (`src/modules/showcase/showcase.service.ts#getFeed`), chat search.

Catatan cakupan:
- **Hashtag**: tidak ada fitur hashtag di produk (tidak ada parser `#tag` di FE
  maupun kolom di BE). Yang ada: kategori (`category`) + pencarian teks. Tidak
  ada yang bisa "rusak"; tidak dibuat fitur baru.
- **Admin**: tidak ada halaman admin untuk search/trending (tidak ada file yang
  menyentuh modul ini di `admin-wt-search`). Tidak ada perubahan admin.

Status: ✅ diperbaiki · ⏭ ditunda (alasan dicatat) · ℹ catatan.

## A. Kritis (hasil salah / fitur mati)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-01 | **Trending tidak pernah terisi.** `POST /v1/commerce/trends/record` tidak ditandai `@Public()`, padahal `JwtAuthGuard` global → FE memanggil dengan `auth:"none"` (tanpa token) → selalu 401, ditelan `.catch` → tabel `search_keywords` kosong, "Sedang tren" tidak pernah muncul. | BE `search-trends.controller.ts:17`, FE `lib/api/commerce.ts:333` | ✅ |
| S-02 | **Riwayat pencarian tidak mencatat cakupan Postingan/Pengguna/Pesan.** Riwayat hanya disimpan di dalam `GET /v1/search`; cakupan `posts`/`users`/`chats` tidak memanggil endpoint itu → pencarian produk (kasus utama) tidak pernah masuk riwayat. | FE `search-screen.tsx:354-385`, BE `search.service.ts:49` | ✅ `POST /v1/search/history` + FE mencatat saat kata kunci stabil |
| S-03 | **Trending & riwayat tercemar prefiks.** Trend dicatat per kata kunci ter-debounce (300 ms): mengetik "sepatu" merekam "se", "sep", "sepa"… → "Sedang tren" berisi potongan kata. Riwayat server sama (disimpan tiap panggilan). | FE `search-screen.tsx:428-434`, BE `search.service.ts:77-86` | ✅ FE: catat setelah 2 dtk stabil / Enter; BE: hapus entri prefiks & duplikat case-insensitive |
| S-04 | **Fokus keyboard melompat ke kolom Lokasi saat mengetik.** `SearchField` default `autoFocus=true`; kolom lokasi dimount saat `enabled` berubah true (setelah 2 huruf) → mencuri fokus dari kolom kata kunci. | FE `search-screen.tsx:814-823`, `search-field.tsx:70` | ✅ |
| S-05 | **Pencarian pengguna gagal 429 setelah beberapa ketikan.** `GET /v1/users/search` dibatasi 10 req/menit/IP; layar menembaknya tiap kata kunci ter-debounce DAN juga `/v1/search` (keduanya mengembalikan users) → duplikasi + limit habis saat mengetik nama panjang. | BE `users.controller.ts:386`, FE `search-screen.tsx:363-367` | ✅ cakupan "Semua" memakai users dari `/v1/search` saja; endpoint dedikasi hanya untuk cakupan Pengguna; throttle 10→30 |
| S-06 | **`GET /v1/users/search` tidak cocok prefiks.** Memakai `plainto_tsquery` → "sant" tidak menemukan "santoso"; hanya kata utuh. Sedangkan `/v1/search` memakai `w:*`. | BE `users.service.ts:694-712` | ✅ tsquery prefiks per kata (index GIN tetap identik) |
| S-07 | **Pencarian feed multi-kata = frasa persis.** `search` dipakai utuh sebagai `ILIKE '%sepatu nike%'` → "Nike sepatu running" tidak cocok. | BE `showcase.service.ts:1644-1657` | ✅ tiap kata harus cocok (AND of OR) |
| S-08 | **Wildcard LIKE tidak di-escape di pencarian pesan.** `normalizeSearchTerm` hanya trim/slice; `%`/`_` dari pengguna jadi wildcard (`"100%"` cocok semua pesan). Melanggar aturan R2-M. | BE `chat.service.ts:2438,2478,2524` | ✅ |
| S-09 | **Hint backend berbahasa Indonesia ditampilkan apa adanya** di empty state → melanggar "semua teks via i18n" (pengguna EN melihat kalimat Indonesia). | BE `search.service.ts:69-74`, FE `search-screen.tsx:944` | ✅ BE kirim `hintCode`, FE menerjemahkan |

## B. Performa (lambat / N+1 / query ganda)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-10 | `suggestions()` menjalankan 3 raw query **berurutan** (await satu-satu) → 3× latensi per ketikan. | BE `search.service.ts:149-203` | ✅ `Promise.all` |
| S-11 | `searchShowcase` & `searchHelpCenter` jalur FTS: COUNT dijalankan **setelah** rows (serial), bukan paralel. | BE `search.service.ts:454,486,520` | ✅ |
| S-12 | `getBlockedUserIds` (query `block_lists`) dipanggil di `searchUsers` DAN `searchShowcase` padahal jalur FTS memakai subquery `blockExclusionSql` → 2 query sia-sia per pencarian. | BE `search.service.ts:208,431` | ✅ hanya di jalur fallback ORM |
| S-13 | `searchHelpCenter` mengirim `answer` penuh (bisa ribuan karakter) padahal FE memotong 200. | BE `search.service.ts:505` | ✅ `LEFT(answer, 300)` |
| S-14 | `serializeFeedPage`: 5 query batch (liked, saved, badge, followed, bestseller) **berurutan**. | BE `showcase.service.ts:2050-2060` | ✅ `Promise.all` |
| S-15 | Feed `search` ILIKE `%…%` di title/description/category + join users (username/fullName) dan filter lokasi `users.address` tanpa index trigram → seq scan; ekstensi `pg_trgm` sudah ada (migrasi AW-003). | BE `showcase.service.ts:1646-1657,1700` | ✅ migrasi index-only `20261010090000_search_trgm_indexes` (tidak menyentuh `schema.prisma`) |
| S-16 | `getTrending` tanpa jendela waktu — "tren" = populer sepanjang masa; satu kata kunci viral setahun lalu menetap selamanya. | BE `search-trends.service.ts:46` | ✅ hanya kata kunci yang dicari 30 hari terakhir |
| S-17 | `searchListHeader` di-memo tetapi deps memuat `setScope` yang dibuat ulang tiap render → memo tidak pernah hit, header (chip, saran, riwayat) dirender ulang tiap render layar. | FE `search-screen.tsx:318,894` | ✅ `useCallback` |
| S-18 | `rows` memo tidak memasukkan `walletEnabled` ke deps → saat kill-switch dompet berubah, baris mutasi basi. | FE `search-screen.tsx:537` | ✅ |

## C. Relevansi & urutan

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-19 | `searchUsers` (global) FTS: `ORDER BY rank DESC` tanpa tiebreak → urutan tidak deterministik antar request; tidak ada boost username persis/prefiks seperti endpoint dedikasi. | BE `search.service.ts:233` | ✅ boost username persis → prefiks → rank → `totalOrdersCompleted` → id |
| S-20 | `searchUsers` fallback ORM `findMany` tanpa `orderBy` → urutan acak. | BE `search.service.ts:254` | ✅ |
| S-21 | `users.service.searchUsers` OFFSET pagination tanpa tiebreak `id` → halaman 2 bisa duplikat/lompat. | BE `users.service.ts:697-702` | ✅ |
| S-22 | Chip saran menampilkan kata yang sama persis dengan kata kunci ("sepatu" saat mencari "sepatu") → kebisingan. | FE `search-screen.tsx:582-594` | ✅ |
| S-23 | "Mungkin maksud Anda" dihitung dari `suggestions`, tetapi query saran hanya aktif di cakupan "Semua" → empty state cakupan lain tidak pernah menawarkan koreksi (komentar kode mengklaim sebaliknya). | FE `search-screen.tsx:399-405,601-608` | ✅ saran aktif di semua cakupan; chip tetap hanya di "Semua" |
| S-24 | Trending menolak kata kunci tanpa huruf Latin (`/^[^a-z…]+$/`) → kata kunci Hangul/Jepang (K-pop merch = target produk) tidak pernah tren. | BE `search-trends.service.ts:29` | ✅ `\p{L}` |
| S-25 | Riwayat: "Sepatu" dan "sepatu" disimpan terpisah (LREM exact). | BE `search.service.ts:81` | ✅ dedupe case-insensitive |
| S-26 | Feed: `search` < 2 karakter diabaikan server (feed penuh) tetapi FE tetap menampilkan chip "a" seolah terfilter. | FE `showcase-feed-tab.tsx:338-345` | ✅ kata < 2 huruf dianggap tanpa pencarian |
| S-27 | `getShowcaseFeed` memetakan `sort` respons `foryou` → `"latest"` (hanya mengenal popular/latest). | FE `lib/api/showcase.ts:400` | ✅ |

## D. Filter & sort

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-28 | Chip cakupan **Mutasi** tetap tampil saat mode tanpa dompet (`walletEnabled=false`) → memilihnya selalu kosong; cakupan tersimpan `transactions` juga tidak di-fallback. | FE `search-screen.tsx:107-121,341` | ✅ disembunyikan + fallback ke "Semua" |
| S-29 | Filter `productType` (JASA/FISIK/DIGITAL/LAINNYA) sudah didukung backend feed (BE-API2 item 121) tetapi tidak ada di sheet filter FE maupun `getShowcaseFeed`. | FE `showcase-filter-sheet.tsx`, `lib/api/showcase.ts:347`, `lib/showcase-filters.ts` | ✅ chip "Jenis produk" + param + identitas kursor |
| S-30 | Label opsi filter (Semua kondisi/Baru/Bekas/4+ ke atas) & `describeSheetFilters` tidak lewat i18n (konstanta modul). | FE `showcase-filter-sheet.tsx:52-62`, `lib/showcase-filters.ts:78-88` | ✅ |
| S-31 | "Lihat semua pesanan/mutasi" muncul saat `counts >= 20` walau total server tepat 20 (semua sudah tampil). | FE `search-screen.tsx:717-719` | ✅ bandingkan total server vs baris tampil |
| S-32 | `web`: efek sinkron URL memanggil `setParams(next)` tanpa menghapus param lama → mengosongkan kata kunci meninggalkan `?q=` basi di URL. | FE `search-screen.tsx:680-692` | ✅ param kosong di-set `undefined` |
| S-33 | Hapus semua riwayat tidak mereset `historyExpanded` → toggle "Lihat semua" basi saat riwayat terisi lagi. | FE `search-screen.tsx:447-463` | ✅ |

## E. Pagination

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-34 | `GET /v1/search` tanpa pagination (hanya `limit` ≤ 50 + `totals`) — by design; FE memakai CTA "Lihat semua" per jenis. Cakupan **Pesan** (`GET /v1/chat/search`) tidak punya cursor dan tidak ada CTA lanjutan → maksimum 20 hasil tanpa jalan lanjut. | BE `chat.service.ts:2462` | ⏭ butuh kontrak cursor baru di chat search; dicatat di `docs/` |
| S-35 | Cakupan Postingan dibatasi 12 tanpa load-more (by design: CTA ke Etalase). | FE `search-screen.tsx:371-375` | ℹ by design |
| S-36 | Feed "Mengikuti" masih filter sisi klien (plafon 3 halaman) — sudah dicatat A-17; butuh `?following=true`. | FE `showcase-feed-tab.tsx:595-640` | ⏭ di luar cakupan sesi ini |

## F. Error handling & UX

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-37 | Cakupan "Semua": bila `/v1/search` gagal tetapi postingan sukses, error **disembunyikan** (ErrorState hanya untuk daftar kosong) → pengguna tidak tahu pesanan/mutasi tidak ikut dicari. | FE `search-screen.tsx:392-398,920-935` | ✅ catatan inline "Sebagian hasil gagal dimuat" + coba lagi |
| S-38 | `Atur ulang pencarian`, `Lihat semua di Etalase`, `Identitas belum tersedia` di-hardcode (bukan `translate`). | FE `search-screen.tsx:194,275,963,1022` | ✅ |
| S-39 | Tab Temukan: 7 string hardcode (empty state, toast gagal ikuti, label a11y chip). | FE `discover-users-tab.tsx:117-121,141,166-181` | ✅ |
| S-40 | `SearchField`/`SearchTrigger` placeholder & hint default hardcode ("Cari transaksi, pihak, atau ID", "Ketuk untuk mencari"). | FE `search-field.tsx:48,100,106` | ✅ |
| S-41 | `parseSearchShowcaseItem` membuang `coverImageUrl`/`priceMin`/`priceMax`/`likeCount`/`saveCount` yang kini dikirim backend (item 105) → kartu dari `/v1/search?types=showcase` selalu tanpa gambar/harga. | FE `lib/api/search.ts:61-91` | ✅ |
| S-42 | Chip "Sedang tren" tanpa `accessibilityLabel`/hint (riwayat punya). | FE `search-screen.tsx:1218-1222` | ✅ |
| S-43 | `clearSearchHistory` backend menelan semua error dan selalu `{cleared:true}` → FE menampilkan riwayat terhapus padahal Redis gagal. | BE `search.service.ts:113-118` | ✅ `cleared:false` saat gagal → FE tetap tampilkan riwayat + pesan |
| S-44 | `GET /v1/search/history/clear` (GET yang memutasi) masih hidup sebagai alias. | BE `search.controller.ts:120` | ⏭ dipertahankan untuk klien lama (DC-017); hapus setelah APK lama habis |

## G. Keamanan / privasi (terkait search)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-45 | `POST /v1/commerce/trends/record` publik + 120 req/menit/IP → siapa pun bisa mendorong kata kunci apa pun ke "Sedang tren" (tak ada moderasi). | BE `search-trends.controller.ts:15` | ✅ throttle 30/menit; `getTrending` hanya kata ≥ 2 pencari berbeda tidak mungkin tanpa skema → minimal `searchCount ≥ 2` agar typo sekali tidak tren. ⏭ UI moderasi admin |
| S-46 | Suggestions pengguna memakai `fullName` → nama lengkap orang tampil sebagai chip saran untuk siapa pun yang mengetik 2 huruf (profil publik saja — sudah difilter `profileVisible`). | BE `search.service.ts:159` | ℹ dapat diterima (profil publik) |

## H. Kode & kontrak

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-47 | Komentar `globalSearch` mengklaim "showcase TIDAK diminta"; `SCOPE_TYPES` benar, tetapi `limit: 20` default di adapter menimpa default backend (5) — konsisten; tidak ada bug. | FE `lib/api/search.ts:120` | ℹ |
| S-48 | `DebouncedSearchField` tidak meneruskan sinyal "submit" terpisah → layar tidak bisa membedakan Enter dari debounce (dibutuhkan S-03). | FE `debounced-search-field.tsx` | ✅ `onSubmitEditing` diteruskan apa adanya (sudah lewat `...rest`), dipakai layar |
| S-49 | `searchListEmpty` memo deps memuat objek hook (`result`, `usersResult`, …) yang identitasnya berubah tiap render → memo tidak efektif. | FE `search-screen.tsx:985-997` | ⏭ kosmetik; perlu refactor hook |
| S-50 | Backend `searchOrders` fallback ORM hanya mencocokkan `title` sementara jalur FTS title+description. | BE `search.service.ts:366-369` | ✅ paritas |
| S-51 | `search()` menyimpan riwayat untuk `types=help-center` saja pun; dan untuk klien lama tetap per ketikan. | BE `search.service.ts:49` | ✅ dedupe prefiks (S-03) menutup efeknya |
| S-52 | `getTrending` memparse `limit` dengan `parseInt` tanpa clamp negatif di controller (service meng-clamp) — aman. | BE `search-trends.controller.ts:28` | ℹ |
| S-53 | Frontend `recordSearchTrend` memakai `auth:"none"` sehingga user login pun anonim → throttle per IP saja. | FE `lib/api/commerce.ts:333` | ✅ `auth:"optional"` |
| S-54 | Tes BE `search.service.spec` memock `getClient()` baru tiap panggilan sehingga LREM/LPUSH prefiks tidak teruji. | BE `tests/search.service.spec.ts:18` | ✅ tes baru untuk dedupe prefiks |

## I. Batch 2 (lanjutan audit, sesi kedua 10 Okt 2026)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| S-55 | Judul header "Temukan pengguna" hardcode (tidak berganti bahasa). | FE `app/discover.tsx:22` | ✅ |
| S-56 | Label "Saran pencarian" dirender walau tidak ada chip, tidak memuat, dan tidak error → label tanpa isi. | FE `search-screen.tsx:943` | ✅ hanya saat memuat/gagal/ada chip |
| S-57 | **Tamu di cakupan "Semua" selalu error.** `/v1/search` auth:"required" → tiap pencarian tamu "Gagal mencari"/"Sebagian hasil gagal dimuat"; chip Pengguna/Pesanan/Mutasi/Pesan ditawarkan padahal semua auth-required. | FE `search-screen.tsx:372-389,115` | ✅ tamu = cakupan Postingan tanpa chip; query auth dimatikan |
| S-58 | `GET /v1/search/history` ditembak tamu tiap mount (401 → refresh sia-sia). | FE `search-screen.tsx:433` | ✅ gated `hasSession` |
| S-59 | Empty state Mutasi: "Coba nominal…" — backend hanya mencocokkan `description`/`txId`, nominal tidak dicari. | FE `lib/search-ui.ts:101`, BE `search.service.ts:searchTransactions` | ✅ copy diperbaiki |
| S-60 | CTA "Lihat semua mutasi" membuang kata kunci — riwayat dompet punya kolom cari tetapi tidak bisa di-seed dari URL. | FE `search-screen.tsx:1142`, `app/wallet-history.tsx:205` | ✅ `ROUTES.walletHistorySearch(q)` + `?q=` |
| S-61 | Cakupan satu jenis tetap `limit 20` padahal backend maks 50 dan daftar tujuan CTA "Lihat semua pesanan" tidak punya kolom cari. | FE `search-screen.tsx:376,387,405` | ✅ 50 untuk cakupan tunggal, 20 untuk "Semua" |
| S-62 | Mengetuk hasil < 2 dtk setelah mengetik (sebelum jeda stabil) → kata kunci tidak pernah masuk riwayat/tren — padahal itu pencarian yang paling berhasil. | FE `search-screen.tsx:483-488` | ✅ catat saat layar kehilangan fokus |
| S-63 | `recordSettledKeyword` deps memuat objek `historyQuery` utuh → identitas berganti tiap data/loading → timer stabil di-reset tanpa alasan. | FE `search-screen.tsx:481` | ✅ hanya `setData` |
| S-64 | `GET /v1/search` masih menulis riwayat per request ter-debounce walau klien sudah mencatat eksplisit (S-02) → tulis ganda + potongan non-prefiks ("sepatu nike" tertinggal saat dihapus jadi "sepatu adidas"). | BE `search.service.ts:53`, FE `lib/api/search.ts` | ✅ param `recordHistory=false` (klien lama tidak berubah) |
| S-65 | `users.service.searchUsers` boost prefiks `LIKE ${q}%` tanpa escape → `_`/`%` di query jadi wildcard (mengacaukan urutan). | BE `users.service.ts:709` | ✅ `escapeLikePattern` |
| S-66 | `recordSearch` upsert Prisma tidak atomik → dua klien mencatat kata kunci baru bersamaan → P2002 → 500. | BE `search-trends.service.ts:50` | ✅ retry sekali pada P2002 + tes |
| S-67 | Fallback ORM help-center tidak mengirim `answer` → cuplikan kosong saat jalur FTS gagal. | BE `search.service.ts:706` | ✅ `answer` dipotong 300 |
| S-68 | `searchOrders` FTS `ORDER BY rank, createdAt` tanpa tiebreak id. | BE `search.service.ts:434` | ✅ |
| S-69 | Tab Temukan: chip "Rating 4+" tampil untuk tamu yang daftarnya terkunci login — kontrol tanpa objek. | FE `discover-users-tab.tsx:150` | ✅ |
| S-70 | `location` dikirim ke `/v1/search` dan masuk kunci query padahal jenis `showcase` tidak pernah diminta dari layar ini → ganti lokasi memicu refetch pesanan/mutasi sia-sia. | FE `search-screen.tsx:373-376` | ✅ dihapus dari query & kunci |
| S-71 | ErrorState `onRetry` = closure baru atas 4 objek hook (duplikat `retryAll`), deps memo `searchListEmpty` ikut membengkak (lanjutan S-49). | FE `search-screen.tsx:1033-1038` | ✅ pakai `retryAll` |
| S-72 | Baris pengguna tanpa `username` tetap menampilkan chevron padahal tidak bisa dibuka. | FE `search-screen.tsx:221` | ✅ chevron hanya bila bisa dibuka |
| S-73 | `<Chip onRemove>` label a11y "Hapus filter" hardcode. | FE `components/ui/chip.tsx:101` | ✅ i18n |
| S-74 | Feed Etalase: 5 chip filter dibangun sebagai JSX tiap render lalu dimasukkan ke deps memo `listHeader` → memo tidak pernah hit, header dirender ulang tiap tick scroll. | FE `showcase-feed-tab.tsx:1206-1299` | ✅ satu `useMemo` deps primitif |
| S-75 | Hint a11y tombol funnel "Buka filter kondisi, rating, dan harga" basi — filter jenis produk ada sejak S-29. | FE `components/ui/showcase-header.tsx:142` | ✅ |

## Rekomendasi lanjutan (tidak dikerjakan)

1. Cursor untuk `GET /v1/chat/search` (S-34) + CTA "Lihat semua pesan".
2. `GET /v1/showcase/feed?following=true` (S-36).
3. UI admin untuk menyembunyikan kata kunci tren (S-45).
4. Hapus alias `GET /v1/search/history/clear` setelah semua klien pindah (S-44).
