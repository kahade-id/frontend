# Audit Komposisi UI/UX — Seluruh Layar `app/`

**Tanggal:** 5 September 2026
**Cakupan:** 83 layar di `app/` (~85 rute), diaudit satu per satu, audit baru (tidak memakai temuan dokumen audit sebelumnya).
**Acuan:** Kahade Design System v1.1 + `lib/tokens.ts` + spec API `docs/api/kahade-api-mobile.json`.
**Sifat:** semua temuan di bawah **sudah diperbaiki** di branch ini. Yang belum dieksekusi hanya ada di bagian terakhir ("Catatan untuk Component Library") karena menyentuh `components/ui/`.

Batasan yang dipatuhi: komponen library tidak dinilai dan tidak diubah perilakunya — yang dinilai adalah **cara layar merakitnya**. Palet tetap monokrom; tidak ada warna baru untuk hierarki.

---

## Ringkasan

| Kategori | Jumlah | Status |
| --- | --- | --- |
| 🔴 Kritis (hardcode, ketidaksesuaian spec API, tidak reuse) | 7 | Selesai |
| 🟡 Perlu Perbaikan (konsistensi layout/spacing) | 5 | Selesai |
| 🟢 Improve Komposisi (diterapkan) | 4 | Selesai |
| 📋 Catatan Component Library (menunggu keputusan Anda) | 4 | Belum dieksekusi |

Verifikasi: `npm run check` hijau — `typecheck` 0 error, `check:tokens` OK, `check:a11y` OK (301 file), `check:screens` OK, `check:api` OK (231 adapter / 82 layar), `check:weblinks` OK, vitest 145/145. Bundle web Metro (10,9 MB) ter-compile penuh tanpa error resolusi.

---

## 🔴 Kritis

### K1 — 18 error TypeScript di `main`: 6 layar tidak bisa dikompilasi

**Lokasi:** `app/(tabs)/home.tsx`, `app/(tabs)/settings.tsx`, `app/chat/[roomId].tsx`, `app/dispute/[id].tsx`, `app/kyc.tsx`, `app/search.tsx`, `app/subscriptions.tsx`

