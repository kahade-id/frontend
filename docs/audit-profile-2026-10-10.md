# Audit Profil — 10 Oktober 2026

Cakupan: profil sendiri, profil orang lain, profil bisnis, follow/unfollow, blokir,
edit profil, QR, pengaturan privasi. Backend: users, badges, ratings. Admin: kelola user.
Branch `claude-profile-uiux` di tiga repo (frontend, backend, admin).

Status: ✅ selesai · ⏳ dikerjakan · ⛔ ditunda (alasan)

## Batch 1 — tautan profil tidak muncul (commit 72f89e5)

| # | Status | Temuan | Lokasi |
|---|---|---|---|
| 1 | ✅ | Backend mengirim `links` di GET /v1/users/{username} tapi frontend tidak membaca & merender | lib/api/users.ts, user-profile-screen.tsx |
| 2 | ✅ | Editor tautan menerima `http://` & nomor telepon → PUT ditolak 400 | social-links-editor.tsx, lib/profile-links.ts |
| 3 | ✅ | Bio maks 500 di klien, kontrak backend 160 → 400 saat simpan | edit-profile.tsx, profile-edit-sheet.tsx |
| 4 | ✅ | Toggle "Selengkapnya" bio tak pernah muncul (ambang = batas bio) | profile-bio |
| 5 | ✅ | Label platform generik ("Toko online"/"Situs web") tidak lewat i18n | social-platforms.ts |

## Batch 2 — follow, statistik, privasi (frontend + backend)

| # | Status | Temuan | Lokasi |
|---|---|---|---|
| 6 | ✅ | Tombol Ikuti di-rollback saat 409 ALREADY_FOLLOWING / 400 NOT_FOLLOWING (state server sudah sesuai) | user-profile-screen.tsx handleFollow |
| 7 | ✅ | Ganti chip filter ulasan memicu muat ulang SELURUH profil (7+ request, tombol Ikuti berkedip) | user-profile-screen.tsx fetchRatings |
| 8 | ✅ | Rekonsiliasi `getFollowers/getFollowing ?limit=1` menimpa counter "Privat" (null) jadi "0" + 2 request sia-sia | user-profile-screen.tsx fetchProfile |
| 9 | ✅ | Profil sendiri tidak menampilkan statistik pengikut/mengikuti/ulasan; tidak ada Bagikan & QR | user-profile-screen.tsx baris aksi |
| 10 | ✅ | 403 USER_BLOCKED tampil sebagai error generik | user-profile-screen.tsx fetchProfile |
| 11 | ✅ | getUserByUsername `auth: "required"` → tamu dilempar expireSession padahal endpoint `@Public()` | lib/api/users.ts |
| 12 | ✅ | Tab "Mengikuti" disaring di klien (hanya halaman termuat) — backend kini `?search=` | followers/[username].tsx, BE users.controller.ts |
| 13 | ✅ | `useCallback(..., [, query])` — handler berganti tiap render, memo baris jebol | followers/[username].tsx, blocked-users.tsx |
| 14 | ✅ | String hardcode tanpa translate() (privacy-settings toast, dialog buka blokir, header Profil, "Pengguna") | privacy-settings.tsx, blocked-users.tsx, profile/[id].tsx |
| 15 | ✅ | BE: pemilik dapat 404 profilnya sendiri saat `profileVisible=false` (profil, badges) | BE users.service.ts getPublicProfile, verification-badge.service.ts |
| 16 | ✅ | BE: kontak publik justru disembunyikan dari viewer LOGIN, tampil ke anonim | BE users.service.ts |
| 17 | ✅ | BE: `hiddenStats` hanya menihilkan `stats.*`, salinan di `ratings.*`/`about.memberSince` bocor; showReviews=false masih bocor via `stats` | BE privacy-profile.util.ts |
| 18 | ✅ | BE: GET /users/:username/ratings mengabaikan showReviews pemilik | BE users.service.ts getUserRatings |
| 19 | ✅ | BE: follow akun banned/nonaktif/terhapus/privat lolos | BE users.service.ts followUser |
| 20 | ✅ | BE: updateLinks transaksi Serializable tanpa retry → P2034 500 saat tap ganda | BE users.service.ts |
| 21 | ✅ | BE: OG metadata masih menyajikan akun banned/nonaktif/terhapus | BE og-metadata.service.ts |
| 22 | ✅ | BE: `isFollowedBy` bocor walau daftar mengikuti disembunyikan | BE privacy-profile.util.ts |
| 23 | ✅ | BE: favoritesTotal & privacy dimuat berurutan setelah Promise.all (2 round-trip ekstra) | BE users.service.ts |
| 24 | ✅ | BE: `loadPrivacySetting` `.catch` tidak menangkap TypeError sinkron (client tanpa model) → 500 | BE privacy-profile.util.ts |

