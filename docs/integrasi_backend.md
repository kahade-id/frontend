# Integrasi Backend — Fitur Story

Dokumen ini adalah kontrak antara frontend (`lib/api/story.ts`) dan backend.
Frontend sudah memakai transport **mock** (`EXPO_PUBLIC_STORY_API` ≠ `live`).
Saat backend siap, set `EXPO_PUBLIC_STORY_API=live`; bentuk request/response di
bawah **tidak boleh berubah** tanpa revisi kontrak bersama.

Semua endpoint memakai prefix `/v1`, JSON UTF-8, dan autentikasi Bearer kecuali
disebutkan lain. Waktu dikirim dalam ISO-8601 UTC (`2026-10-08T07:00:00.000Z`).

---

## 1. Konsep & aturan bisnis

- Story = foto (`kind: "image"`) atau teks dengan latar warna (`kind: "text"`).
- **Umur 24 jam.** `expiresAt = createdAt + 24 jam`. Story yang sudah lewat
  `expiresAt` **tidak boleh** dikembalikan di endpoint mana pun (tray, daftar
  user, `/me`). Klien juga memfilter berdasarkan jam server, tetapi server
  adalah sumber kebenaran.
- **Visibilitas:** story hanya terlihat oleh user yang **menyimpan profil
  pembuat** (`POST /v1/users/{username}/saved`). Graf follow **tidak** dipakai
  untuk story. Pembuat selalu bisa melihat story sendiri.
- **Privasi per-story** (`audience`):
  - `{"mode":"all_savers"}` — semua penyimpan profil.
  - `{"mode":"savers_except","excludedUserIds":["USR-…"]}` — semua penyimpan
    kecuali daftar tersebut. `excludedUserIds` maksimal 500 item.
  - Story yang tidak boleh dilihat viewer **tidak boleh bocor**: tidak muncul
    di tray, tidak bisa dibuka lewat `GET /v1/stories/users/{userId}` (403
    `STORY_NOT_VISIBLE`), tidak bisa direaksi/dibalas (404 `STORY_NOT_FOUND`).
- **Bisu (mute):** bersifat per-viewer. Story author yang dibisukan tetap
  ada, tetapi di tray diurutkan paling bawah (`muted: true`) dan tidak
  memicu notifikasi.
- **Tag produk:** maksimal 5 per story (`STORY_TAGS_LIMIT`). Posisi `x`/`y`
  ternormalisasi 0..1 (titik tengah tag). Produk harus milik pembuat dan
  berstatus tampil di etalase.
- **Stiker harga:** bilangan bulat rupiah, 0 < amount ≤ 999.999.999.
- **Tanya Stok:** `askStock.productId` = id produk, atau `null` untuk tanya
  umum. Saat viewer menekan tombol, klien membuka DM dengan pesan otomatis;
  server tidak perlu mengirim pesan itu sendiri.
- **Teks:** caption/teks story maks 200 karakter (`STORY_TEXT_MAX`). Balasan
  story juga maks 200 karakter.
- **Reaksi:** hanya enam emoji: `❤️ 😂 😮 😢 👏 🔥`. Satu reaksi per viewer per
  story; mengirim reaksi baru menggantikan yang lama.
- **Highlight (sorotan):** arsip permanen. `stories` pada highlight berisi
  **salinan media**, sehingga tetap ada setelah story asli kedaluwarsa.
  Judul maks 24 karakter; 1–30 story per highlight.

---

## 2. Endpoint

Bentuk error umum (semua endpoint):

```json
{ "message": "Teks untuk pengguna (Indonesia)", "code": "STORY_TEXT_TOO_LONG" }
```

Kode error backend (`code`) yang dipakai klien:

| HTTP | code | Kapan |
|---|---|---|
| 400 | `STORY_MEDIA_REQUIRED` | kind=image tanpa `mediaId` |
| 400 | `STORY_TEXT_REQUIRED` | kind=text tanpa teks |
| 400 | `STORY_TEXT_TOO_LONG` | teks > 200 |
| 400 | `STORY_TAGS_LIMIT` | tag produk > 5 |
| 400 | `STORY_REACTION_INVALID` | emoji di luar daftar |
| 400 | `STORY_REPLY_EMPTY` / `STORY_REPLY_TOO_LONG` | balasan kosong / > 200 |
| 400 | `STORY_HIGHLIGHT_TITLE_REQUIRED` / `STORY_HIGHLIGHT_TITLE_TOO_LONG` | judul sorotan |
| 400 | `STORY_HIGHLIGHT_ITEMS_INVALID` | story sorotan di luar 1–30 |
| 401 | `UNAUTHORIZED` | token tidak ada/kedaluwarsa |
| 403 | `STORY_NOT_VISIBLE` | viewer bukan penyimpan profil / dikecualikan |
| 403 | `FORBIDDEN` | bukan pemilik (hapus, sorotan orang lain) |
| 404 | `STORY_NOT_FOUND` | story/highlight tidak ada, sudah kedaluwarsa, atau tidak terlihat |
| 413 | `STORY_MEDIA_TOO_LARGE` | foto > batas upload (lihat §4) |
| 415 | `STORY_MEDIA_TYPE` | format selain JPEG/PNG/WEBP |
| 429 | `RATE_LIMITED` | terlalu banyak request |
| 500 | `SERVER_ERROR` | galat tak terduga |

### 2.1 Tray & daftar

| Method | Path | Auth | Status sukses |
|---|---|---|---|
| GET | `/v1/stories/tray` | required | 200 |
| GET | `/v1/stories/users/{userId}` | required | 200 |
| GET | `/v1/stories/me` | required | 200 |

**GET `/v1/stories/tray`** — `own` null bila tidak ada story aktif.
```json
{
  "own": {
    "author": { "userId": "USR-1", "username": "toko", "fullName": "Toko Saya", "avatarUrl": null },
    "storyCount": 2,
    "latestAt": "2026-10-08T06:00:00.000Z",
    "hasUnseen": false,
    "muted": false
  },
  "others": [
    {
      "author": { "userId": "USR-2", "username": "budi", "fullName": "Budi", "avatarUrl": "https://…/a.jpg" },
      "storyCount": 1,
      "latestAt": "2026-10-08T05:10:00.000Z",
      "hasUnseen": true,
      "muted": false
    }
  ]
}
```
Urutan `others` boleh dari server; klien mengurutkan ulang (bisu di bawah,
lalu belum dilihat, lalu terbaru).

**GET `/v1/stories/users/{userId}`** — story aktif satu penulis, urut terlama → terbaru.
```json
{
  "author": { "userId": "USR-2", "username": "budi", "fullName": "Budi", "avatarUrl": null },
  "stories": [ /* lihat objek Story §3 */ ]
}
```
403 `STORY_NOT_VISIBLE` bila viewer tidak berhak melihat.

**GET `/v1/stories/me`** — story aktif milik sendiri; field `audience` terisi, `viewCount` nyata.
```json
{ "stories": [ /* objek Story */ ] }
```

### 2.2 Buat & hapus

| Method | Path | Auth | Status sukses |
|---|---|---|---|
| POST | `/v1/stories/media` | required | 201 |
| POST | `/v1/stories` | required | 201 |
| DELETE | `/v1/stories/{storyId}` | required | 204 |

**POST `/v1/stories/media`** — `multipart/form-data`, field `file` (JPEG/PNG/WEBP, ≤ 10 MB, sisi terpanjang dikecilkan ke 1600 px di klien).
Response:
```json
{ "mediaId": "med-8f2c", "url": "https://cdn.example/stories/med-8f2c.jpg" }
```
`mediaId` hanya valid 30 menit dan belum dipakai.

**POST `/v1/stories`** — request:
```json
{
  "kind": "image",
  "mediaId": "med-8f2c",
  "text": "Stok baru datang",
  "productTags": [ { "productId": "PRD-1", "x": 0.5, "y": 0.3 } ],
  "priceSticker": { "amount": 350000 },
  "askStock": { "productId": "PRD-1" },
  "audience": { "mode": "savers_except", "excludedUserIds": ["USR-9"] }
}
```
- `kind = "text"`: kirim `text` (wajib) dan `backgroundColor` (`#RRGGBB`), tanpa `mediaId`.
- `priceSticker`, `askStock`: boleh `null`/dihilangkan.
- Response 201: objek `Story` lengkap dengan `viewCount: 0`, `audience` terisi.

