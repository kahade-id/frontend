# Audit Mendalam End-to-End — Fitur Etalase (Showcase)

> **USANG (2026-09-24).** Dokumen ini adalah catatan audit Etalase per
> 2026-09-23. Banyak temuannya SUDAH diperbaiki di kode (lihat penanda
> revisi `A-01…A-21`, `B-05`, `C-01…C-08`, `D-15…D-21`, `E-01…E-03`,
> `H-04/H-05`, `L-06` di sumber), dan audit lanjutannya ada di
> `docs/audit-etalase-mendalam-2026-09-24.md` (+ laporan perbaikan
> `docs/audit-etalase-perbaikan-2026-09-24.md`). JANGAN mengutip daftar di
> bawah sebagai bug yang masih hidup tanpa memverifikasi ulang di HEAD.


**Tanggal:** 2026-09-23 · **Branch:** `arena/01a0ce63-frontend` @ `e3b414c`
**Cakupan (dibaca baris per baris):** `app/(tabs)/showcase.tsx`, `components/showcase-feed-tab.tsx`, `lib/showcase-feed-logic.ts`, `components/ui/showcase-header.tsx`, `components/ui/showcase-feed-item.tsx`, `components/ui/showcase-media-gallery.tsx`, `components/ui/like-button.tsx`, `lib/use-showcase-social-actions.ts`, `lib/showcase-social-prefs.ts`, `lib/showcase-social.ts`, `lib/showcase-labels.ts`, `lib/showcase-state.ts`, `lib/use-showcase-operation.ts`, `app/showcase/[id].tsx`, `components/ui/showcase-comment-row.tsx`, `components/ui/showcase-comments-sheet.tsx`, `components/ui/showcase-report-sheet.tsx`, `app/showcase-management.tsx`, `lib/showcase-upload.ts`, `lib/image-picker.ts`, `components/ui/showcase-gallery-grid.tsx`, `components/ui/profile-etalase-tab.tsx`, `lib/use-profile-showcase.ts`, `app/user/[username].tsx` (bagian etalase), `app/user/[username]/showcase.tsx`, `components/ui/showcase-saved-collection.tsx`, `app/saved.tsx`, `app/search.tsx` (bagian postingan), `lib/api/showcase.ts`, bagian showcase `lib/api/users.ts`, `lib/protected-routes.ts`, `lib/routes.ts`, `lib/notification-routing.ts`, `lib/i18n/*`, kontrak `docs/api/kahade-api-mobile.json`, serta semua test/e2e showcase.

## Metode & standar bukti

Setiap temuan punya **lokasi `file:line`** dan **bukti** dari salah satu jenis berikut:

- **[RUNTIME]** — dibuktikan dengan menjalankan kode sungguhan lewat test vitest sementara (sudah dihapus setelah dipakai). Output-nya dikutip.
- **[KODE]** — dibuktikan dari alur kode yang deterministik (tanpa asumsi soal backend).
- **[KONTRAK]** — dibuktikan dari `docs/api/kahade-api-mobile.json`.
- **[I18N]** — dibuktikan dengan memanggil `translate()` saat `setLanguage("en")`.

Hal-hal yang bergantung pada perilaku backend yang tidak bisa saya lihat **tidak saya masukkan** sebagai issue. Temuan yang sifatnya kemampuan/UX, bukan cacat, ditandai **[IMPROVE]**.

Kondisi awal gate: `tsc` ✅, `eslint` (file showcase) ✅, `check:i18n` ✅, vitest showcase 62/62 ✅. **Tidak satu pun temuan di bawah tertangkap gate tersebut.**

Severity: 🔴 kritis · 🟠 tinggi · 🟡 sedang · 🔵 rendah

## Ringkasan

| Area | Bug | Improve | Total |
|---|---:|---:|---:|
| A. Feed tab | 15 | 6 | 21 |
| B. Kartu feed & galeri media | 8 | 3 | 11 |
| C. Hook aksi sosial & store prefs | 6 | 2 | 8 |
| D. Halaman detail `/showcase/[id]` | 14 | 7 | 21 |
| E. Sheet komentar | 4 | 2 | 6 |
| F. Sheet laporan | 3 | 1 | 4 |
| G. Manajemen etalase | 17 | 7 | 24 |
| H. Tab Etalase profil | 5 | 0 | 5 |
| I. Galeri publik | 3 | 1 | 4 |
| J. Karya tersimpan | 4 | 1 | 5 |
| K. Adapter & kontrak API | 6 | 0 | 6 |
| L. Routing, gating, SEO, search | 4 | 3 | 7 |
| M. i18n & copy | 5 | 0 | 5 |
| N. Testing & dokumentasi | 4 | 0 | 4 |
| **Total** | **98** | **33** | **131** |

### 5 masalah paling mendesak

1. **A-01 🔴 [RUNTIME]** — Sekali tekan ♥/komentar di feed langsung **me-reset feed ke halaman 1**: halaman 2..N hilang dan posisi scroll ikut hilang.
2. **H-01/H-02 🟠 [RUNTIME]** — Sekali tekan ♥ di tab Etalase profil, **seluruh list berubah jadi skeleton**. Kalau refetch di latar gagal, **list terhapus**.
3. **D-01 🟠 [KODE]** — Pull-to-refresh atau kembali fokus saat offline di halaman detail **mengganti seluruh layar dengan error** dan **draf komentar hilang**.
4. **C-01 🟠 [RUNTIME]** — Menyimpan karya ke-26 menampilkan "Terjadi kesalahan. Coba lagi.". Pesan batas 25 yang sebenarnya tertelan.
5. **A-02 🟠 [RUNTIME]** — Tab "Mengikuti" me-refetch **seluruh daftar following (tanpa batas halaman)** setiap kali fokus, dan `getMe` terpanggil dua kali saat mount.

