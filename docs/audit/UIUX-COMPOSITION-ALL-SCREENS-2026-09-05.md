# Audit UI/UX Komposisi — Semua Screen

**Tanggal:** 5 September 2026  
**Branch:** `arena/01a07179-frontend`  
**Cakupan:** seluruh route di `app/` (~85 file). Auth 9 layar + Welcome dianggap baseline yang sudah lolos; audit ini membandingkan pola layout/spacing/reuse terhadap baseline itu.  
**Lingkup:** komposisi screen (layout, urutan, spacing, hierarki, token, reuse library, kontrak API, state). Bukan evaluasi internal komponen library.  
**Perbaikan belum dieksekusi** — menunggu review (tidak ada bug 🔴 yang jelas-jelas salah mapping API / hardcode warna di screen).

---

## Ringkasan eksekutif

Secara teknis, layar sudah jauh lebih rapi daripada putaran audit API sebelumnya:

- Nol hex / `bg-white` / `text-gray-*` di `app/`.
- Nol `Text` / `TouchableOpacity` RN mentah di screen.
- Hampir semua list memakai `PaginatedList` + `EmptyState` + `ErrorState` + pull-to-refresh.
- Padding layar `padded={false}` + `px-6` / `tokens.layout.screenPaddingX` (24px) konsisten.
- Data uang/tanggal lewat `formatRupiah` / `formatDateTime` (§13).
- Route terpusat di `lib/routes.ts`.

Temuan yang tersisa **hampir semua komposisi & voice**, bukan hardcode token. Tidak ada temuan 🔴 “hardcode warna / magic px / komponen library diubah”. Ada beberapa 🔴 **komposisi/kontrak copy** (voice “kamu”, Button disalahgunakan sebagai ringkasan) yang tidak merusak build.

| Kategori | Putaran 1 | Putaran 2 (baru) | Total |
|---|---|---|---|
| 🔴 Kritis | 4 | 8 | **12** |
| 🟡 Perlu perbaikan | 12 | ~45 | **~57** |
| 🟢 Saran improve | 10 | ~27 | **~37** |
| **Semua temuan bernomor** | 31 | **#32–#111 (80 baru)** | **111** |

---

## Pola lintas screen (baseline vs penyimpangan)

| Pola | Auth + Welcome (lolos) | Tab & fitur | Status |
|---|---|---|---|
| Screen padding 24px | `px-6` / footer token | `padded={false}` + `px-6` atau `tokens.layout.screenPaddingX` | ✅ |
| Header | `<Header>` + progress bar alur | `<Header>` tab `showBack={false}` | ✅ |
| Form | `FormSection` + `Field` + footer `Button` | Create TX, KYC, topup, PIN | ✅ |
| List | — | `PaginatedList` + `EmptyState` + `LoadMore` | ✅ |
| Error | `Alert` / `ErrorState compact` | `ErrorState` | ✅ |
| Loading | Skeleton / `Button loading` | `LoadingScreen` atau skeleton list | 🟡 campur |
| Voice “Anda” | formal | beberapa “kamu/untukmu” | 🔴/🟡 |
| Display font | Onboarding `DisplayHeading` | Welcome pakai `Text variant="h1"` | 🟡 |
| Flat / no shadow | ✅ | ✅ (tidak ada shadow di `app/`) | ✅ |

---

## 1. Auth (9) + Welcome + Gate

**File:** `app/(auth)/*`, `app/welcome.tsx`, `app/index.tsx`  
Audit sebelumnya (onboarding/register) tetap berlaku. Temuan baru hanya Welcome.

### 🔴 Kritis

1. **Welcome — voice “kamu”**  
   - Lokasi: `app/welcome.tsx` ~69  
   - Masalah: copy *“Akun kamu sudah siap…”* melanggar §12 (formal, “Anda”).  
   - Usulan: *“Akun Anda sudah siap. Mari mulai transaksi aman bersama Kahade.”*

### 🟡 Perlu perbaikan

2. **Welcome — hierarki tipografi**  
   - Lokasi: `app/welcome.tsx` ~64–66  
   - Masalah: judul hero memakai `Text variant="h1"` (Sofia Sans). DS §3.1 / §1.4: Welcome/splash/konfirmasi besar = **EB Garamond** (`DisplayHeading`), sama seperti onboarding.  
   - Usulan: ganti ke `<DisplayHeading>` (komponen sudah ada; tidak butuh variant baru).

