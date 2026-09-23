# Audit Fitur Etalase (Showcase) — 69 Temuan Terverifikasi

**Tanggal audit:** 2026-09-23
**Branch / commit:** `arena/01a0ccbb-frontend` @ `fda6633` (main)
**Cakupan:** seluruh permukaan fitur Etalase — tab feed `app/(tabs)/showcase.tsx`, `components/showcase-feed-tab.tsx`, `components/ui/showcase-header.tsx`, `components/ui/showcase-feed-item.tsx`, detail `app/showcase/[id].tsx`, sheet komentar `components/ui/showcase-comments-sheet.tsx(+showcase-comment-row.tsx)`, tab Etalase profil `components/ui/profile-etalase-tab.tsx` + induk `app/user/[username].tsx`, manajemen `app/showcase-management.tsx`, galeri publik `app/user/[username]/showcase.tsx`, adapter `lib/api/showcase.ts` + bagian showcase `lib/api/users.ts`, kontrak `docs/api/kahade-api-mobile.json`, gating `lib/protected-routes.ts`, routing notifikasi, i18n, dan test.
**Metode:** pembacaan baris-per-baris seluruh berkas di atas, perbandingan terhadap kontrak OpenAPI (`kahade-api-mobile.json`) dan DTO (`lib/api/types.ts:540-598`), verifikasi silang dengan infrastruktur bersama (`PaginatedList`, `Screen/DataScreen`, `useApiQuery`, `guest-gate`, `notification-routing`, katalog i18n), serta penelusuran alur data end-to-end (unggah → terbit → feed → detail → interaksi). Temuan yang hanya bisa dipastikan 100% di perangkat/backend nyata ditandai **(perlu verifikasi runtime)**.

> **Standar bukti.** Setiap temuan menyertakan `file:line`. Konvensi severity mengikuti `issues.md`: 🔴 kritis · 🟠 tinggi · 🟡 sedang · 🔵 rendah. "Improvement" = celah UX/kemampuan, bukan bug keras.

---

## Ringkasan eksekutif

| Kategori | Jumlah | 🔴 | 🟠 | 🟡 | 🔵 |
|---|---:|---:|---:|---:|---:|
| A. Feed Etalase — paginasi, state, aksi sosial | 12 | 1 | 3 | 4 | 4 |
| B. Kartu `<ShowcaseFeedItem>` | 5 | 0 | 0 | 2 | 3 |
| C. Tab Etalase profil + integrasi `[username].tsx` | 8 | 1 | 2 | 3 | 2 |
| D. Manajemen etalase (`showcase-management`) | 11 | 0 | 1 | 5 | 5 |
| E. Galeri publik `/user/[username]/showcase` | 4 | 0 | 0 | 2 | 2 |
| F. Halaman detail `/showcase/[id]` | 10 | 0 | 0 | 5 | 5 |
| G. Sheet komentar feed | 4 | 0 | 0 | 2 | 2 |
| H. Adapter & kontrak API | 3 | 0 | 0 | 2 | 1 |
| I. Gating tamu, SEO, notifikasi, deep link | 5 | 0 | 0 | 3 | 2 |
| J. i18n & konsistensi copy | 5 | 0 | 0 | 2 | 3 |
| K. Testing | 2 | 0 | 0 | 1 | 1 |
| **Total** | **69** | **2** | **6** | **31** | **30** |

Seluruh quality gate repo (tsc, eslint, check:tokens/a11y/screens/api/i18n, vitest 239 test) hijau di `issues.md` sebelumnya — **tidak satu pun** dari 69 temuan di bawah terdeteksi oleh gate tersebut, karena hampir semuanya adalah cacat logika alur/integrasi, bukan pelanggaran gaya.

### Tiga alur yang paling mendesak diperbaiki

1. **A-01 🔴 — Paginasi feed rusak total saat refresh / ganti tab / ganti kata kunci:** kursor keyset tidak pernah di-reset, sehingga pull-to-refresh *melompat ke halaman N+1 dan menghapus halaman 1..N dari layar*; pencarian baru memakai kursor dari pencarian lama → hasil terlewat. Pengguna tidak pernah bisa melihat item terbaru lewat refresh.
2. **C-03 🔴 — "Laporkan" dari tab Etalase profil mengirim ID showcase ke endpoint lapor PENGGUNA** (`/reports` → `api.settings.reportUser`), sehingga laporan gagal (user tidak ditemukan) atau salah target. Feed punya jalur laporan yang benar; tab profil tidak.
3. **A-02 🟠 — Tab "Mengikuti" bisa menampilkan keadaan kosong permanen yang menyesatkan** (hasil filter klien = 0 item padahal `hasMore=true`) sambil footer muat-lagi disembunyikan untuk list kosong, dan error jaringan disalahartikan sebagai "belum login".

---

## Status perbaikan (2026-09-23, sesi lanjutan — SEMUA 69 ditangani)

Gate akhir: `tsc --noEmit` ✅ · `eslint .` ✅ · `vitest` **375/375** ✅ · `gen-i18n-catalog --check` ✅ (1936 string). Runner Playwright sandbox tidak bisa mengunduh Chromium (jaringan dibatasi) — spec e2e baru divalidasi sintaksnya dan siap jalan di CI lewat `npm run test:e2e`.

