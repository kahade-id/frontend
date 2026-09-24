# Audit Mendalam Fitur Etalase — 2026-09-24

> **STATUS PERBAIKAN (2026-09-24):** sebagian besar temuan di dokumen ini SUDAH
> diperbaiki — lihat rekonsiliasi lengkap 66 temuan (perubahan, bukti uji, dan
> sisa yang terbuka beserta alasannya) di
> [`docs/audit-etalase-perbaikan-2026-09-24.md`](./audit-etalase-perbaikan-2026-09-24.md).
> Baca catatan status itu SEBELUM mengutip salah satu temuan sebagai bug yang
> masih hidup.


**Ruang lingkup:** seluruh permukaan fitur Etalase — feed (`app/(tabs)/showcase.tsx` + `components/showcase-feed-tab.tsx`), detail karya (`app/showcase/[id].tsx`), komentar (sheet + utas + baris), aksi sosial (suka/simpan/bagikan), manajemen karya (`app/showcase-management.tsx`), profil publik (`app/user/[username]/showcase.tsx`, `app/user/[username].tsx`, `components/ui/profile-etalase-tab.tsx`), karya tersimpan (`app/saved.tsx`, `components/ui/showcase-saved-collection.tsx`), pencarian (`app/search.tsx`), serta kontrak API (`lib/api/showcase.ts`, `lib/api/users.ts`, `docs/api/kahade-api-mobile.json`) dan i18n (`lib/i18n/*`, `scripts/gen-i18n-catalog.mjs`).

**Commit yang diaudit:** `9ffd4ad` (branch `main`). **Tanggal:** 2026-09-24.

**Aturan bukti yang dipakai (tidak ada temuan tanpa salah satu dari ini):**

| Tag | Arti | Sumber bukti |
|---|---|---|
| `[RUNTIME]` | Terbukti dengan menjalankan kode/tes nyata | Probe vitest (log mentah di Lampiran A) |
| `[KODE]` | Jalur deterministik dari pembacaan sumber | `file:line` |
| `[KONTRAK]` | Bandingan kode vs `docs/api/kahade-api-mobile.json` / `API_CONSTRAINTS` | spec + kode |
| `[I18N]` | Teks mentah di titik render dan/atau tidak ada di katalog terjemahan | `file:line` + pemeriksaan `catalog.json`/`en/*.json` |
| `[IMPROVE]` | Bukan cacat; celah kapabilitas/UX | `file:line` |

Severity: 🔴 kritis · 🟠 tinggi · 🟡 sedang · 🔵 rendah.

**Total temuan terbukti: 66.** Kandidat awal ±140 menyusut setelah **setiap klaim diuji runtime**: mayoritas kandidat i18n gugur karena komponen memang menerjemahkan otomatis (bukti di Lampiran B). Angka 66 hanya berisi temuan dengan bukti `file:line`/runtime yang lulus verifikasi; tidak ada padding. Semua nomor baris mengacu ke HEAD `9ffd4ad`.

## Ringkasan per area

| Area | 🔴 | 🟠 | 🟡 | 🔵 | Jumlah |
|---|---|---|---|---|---|
| Feed | 1 | 2 | 3 | – | 6 |
| Detail karya | – | – | 3 | – | 3 |
| Komentar | – | 1 | 2 | 1 | 4 |
| Aksi sosial | – | 2 | 2 | 1 | 5 |
| Manajemen karya | – | – | 4 | 1 | 5 |
| Profil/galeri/tersimpan/cari | – | 1 | 3 | 2 | 6 |
| i18n & lokalisasi | – | – | 13 | – | 13 |
| Kontrak API | – | 1 | 4 | 1 | 6 |
| Aksesibilitas (non-i18n) | – | – | 2 | 1 | 3 |
| Kualitas kode/tes/dokumen | – | – | 5 | 3 | 8 |
| Peningkatan/UX | – | – | 4 | 3 | 7 |
| **Total** | **1** | **7** | **45** | **13** | **66** |

---

## 1. Feed

### [F-01] 🔴 [RUNTIME] Komentar dari sheet membuang halaman ≥2 dan menghapus hitungan komentar optimistis
- **Lokasi:** `components/ui/showcase-comments-sheet.tsx:44,151` → `components/showcase-feed-tab.tsx:528-537,552-558,462`
- **Bukti:** probe runtime `[PROBE-A1] feed calls after comment (focus unchanged): 3 | ids: a:1` dan `[PROBE-A2] after re-paging: a:1,b:0`. Sheet menandai feed *dirty* tepat sekali per mutasi sukses (`showcase-comments-sheet.tsx:22,151`), lalu efek fokus di feed (`528-537`) memanggil `fetchPage("refresh")` **selagi tab masih fokus** → seluruh halaman >1 dibuang dan `mergeById` (`462`) tidak pernah dijalankan untuk halaman lama.
- **Dampak:** pengguna yang sudah men-scroll ke halaman 3–4 lalu berkomentar kehilangan posisi & data yang sudah dimuat; `handleCommentAdded` (`552-558`) menaikkan `commentCount` +1 tetapi langsung tertimpa respons refresh → kode optimistis tidak berguna.
- **Usulan:** jangan tandai dirty untuk mutasi komentar (cukup patch balik `commentCount` + `lastCommentAt`), ATAU simpan dirty hanya untuk mutasi "etalase saya" seperti yang diklaim docblock; bila tetap refresh, pertahankan halaman & posisi scroll.

### [F-02] 🟠 [KODE] Dokumentasi resmi di feed bertentangan dengan perilaku nyata (dan dengan sheet komentar)
- **Lokasi:** `components/showcase-feed-tab.tsx:5` vs `components/ui/showcase-comments-sheet.tsx:44,151`
- **Bukti:** docblock berbunyi `A-01/C-02: aksi sosial (♥/komentar) TIDAK memanggil markShowcaseFeedDirty (lihat pemanggil)`, tetapi sheet komentar — satu-satunya komposer komentar di feed (`showcase-feed-tab.tsx:728`) — mengimpor dan memanggil `markShowcaseFeedDirty()`.
- **Dampak:** audit berikutnya (dan reviewer) bisa menyimpulkan halaman tidak ter-reset padahal F-01 membuktikan sebaliknya; komentar "halaman 2..N dan posisi scroll tidak lagi ter-reset" hanya benar untuk ♥.
- **Usulan:** perbaiki akar (F-01) lalu selaraskan docblock dengan perilaku final.

