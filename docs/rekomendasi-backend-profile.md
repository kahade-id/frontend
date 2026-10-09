# Rekomendasi Backend — Profil Publik (Tanya Jawab, Ulasan, Tentang)

Tanggal: 2026-10-09. Cakupan: layar profil publik `app/user/[username]` dan
komponen di bawahnya (`components/screens/user-profile-screen.tsx`,
`components/ui/profile-*.tsx`, `components/ui/qa-thread.tsx`,
`lib/qa-thread.ts`).

Prinsip: **kontrak API tidak diubah sepihak.** Frontend hanya membaca field
yang sudah ada, atau menyediakan tipe lokal opsional yang aman bila field
belum dikirim. Setiap kebutuhan di bawah berstatus **usulan** untuk Tim A
sampai kontrak resmi disepakati.

---

## RK-P01 — Jumlah tepuk tangan (`upvoteCount`) untuk komentar Q&A

**Kondisi:** `QuestionItem` (pertanyaan) sudah membawa `upvoteCount` dan
`isUpvotedByViewer`. `QuestionComment` (jawaban & balasan di utas) **belum**.
Di `lib/api/users.ts` field `upvoteCount` ditambahkan sebagai tipe lokal
opsional, sehingga UI tidak menampilkan angka bila tidak dikirim dan urutan
"Teratas" jatuh ke waktu.

**Usulan:**
1. Kirim `upvoteCount` dan `isUpvotedByViewer` pada setiap item
   `GET /v1/users/:username/questions/:id/comments` (atau endpoint daftar
   komentar yang berlaku).
2. Sediakan endpoint toggle tepuk tangan untuk komentar (nama usulan:
   `POST /v1/users/questions/comments/:id/upvote`, idempotent, respons
   `{ upvoteCount, isUpvotedByViewer }`).

**Dampak bila belum ada:** tombol tepuk tangan di jawaban tidak punya
angka; ikon tetap tampil, tetapi tidak ada state "sudah menepuk" yang
persisten.

## RK-P02 — Urutan "Teratas" sebaiknya di server

**Kondisi:** urutan jawaban "Teratas" (tepuk tangan terbanyak) saat ini
dihitung di klien atas halaman yang sudah dimuat.

**Usulan:** parameter `sort=top|newest` pada endpoint komentar. Dengan begitu
urutan konsisten antar halaman dan tidak salah saat jumlah komentar melebihi
satu halaman.

## RK-P03 — Pohon balasan harus utuh (`parentId`)

**Kondisi:** tampilan balasan bertingkat (`lib/qa-thread.ts`) membangun pohon
dari `parentId`. Bila `parentId` tidak dikirim, balasan jatuh ke level atas
dan utas menjadi datar.

**Usulan:**
- Pastikan `parentId` selalu dikirim (`null` untuk komentar akar).
- Bila komentar dipaginasi, sediakan cara memuat anak dari sebuah induk
  (mis. `GET …/comments?parentId=:id`) atau kembalikan satu utas penuh. Tanpa
  itu, balasan di halaman berikutnya bisa hilang dari pohon.

## RK-P04 — Penanda "milik saya" dari server

**Kondisi:** klien menentukan apakah profil milik pengguna sendiri dengan
membandingkan id/username (`isSelf` di layar profil). Tombol pemilik
(menjawab, moderasi, edit) bergantung pada perbandingan ini.

**Usulan:** kirim `isSelf: boolean` (atau `viewerRelation`) pada
`GET /v1/users/:username`. Keamanan tetap bertumpu pada backend (setiap aksi
pemilik wajib diverifikasi server); field ini hanya memperjelas UI.

## RK-P05 — Kontak publik: flag eksplisit selalu dikirim

**Kondisi:** klien hanya menampilkan email/HP kontak bila
`showContactEmail` / `showContactPhone` bernilai `true` secara eksplisit
(fail closed). Normalisasi di `lib/api/users.ts` mengisi `true` bila nilai
kontak ada, tetapi bentuk respons seharusnya tidak bergantung pada inferensi
itu.

**Usulan:** `GET /v1/users/:username` selalu mengirim `showContactEmail` dan
`showContactPhone` (boolean), dan mengirim `contactEmail` / `contactPhone`
**hanya** bila flag bernilai `true`. Ini mencegah kebocoran bila suatu saat
flag hilang dari respons.

## RK-P06 — Nomor order tidak perlu dikirim ke profil publik

**Kondisi:** `GET /v1/users/:username/ratings` mengirim `orderId` pada setiap
ulasan. Mulai commit ini, layar profil **tidak** menampilkan nomor order
(data transaksi pihak lain, tidak relevan untuk pengunjung).

**Usulan:** hapus `orderId` dari respons endpoint publik. Bila tetap
dibutuhkan (mis. layar daftar ulasan milik sendiri), pisahkan ke endpoint
yang hanya bisa diakses pemilik/pihak transaksi.

## RK-P07 — Ulasan: total, sort, dan halaman

**Kondisi:** tab Ulasan hanya menampilkan 20 ulasan pertama (UI-P011) dan
urutan "Rating tertinggi" dihitung di klien dari halaman yang dimuat.

**Usulan:**
- Parameter `sort=newest|top` pada `GET /v1/users/:username/ratings`.
- Respons menyertakan `total` agar teks "Lihat semua" bisa menyebut jumlah
  tanpa memuat seluruh daftar.

## RK-P08 — Ringkasan distribusi sudah tersedia (catatan)

`GET /v1/users/:username/ratings` sudah dipakai untuk `distribution` dan
`averageRating` (lihat `lib/api/ratings.ts` → `getPublicRatingSummary`).
Tidak ada perubahan yang diminta; catatan ini hanya untuk memastikan kontrak
ringkasan tetap dipertahankan saat endpoint daftar diubah.

## RK-P09 — Varian gambar untuk cache dan scroll

**Kondisi:** avatar dan gambar header dimuat dalam ukuran asli.

**Usulan:** sediakan varian ukuran (mis. 96px untuk avatar kecil dan
komentar, 256px untuk header profil) sehingga cache gambar lebih hemat dan
scroll tidak tersendat.

## RK-P10 — Batas bio di kontrak

**Kondisi:** bio publik tidak punya batas panjang yang terdokumentasi.
Klien menampilkan maksimal 2 baris dan memotong sisanya.

**Usulan:** dokumentasikan batas panjang bio di DTO (mis. 160 karakter)
sehingga UI dan validasi form menyepakati angka yang sama.

---

## Catatan frontend (bukan backend)

- `app/user/[username]/questions.tsx` masih memakai rendering lama dan belum
  memakai `<QaThread>`. Perlu disamakan pada iterasi berikutnya.
- Sort "Teratas" pada komentar bergantung pada RK-P01/RK-P02; sampai itu
  ada, UI jatuh ke urutan waktu.
