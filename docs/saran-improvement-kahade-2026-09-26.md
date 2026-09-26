# 150 Saran Improvement untuk Kahade

**Tanggal audit:** 26 September 2026
**Jenis pekerjaan:** review baca-saja dan penyusunan backlog; tidak ada kode produk yang diubah.

## Cakupan dan cara membaca

Review mencakup tiga repository agar istilah “semua fitur” meliputi aplikasi pengguna, API, dan panel operator:

| Bagian | Snapshot yang ditinjau | Inventaris statis |
|---|---|---|
| Aplikasi pengguna (`kahade-id/frontend`) | `6cd84dd` | 105 route/screen, 68 file test, spesifikasi OpenAPI penuh 403 path / 461 operasi |
| API (`kahade-id/backend`) | `8960358`, clone shallow di `../backend` | NestJS/Prisma, 37 file modul, 76 model dan 60 enum Prisma |
| Panel admin (`kahade-id/admin`) | `cbc3943`, clone shallow di `../admin` | 28 halaman `page.tsx`; belum ditemukan file test unit/E2E di repo ini |

Kedua clone berada sebagai direktori saudara dari `frontend`, bukan di dalam repository frontend; tidak ada perubahan di backend/admin dan keduanya tidak masuk ke diff frontend. Review ini **bukan** pentest, review legal, atau uji produksi; test/build tidak dijalankan. Saran di bawah merupakan backlog peningkatan—bukan klaim bahwa semua kemampuan tersebut belum ada.

**Prioritas:** **P0** = uang, keamanan akun, privasi, audit, atau kepatuhan; **P1** = keandalan alur dan pengalaman inti; **P2** = peningkatan produk/polish. Prioritas bersifat kualitatif, belum diberi estimasi atau skor RICE.

### Catatan terhadap audit yang sudah ada

- `docs/audit-escrow-end-to-end-2026-09-24.md` dan `docs/audit-escrow-round2-2026-09-24.md` sudah memetakan banyak edge case escrow; catatan ronde-2 menyatakan temuannya telah diremediasi pada snapshot auditnya. Gunakan sebagai regression suite, bukan otomatis membuka semua isu lama lagi.
- `SHOWCASE_AUDIT.md` frontend serta `backend/SHOWCASE_AUDIT.md` memuat temuan historis. Pemeriksaan snapshot saat ini menunjukkan beberapa contoh perbaikannya sudah ada, misalnya error per field dan retry ber-idempotency di frontend, serta DTO report, soft delete/restore, dan share counter di backend.
- `backend/DISPUTE_DEFERRED_AUDIT.md` menyisakan keputusan kebijakan produk tentang refund platform fee pada putusan sengketa `FULL_BUYER`. Dua saran di bawah mengusulkan agar keputusan ini ditetapkan bersama Finance/Legal, bukan mengubah aliran dana sepihak.

---

## A. Login, pendaftaran, dan onboarding (1–12)

1. **P1 — Jadikan onboarding berbasis tujuan.** Tanyakan apakah pengguna ingin membeli, menjual, atau keduanya, lalu tampilkan panduan dan shortcut yang relevan; simpan progres bila onboarding ditutup. (`app/(auth)/onboarding.tsx`, `lib/onboarding.ts`)
2. **P1 — Jelaskan kapan dan mengapa KYC diperlukan.** Beri pratinjau manfaat, dokumen yang dibutuhkan, estimasi waktu, serta langkah berikutnya sebelum pengguna memulai verifikasi.
3. **P2 — Tambahkan passkey/WebAuthn sebagai opsi login.** Pertahankan OTP sebagai recovery/fallback dan jangan jadikan biometrik perangkat satu-satunya cara memulihkan akun. (`app/(auth)/login.tsx`, backend `modules/auth`)
4. **P1 — Tampilkan status OTP secara eksplisit.** Bedakan “sedang dikirim”, “terkirim”, “terlambat”, dan “gagal”; gunakan cooldown/`Retry-After` dari server, bukan timer lokal yang bisa berbeda.
5. **P1 — Berikan fallback metode OTP yang kontekstual.** Jika WhatsApp/SMS gagal, tampilkan kanal alternatif yang memang aktif untuk akun dan wilayah tersebut serta tetap batasi penyalahgunaan resend.
6. **P2 — Optimalkan form kredensial untuk password manager.** Pastikan autofill, paste OTP, label aksesibel, validasi inline, dan pesan kebijakan kata sandi bekerja konsisten di iOS, Android, dan web.
7. **P0 — Perkuat pemulihan akun berisiko tinggi.** Perubahan email/nomor atau reset akun dengan saldo perlu verifikasi step-up, notifikasi ke kanal lama, waktu tunggu, dan jalur banding/support yang jelas.
8. **P1 — Pulihkan alur pendaftaran yang terputus.** Setelah app ditutup atau jaringan putus, pulihkan hanya state sementara yang aman dan minta server memvalidasi ulang token tahap registrasi.
9. **P1 — Rapikan lifecycle kode cadangan 2FA.** Beri konfirmasi bahwa backup code hanya bisa dilihat sekali, tombol unduh/salin aman, status jumlah kode tersisa, dan alur rotasi/revoke.
10. **P1 — Lengkapi manajemen sesi perangkat.** Tampilkan nama perangkat, platform, waktu/aktivitas terakhir, status tepercaya, lokasi kasar bila tersedia, serta aksi cabut satu/semua sesi.
11. **P0 — Terapkan step-up berbasis risiko.** Minta PIN/2FA ulang untuk mengganti rekening, PIN, email/nomor, mematikan 2FA, atau menjalankan mutasi saldo; hindari meminta ulang untuk aksi berisiko rendah.
12. **P2 — Tambahkan mode eksplorasi aman.** Beri demo/simulasi escrow tanpa uang nyata agar pengguna baru dapat memahami fee, bukti pengiriman, dan sengketa sebelum transaksi pertama.

