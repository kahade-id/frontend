# Audit mendalam Kahade: 525 gap implementasi dan peluang fitur

**Tanggal audit:** 26 September 2026 (Asia/Jakarta)<br>
**Repositori yang ditinjau:** frontend, backend, admin
**Tujuan:** inventaris saran yang belum tersedia pada permukaan yang disebutkan, bukan mengulang fitur yang sudah ada.

> **Cara membaca angka “525”.** Ini adalah 525 tugas/gap yang diberi ID unik dan dapat ditindaklanjuti, dikelompokkan menjadi 21 paket kerja × 25 butir. Angka tersebut **bukan** klaim bahwa ada 525 bug produksi atau 525 fitur yang sudah disepakati dalam roadmap. Sebagian butir memecah satu kapabilitas besar menjadi pekerjaan data/API, aplikasi, admin, keamanan, dan pengujian. Paket yang menambah domain produk baru (mis. milestone escrow, integrasi kurir, katalog stok, dan API mitra) ditandai sebagai **ekstensi/keputusan produk**; ketidakhadirannya di snapshot repo tidak dengan sendirinya membuktikan bahwa bisnis sudah menjanjikannya.
>
> Status “belum diimplementasikan” dibatasi ke **permukaan dan snapshot** dalam matriks bukti. Itu tidak membuktikan bahwa konfigurasi produksi, sistem eksternal, atau rencana internal Kahade tidak ada. Pemindai nama fungsi/OpenAPI tidak dipakai sebagai bukti tunggal.

## Dasar audit dan batas klaim

Snapshot yang dibaca: frontend `6cd84dd`, backend `8960358`, admin `cbc3943`. Audit dilakukan dengan inspeksi route/controller/service, model Prisma, layar aplikasi, adapter API admin, dan pencarian referensi. Tidak ada kode produk yang diubah oleh audit ini; test/build juga tidak dijalankan.

| Bukti | Observasi langsung pada snapshot | Batas klaim |
|---|---|---|
| **E01 — login sosial** | `../backend/src/modules/auth/auth.service.ts` menjalankan jalur Google hanya jika `GOOGLE_CLIENT_ID` tersedia; jalur Apple melempar `SOCIAL_PROVIDER_NOT_SUPPORTED`. Pencarian layar autentikasi frontend dan `lib/api/auth.ts` tidak menemukan entrypoint/pemanggilan login sosial. | Google punya sebagian logika backend; klaimnya adalah alur pengguna belum selesai di aplikasi dan Apple belum didukung server, bukan bahwa seluruh login sosial tidak punya kode. |
| **E02 — passkey** | Tidak ditemukan model/kontrol WebAuthn/passkey pada `../backend/prisma/schema.prisma`, `../backend/src/modules/auth`, atau layar login. Biometrik frontend (`lib/biometrics.ts`, `app/biometric-settings.tsx`) adalah kunci lokal/app-lock, bukan kredensial autentikasi server. | Klaim hanya tentang passkey/WebAuthn lintas perangkat; fitur biometrik lokal sudah ada. |
| **E03 — penghapusan akun** | `POST /users/me/delete-request` menandai akun nonaktif dan mengisi `deletedAt`, lalu menyebut penghapusan permanen dalam 30 hari. Tidak ditemukan route status/pembatalan. `app/delete-account.tsx` membersihkan sesi dan kembali ke login; form menyebut tenggang sebagai kebijakan lokal/belum ada di API. | Permintaan dan purge 30 hari sudah ada; yang disarankan adalah kontrol status/pembatalan/pemulihan sebelum purge. |
| **E04 — privasi dan ekspor** | `settings` hanya menyimpan dua toggle privasi (`profileVisible`, `showOnlineStatus`). `POST /settings/privacy/export` memang ada, tetapi payload ekspor di `settings.service.ts` berisi profil, keamanan, rekening yang dimasking, tautan sosial, follow/follower, favorit, badge, preferensi notifikasi, dan hitungan blok/laporan; tidak terlihat paket order, dompet, chat, sengketa, ulasan, showcase, atau tiket. | Ekspor dan dua toggle telah ada. Saran menyasar cakupan/riwayat ekspor dan kontrol privasi tambahan yang belum tampak di DTO/payload, bukan mengklaim hak ekspor sama sekali tidak tersedia. |
| **E05 — chat realtime** | `app/chat/[roomId].tsx` menyatakan pesan masih dipoll (8/20 detik) dan presence 30 detik; aplikasi belum memiliki klien Socket.IO. Backend sudah memakai WebSocket dan `chat.service.ts` memiliki serialisasi per-penerima untuk `chat.new_message`/`chat.reaction_updated` (CN-004/CN-005). | Gap adalah konsumsi realtime di aplikasi dan sinkronisasi dukungan; **jangan** mengulang perbaikan payload backend yang sudah terlihat di snapshot. Komentar frontend tentang payload lama kemungkinan stale. |
| **E06 — lampiran sengketa** | `app/dispute/[id].tsx` memuat TODO(DP-025) bahwa file picker/alur upload lampiran pesan sengketa belum dibuat. | Klaim dibatasi pada composer aplikasi; backend/file upload umum tidak dinyatakan absen. |
| **E07 — feedback** | Modul `feedback` menerima submission (`POST /feedback`) dan model `Feedback` hanya menyimpan masukan. Controller admin support bernama “tickets / feedback”, tetapi `AdminSupportService.listTickets()` men-query `supportTicket`, bukan tabel `Feedback`; layar admin yang ditemukan adalah tiket. | Sistem tiket support dan balasan admin sudah ada; gap adalah workflow peninjauan **entri model Feedback**. |
| **E08 — milestone escrow** | Model `Order` (`../backend/prisma/schema.prisma`) memiliki satu nilai/status, timestamp siklus order dan bukti pengiriman; tidak ada relasi/model milestone atau route milestone. | Ekstensi produk baru, bukan bug pada order escrow satu tahap yang sudah ada. |
| **E09 — retur pascapenyelesaian** | `OrderStatus` tidak memiliki status retur/RMA. Ada sengketa dan penanganan refund/reversal pembayaran; tidak ditemukan kanal return/exchange terstruktur setelah order selesai yang terpisah dari sengketa. | Jangan menyarankan mengulang refund webhook/chargeback Midtrans yang sudah ada. Ini alur purnajual baru di tingkat order. |
| **E10 — logistik** | Order sudah menyimpan `courierName`, `trackingNumber`, `trackingNotes`; layar meminta input manual. Tidak ditemukan adapter/route integrasi carrier untuk tarif, booking, dan event tracking otomatis. | Input resi/kurir manual **sudah ada**; gap adalah otomasi provider eksternal. |
| **E11 — katalog stok** | Showcase adalah konten etalase; pencarian model/schema tidak menemukan entitas inventory, SKU, stock, atau product variant. Pembuatan pesanan mempunyai tipe barang/jasa tersendiri. | Ekstensi marketplace opsional; tidak menganggap Kahade saat ini wajib menjadi sistem inventori. |
| **E12 — antrean KYC** | `../admin/src/app/(panel)/kyc/page.tsx` menetapkan `KYC_SLA_HOURS = 48` sebagai konstanta UI. Backend telah menyediakan endpoint bulk KYC, tetapi `bulkApproveKyc`/`bulkRejectKyc` hanya terlihat di adapter API, tidak dipakai layar antrean. | Tinjau perorangan dan endpoint bulk sudah ada. Saran menyasar SLA operasional yang terkonfigurasi dan penggunaan bulk di UI. |
| **E13 — verifikasi bisnis** | Backend mempunyai endpoint bulk approve/reject; adapter `bulkApproveBusiness`/`bulkRejectBusiness` tidak ditemukan dipanggil oleh layar admin. | Queue dan review satu per satu sudah ada; yang belum tampak adalah UX bulk serta pelaporan hasilnya. |
| **E14 — alat keuangan admin** | Adapter `getTransactionDetail` dan `reconcileUser` di `../admin/src/lib/api/admin/finance.ts` tidak ditemukan dipakai layar. Panel jejak audit memang ada dan bersifat read-only. | Tidak menyarankan membuat jejak audit dari nol; gap ialah integrasi detail transaksi dan tindakan rekonsiliasi yang tersedia pada adapter/backend. |
| **E15 — kampanye/voucher** | Admin sudah bisa membuat voucher, menonaktifkan voucher, membuat kampanye, mengaktifkan/menjeda kampanye. Adapter `getCampaign`, `updateCampaign`, `deleteCampaign`, dan `getVoucherDetail` tidak ditemukan dipanggil layar. | Saran menyasar detail/edit/hapus/analitik yang belum terhubung, bukan CRUD total yang tidak ada. |
| **E16 — administrasi pengguna** | `exportUsersCsv`, `getAdmin`, `listUserModerationEvents` tersedia di adapter admin tetapi tidak ditemukan dipakai layar. | Klaim pada permukaan admin yang ditinjau; adapter saja bukan bukti bahwa UI tersedia. |
| **E17 — moderasi laporan showcase** | Detail laporan menyembunyikan aksi untuk status final dan secara eksplisit menyatakan “Aksi moderasi lanjutan tidak tersedia”; backend menolak aksi lanjutan pada laporan final. | Aksi review awal (dismiss/takedown/no-action/under-review) sudah ada; gap adalah lifecycle sesudah keputusan final. |
| **E18 — moderasi Q&A** | Pengguna dapat menyembunyikan/membuka kembali pertanyaan/komentar di API `users`, tetapi tidak ditemukan controller admin/halaman admin Q&A. | Fitur moderasi pemilik konten sudah ada; yang disarankan adalah jalur moderator platform. |
| **E19 — API dan webhook mitra** | Pencarian schema/controller tidak menemukan API key/developer portal/webhook **keluar** untuk integrator mitra. Pembayaran masuk memiliki `WebhookLog`, retry, dan panel admin. | Butir paket ini khusus produk integrasi pihak ketiga, bukan webhook internal Midtrans yang telah ada. |
| **E20 — observability lintas layanan** | Frontend punya abstraksi log/telemetry (`lib/telemetry.ts`) namun tidak ada sink vendor yang didaftarkan pada snapshot; pencarian tidak menemukan instrumentation OpenTelemetry/Prometheus/trace lintas layanan. Audit log, log backend, dan panel dead-letter webhook sudah ada. | Ini peluang observability/monitoring tambahan, bukan klaim bahwa sistem sama sekali tidak mencatat log. |
| **E21 — QA admin dan aksesibilitas otomatis** | Pemeriksaan file `*.test.*`/`*.spec.*` pada `../admin` menghasilkan nol; frontend dan backend justru memiliki suite tes. Tidak ditemukan suite otomatis audit aksesibilitas admin. | Yang terbukti adalah ketiadaan file test berpola tersebut pada snapshot, bukan bahwa semua pengujian manual tidak dilakukan. |