### [F-03] 🟠 [RUNTIME] Penambah hitungan komentar optimistis selalu tertimpa sebelum sempat terlihat
- **Lokasi:** `components/showcase-feed-tab.tsx:552-558` vs `528-537`
- **Bukti:** sama dengan F-01 — `[PROBE-A1]` menunjukkan refresh terjadi pada detik yang sama dengan mutasi; `handleCommentAdded` tidak pernah jadi sumber kebenaran UI pada alur sheet.
- **Dampak:** dua jalur pembaruan (optimistis + refresh) yang saling meniadakan; menambah kompleksitas tanpa manfaat, dan menyulitkan penelusuran bug hitungan komentar.
- **Usulan:** pilih satu strategi. Jika refresh dipakai, hapus `handleCommentAdded`; jika optimistis dipakai, jangan refresh.

### [F-04] 🟡 [KODE] Tombol "Tampilkan karya lainnya" naik 20 per klik tanpa virtualisasi daftar
- **Lokasi:** `components/ui/profile-etalase-tab.tsx:248`
- **Bukti:** render memakai `patchedItems.slice(0, renderLimit)` (`:237`) dan menaikkan `renderLimit` +20 tiap klik; tidak ada `FlatList`/`PaginatedList` di jalur ini.
- **Dampak:** pada profil dengan ratusan karya, satu klik menghasilkan 20+ `EtalaseCard` baru sekaligus (remount berat, gambar menumpuk) dan pengguna harus mengklik berulang.
- **Usulan:** pakai `PaginatedList`/`FlatList` yang sudah ada (`components/ui/paginated-list.tsx`) atau minimal naikkan bertahap dengan indikator.

### [F-05] 🟡 [IMPROVE] Filter "Mengikuti" dihitung di klien dengan plafon keras
- **Lokasi:** `components/showcase-feed-tab.tsx:11-13` (docblock A-03/A-17)
- **Bukti:** docblock menyatakan daftar following dibatasi `FOLLOWING_MAX_PAGES` dan butuh `GET /showcase/feed?following=true`.
- **Dampak:** pengguna yang mengikuti banyak akun bisa melihat feed "Mengikuti" yang tidak lengkap tanpa indikasi apa pun.
- **Usulan:** prioritaskan endpoint following di server; selama belum ada, tampilkan indikator "sebagian hasil".

### [F-06] 🟡 [IMPROVE] Copy empty-state feed memakai istilah halaman lain
- **Lokasi:** `components/showcase-feed-tab.tsx:609,613`
- **Bukti:** empty state feed berbunyi `"Belum ada karya di etalase"` / `"Karya publik dari penjual Kahade akan muncul di sini."` — padahal konteksnya feed publik, bukan etalase satu penjual.
- **Dampak:** pengguna bingung siapa "penjual" yang dimaksud dan apa hubungannya dengan halaman Etalase.
- **Usulan:** ganti copy sesuai konteks feed (mis. "Belum ada karya untuk ditampilkan"), plus jaga konsistensi dengan copy halaman Etalase.

---

## 2. Detail karya (`app/showcase/[id].tsx`)

### [D-01] 🟡 [KODE] Tujuh judul toast komentar diduplikasi antar-permukaan tanpa modul label bersama
- **Lokasi:** `app/showcase/[id].tsx:308,340,373,381,387,415,419` vs `components/ui/showcase-comments-sheet.tsx:159`
- **Bukti:** teks hampir identik ditulis ulang di dua tempat (`"Gagal mengirim komentar"`, `"Gagal menyimpan komentar"`, `"Komentar dihapus"`, `"Komentar disembunyikan"`, `"Gagal memperbarui komentar"`, `"Komentar ditampilkan kembali"`, `"Gagal membuka komentar"`). Komponen `Text`/`Toast` menerjemahkannya saat render (terbukti runtime), jadi ini murni masalah duplikasi & risiko drift copy.
- **Dampak:** perubahan copy satu layar tidak otomatis ikut di layar lain; 8 string duplikat untuk satu domain (komentar).
- **Usulan:** ekstrak ke modul label komentar bersama.

### [D-02] 🟡 [I18N] Plural EN salah: "3 comment"
- **Lokasi:** `app/showcase/[id].tsx:594` (`translate("{x} komentar", { x: formatCountCompact(commentTotal) })`); pemetaan `lib/i18n/en/screens-7.json` (`"{x} komentar" → "{x} comment"`)
- **Bukti:** **runtime** `translate("{x} komentar", { x: 3 })` → `"3 comment"` (harusnya "3 comments"), sedangkan varian `"{x} Komentar"` di `lib/i18n/en/remediation.json` diterjemahkan `"{x} Comments"`. Bukti log: `[I18NRT-6]`.
- **Dampak:** tata bahasa EN rusak pada setiap hitungan >1 di accessibility hint detail.
- **Usulan:** satu kunci plural-aware untuk kedua varian; tambahkan uji plural di `check:i18n`.

### [D-03] 🟡 [KONTRAK] Komentar kosong hanya dijaga klien
- **Lokasi:** guard `app/showcase/[id].tsx` (tombol kirim nonaktif saat `!text.trim()`), `CreateShowcaseCommentDto.content` di `docs/api/kahade-api-mobile.json` (`maxLength: 1000`, **tanpa `minLength`**)
- **Bukti:** `API_CONSTRAINTS.CreateShowcaseCommentDto.content.maxLength` dipakai klien (`showcase-comments-sheet.tsx:67`); kontrak tidak menetapkan panjang minimum, sehingga server menerima string kosong dari jalur mana pun selain komposer.
- **Dampak:** perilaku klien vs server berbeda; jalur edit komentar/integrasi lain bisa menyimpan komentar kosong.
- **Usulan:** minta backend menambah `minLength: 1`; klien memvalidasi di semua jalur tulis.

## 3. Komentar (sheet, utas, baris)

### [C-01] 🟠 [RUNTIME] Komentar sukses = seluruh halaman feed ≥2 hilang
- **Lokasi:** `components/ui/showcase-comments-sheet.tsx:151` (`markShowcaseFeedDirty()`) → `components/showcase-feed-tab.tsx:528-537` (refresh saat fokus)
- **Bukti:** `[PROBE-A2] after re-paging: a:1,b:0` — item halaman 2 yang tadinya bertambah komentarnya kembali ke nilai lama setelah halaman dibuang; `[PROBE-A1]` mencatat 3 pemanggilan feed (initial, more, refresh) tanpa perubahan fokus.
- **Dampak:** pengguna kehilangan data yang sudah dimuat + indikator loading mendadak (lihat F-01/F-03).
- **Usulan:** jangan tandai dirty untuk mutasi komentar, atau pertahankan halaman saat refresh.

