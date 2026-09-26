# Audit Etalase (Showcase) — Frontend Kahade

**Tanggal:** 26 September 2026
**Cakupan:** Pengalaman & fitur user seluruh modul Etalase (Social Commerce Feed)
**Status:** Audit saja — tidak ada perubahan kode. Jangan commit.

---

## Ringkasan Eksekutif

Fitur Etalase sudah cukup matang secara fondasi: arsitektur upload aman (presigned URL + idempotency key + cleanup), like dengan optimistic update dan rollback, state management dengan invalidasi lintas layar yang utuh, loading skeleton di semua list, error state dengan retry, dan aksesibilitas dasar yang baik. Namun ditemukan **1 temuan KRITIS** (bug nyata: dialog "Buang karya ini?" muncul tepat setelah karya berhasil diterbitkan karena state form tidak di-reset sebelum `router.back()`), **5 temuan TINGGI** (retry yang dijanjikan copy tapi diblokir disabled; error foto/harga menempel di field yang salah; tombol "Buat Transaksi" tanpa pengecekan stok/status; komentar detail tanpa Idempotency-Key; tidak ada tombol hapus di layar detail), serta hutang i18n yang besar (~200+ string hardcode Indonesia, fitur ganti bahasa setengah jalan di modul ini) dan inkonsistensi VerifiedSeal (3-tier tidak dipakai di kartu feed/detail). Rekomendasi: perbaiki KRITIS + TINGGI terlebih dahulu secara bertahap, lalu migrasi i18n batch, lalu penyempurnaan SEDANG/RENDAH.

---

## Daftar Screen Lengkap

| # | Screen | File | Fungsi |
|---|--------|------|--------|
| 1 | Buat karya | `app/showcase/create.tsx` | Form 1 halaman: foto (maks 8) + detail (judul, deskripsi, kategori, harga min/max, visibilitas) |
| 2 | Kelola Etalase (milikku) | `app/showcase-management.tsx` | Grid karya sendiri + bottom-sheet editor (edit detail, kelola foto, toggle aktif, hapus) |
| 3 | Detail karya | `app/showcase/[id].tsx` | Galeri, info, like, komentar (thread 1 tingkat), share, tombol "Buat Transaksi" |
| 4 | Feed Etalase | `app/(tabs)/showcase.tsx` + `components/showcase-feed-tab.tsx` | Tab Untuk Anda / Mengikuti / Terbaru / Populer, kartu feed |
| 5 | Etalase user lain | `app/user/[username]/showcase.tsx` | Galeri publik milik user lain |
| 6 | Tab etalase profil | `components/ui/profile-etalase-tab.tsx` | Tab etalase di profil sendiri/orang lain |
| 7 | Koleksi tersimpan | `components/ui/showcase-saved-collection.tsx` + `app/saved.tsx` | Karya yang disimpan user |

Komponen pendukung: `components/ui/showcase-feed-item.tsx` (kartu), `components/ui/showcase-media-gallery.tsx` (galeri), `components/showcase-comments-sheet.tsx` + `components/showcase-detail-comments.tsx` + `components/showcase-comment-row.tsx` (komentar), `components/ui/like-button.tsx`, `components/ui/showcase-share-sheet.tsx`, `components/ui/showcase-report-sheet.tsx`, `components/showcase-author-row.tsx`, `components/showcase-detail-actions.tsx`, `components/ui/showcase-gallery-grid.tsx`, `components/ui/tag-input.tsx`, `components/ui/currency-range-field.tsx`.

API: `lib/api/showcase.ts` (endpoint sosial publik `/v1/showcase`), `lib/api/users.ts` (CRUD `/v1/users/me/showcase*`), `lib/showcase-upload.ts` (presigned upload), `lib/image-picker.ts`, `lib/media.ts`, `lib/query-keys.ts`, `lib/use-api-query`, `lib/query-cache`.

---

## Temuan KRITIS