### Fitur yang sengaja tidak dihitung sebagai gap

- Pengelolaan/restore etalase terhapus **sudah ada** melalui `app/showcase-management.tsx`, `GET /users/me/showcase/deleted`, dan route restore. Kandidat ini dikeluarkan.
- Ekspor data privasi **sudah ada**; saran hanya menambah cakupan/riwayatnya.
- Live Support dan sistem tiket dengan balasan admin **sudah ada**; itu berbeda dari tabel Feedback.
- Review KYC/bisnis per item **sudah ada**; API bulk juga sudah ada di backend.
- Perbaikan payload event chat per penerima CN-004/CN-005 **sudah tampak di backend**, sehingga tidak dimasukkan sebagai pekerjaan memperbaiki bug lama.
- Resi/kurir manual, webhook Midtrans, refund/partial-refund/reversal **sudah ada**; rekomendasi terkait integrasi carrier otomatis atau proses retur order, bukan mengulang kemampuan pembayaran tersebut.

## Daftar 525 tugas/gap yang belum tampak pada permukaan terkait

### 1. Login sosial — aplikasi dan provider (G001–G025, E01)

- **G001** Tambahkan tombol Google pada layar masuk dan daftar aplikasi.
- **G002** Tambahkan tombol Apple yang hanya tampil setelah provider Apple benar-benar didukung server.
- **G003** Buat kontrak endpoint kemampuan provider agar aplikasi tidak menebak konfigurasi environment.
- **G004** Hubungkan tombol Google aplikasi ke endpoint `/auth/social-login`.
- **G005** Tampilkan status “Google login belum dikonfigurasi” tanpa mengirim pengguna ke alur gagal.
- **G006** Selesaikan konfigurasi OAuth Google Android, termasuk package name dan signing fingerprint.
- **G007** Selesaikan konfigurasi OAuth Google iOS dan URL scheme aplikasi.
- **G008** Implementasikan callback/redirect Google untuk frontend web.
- **G009** Implementasikan verifikasi token identitas Apple di backend.
- **G010** Tambahkan pemuatan dan cache JWKS Apple untuk verifikasi token.
- **G011** Ikat nonce Apple ke percobaan login agar token hasil replay ditolak.
- **G012** Tambahkan relasi provider-subject yang stabil; jangan menjadikan email satu-satunya identitas eksternal.
- **G013** Buat alur “tautkan akun Google/Apple” dari akun yang sedang login.
- **G014** Tambahkan penyelesaian konflik bila email provider sudah dipakai akun password/OTP.
- **G015** Wajibkan penggantian nomor sintetis Google dengan nomor terverifikasi sebelum fitur sensitif.
- **G016** Tangani respons `TWO_FA_REQUIRED` dari login sosial dengan layar input TOTP/backup code.
- **G017** Tambahkan state loading, pembatalan, retry, dan pemulihan callback yang kedaluwarsa.
- **G018** Jelaskan kepada pengguna provider mana yang tertaut tanpa membuka token provider.
- **G019** Tambahkan pemutusan tautan provider dengan autentikasi ulang dan pemeriksaan metode login tersisa.
- **G020** Catat persetujuan pengguna sebelum mengirim profil dasar provider ke Kahade.
- **G021** Buat notifikasi keamanan saat provider baru ditautkan atau dilepas.
- **G022** Tambahkan audit trail admin/user untuk perubahan metode login eksternal.
- **G023** Samakan pesan UI untuk akun nonaktif, dibatasi, konflik, dan provider tidak tersedia.
- **G024** Tambahkan metrik funnel login sosial tanpa menyimpan token/email mentah di telemetry.
- **G025** Buat uji end-to-end Google, Apple, 2FA, cancel callback, dan akun email duplikat.

### 2. Passkey/WebAuthn lintas perangkat (G026–G050, E02) — ekstensi autentikasi

- **G026** Tambahkan model kredensial passkey berisi credential ID, public key, counter, dan user relation.
- **G027** Tambahkan endpoint untuk memulai pendaftaran passkey dan membuat challenge sekali pakai.
- **G028** Verifikasi attestation pendaftaran WebAuthn di backend.
- **G029** Tambahkan endpoint opsi autentikasi passkey dengan challenge dan masa berlaku.
- **G030** Verifikasi assertion, origin, RP ID, signature, dan counter di backend.
- **G031** Simpan challenge passkey secara sekali-pakai dan tahan replay secara atomik.
- **G032** Tetapkan RP ID/origin resmi per environment, termasuk staging dan domain preview yang diizinkan.
- **G033** Tambahkan tombol “Masuk dengan passkey” pada alur login, terpisah dari biometrik lokal.
- **G034** Tambahkan alur pendaftaran passkey dari menu Keamanan setelah autentikasi ulang.
- **G035** Tampilkan daftar nama, tanggal tambah, dan perangkat passkey tanpa membuka material rahasia.
- **G036** Izinkan penggantian nama passkey agar pengguna dapat membedakan perangkat.
- **G037** Tambahkan pencabutan satu passkey dari perangkat lain yang masih aktif.
- **G038** Cegah penghapusan metode login terakhir sebelum metode pemulihan baru dikonfirmasi.
- **G039** Tambahkan alur pemulihan ketika semua passkey hilang menggunakan OTP dan pemeriksaan risiko.
- **G040** Minta konfirmasi tambahan saat passkey dipakai untuk perubahan rekening atau keamanan.
- **G041** Sinkronkan passkey secara aman dengan dukungan autofill platform tanpa mengekspor private key ke server.
- **G042** Tangani fallback perangkat tanpa authenticator WebAuthn dengan opsi OTP/password.
- **G043** Tambahkan dukungan conditional UI/autofill passkey pada browser yang kompatibel.
- **G044** Buat pengaturan kebijakan passkey wajib/opsional per tindakan berisiko.
- **G045** Catat registrasi, penggunaan, kegagalan, dan pencabutan sebagai event keamanan.
- **G046** Deteksi perubahan counter/credential anomaly dan minta autentikasi ulang.
- **G047** Batasi jumlah passkey per akun dan sediakan respons rate-limit yang jelas.
- **G048** Tambahkan lokalisasi instruksi passkey untuk Android, iOS, dan browser.
- **G049** Tambahkan uji unit terhadap signature/origin/RP ID/challenge kedaluwarsa.
- **G050** Tambahkan uji perangkat nyata untuk registrasi, login, pencabutan, dan recovery passkey.