---

## A. Feed tab — `components/showcase-feed-tab.tsx`

**A-01 🔴 Like/komentar/moderasi mereset feed ke halaman 1 [RUNTIME]**
Lokasi: effect `379-388` (deps `dirtyVersion`). Pemicunya ada di `use-showcase-social-actions.ts:96`, `showcase-comments-sheet.tsx:117`, dan `[id].tsx:286,321,353,361,395`.
Bukti: test memuat halaman 1 lalu halaman 2, kemudian memanggil `markShowcaseFeedDirty()` seperti yang dilakukan tombol ♥. Hasilnya: `feed calls 2 → 3`, `page2 visible: false`, `cursor of last call: undefined`.
Dampak: pengguna yang sedang scroll di halaman 3 dan menekan ♥ langsung terlempar ke atas dengan isi baru. Aksi paling sering di feed justru merusak feed.
Saran: `markShowcaseFeedDirty` hanya untuk mutasi manajemen. Like/komentar cukup lewat store override dan patch lokal.

**A-02 🟠 Tab "Mengikuti" refetch penuh di setiap fokus + fetch ganda saat mount [RUNTIME]**
Lokasi: `382` (`|| kind === "following"`), `365-366`, `383-384`.
Bukti: saat mount tab following tercatat `getMe calls: 2`. Effect muat awal (364) dan effect fokus (379) sama-sama berjalan, dan yang kedua meng-abort yang pertama.
Dampak: setiap kembali ke tab, seluruh daftar following diunduh ulang dan feed dipindai ulang.

**A-03 🟠 Loop daftar following tanpa batas atas [KODE]**
Lokasi: `201-208` (`for (let page = 1; ; page++)`), 50 akun per halaman, berurutan.
Dampak: akun yang mengikuti 5.000 akun butuh 100 request serial sebelum paint pertama, dan itu diulang di setiap fokus (A-02).

**A-04 🟡 Cache following praktis mati [KODE]**
Lokasi: cache dibaca di `199`, tapi di-null-kan di `176`, `365`, `383`, dan `509`. Setiap fetch `initial` atau `refresh` selalu didahului reset.
Dampak: logika A-04 (cache per akun) tidak pernah terpakai kecuali untuk `more`. Ini kompleksitas tanpa manfaat.

**A-05 🟡 Error parsial "Untuk Anda" saat load-more tampil sebagai banner di atas list [KODE]**
Lokasi: `302` memanggil `setError` tanpa melihat `mode`. `PaginatedList` merendernya di header (`paginated-list.tsx:165`).
Dampak: pengguna di bawah list tidak melihat error-nya. Tombol "Coba lagi" memanggil `refresh`, sehingga semua halaman yang sudah dimuat ikut dibuang.

**A-06 🟡 Filter `?search=` tidak bisa dihapus [KODE]**
Lokasi: `117-120` membaca `search` dari URL, tapi hanya kategori yang punya chip hapus (`468-481`). Header tidak punya kolom cari.
Dampak: deep link lama `/showcase?search=x` mengunci feed ke hasil filter tanpa jalan keluar selain mengedit URL.

**A-07 🟡 `renderItem` bergantung pada `items.length` [KODE]**
Lokasi: `413-421`.
Dampak: setiap load-more mengganti identitas `renderItem`, sehingga FlatList me-render ulang semua sel yang terlihat. Klaim A-09 (memo) jadi tidak berlaku. Divider sebaiknya lewat `ItemSeparatorComponent`.

**A-08 🟡 Memo `ShowcaseFeedItem` selalu jebol [KODE]**
Lokasi: `FeedCard 93-102` membuat arrow baru (`onPress`, `onOpenComments`, `onReport`) di setiap render. `display` juga objek baru setiap kali ada override.
Dampak: `memo(ShowcaseFeedItemBase)` (`showcase-feed-item.tsx:291`) tidak pernah melewati render.

**A-09 🟡 Tombol "Karya tersimpan" tampil untuk tamu tanpa gate [KODE]**
Lokasi: `525`. `/saved` terdaftar di `AUTHENTICATED_SCREENS` (`protected-routes.ts:62`), sementara tab ini dibuka untuk tamu (`protected-routes.ts:111`).
Dampak: tamu menabrak dinding login tanpa konteks. Aksi lain di tab ini memakai `requireLogin`.

**A-10 🟡 Ikon kelola & lonceng di header tidak digate untuk tamu [KODE]**
Lokasi: `showcase-header.tsx:86` (`/showcase-management`, terproteksi) dan `:117` (`/notifications`, sengaja dikeluarkan dari akses tamu, lihat `protected-routes.ts:100-102`).
Dampak: tamu web di tab publik menekan dua tombol utama header dan langsung menabrak dinding login.

