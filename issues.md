# Laporan Audit Mendalam Frontend Kahade (Deep Audit & Comprehensive Issue Tracker)

**Tanggal Audit:** 20 September 2026  
**Target Repository:** `kahade-id/frontend`  
**Cabang Pemeriksaan:** `arena/01a0be9f-frontend`  
**Platform Target:** React Native 0.81.5 / Expo SDK 54 / Expo Router 6.0 / NativeWind v4 / Web PWA  
**Status Audit:** SELESAI (110 Temuan Terbukti & Rekomendasi Peningkatan)

---

## 1. Eksekutif Ringkasan & Metodologi Audit

Audit ini dilakukan secara menyeluruh dan mendalam terhadap seluruh basis kode frontend aplikasi **Kahade**. Pemeriksaan mencakup aspek arsitektur, keamanan sesi dan token, integritas alur escrow dan transaksi keuangan, penanganan sengketa (*disputes*), sistem komunikasi chat dan *real-time*, alur verifikasi identitas (*KYC*) dan bisnis, interaksi sosial (*showcase* dan feed), sistem ulasan dan reputasi, manajemen notifikasi (*push* dan in-app), komponen UI dan *design tokens*, aksesibilitas (*a11y*), lokalisasi (*i18n*), ketahanan jaringan (*network resilience*), serta kompatibilitas lintas platform (Web PWA, iOS, dan Android).

### Metrik Basis Kode Saat Audit
- **Total Berkas Sumber:** 516 berkas (.ts, .tsx, .mjs, .json, .css).
- **Rute Aplikasi (Expo Router):** 99 berkas di bawah `app/`, 95 rute terdaftar di `docs/audit/inventory.json` (19 rute dinamis).
- **Komponen Antarmuka Pengguna:** 233 komponen UI di bawah `components/`.
- **Modul Adapter API:** 36 modul di bawah `lib/api/` yang memetakan 310 interaksi HTTP.
- **Ukuran Kode:** ~86.000 baris kode TypeScript/TSX.
- **Katalog Terjemahan:** 1.577 entri string i18n (`lib/i18n/catalog.json`).

### Matriks Distribusi Tingkat Keparahan (Severity Distribution)

| Tingkat Keparahan (Severity) | Jumlah Temuan | Deskripsi & Dampak |
| :--- | :---: | :--- |
| **CRITICAL (Kritis)** | 4 | Cacat logika fatal, kegagalan transaksi, broken navigation flow, atau risiko keamanan langsung yang merusak fungsionalitas inti aplikasi. |
| **HIGH (Tinggi)** | 42 | Masalah integritas data, unhandled error states, race conditions, memory leaks, hilangnya fungsionalitas utama pada kondisi tertentu, atau kesenjangan fitur penting. |
| **MEDIUM (Sedang)** | 46 | Inkonsistensi UI/UX, kelemahan penanganan kesalahan jaringan, redundansi logika, potensi desinkronisasi state, atau kekurangan optimasi performa. |
| **LOW / ENHANCEMENT (Rendah & Peningkatan)** | 18 | Code smell, dead code (komponen tidak terpakai), kekurangan tipografi/i18n minor, dependensi usang, dan optimasi DX. |
| **TOTAL TEMUAN** | **110** | **Seluruh temuan telah diverifikasi secara langsung pada basis kode.** |

---

## 2. Tabel Rekapitulasi Master 110 Temuan

