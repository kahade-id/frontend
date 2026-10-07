# Rekomendasi Backend — Chat (2026-10-08)

Konteks: perbaikan frontend chat (header center, halaman "Pesan baru", ruang
chat tanpa dobel-kirim, media detail satu gaya, pengaturan pesan) dikerjakan
**tanpa mengubah kontrak API**. Semua item di bawah ini adalah **rekomendasi**
yang akan menghilangkan seluruh kelas bug/kejanggalan tertentu, tetapi TIDAK
wajib: klien sudah punya fallback untuk setiap kasus yang disebut.

Urut prioritas: P0 = menghilangkan bug nyata yang masih bisa muncul,
P1 = akurasi tampilan, P2 = nice-to-have.

---

## P0 — Gema `chat.new_message` untuk pengirim harus jelas menandai sisi

**Masalah.** Saat mengirim, klien menampilkan pesan optimistis (`temp-…`) lalu
menunggu respons POST. Backend juga mem-broadcast `chat.new_message` ke
pengirim. Bila payload gema TIDAK membawa penanda sisi (`isMine` /
`isFromCurrentUser` / `fromUser`), klien menyimpulkan `fromUser: false` dan
sebelumnya menambahkan bubble KEDUA di layar (keluhan "double-send" 2026-10-08).

Frontend sudah memasang dua lapis perbaikan di klien:

1. `findOptimisticMatch`/`mergeChatMessages` sekarang sadar-identitas
   (`selfIds` dari `GET /v1/users/me`) sehingga gema netral yang pengirimnya
   adalah pengguna login tetap menggantikan bubble optimistis.
2. Pagar anti-kirim-ulang di composer (muatan identik dalam 1,5 detik).

**Yang diminta dari backend (kecil, murah):** pastikan SETIAP payload
`chat.new_message` (dan `chat.message_updated`) memuat `isMine`/
`isFromCurrentUser` untuk penerima pengirim — atau, lebih tegas, JANGAN kirim
gema ke socket pengirim dan cukup andalkan respons POST. Salah satu saja:
klien tetap benar, tetapi percobaan balapan yang tidak perlu hilang.

**Manfaat:** hilangnya satu kelas bug "bubble ganda" tanpa mengandalkan
pencocokan waktu/teks di klien.

---

## P0 — Delivery receipt (opsional, tetapi menutup celah UX status)

**Masalah.** `ChatMessageStatus` klien punya `sent` (centang satu) → `read`
(centang ganda). Tidak ada `delivered`, jadi centang satu berarti "diterima
server", bukan "sampai perangkat penerima".

**Usulan:** bila backend menambahkan `GET /rooms/{id}/read-receipts` extended
(`deliveredAt`) atau event `chat.message_delivered`, klien dapat menampilkan
tahap tengah. Tanpa ini: tidak ada yang rusak — centang satu tetap jujur
("terkirim ke server"), dan klien TIDAK mengarang status.

---

## P1 — `urlExpiresAt` konsisten untuk lampiran

**Masalah.** URL lampiran di-sign dengan TTL 5 menit. Lampiran lama kadang
tidak membawa `urlExpiresAt` → klien menganggap SELALU kedaluwarsa dan
memanggil `GET /rooms/{id}/attachments?limit=100` untuk menyegarkan satu
berkas yang diketuk (pola `refreshAttachmentIfExpired`).

**Usulan:**
1. Sertakan `urlExpiresAt` (ISO) akurat di setiap URL lampiran.
2. (Ideal) Endpoint per berkas: `GET /attachments/{id}/url` → `{ url,
   urlExpiresAt }`, supaya klien tidak mengambil 100 baris untuk satu foto.

Detail pola hari ini ada di `docs/rekomendasi-backend-media.md` (P4) — daftar
ini mengulangnya karena menyentuh langsung pengalaman membuka media dari chat.

---

## P1 — Metadata pesan untuk animasi & pengelompokan

**Masalah kecil.** Klien memutuskan "pesan ini BARU" dari `createdAt`
(jendela `BUBBLE_ENTRANCE_FRESH_MS` = 15 detik) untuk animasi masuk, dan
memakai `createdAt` untuk pemisah hari/grup 5 menit. Dua hal yang membuatnya
lebih tajam:

- `createdAt` server (bukan waktu server-terapkan-di-klien) selalu ada di
  SEMUA jalur (poll, realtime, respons POST). Bila salah satu jalur mengirim
  waktu lokal/perangkat, pesan bisa dianggap "lama" (tanpa animasi) atau
  salah grup.
- Bila tersedia, sertakan `seq` monoton per room. Klien memakai urutan waktu
  hari ini; `seq` akan membuat penentuan "pesan setelah jangkar"
  (`afterMessageId`) bebas dari skew jam.

---

## P1 — Kontak tersimpan: daftar dengan alias/nama panggilan

