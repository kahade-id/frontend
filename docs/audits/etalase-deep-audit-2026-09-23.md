# Audit mendalam Etalase Kahade — 70 temuan dan improvement

**Tanggal:** 23 September 2026  
**Baseline:** `5040cff91099a34f9ecdc3cf38e990b5dc4dc416`  
**Branch:** `arena/01a0cd3e-frontend`  
**Jenis dokumen:** snapshot audit sebelum perbaikan. Pernyataan/nomor baris di bawah merujuk baseline, bukan kode terkini.

**Status terbaru:** implementasi remediasi telah mengubah kode produksi. Lihat [ledger E01–E70](etalase-remediation-2026-09-23.md) untuk perubahan, hasil pengujian, serta pekerjaan yang belum tuntas.

## 1. Kesimpulan eksekutif

**Etalase belum layak dianggap selesai hanya karena quality gate hijau.** Masalah utama bukan styling, melainkan lifecycle state, identitas pengguna, transaksi upload bertahap, dan konsistensi paginasi. Audit ini menemukan **70 butir yang dapat ditindaklanjuti**; tidak semuanya bug produksi terkonfirmasi. Bukti dan batasannya ditandai per butir.

Prioritas pertama:

1. **E01:** menghapus satu komentar mengosongkan seluruh komentar yang sedang ditampilkan, bukan hanya target. Ini cacat UI; audit tidak menemukan penghapusan seluruh komentar di server.
2. **E09:** tab Mengikuti untuk tamu mempunyai siklus perubahan state → callback → effect → state yang dapat berulang tanpa stabil.
3. **E02 + E69:** permukaan baca Etalase membuang bearer token, padahal UI bergantung pada identitas viewer; endpoint galeri juga berbeda kebijakan autentikasi dari OpenAPI lokal.
4. **E03:** suka dan bookmark masih disimpan pada singleton global tanpa namespace akun/reset logout.
5. **E38–E40:** fallback upload yang langsung membuat item belum aman untuk multipilih, privasi sebelum publikasi, maupun lampiran ke item yang sudah ada.
6. **E14–E15:** kursor feed belum di-commit secara atomik; kegagalan parsial dan refresh bersamaan dengan load-more dapat melewatkan/mencampur data.
7. **E21, E23–E26:** komentar rentan respons terlambat, submit ganda, retry halaman salah, duplikasi offset, dan overwrite oleh fetch.
8. **E33 + E46:** pengosongan field tidak dikirim eksplisit; reorder dapat mengirim draft berisi ID foto yang sudah dihapus.

### Ringkasan jumlah

| Prioritas | Jumlah |
|---|---:|
| P1 — tinggi | 17 |
| P2 — sedang | 48 |
| P3 — rendah | 5 |
| **Total** | **70** |

| Jenis temuan | Jumlah |
|---|---:|
| B — bug berdasarkan kode | 34 |
| R — risiko integrasi/runtime | 17 |
| I — improvement | 19 |
| **Total** | **70** |

Enam probe merupakan subset temuan, bukan enam temuan tambahan. Tidak ada penjumlahan ganda antara bug dan improvement. Temuan dengan akar/acceptance yang terkait dikelompokkan dalam gelombang remediasi di bagian 9.

### Klasifikasi bukti

- **B — Bug berdasarkan kode:** jalur cacat terlihat pada implementasi. Skenario pemicu dijelaskan; bukan klaim sudah diamati di produksi.
- **R — Risiko integrasi/runtime:** kelemahan kode/kontrak nyata, tetapi dampak akhir membutuhkan backend, browser, atau perangkat tertentu.
- **I — Improvement:** kekurangan UX, ketahanan, observabilitas, atau pengujian. Bukan klaim pelanggaran requirement yang tidak tersedia.
- **Probe:** fungsi asli diekstrak dari AST TypeScript, dijalankan dengan dependensi mock. Ini bukti terisolasi, **bukan** pengujian React/Expo end-to-end.

Prioritas: **P1 tinggi** (kebenaran data, privasi, alur utama); **P2 sedang** (reliabilitas/UX bermakna); **P3 rendah** (polish/kemampuan tambahan). Tidak ada P0 atau klaim eksploitasi backend yang terbukti dalam audit ini.

## 2. Cakupan dan metode

Ditelusuri: tab feed dan header, kartu sosial, komentar sheet/detail, manajemen CRUD/multi-image, profil dan galeri publik, adapter `showcase`/`users`, upload presigned/legacy, picker web, state sosial, session logout, query cache, route transaksi/login, share, metadata HTML, i18n, komponen paginasi, serta test unit/component/e2e.

Metode: membaca source dengan nomor baris, menelusuri caller–callee, membandingkan OpenAPI lokal dengan request aktual, menelusuri perubahan state pada failure/concurrency, menjalankan quality gate yang disebutkan di bawah, dan membuat enam probe reproduksi. Nomor baris merujuk baseline di atas, bukan nomor pada audit lama.

**Batasan:** tidak mengakses API produksi/staging ber-auth, tidak mengunggah/menghapus konten pengguna, tidak menjalankan Playwright atau aplikasi di perangkat fisik. Tidak ada klaim hasil pengukuran FPS, kontras layar nyata, load test, atau verifikasi otorisasi backend. `auth:"none"` terbukti membuang bearer token; HTTP client masih memakai `credentials:"include"`, sehingga kemungkinan autentikasi cookie di web harus diverifikasi terpisah.

### Verifikasi yang benar-benar dijalankan

| Pemeriksaan | Hasil |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | Berhasil memasang dependency dari lockfile |
| `npm run typecheck` | Lulus |
| `npx vitest run tests/showcase-social-logic.test.ts tests/route-protection.test.ts` | 31/31 lulus, subset dari unit suite |
| `npm test` | 375/375 lulus, 29 berkas |
| `npm run test:components` | 121/121 lulus, 12 berkas |
| `node docs/audits/etalase-probes.mjs` | 6/6 skenario cacat terproduksi pada fungsi terisolasi |

Ada warning konfigurasi Vite/esbuild serta warning render pada test mode switcher; test tetap lulus. Audit ini **tidak** menyatakan seluruh `npm run check`/lint/build/e2e sudah dijalankan.

### Hubungan dengan audit sebelumnya

`issues-etalase.md` adalah audit historis 69 temuan, dengan bagian “SEMUA 69 ditangani”. Dokumen itu dipertahankan, tidak ditimpa. Temuan di sini memakai ID **E01–E70** agar tidak tertukar. Beberapa masalah memang sudah diperbaiki (misalnya reset kursor dasar, routing laporan showcase pada caller utama, label harga bersama, akses route publik), tetapi penutupan masalah lifecycle/paginasi/upload belum tuntas. Jumlah 70 ini bukan hasil menyalin 69 temuan lama.

---

## 3. Identitas, suka, dan bookmark

### E01 — Hapus satu komentar menghapus semua komentar lokal
**P1 · B · Probe**  
**Lokasi:** `app/showcase/[id].tsx:277–290,365–374`.

- **Bukti/pemicu:** setelah DELETE target sukses, handler memanggil `patchComment(() => null)`. Callback diterapkan kepada setiap root dan reply. Dengan dua root dan satu balasan, hasilnya array kosong; probe menjalankan handler asli.
- **Dampak:** komentar lain hilang dari layar, sedangkan total hanya berkurang satu. Pengguna mengira konten ikut terhapus; refresh baru memulihkan data server.
- **Perbaikan/acceptance:** cocokkan `c.id === confirmTarget.id`, tentukan kebijakan tombstone/cascade untuk root. Test hapus reply, root tanpa reply, dan root dengan reply; komentar tak terkait harus tetap utuh.

### E02 — Request publik menghilangkan identitas yang dibutuhkan UI
**P1 · R**  
**Lokasi:** `lib/api/showcase.ts:141–199`; `lib/api/client.ts:459,480`; `app/showcase/[id].tsx:248,529–539,711–720`.

- **Bukti/pemicu:** feed/detail/komentar menggunakan `auth:"none"`; client tidak membaca/mengirim bearer. Namun UI memakai `isLiked` dan `isOwner`, termasuk tombol moderasi dan pencegahan transaksi dengan diri sendiri.
- **Dampak:** pada autentikasi bearer, item yang pernah disukai dapat tampak belum disukai; pemilik dapat diperlakukan sebagai pengunjung. Respons backend/cookie aktual belum diuji.
- **Perbaikan/acceptance:** gunakan optional-auth bila backend mendukungnya, atau pisahkan metadata viewer ber-auth. Uji tamu, pemilik, dan pengguna lain; jangan memperbaiki dengan memblokir semua pembacaan publik.

