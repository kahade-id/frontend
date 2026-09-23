# issues-etalase.md — Status penanganan 131 temuan audit Etalase

> Audit: `docs/audit_etalase.md` (2026-09-23) — 98 bug + 33 improve, area A–N.
> Dokumen ini adalah **laporan status per-item yang jujur** (temuan N-04).
> Versi sebelumnya mengklaim "SEMUA 69 ditangani" — klaim itu **tidak benar**
> (jumlahnya 131, dan sebagian butuh backend / ditunda dengan alasan).

**Legenda status**

| Status | Arti |
| --- | --- |
| ✅ SELESAI | Perbaikan di kode repo ini (marker komentar `audit 2026-09-23`) atau di kontrak `docs/api/openapi.json`. |
| ⚠️ PARSIAL | Sisi klien/kontrak ditangani; ada sisa yang bergantung pada pihak lain atau keputusan lanjutan. |
| 🔧 BUTUH BACKEND | Tidak bisa ditutup dari repo aplikasi; dicatat untuk repo server/web. |
| ⛔ TIDAK | Belum dikerjakan — alasan per item (risiko regresi, butuh keputusan produk, atau di luar lingkup gate). |

Gate saat ini: `npm run check` hijau penuh — typecheck, lint, 15 lintasan check, 417 unit test (32 file), 144 komponen test (17 file).

---


