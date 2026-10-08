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

---

# Tambahan — audit FE chat (24 temuan)

Konteks: perbaikan ruang chat berdasarkan audit 24 temuan (optimistic UI,
status kirim, voice note, navigasi/pencarian, pin & reaksi, performa, UX,
privasi, bug kritis). Sama seperti bagian di atas: dikerjakan **tanpa
mengubah kontrak API**; setiap butir di bawah adalah **rekomendasi** yang
menghapus kelas bug/kejanggalan tertentu, dan klien sudah punya fallback
untuk masing-masing. Satu bagian per kelompok temuan (A–I).

## A — Aksi optimistis: pin, lepas pin, hapus

**Kondisi hari ini.** Pin, lepas pin, dan hapus pesan kini optimistis di klien
(UI berubah seketika; gagal → dikembalikan + toast). Agar rollback tidak
pernah salah arah:

1. **`DELETE …/messages/{id}` idempoten.** Menghapus pesan yang sudah terhapus
   sebaiknya `200/204`, bukan `404`/`400`. Hari ini kasus "sudah dihapus
   lawan bicara / perangkat lain" tampil sebagai GAGAL (bubble dikembalikan,
   lalu hilang lagi saat event hapus tiba). Dengan idempotensi, hasilnya
   sama-sama "hilang" tanpa kedipan.
2. **`POST/DELETE …/pin` mengembalikan daftar pin resmi** (`{ pins: [...] }`).
   Klien kini memanggil `GET /pins` setelah setiap pin/lepas pin hanya untuk
   rekonsiliasi urutan; satu respons lengkap menghapus satu round-trip.
   Mem-pin pesan yang sudah terpin dan melepas yang tak terpin juga sebaiknya
   `200` (idempoten), bukan galat.

## B — Kirim pesan, idempotensi, dan status baca

**Kondisi hari ini.** Bubble optimistis kini memakai id sementara yang
diturunkan dari `Idempotency-Key`, kunci render yang stabil, dan satu fungsi
penggantian (`reconcileSentMessage`) sehingga gema yang tiba sebelum respons POST
tidak lagi menghasilkan bubble ganda. Retry memakai key DAN body yang sama
dengan kiriman pertama. Ketiga hal ini bekerja tanpa perubahan backend; yang
berikut hanya membuatnya lebih pasti:

1. **Pantulkan `Idempotency-Key` pada pesan** (`chat.new_message`, respons
   `POST …/messages`, dan `GET …/messages` untuk pesan milik pengirim), mis.
   `clientMessageId`. Klien sudah membaca `idempotencyKey` / `clientMessageId` /
   `clientId` bila ada dan memakainya sebagai pencocokan utama (tanpa tebak
   teks/waktu). Tanpa field ini klien tetap benar lewat pencocokan teks +
   lampiran + jendela waktu, yang sengaja dilonggarkan untuk normalisasi server
   (CRLF, `FILE`→`VIDEO`, ukuran lampiran).
2. **Semantik key yang tegas:** key sama + body sama → kembalikan pesan ASLI
   (200, bukan membuat pesan kedua); key sama + body berbeda → `409/422` dengan
   kode yang jelas; masa berlaku key ≥ 24 jam. Retry setelah timeout (respons
   hilang padahal pesan sudah masuk) hanya aman bila ini terpenuhi.
3. **Status baca dengan watermark.** Event `chat.read` sekarang menyiratkan
   "semua pesan hingga `readAt`" hanya untuk event massal (tanpa `messageId`).
   Usulan: sertakan `lastReadMessageId` (atau `upToMessageId`) pada SETIAP
   event baca, dan dukung `GET …/read-receipts?since=<ISO>` agar klien tidak
   mengunduh status seluruh pesan room tiap rekonsiliasi (payload tumbuh
   seiring panjang room).
4. **Delivered receipt** — sudah tercatat di P0 di atas; klien tetap
   menampilkan jam → centang → centang ganda (= dibaca) dan tidak mengarang
   tahap tengah.

## C — Voice note (tahan untuk merekam, geser untuk mengunci)