**DELETE `/v1/stories/{storyId}`** — hanya pemilik. Hapus lunak diperbolehkan, tetapi story harus langsung hilang dari semua endpoint baca. Response: 204.

### 2.3 Views, viewer, reaksi, balasan

| Method | Path | Auth | Status sukses |
|---|---|---|---|
| POST | `/v1/stories/{storyId}/views` | required | 204 |
| GET | `/v1/stories/{storyId}/viewers?page=1&limit=30` | required (pemilik) | 200 |
| PUT | `/v1/stories/{storyId}/reaction` | required | 204 |
| DELETE | `/v1/stories/{storyId}/reaction` | required | 204 |
| POST | `/v1/stories/{storyId}/replies` | required | 201 |

**POST `/views`** — idempoten. Dipanggil saat story tampil ≥ 1 detik. Tidak
menaikkan `viewCount` bila viewer sama sudah tercatat.

**GET `/viewers`** — hanya pemilik (`FORBIDDEN` untuk selain pemilik).
```json
{
  "viewers": [
    { "user": { "userId": "USR-3", "username": "sari", "fullName": "Sari", "avatarUrl": null },
      "viewedAt": "2026-10-08T06:30:00.000Z", "reaction": "🔥" }
  ],
  "total": 12,
  "page": 1,
  "limit": 30
}
```

**PUT `/reaction`** — body `{ "emoji": "🔥" }`. **DELETE `/reaction`** — hapus reaksi.

**POST `/replies`** — body `{ "text": "Masih ada size M?" }`. Server membuat
DM dengan pemilik bila belum ada, lalu menaruh pesan dengan referensi story
(`storyId`) di ruang chat. Response 201:
```json
{ "roomId": "room-USR-2-USR-1" }
```

### 2.4 Bisu & kandidat audiens

| Method | Path | Auth | Status sukses |
|---|---|---|---|
| GET | `/v1/stories/mutes` | required | 200 |
| PUT | `/v1/stories/mutes/{userId}` | required | 204 |
| DELETE | `/v1/stories/mutes/{userId}` | required | 204 |
| GET | `/v1/stories/audience/candidates` | required | 200 |

**GET `/mutes`**
```json
{ "mutes": [ { "userId": "USR-2", "username": "budi", "fullName": "Budi", "avatarUrl": null } ] }
```

**GET `/audience/candidates`** — daftar penyimpan profil milik sendiri (untuk
editor privasi "kecuali beberapa orang"). Dibatasi 500 entri.
```json
{ "users": [ { "userId": "USR-3", "username": "sari", "fullName": "Sari", "avatarUrl": null } ] }
```

### 2.5 Sorotan (highlight)

| Method | Path | Auth | Status sukses |
|---|---|---|---|
| GET | `/v1/stories/highlights/users/{userId}` | required | 200 |
| POST | `/v1/stories/highlights` | required | 201 |
| PATCH | `/v1/stories/highlights/{highlightId}` | required (pemilik) | 200 |
| DELETE | `/v1/stories/highlights/{highlightId}` | required (pemilik) | 204 |

**GET `/highlights/users/{userId}`** — publik untuk profil; tidak
memerlukan visibilitas story aktif.
```json
{
  "highlights": [
    {
      "id": "HL-1",
      "title": "Katalog",
      "coverUrl": "https://cdn.example/stories/med-1.jpg",
      "storyCount": 3,
      "stories": [ /* objek Story, berisi salinan media */ ],
      "createdAt": "2026-10-01T00:00:00.000Z",
      "updatedAt": "2026-10-02T00:00:00.000Z"
    }
  ]
}
```

**POST `/highlights`** — body `{ "title": "Katalog", "storyIds": ["ST-1","ST-2"] }`.
Server menyalin media story ke arsip. Response 201: objek highlight (sama
seperti di atas). `storyIds` harus milik pemilik; 1–30 item.

