# Audit perubahan feed Etalase — 2026-09-23

## Batas perubahan

- Nama dan sumber data empat feed tetap: Untuk Anda, Mengikuti, Terbaru, Populer. Permintaan tab profil diterapkan sebagai gaya underline, bukan mengganti fungsi feed dengan konten profil.
- `Tabs` memiliki dua opsi baru dengan default `false`: `activeIconOnly` dan `largeLabels`. Hanya header feed yang mengaktifkannya. Label feed memakai bodyLarge (16px); tab profil tetap body.
- Ikon aktif membuka ruang di kiri label dengan timing 180ms; indikator underline memakai animasi existing. Reduced motion dihormati.
- Tiga pintu navigasi duplikat di header daftar dihapus. Pensil kelola dan menu simpan di pengaturan tidak dihapus. CTA empty-state Tambah karya tetap tersedia.
- Funnel hanya menggantikan tombol di feed utama melalui prop `onOptions`. Konsumen kartu di profil mempertahankan alur lapor sebelumnya.
- Foto x dari y dihilangkan secara visual, tetapi tetap menjadi label aksesibilitas indikator titik.

## Temuan dan perbaikan

### 1. Laporan sukses tidak langsung menghilangkan kartu yang sudah dimuat

Bukti: `markShowcaseReported` mengubah store `reported`, tetapi feed sebelumnya hanya membaca `isShowcaseReported` saat fetch selesai. Feed tidak berlangganan perubahan laporan; `feedDirtyVersion` sengaja tidak berubah untuk aksi sosial. Akibatnya kartu yang sudah tampil tetap ada sampai fetch selanjutnya.

Perbaikan: hook `useShowcaseHiddenIds` berlangganan snapshot laporan dan dismiss. Daftar yang dirender disaring secara memoized; cache/paginasi tidak di-reset dan tidak ada request refresh tambahan. Panjang daftar untuk divider memakai daftar terlihat.

### 2. Form laporan tidak mengunci submit terhadap status sudah dilaporkan

Bukti: tampilan sudah-dilaporkan menggantikan form, tetapi handler hanya memeriksa item/submitting; footer hanya memeriksa alasan. Bila status berubah sementara alasan sudah terisi, submit masih bisa dilakukan.

Perbaikan: guard `reported` pada handler dan disabled footer. Server tetap otoritas akhir untuk moderasi/deduplikasi.

### 3. Sheet feed menyimpan item lama ketika sesi berubah

Bukti: efek perubahan revisi sesi sebelumnya hanya membersihkan indeks following; state item komentar/laporan tidak dibersihkan.

Perbaikan: tutup sheet komentar, laporan, dan opsi saat revisi sesi berubah. Preferensi dismiss dan laporan juga di-reset oleh store saat sesi berubah agar tidak diwariskan ke akun berikutnya.

### 4. Gutter filter berlapis

Bukti: chip pencarian/kategori sudah memakai mx-5 tetapi header lamanya juga memakai px-5.

Perbaikan: header daftar hanya membungkus chip tanpa padding tambahan dan tidak dirender saat tidak ada filter.

## Perilaku Tidak tertarik

Ini preferensi lokal selama sesi, bukan laporan moderasi atau perubahan algoritma backend. Menyembunyikan karya pada keempat feed, termasuk saat berpindah tab atau memuat halaman berikutnya. Tidak memengaruhi bookmark, profil penulis, atau akses langsung detail. Reset saat sesi berubah. Tidak mengirim endpoint moderasi.

## Verifikasi

- TypeScript: lulus.
- ESLint: lulus.
- Unit suite: 417 tes lulus, termasuk kontrak API Etalase, logika sosial, upload, dan regresi.
- Component suite: 151 tes lulus, termasuk lifecycle feed/komentar, profil/saved, operasi async, indikator tab, dan regresi baru untuk visibilitas store serta isolasi opsi tab.
- Pemeriksaan token, a11y statis, dan i18n: lulus.
- Build web production: lulus. Web push tidak diaktifkan karena environment Firebase Web tidak tersedia.
- `git diff --check`: lulus.

Tes baru memverifikasi perpindahan slot ikon aktif, ukuran label opt-in, dismiss tidak dianggap laporan, laporan/dismiss tidak memicu refetch dirty, dan preferensi terhapus pada perubahan sesi.

## Batas kepastian

Audit ini berbasis penelusuran kode, build, dan tes otomatis. Belum dilakukan pengujian visual/interaksi pada perangkat iOS/Android atau transaksi dengan backend live. Tes animasi menggunakan stub yang mengunci nilai tujuan, bukan kualitas kurva atau frame rate. Keberhasilan server moderasi dan rekomendasi backend tidak diklaim telah diuji.