### 3. Status dan pembatalan penghapusan akun (G051–G075, E03)

- **G051** Tampilkan tanggal perkiraan purge 30 hari yang dihitung dari timestamp server.
- **G052** Tambahkan endpoint status penghapusan yang dapat dipanggil melalui alur pemulihan pra-login.
- **G053** Tambahkan endpoint pembatalan sebelum tenggang 30 hari berakhir.
- **G054** Rancang autentikasi ulang untuk pembatalan tanpa mengaktifkan sesi lama yang telah dicabut.
- **G055** Aktifkan ulang `isActive` dan pulihkan status akun secara transaksional setelah verifikasi berhasil.
- **G056** Pastikan worker purge memeriksa pembatalan terbaru tepat sebelum penghapusan permanen.
- **G057** Kirim email konfirmasi yang menyebut tanggal purge dan cara membatalkan.
- **G058** Jadwalkan pengingat sebelum purge, misalnya tujuh hari dan satu hari sebelumnya.
- **G059** Sediakan jalur pengingat yang tetap bisa diterima setelah push token dinonaktifkan.
- **G060** Tambahkan kode referensi permintaan penghapusan yang dapat disimpan pengguna.
- **G061** Simpan status siklus deletion terpisah: diminta, menunggu, dibatalkan, dipurge, atau ditahan.
- **G062** Buat riwayat perubahan status yang tidak dapat ditimpa oleh permintaan baru.
- **G063** Beri layar pra-login untuk menemukan akun yang masih berada pada masa tenggang.
- **G064** Minta verifikasi nomor/email yang masih dikuasai sebelum pemulihan.
- **G065** Beri peringatan dan jalur eskalasi jika email atau nomor akun sudah tidak dapat diakses.
- **G066** Tampilkan konsekuensi terhadap order, percakapan, dan data yang wajib dipertahankan sebelum konfirmasi.
- **G067** Pisahkan data yang wajib ditahan karena sengketa/retensi hukum dari data yang akan dipurge.
- **G068** Jelaskan data profil publik mana yang disembunyikan seketika dan mana yang dihapus setelah tenggang.
- **G069** Buat notifikasi ke pengguna yang memiliki order aktif bila penghapusan tertunda karena blocker.
- **G070** Tampilkan alasan blocker dari respons server, bukan hanya daftar best-effort dari aplikasi.
- **G071** Tambahkan dukungan penghapusan akun yang tidak memiliki password lokal (mis. akun sosial/OTP).
- **G072** Terapkan idempotensi untuk pengajuan ulang dan pembatalan berulang.
- **G073** Cegah dua worker purge memproses user yang sama secara bersamaan.
- **G074** Tambahkan halaman bantuan menjelaskan proses, retensi, dan batas pemulihan secara konsisten.
- **G075** Buat uji integrasi untuk request, sesi tercabut, recovery, pembatalan, dan purge kedaluwarsa.

### 4. Kontrol privasi dan ekspor data yang lebih lengkap (G076–G100, E04)

- **G076** Tambahkan kontrol visibilitas terpisah untuk email, nomor, tanggal lahir, dan gender pada profil.
- **G077** Tambahkan pengaturan siapa yang dapat melihat daftar follower dan following.
- **G078** Tambahkan kontrol visibilitas default untuk karya showcase baru.
- **G079** Tambahkan pilihan siapa yang dapat bertanya/berkomentar pada Q&A profil.
- **G080** Tambahkan pengaturan publikasi jawaban Q&A sebelum jawaban tampil ke publik.
- **G081** Tambahkan kontrol visibilitas ulasan/rating pada profil.
- **G082** Tambahkan pilihan menyembunyikan statistik profil tertentu dari pengunjung publik.
- **G083** Tambahkan kontrol indeksasi profil oleh mesin pencari.
- **G084** Pisahkan persetujuan pemasaran dari preferensi notifikasi transaksional.
- **G085** Simpan versi teks, waktu, channel, dan bukti persetujuan kebijakan pengguna.
- **G086** Tambahkan riwayat persetujuan dan kemampuan menarik persetujuan opsional.
- **G087** Tambahkan halaman riwayat permintaan ekspor dan status tautan unduhan.
- **G088** Tampilkan waktu kedaluwarsa berkas ekspor sebelum pengguna mengetuk tautan.
- **G089** Tambahkan manifest dataset dan versi skema pada setiap arsip ekspor.
- **G090** Sertakan riwayat order milik pengguna ke dalam ekspor data pribadi.
- **G091** Sertakan transaksi dompet dan ringkasan ledger yang aman untuk diunduh pengguna.
- **G092** Sediakan ekspor metadata chat beserta penjelasan retensi/penghapusan isi pesan.
- **G093** Sertakan data sengketa, keputusan, dan dokumen milik pemohon dengan redaksi yang tepat.
- **G094** Sertakan rating, jawaban, dan Q&A yang dibuat pengguna dalam paket ekspor.
- **G095** Sertakan showcase, komentar, reaksi, dan koleksi simpan milik pengguna.
- **G096** Sertakan tiket support dan feedback, dengan aturan khusus untuk pesan pihak lain.
- **G097** Jelaskan secara eksplisit data KYC/rekening yang dikecualikan atau dimasking dan alasannya.
- **G098** Tambahkan pilihan JSON terstruktur atau CSV untuk dataset tabel yang cocok.
- **G099** Buat manifest ekspor berbahasa Indonesia/Inggris yang konsisten dengan preferensi akun.
- **G100** Catat akses/unduhan arsip ekspor dan pastikan URL privat dibatasi waktu serta sekali pakai bila sesuai.

### 5. Realtime chat di aplikasi pengguna (G101–G125, E05)

- **G101** Tambahkan klien Socket.IO pada aplikasi Expo; saat ini layar chat hanya mengonsumsi REST.
- **G102** Sediakan provider koneksi realtime tunggal yang dapat dipakai semua layar.
- **G103** Autentikasikan handshake WebSocket dengan token/sesi tanpa meletakkan token di query URL.
- **G104** Gabungkan token refresh dan reconnect agar socket memakai kredensial terkini.
- **G105** Join room chat hanya setelah hak akses room tervalidasi.
- **G106** Leave room dan bersihkan listener saat layar/akun berganti.
- **G107** Konsumsi `chat.new_message` dengan tipe event dan serializer pesan yang sama dengan REST.
- **G108** Deduplikasi pesan realtime terhadap optimistic send dan poll REST yang masih aktif.
- **G109** Sinkronkan cursor pesan terakhir sesudah reconnect untuk mengambil event yang terlewat.
- **G110** Dengarkan event typing lawan bicara dan tampilkan indikator yang kedaluwarsa otomatis.
- **G111** Ganti poll presence 30 detik dengan event presence saat socket aktif.
- **G112** Dengarkan perubahan read receipt tanpa menunggu siklus refresh berikutnya.
- **G113** Terapkan event reaksi ke pesan berdasarkan `reactedByMe` milik viewer yang menerima.
- **G114** Sinkronkan edit pesan masuk secara realtime tanpa mengganti teks lokal yang lebih baru.
- **G115** Tangani event hapus pesan masuk dan state tombstone pada thread.
- **G116** Sinkronkan pin/unpin pesan ke semua anggota room yang berhak.
- **G117** Pause socket/polling yang tidak perlu saat aplikasi berada di background.
- **G118** Reconnect dan resubscribe ketika aplikasi kembali aktif atau jaringan pulih.
- **G119** Pertahankan polling REST hanya sebagai fallback ketika socket benar-benar terputus.
- **G120** Hentikan poll pesan/presence agresif saat koneksi realtime sehat untuk mengurangi baterai dan beban.
- **G121** Tambahkan backoff jitter untuk reconnect agar ribuan klien tidak menyerbu serentak.
- **G122** Tampilkan status offline/reconnecting dan kemampuan kirim ulang yang jelas.
- **G123** Batasi jumlah socket per akun lintas room dan tutup koneksi duplikat yang tidak dipakai.
- **G124** Catat metrik koneksi, reconnect, event terlewat, dan fallback tanpa isi pesan.
- **G125** Uji dua akun pada room yang sama untuk pesan, reaksi, typing, receipt, dan reconnect.

