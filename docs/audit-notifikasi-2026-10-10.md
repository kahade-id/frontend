# Audit Notifikasi end-to-end — 10 Oktober 2026

Cakupan: notification center (list, filter, baca/hapus, deep link), modul
`notifications` backend (tipe, payload, delivery, preferensi), badge unread,
grouping, dan broadcast admin. Tiga repo, branch `claude-notifikasi`.

Status tiap temuan diperbarui saat fix di-commit. Nomor baris = keadaan
SEBELUM fix.

## Backend (`backend-wt-notifikasi`)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| BE-01 | Copy terlarang "ditahan di escrow" (ORDER_PAYMENT_RECEIVED id/en) | `notification-copy.service.ts:96,100` | fix |
| BE-02 | Copy terlarang judul/isi ESCROW_HELD_NO_BANK ("Dana escrow", "ditahan di escrow") | `notification-copy.service.ts:381-386` | fix |
| BE-03 | Copy terlarang "escrow transactions" di notifikasi KYC disetujui (dua tempat) | `admin/kyc/admin-kyc.service.ts:370,383` | fix |
| BE-04 | Copy terlarang "Escrow Released" / "Escrow funds … released" + pesan respons | `orders/delivery-proof.service.ts:456-457,464` | fix |
| BE-05 | `SAFE_PUSH_DATA_KEYS` membuang kunci yang dibaca FE (`refType`, `refId`, `shipmentId`, `returnDbId`, `returnId`, `commentId`, `showcaseId`, `conversationId`, `messageId`, `storyId`, `reportId`, `appealId`, `courierStatus`) → deep link push jatuh ke tab Notifikasi | `push/push.service.ts:14-21` | fix |
| BE-06 | Peta preferensi in-app tidak memuat MILESTONE_* (order), ESCROW_HELD_NO_BANK (wallet), QUESTION_UNANSWERED_REMINDER (marketing) → toggle tidak menekan tipe itu, beda dengan push | `notifications.service.ts:15-25` | fix |
| BE-07 | `NotificationsService.shouldSendPush` daftar basi (tanpa DISPUTE_MESSAGE/SLA, WALLET_REFUND, MILESTONE, KYC, SYSTEM) dan tidak dipakai → dua sumber kebenaran vs `push.service` | `notifications.service.ts:392-417` | fix (satu peta bersama) |
| BE-08 | Kanal Android: MILESTONE_* dan SUPPORT_AGENT_REPLY jatuh ke `default` (bukan `orders`/`chat`) | `push/push.service.ts:178-185` | fix |
| BE-09 | `deriveActionUrl` ganda & tidak konsisten: processor punya `orderLinkToken → /link/<t>` (FE tidak kenal `/link`), tanpa `milestoneId`; push.service tanpa `orderLinkToken` | `queue/processors/notification.processor.ts:121-129`, `push/push.service.ts:122-134` | fix (helper bersama, path `/order-link/<t>`) |
| BE-10 | Fallback resolusi `notifId` untuk event `notification.new` tanpa `deletedAt: null` & tanpa jendela waktu → bisa menunjuk notifikasi lama/terhapus | `realtime/realtime.gateway.ts:164-168` | fix |
| BE-11 | Broadcast: `escapeHtml` pada judul/isi → entitas HTML (`&#39;`, `&amp;`) tampil mentah di aplikasi | `admin/system/admin-system.service.ts:620-621` | fix |
| BE-12 | Broadcast in-app saja: `createMany` tanpa event realtime → inbox/badge tidak bergerak sampai poll; tanpa `actionUrl` | `admin-system.service.ts:640-657` | fix |
| BE-13 | Broadcast kedua kanal: baris notification tercatat `channel=PUSH_NOTIFICATION` padahal in-app diminta | `admin-system.service.ts:629` | fix |
| BE-14 | Broadcast: `queuedCount` < `recipientCount` (enqueue gagal) tidak sampai ke admin (tipe controller hanya `recipientCount`) dan tidak masuk audit log | `admin-system.controller.ts:150`, `admin-system.service.ts:669-677` | fix |
| BE-15 | `ListNotificationsDto.isRead` menerima string apa pun; selain `true`/`false` diabaikan diam-diam | `dto/list-notifications.dto.ts:9` | fix |
| BE-16 | `markAsRead` menimpa `readAt` setiap dipanggil ulang (FE memanggil dua kali: list + detail) | `notifications.service.ts:261-265` | fix |
| BE-17 | `registerDevice` upsert menimpa `deviceName`/`deviceType`/`ipAddress`/`lastLoginAt` baris fingerprint login (FE memakai deviceId yang sama untuk login & push) → data perangkat di ekspor/keamanan rusak | `notifications.service.ts:484-490` | fix |
| BE-18 | `quietHoursTimezone` tidak divalidasi (helper `normalizeTimezone` ada tapi tidak dipakai) → zona salah tersimpan, perhitungan diam-diam jatuh ke Jakarta | `dto/update-preferences.dto.ts:111-114` | fix |
| BE-19 | `PUT /preferences` tidak mengembalikan `quietHoursActive` padahal `GET` iya | `notifications.service.ts:343-355` | fix |
| BE-20 | ESCROW_HELD_NO_BANK dikategorikan INFORMASI padahal menyangkut dana (WALLET_* = TRANSAKSI) | `notification-category.map.ts` | fix |
| BE-21 | `enrichPushData` mencocokkan `OR {title,body} / {type}` → notifId salah bila dua notifikasi bertipe sama dalam 60 dtk | `push/push.service.ts:80-89` | fix |
| BE-22 | Audiens broadcast `active` = login 30 hari, tidak terdokumentasi di DTO/Swagger | `dto/broadcast.dto.ts:30-33` | fix |
| BE-23 | Tidak ada event `notification.unread_count` setelah read/read-all/batch/delete → badge perangkat lain basi sampai poll 60 dtk | `notifications.service.ts` (semua mutasi) | fix |
| BE-24 | SUPPORT_AGENT_REPLY: push data `type: SUPPORT_CHAT_REPLY` tanpa `actionUrl`, `conversationId` dibuang sanitizer → tap push mendarat di detail notifikasi | `support/support-chat.service.ts:669-680` | fix |
| BE-25 | `isDuplicate`/`isDuplicateByRef` tidak punya pemanggil (kode mati) | `notifications.service.ts:108-136` | catatan |
| BE-26 | Broadcast berjalan sinkron di request HTTP (jeda 2 dtk/batch 10k) → basis pengguna besar = timeout klien; `broadcast_progress` ditulis tapi tak ada endpoint baca | `admin-system.service.ts:592-663` | catatan (perlu desain job) |