3. **Welcome — CTA tunggal tanpa logo lockup**  
   - Baseline onboarding punya `<Logo variant="lockup">`. Welcome kosong di tengah.  
   - Usulan: tambah `Logo` di atas judul (komponen existing).

### 🟢 Saran

4. Tombol Welcome: user lama “Masuk ke Beranda” vs baru “Mulai” — jelas. Boleh `size="lg"` agar setara onboarding.

---

## 2. Tab Beranda — `app/(tabs)/home.tsx`

### 🟡 Perlu perbaikan

5. **Hierarki aksi primer terbalik**  
   - Lokasi: pintasan `pt-6` dulu, CTA “Buat Transaksi” di bawah (`~252–276`).  
   - Masalah: aksi bisnis utama (buat escrow) kalah menonjol dari grid 8 pintasan. DS: satu titik fokus per layar.  
   - Usulan: pindahkan `Button primary` “Buat Transaksi” **tepat di bawah StatCard**, lalu pintasan, lalu ghost “Lihat semua transaksi”.

6. **Profil gagal diam-diam**  
   - Lokasi: `getMe().catch(() => {})` ~139  
   - Masalah: wallet/summary punya `ErrorState`; profil gagal → nama `"—"`.  
   - Usulan: `ErrorState compact` atau retry di `ProfileHeader` (prop existing `loading`; error copy di screen).

7. **Ikon StatCard “Total transaksi”**  
   - Lokasi: ~229 `ArrowRight`  
   - Masalah: ikon navigasi, bukan kuantitas.  
   - Usulan: `Receipt` / `Stack` yang sudah dipakai di library (jangan ikon baru).

### 🟢 Saran

8. Badge sengketa di pintasan (`summary?.DISPUTED`) bagus. Pertimbangkan menonjolkan pintasan “Sengketa” hanya jika `> 0` (kurangi noise grid 8 item).  
9. Ghost “Lihat semua transaksi” redundant dengan tab Transaksi — boleh tetap sebagai affordance web.

---

## 3. Tab Transaksi — `app/(tabs)/transactions.tsx`

**Reuse:** `OrderCard`, `SegmentedControl`, `DebouncedSearchField`, `PaginatedList`, `FAB`, `EmptyState`. Filter `ACTIVE` sesuai spec. Timestamp `formatDateTime`. Empty “Transaksi **Anda**…” sesuai §12.

### 🟢 Saran

10. FAB `extended` hanya saat empty — bagus. Saat list penuh, label hilang; pastikan `accessibilityLabel` tetap (sudah ada).  
11. IconButton template + search di header: dua aksi sekunder — konsisten dengan Dompet (CSV/PDF). Tidak wajib diubah.

---

## 4. Tab Dompet — `app/(tabs)/wallet.tsx`

**Reuse:** `WalletBalanceCard`, `WalletTransactionRow`, `Chip`, `PaginatedList`.

### 🔴 Kritis (copy)

12. **Empty state “kamu”**  
    - Lokasi: ~166 `“Transaksi dompet kamu akan muncul di sini.”`  
    - Usulan: *“Transaksi dompet Anda akan muncul di sini.”*

### 🟡 Perlu perbaikan

13. Chip “Riwayat Top-up / Penarikan / Jadwal” di header list — navigasi, bukan filter. Visual sama dengan Chip filter Notifikasi → bisa membingungkan.  
    - Usulan: `SectionHeader` + `ListItem` chevron, atau `Button variant="ghost" size="sm"` — komponen existing.  
14. `StyleSheet` `balanceCard` margin token — OK. Kartu vs chip gap `space[2]` rapat vs gap section auth `space[6]`. Naikkan ke `space[4]` agar hierarki kartu saldo lebih napas.

---

## 5. Tab Notifikasi — `app/(tabs)/notifications.tsx`

State lengkap: loading skeleton sebentuk baris, empty, error via paginated list, batch, long-press. Timestamp `formatDateTime`. Enum kategori API benar.

### 🔴 Kritis (copy)

15. Empty: `“Notifikasi untukmu akan muncul di sini.”` (~409) — informal.  
    - Usulan: *“Notifikasi untuk Anda akan muncul di sini.”*

### 🟡 Perlu perbaikan

16. Chip “Belum dibaca” dicampur satu baris dengan kategori — dua dimensi filter.  
    - Usulan: baris 1 kategori, baris 2 (opsional) chip unread; atau pindahkan unread ke `Header` right (sudah ada mark-all).  