| ID | Status | Lokasi / cara perbaikan |
|---|---|---|
| A-01 🔴 | ✅ | `lib/showcase-feed-logic.ts` (`resetFeedPageState`, state per tab×search×kategori) + `fetchPage` me-reset di setiap initial/refresh |
| A-02 🟠 | ✅ | loop auto-fetch tab "Mengikuti" (maks 3 halaman/fetch sampai ≥5 item terfilter) di `showcase-feed-tab.tsx` |
| A-03 🟠 | ✅ | hanya 401/403 → tamu; error lain → `ErrorState`+retry di `ensureFollowingSet` |
| A-04 🟠 | ✅ | cache following dikunci `me.username` (`followingOwner`) — ganti akun membuang cache |
| A-05 🟡 | ✅ | `lib/use-showcase-social-actions.ts`: tamu → `ROUTES.loginRequired()`; komposer tamu → tombol "Masuk untuk berkomentar" (sheet + detail) |
| A-06 🟡 | ✅ | `lib/showcase-social-prefs.ts` (store session; dipilih karena repo tanpa storage lib — terdokumentasi di header file) |
| A-07 🟡 | ✅ | nilai suka final server masuk store bersama → detail/feed/profil sinkron satu sesi |
| A-08 🟡 | ✅ | `markShowcaseFeedDirty()` di tiap mutasi manajemen; feed menyegarkan saat fokus (`useIsFocused`) |
| A-09 🔵 | ✅ | `renderItem` useCallback + `FeedCard` memo ber-hook (feed & tab profil) |
| A-10 🔵 | ✅ | empty-state tamu "Mengikuti" punya tombol Masuk |
| A-11 🔵 | ✅ | `components/ui/showcase-report-sheet.tsx` — satu sheet, copy "Laporkan Karya" di feed/detail/profil |
| A-12 🔵 | ✅ | query `category` di feed + `ROUTES.showcaseWithCategory` + badge kategori pressable (kartu & detail) + chip filter di list |
| B-01 🟡 | ✅ | `lib/showcase-labels.ts` (`showcasePriceLabel`) dipakai tiga layar; 7 kasus uji table-driven |
| B-02 🟡 | ✅ | pager feed render window ±1 (placeholder menjaga lebar slide) |
| B-03 🔵 | ✅ | prop `href` dihapus dari tipe & implementasi |
| B-04 🔵 | ✅ | `onLayout`/`onMomentumScrollEnd` diketik `LayoutChangeEvent`/`NativeSyntheticEvent` |
| B-05 🔵 | ✅ | bendera disembunyikan untuk `isOwner` (feed + paritas profil via `toSocialShowcaseItem(isSelf)`) |
| C-01 🟠 | ✅ | `showcaseError` state di `[username].tsx` → tab merender `ErrorState compact` + retry |
| C-02 🟠 | ✅ | token generasi `tabRequest` — respons profil lama dibuang |
| C-03 🔴 | ✅ | tab profil kini me-render `<ShowcaseReportSheet>` (endpoint showcase yang benar) |
| C-04 🟡 | ✅ | `getPublicShowcase` auth `"none"` (selaras feed/detail); fallback jujur via C-01 bila backend menolak |
| C-05 🟡 | ✅ | patch lokal (komentar) di-reset saat identitas `items` berubah karena refresh |
| C-06 🟡 | ✅ | suka/simpan tab profil lewat hook+store bersama (gate tamu) |
| C-07 🔵 | ✅ | fallback `untitledShowcaseTitle()` ("Tanpa judul") di normalisasi bersama |
| C-08 🔵 | ✅ | state sheet dibuang saat `item → null`; perilaku didokumentasikan di docblock |
| D-01 🟠 | ✅ | item auto-buat multipart langsung disembunyikan (`isActive:false`) + form edit dibuka; publikasi = aksi eksplisit |
| D-02 🟡 | ✅ | field Kategori + switch Visibilitas di form create/edit (payload `category`/`visibility`) |
| D-03 🟡 | ✅ | `nextSortOrder` = max+1 |
| D-04 🟡 | ✅ | `lib/showcase-upload.ts`: presigned→PUT→confirm (satu pintu) + fallback multipart terukur |
| D-05 🟡 | ✅ | satu util `showcasePriceLabel` di ketiga layar (D-05) + test |
| D-06 🟡 | ✅ | sel grid punya prop `hidden` → scrim + badge EyeSlash (manajemen) |
| D-07 🔵 | ✅ | skeleton = `ShowcaseGalleryGrid loading` persegi |
| D-08 🔵 | ✅ | TITLE/DESC/CATEGORY_MAX dari `API_CONSTRAINTS.CreateShowcaseItemDto` |
| D-09 🔵 | ✅ | `cleanupPendingShowcaseKeys` (`/v1/upload/cleanup`) pada gagal attach/batal create; toast spesifik |
| D-10 🔵 | ✅ | reorder foto = draft lokal di sheet; SATU PUT saat sheet tutup |
| D-11 🔵 | ✅ | `pickImages` multi-pick (tanpa crop paksa) di tambah & lampirkan |
| E-01 🟡 | ✅ | grid galeri memakai `showcaseCoverOf` bersama |
| E-02 🟡 | ✅ | `alt` = `title ?? caption ?? "Item etalase"` |
| E-03 🔵 | ✅ | taut "Lihat sebagai galeri" dari tab Etalase profil |
| E-04 🔵 | ✅ | render grid bertahap 60 sel + tombol "Tampilkan {x} lainnya" |
| F-01 🟡 | ✅ | `ROUTES.createTransactionFromShowcase(orderLink, …)` — prefill counterpart/title/description/amount (bila valid) |
| F-02 🟡 | ✅ | komentar terkirim disisipkan lokal (`insertLocalComment`); paginasi tak ter-reset |
| F-03 🟡 | ✅ | `fetchComments` AbortController per request + abort saat unmount |
| F-04 🟡 | ✅ | `maxLength=1000` (constraints) di komposer, editor, dan sheet |
| F-05 🟡 | ✅ | menu "Laporkan" pada komentar pihak ketiga → `/reports?targetId=penulis` |
| F-06 🔵 | ✅ | `commentsStatus` awal `"loading"` — tanpa kilatan kosong |
| F-07 🔵 | ✅ | `LoadMore` dipindah DI BAWAH daftar komentar |
| F-08 🔵 | ✅ | total hanya berubah pada tambah/hapus (hide/unhide netral) |
| F-09 🔵 | ✅ | `refreshable` + `handleRefresh` (item + komentar halaman 1) |
| F-10 🔵 | ✅ | bar aksi detail memakai `focusRing` (pola kartu feed) |
| G-01 🟡 | ✅ | total = server + komentar lokal yang BELUM tercakup server (dedupe `serverIds`) |
| G-02 🟡 | ✅ | tombol "Lihat semua komentar" → halaman detail bila ada sisanya |
| G-03 🔵 | ✅ | perilaku reset didokumentasikan; draft/list dibuang saat tutup |
| G-04 🔵 | ✅ | buka-ulang item meng-`reload()` query komentar |
| H-01 🟡 | ✅ | like/unlike → `toLikeState()` defensif |
| H-02 🟡 | ✅ | `readList ["showcase","items"]` disamakan |
| H-03 🔵 | ✅ | `resolveShowcaseDeeplink(showcaseId)` adapter ditambahkan |
| I-01 🟡 | ✅ | tab `/showcase` publik untuk tamu web (`WEB_GUEST_TAB_SCREENS` + test diperbarui) |
| I-02 🟡 | ✅ | routing notifikasi mengenal referensi showcase → `showcaseDetail`, CTA "Lihat karya" |
| I-03 🟡 | ✅ | `useDocumentTitle(item.title ?? "Etalase")` di detail |
| I-04 🔵 | ✅ | `shareShowcaseById` → fallback salin tautan + toast yang benar |
| I-05 🔵 | ✅ | `/user/[username]/showcase` dikeluarkan dari daftar protected (+ test) |
| J-01 🟡 | ✅ | judul layar/copy diseragamkan "Etalase"/"karya" (manajemen, detail, galeri) |
| J-02 🟡 | ✅ | "Harga lewat diskusi" via `translate()` literal + EN "Price on request" |
| J-03 🔵 | ✅ | "Mulai Rp {x}"/"Hingga Rp {x}" via literal + EN "From/Up to Rp {x}" |
| J-04 🔵 | ✅ | "Tanpa judul" satu-satunya fallback judul |
| J-05 🔵 | ✅ | copy moderasi diseragamkan "karya" |
| K-01 🟡 | ✅ | `tests/showcase-social-logic.test.ts` — 22 kasus (harga, cover, normalisasi, paginasi, store) |
| K-02 🔵 | ✅/⏳ | `e2e/showcase.spec.ts` CLI-jalur publik; bagian ber-auth butuh staging (`E2E_BASE_URL`) → dicatat follow-up |

Keputusan implementasi yang patut diketahui: **state sosial session-only** (prefs). Dua sebab: (1) kontrak backend belum punya endpoint like-list per user; (2) package.json tidak menyertakan storage sync kecil dan menambah dependensi baru di luar mandat audit. Prinsip konsistensi-lintas-layar (A-06/A-07/C-05) terpenuhi dalam satu sesi; persistensi antar-cold-start dicatat sebagai peningkatan lanjutan bersama dukungan backend.

---

# A. Feed Etalase — paginasi, state, aksi sosial
Berkas utama: `components/showcase-feed-tab.tsx` (599 baris), `components/ui/showcase-header.tsx`.

### A-01 🔴 Kursor keyset tidak pernah di-reset — refresh/ganti tab/ganti kata kunci mengambil halaman BERIKUTNYA dan menghapus konten yang sudah tampil
**Bukti:** `components/showcase-feed-tab.tsx:234` (`cursor: slot[kind] ?? undefined`), `:249`, `:271` — kursor dibaca dari `cursors.current[kind]` (diisi di `:237`, `:253`, `:257`, `:274`) pada **setiap** mode, termasuk `"refresh"` dan `"initial"`. Tidak ada satu pun baris yang mengosongkan `slot` saat mode ≠ `"more"` (bandingkan `emptyCursors()` di `:94` yang hanya dipakai untuk inisialisasi ref). Pergantian tab/kata kunci memicu `useEffect(() => fetchPage(hasLoadedOnce.current ? "refresh" : "initial"), [fetchPage])` (`:301-304`), dan pull-to-refresh memanggil `fetchPage("refresh")` (`:484-487`). Hasil fetch kemudian **mengganti** seluruh list: `setItems((previous) => (mode === "more" ? mergeById(previous, incoming) : incoming))` (`:281`).
**Rantai reproduksi (pasti, dari kode):** muat awal → `slot.latest = nextCursor-1` → user scroll muat halaman 2 → `slot.latest = nextCursor-2` → user menarik-untuk-menyegarkan → request dikirim `cursor=nextCursor-2` → server mengembalikan **halaman 3** → `setItems(halaman3)` → halaman 1–2 lenyap dari layar. Hal yang sama terjadi saat (a) mengetik kata kunci baru setelah memuat beberapa halaman pada kata kunci lama (kursor milik *hasil pencarian lama* dipakai untuk *kata kunci baru* — keyset di atas himpunan data berbeda → baris terlewat/aneh), (b) berpindah kembali ke tab yang kursornya sudah maju.
**Dampak:** fungsi paling dasar feed — "tarik untuk melihat postingan terbaru" — justru melompat maju dan menghapus konten; pengguna tidak pernah bisa melihat item terbaru tanpa mematikan layar. Blok komentar komponen sendiri menjanjikan perilaku sebaliknya ("*Perubahan tab/search mereset feed (kursor lama dari sumber lain tidak valid)*", `:24-25`).
**Mengapa lolos:** perlu skenario multi-halaman; tidak ada satu pun test untuk logika paginasi ini (K-01).
**Saran:** saat `mode !== "more"` reset kursor slot yang relevan (`Object.assign(cursors.current[kind], emptyCursors())` + `moreFlags` → `false`); untuk `following`, reset juga `slot.latest`. Simpan kursor **per (tab × kata kunci)**, bukan per tab — mis. kunci `${kind}:${debouncedSearch}`. Tambahkan test untuk invariant: "refresh selalu request tanpa cursor".