## Frontend (`frontend-wt-notifikasi`)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| FE-01 | Event WS `notification.unread_count` tidak diterapkan ke store badge; `notification.new` hanya invalidasi list; listener hanya hidup saat tab Notifikasi terbuka | `lib/realtime/use-notifications-realtime.ts:18-39`, `components/realtime-global-listeners.tsx` | fix |
| FE-02 | `hasUnread` dari halaman termuat saja → tombol "Tandai semua dibaca" & funnel nonaktif walau ada unread di kategori/halaman lain | `components/screens/notifications-tab-screen.tsx:408,711,722` | fix |
| FE-03 | `handleReadSelected` memanggil `refreshUnreadCount()` SEBELUM POST → badge balik ke angka lama | `notifications-tab-screen.tsx:567` | fix |
| FE-04 | `securityEmail` tidak dikunci padahal backend memaksa `true` → toast "tersimpan", nilai balik saat reload | `app/notification-preferences.tsx:270` | fix |
| FE-05 | Default quiet hours end `06:00` (dua tempat) vs backend `07:00` | `app/notification-preferences.tsx:282`, `lib/notification-effective.ts:61` | fix |
| FE-06 | Badge "Aktif sekarang" dihitung di zona perangkat; `quietHoursActive` server (zona preferensi) diabaikan | `app/notification-preferences.tsx:385` | fix |
| FE-07 | `notificationTypeUiCategory` tidak kenal MILESTONE_, SUPPORT_AGENT_REPLY, ESCROW_HELD_NO_BANK, SYSTEM_, MODERATION_, DATA_EXPORT_READY, QUESTION_, DIGEST_SUMMARY; BADGE_/RANK_ → "system" padahal kategori backend PROMOSI | `lib/notification-category.ts:39-58` | fix |
| FE-08 | refType `SUPPORT_CONVERSATION` → null; actionUrl `/support/chat/<id>` → detail TIKET (`/support/<id>`) — balasan agen support nyasar | `lib/notification-routing.ts:129-135,718-723` | fix |
| FE-09 | actionUrl `/order-link/<token>` & `/link/<token>` tidak dikenali → null | `lib/notification-routing.ts:704-764` | fix |
| FE-10 | actionUrl `/o/<id>` dipetakan ke detail ORDER padahal `/o/<token>` = tautan order pendek (`app/o/[token].tsx`) | `lib/notification-routing.ts:713-715,557` | fix |
| FE-11 | Detail notifikasi 404 (kedaluwarsa/dihapus) tampil "Gagal memuat notifikasi" + Coba lagi, padahal `useApiQuery` sudah punya `errorStatus` | `app/notification/[id].tsx:260-261` | fix |
| FE-12 | `imageUrl` (rich notification, kontrak backend item 114) tidak ada di tipe & tidak dirender | `lib/api/notifications.ts:47-64`, `app/notification/[id].tsx` | fix |
| FE-13 | Tipe `NotificationPreferences` tidak memuat `marketingPush`/`marketingInApp`/`quietHoursActive` yang dipakai matriks/server | `lib/api/notifications.ts:214-247` | fix |
| FE-14 | Detail: tandai dibaca/hapus tidak menginvalidasi cache daftar → kembali ke tab masih tampil item (refresh fokus dilewati bila <30 dtk) | `app/notification/[id].tsx:98-107,205-209` | fix |
| FE-15 | Tap push menandai dibaca tapi tidak menginvalidasi daftar | `app/_layout.tsx:1072-1078` | fix |
| FE-16 | `handleDeleteSelected`/`handleDeleteRead` tanpa dep `toast.show` (closure basi) | `notifications-tab-screen.tsx:610,629` | fix |
| FE-17 | `routeForPushData`: alias `SUPPORT_CHAT_REPLY` & kunci `conversationId` tidak dikenal → tab Notifikasi | `lib/notification-routing.ts:623-647` | fix |
| FE-18 | `labelForActionUrl` untuk `/support/chat/*` → "Lihat tiket bantuan" (salah) | `lib/notification-routing.ts:554-555` | fix |
| FE-19 | Dialog "Hapus yang sudah dibaca" tidak menyebut bahwa semua kategori ikut terhapus (backend `delete-read` lintas kategori) | `notifications-tab-screen.tsx:871` | fix |
| FE-20 | Caption status efektif ("Efektif: …", "Tidak ada kanal aktif", "Push tertahan …") & ringkasan ("Senyap …", "N dari 7 jenis aktif") string dinamis tanpa `translate` → pengguna EN melihat Indonesia | `lib/notification-effective.ts:62,78,122-128` | fix |
| FE-21 | Katalog i18n usang (5850 vs 5849) — `check:i18n` gagal; kunci baru FE-20 belum punya EN | `lib/i18n/catalog.json`, `lib/i18n/en/` | fix (regenerate + `en/notifications.json`) |
| FE-22 | `useNotificationsRealtime` dipasang per layar; setelah listener global ada, pemasangan di layar jadi ganda | `notifications-tab-screen.tsx:318` | fix |
| FE-23 | `AppNotification` tidak membawa `readAt` (ada di PublicNotification) | `lib/api/notifications.ts:47` | fix |
| FE-24 | Tipe ESCROW_HELD_NO_BANK: ikon "system" (Bell) padahal soal dana | `lib/notification-category.ts` | fix (bagian FE-07) |
| FE-25 | Daftar tidak memakai `checkNotificationTarget` (hanya detail) — tap item ke entitas yang sudah dihapus mendarat di layar kosong; by design (navigasi segera) | `notifications-tab-screen.tsx:517` | catatan |
| FE-26 | Agregasi sosial (`SHOWCASE_LIKE`/`USER_FOLLOW`) dormant: backend belum punya tipe itu | `lib/notification-social-grouping.ts` | catatan |
| FE-27 | Local prefs: SUPPORT_AGENT_REPLY → null (fail-open, selalu tampil) — konsisten dengan keputusan produk | `lib/notification-local-prefs.ts` | catatan |
| FE-28 | `labelForActionUrl` tidak punya cabang `support` sama sekali → CTA detail tersembunyi untuk actionUrl `/support/<id>` walau rutenya ada | `lib/notification-routing.ts:549-556` | fix (bersama FE-18) |
| FE-29 | 20+ label CTA detail (`labelForNotificationReference`/`labelForActionUrl`: "Lihat mutasi", "Lihat tiket bantuan", "Buka verifikasi", …) berupa `return "…"` polos → tidak dipungut pemindai katalog, tidak ada EN, pengguna EN selalu melihat Indonesia | `lib/notification-routing.ts:456-618` | fix (`translate()` + `en/notifications.json`) |
| FE-30 | Tap item inbox yang rutenya = tab inbox itu sendiri (broadcast `actionUrl: /notifications`, `/badges`) → `router.push` ke tab yang sedang terbuka = no-op; isi broadcast tidak pernah terbaca | `notifications-tab-screen.tsx:522` | fix (`isNotificationInboxRoute` → detail) |
| FE-31 | `usePaginatedQuery` tidak berlangganan invalidasi cache → event WS `notification.new`/`unread_count`, push foreground, dan mutasi di detail hanya mengosongkan cache; inbox terbuka tetap basi; refresh fokus dilewati bila <30 dtk sehingga FE-14/FE-15 tidak efektif | `notifications-tab-screen.tsx:346-369`, `lib/use-paginated-query.ts` | fix (listener `onQueryCacheInvalidation` + refresh tertunda saat fokus) |
| FE-32 | read-all / delete-read (lintas kategori) dan read/delete batch tidak membatalkan cache tab kategori lain & varian Semua↔Belum dibaca → pindah tab menampilkan dot/ item yang sudah tidak ada | `notifications-tab-screen.tsx:603-672` | fix |
| FE-33 | Listener push foreground: tidak ada jenis yang membatalkan cache `notifications:`; chat/showcase tidak menyegarkan badge → inbox & badge basi saat WS mati (push = cadangan) | `lib/push-notifications.ts:296-335` | fix |
| FE-34 | Tap push WEB tidak menandai notifikasi dibaca (jalur native iya) → item tetap "belum dibaca" | `app/_layout.tsx:966-976` | fix (helper `markPushNotificationRead` bersama) |
| FE-35 | Copy quiet hours "tanpa bunyi"/"tidak dibunyikan" — backend TIDAK mengirim push sama sekali (hanya SECURITY_* lolos; `push.service.shouldSendPush`) | `app/notification-preferences.tsx:410,419` | fix (copy + EN) |
| FE-36 | Efek `syncQuietHoursTimezone` ber-dep `query.data` dan zona yang sukses dikirim tidak ditulis balik → setiap toggle memicu PUT timezone yang sama lagi sampai reload | `app/notification-preferences.tsx:126-131`, `lib/api/notifications.ts:297` | fix |
| FE-37 | Routing: enum penuh tanpa actionUrl (ORDER_PAYMENT_RECEIVED, WALLET_TOPUP_SUCCESS, SECURITY_NEW_LOGIN, KYC_REJECTED, SUBSCRIPTION_*, ESCROW_HELD_NO_BANK, …) jatuh ke `default: null` → tab Notifikasi; tabel hanya kenal kata dasar | `lib/notification-routing.ts:92-236` | fix (`routeForTypeFamily` setelah switch) |
| FE-38 | Local prefs: ESCROW_HELD_NO_BANK, BADGE_*, RANK_* → null (tidak bisa di-toggle) padahal kategorinya dana/promo (selaras FE-07) | `lib/notification-local-prefs.ts:147-164` | fix |
| FE-39 | Label a11y baris ("Belum dibaca", "dipilih") digabung lalu diterjemahkan sebagai satu string → tidak pernah cocok; "dipilih" huruf kecil bahkan tak masuk katalog | `components/ui/notification-list-item.tsx:529-535` | fix (translate per bagian) |
| FE-40 | Toast target hilang: label entitas ("Sengketa"/"Karya") disisipkan mentah ke kalimat; "Karya" tanpa EN | `app/notification/[id].tsx:125-129` | fix |
| FE-41 | Menu ⋮ hilang saat daftar kosong → jalan pintas "Pengaturan notifikasi" tak terjangkau dari tab | `notifications-tab-screen.tsx:734-741` | fix |
| FE-42 | `hasRead` (penyaring "Hapus yang sudah dibaca") hanya dari halaman termuat, padahal delete-read lintas kategori | `notifications-tab-screen.tsx:414,875` | catatan (butuh total per kategori dari server) |
| FE-43 | Nama & deskripsi channel Android + judul tombol aksi "Konfirmasi terima" hardcode Indonesia; nama/deskripsi channel ikut diperbarui tiap boot sehingga bisa diterjemahkan | `lib/push-notifications.ts:343-424` | fix |
| FE-44 | Cold start dengan payload tanpa tujuan: `return` sebelum tandai dibaca/segarkan badge padahal pengguna mengetuk notifikasinya | `app/_layout.tsx:1051` | fix |
| FE-45 | Detail: actionUrl broadcast `/notifications?notificationId=<id ini>` → CTA "Lihat notifikasi" menumpuk layar yang sama; actionUrl `/notification/<id>` (deep link email) tak dikenal → null | `app/notification/[id].tsx:113-114`, `lib/notification-routing.ts:735` | fix (`isNotificationSelfRoute`, cabang `notification`) |
| FE-46 | `GET unread-count` mengembalikan `perCategory` — tidak dipakai (dot per tab kategori) | `lib/api/notifications.ts:37-44` | catatan |
| FE-47 | Header grup hari ("Hari ini") dan "x menit lalu" dihitung saat render; tab yang hidup melewati tengah malam / lama terbuka menampilkan label basi sampai data berubah | `notifications-tab-screen.tsx:381-384,286` | catatan |
| FE-48 | Detail: `checkConfirmReceiptEligible` (GET order) ditembak untuk SETIAP notifikasi ber-referensi order yang dibuka, termasuk yang lama/sudah selesai | `app/notification/[id].tsx:153-171` | catatan |
| FE-49 | `registerPushDevice` saat boot memanggil `requestPermissionsAsync` tiap peluncuran → dialog izin OS muncul SEBELUM sheet rationale (`PushRationaleSheet` di feed) sempat menjelaskan; di iOS dialog hanya sekali seumur instalasi | `lib/push-notifications.ts:460-471`, `app/_layout.tsx:1123` | fix (`prompt: false` saat boot & rotasi token; dialog hanya dari rationale/Pengaturan) |
| FE-50 | Katalog i18n: 2 kunci EN usang (copy quiet hours lama) setelah FE-35 — dihapus dari `remediation.json` | `lib/i18n/en/remediation.json:228,473` | fix |

## Admin (`admin-wt-notifikasi`)

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| AD-01 | `BroadcastResult` hanya `recipientCount`; `queuedCount`/`pushRequested` diabaikan → toast "terkirim" walau 0 job terantri | `src/lib/api/admin/system.ts:79-81`, `system/page.tsx:600-627` | fix |
| AD-02 | Tidak ada penjelasan audiens ("aktif" = login 30 hari) dan bahwa push selalu disertai salinan in-app | `system/page.tsx:553-558,662-670` | fix |
| AD-03 | Riwayat sesi tidak menampilkan jumlah terantri/kegagalan | `system/page.tsx:685-713` | fix |
| AD-04 | Tidak ada test kontrak `sendBroadcast` (path + Idempotency-Key + body) | `tests/unit/` | fix |