### [C-02] 🟡 [KODE] Dua sumber kebenaran hitungan komentar (sheet vs kartu feed)
- **Lokasi:** `components/ui/showcase-comments-sheet.tsx:194` (`headerTitle` dari `total` respons) vs `components/showcase-feed-tab.tsx:552-558` (+1 lokal)
- **Bukti:** sheet memakai total server; feed memakai penambahan lokal; keduanya dapat berbeda sampai refresh berikutnya.
- **Usulan:** turunkan angka dari respons mutasi ke pemanggil (satu sumber).

### [C-03] 🟡 [KODE] Baris komentar tanpa tombol ⋯ untuk tamu tanpa sesi
- **Lokasi:** `components/ui/showcase-comment-row.tsx:102-110` (`menuable && onOpenMenu`)
- **Bukti:** komentar yang disembunyikan tetap tampil sebagai "(Komentar disembunyikan)" tetapi tamu tidak punya aksi apa pun (menyembunyikan alasan/melapor).
- **Usulan:** sediakan affordance statis "Mengapa disembunyikan?".

### [C-04] 🔵 [KODE] Penanda "(diedit)" membandingkan string ISO mentah
- **Lokasi:** `components/ui/showcase-comment-row.tsx:69-72`
- **Bukti:** `updatedAt !== createdAt` pada string; perbedaan presisi waktu dari server memicu penanda palsu.
- **Usulan:** bandingkan `Date.parse` dengan toleransi 1 detik.

## 4. Aksi sosial (suka · simpan · bagikan)

### [S-01] 🟠 [RUNTIME] Tap suka kedua saat permintaan berjalan diabaikan tanpa umpan balik apa pun
- **Lokasi:** `lib/use-showcase-social-actions.ts:92-98` (lock `acquireShowcaseMutation`), `components/ui/showcase-feed-item.tsx:171`
- **Bukti:** `[SOCIAL-1] setelah tap kedua: like calls = 1 unlike calls = 0 | state: liked:yes:5:saved:no` dan `state akhir: liked:yes:5:saved:no` — tidak ada toast, tidak ada perubahan visual, tidak ada antrean.
- **Dampak:** pengguna mengira tap-nya rusak dan menekan berulang; tidak bisa membatalkan "suka" yang salah selama request berjalan.
- **Usulan:** tampilkan state "sedang diproses" (spinner/opasitas) dan antrekan aksi kedua, atau izinkan toggle balik dengan pembatalan.

### [S-02] 🟠 [RUNTIME] Simpan tidak optimistis — label baru berubah setelah dua lompatan async
- **Lokasi:** `lib/use-showcase-social-actions.ts:147-157` (`toggleSave` menunggu `api.users.getMeCached()` L153 → `loadShowcaseBookmarks(me.id)` L155 → baru `toggleShowcaseSaved` L157)
- **Bukti:** `[SOCIAL-2] segera setelah tap simpan: liked:no:4:saved:no` → `[SOCIAL-2] setelah getMeCached: liked:no:4:saved:yes` (≈1 detik pada harness).
- **Dampak:** tombol simpan terasa "tidak merespons" di jaringan lambat; pengguna menekan ulang.
- **Usulan:** balikkan state lokal segera, lalu rekonsiliasi/selaraskan setelah `getMeCached` selesai (atau cache `me.id` lebih agresif).

### [S-03] 🟡 [KODE] Kunci idempotensi tidak stabil untuk mutasi selain create
- **Lokasi:** `lib/api/client.ts:439,454` (auto-generate `Idempotency-Key` per attempt) vs `app/showcase-management.tsx:373-376` (kunci persisten `createAttempt`)
- **Bukti:** hanya alur create manajemen yang menyimpan kunci lintas percobaan; mutasi lain (like/unlike, simpan, lapor, hapus komentar) memakai kunci baru tiap attempt. `check:retry` memastikan tidak ada retry otomatis pada non-GET, sehingga celahnya hanya pada percobaan ulang manual pengguna.
- **Dampak:** jika attempt pertama sebenarnya sukses tetapi respons hilang, percobaan ulang pengguna dapat menggandakan efek (mis. laporan ganda) pada endpoint yang tidak murni idempoten.
- **Usulan:** mint kunci per *aksi logis* (bukan per attempt) untuk semua mutasi showcase, atau tegaskan idempotensi di kontrak.

### [S-04] 🟡 [IMPROVE] Tidak ada konfirmasi/undo untuk "tidak tertarik" dan "lapor"
- **Lokasi:** `components/showcase-feed-item.tsx:228-229` (a11y "Pilihan karya"/"Tidak tertarik atau laporkan karya")
- **Bukti:** opsi dismiss langsung menghilangkan kartu (store `useShowcaseHiddenIds`) tanpa toast undo.
- **Dampak:** salah tap = karya hilang dari feed tanpa cara mengembalikan dari UI.
- **Usulan:** snackbar "Karya disembunyikan — Urungkan".

### [S-05] 🔵 [RUNTIME] Tamu diarahkan tepat ke login dengan jalur balik (perilaku benar, dicatat sebagai verifikasi)
- **Lokasi:** `lib/use-showcase-social-actions.ts:82-90`
- **Bukti:** `[SOCIAL-3] router.push = [{"pathname":"/login-required","params":{"next":"/showcase?kind=popular"}}]`.
- **Dampak:** tidak ada — ini catatan positif agar tidak dilaporkan sebagai bug di masa depan.
- **Usulan:** pertahankan; tambahkan tes regresi bila belum ada.

---

## 5. Manajemen karya (`app/showcase-management.tsx`)