### E03 — State sosial bocor antar akun dalam proses yang sama
**P1 · B**  
**Lokasi:** `lib/showcase-social-prefs.ts:31–47,63–103`; `lib/api/session.ts:173–202`.

- **Bukti/pemicu:** singleton menyimpan `saved[id]` dan `likes[id]`, tanpa user ID, reset, atau subscriber perubahan sesi. Logout membersihkan preferensi lain, bukan store ini.
- **Dampak:** akun B pada runtime yang sama mewarisi bookmark/status suka akun A; toggle berikutnya dapat mengirim operasi berlawanan dari intent B. Ini kebocoran state lokal, bukan bukti akses data server A.
- **Perbaikan/acceptance:** namespace per user dan reset saat logout/login/session revision, termasuk mengabaikan hasil mutasi sesi lama. Test A → logout → B tanpa reload aplikasi.

### E04 — Override suka menimpa data server baru tanpa batas waktu
**P2 · B**  
**Lokasi:** `lib/use-showcase-social-actions.ts:54–60,87–91`; `lib/showcase-social-prefs.ts:87–103`.

- **Bukti/pemicu:** setelah sekali berinteraksi, `override` selalu menang atas `item` baru. Tidak ada invalidasi ketika refresh mengembalikan jumlah terbaru.
- **Dampak:** likeCount membeku pada snapshot terakhir sesi ini walau pengguna lain menambah suka; refresh tampak tidak bekerja.
- **Perbaikan/acceptance:** bedakan optimistic pending state dari canonical server state, reconcile berdasarkan revision/request, lalu hapus override yang sudah terkonfirmasi. Uji refresh count 10 → 15 setelah toggle sukses.

### E05 — Lock suka hanya per instance, bukan per item global
**P2 · R**  
**Lokasi:** `lib/use-showcase-social-actions.ts:57,70–103`; caller di feed/profil/detail.

- **Bukti/pemicu:** dua instance untuk item sama punya `likeBusy` berbeda, tetapi menulis store global yang sama. Navigasi/toggle saat request masih pending memungkinkan request dan rollback silang.
- **Dampak:** respons lama atau rollback bisa menimpa intent terbaru. Frekuensi bergantung navigasi dan latensi.
- **Perbaikan/acceptance:** mutation coordinator per `(userId,itemId)` dengan nomor generasi, atau serialisasi intent. Uji like dari feed, unlike dari detail, lalu selesaikan respons dalam urutan terbalik.

### E06 — `SHOWCASE_ALREADY_LIKED` di-rollback tanpa sinkronisasi
**P2 · B**  
**Lokasi:** `lib/use-showcase-social-actions.ts:90–100`.

- **Bukti/pemicu:** semua error terlebih dahulu mengembalikan state sebelumnya. Untuk already-liked, toast malah disembunyikan; komentar kode mengatakan “sinkronkan”, tetapi tidak ada fetch/reconcile.
- **Dampak:** saat server sudah menyimpan suka dan state awal klien false, UI tetap false dan tap selanjutnya mengulang POST.
- **Perbaikan/acceptance:** baca state canonical atau treat conflict sebagai state liked sambil refetch jumlah. Test respons conflict, bukan hanya sukses dan generic error.

### E07 — Bookmark tidak bertahan setelah reload/restart
**P2 · I**  
**Lokasi:** `lib/showcase-social-prefs.ts:40–42,60–80`; `components/ui/showcase-feed-item.tsx:377–390`.

- **Bukti/pemicu:** “Simpan” hanya mengubah memori. Tutup runtime/hard refresh mengembalikan semua bookmark ke false. Keputusan session-only disebut dalam komentar, tetapi label aksi tidak menjelaskan batasan itu.
- **Dampak:** ekspektasi simpan untuk nanti tidak terpenuhi.
- **Perbaikan/acceptance:** persist per akun atau backend collection; bila sengaja sementara, nyatakan di UX. Uji reload/restart dan pergantian akun secara terpisah.

### E08 — Tidak ada tempat menemukan kembali karya yang disimpan
**P2 · I**  
**Lokasi:** `lib/showcase-social-prefs.ts:63–80`; `app/saved.tsx:1–7,29–33,70–84`.

- **Bukti/pemicu:** store memberi selector per ID, tetapi tidak ada koleksi Etalase tersimpan. Layar `/saved` mengambil profil pengguna, bukan karya.
- **Dampak:** bahkan sebelum restart, pengguna harus menemukan postingan yang sama lagi untuk mengakses bookmark. Ini berbeda dari persistensi E07: kebutuhan discovery/retrieval.
- **Perbaikan/acceptance:** sediakan tab/koleksi tersimpan dengan pagination, unsave, dan penanganan item privat/dihapus. Uji akses dari navigasi, bukan hanya perubahan ikon.

## 4. Feed, pencarian, dan paginasi

### E09 — Tab Mengikuti tamu memiliki feedback loop effect
**P1 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:205–220,249,329,370–377`.

- **Bukti/pemicu:** `markGuest()` selalu `setFollowingSet(new Set())`. `ensureFollowingSet` bergantung pada `followingSet`; `fetchPage` bergantung pada callback tersebut; effect bergantung pada `fetchPage`. Set baru mengubah identitas dependency dan memulai fetch lagi. Cabang tamu mengulangi perubahan yang sama.
- **Dampak:** render/abort/refetch berulang, state refreshing tidak stabil, potensi beban CPU/request. Bukti adalah siklus dependency; frekuensi perangkat belum diukur.
- **Perbaikan/acceptance:** transisi guest harus idempotent, pisahkan cache following dari dependency pemicu fetch, dan short-circuit tanpa feed fetch untuk set kosong. Mount tab Mengikuti sebagai tamu harus settle dengan jumlah request terbatas.

### E10 — Akun yang diikuti dibatasi diam-diam ke 200
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:212,231–235`.

- **Bukti/pemicu:** loop maksimal empat halaman × 50, sekalipun `totalPages` lebih dari empat.
- **Dampak:** karya akun urutan 201+ tidak pernah lolos filter, seolah pengguna tidak mengikuti mereka.
- **Perbaikan/acceptance:** endpoint following-feed/filter server lebih tepat; alternatif pagination seluruh relasi dengan batas dan penjelasan UX yang eksplisit. Fixture 201 akun harus mencakup karya akun terakhir.

### E11 — Follow/unfollow tidak menginvalidasi cache saat kembali fokus
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:229,384–392,517–521`.

- **Bukti/pemicu:** cache dipakai lagi selama username sama. Fokus hanya mengecek dirty version dari mutasi karya, bukan perubahan relasi following. Pull-to-refresh memang membersihkan cache—ini bukan klaim cache tak pernah bisa diperbarui.
- **Dampak:** kembali dari profil setelah follow/unfollow masih melihat subset lama sampai refresh manual.
- **Perbaikan/acceptance:** invalidasi mengikuti query key/event relasi. Test follow dan unfollow lalu kembali ke tab tanpa pull-to-refresh.

### E12 — Pergantian sesi tidak menjadi key lifecycle feed
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:197–203,370–392`.

- **Bukti/pemicu:** sesi disalin ke ref agar callback stabil, tetapi effect tidak bergantung pada identitas/revision sesi. Setelah login/logout, tidak ada refresh deterministik pada tab yang tetap mounted.
- **Dampak:** state guest/akun lama dapat bertahan; owner cache hanya diperiksa jika fetch berikutnya benar-benar terjadi. Terpisah dari singleton E03: ini state fetch komponen.
- **Perbaikan/acceptance:** abort, reset cache, dan reload berdasarkan session revision. Test perubahan akun saat feed masih mounted, setelah E09 diperbaiki.

### E13 — Following sparse masih bisa menampilkan empty-state palsu
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:338–350,447–461`; `components/ui/paginated-list.tsx:196–205`.

- **Bukti/pemicu:** tiga halaman dapat menghasilkan nol item dan `hasMore=true`; empty-state tetap menyatakan belum ada karya. Footer manual load-more disembunyikan ketika `data.length===0`.
- **Dampak:** tidak ada jalur eksplisit “lanjut mencari”. `onEndReached` mungkin menolong pada sebagian layout, tetapi tidak menjamin UX/retry jika hasil kosong atau gagal.
- **Perbaikan/acceptance:** state “belum ditemukan di halaman yang diperiksa” + lanjut/retry saat kosong, atau filter server. Uji karya pertama baru ada di halaman keempat dan request lanjutan gagal.

### E14 — Kegagalan parsial following menggeser kursor tanpa commit data
**P1 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:337–359`.