**Kondisi hari ini.** Halaman "Pesan baru" memakai API yang SUDAH ada:
`GET /v1/users/saved` (simpan profil lewat username) +
`POST/DELETE /v1/users/{username}/saved` + `GET /v1/users/search?q=` +
`POST /v1/chat/dm`. Tidak ada endpoint baru yang diasumsikan, tidak ada
daftar kontak lokal di perangkat.

**Rekomendasi (bila produk ingin "kontak" yang lebih kaya):**

1. **Alias/nama panggilan per kontak** — `PATCH /v1/users/saved/{userId}`
   dengan `{ alias }`. Alasannya: `fullName` sering bukan nama yang dikenali
   pengguna ("Toko Maju Jaya 88" vs "Bu Ani").
2. **Batch lookup status DM** — `POST /v1/chat/dm/lookup { usernames: [] }`
   → `{ username: roomId | null }`. Halaman kontak bisa menandai "sudah pernah
   chat" tanpa membuat room baru (hari ini `POST /v1/chat/dm` yang membuat).

Tanpa keduanya halaman tetap berfungsi: nama ditampilkan apa adanya, dan
ruang DM dibuat saat diketuk (satu permintaan, idempoten di server).

---

## P1 — Pencarian username: batas & hasil

**Kondisi hari ini.** `GET /v1/users/search?q=` mensyaratkan q ≥ 2 huruf dan
dibatasi 10 permintaan/menit (throttle). Klien membatasi: debounce 350 ms,
min 2 huruf, dan kunci cache per query.

**Usulan kecil:**

1. Kembalikan `total` (atau `hasMore`) pada respons pencarian supaya klien
   bisa menampilkan "menampilkan 20 dari N" atau memuat lebih banyak.
   Hari ini klien meminta `limit=20` dan menampilkan apa adanya.
2. Bila memungkinkan, naikkan throttle khusus endpoint cari-user (mis. 30/menit)
   — 10/menit cukup untuk mengetik, tetapi terasa sempit bila pengguna
   menghapus-lalu-mengetik ulang beberapa kali. Klien sudah aman terhadap 429
   (ditampilkan sebagai galat yang bisa dicoba lagi).

---

## P2 — Notifikasi/pengaturan DM: jelaskan alasan penolakan

**Kondisi hari ini.** `POST /v1/chat/dm` menolak dengan 403
`CHAT_DM_NOT_ALLOWED` saat kebijakan penerima melarang. Klien menampilkan
kalimat penjelas ("Pengguna ini membatasi pesan dari orang yang belum ia
kenal.").

**Usulan:** sertakan field mesin-terbaca pada galat (mis.
`reason: "FOLLOWING" | "NONE"`), supaya klien bisa membedakan "harus saling
mengikuti" dari "menolak semua DM" dan menawarkan langkah lanjutan yang tepat
(mis. "Ikuti dulu" vs "Tidak bisa dihubungi"). Tanpa ini, copy tetap benar
tetapi generik.

---

## P2 — Ekspor & lampiran: paritas dengan web

Catatan kecil untuk kelengkapan (bukan bug klien):

- `exportChatRoom` hari ini menghasilkan TXT di klien dari data yang dimuat.
  Bila backend kelak menyediakan ekspor server-side (mis. HTML/PDF dengan
  lampiran), klien akan menawarkan format itu.
- `GET /v1/chat/attachments` dipakai untuk menyegarkan URL; menambahkan
  `type` filter (photo/video/file) akan mengurangi payload untuk room besar.

---

## Ringkas (yang benar-benar diminta)

| Isu | Dampak bila tidak diadopsi | Prioritas |
| --- | --- | --- |
| Tandai sisi pada gema `chat.new_message` (atau jangan kirim ke pengirim) | Klien tetap benar lewat `selfIds` + pencocokan waktu; ada jalur balapan yang tidak perlu | P0 |
| `deliveredAt` / event delivered | Status berhenti di "terkirim" — jujur, tanpa tahap tengah | P0 |
| `urlExpiresAt` konsisten + endpoint URL per berkas | Kadang menarik 100 baris lampiran untuk satu berkas | P1 |
| `seq` per room + jaminan `createdAt` server semua jalur | Urutan tetap benar lewat waktu; animasi bisa salah untuk jalur waktu-lokal | P1 |
| Alias kontak + `dm/lookup` | Nama apa adanya; room dibuat saat diketuk (tetap idempoten) | P1 |
| `total`/`hasMore` di cari-user, throttle lebih longgar | Daftar dibatasi 20 tanpa indikasi "ada lagi" | P1 |
| Alasan terstruktur pada 403 DM | Copy generik tapi benar | P2 |
| Ekspor server-side, filter tipe lampiran | Ekspor TXT klien; payload lampiran lebih besar | P2 |