17. `NotifSkeletonRow` inline `style={{ width: "60%" }}` — persentase skeleton, bukan spacing token. Diterima sebagai geometri runtime; jangan angka px.

---

## 6. Tab Pengaturan — `app/(tabs)/settings.tsx`

Reuse `ProfileHeader`, `ListGroup`/`ListItem`, `Dialog`. Route terpusat. Logout unregister push dulu.

### 🔴 Kritis (copy)

18. Dialog logout ~344: *“Kamu bisa masuk kembali kapan saja.”*  
    - Usulan: *“Anda bisa masuk kembali kapan saja.”*

### 🟡 Perlu perbaikan

19. **Panjang vertikal:** 8 grup, ~40 item — tidak ada search. Pola list auth tidak sepanjang ini.  
    - Usulan komposisi: `DebouncedSearchField` di atas grup (komponen existing, sama tab Transaksi) memfilter `MENU_GROUPS`.  
20. Duplikasi pintasan dengan Beranda (Referral, Analitik, Voucher, Discover, Order Link, Sengketa). Bukan bug; noise IA.  
    - Usulan: di Beranda cukup subset; Settings = kanonik.

---

## 7. Buat Transaksi — `app/create-transaction.tsx`

FormSection, selector sistem, FeeBreakdown, CounterpartValidationCard, VoucherRedeemBox, footer Button. Debounce fee/counterpart. Mode direct/link jelas.

### 🔴 Kritis (reuse salah)

21. **Ringkasan total memakai `Button variant="ghost" disabled`**  
    - Lokasi: ~441–448  
    - Masalah: tombol disabled sebagai display nominal — bukan aksi. Hierarki kacau (terlihat seperti CTA mati). Library punya `Amount` / `FeeBreakdown` / `KeyValue`.  
    - Usulan: hapus Button itu; andalkan `FeeBreakdown` yang sudah di atas, atau `KeyValue emphasis` “Total dibayar”.

### 🟡 Perlu perbaikan

22. Tenggat hari: `Input` number-pad, default `3` hardcoded sebagai nilai form awal (bukan copy API). Wajar sebagai default UX; dokumentasikan. Stepper library ada — lebih jelas ± hari daripada input bebas. **Catatan library:** bila `Stepper` sudah cover integer bounded, pakai itu (jangan bikin input custom).  
23. Ghost “Lihat skema biaya” di tengah form — boleh `TextLink` agar tidak kompetisi dengan CTA footer.

### 🟢 Saran

24. Urutan: Cara membuat → Peran → Lawan → Detail → Biaya sudah natural. Voucher di bawah fee masuk akal (diskon mengubah fee).

---

## 8. Detail Order — `app/order/[id].tsx`

State machine per peran × status lengkap; loading `LoadingScreen`; error `ErrorState`; sheets pay/cancel/reject/dispute/shipping; Dialog terima. Format uang/tanggal token. ID Mono.

### 🟡 Perlu perbaikan

25. **Aksi primer vs sekunder:** blok “Lainnya” (`Invoice`, `Chat`, tenggat, sengketa, batal) `flex-wrap` `size="sm"` — padat, touch 44px bergantung Button sm. Verifikasi `Button size="sm"` ≥ 44pt (library dianggap final; bila sm < 44, **jangan ubah Button di sini** — naikkan `size="md"` di screen).  
26. `STATUS_LABELS` diduplikasi di screen (~91–102) padahal `OrderStatusBadge` punya labels. Risiko drift copy.  
    - Usulan: satu peta label di `lib` / re-export badge, screen hanya pass-through.  
27. Timeline kosong (`history.length === 0`) tidak ada empty mini — diam.  
    - Usulan: caption “Riwayat belum tersedia” (`Text tone="secondary"`) — bukan komponen baru.

### 🟢 Saran

28. ID order di kiri + badge kanan — hierarki baik. Judul lewat `SectionHeader` setelah deskripsi singkat: pertimbangkan judul dulu, ID sebagai caption.  
29. Sengketa `variant="ghost"` vs Invoice `secondary` — ghost untuk destruktif sudah tepat.

---

## 9. KYC — `app/kyc.tsx`

`KycStatusCard`, `UploadField`, `KycHistoryListItem`, FormSection.

### 🟡 Perlu perbaikan