### 6. Lampiran pesan sengketa pada aplikasi (G126–G150, E06)

- **G126** Ganti TODO(DP-025) dengan pemilih berkas dari galeri pada composer pesan sengketa.
- **G127** Tambahkan pemilih dokumen agar bukti PDF/berkas yang diizinkan dapat dilampirkan.
- **G128** Terapkan validasi ukuran, MIME, dan jumlah lampiran sesuai kontrak backend sebelum upload.
- **G129** Tampilkan pratinjau gambar sebelum pengguna mengirim bukti.
- **G130** Tampilkan nama, tipe, dan ukuran berkas non-gambar sebelum dikirim.
- **G131** Sediakan tombol hapus lampiran dari draft tanpa menghapus bukti yang sudah terkirim.
- **G132** Tampilkan progres upload per berkas pada composer sengketa.
- **G133** Simpan state gagal per lampiran dan sediakan retry tanpa mengunggah ulang lampiran sukses.
- **G134** Cegah pengiriman pesan ganda saat upload masih berjalan.
- **G135** Kaitkan upload ke ID sengketa dan identitas pengirim yang tervalidasi.
- **G136** Render lampiran pesan dari DTO backend pada timeline sengketa.
- **G137** Buka gambar melalui viewer yang mendukung zoom dan navigasi lampiran.
- **G138** Buka berkas yang diizinkan lewat viewer aman atau sistem file viewer.
- **G139** Tangani signed URL kedaluwarsa dengan permintaan ulang, bukan menampilkan URL mentah.
- **G140** Tampilkan status lampiran: mengunggah, terkirim, tidak tersedia, atau gagal dibuka.
- **G141** Beri label pembeda bukti pembeli, penjual, dan moderator.
- **G142** Tambahkan cap waktu dan metadata dasar bukti tanpa mengubah file aslinya.
- **G143** Dukung pemilihan beberapa bukti dalam satu tindakan dengan batas yang eksplisit.
- **G144** Lindungi composer dari perubahan sengketa/role saat upload berlangsung.
- **G145** Tambahkan konfirmasi sebelum mengirim bukti sensitif atau dokumen identitas.
- **G146** Pastikan screen reader membacakan nama, tipe, dan status upload lampiran.
- **G147** Hapus file sementara lokal setelah sukses atau pembatalan sesuai kebijakan.
- **G148** Tambahkan pemeriksaan hak akses saat lampiran diminta oleh peserta sengketa.
- **G149** Tambahkan log audit unduh bukti oleh moderator tanpa menyimpan URL signed.
- **G150** Uji upload, retry, batas ukuran, URL kedaluwarsa, dan pergantian sengketa.

### 7. Workflow peninjauan feedback aplikasi (G151–G175, E07)

- **G151** Buat route admin khusus untuk membaca model `Feedback`, terpisah dari `SupportTicket`.
- **G152** Tambahkan halaman antrean feedback di navigasi admin dengan akses role yang sesuai.
- **G153** Tambahkan status feedback: baru, ditinjau, ditindaklanjuti, dan ditutup.
- **G154** Tambahkan field petugas penanggung jawab dan riwayat assignment.
- **G155** Tambahkan filter kategori, platform, rating, tanggal, status, dan akun/guest.
- **G156** Tambahkan pencarian aman pada teks feedback dan kontak tanpa mengekspos PII ke daftar umum.
- **G157** Buat tampilan detail dengan isi masukan, rating, platform, serta waktu submission.
- **G158** Tambahkan catatan internal admin yang tidak pernah dikirim ke pengguna.
- **G159** Tambahkan tag tema dan label dampak untuk mengelompokkan masukan serupa.
- **G160** Tambahkan deteksi duplikat berbasis kemiripan untuk membantu triase, bukan menolak otomatis.
- **G161** Tambahkan kemampuan menghubungi pengirim hanya jika contact consent tersedia.
- **G162** Tambahkan respons yang dapat dikirim ke akun Kahade dengan audit siapa yang menjawab.
- **G163** Simpan status dan balasan pada schema Feedback, bukan membuat tiket palsu tanpa relasi.
- **G164** Kirim notifikasi dalam aplikasi ketika masukan berstatus selesai dan pengguna memilih dapat dihubungi.
- **G165** Tambahkan batas retensi dan redaksi otomatis untuk data kontak guest.
- **G166** Tambahkan ekspor agregat feedback tanpa kolom kontak atau isi sensitif.
- **G167** Tampilkan volume, rating rata-rata, kategori, dan tren per versi/platform.
- **G168** Buat aturan SLA triase yang dapat dikonfigurasi per kategori kritis.
- **G169** Tambahkan eskalasi feedback yang mengandung sinyal risiko keamanan/penipuan.
- **G170** Tambahkan reason code penutupan agar keputusan tidak hanya berupa status.
- **G171** Simpan audit perubahan status, assignment, tag, dan balasan admin.
- **G172** Batasi detail kontak dan isi feedback berdasarkan role admin.
- **G173** Tambahkan pagination berbasis cursor untuk antrean yang bertumbuh besar.
- **G174** Tambahkan halaman ringkasan feedback pada dashboard admin.
- **G175** Uji akses guest, pemfilteran, status, audit, dan larangan kebocoran kontak.

### 8. Order escrow bertahap/milestone (G176–G200, E08) — ekstensi produk

- **G176** Tambahkan model `OrderMilestone` dengan urutan, deskripsi, nilai, status, dan deadline.
- **G177** Tambahkan constraint bahwa total nominal milestone sama dengan nilai order.
- **G178** Buat endpoint membuat milestone saat draft order belum dibayar.
- **G179** Batasi perubahan milestone setelah pembayaran kecuali disetujui kedua pihak.
- **G180** Tambahkan endpoint progres dan status tiap milestone.
- **G181** Pisahkan saldo escrow per milestone, bukan hanya per order keseluruhan.
- **G182** Buat transisi submit pekerjaan milestone dengan timestamp dan actor.
- **G183** Tambahkan bukti kerja khusus milestone tanpa bercampur dengan bukti kirim order umum.
- **G184** Tambahkan aksi buyer menerima atau meminta revisi milestone tertentu.
- **G185** Tambahkan jumlah putaran revisi yang disepakati pada tiap milestone.
- **G186** Release dana per tahap setelah acceptance dengan transaksi ledger idempoten.
- **G187** Hitung fee dan diskon secara konsisten pada release bertahap.
- **G188** Tambahkan deadline review per milestone dan pengingat kepada buyer.
- **G189** Tambahkan perpanjangan deadline milestone dengan persetujuan eksplisit pihak terkait.
- **G190** Buka sengketa yang dibatasi ke milestone yang disengketakan.
- **G191** Tampilkan sisa escrow, dana released, dan nilai milestone berikutnya kepada kedua pihak.
- **G192** Buat timeline order dengan event milestone yang dapat diverifikasi.
- **G193** Tambahkan notifikasi perubahan tahap kepada buyer dan seller.
- **G194** Tambahkan mekanisme pembatalan sisa milestone tanpa menarik dana yang sudah released.
- **G195** Buat dashboard admin untuk membaca status dan saldo tiap milestone.
- **G196** Tambahkan alat rekonsiliasi invariant total nilai vs escrow milestone.
- **G197** Migrasikan order lama menjadi satu milestone sintetis tanpa mengubah saldo.
- **G198** Tambahkan kontrol concurrency saat dua pihak mengubah/menyetujui tahap bersamaan.
- **G199** Tulis kebijakan produk dan legal tentang acceptance, revisi, dan pelepasan per tahap.
- **G200** Uji seluruh transisi milestone, dispute, retry webhook, dan ledger balance.

### 9. Retur/tukar barang setelah order selesai (G201–G225, E09) — ekstensi purnajual