- **Bukti/pemicu:** tiap halaman langsung menulis `slot.cursors`, sedangkan `collected` baru dimasukkan ke items setelah seluruh loop selesai. Jika halaman kedua gagal, item halaman pertama dibuang tetapi kursor sudah maju.
- **Dampak:** retry load-more melewatkan karya yang sebenarnya berhasil diunduh. Menambah retry jaringan saja tidak menyelesaikan invariant.
- **Perbaikan/acceptance:** snapshot kursor lokal lalu commit items+kursor bersamaan, atau commit per halaman. Fault injection sukses halaman A, gagal B, retry harus tetap menampilkan semua A tepat sekali.

### E15 — Load-more dapat berjalan selama refresh/filter baru
**P1 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:254–259,282–285,353–366,394–396`; `components/ui/paginated-list.tsx:168–170`.

- **Bukti/pemicu:** guard hanya `loadingMore/loadMoreBusy`, bukan `refreshing`. Shared list juga tidak memeriksa refreshing. Load-more mengganti `activeRequest` tanpa membatalkan refresh; hasil hanya memeriksa signal, bukan identitas request aktif.
- **Dampak:** dua fetch mengubah slot sama; hasil append bisa ditimpa refresh atau data dari filter lama ikut masuk.
- **Perbaikan/acceptance:** satu state machine per query key, larang more selama reset dan gunakan generation check sebelum seluruh commit. Uji kedua urutan penyelesaian respons.

### E16 — Item filter sebelumnya tetap tampil sebagai hasil filter baru
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:260–268,354,374–377`.

- **Bukti/pemicu:** setelah pernah memuat, pergantian tab/search/kategori memakai mode refresh dan tidak mengosongkan/memisahkan items. Label tab/kategori sudah baru, konten masih lama sampai request selesai.
- **Dampak:** hasil lama tampak cocok dengan pencarian baru; jika fetch gagal, konten tidak relevan tetap ada di bawah label baru.
- **Perbaikan/acceptance:** simpan data per query key atau tampilkan loading/stale marker yang eksplisit. Pertahankan stale content hanya untuk refresh query yang sama. Uji pergantian kategori pada jaringan lambat/error.

### E17 — Satu sumber gagal membuat seluruh “Untuk Anda” gagal
**P2 · I**  
**Lokasi:** `components/showcase-feed-tab.tsx:305–325`.

- **Bukti/pemicu:** latest dan popular digabung dengan `Promise.all`; kegagalan salah satu membuang hasil sumber lain yang sukses.
- **Dampak:** availability feed gabungan lebih rendah daripada masing-masing endpoint; request sukses terbuang.
- **Perbaikan/acceptance:** pertimbangkan partial success dengan cursor/status per sumber dan retry terpisah. Test popular 500 sementara latest 200 tetap dapat menyediakan konten dengan penanda degradasi, jika sesuai keputusan produk.

### E18 — Batas input pencarian/kategori tidak mengikuti kontrak feed
**P2 · R**  
**Lokasi:** `components/ui/showcase-header.tsx:207–218`; `components/showcase-feed-tab.tsx:270–290`; OpenAPI `GET /v1/showcase/feed`.

- **Bukti/pemicu:** search tidak mempunyai `maxLength`, category dari route diteruskan tanpa batas. Spec menetapkan search 100 dan category 60 karakter.
- **Dampak:** paste panjang/deep link invalid memicu error request alih-alih validasi lokal. Penolakan aktual tergantung validator backend.
- **Perbaikan/acceptance:** validasi sebelum query dengan constraints bersama dan pesan yang jelas. Uji 100/101, 60/61, whitespace, Unicode, serta query dari URL.

### E19 — Filter feed tidak dapat dipulihkan/dibagikan secara lengkap
**P3 · I**  
**Lokasi:** `components/showcase-feed-tab.tsx:153–155`; `lib/routes.ts:346–350`.

- **Bukti/pemicu:** kind dan search hanya local state; route hanya mendukung category pada helper yang tersedia.
- **Dampak:** reload/remount atau membagikan URL tidak mempertahankan pencarian dan urutan yang sedang dilihat.
- **Perbaikan/acceptance:** sinkronkan parameter yang memang shareable ke route, validasi enum, dan pertimbangkan restore posisi scroll. Test URL hasil pencarian membuka himpunan/urutan yang sama.

### E20 — Error load-more lama tidak dibersihkan oleh refresh sukses
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:262–268,354–355`; `components/ui/paginated-list.tsx:168–170,199–203`.

- **Bukti/pemicu:** `setLoadMoreError(null)` hanya pada mode more. Gagal more → pull refresh sukses masih menyisakan error footer.
- **Dampak:** pesan gagal sudah basi; auto-load tetap diblokir oleh `loadMoreError` walau halaman pertama berhasil diperbarui.
- **Perbaikan/acceptance:** reset error pagination saat reset query dan commit refresh sukses. Uji gagal halaman 2 → refresh → scroll harus melanjutkan tanpa klik retry basi.

## 5. Komentar, laporan, dan lifecycle detail

### E21 — Respons komentar item A masuk ke sheet item B
**P1 · B · Probe**  
**Lokasi:** `components/ui/showcase-comments-sheet.tsx:89–92,111–130`.

- **Bukti/pemicu:** kirim komentar A, tutup sheet/buka B sebelum POST selesai. Effect mereset state saat ID berubah, tetapi promise lama tetap menambahkan `saved` ke `localComments` komponen yang sama dan mengosongkan draft.
- **Dampak:** komentar A muncul pada B; draft B dapat hilang. Probe menjalankan handler asli dengan respons tertunda.
- **Perbaikan/acceptance:** generation/item/session guard sebelum update UI; mutasi server yang sudah terkirim tetap boleh selesai. Uji close/reopen, A→B, dan logout selama POST.

### E22 — Mengetik saat komentar dikirim dapat menghapus draft berikutnya
**P2 · B**  
**Lokasi:** `components/ui/showcase-comments-sheet.tsx:117–119,171–180`; `app/showcase/[id].tsx:327–333,474–484`.

- **Bukti/pemicu:** input tetap editable saat sending. Handler menangkap draft awal, pengguna menulis teks baru, lalu respons sukses memanggil `setDraft("")` tanpa memeriksa nilai saat ini.
- **Dampak:** teks yang belum pernah dikirim hilang bahkan tanpa pindah item; berbeda dari kontaminasi antar-item E21.
- **Perbaikan/acceptance:** bekukan draft yang dikirim dan hanya clear bila draft masih sama, atau nonaktifkan composer sementara. Test ketik pesan kedua sebelum pesan pertama selesai.

### E23 — Enter dapat mengirim komentar detail berkali-kali
**P1 · B · Probe**  
**Lokasi:** `app/showcase/[id].tsx:322–343,482,490–493`; `lib/api/client.ts:437–440`.

- **Bukti/pemicu:** `handleSendComment` tidak memeriksa `sendingComment`; loading tombol tidak menutup jalur `onSubmitEditing`. Dua pemanggilan menghasilkan dua POST dalam probe. Idempotency client dibuat per pemanggilan, bukan per draft/intent.
- **Dampak:** komentar dobel dan hitungan dobel, terutama Enter berulang pada jaringan lambat.
- **Perbaikan/acceptance:** synchronous ref guard/coordinator + idempotency intent bila diperlukan; guard juga jalur keyboard. Tekan Enter dua kali sebelum respons harus menghasilkan satu mutasi.

### E24 — Retry gagal memuat komentar halaman pertama malah meminta halaman kedua
**P1 · B**  
**Lokasi:** `app/showcase/[id].tsx:190,223–239,777–782`.

- **Bukti/pemicu:** `commentsPage` berawal 1; request halaman 1 gagal dan status menjadi error. `LoadMore` selalu diberi callback `fetchComments(commentsPage + 1, true)` termasuk retry.
- **Dampak:** pengguna melewatkan 20 komentar awal dan halaman kedua dianggap kelanjutan dari daftar kosong.
- **Perbaikan/acceptance:** simpan target request yang gagal dan mode append, atau bedakan initial-error dari next-page-error. Test 500 pada page 1 lalu retry harus tetap meminta page 1.

### E25 — Pagination offset komentar tidak melakukan dedupe
**P2 · B**  
**Lokasi:** `app/showcase/[id].tsx:229–231,302–319`.

- **Bukti/pemicu:** append memakai `[...prev,...res.data]`, sedangkan komentar baru disisipkan lokal di depan. Insert/delete di server dapat menggeser batas offset sehingga root yang sama muncul di dua halaman.
- **Dampak:** komentar berulang, React key collision, hitungan/render tak konsisten.
- **Perbaikan/acceptance:** dedupe berdasarkan ID sambil menjaga urutan; idealnya cursor/snapshot server untuk diskusi aktif. Uji ID tumpang-tindih antara page 1 dan page 2 serta local insert sebelum load-more.

### E26 — Fetch komentar lama dapat menimpa hasil mutasi terbaru
**P2 · R**  
**Lokasi:** `app/showcase/[id].tsx:223–235,277–319,345–402`.

- **Bukti/pemicu:** AbortController mengoordinasikan fetch dengan fetch, bukan fetch dengan add/edit/delete/hide. GET yang dimulai sebelum mutasi dapat selesai sesudah patch lokal.
- **Dampak:** komentar yang baru diedit kembali ke teks lama, komentar baru hilang, atau moderasi tampak dibatalkan. Bergantung snapshot/latensi server.
- **Perbaikan/acceptance:** cancel/invalidate fetch saat mutasi, generation-aware merge atau refetch canonical sesudah sukses. Test GET tertunda → edit sukses → GET lama resolve.

### E27 — Hitungan komentar tidak sinkron antar permukaan
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:406–411`; `components/ui/profile-etalase-tab.tsx:149–175`; `app/showcase/[id].tsx:319,373`.

