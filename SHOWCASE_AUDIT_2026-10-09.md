# Audit Etalase (Showcase) — 2026-10-09

Audit mendalam 8 area yang diminta user: (1) tab feed, (2) kartu produk,
(3) detail, (4) buat/ubah, (5) interaksi (suka/komentar/bagi/simpan),
(6) hapus/pulihkan, (7) cari & filter, (8) kontrak API.

Standar fix yang dipakai: optimis + rollback untuk setiap aksi, loading =
shimmer, error = pesan jelas + tombol ulang, semua teks UI via i18n (terlarang:
"escrow"/"rekber"/"ditahan"), kontrak API TIDAK diubah (kebutuhan backend →
`docs/rekomendasi-backend-etalase.md`). Hanya masalah dengan bukti kode yang
diperbaiki.

Baseline sebelum fix (2026-10-09): `npx tsc --noEmit` lulus; `npm test` =
37 test gagal / 2109 lulus — **semua 37 kegagalan bersifat pra-existing dan
NON-etalase** (i18n 19, device-location 6, poin2 3, web-push 2, drawer-badges 2,
+6 lainnya). Semua test etalase hijau di baseline. Gerbang per-komitmen:
`tsc` lulus + test etalase hijau + tidak menambah kegagalan baru.

---

## TEMUAN (diperbaiki)

### SH-01 — i18n: 18 string UI hardcoded, melewati penerjemah
Ketentuan "semua teks UI via i18n" dilanggar di 8 file etalase. Gejala:
pada locale Inggris teks ini tetap Indonesia. Semua kunci SUDAH ada di
`lib/i18n/catalog.json` + terjemahan EN (`lib/i18n/en/*.json`) karena dipakai
`translate()` di tempat lain — jadi perbaikannya murni pembungkusan,
nol kunci baru, nol risiko kata-kata ganda.

| # | File:baris | String hardcoded |
|---|---|---|
| 1 | components/ui/showcase-share-sheet.tsx:120 | "Salin tautan" |
| 2 | components/ui/showcase-share-sheet.tsx:123 | "WhatsApp" |
| 3 | components/ui/showcase-share-sheet.tsx:126 | "Telegram" |
| 4 | components/ui/showcase-share-sheet.tsx:129 | "X (Twitter)" |
| 5 | components/ui/saved-collection.tsx:145 | "Simpan profil penjual dari halaman profil mereka untuk dilihat lagi nanti." |
| 6 | components/ui/saved-collection.tsx:148 | "Jelajahi etalase" |
| 7 | components/ui/saved-collection.tsx:178 | "Memuat profil tersimpan…" |
| 8 | components/ui/showcase-saved-collection.tsx:180 | "Karya tersimpan" (empty state) |
| 9 | components/ui/showcase-saved-collection.tsx:188 | "Karya tersimpan" (header) |
| 10 | components/screens/showcase-detail-screen.tsx:1426 | "Simpan" (tombol simpan edit komentar) |
| 11 | components/screens/showcase-create-screen.tsx:396 | "Tunggu unggahan selesai…" |
| 12 | components/screens/showcase-create-screen.tsx:420 | "Tunggu unggahan selesai…" |
| 13 | components/screens/showcase-create-screen.tsx:1321 | "Draf privat tetap tersimpan…" |
| 14 | components/screens/showcase-create-screen.tsx:1329 | "Karya langsung tampil di feed…" |
| 15 | components/screens/showcase-management-screen.tsx:426 | "Tunggu unggahan selesai…" |
| 16 | components/screens/showcase-management-screen.tsx:436 | "Tunggu unggahan selesai…" |
| 17 | components/screens/showcase-management-screen.tsx:990 | "Gagal memuat" (ErrorState) |
| 18 | components/screens/showcase-management-screen.tsx:1071 | "Pulihkan" |
| 19 | components/screens/showcase-management-screen.tsx:1338 | "Deskripsi" |
| 20 | components/screens/showcase-management-screen.tsx:1347 | "Deskripsi" |
| 21 | components/screens/showcase-management-screen.tsx:1373 | "Harga minimum (opsional)" |
| 22 | components/screens/showcase-management-screen.tsx:1392 | "Harga maksimum (opsional)" |
| 23 | lib/use-showcase-social-actions.ts:240 | "Gagal memperbarui suka" |
| 24 | lib/use-showcase-social-actions.ts:252 | "Gagal memperbarui suka" |
| 25 | components/showcase-author-row.tsx:125 | "Anda" (badge pemilik di kartu) |

