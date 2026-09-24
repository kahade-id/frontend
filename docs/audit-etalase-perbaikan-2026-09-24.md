# Perbaikan Audit Etalase (mendalam) — 2026-09-24

**Sumber temuan:** `docs/audit-etalase-mendalam-2026-09-24.md` (66 temuan: 1🔴 · 7🟠 · 45🟡 · 13🔵)
**Cabang:** `arena/01a0cfbc-frontend` · basis `9ffd4ad`
**Prinsip:** memperbaiki A **tidak boleh merusak B** — setiap batch diverifikasi ulang
(`tsc` · `eslint` · `vitest` node + komponen · `check:i18n` · gate ratchet repo).

---

## 1. Ringkasan status

| Status | Jumlah | Keterangan |
|---|---:|---|
| ✅ **Diperbaiki di klien** | 53 | Termasuk 2 yang menurunkan akar masalah alat audit, bukan hanya gejalanya |
| ✅ **Bukan defek (diverifikasi)** | 2 | `S-05`, `Q-01` — perilaku benar; dicatat agar tidak dituduhkan lagi |
| 🟡 **Terbuka — butuh backend/kontrak** | 4 | `D-03`, `K-01`, `K-02`, `K-03` |
| 🟡 **Terbuka — refactor/keputusan produk** | 7 | `F-04`, `P-02`, `M-04`, `P-04`, `U-01(sisa)`, `U-03`, `U-04`, `U-06` \\* |
| **Total** | **66** | \\* dua temuan (F-04 & P-02) berakar pada satu kebiasaan render, dihitung terpisah di audit |

> Tidak ada temuan yang "diam-diam dibiarkan": yang belum selesai **disebut apa adanya**
> di §4 beserta alasan kenapa perbaikan tergesa-gesa justru berisiko (efek kupu-kupu).

---

## 2. Tabel rekonsiliasi 66 temuan

### Feed

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| F-01 | 🔴 | ✅ | Komentar tidak lagi memicu refetch feed. Ledger hitungan komentar (`queueShowcaseCommentCount`) + watermark dikonsumsi `showcase-feed-tab.tsx`; kartu bertambah **tanpa** membuang halaman ≥2. Bukti: `tests/showcase-comment-count-sync.test.tsx` (4) |
| F-02 | 🟠 | ✅ | Docblock feed & sheet diselaraskan dengan perilaku nyata (sinyal `dirty` hanya untuk mutasi manajemen) |
| F-03 | 🟠 | ✅ | Kenaikan optimistis tidak lagi tertimpa refresh; delta diterapkan ke SEMUA permukaan lewat ledger. Bukti: `tests/showcase-comment-count-sync.test.tsx` |
| F-04 | 🟡 | 🟡 | Lihat §4.1 — tombol "+20 tanpa virtualisasi" butuh perubahan kontainer scroll profil (VirtualizedList di dalam ScrollView = anti-pola RN) |
| F-05 | 🟡 | ✅ | Feed "Mengikuti" memberi tahu saat hasil **terpotong** plafon klien (`FOLLOWING_MAX_PAGES`) — dulu tampak "habis". Bukti: 2 test baru di `tests/showcase-feed-lifecycle.test.tsx` |
| F-06 | 🟡 | ✅ | Copy empty-state feed diganti konteks feed: "Belum ada karya untuk ditampilkan" |

### Detail karya

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| D-01 | 🟡 | ✅ | 7 judul toast komentar → satu modul `lib/showcase-comment-messages.ts` (`SHOWCASE_COMMENT_MESSAGES`), dipakai detail + sheet |
| D-02 | 🟡 | ✅ | Plural EN "3 comment" → "{x} Comments" (EN `remediation`+`screens-9`) |
| D-03 | 🟡 | 🟡 | Klien sudah memvalidasi semua jalur tulis (komposer nonaktif + `trim()` di sheet/detail/edit); **kontrak** `CreateShowcaseCommentDto.content` masih tanpa `minLength` → §4.2 |