**A-11 🟡 Kembali ke tab lama selalu skeleton + fetch ulang [KODE]**
Lokasi: `364-371` (`setItems([])`) dan `257-259` (`initial` selalu reset slot).
Dampak: kursor per tab di `pageStates` disimpan tapi item tidak. Berpindah Terbaru→Populer→Terbaru selalu memuat dari nol. State per tab jadi tidak berguna.

**A-12 🟡 Filter "Mengikuti" mencocokkan username secara exact-case [KODE]**
Lokasi: `331` (`set.has(item.author.username)`). Di layar profil, perbandingan username memakai `toLowerCase()` (`app/user/[username].tsx:235`).
Dampak: dua aturan identitas berbeda di satu aplikasi. `userId` lebih stabil daripada username yang bisa diganti.

**A-13 🟡 `onRefresh` me-reset state following di semua tab [KODE]**
Lokasi: `507-513`. `setFollowingSet(null)` dijalankan juga di tab Terbaru/Populer.
Dampak: empty-state "Kamu belum mengikuti siapa pun" (`436`) bergantung pada state yang dibuang tanpa alasan. Ini render tambahan dan membuka potensi kedip.

**A-14 🔵 Docblock basi: "maks 4×50 = 200" [KODE]**
Lokasi: `182`. Loop-nya sudah tanpa batas (A-03).

**A-15 🔵 Strip tab tanpa `tablist` [KODE]**
Lokasi: `showcase-header.tsx:145` memakai `accessibilityRole="tab"`, tapi container `ScrollView` (`133`) tidak punya `tablist`. Komponen lain di repo memakainya (`tabs.tsx:179`).

**A-16 🔵 Debounce 400 ms atas param URL yang tidak diketik [KODE]**
Lokasi: `122`. Tidak ada input yang mengubah `search`, jadi debounce hanya menunda fetch saat param berubah.

**A-17 [IMPROVE] 🟡 Feed "Mengikuti" butuh endpoint server** — Saat ini feed global dipindai di sisi klien, 60 item per fetch (`52-53`, `320-333`). Butuh `GET /showcase/feed?following=true`.
**A-18 [IMPROVE] 🔵** — Empty state "Kamu belum mengikuti siapa pun" menyebut "tab Temukan" tapi tidak punya tombol ke sana (`437-443`).
**A-19 [IMPROVE] 🔵** — Tidak ada scroll-to-top saat tab ditekan ulang. `useScrollToTop` tidak dipakai di mana pun.
**A-20 [IMPROVE] 🔵** — Empty state feed umum tidak punya CTA "Tambah karya" untuk penjual (`455-465`).
**A-21 [IMPROVE] 🔵** — State item per tab sebaiknya di-cache supaya pindah tab terasa instan (lanjutan A-11).

## B. Kartu feed & galeri media

**B-01 🟡 Galeri me-render SEMUA foto, bertentangan dengan klaim B-02 [KODE]**
Lokasi: `showcase-media-gallery.tsx:41-49` (`images.map` → `<Picture>` untuk setiap gambar). Docblock `showcase-feed-item.tsx:8-10` mengklaim hanya slide aktif ±1 yang dirender.
Dampak: hingga 8 gambar ter-mount per kartu di feed dan tab profil.

**B-02 🟡 Judul kosong untuk item tanpa `title` [RUNTIME]**
Lokasi: `lib/api/showcase.ts:326` mengembalikan `""`. Buktinya `TITLE: ""`. Fallback "Tanpa judul" hanya ada di jalur `toSocialShowcaseItem`.
Dampak: kartu feed dan detail menampilkan baris kosong. Label a11y jadi "Showcase , Rp…, oleh …". Klaim C-07/J-04 hanya berlaku sebagian.

**B-03 🟡 Pressable bersarang: badge kategori di dalam pressable ringkasan [KODE]**
Lokasi: `showcase-feed-item.tsx:212-235`.
Dampak: di web, button di dalam elemen role=button adalah HTML yang tidak valid. Di iOS, parent `accessible` dengan label ringkasan menyembunyikan tombol kategori dari VoiceOver.

**B-04 🟡 Label a11y ♥ tidak diterjemahkan [I18N]**
Lokasi: `like-button.tsx:188`. `translate("Sukai")` dan `translate("Hapus suka")` di EN mengembalikan teks Indonesia apa adanya.

**B-05 🔵 Hint jumlah komentar dirakit dari string mentah [KODE/I18N]**
Lokasi: `showcase-feed-item.tsx:132` (`` `${n} Komentar` ``). Di EN tetap "12 Komentar".

**B-06 🔵 Harga 0/0 tampil "Rp 0" [RUNTIME]**
Bukti: `PRICE00: Rp 0`. Form manajemen sendiri menyebut "0 untuk gratis" (`showcase-management.tsx:354`), jadi label seharusnya "Gratis".

**B-07 🔵 Label rentang harga tidak bisa diterjemahkan [KODE]**
Lokasi: `showcase-labels.ts:46-47`. Label `Rp X` dan `Rp X – Y` dirakit dengan template literal, bukan `translate`.

**B-08 🔵 Placeholder "Tidak ada gambar" `h-64` vs slide rasio 1:1 [KODE]**
Lokasi: `showcase-media-gallery.tsx:31`. Tinggi kartu tanpa gambar berbeda dari kartu bergambar, sehingga ritme feed tidak konsisten.