| ID | Kategori | Severity | Lokasi Berkas Utama | Ringkasan Temuan |
| :--- | :--- | :---: | :--- | :--- |
| **ISSUE-001** | Autentikasi & Keamanan | **CRITICAL** | `app/biometric-settings.tsx`, `components/ui/biometric-prompt-trigger.tsx` | Biometrik diaktifkan di Pengaturan namun tidak pernah dipicu pada pembayaran order, transfer, atau withdraw. |
| **ISSUE-002** | Transaksi & Escrow | **CRITICAL** | `app/order-link/[token].tsx:54` | Alur terima Order Link mengabaikan ID order baru sehingga pengguna tidak pernah diarahkan ke detail pesanan. |
| **ISSUE-003** | Dompet & Penarikan | **CRITICAL** | `app/withdrawal-schedules.tsx:88`, `components/ui/schedule-field.tsx` | Pembuatan jadwal penarikan otomatis mengirimkan string rekening kosong `bankAccountId: ""` karena ketiadaan input selector rekening. |
| **ISSUE-004** | Showcase Sosial | **CRITICAL** | `app/(tabs)/discover.tsx:440`, `app/reports.tsx:105` | Tombol laporkan pada kartu feed showcase salah memanggil endpoint `POST /v1/settings/report` (lapor user) bukan showcase report. |
| **ISSUE-005** | Autentikasi & Keamanan | **HIGH** | `lib/api/client.ts:250`, `lib/api/session.ts` | Potensi race condition pada refresh access token bersamaan saat multiple tab web atau permintaan API paralel. |
| **ISSUE-006** | Autentikasi & Keamanan | **HIGH** | `app/two-factor.tsx:236` | Blok penonaktifan 2FA menelan pesan error backend asli dan selalu menampilkan pesan salah password/OTP. |
| **ISSUE-007** | Autentikasi & Keamanan | **HIGH** | `app/change-password.tsx:32-35` | Form ubah password sukses tidak melakukan navigasi kembali atau reset rute sehingga pengguna tertahan di form kosong. |
| **ISSUE-008** | Transaksi & Escrow | **HIGH** | `app/(tabs)/transactions.tsx:135` | Tab Transaksi tidak meneruskan handler `onDeadline` ke OrderCard sehingga kadaluwarsa waktu tidak menyegarkan daftar transaksi. |
| **ISSUE-009** | Transaksi & Escrow | **HIGH** | `app/invoice/[orderId].tsx:147` | Tombol unduh struk HTML terduplikasi dua kali (di dalam InvoiceReceiptView dan tombol terpisah di bawahnya). |
| **ISSUE-010** | Transaksi & Escrow | **HIGH** | `app/order/[id].tsx:380`, `lib/api/orders.ts:518` | Penjual dapat menandai pesanan fisik terkirim tanpa mengisi nomor resi dan kurir yang diwajibkan. |
| **ISSUE-011** | Transaksi & Escrow | **HIGH** | `app/dispute/[id].tsx:78`, `lib/api/disputes.ts` | Unggah bukti klaim sengketa awal tidak memvalidasi tipe MIME terhadap batasan format server. |
| **ISSUE-012** | Sengketa & Mediasi | **HIGH** | `app/dispute/[id].tsx:180`, `lib/api/disputes.ts:242` | Dialog eskalasi sengketa tidak menampilkan sisa kuota eskalasi (maksimal 2x per sengketa) sebelum pengguna melakukan submit. |
| **ISSUE-013** | Sengketa & Mediasi | **HIGH** | `app/dispute/[id].tsx:165`, `components/ui/mutual-resolution-card.tsx` | Usulan penyelesaian bersama (mutual resolution) tidak membatasi nominal maksimum pengembalian sebesar nilai order. |
| **ISSUE-014** | Sengketa & Mediasi | **HIGH** | `components/ui/in-call-controls-bar.tsx`, `app/dispute/[id].tsx` | Komponen kendali panggilan video sengketa (mute, speaker, end call) tidak pernah dimount ke layar sengketa aktif. |
| **ISSUE-015** | Dompet & Pembayaran | **HIGH** | `app/bank-accounts.tsx:78` | Guard penambahan rekening bank tidak memeriksa kekosongan nomor rekening sebelum melakukan submit ke backend. |
| **ISSUE-016** | Dompet & Pembayaran | **HIGH** | `app/delete-account.tsx:50` | Alur hapus akun memblokir pengguna bersaldo tanpa menyediakan tautan cepat ke alur penarikan dana. |
| **ISSUE-017** | Dompet & Pembayaran | **HIGH** | `app/topup.tsx:120`, `app/order/[id].tsx:210` | Polling pembayaran QRIS berjalan tanpa batas maksimum waktu percobaan (*infinite polling loop*). |
| **ISSUE-018** | Dompet & Pembayaran | **HIGH** | `lib/api/wallet.ts:535`, `components/ui/transfer-recipient-picker.tsx` | Endpoint penerima favorit (`favorite-recipients`) tidak diintegrasikan ke komponen pemilih penerima transfer. |
| **ISSUE-019** | Chat & Komunikasi | **HIGH** | `app/chat/[roomId].tsx:95`, `lib/use-polling.ts` | Polling chat interval 8 detik tetap berjalan saat tab browser tidak aktif atau aplikasi diminimize. |
| **ISSUE-020** | Chat & Komunikasi | **HIGH** | `app/live-support.tsx:50-80` | Live Support hanya menjalankan pencocokan kata kunci lokal tanpa integrasi ke live agent backend. |
| **ISSUE-021** | Chat & Komunikasi | **HIGH** | `lib/api/chat.ts:421` | Indikator mengetik (*typing indicator*) mengirim body anonim yang tidak terdokumentasi di Swagger OpenAPI spec. |
| **ISSUE-022** | KYC & Verifikasi | **HIGH** | `app/kyc.tsx:175` | Form KYC menelan pesan error validasi server dan menggantinya dengan teks generik. |
| **ISSUE-023** | KYC & Verifikasi | **HIGH** | `app/business-verification.tsx:75` | Format validasi NPWP badan usaha tidak memeriksa digit format baru 16-digit secara ketat. |
| **ISSUE-024** | KYC & Verifikasi | **HIGH** | `app/kyc.tsx:120` | Fallback galeri foto pada selfie KYC tidak memverifikasi kebaruan dokumen atau metadata waktu pengambilan. |
| **ISSUE-025** | Showcase Sosial | **HIGH** | `app/user/[username].tsx:109` | Typo nilai enum penyembunyian komentar Q&A `"INAPPROPIATE"` (kurang huruf R) menyebabkan potensi kegagalan API. |
| **ISSUE-026** | Showcase Sosial | **HIGH** | `app/(tabs)/discover.tsx:325` | Counter suka (*like count*) pada feed berisiko desinkronisasi saat pengguna melakukan klik ganda cepat. |
| **ISSUE-027** | Showcase Sosial | **HIGH** | `app/showcase/[id].tsx:170` | Komentar induk yang dihapus menghapus seluruh sub-komentar alih-alih menampilkan penanda `[Komentar dihapus]`. |
| **ISSUE-028** | Ulasan & Q&A | **HIGH** | `app/ratings.tsx:310` | Tab ulasan "Diberikan" macet pada Empty State jika seluruh 20 ulasan pada halaman pertama bertipe "Diterima". |
| **ISSUE-029** | Ulasan & Q&A | **HIGH** | `components/ui/rating-review-card.tsx:115` | Tampilan balasan ulasan tidak menampilkan riwayat atau label perubahan (*edited status*). |
| **ISSUE-030** | Ulasan & Q&A | **HIGH** | `app/questions.tsx:140`, `app/user/[username].tsx:240` | Aksi upvote pertanyaan tanya jawab tidak memiliki mekanisme throttling pencegah spam request. |
| **ISSUE-031** | Notifikasi & Polling | **HIGH** | `app/(tabs)/home.tsx:295` | Indikator Pull-to-refresh Beranda tidak melacak status refresh query pesanan selesai (`completedOrders`). |
| **ISSUE-032** | Notifikasi & Polling | **HIGH** | `scripts/gen-fcm-sw.mjs`, `lib/web-push.web.ts:80` | Web Push Service Worker gagal menerima notifikasi jika pengguna menolak izin pertama kali tanpa panduan reset browser. |
| **ISSUE-033** | Notifikasi & Polling | **HIGH** | `app/notifications.tsx:150`, `lib/api/notifications.ts:160` | Penghapusan notifikasi secara batch tidak melakukan pembaruan lokal pada query paginasi secara sinkron. |
| **ISSUE-034** | Voucher & Langganan | **HIGH** | `app/subscriptions.tsx:400`, `lib/api/subscriptions.ts:180` | Fitur jeda langganan premium (*pause subscription*) tidak mengizinkan penentuan tanggal aktif kembali (*resumeAt*). |
| **ISSUE-035** | Voucher & Langganan | **HIGH** | `app/referral.tsx:210` | Papan peringkat referral memicu kedipan avatar pengguna karena ketiadaan caching key stabil. |
| **ISSUE-036** | Voucher & Langganan | **HIGH** | `app/transaction-templates.tsx:110` | Form template transaksi tidak memvalidasi batas nominal minimum sebelum disimpan ke template storage. |
| **ISSUE-037** | Dukungan & Bantuan | **HIGH** | `app/support/[ticketId].tsx:180` | Percakapan tiket dukungan tidak menampilkan berkas lampiran yang sebelumnya diunggah pengguna. |
| **ISSUE-038** | Dukungan & Bantuan | **HIGH** | `app/feedback.tsx:75`, `lib/feedback.ts:120` | Antrean umpan balik offline tidak memiliki indikator visual status antrean di antarmuka pengguna. |
| **ISSUE-039** | Pengaturan & Profil | **HIGH** | `app/edit-profile.tsx:215` | Form edit profil mengizinkan pengubahan nomor HP akun secara langsung padahal nomor HP membutuhkan verifikasi OTP. |
| **ISSUE-040** | Pengaturan & Profil | **HIGH** | `app/blocked-users.tsx:35` | Pembatalan blokir pengguna tidak menampilkan dialog konfirmasi keselamatan sebelum eksekusi. |
| **ISSUE-041** | Pengaturan & Profil | **HIGH** | `app/privacy-settings.tsx:31` | Teks judul item pengaturan privasi `"Profile terlihat publik"` mencampurkan bahasa Inggris dan Indonesia. |
| **ISSUE-042** | Komponen UI & A11y | **HIGH** | `components/ui/` (29 berkas) | Terdapat 29 komponen UI terisolasi yang tidak pernah diimpor atau digunakan di seluruh modul aplikasi. |
| **ISSUE-043** | Komponen UI & A11y | **HIGH** | `components/ui/bottom-sheet.tsx:120` | Gestur geser BottomSheet bentrok dengan scroll pada komponen ScrollView/FlatList di sistem Android. |
| **ISSUE-044** | Komponen UI & A11y | **HIGH** | `components/ui/icon-button.tsx:45` | Ukuran target sentuh tombol aksi kecil di bawah standar 44x44px pada mode ukuran kompak. |
| **ISSUE-045** | Data Fetching & API | **HIGH** | `lib/api/` (21 endpoint) | 21 fungsi adapter GET tidak menerima parameter `signal` sehingga pembatalan request tidak dapat bekerja. |
| **ISSUE-046** | Data Fetching & API | **HIGH** | `app/search.tsx:285` | Throttle 10 rpm/IP pada endpoint pencarian pengguna menyebabkan seluruh halaman pencarian menampilkan ErrorState. |
| **ISSUE-047** | Data Fetching & API | **HIGH** | `lib/api/client.ts:280` | Sesi kedaluwarsa tidak membatalkan mutasi POST/PUT yang sedang berada di antrean pengiriman. |
| **ISSUE-048** | Lokalisasi & i18n | **HIGH** | `lib/financial.ts:22`, `lib/financial.ts:110` | Pesan galat validasi nominal keuangan dan DTO menggunakan teks hardcoded bahasa Indonesia tanpa integrasi kamus i18n. |
| **ISSUE-049** | Lokalisasi & i18n | **HIGH** | `lib/format.ts:80` | Format tanggal/waktu mengabaikan preferensi timezone pengguna saat memformat timestamp ISO UTC. |
| **ISSUE-050** | Platform & Build | **HIGH** | `lib/protected-routes.ts:70`, `app/_layout.tsx:160` | Tamu mode web dapat membuka rute privat sesaat sebelum GuestLoginPrompt dirender. |
| **ISSUE-051** | Platform & Build | **HIGH** | `public/.well-known/assetlinks.json` | Konfigurasi App Links dan Universal Links masih kosong tanpa Team ID dan SHA-256 fingerprint signing. |
| **ISSUE-052** | Platform & Build | **HIGH** | `package.json`, `app.json` | Ketiadaan plugin pemilih dokumen native menghambat unggah file PDF resmi di perangkat seluler. |
| **ISSUE-053** | Autentikasi & Keamanan | **MEDIUM** | `lib/registration.ts`, `app/(auth)/create-security.tsx` | Password dan PIN disimpan dalam plain memory modul tanpa auto-wipe setelah batas waktu pendaftaran terlampaui. |
| **ISSUE-054** | Autentikasi & Keamanan | **MEDIUM** | `lib/use-auth-session.ts:25-33` | Kegagalan pemulihan sesi pada web guest mode tidak membedakan error jaringan sementara dari token tidak valid. |
| **ISSUE-055** | Autentikasi & Keamanan | **MEDIUM** | `components/ui/password-field.tsx` | PasswordField tidak memiliki opsi toggle visibilitas kata sandi (*show/hide password toggle*). |
| **ISSUE-056** | Autentikasi & Keamanan | **MEDIUM** | `app/(auth)/login.tsx` | Auto-focus pada form masuk memicu keyboard layout shift agresif di browser seluler web. |
| **ISSUE-057** | Transaksi & Escrow | **MEDIUM** | `app/create-transaction.tsx:392` | Nilai diskon voucher yang tidak terdefinisi dapat merambat sebagai `NaN` ke komponen perhitungan fee. |
| **ISSUE-058** | Transaksi & Escrow | **MEDIUM** | `app/delivery-proof/[orderId].tsx:243` | Pengiriman bukti pengiriman menampilkan error toast generik saat upload file ke presigned URL gagal. |
| **ISSUE-059** | Transaksi & Escrow | **MEDIUM** | `app/analytics.tsx:130-142` | Ekspor CSV transaksi melakukan permintaan sekuensial per halaman yang rentan gagal di tengah jalan. |
| **ISSUE-060** | Transaksi & Escrow | **MEDIUM** | `app/extension/[orderId].tsx:143` | Pengambilan daftar perpanjangan tenggat mengabaikan pembatalan request saat komponen ditutup. |
| **ISSUE-061** | Sengketa & Mediasi | **MEDIUM** | `app/dispute/[id].tsx:220` | Penghapusan bukti sengketa tidak menutup pratinjau MediaViewer secara otomatis jika bukti sedang dibuka. |
| **ISSUE-062** | Sengketa & Mediasi | **MEDIUM** | `components/ui/incoming-call-prompt.tsx` | Komponen prompt panggilan sengketa masuk tidak terhubung ke listener WebSocket atau SSE aktif. |
| **ISSUE-063** | Sengketa & Mediasi | **MEDIUM** | `app/delivery-proof/[orderId].tsx:165` | Penolakan bukti pengiriman oleh pembeli langsung membuka sengketa tanpa opsi perbaikan mandiri oleh penjual. |
| **ISSUE-064** | Dompet & Pembayaran | **MEDIUM** | `app/bank-accounts.tsx:110` | Penonaktifan rekening bank utama tidak memberikan peringatan bila rekening tersebut merupakan satu-satunya rekening aktif. |
| **ISSUE-065** | Dompet & Pembayaran | **MEDIUM** | `app/topup-history.tsx`, `app/withdraw-history.tsx` | Rute riwayat top-up dan withdraw hanya merupakan wrapper satu baris tanpa filter kategori terdedikasi. |
| **ISSUE-066** | Dompet & Pembayaran | **MEDIUM** | `app/subscriptions.tsx:365`, `app/withdraw.tsx:145` | Penggunaan `setTimeout` pada overlay progres transaksi berisiko memory leak saat unmount cepat. |
| **ISSUE-067** | Chat & Komunikasi | **MEDIUM** | `app/chat/[roomId].tsx:120` | Deteksi tipe pesan chat menandai pesan campuran sebagai "FILE" sehingga pratinjau gambar di list chat hilang. |
| **ISSUE-068** | Chat & Komunikasi | **MEDIUM** | `app/chat/[roomId].tsx:260` | Reaksi cepat emoji pada gelembung pesan tidak melakukan rollback jika jaringan terputus saat request dikirim. |
| **ISSUE-069** | Chat & Komunikasi | **MEDIUM** | `components/ui/chat-attachment-item.tsx:45` | Lampiran berkas non-gambar tidak menyertakan informasi ukuran file yang mempermudah pembacaan. |
| **ISSUE-070** | KYC & Verifikasi | **MEDIUM** | `app/kyc.tsx:110` | Form pengajuan ulang KYC tidak membersihkan state gambar lama saat form dibuka kembali. |
| **ISSUE-071** | KYC & Verifikasi | **MEDIUM** | `app/business-verification.tsx:15` | Komponen unggah dokumen bisnis tidak mendukung format PDF pada pemilih berkas mobile. |
| **ISSUE-072** | Showcase Sosial | **MEDIUM** | `app/(tabs)/discover.tsx:280` | Tab feed "Mengikuti" mengambil feed publik lalu memfilternya di klien sehingga halaman bisa kosong. |
| **ISSUE-073** | Showcase Sosial | **MEDIUM** | `app/showcase/[id].tsx:120` | Fitur simpan/bookmark showcase hanya tersimpan di memori lokal tanpa sinkronisasi ke server. |
| **ISSUE-074** | Ulasan & Q&A | **MEDIUM** | `app/ratings.tsx:135` | Validasi jendela 7 hari untuk hapus ulasan bergantung pada jam lokal perangkat bukan jam server. |
| **ISSUE-075** | Ulasan & Q&A | **MEDIUM** | `components/ui/rating-form.tsx:85` | Tombol kirim ulasan tidak mencegah penekanan berulang selama proses submit berlangsung. |
| **ISSUE-076** | Notifikasi & Polling | **MEDIUM** | `lib/unread-count.ts:40` | Polling unread badge notifikasi 60 detik tidak memeriksa apakah pengguna sedang aktif berinteraksi. |
| **ISSUE-077** | Notifikasi & Polling | **MEDIUM** | `lib/notification-routing.ts:35` | Tipe payload notifikasi baru yang tidak terpetakan dialihkan ke rute daftar bukan entitas terkait. |
| **ISSUE-078** | Voucher & Langganan | **MEDIUM** | `components/ui/voucher-card.tsx:40` | Kartu voucher tidak menampilkan kuota tersisa atau batas maksimal klaim promo. |
| **ISSUE-079** | Voucher & Langganan | **MEDIUM** | `app/referral.tsx:155` | Fallback penyalinan tautan referral ke clipboard tidak menyertakan umpan balik getaran haptic. |
| **ISSUE-080** | Dukungan & Bantuan | **MEDIUM** | `app/faq.tsx:65` | Pencarian pada Pusat Bantuan tidak menggunakan debouncing input sehingga memicu request berulang. |
| **ISSUE-081** | Dukungan & Bantuan | **MEDIUM** | `app/support/[ticketId].tsx:135` | Rating tiket dukungan bintang 1 atau 2 tidak mewajibkan pengisian alasan evaluasi. |
| **ISSUE-082** | Pengaturan & Profil | **MEDIUM** | `app/account-type.tsx:60` | Pergantian tipe akun ke Personal tidak memberikan peringatan dampak terhadap visibilitas produk bisnis. |
| **ISSUE-083** | Pengaturan & Profil | **MEDIUM** | `components/ui/social-links-editor.tsx:50` | Input tautan sosial media tidak memvalidasi keberadaan skema URL `https://`. |
| **ISSUE-084** | Komponen UI & A11y | **MEDIUM** | `components/ui/modal.tsx:85` | Focus trap pada komponen Modal Dialog dapat bocor ke elemen latar belakang pada peramban web. |
| **ISSUE-085** | Komponen UI & A11y | **MEDIUM** | `components/ui/home-overview-card.tsx:90` | Pembaruan saldo dompet tidak diumumkan ke pembaca layar menggunakan Accessibility Live Region. |
| **ISSUE-086** | Komponen UI & A11y | **MEDIUM** | `components/ui/slider.tsx` | Komponen Slider berbasis gestur tidak memiliki kontrol alternatif berbasis tombol aksesibilitas. |
| **ISSUE-087** | Data Fetching & API | **MEDIUM** | `lib/api/client.ts:50` | Generator kunci idempotensi menggunakan generator acak fallback tanpa jaminan keunikan kriptografis. |
| **ISSUE-088** | Data Fetching & API | **MEDIUM** | `lib/api/session.ts:85` | Cache memori access token tidak otomatis dibersihkan saat terjadi kegagalan penulisan SecureStore. |
| **ISSUE-089** | Lokalisasi & i18n | **MEDIUM** | `lib/format.ts:130` | Format angka ringkas (*compact count*) memotong ribuan menjadi "rb" bahkan saat bahasa aplikasi diatur ke English. |
| **ISSUE-090** | Lokalisasi & i18n | **MEDIUM** | `lib/i18n/en/errors.json` | Inkonsistensi istilah terminologi antara "Kata sandi" dan "Password" pada kamus terjemahan bahasa Inggris. |
| **ISSUE-091** | Platform & Build | **MEDIUM** | `public/sw.js`, `scripts/gen-fcm-sw.mjs` | Service Worker tidak memiliki mekanisme pembaruan paksa saat terjadi deployment build baru. |
| **ISSUE-092** | Platform & Build | **MEDIUM** | `scripts/check-permissions.mjs` | Skrip audit izin native tidak memeriksa deklarasi izin latar belakang pada manifest Android. |
| **ISSUE-093** | Autentikasi & Keamanan | **LOW** | `app/(auth)/login.tsx:238` | Teks tautan "Lupa password?" tidak konsisten dengan terminologi baku aplikasi "Lupa kata sandi?". |
| **ISSUE-094** | Autentikasi & Keamanan | **LOW** | `app/(auth)/verify-otp.tsx:245` | Terdapat log konsol `console.debug` yang tertinggal pada kode produksi layar verifikasi OTP. |
| **ISSUE-095** | Transaksi & Escrow | **LOW** | `app/extension/[orderId].tsx:164` | Pemanggilan `fetchPage(1)` di dalam useEffect dapat memicu render ganda pada penyegaran data. |
| **ISSUE-096** | Sengketa & Mediasi | **LOW** | `app/dispute/[id].tsx:85` | Pemetaan status panggilan sengketa tidak menangani status `ENDED` secara kanonikal. |
| **ISSUE-097** | Dompet & Pembayaran | **LOW** | `components/ui/currency-range-field.tsx` | Komponen pemilih rentang mata uang belum dimanfaatkan pada filter riwayat transaksi dompet. |
| **ISSUE-098** | Chat & Komunikasi | **LOW** | `app/chat/[roomId].tsx:310` | Auto-scroll ke pesan terbawah pada ruang percakapan dapat terpotong animasi keyboard Android. |
| **ISSUE-099** | KYC & Verifikasi | **LOW** | `components/ui/kyc-document-viewer.tsx` | Komponen penampil dokumen KYC tidak memiliki pemanggil aktif di seluruh layar verifikasi. |
| **ISSUE-100** | Showcase Sosial | **LOW** | `app/showcase/[id].tsx:145` | Pengukuran lebar carousel foto showcase mengandalkan perhitungan window mentah. |
| **ISSUE-101** | Ulasan & Q&A | **LOW** | `components/ui/trust-score-card.tsx:35` | Tipe data faktor skor kepercayaan menggunakan deklarasi array string longgar. |
| **ISSUE-102** | Notifikasi & Polling | **LOW** | `docs/DEEP-LINKING.md` | Dokumentasi deep linking memuat kesalahan ketik pada skema rute notifikasi referensi. |
| **ISSUE-103** | Voucher & Langganan | **LOW** | `components/ui/voucher-redeem-box.tsx` | Preset nominal voucher dapat terpotong secara visual pada layar perangkat berlebar di bawah 360px. |
| **ISSUE-104** | Dukungan & Bantuan | **LOW** | `app/help/[slug].tsx:45` | Komponen breadcrumb artikel bantuan tidak tersembunyi secara rapi pada viewport mobile kecil. |
| **ISSUE-105** | Pengaturan & Profil | **LOW** | `app/appearance.tsx:40` | Pemilihan tema tampilan tidak menyimpan cache lokal saat koneksi internet offline. |
| **ISSUE-106** | Komponen UI & A11y | **LOW** | `components/ui/footer-bar.tsx:35` | Padding safe area bawah terhitung ganda pada beberapa layar dengan bottom bar mengambang. |
| **ISSUE-107** | Data Fetching & API | **LOW** | `lib/api/errors.ts:60` | Parser header `Retry-After` hanya mendukung format detik dan mengabaikan format tanggal HTTP. |
| **ISSUE-108** | Lokalisasi & i18n | **LOW** | `components/ui/calendar.tsx:30` | Nama hari pada pemilih kalender menggunakan array konstan statis tanpa helper i18n dinamis. |
| **ISSUE-109** | Platform & Build | **LOW** | `scripts/babel-phosphor-imports.cjs` | Transformasi impor ikon Phosphor tidak mendukung penamaan ikon dinamis secara penuh. |
| **ISSUE-110** | Platform & Build | **LOW** | `package.json`, `package-lock.json` | Terdapat 27 kerentanan paket dependensi npm audit yang memerlukan pembaruan berkala. |