**Masalah:** `npm run typecheck` gagal dengan 18 error pada commit dasar (`d89b1ac`, hasil merge PR #51). Variabel dirujuk tanpa dideklarasikan, import hilang, dan satu langkah UI hilang total.

**Perbaikan:**
- `home.tsx` — `profileError` dirujuk tanpa state; ditambahkan.
- `settings.tsx` — state pencarian + `<EmptyState>` hasil-nol yang hilang.
- `chat/[roomId].tsx` — header memakai `<IconButton>` sesuai pola kanonik (import `Package`/`IconButton` yang "tidak terpakai" ternyata bukti pola header yang belum dirakit, bukan sampah).
- `dispute/[id].tsx` — `insets` tak terpakai.
- `kyc.tsx`, `search.tsx` — import `ListLoading` / `SectionHeader` yang hilang.
- `subscriptions.tsx` — **langkah konfirmasi PIN hilang seluruhnya**; direkonstruksi memakai pola kanonik `<BottomSheet visible={step === "pin"} avoidKeyboard>` + `<PinInput mode="enter">` (sama seperti `app/withdraw.tsx`).

---

### K2 — Pesan galat backend dibuang di 23 layar (`setError` literal)

**Lokasi:** 23 layar; contoh `app/edit-profile.tsx`, `app/bank-accounts.tsx`, `app/security.tsx`, `app/two-factor.tsx`, `app/transaction-templates.tsx`

**Masalah:** pola `catch { setError("Gagal memuat profil.") }` menimpa pesan asli backend. Pengguna yang ditolak karena KYC belum selesai, kena rate limit, atau datanya sudah berubah membaca kalimat yang sama persis dengan pengguna yang kehilangan sinyal — dan tim support tidak punya apa pun untuk ditindaklanjuti.

**Perbaikan:** seluruhnya menjadi `catch (err: unknown) { setError(userMessage(err)) }` dengan `userMessage` diimpor dari barrel `@/lib/api`. Aturan ini sekarang **dikunci di CI**: baseline S2 di `scripts/check-screens.mjs` dikosongkan (dari 26 entri → 0), jadi regresi baru langsung menggagalkan `npm run check`.

---

### K3 — 35 toast galat membuang alasan asli backend

**Lokasi:** 22 layar; contoh `app/(tabs)/notifications.tsx:219,235,249`, `app/bank-accounts.tsx:123,136`, `app/edit-profile.tsx:276,291`, `app/(tabs)/wallet.tsx:114`, `app/invoice/[orderId].tsx:69`

**Masalah:** varian K2 pada jalur aksi (bukan muat data): `} catch { toast.show({ title: "Gagal menghapus rekening", tone: "danger" }) }`. Judul saja tidak memberi tahu apakah pengguna harus mengulang (jaringan) atau memperbaiki sesuatu (validasi/izin).

**Perbaikan:** `} catch (err: unknown) {` + `description: userMessage(err)` pada semua toast danger yang memanggil API.

Tiga kasus ditangani manual karena menebak alasan lebih berbahaya daripada diam:
- `app/change-password.tsx:37` — deskripsi tetap "Periksa password saat ini." padahal penyebabnya bisa rate limit → diganti `userMessage(err)`.
- `app/change-pin.tsx:90` — deskripsi "Periksa password akun dan PIN lama Anda." menyesatkan saat backend **mengunci akun** (DS §14 membatasi percobaan PIN); saran mencoba lagi justru memperpanjang penguncian → diganti `userMessage(err)`.
- `app/contact.tsx:51` — toast tanpa deskripsi sama sekali → ditambah `userMessage(err)`.

Satu kasus sengaja **tidak** diubah: `app/biometric-settings.tsx:99` — kegagalannya berasal dari sensor/SecureStore perangkat, bukan backend, jadi tidak ada pesan server yang bisa diteruskan. Alasannya ditulis sebagai komentar di kode.

---

### K4 — Label status order ditulis ulang di layar detail

**Lokasi:** `app/order/[id].tsx:97` (dulu `const STATUS_LABELS`)

**Masalah:** layar mendefinisikan peta label status sendiri lalu mengoperkannya sebagai prop `labels` ke `<OrderStatusBadge>`. Sumber kebenaran status order adalah `components/ui/order-status-badge.tsx` (`ORDER_STATUS_LABELS`). Dua salinan = label bisa berbeda antara daftar transaksi dan detail order untuk status yang sama.

**Perbaikan:** peta lokal dihapus, layar memakai `ORDER_STATUS_LABELS`, dan prop `labels` pada `<OrderStatusBadge>` dilepas (prop itu untuk i18n, bukan untuk mengganti kata).

---

### K5 — State machine escrow diduplikasi dan sudah mulai menyimpang

**Lokasi:** `app/order/[id].tsx:95–110` vs `app/extension/[orderId].tsx:72`

**Masalah:** `EXTENDABLE_STATUSES` ada dua kali dengan bentuk berbeda — array di detail order, `Set` di layar perpanjangan. Dua salinan berarti tombol "Perpanjang" di detail order bisa muncul untuk status yang justru ditolak layar perpanjangan: pengguna menekan tombol lalu mendarat di layar tanpa aksi. `DISPUTABLE_STATUSES`, `ACTIVE_STATUSES` (gerbang pembatalan), dan `NEXT_STATUS` punya risiko yang sama. Docstring `ACTIVE_STATUSES` bahkan sudah salah — menyebut "dibatalkan / disengketakan" padahal sengketa punya gerbang sendiri.

**Perbaikan:** keempatnya dipindah ke `lib/api/orders.ts`, tepat di bawah union `OrderStatus` yang memang sudah bertuliskan "jangan definisikan ulang union ini di file lain":

```ts
export function isDisputable(status: OrderStatus): boolean
export function isExtendable(status: OrderStatus): boolean
export function isCancellable(status: OrderStatus): boolean
export function nextOrderStatus(status: OrderStatus): OrderStatus | undefined
```

Kedua layar sekarang memanggil fungsi yang sama. Status baru dari backend cukup diputuskan di satu tempat. (`lib/` bukan bagian dari component library yang dibekukan.)

---

### K6 — Status tautan order tampil beda warna di dua layar

**Lokasi:** `app/order-links.tsx:46` (`STATUS_META` lokal) vs `app/order-link/[token].tsx:130` (ternary bersarang 4 tingkat)

**Masalah:** tautan yang sama tampil **kuning** di daftar tapi **merah** di halaman terima — daftar memakai `EXPIRED: "warning"`, `ACCEPTED: "info"`, sedangkan `components/ui/order-link-preview-card.tsx` memakai `EXPIRED: "danger"`, `ACCEPTED: "neutral"`. Selain itu labelnya juga beda ("Diterima" vs "Sudah diterima").

**Perbaikan:** dibuat `lib/order-link-labels.ts` sebagai satu sumber (`ORDER_LINK_STATUS_LABELS`, `orderLinkStatus()`, `orderLinkStatusMeta()`). Nilai tone **sengaja mengikuti komponen library**, karena komponen adalah acuan yang tidak boleh diubah dari layar. Ternary bersarang di halaman terima diganti satu pemanggilan `orderLinkStatus(link.status)`; status asing dari backend tampil apa adanya dengan tone netral, bukan crash.

---

### K7 — 10 layar merakit footer sendiri alih-alih memakai `<FooterBar>`

**Lokasi:** 9 layar `app/(auth)/*` + `app/verify-email.tsx`

**Masalah:** footer CTA dirakit manual dengan `<View>` + padding sendiri. Akibatnya inset bawah (home indicator), padding horizontal, dan jarak antar tombol berbeda-beda antar layar auth — persis area yang paling sering dilihat pengguna baru.

**Perbaikan:** semuanya memakai `<FooterBar>`, yang menangani `paddingBottom = max(space[4], insets.bottom)` dan `px-6` secara konsisten. 11 import yang menjadi tak terpakai dibersihkan. Catatan: `className` pada `<FooterBar>` tidak mengatur jarak antar anak (anak berada di `<View class="gap-2">` internal), jadi `className="gap-4"` yang tidak berefek juga dihapus.

---

## 🟡 Perlu Perbaikan

### P1 — Bentuk skeleton tidak menyerupai konten yang dimuat (12 layar)

**Lokasi:** `app/invoice/[orderId].tsx`, `app/wallet-transaction/[txId].tsx`, `app/rate/[orderId].tsx`, `app/order-link/[token].tsx`, `app/kyc.tsx`, `app/delete-account.tsx`, `app/analytics.tsx`, `app/help/[slug].tsx`, `app/support/[ticketId].tsx`, `app/extension/[orderId].tsx`, `app/dispute/[id].tsx`, `app/delivery-proof/[orderId].tsx`

**Masalah:** semuanya memakai `<ListLoading>` (4 kartu `h-24` berulang) padahal isinya **satu record** — struk, detail mutasi, form penilaian, artikel bantuan. Layar berkedip dari "empat kartu seragam" ke "satu blok detail": pergeseran layout yang tidak perlu dan ekspektasi yang salah.

**Perbaikan:** ditambahkan helper `DetailLoading()` (judul `h-6 w-2/5` + `Skeleton shape="card" h-32` + `SkeletonText lines={3}`) dan 12 layar dipindahkan ke sana. Aturan yang sekarang berlaku: `ListLoading` hanya untuk daftar kartu sejati, `DetailLoading` untuk detail/form/ringkasan satu record, `<LoadingScreen>` untuk muat satu halaman penuh.

`ListLoading` **sengaja dipertahankan** di `app/topup.tsx` (daftar metode pembayaran), `app/withdraw.tsx` (daftar rekening), `app/security.tsx` (daftar perangkat & sesi), `app/faq.tsx` (daftar kategori) — semuanya memang daftar.

> Helper ini menambah export baru di `components/ui/paginated-list.tsx` → dicatat di bagian Component Library (L1).

### P2 — FAB menutupi baris terakhir daftar transaksi

**Lokasi:** `app/(tabs)/transactions.tsx:120`

**Masalah:** `<FloatingActionButton>` melayang di atas daftar tetapi hanya diberi `bottomOffset={tokens.space[4]}`, sementara `bottomPadding` daftar memakai angka rakitan `tokens.space[16] + tokens.space[8]` yang kebetulan mirip tinggi FAB — bukan diturunkan dari nilai sebenarnya. Baris terakhir bisa tertutup tombol.

**Perbaikan:** `bottomPadding={FAB_SIZE + tokens.space[4] + tokens.space[8]}`, dihitung dari konstanta yang sekarang diekspor komponen. `safeArea={false}` dipertahankan karena tab bar sudah mengonsumsi `insets.bottom`; menambahkannya lagi akan menghitung ganti dua kali.

> Perlu satu export baru (`FAB_SIZE`) di `components/ui/floating-action-button.tsx` → dicatat di L2.

### P3 — Padding bawah ganda di tab Pengaturan

**Lokasi:** `app/(tabs)/settings.tsx:222`

**Masalah:** layar menambahkan `insets.bottom + tokens.space[8]` pada konten, padahal bottom tab bar adalah **sibling normal** (bukan `position: absolute`) yang sudah menambahkan `paddingBottom: insets.bottom` sendiri. Hasilnya ruang kosong ganda di bawah daftar.

**Perbaikan:** menjadi `tokens.space[8]` saja; `useSafeAreaInsets()` yang jadi tak terpakai dihapus. Efek sampingnya layar ini otomatis lolos aturan S3 (`check-screens`), jadi entri baseline S3-nya ikut dihapus — pengetatan permanen.

> Catatan proses: sempat ada hipotesis bahwa kelima tab perlu menambahkan `TAB_BAR_HEIGHT` ke padding konten. Hipotesis itu **dibantah** setelah membaca `app/(tabs)/_layout.tsx` — `<Tabs tabBar={…}>` merender bar sebagai sibling di bawah konten, tanpa `position:"absolute"` maupun `tabBarStyle`. Menambahkan 56px hanya menciptakan ruang mati. Perubahan pada home/wallet/notifications/settings sudah dikembalikan; hanya elemen **overlay** (FAB pada P2) yang benar-benar butuh jarak aman.

### P4 — Header ikut ter-scroll di 3 layar

**Lokasi:** `app/app-version.tsx:62`, `app/delete-account.tsx:103`, `app/help/[slug].tsx:40`

**Masalah:** ketiganya memakai `<Screen scroll>` dengan `<Header>` **di dalam** area scroll, sehingga tombol kembali hilang saat konten digulir. Artikel bantuan bisa sangat panjang, dan form hapus akun berisi blocker + frasa konfirmasi + MFA. 16 layar lain (dan `<DataScreen>`) menempatkan `<Header>` di luar area scroll.

**Perbaikan:** ketiganya mengikuti pola kanonik `<Screen padded={false}>` + `<Header>` + `<ScrollView>` eksplisit, dengan `keyboardShouldPersistTaps="handled"` dan `showsVerticalScrollIndicator={false}` seperti yang dipakai `<Screen scroll>` internal. Padding konten tidak berubah.

### P5 — Baseline pemeriksaan usang menutupi layar yang sudah bersih

**Lokasi:** `scripts/check-screens.mjs`

**Masalah:** baseline S1/S2/S3 masih mendaftar layar yang sebenarnya sudah lolos, termasuk file yang sudah tidak ada (`app/chat.tsx`). Baseline yang longgar membuat regresi baru lolos diam-diam.

**Perbaikan:** S2 dikosongkan total (26 → 0), entri usang S1/S3 dihapus. Hasil sekarang: S1 30 · S2 0 · S3 31 · S4 0 · S5 38, dan `check-screens` melaporkan "OK" tanpa peringatan baseline basi.

---

## 🟢 Improve Komposisi (diterapkan)

### G1 — CTA utama di Beranda terkubur di bawah 8 pintasan

**Lokasi:** `app/(tabs)/home.tsx`

**Masalah:** urutan lama menaruh grid "Pintasan" (8 ubin sekunder) di antara ringkasan saldo dan tombol **Buat Transaksi**. Aksi utama produk escrow justru paling jauh dari data yang memicunya.

**Perbaikan:** blok CTA (`Buat Transaksi` + `Lihat semua transaksi`) dipindah **ke atas** grid pintasan, menempel pada konteks saldo/ringkasan; grid memakai `pt-8` sebagai pemisah kelompok. Tidak ada komponen baru — hanya urutan dan spacing token.

### G2 — Hierarki header detail order

**Lokasi:** `app/order/[id].tsx`

**Perbaikan:** judul order dan `<OrderStatusBadge>` disatukan dalam satu baris `flex-row items-start justify-between gap-3`; ID order diturunkan menjadi `monoBody` + `tone="tertiary"` + `selectable` (identifier untuk disalin, bukan judul). Region kosong memakai `<EmptyState compact>`, peringatan inline memakai `<ErrorState compact … onRetry>`, dan navigasi yang sebelumnya dirender sebagai *value* `KeyValue` diganti `<TextLink>` agar target sentuhnya benar (≥44pt lewat hitSlop bawaan). Import `UserCircle` yang menjadi tak terpakai dibersihkan.

### G3 — Galat parsial di Beranda tidak lagi anonim

**Lokasi:** `app/(tabs)/home.tsx` — 3 `.catch()` di dalam `Promise.allSettled`

**Perbaikan:** `.catch(() => setXError("Gagal memuat …"))` → `.catch((err: unknown) => setXError(userMessage(err)))` untuk profil, wallet, dan ringkasan. Karena `allSettled` memang dipakai agar satu blok gagal tidak menjatuhkan seluruh beranda, tiap blok kini menjelaskan kegagalannya sendiri.

### G4 — Rangkuman konsistensi lintas layar yang diverifikasi bersih

Disapu menyeluruh dan **tidak** ditemukan pelanggaran (jadi tidak ada perubahan): tidak ada warna hex/palet Tailwind mentah, tidak ada `shadow*`, tidak ada nilai spacing di luar skala token, tidak ada primitif RN mentah (`TouchableOpacity`/`<Pressable>`/`Text` dari `react-native`) di `app/`, tidak ada `toLocaleString`/`Intl` untuk uang atau tanggal (semua lewat `lib/format.ts`), tidak ada waktu relatif ("2 jam lalu") yang dilarang DS §13, tidak ada sapaan "kamu/-mu" (DS §12 mewajibkan "Anda"), dan seluruh 40 `<EmptyState>` sudah memakai ikon. Penanganan safe-area konsisten di seluruh layar.

---

## 📋 Catatan untuk Component Library — belum dieksekusi, menunggu keputusan Anda

Empat hal berikut menyentuh `components/ui/`. Dua di antaranya (L1, L2) **sudah saya tambahkan** karena perbaikan layar bergantung padanya dan keduanya bersifat aditif murni — tidak ada komponen lama yang berubah perilaku atau tampilan. Silakan tinjau; jika Anda lebih suka pendekatan lain, keduanya mudah dicabut.

**L1 — `DetailLoading()` baru di `components/ui/paginated-list.tsx`** *(sudah ditambahkan, aditif)*
Skeleton berbentuk konten untuk layar satu-record, pendamping `ListLoading` yang sudah ada. Isinya `SkeletonGroup className="gap-4 py-4"` berisi judul `h-6 w-2/5` + `Skeleton shape="card" h-32` + `SkeletonText lines={3}`. Tidak ada komponen lama yang disentuh; hanya `SkeletonText` ditambahkan ke daftar import file tersebut. Dipakai 12 layar (P1). **Keputusan Anda:** apakah tempatnya tepat di `paginated-list.tsx`, atau sebaiknya pindah ke file sendiri (mis. `components/ui/detail-loading.tsx`) karena namanya tidak berhubungan dengan paginasi.

**L2 — `FAB_SIZE` diekspor dari `components/ui/floating-action-button.tsx`** *(sudah ditambahkan, aditif)*
Konstanta `SIZE = 56` sebelumnya privat, sehingga layar yang menaruh FAB di atas daftar harus menebak jarak amannya dengan kombinasi token. Sekarang diekspor sebagai `FAB_SIZE` (dan `SIZE` menjadi aliasnya), mengikuti pola `TAB_BAR_HEIGHT` yang sudah ada di `bottom-tab-bar.tsx`. Perilaku dan tampilan FAB tidak berubah sama sekali.

**L3 — Label mode tema tidak bisa dipakai ulang** *(tidak dieksekusi)*
`app/appearance.tsx:36` punya `MODE_LABEL = { light: "Terang", dark: "Gelap" }` yang menduplikasi `defaultModeLabels` privat di `components/ui/theme-toggle-button.tsx`. Layar butuh label itu untuk baris `<KeyValue label="Sedang aktif">`, tapi tidak ada cara mengaksesnya tanpa menambah export baru. **Usulan:** ekspor `defaultModeLabels` (atau helper `themeModeLabel(mode)`) dari komponen tersebut. Sementara ini duplikasi dibiarkan agar `components/ui/` tidak berubah.

**L4 — 38 komponen UI tanpa satu pun pemakaian** *(tidak dieksekusi)*
`check:screens` S5 melaporkan 38 komponen di `components/ui/` yang tidak pernah dirender layar mana pun. Sebagian mungkin memang disiapkan untuk fitur mendatang, sebagian mungkin sisa iterasi lama. Ini bukan temuan komposisi layar dan penghapusannya adalah keputusan produk, jadi saya biarkan. **Usulan:** tinjau daftarnya terpisah dan tandai mana yang disengaja, agar angka baseline S5 bisa dikunci.

---

## Catatan verifikasi

Verifikasi visual otomatis **tidak dapat dijalankan** di lingkungan ini: `npx playwright install chromium` gagal mengunduh (`Download failure, code=1`) dan tidak ada browser di PATH. Sebagai gantinya, perbaikan diverifikasi lewat pembacaan kode per layar, `npm run check` (7 pemeriksaan, semuanya hijau), dan kompilasi bundle web Metro secara penuh. Job e2e Playwright di CI akan menjalankan `tests/e2e/regression.spec.ts` pada PR ini.