**B-09 [IMPROVE] 🔵** — `viewCount`, `isVip`, dan `membershipRank` di-parse dan dibawa ke setiap item, tapi tidak pernah ditampilkan di mana pun (grep: 0 pemakaian UI).
**B-10 [IMPROVE] 🔵** — Waktu posting memakai tanggal-jam absolut (`189`). Feed sosial umumnya memakai waktu relatif ("2 jam").
**B-11 [IMPROVE] 🔵** — Navigasi foto berupa baris panah + teks di bawah gambar, tanpa indikator titik. Setiap kartu multi-foto jadi ±44 px lebih tinggi (`showcase-media-gallery.tsx:52-56`).

## C. Hook aksi sosial & store prefs

**C-01 🟠 Batas 25 karya tersimpan tampil sebagai "Terjadi kesalahan" [RUNTIME]**
Lokasi: `showcase-social-prefs.ts:210` melempar `Error` biasa. `use-showcase-social-actions.ts:137` memakai `userMessage(error)`.
Bukti: `LIMIT_MSG: Maksimal 25 karya… => USER: Terjadi kesalahan. Coba lagi.`

**C-02 🟡 Setiap ♥ memicu reload jaringan di feed & profil [KODE+RUNTIME]**
Lokasi: `use-showcase-social-actions.ts:96` memanggil `markShowcaseFeedDirty()` setelah like sukses. Akibatnya lihat A-01 dan H-01.
Dampak: satu tap berujung 1 POST + 1–2 GET feed + GET profil.

**C-03 🟡 Login dari aksi apa pun selalu kembali ke halaman detail [KODE]**
Lokasi: `use-showcase-social-actions.ts:66`, `showcase-report-sheet.tsx:59`, `showcase-comments-sheet.tsx:200`.
Dampak: tamu yang menekan ♥ di feed atau profil, setelah login, mendarat di `/showcase/{id}`. Konteks dan posisinya hilang.

**C-04 🔵 `likeBusy` ditulis tapi tidak pernah dibaca [KODE]**
Lokasi: `use-showcase-social-actions.ts:55,86,121`. Ini kode mati.

**C-05 🔵 `useRequireSessionAction` diekspor tapi tidak dipakai [KODE]**
Lokasi: `showcase-social-prefs.ts:269-277` (grep: 0 pemakai).

**C-06 🔵 Invalidasi cache di `markShowcaseFeedDirty` tidak berefek [KODE]**
Lokasi: `showcase-social-prefs.ts:257-259`. Semua konsumen prefix tersebut memakai `useCache:false` (`[id].tsx:91`, `showcase-management.tsx:127`, `user/[username]/showcase.tsx:335`, `showcase-comments-sheet.tsx:83`, `showcase-saved-collection.tsx:30`).

**C-07 [IMPROVE] 🟡** — Bookmark hanya lokal, maksimal 25 per perangkat, dan hilang saat logout (`showcase-saved-collection.tsx:35`). Tidak sinkron lintas perangkat. Butuh endpoint koleksi di server.
**C-08 [IMPROVE] 🔵** — Share selalu merakit payload lokal (`showcase-social.ts:141-144`). `item.shareUrl` dari backend dan endpoint `/share` (yang punya `imageUrl`/`priceLabel`) diabaikan untuk item yang sudah dikenal. Pesan share juga tanpa harga.

## D. Halaman detail — `app/showcase/[id].tsx`

**D-01 🟠 Refresh atau fokus-ulang yang gagal menghapus layar & draf komentar [KODE]**
Lokasi: `98` (`if (!item || query.error)`). `useApiQuery` mengisi `error` saat refresh gagal tanpa membuang `data` (`use-api-query.ts:221`), dan `refreshOnFocus:true` (`91`) memakai jalur refresh.
Dampak: kembali ke detail saat offline membuat seluruh konten diganti ErrorState. `ShowcaseDetailContent` unmount sehingga draf komentar, halaman komentar, dan posisi scroll hilang.

**D-02 🟡 Setiap mutasi komentar me-refetch halaman 1..N secara serial [KODE]**
Lokasi: `199-207` dipanggil dari `305`, `338`, `382`, `412`.
Dampak: setelah membaca 10 halaman, satu komentar memicu 10 GET berurutan. Insert lokal juga langsung ditimpa.

**D-03 🟡 "Laporkan pengguna" pada komentar tidak melaporkan komentarnya [KODE]**
Lokasi: `432-434` → `/reports?targetId=userId`, formulir lapor pengguna (`app/reports.tsx:93-110`). ID dan isi komentar tidak ikut terkirim, dan `targetName` tidak diteruskan sehingga judulnya generik "Laporkan pengguna" (`reports.tsx:139-141`).

**D-04 🟡 "Buat Transaksi" tampil untuk tamu tanpa gate [KODE]**
Lokasi: `437-443`, `645-649`. `create-transaction` terproteksi (`protected-routes.ts:35`), sementara detail ini publik.

**D-05 🟡 Hitungan komentar tercampur: root vs semua [KODE+KONTRAK]**
Kontrak menyebut "Komentar root dipaginasi", jadi `total` hanya menghitung root (`[id].tsx:203`). Tapi insert balasan menambah `+1` (`270`), menghapus root yang punya balasan hanya mengurangi `-1` (`356`), dan kartu feed memakai `commentCount`.
Dampak: angka di kartu dan di detail tidak sinkron.