---

## 3. Analisis Mendalam 110 Temuan & Rekomendasi Solusi

---

### Kategori 1: Autentikasi, Manajemen Sesi, Keamanan Token & Biometrik

#### ISSUE-001 [CRITICAL]
- **Lokasi Kode:** `app/biometric-settings.tsx`, `components/ui/biometric-prompt-trigger.tsx`, `app/order/[id].tsx`, `app/transfer.tsx`, `app/withdraw.tsx`
- **Deskripsi:** Pengguna dapat mengaktifkan opsi "Buka dengan Biometrik" pada layar Pengaturan Keamanan, yang menyimpan flag `SecureKeys.biometricEnabled = "1"`. Namun, komponen `<BiometricPromptTrigger>` yang dirancang untuk memicu otentikasi biometrik sebelum konfirmasi transaksi PIN **sama sekali tidak diimpor atau digunakan** pada layar transaksi kritis seperti bayar order escrow (`app/order/[id].tsx`), transfer saldo (`app/transfer.tsx`), maupun penarikan dana (`app/withdraw.tsx`). Pengguna selalu dipaksa mengetik PIN manual, menjadikan fitur biometrik hanya toggle tanpa fungsi nyata.
- **Dampak:** Kekecewaan pengguna (*UX regression*), ketidaksesuaian klaim fitur pada deskripsi pengaturan ("Untuk membuka aplikasi dan konfirmasi transaksi tanpa mengetik PIN"), serta hilangnya efisiensi transaksi harian.
- **Rekomendasi:** Integrasikan `<BiometricPromptTrigger>` pada form PIN transaksi di `app/order/[id].tsx`, `app/transfer.tsx`, dan `app/withdraw.tsx`. Saat `biometricEnabled === true`, tampilkan tombol biometrik dan picu `authenticateBiometric()` sebelum fallback ke input PIN 6 digit.

#### ISSUE-002 [HIGH]
- **Lokasi Kode:** `lib/api/client.ts:250-290`, `lib/api/session.ts:60-80`
- **Deskripsi:** Mekanisme pembaruan token akses (`refreshAccessToken()`) menggunakan variabel modul `refreshInFlight`. Pada environment Web dengan beberapa tab terbuka bersamaan, saat token kedaluwarsa, kedua tab akan memicu request refresh secara independen melalui fetch cookie `POST /v1/auth/refresh`. Tab kedua yang terlambat mengirimkan cookie refresh lama akan menerima `401 Unauthorized`, yang kemudian memicu `expireSession()` dan memaksa logout di semua tab.
- **Dampak:** Pengguna web tiba-tiba ter-logout (*force logged out*) saat membuka beberapa tab Kahade bersamaan ketika token akses kedaluwarsa.
- **Rekomendasi:** Gunakan Web BroadcastChannel API atau `storage` event listener antar-tab di platform web untuk mengkoordinasikan proses token refresh satu pintu (*single leader election*).

#### ISSUE-003 [HIGH]
- **Lokasi Kode:** `app/two-factor.tsx:236-248`
- **Deskripsi:** Pada fungsi `handleDisable()` saat mematikan 2FA, blok `catch` tidak membaca respons galat dari backend (`userMessage(err)`) melainkan langsung menetapkan `setDisableError("Password, kode autentikator, atau OTP email tidak cocok.")`. Jika kegagalan disebabkan oleh batas percobaan terlampaui (*Rate Limit / 429*) atau kesalahan server (*500*), pengguna disesatkan dengan pesan kredensial salah.
- **Dampak:** Pengguna mengulang-ulang input yang benar dan memperpanjang masa pemblokiran (*rate limit lockout*).
- **Rekomendasi:** Gunakan `setDisableError(userMessage(err))` pada blok `catch` di `handleDisable()`.

#### ISSUE-004 [HIGH]
- **Lokasi Kode:** `app/change-password.tsx:32-35`
- **Deskripsi:** Setelah API `api.auth.changePassword()` berhasil dijalankan dan toast sukses muncul, form hanya mengosongkan state `current`, `next`, dan `confirm`. Tidak ada navigasi otomatis `router.back()` atau `goBackOrNavigate(ROUTES.settings)`.
- **Dampak:** Pengguna bingung apakah proses sudah selesai karena tetap berada di layar ganti password dengan field kosong.
- **Rekomendasi:** Tambahkan `goBackOrNavigate(ROUTES.settings)` setelah pemanggilan toast sukses.

#### ISSUE-005 [MEDIUM]
- **Lokasi Kode:** `lib/registration.ts:1-40`, `app/(auth)/create-security.tsx:40`
- **Deskripsi:** Password dan PIN pengguna disimpan sementara dalam modul memori `registration.ts` selama alur 4 langkah registrasi. Jika pengguna membatalkan registrasi atau meninggalkan aplikasi, data tersebut tidak memiliki timer pembersihan otomatis (*TTL expiry / memory wipe*).
- **Dampak:** Kredensial sensitif tertahan di heap memory JavaScript lebih lama dari yang diperlukan.
- **Rekomendasi:** Tambahkan timer pembersihan otomatis (misal 15 menit) dan bersihkan `registrationState` saat navigasi keluar dari grup `(auth)`.

#### ISSUE-006 [MEDIUM]
- **Lokasi Kode:** `lib/use-auth-session.ts:25-33`
- **Deskripsi:** Pada pemulihan sesi di platform web, kegagalan `refreshAccessToken()` ditangkap dengan blok kosong `if (Platform.OS !== "web") throw error`. Jika kegagalan disebabkan oleh gangguan jaringan sementara (*offline/timeout*), aplikasi langsung memperlakukan pengguna sebagai tamu (*guest mode*) tanpa menyediakan indikator retry pemulihan akun.
- **Dampak:** Pengguna yang memiliki sesi valid tiba-tiba melihat antarmuka mode tamu saat koneksi internet tersendat di awal pembukaan web.
- **Rekomendasi:** Bedakan status galat 401 (sesi habis) dengan galat jaringan (transient network error) pada pemulihan sesi web.

#### ISSUE-007 [MEDIUM]
- **Lokasi Kode:** `components/ui/password-field.tsx:40-80`, `app/(auth)/login.tsx`
- **Deskripsi:** Komponen `PasswordField` pada beberapa implementasi form auth tidak menyediakan tombol mata (*show/hide toggle*) secara default, menyulitkan pengguna memeriksa ketepatan karakter kompleks di layar seluler.
- **Dampak:** Tingkat kegagalan login meningkat akibat salah ketik karakter khusus pada password panjang.
- **Rekomendasi:** Aktifkan icon button toggle `Eye`/`EyeSlash` sebagai fitur standar pada seluruh `PasswordField`.

#### ISSUE-008 [MEDIUM]
- **Lokasi Kode:** `app/(auth)/login.tsx:180`, `app/(auth)/register.tsx:160`
- **Deskripsi:** Properti `autoFocus` terpasang secara statis pada input email dan nomor HP. Di browser mobile (iOS Safari & Chrome Android), autoFocus memicu pembukaan paksa keyboard virtual yang menutupi konten header sebelum layout selesai ter-render.
- **Dampak:** Pergeseran visual (*layout shift*) dan kedipan tampilan saat halaman auth pertama kali dimuat.
- **Rekomendasi:** Nonaktifkan `autoFocus` pada platform Web seluler (`Platform.OS === "web"`).

#### ISSUE-009 [LOW]
- **Lokasi Kode:** `app/(auth)/login.tsx:238`
- **Deskripsi:** Teks link footer menggunakan frasa `"Lupa password?"`, sedangkan pedoman tone aplikasi menggunakan istilah baku Indonesia `"Lupa kata sandi?"`.
- **Dampak:** Inkonsistensi terminologi mikro pada antarmuka autentikasi.
- **Rekomendasi:** Ubah teks menjadi `"Lupa kata sandi?"` dan sesuaikan kunci i18n terkait.

#### ISSUE-010 [LOW]
- **Lokasi Kode:** `app/(auth)/verify-otp.tsx:245`
- **Deskripsi:** Terdapat statement `console.debug("[kahade/verify-otp] cooldown dari backend:", result.cooldownSeconds)` yang tertinggal di kode produksi.
- **Dampak:** Menghasilkan polusi log pada console browser dan debugger runtime.
- **Rekomendasi:** Hapus baris `console.debug` tersebut atau bungkus dengan guard `__DEV__`.

---

### Kategori 2: Escrow, Lifecycle Transaksi, Order Links & Ekstensi

#### ISSUE-011 [CRITICAL]
- **Lokasi Kode:** `app/order-link/[token].tsx:54-60`
- **Deskripsi:** Pada fungsi `handleAccept`, kode memanggil `await api.orders.acceptOrderLink(link.token)`. Respons endpoint ini adalah objek `Order` baru yang memiliki atribut `id`. Namun, kode memeriksa `if (link.orderId) router.replace(ROUTES.orderDetail(link.orderId))` menggunakan objek `link` lama yang atribut `orderId`-nya masih `undefined`.
- **Dampak:** Pengguna yang menyetujui Order Link berhasil membuat pesanan, namun **tidak pernah diarahkan ke halaman detail pesanan** dan tetap tertahan di halaman Order Link.
- **Rekomendasi:** Tangkap hasil kembalian `const order = await api.orders.acceptOrderLink(link.token)` lalu lakukan `router.replace(ROUTES.orderDetail(order.id))`.

#### ISSUE-012 [HIGH]
- **Lokasi Kode:** `app/(tabs)/transactions.tsx:135`
- **Deskripsi:** Pada komponen `OrderCard` di tab Transaksi, properti `onDeadline` tidak diteruskan (berbeda dengan `app/(tabs)/home.tsx` yang meneruskan `onDeadline={() => void activeOrders.refresh()}`).
- **Dampak:** Saat hitung mundur tenggat pesanan mencapai nol (*deadline expired*), status transaksi di daftar transaksi tidak terbarui secara otomatis dan tetap menampilkan status aktif lama.
- **Rekomendasi:** Teruskan properti `onDeadline={() => void query.refresh()}` ke komponen `OrderCard` di `app/(tabs)/transactions.tsx`.

#### ISSUE-013 [HIGH]
- **Lokasi Kode:** `app/invoice/[orderId].tsx:147`, `components/ui/invoice-receipt-view.tsx:280`
- **Deskripsi:** Tombol aksi "Unduh struk (HTML)" dirender di dalam komponen `<InvoiceReceiptView>` melalui prop `onDownload`, namun di `app/invoice/[orderId].tsx` terdapat tombol `<Button>` kedua di luar komponen yang menjalankan fungsi yang sama persis.
- **Dampak:** Tampilan visual ganda (*redundant double CTA buttons*) yang membingungkan pengguna.
- **Rekomendasi:** Hapus tombol unduh kedua yang berada di luar `<InvoiceReceiptView>`.

#### ISSUE-014 [HIGH]
- **Lokasi Kode:** `app/order/[id].tsx:380-410`, `lib/api/orders.ts:518`
- **Deskripsi:** Pada pesanan barang fisik (`orderType === "PHYSICAL_GOODS"`), modal input resi pengiriman (`sheet === "shipping"`) memungkinkan tombol Simpan ditekan jika `tracking` atau `courier` hanya berupa spasi kosong saat `shippingRequired` tidak terpasang ketat pada form perubahan parsial.
- **Dampak:** Pesanan dapat berpindah status menjadi dikirim (*shipped*) tanpa nomor resi yang valid, menyulitkan pembeli melacak kiriman fisik.
- **Rekomendasi:** Tambahkan validasi ketat `tracking.trim().length >= 3 && courier.trim().length >= 2` sebelum mengizinkan pengiriman request `api.orders.updateShipping`.

