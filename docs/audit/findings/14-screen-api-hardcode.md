# Audit Layar: Kontrak API, Hardcode & Pemakaian Komponen

**Tanggal audit:** 2026-09-05
**Branch:** `arena/01a06f1a-frontend`
**Cakupan:** SEMUA screen di `app/` (auth 9 layar + 5 tab + welcome + gate) + lib layer pendukung (`lib/api/*`, `lib/push-notifications.ts`, `lib/routes.ts`).

---

## Ringkasan Eksekutif

**Status: ✅ Lolos — `tsc --noEmit` 0 error (sebelumnya 56 error), `check:tokens` OK, `check:a11y` OK, bundle web OK.**

Audit menemukan bahwa layar tab ditulis terhadap **API komponen yang sudah berubah** (hasil audit komponen putaran sebelumnya), sehingga 56 error kompilasi dan beberapa bug runtime/API:

| Kategori | Temuan | Severity |
|---|---|---|
| Modul rusak | `lib/api/transactions.ts` mengimpor `apiClient` & `@/lib/types` yang tidak ada → tab Transaksi tidak bisa dibuild | 🔴 Critical |
| API kontrak | Filter "Aktif" mengirim `status=IN_PROGRESS` — spec `GET /v1/orders` mendokumentasikan **"use ACTIVE for all active statuses"** | 🔴 Critical |
| API kontrak | `GET /v1/wallet/transactions` spec menandai `type/from/to` **required**, helper lama hanya mengirim `page/limit` | 🟠 High |
| API kontrak | `markNotificationRead`/`markAllNotificationsRead` mengirim `{auth}` sebagai body POST | 🟠 High |
| API enum | Dua union `OrderStatus` bertabrakan (`PENDING_CONFIRMATION/AWAITING_PAYMENT/IN_PROGRESS` vs `PENDING_PAYMENT/PROCESSING/...`) | 🟠 High |
| Hardcode | Route literal di screen (`/topup`, `/edit-profile`, `/bank-accounts`, 12 item menu settings) | 🟠 High |
| Hardcode | Duplikasi konstanta `HEADER_HEIGHT = 56` di 3 file auth (di header.tsx sudah ada `HEADER_BAR_HEIGHT`) | 🟡 Medium |
| Hardcode | `toLocaleString("id-ID")` untuk saldo tertahan di Beranda | 🟡 Medium |
| Komponen | Tab screens membangun markup custom, tidak memakai komponen sistem (`WalletBalanceCard`, `WalletTransactionListItem`, `ProfileHeader`, `StatCard`, `SectionHeader`, `Dialog`, `SearchField`, `IconButton`, `LoadMore`, `Chip`) | 🟠 High |
| API tak terpakai | `POST /v1/notifications/register-device` & `/unregister-device` punya helper di lib tapi tidak dipakai; `setupNotifications()` tidak pernah dipanggil | 🟡 Medium |
| Fitur | Avatar upload di Setup Profil adalah placeholder "segera hadir" padahal `uploadAvatarDirect`+`confirmAvatar` sudah ada | 🟡 Medium |
| Aksesibilitas | Logout memakai `Alert.alert` yang **no-op di react-native-web** → `Dialog` sistem | 🟡 Medium |

---

## 1. Tab Transaksi — dirombak agar sesuai kontrak `GET /v1/orders`

**Sebelum**
- Impor `getTransactions` dari modul yang import-nya sendiri sudah salah (`apiClient`, `@/lib/types`) → build gagal.
- Filter "Aktif" → `status=IN_PROGRESS` (salah; spec bilang pakai `ACTIVE`).
- Tidak ada paginasi (spec: `page` default 1, `limit` default 10, max 50), tidak ada pencarian padahal query `search` tersedia.
- `SegmentedControl` dipakai dengan API lama (`items: string[]`, `selectedIndex`) — versi sekarang `items: SegmentItem[]` + `value`.
- `OrderCard` dipakai dengan API lama (`order={...}`) — sekarang props eksplisit.
- `EmptyState` tanpa `icon` (required) & `LoadMore` pakai `loading` (sekarang `status`).
- FAB memakai `style={{bottom}}` — sekarang `bottomOffset`.

**Sesudah**
- `api.orders.listOrders({ page, limit, status, search })` — satu-satunya jalur.
- `FILTER_STATUS_MAP = { all→undefined, active→"ACTIVE", completed→"COMPLETED", cancelled→"CANCELLED" }`.
- Pencarian `SearchField` (debounce 300ms) → query `search`.
- Paginasi + `LoadMore`, pull-to-refresh, skeleton, `EmptyState`, `ErrorState`.
- OrderCard dimapping dari `Order` (+ peran lawan via `myRole`), rute `ROUTES.orderDetail(id)`.

## 2. Tab Dompet — komponen sistem + parameter wajib API

- Kartu saldo custom diganti **`WalletBalanceCard`** (inverted, action 3 tombol terpasang via `onTopUp/onWithdraw/onTransfer`).
- Baris mutasi custom diganti **`WalletTransactionListItem`** (peta `type→kind`, `status COMPLETED→SUCCESS`, arah `direction`/kategori).
- `getWalletTransactions` kini mengirim **`page, limit, type, from, to`** sesuai spec; default `type="ALL"`, `from=2000-01-01`, `to=now` di **satu tempat** (`lib/api/wallet.ts`) — ditandai UNVERIFIED.
- Error halaman pertama riwayat kini tampil (`ErrorState`), bukan EmptyState yang menyesatkan.