### K1 — Dialog "Buang karya ini?" muncul setelah karya berhasil diterbitkan
- **Lokasi:** `app/showcase/create.tsx` (~415–420, success path `handleSave` + `usePreventRemove`)
- **Masalah:** Setelah simpan sukses, `router.back()` dipanggil tanpa me-reset state form. `dirty` masih `true` sehingga `usePreventRemove` mencegat back dan membuka dialog "Buang karya ini?" tepat setelah toast "Karya ditambahkan". Tombol "Periksa daftar etalase" di blok `uncertainCreate` juga memanggil `router.back()` dengan `dirty=true` → disambut dialog buang karya, bukan daftar etalase.
- **Dampak:** Sangat membingungkan — user baru menerbitkan karya lalu ditanya apakah mau membuangnya. Tombol "Periksa daftar etalase" praktis tidak berfungsi.
- **Rekomendasi:** Reset state (`setForm(EMPTY_FORM)`, `setPreviews([])`, `setFailedAssets([])`) sebelum `router.back()` pada success path; atau flag ref `skipPrevent` yang dibaca callback `usePreventRemove`. Untuk tombol "Periksa daftar etalase", gunakan `router.replace()` dengan state sudah dibersihkan.

---

## Temuan TINGGI

### T1 — Retry yang dijanjikan copy justru diblokir (user stuck setelah timeout)
- **Lokasi:** `app/showcase/create.tsx` (footer `Button` `disabled={uploading || uncertainCreate || ...}` + guard `handleSave`)
- **Masalah:** Copy blok uncertain berbunyi "Coba Terbitkan lagi untuk melanjutkan permintaan yang sama" (mengandalkan idempotency key), tetapi tombol "Terbitkan karya" disabled saat `uncertainCreate=true` dan `handleSave` early-return. Retry tidak bisa dijangkau user.
- **Dampak:** Setelah timeout/5xx user stuck — satu-satunya aksi adalah back (yang juga rusak, lihat K1). User bisa panik dan membuat karya duplikat.
- **Rekomendasi:** Keluarkan `uncertainCreate` dari `disabled` dan guard `handleSave` (tetap jaga `saveBusy`/`uploadBusy`); `createAttempt.current ??=` memang dirancang memakai idempotency key yang sama.

### T2 — Error foto/harga menempel di field yang salah
- **Lokasi:** `app/showcase/create.tsx` (~425–455; satu state `formError` + `errorText` di dua `Input`)
- **Masalah:** Satu `formError` dipakai untuk semua error lalu ditempel ke field yang salah: error foto ("Pilih minimal satu foto karya.") dan error harga (max<min) dirender sebagai `errorText` di input "Harga maksimum" (`errorText={formError && form.title.trim() ? formError : undefined}`); hanya error judul yang tampil di tempat benar.
- **Dampak:** User disuruh "pilih foto" lewat pesan error yang menempel di kolom harga — membingungkan, terutama bagi screen reader.
- **Rekomendasi:** Pisahkan error per field (`titleError`, `photoError`, `priceError`) atau tampilkan banner ringkasan error di atas form; error foto idealnya dekat seksi foto.

### T3 — Tombol "Buat Transaksi" tanpa pengecekan stok/status karya
- **Lokasi:** `app/showcase/[id].tsx:526-536` (`handleCreateTransaction`)
- **Masalah:** Tombol selalu aktif untuk non-pemilik dan langsung `router.push` ke alur transaksi. `ShowcaseSocialItem` (`lib/api/showcase.ts:395-418`) tidak punya field stok/status (`isActive` hanya di list parser, tidak diteruskan ke DTO detail sosial), sehingga tidak ada guard "stok habis / karya nonaktif".
- **Dampak:** User bisa masuk alur transaksi untuk karya yang sudah tidak tersedia, lalu gagal di tengah jalan.
- **Rekomendasi:** Tambahkan `isActive`/status ke DTO detail dan disabled-kan tombol dengan label jelas ("Tidak tersedia") bila karya nonaktif. Validasi server tetap, tapi UX gagal-cepat lebih baik.