## Batch 3 — layar profil (frontend)

| # | Status | Sev | Temuan | Lokasi |
|---|---|---|---|---|
| P-01 | ✅ | kritis | Item rating publik dibaca `authorUsername/authorAvatarUrl`, backend kirim `giver.{username,avatarUrl}` → semua ulasan "Pengguna" tanpa avatar | lib/api/ratings.ts, profile-ratings-tab.tsx, user/[username]/ratings.tsx |
| P-02 | ✅ | kritis | `firstRatingReply` memperlakukan `reply` (objek `{content,createdAt,replier}`) sebagai string → objek jadi child Text → crash tab Ulasan | lib/api/ratings.ts |
| P-03 | ✅ | kritis | Tamu: `getMeCached` (auth required) paralel dengan GET profil → refresh 401 → expireSession → revision naik → GET profil ABORTED → "Gagal memuat profil" | user-profile-screen.tsx fetchProfile; checkSavedProfile; getStoryHighlights |
| P-04 | ✅ | sedang | `getQuestionComments` auth required padahal endpoint `@Public()` | lib/api/users.ts |
| P-05 | ✅ | sedang | `getVerificationBadges` auth none → pemilik profil privat kehilangan lencana; redundan (payload profil sudah memuat `badges`) | lib/api/users.ts, user-profile-screen.tsx |
| P-06 | ✅ | sedang | Pull-to-refresh `silent` tidak diteruskan ke tab → skeleton tab tiap refresh | user-profile-screen.tsx |
| P-07 | ✅ | sedang | Request pertanyaan tanpa guard respons basi → pertanyaan profil A tampil di profil B | user-profile-screen.tsx fetchTabContents |
| P-08 | ✅ | sedang | Reset per-profil tidak `setProfile(null)` → profil lama tampil di bawah header username baru | user-profile-screen.tsx |
| P-09 | ✅ | sedang | Effect filter ulasan menembak untuk profil LAMA saat pindah profil | user-profile-screen.tsx |
| P-10 | ✅ | sedang | Offline: `followUser` enqueue → promise menggantung → spinner & kunci follow tak lepas sampai online | user-profile-screen.tsx handleFollow |
| P-11 | ✅ | sedang | `hidden: true` dari backend (ulasan disembunyikan pemilik) tidak dibaca → "Belum ada ulasan" + distribusi 0 palsu | profile-ratings-tab.tsx, rating-distribution.tsx, lib/api/ratings.ts |
| P-12 | ✅ | sedang | Bar distribusi rating ber-role button tapi tanpa handler → tombol mati di screen reader | profile-ratings-tab.tsx, rating-distribution.tsx |
| P-13 | ✅ | sedang | Simpan profil tidak optimistis (setSaved setelah await) | user-profile-screen.tsx |
| P-14 | ✅ | sedang | `submitComment` tab Utas tanpa `requireSession()` → tamu dapat toast gagal, bukan gerbang login | user-profile-screen.tsx |
| P-15 | ✅ | ringan | `offlineLabel` follow/unfollow + judul toast offline hardcode | lib/api/users.ts, app/_layout.tsx |
| P-16 | ✅ | ringan | a11y "diblokir" hardcode | user-list-item.tsx |
| P-17 | ✅ | ringan | fallback "Pengguna" hardcode | user/[username]/questions.tsx |
| P-18 | ✅ | ringan | `ProfileHeader` dead code 317 baris + 2 string hardcode | components/ui/profile-header.tsx |
| P-19 | ✅ | ringan | Kunci EN hilang: "Profil ini tidak tersedia.", "Lihat ulasan", "Lencana Verifikasi" | lib/i18n/en/profile.json |
| P-20 | ✅ | ringan | `showContactEmail/Phone` dibaca dari root, backend menaruh di `contact.*` | lib/api/users.ts |
| P-21 | ✅ | ringan | "Coba lagi" per tab memuat ulang KETIGA tab | user-profile-screen.tsx retryTabContents |
| P-22 | ✅ | ringan | `getFollowers` selalu kirim `search=""` | lib/api/users.ts |
| P-23 | ✅ | ringan | Docblock & komentar tab usang/rusak | user-profile-screen.tsx |