- **Bukti/pemicu:** sheet menambah hitungan hanya pada caller lokal; detail punya state sendiri. Mutasi komentar tidak memanggil dirty feed atau invalidasi query bersama.
- **Dampak:** tambah/hapus di detail lalu kembali ke feed/profil menampilkan angka lama sampai refresh manual.
- **Perbaikan/acceptance:** centralized entity cache atau event invalidasi seluruh consumer item. Uji create/reply/delete dari detail lalu kembali ke feed dan profil tanpa hard reload.

### E28 — Error refresh detail disembunyikan ketika data lama tersedia
**P2 · B**  
**Lokasi:** `app/showcase/[id].tsx:140–157,414–419,441–451`; `lib/use-api-query.ts:221–223`.

- **Bukti/pemicu:** jika `item` sudah ada, `DataScreen` selalu menerima `error:null`. Hook tetap menyimpan error refresh, tetapi refresh mengembalikan normal setelah menangkap error.
- **Dampak:** refresh 403/404/500 pada karya yang sebelumnya terbuka tampak berhasil; konten yang kini dihapus/privat dapat tetap ditampilkan sebagai snapshot lama.
- **Perbaikan/acceptance:** tampilkan stale/error banner; 404/403 perlu kebijakan menghapus data lama. Uji fetch awal sukses, lalu akses dicabut dan refresh gagal.

### E29 — Identitas moderator/penulis komentar tidak diperbarui saat sesi berubah
**P2 · B**  
**Lokasi:** `app/showcase/[id].tsx:181,211–213,424–425,805–865`.

- **Bukti/pemicu:** `getMeCached` hanya dipanggil pada mount (`[]`), sementara layar detail bersifat publik dan dapat tetap mounted saat login/logout. `meId` tetap milik sesi sebelumnya atau null.
- **Dampak:** menu edit/hapus milik sendiri salah; otorisasi server masih harus menjadi pengaman. Ini bukan bukti privilege escalation server.
- **Perbaikan/acceptance:** turunkan identity dari session-reactive query dan reset saat sesi berganti. Uji guest→login dan A→B pada detail yang sama.

### E30 — Laporan karya tidak digerbang untuk tamu
**P2 · B**  
**Lokasi:** `components/showcase-feed-tab.tsx:402–404`; `components/ui/profile-etalase-tab.tsx:183–185`; `components/ui/showcase-report-sheet.tsx:47–65`; `lib/api/showcase.ts:292–299`.

- **Bukti/pemicu:** sheet menerima tamu, mengizinkan mengisi alasan, lalu memanggil endpoint `auth:"required"`. Tidak ada `useHasSession`/redirect pada sheet atau handler caller utama.
- **Dampak:** pengguna menulis laporan hanya untuk menemui error autentikasi, berbeda dari like/comment yang memiliki ajakan login.
- **Perbaikan/acceptance:** gate terpusat sebelum membuka/submit, simpan intent dan return path. Uji tamu menekan Laporkan tidak mengirim request mutation ber-auth.

### E31 — Respons laporan lama bisa menutup form laporan yang baru
**P2 · R**  
**Lokasi:** `components/ui/showcase-report-sheet.tsx:42–45,47–76`.

- **Bukti/pemicu:** sheet tetap dapat ditutup saat submitting, dan handler lama selalu menjalankan `onRequestClose()` setelah sukses. Jika pengguna sudah membuka item B, hasil laporan A menutup B.
- **Dampak:** draft laporan B hilang dan toast sukses terlihat dalam konteks yang salah.
- **Perbaikan/acceptance:** guard generation/item atau cegah dismissal saat submit dengan UX yang jelas; reset busy per lifecycle. Test respons laporan A tertunda selama B dibuka.

### E32 — “Laporkan komentar” kehilangan identitas komentar/karya
**P2 · I**  
**Lokasi:** `app/showcase/[id].tsx:427–430,841–849`; `lib/routes.ts:367–369`.

- **Bukti/pemicu:** aksi dari komentar mengarah ke laporan pengguna dengan `targetId: author.userId`, tanpa commentId, showcaseId, kutipan, atau konteks thread.
- **Dampak:** moderator sulit mengetahui konten yang dilaporkan; label menyiratkan laporan konten padahal objek laporan adalah akun.
- **Perbaikan/acceptance:** endpoint laporan komentar jika tersedia, atau copy “Laporkan pengguna” dan attach konteks yang sesuai kontrak. Acceptance memverifikasi target dan konteks, bukan hanya HTTP sukses.

## 6. CRUD, upload, privasi, dan urutan foto

### E33 — Mengosongkan field opsional tidak dikirim sebagai aksi clear
**P1 · R · Probe**  
**Lokasi:** `app/showcase-management.tsx:115–123,326–338`.

- **Bukti/pemicu:** kosongnya description/category/harga menjadi `undefined`; JSON menghilangkan field. Probe mengonfirmasi hasil hanya `{visibility:"PUBLIC"}` untuk semua field opsional yang dikosongkan.
- **Dampak:** pada update parsial yang mempertahankan field omitted, data lama tidak terhapus walau toast “Detail diperbarui”. Semantik final PUT/backend perlu verifikasi; DTO update tidak menetapkan clear semantics.
- **Perbaikan/acceptance:** sepakati representasi clear (`null`, string kosong, atau operasi eksplisit) dan pisahkan serializer create/update. Test round-trip isi→kosong→refetch untuk tiap field.

### E34 — Harga nol tidak dapat dibedakan dari harga tidak diisi
**P2 · I**  
**Lokasi:** `app/showcase-management.tsx:96–103,119–120`; `lib/showcase-labels.ts:40–52`; OpenAPI `CreateShowcaseItemDto.priceMin/priceMax`.

- **Bukti/pemicu:** form memakai 0 untuk kosong dan serializer membuang 0; label harga menganggap `>0` saja valid. Kontrak mengizinkan minimum 0.
- **Dampak:** produk gratis/harga eksplisit nol tidak bisa direpresentasikan bila bisnis membutuhkannya.
- **Perbaikan/acceptance:** keputusan produk eksplisit; gunakan nullable form state dan label Gratis/Rp0 jika diperbolehkan. Uji null, 0, min-only, max-only, dan rentang normal.

### E35 — Error membuka picker berada di luar penanganan error
**P2 · B**  
**Lokasi:** `app/showcase-management.tsx:195–204,405–417`.

- **Bukti/pemicu:** `await pickImages(...)` dieksekusi sebelum `try`. Permission API/picker native yang reject tidak masuk toast catch; handler dipanggil dengan `void`.
- **Dampak:** unhandled rejection atau aksi tampak tidak melakukan apa pun. Guard `attaching` juga belum terkunci selama picker terbuka.
- **Perbaikan/acceptance:** masukkan seluruh fase picker ke try/finally dengan synchronous busy guard. Mock picker reject dan pastikan error ditangani serta pengguna dapat mencoba ulang.

### E36 — Batas delapan foto tidak ditegakkan setelah picker, khususnya web
**P1 · B**  
**Lokasi:** `lib/image-picker.ts:125–136`; `app/showcase-management.tsx:196,212,408–420`; dependency Expo Image Picker web `src/ExponentImagePicker.web.ts:20–33`.