### T4 — Komentar detail tanpa Idempotency-Key (risiko duplikat)
- **Lokasi:** `app/showcase/[id].tsx:382` (`addShowcaseComment(id, {...})` tanpa argumen ketiga)
- **Masalah:** `addShowcaseComment` mendukung `Idempotency-Key` (`lib/api/showcase.ts:231-243`), dan versi sheet (`components/ui/showcase-comments-sheet.tsx:193`) memakainya — tapi handler di layar detail tidak. Mutation lock mencegah tap ganda cepat, tapi timeout-then-retry bisa mencatat komentar dua kali.
- **Dampak:** Komentar duplikat bila respons lambat/timeout.
- **Rekomendasi:** Tiru pola sheet: `createIdempotencyKey()` per (item × isi), dipakai ulang saat retry, dibuang setelah sukses.

### T5 — Tidak ada tombol hapus karya di layar detail (pemilik)
- **Lokasi:** `app/showcase/[id].tsx` (seluruh file — tidak ada aksi hapus item)
- **Masalah:** Pemilik hanya diberi shortcut "Ubah karya" (ke halaman manajemen) di `components/showcase-author-row.tsx:108`. Tidak ada cara menghapus karya dari layar detailnya sendiri.
- **Dampak:** User harus navigasi ke Kelola Etalase untuk menghapus; tidak konsisten dengan aksi edit yang tersedia in-context.
- **Rekomendasi:** Tambahkan aksi hapus di detail (mis. di menu/ActionSheet) dengan Dialog konfirmasi + navigasi kembali setelah sukses.

---

## Temuan SEDANG

### S1 — VerifiedSeal 3-tier tidak dipakai di feed/detail; hanya boolean KYC lama
- **Lokasi:** `components/showcase-author-row.tsx:88-93`, `components/ui/showcase-feed-item.tsx:119-131`
- **Masalah:** Verifikasi hanya muncul sebagai ikon `SealCheck` kecil di sudut avatar (`verified={item.author.isKycVerified === true}`). Komponen `<VerifiedSeal>` (`components/ui/verified-seal.tsx:124`) mendukung 3 tier (FULLY_VERIFIED / BUSINESS_VERIFIED / TRUSTED_BY_KAHADE), tetapi parser `lib/api/showcase.ts:403-411` tidak meneruskan field `badges` ke author DTO detail. Satu-satunya pemakai `<VerifiedSeal>` yang benar adalah header profil (`app/user/[username].tsx:854`). Dua flag berbeda dipakai: kartu memakai `author.isKycVerified`, profil memakai `profile.verified` + `badges`.
- **Dampak:** Penjual terverifikasi bisnis/terpercaya tampil sama dengan yang belum di feed/detail — inkonsisten dengan definisi tier; akun bisa tampak terverifikasi di profil tapi polos di feed.
- **Rekomendasi:** Teruskan `badges` di parser author dan render `<VerifiedSeal badges={...}>` (varian inline kecil) di samping nama penjual di kartu feed dan baris penulis detail; satukan sumber flag dengan profil.

### S2 — i18n: ~200+ string hardcode Indonesia (fitur ganti bahasa setengah jalan)
- **Lokasi:** `app/showcase/create.tsx` (~30+ string: judul layar, label, placeholder, toast, dialog), `app/showcase-management.tsx` (~40+ string: toast, menu, dialog, label), `app/showcase/[id].tsx` (~25+ string: "Buat Transaksi", header komentar, aksi ActionSheet, dialog), `components/showcase-feed-tab.tsx` (label tab "Untuk Anda"/"Mengikuti"/"Terbaru"/"Populer" di level modul, empty state), `components/ui/showcase-comments-sheet.tsx`, `components/ui/showcase-share-sheet.tsx`, `components/ui/showcase-report-sheet.tsx`, `components/showcase-author-row.tsx`, `components/ui/showcase-detail-actions.tsx`, `components/ui/profile-etalase-tab.tsx`, `app/user/[username]/showcase.tsx`
- **Masalah:** String UI ditulis langsung tanpa `translate()` — melanggar kontrak i18n `lib/i18n`. Khusus `FEED_TABS`: const di level modul sehingga mustahil mengikuti bahasa aktif. Pola tidak konsisten: string yang sama maknanya kadang lewat `translate()` kadang hardcode.
- **Dampak:** Saat bahasa Inggris aktif, layar etalase tampil campur aduk ID/EN; fitur ganti bahasa tidak berfungsi penuh di modul ini.
- **Rekomendasi:** Migrasi batch ke `translate()` dengan key konsisten; pindahkan label `FEED_TABS` ke dalam komponen agar reaktif terhadap ganti bahasa; jalankan `npm run check:i18n` setelahnya.