### A-02 🟠 Filter sisi-klien tab "Mengikuti" menghasilkan empty-state palsu + tanpa jalan memuat halaman berikutnya
**Bukti:** filter `page.items.filter((item) => set.has(item.author.username))` (`:276`); kosong → `PaginatedList` merender `empty`, sedangkan footer `LoadMore` hanya dirender bila `data.length > 0` (`components/ui/paginated-list.tsx:196-204`); `onEndReached` tidak bisa diandalkan pada konten kosong. Copy yang tampil: "Belum ada showcase dari akun yang diikuti" (`:415-421`).
**Dampak:** pengguna yang mengikuti akun aktif bisa melihat "Belum ada showcase…" padahal halaman 2+ memuat karya akun tersebut — informasi salah, dan tidak ada affordance untuk maju **(perlu verifikasi runtime** apakah FlatList menembak `onEndReached` pada konten < viewport; pada banyak versi hanya sekali/tidak sama sekali tanpa scroll).
**Saran:** loop jujur di klien — ambil halaman berikutnya secara otomatis sampai ≥N item lolos filter atau `hasMore=false` (dengan batas iterasi + indikator progres), atau minta endpoint `sort=following`/`followingOnly` ke backend. Bedakan copy "kosong karena hasMore habis" vs "kosong pada halaman ini".

### A-03 🟠 Error jaringan tab "Mengikuti" disalahartikan sebagai "belum login"
**Bukti:** `ensureFollowingSet` menangkap SEMUA error non-abort — termasuk 500/timeout dari `GET /v1/users/me` atau `getFollowing` — lalu `setFollowingGuest(true)` + `followingSet.current = new Set()` (`components/showcase-feed-tab.tsx:194-207`); empty state tamu "Masuk untuk melihat feed mengikuti" dirender berdasarkan flag itu (`:396-403`).
**Dampak:** pengguna yang **sedang login** dengan sinyal buruk disuruh login; angka "belum mengikuti siapa pun" juga bisa tampil salah (`:405-412`). Klasifikasi error → state UI yang salah.
**Saran:** hanya petakan 401/403 → guest; error lain → `setError` (state error yang sudah ada) agar `ErrorState` + retry tampil. `me?.username` falsy bukan bukti tamu yang sah.

### A-04 🟠 Cache "akun yang diikuti" tidak dibersihkan saat ganti akun — bocor lintas sesi pada perangkat yang sama
**Bukti:** `followingSet.current` (`:153`) hanya di-null-kan saat refresh manual / mode≠more tab following (`:265-268`); komentar di `:156-163` sengaja menjaga `hasSession` di luar dependensi `fetchPage`. Setelah logout→login sebagai akun lain pada sesi mount yang sama (tab tetap ter-mount), daftar following **akun lama** tetap dipakai memfilter sampai refresh manual.
**Dampak:** feed "Mengikuti" akun B menampilkan/menyembunyikan item berdasarkan sosial graph akun A — kebocoran data antar akun di perangkat bersama + kebenaran feed salah.
**Saran:** kunci cache pada identitas akun (mis. simpan `ownerUsername` bersama set dan buang bila `me.username` berubah), atau reset di listener sesi (`subscribeSession`).

### A-05 🟡 Aksi sosial tamu (Suka/Komentar/Lapor) menembak 401 mentah alih-alih ajakan login
**Bukti:** `handleToggleLike` (`:323-353`), komposer di `<ShowcaseCommentsSheet>` (`components/ui/showcase-comments-sheet.tsx:79-100`), dan report (`showcase-feed-tab.tsx:448-475`) semuanya memanggil endpoint `auth:"required"` tanpa memeriksa sesi; `hasSession` sudah tersedia di komponen (`:161`) tetapi hanya dipakai untuk tab Mengikuti. Feed sendiri `auth:"none"` (`lib/api/showcase.ts:135-158`) sehingga tamu web/native pasti menemui jalur 401 ini.
**Dampak:** tamu menekan ♥ → toast "Gagal memperbarui suka" (setelah percobaan refresh token yang mustahil) — bukan sheet login. Kehilangan konversi sign-up dari corong konten publik.
**Saran:** gerbang satu tempat — `if (!hasSession) { tampilkan ajakan login (pola GuestLoginPrompt/login-required); return }` sebelum aksi sosial mana pun.

### A-06 🟡 "Simpan" (bookmark) murni lokal, hilang antar sesi, dan BERTENTANGAN antar layar
**Bukti:** feed `savedIds` state lokal (`:126`); tab profil `savedIds` terpisah (`components/ui/profile-etalase-tab.tsx:122`); detail `saved` terpisah lagi (`app/showcase/[id].tsx:113`). Ketiganya `useState` awal kosong tanpa persistensi maupun sinkronisasi.
**Dampak:** simpan di feed → buka detail → ikon bookmark kosong; simpan di detail → kembali → feed tetap penuh. Terlihat seperti aksi yang tidak berfungsi.
**Saran:** sampai endpoint koleksi tersedia, satukan state di store kecil per-item-id (satu sumber untuk feed/detail/profil) + persistensi ringan (MMKV/AsyncStorage) dengan copy UI "disimpan di perangkat ini", atau sembunyikan tombol sampai kontrak ada — tombol palsu lebih buruk dari tidak ada.

### A-07 🟡 State suka di feed tidak pernah disegarkan kembali dari detail/aksi lain
**Bukti:** `patchItem` menimpa `items` lokal (`:306-310`); tidak ada invalidasi saat kembali dari `/showcase/[id]` (yang punya state like sendiri, `app/showcase/[id].tsx:108-111, 350-377`); feed juga tidak refetch on focus (`useEffect` hanya pada `[fetchPage]` di `:301-304`).
**Dampak:** unlike di halaman detail → kembali → kartu feed masih ♥ penuh dengan angka lama (dan sebaliknya). Inkonsistensi yang terlihat jelas pada alur paling umum.
**Saran:** invalidasi query-cache `showcase-detail:` setelah like/unlike, dan/atau refetch ringan feed saat fokus kembali (flag "kembali dari detail").

### A-08 🟡 Item baru dari manajemen tidak pernah muncul di feed tanpa intervensi manual — dan refresh manualnya rusak (A-01)
**Bukti:** feed tidak punya refresh-on-focus maupun invalidasi cache dari `POST /v1/users/me/showcase` (lihat `:301-304`; adapter create tidak menyentuh cache feed karena feed state-nya lokal komponen, bukan `useApiQuery`).
**Dampak:** penjual menambah item di "Kelola etalase" ([+] di header), kembali ke Etalase → item tidak terlihat; menarik-refresh justru terkena A-01. Corong "terbit → terverifikasi di feed" patah.
**Saran:** invalidate/refresh feed saat fokus kembali dari `showcase-management`, atau setidaknya setelah mutasi create/update/delete (flag global/query-cache event).

### A-09 🔵 `renderItem` inline → seluruh sel tampak dirender ulang setiap ketikan di kolom pencarian
**Bukti:** `renderItem={({ item, index }) => (…)}` inline (`:525-544`) → identitas baru tiap render; `PaginatedList` membungkusnya dalam `itemWithLayout = useCallback(…, [renderItem, …])` (`components/ui/paginated-list.tsx:147-150`) sehingga FlatList (PureComponent) menggambar ulang semua sel yang terlihat pada setiap `setSearch` (per karakter; debounce 400 ms hanya menahan *request*).
**Dampak:** jank saat mengetik pencarian pada feed penuh gambar (masing-masing sel berisi pager + Picture); sia-sia di low-end.
**Saran:** bungkus renderItem dengan `useCallback` ber-dependensi handler stabil (handler sudah `useCallback`) + state kecil yang dipetakan (savedIds) — atau turunkan saved/like ke dalam sel memakai props nilai, bukan closure.

### A-10 🔵 Empty-state tamu tab "Mengikuti" buntu — tanpa tombol Masuk
**Bukti:** `<EmptyState icon … title="Masuk untuk melihat feed mengikuti" description=…/>` tanpa `action` (`:396-403`; bandingkan empty-state `isSelf` di tab profil yang punya tombol, `profile-etalase-tab.tsx:239-250`).
**Saran:** tambahkan aksi `Masuk` → `ROUTES.login` (tahap pertama konversi dari konten publik).