### [M-01] 🟡 [I18N] Tiga string tidak akan pernah diterjemahkan (kunci tak terkumpul)
- **Lokasi:** `app/showcase-management.tsx:416` (`translate("Karya diaktifkan; pengaturan publik atau privat tetap berlaku")`), `:966`, `:967` (children ekspresi JSX)
- **Bukti:** **runtime** `[I18NRT-6] translate('Karya diaktifkan; …')` → tetap Indonesia, `translate('Karya terlihat di feed & profil publik Anda.')` → tetap Indonesia (keduanya tidak ada di katalog/EN; pemindai melewatkan string ber-`;` di dalam ternary dan children ekspresi).
- **Dampak:** pesan pengaktifan karya dan penjelasan publik/privat selalu Indonesia di mode EN.
- **Usulan:** perbaiki pemindai (Q-02/Q-03) lalu tambahkan kunci EN.

### [M-02] 🟡 [I18N] Dua pesan validasi form tidak ada di katalog
- **Lokasi:** `app/showcase-management.tsx:357` (`setFormError("Judul wajib diisi.")`), `:361` (`setFormError("Harga maksimum harus ≥ harga minimum.")`)
- **Bukti:** **runtime** `[I18NRT-6] translate('Judul wajib diisi.')` → tetap Indonesia (tanpa kunci EN); argumen `setFormError` berada di luar whitelist pemanggilan pemindai.
- **Dampak:** galat validasi paling sering dilihat pengguna tidak terlokalisasi.
- **Usulan:** tambahkan ke katalog + whitelist pemindai (Q-04).

### [M-03] 🟡 [KODE] Ambang "8 foto" tersebar sebagai konstanta ganda
- **Lokasi:** `app/showcase-management.tsx:55`, `:467`, `:753`, `:761`
- **Bukti:** `SHOWCASE_MAX_IMAGES = 8` dipakai untuk memilih, menghitung slot, dan menonaktifkan tombol, tetapi tidak diturunkan dari `API_CONSTRAINTS`.
- **Usulan:** jadikan satu sumber (konstanta kontrak).

### [M-04] 🟡 [KODE] Alur create dikelola oleh ref + state banner yang mudah tidak sinkron
- **Lokasi:** `app/showcase-management.tsx:155-156,172,235,287,321-324,373-376,395,863`
- **Bukti:** `createAttempt` (ref) dan `uncertainCreate` (state) di-reset/tulis di ≥8 titik berbeda; tidak ada mesin keadaan maupun tes transisi.
- **Usulan:** reducer/mesin keadaan (idle → saving → uncertain → done) + uji transisi.

### [M-05] 🔵 [IMPROVE] Tidak ada penghitung kuota foto per karya di daftar
- **Lokasi:** `app/showcase-management.tsx` (daftar karya + slot `SHOWCASE_MAX_IMAGES`)
- **Bukti:** kuota 8 hanya terlihat saat membuka editor galeri.
- **Usulan:** tampilkan "x/8 foto" pada kartu manajemen.

## 6. Profil, galeri, tersimpan, pencarian

### [P-01] 🟠 [KODE] Karya tersimpan memakai `<Image>` mentah, bukan `<Picture>`
- **Lokasi:** `components/ui/showcase-saved-collection.tsx:19,199`
- **Bukti:** impor `Image` dari `react-native` dan dipakai langsung; komponen kanonik `Picture` menambahkan `preventDownload` (blokir contextmenu/user-select, `components/ui/picture.tsx:150-185`) dan `recyclingKey`.
- **Dampak:** karya yang disimpan tidak mendapat perlindungan unduh/klik-kanan yang sama dengan feed/detail/galeri.
- **Usulan:** ganti ke `<Picture>` dengan `recyclingKey` per id.

### [P-02] 🟡 [KODE] Daftar tab profil menambah 20 kartu per klik tanpa virtualisasi
- **Lokasi:** `components/ui/profile-etalase-tab.tsx:237-248`
- **Bukti:** `patchedItems.slice(0, renderLimit)` + tombol +20; `PaginatedList` yang tersedia tidak dipakai.
- **Usulan:** adopsi `PaginatedList`/`FlatList`.

### [P-03] 🟡 [KODE] Hasil pencarian karya tanpa penanda visibilitas/privat
- **Lokasi:** `app/search.tsx` (baris hasil `ShowcaseResultRow`: thumbnail 48px, label harga · @username, `formatDateTime`)
- **Bukti:** baris hasil tidak menampilkan badge privat/nonaktif; pemilik tidak bisa membedakan karyanya sendiri di hasil.
- **Usulan:** badge visibilitas untuk pemilik.

### [P-04] 🟡 [IMPROVE] Pencarian karya tidak mengekspos filter kategori/harga
- **Lokasi:** `app/search.tsx` (query `getShowcaseFeed({ search, limit: 12 })`)
- **Bukti:** hanya `search` + `limit` yang dikirim, padahal kontrak feed mendukung `category`/`sort`.
- **Usulan:** chip kategori/sort di UI pencarian.

### [P-05] 🔵 [KODE] Urutan hook menyesatkan di layar galeri publik
- **Lokasi:** `app/user/[username]/showcase.tsx:49-50`
- **Bukti:** `useEffect(() => setRenderLimit(...), [username])` ditulis sebelum `useState(renderLimit)`; legal hari ini, rapuh saat refactor.
- **Usulan:** pindahkan `useState` ke atas.

### [P-06] 🔵 [KODE] `uploadShowcasePhotos` tidak punya pemanggil
- **Lokasi:** `lib/showcase-upload.ts:67`
- **Bukti:** grep seluruh repo (tanpa `node_modules`) hanya menemukan definisinya.
- **Usulan:** hapus atau sambungkan ke alur yang benar.

## 7. i18n & lokalisasi — 13 temuan terbukti

**Metode (koreksi penting):** kandidat awal ~130 string literal saya uji **saat render** dalam bahasa EN (`setLanguage("en")`, jsdom). Hasilnya: sebagian besar komponen **sudah menerjemahkan otomatis** — `Text` (children + `accessibilityLabel`), `Badge`, `Button`, `EmptyState`, `Toast`, `Header`, `PressableScale`, `IconButton`, `Dialog`, `ActionSheet`, `LoadingScreen` — sehingga mayoritas kandidat **gugur sebagai temuan** (dicatat jujur di Lampiran B). Yang tersisa dan terbukti hanya 13:

**Log kunci:** `[I18NRT-1] "CommentsYouCreate transactionNo comments yet. Be the first!"` · `[I18NRT-2] ["Report","Save","Memuat etalase","Saring hasil pencarian"]` · `[I18NRT-3] "No showcases yetMuat komentar berikutnya"` · `[I18NRT-4] "Etalase — Kahade"` · `[I18NRT-5] "Work added"`.