## B. Transaksi dan escrow (13–27)

13. **P0 — Jadikan quote fee server satu-satunya angka final.** Pastikan layar review dan layar order memakai `buyerPayAmount`/`sellerReceiveAmount` dari `calculate-fee`; hitung lokal hanya untuk skeleton, bukan keputusan pembayaran. (`app/create-transaction.tsx`, backend `modules/orders`)
14. **P0 — Versikan quote transaksi.** Kembalikan ID/masa berlaku quote yang mencakup fee, voucher, diskon membership, dan pembagian fee; tolak atau minta konfirmasi ulang bila nilainya berubah saat order dibuat.
15. **P1 — Sajikan status escrow sebagai timeline tindakan.** Terjemahkan status server menjadi “menunggu konfirmasi penjual”, “menunggu pembayaran”, “diproses”, “dikirim”, dan “dana dilepas”, lengkap dengan siapa perlu bertindak.
16. **P0 — Gunakan rekonsiliasi untuk hasil mutasi yang tidak pasti.** Setelah timeout/response rusak pada bayar, konfirmasi, pembatalan, atau penyelesaian, tampilkan “sedang memeriksa status” dan baca ulang order sebelum menawarkan retry.
17. **P0 — Pertahankan satu idempotency key per niat pengguna.** Simpan kunci yang sama saat retry sampai server memberi hasil pasti; uji replay pada API, app restart, dan request paralel untuk seluruh mutasi uang.
18. **P1 — Jelaskan alasan sebuah aksi tidak tersedia.** Bila tombol terima, bayar, proses, kirim bukti, atau batalkan dinonaktifkan, tampilkan syarat status/role yang belum terpenuhi, bukan sekadar tombol abu-abu.
19. **P1 — Satukan deadline dengan waktu server.** Tampilkan tanggal, zona waktu, sumber tenggat, dan reminder yang bisa dikonfigurasi; saat kembali dari background, sinkronkan status sebelum menampilkan countdown lama.
20. **P1 — Tambahkan ringkasan akhir sebelum membuat order.** Ulangi nama counterpart, nilai order, fee per pihak, potongan voucher, jumlah yang dibayar/diterima, dan deadline sebelum konfirmasi.
21. **P2 — Dukung milestone untuk layanan dan barang digital.** Pecah pekerjaan menjadi tahap, bukti per tahap, serta pelepasan dana bertahap jika model bisnis mengizinkan; tetap sediakan jalur layanan sederhana.
22. **P2 — Integrasikan pelacakan pengiriman.** Izinkan nomor resi, pilihan kurir, tautan tracking, dan status terakhir; pertahankan input manual untuk kurir yang belum terintegrasi.
23. **P1 — Perjelas dampak pembatalan sebelum tindakan final.** Sebutkan apakah dana kembali ke wallet/provider, estimasi waktunya, biaya yang tetap berlaku, alasan wajib, dan apakah lawan transaksi perlu menyetujui.
24. **P1 — Tampilkan status refund terpisah dari status order.** Pengguna perlu melihat “refund diminta”, “diproses provider”, “berhasil”, atau “perlu bantuan” tanpa menyimpulkan refund selesai dari order yang sudah dibatalkan.
25. **P2 — Tingkatkan pencarian transaksi.** Tambahkan filter rentang tanggal, nilai, peran pembeli/penjual, metode bayar, dan status; sediakan filter tersimpan serta reset filter yang mudah.
26. **P2 — Deteksi order yang tampak duplikat.** Sebelum submit, tawarkan peringatan untuk transaksi yang baru dibuat dengan pihak/nilai/judul serupa—tanpa memblokir order yang memang disengaja.
27. **P1 — Perkaya keamanan Order Link.** Beri masa berlaku yang mudah dimengerti, pratinjau penerima, jumlah pemakaian, revoke cepat, dan status link; pastikan penerima tanpa akun tetap mendapat alur publik yang aman.

## C. Wallet, pembayaran, dan penarikan (28–41)