### A-11 🔵 Copy laporan inkonsisten antar dua jalur yang sama
**Bukti:** sheet laporan di feed: judul "Laporkan Karya" (`:558`); halaman detail: "Laporkan item" (`app/showcase/[id].tsx:886`); keduanya `POST /v1/showcase/{id}/report`. Juga `reportReason` default "SPAM" tanpa mengingat pilihan terakhir — minor.
**Saran:** satu copy ("Laporkan karya" disarankan, konsisten dengan label "karya" di empty states).

### A-12 🔵 Pencarian tidak pernah memakai filter `category` yang didukung backend — dan tidak ada UI kategori di mana pun di feed
**Bukti:** adapter mengirim `category` (`lib/api/showcase.ts:138-148`, spec `ShowcaseFeedQuery.category`), tetapi satu-satunya input filter adalah kolom teks — `grep category components/showcase-feed-tab.tsx components/ui/showcase-header.tsx` kosong. Kategori tampil pasif sebagai teks/badge (`showcase-feed-item.tsx:314-321`, `app/showcase/[id].tsx:591`).
**Dampak (improvement):** penemuan produk terbatas pada pencarian bebas; kategori — data yang sudah diminta backend — tak bisa dijelajahi (lihat juga D-02: tidak ada cara mengisi kategori sama sekali dari aplikasi).
**Saran:** chip kategori populer di bawah kolom cari (mengisi `category`), dan saat mengetuk badge kategori di kartu/detail → filter feed.

---

# B. Kartu `<ShowcaseFeedItem>` (`components/ui/showcase-feed-item.tsx`)

### B-01 🟡 Item dengan hanya `priceMax` ditampilkan "Harga lewat diskusi" — data harga dibuang
**Bukti:** `priceLabel` (`:134-139`) hanya memeriksa `priceMin != null` untuk cabang harga tunggal; `priceMin == null && priceMax != null` jatuh ke string default. Backend mengizinkan max-saja (DTO `minimum: 0` tanpa pasangan wajib) — layar manajemen sendiri mengantisipasinya dengan label "Hingga RpX" (`app/showcase-management.tsx:88`).
**Dampak:** penjual yang mengisi "maksimal Rp500rb" kehilangan informasinya di feed & profil. Halaman detail punya bug sama (`app/showcase/[id].tsx:436-440`).
**Saran:** samakan dengan logika manajemen (rentang bila keduanya & berbeda; "Mulai/Hingga" bila satu; "Harga lewat diskusi" bila kosong).

### B-02 🟡 Semua slide galeri di-mount sekaligus — pager tidak divirtualkan
**Bukti:** `gallery.map(… 8 <Picture>)` penuh di dalam `ScrollView horizontal` (`:271-288`); tiap kartu bisa memuat 8 gambar persegi; feed 20 item → sampai 160 `expo-image` persegi besar ter-mount.
**Dampak:** memori & decode image melonjak; `initialNumToRender={8}` FlatList sudah 8 kartu × gambar ganda. Di low-end: jank / OOM-ish.
**Saran:** render window (slide aktif ±1) atau ganti pager dengan FlatList horizontal ber-window; prefetch slide berikut saat momentum.

### B-03 🔵 Prop `href` mati — diterima lalu dibuang
**Bukti:** `void href` (`:128`) dan tidak dipakai di mana pun; satu-satunya navigasi lewat `router.push` internal.
**Dampak:** API publik komponen menipu (web tidak dapat `<a href>` yang bisa dibuka-tab-baru/di-crawl), dan tidak pernah diketahui pemanggil.
**Saran:** hapus prop atau implementasikan `Link` di web (SEO feed).

### B-04 🔵 `onLayout` memakai `any` — bypass tipe di komponen inti
**Bukti:** `onLayout={(e: any) => …}` (`:229`); halaman detail mengetiknya dengan benar (`app/showcase/[id].tsx:609`).
**Saran:** ketik `LayoutChangeEvent` (sudah diimpor pola serupa di `showcase-gallery-grid.tsx:41`).

### B-05 🔵 Tombol Laporkan (bendera) tampil juga pada item milik sendiri di feed
**Bukti:** `handleReport` tanpa cek pemilik (`:168-172`; render `:193-202`); halaman detail sebaliknya menyembunyikan bendera untuk pemilik (`app/showcase/[id].tsx:623-629`).
**Dampak:** pemilik bisa "melaporkan karya sendiri" — affordance moderasi yang keliru; beda perilaku feed vs detail (detail menyembunyikannya di `app/showcase/[id].tsx:527-535`).
**Saran:** butuh `isOwner` dari feed item (sudah ada di tipe) → sembunyikan bendera; atau ganti jadi menu ⋯ berisi "Kelola" untuk pemilik.

---

# C. Tab Etalase profil + integrasi `app/user/[username].tsx`
Berkas: `components/ui/profile-etalase-tab.tsx`, `app/user/[username].tsx`, `lib/api/users.ts:731-737`.

### C-01 🟠 Error memuat etalase profil ditampilkan sebagai "belum ada konten" — tanpa retry
**Bukti:** `.catch(() => setShowcaseItems([]))` (`app/user/[username].tsx:255`); tab lalu merender salah satu `<EmptyState>` (`profile-etalase-tab.tsx:236-260`). Pola identik menimpa Tanya Jawab & Ulasan (`:263-267`, `:275-279`) tetapi untuk Etalase paling merugikan karena tab ini default aktif.
**Dampak:** penjual DENGAN etalase penuh tampak "belum membagikan apa pun" bagi calon pembeli saat jaringan/backend goyah — fatal untuk corong transaksi. Tidak ada tombol coba-lagi.
**Saran:** simpan error per tab (`showcaseError`) dan render `ErrorState compact` dengan retry yang memanggil ulang fetch tab saja.

### C-02 🟠 Race pindah profil: etalase pengguna A bisa menimpa tampilan profil B
**Bukti:** `fetchTabContents` (`:246-280`) menembak request TANPA AbortController dan tanpa token generasi — guard `profileRequest.current` hanya melindungi `fetchProfile` (`:284+`). Pengguna mengetuk profil B sebelum respons etalase profil A kembali → `.then(setShowcaseItems)` milik A menimpa state milik B.
**Dampak:** profil B sesaat (atau permanen, bila respons B lebih dulu selesai) menampilkan karya penjual lain — salah atribusi konten dagangan **(perlu verifikasi runtime** untuk urutan pastinya, tetapi jalurnya pasti ada).
**Saran:** teruskan `signal` (getPublicShowcase sudah menerimanya) + batalkan di cleanup effect, atau pakai pola token `profileRequest` yang sama.

### C-03 🔴 "Laporkan" dari tab ini mengirim ID showcase ke endpoint lapor PENGGUNA — laporan gagal/salah target
**Bukti:** tab tidak meneruskan `onReport` (komentar eksplisit `profile-etalase-tab.tsx:285-286`) → default komponen `router.push(ROUTES.reports({ targetId: item.id }))` (`showcase-feed-item.tsx:168-172`) → layar `/reports` mensubmit `api.settings.reportUser({ targetId, category, description }, targetName)` (`app/reports.tsx:93-108`) — endpoint `POST /v1/users/{id}/report` dengan kategori enum PENGGUNA (`lib/labels/report.ts:41-61`), sementara `targetId` adalah ID showcase dan `targetName` kosong.
**Dampak:** setiap laporan karya dari tab Etalase profil berakhir 400/404 ("user tidak ditemukan") atau salah arah; halaman komentar di adapter sendiri mengakui keluarga kegagalan ini ("*Laporkan dulu gagal dengan 'user tidak tersedia'*", `app/reports.tsx:100-104`).
**Saran:** teruskan `onReport` seperti feed (sheet `reportShowcase`) — kode sheet-nya sudah ada dan bisa diekstrak dari `showcase-feed-tab.tsx:496-538` menjadi komponen bersama.

### C-04 🟡 Endpoint showcase publik mewajibkan login — bertentangan dengan permukaan publik fitur
**Bukti:** spec: `GET /v1/users/{username}/showcase security=[access-token]` (`docs/api/kahade-api-mobile.json`), adapter `auth:"required"` (`lib/api/users.ts:731-737`); sedangkan feed & detail sosial `auth:"none"` dan rute `/showcase/[id]` sengaja publik (`lib/protected-routes.ts:179-181`).
**Dampak:** corong "lihat link profil → lihat etalase" mustahil untuk tamu; di web profil tertutup gate, pola "gagal→[]" (C-01) menyembunyikan penyebab sebenarnya di jalur error native.
**Saran:** negosiasikan `auth:"none"` dengan backend (kontennya sudah publik lewat feed), atau tampilkan state "masuk untuk melihat etalase" yang jujur alih-alih empty/error generik.