**Kondisi hari ini.** Mic di composer mendukung tahan (rekam, lepas = kirim),
geser ke atas (kunci), geser ke kiri (batal); ketukan biasa tetap membuka
lembar perekam lama. Rekaman diunggah lewat endpoint upload ruang lalu
dikirim otomatis sebagai `VOICE` dengan `durationSeconds`. Tidak ada kontrak
yang berubah. Dua hal kecil yang akan mempertajamnya:

1. **Waveform sungguhan.** Bubble voice note menampilkan gelombang
   DEKORATIF (deterministik dari id pesan) karena backend tidak menyimpan
   amplitudo. Usulan: pada `POST …/upload` (atau saat kirim `VOICE`) terima
   `waveform` (±64 sampel 0–255) dan kembalikan di `attachments[].waveform`;
   klien sudah bisa memakainya begitu tersedia. Sampai itu ada, UI tidak
   mengklaim gelombang itu sebagai amplitudo asli.
2. **Satu langkah kirim untuk voice note.** Saat ini unggah + kirim adalah dua
   request berurutan (klien mengotomatiskan keduanya). Bila `POST …/messages`
   menerima unggahan langsung (multipart) untuk tipe `VOICE`, kegagalan di
   tengah (unggah sukses, kirim gagal) tidak mungkin terjadi dan satu
   `Idempotency-Key` cukup untuk seluruh operasi.

## D — Navigasi & pencarian: lompat ke pesan lama

**Kondisi hari ini.** Ikon cari di header membuka sheet pencarian seluruh
riwayat (kata kunci ditebalkan + muat bertahap); mengetuk hasil / kutipan /
pin / pesan berbintang melompat TEPAT ke pesannya dan menyorotnya. Pesan yang
belum termuat dicari dengan memuat halaman lama satu per satu
(`GET …/messages?cursor=`, 30 pesan per halaman, anggaran 15 halaman). Kasus
tak terjangkau dijelaskan per alasan (dihapus / disembunyikan / tidak
ditemukan / di luar jangkauan). Tanpa perubahan kontrak. Yang akan
menghapus seluruh kelas "menunggu banyak halaman":

1. **`GET …/messages?around=<messageId>&limit=N`** (jendela di sekitar satu
   pesan, plus `nextCursor`/`prevCursor`). Hari ini lompat ke pesan berusia
   ratusan pesan memerlukan belasan request berurutan dan tetap berhenti di
   anggaran halaman ("di luar jangkauan"). Dengan `around`, SATU request
   cukup, dan klien memuat jendela itu sebagai thread aktif.
2. **Hasil pencarian dengan konteks.** Sertakan `snippet` (potongan di
   sekitar kata kunci), `total`, dan — bila memungkinkan — `position`
   (urutan pesan dari yang terbaru). Hari ini klien memotong sendiri dan
   tidak tahu berapa total hasil.
3. **Batas `limit` pada `GET …/messages` didokumentasikan** (spec hanya
   menyebut `limit: number`). Klien memakai 30 agar aman; bila backend
   mengizinkan 100 untuk jalur lompat, jumlah request turun ±3×.

## E — Pin & reaksi

**Kondisi hari ini.** Penolakan "batas pin tercapai" dikenali dari kode/pesan
galat dan dijelaskan di UI ("Maksimal N pin per percakapan…"); batas yang
baru dipelajari diingat selama sesi ruang itu (pin berikutnya yang pasti
ditolak dijelaskan tanpa request) dan baris pin menampilkan "2/3". Mengetuk
chip reaksi membuka daftar "siapa memberi reaksi apa". Semua heuristik
klien; kontrak tidak berubah. Karena kontrak OpenAPI hari ini tidak menyebut
angka maupun kode galat batas pin (respons `200` tanpa skema), pengenalan
itu bersifat menebak — usulan yang menghapus tebakan:

1. **Kode galat tegas + batas di payload.** Penolakan pin: `409`
   `{ code: "CHAT_PIN_LIMIT_REACHED", limit: 3 }`. Klien sudah membaca kode
   seperti ini bila ada, dan memakai `limit` daripada menyimpulkan angka dari
   jumlah pin saat ditolak.