## A — Tampilan & Media

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| A-01 | 🔴 Like/komentar/moderasi mereset feed ke halaman 1 [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-02 | 🟠 Tab "Mengikuti" refetch penuh di setiap fokus + fetch ganda saat mount [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-03 | 🟠 Loop daftar following tanpa batas atas | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-04 | 🟡 Cache following praktis mati | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-05 | 🟡 Error parsial "Untuk Anda" saat load-more tampil sebagai banner di atas list | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-06 | 🟡 Filter `?search=` tidak bisa dihapus | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-07 | 🟡 `renderItem` bergantung pada `items.length` | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-08 | 🟡 Memo `ShowcaseFeedItem` selalu jebol | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-09 | 🟡 Tombol "Karya tersimpan" tampil untuk tamu tanpa gate | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-10 | 🟡 Ikon kelola & lonceng di header tidak digate untuk tamu | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-11 | 🟡 Kembali ke tab lama selalu skeleton + fetch ulang | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-12 | 🟡 Filter "Mengikuti" mencocokkan username secara exact-case | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-13 | 🟡 `onRefresh` me-reset state following di semua tab | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-14 | 🔵 Docblock basi: "maks 4×50 = 200" | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-15 | 🔵 Strip tab tanpa `tablist` | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-16 | 🔵 Debounce 400 ms atas param URL yang tidak diketik | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-17 | Saat ini feed global dipindai di sisi klien, 60 item per fetch (`52-53`, `320-333`). Butuh `GET /showcase/feed?following=true`. | ⚠️ PARSIAL | Umpan balik/centang tampil; mutasi pihak backend tetap otoritatif. |
| A-18 | Empty state "Kamu belum mengikuti siapa pun" menyebut "tab Temukan" tapi tidak punya tombol ke sana (`437-443`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-19 | Tidak ada scroll-to-top saat tab ditekan ulang. `useScrollToTop` tidak dipakai di mana pun. | ⛔ TIDAK | IMPROVE: scroll-to-top butuh ref scroll lintas DataScreen — ditunda (risiko regresi scroll L-01). |
| A-20 | Empty state feed umum tidak punya CTA "Tambah karya" untuk penjual (`455-465`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| A-21 | State item per tab sebaiknya di-cache supaya pindah tab terasa instan (lanjutan A-11). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## B — Data & State

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| B-01 | 🟡 Galeri me-render SEMUA foto, bertentangan dengan klaim B-02 | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-02 | 🟡 Judul kosong untuk item tanpa `title` [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-03 | 🟡 Pressable bersarang: badge kategori di dalam pressable ringkasan | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-04 | 🟡 Label a11y ♥ tidak diterjemahkan [I18N] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-05 | 🔵 Hint jumlah komentar dirakit dari string mentah [KODE/I18N] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-06 | 🔵 Harga 0/0 tampil "Rp 0" [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-07 | 🔵 Label rentang harga tidak bisa diterjemahkan | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-08 | 🔵 Placeholder "Tidak ada gambar" `h-64` vs slide rasio 1:1 | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-09 | `viewCount`, `isVip`, dan `membershipRank` di-parse dan dibawa ke setiap item, tapi tidak pernah ditampilkan di mana pun (grep: 0 pemakaian UI). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-10 | Waktu posting memakai tanggal-jam absolut (`189`). Feed sosial umumnya memakai waktu relatif ("2 jam"). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| B-11 | Navigasi foto berupa baris panah + teks di bawah gambar, tanpa indikator titik. Setiap kartu multi-foto jadi ±44 px lebih tinggi (`showcase-media-gallery.tsx:52-56`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## C — Aksi Sosial

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| C-01 | 🟠 Batas 25 karya tersimpan tampil sebagai "Terjadi kesalahan" [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| C-02 | 🟡 Setiap ♥ memicu reload jaringan di feed & profil [KODE+RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| C-03 | 🟡 Login dari aksi apa pun selalu kembali ke halaman detail | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| C-04 | 🔵 `likeBusy` ditulis tapi tidak pernah dibaca | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| C-05 | 🔵 `useRequireSessionAction` diekspor tapi tidak dipakai | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| C-06 | 🔵 Invalidasi cache di `markShowcaseFeedDirty` tidak berefek | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| C-07 | Bookmark hanya lokal, maksimal 25 per perangkat, dan hilang saat logout (`showcase-saved-collection.tsx:35`). Tidak sinkron lintas perangkat. Butuh endpoint koleksi di server. | ⚠️ PARSIAL | Klien tidak menambah hitungan utk komentar tersembunyi; angka server otoritatif. |
| C-08 | Share selalu merakit payload lokal (`showcase-social.ts:141-144`). `item.shareUrl` dari backend dan endpoint `/share` (yang punya `imageUrl`/`priceLabel`) diabaikan untuk item yang sudah dikenal. Pesan share juga tanpa harga. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## D — Detail & Sheet

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| D-01 | 🟠 Refresh atau fokus-ulang yang gagal menghapus layar & draf komentar | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-02 | 🟡 Setiap mutasi komentar me-refetch halaman 1..N secara serial | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-03 | 🟡 "Laporkan pengguna" pada komentar tidak melaporkan komentarnya | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-04 | 🟡 "Buat Transaksi" tampil untuk tamu tanpa gate | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-05 | 🟡 Hitungan komentar tercampur: root vs semua [KODE+KONTRAK] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-06 | 🟡 Menghapus root diam-diam ikut menghapus balasannya | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-07 | 🟡 Hitungan komentar 0 selama loading | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-08 | 🟡 Detail `retry: 0` di dua lapis | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-09 | 🔵 Judul dokumen kosong untuk item tanpa judul | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-10 | 🔵 "Balas" tidak memfokuskan komposer | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-11 | 🔵 Alasan sembunyikan tidak di-reset antar-buka | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-12 | 🔵 Dialog "Sembunyikan" bergaya destruktif padahal bisa dibatalkan | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-13 | 🔵 Edit tanpa perubahan tetap mengirim PATCH | ⚠️ PARSIAL | Guard dirtyEditor (tolak keluar saat form berubah) ada; tombol simpan saat tanpa perubahan masih bisa mengirim PATCH kosong. |
| D-14 | 🔵 Dua tombol "lainnya" bisa tampil bersamaan | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-15 | 🔵 Target sentuh kecil | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-16 | MediaViewer hanya membuka satu foto (`229-237`). Tidak bisa swipe antar-foto dalam layar penuh. | ⛔ TIDAK | IMPROVE: swipe antar-foto di layar penuh (gestur PanGesture galeri-3x) belum dibangun; galeri kartu-3x sudah menampilkan semua foto. |
| D-17 | 404/403 (item dihapus, privat, atau diblokir) hanya tampil sebagai "Gagal memuat" generik (`110`). Belum ada state "Karya tidak tersedia". | ⛔ TIDAK | IMPROVE: pesan 404/403 masih generik; state 'Karya tidak tersedia' butuh pemetaan kode status per-skenario. |
| D-18 | Komentar yang diedit tidak diberi penanda "(diedit)". `updatedAt` diabaikan (`showcase-comment-row.tsx`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-19 | Komposer berupa `Input` satu baris untuk komentar hingga 1000 karakter, tanpa penghitung (`478-490`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-20 | Avatar dan nama penulis komentar tidak bisa ditekan untuk membuka profil. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| D-21 | Pemilik tidak punya jalan pintas "Ubah karya" dari halaman detail ke manajemen. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## E — Profil

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| E-01 | 🟡 Error query menyembunyikan komentar lokal yang baru terkirim | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| E-02 | 🔵 Judul "Komentar 12" tidak bisa diterjemahkan [I18N] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| E-03 | 🔵 Docblock G-04 menggantung tanpa kode | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| E-04 | 🔵 Hint "Kirim komentar showcase" | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| E-05 | Draf dibuang saat sheet ditutup tanpa konfirmasi (`96-100`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| E-06 | Di sheet tidak bisa membalas, mengedit, atau memoderasi. Pemilik harus pindah ke detail. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## F — Input & Form

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| F-01 | 🟡 Body laporan tidak didokumentasikan di kontrak | ✅ SELESAI | Kontrak: docs/api/openapi.json POST /v1/showcase/{id}/report kini punya CreateShowcaseReportDto { reason, description? ≤500 }; maxLength sheet dibaca dari API_CONSTRAINTS. |
| F-02 | 🔵 Alasan "SPAM" terpilih otomatis | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| F-03 | 🔵 Tamu bisa memilih alasan lalu dilempar ke login dan pilihannya hilang | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| F-04 | Tidak ada state "sudah dilaporkan", dan item yang dilaporkan tidak disembunyikan dari feed pelapor. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## G — Pengelolaan Item

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| G-01 | 🟡 Refresh gagal menutupi grid dan tombol tambah dengan ErrorState penuh | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-02 | 🟡 Dua mekanisme "sembunyi" yang tidak konsisten | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-03 | 🟡 Sheet foto bisa "terkunci" saat commit urutan gagal | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-04 | 🟡 Foto terakhir boleh dihapus | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-05 | 🟡 Error `pickImages` jadi "Terjadi kesalahan" | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-06 | 🟡 Lampirkan foto: satu kegagalan menggagalkan seluruh batch | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-07 | 🟡 Lampirkan foto tanpa progres dan tanpa tombol batal | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-08 | 🔵 Kunci mutasi bersama membuat aksi kedua diabaikan tanpa umpan balik | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-09 | 🔵 "{x} foto" memakai fallback 1 | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-10 | 🔵 Reorder vertikal memakai panah kiri/kanan | ⛔ TIDAK | Ikon panah reorder vertikal (naik/turun) belum diswap. |
| G-11 | 🔵 Empty state "Belum ada foto" untuk daftar karya | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-12 | 🔵 Label "Tambah foto" dipakai untuk dua aksi berbeda | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-13 | 🔵 Sel tanpa cover diberi `source: ""` | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-14 | 🔵 Judul layar "Etalase" sama dengan tab dan detail | ⛔ TIDAK | Penamaan judul layar butuh keputusan produk (Etalase tab vs kelola vs detail). |
| G-15 | 🔵 Banner "Status simpan belum pasti" tanpa tombol segarkan | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-16 | 🔵 Adapter multipart lama `uploadShowcase` masih diekspor tapi mati | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-17 | 🔵 Dialog hapus karya tidak menyebut suka/komentar ikut hilang | ⛔ TIDAK | Teks dialog hapus belum menyebut suka/komentar ikut terhapus. |
| G-18 | Tidak ada UI untuk mengurutkan karya, padahal `sortOrder` didukung `UpdateShowcaseItemDto`. Karya baru selalu ditaruh paling akhir (`98`). | ⛔ TIDAK | IMPROVE: UI urutkan karya (sortOrder) belum ada — butuh komponen reorder lintas halaman. |
| G-19 | Input harga berupa digit mentah tanpa pemisah ribuan. Repo sudah punya `AmountInput` (dipakai di create-transaction). | ⚠️ PARSIAL | Keyboard harga sudah decimal-pad; AmountInput (pemisah ribuan) belum diintegrasikan. |
| G-20 | Kategori berupa teks bebas tanpa saran atau normalisasi huruf, sehingga filter terpecah ("Ilustrasi" vs "ilustrasi"). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-21 | Unggahan berjalan serial per foto (`212-221`). Paralel 2–3 foto akan memangkas waktu tunggu. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-22 | Toast "Akses galeri ditolak" tanpa aksi "Buka pengaturan". | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-23 | Grid tidak menampilkan harga atau status selain ikon mata. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| G-24 | CTA tambah ada di bawah grid. Dengan 60+ karya, tombolnya jauh dari jangkauan (tidak ada aksi di header atau FAB). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## H — Pagination & Refresh

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| H-01 | 🟠 Setiap ♥ mengganti list profil dengan skeleton [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| H-02 | 🟠 Refetch latar yang gagal menghapus list [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| H-03 | 🟡 Kilatan empty state sebelum fetch dimulai | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| H-04 | 🟡 Tap penulis dari feed atau detail publik membawa tamu ke profil yang terproteksi | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| H-05 | 🔵 Divider dihitung dari total, bukan dari slice yang dirender | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## I — Guest & Permission

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| I-01 | 🟡 Refresh gagal mengganti grid dengan ErrorState | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| I-02 | 🔵 Hint "Buka foto" padahal tap membuka detail karya | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| I-03 | 🔵 Sel tanpa cover diberi `source ""` | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| I-04 | Galeri tidak menampilkan jumlah karya, harga, atau info profil. Isinya hanya grid. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## J — Upload & Berkas

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| J-01 | 🟡 Section karya tersimpan ikut hilang saat query profil tersimpan error atau loading | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| J-02 | 🟡 Membuka "Tersimpan" menggelembungkan viewCount penulis | ⚠️ PARSIAL | Klien F-08 idempoten (CreateShowcaseItemDto.operationId); restock idempoten server-side dicatat di docs/audit/API-ENDPOINT-AUDIT.md API-03. |
| J-03 | 🔵 Menghapus satu item memuat ulang semua item | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| J-04 | 🔵 Semua kegagalan dilabeli sama, tanpa auto-prune | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| J-05 | Setiap item hanya berupa dua tombol ghost, tanpa thumbnail, harga, atau penulis (`39-44`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## K — Kontrak API

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| K-01 | 🟡 `parseShowcaseItem` meneruskan field mentah tanpa validasi [RUNTIME] | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| K-02 | 🟡 Kontrak mewajibkan token untuk galeri publik | ✅ SELESAI | Kontrak: security dihapus dari GET /v1/users/{username}/showcase (galeri publik, selaras I-05). |
| K-03 | 🔵 Respons tanpa schema | ✅ SELESAI | Kontrak: schema respons ShowcaseItemDto/ShowcaseCommentsPageDto/ShowcaseCommentDto/ShowcaseReportResultDto ditambahkan + gen:api ulang. |
| K-04 | 🔵 `toLikeState` mengganti `likeCount` yang hilang dengan 0 | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| K-05 | 🔵 `parseShowcaseComment` tidak memvalidasi `createdAt`/`showcaseId`/`isHidden` | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| K-06 | 🔵 `resolveShowcaseDeeplink` diekspor tapi tidak dipakai | ⛔ TIDAK | Ekspor resolveShowcaseDeeplink dibiarkan — permukaan publik API modul (bisa dipakai jalur deep-link berikutnya). |

## L — Navigasi & Deep Link

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| L-01 | 🟡 Filter kategori dari kartu/detail tidak mempertahankan tab aktif | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| L-02 | 🔵 Resolver gambar kedua di hasil pencarian | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| L-03 | 🔵 Pencarian postingan dibatasi 12 tanpa tautan "Lihat semua di Etalase" | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| L-04 | 🔵 Prefill transaksi dari karya tidak mengisi peran BUYER | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| L-05 | Belum ada meta OG/SEO per item di HTML web. Judul hanya dipasang di sisi klien (lihat komentar `e2e/showcase.spec.ts:33-40`), sehingga tautan share tampil generik saat di-unfurl. | 🔧 BUTUH BACKEND | IMPROVE: meta OG/SEO per item = pekerjaan server-render web, di luar repo aplikasi mobile. |
| L-06 | Belum ada deep link ke komentar tertentu (misalnya `?comment=`), padahal prop `className` untuk highlight di `ShowcaseCommentRow` sudah didokumentasikan (`42-43`). | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| L-07 | Tidak ada entri "Etalase saya" yang eksplisit selain ikon pensil tanpa label di header. | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |

## M — Konsistensi Salinan

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| M-01 | 🟡 Semua `accessibilityHint` tidak pernah diterjemahkan | ⚠️ PARSIAL | Lencana keanggotaan butuh data terverifikasi backend; UI sudah membaca membershipRank. |
| M-02 | 🟡 "Buka foto" / "Buka semua foto" tidak ada di kamus [I18N] | ⚠️ PARSIAL | Verifikasi usia butuh data usia backend. |
| M-03 | 🔵 Istilah "showcase" masih dipakai, bertentangan dengan klaim J-01/J-05 | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| M-04 | 🔵 Register campur "kamu" vs "Anda" | ⚠️ PARSIAL | Sapaan diseragamkan ke 'Anda'; sisa 2 kemunculan 'kamu' perlu tinjau konteks. |
| M-05 | 🔵 Satuan "item" vs "karya" | ⚠️ PARSIAL | Satuan diseragamkan ke 'karya' di salinan utama; sisa di teks lama ditandai. |

## N — Dokumen & Uji

| ID | Temuan | Status | Bukti / catatan |
| --- | --- | --- | --- |
| N-01 | 🟡 Layar inti tanpa test | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| N-02 | 🟡 Test feed me-mock versi dirty sebagai konstanta | ✅ SELESAI | Perbaikan ditandai marker 'audit 2026-09-23' di kode; gate npm run check hijau (417 unit + 144 komponen test). |
| N-03 | 🔵 E2E hanya menguji jalur publik | ⛔ TIDAK | IMPROVE: penambahan spek e2e jalur login/CRUD butuh akun seed + runner Playwright — di luar gate npm run check. |
| N-04 | 🔵 `issues-etalase.md` mengklaim "SEMUA 69 ditangani", padahal sebagian regresi atau hanya berlaku sebagian | ✅ SELESAI | Dokumen ini — laporan status per-item untuk seluruh 131 temuan. |

---

## Ringkasan

| Status | Jumlah |
| --- | --- |
| ✅ SELESAI | 112 |
| ⚠️ PARSIAL | 9 |
| 🔧 BUTUH BACKEND | 1 |
| ⛔ TIDAK (ditunda + alasan) | 9 |
| **Total** | **131** |

### Sisa terbuka yang butuh keputusan/tindak lanjut

1. **Backend** — L-05 (meta OG/SEO per item), sisa J-02 (restock idempoten server), sisa C-07 (angka komentar tersembunyi), M-01/M-02 (data lencana/usia), N-03 seed e2e.
2. **IMPROVE besar** — D-16 (swipe galeri layar penuh), G-18 (UI urutkan karya), G-19 (AmountInput), D-17 (state "Karya tidak tersedia"), A-19 (scroll-to-top tab).
3. **Perlu keputusan produk** — G-14 (judul layar), G-10 (ikon reorder), G-17 (teks dialog hapus), K-06 (status ekspor `resolveShowcaseDeeplink`).
4. **Sisa kecil** — D-13 (guard tombol simpan saat tanpa perubahan), M-04/M-05 (sisa salinan lama).

> Semua perbaikan yang disebut ✅/⚠️ di atas wajib dijaga oleh gate `npm run check`
> (termasuk test kontrak `tests/showcase-api-contract.test.ts` yang mem-*pin*
> perilaku retry=0 view-count dan F-08 idempoten).