## 3. Tab Notifikasi — enum API & komponen

- Kategori chip PERSIS enum API `TRANSAKSI|PROMOSI|INFORMASI`; peta ke kategori ikon komponen (`order/promo/system`) di `UI_CATEGORY`.
- `Chip` memakai `children` (bukan `label`), `LoadMore status`, `ErrorState` props baru, `EmptyState icon`.
- Perbaikan helper `markNotificationRead`/`markAllNotificationsRead` (body POST salah tempat).

## 4. Tab Beranda & Pengaturan

- Beranda: `ProfileHeader` + 2–3 `StatCard` (saldo via `<Amount>`, order aktif & total dari `GET /v1/orders/summary`), `formatRupiah` untuk hint escrow, `Icon` token (tone `"secondary"` tidak ada di komponen), logout → `Dialog`.
- Pengaturan: `ProfileHeader`, `ListGroup`/`ListItem` (API title/leading/chevron), `Bank` & `ChatCircleText` (ikon `Landmark`/`MessageCircle` tidak ada di phosphor v2.3), **logout unregister push device dulu** lalu `clearSession()`.
- Semua route menu dipusatkan di `lib/routes.ts`; menu yang screen-nya belum ada memakai `useComingSoon()` (toast sistem), bukan push ke "Unmatched Route".

## 5. Satu sumber kebenaran status & rute

- Union `OrderStatus` dipindah ke **`lib/api/orders.ts`** (10 status escrow + `(string & {})`); `components/ui/order-status-badge.tsx` re-export — tidak ada dua enum lagi.
- `TAB_BAR_HEIGHT = 56` diekspor dari `bottom-tab-bar.tsx` (pola sama `HEADER_BAR_HEIGHT`), dipakai FAB.
- `lib/routes.ts` menambah `topup/withdraw/transfer` + 12 route settings — **nol string route literal di screen**.
- `HEADER_HEIGHT` duplikat di register/verify-otp/profile-data → `HEADER_BAR_HEIGHT`.

## 6. Push notification sesuai API

- `lib/api/notifications.ts`: tambah `registerDevice(dto: RegisterDeviceDto)` & `unregisterDevice()` (spec path `/register-device`, `/unregister-device`).
- `welcome.tsx`: `registerPushDevice(...)` dengan adapter `api.notifications` (sebelumnya import fungsi yang tidak ada).
- `app/_layout.tsx`: `setupNotifications()` dipanggil saat boot (handler foreground + channel Android).
- `settings.tsx` logout: `unregisterPushDevice()` sebelum `clearSession()`.

## 7. Setup Profil — avatar upload aktif

- `expo-image-picker@17.0.11` ditambahkan (SDK 54).
- ActionSheet "Ambil foto"/"Pilih dari galeri" sekarang bekerja: izin (native) → pick/crop 1:1 → `uploadAvatarDirect(FormData field "file")` → `confirmAvatar({ avatarKey })` → preview di `<Avatar>`.
- Fallback web: `fetch(uri)→Blob` karena FormData RN tidak menerima objek `{uri}` di web.
- Overlay kamera → `IconButton` sistem (a11y + hit target + loading).

## 8. Perbaikan lain

- `app/(tabs)/_layout.tsx`: `TabsProps` tidak diekspor expo-router v6 → `ComponentProps<typeof Tabs>["tabBar"]`.
- `components/ui/bottom-tab-bar.tsx`: tipe `RouterTabBarNavigation` ditulis ulang → `Pick<BottomTabBarProps["navigation"], ...>` dari `@react-navigation/bottom-tabs` (menghilangkan mismatch `emit`).
- `app/(auth)/create-security.tsx`: typo `HEADER_HEIGHT` → `HEADER_BAR_HEIGHT`.
- `lib/api.ts`: domain `wallet` & tipe (`Order`, `UserProfile`, `Wallet`, …) diekspor dari satu pintu `@/lib/api`.

---

## Keputusan yang perlu dikonfirmasi tim

1. **`GET /v1/wallet/transactions` — nilai `type/from/to`.** Spec hanya menandai required tanpa enum/deskripsi. Implementasi mengirim asumsi `type="ALL"` + rentang `2000-01-01 → sekarang` (satu tempat di `lib/api/wallet.ts`). Bila backend menerima nilai lain (mis. `type` kosong, atau tanggal `YYYY-MM-DD`), cukup ubah konstanta di file itu.
2. **Union `OrderStatus`.** Spec OpenAPI tidak mengekspor enum status order; union sekarang mengikuti lifecycle design system (`PENDING_PAYMENT…EXPIRED`). Bila backend ternyata memakai nama lain (mis. `PENDING_CONFIRMATION`), ganti di `lib/api/orders.ts` — label/tone komponen mengikuti otomatis.
3. **Menu & aksi ke screen yang belum ada.** Rute dipusatkan di `lib/routes.ts` (siap dipakai), UI menampilkan toast "segera hadir" alih-alih "Unmatched Route". Saat file route dibuat, ganti `useComingSoon(...)` dengan `router.push(ROUTES.x)`.
4. **package-lock.json.** Repo sebelumnya tidak bisa `npm ci` (lockfile out of sync). Lockfile diperbaiki oleh `npm install` + penambahan `expo-image-picker`.