Catatan: 25 lokasi (bukan 18) — beberapa file punya string lebih dari satu.
File-file lain di permukaan etalase (feed tab, feed item, header, media
gallery, komposer komentar, sheet komentar, author rating, search, public
gallery, profile etalase tab, upload) sudah audit baris-per-baris dan
bersih.

### SH-02 — Buat: race timer autosave draft → draf muncul lagi setelah terbit/buang
components/screens/showcase-create-screen.tsx:274-292. Efek autosave memakai
`setTimeout(..., 1000)` yang hanya dibatalkan saat `form` berubah atau
unmount. Alur bug:
1. user mengetik (timer draf terjadwal, mis. akan nembak 0,4 dtk lagi);
2. user langsung tap "Terbitkan"; `handleSave` sukses → `clearShowcaseDraft()`
   (baris 890) + `setIntentionalLeave(true)`;
3. expo-router mengundur `navigation.dispatch` ke efek berikutnya (komentarnya
   sendiri ada di baris 296-300); di jendela itu timer draf nembak
   → `saveShowcaseDraft(...)` menuliskan ulang draf;
4. layar buka lagi → muncul prompt "Lanjutkan draf?" berisi karya yang
   SUDAH terbit. Path `confirmDiscard` (baris 404-410) dan dialog
   "Buang draf?" (baris 1388-1395) punya race yang sama.

Fix: ref `suppressDraftRef` yang di-set pada ketiga path di atas dan
dicek di DALAM callback timeout (cek saat efek saja tidak cukup karena
timer sudah berjalan).

### SH-03 — Ubah (editor BottomSheet): pesan error validasi menempel di field salah
components/screens/showcase-management-screen.tsx (handleSave ~baris 1150-1215,
render ~1310-1400). Satu state `formError` ditampilkan:
- di input Judul hanya jika judul kosong,
- SISI KANAN di input "Harga maksimum (opsional)" untuk SELURUH error lainnya.

Bukti gejala: error "Produk jasa wajib memiliki tenggat pengerjaan" dan
"Harga coret harus lebih besar dari harga jual" (keduanya milik field
komersial — `<CommerceProductFields>` punya mekanisme error fieldnya sendiri)
muncul sebagai teks error bawah input harga maksimum. Error
"Harga yang sudah terisi belum dapat dikosongkan" (milik harga minimum)
juga mendarat di input maksimum. Layar create sudah memisahkan ini sejak
C10/T2 (ValidationSummary + error per field) — editor belum ikut.

Fix: pecah menjadi `titleError` (menempel input Judul), `priceRangeError`
(sudah ada, tetap di input maksimum), dan `summaryError` → `<ValidationSummary
tone="danger">` di atas sheet (sebelah notice moderasi). Tidak mengubah
logika validasi, hanya lokasi tampilan.

### SH-04 — Detail: stale closure `handleDeleteItem`
components/screens/showcase-detail-screen.tsx:896, deps baris 929
`}, [id, isOwner, operation, toast.show])`. Callback membaca `item.title`,
`item.condition`, `item.category`, `showcaseImages(item)[0]` untuk
`markShowcaseDeleted` (baris 912) tapi `item` tidak ada di deps. Setelah
pull-to-refresh `item` adalah objek baru; dialog hapus yang terbuka sebelum
refresh memakai objek lama → entri hapus-pulihkan menyimpan judul/cover usang.
(exhaustive-deps dimatikan di eslint.config.mjs:85, jadi tidak ada gerbang
yang menangkap ini.)