### S3 — Tidak ada empty state khusus "karya tidak ditemukan/dihapus"
- **Lokasi:** `app/showcase/[id].tsx:116-132`
- **Masalah:** Early-return hanya menangani loading/error generik. 404 (karya dihapus/private) jatuh ke `ErrorState` generik dengan pesan "Data tidak ditemukan." — tidak ada copy spesifik, dan tombol "Coba lagi" untuk 404 tidak berguna.
- **Dampak:** User yang membuka tautan karya yang sudah dihapus melihat error generik + tombol retry yang takkan berhasil.
- **Rekomendasi:** Deteksi 404 (backendCode NOT_FOUND) → `EmptyState` khusus "Karya tidak ditemukan / sudah dihapus" tanpa tombol retry.

### S4 — Harga: input mentah tanpa format, kategori teks bebas
- **Lokasi:** `app/showcase/create.tsx` (Input "Kategori", dua Input harga)
- **Masalah:** Kategori = `Input` teks bebas (bukan `TagInput` di `components/ui/tag-input.tsx`); harga = dua `Input` angka mentah (bukan `CurrencyRangeField` di `components/ui/currency-range-field.tsx` yang sudah punya validasi min>max + label i18n). Tidak ada pemisah ribuan — user mengetik `1000000` mentah, rawan salah digit. Paste "1.000.000" ditolak diam-diam oleh regex `/^\d*$/`.
- **Dampak:** Risiko salah ketik harga; kategori tidak ternormalisasi; inkonsisten dengan pola komponen di layar lain.
- **Rekomendasi:** Pakai `CurrencyRangeField` untuk harga (atau `AmountInput` dengan format Rupiah) dan pertimbangkan `TagInput`/chip untuk kategori.

### S5 — Harga 0 ambigu; tidak ada konsep stok
- **Lokasi:** `app/showcase/create.tsx` (`formToPayload`); `lib/api/types.ts` (`CreateShowcaseItemDto`, ~428)
- **Masalah:** Harga 0 lolos validasi tanpa pesan eksplisit (diperlakukan sebagai "harga pasti"). Tidak ada field stok di form maupun DTO backend (grep `stock|stok` di `types.ts` = nihil). `priceMax=0` tanpa `priceMin` menghasilkan payload `{priceMax: 0}` (rentang tanpa batas bawah) — validasi hanya mengecek max<min bila keduanya non-null.
- **Dampak:** Tidak jelas apakah "Rp 0" berarti gratis atau kesalahan input; tidak ada cara menetapkan stok.
- **Rekomendasi:** Putuskan kebijakan produk: jika 0 = gratis, tampilkan label "Gratis"; jika tidak boleh, tolak dengan pesan jelas. Tambahkan validasi `priceMax` tanpa `priceMin`.