- **Bukti/pemicu:** wrapper hanya meneruskan `selectionLimit` dan mengembalikan semua assets. Implementasi web versi terpasang tidak mengambil `selectionLimit`; pengguna dapat memilih lebih dari delapan atau melebihi slot tersisa.
- **Dampak:** seluruh file terlanjur diunggah lalu create/attach berpotensi ditolak; biaya, waktu, dan orphan bertambah.
- **Perbaikan/acceptance:** validasi jumlah assets sesudah picker pada semua platform sebelum upload. Pilih 9 file untuk create dan 3 saat tersisa 1 slot; upload tidak boleh melebihi kontrak.

### E37 — Navigasi keluar tidak membersihkan lifecycle upload/draft
**P2 · R**  
**Lokasi:** `app/showcase-management.tsx:172,195–291,305–312`; `lib/showcase-upload.ts:48–80`.

- **Bukti/pemicu:** `pendingKeys` ditulis/dikosongkan tetapi tidak memiliki cleanup unmount; upload tidak menerima AbortSignal. Keluar dari screen berbeda dari `closeEditor()`.
- **Dampak:** upload bisa selesai setelah pengguna keluar; key yang belum dipakai tidak dijadwalkan cleanup oleh frontend. GC backend mungkin mengurangi dampak, belum diverifikasi.
- **Perbaikan/acceptance:** upload session yang dapat dibatalkan, pending-key ledger dan cleanup best-effort yang aman terhadap commit. Uji back saat upload dan back saat form create terbuka.

### E38 — Multipilih legacy hanya mengurus item otomatis yang terakhir
**P1 · B · Probe**  
**Lokasi:** `app/showcase-management.tsx:210–237,241–263`.

- **Bukti/pemicu:** setiap respons `kind:"item"` menimpa satu variabel `autoItem`. Sesudah loop, hanya item terakhir di-hide dan dibuka di editor. Probe dua respons item menghasilkan update hanya untuk item kedua.
- **Dampak:** item sebelumnya tersisa tanpa proses pelengkapan/privasi yang dijanjikan; satu aksi multipilih dapat membuat beberapa postingan tak diharapkan.
- **Perbaikan/acceptance:** jangan gunakan endpoint auto-create untuk batch attachment, atau track dan reconcile semua item. Test semua-legacy serta campuran fileKey/item dan partial failures.

### E39 — Privasi legacy bersifat publish-then-hide dan kegagalannya disembunyikan
**P1 · R**  
**Lokasi:** `app/showcase-management.tsx:226–258`; `lib/showcase-upload.ts:66–71`.

- **Bukti/pemicu:** setelah upload mengembalikan item, barulah request kedua mengirim `isActive:false`; error hide ditelan. Jika endpoint legacy default aktif/publik, ada jendela paparan dan kegagalan hide mempertahankan publikasi.
- **Dampak:** foto yang belum disetujui pengguna dapat terlihat publik. Status default backend harus diverifikasi; ini bukan klaim kebocoran produksi yang telah diamati.
- **Perbaikan/acceptance:** upload-only atau create draft/private atomik server-side, jangan mengandalkan kompensasi UI untuk privasi. Uji hide 500 dan jaringan terputus setelah upload.

### E40 — Tambah foto ke item lama dapat membuat item baru yang tak dikelola
**P1 · B**  
**Lokasi:** `app/showcase-management.tsx:420–440`; `lib/showcase-upload.ts:26–30,66–71`.

- **Bukti/pemicu:** pada attach, hasil `kind:"item"` hanya menambah `failedUploads`; item baru yang sudah dibuat tidak dihapus/disembunyikan ataupun ditautkan. Jika semua fallback, handler return sebelum refresh.
- **Dampak:** pengguna melihat “Gagal mengunggah” padahal ada postingan baru/orphan di server.
- **Perbaikan/acceptance:** pisahkan uploader attachment dari endpoint auto-create; hentikan fallback yang memiliki side effect berbeda. Uji respons item-utuh saat attach dan pastikan tidak ada postingan tambahan.

### E41 — Fallback upload terlalu luas dan tidak membedakan tahap gagal
**P2 · R**  
**Lokasi:** `lib/showcase-upload.ts:33–41,49–60`.

- **Bukti/pemicu:** semua 400/404/405/501 atau `VALIDATION` dari seluruh pipeline dianggap alasan memakai legacy. Error validasi file maupun confirm ikut masuk kategori “presigned tidak didukung”.
- **Dampak:** invalid file diunggah ulang, akar masalah tertutup, dan side effect endpoint legacy bisa berbeda.
- **Perbaikan/acceptance:** fallback hanya pada capability error yang dikenal pada tahap request presigned; error file/PUT/confirm harus dipertahankan. Uji masing-masing tahap dengan status sama tetapi sebab berbeda.

### E42 — Key presigned hilang dari caller jika PUT/confirm gagal
**P2 · R**  
**Lokasi:** `lib/api/upload.ts:130–148`; `lib/showcase-upload.ts:49–57,88–94`.

- **Bukti/pemicu:** key baru dikembalikan setelah confirm sukses. Bila objek sudah di-PUT tetapi confirm gagal, uploader melempar tanpa mengembalikan key ke `uploadedKeys` caller.
- **Dampak:** cleanup caller tidak mengetahui objek tersebut. Keberadaan TTL/GC server menentukan orphan permanen atau sementara.
- **Perbaikan/acceptance:** cleanup di lapisan yang memiliki presigned key, atau error bertipe yang membawa cleanup handle; pastikan tidak menghapus objek yang ternyata sudah committed. Fault-injection setelah PUT wajib diuji.

### E43 — Upload batch tidak menunjukkan progres atau file yang perlu retry
**P2 · I**  
**Lokasi:** `app/showcase-management.tsx:202–223,266–279,656–662`.

- **Bukti/pemicu:** delapan upload dilakukan berurutan; UI hanya memiliki boolean uploading. Nama file gagal dikumpulkan tetapi hasil hanya menampilkan jumlah, tanpa retry per file.
- **Dampak:** pengguna tidak tahu progres atau gambar mana yang hilang; mengulangi semua upload membuang bandwidth.
- **Perbaikan/acceptance:** tampilkan fase dan progres `n/N`, thumbnail status, cancel, serta retry hanya file gagal. Uji satu gagal di tengah batch tanpa membuang file sukses.

### E44 — Tidak ada preview foto draft sebelum create dipublikasikan
**P2 · I**  
**Lokasi:** `app/showcase-management.tsx:105–108,281–284,776–858`.

- **Bukti/pemicu:** editor create hanya menyimpan fileKeys, bukan assets/preview; form menampilkan metadata tanpa thumbnail, penghapusan foto pilihan, atau reorder sebelum simpan.
- **Dampak:** setelah partial upload, pengguna sulit memastikan foto/cover yang akan terbit. Default visibility PUBLIC memperbesar pentingnya preview.
- **Perbaikan/acceptance:** draft menyimpan metadata preview dan pemetaan fileKey; konfirmasi urutan/cover sebelum commit, dengan cleanup foto yang dikeluarkan.

### E45 — Form dapat dibuang tanpa konfirmasi perubahan belum tersimpan
**P2 · I**  
**Lokasi:** `app/showcase-management.tsx:305–312,779,787–789`.

- **Bukti/pemicu:** dismissal langsung menutup editor; tidak ada dirty-check/konfirmasi. Pada create, semua upload draft dijadwalkan cleanup.
- **Dampak:** swipe/backdrop/Batal yang tak sengaja menghilangkan metadata dan memaksa upload ulang.
- **Perbaikan/acceptance:** dirty-state guard konsisten untuk tombol, swipe, hardware back dan navigasi; opsi lanjut mengedit/buang draft. Jangan memblokir penutupan form yang belum berubah.

### E46 — Draft reorder invalid tetap dikirim setelah foto dihapus/ditambah
**P1 · B · Probe**  
**Lokasi:** `app/showcase-management.tsx:472–479,496–506`.

- **Bukti/pemicu:** UI `effectiveImageIds` menolak draft jika himpunan ID berbeda, tetapi close handler mengirim `orderDraft` mentah. Probe server `[a,b]` dan draft `[c,b,a]` mengirim ID `c` yang sudah tidak ada.
- **Dampak:** endpoint menolak “seluruh ID harus lengkap”; urutan yang terlihat dan request tidak sama.
- **Perbaikan/acceptance:** invalidate/rebase draft saat attach/delete dan validasi set sebelum commit. Test reorder→delete→close dan reorder→attach→close dengan payload lengkap yang benar.