### Komentar

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| C-01 | 🟠 | ✅ | Akar sama dengan F-01: `markShowcaseFeedDirty()` dihapus dari jalur komentar; halaman ≥2 tidak dibuang |
| C-02 | 🟡 | ✅ | Satu sumber kebenaran: delta ledger diterapkan ke sheet **dan** kartu feed/profil (`applyShowcaseCommentCountDelta`) |
| C-03 | 🟡 | ✅ | Komentar tersembunyi tanpa `hiddenReason` kini selalu punya alasan statis ("Disembunyikan karena melanggar pedoman komunitas.") — tamu tanpa ⋯ tidak lagi menatap kalimat misterius |
| C-04 | 🔵 | ✅ | `isEditedComment` membandingkan waktu terurai dengan toleransi ±1 detik, bukan string ISO mentah |

### Aksi sosial

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| S-01 | 🟠 | ✅ | Tap suka kedua saat request berjalan diantre + tombol tampil sibuk (`likePending`). Bukti: `tests/showcase-social-feedback.test.tsx` (6) |
| S-02 | 🟠 | ✅ | Simpan optimistis dengan override pending (`setShowcaseSavedPending`/`useShowcaseSavedPending`), bukan menunggu 2 lompatan async. Bukti: test yang sama |
| S-03 | 🟡 | ✅ | `Idempotency-Key` stabil per aksi logis: komentar (per item×konten), laporan (per item), create. Bukti: `tests/idempotency-key.test.ts` (7) |
| S-04 | 🟡 | ✅ | "Tidak tertarik" tidak lagi senyap: toast + tombol **Urungkan** (`undismissShowcase`). Bukti: `tests/showcase-dismiss-undo.test.tsx` |
| S-05 | 🔵 | ✅ | Diverifikasi benar (tamu → login dengan jalur balik). Tidak ada perubahan kode; dicatat agar tidak dilaporkan ulang |

### Manajemen karya

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| M-01 | 🟡 | ✅ | 3 string (aktivasi, publik, draf) kini terkumpul & diterjemahkan — akar pemindai ikut diperbaiki (Q-02..Q-04) |
| M-02 | 🟡 | ✅ | 2 pesan validasi diterjemahkan eksplisit + masuk katalog |
| M-03 | 🟡 | ✅ | Ambang foto → `lib/showcase-limits.ts` (`SHOWCASE_MAX_IMAGES`), dipakai picker, slot, tombol, dan sel |
| M-04 | 🟡 | 🟡 | §4.3 — alur create masih ref+state; mesin keadaan penuh = refactor berisiko tinggi tanpa test transisi bawaan |
| M-05 | 🔵 | ✅ | Sel daftar manajemen menampilkan kuota "{x}/{y} foto" (slot `meta` grid yang sudah ada) |

### Profil · galeri · tersimpan · pencarian

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| P-01 | 🟠 | ✅ | Karya tersimpan memakai `<Picture>` (+`preventDownload`, `recyclingKey`) seperti permukaan lain |
| P-02 | 🟡 | 🟡 | Akar sama dengan F-04 → §4.1 |
| P-03 | 🟡 | ✅ | Hasil pencarian memberi badge **Nonaktif/Privat** untuk pemilik (`item.isOwner`) |
| P-04 | 🟡 | 🟡 | §4.4 — filter kategori/harga di pencarian butuh keputusan produk (kontrak sudah mendukung) |
| P-05 | 🔵 | ✅ | Urutan hook diperbaiki (`useState` sebelum efek reset) |
| P-06 | 🔵 | ✅ | `uploadShowcasePhotos` (tanpa pemanggil) dihapus dari `lib/showcase-upload.ts` |