28. **P0 — Bedakan saldo tersedia, tertahan, dan dalam proses.** Berikan angka yang menjelaskan mana yang bisa dipakai, sedang di-escrow, menunggu top-up, atau menunggu penarikan; hubungkan tiap angka ke mutasi terkait.
29. **P0 — Tampilkan hanya metode pembayaran yang benar-benar tersedia.** Muat daftar metode, batas nominal, biaya, dan status provider dari API/config; hindari menawarkan metode yang tidak dapat diselesaikan oleh alur klien.
30. **P0 — Sediakan jalur pemulihan QRIS berstatus `UNKNOWN`.** Beri tombol cek ulang, bantuan “saya sudah membayar”, akses riwayat, dan instruksi agar tidak membuat QR baru sebelum status transaksi lama direkonsiliasi.
31. **P1 — Sinkronkan QRIS saat app kembali aktif.** Saat app resume atau push diterima, ambil status provider/server, tutup countdown yang kedaluwarsa, dan jelaskan bila status provider masih belum final.
32. **P1 — Buat bukti top-up mudah diverifikasi.** Simpan referensi pembayaran/provider, jumlah, waktu, fee, dan status settlement di detail transaksi serta notifikasi sukses/gagal.
33. **P1 — Tampilkan rincian penarikan sebelum submit.** Pisahkan jumlah bruto, biaya, jumlah bersih, rekening tujuan, estimasi proses, batas harian, dan kemungkinan hari libur.
34. **P0 — Verifikasi nama pemilik rekening secara jelas.** Sebelum penarikan pertama atau penggantian rekening, tampilkan hasil pencocokan nama dan minta konfirmasi eksplisit jika nama berbeda.
35. **P1 — Buat jadwal penarikan transparan.** Tampilkan waktu eksekusi berikutnya, syarat saldo minimum, zona waktu, status tiap jadwal, dan aksi jeda/batalkan yang aman.
36. **P0 — Tambahkan layar konfirmasi transfer yang anti-salah-kirim.** Tampilkan nama/username penerima, nomor yang dimasking, nominal, fee, dan saldo sesudah transfer sebelum PIN diminta.
37. **P0 — Rekonsiliasi transfer dengan idempotency dan tanda terima.** Retry harus kembali ke satu transfer yang sama; berikan ID referensi dan tombol bagikan/salin bukti transaksi.
38. **P1 — Lengkapi ekspor wallet dengan kontrol rentang dan privasi.** Dukung CSV/PDF yang dapat difilter, beri peringatan bahwa file berisi data finansial, dan jangan memuat PII yang tidak diperlukan.
39. **P1 — Uji seluruh nominal dalam integer rupiah.** Tetapkan aturan rounding tunggal untuk fee, voucher, transfer, dan split; hindari float desimal atau fallback nominal `0` pada layar/dokumen.
40. **P0 — Perketat proteksi PIN wallet.** Terapkan throttling yang konsisten antar perangkat, cooldown yang berasal dari server, notifikasi percobaan mencurigakan, dan step-up sebelum reset PIN.
41. **P1 — Jelaskan cashback dan bonus top-up.** Tampilkan syarat, batas maksimum, saldo promosi vs saldo tunai, masa berlaku, serta urutan penggunaan sebelum pengguna mengonfirmasi.

## D. Pengiriman, sengketa, rating, dan asuransi (42–53)

42. **P1 — Buat wizard sengketa berbasis kasus.** Pertanyaan awal sesuai kategori (barang tidak sampai, rusak, tidak sesuai, jasa belum selesai) dapat merekomendasikan jenis bukti yang relevan.
43. **P1 — Tampilkan tenggat masing-masing pihak.** Pisahkan deadline respons pengguna, deadline mediasi, SLA eskalasi, dan estimasi keputusan admin; jelaskan apa yang terjadi bila lewat.
44. **P1 — Jadikan unggah bukti tahan jaringan buruk.** Tampilkan antrean per file, ukuran/tipe, progress, preview, retry, hapus, dan resume setelah app tertutup; jangan laporkan seluruh aksi gagal hanya karena refetch daftar gagal.
45. **P0 — Jaga integritas bukti end-to-end.** Simpan hash, tipe media tervalidasi, waktu unggah server, pemilik file, dan jejak perubahan; tampilkan file yang ditolak beserta alasan yang bisa ditindaklanjuti.
46. **P1 — Beri kontrol privasi untuk bukti sensitif.** Jelaskan siapa yang bisa melihat bukti dan berapa lama disimpan; sediakan redaksi bagian data yang tidak relevan sebelum unggah.
47. **P1 — Pisahkan status upload dari status pengiriman bukti.** Bila file sudah tersimpan tetapi submit metadata gagal, pertahankan file yang sama untuk retry dan rekonsiliasi server agar tidak menggandakan lampiran.
48. **P0 — Putuskan kebijakan fee pada refund sengketa.** Finance/Legal/Product harus menetapkan apakah putusan `FULL_BUYER` mengembalikan fee platform; dokumentasikan alasan, versi kebijakan, dan jumlah bersih sebelum pihak menyetujui penyelesaian. (`backend/DISPUTE_DEFERRED_AUDIT.md`)
49. **P1 — Terangkan proses banding dan finalitas putusan.** Tampilkan siapa yang memutuskan, dasar ringkas keputusan, langkah yang masih tersedia, batas waktu, serta alasan bila kasus tidak bisa dibuka ulang.
50. **P1 — Jelaskan perlindungan asuransi sebelum transaksi.** Tampilkan transaksi yang memenuhi syarat, premi, batas ganti rugi, pengecualian, masa pengajuan klaim, serta status klaim pada timeline.
51. **P1 — Kunci eligibility rating secara server-side dan terangkan aturannya.** Batasi satu rating per pihak/order, jelaskan kapan form terbuka, serta berikan jalur edit atau koreksi yang terkontrol.
52. **P2 — Tambahkan dimensi rating yang terstruktur.** Selain bintang dan komentar, ukur komunikasi, ketepatan, dan kesesuaian deskripsi; izinkan respons penjual dengan kebijakan moderasi yang jelas.
53. **P1 — Buat auto-complete escrow lebih mudah dipahami.** Kirim reminder bertahap, jelaskan konsekuensi pelepasan dana, sediakan perpanjangan yang sah, dan tautkan tombol “Ada masalah?” ke sengketa.