**D-06 🟡 Menghapus root diam-diam ikut menghapus balasannya [KODE]**
Lokasi: `patchComments` (`showcase-state.ts:675`). Copy konfirmasi hanya berbunyi "Komentar dihapus permanen." (`836`).

**D-07 🟡 Hitungan komentar 0 selama loading [KODE]**
Lokasi: `147` (`useState(0)`). `item.commentCount` sebenarnya sudah tersedia. Baris aksi menampilkan "0 Komentar" lalu melompat.

**D-08 🟡 Detail `retry: 0` di dua lapis [KODE]**
Lokasi: `91` dan `lib/api/showcase.ts:167`. Satu gangguan jaringan sesaat langsung menampilkan layar error penuh (lihat juga D-01).

**D-09 🔵 Judul dokumen kosong untuk item tanpa judul [KODE]**
Lokasi: `96`. `"" ?? "Etalase"` tetap `""` (lihat B-02).

**D-10 🔵 "Balas" tidak memfokuskan komposer [KODE]**
Lokasi: `684`, `694`, `741` (`onReply={setReplyTo}`). Pengguna harus mengetuk input secara manual.

**D-11 🔵 Alasan sembunyikan tidak di-reset antar-buka [KODE]**
Lokasi: `164`. Alasan dari moderasi sebelumnya sudah terpilih.

**D-12 🔵 Dialog "Sembunyikan" bergaya destruktif padahal bisa dibatalkan [KODE]**
Lokasi: `845` (`destructive` selalu aktif).

**D-13 🔵 Edit tanpa perubahan tetap mengirim PATCH [KODE]**
Lokasi: `817`. Tombol hanya dinonaktifkan saat teks kosong.

**D-14 🔵 Dua tombol "lainnya" bisa tampil bersamaan [KODE]**
Lokasi: "Tampilkan komentar lainnya" (`700-708`) dan "Muat komentar berikutnya" (`711-719`).

**D-15 🔵 Target sentuh kecil [KODE]**
Lokasi: "Batal" balasan (`465-472`) dan "Balas" (`showcase-comment-row.tsx:99-107`). Keduanya tanpa `min-h-11`.

**D-16 [IMPROVE] 🟡** — MediaViewer hanya membuka satu foto (`229-237`). Tidak bisa swipe antar-foto dalam layar penuh.
**D-17 [IMPROVE] 🔵** — 404/403 (item dihapus, privat, atau diblokir) hanya tampil sebagai "Gagal memuat" generik (`110`). Belum ada state "Karya tidak tersedia".
**D-18 [IMPROVE] 🔵** — Komentar yang diedit tidak diberi penanda "(diedit)". `updatedAt` diabaikan (`showcase-comment-row.tsx`).
**D-19 [IMPROVE] 🔵** — Komposer berupa `Input` satu baris untuk komentar hingga 1000 karakter, tanpa penghitung (`478-490`).
**D-20 [IMPROVE] 🔵** — Avatar dan nama penulis komentar tidak bisa ditekan untuk membuka profil.
**D-21 [IMPROVE] 🔵** — Pemilik tidak punya jalan pintas "Ubah karya" dari halaman detail ke manajemen.

## E. Sheet komentar — `components/ui/showcase-comments-sheet.tsx`

**E-01 🟡 Error query menyembunyikan komentar lokal yang baru terkirim [KODE]**
Lokasi: `225-233`. `query.error` dicek sebelum `comments`.

**E-02 🔵 Judul "Komentar  12" tidak bisa diterjemahkan [I18N]**
Lokasi: `160`. `translate("Komentar  12")` di EN tetap Indonesia.

**E-03 🔵 Docblock G-04 menggantung tanpa kode [KODE]**
Lokasi: `102-107`. Komentarnya berada di atas `handleSend`. Reload saat buka ulang terjadi hanya sebagai efek samping `enabled`.

**E-04 🔵 Hint "Kirim komentar showcase" [KODE]**
Lokasi: `190`. Masih memakai istilah "showcase" (lihat M-03).

**E-05 [IMPROVE] 🔵** — Draf dibuang saat sheet ditutup tanpa konfirmasi (`96-100`).
**E-06 [IMPROVE] 🔵** — Di sheet tidak bisa membalas, mengedit, atau memoderasi. Pemilik harus pindah ke detail.

## F. Sheet laporan — `components/ui/showcase-report-sheet.tsx`

**F-01 🟡 Body laporan tidak didokumentasikan di kontrak [KONTRAK]**
`POST /v1/showcase/{id}/report` tidak punya `requestBody` di spec. `reason` dan `description` (maxLength 500 hardcoded, `129`) tidak tervalidasi oleh generator.

**F-02 🔵 Alasan "SPAM" terpilih otomatis [KODE]**
Lokasi: `44`. Laporan yang dikirim tanpa pilihan sadar mencemari data moderasi.

**F-03 🔵 Tamu bisa memilih alasan lalu dilempar ke login dan pilihannya hilang [KODE]**
Lokasi: TextArea dinonaktifkan untuk tamu (`125`), tapi RadioGroup tidak (`112`).