- **G201** Definisikan kebijakan retur berdasarkan tipe order dan kategori barang sebelum membangun workflow.
- **G202** Tambahkan status return request terpisah dari `OrderStatus` dan sengketa pembayaran.
- **G203** Buat endpoint buyer mengajukan retur dalam jendela waktu kebijakan.
- **G204** Simpan alasan retur terstruktur beserta deskripsi bebas.
- **G205** Lampirkan foto kondisi barang dan bukti pembelian pada permintaan retur.
- **G206** Tampilkan tanggal akhir pengajuan retur yang dihitung server.
- **G207** Beri seller pilihan menerima, menolak dengan alasan, atau minta klarifikasi.
- **G208** Tambahkan batas waktu respons seller dan eskalasi otomatis ke support.
- **G209** Sediakan opsi refund, tukar barang, perbaikan, atau penyelesaian yang disetujui kedua pihak.
- **G210** Tambahkan pencatatan persetujuan nominal refund tanpa memanggil refund provider dua kali.
- **G211** Hubungkan hasil refund dengan ledger/order agar saldo dan status tidak berbeda.
- **G212** Buat instruksi pengiriman balik yang hanya muncul sesudah retur disetujui.
- **G213** Simpan nomor resi retur terpisah dari resi pengiriman awal.
- **G214** Tambahkan event tracking paket retur ke timeline purnajual.
- **G215** Minta konfirmasi penerimaan barang retur sebelum menyelesaikan kompensasi bila kebijakan memerlukan.
- **G216** Tambahkan alur negosiasi penyelesaian dan catatan yang terlihat oleh kedua pihak.
- **G217** Sediakan eskalasi ke sengketa tanpa menggandakan case aktif.
- **G218** Cegah pengajuan ganda untuk order/item yang sama.
- **G219** Buat dashboard admin return queue dan filter umur kasus.
- **G220** Simpan audit keputusan, lampiran, perpindahan barang, dan refund secara utuh.
- **G221** Beri notifikasi status kepada buyer/seller di setiap perpindahan tahap.
- **G222** Buat aturan retensi bukti retur dan penghapusan data yang sensitif.
- **G223** Tambahkan reason code penolakan yang konsisten dan dapat dianalisis.
- **G224** Tampilkan riwayat retur pada detail order dan profil dukungan.
- **G225** Uji masa berlaku, race condition, refund parsial, penolakan, dan eskalasi.

### 10. Integrasi kurir dan tracking otomatis (G226–G250, E10) — ekstensi logistik

- **G226** Buat abstraction layer provider kurir agar integrasi tidak menempel pada satu vendor.
- **G227** Tambahkan katalog kurir yang didukung beserta layanan dan wilayah cakupan.
- **G228** Tambahkan endpoint estimasi ongkir dan waktu kirim dari alamat pickup/destination.
- **G229** Validasi format alamat dan kode pos yang diperlukan sebelum meminta tarif.
- **G230** Tampilkan perbandingan layanan kurir pada alur order barang fisik.
- **G231** Tambahkan pemilihan pickup atau drop-off sesuai dukungan provider.
- **G232** Buat booking pickup/label pengiriman dari layar order.
- **G233** Simpan ID booking provider dan label dalam entitas pengiriman tersendiri.
- **G234** Sediakan unduh/cetak label yang aman dari detail order.
- **G235** Konsumsi webhook status tracking dengan signature dan idempotency provider.
- **G236** Normalisasi event tracking provider ke status internal lintas kurir.
- **G237** Dedup event kurir yang dikirim berulang atau tidak berurutan.
- **G238** Tampilkan lokasi/event perjalanan tanpa membuka data alamat lengkap ke pihak yang tidak berhak.
- **G239** Tambahkan refresh tracking manual saat provider tidak mengirim webhook.
- **G240** Tangani provider timeout dengan status unknown, bukan mengarang status gagal.
- **G241** Beri seller fallback input resi manual ketika integrasi kurir tidak tersedia.
- **G242** Sinkronkan pembatalan/void label dengan provider dan riwayat order.
- **G243** Buat kontrol biaya kirim dan pihak yang menanggungnya sebelum payment.
- **G244** Tampilkan estimasi dan ongkir aktual secara terpisah di ringkasan transaksi.
- **G245** Tambahkan SLA keterlambatan berdasarkan service level yang dipilih.
- **G246** Beri notifikasi event penting seperti pickup, transit, delivered, dan exception.
- **G247** Buat panel admin untuk booking gagal, tracking macet, dan refund ongkir.
- **G248** Tambahkan rekonsiliasi antara tagihan provider dan biaya yang dicatat.
- **G249** Sediakan feature flag per provider/wilayah sebelum rollout penuh.
- **G250** Uji sandbox provider, event duplikat, status tidak dikenal, dan fallback manual.

### 11. Katalog produk dan persediaan terstruktur (G251–G275, E11) — ekstensi marketplace

- **G251** Pisahkan entitas produk yang dapat dibeli dari konten showcase sosial.
- **G252** Tambahkan SKU unik per produk/varian yang dikelola seller.
- **G253** Tambahkan atribut opsi seperti ukuran/warna beserta kombinasi varian valid.
- **G254** Simpan stok tersedia dan stok yang sedang dicadangkan untuk order.
- **G255** Buat transaksi reservasi stok saat order menunggu pembayaran.
- **G256** Lepaskan reservasi otomatis ketika payment gagal/kedaluwarsa atau order dibatalkan.
- **G257** Kurangi stok secara idempoten setelah order dikonfirmasi sesuai kebijakan.
- **G258** Cegah overselling melalui constraint/transaksi saat order bersamaan.
- **G259** Tambahkan jumlah item dan harga satuan ke order produk, bukan hanya judul/nilai bebas.
- **G260** Buat halaman katalog produk dengan filter kategori, rentang harga, dan ketersediaan.
- **G261** Tambahkan status draft, aktif, habis, dan arsip untuk listing produk.
- **G262** Beri seller form untuk membuat dan mengedit atribut produk terstruktur.
- **G263** Sediakan impor/ekspor stok CSV untuk seller dengan validasi baris.
- **G264** Tambahkan peringatan stok menipis yang dapat diatur per SKU.
- **G265** Sediakan bulk update harga dan stok dengan pratinjau perubahan.
- **G266** Tampilkan riwayat mutasi stok dengan actor, sumber, dan referensi order.
- **G267** Tambahkan alasan adjustment stok dan kontrol role untuk perubahan manual.
- **G268** Simpan satuan berat/dimensi agar dapat dipakai integrasi ongkir.
- **G269** Hubungkan listing produk ke halaman profil bisnis tanpa mencampur konten sosial.
- **G270** Tambahkan pencarian berdasarkan SKU/nama varian khusus bagi seller.
- **G271** Tambahkan filter produk yang hanya dapat dibeli setelah verifikasi bisnis bila diperlukan.
- **G272** Buat moderasi atribut/listing produk terpisah dari moderasi showcase.
- **G273** Tambahkan notifikasi stok habis dan pemulihan stok kepada seller.
- **G274** Tampilkan kebijakan harga, variasi, dan ketersediaan sebelum checkout.
- **G275** Uji race stok, rollback pembayaran, variasi, dan migrasi listing lama.

### 12. SLA dan operasi antrean KYC (G276–G300, E12)

- **G276** Pindahkan nilai SLA 48 jam dari konstanta halaman ke konfigurasi yang memiliki pemilik dan audit.
- **G277** Sajikan SLA efektif dari backend agar daftar/detail admin memakai sumber kebenaran yang sama.
- **G278** Definisikan apakah SLA dihitung dalam jam kalender atau hari/jam kerja.
- **G279** Simpan timestamp mulai SLA dan timestamp jeda ketika dokumen perlu dilengkapi.
- **G280** Tambahkan label “mendekati SLA” sebelum status terlambat.
- **G281** Kirim alert ke role KYC admin saat antrean mendekati batas waktu.
- **G282** Buat metrik median dan persentil waktu review berdasarkan status dan periode.
- **G283** Tampilkan umur antrean serta reviewer penanggung jawab pada dashboard KYC.
- **G284** Tambahkan filter antrean berdasarkan SLA breached dan umur pengajuan.
- **G285** Gunakan endpoint bulk approve yang sudah ada dari toolbar seleksi antrean.
- **G286** Gunakan endpoint bulk reject dengan alasan wajib dan pratinjau dampak.
- **G287** Batasi bulk selection sesuai batas backend 50 item.
- **G288** Tampilkan hasil berhasil/gagal per ID, bukan satu toast agregat.
- **G289** Sediakan retry hanya untuk baris gagal tanpa memproses ulang yang sukses.
- **G290** Cegah bulk action atas item yang statusnya berubah sejak daftar dimuat.
- **G291** Tambahkan konfirmasi ekstra untuk keputusan bulk yang tidak dapat dibatalkan.
- **G292** Tampilkan catatan reviewer sebelumnya dengan kontrol akses PII.
- **G293** Tambahkan assignment dan reassignment reviewer dengan audit trail.
- **G294** Buat fallback antrean untuk pengajuan yang dokumennya gagal diunduh.
- **G295** Tampilkan alasan dokumen gagal/URL signed kedaluwarsa tanpa menampilkan key storage.
- **G296** Tambahkan antrean pemeriksaan ulang berdasarkan umur dokumen/masa berlaku identitas.
- **G297** Konfigurasikan retensi dokumen KYC dan status purge sesuai kebijakan legal.
- **G298** Buat ekspor agregat performa KYC tanpa mengekspor dokumen atau NIK.
- **G299** Tambahkan runbook penanganan backlog KYC dan alur eskalasi.
- **G300** Uji perhitungan SLA, pause, bulk partial failure, RBAC, dan audit.