## E. Etalase, profil sosial, dan discovery (54–68)

54. **P1 — Lengkapi ketersediaan barang/jasa.** Tambahkan status stok/kapasitas, waktu respons, dan alasan nonaktif pada detail item agar CTA transaksi tidak menyiratkan bahwa setiap penawaran selalu tersedia.
55. **P2 — Kembangkan taksonomi kategori.** Gunakan kategori/subkategori baku dengan sinonim dan popularitas lokal; tetap izinkan tag tambahan tanpa membuat pencarian terpecah oleh variasi ejaan.
56. **P1 — Perjelas jenis harga.** Bedakan harga tetap, rentang, mulai dari, gratis, dan harga per milestone; validasi variasi agar pembeli tahu nilai mana yang akan masuk ke escrow.
57. **P2 — Tambahkan checklist kualitas listing.** Sarankan foto cover, deskripsi, kategori, harga, dan teks alternatif sebelum terbit; tampilkan preview kartu feed/profil.
58. **P1 — Percepat upload multi-foto dengan progres yang dapat dipercaya.** Kompres gambar sesuai batas, unggah konkuren dengan batas server, tampilkan retry per foto, dan umumkan batas ukuran sebelum picker dibuka.
59. **P2 — Simpan draft media dengan aman.** Pertahankan metadata foto lokal yang masih bisa diakses, beri opsi “lanjutkan/buang”, dan bersihkan file orphan jika draft dibuang atau sesi akun berubah.
60. **P1 — Tambahkan preview publik sebelum menerbitkan.** Tampilkan bagaimana listing terlihat untuk pengunjung, termasuk harga, badge, cover, dan tombol transaksi.
61. **P1 — Beri konteks pada badge penjual.** Terangkan perbedaan KYC personal, verifikasi bisnis, badge kepercayaan, serta tanggal/ruang lingkup verifikasinya; hindari menjadikan badge dekoratif tanpa makna.
62. **P2 — Lengkapi koleksi favorit dan tersimpan.** Sediakan folder/label, sortir, sinkron lintas perangkat, dan ekspor/hapus koleksi; bedakan “favorit profil” dari “simpan listing”.
63. **P2 — Beri kontrol feed yang transparan.** Izinkan memilih Mengikuti/Terbaru/Populer, menyembunyikan kategori/akun, dan menampilkan alasan rekomendasi secara singkat.
64. **P1 — Tambahkan filter discovery marketplace.** Filter kategori, rentang harga, tipe barang/jasa, status aktif, rating, dan status verifikasi; pertahankan filter saat kembali dari detail.
65. **P1 — Satukan alur block, mute, dan report.** Letakkan pada profil, listing, komentar, dan chat; tampilkan hasil blokir secara konsisten pada feed dan pencarian.
66. **P1 — Siapkan komentar untuk pertumbuhan.** Pertahankan pagination balasan per root, optimistic state, status moderasi, dan notifikasi balasan; hindari respons membesar karena satu thread populer.
67. **P1 — Tutup loop pelaporan konten.** Setelah laporan dikirim, tampilkan ID/status, kebijakan kerahasiaan, dan notifikasi jika moderator meminta informasi tambahan atau menutup kasus.
68. **P1 — Perbaiki pengalaman share di web/deep link.** Validasi URL share, gunakan preview Open Graph yang aman, fallback untuk app belum terpasang, dan ukur share/open tanpa menghitung crawler sebagai pengguna nyata.

## F. Chat dan notifikasi (69–79)