**PATCH `/highlights/{highlightId}`** — body parsial:
`{ "title": "Testimoni" }` dan/atau `{ "storyIds": ["ST-3"] }`. Mengganti
`storyIds` menyalin ulang media untuk item baru. Response 200: objek highlight.

**DELETE `/highlights/{highlightId}`** — hapus arsip; salinan media ikut dihapus dari storage.

---

## 3. Objek `Story`

```json
{
  "id": "ST-1",
  "author": { "userId": "USR-1", "username": "toko", "fullName": "Toko Saya", "avatarUrl": null },
  "kind": "image",
  "mediaUrl": "https://cdn.example/stories/med-8f2c.jpg",
  "text": "Stok baru datang",
  "backgroundColor": null,
  "productTags": [
    { "productId": "PRD-1", "title": "Kemeja Linen", "coverUrl": "https://…/p.jpg",
      "priceAmount": 350000, "x": 0.5, "y": 0.3 }
  ],
  "priceSticker": { "amount": 350000, "currency": "IDR" },
  "askStock": { "productId": "PRD-1" },
  "createdAt": "2026-10-08T06:00:00.000Z",
  "expiresAt": "2026-10-09T06:00:00.000Z",
  "viewed": false,
  "viewCount": 12,
  "myReaction": null,
  "audience": { "mode": "all_savers" }
}
```

- `viewed`, `myReaction`: per-viewer. `viewCount`: 0 untuk viewer non-pemilik.
- `audience`: hanya pada `GET /v1/stories/me`; `null` di tempat lain.
- `currency` selalu `"IDR"`.

---

## 4. Kebutuhan storage

- **Foto story** disimpan di object storage (S3/GCS/setara) dengan CDN di depannya.
  - Path: `stories/{yyyy}/{mm}/{mediaId}.{ext}`; `mediaId` acak, tidak berurutan.
  - Ukuran upload maks 10 MB; server mengonversi ke JPEG/WEBP dan membatasi sisi terpanjang 1600 px.
  - Bucket **tidak publik-listable**; URL yang dikembalikan boleh signed URL dengan TTL ≥ 24 jam, atau URL CDN publik dengan nama acak.
- **Expiry otomatis:**
  - Simpan `expiresAt` di baris story; semua query baca memfilter `expiresAt > now()`.
  - Job terjadwal (cron tiap 5–15 menit) menghapus baris story dan objek media yang `expiresAt < now() - 1 jam` dan **tidak** disalin ke highlight.
  - Salinan media highlight disimpan dengan kunci terpisah (`highlights/…`) dan tidak ikut expiry.
  - Alternatif: TTL bawaan database / lifecycle rule object storage pada prefix `stories/` (dengan syarat highlight dipindah ke prefix `highlights/` saat disorot).
- **Media `pending`** (belum dipakai `POST /v1/stories`) dihapus setelah 30 menit.
- **Retensi viewer/reaksi** mengikuti story: ikut terhapus saat story dihapus/kedaluwarsa. Highlight tidak menyimpan viewer.
- Backup: media highlight masuk kebijakan backup biasa; media story biasa tidak perlu di-backup.

---

## 5. Kebutuhan realtime

Realtime bersifat **opsional untuk rilis pertama** (klien tetap benar tanpanya lewat refresh saat aplikasi aktif). Kebutuhan bila tersedia:

| Event | Penerima | Payload minimal | Dampak di klien |
|---|---|---|---|
| `story.created` | penyimpan profil pembuat (sesuai audience) | `{ authorUserId, storyId, createdAt }` | refresh tray |
| `story.deleted` | semua yang pernah menerima `story.created` | `{ authorUserId, storyId }` | hapus dari tray/viewer |
| `story.expired` | sama dengan di atas | `{ authorUserId, storyId }` | hapus dari tray |
| `story.viewers.updated` | pemilik (throttle ≥ 5 detik) | `{ storyId, viewCount }` | perbarui counter di Kelola |
| `story.reply.received` | pemilik | `{ storyId, roomId }` | notifikasi chat |
| `story.mute.changed` | hanya user yang mengubah | — (tidak perlu; klien optimistis) | — |