**F-04 [IMPROVE] 🔵** — Tidak ada state "sudah dilaporkan", dan item yang dilaporkan tidak disembunyikan dari feed pelapor.

## G. Manajemen etalase — `app/showcase-management.tsx`

**G-01 🟡 Refresh gagal menutupi grid dan tombol tambah dengan ErrorState penuh [KODE]**
Lokasi: `664`. Polanya sama dengan D-01.

**G-02 🟡 Dua mekanisme "sembunyi" yang tidak konsisten [KODE]**
Deskripsi ActionSheet "Disembunyikan dari profil publik" hanya mengecek `isActive===false` (`727`). Label toggle juga hanya membaca `isActive` (`625-627`). Sementara grid menandai `PRIVATE` sebagai tersembunyi (`showcaseIsHidden`).
Dampak: item PRIVATE+aktif tidak diberi keterangan, tetap ditawari "Nonaktifkan", dan toast-nya membingungkan ("pengaturan publik atau privat tetap berlaku", `409`).

**G-03 🟡 Sheet foto bisa "terkunci" saat commit urutan gagal [KODE]**
Lokasi: `536-565`. Menutup sheet selalu mencoba commit. Kalau gagal, sheet tetap terbuka dan tidak ada opsi "buang urutan".

**G-04 🟡 Foto terakhir boleh dihapus [KODE]**
Lokasi: `567-586` (tanpa cek jumlah). Copy dialog tetap berbunyi "Foto cover akan digantikan foto berikutnya" (`805`) walaupun tidak ada foto berikutnya.
Dampak: item tampil "Tidak ada gambar" di feed.

**G-05 🟡 Error `pickImages` jadi "Terjadi kesalahan" [KODE]**
Lokasi: `image-picker.ts:136` melempar `Error` biasa, lalu `userMessage` di `238`/`489` mengubahnya jadi pesan generik (perilakunya sama dengan C-01).

**G-06 🟡 Lampirkan foto: satu kegagalan menggagalkan seluruh batch [KODE]**
Lokasi: `477-479`. Alur create menangani kegagalan per foto (`214-220`), alur attach tidak.

**G-07 🟡 Lampirkan foto tanpa progres dan tanpa tombol batal [KODE]**
Lokasi: `458-500`. `uploadAbort` sudah ada, tapi tidak ada UI di sheet foto.

**G-08 🔵 Kunci mutasi bersama membuat aksi kedua diabaikan tanpa umpan balik [KODE]**
Lokasi: `401-402`, `433-434` (`mutations.begin()` → `null` → return).

**G-09 🔵 "{x} foto" memakai fallback 1 [KODE]**
Lokasi: `616` (`images?.length ?? 1`). Item lama tanpa array `images` tertulis "1 foto".

**G-10 🔵 Reorder vertikal memakai panah kiri/kanan [KODE]**
Lokasi: `765-783` dan label "Geser foto ke kiri/kanan". Barisnya tersusun vertikal.

**G-11 🔵 Empty state "Belum ada foto" untuk daftar karya [KODE]**
Lokasi: `696-699`. Seharusnya "Belum ada karya".

**G-12 🔵 Label "Tambah foto" dipakai untuk dua aksi berbeda [KODE]**
Lokasi: membuat karya baru (`715`) dan melampirkan foto (`750`).

**G-13 🔵 Sel tanpa cover diberi `source: ""` [KODE]**
Lokasi: `689`. `Picture` langsung masuk fallback "gambar gagal" (`picture.tsx:134-137`), bukan placeholder netral.

**G-14 🔵 Judul layar "Etalase" sama dengan tab dan detail [KODE]**
Lokasi: `660`. Seharusnya dibedakan, misalnya "Kelola Etalase".

**G-15 🔵 Banner "Status simpan belum pasti" tanpa tombol segarkan [KODE]**
Lokasi: `850`.

**G-16 🔵 Adapter multipart lama `uploadShowcase` masih diekspor tapi mati [KODE]**
Lokasi: `lib/api/users.ts:661-675` (0 pemakai; tipenya UNVERIFIED).

**G-17 🔵 Dialog hapus karya tidak menyebut suka/komentar ikut hilang [KODE]**
Lokasi: `820`.

**G-18 [IMPROVE] 🟡** — Tidak ada UI untuk mengurutkan karya, padahal `sortOrder` didukung `UpdateShowcaseItemDto`. Karya baru selalu ditaruh paling akhir (`98`).
**G-19 [IMPROVE] 🔵** — Input harga berupa digit mentah tanpa pemisah ribuan. Repo sudah punya `AmountInput` (dipakai di create-transaction).
**G-20 [IMPROVE] 🔵** — Kategori berupa teks bebas tanpa saran atau normalisasi huruf, sehingga filter terpecah ("Ilustrasi" vs "ilustrasi").
**G-21 [IMPROVE] 🔵** — Unggahan berjalan serial per foto (`212-221`). Paralel 2–3 foto akan memangkas waktu tunggu.
**G-22 [IMPROVE] 🔵** — Toast "Akses galeri ditolak" tanpa aksi "Buka pengaturan".
**G-23 [IMPROVE] 🔵** — Grid tidak menampilkan harga atau status selain ikon mata.
**G-24 [IMPROVE] 🔵** — CTA tambah ada di bawah grid. Dengan 60+ karya, tombolnya jauh dari jangkauan (tidak ada aksi di header atau FAB).