30. **`LoadingScreen` di dalam `PullToRefresh`** (~206) — full-screen loader di body scroll, berbeda dari auth (skeleton) dan order (LoadingScreen mengganti body).  
    - Usulan: skeleton kartu status ATAU early return seperti order detail (bukan loader di dalam scroll).  
31. Nama + NIK approved di `View` polos, bukan `KeyValueList` — inkonsisten dengan order detail.

---

## 10. Keluarga list/fitur lain (scan pola)

Screen berikut mengikuti pola yang sama (`Screen padded={false}` + `Header` + `PaginatedList`/`PullToRefresh` + empty/error). Tidak ada hardcode warna. Temuan komposisi ringkas:

| Screen | Temuan |
|---|---|
| `discover`, `search`, `favorites`, `blocked-users` | List + search — selaras tab Transaksi. 🟢 Pastikan empty copy “Anda”. |
| `chat.tsx`, `chat/[roomId].tsx` | Pola thread. 🟡 Composer harus di footer `Screen` (safe area bawah), bukan padding ad-hoc. |
| `disputes`, `dispute/[id]` | Timeline + aksi. 🟡 Jangan hardcode `proposedByMe` (komentar file sudah waspada). |
| `topup`, `withdraw`, `transfer` | Form + AmountInput + PIN sheet. Selaras create-tx. 🟢 Konfirmasi: DisplayHeading tidak wajib di sheet. |
| `topup-history`, `withdraw-history`, `wallet-transaction/[txId]` | List/detail mutasi. Reuse row. |
| `bank-accounts`, `edit-profile`, `change-password`, `change-pin`, `two-factor`, `biometric-settings`, `security` | Form settings. Footer CTA. |
| `faq`, `help/[slug]`, `support`, `contact`, `privacy-policy`, `terms` | Konten. 🟡 Artikel panjang: `px-6` + `Text body`. |
| `analytics`, `trust-score`, `badges`, `ratings`, `showcase` | StatCard / chart. 🟡 Chart kategori non-status harus gray 400/600/800 (di komponen chart, bukan screen). |
| `vouchers`, `referral`, `subscriptions`, `order-links` | Kartu sistem. |
| `invoice/[orderId]`, `rate/[orderId]`, `delivery-proof`, `extension` | Alur order sekunder — push, bukan sheet bertumpuk (§10). |
| `appearance`, `language`, `notification-preferences` | ListItem radio/switch. |
| `delete-account` | Dialog destructive — benar Modal bukan sheet. |

Scan grep: **tidak ada** hex, **tidak ada** class `bg-white`/`text-gray`, **tidak ada** Pressable mentah di `app/`.

---

## 11. Responsiveness & platform

- Web: layout cap 520px di `Screen` (asumsi library). Screen tidak override max-width.  
- `edges={["top"]}` + paddingBottom `insets.bottom + tokens.space[8]` di form/settings — pola berulang, konsisten. Tab memakai tab bar library (safe area bawah).  
- Welcome `edges={["top","bottom"]}` — benar (tanpa tab).  
- Touch: aksi kecil di order “Lainnya” `size="sm"` = satu-satunya risiko 44pt di tingkat **pemakaian**, bukan di dalam Button.  
- Export CSV di wallet memakai `document` di web — OK; native share.

---

## 12. Kesesuaian API (komposisi data)