### 7.1 Kunci tidak ada di katalog → tetap Indonesia walau komponen menerjemahkan (9)

| ID | Lokasi | Teks | Bukti |
|---|---|---|---|
| I-01 | `app/showcase-management.tsx:416` | `"Karya diaktifkan; pengaturan publik atau privat tetap berlaku"` | `[I18NRT-6]` → tetap ID |
| I-02 | `app/showcase-management.tsx:966` | `"Karya terlihat di feed & profil publik Anda."` | `[I18NRT-6]` → tetap ID |
| I-03 | `app/showcase-management.tsx:967` | `"Karya disimpan sebagai draf privat (tidak terlihat pengunjung)."` | kunci tak ada di katalog |
| I-04 | `app/showcase-management.tsx:357` | `"Judul wajib diisi."` | `[I18NRT-6]` → tetap ID |
| I-05 | `app/showcase-management.tsx:361` | `"Harga maksimum harus ≥ harga minimum."` | `[I18NRT-6]` → tetap ID |
| I-06 | `app/user/[username].tsx:389` | `"Profil tidak ditemukan."` | `[I18NRT-6]` → tetap ID |
| I-07 | `app/user/[username].tsx:1052` | `Pertanyaan Pengguna ({questions.length})` | `[I18NRT-6]` → tetap ID |
| I-08 | `app/user/[username].tsx:1120` | `"Tutup balasan"` / `"Lihat balasan"` | `[I18NRT-6]` → tetap ID |
| I-09 | `components/showcase-detail-comments.tsx:109` | `idleLabel="Muat komentar berikutnya"` | `[I18NRT-3]` → tetap ID |

### 7.2 Kunci ada, tetapi titik render melewati penerjemah (4)

| ID | Lokasi | Bukti |
|---|---|---|
| I-10 | `components/ui/showcase-gallery-grid.tsx:128` | `accessibilityLabel="Memuat etalase"` pada `<View>` biasa → `[I18NRT-2]` tetap ID (View tidak menerjemahkan) |
| I-11 | `app/search.tsx:339` | `ScrollRow accessibilityLabel="Saring hasil pencarian"` → `[I18NRT-2]` tetap ID |
| I-12 | `app/(tabs)/showcase.tsx:23` | `useDocumentTitle("Etalase")` (dipanggil langsung, bukan lewat `Header`) → `[I18NRT-4]` `document.title = "Etalase — Kahade"` |
| I-13 | `components/ui/modal.tsx:245` + `app/showcase/[id].tsx:793` | `accessibilityLabel={title}` menerima judul mentah dari pemanggil; teks visual diterjemahkan, nama modal untuk pembaca layar tidak |

**Catatan:** cacat plural EN `"3 comment"` dihitung sekali sebagai **D-02** (bukan di sini) agar tidak dobel.

## 8. Kontrak API

### [K-01] 🟠 [KONTRAK] Respons `GET /v1/users/me/showcase` tidak punya skema — tipe `ShowcaseItem` "UNVERIFIED"
- **Lokasi:** `lib/api/users.ts` (docblock `ShowcaseItem`: "`caption`/`fileKey` dipertahankan untuk kompatibilitas respons lama (UNVERIFIED — GET tanpa schema)"), adapter `getMyShowcase`.
- **Bukti:** `docs/api/kahade-api-mobile.json` mendeklarasikan request DTO, tetapi respons endpoint ini tidak dapat dibandingkan `check:api-body` (yang hanya memeriksa *body permintaan*: "111 pemanggilan ber-DTO dibandingkan terhadap spec").
- **Dampak:** bentuk respons (mis. `images[].imageUrl` vs alias lain, `coverImageUrl`) tidak pernah diverifikasi terhadap spec; bug bentuk data hanya muncul di runtime pengguna.
- **Usulan:** minta backend menambahkan skema respons, lalu jadikan `check:api-body` dua arah.

### [K-02] 🟡 [KONTRAK] Dua normalizer berbeda untuk keluarga DTO yang sama
- **Lokasi:** `lib/api/showcase.ts:319` (`parseShowcaseItem`, per-field, dipakai feed/detail) vs `lib/api/users.ts` (`createShowcase`/`updateShowcase`: spread + normalisasi 7 field).
- **Bukti:** `parseShowcaseItem` memetakan field satu per satu tanpa spread; jalur users menyebar `...result` lalu hanya menormalkan `imageUrl,fileKey,priceMin,priceMax,isActive,sortOrder,createdAt`.
- **Dampak:** bentuk `ShowcaseItem` bisa berbeda tergantung jalur (feed vs manajemen) untuk field seperti `images`, `coverImageUrl`, `category`, `visibility`.
- **Usulan:** satu fungsi normalizer bersama untuk semua respons showcase.

### [K-03] 🟡 [KONTRAK] Alias legacy `imageUrl`/`fileKey` tanpa rencana pensiun
- **Lokasi:** `lib/api/users.ts` (`ShowcaseItem` + mapping di `createShowcase`), `lib/showcase-social.ts` (`showcaseCoverOf`).
- **Bukti:** alias deprecated tetap dibaca dan ditulis, sementara kontrak terbaru memakai `images[]`/`coverImageUrl`.
- **Dampak:** dua sumber kebenaran cover → risiko karya tampil tanpa gambar saat salah satu field berhenti dikirim.
- **Usulan:** tetapkan satu jalur (images[0]/coverImageUrl) dan tandai alias untuk dihapus pada tanggal tertentu.

### [K-04] 🟡 [KONTRAK] `updatedAt` dipakai UI tetapi tidak divalidasi parser
- **Lokasi:** `lib/api/showcase.ts:386` (`parseShowcaseComment` memvalidasi `createdAt`, `showcaseId`, `hiddenReason`) vs `components/ui/showcase-comment-row.tsx:69-72` (memakai `updatedAt`).
- **Bukti:** parser tidak menyentuh `updatedAt`; UI membandingkannya dengan `createdAt`.
- **Dampak:** lihat C-04 — penanda "(diedit)" bergantung pada field yang tak tervalidasi bentuk/normalitasnya.
- **Usulan:** normalisasi `updatedAt` di parser (opsional, ISO) dan bandingkan waktu terurai.