### S6 — Upload serial tanpa progress bar; batas ukuran file tak dikomunikasikan
- **Lokasi:** `app/showcase/create.tsx` (`handlePickPhotos`, loop `for…of`); `lib/showcase-upload.ts:11-46`; `lib/showcase-limits.ts:15`
- **Masalah:** Upload satu-per-satu (8 foto = 8 round-trip berurutan); indikator hanya teks "Mengunggah foto X dari Y" tanpa progress bar. Batas jumlah (8) ditampilkan jelas, tetapi batas MB per foto tidak disebut di UI dan tidak divalidasi client-side — user baru tahu saat kena 413 dari server. Kompresi ada (`quality: 0.7`) tetapi tanpa resize dimensi, foto 48MP tetap berat. Batas 8 gambar hidup di konstanta produk (`SHOWCASE_MAX_IMAGES`), bukan kontrak backend — rawan drift.
- **Dampak:** Upload lama dengan feedback minim; user memilih foto besar → gagal 413 tanpa tahu batasnya.
- **Rekomendasi:** Tambahkan progress bar (per foto + total); tampilkan batas ukuran di subtitle seksi foto dan validasi `asset.size` sebelum upload dengan pesan jelas; pertimbangkan konkurensi terbatas (2–3); negosiasi agar batas jumlah masuk kontrak DTO backend.

### S7 — Tidak ada autosave draft
- **Lokasi:** `app/showcase/create.tsx` (`dirty`, Dialog discard, `usePreventRemove`)
- **Masalah:** Keluar di tengah jalan = foto yang sudah diunggah + ketikan dibuang (dengan konfirmasi dialog — itu sudah baik). Tidak ada pemulihan.
- **Dampak:** Ketikan deskripsi panjang hilang bila user tidak sengaja keluar / app crash.
- **Rekomendasi:** Simpan draft teks (tanpa foto) ke storage lokal dan tawarkan "Lanjutkan draft" saat membuka layar.

### S8 — Tombol "Ubah karya" pemilik mengarah ke daftar, bukan edit item ini
- **Lokasi:** `components/showcase-author-row.tsx:108-118`
- **Masalah:** `onPress` → `ROUTES.showcaseManagement` (halaman daftar), bukan form edit karya yang sedang dibuka.
- **Dampak:** Pemilik harus mencari lagi karyanya di daftar untuk mengedit — satu langkah sia-sia.
- **Rekomendasi:** Navigasi langsung ke form edit item ini (dengan param id).

### S9 — Komentar detail tidak optimistic (baru muncul setelah respons server)
- **Lokasi:** `app/showcase/[id].tsx:369-397`
- **Masalah:** `insertLocalComment` dipanggil setelah `await addShowcaseComment` sukses. Ada spinner di tombol kirim, tapi pada jaringan lambat user menunggu tanpa umpan balik di daftar.
- **Dampak:** Minor UX lag.
- **Rekomendasi:** Insert optimistic dengan status "mengirim", rollback + toast bila gagal (atau pertahankan pola sekarang sebagai keputusan sadar — sheet versi feed memakai pola yang sama).

### S10 — Deep link share: `item.shareUrl` tidak divalidasi
- **Lokasi:** `components/ui/showcase-share-sheet.tsx:60`, `lib/deeplinks.ts:56-58`
- **Masalah:** `shareUrl` memakai `https://kahade.id/showcase/<id>` — benar — tetapi `item.shareUrl` dari server dipakai langsung tanpa `safeHttpsLink` (validasi hanya diterapkan ke URL wa/tg/x).
- **Dampak:** Rendah — server tepercaya — tapi satu-satunya URL yang masuk clipboard/share tanpa sanitasi.
- **Rekomendasi:** Lewatkan `item.shareUrl` ke `safeHttpsLink`, fallback ke `showcaseUrl(item.id)` bila gagal.

---

## Temuan RENDAH

### R1 — Tombol "Terbitkan karya" tidak disabled saat judul kosong (inkonsisten)
- **Lokasi:** `app/showcase/create.tsx` (footer Button)
- **Masalah:** Tombol tidak disabled saat judul kosong/form invalid — user harus menekan dulu untuk melihat error. Sebaliknya tombol disabled saat `previews.length === 0` — perilaku tidak konsisten.
- **Dampak:** Minor — satu ketukan ekstra + pesan error.
- **Rekomendasi:** Samakan pola: validasi inline saat blur, atau disable tombol hingga judul terisi dan ≥1 foto.