## Batch 4 — edit profil & pengaturan (frontend)

| # | Status | Sev | Temuan | Lokasi |
|---|---|---|---|---|
| E-01 | ⏳ | kritis | Akun tanpa kata sandi tidak bisa hapus akun: tombol butuh password, jalur OTP WhatsApp (`sendDeletionOtp`, `otpCode`) tidak pernah dipakai | delete-account.tsx, delete-account-form.tsx |
| E-02 | ⏳ | kritis | Layar hasil hapus akun (kode referensi) tak pernah tampil: `clearSession()` meng-unmount stack terproteksi | delete-account.tsx |
| E-03 | ⏳ | kritis | Mengosongkan email kontak kirim `""` → `@IsEmail` 422; error tampil di field kata sandi | edit-profile.tsx |
| E-04 | ⏳ | sedang | Format ekspor data dikirim di body, backend baca query → selalu JSON | lib/api/settings.ts |
| E-05 | ⏳ | sedang | Cek username tiap 450 ms vs throttle 5/menit → 429 → "idle" → simpan ditolak "tidak tersedia" | edit-profile.tsx, profile-edit-sheet.tsx |
| E-06 | ⏳ | sedang | Regex username klien tak selaras service backend (awalan/akhiran `._`, `..`) | username-field.tsx, edit-profile.tsx |
| E-07 | ⏳ | sedang | PUT links gagal → `refresh()` membuang edit tautan; dialog kata sandi tetap terbuka | edit-profile.tsx |
| E-08 | ⏳ | sedang | Akun tanpa password ganti username → INVALID_CREDENTIALS tampil "Kata sandi salah" (jalan buntu) | edit-profile.tsx, profile-edit-sheet.tsx, BE users.service.ts |
| E-09 | ⏳ | sedang | Daftar diblokir hanya 20 pertama (backend berpaginasi, FE tanpa page/limit) | blocked-users.tsx, lib/api/settings.ts |
| E-10 | ⏳ | sedang | Empty state pencarian pengikut sendiri → "Belum ada pengikut" + Bagikan | followers/[username].tsx |
| E-11 | ⏳ | sedang | Hapus akun: semua galat non-blocker → satu pesan generik | delete-account.tsx |
| E-12 | ⏳ | sedang | Field 2FA dipaksa 6 digit; backend terima backup code 10–16 alfanumerik | delete-account-form.tsx |
| E-13 | ⏳ | sedang | Guard ukuran avatar/header dijalankan SEBELUM resize → foto kamera ditolak | lib/use-avatar-upload.ts, edit-profile.tsx |
| E-14 | ⏳ | sedang | privacy-settings: mayoritas teks hardcode | privacy-settings.tsx |
| E-15 | ⏳ | sedang | business-verification, delete-account, delete-account-form hampir seluruhnya hardcode | tiga file |
| E-16 | ⏳ | sedang | Editor tautan izinkan platform duplikat → backend 409 tanpa baris ditandai | social-links-editor.tsx, lib/profile-links.ts |
| E-17 | ⏳ | sedang | Validasi klien tak lengkap (`<>` di nama/bio, email kontak) → 422 generik / salah field | edit-profile.tsx, profile-edit-sheet.tsx |
| E-18 | ⏳ | sedang | Pull-to-refresh edit profil menghidrasi ulang form saat dirty | edit-profile.tsx |
| E-19 | ⏳ | ringan | Toggle privasi grup: semua switch pending/rollback bersama | privacy-settings.tsx |
| E-20 | ⏳ | ringan | `api.users.requestAccountDeletion` dead code, tipe password wajib | lib/api/users.ts, types.ts |
| E-21 | ⏳ | ringan | `UpdateProfileDto` FE: bio 500, `accountType` tak ada di DTO backend; komentar phoneNumber salah | lib/api/users.ts, edit-profile.tsx |
| E-22 | ⏳ | ringan | Tipe `showcaseDefaultVisibility` masih berisi `FOLLOWERS` | lib/api/settings.ts, types.ts |
| E-23 | ⏳ | ringan | Kunci EN bio `<>` hilang | lib/i18n/en |
| E-24 | ⏳ | ringan | `signal` tidak diteruskan ke listMyBadges/listAllBadges | badges.tsx |
| E-25 | ⏳ | ringan | a11y "Jenis ulasan" hardcode | ratings.tsx |
| E-26 | ⏳ | ringan | `linksChanged` via JSON.stringify (label null vs "") → dirty palsu | edit-profile.tsx |
| E-27 | ⏳ | ringan | key baris tautan ikut platform → remount saat ganti chip | social-links-editor.tsx |
| E-28 | ⏳ | ringan | `canOpenURL` false tanpa umpan balik | privacy-settings.tsx |
| E-29 | ⏳ | ringan | Redirect login membuang param `tab` | followers/[username].tsx |
| E-30 | ⏳ | ringan | Submit verifikasi bisnis gagal → unggah ulang semua dokumen | business-verification.tsx |
| E-31 | ⏳ | ringan | Komentar REVOKED salah | business-verification.tsx |
| E-32 | ⏳ | ringan | Komentar header endpoint usang | blocked-users.tsx |
| E-33 | ⏳ | gap | Hapus pengikut (DELETE /users/:username/followers) ada di backend, tak ada adapter/aksi FE | lib/api/users.ts, followers/[username].tsx |