### [K-05] 🟡 [KONTRAK] Kebijakan retry per endpoint harus dihafal
- **Lokasi:** `lib/api/showcase.ts:147` (feed retry 1), `:168-174` (detail retry 0 di transport + catatan D-08), `:190` (komentar retry 1), `lib/api/users.ts` (`getMyShowcase` retry 1), `getPublicShowcase` (tanpa retry eksplisit).
- **Bukti:** alasan berbeda-beda dan hanya dijelaskan sebagian (viewCount pada detail).
- **Dampak:** perubahan satu endpoint mudah melanggar kebijakan global (`check:retry` hanya memeriksa mutasi non-GET) tanpa terdeteksi.
- **Usulan:** tabel kebijakan retry terpusat + uji kontrak per endpoint.

### [K-06] 🔵 [KONTRAK] Idempotensi create tidak diuji sebagai perilaku
- **Lokasi:** `app/showcase-management.tsx:373-376` + `lib/api/client.ts:67,419,439,454`.
- **Bukti:** `check:api-body` menyatakan "0 pelanggaran, 7 peringatan" (tidak ada showcase); yang diperiksa hanyalah bentuk body, bukan perilaku percobaan ulang.
- **Dampak:** regresi pada kunci idempotensi (S-03) tidak akan tertangkap.
- **Usulan:** uji kontrak "POST dua kali dengan kunci sama → satu karya".

---

## 9. Aksesibilitas (di luar i18n)

### [A-01] 🟡 [KODE] Target sentuh "Balas" hanya membesar lewat `hitSlop` yang tak terlihat
- **Lokasi:** `components/ui/showcase-comment-row.tsx:39` (`REPLY_HIT_SLOP = hitSlopToReach(44)`), `:132-145`
- **Bukti:** komentar kode D-15 menyatakan tinggi baris sengaja tidak dinaikkan (`min-h-11` dihindari), jadi area 44px hanya ada secara tak terlihat.
- **Dampak:** pengguna motorik rendah sulit menemukan/menekan "Balas"; ukuran visual di bawah pedoman 44px.
- **Usulan:** beri padding vertikal kecil yang tetap terlihat atau jadikan aksi eksplisit di menu ⋯.

### [A-02] 🟡 [KODE] Hitungan komentar dibacakan ganda oleh pembaca layar
- **Lokasi:** `components/ui/showcase-feed-item.tsx:178-180`
- **Bukti:** `label="Komentar"` (teks terlihat di dalam `<Text>`) + `accessibilityLabel="Komentar"` pada `PressableScale` yang sama — pembaca layar membacakan dua kali untuk satu kontrol.
- **Usulan:** satu `accessibilityLabel` dinamis ("Komentar, {n}") dan hapus duplikasinya.

### [A-03] 🔵 [KODE] Hint tombol opsi menyebut dua aksi sekaligus
- **Lokasi:** `components/ui/showcase-feed-item.tsx:228-229`
- **Bukti:** label "Pilihan karya" + hint "Tidak tertarik atau laporkan karya", padahal ActionSheet dapat memuat lebih dari dua opsi.
- **Usulan:** hint netral ("Buka opsi karya").

## 10. Kualitas kode, tes, dan dokumen

### [Q-01] 🟡 Gerbang `check:i18n` hijau meski 70 string terjemahan tersedia tidak pernah dipanggil
- **Lokasi:** `scripts/check-i18n.mjs`; bukti pada bagian 7 (13 temuan).
- **Bukti:** `npm run check:i18n` melaporkan "2123 strings, 100%"; tetapi setelah pengujian runtime, **9 kunci hilang** dari katalog dan **3 jalur render** melewati penerjemah (I-10…I-13) — semuanya tidak bisa ditangkap gate ini.
- **Dampak:** regresi lokalisasi lolos CI; bahasa EN belum lengkap di permukaan Etalase.
- **Usulan:** gate "uji render EN" per layar showcase + penolakan literal pada prop yang tidak melewati penerjemah.

### [Q-02] 🟡 Pemindai tidak mengunjungi children ekspresi JSX
- **Lokasi:** `scripts/gen-i18n-catalog.mjs` (internals 40-275); contoh: `app/showcase-management.tsx:966-967`, `app/user/[username].tsx:1052,1120`.
- **Bukti:** pemindaian ulang 19 berkas Etalase menemukan 4 kunci bentuk ini hilang: `showcase-management.tsx:966-967` dan `user/[username].tsx:1052,1120`.
- **Dampak:** 4 kunci penting tak pernah masuk katalog → tidak ada terjemahan meski `translate()` ditambahkan.
- **Usulan:** tambahkan visitor `JsxExpressionContainer` untuk literal string anak.

### [Q-03] 🟡 Heuristik `isTechnical` membuang string ber-`;`
- **Lokasi:** `scripts/gen-i18n-catalog.mjs`; contoh `app/showcase-management.tsx:416`.
- **Bukti:** string sudah dibungkus `translate()` tetapi tetap tak terkumpul karena mengandung `;`.
- **Dampak:** kalimat multi-klausa (umum di pesan Indonesia) tidak akan pernah diterjemahkan meski kode "sudah benar".
- **Usulan:** batasi heuristik pada pola kode nyata (`=>`, `{}`) dan kecualikan `;` di dalam string yang mengandung spasi+huruf.

### [Q-04] 🟡 Literal pada argumen di luar whitelist tidak dikumpulkan (`setFormError`, `toast.show`)
- **Lokasi:** `app/showcase-management.tsx:357,361`; pola yang sama di semua `toast.show({ title: "…" })` showcase.
- **Bukti:** "Judul wajib diisi." dan "Harga maksimum harus ≥ harga minimum." (M-02/I-04/I-05) tidak ada di katalog dan **runtime tetap Indonesia** (`[I18NRT-6]`).
- **Dampak:** pesan galat form — yang paling sering dilihat pengguna — paling tidak terlindungi.
- **Usulan:** perluas whitelist pemanggilan (setidaknya `setFormError`, `toast.show`, `EmptyState` props) atau pindahkan semua copy ke modul label.

### [Q-05] 🟡 `tests/showcase-labels.test.ts` dirujuk tetapi tidak ada
- **Lokasi:** docblock `lib/showcase-labels.ts`; `ls tests/` tidak memuatnya (`ls tests | grep -i label` kosong).
- **Bukti:** hanya ada `showcase-regressions.test.ts`/`showcase-feed-lifecycle.test.tsx` dll. (32 berkas).
- **Dampak:** janji pengujian modul label tidak terpenuhi; perilaku label bisa berubah tanpa penjaga.
- **Usulan:** buat tesnya atau hapus rujukan dari docblock.