### E47 — Draft reorder dibuang sebelum request sukses, tanpa jalur retry
**P2 · B**  
**Lokasi:** `app/showcase-management.tsx:496–518`.

- **Bukti/pemicu:** sheet/`orderDraft` di-null-kan sebelum request. Error hanya toast. Guard `committingOrder` juga diperiksa setelah draft dibuang.
- **Dampak:** offline atau commit overlap menghilangkan susunan pilihan pengguna; harus mengurutkan ulang dari awal.
- **Perbaikan/acceptance:** keep pending draft sampai sukses, sediakan retry/rollback eksplisit dan lock konsisten. Test reorder lalu 500/offline harus mempertahankan draft yang dapat dikirim ulang.

### E48 — Toggle “Tampilkan di profil” tidak mengubah visibility PRIVATE
**P2 · B**  
**Lokasi:** `app/showcase-management.tsx:355–369,574–577,633–639,846–858`.

- **Bukti/pemicu:** menu menilai/mengubah `isActive` saja; editor mempunyai visibility PUBLIC/PRIVATE terpisah. Item PRIVATE yang diaktifkan mendapat toast “Karya ditampilkan di profil”, tetapi grid tetap hidden.
- **Dampak:** status publikasi membingungkan dan pengguna merasa toggle gagal.
- **Perbaikan/acceptance:** bedakan Aktif/nonaktif dari Publik/privat dalam copy dan model status; bila tombol bermaksud publish, tampilkan perubahan visibility yang eksplisit. Test seluruh empat kombinasi boolean/visibility.

### E49 — Jumlah “disembunyikan” berbeda dari badge grid
**P3 · B**  
**Lokasi:** `app/showcase-management.tsx:593,619–623,633–639`.

- **Bukti/pemicu:** hiddenCount hanya menghitung `isActive===false`, tetapi badge juga menghitung PRIVATE. Satu item aktif-private menghasilkan badge hidden namun counter nol.
- **Dampak:** ringkasan manajemen tidak konsisten; berbeda dari aksi publikasi E48, ini kesalahan agregasi.
- **Perbaikan/acceptance:** satu predicate status bersama untuk grid, counter dan menu. Test empat kombinasi active/visibility dan jumlah agregat.

## 7. Galeri, media, aksesibilitas, dan konversi

### E50 — Batas render galeri tidak direset saat pindah username
**P2 · B**  
**Lokasi:** `app/user/[username]/showcase.tsx:45–60,87,108`.

- **Bukti/pemicu:** `renderLimit` initialized sekali; perubahan username/query key tidak meresetnya. Jika route instance dipakai ulang setelah melihat 600 item, profil berikutnya ikut merender sampai 600.
- **Dampak:** proteksi batch 60 tidak berlaku lagi dan posisi pengalaman galeri terbawa antar profil.
- **Perbaikan/acceptance:** key/reset render budget dan scroll berdasarkan username. Test perubahan param route A→B tanpa unmount setelah load beberapa batch.

### E51 — Label “Tampilkan N lainnya” menjanjikan lebih banyak dari yang dibuka
**P3 · B**  
**Lokasi:** `app/user/[username]/showcase.tsx:104–112`.

- **Bukti/pemicu:** label memakai seluruh `items.length-renderLimit`, sedangkan aksi hanya menambah 60. Untuk 300 item dan limit 60, label 240 tetapi hanya 60 tambahan muncul.
- **Dampak:** aksi tidak sesuai label dan pembaca layar menerima ekspektasi yang salah.
- **Perbaikan/acceptance:** tampilkan `min(remaining, GALLERY_RENDER_STEP)` atau benar-benar buka semuanya dengan peringatan performa. Uji sisa 1, 60, 61, 240.

### E52 — Profil dan manajemen tidak memvirtualisasi daftar karya
**P2 · I**  
**Lokasi:** `components/ui/profile-etalase-tab.tsx:126–141,234–242`; `app/showcase-management.tsx:604–641`; `app/user/[username]/showcase.tsx:62,87`.

- **Bukti/pemicu:** profil me-map seluruh kartu sosial ke View; manajemen membuat seluruh sel grid dalam scroll container. Galeri publik melakukan render bertahap tetapi tetap mengunduh array lengkap dan mempertahankan semua sel yang sudah dibuka.
- **Dampak:** biaya render/memori naik bersama katalog; belum ada benchmark untuk menentukan ambang aktual.
- **Perbaikan/acceptance:** virtualized list/grid dan, bila tersedia, pagination backend. Profiling fixture 100/500/1000 karya di perangkat target; tetapkan budget frame time/memori sebelum mengklaim peningkatan.

### E53 — Bentuk entity API tidak divalidasi sebelum akses field wajib
**P2 · R**  
**Lokasi:** `lib/api/showcase.ts:161–179,195–200`; `components/ui/showcase-feed-item.tsx:130–143`; `app/showcase/[id].tsx:250–252`.

- **Bukti/pemicu:** adapter memvalidasi sebagian envelope, bukan entity. `images:null`/missing atau `author:null` tetap lolos cast; renderer memanggil `images.flatMap` dan `author.username` langsung.
- **Dampak:** satu respons legacy/malformed dapat merusak feed/detail, bukan ErrorState yang dapat dicoba ulang. Backend compliant tidak memicu ini.
- **Perbaikan/acceptance:** parser runtime domain dengan kebijakan skip/quarantine/error dan telemetry teredaksi. Fixture missing/null images, author invalid, count non-finite, serta cursor bukan string harus diuji.

### E54 — Path parameter adapter sosial tidak di-encode
**P2 · R**  
**Lokasi:** `lib/api/showcase.ts:175,194,225,234,242,257,265,284,298`; bandingkan `lib/api/users.ts:709,725` yang memakai `seg`.

- **Bukti/pemicu:** showcaseId/commentId diinterpolasi langsung ke URL, termasuk ID dari route. Karakter `/`, `?`, `#` dapat mengubah struktur path/query alih-alih menjadi satu segment.
- **Dampak:** request salah tujuan/404 atau error ambigu pada deep link malformed. Tidak ada bukti bypass otorisasi backend.
- **Perbaikan/acceptance:** helper segment encoding bersama dan validasi format ID sesuai kontrak. Test slash, percent, query delimiter, Unicode, dan UUID normal.

### E55 — Detail tidak mempunyai fallback cover yang sudah ada pada feed
**P2 · B**  
**Lokasi:** `app/showcase/[id].tsx:250–253,548–594`; `components/ui/showcase-feed-item.tsx:130–135,238–250`.

- **Bukti/pemicu:** item `images:[]` tetapi `coverImageUrl/imageUrl` valid ditampilkan feed lewat coverFallback. Detail hanya memakai `images`, lalu “Tidak ada gambar”.
- **Dampak:** foto terlihat di feed tetapi hilang setelah dibuka; field cover memang ada pada tipe sosial.
- **Perbaikan/acceptance:** resolver galeri/cover bersama pada feed dan detail. Uji images kosong, legacy imageUrl-only, cover-only, serta URL tidak valid.

### E56 — Lazy carousel bergantung pada momentum-end untuk membuka slide
**P2 · R**  
**Lokasi:** `components/ui/showcase-feed-item.tsx:149–162,273–303`.

- **Bukti/pemicu:** mediaPage hanya berubah di `onMomentumScrollEnd`, dan gambar di luar aktif ±1 hanyalah placeholder. Scroll cepat melewati beberapa slide dapat memperlihatkan placeholder sampai gesture selesai; dispatch momentum pada mouse/wheel/browser perlu diuji.
- **Dampak:** slide tampak kosong saat drag/jump dan, pada runtime yang tidak memberi event yang diharapkan, dapat tetap tidak dimuat.
- **Perbaikan/acceptance:** viewability/onScroll-throttled yang sesuai web/native, prefetch terukur, dan fallback. Uji swipe cepat ke foto kedelapan serta trackpad/mouse, bukan native touch saja.

### E57 — Index/offset carousel tidak direconcile saat ukuran atau foto berubah
**P2 · R**  
**Lokasi:** `components/ui/showcase-feed-item.tsx:149–162`; `app/showcase/[id].tsx:183–185,267–274,559,584`.

- **Bukti/pemicu:** mediaPage tidak di-clamp ke jumlah gambar dan tidak direset saat array menyusut; perubahan width mengubah lebar slide tanpa scrollTo index yang dipertahankan.
- **Dampak:** sesudah foto dihapus atau rotasi/resize, dot aktif dan gambar terlihat bisa tak cocok; window lazy bisa berada di index di luar array.
- **Perbaikan/acceptance:** reconcile index berdasarkan ID foto, clamp dan reposition saat layout berubah. Test index 7→jumlah foto 2, rotasi, serta perubahan urutan cover.