## Batch 5 — backend users / badges / ratings / admin-users

| # | Status | Sev | Temuan | Lokasi |
|---|---|---|---|---|
| B-01 | ⏳ | sedang | `/users/discover` bocorkan avgRating/ratingCount/orders/memberSince tanpa privasi; followersCount `_count` mentah | user-search.service.ts |
| B-02 | ⏳ | sedang | OG publik menyusun deskripsi rating/orders tanpa privasi; `searchEngineIndex=false` diabaikan | og-metadata.service.ts |
| B-03 | ⏳ | sedang | `getUserRatings` abaikan `hiddenStats` avgRating/ratingCount | users.service.ts |
| B-04 | ⏳ | sedang | `redisAvailable = true` sebelum `setNx` → Redis down = semua laporan ditolak | users.service.ts reportUser, settings.service.ts |
| B-05 | ⏳ | sedang | `evidenceUrls` DTO paksa cdn.kahade.id vs service hanya percaya storagePublicUrl → bukti selalu 400 | dto/report-user.dto.ts |
| B-06 | ⏳ | sedang | `users.blockUser` tidak hapus `userSavedProfile` dua arah & tanpa audit | users.service.ts |
| B-07 | ⏳ | sedang | `getFavorites`/`getSavedProfiles` tanpa filter `profileVisible` | users.service.ts |
| B-08 | ⏳ | sedang | `updateProfile` tanpa audit log (username/kontak/visibilitas) | users.service.ts |
| B-09 | ⏳ | sedang | privacy `profileVisible=false` & admin ban tidak invalidasi cache OG | settings.service.ts, admin-users.service.ts |
| B-10 | ⏳ | sedang | `settings.blockUser` Serializable tanpa retry | settings.service.ts |
| B-11 | ⏳ | ringan | `unblockUser` read-then-delete → P2025 500 saat tap ganda | users.service.ts |
| B-12 | ⏳ | ringan | admin `getUserDetail`: contactEmail/contactPhone tak di-mask | admin-users.service.ts |
| B-13 | ⏳ | ringan | admin `listUsers` orderBy tanpa tiebreak id | admin-users.service.ts |
| B-14 | ⏳ | ringan | favorites/saved: tanpa tiebreak, kirim id internal | users.service.ts |
| B-15 | ⏳ | ringan | `listBlockedUsers` (deprecated) sama | settings.service.ts |
| B-16 | ⏳ | ringan | `dateOfBirth` tanpa rentang; tanggal tak valid digulung | update-profile.dto.ts, users.service.ts |
| B-17 | ⏳ | ringan | `fullName` tidak di-trim | update-profile.dto.ts |
| B-18 | ⏳ | ringan | `contactPhone` teks bebas | update-profile.dto.ts |
| B-19 | ⏳ | ringan | Tiga regex username berbeda (DTO/service/pipe) | update-profile.dto.ts, users.service.ts, parse-username.pipe.ts |
| B-20 | ⏳ | ringan | `platform` links tanpa whitelist; label tanpa filter `<>` | update-links.dto.ts |
| B-21 | ⏳ | ringan | `hiddenStats` terima string apa pun | update-privacy.dto.ts |
| B-22 | ⏳ | ringan | `updateProfile` 3× findUnique berurutan | users.service.ts |
| B-23 | ⏳ | ringan | followers/following: 4 round-trip berurutan yang saling bebas | users.service.ts |
| B-24 | ⏳ | ringan | `getUserRatings` groupBy setelah Promise.all | users.service.ts |
| B-25 | ⏳ | ringan | `PUT /users/me/links` tanpa @Throttle khusus | users.controller.ts |
| B-26 | ⏳ | ringan | removeFavorite/removeSavedProfile lookup OR id internal | users.service.ts |