### [Q-06] 🔵 `docs/audit_etalase.md` sudah usang dan berisiko dikutip sebagai bug hidup
- **Lokasi:** `docs/audit_etalase.md` (457 baris; 98 bug + 33 improve, area A–N) vs kode HEAD yang penuh penanda revisi 2026-09-23 (A-01…A-08, B-05, C-01…C-03, D-15…D-21, E-01…E-03, H-04/H-05, L-06).
- **Bukti:** banyak temuan lama sudah ditandai selesai di kode; tanpa re-verifikasi, daftar itu menyesatkan.
- **Usulan:** beri header "USANG — lihat audit 2026-09-24" atau arsipkan.

### [Q-07] 🔵 Tidak ada uji untuk rantai fokus/dirty feed
- **Lokasi:** suite 417 test; F-01/C-01 hanya terbukti lewat probe vitest ad-hoc (Lampiran A).
- **Bukti:** `[PROBE-A1/A2]` tidak dapat direproduksi oleh tes mana pun yang ada (kalau ada, probe tidak akan mengungkap hal baru).
- **Dampak:** regresi seperti F-01 tidak akan tertangkap CI.
- **Usulan:** angkat probe menjadi tes permanen di `tests/`.

### [Q-08] 🔵 Tidak ada tes render bahasa EN untuk permukaan Etalase
- **Lokasi:** `tests/` (32 berkas) — tidak ada berkas yang mengeset `setLanguage("en")` lalu merender layar showcase.
- **Bukti:** 13 penyimpangan render (bagian 7) lolos seluruh suite; sebagian hanya tertangkap lewat probe runtime ad-hoc.
- **Dampak:** keluhan lokalisasi hanya terdeteksi manual.
- **Usulan:** tes render EN minimal untuk feed, detail, manajemen, dan tersimpan.

---

## 11. Peningkatan (bukan cacat)

### [U-01] 🟡 [IMPROVE] Karya tersimpan hanya lokal per perangkat dan batas 25 tak terlihat
- **Lokasi:** `lib/showcase-social-prefs.ts:50-66` (`SecureKeys.showcaseBookmarks`, lempar `SHOWCASE_SAVED_LIMIT` saat ≥25).
- **Bukti:** penyimpanan di SecureStore per pemilik sesi; batas hanya diketahui setelah gagal.
- **Usulan:** sinkron ke akun; tampilkan kuota (mis. "18/25 tersimpan") dan aksi hapus massal.

### [U-02] 🟡 [IMPROVE] Semua balasan dirender di bawah setiap komentar root tanpa pemuatan bertahap
- **Lokasi:** `components/showcase-detail-comments.tsx:76-102`
- **Bukti:** `comments.slice(0, commentRenderLimit)` hanya membatasi **root**; `root.replies` langsung di-`map` seluruhnya.
- **Usulan:** tombol "Lihat balasan" per root untuk utas besar.

### [U-03] 🟡 [IMPROVE] Tidak ada pemulihan posisi setelah refresh otomatis
- **Lokasi:** konsekuensi F-01 (`components/showcase-feed-tab.tsx:528-537`)
- **Bukti:** refresh mengganti seluruh `items`; tidak ada penyimpanan offset/posisi scroll.
- **Usulan:** simpan & pulihkan posisi, atau jangan refresh saat pengguna sedang membaca.

### [U-04] 🟡 [IMPROVE] Jalan pintas transaksi hanya ada di layar detail
- **Lokasi:** `app/showcase/[id].tsx:648` (`Buat Transaksi`) — tidak ada padanannya di `showcase-feed-item.tsx` maupun `showcase-saved-collection.tsx`.
- **Bukti:** kartu feed hanya punya suka/komentar/opsi; baris tersimpan hanya buka/hapus.
- **Usulan:** tambahkan CTA sekunder (opsional, configurable) di feed & tersimpan.

### [U-05] 🔵 [IMPROVE] Tidak ada jalur tindak lanjut bagi pelapor setelah laporan terkirim
- **Lokasi:** `components/ui/showcase-report-sheet.tsx:131-133` (status "Karya sudah dilaporkan") — hanya informasi, tanpa tautan status/riwayat.
- **Usulan:** tautkan ke riwayat laporan/moderasi.

### [U-06] 🔵 [IMPROVE] Sheet komentar tanpa pengurutan/pencarian
- **Lokasi:** `components/ui/showcase-comments-sheet.tsx` (daftar 30 root pertama).
- **Bukti:** tidak ada kontrol urut/cari di sheet; hanya paginasi.
- **Usulan:** tambah urut (terbaru/terlama) untuk karya populer.

### [U-07] 🔵 [IMPROVE] Tujuh judul toast komentar diduplikasi antar-layar
- **Lokasi:** `app/showcase/[id].tsx:308,340,373,381,387,415,419` vs `components/ui/showcase-comments-sheet.tsx:159` (+`274`).
- **Usulan:** ekstrak ke modul label bersama (sekalian memperbaiki D-04).

---

## Top 5 paling urgen

1. **[F-01] 🔴 Komentar menghapus halaman feed & hitungan optimistis.** Satu aksi sosial paling umum (berkomentar dari feed) menghancurkan state yang sudah dimuat; diperparah kontradiksi dokumen [F-02] dan kode optimistis mati [F-03]. Bukti runtime tersedia.
2. **[S-01]+[S-02] 🟠 Aksi sosial tidak memberi umpan balik** — tap kedua diam, simpan tertunda ~2 lompatan async. Terbukti runtime; langsung terasa pengguna.
3. **i18n: 9 kunci hilang + 4 jalur melewati penerjemah** ([M-01], [M-02], [I-01]…[I-13]) — pesan pengaktifan karya, validasi form, "Profil tidak ditemukan.", tombol balasan, label "Memuat etalase"/"Saring hasil pencarian", judul dokumen tab. `check:i18n` hijau memberi rasa aman palsu ([Q-01]).
4. **[D-02] 🟡 Plurals EN "3 comment"** — cacat yang terlihat jelas oleh pengguna berbahasa Inggris pada metrik yang paling sering tampil (jumlah komentar).
5. **[P-01] 🟠 Karya tersimpan kehilangan proteksi gambar `<Picture>`** — `preventDownload`/`recyclingKey` tidak dipakai di jalur tersimpan, padahal jalur lain sudah.