### C-05 🟡 Patch interaksi bertahan di atas data segar setelah refresh profil
**Bukti:** `patches` per-id (`profile-etalase-tab.tsx:130-141`) tidak pernah di-reset; `base` dari `items` baru diganti patch lama pada `socialItems` (`:143-147`). `fetchTabContents` dipanggil ulang saat profil di-refresh (induk, `:336`).
**Dampak:** angka suka/komentar hasil optimistis menimpa nilai server yang lebih baru tanpa batas waktu (mis. likeCount turun di server karena spam-cleanup → klien menampilkan angka lama).
**Saran:** reset `patches` saat `items` berubah identitas karena refresh (bukan karena patch sendiri) — mis. set `patches={}` di callback yang mengganti `items` dari jaringan.

### C-06 🟡 Tamu/pengunjung: Suka & Simpan di tab ini menembak 401 / tak tersimpan (kelas yang sama dengan A-05/A-06)
**Bukti:** `handleToggleLike` (`:184-211`) & `savedIds` lokal (`:122`) — tanpa guest-gate.
**Saran:** gabung perbaikan dengan A-05/A-06 (satu komponen aksi sosial bersama akan menghapus empat duplikasi logika ini; lihat G-03/I-01).

### C-07 🔵 Judul fallback "Showcase" untuk item tanpa judul
**Bukti:** `title: item.title ?? item.caption ?? "Showcase"` (`:94-95`); item otomatis-dibuat dari alur unggah (D-04) punya probabilitas tinggi tanpa judul → feed/profil dipenuhi kartu bernama generik "Showcase" (bahasa Inggris pula di UI Indonesia).
**Saran:** fallback netral berbahasa Indonesia ("Tanpa judul") + cegah sumbernya di D-04.

### C-08 🔵 Query `showcase-comments:none` + efek reset saat `showcaseId` berubah meninggalkan jendela state basi saat menutup sheet
**Bukti:** key `showcase-comments:${showcaseId ?? "none"}` (`showcase-comments-sheet.tsx:55-60`) — tutup sheet (`item → null`) mematikan query, tetapi `localComments`/`draft` hanya direset saat id **berubah**, bukan saat ditutup (`:66-69`).
**Dampak (kecil):** draf setengah jadi bertahan saat sheet dirender ulang untuk item yang sama — bisa dianggap fitur, tetapi tidak didokumentasikan; hitungan ganda terkait G-01.
**Saran:** dokumentasikan perilaku draf, atau reset juga saat `item` → `null`.

---

# D. Manajemen etalase (`app/showcase-management.tsx`)

### D-01 🟠 Unggah foto bisa LANGSUNG menerbitkan item tanpa judul/judul-placeholder — publikasi tanpa konfirmasi
**Bukti:** `if (res?.id) { toast "Foto showcase ditambahkan"; … setEditor({ mode: "edit", item: res }) }` (`:142-150`) — bila backend membuat item langsung dari `/showcase/upload`, item sudah tersimpan (aktif) sebelum pengguna mengisi apa pun; membatalkan form edit menyisakan item terbit tanpa judul (tampil sebagai "Showcase" di publik, lihat C-07).
**Dampak:** etalase publik berisi item kosong tak disengaja; pengguna tidak sadar harus menghapusnya manual.
**Saran:** setelah cabang ini, tandai item "draft" dan minta minimal judul sebelum aktif (set `isActive:false` saat memperbaiki), atau hilangkan dukungan cabang dengan menyepakati satu kontrak unggah dengan backend (lihat D-05).

### D-02 🟡 `category` & `visibility` tidak bisa diisi dari aplikasi — dua field kontrak menganggur
**Bukti:** form hanya title/description/priceMin/priceMax (`:560-620`); DTO menyediakan `category` (maxLength 60) dan `visibility: PUBLIC|PRIVATE` (`lib/api/types.ts:549-551, 576-578`). Tipe item sosial mengembalikan `category`/`visibility` (`lib/api/showcase.ts:39-40`) dan feed-item menampilkannya pasif.
**Dampak:** filter kategori backend (A-12) tak pernah punya data; penjual tak bisa menyetel item "PRIVATE" (draft) — semua item publik.
**Saran:** tambahkan input kategori (combobox bebas dengan saran) + toggle visibilitas pada form create/edit; tampilkan badge PRIVAT di grid (D-08).

### D-03 🟡 `sortOrder: items.length` berisiko tabrakan urutan; tidak ada cara mengatur urutan item
**Bukti:** `sortOrder: items.length` saat create (`:201`) — termasuk item tersembunyi dan tanpa membaca `sortOrder` maksimum yang sudah ada; setelah hapus item tengah, nilai baru bisa duplikat dengan yang ada, dan hasil akhir bergantung tie-break backend. Komentar file sendiri mengakui backlog reorder (`:31-33`).
**Dampak:** susunan etalase bisa berubah tak terduga saat menambah item; pemilik tak bisa menonjolkan karya terbaik di atas (kunci e-Commerce).
**Saran:** `sortOrder = max(sortOrder)+1`; sediakan reorder (minimal naik/turun seperti kelola foto, `:294-313`) yang memakai `PUT …/me/showcase` berurutan atau endpoint reorder bila disediakan backend.

### D-04 🟡 Kontrak unggah "ditebak" tiga cabang dan tidak memakai alur presigned→confirm yang didokumentasikan DTO
**Bukti:** `const imageUrl = res?.imageUrl ?? res?.url ?? res?.key ?? res?.fileKey` (`:152-154`) dengan komentar "UNVERIFIED mana yang dilakukan backend" (`:14`); respons spec 201 tanpa schema (`kahade-api-mobile.json` → `/v1/users/me/showcase/upload responses: {201: {description:""}}`); sementara `imageFileKeys` mensyaratkan "*object key hasil upload presigned … yang sudah dikonfirmasi lewat POST /upload/confirm*" (`lib/api/types.ts:567`).
**Dampak:** bila backend menolak key dari multipart langsung (belum "confirmed"), create gagal setelah foto sudah terunggah (orphan) — dan cabang-cabang tebakan ini tak teruji (K-01).
**Saran:** satukan ke `api.upload.uploadPresigned`(purpose SHOWCASE_IMAGE)+`/upload/confirm` (yang juga memberi progres & pembatalan); pertahankan multipart hanya sebagai fallback terukur dengan test kontrak.

### D-05 🟡 Tiga implementasi label harga, tiga perilaku berbeda — manajemen menampilkan rentang ganda untuk harga sama
**Bukti:** manajemen `priceLabel` (`:84-90`): `min && max` → "Rp X – Rp Y" **tanpa cek kesetaraan** (min==max → "Rp5.000 – Rp5.000"); feed (`showcase-feed-item.tsx:134-139`): setara → tunggal, max-saja → "Harga lewat diskusi" (B-01); detail (`app/showcase/[id].tsx:436-440`): rentang menulis "Rp X – Rp Y" (Rp ganda) vs feed "Rp X – Y".
**Saran:** satu util `showcasePriceLabel(item)` di `lib/` + test table-driven (K-01), dipakai ketiga layar.

### D-06 🟡 Item tersembunyi tidak punya penanda VISUAL di grid — hanya di label aksesibilitas
**Bukti:** penanda disembunyikan hanya digabung ke string `alt` (`:426`) dan subjudul jumlah (`:413`); sel grid tidak punya badge/overlay `EyeSlash`.
**Dampak:** pemilik tunanetra diberi tahu, pemilik awas tidak — bingung "kenapa karya saya tidak tampil di profil".
**Saran:** overlay kecil (ikon + scrim) pada sel nonaktif.

### D-07 🔵 Skeleton layar memakai `<ListLoading>` (kartu h-24) padahal grid punya skeleton sel sendiri
**Bukti:** `<Crossfade loading skeleton={<ListLoading/>}>` (`:421`) + `<ShowcaseGalleryGrid … loading={false}>` (`:429`) — prop loading grid sengaja dimatikan; grid menyediakan skeleton persegi yang bentuknya pas (`showcase-gallery-grid.tsx:110-113`).
**Dampak:** layout melompat saat data tiba (jenis cacat yang sama dengan yang diperbaiki `DetailLoading` di `paginated-list.tsx:48-72`).
**Saran:** `skeleton={<ShowcaseGalleryGrid items={[]} loading />}`.

### D-08 🔵 `SHOWCASE_MAX_IMAGES = 8` & batas form hardcode, diduplikasi dari backend
**Bukti:** `:65-68` (TITLE_MAX/DESC_MAX/SHOWCASE_MAX_IMAGES) — kontrak sebenarnya hidup di `lib/api/constraints.ts:284+` (CreateShowcaseItemDto) dan spec.
**Saran:** turunkan dari `constraints.ts` (sudah jadi sumber untuk check:api), supaya perubahan backend tidak desinkron diam-diam.