### R2 — Back/batal saat upload/save berjalan diabaikan diam-diam
- **Lokasi:** `app/showcase/create.tsx` (`requestClose`: `if (saveBusy.current || uploadBusy.current) return`)
- **Masalah:** Ketukan back/batal saat busy diabaikan tanpa feedback.
- **Dampak:** User mengira tombol rusak.
- **Rekomendasi:** Toast ringan ("Tunggu unggahan selesai…") atau nonaktifkan visual tombol back selama busy.

### R3 — `query-keys.ts` tidak punya entri showcase (kunci ad-hoc)
- **Lokasi:** `lib/query-keys.ts`; `app/showcase-management.tsx`, `app/user/[username]/showcase.tsx`
- **Masalah:** `lib/query-keys.ts` dideklarasikan sebagai single source of truth per endpoint tetapi tidak punya entri showcase — layar merangkai kunci ad-hoc sendiri.
- **Dampak:** Saat ini nihil fungsional (semua pemakaian showcase memakai `useCache: false`), tapi melanggar doktrin modul dan rawan duplikasi/invalidasi tak menjangkau.
- **Rekomendasi:** Tambahkan `queryKeys.myShowcase()`, `queryKeys.publicShowcase(username)`, `queryKeys.showcaseDetail(id)`.

### R4 — Kartu feed tidak menandai karya milik sendiri
- **Lokasi:** `components/ui/showcase-feed-item.tsx` vs `components/showcase-author-row.tsx:53`
- **Masalah:** Di feed, karya milik sendiri tidak dibedakan secara visual (hanya bendera lapor disembunyikan). Layar detail menampilkan Badge "Anda" dengan jelas.
- **Dampak:** Di feed user tidak bisa sekilas tahu kartu mana miliknya.
- **Rekomendasi:** Tambahkan penanda kecil ("Karya Anda") pada kartu feed bila `item.isOwner`.

### R5 — Empty state "Belum ada foto" menyesatkan; list tanpa paginasi server
- **Lokasi:** `app/showcase-management.tsx` (EmptyState di `ShowcaseGalleryGrid`); `lib/api/users.ts:647`
- **Masalah:** (a) Copy "Belum ada foto" padahal kondisinya belum ada *karya*. (b) Seluruh daftar diambil satu request tanpa paginasi; "Tampilkan karya lainnya" (+60) hanya memotong render lokal.
- **Dampak:** (a) Copy membingungkan user baru. (b) Akun dengan ratusan karya → respons besar, lambat di jaringan lemah.
- **Rekomendasi:** Ganti judul jadi "Belum ada karya" + tambah CTA inline; pertimbangkan paginasi server bila volume tumbuh.

### R6 — Hapus komentar tanpa undo
- **Lokasi:** `app/showcase/[id].tsx:676-702`
- **Masalah:** Hapus permanen dengan konfirmasi saja, tanpa snackbar-undo.
- **Dampak:** Rendah — konfirmasi eksplisit sudah ada.
- **Rekomendasi:** Opsional; pola sekarang dapat diterima.

### R7 — Aksesibilitas: `showcase-detail-comments.tsx` tanpa accessibility props
- **Lokasi:** `components/showcase-detail-comments.tsx` (seluruh file)
- **Masalah:** Toggle "Lihat {x} balasan" dan item komentar tanpa `accessibilityRole`/`accessibilityLabel`; pembaca layar tidak mengumumkan sebagai kontrol yang bisa ditekan.
- **Dampak:** User tunanetra sulit menavigasi thread komentar.
- **Rekomendasi:** Tambah `accessibilityRole="button"` + `accessibilityState={{ expanded }}` pada toggle; label "Komentar" jadikan header aksesibilitas.