69. **P1 — Tambahkan antrean kirim offline untuk chat.** Tandai pesan “mengirim/gagal/terkirim”, izinkan retry pada ID pesan yang sama, dan pertahankan urutan pesan setelah reconnect.
70. **P1 — Samakan state realtime dan hasil polling.** Saat Socket.IO reconnect, lakukan sync delta sejak cursor terakhir agar status baca, pesan, dan order tidak hilang atau tampil ganda.
71. **P1 — Hardening lampiran chat.** Validasi MIME/magic byte, scan file, buat thumbnail aman, batasi ukuran, dan tampilkan progres serta retry per lampiran.
72. **P1 — Sediakan tindakan trust & safety di ruang chat.** Report, block, mute, serta keluar dari inquiry/order perlu menjelaskan dampaknya terhadap transaksi yang masih aktif.
73. **P2 — Tingkatkan pencarian percakapan.** Cari isi pesan, tanggal, lampiran, dan pesan tersemat; lindungi pesan sengketa yang memiliki retensi khusus dari penghapusan biasa.
74. **P1 — Rekonsiliasi unread count antar perangkat.** Gunakan cursor baca server, dedupe event realtime, dan perbaiki badge saat notifikasi dibuka atau sesi berpindah perangkat.
75. **P1 — Minta izin push pada saat yang tepat.** Jelaskan nilai notifikasi transaksi sebelum prompt OS; sediakan status token/izin dan tombol aktifkan ulang di pengaturan.
76. **P1 — Terapkan preferensi notifikasi per kategori dan kanal.** Bedakan transaksi, keamanan, dukungan, sosial, dan promosi untuk in-app/push/email/WhatsApp sesuai kemampuan backend.
77. **P0 — Gunakan transactional outbox untuk notifikasi penting.** Perubahan status order/wallet dan event notifikasi harus pulih dari crash worker tanpa notifikasi ganda atau hilang.
78. **P1 — Hormati quiet hours berdasarkan zona waktu pengguna.** Izinkan pengecualian untuk keamanan dan pembayaran kritis, serta tunjukkan waktu lokal yang dipakai untuk jadwal.
79. **P1 — Buat deep link notifikasi tahan kondisi akun.** Jika sesi berakhir, login harus kembali ke tujuan yang benar; jika objek sudah dihapus/akses dicabut, tampilkan fallback yang aman.

## G. KYC, identitas, keamanan, dan privasi (80–90)

80. **P1 — Tampilkan status KYC sebagai checklist.** Jelaskan dokumen diterima/ditinjau/perlu ulang, estimasi SLA, alasan penolakan, dan tombol kirim ulang tanpa mengisi ulang bagian yang masih valid.
81. **P1 — Beri panduan kamera yang aksesibel.** Tambahkan contoh pencahayaan, posisi KTP, kualitas selfie/liveness, indikator upload, dan alternatif bila kamera atau perangkat tidak mendukung.
82. **P0 — Publikasikan kebijakan retensi data KYC.** Jelaskan tujuan pemrosesan, pihak penerima, masa simpan, prosedur penghapusan, dan kapan data wajib disimpan karena regulasi.
83. **P1 — Buat onboarding akun bisnis bertahap.** Bedakan KYC individu dari legalitas perusahaan, simpan progres dokumen, dan jelaskan bahwa verifikasi bisnis tidak otomatis berarti transaksi diasuransikan.
84. **P1 — Beri alasan dan jalur koreksi verifikasi bisnis.** Tampilkan dokumen yang ditolak, alasan per dokumen, tenggat perbaikan, dan cara menghubungi reviewer.
85. **P0 — Audit akses ke NIK, KTP, dan data rekening.** Terapkan redaksi default, alasan akses, audit log per admin, masa berlaku URL dokumen, dan alarm untuk akses tidak biasa.
86. **P1 — Tambahkan preset visibilitas profil.** Pilih informasi yang publik, hanya pengikut, atau privat; beri preview profil sebagai pemilik dan pengunjung lain.
87. **P0 — Satukan pusat privasi.** Ekspor data, daftar sesi, pengguna diblokir, izin notifikasi/lokasi, hapus akun, dan status permintaan privasi dapat dikelola dari satu tempat.
88. **P1 — Perkuat pencabutan sesi dan perubahan kredensial.** Cabut refresh token lintas perangkat, tampilkan kapan aksi selesai, dan kirim peringatan ke kanal tepercaya.
89. **P1 — Pastikan biometrik tidak menjadi lock-out.** Sediakan fallback PIN/perangkat/OTP yang aman, minta autentikasi ulang saat state berubah, dan beri petunjuk ketika biometric sensor gagal.
90. **P2 — Jelaskan Trust Score dan proses keberatan.** Tampilkan faktor yang dapat diperbaiki, hindari membuka sinyal anti-fraud yang sensitif, serta sediakan review manusia untuk keputusan berdampak besar.

## H. Voucher, referral, Kahade+, badge, dan kampanye (91–100)

