# Audit Etalase (Showcase) — 2026-10-10

Audit menyeluruh fitur Etalase sebelum go public: feed, detail, buat/ubah/hapus,
draf, suka, komentar, bagikan, simpan, unggah foto/video, pencarian, filter.
Dikerjakan dalam enam jalur paralel (feed · detail · buat/ubah/unggah · sosial ·
API+pencarian · konsistensi visual), lalu setiap temuan kritis dan sedang
dibaca ulang langsung di kode sebelum masuk laporan ini. Nomor baris mengacu
pada commit `b8ed7ad` (sebelum fix apa pun dari audit ini).

Lensa yang dipakai: penyerang (input aneh, tap ganda, request paralel, token
kedaluwarsa, item dihapus saat dibuka), pengguna awam (loading tanpa kepastian,
tombol mati, error tanpa arahan), QA jaringan buruk (2G, putus di tengah unggah,
retry, duplikat), reviewer kode (race, kebocoran, state basi, listener).

Audit sebelumnya (`SHOWCASE_AUDIT.md`, `SHOWCASE_AUDIT_2026-10-09.md`) diverifikasi
ulang. Klaim yang **tidak bertahan**: "tab feed / kartu produk tidak ada bug"
(→ FD-01…FD-08), SH-01 (dua lokasi belum terbungkus, → CR-U8), SH-02 (fix tidak
lengkap, → CR-04), "404/410 restore idempoten" & "purge lokal" (tidak ada di
kode, → CR-06), komentar `secure-storage.ts:108-110` "dihapus `clearSession()`"
(tidak benar, → CR-05).

**Baseline sebelum fix:** `tsc` lulus; semua 334 tes unit etalase hijau; tes
komponen punya 4 kegagalan pra-existing di sekitar etalase (ikon header,
shell tab bar, probe r2) yang bukan inti fitur. `check:tokens`/`check:a11y`/
`check:i18n` sudah merah di `main` untuk alasan di luar etalase — gerbang per
commit audit ini: tidak menambah kegagalan baru.

---

## Ringkasan

| | Kritis | Sedang | Kosmetik |
|---|---|---|---|
| **Bug** | 3 | 38 | 17 |
| **UI/UX** | — | 24 | 33 |

Pola yang berulang (bukan kasus tunggal):
1. **Sheet komentar di feed tertinggal dari layar detail** (hapus tanpa
   konfirmasi & tanpa ledger, lapor buntu, tanpa ubah).
2. **Antrean toggle suka/simpan berupa boolean** → paritas tap hilang, tap
   kedua tanpa umpan balik, tersangkut lintas kartu/detail.
3. **State dari `useApiQuery` tidak diteruskan** (`offlineMiss`,
   `refreshError`) → layar kosong/diam saat offline atau refresh gagal.
4. **`tone="inverse"` di atas scrim hitam** → ikon hitam di atas hitam pada
   dark mode (10 lokasi), padahal jebakan ini sudah dicatat di kode.
5. **Kelas Tailwind yang tidak ada di theme** (`rounded-xl`, `bg-primary/10`)
   → styling diam-diam tidak diterapkan.

---

## A. BUG — KRITIS