### i18n & lokalisasi (13 temuan)

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| I-01…I-09 | 🟡 | ✅ | 9 kunci hilang masuk katalog: aktivasi karya, publik/draf, 2 pesan validasi, "Profil tidak ditemukan.", "Pertanyaan Pengguna ({x})", "Tutup/Lihat balasan", "Muat komentar berikutnya" |
| I-10…I-13 | 🟡 | ✅ | 4 titik render melewati penerjemah diperbaiki (`translate` di gallery-grid, search, judul dokumen tab, dan `translateProp(title)` di modal) |
| — | — | ✅ | Akar masalah alat: pemindai `gen-i18n-catalog.mjs` kini mengunjungi children ekspresi JSX, menerima `;` dalam prosa, dan mengenali `setFormError(...)` |
| — | — | ✅ | Penjaga baru: `tests/showcase-i18n-en.test.tsx` (9) merender permukaan Etalase dalam EN |

### Kontrak API

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| K-01 | 🟠 | 🟡 | §4.2 — skema **respons** `GET /v1/users/me/showcase` hanya backend yang bisa menetapkan |
| K-02 | 🟡 | 🟡 | §4.2 — dua normalizer disatukan **setelah** K-01 punya skema; tanpa itu penyatuan justru menyembunyikan drift kontrak |
| K-03 | 🟡 | ✅/🟡 | Klien sudah punya SATU resolver cover (`showcaseCoverOf`/`showcaseImages`); pensiun alias `imageUrl`/`fileKey` butuh jaminan backend (ikut §4.2) |
| K-04 | 🟡 | ✅ | `parseShowcaseComment` menormalkan `updatedAt` (opsional, ISO) sebelum UI membandingkannya |
| K-05 | 🟡 | ✅ | Tabel kebijakan retry per endpoint ditulis di `lib/api/showcase.ts` (endpoint, retry, alasan) — tidak lagi harus dihafal |
| K-06 | 🔵 | ✅ | Idempotensi jadi perilaku teruji: `tests/idempotency-key.test.ts` (termasuk 2 kasus Etalase) |

### Aksesibilitas

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| A-01 | 🟡 | ✅ | "Balas" kini target 44px **terlihat** (`min-h-11` + garis), bukan cuma `hitSlop` tak terlihat |
| A-02 | 🟡 | ✅ | Satu label informatif per kontrol komentar (`Komentar · {n}`) + hint "Buka komentar"; tidak lagi dibacakan ganda |
| A-03 | 🔵 | ✅ | Hint tombol opsi dinetralkan → "Buka opsi karya" |

### Kualitas kode, tes, dokumen

| ID | Tingkat | Status | Perubahan & bukti |
|---|---|---|---|
| Q-01 | 🟡 | ✅ | Bingkai "70 ✅ string" ditutup sebagai **bukan defek** (kontra-verifikasi render EN); alatnya diperkuat lewat Q-02..Q-04 + Q-08 |
| Q-02 | 🟡 | ✅ | Pemindai mengunjungi children ekspresi JSX (100 string tak terlihat tersingkap, semuanya diterjemahkan) |
| Q-03 | 🟡 | ✅ | Heuristik `isTechnical` tidak lagi membuang kalimat ber-`;` |
| Q-04 | 🟡 | ✅ | Argumen `setFormError(...)` ikut dikumpulkan + whitelist diperluas |
| Q-05 | 🟡 | ✅ | `tests/showcase-labels.test.ts` dibuat (14 test) — format label harga diprobe dulu, bukan diasumsikan |
| Q-06 | 🔵 | ✅ | `docs/audit_etalase.md` diberi header **USANG** + penunjuk ke audit 2026-09-24 |
| Q-07 | 🔵 | ✅ | Rantai fokus/dirty feed jadi test permanen (`A-01/A-08` di `showcase-feed-lifecycle`), bukan lagi probe ad-hoc |
| Q-08 | 🔵 | ✅ | Tes render EN untuk permukaan Etalase (`tests/showcase-i18n-en.test.tsx`) |

### Peningkatan (bukan cacat)