## H. Tab Etalase profil

**H-01 🟠 Setiap ♥ mengganti list profil dengan skeleton [RUNTIME]**
Lokasi: `use-profile-showcase.ts:24` (`setLoading(true)` pada refetch dirty `40-45`) dan `profile-etalase-tab.tsx:192-195`.
Bukti: `P2 after like -> loading true`.

**H-02 🟠 Refetch latar yang gagal menghapus list [RUNTIME]**
Lokasi: `use-profile-showcase.ts:29` (`setItems([])` di catch).
Bukti: `P3 after failed silent refetch items 0 error offline`.

**H-03 🟡 Kilatan empty state sebelum fetch dimulai [KODE]**
Lokasi: `use-profile-showcase.ts:11` (`loading` awal `false`). Fetch baru dipicu setelah profil termuat (`[username].tsx:247`, `321-327`), jadi "Belum ada konten" sempat tampil sesaat.

**H-04 🟡 Tap penulis dari feed atau detail publik membawa tamu ke profil yang terproteksi [KODE]**
Lokasi: `showcase-feed-item.tsx:174` dan `[id].tsx:510` → `user/[username]`, yang terproteksi (`protected-routes.ts:83`). Galeri anaknya justru publik.

**H-05 🔵 Divider dihitung dari total, bukan dari slice yang dirender [KODE]**
Lokasi: `profile-etalase-tab.tsx:240`. Kartu terakhir sebelum "Tampilkan lainnya" tetap diberi divider.

## I. Galeri publik — `app/user/[username]/showcase.tsx`

**I-01 🟡 Refresh gagal mengganti grid dengan ErrorState [KODE]**
Lokasi: `353`. Polanya sama dengan D-01.

**I-02 🔵 Hint "Buka foto" padahal tap membuka detail karya [KODE]**
Lokasi: `showcase-gallery-grid.tsx:189` vs `showcase.tsx:367-370`.

**I-03 🔵 Sel tanpa cover diberi `source ""` [KODE]**
Lokasi: `364`. Sama dengan G-13.

**I-04 [IMPROVE] 🔵** — Galeri tidak menampilkan jumlah karya, harga, atau info profil. Isinya hanya grid.

## J. Karya tersimpan

**J-01 🟡 Section karya tersimpan ikut hilang saat query profil tersimpan error atau loading [KODE]**
Lokasi: `app/saved.tsx:58-64`. `ShowcaseSavedCollection` adalah child dari `DataScreen state={query}` (`data-screen.tsx:155-160`).

**J-02 🟡 Membuka "Tersimpan" menggelembungkan viewCount penulis [KONTRAK]**
Lokasi: `showcase-saved-collection.tsx:28-31`. Kode memanggil `getShowcaseDetail` untuk setiap id, padahal kontrak menyebut endpoint detail "menaikkan `viewCount`". Ini juga N+1 (hingga 25 GET).

**J-03 🔵 Menghapus satu item memuat ulang semua item [KODE]**
Lokasi: `27` (query key memuat `ids.join`).

**J-04 🔵 Semua kegagalan dilabeli sama, tanpa auto-prune [KODE]**
Lokasi: `30`, `41`. Item terhapus, privat, maupun gagal jaringan semuanya berbunyi "Karya tidak tersedia — coba buka lagi".

**J-05 [IMPROVE] 🔵** — Setiap item hanya berupa dua tombol ghost, tanpa thumbnail, harga, atau penulis (`39-44`).

## K. Adapter & kontrak API

**K-01 🟡 `parseShowcaseItem` meneruskan field mentah tanpa validasi [RUNTIME]**
Lokasi: `lib/api/showcase.ts:324` (`...value`).
Bukti: `UNVALIDATED: {"title":5} 42`. `orderLink.title` berupa number dan `visibility` 42 lolos. `orderLink` diteruskan ke prefill transaksi (`routes.ts:125-135`).

**K-02 🟡 Kontrak mewajibkan token untuk galeri publik [KONTRAK]**
Spec `GET /v1/users/{username}/showcase` menulis `security: access-token`, sementara adapter memakai `auth:"optional"` (`users.ts:721`) dan rutenya dibuka untuk tamu (I-05 lama). Keduanya bertentangan. Kalau backend mengikuti spec, tamu hanya melihat error.

**K-03 🔵 Respons tanpa schema [KONTRAK]**
`/users/{username}/showcase`, `/users/me/showcase` (GET/POST), dan `/showcase/{id}/comments` hanya punya `"description": ""`. Tipe di klien tidak bisa dijaga generator.

**K-04 🔵 `toLikeState` mengganti `likeCount` yang hilang dengan 0 [KODE]**
Lokasi: `261-264`. Setelah like sukses, UI bisa menampilkan "0 Suka". Seharusnya fallback ke nilai optimistis.

**K-05 🔵 `parseShowcaseComment` tidak memvalidasi `createdAt`/`showcaseId`/`isHidden` [KODE]**
Lokasi: `343-350`. Kalau `createdAt` hilang, tampilannya jadi "—".

**K-06 🔵 `resolveShowcaseDeeplink` diekspor tapi tidak dipakai [KODE]**
Lokasi: `lib/api/deeplinks.ts:62` (0 pemakai). Klaim H-03 "ditambahkan" menghasilkan kode mati.

