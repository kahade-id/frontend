# Offline Fase 3 — antrean pesan chat

## Perilaku

- Pesan chat teks, lampiran yang sudah selesai diunggah, lokasi, kartu produk, dan voice note yang payload-nya valid dapat masuk antrean chat tersendiri saat transport melaporkan koneksi offline/gangguan jaringan.
- Bubble lokal menampilkan **“Menunggu koneksi”**. Toast menjelaskan bahwa pesan akan dikirim otomatis setelah koneksi pulih.
- Antrean dipulihkan saat aplikasi dibuka dan dikirim FIFO setelah reconnect. Kiriman memakai `Idempotency-Key` yang sama sepanjang percobaan antrean/retry.
- Antrean chat dipisahkan dari `lib/offline-queue.ts`. Allowlist sosial tetap hanya like/unlike showcase dan follow/unfollow; chat tidak pernah dilewatkan sebagai aksi sosial.
- Payload antrean disimpan melalui SecureStore per room pada native. Web hanya menyimpan antrean selama proses aktif, agar isi chat tidak masuk localStorage. Indeks room tidak memuat isi pesan.
- Maksimum 100 pesan tertunda, 14 room, dan 7 hari untuk pengiriman otomatis. Pesan kedaluwarsa atau kiriman yang hasilnya tidak pasti ketika proses ditutup tetap terlihat sebagai pesan yang perlu dicoba ulang manual; tidak dikirim ulang diam-diam.
- Jika penulisan SecureStore tidak tersedia/terlalu besar, antrean tetap aktif dalam memori untuk sesi aplikasi saat ini dan UI memberi tahu bahwa antrean hanya aktif selama aplikasi terbuka.

## Di luar cakupan antrean

- Aksi wallet, pembayaran, transaksi, escrow, sengketa, pengelolaan order, dan mutasi non-chat lain tetap ditolak gerbang transport saat offline.
- Pesan sistem, polling, dan kartu order tidak diterima oleh allowlist payload antrean chat.
- Aksi finansial memakai copy offline yang menjelaskan bahwa aksi tidak diantrekan dan bisa dicoba lagi setelah tersambung.

## Verifikasi terarah

`tests/chat-send-queue.test.ts`, `tests/offline-queue.test.ts`, `tests/chat-window.test.ts`, dan `tests/chat-message-timestamps.test.tsx` mengunci drain/recovery, idempotensi, status bubble, dan batas fail-closed.