### 13. Operasi bulk verifikasi badan usaha (G301–G325, E13)

- **G301** Tambahkan checkbox pemilihan pengajuan pada tabel verifikasi bisnis.
- **G302** Tampilkan toolbar jumlah terpilih dan aksi bulk yang tersedia untuk role KYC.
- **G303** Hubungkan aksi approve massal ke endpoint backend yang sudah ada.
- **G304** Hubungkan aksi reject massal dengan alasan wajib per keputusan.
- **G305** Tampilkan konfirmasi berisi jumlah, status, dan konsekuensi keputusan batch.
- **G306** Batasi jumlah batch di UI agar sesuai batas controller backend.
- **G307** Tampilkan status tiap pengajuan setelah operasi bulk selesai.
- **G308** Tampilkan daftar alasan gagal per ID dan tombol salin ringkasan aman.
- **G309** Tambahkan retry selektif hanya untuk hasil gagal sementara.
- **G310** Batalkan pilihan yang sudah tidak berstatus PENDING saat data diperbarui.
- **G311** Pertahankan selection dengan aman saat admin berpindah halaman antrean.
- **G312** Bersihkan selection saat filter status berubah untuk menghindari keputusan lintas antrean.
- **G313** Tambahkan preview dokumen ringkas tanpa membuka lebih banyak PII daripada perlu.
- **G314** Tambahkan filter berdasarkan jenis badan hukum dan kelengkapan dokumen.
- **G315** Tambahkan filter pengajuan yang menunggu dokumen tambahan.
- **G316** Tampilkan durasi antrean dan status SLA khusus bisnis.
- **G317** Buat ringkasan volume disetujui/ditolak/dicabut per periode.
- **G318** Tambahkan penugasan reviewer bisnis yang terpisah dari reviewer KYC personal.
- **G319** Tampilkan riwayat perubahan legalitas/masa berlaku pada detail badan usaha.
- **G320** Buat alarm untuk dokumen legal usaha yang kedaluwarsa atau perlu diperbarui.
- **G321** Tambahkan alasan pencabutan standar dan catatan internal terpisah.
- **G322** Terapkan notifikasi kepada pemohon untuk hasil bulk secara individual.
- **G323** Sediakan ekspor kerja antrean yang tidak menyertakan nomor NPWP mentah.
- **G324** Catat batch ID agar audit keputusan massal dapat ditelusuri bersama.
- **G325** Uji endpoint bulk melalui UI, role gating, status race, dan redaksi dokumen.

### 14. Detail transaksi dan rekonsiliasi keuangan admin (G326–G350, E14)

- **G326** Tambahkan tautan detail transaksi pada daftar keuangan yang memanggil adapter `getTransactionDetail`.
- **G327** Buat panel detail yang menampilkan pemilik dompet dan relasi order/top-up secara terkontrol.
- **G328** Tampilkan status provider, ID referensi, dan webhook terkait tanpa membocorkan rahasia provider.
- **G329** Sediakan pencarian transaksi berdasarkan transaction ID, order ID, dan referensi eksternal.
- **G330** Tambahkan timeline perubahan status transaksi dari ledger dan webhook log.
- **G331** Hubungkan aksi “rekonsiliasi user” ke `reconcileUser` yang sudah tersedia pada adapter.
- **G332** Tampilkan saldo tercatat, saldo hitung ulang, selisih, dan invariant yang dilanggar.
- **G333** Tambahkan preview hasil rekonsiliasi sebelum admin mengeksekusi tindakan korektif.
- **G334** Pisahkan hak lihat rekonsiliasi dari hak menjalankan mutasi saldo.
- **G335** Tambahkan alur approval dua admin untuk koreksi ledger manual berisiko tinggi.
- **G336** Buat catatan alasan wajib dan referensi tiket pada setiap koreksi keuangan.
- **G337** Tambahkan endpoint acknowledge discrepancy agar temuan dapat ditandai ditangani dengan audit.
- **G338** Simpan status temuan rekonsiliasi: baru, diselidiki, diperbaiki, atau diterima sebagai selisih sah.
- **G339** Tambahkan filter rekonsiliasi berdasarkan besar selisih, umur, dan jenis invariant.
- **G340** Sediakan ekspor laporan rekonsiliasi yang menghilangkan PII yang tidak diperlukan.
- **G341** Tambahkan batasan nominal/rate limit untuk tindakan koreksi manual.
- **G342** Minta autentikasi ulang sebelum operasi yang dapat mengubah saldo.
- **G343** Buat perbandingan hasil rekonsiliasi sebelum/sesudah tindakan.
- **G344** Beri alert ketika selisih melewati ambang finansial yang disetujui.
- **G345** Tampilkan metrik total wallet diperiksa, bersih, dan bermasalah pada halaman finance.
- **G346** Tambahkan rekonsiliasi terjadwal dengan hasil yang bisa dibuka dari admin.
- **G347** Simpan snapshot hasil batch agar daftar discrepancy tidak berubah diam-diam saat dilihat.
- **G348** Sediakan drill-down dari discrepancy ke transaksi penyebab dengan pagination.
- **G349** Tambahkan simulasi permission test untuk admin finance dan super admin.
- **G350** Uji rekonsiliasi bersih, selisih, operasi berulang, audit, dan otorisasi.

### 15. Siklus edit/hapus dan analitik kampanye/voucher (G351–G375, E15)

- **G351** Tambahkan halaman detail kampanye yang memakai adapter `getCampaign` yang saat ini belum terhubung.
- **G352** Tambahkan layar edit kampanye yang mengirim perubahan melalui `updateCampaign`.
- **G353** Tampilkan field kampanye mana yang terkunci sesudah status aktif.
- **G354** Tambahkan validasi tanggal, rollout, audience, dan batas redemption sebelum menyimpan edit.
- **G355** Beri pratinjau perubahan kampanye sebelum admin menekan simpan.
- **G356** Tambahkan aksi hapus kampanye draft memakai `deleteCampaign` yang tersedia.
- **G357** Cegah penghapusan kampanye yang sudah menerbitkan voucher tanpa konfirmasi/aturan backend.
- **G358** Buat riwayat versi kampanye agar perubahan audience dan periode bisa diaudit.
- **G359** Tampilkan ringkasan redemption, skip, error, dan biaya promo pada detail kampanye.
- **G360** Tambahkan filter kampanye berdasarkan pemilik pembuat, status, dan rentang tanggal.
- **G361** Sediakan duplikasi kampanye ke draft baru tanpa menyalin hasil redemption lama.
- **G362** Tambahkan jadwal aktivasi otomatis dengan zona waktu yang terlihat.
- **G363** Tambahkan jadwal akhir dan notifikasi sebelum kampanye berakhir.
- **G364** Tampilkan preview segmen target dan estimasi penerima sebelum aktivasi.
- **G365** Simpan alasan pause/resume dan actor pada riwayat kampanye.
- **G366** Tambahkan detail voucher melalui adapter `getVoucherDetail` yang belum digunakan layar.
- **G367** Tampilkan riwayat penggunaan voucher per user dengan masking data sensitif.
- **G368** Tambahkan pencarian voucher berdasarkan kode/nama tanpa membuka data seluruh user.
- **G369** Beri preview dampak ketika voucher dinonaktifkan saat masih memiliki pengguna aktif.
- **G370** Tambahkan ekspor agregat performa voucher per jenis dan periode.
- **G371** Tampilkan biaya diskon/cashback aktual terpisah dari jumlah redemption.
- **G372** Tambahkan alarm ketika kuota atau batas anggaran kampanye hampir habis.
- **G373** Buat idempotency key UI untuk aktivasi agar klik ganda tidak menerbitkan duplikat.
- **G374** Catat perubahan dan aktivasi kampanye dalam audit trail admin.
- **G375** Uji detail/edit/delete/activate/pause, akses role, dan respons parsial provider.