### R8 — `pickImages` melempar error bila user memilih > limit (unreachable)
- **Lokasi:** `lib/image-picker.ts:130-138`
- **Masalah:** `selectionLimit` sudah diteruskan ke OS picker sehingga jalur throw praktis unreachable; pola error-vs-truncate tidak didefinisikan.
- **Dampak:** Minimal.
- **Rekomendasi:** Ganti throw dengan `slice(0, limit)` + pesan info bila ingin defensive.

---

## Yang Sudah Baik (tidak perlu tindakan)

- **Loading:** Skeleton di semua list (manajemen, feed, galeri publik, tab profil, tersimpan). Refresh tidak menukar list jadi skeleton.
- **Error + retry:** `ErrorState` + retry di semua list; feed: banner error + footer `LoadMore` dengan retry yang melanjutkan kursor.
- **Pull-to-refresh:** Ada & berfungsi di manajemen, feed, galeri publik, profil.
- **Infinite scroll:** Cursor pagination per (tab × filter), `mergeById` + dedupe — tidak ada duplikasi; request lama di-abort.
- **Stale data:** Rantai invalidasi utuh — `markShowcaseFeedDirty()` + `query.refresh()` setelah simpan/toggle/hapus/attach/reorder; karya baru muncul setelah kembali; feed refetch saat fokus bila dirty; detail `refreshOnFocus: true`.
- **Like:** Optimistic via store bersama dengan rollback ke snapshot + toast saat gagal; tap ganda diantre; tersinkron feed/profil; tamu di-gate login.
- **Komentar:** Tulis/edit/hapus (milik sendiri atau pemilik karya) dengan dialog konfirmasi; pagination 20/halaman; balasan dilipat; kirim gagal → toast dengan pesan server; draf per-item di sheet.
- **Share:** Sheet opsi (salin tautan, WhatsApp, Telegram, X, system share); deep link `https://kahade.id/showcase/<id>` benar.
- **Upload:** Kontrak rapi — pilih → presigned → kunci terkumpul → satu POST; foto gagal tidak membatalkan yang lain + tombol retry per foto; hapus foto membersihkan key di server; idempotency key cegah duplikat.
- **Peringatan perubahan belum disimpan:** `usePreventRemove` + dialog + `beforeunload` di web.
- **Validasi:** Judul wajib, min 1 foto, max≥min; batas panjang dari `API_CONSTRAINTS` (kontrak backend); harga negatif ditolak regex input; timeout 20s semua endpoint; error mapping `userMessage()` Indonesia yang jelas; offline → "Tidak ada koneksi internet. Periksa jaringan lalu coba lagi."
- **Gambar:** Placeholder skeleton + fallback ikon saat gagal load (`<Picture>`); galeri dengan indikator titik + tombol prev/next berlabel aksesibilitas.
- **Tipe:** Tanpa `any`; parser defensif dengan narrowing per-field.
- **Izin galeri:** Status `denied` dibedakan dari `cancelled`; pesan jelas + tombol "Buka pengaturan".

---

## Prioritas Fix Bertahap (usulan)

1. **Tahap 1 (bug nyata):** K1, T1, T2 — dialog buang setelah terbit, retry terblokir, error menempel di field salah.
2. **Tahap 2 (kepercayaan & konversi):** T3, S1, T5, S8 — guard stok/status tombol transaksi, VerifiedSeal 3-tier di feed/detail, hapus & edit in-context.
3. **Tahap 3 (hutang i18n):** S2 — migrasi batch `translate()` + `check:i18n`.
4. **Tahap 4 (penyempurnaan):** S3–S7, S9–S10, R1–R8.

---

*Catatan metodologi: audit dilakukan dengan membaca seluruh file terkait (4 tim paralel). Edit mode tidak ada di `app/showcase/create.tsx` — editor hidup di bottom-sheet `app/showcase-management.tsx` (sudah tercakup sebagian; audit khusus editor disarankan bila disentuh). Sweep i18n memakai deteksi kata Indonesia pada string literal/JSX; kemungkinan 1–2 string terlewat, tetapi daftar mencakup semua temuan signifikan.*