2. **Ekspos batas lebih awal:** `GET …/pins` → `{ pins: [...], maxPins: 3 }`.
   Dengan itu baris pin bisa menampilkan "2/3" sejak ruang dibuka (hari ini
   hanya setelah penolakan pertama) dan tombol Pin dapat dijelaskan sebelum
   pengguna mencoba.
3. **Reaksi: `users` WAJIB pada `reactions[]`** (`{ userId, fullName,
   avatarUrl? }`). Tipe klien sudah menyebutnya opsional; tanpanya daftar
   reaksi hanya bisa menamai "Anda" dan (di DM) lawan bicara — di ruang
   dengan >2 pihak muncul "Pengguna lain" dengan jumlah yang benar tetapi
   tanpa nama. Cukup `userId`+`fullName` untuk emoji yang ≤ N pengguna
   pertama, ditambah `count` total.
4. **`userId` pada `reactions[].users` memakai id PUBLIK (`USR-…`)** seperti
   `GET /v1/users/me`, supaya baris "Anda" dikenali tanpa bergantung pada id
   internal (klien membandingkan dengan keduanya, tetapi hanya satu yang
   dijamin ada di payload).

## F — Performa: efek layar & daftar ribuan ruang

**Kondisi hari ini.** Efek layar ruang chat diaudit (deps primitif, tanpa
efek samping di updater, tanpa mengganti objek pesan yang tak berubah) dan
daftar chat memakai jendela render khusus baris rapat. Dua hal di sisi
server yang akan menghilangkan beban terbesar untuk pengguna dengan ribuan
ruang:

1. **Indikator mengetik di daftar tanpa join per ruang.** Klien harus
   `join-room chat:<id>` untuk SETIAP ruang yang indikatornya ingin
   ditampilkan (bertahap 10 ruang / 2 dtk; kini dibatasi 60 ruang teratas).
   Usulan: kirim `chat.typing` untuk semua ruang milik pengguna ke satu
   channel pribadi (`user:<id>`, yang sudah dipakai event pin ruang) — daftar
   chat cukup mendengarkan satu channel, nol join tambahan, dan batas 60
   ruang bisa dicabut.
2. **`GET /v1/chat/rooms` berbasis kursor.** Paginasi `page/limit` dengan
   urutan `updatedAt` bergeser tiap ada pesan baru: item pindah antar halaman
   sehingga "muat lebih banyak" bisa melewatkan atau menggandakan ruang
   (klien menambal dengan urut ulang + dedupe per id). Dengan `cursor`
   (`updatedAt`+`id` terakhir) halaman berikutnya stabil — dan perbaikan klien
   itu tidak lagi diperlukan.

## G — UX: mengetik, pemisah hari, ruang kosong, berkas besar

**Kondisi hari ini.** Indikator mengetik berhenti 3 dtk setelah diam (dan
seketika saat draft kosong / pesan terkirim / kolom kehilangan fokus /
aplikasi ke latar), berdenyut tiap 5 dtk selama masih mengetik, dan di ruang
multi-pihak menyebut nama ("Budi sedang mengetik…") dari
`chat.typing.username` yang SUDAH ada di payload. Pemisah hari menghitung
ulang labelnya saat hari berganti; ruang kosong punya ilustrasi + panduan;
berkas > 20 MB meminta konfirmasi sebelum diunggah. Tidak ada perubahan
kontrak. Yang akan menghapus angka-angka yang kini disalin di klien:

1. **Endpoint konfigurasi chat** — `GET /v1/chat/config` →
   `{ attachmentMaxBytes, attachmentMaxCount, allowedMimeTypes,
   messageMaxLength, voiceNoteMaxSeconds, maxPinsPerRoom }`. Hari ini klien
   menyalin batas dari kode backend (`lib/chat-attachment-limits.ts`:
   "tidak ada endpoint yang mengekspos batas ini — gap kontrak yang
   diketahui"), menebak batas pin dari penolakan (bagian E), dan mem-hardcode
   ambang konfirmasi berkas besar (20 MB) sebagai kebijakan klien. Satu
   endpoint menutup ketiganya dan membuat perubahan batas di server tidak
   diam-diam melenceng di klien.
2. **Typing: sertakan `expiresAt` pada SETIAP event `chat.typing`** (field-nya
   sudah ada di tipe). Klien memakai kedaluwarsa tetap 10 dtk bila server
   tidak mengirimnya; dengan `expiresAt` akurat, indikator mati tepat saat
   status server habis, termasuk bila paket `stop` hilang.

## H — Privasi: screenshot & rekam layar, pesan terusan

**Kondisi hari ini.** Pengaturan pesan → grup "Layar" → saklar "Izinkan
screenshot & rekam layar di chat" (default IZINKAN, disimpan LOKAL di
perangkat). Dimatikan → ruang chat dan daftar chat (hanya saat tab Pesan
terfokus) dilindungi `expo-screen-capture`: Android FLAG_SECURE (juga
mengosongkan pratinjau di daftar aplikasi terbaru), iOS pencegahan screenshot
& rekam layar + blur app-switcher. Pesan hasil Teruskan diberi label
"Diteruskan". Tidak ada field baru yang WAJIB; untuk dua hal berikut backend
bisa menyempurnakan:

1. **Sinkron antar-perangkat** — tambahkan `allowScreenCapture` (boolean,
   default `true`) ke `GET/PATCH /v1/chat/privacy` (tempat `hideReadReceipts`
   dan `dmPolicy` sudah hidup). Hari ini preferensi per perangkat: pengguna
   yang mematikannya di HP A tetap bisa di-screenshot di HP B. Klien tinggal
   menjadikan nilai server sumber kebenaran dan menyimpan salinan lokal
   sebagai cache offline.
2. **Penanda "Diteruskan" yang lengkap** — pastikan `forwardedFromId` (dan
   `forwardedFrom`) ikut di SEMUA jalur: `GET …/messages`, `chat.new_message`
   realtime, `lastMessage` pada `GET /rooms`, dan hasil pencarian. Usul
   tambahan untuk pencegahan penipuan: `isForwarded: boolean` yang eksplisit
   dan `forwardCount` (diteruskan berkali-kali = label lebih tegas, ala
   "Diteruskan berkali-kali"), serta menolak meneruskan pesan yang memuat
   nomor rekening ke ruang yang bukan milik transaksi yang sama bila
   kebijakan antipenipuan menghendakinya. Klien hanya membaca penanda; tidak
   ada logika keamanan yang bergantung pada klien.
3. **Event tangkapan layar (opsional, keputusan produk).** Sebagian aplikasi
   memberi tahu lawan bicara saat percakapan di-screenshot. Klien dapat
   mengirim `POST …/screenshot-notice` bila produk menginginkannya; tidak
   diaktifkan hari ini karena menyangkut privasi pihak lain dan tidak
   diminta di audit.

## I — Bug kritis: layar kosong saat buka ruang, kedipan putih saat kirim

**Kondisi hari ini (semua di klien, tanpa perubahan kontrak).**

*Layar kosong (I23).* Penyebab yang ditemukan, semuanya sekarang tertutup:

1. Rute tanpa `roomId` meninggalkan `loading=true` selamanya (shimmer abadi).
2. `loading` baru padam setelah `POST …/read` (`markChatRoomRead`) selesai —
   request yang tidak ada hubungannya dengan isi thread. Bila endpoint itu
   lambat/menggantung, pengguna menatap shimmer padahal pesan sudah ada.
3. List digulir ke ujung SEBELUM baris di ujung ter-mount: tampil dulu bagian
   atas riwayat lalu melompat, atau sebuah celah kosong di tengah.
4. Keadaan kosong/galat/memuat hidup di `ListEmptyComponent` dalam ternary —
   mudah menghasilkan area putih saat urutan state berubah.