### 16. Fitur operasional admin pengguna dan tim (G376–G400, E16)

- **G376** Tambahkan ekspor CSV pengguna dari layar admin menggunakan adapter `exportUsersCsv` yang belum dipakai.
- **G377** Minta alasan dan autentikasi ulang sebelum mengekspor dataset pengguna.
- **G378** Sediakan pilihan kolom CSV dengan prinsip minimisasi data pribadi.
- **G379** Masking email/nomor pada ekspor massal kecuali role memiliki izin khusus.
- **G380** Catat actor, filter, jumlah baris, dan waktu setiap ekspor admin.
- **G381** Buat ekspor asinkron untuk dataset besar dengan tautan privat kedaluwarsa.
- **G382** Tambahkan filter dan pencarian moderasi berdasarkan event, actor, target, dan rentang waktu.
- **G383** Tampilkan riwayat `listUserModerationEvents` pada detail user yang saat ini tidak memanggil adapter itu.
- **G384** Tampilkan timeline satu user yang menggabungkan perubahan status, report, dan keputusan moderator.
- **G385** Bedakan event otomatis sistem dari tindakan admin pada timeline moderasi.
- **G386** Tambahkan filter catatan internal yang tidak dapat dibaca role customer support biasa.
- **G387** Buat halaman detail admin dari adapter `getAdmin` yang belum digunakan di tim admin.
- **G388** Tampilkan role, status, waktu login, dan histori perubahan hak akses pada detail admin.
- **G389** Tambahkan review periodik akses admin dan tanggal sertifikasi ulang izin.
- **G390** Buat alur suspend sementara admin yang mempertahankan audit history.
- **G391** Tambahkan alasan wajib ketika mengubah role atau menonaktifkan akun admin.
- **G392** Tampilkan daftar sesi aktif admin dan aksi revoke sesi yang dipilih.
- **G393** Tambahkan pemberitahuan login admin dari perangkat/lokasi baru.
- **G394** Terapkan pembatasan unduh detail PII pada halaman user berdasarkan role dan tujuan kerja.
- **G395** Tambahkan alur permintaan akses darurat dengan masa berlaku singkat dan approval.
- **G396** Buat deteksi konflik tugas, misalnya admin meninjau laporan yang dibuat akun terkait.
- **G397** Tambahkan catatan handoff antar petugas pada kasus user tanpa terlihat pengguna.
- **G398** Tampilkan total kasus terbuka per petugas untuk mencegah antrean yatim.
- **G399** Tambahkan retensi dan ekspor audit aktivitas admin yang dapat diverifikasi.
- **G400** Uji role gating untuk ekspor, detail admin, moderasi, dan revoke session.

### 17. Tindakan setelah laporan etalase final (G401–G425, E17)

- **G401** Tambahkan aksi reopen untuk status final dengan alasan dan hak role khusus.
- **G402** Tambahkan aksi append catatan moderasi tanpa menimpa resolusi awal.
- **G403** Simpan riwayat resolusi sebagai event append-only per laporan.
- **G404** Bedakan permintaan banding pemilik item dari report baru atas item yang sama.
- **G405** Buat alur banding atas takedown yang mengumpulkan alasan dan bukti baru.
- **G406** Tampilkan status banding dan reviewer berbeda dari moderator keputusan awal.
- **G407** Terapkan aturan konflik kepentingan untuk reviewer banding.
- **G408** Tambahkan aksi pulihkan item takedown setelah banding disetujui.
- **G409** Simpan snapshot status/item saat keputusan awal dibuat untuk jejak audit.
- **G410** Tampilkan perbedaan item saat laporan dibuka dibanding saat ditinjau ulang.
- **G411** Tambahkan assignment dan antrean laporan showcase berdasarkan tingkat risiko.
- **G412** Beri label alasan kebijakan yang dilanggar, bukan hanya catatan bebas.
- **G413** Tambahkan dokumentasi internal moderator untuk setiap reason code.
- **G414** Tampilkan laporan lain yang merujuk item/pemilik sama untuk konteks moderator.
- **G415** Deteksi report duplikat dan tautkan sebagai satu cluster tanpa menghapus laporan sumber.
- **G416** Tambahkan notifikasi status kepada pelapor sesuai kebijakan privasi.
- **G417** Tambahkan notifikasi kepada pemilik item atas takedown dan jalur banding.
- **G418** Buat ringkasan bukti yang relevan dan aman untuk reviewer kedua.
- **G419** Tambahkan SLA review, overdue badge, dan eskalasi laporan berisiko tinggi.
- **G420** Tampilkan histori semua aksi moderasi pada halaman detail final.
- **G421** Tambahkan ekspor laporan moderasi untuk audit kepatuhan tanpa data yang tak perlu.
- **G422** Catat alasan manual ketika moderator mempertahankan atau membalikkan keputusan final.
- **G423** Buat aksi restrict sementara yang berbeda dari takedown permanen bila kebijakan mengizinkan.
- **G424** Tambahkan endpoint backend transisi pascafinal dengan state machine eksplisit.
- **G425** Uji reopen, appeal, restore, role, race condition, dan audit event.

### 18. Moderasi platform atas pertanyaan dan komentar profil (G426–G450, E18)

- **G426** Tambahkan endpoint admin untuk mengambil antrean pertanyaan profil yang dilaporkan/tersembunyi.
- **G427** Buat halaman admin “Moderasi Q&A” dengan pagination dan pencarian.
- **G428** Bedakan tindakan hide pemilik profil dari hide moderator platform.
- **G429** Tambahkan reason code dan catatan internal pada tindakan moderator.
- **G430** Tambahkan tombol hide/unhide moderator yang tidak memakai endpoint self-service pemilik.
- **G431** Buat antrean laporan komentar Q&A yang terpisah dari laporan etalase.
- **G432** Tampilkan konteks thread secukupnya agar moderator memahami percakapan.
- **G433** Sembunyikan PII asker dan receiver yang tidak dibutuhkan dalam list view.
- **G434** Tambahkan alat redaksi data pribadi di teks pertanyaan/komentar.
- **G435** Buat tindakan hapus permanen dengan approval bila retensi legal mengizinkan.
- **G436** Tambahkan mekanisme appeal untuk pemilik dan penulis konten yang disembunyikan.
- **G437** Simpan event moderasi append-only dan actor admin pada record terkait.
- **G438** Tampilkan histori hide/unhide dan alasan terakhir pada detail Q&A.
- **G439** Tambahkan filter berdasarkan spam, profanity, laporan, dan status jawaban.
- **G440** Buat deteksi spam lintas profil untuk membantu moderator menemukan pola berulang.
- **G441** Tambahkan rate-limit tindakan moderator dan konfirmasi untuk bulk hide.
- **G442** Tambahkan bulk action hanya setelah validasi reason dan jumlah item.
- **G443** Notifikasikan penulis secara netral saat konten disembunyikan atau dipulihkan.
- **G444** Sediakan halaman panduan kebijakan moderasi Q&A untuk admin.
- **G445** Tampilkan metrik antrean, waktu penyelesaian, dan alasan keputusan.
- **G446** Tambahkan assignment kasus dan handoff antar moderator.
- **G447** Terapkan RBAC yang membedakan customer support dari moderator konten.
- **G448** Buat ekspor audit agregat tanpa mengekspor teks konten sensitif massal.
- **G449** Tambahkan uji keamanan IDOR untuk akses pertanyaan lintas user.
- **G450** Uji API, UI, appeal, audit, RBAC, dan sinkronisasi state hide/unhide.

### 19. API publik dan webhook keluar untuk mitra (G451–G475, E19) — ekstensi platform