Fix: tambah `item` ke deps.

### SH-05 — API: `getDeletedShowcase` mempercayai bentuk respons mentah
lib/api/showcase.ts:912-915 — satu-satunya endpoint daftar etalase yang
TIDAK di-parse defensif. Semua saudara dalam file yang sama memakai
`readList` dengan beberapa kandidat kunci:
`getMyShowcase` `readList(..., ["showcase","items"])`, daftar tersimpan
`readList(..., ["data"])`, komentar `readList(..., ["data"])`, likers/savers
`readList(..., ["data"])`. Jika backend mengirim `{data:[...]}` (atau
melewatkan `items`), `res.items === undefined` → daftar pulih diam-diam
KOSONG (merge di management-screen:1002-1009 mempertahankan local yang
kosong). Tidak ada crash, tapi fitur "Pulihkan" tampak mati total.

Fix: parse `items` via `readList(record, ["items","data","showcase"])` —
tetap menerima `items` (kontrak tidak berubah), menambah toleransi bentuk
yang sama dengan seluruh endpoint lain.

### SH-06 — Dok: docblock `sortShowcaseComments` usang
lib/showcase-social.ts (~baris 60-70). Docblock mengklaim "urutan final
dipilih di layar detail karena backend belum memberi param sort" — padahal
sejak BFE-114 (2026-10-03) urutannya dikirim ke server
(`?sort=newest|oldest`, lihat lib/api/showcase.ts listShowcaseComments dan
docblock components/showcase-detail-comments.tsx). Fix: teks komentar saja;
fungsi tidak berubah (tetap dipakai untuk indeks fokus deep-link C14).

---

## TEMUAN (dipertimbangkan, TIDAK diubah — alasannya)

- **Detail fetch badge commerce per mount** (product-commerce-section.tsx
  ProductBadges) — TIDAK bug: keputusan D1-011 tertulis di komentar kode
  "badge kini diserialkan langsung di payload feed — detail tetap memakai
  endpoint /badges". Feed (D1-001) memang sudah tanpa fetch per kartu.
- **Race suka (SHOWCASE_ALREADY_LIKED) me-refetch detail**
  (use-showcase-social-actions.ts runLike) — `getShowcaseDetail` menaikkan
  viewCount (D-08), jadi path langka ini menggelembung hitungan tayang.
  Tidak diubah karena respons 409 saat ini tidak membawa state akhir;
  memperbaikinya butuh perubahan respons backend → sudah didokumentasikan
  di docs/rekomendasi-backend-etalase.md (RK-01).
- **Tab "Untuk Anda"** — personalisasi dilakukan server (sort=foryou);
  keputusan produk 2026-09-28 tertulis di komentar lib/api/showcase.ts.
  Tidak bisa divalidasi dari sisi client; tidak ada bug client.
- **Tab "Populer"** — sort=popular dihitung server (keputusan produk
  2026-10-01: klik+tayang+suka, reset harian); tidak ada bug client.
- **"Mengikuti" difilter client** (FOLLOWING_MIN_ITEMS=5, MAX_PAGES=3, NP-005)
  — disengaja, di-dokumentasikan; commit parsial + empty state "Belum ada
  etalase dari akun yang diikuti" + batas 300 item (FEED_MAX_ITEMS) aman.