91. **P0 — Berikan preview voucher dari kalkulasi server.** Sebelum diterapkan, tampilkan nominal sebelum/sesudah, siapa yang menanggung fee, batas diskon, dan jumlah akhir yang dibayar.
92. **P1 — Jelaskan alasan voucher tidak berlaku.** Bedakan kedaluwarsa, kuota habis, kategori tidak cocok, nominal minimum, akun tidak memenuhi syarat, dan gangguan jaringan.
93. **P1 — Buat referral dapat dilacak oleh pengguna.** Tampilkan siapa yang berhasil mendaftar tanpa membocorkan data sensitif, syarat reward, status pending/approved, dan estimasi pencairan.
94. **P0 — Perkuat anti-abuse referral dan promo.** Deteksi akun/perangkat/pembayaran yang terhubung, batasi reward per identitas sesuai kebijakan, dan sediakan jalur banding atas blokir otomatis.
95. **P1 — Bandingkan paket Kahade+ dengan transparan.** Tampilkan periode penagihan, manfaat aktif, batas penggunaan, syarat promosi, perpanjangan, refund, dan konsekuensi berhenti.
96. **P1 — Bangun lifecycle langganan yang jelas.** Notifikasi sebelum perpanjangan, status pembayaran gagal, grace period, restore/lanjutkan paket, dan cancel efektif pada tanggal tertentu.
97. **P2 — Terangkan Membership Rank dan badge.** Tampilkan syarat naik level, masa berlaku, apa yang memengaruhi skor, dan perbedaan badge yang diverifikasi otomatis vs diberikan admin.
98. **P0 — Sajikan saldo promosi terpisah dan mudah diaudit.** Tampilkan sumber cashback, batas pemakaian, tanggal kedaluwarsa, dan mutasi ledger tanpa menggabungkannya dengan saldo tunai.
99. **P1 — Beri dry-run pada kampanye/voucher.** Admin dapat melihat contoh eligibility, biaya maksimum, cohort, periode, dan konflik promo sebelum mempublikasikan.
100. **P1 — Buat penawaran asuransi kontekstual dan opt-in.** Jelaskan premi, penanggung, batas klaim, pengecualian, dan dampak bila transaksi dibatalkan sebelum pengguna memilih.

## I. Bantuan, pengaturan, dan pengalaman aplikasi (101–110)

101. **P2 — Tingkatkan pencarian FAQ/help.** Tambahkan sinonim, typo tolerance, kategori populer, dan saran hasil saat mengetik; ukur pencarian tanpa hasil untuk memperbaiki basis pengetahuan.
102. **P1 — Tampilkan artikel bantuan sesuai konteks.** Pada layar bayar, penarikan, sengketa, dan KYC, tautkan artikel spesifik dengan parameter aman—bukan hanya pusat bantuan umum.
103. **P1 — Beri status tiket dukungan end-to-end.** Tampilkan antrean, SLA, balasan terakhir, lampiran, status menunggu pengguna/admin, dan notifikasi saat ada update.
104. **P1 — Izinkan konteks transaksi dilampirkan dengan persetujuan.** Dari order/wallet pilih “Hubungi support terkait ini”; kirim ID referensi minimum, bukan seluruh chat atau PII secara default.
105. **P1 — Sediakan fallback untuk live support.** Tampilkan jam operasional, posisi antrean bila ada, estimasi respons, dan opsi buat tiket saat kanal live tidak tersedia.
106. **P2 — Jadikan Feedback loop terlihat.** Kategorikan bug/saran, beri ID laporan dan konfirmasi diterima, lalu sediakan opsi berbagi versi app/perangkat tanpa mengumpulkan data sensitif.
107. **P1 — Tutup gap terjemahan di seluruh app.** Pastikan semua screen, toast, dialog, email/push, plural, tanggal, nominal, dan legal copy punya katalog ID/EN yang konsisten.
108. **P1 — Satukan preferensi notifikasi di Settings.** Setiap perubahan perlu disimpan ke server, menampilkan state simpan/gagal, dan bisa dipulihkan saat login di perangkat baru.
109. **P0 — Versikan persetujuan legal dan data.** Catat versi Terms/Privacy yang diterima, waktu, wilayah, dan alur persetujuan ulang saat perubahan material.
110. **P1 — Jalankan audit aksesibilitas berkala.** Uji screen reader, urutan fokus, ukuran target sentuh, kontras, text scaling, keyboard di web, reduce motion, dan pesan validasi per form.

## J. Panel admin dan operasi (111–122)