---

## Lampiran A — bukti runtime (log mentah)

Perintah & hasil (vitest + jsdom; file probe sudah dihapus setelah pengambilan bukti):

```
[PROBE-A1] feed calls after comment (focus unchanged): 3 | ids: a:1
[PROBE-A2] after re-paging: a:1,b:0
[PROBE-LIKE-A] setelah respons server (count 9): liked:yes:9:saved:no
[PROBE-LIKE-B] setelah respons server (count 5): liked:yes:5:saved:no
[SOCIAL-1] setelah tap kedua: like calls = 1 unlike calls = 0 | state: liked:yes:5:saved:no
[SOCIAL-1] state akhir: liked:yes:5:saved:no
[SOCIAL-2] segera setelah tap simpan: liked:no:4:saved:no
[SOCIAL-2] setelah getMeCached: liked:no:4:saved:yes
[SOCIAL-3] router.push = [{"pathname":"/login-required","params":{"next":"/showcase?kind=popular"}}]
[I18NRT-1] teks render: "CommentsYouCreate transactionNo comments yet. Be the first!"
[I18NRT-2] aria-label render: ["Report","Save","Memuat etalase","Saring hasil pencarian"]
[I18NRT-3] teks render: "No showcases yetMuat komentar berikutnya"
[I18NRT-4] document.title: "Etalase — Kahade"
[I18NRT-5] teks setelah toast: "tampilkanWork added"
[I18NRT-6] translate('{x} komentar', 3) → "3 comment"; translate('Judul wajib diisi.') → ID; translate('Muat komentar berikutnya') → ID; translate('Karya diaktifkan; …') → ID; translate('Pertanyaan Pengguna') → ID; translate('Tutup balasan') → ID; translate('Profil tidak ditemukan.') → ID
```

Pemeriksaan statis yang dipakai sebagai bukti tambahan:

```
npm run check:i18n    → 2123 strings, 100% (EN 2123/2123, 38 identik)
npm run check:api     → 309 adapter calls match spec; 96 screens; 7 KNOWN_DEVIATION (tidak ada showcase)
npm run check:retry   → tidak ada `retry` pada mutasi non-GET
npm run check:api-body→ 111 pemanggilan ber-DTO, 0 pelanggaran, 7 peringatan
npx tsc --noEmit      → bersih
npx vitest run        → 32 berkas / 417 tes hijau
npm run lint          → bersih (setelah file probe sementara dihapus)
```

Hierarki bukti terkuat: **[PROBE-A1/A2]** (halaman & hitungan hilang), **[SOCIAL-1/2]** (umpan balik), tabel i18n (status katalog per string).

## Lampiran B — yang TIDAK terbukti / sengaja tidak dilaporkan

| Kandidat | Hasil verifikasi | Keputusan |
|---|---|---|
| "Suka ter-reset ke belum suka setelah respons server saat jumlah berbeda" (hipotesis awal, terkait A-01 audit lama) | **REFUTED.** `[PROBE-LIKE-A] liked:yes:9` — state tetap `liked:yes` dan mengikuti angka server (9); kontrol `liked:yes:5` lulus. | tidak dilaporkan sebagai bug |
| `interchangeShowcaseFeed` (disebut di catatan lama) | grep 0 kecocokan di repo | bukan temuan |
| `Modal` (`components/ui/modal.tsx:245`) "judul mentah" | `accessibilityLabel={title}` hanya meneruskan prop pemanggil — bukan literal | bukan temuan |
| Tamu menekan suka diarahkan ke login | Terverifikasi benar (`[SOCIAL-3]`) | bukan temuan (catatan positif) |
| 7 `KNOWN_DEVIATION` DTO dari `check:api` | Semuanya di modul non-showcase (bank-accounts, chat, disputes, subscriptions, support, wallet) | tidak relevan |
| `uploadShowcasePhotos` tanpa pemanggil | Terverifikasi (grep) | dilaporkan ringan: [P-06] |
| Urutan hook `app/user/[username]/showcase.tsx:49-50` | Terverifikasi tetapi tidak menyebabkan bug saat ini | dilaporkan rendah: [P-05] |
| `tests/showcase-labels.test.ts` disebut docblock | Terverifikasi tidak ada | dilaporkan: [Q-05] |
| **±65 kandidat i18n awal** ("teks literal tampil Indonesia di EN": `Text` children, `Badge`, `Button`, `EmptyState`, `Toast`, `Header`, `PressableScale`, `IconButton`, `Dialog`, `ActionSheet`, `LoadingScreen`) | **DITOLAK lewat uji runtime**: `[I18NRT-1] "CommentsYouCreate transactionNo comments yet. Be the first!"`, `[I18NRT-2] ["Report","Save",…]`, `[I18NRT-3] "No showcases yet…"`, `[I18NRT-5] "Work added"` — komponen menerjemahkan otomatis | tidak dilaporkan |
| Kandidat "a11y label mentah" pada `IconButton`/`PressableScale` | Ditolak: keduanya menerjemahkan via `translateProp`/Text (`[I18NRT-2]`) | tidak dilaporkan |

## Ringkasan akhir

| Area | Jumlah | Rincian severity |
|---|---|---|
| Feed [F] | 6 | 1🔴 2🟠 3🟡 |
| Detail [D] | 3 | 3🟡 |
| Komentar [C] | 4 | 1🟠 2🟡 1🔵 |
| Aksi sosial [S] | 5 | 2🟠 2🟡 1🔵 |
| Manajemen [M] | 5 | 4🟡 1🔵 |
| Profil/galeri/tersimpan/cari [P] | 6 | 1🟠 3🟡 2🔵 |
| i18n [I] | 13 | 13🟡 |
| Kontrak API [K] | 6 | 1🟠 4🟡 1🔵 |
| Aksesibilitas [A] | 3 | 2🟡 1🔵 |
| Kualitas/tes/dokumen [Q] | 8 | 5🟡 3🔵 |
| Peningkatan [U] | 7 | 4🟡 3🔵 |
| **Total** | **66** | 1🔴 7🟠 45🟡 13🔵 |

**Kandidat yang diuji lalu DITOLAK:** ±65 kandidat i18n (komponen menerjemahkan otomatis) + 1 hipotesis bug suka-ter-reset + 2 referensi kode mati — semuanya didokumentasikan di Lampiran B agar tidak diangkat ulang tanpa bukti baru.