- **Katalog i18n usang 1 string** (lib/i18n/catalog.json: "Dana escrow
  diteruskan…" vs source "Dana transaksi diteruskan…") — regenerasi katalog
  masuk commit i18n (`npm run check:i18n` gagal "katalog usang" sebelum fix).
  Tidak ada kata terlarang yang terlihat user (grep seluruh app/components/lib:
  hanya 2 komentar kode di showcase-social.ts).

---

## HASIL AUDIT PER AREA (yang BERSIH)

**1. Tab feed (showcase-feed-tab.tsx + lib/api/showcase.ts)**
Tiga tab benar-benar mengembalikan data berbeda: `sort=foryou|popular|latest`
di-request ke server (NP-007), "Mengikuti" = latest + filter client terhadap
`/v1/users/me/following-ids` (idempotent, 401/403 → tamu). Kursor per tab;
ganti tab/filter membatalkan request berjalan dan mereset kursor. Refresh
menimpa; loadMore menempel (mergeById per id, urutan server dijaga). Posisi
scroll dipulihkan per (tab × filter × sesi) dengan verifikasi anchor
(C02). Feed dibatasi 300 item; "Tampilkan lainnya" membuang sisa buffer.
Loading awal = shimmer (`initialLoading` vs `LoadMore`), error = ErrorState +
ulang. Tidak ada bug.

**2. Kartu produk (showcase-feed-item.tsx + showcase-feed-logic.ts +
showcase-labels.ts + showcase-author-row.tsx)**
Harga: `showcasePriceLabel` benar untuk semua bentuk (rentang "Rp A – Rp B",
min==max harga pasti, max-only "Hingga Rp B", 0 "Gratis", terbalik "Mulai
Rp B"). Foto rusak: `onError` per posisi → placeholder "Gagal memuat" +
`tint={false}` (tanpa ikon di atas foto); gallery detail juga fail-closed.
Badge kondisi BARU/BEKAS selalu dirender; nama penjual + verifikasi KYC +
baris rating fail-closed (n<10 disembunyikan, SH-005); username + kategori +
waktu relatif (formatWhen) selalu ada. Badge commerce TERLARIS/DISKON dari
payload (D1-001, tanpa fetch per kartu). Tidak ada bug.

**3. Detail (showcase-detail-screen.tsx + gallery + sheet komentar)**
- Galeri: `galleryErrors` per indeks, overlay error + "Coba lagi", foto
  rusak gagal-tutup (tidak diklaim loaded), video thumbnail rusak →
  placeholder; double-tap suka hanya menambah (bukan toggle) agar suka tidak
  hilang saat double-tap dalam (F-13).
- Deskripsi terpotong 3 baris + "Lihat selengkapnya/Lipat" — bukan terpotong
  permanen.
- "Beli via Kahade" BUKAN purchase instan: meneruskan ke create-transaction
  dengan prefill (role BUYER, orderType SHOWCASE, fromShowcase=1, counterpart,
  judul, deskripsi, nominal min/tenang) — sesuai desain produk (uang ditahan
  via transaksi; cashback +1 poin hanya dari transaksi). Tombol mati hanya
  jika `priceMax == null` (item tanpa harga) — disengaja, terdokumentasi.
- Info penjual: baris author selalu ada (username, nama, KYC, rating);
  "Lihat profil" → profil publik. Tidak ada empty state kosong.
- Komentar: offset + tiebreak id, paginasi server ?sort (BFE-114), limit
  render C14, deep-link `?comment=` + fokus C14, balas satu tingkat, like
  komentar idempotent, Idempotency-Key per (item × isi), draf komposer per
  item (E-05), mode edit/hapus/hide dengan guard 404/409/410.
- Aksi owner (ubah/hapus/menu laporkan) hanya untuk pemilik; menu laporkan
  publik juga ada.
- Bug yang ditemukan: SH-04 (stale closure hapus), SH-01:10 (tombol "Simpan"
  komentar).

**4. Buat/Ubah (showcase-create-screen.tsx, editor management-screen.tsx,
lib/showcase-upload.ts)**
Unggah: guard tipe/ukuran sebelum mulai, video durasi minimum BFI-107,
thumbnail video fail-closed (tanpa thumbnail = video ditolak, tidak pernah
mengirim frame kosong), chunked upload >8 MB (NP-006), batch cleanup file
gagal, progress per slot, tombol hapus/replace media. Validasi create: per
field + ValidationSummary (C10/T2) — benar. Draft: autosave debounce,
prompt "Lanjutkan draf?" (lanjut/buang), clear saat terbit. Bug yang
ditemukan: SH-02 (race timer draf), SH-01 (toast/hint hardcoded), SH-03
(error editor di field salah).

**5. Interaksi (use-showcase-social-actions.ts + lib/showcase-social.ts +
state store)**
Suka: optimis penuh (flag + count ±1 + snapshot sebelumnya), rollback
persis pada error (C13), antrian toggle (rapid double-tap), 409 race →
normalisasi idempotent + refetch (dengan catatan RK-01), 404/410 → item
tidak ada, count dinormalisasi. Simpan: optimis count + pending, flag
disinkronkan ke state global pasca-respons, sheet tersimpan + kolom tersimpan
selalu di-refresh dari server saat fokus (state server kanonik). Bagi:
URL canonical `https://kahade.id/p/<id>` (kontrak 1 Okt 2026), wa.me,
t.me, twitter intent — semua divalidasi allow-list host (lib/external-url)
sebelum dibuka; clipboard + sistem share sebagai fallback. Tidak ada bug
selain SH-01 (toast).

**6. Hapus/Pulihkan (showcase-deleted.ts + management restore)**
Soft-delete 30 hari: server `daysRemaining` (SS-012) kanonik; localStorage
hanya cache offline (fail-closed, tidak inventori item server lain).
Pulihkan = POST /me/showcase/:id/restore; 404/410 idempotent; setelah masa
30 hari item hilang permanen dari server dan dari cache lokal (purge local
saat daftar server tanpa item itu). Dialog hapus menunjukkan sisa hari
(hariAtActionAt saat mengklik, bukan saat membuka). Tidak ada bug selain
SH-05 (parse respons daftar pulih).

**7. Cari & Filter (search-screen.tsx)**
Ketik cepat aman: `DebouncedSearchField` (debounce internal) + 4
`useApiQuery` dengan AbortController — request lama dibatalkan, tidak ada
race hasil. Riwayat cari optimis + rollback, dibatasi 10, hapus satu/hapus
semua. Filter kategori + harga + kondisi hanya dipakai tab "Untuk Anda"
(disengaja: foryou menerima param filter; popular/following tidak).
Relevansi hasil = tanggung jawab backend (ILIKE judul/deskripsi/kategori/
username) — tidak ada bug client. Tidak ada crash.

**8. Kontrak API**
- Tipe DTO (CreateShowcaseItemDto/UpdateShowcaseItemDto/ShowcaseMediaInput)
  konsisten dengan aturan backend: title ≤100, description ≤500, category
  ≤60, media[] XOR imageFileKeys, video wajib thumbnail, spin360 8–24 frame,
  kondisi BARU|BEKAS, badges TERLARIS|DISKON, visibility default public.
- Parser fail-closed (SH-F-011): whitelist enum, clamp harga non-negatif,
  `imageFileKeys[]` (bukan string), ekscerpt feed tanpa viewCount/updatedAt
  (NP-007) ditangani.
- `docs/api/openapi.json` USANG relatif implementasi (skema respons kosong,
  banyak path baru tidak tercantum) — sudah didokumentasikan sebagai
  RK-02 di docs/rekomendasi-backend-etalase.md. Sumber kebenaran kontrak
  untuk FE saat ini = komentar kode terverifikasi (2026-09/10) + test
  showcase-api-contract.

---

## RENCANA KOMITMEN

1. `fix(etalase): i18n — bungkus 25 string hardcoded + regenerasi katalog`
   (SH-01 + katalog usang; `npm run gen:i18n`).
2. `fix(etalase): cegah autosave draft menulis ulang setelah terbit/buang`
   (SH-02).
3. `fix(etalase): tampilkan error validasi editor di field yang benar` (SH-03).
4. `fix(etalase): detail — deps hapus + parse defensif daftar pulih + dok sort`
   (SH-04 + SH-05 + SH-06).
5. `docs(etalase): rekomendasi backend (spasi kontrak + respons race suka)`
   (RK-01/RK-02).