111. **P1 — Jadikan semua antrean work queue berbasis SLA.** KYC, sengketa, tiket, report, klaim asuransi, dan withdrawal sebaiknya punya umur kasus, prioritas, pemilik, due date, dan filter overdue.
112. **P1 — Tambahkan pencarian lintas modul dengan kontrol akses.** Cari user/order/payment/tiket sekali, tampilkan hasil yang sesuai role, serta redaksi data yang tidak diperlukan untuk tugas admin.
113. **P0 — Buat laporan rekonsiliasi keuangan harian.** Cocokkan ledger internal, provider payment, payout bank, refund, dan webhook; sorot selisih serta daftar item yang butuh tindakan.
114. **P0 — Terapkan dual control untuk aksi dana tertentu.** Penyesuaian saldo, refund besar, perubahan treasury, atau keputusan yang melepas escrow dapat memerlukan pembuat dan penyetuju berbeda.
115. **P0 — Tampilkan simulasi dampak sebelum keputusan sengketa.** Sebelum Resolve, tunjukkan nominal buyer, seller, fee platform, voucher, dan saldo escrow; validasi jumlah split = 100%.
116. **P0 — Buat audit trail admin append-only dan mudah ditelusuri.** Simpan actor, role, alasan, before/after, request ID, waktu server, dan hasil; cegah edit/hapus audit oleh admin biasa.
117. **P0 — Uji matriks RBAC sebagai kontrak.** Bandingkan role UI dengan `@AdminRoles` backend per halaman dan per aksi; sembunyikan data PII berdasarkan kebutuhan tugas, bukan hanya menu.
118. **P0 — Amankan tampilan dokumen KYC/bisnis.** Watermark nama admin, audit setiap buka/unduh, URL singkat masa berlaku, cegah cache, dan tandai dokumen yang sudah kedaluwarsa.
119. **P1 — Pisahkan catatan internal dan balasan ke pengguna.** Gunakan composer berbeda dengan label jelas, template jawaban, lampiran aman, dan peringatan sebelum mengirim catatan internal.
120. **P1 — Tambahkan approval dan preview publikasi promo.** Validasi tanggal/wilayah/kuota, tampilkan estimasi exposure/budget, dan sediakan pause/rollback tanpa menghapus audit.
121. **P1 — Sertakan freshness pada dashboard admin.** Tampilkan waktu data terakhir diperbarui, zona waktu, sumber metrik, definisi KPI, dan status job agregasi.
122. **P1 — Amankan bulk action.** Dukung dry-run, batas jumlah item, rekap hasil per baris, unduh laporan, konfirmasi kedua, dan undo untuk perubahan yang memang dapat dibalik.

## K. Backend, kontrak API, data, dan keamanan (123–140)

123. **P1 — Lengkapi schema request/response OpenAPI.** Dokumentasikan status error, pagination, field nullable, enum, contoh response, dan skema respons admin agar adapter tidak perlu menebak bentuk data.
124. **P1 — Bangun contract test lintas tiga repo.** Generate tipe/SDK atau validasi Zod dari satu spec backend, lalu jalankan tes yang membandingkan adapter mobile dan admin saat CI.
125. **P0 — Tetapkan kebijakan idempotency API secara menyeluruh.** Semua mutasi yang membuat/mengubah order, saldo, sengketa, withdraw, subscription, report, atau bukti perlu aturan key, hash request, TTL, dan hasil replay yang teruji.
126. **P0 — Terapkan transactional outbox untuk event domain.** Simpan perubahan order/wallet dan event notifikasi/websocket dalam transaksi yang sama; worker harus idempotent, dapat mengulang, dan memiliki dead-letter queue.
127. **P0 — Audit model ledger sebagai sumber kebenaran saldo.** Pertimbangkan jurnal debit/kredit immutable, rekonsiliasi saldo dari entry, dan invariant bahwa setiap transaksi seimbang pada semua jalur refund/split/bonus.
128. **P0 — Harden webhook payment end-to-end.** Verifikasi signature/IP, dedupe event provider, simpan inbox sebelum proses, dukung replay aman, tandai urutan event terlambat, dan rekonsiliasi berkala.
129. **P0 — Uji state machine dan konkurensi order.** Mutasi status harus memakai prasyarat state/version, mencegah dua worker melepas dana bersamaan, dan menolak transisi ilegal dengan kode error konsisten.
130. **P1 — Standarkan pagination untuk data besar.** Gunakan cursor stabil pada feed, chat, transaksi, notifikasi, bukti, dan admin queue; dokumentasikan total/hasMore dan aturan sort yang deterministik.
131. **P1 — Tetapkan budget query database.** Catat query lambat per endpoint, cek `EXPLAIN` untuk query populer, paginasi relasi, dan buat alert sebelum tabel audit/chat/ledger membesar.
132. **P1 — Seragamkan error dan header operasional.** Sertakan request/correlation ID, kode error stabil, `Retry-After`, petunjuk retry aman, dan format yang sama untuk API mobile serta admin.
133. **P0 — Kelola kunci enkripsi PII dengan rotasi terencana.** Gunakan key versioning, prosedur re-encryption/backfill, pemisahan akses, audit decrypt, dan uji restore jika kunci lama dicabut.
134. **P0 — Buat pipeline ekspor dan penghapusan data subjek.** Jalankan job asinkron dengan status, verifikasi identitas, redaksi/retensi data legal, serta audit hasil tanpa menghapus record finansial yang wajib disimpan.
135. **P1 — Kelola siklus hidup file dan orphan upload.** Scan malware, verifikasi magic bytes, dedupe, cleanup terjadwal, retention per tujuan (KYC/chat/bukti), serta dashboard file yang gagal dihapus.
136. **P1 — Tambahkan observabilitas queue dan scheduler.** Ukur umur antrean, retry, dead-letter, durasi job, duplikasi, dan job tidak berjalan; buat alat replay yang aman untuk operator.
137. **P0 — Uji mode degradasi Redis dan dependency lain.** Bedakan rate limiter/session/cache/queue, tentukan fail-open vs fail-closed per endpoint, dan tampilkan alert saat fallback in-memory aktif.
138. **P0 — Jalankan pengujian authorization negatif.** Otomatiskan IDOR, akses lintas user, role admin, CSRF/CORS, token kedaluwarsa, file key milik user lain, dan pemakaian token setelah revoke.
139. **P0 — Buktikan pemulihan database, bukan hanya backup.** Lakukan restore drill berkala, ukur RPO/RTO, verifikasi checksum, uji PITR, dan dokumentasikan migrasi/rollback ketika schema berubah.
140. **P0 — Versikan kebijakan finansial yang berdampak pada hasil sengketa.** Fee refund, pembagian split, voucher, dan cashback harus punya policy version yang direkam bersama transaksi serta diuji sebelum rollout.