### D-09 🔵 Flow lampirkan foto meninggalkan fileKey orphan bila langkah kedua gagal
**Bukti:** `uploadShowcase` sukses → `attachShowcaseImages` gagal → fungsi kembali tanpa cleanup (`:264-292`); file di storage permanen sebagai sampah tak terlacak (tujuan SHOWCASE_IMAGE).
**Saran:** catat key tertunda per item dan tawarkan "Coba lagi melampirkan" (pending-actions pattern yang sudah ada di repo), atau pindah ke alur confirm-atomik (D-04).

### D-10 🔵 Reorder foto = 2 request penuh per klik panah; pemindahan 3 posisi = 6 round-trip + 3 refetch daftar
**Bukti:** `handleMoveImage` → `reorderShowcaseImages` lalu `query.refresh()` penuh (`:298-313`).
**Saran:** urutkan optimistis di state, debounce satu PUT saat sheet ditutup/berhenti 800 ms, rollback pada error.

### D-11 🔵 Tidak ada multi-select saat menambah foto (satu per satu) dan crop dipaksa persegi
**Bukti:** `pickImage({ allowsEditing: true })` (`:134`, `:275`) — tanpa `allowsMultipleSelection`, crop 1:1 tanpa opsi rasio asli (picker mendukung `aspect`, `lib/image-picker.ts:36-43`).
**Dampak (improvement):** 8 foto = 16 interaksi; karya portrait/landscape (jasa desain, interior) terpotong paksa.
**Saran:** multi-pick + opsi "tanpa crop", biarkan card memberi crop visual (`aspectRatio` tetap 1 di kartu, original tetap utuh di viewer).

---

# E. Galeri publik `app/user/[username]/showcase.tsx`

### E-01 🟡 Pemetaan sumber gambar mengabaikan `coverImageUrl`/`images[]` — grid bisa kosong walau data ada
**Bukti:** `source: it.imageUrl ?? it.fileKey ?? ""` (`:68`); bentuk modern (manajemen, `:420-424`) memakai `coverImageUrl ?? imageUrl ?? fileKey` dan adapter menjamin `images[]`/`coverImageUrl` adalah kanonik baru (`lib/api/showcase.ts:42-47`, `lib/api/users.ts:169-170…645-651`).
**Dampak:** layar ini menampilkan sel kosong/`alt` saja untuk item multi-gambar baru **(perlu verifikasi runtime** terhadap respons hidup, karena kontrak GET ini sendiri "UNVERIFIED" per komentar adapter).
**Saran:** samakan resolver dengan mana pun — satu fungsi `showcaseCoverOf(item)` bersama.

### E-02 🟡 `alt` memakai `caption` (field legacy), bukan `title` — pembaca layar mendengar "Portofolio" untuk semua sel
**Bukti:** `alt: it.caption ?? "Portofolio"` (`:69`); konten kanonik adalah `title` (DTO required).
**Dampak:** a11y: seluruh sel memiliki label identik/tak bermakna; juga menyembunyikan judul asli dari alt.
**Saran:** `it.title ?? it.caption ?? translate("Item etalase")`.

### E-03 🔵 Layar ini (route terdaftar + terproteksi) tidak ditautkan dari mana pun — kode mati hidup
**Bukti:** `ROUTES.userShowcase` didefinisikan (`lib/routes.ts:325-326`) tetapi `grep userShowcase app/ components/` hanya menemukan definisinya.
**Dampak:** duplikasi jalur "galeri grid vs tab feed profil" tetap dirawat (dan menyimpan bug E-01/E-02) tanpa pengguna; atau sebaliknya — jalur intended-nya hilang dari UI.
**Saran:** putuskan: tautkan ("Lihat semua" dari tab Etalase profil) atau hapus layar + rute.

### E-04 🔵 Tanpa paginasi/batas — satu respons penuh diterjemahkan seluruhnya ke grid
**Bukti:** langsung `api.users.getPublicShowcase(username)` → `items.map` (`:38-43, 66-72`); Picture per sel tanpa windowing.
**Saran:** pagination/batas + `initialNumToRender` pola grid bertahap, atau virtualisasi dua dimensi.

---

# F. Halaman detail `app/showcase/[id].tsx`

### F-01 🟡 Kontrak `orderLink` (pra-isi transaksi) diabaikan — CTA "Buat Transaksi" generik
**Bukti:** tipe membawa `orderLink { title, description, orderValue, orderValueValid, counterpartUsername }` "siap pakai untuk pr-pengisian alur transaksi" (`lib/api/showcase.ts:59-66`), tetapi CTA hanya `router.push(ROUTES.createTransactionWith(item.author.username))` (`:675-679`); `orderLink` tak direferensikan di UI mana pun.
**Dampak (improvement-commerce):** pembeli mengetik ulang judul/deskripsi/nominal yang server sudah siapkan — corong konversi terpanjang fitur ini sia-sia.
**Saran:** kirim payload orderLink sebagai param pra-isi ke create-transaction (ikonfirmasi field-nya dengan layar itu), dan tampilkan strip ringkasan ("Pesan: {title} — {orderValue}") di atas tombol.

### F-02 🟡 Komentar terkirim me-reset paginasi — halaman komentar 2..N yang sudah dimuat dibuang
**Bukti:** setiap send/edit melewati `applyServerComment` (`:237-249`) yang selalu memanggil `fetchComments(1, false)` (`:248`), dan fetch non-append me-reset window render (`if (!append) setCommentRenderLimit(…)` di `:165`) — seluruh array hasil append sebelumnya diganti halaman 1.
**Dampak:** pengguna yang sedang membaca halaman komentar 3 lalu membalas → kembali ke halaman 1 dan harus memuat ulang satu per satu. Juga memicu request penuh untuk satu komentar baru (`applyServerComment` sudah menambal lokal — fetch ulang redundan dalam banyak kasus).
**Saran:** sisipkan komentar baru langsung ke root yang tepat (untuk balasan parentId → tambah ke `replies`), fetch ulang hanya bila id tidak dikenal atau counter berubah.

### F-03 🟡 `fetchComments` tanpa AbortController — setState setelah unmount / respons basi
**Bukti:** `listShowcaseComments(id, { page, limit: 20 })` dipanggil tanpa `signal` (`:163`); `fetchComments` (`:158-172`) dan efek pemicunya (`:176-178`) tidak punya AbortController/flag batal, begitu pula handler load-more.
**Dampak:** navigasi cepat item A→B menuliskan komentar A ke layar B (id berubah → fetch lama tetap resolve ke `setComments`), plus warning React **(perlu verifikasi runtime**).
**Saran:** AbortController per generasi seperti `activeRequest` di feed, atau migrasi ke `usePaginatedQuery`/`useApiQuery`.

### F-04 🟡 Komposer komentar tanpa batas 1000 karakter (kontrak) —ditampol server setelah mengetik panjang
**Bukti:** `Input` tanpa `maxLength` di komposer footer (`:478-486`), komposer sheet feed (`showcase-comments-sheet.tsx:112-122`), dan edit `TextArea` tanpa `maxLength` (`:842-848`); spec `CreateShowcaseCommentDto.content maxLength 1000`.
**Saran:** `maxLength={1000}` + counter (TextArea sudah punya `showCount`; komposer utama perlu jadi TextArea kecil atau tetap Input dengan batas).

### F-05 🟡 Tidak ada jalur melaporkan KOMENTAR — moderasi hanya untuk pemilik/pengarang
**Bukti:** menu komentar (ActionSheet `:755-818`) hanya Balas/Edit/Sembunyikan/Tampilkan/Hapus; `reportShowcase` hanya level item. Pengguna melihat komentar scam/ujaran kebencian pada karya orang lain → tidak bisa melaporkannya.
**Saran:** aksi "Laporkan komentar" (endpoint bila tersedia — bila belum, minimal `reportUser` pengarang lewat jalur `/reports` dengan `targetId` user-id yang benar + konteks).

### F-06 🔵 Bingkai data dua kali: "Belum ada komentar" & tombol Muat muncul sekejap sebelum fetch pertama
**Bukti:** `commentsStatus` awal `"idle"` (`:126`); pesan kosong dirender bila status ≠ loading/error (`:709-712`) dan `<LoadMore>` menampilkan `idleLabel` — sebelum efek pertama mengubahnya menjadi `"loading"`.
**Saran:** inisialisasi `"loading"` dan turunkan ke `"idle"` setelah fetch pertama; atau render kosong sampai fetch pertama selesai.