- Kanal per-user (mis. `user:{userId}:stories`). **Jangan** broadcast ke semua user.
- Event harus **idempoten** dan membawa `storyId`; klien mengabaikan event untuk story yang sudah tidak ada.
- Push notification untuk balasan story mengikuti kebijakan notifikasi chat yang ada.

---

## 6. Keamanan & privasi (wajib)

- Setiap endpoint baca **wajib** memeriksa: (a) viewer menyimpan profil pembuat, (b) viewer tidak ada di `excludedUserIds`, (c) story belum kedaluwarsa, (d) pembuat tidak diblokir (dua arah) oleh viewer.
- Validasi `productTags` milik pembuat & status tampil. Produk yang dihapus setelah story dibuat: tag disembunyikan, bukan error.
- Rate limit: buat story 30/jam per user; reaksi/view 600/menit per user; upload media 20/jam.
- Balasan story memakai pipeline moderasi pesan chat yang sama.
- Foto di-strip metadata EXIF (termasuk lokasi GPS) sebelum disimpan.

---

## 7. Kebutuhan Admin

Admin panel perlu fitur berikut. Semua aksi admin dicatat di audit log.

### 7.1 Daftar story
- Tabel story aktif & kedaluwarsa (paginasi, filter: pembuat, kind, rentang waktu, status hapus/ban).
- Kolom: id, pembuat, kind, `createdAt`, `expiresAt`, `viewCount`, jumlah reaksi, jumlah balasan, jumlah laporan.
- Sumber data: tabel story + agregat view. Story kedaluwarsa tetap bisa dicari selama belum dihapus job expiry.

### 7.2 Lihat isi
- Pratinjau foto/teks, tag produk, stiker harga, Tanya Stok, dan `audience` (termasuk daftar `excludedUserIds`).
- Daftar viewer dan reaksi (akses dibatasi peran "moderator" ke atas; setiap akses dicatat).
- Riwayat balasan (ruang chat terkait) hanya bila ada laporan terbuka yang mengacu ke story tersebut.

### 7.3 Hapus & ban
- **Hapus story** oleh admin: hapus baris + media, kirim event `story.deleted`, catat alasan (wajib).
- **Sembunyikan** (soft-hide) story sementara selama peninjauan laporan — tidak tampil di mana pun, tetapi tidak dihapus.
- **Ban pembuat story** dari fitur story: pembuat tidak bisa membuat story baru; story aktifnya disembunyikan. Durasi: sementara (hari) atau permanen.
- **Pulihkan** story yang disembunyikan keliru dalam 7 hari.

### 7.4 Kelola laporan
- Laporan story datang dari viewer (kategori: spam, pelecehan, konten menyinggung, tautan/jualan tidak relevan, lainnya; catatan opsional ≤ 500 karakter).
- Antrean laporan: status `open` → `in_review` → `resolved_action` / `resolved_dismissed`. Ada SLA (tampilkan umur laporan).
- Keputusan: hapus story, sembunyikan, ban pembuat, atau tolak laporan. Setiap keputusan wajib catatan internal.
- Pelapor mendapat notifikasi ringkas (tanpa identitas terlapor). Satu user tidak boleh melapor story yang sama lebih dari sekali.
- Ambang otomatis: story dengan ≥ 5 laporan unik disembunyikan sementara dan masuk antrean prioritas.

### 7.5 Metrik
- Jumlah story per hari, rata-rata viewer per story, rasio reaksi, laporan per 1000 story, waktu rata-rata penanganan laporan.

---

## 8. Catatan implementasi frontend

- Semua panggilan lewat `lib/api/story.ts`. Mode mock berlaku bila `EXPO_PUBLIC_STORY_API` bukan `live`.
- Mutasi memakai optimistic UI dengan rollback (`lib/story/local-state.ts`, `runOptimistic`).
- Pembuatan story bersifat optimistis: layar langsung kembali, unggah dan `POST /v1/stories` berjalan di latar belakang; gagal → rollback + toast.
- Teks UI lewat i18n (ID sumber, EN di `lib/i18n/en/story.json`).
- Kode galat backend dinormalisasi lewat `ApiError` (`backendCode` menyimpan kode asli).