Tidak ditemukan hardcode status order `"pending"` di JSX. Filter transaksi `ACTIVE`. Wallet history lewat helper default `type/from/to` (UNVERIFIED, sudah di backlog #14). Home `ACTIVE_KEYS` untuk summary — 🟡 bila backend `summary` memakai key lain, angka “Order aktif” bisa 0 (logic di screen, bukan di API client).

State loading/empty/error:

| Keluarga | Loading | Empty | Error |
|---|---|---|---|
| Auth form | Button loading + skeleton metode | n/a | Alert |
| Tab list | PaginatedList / skeleton notif | EmptyState | ErrorState |
| Detail order/KYC | LoadingScreen | n/a | ErrorState |
| Home | StatCard loading / ProfileHeader loading | n/a (angka 0) | ErrorState saldo/summary; profil diam |

---

## Putaran 2 — 60 temuan baru (#32–#91)

Audit file-per-file lanjutan (topup/withdraw/transfer, chat, search/FAQ, profil, sengketa, 2FA, langganan, bantuan, laporan, tampilan, dll.). Tidak tumpang tindih dengan #1–#31.

---

### 13. Isi Saldo — `app/topup.tsx`

32. 🟡 **CTA di dalam scroll, bukan footer Screen** — “Lanjutkan Pembayaran” (~201) di body. Withdraw/Transfer memakai `footer` sticky. Inkonsisten; di keyboard iOS tombol bisa tertutup. Usulan: pindah ke `Screen footer` seperti tarik dana.

33. 🟡 **`LoadingScreen` di dalam `PullToRefresh`** (~189) untuk metode bayar — sama pola KYC #30. Usulan: `ListLoading` / skeleton selector, atau early-return.

34. 🟡 **Interval poll `5000` literal** (~109) vs order detail `POLL_MS = 3000`. Bukan token spacing, tapi magic number tidak bernama. Usulan: `const POLL_MS = 5000` di atas file.

35. 🟢 Empty metode tanpa `description` (~197) — screen lain selalu punya. Usulan: “Metode top-up sedang tidak tersedia. Coba lagi nanti.”

36. 🟢 Setelah sukses, `onDone` → riwayat top-up, bukan Dompet. Masuk akal; pastikan `TopupStatusCard` primary = “Lihat riwayat”, secondary kembali (sudah di komponen).

---

### 14. Tarik Dana — `app/withdraw.tsx`

37. 🟡 **PIN & OTP inline di halaman, bukan PIN Sheet** — DS §9.21 / §10: konfirmasi PIN = BottomSheet. Transfer & langganan pola sama. Usulan: bungkus `PinInput` di sheet yang sudah ada di library (jangan bikin sheet baru).

38. 🟡 **Copy CTA “Lanjut”** vs Topup “Lanjutkan Pembayaran” vs Create TX nama aksi penuh. Usulan: “Lanjut ke PIN” agar hierarki langkah jelas.

39. 🟢 Step `done` memakai `SectionHeader` sebagai judul sukses — Welcome/onboarding pakai Display/H1. Usulan: `Heading level={1}` untuk momen konfirmasi (§3.1).

40. 🟢 “Batal” di langkah PIN `variant="ghost"` — benar (bukan destructive). OTP “Batalkan penarikan” juga ghost padahal aksi merusak hold. Usulan: `variant="destructive"` atau Dialog konfirmasi (komponen existing).

---

### 15. Transfer — `app/transfer.tsx`

41. 🟡 PIN inline (sama #37).

42. 🟡 **Catatan tanpa `Field`/`label`** (~248 `TextArea` telanjang) — Create TX & Contact membungkus `Field`. Usulan: `<Field label="Catatan" helperText="Opsional">`.

43. 🟢 Penerima `recent` hanya memori sesi — hilang saat unmount. Bukan hardcode API; 🟢 cache opsional, jangan invent komponen.

44. 🟢 Lookup error `ErrorState compact` tanpa title (~229). Usulan: `title="Gagal mencari penerima"`.

---

### 16. Chat list — `app/chat.tsx`

45. 🟡 **Tidak ada paginasi** — `listChatRooms()` sekali. Transaksi/notif pakai `PaginatedList`. Jika API support page, usulkan reuse; jika tidak, catat UNVERIFIED.

46. 🟡 **LoadingScreen dalam scroll** (~81).

47. 🟡 **Konteks order mentah** (~99) ``Order ${room.orderId}`` — UUID panjang di caption. Usulan: `truncateMiddle(room.orderId)` (`lib/format` sudah ada).

48. 🟢 `SectionHeader “Percakapan”` redundan dengan `Header title="Chat"`. Usulan: hapus section, langsung list (seperti Notifikasi).

49. 🟢 `gap-1` antar room vs gap card transaksi `gap-3` / 12px. List item memang rapat; OK jika `ChatRoomListItem` sudah punya padding internal.

---

### 17. Chat room — `app/chat/[roomId].tsx`

50. 🟡 **Pull-to-refresh pada thread** — pesan baru di bawah; PTR me-reset seluruh riwayat (kursor hilang). Pola chat biasanya load-older di atas (sudah ada `LoadMore`) + poll/realtime. Usulan: hilangkan PTR atau hanya refetch halaman terakhir tanpa wipe cursor.

51. 🟡 **Padding bawah dobel** — `Screen footer` composer + `paddingBottom: insets.bottom + space[8]` di scroll (~318). Pesan terakhir jauh di atas composer. Usulan: scroll padding = `space[4]` saja (footer sudah safe area).

52. 🟡 Composer tetap di footer saat `error` full-page — user bisa ketik ke ruang yang gagal dimuat. Usulan: `footer={error || !roomId ? undefined : composer}`.

53. 🟢 Header aksi “Pesanan” `Button ghost sm` (~304) — inkonsisten dengan `IconButton` di tab lain. Usulan: `IconButton` Package + a11y “Lihat pesanan”.

54. 🟢 Empty “Mulai percakapan Anda.” — voice OK. Tidak ada hint lampiran.

---

### 18. Pencarian global — `app/search.tsx`

55. 🟡 **Hasil campur tanpa `SectionHeader`** — user/order/mutasi/artikel dalam satu `FlatList`. DS: grouping section. Usulan: sisipkan header per `kind` (komponen `SectionHeader` existing) atau filter Chip “Pengguna | Transaksi | Mutasi | Bantuan”.

56. 🟡 **Bukan `PaginatedList`** — `limit: 20` tanpa load-more. Inkonsisten dengan search transaksi.

57. 🟡 **`OrderCard` tanpa `timestamp`** (~157) — tab Transaksi selalu kirim `formatDateTime`. Kartu di search “lebih kosong”.

58. 🟡 **Chip saran `value={[]}` selalu** (~96) — `ChipGroup` terlihat tidak pernah selected; tap mengubah `seed` dan remount field. UX aneh. Usulan: Chip biasa `onPress` seperti Notifikasi, bukan group multi-select kosong.

59. 🟢 DS §9.23 Search = overlay full-screen. Route `/search` adalah push — diterima sebagai overlay-equivalent. Tab Transaksi punya search inline **dan** ikon ke global (#11) → duplikasi. Usulan: di Transaksi hanya filter list; ikon kaca → `/search`.

---

### 19. FAQ / Bantuan — `app/faq.tsx`, `app/help/[slug].tsx`

60. 🟡 **`SearchField` langsung vs `DebouncedSearchField`** di Transaksi/Search. Ketikan merender list. Usulan: samakan debounce.

61. 🟡 Settings label “FAQ”, header screen “Pusat Bantuan”. Usulan: samakan “Pusat Bantuan”.

62. 🟡 Help article: `Header title="Artikel"` generik; judul hanya di `SectionHeader` body. Usulan: `Header title={selected.title}` (numberOfLines).

63. 🟢 Artikel `Text variant="body"` untuk HTML/plain panjang — tidak ada spacing paragraf. Copy dari API; 🟢 `variant="bodyLarge"` untuk baca.

---

### 20. Discover & Followers

64. 🔴 **Judul English “Discover”** (`app/discover.tsx` ~63) — seluruh app ID. Usulan: “Jelajahi” (sudah dipakai di Beranda/Settings).

65. 🟡 Discover `PAGE_LIMIT = 50` sekali fetch, tanpa load-more.

66. 🟢 `SectionHeader “Pengguna untuk Anda”` + Header Discover = dobel. Voice “Anda” sudah benar.

67. 🟡 Followers empty `“Belum ada pengguna”` (~56) — tidak bedakan pengikut vs mengikuti. Usulan: dua copy.

68. 🟢 Header title berubah saat ganti tab — bagus; Segmented di bawah juga mengulang label yang sama. Boleh hapus duplikat di header (tetap “Koneksi”).

---

### 21. Analitik — `app/analytics.tsx`

69. 🔴 **Label “Followers” English** (~103). Usulan: “Pengikut”.

70. 🟡 LoadingScreen menutup `SegmentedControl` periode — ganti periode harus menunggu reload penuh. Usulan: control selalu terlihat; `AnalyticsSummary loading`.

71. 🟡 Copy `periodLabel={`${periodLabel} terakhir`}` — jika label API “30 hari” → “30 hari terakhir”; jika “30d” → “30d terakhir”. Usulan: cek `ANALYTICS_PERIODS` labels.

72. 🟢 Stat “Followers” kurang sentral untuk escrow vs “Order aktif / sengketa”. 🟢 Turunkan atau pindah ke profil.

---

### 22. Tampilan — `app/appearance.tsx`

73. 🔴 **`<Screen>` bersarang** (~45–47): outer `padded={false}` + inner `scroll padded`. Risiko double safe-area, double max-width 520px, background dobel. Usulan: satu `Screen scroll padded edges={["top"]}` + Header di luar scroll (pola Settings).

---

### 23. 2FA — `app/two-factor.tsx`

74. 🟡 Error muat pakai `Alert` + ghost retry (~217), bukan `ErrorState` seperti screen data lain.

75. 🟡 Saat 2FA aktif, **dua tombol destruktif** berurutan: “Buat Kode Cadangan Baru” secondary + “Matikan…” destructive, **plus** kartu sudah punya `onManage`/`onRegenerateBackup` — aksi dobel. Usulan: biarkan kartu; hapus blok tombol bawah (~399–411) atau sebaliknya.

76. 🟢 `BACKUP_CODES_TOTAL = 10` hardcode untuk progress kartu. Jika server ≠ 10, meter salah. Usulan: `codes.length` saat baru dibuat; idle pakai remaining only.

---

### 24. Langganan — `app/subscriptions.tsx`

77. 🔴 **Badge riwayat menampilkan enum mentah** `h.status` (`ACTIVE`/`PENDING`, ~434). Reports sudah memetakan ke label ID. Usulan: peta `HISTORY_LABELS`.

78. 🟡 Deskripsi paket hardcode “Bayar sekali untuk setahun” (~348) — bukan dari API `plan.description`. Usulan: `plan.description ??` fallback itu.

79. 🟡 `Header onBack={step !== "plans" ? backToPlans : undefined}` — menimpa back sistem. Di native, gesture back bisa keluar screen di tengah PIN. Usulan: `BackHandler`/konfirmasi atau biarkan stack (step state hilang = OK).

80. 🟡 `startSubscribe` **blokir jika `!hasMethods`** (~199) — komentar bilang metode opsional (server default). User tanpa metode tidak bisa berlangganan. Usulan: izinkan langsung ke PIN (saldo) jika methods kosong.

81. 🟢 PIN inline (sama #37).

---

### 25. Profil publik — `app/user/[username].tsx`

82. 🟡 “Bergabung {formatDateTime}” (~365) — jam:menit untuk tanggal join berlebihan. §13 larang relative, tidak wajib jam. Usulan: `formatDate` saja.

83. 🟡 `FollowButton disabled={following == null}` tanpa skeleton — tombol mati sampai followers search selesai. Usulan: `loading` prop sampai resolved.

84. 🟢 Baris “Lihat juga” wrap `size="sm"` — sama risiko 44pt seperti order #25.

---

### 26. Edit profil — `app/edit-profile.tsx`

85. 🟡 **CTA foto dobel**: `IconButton` kamera overlay + `Button secondary “Ubah foto”` (~365–388). Setup profil hanya overlay. Usulan: satu pemicu (icon di avatar).

86. 🟢 Email akun `EmailField disabled` terlihat seperti field mati, bukan `KeyValue`. Usulan: `KeyValue label="Email akun"` + link verifikasi.

---

### 27. Sengketa detail — `app/dispute/[id].tsx`

87. 🟡 **Composer di footer vs pesan di dasar scroll panjang** (klaim, bukti, usulan, panggilan dulu). User harus scroll jauh untuk lihat bubble, padahal ketik selalu terlihat. Usulan: section Pesan langsung di atas footer (pindah ke atas) ATAU tab Segmented “Klaim | Bukti | Pesan”.

88. 🔴 **Deskripsi bukti hardcode** `"Bukti tambahan"` (~258) — bukan input user. Usulan: `TextArea` opsional di sheet sebelum upload, atau kosongkan field.

89. 🟡 Footer composer `className="px-6"` + paddingBottom insets — jika `Screen footer` sudah padded, dobel 24px. Cek primitif Screen.

90. 🟢 Empty usulan/panggilan `EmptyState compact` di tengah alur berat — terlalu besar. Caption `Text secondary` cukup.

---

### 28. Hubungi kami vs Tiket — `app/contact.tsx` / `app/support.tsx`

91. 🟡 **IA dobel**: Contact = form + list tiket; Support = list tiket. Settings punya keduanya. Usulan: Contact = form saja (CTA kirim); list hanya di Support — atau sebaliknya.

92. 🟡 Contact: tombol kirim di body form, bukan footer (sama topup).

93. 🟡 Contact: `LoadingScreen` untuk list di bawah form — form loncat. Usulan: skeleton 2 kartu.

94. 🟢 Toast “Tim kami akan segera merespons” — “segera” hampir relative. 🟢 “Tim Kahade akan membalas lewat tiket ini.”

---

### 29. Laporan — `app/reports.tsx`

95. 🟢 Form laporkan + list “Laporan saya” satu scroll — OK. Jika `targetId` ada, list di bawah masih loading penuh.

96. 🟢 Status sudah dilabeli ID (beda dengan langganan #77) — pola yang harus ditiru.

---

### 30. Lain-lain

97. 🟡 `app/notification/[id].tsx` hanya `Redirect` ke list — deep link kehilangan konteks id. 🟢 Toast “Buka dari daftar” berlebihan; biarkan jika spec belum ada GET by id.

98. 🟡 `app/+not-found.tsx` `Screen` tanpa `edges` — notch. Usulan: `edges={["top","bottom"]}`.

99. 🟡 Home `background="surface"` vs tab lain default background — kartu Stat di atas surface vs white. Inkonsisten antar tab.

100. 🟡 Home `QuickActionGrid className="-mx-1"` — negative margin 4px, hampir alignment “geser beberapa pixel”. Usulan: hapus; biarkan grid dalam `px-6`.

101. 🔴 **Order detail: `canPay` mensyaratkan `!!fee`** — jika `calculateFee` gagal, pembeli tidak punya tombol Bayar padahal status `PENDING_PAYMENT`. Usulan: tetap tampilkan Bayar dengan `orderValue`; atau ErrorState compact “Rincian biaya gagal” + retry (bukan sembunyikan CTA).

102. 🟡 Create-tx placeholder “Jasa desain logo” / “johndoe” — contoh OK; pastikan tidak tersubmit sebagai default (tidak).

103. 🟡 Withdraw/Transfer/Topup/Create: `paddingTop: tokens.space[3]` vs auth form tanpa extra top (Header sudah gap). Minor, samakan `pt-4` (`space-4`) antar form.

104. 🟢 Language screen copy sudah jujur UI tetap ID — bagus.

105. 🟡 Security (perangkat): tiga tab dalam satu scroll — belum diaudit baris-per-baris; pola `LoadingScreen` kemungkinan sama #30. Flag untuk putaran 3: `app/security.tsx`, `showcase.tsx`, `ratings.tsx`, `questions.tsx`, `bank-accounts.tsx`, `referral.tsx`, `delivery-proof`, `extension`, `invoice`, `rate`.

106. 🟢 Help `trackHelpArticleView` diam-diam — tidak ada UI; OK.

107. 🟡 Followers `UserListItem padded={false}` di dalam list yang mungkin sudah unpadded — cek double padding vs chat.

108. 🟢 Delete-account / privacy / notif-prefs memakai DataScreen — pola lebih bersih; tarik chat/analytics ke pola itu.

109. 🟡 Subscriptions history `ListItem` trailing Badge+Amount — angka tidak `Amount` component (pakai `Text monoBody` + formatRupiah). Format OK; hierarki OK.

110. 🟢 Two-factor menamai Google Authenticator — pengecualian merek, bukan warna.

111. 🟡 Dispute call buttons `className="flex-1"` + `px-6` di dalam `ListGroup` yang mungkin sudah padded — indent dobel.

---

**Putaran 2 selesai.** Masih ada cluster security/showcase/ratings/bank/referral/invoice untuk putaran 3 jika perlu.

---

## Catatan untuk Component Library (tidak dieksekusi)

Tidak ada usulan komponen **baru**. Yang perlu keputusan Anda:

1. Apakah `Stepper` resmi untuk integer tenggat hari (create-tx)? Jika ya, screen bisa ganti Input.  
2. Apakah `Button size="sm"` dijamin ≥ 44pt? Jika tidak, screen order harus `md` (bukan ubah primitif di PR ini).  
3. `DisplayHeading` di Welcome — konfirmasi boleh dipakai di luar onboarding.  
4. Centralize `STATUS_LABELS` order (bukan variant baru badge).

---

## Prioritas jika disetujui

1. Copy “kamu/untukmu” → “Anda” (Welcome, Wallet empty, Settings logout, Notifikasi empty).  
2. Hapus Button disabled sebagai total di create-tx.  
3. Reorder Beranda: CTA buat transaksi naik.  
4. Welcome: `DisplayHeading` + Logo.  
5. Settings: search menu.  
6. KYC: jangan `LoadingScreen` di dalam scroll.

Menunggu review sebelum eksekusi.