### E58 — Carousel belum menyediakan kontrol navigasi alternatif yang eksplisit
**P2 · I**  
**Lokasi:** `components/ui/showcase-feed-item.tsx:273–309`; `app/showcase/[id].tsx:550–584`; `components/ui/page-indicator.tsx:67–78`.

- **Bukti/pemicu:** navigasi gambar mengandalkan horizontal scroll; dot adalah progressbar, bukan tombol. Tidak ada previous/next atau accessibility action per slide pada layar ini.
- **Dampak:** discoverability desktop dan operasi switch/keyboard/screen reader perlu diperkuat. Audit tidak mengklaim semua horizontal scrolling tidak aksesibel.
- **Perbaikan/acceptance:** kontrol berlabel, keyboard arrows, announcement slide dan focus behavior. Verifikasi dengan keyboard, VoiceOver/TalkBack dan zoom teks; target minimal dapat mencapai seluruh foto tanpa gesture presisi.

### E59 — Judul tetap dipotong dua baris di halaman detail
**P3 · I**  
**Lokasi:** `app/showcase/[id].tsx:615–619`.

- **Bukti/pemicu:** detail memakai `numberOfLines={2}` tanpa expand. Judul valid sampai 100 karakter dapat melampaui dua baris, terlebih pada font scaling besar.
- **Dampak:** pengguna yang membuka detail masih tidak dapat membaca nama produk lengkap secara visual.
- **Perbaikan/acceptance:** judul penuh atau expand/collapse yang dapat diakses. Uji judul maksimum pada layar kecil dan font scale 200%.

### E60 — Ajakan login tidak membawa return path/intent Etalase
**P2 · B**  
**Lokasi:** `lib/use-showcase-social-actions.ts:62–64`; `components/ui/showcase-comments-sheet.tsx:196`; `app/showcase/[id].tsx:497`; `lib/routes.ts:243`; `app/login-required.tsx:15–20`.

- **Bukti/pemicu:** helper route mendukung `next`, tetapi semua caller tersebut memanggil tanpa argumen. Layar login-required meneruskan string kosong saat next tidak ada.
- **Dampak:** konteks karya yang memicu login tidak diteruskan lewat mekanisme return path yang tersedia. Pemulihan lewat history mungkin membantu, tetapi tidak menggantikan intent yang deterministik.
- **Perbaikan/acceptance:** bawa path aman item/feed dan jenis intent; setelah login kembali ke konteks tersebut, jangan otomatis melakukan mutasi sensitif tanpa UX yang disepakati. Uji like/comment dari deep link tamu.

### E61 — Alasan moderasi ditampilkan sebagai enum mentah
**P3 · I**  
**Lokasi:** `components/ui/showcase-comment-row.tsx:83–86`; `lib/labels/report.ts`.

- **Bukti/pemicu:** `hiddenReason.toLowerCase()` menghasilkan `inappropriate`, `harassment`, `other` alih-alih label Indonesia/Inggris yang dikelola katalog.
- **Dampak:** penjelasan moderasi tidak konsisten bahasa, padahal pilihan alasannya sudah punya label terpusat.
- **Perbaikan/acceptance:** map enum ke label lokal, dengan fallback enum tak dikenal. Uji semua alasan di ID/EN; jangan mengasumsikan string literal selalu aman karena Text memiliki auto-translation.

### E62 — Share tidak punya fallback ketika endpoint metadata gagal
**P2 · I**  
**Lokasi:** `lib/showcase-social.ts:137–148`; `lib/use-showcase-social-actions.ts:115–130`.

- **Bukti/pemicu:** setiap tap wajib berhasil GET payload share sebelum share/clipboard. Fallback salin hanya dijalankan bila shareContent unavailable, bukan bila metadata endpoint timeout.
- **Dampak:** item yang sudah terbuka tetap tidak bisa dibagikan ketika endpoint tambahan gagal, walau URL publik dapat disediakan dari data/rute tervalidasi.
- **Perbaikan/acceptance:** cache/preload metadata dan fallback canonical URL yang dipercaya. Uji metadata 500/offline setelah detail sudah dimuat; jangan membagikan URL bebas yang tidak divalidasi.

### E63 — Await metadata sebelum Web Share dapat kehilangan user activation
**P2 · R**  
**Lokasi:** `lib/showcase-social.ts:137–145`; `lib/share.ts:61–68`.

- **Bukti/pemicu:** `navigator.share` dipanggil setelah request jaringan. Transient activation browser dapat habis pada jaringan lambat; fallback clipboard juga dapat memiliki pembatasan gesture/permission.
- **Dampak:** share sheet gagal atau tiba-tiba hanya menyalin URL pada browser tertentu. Harus diverifikasi di browser sasaran, bukan dianggap universal.
- **Perbaikan/acceptance:** preload payload lalu panggil share langsung dari gesture, atau dua tahap “siapkan → bagikan”. Uji Safari/mobile browser dengan delay jaringan yang panjang.

### E64 — Preview share/SEO item masih metadata HTML generik
**P2 · I**  
**Lokasi:** `scripts/gen-web-meta.mjs:32–33,74–100`; `app/showcase/[id].tsx:137–138`; `e2e/showcase.spec.ts:32–38`.

- **Bukti/pemicu:** export statis memasang judul/deskripsi generik; judul item baru diset di client. Bot preview yang tidak menjalankan JS tidak mendapat title/cover karya dari halaman detail ini.
- **Dampak:** kartu share kurang informatif dan discovery publik terbatas. Infrastruktur backend/deeplink mungkin memberi metadata lain; jalur shareUrl aktual perlu diperiksa.
- **Perbaikan/acceptance:** pastikan URL yang dibagikan memiliki server/edge metadata untuk item PUBLIC, dengan invalidasi untuk delete/private dan sanitasi output. Test raw HTML menggunakan crawler user-agent dan fixture konten privat; bukan sekadar document.title setelah JS.

## 8. Pengujian, observabilitas, dan kesenjangan kontrak

### E65 — Test Etalase belum menjalankan lifecycle komponen utama
**P1 · I**  
**Lokasi:** `tests/showcase-social-logic.test.ts:6–13`; `vitest.components.config.ts`; `components/showcase-feed-tab.tsx:252–392`; `app/showcase/[id].tsx:277–392`.

- **Bukti/pemicu:** test khusus Etalase berfokus helper murni dan store; hook utama/handler layar tidak diuji sebagai fitur. Enam probe audit menemukan cacat walau suite 496 test lulus.
- **Dampak:** reset kursor helper lulus, tetapi feedback loop/concurrency dan delete-all lokal tetap lolos release gate.
- **Perbaikan/acceptance:** component/hook integration tests dengan deferred promises untuk E01/E09/E14/E15/E21/E23/E24/E46. Setelah perbaikan, ubah probe karakterisasi menjadi assertion perilaku benar, bukan sekadar menambah snapshot.

### E66 — Kontrak upload/social belum dilindungi matriks fixture integrasi
**P2 · I**  
**Lokasi:** `lib/showcase-upload.ts:26–80`; `lib/api/showcase.ts:141–210,271–279`; `tests/showcase-social-logic.test.ts:1–33`.

- **Bukti/pemicu:** cakupan khusus fitur tidak menguji presigned→PUT→confirm→create/attach, varian auto-item/fileKey legacy, response mutation malformed, ataupun personalized auth. Test API client generik tidak memvalidasi kontrak domain ini.
- **Dampak:** perubahan backend/legacy dapat memunculkan postingan tambahan atau kehilangan state meski transport HTTP diuji.
- **Perbaikan/acceptance:** fixture terverifikasi backend dan transport mock untuk tiap tahap/failure/status; sertakan optional-auth dan public gallery contract. Ini lapisan kontrak, berbeda dari lifecycle UI E65.

### E67 — E2E hanya smoke URL/HTML, belum alur pengguna Etalase
**P2 · I**  
**Lokasi:** `e2e/showcase.spec.ts:16–46`.

- **Bukti/pemicu:** assertion utama HTTP 200, judul Kahade, dan tidak redirect; detail memakai ID dummy tanpa membuktikan karya berhasil dirender. Test galeri bahkan tidak memeriksa URL akhir bebas gate seperti test feed.
- **Dampak:** halaman error 200 dapat lolos; publish→feed→detail→interaksi, keyboard carousel, serta owner moderation tidak dilindungi.
- **Perbaikan/acceptance:** browser e2e dengan API fixture deterministik dapat dijalankan tanpa kredensial produksi; tambah staging contract suite terpisah. Satu happy path penuh plus offline/guest/owner dan keyboard flow harus memiliki assertion konten/side effect.