| ID | Tingkat | Status | Perubahan |
|---|---|---|---|
| U-01 | 🟡 | ✅ sebagian | Kuota tersimpan kini terlihat ("{x}/{y} tersimpan di perangkat ini") + konstanta `SHOWCASE_SAVED_LIMIT`. Sisa (sinkron akun, hapus massal) butuh backend → §4.2 |
| U-02 | 🟡 | ✅ | Utas balasan diringkas 3 baris + "Lihat {x} balasan"; deep link `?comment=` otomatis membuka lipatan. Bukti: `tests/showcase-detail-replies.test.tsx` (4) |
| U-03 | 🟡 | 🟡 | §4.5 — pemulihan posisi scroll setelah refresh otomatis: berisiko mengubah perilaku gulir inti |
| U-04 | 🟡 | 🟡 | §4.4 — CTA transaksi di kartu feed/tersimpan: keputusan produk (dan rawan mendorong penjualan di feed) |
| U-05 | 🔵 | ✅ | Setelah lapor: tombol "Lihat riwayat laporan" → `/reports` (tidak lagi buntu) |
| U-06 | 🔵 | 🟡 | §4.4 — pengurutan/pencarian di sheet komentar: keputusan produk |
| U-07 | 🔵 | ✅ | Duplikasi 7 judul toast dihapus (modul bersama, sama dengan D-01) |

---

## 3. Verifikasi (tanpa efek kupu-kupu)

Jalankan `npm run check` (typecheck, lint, seluruh gate kontrak/i18n/a11y/ratchet, 2 suite test) — **lolos**:

| Gate / suite | Hasil |
|---|---|
| `tsc --noEmit` · `eslint .` | bersih |
| `check:tokens` · `audit:classes` · `check:a11y` · `check:screens` · `check:inventory` | lolos |
| `check:spec` · `check:api` · `check:weblinks` · `check:external-urls` · `check:time-domains` · `check:push` · `check:permissions` | lolos |
| `check:i18n` | 2224 → **2231 string, 100% terjemah**, katalog sinkron |
| `vitest run` (node) | **33 berkas / 434 test** ✓ |
| `vitest run --config vitest.components.config.ts` | **23 berkas / 177 test** ✓ |

**Uji baru yang menjaga perbaikan** (6 berkas):

| Berkas | Test | Menjaga |
|---|---:|---|
| `tests/showcase-comment-count-sync.test.tsx` | 4 | F-01 · F-03 · C-01 · C-02 |
| `tests/showcase-social-feedback.test.tsx` | 6 | S-01 · S-02 |
| `tests/showcase-dismiss-undo.test.tsx` | 1 | S-04 |
| `tests/showcase-detail-replies.test.tsx` | 4 | U-02 |
| `tests/showcase-labels.test.ts` | 14 | Q-05 (format label harga) |
| `tests/showcase-i18n-en.test.tsx` | 9 | I-01…I-13 · Q-08 |
| `tests/idempotency-key.test.ts` (+2) | 7 | S-03 · K-06 |
| `tests/showcase-feed-lifecycle.test.tsx` (+2) | 9 | F-05 |

**Perubahan kontrak yang ikut diselaraskan (bukan regresi produk):**
- `ShowcaseCommentsSheet` prop `onCommentAdded` dihapus → sinkronisasi lewat ledger.
- `lib/showcase-social-prefs.ts` menambah API ledger + `pendingSaved`.
- Mock di 5 berkas test lama diperbarui untuk kontrak baru; **tidak ada** perilaku produk yang berubah karenanya.
- Ratchet S9 diturunkan: `app/showcase/[id].tsx` 826 → **786 baris** (baris aksi diekstrak ke
  `components/ui/showcase-detail-actions.tsx`) — gate tetap "hanya boleh menyusut".

---

## 4. Terbuka — apa adanya, beserta alasannya

### 4.1 F-04 + P-02 — "Tampilkan karya lainnya" menambah 20 kartu tanpa virtualisasi