## L. Routing, gating, SEO, pencarian

**L-01 🟡 Filter kategori dari kartu/detail tidak mempertahankan tab aktif [KODE]**
Lokasi: `routes.ts:350-351`. Param yang dikirim hanya `{category}`, dan `kind` tidak ikut sehingga jatuh ke default `forYou` (`showcase-feed-tab.tsx:116`).

**L-02 🔵 Resolver gambar kedua di hasil pencarian [KODE]**
Lokasi: `app/search.tsx:544` memakai `images[0] ?? coverImageUrl ?? imageUrl` sendiri, bukan `showcaseImages()`. Ini bertentangan dengan prinsip satu resolver (E-01 lama).

**L-03 🔵 Pencarian postingan dibatasi 12 tanpa tautan "Lihat semua di Etalase" [KODE]**
Lokasi: `search.tsx:172`. `/showcase?search=` sudah didukung feed, tapi tidak ditautkan.

**L-04 🔵 Prefill transaksi dari karya tidak mengisi peran BUYER [KODE]**
Lokasi: `routes.ts:125-135`. Penonton karya orang lain pasti pembeli, tapi peran harus dipilih manual.

**L-05 [IMPROVE] 🟡** — Belum ada meta OG/SEO per item di HTML web. Judul hanya dipasang di sisi klien (lihat komentar `e2e/showcase.spec.ts:33-40`), sehingga tautan share tampil generik saat di-unfurl.
**L-06 [IMPROVE] 🔵** — Belum ada deep link ke komentar tertentu (misalnya `?comment=`), padahal prop `className` untuk highlight di `ShowcaseCommentRow` sudah didokumentasikan (`42-43`).
**L-07 [IMPROVE] 🔵** — Tidak ada entri "Etalase saya" yang eksplisit selain ikon pensil tanpa label di header.

## M. i18n & copy

**M-01 🟡 Semua `accessibilityHint` tidak pernah diterjemahkan [KODE]**
`PressableScale` hanya menerjemahkan `accessibilityLabel` (`pressable-scale.tsx:109`). Semua hint etalase ("Buka detail showcase", "Bagikan showcase ini", "Tampilkan feed kategori ini", "Buka foto", dan lainnya) tetap berbahasa Indonesia di EN.

**M-02 🟡 "Buka foto" / "Buka semua foto" tidak ada di kamus [I18N]**
Lokasi: `showcase-gallery-grid.tsx:189`. `translate()` di EN mengembalikan teks apa adanya.

**M-03 🔵 Istilah "showcase" masih dipakai, bertentangan dengan klaim J-01/J-05 [KODE]**
Lokasi: `showcase-feed-tab.tsx:430,450`, `showcase-feed-item.tsx:199,200,215,261`, `showcase-comments-sheet.tsx:190`.

**M-04 🔵 Register campur "kamu" vs "Anda" [KODE]**
Feed memakai "kamu" (`showcase-feed-tab.tsx:430,440,452`), sementara detail, manajemen, dan profil memakai "Anda".

**M-05 🔵 Satuan "item" vs "karya" [KODE]**
`showcase-management.tsx:672` menulis "{x} item", padahal copy lain memakai "karya". Tombol profil "Tambah etalase" (`profile-etalase-tab.tsx:220`) juga tidak seragam.

## N. Testing & dokumentasi

**N-01 🟡 Layar inti tanpa test [KODE]**
0 test yang merender `app/showcase/[id].tsx`, `app/showcase-management.tsx`, `profile-etalase-tab`, `use-profile-showcase`, `showcase-saved-collection`, dan `showcase-media-gallery` (hasil grep `tests/`).

**N-02 🟡 Test feed me-mock versi dirty sebagai konstanta [KODE]**
Lokasi: `tests/showcase-feed-lifecycle.test.tsx:14` (`showcaseFeedDirtyVersion: () => 0`). Karena itu regresi A-01 tidak mungkin tertangkap.

**N-03 🔵 E2E hanya menguji jalur publik [KODE]**
Alur login → suka → komentar → kelola belum diotomasi (`e2e/showcase.spec.ts:13-15`).

**N-04 🔵 `issues-etalase.md` mengklaim "SEMUA 69 ditangani", padahal sebagian regresi atau hanya berlaku sebagian [KODE]**
B-02 (render window) ada di B-01 laporan ini, J-01/J-05 di M-03, C-07/J-04 di B-02, dan A-09 di A-07/A-08.

---

## Urutan perbaikan yang disarankan

1. **Sprint 1 (kebenaran data & kehilangan kerja):** A-01, C-02, H-01, H-02, D-01, G-01, I-01, C-01, G-05. Pola yang sama berulang di beberapa layar: jangan pakai *dirty → refetch* untuk aksi sosial, dan jangan jadikan `query.error` alasan membuang data yang masih valid.
2. **Sprint 2 (performa & jaringan):** A-02, A-03, A-04, A-07, A-08, B-01, D-02, J-02.
3. **Sprint 3 (gating & alur):** A-09, A-10, D-03, D-04, H-04, C-03, L-01, G-02, G-03, G-04, G-06.
4. **Sprint 4:** i18n/copy (M-*, B-04, E-02), kontrak (K-*, F-01), test (N-01, N-02), lalu IMPROVE.