- **G451** Definisikan produk API mitra dan batas data yang boleh diakses sebelum membuat endpoint.
- **G452** Tambahkan model API client dengan owner organisasi dan status aktif/nonaktif.
- **G453** Buat penerbitan API key sekali tampil dengan penyimpanan hash di backend.
- **G454** Tambahkan scope granular per endpoint dan data resource.
- **G455** Sediakan rotasi key tanpa downtime dengan masa overlap terbatas.
- **G456** Tambahkan revoke key instan dan audit alasan pencabutan.
- **G457** Buat portal admin untuk melihat client, scope, pemakaian, dan status key tanpa menampilkan secret.
- **G458** Sediakan sandbox terpisah dari saldo dan data produksi.
- **G459** Tambahkan dokumentasi API publik berversi dan contoh request Indonesia/Inggris.
- **G460** Terapkan rate limit per client, endpoint, dan tingkat akses.
- **G461** Tambahkan usage dashboard dan kuota yang dapat dipantau mitra.
- **G462** Tambahkan registry event bisnis yang boleh dikirim sebagai webhook keluar.
- **G463** Buat endpoint pendaftaran URL webhook oleh mitra dengan verifikasi kepemilikan domain.
- **G464** Tanda tangani payload webhook dengan secret per endpoint dan timestamp.
- **G465** Terapkan perlindungan replay untuk penerima webhook melalui event ID dan signature window.
- **G466** Tambahkan retry eksponensial dan dead-letter terpisah untuk webhook mitra keluar.
- **G467** Sediakan test event dan simulasi delivery dari portal.
- **G468** Tampilkan request/response teredaksi, status, waktu, dan jumlah retry kepada pemilik endpoint.
- **G469** Tambahkan tombol replay event secara manual dengan idempotency key.
- **G470** Batasi URL webhook ke HTTPS dan blok private/reserved IP untuk mencegah SSRF.
- **G471** Tambahkan allowlist IP keluar dan prosedur perubahan alamat resmi.
- **G472** Buat versi payload yang kompatibel dan catatan deprecation sebelum perubahan breaking.
- **G473** Tambahkan endpoint health/verification webhook dan status langganan event.
- **G474** Buat kontrak keamanan, penghapusan client, dan prosedur incident mitra.
- **G475** Uji signature, SSRF, retry, key rotation, rate limit, dan isolasi sandbox.

### 20. Observability dan kesiapan insiden lintas layanan (G476–G500, E20)

- **G476** Daftarkan sink telemetry produksi pada abstraksi frontend agar crash/error tidak hanya menjadi log lokal.
- **G477** Pilih kebijakan redaksi field sebelum mengirim event frontend ke vendor observability.
- **G478** Tambahkan correlation/request ID yang konsisten dari aplikasi sampai backend dan admin.
- **G479** Instrumentasikan trace untuk jalur order dari create hingga completion.
- **G480** Tambahkan span pembayaran/webhook tanpa merekam nomor rekening, token, atau isi sensitif.
- **G481** Instrumentasikan trace upload file dari request presigned sampai confirm.
- **G482** Tambahkan metrik latency/error untuk endpoint login, order, dompet, dispute, dan chat.
- **G483** Buat dashboard p95/p99 latency per route dan deployment.
- **G484** Tambahkan metrik backlog queue email, OTP, notifikasi, dan pekerjaan terjadwal.
- **G485** Buat alert untuk kenaikan error login/OTP dengan ambang yang mencegah alert storm.
- **G486** Tambahkan alert untuk rasio payment pending, webhook retry, dan dead-letter.
- **G487** Buat SLO dan error budget untuk alur kritis pengguna, bukan hanya uptime server.
- **G488** Tampilkan status dependensi Redis, PostgreSQL, storage, OTP, dan payment di health admin.
- **G489** Tambahkan synthetic check untuk login, pembacaan saldo, dan status order tanpa akun nyata.
- **G490** Simpan release/deployment version pada event error agar regresi bisa dikorelasikan.
- **G491** Buat sampling policy untuk trace volume tinggi dengan semua transaksi gagal tetap terlacak.
- **G492** Tambahkan alert penyimpanan penuh/pertumbuhan tabel log dan webhook inbox.
- **G493** Buat dashboard penggunaan koneksi WebSocket dan reconnect per versi aplikasi.
- **G494** Tambahkan metric delivery push/email dan status provider OTP yang terkonfigurasi.
- **G495** Buat runbook on-call yang menghubungkan alert ke pemeriksaan dan mitigasi.
- **G496** Tambahkan prosedur incident severity, owner, dan komunikasi status ke pengguna.
- **G497** Sediakan halaman status layanan publik dengan komponen dan histori gangguan.
- **G498** Latih restore backup dan pemulihan disaster secara terjadwal dengan hasil tercatat.
- **G499** Buat kontrol akses observability yang memisahkan operator dari akses payload sensitif.
- **G500** Uji jalur alert dari kegagalan sintetis sampai notifikasi petugas dan penutupan insiden.

### 21. QA admin, aksesibilitas otomatis, dan kesiapan rilis (G501–G525, E21)

- **G501** Tambahkan fondasi unit-test runner untuk komponen dan helper pada repo admin.
- **G502** Tambahkan unit test untuk RoleGate dan setiap variasi role admin.
- **G503** Buat integration test daftar/detail tiket beserta perubahan status dan balasan.
- **G504** Uji antrean KYC per filter, pagination, serta state SLA sebelum merilis perubahan.
- **G505** Uji operasi bulk KYC/bisnis dengan hasil sukses parsial dan konflik status.
- **G506** Tambahkan test finance untuk detail transaksi, rekonsiliasi, dan masking PII.
- **G507** Tambahkan test kampanye create/edit/delete/activate/pause setelah UI lifecycle diimplementasi.
- **G508** Buat test moderasi showcase untuk status final dan jalur banding/reopen baru.
- **G509** Buat test admin Feedback terpisah dari test support ticket.
- **G510** Tambahkan smoke test halaman admin untuk mencegah route yang tercantum di menu menjadi 404.
- **G511** Tambahkan Playwright test login admin, refresh token, logout, dan expiry session.
- **G512** Uji permission negatif bahwa role tidak berhak menerima 403/redirect yang benar.
- **G513** Tambahkan automated axe/WCAG scan untuk setiap halaman panel admin.
- **G514** Audit nama accessible dan state label untuk tombol ikon pada admin.
- **G515** Uji navigasi keyboard penuh, fokus dialog, dan pemulihan fokus setelah modal ditutup.
- **G516** Tambahkan pemeriksaan kontras warna untuk badge status, teks sekunder, dan grafik.
- **G517** Buat pengujian zoom 200% dan reflow pada tabel lebar serta halaman detail.
- **G518** Uji screen reader terhadap tabel data, pagination, filter, dan alert perubahan status.
- **G519** Tambahkan test locale Indonesia/Inggris untuk tanggal, mata uang, dan pesan error admin.
- **G520** Tambahkan visual regression untuk komponen antrean, form, dan dialog keputusan.
- **G521** Uji dashboard pada viewport laptop, tablet, dan ponsel tanpa kehilangan aksi utama.
- **G522** Tambahkan test performa tabel besar dan strategi virtualisasi bila jumlah baris meningkat.
- **G523** Blok rilis admin jika lint, typecheck, unit, accessibility, atau smoke test gagal.
- **G524** Buat test staging yang memakai mock provider dan data sintetis tanpa PII produksi.
- **G525** Publikasikan laporan cakupan test per domain dan daftar skenario manual yang masih tersisa.

## Prioritas implementasi yang disarankan

1. **P0 — perlindungan pengguna:** status/pembatalan hapus akun (G051–G075), kelengkapan ekspor/privasi (G076–G100), dan lampiran bukti sengketa (G126–G150).
2. **P1 — operasi dan moderasi:** KYC/business bulk + SLA (G276–G325), feedback (G151–G175), laporan showcase final (G401–G425), dan Q&A moderation (G426–G450).
3. **P1 — pengalaman komunikasi:** realtime chat dan dukungan ketika jaringan pulih (G101–G125).
4. **P2 — kemampuan baru yang perlu keputusan bisnis/legal:** milestone, retur, integrasi kurir, katalog stok, passkey, dan API mitra (G026–G050, G176–G275, G451–G475).
5. **P1 lintas domain — mutu operasional:** observability, pengujian admin, dan aksesibilitas otomatis (G476–G525).

Prioritas tersebut adalah usulan berdasarkan dampak dan kepastian bukti, bukan komitmen roadmap atau pernyataan bahwa seluruh kemampuan ekstensi di atas wajib dibuat.