**Kenapa belum diperbaiki sekarang:** `ProfileEtalaseTab` hidup di dalam `DataScroll`
(ScrollView) layar profil. Menempelkan `PaginatedList`/`FlatList` di dalamnya memicu
anti-pola React Native "VirtualizedLists should never be nested inside plain ScrollViews"
— perbaikan A yang langsung merusak B (gulir profil, header kolaps, tarik-untuk-menyegarkan).
**Jalan keluar yang benar:** jadikan daftar etalase sebagai kontainer gulir tersendiri di
layar profil (header jadi `ListHeaderComponent`), baru pakai `PaginatedList`.
Itu perubahan struktur layar, bukan satu baris kode.

### 4.2 Butuh backend/kontrak (bukan bisa ditutup dari klien)

| Temuan | Permintaan konkret ke backend |
|---|---|
| D-03 | `CreateShowcaseCommentDto.content`: tambahkan `minLength: 1` (klien sudah menjaga di semua jalur tulis) |
| K-01 | Skema **respons** `GET /v1/users/me/showcase` (mis. `images[]`, `coverImageUrl`, `visibility`, `isActive`) supaya `check:api-body` bisa dua arah |
| K-02 | Setelah K-01 ada: satu normalizer bersama. Tanpa skema, "penyatuan" hanya memindahkan tebakan |
| K-03 | Tanggal pensiun alias `imageUrl`/`fileKey` (klien sudah lewat satu resolver `showcaseCoverOf`) |
| U-01 sisa | Sinkron bookmark ke akun + endpoint hapus massal (sekarang lokal per perangkat) |
| F-05 sisa | `GET /showcase/feed?following=true` (menghapus plafon `FOLLOWING_MAX_PAGES` di klien) |
| K-05 sisa | (opsional) jadikan tabel retry sebagai skrip gate per-endpoint, bukan hanya dokumen |

### 4.3 M-04 — alur create `showcase-management` (ref + state banner)

Menyulapnya menjadi mesin keadaan (`idle → saving → uncertain → done`) adalah refactor
besar pada layar yang menyentuh uang orang (unggah foto + idempotensi). Audit sendiri
meminta "reducer + uji transisi"; tanpa test transisi yang lengkap lebih dulu, refactor
ini berisiko mengubah perilaku "uncertain create" yang sudah dijaga. **Usulan:** tulis
test transisi alur create (5–6 test) sebagai langkah pertama, baru ganti mesinnya.

### 4.4 U-04 · P-04 · U-06 — keputusan produk

Tiga-tiganya menambah kemampuan baru (CTA transaksi di kartu feed, filter kategori/harga
di pencarian karya, pengurutan/pencarian di sheet komentar). Kontrak API sudah mendukung
(§8 audit), tetapi bentuk UI & prioritasnya keputusan pemilik produk — bukan cacat yang
bisa ditutup sepihak oleh perbaikan audit.

### 4.5 U-03 — pemulihan posisi gulir setelah refresh otomatis

Sempat dipertimbangkan: menyimpan offset & memulihkannya setelah `refresh`. Berisiko
karena `PaginatedList` mengganti seluruh `data` dan pengguna bisa sudah menggulir selama
request berjalan; salah memulihkan justru melempar posisi baca. **Usulan:** kerjakan
bersama §4.1 (ketika daftar jadi virtual dan punya `scrollToOffset` yang andal).

---

## 5. Catatan proses

- Setiap batch diverifikasi ulang; **10 test lama** gagal saat kontrak ledger berubah dan
  diperbaiki di sisi **mock**, bukan dengan melonggarkan asersi produk.
- Dua kali `check:screens` menangkap dampak samping dari perbaikan ini (`[id].tsx` melewati
  plafon 826 baris) → diselesaikan dengan **ekstraksi komponen**, bukan menaikkan plafon.
- Label/format tidak pernah "ditebak": `tests/showcase-labels.test.ts` lahir dari probing
  format nyata (`"Rp 100.000 – 250.000"`, `"Mulai Rp 100.000"`, `"Harga lewat diskusi"`, …).