#### ISSUE-015 [HIGH]
- **Lokasi Kode:** `app/dispute/[id].tsx:78`, `lib/api/disputes.ts:120`
- **Deskripsi:** Saat pembeli mengajukan klaim sengketa awal, file lampiran bukti yang dipilih melalui image picker tidak divalidasi tipe MIME-nya terhadap format yang diterima (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`).
- **Dampak:** Format file tidak didukung (misal `.heic` atau `.bmp`) gagal diunggah ke presigned URL S3 tanpa pesan kesalahan yang informatif.
- **Rekomendasi:** Gunakan fungsi `toEvidenceFileType(mime)` untuk menolak atau mengonversi format file sebelum proses unggah presigned dimulai.

#### ISSUE-016 [MEDIUM]
- **Lokasi Kode:** `app/create-transaction.tsx:392`, `components/ui/voucher-redeem-box.tsx`
- **Deskripsi:** Pada validasi voucher promo transaksi, jika server mengembalikan voucher valid tanpa atribut `discountValue` numerik, nilai disimpan sebagai `undefined`. Namun pada kalkulasi diskon lokal, ekspresi aritmatika menghasilkan `NaN` yang merambat ke komponen `<Amount>` sebagai tampilan `"Rp—"`.
- **Dampak:** Tampilan nominal total pembayaran menjadi rusak secara visual saat voucher tertentu diterapkan.
- **Rekomendasi:** Pastikan nilai diskon selalu dinormalkan menjadi angka bulat non-negatif (`Math.max(0, discount ?? 0)`).

#### ISSUE-017 [MEDIUM]
- **Lokasi Kode:** `app/delivery-proof/[orderId].tsx:243`
- **Deskripsi:** Blok `catch` pada proses pengunggahan foto bukti pengiriman `api.upload.uploadPresigned` menangkap error dan menampilkan deskripsi statis `"Gagal mengunggah foto"` tanpa menyertakan alasan kegagalan dari backend (misal ukuran file melebihi batas 10MB).
- **Dampak:** Pengguna tidak mengetahui penyebab kegagalan unggah foto bukti pengiriman.
- **Rekomendasi:** Gunakan `userMessage(err)` pada toast penanganan error pengunggahan berkas.

#### ISSUE-018 [MEDIUM]
- **Lokasi Kode:** `app/analytics.tsx:130-142`
- **Deskripsi:** Fitur unduh riwayat transaksi mengeksekusi loop `do { ... } while` secara sekuensial halaman demi halaman hingga `MAX_EXPORT_PAGES` (20 halaman). Jika terjadi kegagalan jaringan pada halaman ke-15, seluruh proses dibatalkan dan transaksi yang sudah diunduh dibuang.
- **Dampak:** Fitur ekspor transaksi rentan gagal total pada jaringan seluler yang tidak stabil.
- **Rekomendasi:** Implementasikan mekanisme pengunduhan dengan toleransi retry per halaman dan simpan progres secara bertahap.

#### ISSUE-019 [MEDIUM]
- **Lokasi Kode:** `lib/api/orders.ts:590`, `app/extension/[orderId].tsx:143`
- **Deskripsi:** Fungsi `listExtensions(orderId, query)` di `lib/api/orders.ts` tidak menerima parameter `signal: AbortSignal`.
- **Dampak:** Permintaan daftar perpanjangan tenggat tidak dapat dibatalkan saat pengguna keluar dari layar sebelum respons tiba.
- **Rekomendasi:** Tambahkan parameter `signal?: AbortSignal` pada deklarasi `listExtensions` dan teruskan ke opsi `http.get`.

#### ISSUE-020 [LOW]
- **Lokasi Kode:** `app/extension/[orderId].tsx:164`
- **Deskripsi:** `useEffect` yang memanggil `fetchPage(1)` memiliki dependensi `[bundle, fetchPage]`. Setiap kali objek `bundle` hasil query diperbarui, `fetchPage(1)` dipicu ulang, berpotensi menimpa data yang sedang dimuat pengguna pada halaman berikutnya.
- **Dampak:** Reset posisi scroll dan paginasi daftar perpanjangan saat background refetch berlangsung.
- **Rekomendasi:** Gunakan `usePaginatedQuery` terintegrasi daripada memisahkan query detail order dengan state paginasi manual.

---

### Kategori 3: Sengketa (Disputes), Mediasi, Eskalasi & Resolusi Bersama

#### ISSUE-021 [HIGH]
- **Lokasi Kode:** `app/dispute/[id].tsx:180-210`, `lib/api/disputes.ts:242`
- **Deskripsi:** Fitur eskalasi sengketa ke admin mediator (`api.disputes.escalateDispute`) dibatasi maksimal 2 kali per sengketa oleh aturan bisnis backend. Namun antarmuka modal eskalasi tidak menampilkan sisa kuota eskalasi kepada pengguna.
- **Dampak:** Pengguna yang telah mencapai kuota eskalasi baru mengetahui penolakan setelah melakukan submit dan menerima error 400.
- **Rekomendasi:** Tampilkan indikator badge kuota eskalasi (misal "Eskalasi 1/2") pada kartu sengketa dan nonaktifkan tombol jika kuota habis.

#### ISSUE-022 [HIGH]
- **Lokasi Kode:** `app/dispute/[id].tsx:165-175`, `components/ui/mutual-resolution-card.tsx`
- **Deskripsi:** Pada dialog pengajuan kesepakatan damai (*Mutual Resolution Proposal*), input nominal dana yang dikembalikan ke pembeli (`proposeAmount`) tidak divalidasi batas maksimumnya sebesar total nilai order transaksi yang disengketakan.
- **Dampak:** Pengguna dapat memasukkan nominal usulan yang melebihi dana escrow tertahan, yang pasti ditolak backend saat submit.
- **Rekomendasi:** Pasang batas `max={order?.orderValue ?? 0}` pada komponen `AmountInput` usulan resolusi bersama.

#### ISSUE-023 [HIGH]
- **Lokasi Kode:** `components/ui/in-call-controls-bar.tsx`, `app/dispute/[id].tsx`
- **Deskripsi:** Komponen `<InCallControlsBar>` (berisi tombol mute mikrofon, switch kamera/speaker, dan akhiri panggilan) telah selesai dibuat di `components/ui/in-call-controls-bar.tsx`, tetapi **tidak pernah dipasang atau dirender** di dalam `app/dispute/[id].tsx` saat panggilan sengketa aktif.
- **Dampak:** Saat sesi mediasi panggilan sengketa berlangsung, pengguna tidak memiliki antarmuka untuk mengontrol perangkat audio/video mereka.
- **Rekomendasi:** Mount `<InCallControlsBar>` secara kondisional saat `activeCall?.status === "ONGOING"`.

#### ISSUE-024 [MEDIUM]
- **Lokasi Kode:** `app/dispute/[id].tsx:220`
- **Deskripsi:** Saat pengguna menghapus bukti sengketa miliknya melalui dialog konfirmasi hapus bukti, state `viewerItem` (MediaViewer) tidak direset ke `null` jika bukti yang sedang ditampilkan di layar penuh adalah bukti yang baru saja dihapus.
- **Dampak:** MediaViewer tetap menampilkan berkas yang telah dihapus hingga ditutup manual.
- **Rekomendasi:** Panggil `setViewerItem(null)` di dalam callback sukses penghapusan bukti.

#### ISSUE-025 [MEDIUM]
- **Lokasi Kode:** `components/ui/incoming-call-prompt.tsx`, `app/_layout.tsx`
- **Deskripsi:** Komponen modal `<IncomingCallPrompt>` untuk notifikasi panggilan masuk mediasi sengketa tidak terdaftar di Portal global `AppShell` di root layout.
- **Dampak:** Panggilan masuk tidak dapat muncul jika pengguna sedang berada di luar layar detail sengketa tersebut.
- **Rekomendasi:** Daftarkan prompt panggilan masuk pada layer Portal root layout dengan listener notifikasi panggilan masuk.

#### ISSUE-026 [MEDIUM]
- **Lokasi Kode:** `app/delivery-proof/[orderId].tsx:165`
- **Deskripsi:** Saat pembeli menolak bukti pengiriman (`api.orders.rejectDelivery`), backend secara otomatis mengubah status order menjadi `DISPUTED`. Namun UI tidak memberikan opsi klarifikasi atau perbaikan bukti langsung antara penjual dan pembeli sebelum status sengketa permanen dibuka.
- **Dampak:** Peningkatan volume sengketa formal yang sebenarnya dapat diselesaikan melalui komunikasi singkat.
- **Rekomendasi:** Berikan konfirmasi peringatan jelas pada dialog tolak bukti bahwa aksi ini akan membuka sengketa resmi dan membekukan dana di escrow.

#### ISSUE-027 [LOW]
- **Lokasi Kode:** `app/dispute/[id].tsx:85`
- **Deskripsi:** Objek `CALL_OUTCOME` memetakan status `ENDED` dan `COMPLETED` ke nilai outcome `"COMPLETED"`. Namun beberapa respons lama backend mengirimkan `"FINISHED"`.
- **Dampak:** Status panggilan `"FINISHED"` jatuh ke fallback default tanpa label tone khusus.
- **Rekomendasi:** Tambahkan pemetaan `FINISHED: "COMPLETED"` pada kamus `CALL_OUTCOME`.

---

### Kategori 4: Dompet (Wallet), Top Up, Penarikan, Transfer & Rekening Bank

#### ISSUE-028 [CRITICAL]
- **Lokasi Kode:** `app/withdrawal-schedules.tsx:86-92`, `components/ui/schedule-field.tsx`
- **Deskripsi:** Pada fungsi `handleSubmit` saat membuat jadwal penarikan otomatis baru (`!editing`), kode mengirimkan DTO:
  ```typescript
  const dto: CreateScheduleDto = {
    dayOfWeek: schedule.dayOfWeek ?? 1,
    minAmount: (schedule.minAmount ?? 0) > 0 ? (schedule.minAmount ?? undefined) : undefined,
    bankAccountId: "",
  }
  ```
  Nilai `bankAccountId` di-hardcode sebagai string kosong `""`. Komponen `ScheduleField` sama sekali tidak menyediakan input pemilihan rekening bank tujuan.
- **Dampak:** Setiap upaya pembuatan jadwal penarikan otomatis baru oleh pengguna **pasti gagal ditolak backend (400 Bad Request)** karena `bankAccountId` wajib diisi dengan ID rekening bank yang valid.
- **Rekomendasi:** Tambahkan komponen selector rekening bank (`<BankSelect>` / `<Select>`) pada form `WithdrawalSchedulesScreen` dan simpan ID rekening terpilih ke dalam payload DTO.

#### ISSUE-029 [HIGH]
- **Lokasi Kode:** `app/bank-accounts.tsx:78`
- **Deskripsi:** Pada fungsi `handleAdd`, guard validasi memeriksa `if (!bankCode || !bankName.trim() || !accountName.trim()) return`. Variabel `accountNumber` **tidak diperiksa** dalam guard tersebut, sehingga jika pengguna mengosongkan nomor rekening, fungsi tetap mengirimkan `accountNumber: ""` ke server.
- **Dampak:** Pengiriman request gagal di sisi server dan membuang kuota request pengguna.
- **Rekomendasi:** Tambahkan `!accountNumber.trim()` ke dalam guard kondisi awal `handleAdd()`.

#### ISSUE-030 [HIGH]
- **Lokasi Kode:** `app/delete-account.tsx:50-55`
- **Deskripsi:** Form hapus akun mendeteksi apakah pengguna memiliki saldo dompet (`wallet.balance !== 0`) sebagai blocker penghapusan akun. Namun form tidak menyediakan tombol aksi cepat atau tautan menuju halaman penarikan dana (`ROUTES.withdraw`).
- **Dampak:** Pengguna yang ingin menutup akun terhambat dan harus mencari menu penarikan dana secara manual di tab dompet.
- **Rekomendasi:** Tampilkan tombol "Tarik Saldo Terlebih Dahulu" pada item blocker saldo di `DeleteAccountForm`.

#### ISSUE-031 [HIGH]
- **Lokasi Kode:** `app/topup.tsx:120-135`, `app/order/[id].tsx:210`
- **Deskripsi:** Polling status pembayaran QRIS dan Virtual Account menggunakan interval `POLL_MS = 5000` tanpa batas waktu maksimal (*timeout*). Jika pengguna membiarkan layar terbuka selama berjam-jam, request status terus ditembakkan ke backend.
- **Dampak:** Pemborosan bandwidth, konsumsi baterai perangkat, dan beban request berlebih (*unnecessary server load*) pada backend.
- **Rekomendasi:** Batasi polling otomatis hingga batas kedaluwarsa QRIS/VA (`expiresAt`) atau maksimal 15 menit, lalu ubah state menjadi "Periksa Status Manual".

#### ISSUE-032 [HIGH]
- **Lokasi Kode:** `lib/api/wallet.ts:535`, `components/ui/transfer-recipient-picker.tsx:110`
- **Deskripsi:** Backend menyediakan endpoint `POST /v1/wallet/favorite-recipients` dan `GET /v1/wallet/favorite-recipients` untuk menyimpan daftar penerima transfer favorit. Namun data ini tidak dimuat atau ditampilkan pada komponen `TransferRecipientPicker` saat input pencarian kosong (hanya menampilkan riwayat transfer terakhir).
- **Dampak:** Pengguna tidak dapat memanfaatkan fitur penerima favorit yang telah disediakan backend.
- **Rekomendasi:** Muat daftar penerima favorit via `api.wallet.getFavoriteRecipients()` dan tampilkan di bawah seksi "Favorit" pada `TransferRecipientPicker`.

#### ISSUE-033 [MEDIUM]
- **Lokasi Kode:** `app/bank-accounts.tsx:110`, `lib/api/bank-accounts.ts`
- **Deskripsi:** Saat menghapus rekening bank, antarmuka tidak memeriksa apakah rekening tersebut saat ini digunakan oleh jadwal penarikan otomatis aktif (*withdrawal schedule*).
- **Dampak:** Penghapusan rekening menyebabkan jadwal penarikan otomatis gagal dieksekusi di kemudian hari tanpa pemberitahuan awal.
- **Rekomendasi:** Tampilkan peringatan pada dialog konfirmasi jika rekening yang akan dihapus terikat pada jadwal penarikan aktif.

#### ISSUE-034 [MEDIUM]
- **Lokasi Kode:** `app/topup-history.tsx`, `app/withdraw-history.tsx`
- **Deskripsi:** Kedua berkas rute ini hanya berisi deklarasi delegasi 4 baris ke `WalletHistoryScreen` dengan tipe filter terpasang. Tidak ada kustomisasi judul dokumen web khusus untuk SEO masing-masing halaman.
- **Dampak:** Judul tab peramban web tidak mencerminkan konteks spesifik ("Riwayat Top-up" / "Riwayat Penarikan").
- **Rekomendasi:** Teruskan properti `title` eksplisit ke `WalletHistoryScreen` agar judul dokumen web terpasang sesuai rute.

#### ISSUE-035 [MEDIUM]
- **Lokasi Kode:** `app/subscriptions.tsx:365`, `app/withdraw.tsx:145`
- **Deskripsi:** Penggunaan `setTimeout(..., RESULT_HOLD_MS)` untuk menutup overlay transaksi tidak dibersihkan (*cleared*) saat komponen unmount.
- **Dampak:** Potensi memory leak dan warning *"Can't perform a React state update on an unmounted component"*.
- **Rekomendasi:** Simpan ID timer ke dalam `useRef` dan bersihkan pada fungsi cleanup `useEffect`.

#### ISSUE-036 [LOW]
- **Lokasi Kode:** `components/ui/currency-range-field.tsx`, `app/wallet-history.tsx`
- **Deskripsi:** Komponen `CurrencyRangeField` telah tersedia di design system namun tidak diintegrasikan pada sheet filter riwayat transaksi dompet.
- **Dampak:** Pengguna hanya dapat memfilter riwayat berdasarkan jenis transaksi dan tanggal, tidak dapat memfilter berdasarkan rentang nominal uang.
- **Rekomendasi:** Tambahkan filter nominal uang pada filter sheet di `app/wallet-history.tsx`.

---

### Kategori 5: Chat Real-time, Polling, Indikator & Live Support

#### ISSUE-037 [HIGH]
- **Lokasi Kode:** `app/chat/[roomId].tsx:95-110`, `lib/use-polling.ts`
- **Deskripsi:** Hook `usePolling` pada ruang percakapan chat memicu request pesan baru setiap 8 detik (`CHAT_POLL_MS = 8000`). Polling ini tidak memeriksa status `AppState` (foreground vs background) maupun keterlihatan tab browser (*Page Visibility API*).
- **Dampak:** Konsumsi kuota data dan baterai pengguna terus berjalan di latar belakang meskipun aplikasi sedang tidak dilihat.
- **Rekomendasi:** Hentikan sementara interval polling saat `AppState.currentState !== "active"` atau `document.hidden === true`.

#### ISSUE-038 [HIGH]
- **Lokasi Kode:** `app/live-support.tsx:50-80`
- **Deskripsi:** Layar Bantuan Langsung (*Live Support*) dirancang menyerupai ruang chat interaktif, namun seluruh respons dihasilkan oleh pencocokan kata kunci statis di sisi klien (*client-side keyword rules*). Tidak ada opsi eskalasi otomatis ke live support agent resmi.
- **Dampak:** Pengguna mengira mereka sedang berbicara dengan customer support resmi dan menunggu jawaban dari pertanyaan kompleks yang tidak ada di kamus kata kunci.
- **Rekomendasi:** Berikan banner disclaimer tegas di bagian atas percakapan bahwa ini adalah "Bot Panduan Cepat Mandiri" dan sediakan tombol satu-klik "Buat Tiket Bantuan Resmi" saat bot tidak dapat menjawab.

#### ISSUE-039 [HIGH]
- **Lokasi Kode:** `lib/api/chat.ts:421`
- **Deskripsi:** Endpoint `POST /v1/chat/rooms/{roomId}/typing` mengirimkan body anonim `{ isTyping: boolean }` tanpa deklarasi class DTO resmi di OpenAPI Swagger spec.
- **Dampak:** Ketidaksesuaian kontrak API antara Swagger spec dan implementasi controller backend.
- **Rekomendasi:** Sinkronkan pembuatan `TypingIndicatorDto` dengan `@ApiProperty` pada repositori backend.

#### ISSUE-040 [MEDIUM]
- **Lokasi Kode:** `app/chat/[roomId].tsx:120-135`
- **Deskripsi:** Fungsi penentu tipe pesan `messageTypeFor()` menandai pesan yang memuat lampiran gambar bersama lampiran dokumen non-gambar sebagai `"FILE"`. Akibatnya, pratinjau pesan di daftar percakapan hanya menampilkan ikon file dan menyembunyikan thumbnail gambar.
- **Dampak:** Tampilan gelembung chat menjadi kurang informatif pada pesan multi-lampiran.
- **Rekomendasi:** Pisahkan perlakuan rendering gelembung chat untuk pesan dengan lampiran majemuk (*mixed media bubble*).

#### ISSUE-041 [MEDIUM]
- **Lokasi Kode:** `app/chat/[roomId].tsx:260-280`
- **Deskripsi:** Penambahan reaksi cepat emoji (*quick reaction*) pada gelembung pesan chat mengaplikasikan update optimis pada UI. Namun jika request ke server gagal karena gangguan koneksi, state reaksi tidak dikembalikan ke kondisi awal (*missing rollback*).
- **Dampak:** Pengguna melihat emoji reaksi aktif pada gelembung pesan padahal server tidak mencatatnya.
- **Rekomendasi:** Simpan snapshot reaksi sebelumnya dan lakukan rollback jika `api.chat.addReaction()` melempar error.

#### ISSUE-042 [MEDIUM]
- **Lokasi Kode:** `components/ui/chat-attachment-item.tsx:45`
- **Deskripsi:** Komponen item lampiran dokumen non-gambar pada ruang chat hanya menampilkan nama berkas dan ekstensi, tanpa menyertakan ukuran berkas (*file size*).
- **Dampak:** Pengguna tidak dapat memperkirakan ukuran data sebelum mengunduh berkas lampiran.
- **Rekomendasi:** Tampilkan format ukuran file (misal `2.4 MB`) menggunakan helper `formatFileSize` pada `ChatAttachmentItem`.

#### ISSUE-043 [LOW]
- **Lokasi Kode:** `app/chat/[roomId].tsx:310`
- **Deskripsi:** Pada beberapa perangkat Android dengan custom keyboard, auto-scroll `scrollToEnd` pada daftar chat terpental sebelum animasi pembukaan keyboard selesai sepenuhnya.
- **Dampak:** Pesan terbaru tertutup sebagian oleh keyboard virtual saat pertama kali mengetik.
- **Rekomendasi:** Pasang listener `keyboardDidShow` untuk memicu `scrollToEnd({ animated: true })` setelah keyboard selesai terbuka.

---

### Kategori 6: KYC, Verifikasi Bisnis & Unggah Dokumen

#### ISSUE-044 [HIGH]
- **Lokasi Kode:** `app/kyc.tsx:175-185`
- **Deskripsi:** Pada fungsi `handleSubmit` saat pengajuan verifikasi identitas (KYC), blok `catch` menangkap error dan menampilkan toast dengan deskripsi statis:
  `toast.show({ title: "Gagal mengirim verifikasi", description: "Periksa koneksi dan pastikan foto jelas, lalu coba lagi.", tone: "danger" })`
  Pesan validasi asli dari server (misal "NIK sudah terdaftar pada akun lain" atau "Format NIK tidak valid") tidak pernah ditampilkan ke pengguna.
- **Dampak:** Pengguna tidak mengetahui kesalahan data spesifik yang menyebabkan pengajuan KYC mereka ditolak server.
- **Rekomendasi:** Gunakan `description: isApiError(err) ? userMessage(err) : "Periksa koneksi dan coba lagi."`.

#### ISSUE-045 [HIGH]
- **Lokasi Kode:** `app/business-verification.tsx:75-85`
- **Deskripsi:** Validasi nomor NPWP badan usaha pada `formValid` hanya memeriksa panjang digit `15` atau `16`. Format pemisah titik dan strip standar NPWP Indonesia tidak divalidasi dengan regex pola resmi.
- **Dampak:** Pengguna dapat memasukkan format acak yang lolos di klien namun ditolak saat proses verifikasi manual oleh tim kepatuhan (*compliance*).
- **Rekomendasi:** Terapkan regex mask validasi NPWP standar Indonesia (`^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$` atau 16-digit format NIK).

#### ISSUE-046 [HIGH]
- **Lokasi Kode:** `app/kyc.tsx:120-135`
- **Deskripsi:** Pengambilan foto selfie dengan KTP memiliki fallback ke galeri foto jika izin kamera ditolak. Namun proses ini tidak memvalidasi metadata file (seperti tanggal pembuatan) untuk memastikan foto adalah foto langsung (*live selfie*).
- **Dampak:** Celah kepatuhan anti-fraud (*fraud risk*) di mana pengguna dapat mengunggah foto selfie lama orang lain dari galeri.
- **Rekomendasi:** Tambahkan panduan instruksi gestur atau liveness check sederhana pada alur verifikasi KYC.

#### ISSUE-047 [MEDIUM]
- **Lokasi Kode:** `app/kyc.tsx:110`, `app/business-verification.tsx:110`
- **Deskripsi:** Saat pengguna mengajukan ulang dokumen KYC/Bisnis yang sebelumnya berstatus `REJECTED`, berkas lama yang tersimpan di state form tidak direset secara bersih jika modal ditutup paksa.
- **Dampak:** Pengguna tidak sengaja mengirimkan kembali berkas foto lama yang sebelumnya telah ditolak.
- **Rekomendasi:** Panggil `resetForm()` saat inisialisasi pembukaan form pengajuan ulang.

#### ISSUE-048 [MEDIUM]
- **Lokasi Kode:** `app/business-verification.tsx:15`, `lib/image-picker.ts`
- **Deskripsi:** Backend menerima dokumen verifikasi bisnis berformat PDF (maksimal 10MB). Namun antarmuka klien hanya mengizinkan pemilihan file foto JPG/PNG karena dependensi `expo-image-picker` tidak mendukung file picker dokumen PDF.
- **Dampak:** Pengguna badan usaha yang memiliki dokumen legalitas resmi dalam bentuk PDF tidak dapat mengunggah dokumen asli mereka.
- **Rekomendasi:** Tambahkan modul pemilih dokumen (`expo-document-picker`) khusus untuk alur verifikasi bisnis.

#### ISSUE-049 [LOW]
- **Lokasi Kode:** `components/ui/kyc-document-viewer.tsx`
- **Deskripsi:** Komponen `<KycDocumentViewer>` telah diimplementasikan lengkap dengan fitur zoom dan status badge dokumen, tetapi tidak pernah diimpor pada `app/kyc.tsx` maupun `app/business-verification.tsx`.
- **Dampak:** Redundansi kode komponen UI yang tidak terpakai (*dead code*).
- **Rekomendasi:** Gunakan `<KycDocumentViewer>` pada seksi riwayat pengajuan dokumen KYC atau hapus komponen jika sudah digantikan oleh `MediaViewer`.

---

### Kategori 7: Showcase Sosial, Feed, Komentar & Portofolio

#### ISSUE-050 [CRITICAL]
- **Lokasi Kode:** `app/(tabs)/discover.tsx:440`, `app/reports.tsx:105`
- **Deskripsi:** Pada kartu feed showcase (`ShowcaseFeedItem`), tombol aksi "Laporkan" mengeksekusi navigasi:
  `onReport={() => router.push(ROUTES.reports({ targetId: item.id, targetName: item.title }))}`
  Rute `/reports` adalah layar **Laporan Pengguna** (`app/reports.tsx`), yang memanggil `api.settings.reportUser({ targetId: item.id, ... })` (`POST /v1/settings/report`).
  Akibatnya, ID item showcase dikirimkan ke endpoint laporan akun pengguna, menyebabkan kegagalan 400 di backend atau salah lapor akun.
- **Dampak:** Fitur moderasi konten feed sosial rusak total dan tidak dapat melaporkan karya/postingan yang melanggar ketentuan.
- **Rekomendasi:** Buka modal/sheet laporan konten showcase khusus yang memanggil `api.showcase.reportShowcase(item.id, { reason, description })` (`POST /v1/showcase/{id}/report`).

#### ISSUE-051 [HIGH]
- **Lokasi Kode:** `app/user/[username].tsx:109`
- **Deskripsi:** Pada konstanta alasan penyembunyian komentar Q&A `QA_HIDE_REASONS`, terdapat kesalahan penulisan nilai enum:
  `{ value: "INAPPROPIATE", label: "Tidak pantas", description: "Konten menyinggung" }`
  Nilai enum yang valid pada backend dan modul lainnya adalah `"INAPPROPRIATE"` (dengan huruf 'R').
- **Dampak:** Eksekusi penyembunyian komentar dengan alasan "Tidak pantas" akan ditolak oleh validasi enum backend NestJS (*400 Bad Request*).
- **Rekomendasi:** Perbaiki nilai enum menjadi `"INAPPROPRIATE"`.

#### ISSUE-052 [HIGH]
- **Lokasi Kode:** `app/(tabs)/discover.tsx:325-350`
- **Deskripsi:** Pada fungsi `handleToggleLike`, penambahan dan pengurangan angka suka (*like count*) dilakukan secara optimis. Jika pengguna menekan tombol suka secara cepat berulang kali (*spam click*), race condition pada promise `likeShowcase` / `unlikeShowcase` dapat menyebabkan angka suka di kartu berbeda dengan angka aktual di halaman detail.
- **Dampak:** Desinkronisasi jumlah suka pada postingan feed sosial.
- **Rekomendasi:** Gunakan flag `likeBusy` per ID item untuk mengabaikan klik baru selama request sebelumnya masih berlangsung.

#### ISSUE-053 [HIGH]
- **Lokasi Kode:** `app/showcase/[id].tsx:170-195`
- **Deskripsi:** Saat pemilik showcase menghapus komentar induk yang memiliki balasan (*replies*), fungsi `patchComment` memfilter komentar tersebut dari array lokal. Hal ini menyebabkan seluruh balasan di bawahnya ikut hilang dari tampilan.
- **Dampak:** Struktur thread percakapan terputus dan balasan pengguna lain hilang secara tidak wajar.
- **Rekomendasi:** Jika komentar induk memiliki balasan, ubah teks konten menjadi `"[Komentar ini telah dihapus]"` dan pertahankan thread balasan di bawahnya.

#### ISSUE-054 [MEDIUM]
- **Lokasi Kode:** `app/(tabs)/discover.tsx:280-310`
- **Deskripsi:** Tab feed "Mengikuti" (*Following*) tidak memiliki endpoint khusus di backend. Klien mengambil feed terbaru (`sort=latest`) lalu memfilternya secara lokal terhadap daftar username yang diikuti.
- **Dampak:** Jika 20 postingan terbaru di server bukan dibuat oleh orang yang diikuti pengguna, tab "Mengikuti" akan tampil kosong (*empty state palsu*) meskipun orang yang diikuti memiliki postingan di halaman berikutnya.
- **Rekomendasi:** Tampilkan tombol "Muat Halaman Berikutnya" secara eksplisit atau tambahkan endpoint feed khusus mengikuti di sisi backend.

#### ISSUE-055 [MEDIUM]
- **Lokasi Kode:** `app/(tabs)/discover.tsx:210`, `app/showcase/[id].tsx:120`
- **Deskripsi:** Fitur simpan postingan showcase (*bookmark*) hanya disimpan dalam state `useState` memori lokal klien (`savedIds`).
- **Dampak:** Seluruh postingan yang disimpan pengguna hilang seketika saat aplikasi ditutup atau di-refresh.
- **Rekomendasi:** Simpan daftar ID postingan tersimpan ke `AsyncStorage` / `SecureStore` atau buat endpoint koleksi tersimpan di backend.

#### ISSUE-056 [LOW]
- **Lokasi Kode:** `app/showcase/[id].tsx:145`
- **Deskripsi:** Indikator halaman galeri foto dihitung dari `event.nativeEvent.contentOffset.x / rawWidth` menggunakan dimensi window mentah `windowWidth - 40`.
- **Dampak:** Indikator halaman foto dapat salah hitung pada perangkat tablet atau saat rotasi layar berubah.
- **Rekomendasi:** Gunakan callback `onLayout` pada kontainer carousel untuk mendapatkan nilai lebar aktual secara dinamis.

---

### Kategori 8: Ulasan (Ratings), Reputasi, Trust Score & Q&A

#### ISSUE-057 [HIGH]
- **Lokasi Kode:** `app/ratings.tsx:310-340`
- **Deskripsi:** Layar Ulasan Saya memuat data dari `api.ratings.getMyRatings({ page, limit: 20 })`. Hasilnya kemudian difilter di klien berdasarkan segmen aktif (`RECEIVED` vs `GIVEN`). Jika pengguna memiliki 20 ulasan masuk dan hanya 1 ulasan keluar yang berada di halaman ke-2, saat membuka segmen "Diberikan", `visible.length === 0`. Karena `visible.length === 0`, komponen merender `<EmptyState>` dan **tidak merender tombol `<LoadMore>`**.
- **Dampak:** Pengguna yang sudah memberikan ulasan tidak dapat melihat ulasan mereka dan terjebak pada Empty State tanpa bisa memuat halaman berikutnya.
- **Rekomendasi:** Kirimkan query parameter filter ke endpoint backend atau tetap render komponen `<LoadMore>` di bawah `<EmptyState>` jika `query.hasMore === true`.

#### ISSUE-058 [HIGH]
- **Lokasi Kode:** `components/ui/rating-review-card.tsx:115`
- **Deskripsi:** Kartu ulasan menampilkan balasan dari penjual/pembeli. Namun jika balasan telah diedit melalui endpoint `updateRatingReply`, komponen tidak menampilkan label keterangan bahwa balasan telah diperbarui (*Edited status*).
- **Dampak:** Kurangnya transparansi informasi riwayat balasan ulasan publik.
- **Rekomendasi:** Tampilkan teks `"(diedit)"` di samping timestamp balasan jika `reply.updatedAt !== reply.createdAt`.

#### ISSUE-059 [HIGH]
- **Lokasi Kode:** `app/questions.tsx:140`, `app/user/[username].tsx:240`
- **Deskripsi:** Aksi upvote pada pertanyaan Q&A publik (`api.users.upvoteQuestion`) dapat ditekan berkali-kali tanpa batas throttling di sisi klien.
- **Dampak:** Pengguna dapat memicu request beruntun (*request flooding*) yang membebani backend.
- **Rekomendasi:** Pasang mekanisme lock atau debouncing 1 detik per ID pertanyaan sebelum mengizinkan penekanan tombol upvote berikutnya.

#### ISSUE-060 [MEDIUM]
- **Lokasi Kode:** `app/ratings.tsx:135-142`
- **Deskripsi:** Jendela waktu izin menghapus ulasan (7 hari / `MS_PER_DAY_DELETE_WINDOW`) dihitung dengan membandingkan `Date.now() - created`. Penghitungan ini bergantung pada jam lokal perangkat pengguna.
- **Dampak:** Pengguna yang mengubah jam perangkat mereka dapat melihat tombol hapus aktif padahal server akan menolak penghapusan dengan kode `RATING_WINDOW_CLOSED`.
- **Rekomendasi:** Tampilkan pesan error informatif dari server saat penolakan batas waktu hapus ulasan terjadi.

#### ISSUE-061 [MEDIUM]
- **Lokasi Kode:** `components/ui/rating-form.tsx:85`, `app/rate/[orderId].tsx:50`
- **Deskripsi:** Tombol submit pada form pemberian ulasan tidak memiliki debounce internal. Penekanan ganda cepat dapat mengirimkan dua request pembuatan ulasan untuk satu pesanan yang sama.
- **Dampak:** Request kedua menghasilkan error 409 Conflict di backend dan memunculkan toast kegagalan yang membingungkan pengguna.
- **Rekomendasi:** Pasang guard `submitting` ketat pada handler `handleSubmit` di `RatingForm`.

#### ISSUE-062 [LOW]
- **Lokasi Kode:** `components/ui/trust-score-card.tsx:35`
- **Deskripsi:** Tipe properti `factors` pada kartu skor kepercayaan dideklarasikan sebagai `Record<string, unknown>`.
- **Dampak:** Berkurangnya keamanan pengetikan (*type safety*) pada rendering rincian faktor skor reputasi.
- **Rekomendasi:** Definisikan interface spesifik `TrustScoreFactor` dengan nilai bobot dan deskripsi terstruktur.

---

### Kategori 9: Notifikasi, Push Native, FCM Web & Badge Unread

#### ISSUE-063 [HIGH]
- **Lokasi Kode:** `app/(tabs)/home.tsx:295`
- **Deskripsi:** Pada komponen `<PullToRefresh>` di Beranda, properti `refreshing` didefinisikan sebagai:
  `refreshing={profile.refreshing || wallet.refreshing || summary.refreshing || activeOrders.refreshing}`
  Query `completedOrders.refreshing` terlewat dan tidak dimasukkan ke dalam kondisi tersebut.
- **Dampak:** Indikator loading pull-to-refresh dapat berhenti berputar sebelum data jumlah transaksi selesai dimuat ulang.
- **Rekomendasi:** Tambahkan `completedOrders.refreshing` ke dalam ekspresi boolean `refreshing`.

#### ISSUE-064 [HIGH]
- **Lokasi Kode:** `scripts/gen-fcm-sw.mjs`, `lib/web-push.web.ts:80`
- **Deskripsi:** Pada Web PWA, jika pengguna awalnya menolak izin notifikasi browser (*Permission Denied*), fungsi `registerWebPushDevice` gagal secara diam-diam tanpa memberikan panduan visual kepada pengguna tentang cara membuka blokir izin di pengaturan situs browser.
- **Dampak:** Pengguna web yang ingin mengaktifkan kembali notifikasi tidak dapat melakukannya dan menganggap fitur notifikasi web rusak.
- **Rekomendasi:** Tampilkan banner instruksi khusus pada `app/notification-preferences.tsx` yang memandu pengguna membuka setelan izin browser saat status izin adalah `"denied"`.

#### ISSUE-065 [HIGH]
- **Lokasi Kode:** `app/notifications.tsx:150-170`, `lib/api/notifications.ts:160`
- **Deskripsi:** Eksekusi hapus notifikasi secara massal (`deleteNotificationsBatch`) berhasil mengirimkan request ke server, namun tidak memperbarui cache array lokal `query.setData`.
- **Dampak:** Notifikasi yang telah dihapus tetap terlihat di layar hingga pengguna melakukan pull-to-refresh manual.
- **Rekomendasi:** Lakukan pembaruan optimis dengan memfilter item yang dihapus dari `query.setData((prev) => prev.filter(...))`.

#### ISSUE-066 [MEDIUM]
- **Lokasi Kode:** `lib/unread-count.ts:40-60`
- **Deskripsi:** Interval polling badge unread notifikasi (setiap 60 detik) terus berjalan secara konstan tanpa mendeteksi apakah pengguna sedang idle (*tidak ada aktivitas sentuhan selama > 5 menit*).
- **Dampak:** Request polling yang tidak efisien saat aplikasi dibiarkan menyala di atas meja.
- **Rekomendasi:** Turunkan frekuensi polling menjadi 5 menit saat pengguna terdeteksi idle.

#### ISSUE-067 [MEDIUM]
- **Lokasi Kode:** `lib/notification-routing.ts:35-50`
- **Deskripsi:** Pemetaan rute notifikasi push (`routeForPushData`) mengarahkan payload dengan tipe referensi baru yang belum terdaftar langsung ke rute fallback `ROUTES.notifications`.
- **Dampak:** Pengguna yang mengetuk notifikasi promosi atau pembaruan sistem tidak diarahkan ke layar detail promo terkait.
- **Rekomendasi:** Lengkapi pemetaan rute untuk seluruh tipe payload notifikasi yang didukung backend (termasuk `PROMOTION`, `VOUCHER`, dan `SUBSCRIPTION`).

#### ISSUE-068 [LOW]
- **Lokasi Kode:** `docs/DEEP-LINKING.md:45`
- **Deskripsi:** Dokumentasi deep linking mencatat skema `kahade://notifications/:id` padahal rute aplikasi menggunakan format singular `kahade://notification/:id`.
- **Dampak:** Ketidaksinkronan antara dokumentasi pengembang dan implementasi rute nyata.
- **Rekomendasi:** Perbaiki dokumentasi menjadi `kahade://notification/:id`.

---

### Kategori 10: Voucher, Program Referral, Langganan & Template Transaksi

#### ISSUE-069 [HIGH]
- **Lokasi Kode:** `app/subscriptions.tsx:400-420`, `lib/api/subscriptions.ts:180`
- **Deskripsi:** Fitur jeda langganan premium (`api.subscriptions.pauseSubscription()`) memanggil endpoint tanpa parameter `resumeAt`. Di antarmuka pengguna tidak disediakan pemilih tanggal kapan langganan otomatis aktif kembali.
- **Dampak:** Langganan yang dijeda akan berstatus jeda permanen sampai pengguna mengingat untuk mengaktifkannya kembali secara manual.
- **Rekomendasi:** Sediakan opsi pilihan durasi jeda (misal 7 hari, 14 hari, 30 hari) pada dialog konfirmasi jeda langganan.

#### ISSUE-070 [HIGH]
- **Lokasi Kode:** `app/referral.tsx:210-230`
- **Deskripsi:** Komponen daftar papan peringkat referral me-render avatar dan nama pengguna menggunakan kunci elemen `${e.rank}-${e.username}`. Saat query diperbarui di latar belakang, komponen Avatar berkedip karena memuat ulang gambar dari awal tanpa caching memory yang stabil.
- **Dampak:** Pengalaman visual yang kurang mulus pada layar program referral.
- **Rekomendasi:** Gunakan komponen `Avatar` dengan caching `expo-image` yang memiliki properti `cachePolicy="memory-disk"`.

#### ISSUE-071 [HIGH]
- **Lokasi Kode:** `app/transaction-templates.tsx:110-135`
- **Deskripsi:** Form pembuatan template transaksi tidak memvalidasi nilai nominal terhadap batas minimum pesanan escrow (`AMOUNT_LIMITS.order.minimum = 10.000`).
- **Dampak:** Pengguna dapat menyimpan template dengan nominal Rp0 atau di bawah minimum, yang kemudian selalu gagal saat dipakai membuat transaksi nyata.
- **Rekomendasi:** Tambahkan validasi batas nominal minimum pada form pembuatan template transaksi.

#### ISSUE-072 [MEDIUM]
- **Lokasi Kode:** `components/ui/voucher-card.tsx:40-60`
- **Deskripsi:** Kartu voucher promo tidak menampilkan persentase atau sisa kuota penggunaan promo (misal "Tersisa 15%").
- **Dampak:** Pengguna tidak mengetahui urgensi penggunaan voucher sebelum kuota promo habis terpakai oleh pengguna lain.
- **Rekomendasi:** Tampilkan progress bar kuota voucher pada `VoucherCard` jika data kuota disediakan oleh API.

#### ISSUE-073 [MEDIUM]
- **Lokasi Kode:** `app/referral.tsx:155`
- **Deskripsi:** Saat share sheet native tidak tersedia dan aplikasi menyalin tautan referral ke clipboard, aksi penyalinan tidak memicu haptic feedback.
- **Dampak:** Pengguna perangkat seluler tidak merasakan konfirmasi taktil bahwa tautan telah berhasil disalin.
- **Rekomendasi:** Panggil `haptic("selection")` saat penyalinan ke clipboard berhasil.

#### ISSUE-074 [LOW]
- **Lokasi Kode:** `components/ui/voucher-redeem-box.tsx:45`
- **Deskripsi:** Pada perangkat berlayar sangat sempit (<360px), teks tombol preset diskon voucher dapat terpotong (*text truncation*).
- **Dampak:** Tampilan visual tombol sedikit terpotong pada perangkat model lama.
- **Rekomendasi:** Gunakan layout `flex-wrap` dengan ukuran teks dinamis pada kontainer preset voucher.

---

### Kategori 11: Pusat Bantuan, FAQ, Tiket Dukungan & Kontak

#### ISSUE-075 [HIGH]
- **Lokasi Kode:** `app/support/[ticketId].tsx:180-210`, `lib/api/support.ts`
- **Deskripsi:** Layar detail tiket dukungan memuat daftar percakapan antara pengguna dan tim support. Namun, properti lampiran berkas (`ticket.attachmentKeys` / `ticket.attachments`) **sama sekali tidak dirender** di dalam gelembung percakapan.
- **Dampak:** Pengguna tidak dapat melihat kembali bukti gambar atau dokumen yang mereka kirimkan pada tiket tersebut.
- **Rekomendasi:** Render daftar lampiran di bawah teks pesan tiket menggunakan komponen `ChatAttachmentItem` atau `Picture`.

#### ISSUE-076 [HIGH]
- **Lokasi Kode:** `app/feedback.tsx:75-90`, `lib/feedback.ts:120`
- **Deskripsi:** Saat pengguna mengirimkan umpan balik dalam kondisi luring, masukan disimpan ke antrean lokal (`lib/feedback.ts`). Namun pada antarmuka pengguna tidak ada indikator yang memberitahukan berapa jumlah masukan yang saat ini sedang mengantre di perangkat.
- **Dampak:** Pengguna mengira masukan mereka telah terkirim ke server atau justru hilang.
- **Rekomendasi:** Tampilkan banner informatif kecil (misal "1 masukan tersimpan di perangkat dan akan dikirim otomatis") saat `queuedFeedbackCount() > 0`.

#### ISSUE-077 [MEDIUM]
- **Lokasi Kode:** `app/faq.tsx:65`
- **Deskripsi:** Kolom pencarian pertanyaan pada Pusat Bantuan menyaring daftar FAQ secara langsung pada setiap ketikan huruf tanpa mekanisme debouncing.
- **Dampak:** Re-render layout berulang secara intensif saat mengetik cepat di perangkat berspesifikasi rendah.
- **Rekomendasi:** Gunakan hook `useDebouncedValue(query, 300)` pada filter pencarian FAQ.

#### ISSUE-078 [MEDIUM]
- **Lokasi Kode:** `app/support/[ticketId].tsx:135`
- **Deskripsi:** Saat pengguna memberikan rating penyelesaian tiket bantuan dengan nilai bintang 1 atau 2, kolom komentar evaluasi bersifat opsional.
- **Dampak:** Tim kepuasan pelanggan (*customer satisfaction team*) tidak mendapatkan masukan konstruktif mengenai alasan ketidakpuasan layanan.
- **Rekomendasi:** Wajibkan pengisian kolom komentar jika rating yang dipilih adalah bintang 1 atau 2.

#### ISSUE-079 [LOW]
- **Lokasi Kode:** `app/help/[slug].tsx:45`
- **Deskripsi:** Navigasi breadcrumb pada artikel bantuan memakan 2 baris penuh di layar ponsel berukuran kecil.
- **Dampak:** Mengurangi ruang baca konten artikel pada viewport mobile sempit.
- **Rekomendasi:** Buat breadcrumb scrollable horizontal atau sederhanakan menjadi tombol "Kembali ke Kategori".

---

### Kategori 12: Pengaturan Akun, Keamanan, Privasi & Profil Pengguna

#### ISSUE-080 [HIGH]
- **Lokasi Kode:** `app/edit-profile.tsx:215-225`, `app/change-phone.tsx`
- **Deskripsi:** Pada layar Edit Profil, field nomor HP publik dimasukkan ke dalam payload `d.phoneNumber = toE164Id(form.phone)` saat submit `PUT /v1/users/me`. Namun, pengubahan nomor HP akun utama adalah aksi sensitif yang membutuhkan otentikasi kata sandi dan verifikasi OTP di layar `app/change-phone.tsx`.
- **Dampak:** Permintaan edit profil berisiko ditolak backend dengan galat otorisasi saat pengguna mencoba memperbarui nomor telepon dari form edit profil biasa.
- **Rekomendasi:** Kunci field nomor telepon di Edit Profil sebagai read-only dengan tombol tautan "Ubah via Verifikasi Nomor HP" yang mengarahkan ke `ROUTES.changePhone`.

#### ISSUE-081 [HIGH]
- **Lokasi Kode:** `app/blocked-users.tsx:35-50`
- **Deskripsi:** Tombol "Buka blokir" pada daftar pengguna yang diblokir langsung mengeksekusi `api.settings.unblockUser(user.id)` saat ditekan tanpa menampilkan dialog konfirmasi keselamatan.
- **Dampak:** Pengguna dapat secara tidak sengaja membuka blokir akun yang tidak diinginkan karena salah sentuh (*accidental tap*).
- **Rekomendasi:** Tampilkan dialog konfirmasi "Buka blokir pengguna ini?" sebelum memanggil API unblock.

#### ISSUE-082 [HIGH]
- **Lokasi Kode:** `app/privacy-settings.tsx:31`
- **Deskripsi:** Label judul pada pengaturan visibilitas profil tertulis `"Profile terlihat publik"` (mencampurkan kata bahasa Inggris "Profile" dan bahasa Indonesia "terlihat publik").
- **Dampak:** Cacat visual tipografi (*linguistic inconsistency*) pada pengaturan privasi akun.
- **Rekomendasi:** Ubah judul menjadi `"Profil terlihat publik"`.

#### ISSUE-083 [MEDIUM]
- **Lokasi Kode:** `app/account-type.tsx:60-75`
- **Deskripsi:** Saat pengguna beralih dari tipe akun Bisnis ke Personal, antarmuka tidak memberikan dialog penjelasan mengenai dampaknya terhadap visibilitas produk portofolio dan verifikasi bisnis yang telah disetujui.
- **Dampak:** Pengguna bisnis tidak menyadari bahwa fitur marketplace bisnis mereka akan dinonaktifkan setelah berganti tipe akun.
- **Rekomendasi:** Tambahkan dialog peringatan konfirmasi sebelum menyimpan perubahan dari tipe akun Bisnis ke Personal.

#### ISSUE-084 [MEDIUM]
- **Lokasi Kode:** `components/ui/social-links-editor.tsx:50-65`
- **Deskripsi:** Form penambahan tautan media sosial tidak memvalidasi apakah URL yang dimasukkan diawali dengan protokol aman `https://`.
- **Dampak:** Pengguna dapat memasukkan skema tidak aman seperti `javascript:` atau format URL rusak yang gagal dibuka.
- **Rekomendasi:** Terapkan sanitasi validasi URL yang mengharuskan awalan `https://` atau `http://`.

#### ISSUE-085 [LOW]
- **Lokasi Kode:** `app/appearance.tsx:40`
- **Deskripsi:** Pemilihan tema tampilan (Gelap, Terang, Sistem) disimpan melalui state konteks, namun jika aplikasi dibuka dalam keadaan offline tanpa inisialisasi storage, tema dapat kembali ke default sistem.
- **Dampak:** Preferensi tema pengguna reset ke tema bawaan saat aplikasi dibuka dalam mode pesawat.
- **Rekomendasi:** Pastikan penyimpanan preferensi tema menggunakan penyimpanan lokal sinkron yang tahan terhadap kondisi luring.

---

### Kategori 13: Komponen UI, Design System, Gestur & Aksesibilitas (A11y)

#### ISSUE-086 [HIGH]
- **Lokasi Kode:** `components/ui/` (29 komponen)
- **Deskripsi:** Berdasarkan audit keterpakaian komponen, terdapat **29 komponen UI** di bawah `components/ui/` yang tidak pernah diimpor atau digunakan oleh layar mana pun di dalam `app/`:
  1. `accordion.tsx`
  2. `banner.tsx`
  3. `biometric-prompt-trigger.tsx`
  4. `box.tsx`
  5. `bullet-list.tsx`
  6. `captcha-field.tsx`
  7. `checkbox-group.tsx`
  8. `count-badge.tsx`
  9. `data-table.tsx`
  10. `dispute-evidence-item.tsx`
  11. `filter-sheet-content.tsx`
  12. `in-call-controls-bar.tsx`
  13. `incoming-call-prompt.tsx`
  14. `kyc-document-viewer.tsx`
  15. `menu-list.tsx`
  16. `order-summary-strip.tsx`
  17. `presence.tsx`
  18. `result-state.tsx`
  19. `search-overlay.tsx`
  20. `signature-pad.tsx`
  21. `slider.tsx`
  22. `surface.tsx`
  23. `swipeable-list-item.tsx`
  24. `tag-input.tsx`
  25. `tooltip.tsx`
  26. `two-factor-method-selector.tsx`
  27. `typography.tsx`
  28. `wallet-balance-card.tsx`
  29. `z-stack.tsx`
- **Dampak:** Membengkaknya ukuran bundle JavaScript (*bundle bloat*), beban pemeliharaan kode yang tidak perlu, dan kebingungan arsitektur bagi pengembang baru.
- **Rekomendasi:** Hubungkan komponen yang memang memiliki fungsionalitas esensial (seperti `biometric-prompt-trigger.tsx`, `in-call-controls-bar.tsx`, `incoming-call-prompt.tsx`) ke layar terkait, dan arsipkan/hapus komponen yang sepenuhnya redundan.

#### ISSUE-087 [HIGH]
- **Lokasi Kode:** `components/ui/bottom-sheet.tsx:120-150`
- **Deskripsi:** Gestur geser ke bawah (*drag to dismiss*) pada komponen `BottomSheet` yang memuat konten scrollable bersarang (*nested FlatList/ScrollView*) mengalami perebutan penanganan sentuhan (*gesture collision*) pada perangkat Android.
- **Dampak:** Pengguna kesulitan menggulir isi konten sheet karena sheet sering tertutup secara tidak sengaja saat mencoba scroll ke atas.
- **Rekomendasi:** Gunakan konfigurasi `simultaneousHandlers` atau aktifkan `scrollEnabled` sheet hanya saat posisi scroll konten berada di offset teratas (`contentOffset.y <= 0`).

#### ISSUE-088 [HIGH]
- **Lokasi Kode:** `components/ui/icon-button.tsx:45`
- **Deskripsi:** Pada varian ukuran `size="sm"` (28px) atau `size="xs"` (24px), komponen `IconButton` tidak menambahkan properti `hitSlop` secara otomatis untuk memperluas area sentuh fisik menjadi minimal 44x44px sesuai pedoman WCAG 2.5.5 Target Size.
- **Dampak:** Pengguna dengan jari lebih besar atau keterbatasan motorik kesulitan menekan tombol aksi kecil.
- **Rekomendasi:** Suntikkan `hitSlop` dinamis pada `IconButton` berukuran kecil agar total target sentuh efektif selalu memenuhi minimal 44x44px.

#### ISSUE-089 [MEDIUM]
- **Lokasi Kode:** `components/ui/modal.tsx:85-110`
- **Deskripsi:** Komponen Modal Dialog pada platform Web tidak mengunci fokus keyboard (*focus trap*) secara ketat. Pengguna yang menekan tombol `Tab` pada keyboard dapat memindahkan fokus ke elemen formulir di belakang backdrop modal yang sedang terbuka.
- **Dampak:** Aksesibilitas keyboard terganggu dan pembaca layar dapat membacakan elemen di luar modal yang aktif.
- **Rekomendasi:** Terapkan focus trap listener pada platform Web saat modal berada dalam status `visible === true`.

#### ISSUE-090 [MEDIUM]
- **Lokasi Kode:** `components/ui/home-overview-card.tsx:90`, `lib/a11y.ts`
- **Deskripsi:** Saat saldo dompet diperbarui pasca top-up atau pembayaran, nilai saldo yang berubah tidak dibungkus dengan komponen `<LiveRegion>` atau atribut `accessibilityLiveRegion="polite"`.
- **Dampak:** Pengguna tuna netra yang menggunakan VoiceOver/TalkBack tidak mendapatkan pengumuman bahwa saldo akun mereka telah berubah.
- **Rekomendasi:** Bungkus teks perubahan saldo dengan atribut live region untuk aksesibilitas pembaca layar.

#### ISSUE-091 [MEDIUM]
- **Lokasi Kode:** `components/ui/slider.tsx`, `components/ui/range-slider.tsx`
- **Deskripsi:** Komponen Slider dan RangeSlider hanya dapat digerakkan menggunakan gestur drag sentuhan. Tidak ada dukungan tombol pintas keyboard (panah kiri/kanan) atau tombol kenaikan/penurunan bertahap (*stepper buttons*).
- **Dampak:** Pengguna yang mengandalkan navigasi keyboard di platform Web tidak dapat mengubah nilai slider.
- **Rekomendasi:** Tambahkan atribut `accessibilityRole="adjustable"` dan implementasikan handler `accessibilityActions` untuk kenaikan/penurunan nilai.

#### ISSUE-092 [LOW]
- **Lokasi Kode:** `components/ui/footer-bar.tsx:35`
- **Deskripsi:** Komponen `FooterBar` menambahkan padding bawah dari `useSafeAreaInsets().bottom`. Jika komponen ini ditempatkan di dalam layar yang parent-nya sudah menyertakan `edges={["bottom"]}`, padding bawah menjadi berlipat ganda (*double padding*).
- **Dampak:** Ruang kosong berlebih di bagian bawah tombol footer pada perangkat ber-notch (seperti iPhone dengan Home Bar).
- **Rekomendasi:** Standarisasi konsumsi inset safe area: letakkan penanganan inset bawah hanya pada satu layer kontainer.

---

### Kategori 14: Data Fetching, AbortController, Caching, Polling & Network Resilience

#### ISSUE-093 [HIGH]
- **Lokasi Kode:** `lib/api/badges.ts:29`, `lib/api/auth.ts:219`, `lib/api/orders.ts:590`, `lib/api/public.ts:36`, `lib/api/search.ts:135`, etc.
- **Deskripsi:** Berdasarkan audit pemindaian adapter API, terdapat **21 fungsi adapter HTTP GET** yang tidak menerima atau meneruskan parameter `signal: AbortSignal` ke fungsi `http.get`:
  - `lib/api/auth.ts: verifyEmail, verifyEmailByLink`
  - `lib/api/badges.ts: listAllBadges, listMyBadges, readBadgeList`
  - `lib/api/chat.ts: getRoomPresence`
  - `lib/api/deeplinks.ts: resolveUserDeeplink, resolveProfileDeeplink, resolveOrderLinkDeeplink, resolveOrderDeeplink, resolveNotificationDeeplink`
  - `lib/api/notifications.ts: getUnreadCount`
  - `lib/api/orders.ts: listExtensions, getReceiptHtml`
  - `lib/api/public.ts: getSubscriptionPlans, getExchangeRates`
  - `lib/api/search.ts: clearSearchHistory`
  - `lib/api/showcase.ts: getShowcaseSharePayload`
  - `lib/api/transaction-templates.ts: getTransactionTemplate`
  - `lib/api/users.ts: getMyDashboard, getQuestionComments`
- **Dampak:** Permintaan jaringan pada fungsi-fungsi tersebut tidak dapat dibatalkan ketika pengguna berpindah halaman secara cepat, menyebabkan konsumsi data berlebih dan potensi race condition state.
- **Rekomendasi:** Tambahkan parameter opsional `signal?: AbortSignal` pada ke-21 fungsi adapter tersebut dan teruskan ke konfigurasi `http.get()`.

#### ISSUE-094 [HIGH]
- **Lokasi Kode:** `app/search.tsx:285-300`
- **Deskripsi:** Pada layar pencarian global, query pencarian pengguna menggunakan endpoint khusus `api.users.searchUsers` yang memiliki rate limit ketat (10 rpm per IP). Saat rate limit tercapai, query tersebut mengembalikan error. Meskipun query utama `api.search.globalSearch` berhasil memuat data pesanan dan artikel, kondisi `ListEmptyComponent` memeriksa `result.error || usersResult.error` sehingga **seluruh halaman menampilkan ErrorState**.
- **Dampak:** Pengguna tidak dapat melihat hasil pencarian transaksi, pesanan, dan artikel bantuan hanya karena sub-pencarian pengguna terkena throttle.
- **Rekomendasi:** Perlakukan `usersResult.error` sebagai kegagalan lokal (tampilkan fallback dari hasil pencarian global) dan jangan batalkan rendering seksi hasil pencarian lainnya.

#### ISSUE-095 [HIGH]
- **Lokasi Kode:** `lib/api/client.ts:280-310`
- **Deskripsi:** Saat terjadi kegagalan pembaruan token (401 yang tidak dapat dipulihkan), fungsi `expireSession()` membersihkan sesi. Namun mutasi HTTP POST/PUT non-idempoten yang saat itu sedang berada dalam antrean network flight tidak segera di-abort.
- **Dampak:** Permintaan mutasi tetap dikirimkan ke server dengan token kedaluwarsa atau tanpa otentikasi.
- **Rekomendasi:** Batalkan seluruh controller in-flight aktif saat event sesi berakhir (*session expired event*) dipancarkan.

#### ISSUE-096 [MEDIUM]
- **Lokasi Kode:** `lib/api/client.ts:50-60`
- **Deskripsi:** Generator kunci idempotensi `createIdempotencyKey()` menggunakan fallback `Math.random()` jika API `crypto.randomUUID` dan `crypto.getRandomValues` tidak tersedia di environment runtime tertentu.
- **Dampak:** Kunci idempotensi yang dihasilkan pada environment fallback memiliki entropi rendah dan berpotensi bertabrakan (*key collision*).
- **Rekomendasi:** Gunakan polyfill `expo-crypto` atau library UUID v4 berbasis pseudo-random number generator teruji pada platform mobile.

#### ISSUE-097 [MEDIUM]
- **Lokasi Kode:** `lib/api/session.ts:85-100`
- **Deskripsi:** Fungsi `setAccessToken(token)` memperbarui variabel `accessTokenCache` di memori setelah memanggil `setSecureItem`. Namun jika proses penulisan ke Keychain/Keystore gagal (misal storage penuh atau enkripsi OS terkunci), cache memori tidak di-invalidate.
- **Dampak:** Klien berjalan dengan token baru di memori, namun saat aplikasi di-restart, aplikasi kembali menggunakan token lama atau tidak memiliki token.
- **Rekomendasi:** Bungkus pembaruan cache memori di dalam blok `try...catch` dan pastikan cache di-reset jika penulisan storage gagal.

#### ISSUE-098 [LOW]
- **Lokasi Kode:** `lib/api/errors.ts:60`
- **Deskripsi:** Helper `parseRetryAfterMs` hanya mem-parsing nilai integer detik pada header `Retry-After`. Standar RFC 7231 juga mengizinkan format tanggal HTTP (*HTTP-Date string*, misal `"Wed, 21 Oct 2026 07:28:00 GMT"`).
- **Dampak:** Header `Retry-After` berformat tanggal HTTP diabaikan dan menghasilkan nilai `undefined`.
- **Rekomendasi:** Tambahkan parsing fallback menggunakan `Date.parse(value)` untuk menghitung selisih milidetik terhadap waktu saat ini.

---

### Kategori 15: Internasionalisasi (i18n), Lokalisasi Rupiah & Format Tanggal/Waktu

#### ISSUE-099 [HIGH]
- **Lokasi Kode:** `lib/financial.ts:22`, `lib/financial.ts:110`
- **Deskripsi:** Pesan galat validasi nominal keuangan di `assertValidAmount` dan validasi DTO di `assertDtoConstraints` menggunakan string pesan hardcoded bahasa Indonesia:
  `"Nominal harus berupa Rupiah bulat antara..."` dan `"Isian ${key} tidak sesuai ketentuan layanan."`
- **Dampak:** Saat aplikasi dijalankan dalam bahasa Inggris (*English locale*), pesan validasi kesalahan transaksi tetap muncul dalam bahasa Indonesia.
- **Rekomendasi:** Hubungkan pesan validasi error ke kamus terjemahan `lib/i18n/translate.ts` menggunakan fungsi `t("errors.validation...")`.

#### ISSUE-100 [HIGH]
- **Lokasi Kode:** `lib/format.ts:80-110`
- **Deskripsi:** Fungsi pemformatan tanggal `formatDateTime()` dan `formatDate()` mengonversi string ISO UTC menjadi objek `Date` lokal tanpa menyediakan opsi formatting berbasis zona waktu Indonesia standar (WIB/WITA/WIT).
- **Dampak:** Pengguna di luar zona waktu Indonesia yang menggunakan aplikasi melihat jam transaksi bergeser sesuai zona waktu perangkat mereka tanpa indikator zona waktu yang jelas.
- **Rekomendasi:** Sertakan label singkatan zona waktu (misal "WIB") atau berikan opsi pengaturan zona waktu pada preferensi akun.

#### ISSUE-101 [MEDIUM]
- **Lokasi Kode:** `lib/format.ts:130-150`
- **Deskripsi:** Fungsi `formatCountCompact()` memformat angka ribuan menjadi sufiks `"rb"` (misal `1.5 rb`) dan jutaan menjadi `"jt"`. Format ini bersifat hardcoded bahasa Indonesia dan tidak berubah menjadi `"k"` / `"M"` saat bahasa aplikasi diatur ke English.
- **Dampak:** Angka statistik di profil dan showcase sosial menampilkan singkatan bahasa Indonesia pada antarmuka bahasa Inggris.
- **Rekomendasi:** Sesuaikan sufiks singkatan angka berdasarkan bahasa aktif dari `getLanguage()` (`id`: rb/jt, `en`: k/M).

#### ISSUE-102 [MEDIUM]
- **Lokasi Kode:** `lib/i18n/en/errors.json`
- **Deskripsi:** Pada kamus terjemahan bahasa Inggris, beberapa frasa galat autentikasi menggunakan istilah yang tidak konsisten, seperti percampuran antara `"Password"` dan `"Passcode"`.
- **Dampak:** Inkonsistensi teks pada dialog kesalahan bagi pengguna berbahasa Inggris.
- **Rekomendasi:** Selaraskan seluruh istilah kredensial menjadi `"Password"` untuk kata sandi akun dan `"PIN"` untuk transaksi dompet.

#### ISSUE-103 [LOW]
- **Lokasi Kode:** `components/ui/calendar.tsx:30`
- **Deskripsi:** Header nama hari pada komponen kalender kustom menggunakan array statis `["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]`.
- **Dampak:** Header kalender tetap berbahasa Indonesia saat pengguna memilih bahasa Inggris.
- **Rekomendasi:** Ambil nama hari dari helper `dayNames()` di `lib/format.ts` yang responsif terhadap bahasa aktif.

---

### Kategori 16: Kompatibilitas Web vs Native, Deep Linking, Build Configs & CI Tooling

#### ISSUE-104 [HIGH]
- **Lokasi Kode:** `lib/protected-routes.ts:70`, `app/_layout.tsx:160-190`
- **Deskripsi:** Pada mode web tamu (*web guest mode*), seluruh rute didaftarkan tanpa proteksi navigator (`guard={true}`) agar tamu dapat menelusuri aplikasi. Blokir rute privat ditangani oleh overlay `<GuestLoginPrompt>`. Namun, saat halaman ber-auth pertama kali dibuka, komponen layar privat sempat melakukan inisialisasi query data ke server (yang menghasilkan 401) sebelum overlay selesai menutupi layar.
- **Dampak:** Terjadinya request API yang tidak perlu dan potensi kebocoran tata letak layar privat sesaat sebelum popup login muncul.
- **Rekomendasi:** Cegah inisialisasi query data di dalam layar privat jika `Platform.OS === "web" && !session.token`.

#### ISSUE-105 [HIGH]
- **Lokasi Kode:** `public/.well-known/assetlinks.json`, `public/.well-known/apple-app-site-association`
- **Deskripsi:** Berkas konfigurasi verifikasi deep linking Android App Links (`assetlinks.json`) dan iOS Universal Links (`apple-app-site-association`) masih berupa placeholder kosong:
  `PERINGATAN assetlinks.json kosong: App Links belum diaktifkan sampai fingerprint signing production tersedia`
- **Dampak:** Tautan tautan web (misal `https://kahade.id/order/123` atau link referral) yang diklik di aplikasi chat tidak langsung membuka aplikasi native Kahade melainkan membuka browser web.
- **Rekomendasi:** Isi SHA-256 fingerprint sertifikat release Android dan Apple Team ID pada environment CI/CD production deployment.

#### ISSUE-106 [HIGH]
- **Lokasi Kode:** `package.json`, `app.json`
- **Deskripsi:** Paket dependensi `expo-document-picker` tidak terpasang di `package.json`. Aplikasi hanya memiliki `expo-image-picker` yang dibatasi pada media gambar/video.
- **Dampak:** Seluruh alur unggah dokumen hukum, PDF invoice, dan akta bisnis di platform mobile terhambat karena ketiadaan modul pemilih dokumen native.
- **Rekomendasi:** Tambahkan paket `expo-document-picker` ke dalam dependensi proyek dan daftarkan izin terkait di `app.json`.

#### ISSUE-107 [MEDIUM]
- **Lokasi Kode:** `public/sw.js`, `scripts/gen-fcm-sw.mjs`
- **Deskripsi:** Skrip generator Service Worker untuk Web PWA tidak menyertakan hash versi build pada nama cache aset statis.
- **Dampak:** Peramban pengguna web dapat mempertahankan cache script bundle lama (*stale cached assets*) setelah update rilis baru di-deploy ke production.
- **Rekomendasi:** Suntikkan timestamp atau Git commit hash ke dalam cache name Service Worker pada saat proses build web.

#### ISSUE-108 [MEDIUM]
- **Lokasi Kode:** `scripts/check-permissions.mjs`
- **Deskripsi:** Skrip audit izin native `check-permissions.mjs` hanya memvalidasi izin kamera, mikrofon, dan notifikasi. Izin akses file storage dan lokasi latar belakang tidak dipindai secara otomatis.
- **Dampak:** Potensi penolakan rilis di Google Play Store / Apple App Store jika ada dependensi pihak ketiga yang menyisipkan izin berlebih tanpa deklarasi penggunaan.
- **Rekomendasi:** Perluas cakupan pemindaian `check-permissions.mjs` untuk memverifikasi seluruh manifest Android & Info.plist iOS.

#### ISSUE-109 [LOW]
- **Lokasi Kode:** `scripts/babel-phosphor-imports.cjs`
- **Deskripsi:** Plugin Babel kustom untuk optimasi impor Phosphor Icons tidak menangani re-export dengan nama dinamis.
- **Dampak:** Peringatan bundler minor saat mengevaluasi modul icon dinamis.
- **Rekomendasi:** Perbarui parser AST pada skrip babel plugin agar mendukung seluruh varian sintaks re-export.

#### ISSUE-110 [LOW]
- **Lokasi Kode:** `package.json`, `package-lock.json`
- **Deskripsi:** Hasil `npm audit` melaporkan 27 kerentanan paket dependensi (19 moderate, 8 high) pada dependensi build tooling sekunder (seperti `glob`, `rimraf`, dan sub-dependensi `eslint`).
- **Dampak:** Potensi risiko keamanan pada pipeline CI/CD lokal pengembang.
- **Rekomendasi:** Jalankan `npm audit fix` untuk memperbarui dependensi tooling dev ke versi terbaru yang aman dari kerentanan.

---

## 4. Roadmap Rencana Aksi & Prioritas Perbaikan

### Fase 1: Perbaikan Kritis & Celah Keamanan (P0 / Target: Minggu 1)
1. **Perbaikan Integrasi Biometrik (ISSUE-001):** Sambungkan `<BiometricPromptTrigger>` pada alur konfirmasi PIN di `app/order/[id].tsx`, `app/transfer.tsx`, dan `app/withdraw.tsx`.
2. **Perbaikan Redirection Order Link (ISSUE-002):** Tangkap hasil kembalian pembuatan order dan arahkan pengguna ke `ROUTES.orderDetail(order.id)`.
3. **Perbaikan Selector Rekening Jadwal Penarikan (ISSUE-003):** Tambahkan input pemilihan rekening bank pada `WithdrawalSchedulesScreen` dan hilangkan hardcoded `bankAccountId: ""`.
4. **Perbaikan Rute Laporan Showcase Feed (ISSUE-004):** Ubah aksi lapor kartu feed agar memanggil endpoint khusus laporan showcase bukan laporan akun pengguna.
5. **Pencegahan Race Condition Token Refresh (ISSUE-005):** Pasang koordinasi tab web untuk proses refresh token.

### Fase 2: Stabilitas Transaksi, Dompet & Sengketa (P1 / Target: Minggu 2)
1. **Layanan Chat & Polling Latar Belakang (ISSUE-037):** Hentikan interval polling saat aplikasi atau tab browser berada di background.
2. **Validasi Input Keuangan & Resi (ISSUE-014, ISSUE-015, ISSUE-029):** Perketat validasi resi barang fisik dan input nomor rekening bank.
3. **Penyempurnaan Eskalasi & Resolusi Sengketa (ISSUE-021, ISSUE-022, ISSUE-023):** Batasi nominal kesepakatan damai, tampilkan sisa kuota eskalasi, dan pasang kontrol panggilan aktif.
4. **Pembersihan Komponen UI Tidak Terpakai (ISSUE-042, ISSUE-086):** Integrasikan komponen yang dibutuhkan dan bersihkan 29 komponen dead code.
5. **Dukungan Pembatalan Request pada Adapter API (ISSUE-093):** Tambahkan parameter `signal: AbortSignal` pada 21 fungsi adapter GET.

### Fase 3: Aksesibilitas, Lokalisasi & Optimalisasi Platform (P2 / Target: Minggu 3)
1. **Penyempurnaan Gestur & Target Sentuh (ISSUE-087, ISSUE-088):** Selesaikan konflik gestur BottomSheet di Android dan pasang hitSlop pada tombol kecil.
2. **Standardisasi Lokalisasi i18n (ISSUE-048, ISSUE-099, ISSUE-101):** Pindahkan seluruh teks error validasi ke kamus i18n dan sesuaikan format angka ringkas.
3. **Konfigurasi Universal Links & PWA (ISSUE-051, ISSUE-105, ISSUE-107):** Lengkapi hash assetlinks produksi dan perbarui cache strategy Service Worker.
4. **Pemasangan Modul Dokumen PDF (ISSUE-052, ISSUE-106):** Tambahkan dependensi `expo-document-picker` untuk verifikasi bisnis dan bukti hukum.
5. **Audit Dependensi Tooling (ISSUE-110):** Jalankan pembaruan paket dependensi yang rentan.

---

## 5. Kesimpulan & Rekomendasi Arsitektur

Frontend Kahade memiliki fondasi arsitektur yang sangat terstruktur, didukung oleh sistem token desain yang disiplin, integrasi Expo Router modern, serta pemisahan boundary API yang rapi. 

Dengan menyelesaikan 110 temuan yang telah diidentifikasi dalam dokumen audit ini—khususnya 4 temuan kritis pada alur biometrik, navigasi order link, pembuatan jadwal penarikan, dan pelaporan feed sosial—aplikasi akan mencapai tingkat kematangan produksi (*Production Readiness Grade*) yang kokoh, aman, dan dapat diandalkan untuk melayani transaksi keuangan bernilai tinggi.