### F-07 🔵 Tombol "Muat komentar berikutnya" berada DI ATAS daftar padahal halaman baru ditambahkan DI BAWAH
**Bukti:** `<LoadMore … />` adalah anak pertama kontainer komentar (`:703-707`), sedangkan append `[...prev, ...res.data]` (`:163`). Pengguna menekan tombol di atas, lalu harus menggulir ke bawah untuk melihat hasilnya — tak terlihat perubahan di titik tekan.
**Saran:** pindahkan ke akhir daftar (atau ganti infinite scroll dengan sentinel `onEndReached` manual seperti feed).

### F-08 🔵 Angka komentar menyimpang setelah hide/unhide/hapus berantai
**Bukti:** hapus root berbalasan → tombstone ("[Komentar ini telah dihapus]", `:227`) TANPA mengurangi total; hide → total `-1` (`:306-313`) walau balasan anak masih dihitung server; unhide `+1` (`:319-320`). Total display item (`commentCount` dari detail) dan `commentTotal` lokal berangsur-angsur berbeda.
**Saran:** biarkan counter mengikuti respons list (`res.total`) pada refresh berikutnya dan hindari mutasi ganda; lebih baik lagi tanya backend satu field `visibleCommentCount`.

### F-09 🔵 Halaman detail tidak bisa disegarkan manual (`refreshable={false}`) dan tidak ada refresh-on-focus
**Bukti:** `refreshable={false}` di kedua kolom DataScreen (`:430`, `:456`); counter suka/komentar/view menjadi basi pada layar yang dibuka lama via share.
**Saran:** aktifkan pull-to-refresh (DataScreen sudah mendukung) memakai `query.refresh` + `fetchComments(1,false)`.

### F-10 🔵 Bar aksi detail tanpa focus-ring (web), padahal kartu feed memilikinya
**Bukti:** containerClassName keempat PressableScale baris aksi (`:660-714`) tidak menyertakan `focusRing` — bandingkan `showcase-feed-item.tsx:103, 113`.
**Saran:** tambahkan `focusRing` ke keempat PressableScale aksi (suka/komentar/bagikan/simpan).

---

# G. Sheet komentar feed (`components/ui/showcase-comments-sheet.tsx`)

### G-01 🟡 Hitungan header bisa ganda setelah mengirim komentar lalu membuka ulang sheet item yang sama
**Bukti:** `total = (query.data?.total ?? item?.commentCount ?? 0) + localComments.length` (`:96`); `localComments` hanya direset saat `showcaseId` BERUBAH (`:66-69`). Setelah post → tutup → buka item sama: cache `useApiQuery` (TTL) bisa berisi total yang SUDAH memuat komentar baru, lalu `+ localComments.length` menambahnya lagi. Daftar ter-dedupe oleh id (`:93-94`) — hanya angkanya yang bohong.
**Saran:** dedupe juga hitungannya (mis. `Math.max(serverTotal, item.commentCount + localsYetUnseen)`), atau reset `localComments` saat sheet tertutup.

### G-02 🟡 Maksimum 30 komentar root per item; tidak ada jalur membaca sisanya dari feed
**Bukti:** `SHEET_COMMENT_LIMIT = 30` (`:37`), satu halaman tanpa LoadMore/paginasi dan tanpa tautan "Lihat semua di halaman detail".
**Saran:** footer sheet "Lihat semua {n} komentar" → `ROUTES.showcaseDetail(item.id)`.

### G-03 🔵 Dua implementasi komentar (sheet vs halaman detail) menyimpan logika duplikat yang pasti drift
**Bukti:** composer+fetch+dedupe lokal di sheet (`:55-100`) vs state mesin lengkap di detail (`:117-272`); sheet tanpa balas/edit/hapus/hide (baris komentar mematikannya: `showcase-comment-row.tsx:15-19`).
**Dampak:** perbaikan F-02/F-04 harus dilakukan dua kali (dan sudah: maxLength absen di keduanya); penyembunyian komentar pemilik tak terlihat konsisten di sheet.
**Saran:** ekstrak hook `useShowcaseComments(showcaseId)` bersama + satu komposer.

### G-04 🔵 Sheet tidak menyegarkan ulang daftar saat dibuka kembali untuk item yang sama
**Bukti:** query dikunci per id dan cache `useApiQuery` menyajikan data lama; tidak ada panggilan `query.reload()` saat transisi `item: null → item`.
**Saran:** reload ringan saat pembukaan ulang (atau andalkan TTL yang lebih pendek untuk kunci `showcase-comments:*`).

---

# H. Adapter & kontrak API (`lib/api/showcase.ts`, `lib/api/users.ts`)

### H-01 🟡 Hasil mutasi showcase tidak dinormalisasi defensif, tidak konsisten dengan adapter sekelilingnya
**Bukti:** `uploadShowcase` hanya `pick*` sebagian field (`lib/api/users.ts:676-690`); `attachShowcaseImages`/`reorderShowcaseImages` me-return mentah (`:1039-1057`); `likeShowcase` langsung cast `{liked, likeCount}` (`lib/api/showcase.ts:245-258`); sedangkan GET feed mengurai defensif (`:135-158`). Silang-bentuk (snake_case vs camelCase) hanya ditangani pada create/update item.
**Dampak:** satu perubahan bentuk respons kecil dari backend → UI menyimpan `undefined` tanpa error yang jelas (mis. `liked` hilang → patch `isLiked: undefined` → ikon salah).
**Saran:** satu normalizer `toShowcaseItem(raw)` + `toLikeState(raw)` dengan default eksplisit; gunakan di semua mutasi.

### H-02 🟡 Urutan kunci `readList` berbeda untuk endpoint yang sekeluarga
**Bukti:** milik sendiri `readList(raw, ["showcase", "items"])` (`lib/api/users.ts:665-668`) vs publik `readList(raw, ["items", "showcase"])` (`:731-737`) — prioritas kunci berbeda bila backend mengirim keduanya.
**Saran:** konsistenkan (atau dokumentasikan alasannya); tambahkan test respons-helper untuk kedua endpoint (K-01).

### H-03 🔵 Endpoint `GET /v1/deeplinks/showcase/{showcaseId}` tidak punya adapter dan tidak dipakai
**Bukti:** ada di spec (`kahade-api-mobile.json`), tak ada di `lib/api/deeplinks.ts` (hanya user/profile/order-link/order) dan tak ada pemanggil.
**Dampak (improvement):** resolusi "buka di app" untuk tautan showcase tempel-di-chat tak terstandar (share memakai `shareUrl` mentah dari payload).
**Saran:** tambahkan adapter + pakai di pipeline deep link masuk bila universal link tidak menangkapnya.

---

# I. Gating tamu, SEO, notifikasi, deep link

### I-01 🟡 Tab `/showcase` terkunci untuk tamu web padahal endpoint feed-nya publik dan detail item justru publik — kebijakan campur & komentar basi
**Bukti:** `"showcase"` ada di `AUTHENTICATED_SCREENS` (`lib/protected-routes.ts:67`) dan tidak di `WEB_GUEST_TAB_SCREENS` (`:97`) → `isProtectedPath("/showcase") === true` (dikunci test `tests/route-protection.test.ts:175-178`); tetapi komentar di file yang sama menyatakan "*Tab "showcase"/"discover" publik*" (`:96-99`); feed API `auth:"none"`; rute `/showcase/[id]` sengaja dibuka untuk "*corong share/SEO*" (`tests/route-protection.test.ts:58`).
**Dampak:** pengunjung web organik tak bisa menjelajah pasar meski backend mengizinkan; hanya satu item dalam isolasi yang dapat dilihat (tanpa konteks belanja lain). Ini mungkin keputusan produk — maka komentar kode dan (kemungkinan) halaman SEO perlu diluruskan.
**Saran:** putuskan satu kebijakan: (a) buka tab untuk tamu (feed sudah aman; sosial digate A-05), atau (b) tetap terkunci → hapus komentar basi + pertimbangkan halaman indeks publik statis untuk SEO. Sementara itu di balik gate, fetch feed tetap ditembak (mount tersembunyi) — sia-sia.

### I-02 🟡 Routing notifikasi tidak mengenal referensi bertipe showcase
**Bukti:** switch `routeForNotificationReference`/`labelForNotificationReference` tanpa kasus "showcase" (`lib/notification-routing.ts:37-92, 95-150`); `routeForPushData` mendelegasikan ke fungsi yang sama (`:152-173`).
**Dampak:** bila backend mengirim notifikasi suka/komentar showcase dengan `referenceType=SHOWCASE`, tap bernavigasi ke `null` (tidak terjadi apa-apa / fallback) **(perlu verifikasi runtime** — spec tidak mendokumentasikan payload notifikasi showcase).
**Saran:** tambahkan kasus → `ROUTES.showcaseDetail(id)` + label "Lihat karya" (dan test `notification-routing` untuk tabel tipe).