## L. Testing, performa, rilis, dan operasional (141–150)

141. **P1 — Tambahkan test suite pada admin web.** Repo `kahade-id/admin` saat ditinjau belum memiliki file test; mulai dari login/MFA, RBAC, tabel/filter, mutasi withdrawal, keputusan dispute, serta tampilan PII.
142. **P1 — Uji journey end-to-end lintas platform.** Otomatiskan daftar–buat–bayar–kirim bukti–selesai/refund, top-up/withdraw, onboarding/KYC, dan notifikasi pada Android, iOS, web, serta admin sandbox.
143. **P0 — Masukkan kegagalan jaringan ke test matrix.** Simulasikan timeout sesudah commit server, app restart, double tap, jaringan putus saat upload, token refresh paralel, jam perangkat meleset, dan status provider `UNKNOWN`.
144. **P0 — Gunakan property-based test untuk nominal dan state.** Uji pembulatan fee, voucher, split refund, saldo tidak negatif, idempotency replay, dan konkurensi dengan nilai acak serta batas ekstrem.
145. **P1 — Ukur SLI bisnis selain uptime.** Pantau tingkat bayar sukses, pembayaran menggantung, waktu refund, SLA sengketa, kegagalan notifikasi, crash-free session, serta p50/p95/p99 API.
146. **P1 — Buat taksonomi analytics yang minim data pribadi.** Definisikan event funnel onboarding→transaksi→selesai, consent, masa retensi, dan agregasi; jangan kirim chat, NIK, token, atau isi bukti ke analytics.
147. **P1 — Satukan error monitoring lintas app, admin, API, dan worker.** Propagasikan request ID/trace ID tanpa PII dan buat dashboard yang menghubungkan crash pengguna ke job/payment terkait.
148. **P1 — Gunakan feature flag dan staged rollout.** Rollout bertahap per platform/versi, pantau metrik guardrail, pastikan API backward-compatible dengan versi app lama, dan dokumentasikan rollback/OTA.
149. **P1 — Kendalikan biaya render dan unduhan media.** Audit ukuran bundle per route, virtualisasi feed/transaksi, resize gambar, cache dengan batas, serta profil memori pada perangkat Android kelas menengah.
150. **P1 — Siapkan komunikasi insiden dan latihan pemulihan.** Sediakan banner status layanan di app/admin, template informasi pengguna, runbook untuk payment/provider outage, dan simulasi failover terjadwal.

---

## Urutan pelaksanaan yang disarankan

1. **Gelombang 1 — uang dan akses (P0):** #13–17, #28–40, #48, #85, #109, #113–118, #125–129, #132–140, #143–144.
2. **Gelombang 2 — operasi dan pemulihan (P1):** #18–24, #30–35, #42–47, #69–79, #80–84, #102–108, #111–112, #119–122, #126, #135–139, #141–142, #145–148.
3. **Gelombang 3 — pertumbuhan dan polish (P2):** #1–3, #6, #12, #21–22, #25–27, #55–68, #73, #90, #97, #101, #106, #149–150.

Sebelum tiap item masuk sprint, verifikasi kembali statusnya pada branch terbaru, sepakati owner (Product/Mobile/Backend/Admin/Finance/Legal), tulis acceptance criteria dan metrik hasil, lalu tambahkan regression test. Beberapa kemampuan di atas sudah tersedia sebagian; sasaran rekomendasinya adalah meningkatkan kejelasan, cakupan, konsistensi, atau ketahanannya, bukan membangun ulang tanpa audit status.