Sekarang satu mesin keadaan (`resolveThreadState`) memutuskan tampilan:
`memuat → shimmer berbentuk percakapan` · `ada pesan → thread` ·
`kosong → ilustrasi + panduan` · `galat → pesan + Coba lagi` ·
`ruang dihapus (404) → penjelasan + kembali ke daftar` ·
`tautan rusak → penjelasan`. Memuat >12 dtk menambah catatan "Masih memuat
percakapan…" + Coba lagi. Selama chunk layar dimuat, rute menampilkan shimmer
yang sama, dan error render ditangkap `ErrorBoundary` tingkat-rute.

*Kedipan putih saat kirim (I24).* Dugaan "render ulang besar memblokir UI"
terbukti benar; penyebabnya ditemukan lewat harness hitung-render pada layar
sungguhan (`tests/chat-room-thread-states.test.tsx`):

1. `openAttachment` bergantung pada `messages`, sehingga identitasnya berganti
   pada SETIAP perubahan pesan (kirim, masuk, centang baca, reaksi). Ia dikirim
   ke tiap baris sebagai `onAttachmentPress`, jadi memo SEMUA baris batal dan
   seluruh list di-render ulang. Kini pesan terkini dibaca lewat ref saat
   diketuk.
2. `stickyHeaderIndices` memakai indeks data padahal VirtualizedList memakai
   ruang indeks anak (`ListHeaderComponent` = anak ke-0, item `i` ↔ `i+1`).
   Akibatnya header "Muat pesan sebelumnya" yang menempel, dan untuk tiap
   pemisah hari yang menempel justru bubble SEBELUMNYA — sel berbeda dibungkus
   ulang setiap list berubah, pemisah hari tidak pernah menempel (B10 rusak
   diam-diam). Ini bug lama; indeks kini digeser (`stickyDayChildIndices`).
3. Daftar baris (pemisah hari, penanda belum dibaca, bubble) dibangun ulang
   dengan objek baru tiap perubahan; kini `buildThreadRows` memakai ulang objek
   baris yang tidak berubah dan mengembalikan array lama bila tak ada yang
   berubah, `previous` dihitung sekali per baris, handler `onLayout` di-cache
   per baris, dan callback footer/composer stabil — menambah satu pesan hanya
   me-render baris baru (teruji: baris lama TIDAK di-render ulang saat kirim,
   saat respons server tiba, maupun saat pesan realtime masuk).

**Rekomendasi backend (tidak wajib, menyempurnakan penanganan galat):**

1. **Bedakan `404` dan `403` untuk ruang.** Klien memperlakukan `404` sebagai
   "percakapan tidak tersedia" (tidak ada gunanya Coba lagi). Pastikan ruang
   yang dihapus/dinonaktifkan konsisten `404` dengan kode mesin yang stabil
   (mis. `CHAT_ROOM_NOT_FOUND`), dan non-peserta `403` (`CHAT_ROOM_FORBIDDEN`),
   bukan `500`/`400` — agar klien tidak menampilkan "Gagal memuat" untuk ruang
   yang memang tidak ada.
2. **`POST …/read` harus cepat dan idempoten**, dan sebaiknya tidak berbagi
   timeout dengan `GET …/messages`. Klien sudah tidak menunggunya untuk
   menampilkan pesan, tetapi tanda "sudah dibaca" ke lawan bicara tertunda
   selama endpoint ini lambat.
3. **Tambahkan `firstUnreadMessageId` (atau `lastReadMessageId`) pada
   `GET …/rooms/{id}`.** Hari ini klien hanya punya `unreadCount` dan
   menghitung jangkar "pesan belum dibaca" dari halaman riwayat yang sudah
   dimuat; bila pesan itu lebih tua dari halaman pertama, penanda baru muncul
   setelah pengguna memuat riwayat lebih lama. Dengan id jangkar dari server,
   klien bisa langsung memuat sampai pesan itu.

**Cara memverifikasi di perangkat Android (belum dijalankan di perangkat dari
lingkungan ini):** buka ruang di mode pesawat (harus tampil galat + Coba lagi,
bukan kosong); buka dengan jaringan lambat (shimmer → catatan lambat di 12
dtk); buka ruang berisi >500 pesan (tanpa lompatan posisi yang terlihat); kirim
pesan di ruang panjang dengan *Profiler → Highlight updates* menyala (hanya
bubble baru yang berkedip).