### FD-01 — Slot player video bocor → semua video di app mati sampai restart
- `components/ui/feed-video.tsx:58-83` (cap 2 slot; `waitForVideoPlayerSlot` mendorong resolver tanpa cara dibatalkan; `releaseVideoPlayerSlot` men-shift waiter lalu `activeVideoPlayers += 1`), `:481-493` (`ExpoVideoPlayer`: `cancelled=true` hanya mencegah `setState`, resolver tetap di antrean).
- **Reproduksi:** (WiFi) kartu video A autoplay di feed → buka detail video B (kartu feed tetap ter-mount, slot #1 tertahan karena `autoplayActive` tidak terikat fokus layar, `showcase-feed-tab.tsx:331`) → detail memakai slot #2 → ketuk video di detail → viewer minta slot #3 → `hasSlot=false` → poster beku tanpa tombol → tutup viewer; resolver basi tertinggal → saat kartu feed di-unmount, `release` memberi slot ke resolver basi (`activeVideoPlayers += 1`, `next()` no-op) → slot hilang permanen. Dua kejadian → `activeVideoPlayers` macet di 2 dengan nol player nyata.
- **Dampak:** video adalah konten utama feed; gagal diam-diam, tanpa pesan.
- **Fix:** antrean dengan `cancel()` yang mencabut resolver saat unmount; `autoplayActive` dikalikan `useIsFocused()`; saat slot penuh tampilkan poster ber-tombol putar, bukan poster inert.

### CR-01 — "Ubah detail" menimpa tipe produk, harga coret, tenggat jasa, dan jadwal publish dengan nilai kosong
- `components/screens/showcase-management-screen.tsx:414-425` (prefill commerce dari `getCommerceFieldsCache`; bila tidak ada → `EMPTY_COMMERCE_FORM`: `productType:"LAINNYA"`, sisanya `null`), `:537-545` (`updateProductCommerce` dipanggil **tanpa syarat** setiap simpan), `lib/commerce-fields.ts:33` (cache = `Map` in-memory per proses), `lib/api/commerce.ts:30-40` (DTO: `null` = hapus).
- **Reproduksi:** buat produk JASA + tenggat 7 hari + harga coret + jadwal publish → tutup app → Kelola Etalase → Ubah detail → ganti judul saja → Simpan. PATCH mengirim `productType:"LAINNYA", originalPriceIdr:null, serviceDeadlineDays:null, scheduledAt:null`. Bahkan "Simpan" tanpa mengubah apa pun sudah merusak (tombol tidak digate dirty).
- **Dampak:** kehilangan data penjual tanpa disadari; menu "Kelola slot jasa" ikut hilang.
- **Fix:** PATCH commerce hanya bila form commerce berubah dari nilai awal; bila prefill berasal dari cache kosong, kirim hanya field yang disentuh pengguna. Fix tuntas butuh backend mengekspos field commerce di GET (→ BE-1).

### CR-05 — Draf etalase & daftar "Baru dihapus" akun sebelumnya bocor ke akun berikutnya
- `lib/secure-storage.ts:399-434` `clearSession()` tidak menghapus `SecureKeys.deletedShowcaseItems` (`:111`) dan `SecureKeys.showcaseDraft` (`:113`); tidak ada pemanggil lain yang menghapusnya. `lib/showcase-draft.ts:23`, `lib/showcase-deleted.ts` memakai kunci tunggal tanpa scope user.
- **Reproduksi:** akun A mengetik draf / menghapus etalase → logout → akun B login di HP yang sama → "Lanjutkan draf?" berisi teks A; "Baru dihapus" menampilkan judul+sampul item A (Pulihkan → 404/403).
- **Dampak:** privasi antar akun di perangkat bersama (umum di Indonesia).
- **Fix:** hapus kedua kunci di `clearSession()`.

---

## B. BUG — SEDANG

### Feed
- **FD-02 — Tombol "Putar" di tab Etalase profil & kartu terkait tidak melakukan apa-apa.** `components/ui/showcase-media-gallery.tsx:231` `userPlay={autoplayActive && …}`; `profile-etalase-tab.tsx:131` & `showcase-related-card.tsx:63` mengirim `autoplayActive={false}` → niat putar eksplisit selalu `false`, tombol overlay (`:369-379`) tetap bisa diketuk. Repro: profil penjual → tab Etalase → kartu video → ketuk putar berulang: tidak pernah mulai. Fix: `userPlay` tidak dikalikan `autoplayActive`.
- **FD-03 — Tombol "Coba lagi" video gagal & poster gerbang tidak bisa diketuk di feed.** `showcase-media-gallery.tsx:361` membungkus `<FeedVideo>` dengan `pointerEvents:"none"`; `feed-video.tsx:378-418` (retry) dan `:423-433` (poster gerbang) ada di dalamnya → ketukan jatuh ke slide dan membuka viewer. Fix: `box-none` + tombol internal menelan ketukan, atau angkat retry ke overlay galeri.
- **FD-04 — Infinite scroll digerbang `onMomentumScrollBegin`: tidak pernah jalan di web, macet di native saat drag pelan sampai ujung.** `components/ui/paginated-list.tsx:197-205, 278-280`. RN-web tidak mengemisi event momentum; di native `onEndReached` saat masih drag dibuang dan VirtualizedList tidak menembak lagi untuk `contentLength` yang sama. Fix: arm juga pada `onScrollBeginDrag`.
- **FD-05 — Akun login tanpa `username` dianggap tamu di tab "Mengikuti".** `showcase-feed-tab.tsx:694-699` `if (!username) { markGuest() }` → empty state "Masuk untuk melihat feed mengikuti" + tombol Masuk untuk pengguna yang sudah masuk (registrasi via HP, username nullable — `lib/api/showcase.ts:1019-1021`). Fix: pakai `me.id` sebagai pemilik cache; `markGuest` hanya pada 401/403.
- **FD-06 — Tab Etalase profil menyembunyikan seluruh daftar saat refresh diam gagal.** `profile-etalase-tab.tsx:260-274` cabang `error` menang atas `items`, padahal `lib/use-profile-showcase.ts:58-61` sengaja mempertahankan `items`. Fix: banner compact bila daftar ada, ErrorState penuh hanya bila kosong.
- **FD-07 — Setiap kartu berlangganan `useGlobalSearchParams`/`usePathname` → semua kartu render ulang pada navigasi apa pun.** `lib/use-showcase-social-actions.ts:39-50` (`useLoginNextPath`), deps merembet ke `requireLogin` → `toggleLike` (prop `memo(ShowcaseFeedItem)`). Repro: 100 kartu → `setParams`/push → semua kartu render ulang; `ShowcaseMediaGallery` bukan `memo`. Fix: baca pathname/params lewat ref saat dibutuhkan; `memo` galeri.
- **FD-08 — Sentuhan awal scroll di judul kartu menembak `GET /v1/showcase/:id` yang menaikkan viewCount.** `pressable-scale.tsx:231` `unstable_pressDelay={0}` + `showcase-feed-item.tsx:558` `onPressIn` → `lib/showcase-detail-prefetch.ts:11` `getShowcaseDetail` (endpoint menghitung tayang). Fix: `pressDelay` ±130 ms untuk pressable ringkasan/penulis.
- **FD-11 — Ketuk-ganda tamu dari viewer: `router.push(loginRequired)` terjadi di bawah Modal yang masih terbuka.** `showcase-media-gallery.tsx:118-130`, `image-viewer.tsx:206`, `use-showcase-social-actions.ts:275-279`. Fix: tutup viewer dulu bila `!hasSession`.

### Detail
- **DT-01 — Deep link saat offline tanpa cache → layar kosong tanpa pesan.** `showcase-detail-screen.tsx:215-230` cabang `!item` tidak meneruskan `offlineMiss` (DataScreen mendukungnya, `data-screen.tsx:75,227`). Melanggar aturan "offline → 'Tidak ada koneksi internet'".
- **DT-02 — Pull-to-refresh gagal (offline/item dihapus/5xx) → tanpa umpan balik; item terhapus tetap "bisa dibeli".** `:1016-1022` `refreshError` tidak diteruskan; CTA hanya cek objek lama (`:1055`).
- **DT-03 — State "tidak ditemukan" hanya untuk 404; 403/410/id rusak jatuh ke error generik + "Coba lagi" yang mustahil berhasil.** `:171-172`; `lib/api/client.ts:146-164` (`seg()` melempar tanpa status); `errors.ts:477-487` (410 → UNKNOWN → "Terjadi kesalahan. Coba lagi.").
- **DT-04 — Ganti urutan komentar saat mutasi berjalan → refetch dibuang diam-diam, kursor di-reset → urutan campur.** `:443-449` `if (mutationPending.current) return`, `:1248-1253`.
- **DT-06 — Tap ganda "Beli via Kahade"/"Chat penjual" → dua layar tertumpuk.** `:874-882` `router.push` tanpa guard; tidak ada helper navigasi sekali-jalan di repo.
- **DT-07 — Seksi jadwal jasa: 1–2 request + skeleton untuk SEMUA produk, lalu lenyap (layout shift).** `product-commerce-section.tsx:201-227, 291-300`; tanpa guard `alive`.
- **DT-08 — Aset digital LINK: penjual boleh simpan `http://`, pembeli hanya bisa buka `https://`.** `digital-asset-section.tsx:249` vs `:127` → auto-delivery mati untuk tautan http.

### Buat / Ubah / Unggah
- **CR-02 — `OfflineError` dianggap "status simpan belum pasti" → seluruh form terkunci.** `showcase-create-screen.tsx:957-963` (`rejected` hanya `ApiError` dengan status tertentu; `OfflineError` bukan `ApiError`, `errors.ts:237`); request tidak pernah terkirim (`client.ts:484-501`) tapi semua input `disabled`.
- **CR-03 — Saat `uncertainCreate`, "Tambah foto/video" tetap aktif → DTO berubah di bawah Idempotency-Key yang sama.** `:1152, :1162, :467, :653` (hapus/urut/sampul sudah digate `:805,823,839`), `:906-913`.
- **CR-04 — `draftSuppressed` tidak pernah di-reset → autosave mati setelah "Buang draf".** `:316, :422, :942, :1446` (tidak ada `= false`).
- **CR-06 — Entri lokal "Baru dihapus" tidak pernah dipurge; "Pulihkan" pada entri basi gagal selamanya.** `lib/showcase-deleted.ts:116-160` (merge hanya menambah), `showcase-management-screen.tsx:659-677` (404/410 → toast gagal berulang).
- **CR-07 — Edit detail mengirim `media[]` replace penuh dari snapshot saat sheet dibuka.** `:530-533` → foto yang ditambah di perangkat lain terhapus saat menyimpan judul; setiap simpan memaksa validasi ulang fileKey.
- **CR-08 — `visibility` yang absen/asing ditulis balik sebagai PRIVATE.** `:213` fail-closed untuk tampilan, `:193` selalu dikirim; `lib/api/users.ts:841-845` GET tanpa schema.
- **CR-09 — Probe ukuran video memuat seluruh berkas ke memori.** `:684-695` `pickedImageToBlob` hanya untuk cek `size` (video 90 MB → ±2× di memori); `expo-file-system` `File.info()` sudah dipakai di `image-picker.ts:136-138`.
- **CR-10 — Pesan error mutasi: socket reset saat online → "Tidak ada koneksi internet"; timeout → "Server terlalu lama merespons".** `errors.ts:495-496, 624-631`; `client.ts:237-243`. CLAUDE.md: timeout → "Koneksi lambat, coba lagi". Berlaku lintas app, bukan hanya etalase.

### Sosial
- **SO-01 — Antrean toggle suka/simpan berupa boolean → paritas tap hilang, tap kedua tanpa umpan balik.** `lib/use-showcase-social-actions.ts:189-196, 256-286, 365-368`. Tiga tap (suka→batal→suka) saat request berjalan berakhir TIDAK suka.
- **SO-02 — Antrean tersangkut lintas instance (kartu feed + detail item sama) → toggle liar belakangan.** Keputusan antre berdasarkan kunci global `showcaseMutationPending` tetapi flag disimpan di ref per instance; `finally` instance lain tidak melihatnya.
- **SO-03 — Sheet komentar feed: hapus tanpa konfirmasi, tidak optimistis, tanpa ledger −1 → hitungan kartu drift.** `showcase-comments-sheet.tsx:286-312, 706-710` (detail punya Dialog `showcase-detail-screen.tsx:1446`).
- **SO-04 — Komentar soft-delete (`isDeleted`) dirender sebagai baris kosong dengan aksi aktif.** `showcase-comment-row.tsx:312-314` hanya `isHidden`; `isDeleted` tidak pernah dibaca di `components/`; parser menerima `content:null` (`showcase.ts:1140-1143`).
- **SO-05 — Balasan gagal kirim → konteks `replyTo` hilang; retry terkirim sebagai komentar utama dengan Idempotency-Key yang sama.** `showcase-detail-screen.tsx:649-652` (reset sebelum request), `:684-704` (catch tidak memulihkan), kunci = item × isi tanpa `parentId` (`:655-658`, sheet `:375-377`).
- **SO-06 — Pesan gagal vote komentar selalu "Periksa koneksi lalu coba lagi." apa pun penyebabnya (429/403/404).** `showcase-comment-row.tsx:181-187` mengabaikan `err`; `userMessage` sudah punya copy 429.
- **SO-07 — Seal verifikasi penulis komentar tidak pernah tampil: parser membuang `badges`/`sealTier`/`isKycVerified`.** `showcase.ts:1190-1195` vs `showcase-comment-row.tsx:256-261`.
- **SO-08 — Konten buatan pengguna (komentar, judul, deskripsi) ikut diterjemahkan oleh `<Text>` pada locale EN.** `components/ui/text.tsx:186` `localizeChildren` untuk semua children string; `lib/i18n/translate.ts:86-120` juga mencocokkan bentuk angka → komentar "Batal" tampil "Cancel", "Harga 500" bisa ditulis ulang. Tidak ada prop opt-out.

### API / Pencarian
- **AP-01 — Pencarian saat offline menampilkan "Tidak ada hasil", bukan "Tidak ada koneksi internet".** `search-screen.tsx:920-984` tidak membaca `offlineMiss` (grep = 0); `LiveRegion` ikut mengumumkan copy yang salah.
- **AP-02 — `globalSearch`: satu baris `null` di `users`/`orders`/`transactions` meruntuhkan seluruh hasil dengan "Terjadi kesalahan. Coba lagi."** `lib/api/search.ts:138-170` (cabang `showcase`/`helpCenter` sudah null-safe, tiga lainnya tidak).
- **AP-03 — Respons mutasi komentar dipercaya mentah lalu dirender → crash bila `author` hilang.** `showcase.ts:489-540` (add/update/hide/unhide tanpa `parseShowcaseComment`); `showcase-comment-row.tsx:153-154` `comment.author.fullName` tanpa guard.
- **AP-04 — `check:retry` GAGAL karena `retry: 1` pada POST/DELETE `/v1/showcase/saved/:id`.** `showcase.ts:805, :813` (bagian dari `npm run check:api`).
- **AP-05 — Kata kunci pencarian PRIVAT (Pesan/Pesanan/Mutasi) dikirim ke endpoint tren publik.** `search-screen.tsx:426-434` `recordSearchTrend(q)` untuk semua cakupan → `POST /v1/commerce/trends/record` (`auth:"none"`).

### Visual (bug nyata, bukan selera)
- **VI-01 — `tone="inverse"` di atas `bg-overlay-media` = HITAM di atas HITAM pada dark mode.** `inverse` = `primaryForeground` = `#000000` di dark (`lib/tokens.ts:289`); scrim selalu `rgba(0,0,0,0.7)` (`:292`). Jebakan ini sudah didokumentasikan di `showcase-gallery-grid.tsx:216-218` tetapi dilanggar di: `showcase-feed-item.tsx:480` (badge "Stok habis"), `feed-video.tsx:292, 619` (tombol putar), `showcase-media-gallery.tsx:378, 391` (putar/mute), `showcase-create-screen.tsx:1090, 1099, 1113, 1125` (putar/"Sampul"/bintang/hapus).
- **VI-02 — `rounded-xl` tidak ada di theme → baris "Promo saya" tanpa radius.** `showcase-management-screen.tsx:156`; `tailwind.config.js:63` sengaja meniadakannya.
- **VI-03 — `bg-primary/10` tidak dikompilasi → chip tanggal jasa aktif tanpa fill.** `product-commerce-section.tsx:353-356` (warna `var()` tanpa `<alpha-value>`; pola yang sama ada di 9 file chat/drawer di luar scope — dicatat).
- **VI-04 — Sorotan deep-link komentar & reply-chip `bg-surface-elevated` tak terlihat di light mode.** `showcase-detail-comments.tsx:74`, `showcase-detail-screen.tsx:945`; light `surfaceElevated` = `background` = `#FFFFFF` (`tokens.ts:182,189`).
- **VI-05 — `className="flex-1"` pada `<Button>` tidak membagi lebar → dua tombol footer filter 100% lebar.** `showcase-filter-sheet.tsx:110, 115` (`className` jatuh ke kotak dalam; container tetap `w-full`, `button.tsx:123`); pola benar `containerClassName="flex-1"`.
- **VI-06 — `<Button>` fullWidth sebagai aksi baris aset digital.** `digital-asset-section.tsx:183` (default `w-full`, md 48px) di baris `flex-row` bersama saudara `IconButton sm`.
- **VI-07 — Dua ikon Putar tampil bersamaan di satu slide video.** `showcase-media-gallery.tsx:361-365` + `feed-video.tsx:423-434` (poster gerbang Play 60px inert) + kontrol galeri `:369-380` (Play 44px).
- **VI-08 — Badge "Stok habis" dan badge durasi video menumpuk di `left-2 top-2`.** `showcase-feed-item.tsx:479`, `showcase-media-gallery.tsx:397`.
- **VI-09 — Filter sheet berisi input harga tanpa `avoidKeyboard`.** `showcase-filter-sheet.tsx:104-108` (sheet lain berisi input semua memakainya).
- **VI-10 — Pressable bersarang di baris penulis detail (button-in-button, VoiceOver menyembunyikan anak).** `showcase-author-row.tsx:86-126` membungkus `SellerRatingLine` (`:64-75`) yang juga pressable, 18pt.
- **VI-11 — Target sentuh < 44pt:** chip kategori kartu feed ±18pt (`showcase-feed-item.tsx:524-537`); kategori detail = Badge 22pt (`showcase-detail-screen.tsx:1130-1138`); toggle waktu komentar 34pt & tautan profil 24pt (`showcase-comment-row.tsx:277-299, 232-245`); tombol sampul/hapus thumbnail create 32pt (`showcase-create-screen.tsx:1105-1127`); chip tanggal jasa 30pt (`product-commerce-section.tsx:348-361`).
- **VI-12 — `className` di RN `Animated.View` diabaikan di web → kartu orientasi tanpa bg/radius.** `feed-orientation-overlay.tsx:81-88` (aturan repo sendiri di `toast.tsx:354-356`).

---

## C. BUG — KOSMETIK

- **FD-09** Cap waktu relatif kartu di-memo tanpa bahasa & tanpa jam (`showcase-feed-item.tsx:248`) → tetap bahasa lama setelah ganti bahasa; "5 menit lalu" membeku.
- **FD-10** Ambang viewability 60% dari tinggi item (`showcase-feed-tab.tsx:560`) → kartu sangat tinggi (rasio <~0,45) tak pernah "terlihat": tidak autoplay, bukan anchor posisi.
- **FD-12** Notice "Mengikuti" terpotong menyarankan tarik-segarkan padahal refresh mengulang halaman 1 (`showcase-feed-tab.tsx:837-839, 1185-1191`).
- **FD-13** Suka saat offline: `likePending` + kunci item ditahan sampai tersambung (promise antrean baru resolve saat drain, `offline-queue.ts:182-184`); label antrean "Suka etalase" tidak di-`translate` (`showcase.ts:606`, `app/_layout.tsx:912`); `offlineBehavior:"enqueue-social"` pada simpan tidak ada di allowlist (`offline-queue.ts:59-64`) — opsi mati (= AP-09).
- **FD-14** `SellerRatingLine` menampilkan rating penulis lama bila `username` berganti dan fetch baru gagal (`showcase-author-row.tsx:44-56`).
- **DT-05 / SO-11** Stale closure `comments` di `handleConfirmAction` (`showcase-detail-screen.tsx:759-760`, deps `:795`) → `removed` memakai jumlah balasan lama.
- **DT-09** `<ImageViewer images={resolvedMedia.map(...)}>` array baru tiap render (`:1279-1284`) → effect prefetch & FlatList data berubah saat viewer terbuka.
- **DT-10** `ProductStatsSection.load` membuat `AbortController` yang tidak pernah di-abort (`product-stats-section.tsx:102-104`).
- **CR-11** Retry transien `POST /v1/upload/direct` tanpa Idempotency-Key (`upload.ts:364, 418-428`; `showcase-upload.ts:91-96`) → berkas yatim bila respons hilang (butuh konfirmasi BE, → BE-3).
- **CR-12** Hardware back saat unggahan pertama (form masih kosong) tidak dicegat (`showcase-create-screen.tsx:398-401, 431`) — tombol X justru menoast "Tunggu unggahan selesai…".
- **SO-09** Tarik-segarkan tab "Tersimpan" hanya menyegarkan profil, bukan karya (`saved-collection.tsx:174`).
- **SO-10** Edit komentar tidak memperbarui `updatedAt` → penanda "(diedit)" baru muncul setelah refetch (`showcase-detail-screen.tsx:728`).
- **AP-06** `deleteSearchHistoryItem` memakai `encodeURIComponent` mentah (`search.ts:332-337`) → kata kunci `..` tak bisa dihapus satuan.
- **AP-07** Sinkron URL web tidak menghapus param lama (`search-screen.tsx:680-692`, `setParams` merge).
- **AP-08** `getSavedShowcases` menerima `nextCursor: ""` sebagai "masih ada halaman" (`showcase.ts:792-795`) → potensi duplikat.
- **VI-13** Glyph Phosphor mentah tanpa `<Icon>` (`showcase-gallery-grid.tsx:195`, aturan CLAUDE.md §4).
- **VI-14** `elevation: 8` manual di drag-sort (`showcase-media-drag-sort.tsx:329`; aturan tokens §6.2 `elevationStyle()`).
- **VI-15** `border-2` di luar skala token (`showcase-create-screen.tsx:1131`, `showcase-management-screen.tsx:1382`); `px-0` no-op (`showcase-feed-item.tsx:518`); literal `8` & `backgroundColor` inline pada FAB (`showcase-feed-tab.tsx:1356-1361`).

---

## D. UI/UX — SEDANG

- **UX-01** Stok habis / tidak aktif di detail hanya tombol pudar + `accessibilityHint`, tanpa label terlihat (`showcase-detail-screen.tsx:1052-1066`); kartu feed punya badge (`showcase-feed-item.tsx:478-483`).
- **UX-02** Loading detail: skeleton generik (`app/showcase/[id].tsx:19-27`) → logo berdenyut `LoadingScreen` → konten; dua visual loading berurutan, tidak sebentuk detail.
- **UX-03** Video tanpa indikator buffering (`feed-video.tsx:503-626`); di 2G poster hilang → kotak kosong sampai frame pertama.
- **UX-04** Judul error feed selalu "Terjadi kesalahan" termasuk saat offline/timeout (`paginated-list.tsx:211-213, 224` tidak mengirim `title`; default `error-state.tsx:50`). CLAUDE.md menyebut ini BUG.
- **UX-05** Skeleton feed & placeholder gambar hampir putih di light mode (`skeleton.tsx:97-108` sendiri mencatat kontras 1,10:1 dan menyediakan `tone="contrast"`; `showcase-feed-skeleton.tsx:33-61` & `picture.tsx:277-281` tidak memakainya).
- **UX-06** Ketuk-ganda suka tanpa umpan balik yang terlihat: di feed hati meledak di kartu yang tertutup viewer (ketuk 1 langsung membuka viewer, `showcase-media-gallery.tsx:118-130`); di viewer ketuk kedua = zoom (`zoomable-image.tsx:144-148`); di detail tanpa semburan hati sama sekali (`showcase-detail-screen.tsx:1088-1090`).
- **UX-07** "Ikuti" tersembunyi di menu ⋯; tidak ada tombol follow inline di baris penulis (`showcase-author-row.tsx:78-128`).
- **UX-08** Kartu booking slot memakai "Buat transaksi" (`product-commerce-section.tsx:335`) — aturan tombol: dari produk → "Beli via Kahade"; plus dua jalur beli paralel di produk jasa (tombol "Pesan" vs footer CTA tanpa slot).
- **UX-09** Sheet komentar: tinggi list dihitung dari window (0.55×), sheet 0.9× window — tidak dari area tersisa setelah keyboard (`showcase-comments-sheet.tsx:525`, `bottom-sheet.tsx:357,434`); di ponsel kecil header/handle berisiko terdorong keluar layar (argumen aritmetika, perlu cek device).
- **UX-10** "Laporkan komentar" di sheet feed hanya navigasi ke detail (`showcase-comments-sheet.tsx:714-726`), bukan form lapor seperti di detail (`showcase-detail-screen.tsx:858-867`).
- **UX-11** Hapus / Nonaktifkan / Pulihkan etalase tidak optimistis & tanpa rollback (`showcase-management-screen.tsx:595-677`) — di 2G dialog spinner 5–20 detik; hapus tanpa Undo di toast (`:644`).
- **UX-12** Sheet "Kelola foto" terjebak bila commit urutan gagal (`:892-916`, tanpa "Buang urutan"); tutup saat sibuk diam total (`:893`).
- **UX-13** Aset digital tipe FILE menuntut pengguna mengetik `fileKey` manual, tanpa tombol unggah (`digital-asset-section.tsx:343-368`) — butuh BE (→ BE-5).
- **UX-14** Copy teknis/jargon ke pengguna: "Respons server tidak lengkap." (`product-commerce-section.tsx:265`), "fileKey upload"/"Hasil upload file" (`digital-asset-section.tsx:349, 358`), "Field commerce gagal disimpan" (`showcase-create-screen.tsx:932`, `showcase-management-screen.tsx:550`), "Media tidak ikut tersimpan (server menolak fileKey lama)" (`:574`), "Status lampiran belum dapat dipastikan. Segarkan…" di dalam sheet (`:773, :845`), placeholder editor berisi tag HTML (`showcase-html-description-editor.tsx:200`).
- **UX-15** Copy error menebak penyebab tanpa cek: "Periksa koneksi lalu coba lagi." untuk semua error termasuk 5xx/403 (`showcase-likers-sheet.tsx:215`, `product-stats-section.tsx:166`, `showcase-comment-row.tsx:184`).
- **UX-16** Teks "Memuat…" alih-alih shimmer (`service-slot-manager.tsx:163-164`).
- **UX-17** Chip filter aktif di feed dirakit manual 4× (`showcase-feed-tab.tsx:1198, 1215, 1232, 1248`, pil ±52px lebar penuh) alih-alih `<Chip onRemove>` (32px).
- **UX-18** Empat gaya "tautan teks" berbeda; satu memakai biru (`showcase-html-description-editor.tsx:221` `tone="info"`) padahal `text-link.tsx` menetapkan monokrom + underline.
- **UX-19** Footer editor 3 tombol bertumpuk fullWidth (`showcase-management-screen.tsx:1481-1494`) vs footer create 1 baris; dua tombol primary bersamaan di create (`showcase-create-screen.tsx:1211-1213` + `:1004-1012`).
- **UX-20** Overlay orientasi = 12 blok teks dalam satu modal (`feed-orientation-overlay.tsx:105-171`); form buat: dua penjelasan untuk satu sakelar + kotak info berlapis (`showcase-create-screen.tsx:1356-1360` dan `:1370-1385`).
- **UX-21** Teks di atas foto tanpa scrim ("Mode hemat data" `showcase-media-gallery.tsx:350-357`, "Video gagal dimuat" `feed-video.tsx:381-416`).
- **UX-22** Tidak ada state "akhir feed" (`paginated-list.tsx:233-247`; `load-more.tsx` punya status `"end"` yang tidak dipakai).
- **UX-23** Chip filter "4+ ke atas"/"4,5+ ke atas" dan `describeSheetFilters` (string gabungan) tidak pernah terterjemah di EN (`showcase-filter-sheet.tsx:55-59`, `lib/showcase-filters.ts:81-92`).
- **UX-24** Setiap perubahan kata kunci pencarian mengganti hasil lama dengan skeleton (`use-api-query.ts:389-394` `setRaw(null)` saat key berganti; `usePaginatedQuery` punya `keepPreviousOnKeyChange`, `useApiQuery` tidak).

## E. UI/UX — KOSMETIK

Spasi/radius/tipografi: padding Card di-override p-3/p-4/p-5 (`product-stats-section.tsx:72`, `digital-asset-section.tsx:67/157`, `service-slot-manager.tsx:171`, `showcase-moderation-notice.tsx:44`); baris penulis feed vs detail beda irama (`showcase-feed-item.tsx:381` vs `showcase-author-row.tsx:85`); ikon kolom kanan kartu feed tidak segaris (selisih 14px, `:572-582`); header komentar `pt-8` satu-satunya 32px (`showcase-detail-comments.tsx:123`); media feed `rounded-sm` vs skeleton `rounded-md` (`showcase-media-gallery.tsx:208` vs `showcase-feed-skeleton.tsx:43`); `rounded-lg` + `className` radius menimpa prop `Picture` (`showcase-management-screen.tsx:1191, 1197`); reply-chip `rounded` vs `rounded-md` (`showcase-comments-sheet.tsx:145` vs detail `:945`); ring fokus `rounded-full` membungkus Badge `rounded-xs` (`showcase-detail-screen.tsx:1135`); `tone="tertiary"` pada varian kecil diam-diam jadi `secondary` (7 lokasi); teks error body vs caption campur (`showcase-create-screen.tsx:1170, 1190, 1224`; `showcase-management-screen.tsx:1411`); `toLocaleTimeString()` langsung (`product-stats-section.tsx:128`); opacity busy 0.6 di luar token (`like-button.tsx:230`, `save-button.tsx:146`).

Ikon/tombol: tiga ukuran tombol "Putar" (60/44/36px); "+" header glass circle vs ghost square (`showcase-management-screen.tsx:264-270`); haptic tidak merata di baris aksi (bagikan & komentar detail tanpa `haptic`; `showcase-feed-item.tsx:577-585`, `showcase-detail-actions.tsx:70-104`); `Pressable` mentah tanpa umpan balik (`showcase-html-description-editor.tsx:216-224`); "Muat lagi" menukar label alih-alih `loading` (`showcase-saved-collection.tsx:294-296`); `<Button>` dipakai sebagai baris list (`:229-268`); "Chat penjual" dua wujud di satu layar (`showcase-detail-screen.tsx:1115-1123` vs `:1042-1049`); "Hapus etalase" ghost fullWidth di tengah konten + duplikat di menu (`:1230-1232`, `:1531-1540`); tombol kirim laporan `destructive` (`showcase-report-sheet.tsx:135`); "Tampilkan lainnya" full-bleed vs "Lihat sebagai galeri" ber-gutter (`profile-etalase-tab.tsx:317-326`); "Batal" balasan 42pt dengan `hitSlop={12}` literal (`showcase-detail-screen.tsx:949-959`); "Kosongkan pilihan" 26pt (`showcase-condition-input.tsx:50-60`); pil "Coba lagi" video 42pt (`feed-video.tsx:404`).

State & copy: empty state komentar tiga rupa; placeholder "Tidak ada gambar" tanpa ikon (`showcase-media-gallery.tsx:211`); empat presentasi error inline & lima varian "Coba lagi"; skeleton tidak sebentuk (avatar 24 vs 32, `showcase-comments-sheet.tsx:622`; skeleton media `aspect-square` vs kartu ber-rasio); blurhash tidak dipakai (`picture.tsx:102` mendukung `placeholder`; DTO tanpa blurhash, → BE-7); konter "N karakter tersisa" selalu tampil (`showcase-detail-screen.tsx:977-980`, `showcase-comments-sheet.tsx:183-185`); share sheet berisi kalimat instruksi + URL mentah (`showcase-share-sheet.tsx:115-117, 139-143`); `fullName === ""` → pesan berakhir " — " (`:62`); ikon `ChatCircle` untuk "Etalase tidak ditemukan" (`showcase-detail-screen.tsx:197`); teks instruksi tersebar di manajemen (`:1172-1174, :1480, :1244-1248`); sheet feed tanpa aksi "Ubah" komentar; perilaku ketuk media berbeda feed (viewer) vs profil/terkait (detail); `ShowcaseShareSheet` + pohon hook BottomSheet di-mount per kartu feed (`showcase-feed-tab.tsx:342`); rasio per-slide campur dalam satu pager (`showcase-media-gallery.tsx:247, 253, 338`); Simpan di viewer memakai ikon statis bukan `<SaveAction>` (`showcase-detail-screen.tsx:1302-1312`); string literal di luar `translate()` yang tetap terlokalisasi via `<Text>` (sheet komentar 10 lokasi, `showcase-management-screen.tsx:1537, 1572, 238-239`, `digital-asset-section.tsx:211-215`) dan yang TIDAK: alt `${label} (disembunyikan)` (`:1049`), `accessibilityLabel` pada `<View>` (`skeleton.tsx:180`, `pull-to-refresh.tsx:334, 725`); `check:a11y` menandai `feed-video.tsx:263` (`<View accessibilityLabel>` tanpa `accessible`).

---

## F. BUTUH PERUBAHAN BACKEND

Dicatat ke `docs/rekomendasi-backend-etalase.md` (bukan workaround diam-diam):
1. **BE-1** Ekspos field commerce (`productType`, `originalPrice`, `serviceDeadlineDays`, `digitalDeliveryInfo`, `scheduledAt`) di `GET /v1/users/me/showcase` — prasyarat fix tuntas CR-01.
2. **BE-2** `GET /me/showcase` selalu menyertakan `visibility` dan `condition` (CR-08).
3. **BE-3** Konfirmasi `POST /v1/upload/direct` menghormati `Idempotency-Key` untuk purpose non-chat, atau GC berkas yatim (CR-11).
4. **BE-4** Semantik `POST /me/showcase/:id/restore` untuk item sudah dipulihkan/kedaluwarsa (404/410/409) agar klien idempoten (CR-06).
5. **BE-5** Purpose upload + signed download untuk aset digital FILE (UX-13).
6. **BE-6** Semantik `POST /me/showcase` saat Idempotency-Key diulang dengan payload berbeda (CR-03).
7. **BE-7** `blurhash`/`thumbhash` per media di DTO untuk loading progresif.
8. **BE-8** `DELETE /v1/showcase/comments/:id` mengembalikan `commentCount` final atau `removedCount` (SO-04); konfirmasi serializer komentar mengirim `badges`/`sealTier`/`isKycVerified` (SO-07); `Retry-After` pada 429 vote komentar (SO-06); konfirmasi Idempotency-Key komentar menolak body berbeda (SO-05).
9. **BE-9** "Tidak tertarik" hanya sesi-lokal (`lib/showcase-social-prefs.ts:235-238`) — butuh endpoint agar jadi sinyal `sort=foryou`.
10. **BE-10** Drift skema (memperluas RK-02): `ShowcaseItemDto` tanpa `saveCount, isSaved, condition, badges, isCommerce, shareCount, related, descriptionHtml, orderLink, images[].kind/thumbnailUrl/durationSec/width/height, author.badges/sealTier/isFollowing`; `ShowcaseCommentDto` tanpa `isDeleted, likes, dislikes, userVote, replyCount`; komentar tanpa param `cursor`/`sort`; feed `sort` tanpa `foryou`; `POST /comments/{}/like` body `{value}` tidak dideklarasikan; keluarga `/v1/search` (DELETE history, param `location`, enum `types`, bentuk `results`) dan `/v1/commerce/trends*` tidak ada di spec; kode `SHOWCASE_*` belum terdaftar di `lib/api/error-codes.ts`.
11. **RK-01 (masih terbuka)** 409 `SHOWCASE_ALREADY_LIKED` tanpa state akhir → refetch detail menaikkan viewCount.

---

## G. YANG DIPERIKSA DAN BERSIH (ringkas)

Injeksi HTML/skrip (judul/deskripsi/komentar plaintext; `descriptionHtml` lewat sanitasi allowlist + `href` https saja; tidak ada WebView/`dangerouslySetInnerHTML`); id URL rusak ditolak `seg()`; owner vs non-owner digerbangi UI + server otoritatif (`/v1/users/me/*`); token kedaluwarsa di tengah aksi (fence `getSessionRevision()` di semua jalur async; store sosial/draf/vote direset per sesi); Idempotency-Key komentar & laporan, dipakai ulang saat retry, mutasi tidak pernah auto-retry; paginasi feed keyset dengan dedupe & fence `AbortController`; balapan ketikan pencarian (abort + debounce); param query di-trim/di-whitelist/di-clamp; parser feed fail-closed per item; cache & ETag terikat revisi sesi; guard media sebelum unggah (resize → 5 MB, video 100 MB/180 s, MIME dari ekstensi); transport unggah terpusat (NetInfo, timeout adaptif, 401 refresh, retry transien, abort per berkas) — tidak ada jalur unggah baru; harga via `parseRupiahTyping`; drag-sort commit sekali; FlatList `keyExtractor`/`memo`/visibilitas per-id; player native hanya saat diputar, pause saat tidak terlihat, `VideoErrorBoundary`; galeri jendela ±1 slide + prefetch terbatas; animasi suka/simpan + haptic + reduced-motion; "Tidak tertarik" dengan Urungkan; gate tamu konsisten; kata terlarang ("escrow/rekber/ditahan/rekening bersama") nihil di teks pengguna seluruh etalase.

---

## H. RENCANA FIX (berurutan, satu commit per kelompok, tiap commit lolos `tsc` + tes)

1. **Kritis — video:** FD-01 (antrean slot dengan `cancel`, dipisah ke modul teruji), FD-02, FD-03, VI-07; `autoplayActive` terikat fokus layar.
2. **Kritis — edit commerce:** CR-01 (PATCH hanya bila berubah; delta bila cache kosong) + helper murni teruji.
3. **Kritis — privasi & sampah lokal:** CR-05, CR-06 (purge + restore 404/410 idempoten).
4. **Detail:** DT-01, DT-02, DT-03, DT-04, DT-05, DT-06 (helper navigasi sekali-jalan), DT-07, DT-08, DT-09, DT-10, UX-01, UX-08 (label tombol), UX-14 (copy teknis).
5. **Sosial:** SO-01, SO-02 (state tujuan per item, global), SO-03, SO-04, SO-05, SO-06, SO-07, SO-09, SO-10, UX-10, UX-15.
6. **API & pencarian:** AP-01 … AP-08 (AP-09/FD-13 opsi mati: dihapus dari adapter simpan agar kode jujur), UX-23.
7. **Buat/Ubah/Unggah:** CR-02, CR-03, CR-04, CR-07, CR-08, CR-09, CR-10 (copy timeout/network sesuai CLAUDE.md, lintas app), CR-12, UX-11 (optimistis + undo), UX-12, UX-16, UX-19, UX-20 (kotak info ganda).
8. **Feed:** FD-04, FD-05, FD-06, FD-07, FD-08, FD-09, FD-11, FD-12, FD-14, UX-04, UX-05, UX-06 (semburan hati di viewer & detail), UX-22.
9. **Visual:** VI-01 (tone `onMedia` baru), VI-02 … VI-06, VI-08 … VI-12, VI-13 … VI-15, UX-17, UX-18, UX-21, plus kosmetik yang murah.

**Sengaja tidak diubah (alasan):**
- UX-07 tombol Ikuti inline, UX-02 skeleton berbentuk detail + hero dari feed, UX-09 tinggi sheet komentar: perubahan desain/arsitektur yang butuh keputusan produk atau verifikasi device; dicatat di sini, tidak dieksekusi diam-diam.
- UX-13, UX-24 (blurhash), BE-*: bergantung backend.
- Personalisasi "Untuk Anda"/"Populer" dan filter "Mengikuti" sisi klien: keputusan produk terdokumentasi (audit 2026-10-09), tidak ada bug klien baru.