### I-03 🟡 Judul dokumen web halaman detail adalah kata generik "Showcase", bukan judul item — corong SEO/share tumpul
**Bukti:** `<DataScreen title="Showcase">` (`:420`, `:447`) → `useDocumentTitle("Showcase")` via Header (`components/ui/header.tsx:122`); tab feed sendiri memakai `useDocumentTitle("Etalase")` (`app/(tabs)/showcase.tsx:24`). Tidak ada meta og:title/og:image per item (generator meta statis).
**Dampak:** tautan item yang dibagikan menampilkan judul generik; brand: "Etalase" (tab) vs "Showcase" (detail) vs "Portofolio" (manajemen & galeri) — tiga nama untuk satu fitur.
**Saran:** saat item termuat: `useDocumentTitle(item.title)`; dan samakan nama UI menjadi "Etalase" di seluruh layar (J-01).

### I-04 🔵 WebShare tak tersedia → hanya toast "Share tidak tersedia…" tanpa fallback salin tautan
**Bukti:** kontrak `shareContent` sendiri menyatakan "*pemulia jatuh ke tombol Salin*" (`lib/share.ts:28-30`), tetapi ketiga pemanggil etalase (feed `:363-380`, detail `:379-397`, profil `profile-etalase-tab.tsx:212-230`) berhenti di toast info.
**Saran:** pada outcome "unavailable" tampilkan sheet kecil dengan `<CopyableField>` berisi `payload.shareUrl` (komponen sudah ada di repo).

### I-05 🔵 Layar galeri publik ikut terproteksi — menutup satu-satunya calon halaman indeks etalase per pengguna
**Bukti:** `"user/[username]/showcase"` di daftar protected (`lib/protected-routes.ts:80`) — konsisten dengan endpointnya (C-04), tetapi patut dicatat saat memutuskan I-01: saat ini **tidak ada satu pun** halaman etalase-per-pengguna yang bisa diindeks/dilihat tamu; satu-satunya publik adalah item tunggal.

---

# J. i18n & konsistensi copy

### J-01 🟡 Tiga nama untuk satu fitur: "Etalase" (navbar, tab, switcher, judul dokumen), "Portofolio" (manajemen & galeri publik), "Showcase" (detail, empty states, docblock) — melanggar keputusan produk yang tertulis
**Bukti:** keputusan seragam dinyatakan eksplisit: '"Etalase" … SATU nama & ikon … *jangan sampai tiga sebutan untuk satu tempat*' (`components/ui/bottom-tab-bar.tsx:138-145`; ditegaskan di `app/(tabs)/showcase.tsx:11-13`). Tetapi: `<Header title="Portofolio">` (`app/showcase-management.tsx:394`, `app/user/[username]/showcase.tsx:45`), "Portofolio Anda" (`:411`), "Tanpa judul → Portofolio" (`:77`), `DataScreen title="Showcase"` (`app/showcase/[id].tsx:420`), "Belum ada showcase" (`showcase-feed-tab.tsx:424`, dsb.), title fallback "Showcase" (`profile-etalase-tab.tsx:94`).
**Saran:** ganti label yang menghadap pengguna menjadi "Etalase" (pertahankan istilah teknis hanya di kode/route); tambahkan hafalan copy ke `scripts/check-i18n` (mis. daftar istilah terlarang untuk UI: "Portofolio", "Showcase" pada string tampilan).

### J-02 🟡 "Harga lewat diskusi" tidak ada di katalog i18n — tampil bahasa Indonesia pada locale Inggris
**Bukti:** literal di `showcase-feed-item.tsx:139` dan `app/showcase/[id].tsx:440`; `grep "Harga lewat diskusi" lib/i18n/catalog.json` kosong (scanner tidak menangkap cabang ternary ini); tidak ada padanan di `lib/i18n/en/*`.
**Saran:** bungkus dengan `translate("Harga lewat diskusi")` eksplisit (dan periksa scanner: ternary di scope modul/render harus selalu lewat `translate` — kemungkinan kelas celah yang sama di tempat lain).

### J-03 🔵 String dinamis "Mulai RpX" / "Hingga RpX" tidak dapat diekstrak penerjemah
**Bukti:** template literal `app/showcase-management.tsx:87-88`.
**Saran:** `translate("Mulai {x}", { x: formatRupiah(…) })` (pola yang sudah dipakai file yang sama di `:418`).

### J-04 🔵 "Tanpa judul" sebenarnya ditulis "Showcase"/"Portofolio" (bahasa Inggris & inkonsisten) sebagai fallback tampilan
**Bukti:** `profile-etalase-tab.tsx:94`, `app/showcase-management.tsx:77`, `app/user/[username]/showcase.tsx:69`.
**Saran:** satu konstanta terjemahkan, mis. `translate("Tanpa judul")`.

### J-05 🔵 Copy moderasi mencampur "karya/item/postingan/showcase" untuk objek yang sama
**Bukti:** "Laporkan Karya" (feed `:508`) vs "Laporkan item" (detail `:806`) vs deskripsi 'postingan "{x}"' (feed `:509`) vs "Item showcase dibuat" (manajemen `:209`).
**Saran:** kamus istilah: **karya** untuk unit etalase di teks pengguna; selaraskan kelima lokasi.

---

# K. Testing

### K-01 🟡 Tidak ada satu pun test untuk logika fitur Etalase
**Bukti:** `grep -rl showcase tests/ e2e/` hanya menemukan test infrastruktur yang menyebut nama rute (`route-protection`, `app-mode`, `mode-switcher`, `query-keys-shared`) — tak ada test untuk `interleave`/`mergeById`/invarian kursor (A-01 yang paling mahal), filter following (A-02/A-03), `priceLabel` tiga layar (D-05/B-01), `toSocialShowcaseItem` (`profile-etalase-tab.tsx:69-114`), validasi form manajemen (D-03), atau cabang unggah UNVERIFIED (D-04).
**Dampak:** fungsi murni paling rapuh di fitur ini (paginasi keyset kustom) bebas regresi.
**Saran (prioritas):** test tabel untuk `interleave`/`mergeById`; test "refresh ⇒ request tanpa cursor" (menangkap A-01); test klasifikasi error `ensureFollowingSet` (A-03); test `priceLabel` min/max/sama/satu-sisi/kosong.

### K-02 🔵 Tidak ada e2e alur Etalase (terbit→feed→detail→suka/komentar)
**Bukti:** `ls e2e/` tak memuat spec etalase; checklist bisa memakai kontrak mock yang sama dengan K-01.

---

## Lampiran — peta cepat perbaikan (urutan disarankan)

1. **Hari 1 (p0):** A-01 (reset kursor), C-03 (onReport tab profil), A-03 (klasifikasi error following).
2. **Minggu 1 (p1):** A-02 (loop following/endpoin), D-01/D-04 (alur unggah--satu kontrak + tanpa auto-terbit), C-01/C-02 (error & race profil), G-01 (hitungan), F-02/F-03 (komentar & abort), J-02 (string), K-01 batch pertama.
3. **Minggu 2-4 (p2):** A-05/A-06/A-07 (aksi sosial satu sumber + guest CTA), A-12 + D-02 (kategori end-to-end), F-01 (orderLink→prefill), D-03 (sortOrder+reorder), B-02 (window pager), I-01/I-02 (kebijakan tamu + notifikasi), J-01/J-05 (kamus istilah "Etalase/karya"), D-06/D-07 (penanda visual + skeleton grid), E-01…E-04 (putuskan nasib galeri publik: tautkan & perbaiki, atau hapus).

## Lampiran — cara mereproduksi temuan kunci tanpa backend

- **A-01:** stub `getShowcaseFeed` yang merekam argumen; panggil `fetchPage("initial")` → `fetchPage("more")` → `fetchPage("refresh")`; assertion: panggilan "refresh" menerima `cursor: undefined`. Hari ini ia menerima `nextCursor` sebelumnya → test merah.
- **C-03:** render `<ProfileEtalaseTab>` dengan satu item; tekan bendera lapor; assertion navigasi menuju `/reports?targetId=<showcaseId>` (bukan sheet `reportShowcase`). Router stub sudah ada di `tests/stubs/expo-router.tsx`.
- **D-05/B-01:** test tabel `priceLabel`: `{min:null,max:500000} → "Harga lewat diskusi"` (bug: seharusnya *"Hingga Rp500.000"*); `{min:5000,max:5000}` pada manajemen → `"Rp5.000 – Rp5.000"`.
- **G-01:** buka sheet item X, kirim komentar (mock 201), tutup, buka lagi dengan cache `total` yang sudah memuat komentar itu → header menampilkan total+1 berlebih.