## Batch 6 — admin kelola user

| # | Status | Sev | Temuan | Lokasi |
|---|---|---|---|---|
| A-01 | ⏳ | kritis | Ekspor CSV POST tanpa `Idempotency-Key` → selalu 400 | admin src/lib/api/admin/users.ts |
| A-02 | ⏳ | kritis | Dialog klaim "(termasking)" tapi SUPER_ADMIN tak pernah di-mask → CSV PII mentah | export-users-dialog.tsx, BE admin-users.service.ts |
| A-03 | ⏳ | sedang | CSV formula injection (=,+,-,@) | BE admin-users.service.ts, export-users-dialog.tsx |
| A-04 | ⏳ | sedang | Tombol Ekspor tampil untuk CS padahal SUPER_ADMIN-only | users/page.tsx |
| A-05 | ⏳ | sedang | Copy "dibatasi filter aktif" salah: accountType tak diteruskan | export-users-dialog.tsx, DTO |
| A-06 | ⏳ | sedang | IP sesi/audit tampil mentah untuk non-SUPER_ADMIN | [id]/page.tsx, BE getUserSessions |
| A-07 | ⏳ | sedang | Deteksi self-review bandingkan email yang sudah di-mask | moderation-tab.tsx |
| A-08 | ⏳ | sedang | requestUsersExport/download fetch polos tanpa refresh-on-401 | users.ts |
| A-09 | ⏳ | sedang | Wallet 404 → teks merah "User wallet not found" bukan "Wallet belum dibuat" | [id]/page.tsx |
| A-10 | ⏳ | ringan | Progress ekspor baca `progress`, backend kirim processed/rowCount | export-users-dialog.tsx |
| A-11 | ⏳ | ringan | BOM ganda di CSV | export-users-dialog.tsx |
| A-12 | ⏳ | ringan | maxLength alasan tak sinkron DTO (500) | [id]/page.tsx, deletion-tab.tsx, export dialog |
| A-13 | ⏳ | ringan | Error durasi suspend tampil di field alasan | [id]/page.tsx |
| A-14 | ⏳ | ringan | Filter tanggal audit zona browser vs tampilan WIB | [id]/page.tsx |
| A-15 | ⏳ | ringan | `LoadMoreButton` didefinisikan dalam body komponen | [id]/page.tsx |
| A-16 | ⏳ | ringan | Tabs tanpa aria-controls/tabpanel/panah | [id]/page.tsx |
| A-17 | ⏳ | ringan | `<dt>/<dd>` tanpa `<dl>` | admin-ui.tsx, card.tsx |
| A-18 | ⏳ | ringan | Dua dialog modal bertumpuk, Escape menutup keduanya | [id]/page.tsx, dialog.tsx |
| A-19 | ⏳ | ringan | Kode error domain user tak dipetakan ke Indonesia | error-catalog.ts |
| A-20 | ⏳ | ringan | Mask ganda nomor HP untuk CS | [id]/page.tsx, lib/pii.ts |
| A-21 | ⏳ | ringan | Back/forward `?q=` tidak menyinkronkan input | users/page.tsx |
| A-22 | ⏳ | ringan | `exportUsersCsv` dead code & rusak (tanpa reason) | users.ts |
| A-23 | ⏳ | ringan | Tes kontrak minim (list, ban header, export header) | tests/unit/api-users-domain4.test.ts |
| A-24 | ⏳ | ringan | Tipe `email: string` padahal nullable | users.ts |
| A-25 | ⏳ | ringan | Label "Saldo escrow" (kosakata terlarang) | [id]/page.tsx |