### E68 — Kegagalan kompensasi upload tidak observable
**P2 · I**  
**Lokasi:** `lib/showcase-upload.ts:88–94`; `app/showcase-management.tsx:232–235,221–223,425–426`.

- **Bukti/pemicu:** cleanup/hide gagal ditelan, per-file error diringkas menjadi jumlah. Tidak ada event domain yang membedakan presign, PUT, confirm, attach, cleanup atau compensation failure.
- **Dampak:** developer sulit mengetahui orphan/privasi fallback gagal di lapangan; toast sukses dapat menutupi kegagalan kompensasi. Logging transport umum tidak menggantikan outcome workflow.
- **Perbaikan/acceptance:** telemetry terstruktur dengan correlation ID dan tahap, tanpa token/signed URL/konten privat. Alarm cleanup/hide failure dan dashboard funnel upload; test redaksi data sensitif.

### E69 — Kebijakan galeri publik bertentangan dengan OpenAPI lokal
**P1 · R**  
**Lokasi:** `lib/api/users.ts:731–745`; `docs/api/kahade-api-mobile.json`, operasi `GET /v1/users/{username}/showcase`, properti `security`.

- **Bukti/pemicu:** OpenAPI menetapkan `security:[{"access-token":[]}]`; frontend memaksa `auth:"none"` dan membuka route untuk tamu. Komentar adapter sendiri mengantisipasi backend 401, tetapi bukan penyelesaian kontrak.
- **Dampak:** bila backend mengikuti spec, galeri/profil Etalase gagal bagi tamu dan bearer-only user karena token tidak dikirim. Berbeda dari E02 yang membahas personalized fields pada endpoint sosial publik.
- **Perbaikan/acceptance:** putuskan apakah endpoint benar-benar publik, ubah backend/spec/frontend secara konsisten. Verifikasi anonymous dan bearer user pada staging. ErrorState yang jujur bukan acceptance untuk galeri publik yang seharusnya berhasil.

### E70 — Detail GET yang menghitung view dapat berulang lewat retry/cache revalidation
**P2 · R**  
**Lokasi:** `lib/api/showcase.ts:174–180`; `lib/use-api-query.ts:179–210`; `app/showcase/[id].tsx:130–134,414–419`.

- **Bukti/pemicu:** adapter mendeskripsikan detail GET sebagai penghitung view; adapter mengizinkan retry dan hook juga memiliki retry transient. Refresh berulang memanggil endpoint yang sama.
- **Dampak:** jika backend menghitung setiap request, response timeout setelah increment lalu retry dapat memperbesar view count; refresh dan revalidation bukan necessarily kunjungan baru. Dedup backend belum diverifikasi.
- **Perbaikan/acceptance:** sepakati definisi view dan dedupe server per viewer/window atau pisahkan event view dari resource GET. Uji retry setelah server memproses request serta refresh berulang; jangan menonaktifkan reliability GET tanpa kontrak analytics yang jelas.

---

## 9. Rencana remediasi yang disarankan

### Gelombang 1 — Stabilkan integritas dan privasi (release gate)

- **Frontend komentar:** E01, E21, E23, E24; tambah test yang membuktikan hanya target berubah dan request tidak ganda.
- **Frontend state/feed:** E03, E09, E14, E15; gunakan session revision dan request generation, bukan kumpulan boolean yang saling lepas.
- **Frontend + backend:** selesaikan E02/E69; audit kontrak legacy pada E38/E39/E40 sebelum mempertahankan fallback. Matikan fallback yang tidak dapat menjamin draft private, bukan sekadar menambah toast.
- **CRUD:** sepakati clear semantics E33, validasi jumlah asset E36, dan reconcile draft foto E46.

### Gelombang 2 — Konsistensi lintas layar dan recovery

E04–E06, E10–E13, E16/E18/E20, E22/E25–E31, E35/E37/E41/E42/E47/E48, E53–E57/E60. Setiap fix harus diuji terhadap sukses, gagal, respons terbalik, route berubah, dan sesi berubah. E65–E67 dikerjakan bersamaan dengan fix, bukan menunggu akhir.

### Gelombang 3 — Kualitas produk dan operasional

Persistensi/retrieval bookmark E07/E08, feed resilience/shareable filters E17/E19, laporan kontekstual E32, model harga E34, progres/preview/draft E43–E45, konsistensi ringkasan E49–E51, virtualisasi E52, aksesibilitas E58/E59, i18n E61, share/SEO E62–E64, telemetry E68, view semantics E70.

**Dependensi penting:** memperbaiki optional-auth tanpa reset account-scoped cache dapat membuat state lintas akun semakin sensitif. Memperbaiki serializer clear tanpa kontrak backend dapat mengubah field secara salah. Cleanup upload tidak boleh menghapus objek yang sudah attached pada respons timeout ambigu. Reorder dan attach/delete harus diperlakukan sebagai satu workflow, bukan mutation independen tanpa revisi.

## 10. Matriks verifikasi runtime/staging

| Area | Skenario minimum | Bukti penerimaan |
|---|---|---|
| Identitas | Tamu, pemilik, pengguna lain, A→logout→B tanpa reload | Header auth sesuai kontrak; state/aksi tidak diwariskan |
| Following | 0/1/201 akun, karya pertama di page 4, login saat tab mounted | Tidak loop; tidak false-empty tanpa jalur lanjut |
| Feed concurrency | Refresh vs more, filter cepat, latest sukses/popular gagal | Tidak campur query; cursor dan items konsisten |
| Komentar | Page 1 gagal, dua Enter, sheet A→B, edit saat GET pending | Target/halaman benar; tidak hilang/duplikat |
| Upload | 1/8/9 file; legacy item/fileKey campuran; PUT sukses-confirm gagal | Tidak ada publikasi tak disengaja; cleanup terukur |
| Foto | Reorder→delete/attach→close; commit 500; resize carousel | Draft valid/retryable; media dan indikator konsisten |
| Privasi | PUBLIC/PRIVATE × active/inactive; item dicabut saat terbuka | Pesan status benar; refresh tidak menyembunyikan pencabutan |
| Share/login | Metadata timeout, browser activation, login dari deep link | Fallback jelas; kembali ke karya; metadata bot sesuai visibility |
| Aksesibilitas | Keyboard saja, TalkBack, VoiceOver, 200% font, reduced motion | Semua aksi/media dapat dijangkau dan dibaca |
| Skala | 100/500/1000 karya, thread banyak replies | Budget performa terukur; tidak hanya klaim memo/virtualisasi |

## 11. Reproduksi terisolasi yang disertakan

Jalankan dari root repository:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node docs/audits/etalase-probes.mjs
```

Probe mengambil **fungsi aktual** dengan TypeScript AST dan memock dependency, bukan menyalin ulang algoritme. Enam skenario: E01, E33, E46, E21, E38, E23. Output `CONFIRMED` berarti kondisi cacat berhasil ditunjukkan di fixture terisolasi, **bukan** test acceptance yang menyatakan fitur benar. Setelah fix, assertion karakterisasi memang dapat gagal; pindahkan kasusnya ke regression tests dengan ekspektasi perilaku benar.

Untuk E33, probe hanya membuktikan field hilang dari JSON; efek update final tetap bergantung backend. Untuk E38, probe memakai cabang respons `kind:item` yang memang didukung kode, bukan menyatakan endpoint produksi selalu mengembalikan bentuk itu.

## 12. Kriteria menutup audit

1. Setiap P1 memiliki owner, reproduksi, test gagal sebelum fix/lulus sesudah fix, dan bukti verifikasi sesuai lapisannya.
2. Setiap R dikonfirmasi atau ditutup dengan bukti kontrak/runtime—bukan dianggap bug pasti, dan bukan diabaikan karena unit test hijau.
3. Setiap I diputuskan produk: implementasikan, jadwalkan, atau tolak dengan alasan/UX alternatif.
4. Status audit lama diperbarui hanya setelah acceptance per workflow; hindari pernyataan “semua selesai” berdasarkan grep, typecheck, atau pemindahan kode ke helper.
5. Jangan menyamakan perbaikan frontend dengan jaminan keamanan server. Ownership, visibility, validasi upload, moderasi, dan idempotency tetap harus ditegakkan backend.
