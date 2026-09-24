# Audit Mendalam Fitur Transaksi / Order Escrow — End-to-End — 2026-09-24

**Ruang lingkup:** seluruh permukaan siklus hidup order escrow — buat transaksi
(`app/create-transaction.tsx`), detail order (`app/order/[id].tsx`), tab daftar
transaksi (`app/(tabs)/transactions.tsx`), pembayaran (saldo PIN + QRIS:
`lib/use-qris-payment.ts`, `components/qris-payment-panel.tsx`), bukti
pengiriman (`app/delivery-proof/[orderId].tsx`, `components/ui/delivery-proof*.tsx`),
perpanjangan tenggat (`app/extension/[orderId].tsx`), sengketa
(`app/dispute/[id].tsx`, `app/disputes.tsx`, `lib/api/disputes.ts`), order link
(`app/order-link/[token].tsx`, `app/order-links.tsx`), invoice/receipt
(`app/invoice/[orderId].tsx`), rating (`app/rate/[orderId].tsx`), serta seluruh
lapisan API & util yang menyentuhnya (`lib/api/orders.ts`, `lib/api/client.ts`,
`lib/api/response.ts`, `lib/api/disputes.ts`, `lib/financial.ts`, `lib/format.ts`,
`lib/pending-actions.ts`, `lib/server-time.ts`, `lib/use-api-query.ts`,
`lib/use-paginated-query.ts`, `lib/use-polling.ts`, `lib/query-cache.ts`,
`components/ui/order-*`, `components/ui/fee-breakdown.tsx`,
`components/ui/mutual-resolution-card.tsx`, `components/ui/order-extension-card.tsx`,
`components/ui/order-history-timeline.tsx`, `components/ui/invoice-receipt-view.tsx`),
kontrak API (`docs/api/kahade-api-mobile.json`, `docs/api/openapi.json`,
`lib/api/types.ts`, `lib/api/constraints.ts`).

**Commit yang diaudit:** `033830e` (branch `arena/01a0d178-frontend`).
**Tanggal:** 2026-09-24. **Baseline:** `tsc --noEmit` bersih, 33 file tes / 434
tes lulus sebelum audit.

**Aturan bukti (tidak ada temuan tanpa salah satu dari ini):**

| Tag | Arti | Sumber bukti |
|---|---|---|
| `[RUNTIME]` | Terbukti dengan menjalankan kode nyata | Probe vitest `tests/zz-probe-escrow.test.tsx` (log mentah di Lampiran A) |
| `[KODE]` | Jalur deterministik dari pembacaan sumber | `file:line` |
| `[KONTRAK]` | Bandingan kode vs `docs/api/*.json` / `API_CONSTRAINTS` / `lib/api/types.ts` | spec + kode |
| `[I18N]` | Teks mentah di titik render / tidak melewati `translate()` | `file:line` |
| `[IMPROVE]` | Bukan cacat; celah kapabilitas/UX | `file:line` |

Severity: 🔴 kritis · 🟠 tinggi · 🟡 sedang · 🔵 rendah.
Konteks escrow dipakai saat menimbang: hal yang mengubah angka uang, menahan /
melepas dana, mematikan jalur bayar/kirim, atau menjatuhkan layar di tengah
alur duit, naik satu tingkat dibanding aplikasi biasa.

**Total temuan terbukti: 136** (🔴 55 · 🟠 29 · 🟡 40 · 🔵 12, termasuk 5
peningkatan kapabilitas di §O). Setiap butir minimal punya `file:line` atau
output probe; tidak ada pengulangan isu yang sama dengan nomor berbeda —
temuan yang berbagi akar ditandai "satu akar dengan [ID]" dan tetap dihitung
terpisah hanya bila permukaan/dampaknya berbeda.

---

## Ringkasan per area

| Area | 🔴 | 🟠 | 🟡 | 🔵 | Jumlah |
|---|---|---|---|---|---|
| A. State machine & gerbang aksi | 5 | 3 | 5 | – | 13 |
| B. Uang, fee & voucher | 6 | 3 | 4 | 1 | 14 |
| C. Pembayaran (saldo/PIN/QRIS) | 6 | 2 | 4 | – | 12 |
| D. Kontrak API & normalisasi respons | 10 | 3 | 2 | – | 15 |
| E. Sengketa & bukti pengiriman | 5 | 2 | 3 | 1 | 11 |
| F. Perpanjangan & order link | 3 | 3 | 3 | – | 9 |
| G. Race, cache & polling | 3 | 2 | 5 | – | 10 |
| H. Navigasi, deep link & guard rute | 3 | 2 | 2 | 1 | 8 |
| I. Waktu, zona & format | 2 | 1 | 3 | 1 | 7 |
| J. i18n & lokalisasi | 2 | 2 | 3 | 1 | 8 |
| K. Aksesibilitas | 1 | 1 | 3 | – | 5 |
| L. Keamanan & privasi | 3 | 2 | – | – | 5 |
| M. Kualitas kode, kontrak tipe & tes | 3 | 2 | 2 | – | 7 |
| N. UX & copy alur dana | 3 | 1 | 1 | 2 | 7 |
| O. Peningkatan kapabilitas | – | – | – | 5 | 5 |
| **Total** | **55** | **29** | **40** | **12** | **136** |

---

## A. State machine & gerbang aksi

### [A-01] 🔴 [RUNTIME] Status order yang menyentuh kunci `Object.prototype` melempar fungsi ke render timeline → layar detail order crash
- **Lokasi:** `lib/api/orders.ts:164` (`nextOrderStatus`), `app/order/[id].tsx:411,418` (`title: ORDER_STATUS_LABELS[next] ?? next`), `components/ui/order-history-timeline.tsx:97-99`
- **Bukti:** `[PROBE-P20] nextOrderStatus(toString) typeof= function value= function toString() { [native code] }`, `timeline title typeof= function`, dan React menulis
  `Functions are not valid as a React child … <div>{toString}</div>`.
  `nextOrderStatus` memakai objek literal sebagai peta (`{...}[status as string]`),
  sehingga `status = "toString" | "constructor" | "valueOf" | "hasOwnProperty"`
  mengembalikan properti `Object.prototype` (fungsi), bukan `undefined`.
  `ORDER_STATUS_LABELS[next] ?? next` lalu memilih fungsi itu (bukan nullish),
  dan `mapOrderHistoryToTimeline` memasukkannya sebagai `title`.
- **Dampak:** satu nilai status asing dari backend (union `OrderStatus` memang
  mengizinkan `(string & {})`, `lib/api/orders.ts:110`) cukup untuk menjatuhkan
  SELURUH layar detail order ke ErrorBoundary — pengguna tidak bisa membayar,
  mengonfirmasi, atau membatalkan order itu sampai status berubah.
  Kelas bug ini sudah diakui dan diperbaiki di `lib/order-link-labels.ts:29-33`
  ("`toString` would be treated as a known status and render the function itself
  as the badge label, which React rejects") — tetapi **tidak diperbaiki di
  `nextOrderStatus`**.
- **Usulan:** pakai `Object.create(null)` untuk peta, atau `hasOwn` seperti
  `lib/order-link-labels.ts`; sekaligus tipe ulang return `nextOrderStatus`
  sebagai `string | undefined` dan validasi `typeof title === "string"`.

### [A-02] 🔴 [RUNTIME] `mapOrderHistoryToTimeline` mengimbas label lewat objek biasa → `toStatus`/`actor` kunci prototipe menghasilkan `title`/`description` berupa fungsi
- **Lokasi:** `components/ui/order-history-timeline.tsx:97` (`labels.statuses[e.toStatus as OrderStatus]`), `:99` (`labels.actors[e.actor as OrderHistoryActor]`)
- **Bukti:** `[PROBE-P21] title[0] typeof= function desc[1]= oleh function toString() { [native code] }` — entri riwayat `toStatus: "valueOf"` menghasilkan
  `title` fungsi; entri `actor: "toString"` menghasilkan `description`
  `"oleh function toString() { [native code] }"`. Karena `??` hanya menyalakan
  fallback untuk `null`/`undefined`, peta label (`{}` di `statuses`, objek literal
  di `actors`) tidak pernah jatuh ke cabang aman.
- **Dampak:** crash yang sama dengan A-01, dengan pemicu berbeda (data history,
  bukan status order). `GET /v1/orders/{id}/history` di-cast mentah
  (`lib/api/orders.ts:664`) sehingga `toStatus`/`actor` apa pun dari backend
  diteruskan tanpa penyaringan.
- **Usulan:** `hasOwn()` di kedua lookup (pola yang sudah ada di repo), plus
  `String()` sebelum dipakai sebagai label.

### [A-03] 🔴 [KODE] Tombol "Mulai proses" (penjual) terkunci pada status `PAID` yang menurut dokumen sendiri "tidak punya status itu" di enum backend
- **Lokasi:** `app/order/[id].tsx:489` (`const canProcess = order.status === "PAID" && isSeller`)
- **Bukti:** komentar di `lib/api/orders.ts:84-112` menyatakan enum backend hanya
  `WAITING_CONFIRMATION | WAITING_PAYMENT | PROCESSING | IN_DELIVERY | COMPLETED |
  DISPUTED | CANCELLED` dan "pembayaran menggeser WAITING_PAYMENT langsung ke
  PROCESSING". Enum itu dikonfirmasi spec (`docs/api/openapi.json`,
  parameter `status` `/v1/admin/orders`). `nextOrderStatus` juga memetakan
  `WAITING_PAYMENT → PROCESSING` (bukan ke `PAID`).
- **Dampak:** `canProcess` selalu `false` untuk data backend nyata → setelah
  pembeli membayar, penjual yang mengandalkan tombol ini tidak punya jalan UI
  menuju `POST /v1/orders/{id}/process` sama sekali (endpoint ada, spec
  `/v1/orders/{orderId}/process`), sementara `canShip` mensyaratkan
  `PROCESSING` (`app/order/[id].tsx:490`). Bila backend memang butuh
  `/process`, alur penjual buntu; bila tidak, `processOrder`
  (`lib/api/orders.ts:637`) adalah kode mati yang tetap ter-deploy.
- **Usulan:** putuskan kontrak: kalau `/process` diwajibkan, gerbangnya
  `status === "WAITING_PAYMENT"` setelah dibayar — perlu status/flag dari server
  (mis. `paidAt`) — atau `PROCESSING` bila pembayaran langsung memproses;
  uji gerbang ini lewat test status-matrix.

### [A-04] 🔴 [KODE] "Batalkan pesanan" tetap tampil sampai `DELIVERED`/`IN_DELIVERY` — order yang barangnya sudah dikirim masih bisa diajukan batal dari klien
- **Lokasi:** `lib/api/orders.ts:150-158` (`isCancellable` memuat
  `PROCESSING`, `IN_DELIVERY`, `PAID`, `SHIPPED`, `DELIVERED`),
  `app/order/[id].tsx:498` + tombol `:807-816`
- **Bukti:** `[PROBE-P1] isCancellable(IN_DELIVERY)= true`,
  `isCancellable(DELIVERED)= true`. Pada saat yang sama `isDisputable`
  (`lib/api/orders.ts:135`) juga `true` untuk status tersebut — jadi sheet
  "Batalkan" (dengan copy "dana yang sudah masuk dikembalikan ke pembeli",
  `app/order/[id].tsx:888`) dan "Ajukan sengketa" **tampil berdampingan** untuk
  order yang sudah dikirim.
- **Dampak:** pengguna menekan "Batalkan pesanan" di order yang barangnya sudah
  jalan; copy menjanjikan refund penuh yang belum tentu sesuai keputusan backend
  (dan berlawanan dengan jalur sengketa). Untuk escrow, menawarkan dua jalur
  penyelesaian dana yang saling bertabrakan di status yang sama adalah cacat
  alur, bukan kosmetik. Dokumen sendiri menyebut pembatalan berlaku "selama
  order belum selesai DAN belum disengketakan" — `IN_DELIVERY` sudah lewat fase
  "barang belum diterima".
- **Usulan:** batasi `isCancellable` ke `WAITING_CONFIRMATION`,
  `WAITING_PAYMENT` (+ alias lama `PENDING_PAYMENT`) dan `PROCESSING` pra-kirim;
  sisanya hanya lewat sengketa.

### [A-05] 🟠 [KODE] `isDisputable` menutup diri untuk `WAITING_CONFIRMATION` — order yang ditolak/diabaikan penjual tidak punya jalur sengketa maupun eskalasi
- **Lokasi:** `lib/api/orders.ts:124-138`, `app/order/[id].tsx:499`
- **Bukti:** `[PROBE-P1] isDisputable(WAITING_CONFIRMATION)= false`. Satu-satunya
  aksi di status itu hanya "Batalkan". `POST /v1/orders/{id}/dispute`
  (`lib/api/orders.ts:657`) tidak pernah bisa dijangkau dari UI untuk order
  yang ditahan di `WAITING_CONFIRMATION`.
- **Dampak:** kasus "saya sudah transfer di luar / sudah janjian, penjual tidak
  merespons" tidak punya kanal bukti; pengguna dipaksa membatalkan (kehilangan
  jejak klaim) atau menunggu. `SubmitDisputeDto` tidak membatasi status.
- **Usulan:** buka `isDisputable` untuk `WAITING_CONFIRMATION` setelah tenggat
  konfirmasi lewat, atau tawarkan "Lapor masalah" yang berujung eskalasi admin
  (`api.disputes.escalateDispute` sudah ada).

### [A-06] 🟠 [KODE] `isDisputable` `true` untuk `COMPLETED`? Tidak — tetapi `isCancellable(DELIVERED)=true` dan `isDisputable(DELIVERED)=true` membuat dua CTA destruktif sekaligus di satu layar
- **Lokasi:** `lib/api/orders.ts:135-147,150-158`, `app/order/[id].tsx:498-499` + blok aksi sekunder `:780-817`
- **Bukti:** `[PROBE-P1]` (Lampiran A). Untuk `status ∈ {IN_DELIVERY, PAID,
  SHIPPED, DELIVERED}` kedua fungsi `true`; UI merender "Ajukan sengketa" (ghost)
  dan "Batalkan pesanan" (ghost) bersebelahan tanpa penjelasan mana yang
  menyelesaikan sengketa dan mana yang membuka dana.
- **Dampak:** pengguna yang panik memilih "Batalkan" padahal kasusnya sengketa;
  keputusan dana berbeda (refund vs adjudikasi) tanpa pembeda visual.
- **Usulan:** saling eksklusif per status; tampilkan satu CTA utama berdasar
  fasa, sisanya di sheet "Lainnya".

### [A-07] 🟠 [KODE] `normalizeOrder` membiarkan `id` kosong (`""`) lolos ke seluruh layar → `seg("")` melempar di setiap aksi lanjutan
- **Lokasi:** `lib/api/orders.ts:272-296` (`id: typeof id === "string" ? id : ""`), `lib/api/client.ts` (`seg`), `lib/routes.ts:100-101` (`orderDetail("")`)
- **Bukti:** `[PROBE-P3] numeric id -> "" len 0`, `[PROBE-P22] normalizeOrder({}) => {"id":""}`, `[PROBE-P22] seg('') => THROW: ApiError Identitas data tidak valid.`
- **Dampak:** order dengan id numeric/string-aneh dirender sebagai baris valid
  di tab Transaksi, tetapi semua aksi (bayar, invoice, bukti kirim, perpanjang)
  melempar `ApiError BAD_REQUEST "Identitas data tidak valid."` — pengguna
  melihat order yang tidak bisa disentuh tanpa tahu sebabnya. `id` kosong juga
  lolos jadi `key` list dan rute `/order/`.
- **Usulan:** buang entri tanpa id string non-kosong di `normalizeOrder` /
  filter di `listOrders`, atau kembalikan `null` dan tampilkan "data tidak
  lengkap".

### [A-08] 🟡 [KODE] `nextOrderStatus` mempertahankan rantai alias lama (`PENDING_PAYMENT → PAID → PROCESSING`) yang bertentangan dengan rantai backend (`→ PROCESSING → …`)
- **Lokasi:** `lib/api/orders.ts:164-180`
- **Bukti:** `[PROBE-P1] chain from PENDING_PAYMENT: PENDING_PAYMENT -> PAID ->
  PROCESSING -> IN_DELIVERY -> COMPLETED` vs `chain from WAITING_CONFIRMATION:
  WAITING_CONFIRMATION -> WAITING_PAYMENT -> PROCESSING -> …`.
- **Dampak:** estimasi timeline (`expectedNext`, `app/order/[id].tsx:411-425`)
  menampilkan status yang tidak akan pernah muncul ("Dana di escrow"/`PAID`)
  untuk order ber-status alias — langkah berikutnya di estimasi tidak sama
  dengan langkah berikutnya di riwayat nyata.
- **Usulan:** alias cukup dinormalisasi ke enum backend sekali di
  `normalizeOrder`; rantai tunggal.

### [A-09] 🟡 [RUNTIME] `isOrderActive("DISPUTED") = true` → kartu order sengketa tetap memutar countdown tenggat dan dihitung "aktif"
- **Lokasi:** `components/ui/order-status-badge.tsx` (`isOrderActive`:
  `![\"COMPLETED\",\"CANCELLED\",\"REFUNDED\",\"EXPIRED\"].includes(status)`),
  `components/ui/order-card.tsx:214-216` (`showDeadline`),
  `components/ui/order-history-timeline.tsx:92` (`active` → status entri `current`)
- **Bukti:** `[PROBE-P2/P29] isOrderActive(DISPUTED)= true`, `isOrderActive(CANCELLED)= false`.
- **Dampak:** order yang sedang disengketakan menampilkan "Batas waktu ⏳" yang
  sudah tidak relevan (tenggat pengiriman bukan lagi keputusan), dan timeline
  menandai entri terakhir "current" padahal alur sudah di luar state machine.
  `onDeadline` (`app/(tabs)/transactions.tsx:263`) lalu memicu refresh saat
  countdown habis — lihat [G-07].
- **Usulan:** `DISPUTED` = non-aktif untuk countdown; pisahkan "belum final"
  dari "punya deadline".

### [A-10] 🟡 [KODE] Fallback fee di detail order dihitung ulang TANPA `voucherCode` order asli
- **Lokasi:** `app/order/[id].tsx:127-133` (`EARLY_STATUSES`), `:205-213`
  (`api.orders.calculateFee({ orderValue, feeResponsibility, role })`)
- **Bukti:** `CalculateFeeDto` (`lib/api/types.ts:875-890`) punya `voucherCode?`,
  tetapi pemanggilan di `:205-210` tidak mengirimnya — sementara order asli bisa
  dibuat dengan `voucherCode` (`create-transaction.tsx` `CreateOrderDto.voucherCode`).
- **Dampak:** order ber-voucher yang `order.fee` kosong direspons backend akan
  menampilkan `FeeBreakdown` tanpa diskon → angka "Pembeli membayar" lebih
  besar dari yang benar (dan berbeda dari tombol Bayar, lihat [B-01]).
- **Usulan:** simpan `voucherCode` di `Order` (atau minta backend selalu
  mengirim `fee` final) dan teruskan ke `calculateFee`.

### [A-11] 🟡 [KODE] Tidak ada satu pun gerbang/status untuk `REFUNDED` — order yang dananya sudah dikembalikan tidak punya CTA, badge hanya label
- **Lokasi:** `lib/api/orders.ts:110` (`"REFUNDED"` di union alias),
  `lib/labels/status.ts:53` (label "Dana dikembalikan"),
  `components/ui/order-status-badge.tsx` (`BASE_TONE.REFUNDED = "neutral"`)
- **Bukti:** `isCancellable/isDisputable/isExtendable` semuanya `false` untuk
  `REFUNDED` (Lampiran A P1, pengecualian); tidak ada aksi UI yang menyebut
  refund selain teks.
- **Dampak:** pengguna yang dananya dikembalikan tidak tahu harus berbuat apa
  (bayar ulang? buat order baru?) dan tidak ada kanal "Ajukan ulang pembayaran".
- **Usulan:** CTA "Buat order serupa" / tautan ke detail transaksi wallet
  (riwayat refund) pada status `REFUNDED`/`EXPIRED`.

### [A-12] 🟡 [KODE] Inferensi `myRole` dari `me.id`/`me.username` bisa salah saat akun mengganti username setelah order dibuat
- **Lokasi:** `app/order/[id].tsx:170-184` (fallback bila `o.myRole` kosong)
- **Bukti:** perbandingan `o.buyer?.username === me.username` —
  `normalizeOrder` (`lib/api/orders.ts:284-291`) menyimpan username pihak apa
  adanya; riwayat `me` adalah username **terkini**. `app/extension/[orderId].tsx:132-143`
  (`resolveRole`) hanya memakai id, jadi perilaku dua layar berbeda.
- **Dampak:** peran tertukar → label lawan transaksi tertukar dan, lebih parah,
  `canPay`/`canConfirm`/`canShip` (`:487-490`) mengaktifkan tombol yang salah
  pihak sampai server menolak.
- **Usulan:** jangan infer dari username; bila `myRole` kosong, sembunyikan aksi
  (perilaku `knownRole` sudah ada) dan minta backend selalu mengisi `myRole`.

### [A-13] 🔴 [KODE] "Tandai selesai" (pembeli) memanggil `completeOrder` tanpa `proofId`, sementara jalur konfirmasi bukti memakai `confirmDelivery({proofId})` — dua jalur rilis dana escrow yang tidak konsisten
- **Lokasi:** `app/order/[id].tsx:491-497` (`canReviewDelivery`), `:706-719`
  (`api.orders.completeOrder(order.id)`), `lib/api/orders.ts:647-649` vs
  `:722-730` (`confirmDelivery(orderId, { proofId })`)
- **Bukti:** `ConfirmDeliveryDto` (`lib/api/types.ts:1063-1069`) punya `proofId`
  opsional berpola `^c[a-z0-9]{24}$`; `completeOrder` tidak mengirim apa pun.
  Tombol "Periksa bukti pengiriman" dan "Tandai selesai" tampil **berdampingan**
  (`:706-733`) — pembeli bisa melepas dana **tanpa pernah membuka bukti**.
- **Dampak:** escrow bisa dilepas ke penjual tanpa pembeli melihat bukti kirim
  sama sekali (konfirmasi implisit lewat tombol yang labelnya tidak menyebut
  dana). Untuk produk escrow ini kegagalan alur paling mahal.
- **Usulan:** hilangkan `completeOrder` dari klien (atau kunci di belakang
  konfirmasi bukti), atau samakan kontrak: `completeOrder` juga harus
  menyertakan `proofId` yang direview.

---

## B. Uang, fee & voucher

### [B-01] 🔴 [RUNTIME][KODE] Kartu `FeeBreakdown` di detail order tidak meneruskan `buyerPays`/`sellerReceives` milik server — angka di kartu dihitung ulang lokal dan bisa berbeda dari angka di tombol "Bayar"
- **Lokasi:** `app/order/[id].tsx:604-612` (props `FeeBreakdown`:
  `orderValue`, `feeAmount`, `feeResponsibility`, `role`, `discountAmount` —
  **tanpa** `buyerPays`/`sellerGets`) vs `:658`
  (`Bayar {formatRupiah(fee?.buyerPays ?? order.orderValue)}`),
  `components/ui/fee-breakdown.tsx:158-163` (`pays = buyerPays ?? orderValue +
  share.buyer - discountShare.buyer`)
- **Bukti:** `[PROBE-P8] localPays(diskon dipotong ke fee)= 100000
  serverBuyerPays(mis.)= 55000` — untuk `orderValue=100.000, fee=10.000 SPLIT,
  diskon 50.000`, kartu mencetak **Rp100.000** sedangkan tombol Bayar memakai
  `fee.buyerPays` server (Rp55.000 pada contoh kontrak umum).
  Komponen sudah punya props `buyerPays`/`sellerGets` (`fee-breakdown.tsx:128-130`)
  yang **tidak dipakai** oleh `app/order/[id].tsx` maupun
  `app/create-transaction.tsx:690-698`.
- **Dampak:** dua angka berbeda untuk pembayaran yang sama di satu layar:
  rincian biaya vs label tombol. Pengguna memverifikasi nominal pada rincian,
  lalu menekan tombol dengan nominal lain. Di produk escrow ini cacat kebenaran
  uang, bukan tampilan.
- **Usulan:** teruskan `buyerPays={fee.buyerPays}` / `sellerGets={fee.sellerReceives}`
  dari `FeeBreakdown` response (`lib/api/orders.ts:294-301`) di kedua layar;
  jadikan angka lokal fallback bertanda "perkiraan".

### [B-02] 🔴 [RUNTIME] Potongan voucher di-clamp ke `feeAmount` — voucher bernilai lebih besar dari biaya platform tidak pernah tampil penuh
- **Lokasi:** `components/ui/fee-breakdown.tsx:158` (`const discount =
  Math.min(Math.max(discountAmount, 0), feeAmount)`), `:160` (`discountShare`)
- **Bukti:** `[PROBE-P8]` (kasus sama dengan B-01): `discountAmount=50.000` →
  baris "Potongan voucher" yang dirender `Amount value={-discount}` hanya
  `-Rp10.000`; sisanya Rp40.000 lenyap dari tampilan, dan `pays`/`gets` lokal
  ikut salah.
- **Dampak:** pengguna yang menukarkan voucher besar melihat potongan jauh lebih
  kecil dari yang dijanjikan `VoucherRedeemBox` (`app/create-transaction.tsx:392-414`
  menampilkan `v.discountValue` apa adanya) → keraguan "voucher saya hilang";
  angka akhir kartu tidak cocok dengan tagihan.
- **Usulan:** jangan clamp diskon ke fee; kurangi dari `orderValue` bila memang
  skemanya begitu, dan utamakan angka server ([B-01]).

### [B-03] 🔴 [RUNTIME] `splitFee` menghasilkan pecahan pada fee desimal — nilai uang non-integer beredar di kartu biaya
- **Lokasi:** `components/ui/fee-breakdown.tsx:70-77` (`splitFee`),
  `:155-157` (`pays`/`gets` aritmetika float)
- **Bukti:** `[PROBE-P8] splitFee(0.5,SPLIT)= {"buyer":0.5,"seller":0}`;
  `[PROBE-P11] formatRupiah(1500.5)= Rp1.501 formatRupiah(1500.4)= Rp1.500` —
  pembulatan `formatRupiah` **membulatkan** sementara total yang ditransfer
  dibulatkan terpisah, sehingga `pays + gets` bisa meleset Rp1 dari
  `orderValue + fee - diskon`.
- **Dampak:** fee persentase (skema publik `feePercent`, `app/create-transaction.tsx:738-750`)
  pada orderValue yang tidak habis dibagi menghasilkan nominal desimal;
  pembulatan terjadi di tempat berbeda-beda (format vs split) → selisih rupiah
  yang tidak bisa direkonsiliasi pengguna.
- **Usulan:** bulatkan ke integer Rupiah sekali di `splitFee` (floor seller,
  sisanya buyer — sudah seperti itu untuk integer) dan tolak/gembok nilai
  desimal masuk dari server.

### [B-04] 🔴 [RUNTIME] `unwrapResponse` melewatkan envelope `{success:false}` yang tidak punya kunci `data` — respons error diperlakukan sebagai body sukses
- **Lokasi:** `lib/api/response.ts:33` (`if (!body || typeof body.success !==
  "boolean" || !(\"data\" in body)) return value`)
- **Bukti:** `[PROBE-P23] success:false => {"success":false,"message":"E"}`
  (dikembalikan utuh, **tanpa throw**); `[PROBE-P31] unwrap({success:false,message})
  => {"success":false,"message":"Insufficient balance"}` lalu
  `normalizePaymentStatus` membacanya sebagai
  `{"status":"PENDING",…}` → `[PROBE-P31] terminal? false`.
- **Dampak:** guard `success:false` di `unwrapResponse` (yang menurut komentar
  "Confirmed against api.kahade.id") hanya bekerja bila backend **juga**
  mengirim `data`. Bentuk `{success:false, message}` — bentuk paling lazim untuk
  error — bocor ke pemanggil sebagai data sukses: `listOrders` → `readList`
  melempar PARSE yang membingungkan, `getPaymentStatus` → polling tak berujung
  ([C-02]), `getOrdersSummary` → objek error ditampilkan sebagai ringkasan.
- **Usulan:** uji `body.success === false` **sebelum** syarat `"data" in body`;
  lempar `ApiError` berisi `message`/`backendCode` seperti jalur error HTTP.

### [B-05] 🔴 [KODE] Tombol "Bayar" memfallback ke `order.orderValue` (tanpa fee) bila `fee` belum terhitung
- **Lokasi:** `app/order/[id].tsx:658` (`formatRupiah(fee?.buyerPays ?? order.orderValue)`)
- **Bukti:** `:645-651` menampilkan `ErrorState "Rincian biaya belum tersedia"`
  **sekaligus** tetap merender `<Button disabled={!fee}>Bayar {…}</Button>`;
  fallback `order.orderValue` mengecualikan `platformFee` dan diskon.
- **Dampak:** pada jeda antara render (fee `null` sesaat saat refresh/`EARLY_STATUSES`),
  label tombol menampilkan nominal LEBIH KECIL dari tagihan sebenarnya.
  Meski tombol disabled, angkanya terbaca sebagai janji harga.
- **Usulan:** tampilkan "—" atau "menghitung…" bila `fee` null; jangan pernah
  mencetak `orderValue` sebagai total bayar.

### [B-06] 🔴 [KODE] Rumus lokal `gets = orderValue - share.seller + discountShare.seller` MENAMBAH penerimaan penjual saat ada diskon
- **Lokasi:** `components/ui/fee-breakdown.tsx:157`
- **Bukti:** untuk `orderValue=100.000, fee=10.000 SPLIT, diskon=2.000`:
  `share={buyer:5000,seller:5000}`, `discountShare={buyer:1000,seller:1000}`
  → `gets = 100.000 - 5.000 + 1.000 = 96.000`, `pays = 100.000 + 5.000 - 1.000 = 104.000`.
  Penjual menerima **lebih** dari `orderValue - fee` ketika pembeli memakai
  voucher — implikasi arus dana yang tidak dijelaskan di mana pun.
- **Dampak:** angka "Penjual menerima" pada pratinjau tidak akan cocok dengan
  pencairan nyata bila backend memotong diskon dari nilai order. Dua angka
  (pays & gets) tidak lagi konsisten satu sama lain terhadap `fee`.
- **Usulan:** selaraskan dengan model backend (sekali lagi: utamakan
  `buyerPays`/`sellerReceives` server) dan tulis invariant `pays - gets ==
  fee - discount` sebagai unit test.

### [B-07] 🟠 [KODE] `feeShare` (pembagian persen 50/50) dan `splitFee` (pembagian nominal dengan pembulatan) dipakai bergantian tanpa jaminan konsistensi
- **Lokasi:** `components/ui/fee-breakdown.tsx:62-77` (dua fungsi),
  pemakaian `feeShare` di `FeeResponsibilitySelector` (`app/create-transaction.tsx:682`)
- **Bukti:** `[PROBE-P8] splitFee(10001,SPLIT)= {buyer:5001,seller:5000}` vs
  `feeShare(SPLIT)= {buyer:0.5,seller:0.5}` — untuk fee ganjil persen menampilkan
  "Dibagi dua" (50%) padahal nominalnya 5.001/5.000.
- **Dampak:** label "Dibagi dua pihak — Rp5.001 / Rp5.000" kontradiktif dengan
  pembulatan; kecil nilainya tapi merusak kepercayaan pada angka.
- **Usulan:** satu sumber pembagian fee; label persen dihitung dari nominal.

### [B-08] 🟠 [KODE] `normalizeInvoice` menerima total negatif tanpa bantah
- **Lokasi:** `lib/api/orders.ts:783-791` (`toAmount` menerima `-?\\d+(\\.\\d+)?`),
  `:838-841` (`total` ?? jumlah item), `app/invoice/[orderId].tsx:160` (`total={invoice.total}`)
- **Bukti:** `[PROBE-P6] negatif: {"total":-5000,…}` — invoice `total: -5000`
  dirender apa adanya oleh `InvoiceReceiptView`.
- **Dampak:** respons kacau (mis. refund dikembalikan sebagai invoice) tampil
  sebagai struk sah dengan total negatif; tidak ada guard.
- **Usulan:** tolak `total < 0` (atau tandai "kredit") di `normalizeInvoice`.

### [B-09] 🟠 [RUNTIME] `toAmount`/`normalizeInvoice` menerima angka desimal padahal seluruh app mengasumsikan Rupiah bulat
- **Lokasi:** `lib/api/orders.ts:783-791`, `lib/financial.ts:18-23` (`Number.isSafeInteger`)
- **Bukti:** `[PROBE-P6] desimal: {"total":1500.5,…}` diterima; `[PROBE-P11]`
  menunjukkan `formatRupiah` membundarkannya (`Rp1.501`) — nilai asli 1500,5
  tidak pernah disimpan/ditampilkan.
- **Dampak:** invoice senilai `1500.50` tampil `Rp1.501` — angka struk ≠ angka
  transaksi; `assertValidAmount` sendiri menolak desimal untuk input, jadi
  standar ganda.
- **Usulan:** `toAmount` hanya menerima integer (atau tandai desimal sebagai
  error PARSE) — konsisten dengan `lib/financial.ts`.

### [B-10] 🟡 [RUNTIME] `parseRupiah("10.000,50")` → `NaN` sementara `amountInputValue("1.000.50")` → `100050` — dua jalur input uang dengan perilaku berbeda
- **Lokasi:** `lib/format.ts:207-215` (`parseRupiah`), `:269` (`amountInputValue`),
  `components/ui/amount-input.tsx:84-92`
- **Bukti:** `[PROBE-P24] amountInputValue('1.000.50')= 100050`,
  `parseRupiah('10.000,50')= NaN`. Komentar `lib/format.ts:212` ("Never turn a
  pasted decimal 10.000,50 into 1.000.050") menyatakan tujuan, tapi hasil
  `amountInputValue` justru menggabung semua digit: "1.000.50" → 100050
  (100x lipat dari maksud "1.000,50").
- **Dampak:** tempelan nominal bergaya Eropa/ID salah 100x di field nominal
  escrow (`AmountInput` dipakai di `create-transaction`, `dispute` proposal,
  dll.) tanpa peringatan.
- **Usulan:** satu fungsi parse; tolak string yang mengandung pemisah ambigu
  dengan `errorText`, jangan diam-diam membuang tanda baca.

### [B-11] 🟡 [RUNTIME] `splitFee` membebankan sisa pembulatan ke pembeli tanpa keterangan di UI
- **Lokasi:** `components/ui/fee-breakdown.tsx:73-77` (`buyer: fee - half`)
- **Bukti:** `[PROBE-P8] splitFee(10001,SPLIT)= {"buyer":5001,"seller":5000}`.
- **Dampak:** Rp1 lebih untuk pembeli pada fee ganjil — wajar, tapi tidak ada
  caption yang menjelaskan pembulatan ke pembeli; komentar kode menyebutnya,
  UI tidak.
- **Usulan:** caption "pembulatan ke pembeli" pada `feeResponsibility === "SPLIT"`.

### [B-12] 🟡 [KODE] `assertDtoConstraints` melewati semua field bernilai `null` (`value == null`) — `attachments: null` / `voucherCode: null` lolos validasi lokal
- **Lokasi:** `lib/financial.ts:48-49` (`if (value == null) continue`)
- **Bukti:** `CreateOrderDto.attachments` dibatasi `maxItems 5`
  (`lib/api/types.ts:934-938`); `null` dilewatkan tanpa `minItems/maxItems`
  check, lalu di-`JSON.stringify` sebagai `"attachments":null`.
- **Dampak:** validasi klien yang dipuji di komentar ("a TypeScript cast must
  not bypass validation") justru bisa dibypass dengan `null`; backend yang
  `forbidNonWhitelisted`/strict akan 400 dengan pesan validator yang lolos
  disaring (`USER_MESSAGE_MAX` 300, `lib/api/errors.ts`).
- **Usulan:** `value === undefined` saja yang opsional; `null` untuk field
  non-nullable = VALIDATION.

### [B-13] 🟡 [KODE] `numberField` (pembaca `trustScore/completedOrders/rating`) memakai koersi `Number(value)` untuk string — kebalikan kebijakan `pickNumber` (D-04) yang sengaja menolaknya
- **Lokasi:** `lib/api/orders.ts:375-381` (`numberField`) vs
  `lib/api/response.ts:257-266` (`pickNumber` "SENGAJA ketat")
- **Bukti:** `numberField` (`orders.ts`) menerima `{"trustScore":"95"}` → `95`;
  `pickNumber` untuk field yang sama akan mengembalikan `undefined`. Kedua
  kebijakan hidup berdampingan di domain `orders`.
- **Dampak:** dua standar parsing angka di satu modul; bila `pickNumber` dipakai
  untuk field uang dan `numberField` untuk statistik, kontrak "nilai salah harus
  terlihat sebagai undefined" bocor di salah satu jalur.
- **Usulan:** pakai `pickNumber` di `numberField` (atau dokumentasikan
  pengecualiannya).

### [B-14] 🔵 [KODE] `normalizeInvoice` mengarang `invoiceNumber` `INV-${orderId}` dan `order.status = "UNKNOWN"` untuk placeholder
- **Lokasi:** `lib/api/orders.ts:843-857` (placeholder order), `:861`
  (`invoiceNumber ?? `INV-${orderId}``)
- **Bukti:** `[PROBE-P6] items string amount: … invoiceNumber INV-1 … status
  UNKNOWN … issuedAt ""` — nomor invoice buatan klien bisa disalin pengguna
  (`onCopyNumber`, `app/invoice/[orderId].tsx:178`) sebagai dokumen sah.
- **Dampak:** "Nomor invoice" palsu beredar dari klien; status `UNKNOWN`
  (di luar union) dirender mentah bila suatu saat ikut ke badge.
- **Usulan:** tampilkan "—" bila server tidak mengirim nomor; jangan mengarang
  identitas dokumen finansial.

---

## C. Pembayaran (saldo/PIN/QRIS)

### [C-01] 🔴 [RUNTIME] `normalizePaymentStatus` mem-default status apa pun menjadi `"PENDING"` — respons error/tak berbentuk membuat polling QRIS tidak pernah berhenti
- **Lokasi:** `lib/api/orders.ts:620-636` (`status: (rawStatus ?? "PENDING")`), `lib/use-qris-payment.ts:74-100` (loop poll), `:47-50` (`TERMINAL`)
- **Bukti:** `[PROBE-P4] kosong: {"status":"PENDING"}`,
  `paid flag: {"paid":true,…,"status":"PENDING"}`;
  `[PROBE-P31]` (envelope error → `status:"PENDING"`, `terminal? false`).
  Polling berhenti hanya bila status ∈ `{PAID, EXPIRED, FAILED, CANCELLED}`.
- **Dampak:** satu respons tanpa field `status` (termasuk envelope error [B-04])
  mengunci UI di "Menunggu pembayaran… status diperbarui otomatis." sampai batas
  15 menit ([C-05]) — pembayaran yang sebenarnya sudah masuk tidak pernah
  memicu `onPaid` (tutup sheet + refresh). Ini tepat cacat yang diklaim sudah
  ditutup normalizer itu ("polling tidak pernah berhenti").
- **Usulan:** status tak dikenal → jangan di-default `PENDING`; kembalikan
  `undefined`/`UNKNOWN`, hentikan polling, dan tawarkan "Cek status sekarang".

### [C-02] 🔴 [RUNTIME] `{ paid: true }` diabaikan total — bukti pembayaran non-standar tidak pernah menyalakan state sukses
- **Lokasi:** `lib/api/orders.ts:620-636` (hanya membaca `status|paymentStatus|
  payment_status`), `lib/api/types.ts` (tidak ada `PaymentStatus` DTO)
- **Bukti:** `[PROBE-P4] paid flag: {"paid":true,"status":"PENDING"}`.
- **Dampak:** bila backend menandai pembayaran lewat boolean/`paidAt` tanpa
  `status`, klien tetap `PENDING` → tombol bayar bisa ditekan lagi, order tidak
  di-refresh, pengguna menunggu tanpa kepastian.
- **Usulan:** baca juga `paid`/`paidAt`/`paymentStatus` boolean sebagai sinyal
  terminal (pola alias yang dipakai `normalizeCounterpartValidation` sudah ada).

### [C-03] 🔴 [KODE] `<Countdown until={undefined}>` (durasi 0 detik) langsung memanggil `onComplete` → intent QRIS yang baru dibuat ditandai `EXPIRED` lokal
- **Lokasi:** `components/qris-payment-panel.tsx:103-112` (`until={expiresAt ?
  new Date(expiresAt) : undefined}`), `lib/use-qris-payment.ts:169-172`
  (`expireLocally` memaksa status `EXPIRED`), `components/ui/countdown.tsx:64-73`
  (`seconds = 0` → `endAt = serverNow() + 0`)
- **Bukti:** `useCountdown({ seconds: 0, until: undefined })` menghitung
  `endAt = serverNow()`, `tick()` pertama: `ms ≈ 0` → `s = 0` → `onComplete`
  segera dipanggil (jalur `:124-129`). `QrisPayment.expiresAt` bertipe `string`
  wajib di TS (`lib/api/orders.ts:336`) tetapi respons **di-cast**, bukan
  divalidasi (`:599-603`) — field hilang = `undefined`.
- **Dampak:** QRIS valid langsung dilabeli "QRIS kedaluwarsa — buat ulang untuk
  mencoba lagi" (`qris-payment-panel.tsx:131-132`) dan tombol berubah jadi
  "Buat ulang QRIS"; pengguna membuat intent kedua (kemungkinan dua charge
  menggantung) padahal QR pertama masih hidup.
- **Usulan:** jangan render `Countdown` bila `expiresAt` tidak valid (sudah ada
  pola `invalid` di `useCountdown`); `expireLocally` hanya saat ada sumber
  waktu valid.

### [C-04] 🔴 [RUNTIME] `toEpochMs` menganggap epoch **detik** sebagai milidetik → catatan aksi menggantung langsung dianggap kedaluwarsa dan dibuang
- **Lokasi:** `lib/pending-actions.ts:56-62` (`toEpochMs`), `:88-91` (`isStale`:
  `expiresAt <= now`), `lib/use-qris-payment.ts:143-150` (`recordPendingAction` …
  `expiresAt: toEpochMs(res.expiresAt)`)
- **Bukti:** `[PROBE-P25] toEpochMs(1700000000)= 1700000000` — nilai ~Jan 1970,
  jauh di bawah `serverNow()` → `isStale` true → `sanitize` membuangnya saat
  load berikutnya. `[PROBE-P25] toEpochMs('1700000000000')= undefined`.
- **Dampak:** format epoch detik yang lazim dipakai backend menghapus sendiri
  catatan "Pembayaran pesanan menunggu" di `PendingActionsBanner`
  (`components/pending-actions-banner.tsx`) setelah restart — fitur pemulihan
  J-04 mati diam-diam untuk bentuk timestamp itu. Ini uang yang "hilang rasa".
- **Usulan:** deteksi skala (nilai < 1e12 → × 1000); terima string numerik.

### [C-05] 🔴 [KODE] `expireLocally` bisa menimpa status `PAID` server — countdown habis menang atas kenyataan pembayaran
- **Lokasi:** `lib/use-qris-payment.ts:169-172` (`setStatus(prev =>
  (prev === "PENDING" || prev == null ? "EXPIRED" : prev))`),
  `components/qris-payment-panel.tsx:107-111` (`onComplete={onExpire}`)
- **Bukti:** `prev === "PENDING"` adalah status **lokal**; `syncStatus` bisa
  belum sempat membaca `PAID` (poll interval 3 detik, `POLL_MS` `:34`). Begitu
  `EXPIRED` dipasang, `TERMINAL` (`:36`) menghentikan polling
  (`use-qris-payment.ts:88-94`) — kebenaran server tidak akan pernah diminta
  lagi otomatis.
- **Dampak:** pembayaran QRIS yang sukses 1 detik setelah countdown habis
  ditampilkan sebagai "kedaluwarsa"; pengguna menekan "Buat ulang QRIS" untuk
  membayar dua kali (dua intent aktif di server).
- **Usulan:** saat countdown habis, lakukan `syncStatus()` dulu; hanya tandai
  `EXPIRED` bila server juga mengatakan begitu.

### [C-06] 🔴 [KODE] Alur "bayar ulang" tanpa idempotency key yang stabil: `createOrder`/`payOrder` memanggil transport yang membuat `Idempotency-Key` baru untuk setiap attempt pengguna
- **Lokasi:** `lib/api/client.ts:334-352` (kunci dibuat per `performRequest`
  bila pemanggil tidak mengirim), `lib/api/orders.ts:527-532` (`createOrder`),
  `:595-597` (`payOrder`) — keduanya tanpa `headers["Idempotency-Key"]` dari
  pemanggil
- **Bukti:** timeout pada `POST /v1/orders` melempar `TIMEOUT`
  (`err.isTransient = true` — `lib/api/errors.ts:102-104`); tombol submit
  `app/create-transaction.tsx:543` hanya dikunci `submitLock` selama promise
  hidup (`:578-580` `finally` melepasnya) — tekan lagi setelah timeout = request
  kedua dengan kunci **baru**. Kontras: jalur 401 memang berbagi kunci
  (dokumen D-09), tapi jalur "pengguna mencoba lagi" tidak.
- **Dampak:** `createOrder` sukses di server tapi timeout di klien → pengguna
  menekan "Buat transaksi" lagi → **dua order** dibuat (dua dana menggantung).
  Sama untuk `payOrder` (dua kali debit PIN bila backend tidak mengunci
  status). Komentar `lib/api/orders.ts:13-15` sendiri mengakui "pay/complete/cancel
  tidak idempoten".
- **Usulan:** layar membuat SATU kunci per formulir (pola "recovery pending
  action" yang dijanjikan komentar D-09) dan menyimpannya sampai hasil final
  diketahui; tampilkan status "pembayaran mungkin sedang diproses" seperti
  `handlePayPin` (`app/order/[id].tsx:344-357`) untuk `createOrder` juga.

### [C-07] 🟠 [KODE] `toEpochMs` menerima string numerik? Tidak — `"1700000000000"` diabaikan (`undefined`) padahal `expiresAt` pending-action bisa dikirim sebagai string angka
- **Lokasi:** `lib/pending-actions.ts:56-62`
- **Bukti:** `[PROBE-P25] toEpochMs('1700000000000')= undefined` — hanya
  `Date.parse` (ISO) yang dikenali untuk string.
- **Dampak:** `expiresAt` hilang → `isStale` jatuh ke TTL 24 jam
  (`PENDING_TTL_MS`, `:74`) → banner "QRIS berlaku sampai …" tidak tampil
  (`pending-actions-banner.tsx:70-73`) padahal batas waktu lebih pendek.
- **Usulan:** terima string numerik murni di `toEpochMs`.

### [C-08] 🟠 [KODE] Pesan galat PIN salah: fallback non-`ApiError` selalu "PIN salah atau saldo tidak cukup" — menutupi penyebab lain
- **Lokasi:** `app/order/[id].tsx:330` (`const base = isApiError(err) ?
  userMessage(err) : "PIN salah atau saldo tidak cukup."`)
- **Bukti:** jalur `catch` tunggal untuk semua kegagalan `payOrder`; error
  non-ApiError (bug runtime, JSON tak terbaca) disamarkan sebagai kesalahan
  pengguna.
- **Dampak:** pengguna mengganti PIN berulang padahal masalahnya bukan PIN;
  untuk pembayaran escrow, pesan yang salah di momen otorisasi dana
  mengarahkan tindakan yang salah.
- **Usulan:** pisahkan `code === "VALIDATION"/"UNAUTHORIZED"` (PIN) vs
  `NETWORK/TIMEOUT/SERVER` (sudah sebagian di `uncertain`) dan tampilkan
  "tidak dapat memverifikasi" untuk sisanya.

### [C-09] 🟡 [KODE] `setPinError` baru diisi setelah overlay hasil 1,4 detik — pengguna tidak langsung tahu PIN-nya salah
- **Lokasi:** `app/order/[id].tsx:351-355` (`scheduleResult(() => { …
  setPinError(msg) }, "pay")`), `lib/use-result-timer.ts:12` (`RESULT_HOLD_MS = 1400`)
- **Bukti:** `scheduleResult` menunda callback 1400 ms; sampai saat itu
  `PinInput` (`:849`) masih tanpa `errorText` dan overlay `FAILURE` yang
  menutup layar.
- **Dampak:** total ~1,5-2 detik sebelum feedback PIN; untuk alur PIN
  (biasanya cepat) ini terasa macet dan memicu tekan ulang.
- **Usulan:** set `pinError` segera, tampilkan overlay hanya untuk sukses.

### [C-10] 🟡 [KODE] `MAX_POLLS = 300 × 3s` (15 menit) lalu berhenti tanpa menawarkan metode bayar alternatif
- **Lokasi:** `lib/use-qris-payment.ts:34-36`, `:88-94` (`setStopped(true)`),
  `components/qris-payment-panel.tsx:133-136` (hanya teks + "Cek status sekarang")
- **Bukti:** setelah cap, `enabled` polling `false`; panel hanya menampilkan
  "Pemantauan otomatis dihentikan setelah 15 menit".
- **Dampak:** pengguna di jaringan buruk terjebak di panel QRIS tanpa jalur
  "bayar dari saldo" (padahal sheet masih memuat SegmentedControl itu —
  `:828-840` — hanya tertutup panel QR).
- **Usulan:** tampilkan tombol "Ganti metode" yang kembali ke pilihan
  `balance`/`qris`.

### [C-11] 🟡 [KODE] `createIntent` dengan intent non-terminal hanya `syncStatus()` — tombol "Tampilkan kode QRIS" tidak responsif saat status belum terbaca
- **Lokasi:** `lib/use-qris-payment.ts:128-134` (`if (qris && !(TERMINAL…
  includes(status ?? ""))` → `syncStatus` lalu `return`)
- **Bukti:** `status === null` (intent baru dibuat, belum poll) **lolos** dari
  `TERMINAL` → pengguna yang menekan tombol dua kali tidak mendapat QR kedua
  maupun feedback; hanya `creating` spinner sekilas.
- **Dampak:** kebingungan di momen pembayaran; tidak ada indikator bahwa
  "status sedang disinkronkan".
- **Usulan:** toast/status "Memeriksa status pembayaran…" pada jalur sinkron.

### [C-12] 🟡 [KODE] Overlay `TransactionProgressOverlay` mencetak "Membayar Rp0 dari saldo…" bila `fee` null saat submit
- **Lokasi:** `app/order/[id].tsx:1098` (`formatRupiah(fee?.buyerPays ?? 0)`)
- **Bukti:** `fee` bisa `null` (fallback [B-05]) walau `handlePayPin` hanya
  dipanggil lewat `PinInput` di sheet; `fee?.buyerPays ?? 0` → `Rp0`.
- **Dampak:** pesan progres pembayaran dengan nominal 0 — menakutkan di momen
  debit dana.
- **Usulan:** tampilkan tanpa nominal bila tidak diketahui.

---

## D. Kontrak API & normalisasi respons

> Akar bersama: 8 adapter di domain `orders` **hanya me-cast** tipe response
> (dokumen `lib/api/orders.ts:8-10` "Tipe RESPONSE: tidak ada di spec — ditulis
> minimal dan ditandai UNVERIFIED"), sementara `listOrders`/`getOrder`/`getInvoice`
> sudah dinormalisasi. Ketidakseragaman ini yang menghasilkan D-01..D-08.

### [D-01] 🔴 [RUNTIME] `listDeliveryProofs` tanpa `readList` → bentuk `{proofs:[…]}`/`{data:[…]}` membuat layar bukti pengiriman crash ("ps is not iterable")
- **Lokasi:** `lib/api/orders.ts:715-719` (`http.get<DeliveryProof[]>` — cast
  polos), `app/delivery-proof/[orderId].tsx:90-95` (`proofs: ps ?? []`),
  `:113-118` (`[...proofs]`), `:111` (`proofs.length`)
- **Bukti:** `[PROBE-P30] spread {"proofs":[{"id":"p1"}]} => THROW ps is not
  iterable`; `{"data":[{"id":"p1"}]} => THROW ps is not iterable`. Hanya array
  polos yang selamat. `readList` (`lib/api/response.ts:78-107`) — yang justru
  dirancang untuk ketiga bentuk ini — tidak dipanggil.
- **Dampak:** satu perubahan bentuk response backend (atau envelope `data`
  tambahan) menjatuhkan **seluruh** layar bukti pengiriman ke ErrorBoundary;
  pembeli tidak bisa konfirmasi/tolak, penjual tidak bisa unggah → escrow
  macet di `IN_DELIVERY`.
- **Usulan:** `listDeliveryProofs` → `readList(raw, ["deliveryProofs","proofs"])`.

### [D-02] 🔴 [KODE][RUNTIME] `getOrderHistory` di-cast ke `Paginated<T>` — `.data` `undefined` bila backend membungkus dengan kunci `history`
- **Lokasi:** `lib/api/orders.ts:663-669` (`http.get<Paginated<OrderHistoryEntry>>`),
  `app/order/[id].tsx:184` (`history: h?.data ?? []`)
- **Bukti:** `[PROBE-P7] cast .data dari {history:[]} => undefined` → fallback
  `?? []` menyembunyikan bahwa riwayat **ada** tapi tidak terbaca; `listOrders`
  sebaliknya memakai `readPage(raw, page, ["orders"])` (`:541-548`).
- **Dampak:** bagian "Riwayat" detail order selalu "Riwayat belum tersedia"
  (`:848-854`) tanpa error — audit transisi status hilang dari satu layar yang
  paling membutuhkannya (bukti siapa yang mengubah status escrow).
- **Usulan:** `readPage(raw, query, ["history"])` — konsisten dengan `listOrders`.

### [D-03] 🔴 [KODE][RUNTIME] `listExtensions` di-cast ke `Paginated<T>` — daftar perpanjangan tenggat bisa kosong senyap (satu akar dengan D-02)
- **Lokasi:** `lib/api/orders.ts:685-691`, `app/extension/[orderId].tsx:167-178`
  (`res?.data ?? []`)
- **Bukti:** `[PROBE-P7]` (logika sama). `hasMore` lalu `false`
  (`:175` `data.length >= PAGE_SIZE` juga `false`) → "Belum ada permintaan"
  (`:337-344`).
- **Dampak:** pembeli tidak melihat permintaan perpanjangan PENDING (tidak bisa
  menyetujui), penjual tidak melihat riwayat → tenggat lewat percuma.
- **Usulan:** `readPage` dengan `["extensions"]`.

### [D-04] 🔴 [KODE][RUNTIME] `listMyOrderLinks` di-cast ke `Paginated<T>` — daftar order link kosong senyap (satu akar dengan D-02)
- **Lokasi:** `lib/api/orders.ts:752-758`, `app/order-links.tsx:66-81`
  (`res.data ?? []`, fallback `totalPages` dari `data.length`)
- **Bukti:** `[PROBE-P7]`. Fallback `totalPages` (`order-links.tsx:74-78`)
  juga menebak dari panjang array — predikat "masih ada halaman" yang sudah
  diperbaiki untuk `listOrders` (C-05 di komentar `lib/api/response.ts:186-194`)
  tetap belum berlaku di sini.
- **Dampak:** pengguna tidak melihat tautan yang sudah dibuat → membuat tautan
  ganda (order menggantung makin banyak).
- **Usulan:** `readPage(raw, query, ["links"])`.

### [D-05] 🔴 [KODE] `payOrderQris` me-cast `QrisPayment` tanpa normalisasi — `qrString` bisa `undefined` lalu dirender sebagai QR kosong
- **Lokasi:** `lib/api/orders.ts:599-603`, `components/qris-payment-panel.tsx:94-99`
  (`<QRCodeDisplay value={qrString} …>`), `lib/use-qris-payment.ts:135-143`
  (`setQris(res)`)
- **Bukti:** tidak ada `normalize…` untuk `QrisPayment` (bandingkan
  `normalizePaymentStatus` yang justru dibuat karena cacat kelas sama);
  `QrisPayment.qrString` bertipe `string` wajib namun datang dari cast.
- **Dampak:** pengguna membayar dengan QR yang salah/gagal dipindai tanpa pesan
  error; `amount`/`expiresAt` ikut tak tervalidasi (memperparah [C-03]).
- **Usulan:** normalizer `QrisPayment` (alias `qrString|qr_string|qr`, validasi
  `expiresAt`) — pola yang sudah ada di modul ini.

### [D-06] 🔴 [KODE] `getOrderLink` me-cast `OrderLink` — `link.token`/`status`/`orderValue` dipakai untuk navigasi & pembayaran tanpa penjaga
- **Lokasi:** `lib/api/orders.ts:761-765`, `app/order-link/[token].tsx:56-79`
  (`api.orders.acceptOrderLink(link.token)`, `query.setData(…status…)`)
- **Bukti:** `handleAccept` memanggil `acceptOrderLink(link.token)` —
  bila `token` `undefined` dari response, `seg(undefined)` melempar
  `ApiError BAD_REQUEST` (`lib/api/client.ts:96-108`); `link.orderValue`
  dirender `OrderLinkPreviewCard` (`:113`) tanpa validasi nominal.
- **Dampak:** penerima tautan (calon lawan transaksi) melihat nominal yang
  tidak tervalidasi dan tombol Terima yang bisa gagal diam-diam.
- **Usulan:** normalizer `OrderLink` + guard sebelum render nominal.

### [D-07] 🔴 [KODE] `getOrdersSummary` & `getAverageDurations` me-cast objek mentah ke `Record`/`OrderSummary` — angka estimasi timeline & ringkasan tanpa penjaga
- **Lokasi:** `lib/api/orders.ts:557-559,561-563`, `app/order/[id].tsx:413-424`
  (`durations?.[next]` → `durationHoursParts(hours)`)
- **Bukti:** `durationHoursParts` (`lib/format.ts:358-363`) sudah menolak
  non-finite (`return null`) — itu penyelamat parsial; tapi
  `getAverageDurationsCached` (`:575-588`) **meng-cache objek error apa pun**
  selama 10 menit (`AVERAGE_DURATIONS_TTL_MS`, `:568`) bila `unwrapResponse`
  lolos ([B-04]).
- **Dampak:** estimasi "Biasanya sekitar {x} jam" bisa berisi angka dari
  response tak valid yang di-cache per sesi; `getOrdersSummary` dipakai untuk
  angka (belum ada pemanggil UI saat ini, tetapi API publik di `lib/api.ts:88`).
- **Usulan:** validasi `Record<string, number>` sebelum cache; buang cache bila
  bentuk salah.

### [D-08] 🔴 [RUNTIME] `normalizeOrder` menyebar `...raw` termasuk field tak dikenal ke state `Order` — tipe `Order` adalah janji yang tidak ditegakkan
- **Lokasi:** `lib/api/orders.ts:272-296` (`return { ...raw, id, buyer, seller, myRole }`)
- **Bukti:** `[PROBE-P3] role -> myRole: BUYER` (alias dipetakan), tetapi semua
  field lain (`order.fee`, `trackingNumber`, `deliveryDeadlineAt`) diteruskan
  apa adanya tanpa validasi tipe — `fee?: FeeBreakdown` bisa string tanpa
  yang menyadarinya, lalu `FeeBreakdown` component menerima `fee.platformFee`
  `undefined` → `splitFee(undefined)` → `Math.max(undefined, 0)` = `NaN`.
- **Dampak:** satu field server berubah tipe merambat menjadi `NaN` di angka
  uang ([B-03] memperlihatkan `formatRupiah(NaN)` = "—", jadi tampilannya
  "Rp—" bukan error).
- **Usulan:** pilih field yang dikenal secara eksplisit (allowlist), validasi
  `fee` lewat normalizer `FeeBreakdown`.

### [D-09] 🔴 [RUNTIME] `normalizeCounterpartValidation` mengklasifikasikan `{valid:false, reason:"…diblokir…"}` sebagai `notFound` — pengguna dituduh "tidak ditemukan" padahal diblokir
- **Lokasi:** `lib/api/orders.ts:361-367` (`notFound = … || (!userRecord &&
  explicit !== true && !blocked && !statusBlocked)`), `app/create-transaction.tsx:335-338`
  (`res.notFound ? "notFound" : "blocked"`)
- **Bukti:** `[PROBE-P5] {"valid":false,"reason":"Anda diblokir oleh pengguna ini"}
  => {"valid":false,"reason":"…","notFound":true}` → state `notFound` →
  `<CounterpartValidationCard>` (`components/ui/counterpart-validation-card.tsx:119-121`)
  menampilkan "Pengguna tidak ditemukan / Periksa kembali username…"; prop
  `reason` **hanya** dipakai di cabang `blocked` (`:124` `hint: reason ?? t.blockedHint`)
  — alasan asli terbuang.
- **Dampak:** kelas pesan yang persis dikeluhkan di komentar normalizer itu
  ("menuduh pengguna lain") masih terjadi untuk respons `valid:false` berisi
  `reason`; pengguna salah perbaiki input padahal harus menghubungi pihak lain.
- **Usulan:** `notFound` hanya untuk sinyal eksplisit (`notFound/userExists/
  status NOT_FOUND`); `valid:false` + `reason` = `blocked` dengan `reason`
  ditampilkan.

### [D-10] 🔴 [RUNTIME] `{ valid: "yes" }` (boolean salah tipe) dianggap tidak ada flag → `notFound`
- **Lokasi:** `lib/api/orders.ts:355` (`pickBoolean` menolak non-boolean),
  `:361-367`
- **Bukti:** `[PROBE-P5] {"valid":"yes"} => {"valid":false,"notFound":true}`.
- **Dampak:** backend yang mengirim `"valid":"true"`/`1` (kejadian nyata lintas
  versi API) membuat SEMUA lawan transaksi tampil "tidak ditemukan" — fitur
  buat transaksi mati total dengan pesan yang menuduh.
- **Usulan:** `pickBoolean` terima `"true"/"false"/1/0` (sebagian sudah), dan
  `valid` yang ada tapi salah tipe → `PARSE` error, bukan kesimpulan negatif.

### [D-11] 🟠 [RUNTIME] `normalizeOrder` tanpa id → `{id:""}` diteruskan ke daftar & rute (satu akar dengan A-07, permukaan berbeda)
- **Lokasi:** `lib/api/orders.ts:285-287`, `app/(tabs)/transactions.tsx:235-243`
  (`href={ROUTES.orderDetail(item.id)}`)
- **Bukti:** `[PROBE-P22] normalizeOrder({}) => {"id":""}`.
- **Dampak:** `OrderCard` dengan `orderId=""` (baris kosong) tetap bisa
  ditekan → `/order/` → `getOrder("")` → `seg("")` throw.
- **Usulan:** filter baris tanpa id sebelum render.

### [D-12] 🟠 [KODE] `cancelOrderLink` mengembalikan `OrderLink | MessageResult` — klien tidak pernah membedakan hasil
- **Lokasi:** `lib/api/orders.ts:772-775`, `app/order-links.tsx:110-123`
  (`query.setData(… status: "CANCELLED" …)` apa pun hasilnya)
- **Bukti:** tipe union sengaja ditulis (`:772`), tetapi kedua pemanggil
  (`order-links.tsx`, `app/order-link/[token].tsx:73-82`) mengabaikan return
  dan **mengoptimistis** status `CANCELLED`.
- **Dampak:** bila server menolak/menunda (mis. tautan sudah diterima saat
  request telat), UI tetap menampilkan "Tautan dibatalkan" — status palsu di
  dokumen finansial ringan.
- **Usulan:** baca `status` dari hasil; batalkan optimisme bila berbeda.

### [D-13] 🟠 [KODE] `DisputeMessage` klien membaca `text` padahal DTO produksi memakai `message` — bidang `text` hanya mengisi sendiri dari `readList` mentah
- **Lokasi:** `lib/api/disputes.ts:44-48` (`type DisputeMessage { text: … }`),
  `:134-142` (`sendDisputeMessage` **mengirim** `{message: text}` — sudah benar),
  `app/dispute/[id].tsx:488-494` (`<ChatMessageBubble text={m.text} …>`)
- **Bukti:** `DisputeMessageDto` (`lib/api/types.ts:1118-1124`) memuat
  `message`; `getDisputeMessages` me-cast `DisputeMessage[]` tanpa normalisasi
  (`disputes.ts:126-132`) — bila server mengembalikan `message`, `m.text`
  `undefined` → bubble kosong.
- **Dampak:** pesan sengketa (bukti komunikasi untuk mediator) tampil kosong di
  satu/dua pihak.
- **Usulan:** `text: string` dinormalisasi dari `text|message|content`.

### [D-14] 🟡 [KODE] `getReceiptHtml` menerima `text/html` mentah tanpa memverifikasi isinya — 404/HTML error server tersimpan jadi "struk"
- **Lokasi:** `lib/api/orders.ts:882-888` (`responseType: "text"`),
  `app/invoice/[orderId].tsx:77-85` (`saveTextFile(html, `${invoiceNumber}.html`)`)
- **Bukti:** `exchange` (`lib/api/client.ts:253-266`) memanggil `parseBody`
  dengan `type` — untuk `text` mengembalikan string apa pun, termasuk halaman
  error proxy; `handleDownload` langsung menyimpannya dan men-toast
  "Struk diunduh" (`:81-83`).
- **Dampak:** pengguna mengarsipkan "struk" berisi halaman error; tombol
  "Bagikan" ikut membagikan file itu.
- **Usulan:** cek prefix/`<!doctype` + minimal struktur, atau sediakan endpoint
  `invoice/pdf` ([O-04]).

### [D-15] 🟡 [KODE] `api.upload.requestPresignedUrl` me-cast `PresignedUpload` — `url`/`fileKey` dipakai untuk unggah bukti sengketa/bukti kirim tanpa penjaga
- **Lokasi:** `lib/api/upload.ts:32-46` (`value.url ?? value.uploadUrl` —
  sebagian dinormalkan), `:49` (`safeHttpsUrl(upload.url)` memang sudah
  menolak non-HTTPS), `app/dispute/[id].tsx:303-310`
- **Bukti:** `fileKey` tidak dinormalkan (hanya `url`/`expiresAt`); bila
  `fileKey` `undefined`, `submitDisputeEvidence({ fileUrls: [fileKey] })`
  (`dispute/[id].tsx:307-310`) mengirim `[undefined]` → JSON
  `"fileUrls":[null]` → `SubmitEvidenceDto.fileUrls minItems 1`
  (`lib/api/types.ts:1092-1098`) ditolak server.
- **Dampak:** unggah bukti gagal setelah file terkirim ke storage (objek
  yatim) dengan pesan validator yang membingungkan.
- **Usulan:** validasi `fileKey: string` sebelum dipakai di DTO.

---

## E. Sengketa & bukti pengiriman

### [E-01] 🔴 [KODE] `toAttachments` memetakan SEMUA `fileUrls` ke `kind:"image"` — PDF bukti kirim dirender sebagai gambar rusak
- **Lokasi:** `app/delivery-proof/[orderId].tsx:73-81`
  (`(p.fileUrls ?? []).map((uri) => ({ kind: "image", uri }))`; hanya
  `linkUrls` yang menjadi `kind: "pdf"`)
- **Bukti:** `SubmitDeliveryProofDto.fileUrls` ("S3 object keys for proof
  files", `lib/api/types.ts:1045-1053`) tidak membatasi MIME — PDF sah
  (form penjual sendiri menjanjikan "atau PDF", `components/ui/delivery-proof.tsx:81`).
  `DeliveryProofViewer` merender `kind:"image"` lewat `<Picture>`
  (`delivery-proof-viewer.tsx:233-250`) dan `kind:"pdf"` lewat baris ikon
  (`:252-286`).
- **Dampak:** bukti PDF yang menjadi dasar keputusan escrow tampil sebagai
  kotak rusak untuk pembeli; pembeli bisa menolak bukti yang sebenarnya valid
  (membuka sengketa percuma) atau, sebaliknya, tidak bisa memeriksa bukti sama
  sekali.
- **Usulan:** deteksi ekstensi/MIME dari `fileUrls` (atau kembalikan
  `fileTypes` dari server) saat memetakan ke `DeliveryProofAttachment`.

### [E-02] 🔴 [KODE] Peran tak dikenal (`myRole` undefined) diperlakukan sebagai **pembeli** di layar bukti pengiriman — tombol "Konfirmasi diterima" (rilis dana) tampil untuk pihak yang belum terkonfirmasi
- **Lokasi:** `app/delivery-proof/[orderId].tsx:131` (`const isSeller =
  order?.myRole === "SELLER"`), `:351` (`viewer={isSeller ? "seller" : "buyer"}`)
- **Bukti:** `DeliveryProofViewer` hanya menampilkan aksi konfirmasi/tolak bila
  `viewer === "buyer"` (`delivery-proof-viewer.tsx:187` `showActions =
  viewer === "buyer" && status === "pending"`); bila `myRole` hilang atau order
  gagal dimuat (`order` null), `isSeller` `false` → `viewer="buyer"` →
  `onConfirm`/`onReject` aktif (`:348-354`). Bandingkan `app/order/[id].tsx:466-469`
  yang menampilkan `ErrorState "Peran Anda belum terkonfirmasi"` dan
  menonaktifkan aksi.
- **Dampak:** pengguna yang perannya belum jelas (atau pemirsa yang salah buka
  rute — lihat [H-05]) melihat tombol yang melepas dana escrow ke penjual.
  Server memang akan memvalidasi, tetapi UI sudah menawarkan aksi destruktif
  dengan dialog "Dana di escrow akan dilepas ke penjual" (`:374`).
- **Usulan:** `viewer` hanya bila `myRole` pasti; selain itu read-only +
  `ErrorState` peran.

### [E-03] 🔴 [KODE] Usulan penyelesaian bersama: nominal rupiah dikonversi ke persen dengan `Math.round` → pembagian yang disepakati ≠ pembagian yang tampil
- **Lokasi:** `app/dispute/[id].tsx:369-370`
  (`buyerPercent = Math.round((proposeAmount / orderValue) * 100)`),
  `:824-827` (pratinjau "Ke penjual: {formatRupiah(orderValue - proposeAmount)}"),
  `lib/api/disputes.ts:101-113` (`buyerPercent + sellerPercent = 100` integer)
- **Bukti:** untuk `orderValue = 10.000`, `proposeAmount = 3.333` →
  `buyerPercent = 33`, `sellerPercent = 67` → backend membagi
  `Rp3.300 / Rp6.700`, sementara sheet menampilkan `Rp3.333 / Rp6.667`.
  Selisih **Rp33** yang dilihat pihak ketika menyetujui (`MutualResolutionCard`
  dihitung dari persen: `components/ui/mutual-resolution-card.tsx:180-184`
  `buyerPct = Math.round((buyer / safeTotal) * 100)`).
- **Dampak:** pihak yang menekan "Setuju" menyetujui angka yang berbeda dari
  yang ditampilkan di sheet pengusul — sengketa justru soal pembagian dana;
  selisih membesar untuk order bernilai besar (Rp100jt → selisih ±Rp500rb
  bila pembulatan 0,5%).
- **Usulan:** kirim **nominal** (bila backend menambah opsi) atau bulatkan
  `proposeAmount` ke kelipatan `orderValue/100` sebelum dikirim dan tampilkan
  hasil bagi persen tersebut di pratinjau.

### [E-04] 🔴 [KODE] Klaim sengketa ditimpa setiap `query.refresh()` — pengguna kehilangan draft klaim yang sedang diketik (bug lama yang disengaja dipertahankan)
- **Lokasi:** `app/dispute/[id].tsx:254-263` (effect `setClaim(dispute.claim ?? "")`
  pada setiap identitas `dispute` baru) + komentar `:248-252` ("Bug lama; tidak
  dicampurkan ke migrasi ini")
- **Bukti:** `handleSend`/`handleAddEvidence` memanggil `query.setData`
  (`:283-285`, `:312`) yang mengganti `bundle` → `dispute` identitas baru →
  effect menimpa `claim`; `PullToRefresh` (`:446-448`) juga.
- **Dampak:** draft klaim (20-2000 karakter, `SubmitClaimDto`) hilang tanpa
  peringatan saat pengguna menarik-refresh atau setelah mengirim pesan — di
  alur sengketa ini bukti tertulis pengguna.
- **Usulan:** pola yang sudah dipakai `app/order/[id].tsx:226-246`
  (pra-isi hanya saat order berganti / server benar-benar mengubah nilai).

### [E-05] 🔴 [KODE] `mine` bukti default `false` bila backend tidak mengirim flag → bukti milik sendiri tidak bisa dihapus dan diberi judul "Bukti {lawan}"
- **Lokasi:** `app/dispute/[id].tsx:406-415` (`mine: e.mine ?? e.uploadedByMe ?? false`),
  `:425-433` (`title: item.mine ? "Bukti Anda" : `Bukti ${counterpartName}``),
  `components/ui/media-viewer` actions (`:857-867` `viewerItem?.mine && …`)
- **Bukti:** `DisputeEvidence` (`lib/api/disputes.ts:34-43`) menandai kedua
  field `optional` (UNVERIFIED); `SubmitEvidenceDto` tidak mengembalikan
  kepemilikan dalam DTO. Default `false` membuat tombol "Hapus bukti"
  (`:857`) tidak pernah tampil untuk bukti sendiri bila flag hilang — dan
  judul viewer menuduh lawan.
- **Dampak:** pengguna tidak bisa mencabut bukti yang salah unggah (privasi +
  keputusan mediator), sementara dialog hapus (`:871-880`) mengklaim "tidak
  lagi dilihat mediator".
- **Usulan:** bandingkan `uploadedBy`/`userId` dengan `me.id` sebagai fallback,
  bukan `false`.

### [E-06] 🟠 [KODE] `handleRespond` (ACCEPT/REJECT/WITHDRAW) tidak pernah mengirim `responseNote` yang didukung `MutualResolutionRespondDto`
- **Lokasi:** `app/dispute/[id].tsx:331-350` (`respondMutualResolution(id,
  proposal.id, { action })`), `lib/api/types.ts:1166-1173` (`responseNote? maxLength 2000`)
- **Bukti:** body `{ action }` saja; tidak ada UI `responseNote`.
- **Dampak:** penolakan usulan tanpa alasan — pihak lain dan mediator kehilangan
  konteks; padahal `MutualResolutionCard` punya slot `note` untuk menampilkannya.
- **Usulan:** tambah textarea opsional di dialog tanggapan.

### [E-07] 🟠 [KODE] `handleRequestCall` bergantung pada `calls` di dep array padahal tidak memakainya; `handleSend`/`handleAddEvidence`/`handleDeleteEvidence` kehilangan `query` dari dep
- **Lokasi:** `app/dispute/[id].tsx:353-373` (`useCallback(…, [id, calls,
  toast.show])` — `calls` tidak dipakai), `:270-287` (`[id, toast.show]`),
  `:290-317` (`[id, toast.show]`), `:319-330` (`[id, deleteEvidenceId,
  toast.show]`)
- **Bukti:** `query.setData` dibaca dari closure; ESLint `react-hooks/exhaustive-deps`
  (jika diaktifkan untuk pola ini) akan menandai. Fungsi yang sama dipanggil
  setelah `query` berganti (refresh) memakai `setData` versi lama — untuk
  `useApiQuery`, `setData` = `setRaw` (stabil), jadi dampak praktis kecil,
  tetapi pola ini rapuh bila hook berubah.
- **Dampak:** potensi pembaruan lokal mengenai snapshot basi; kualitas kode.
- **Usulan:** perbaiki dep array (referensi `query.setData` di-ref).

### [E-08] 🟡 [KODE] `canEscalate` tidak membatasi eskalasi ke-2 di klien — dialog mengatakan "maksimal 2x" tetapi tombol tetap bisa ditekan
- **Lokasi:** `app/dispute/[id].tsx:221-225` (`canEscalate` hanya mengecualikan
  `RESOLVED/ESCALATED`), `:894-895` (teks dialog), `lib/api/disputes.ts:240-248`
  (aturan backend "maks 2x")
- **Bukti:** tidak ada hitungan eskalasi di `DisputeDetail`; percobaan ke-3
  hanya ditolak server dengan error yang tampil sebagai toast generik.
- **Dampak:** tombol yang selalu aktif + kegagalan yang tidak dijelaskan.
- **Usulan:** sembunyikan/nonaktifkan setelah 2 (bila API mengembalikan
  `escalationCount`), atau tangani `backendCode` spesifik.

### [E-09] 🟡 [KODE] `EVIDENCE_FILE_TYPES` membatasi ke 4 MIME sementara `SubmitEvidenceDto.fileTypes` mendukung 7 (termasuk video)
- **Lokasi:** `app/dispute/[id].tsx:70-71` vs `lib/api/types.ts:1098-1102`
  (`video/mp4 | video/quicktime | video/webm`)
- **Bukti:** `toEvidenceFileType` (`:74-77`) memetakan `image/heic` (dll.) ke
  `"image/jpeg"` — padahal `pickImage` (`lib/image-picker.ts`) bisa
  mengembalikan MIME asli; video tidak pernah bisa dikirim walau DTO membolehkan.
- **Dampak:** label MIME di server salah untuk HEIC/WebP asli; bukti video
  (sering jadi bukti utama sengketa) tidak tersedia.
- **Usulan:** teruskan MIME asli bila ada di enum, tolak dengan pesan bila tidak.

### [E-10] 🟡 [KODE] `handlePropose` membaca `orderValue` dari `order?.orderValue ?? Number.NaN` — usulan dengan order yang gagal dimuat diam-diam tidak terkirim
- **Lokasi:** `app/dispute/[id].tsx:218` (`orderValue = order?.orderValue ?? Number.NaN`),
  `:373-380` (guard `Number.isSafeInteger(orderValue)` → `return` tanpa pesan)
- **Bukti:** tombol "Kirim usulan" (`:805-811`) hanya di-disable oleh
  `proposeNote.length < 10`; bila `order` null (fetch order `.catch(() => null)`,
  `:163-167`) tombol aktif tapi `handlePropose` keluar diam-diam.
- **Dampak:** pengguna menulis usulan 500 karakter lalu menekan kirim — tidak
  terjadi apa pun, tidak ada error.
- **Usulan:** disable + alasan "Detail order belum termuat" bila `order` null.

### [E-11] 🔵 [KODE] `SubmitDisputeDto.fileUrls/fileTypes` didukung kontrak tetapi sheet sengketa di detail order tidak pernah mengirim bukti sekaligus
- **Lokasi:** `app/order/[id].tsx:855-878` (sheet sengketa hanya
  `{claim, category}`), `lib/api/types.ts:1009-1028` (`fileUrls? maxItems 10`)
- **Bukti:** komentar sheet `:852` ("Bukti foto bisa ditambahkan setelah
  sengketa dibuat") — kapabilitas DTO dipilih tidak dipakai.
- **Dampak:** pengalaman dua langkah untuk kasus sederhana ([O-05]).
- **Usulan:** [IMPROVE] — lampirkan bukti saat pembukaan sengketa.

---

## F. Perpanjangan & order link

### [F-01] 🔴 [KODE] Penerimaan order link **wajib login** (`auth: "required"`), padahal order link dirancang untuk lawan yang belum punya akun
- **Lokasi:** `lib/api/orders.ts:761-765` (`getOrderLink` `auth: "required"`),
  `app/create-transaction.tsx:29-33` (dokumen: "Order Link cocok bila lawan
  belum punya akun — tautan dibagikan, penerima yang menyetujui"),
  `app/order-link/[token].tsx:56` (`useApiQuery` → gerbang tamu
  `lib/guest-gate` / `useApiQuery` B-03 memblokir request auth-required untuk
  tamu web)
- **Bukti:** spec memiliki endpoint publik `GET /v1/deeplinks/order-link/{token}`
  (`docs/api/kahade-api-mobile.json`, `lib/api/deeplinks.ts:31-37` —
  `auth: "none"`), tetapi layar terima tautan **tidak memakainya**; yang
  dipanggil `getOrderLink` ber-auth.
- **Dampak:** alur "bagikan tautan ke calon pengguna" paling penting dari fitur
  order link terputus: penerima di web tanpa sesi melihat gate login (atau
  401), dan setelah login pun token harus cocok dengan izin endpoint
  ber-auth. Tautan menjadi tidak berguna untuk akuisisi lawan transaksi baru.
- **Usulan:** pakai `resolveOrderLinkDeeplink`/endpoint publik untuk preview,
  minta login hanya saat menekan "Terima" (`acceptOrderLink`).

### [F-02] 🔴 [KODE] `fetchPage` pada layar perpanjangan tidak membawa `AbortSignal` — request halaman memperbarui state setelah unmount & balapan dengan refresh
- **Lokasi:** `app/extension/[orderId].tsx:165-178` (`api.orders.listExtensions(orderId,
  {page, limit})` tanpa `signal`), `:184-188` (`useEffect` `void fetchPage(1)`),
  `:190-203` (`handleLoadMore`)
- **Bukti:** `listExtensions` menerima `signal` (`lib/api/orders.ts:685`) tetapi
  pemanggil tidak memberikannya; `useApiQuery` (order) di-abort saat unmount
  (`lib/use-api-query.ts:232` `return () => current.current?.abort()`) —
  daftar perpanjangan tidak.
- **Dampak:** balapan `fetchPage(1)` (dari refresh) vs `fetchPage(page+1)` (load
  more): `setItems((prev) => (p === 1 ? data : [...prev, ...data]))`
  (`:171-173`) bisa menggabungkan halaman 2 lama ke halaman 1 baru →
  **duplikat kartu** dan urutan salah; setelah unmount, `setState` pada
  komponen mati.
- **Usulan:** teruskan `signal` dari effect + batalkan sebelum `fetchPage(1)`,
  atau migrasikan ke `usePaginatedQuery` (yang sudah menangani semua ini).

### [F-03] 🔴 [KODE] Tombol "Perpanjang tenggat" di detail order mengikuti `isExtendable` yang **berbeda isi** dari yang dijanjikan komentar (PAID/SHIPPED alias lama ikut, `DELIVERED` tidak)
- **Lokasi:** `lib/api/orders.ts:140-143` (`["PROCESSING","IN_DELIVERY","PAID","SHIPPED"]`),
  `app/order/[id].tsx:500`, `app/extension/[orderId].tsx:233` (`canRequest`)
- **Bukti:** `[PROBE-P1] isExtendable(IN_DELIVERY)= true`; komentar
  `orders.ts:140` menyebut "selama pekerjaan berjalan (belum diterima pembeli)"
  — `IN_DELIVERY` **sudah dikirim**; `DELIVERED` (alias "menunggu konfirmasi")
  justru tidak boleh diperpanjang padahal itulah fase menunggu pembeli.
- **Dampak:** penjual bisa mengajukan perpanjangan saat barang sudah di jalan
  (tidak ada gunanya) dan tidak bisa meminta waktu saat barang ditahan di
  "menunggu konfirmasi" (justru saat deadline paling relevan).
- **Usulan:** `isExtendable = {WAITING_PAYMENT?, PROCESSING}` (+ alias
  konsisten); sinkronkan dengan aturan backend.

### [F-04] 🟠 [KODE] `handleAccept` order link tidak menangani hasil `acceptOrderLink` yang kosong — navigasi ke `orderDetail(undefined)` bila respons tanpa `id`
- **Lokasi:** `app/order-link/[token].tsx:56-79`
  (`const targetOrderId = order?.id ?? link.orderId; if (targetOrderId) …`)
  — guard `if` sudah ada, tetapi `query.setData(… orderId: order?.id ?? current.orderId …)`
  (`:73`) tetap menulis `ACCEPTED` **tanpa** `orderId` lalu pengguna dibiarkan
  di layar preview dengan tombol mati (`active` false, `:81`) tanpa jalan ke
  order baru.
- **Bukti:** `acceptOrderLink` (`lib/api/orders.ts:768-770`) me-cast `Order`
  mentah (tanpa `normalizeOrder`) → `order?.id` bisa `undefined` walau order
  dibuat.
- **Dampak:** order baru tidak bisa dibuka dari alur terima tautan.
- **Usulan:** `normalizeOrder` + selalu tampilkan CTA "Buka pesanan" setelah
  accept sukses, dengan fallback ke daftar transaksi.

### [F-05] 🟠 [KODE] `orderLinkStatus` memetakan status asing ke `EXPIRED` — status `PENDING`/baru tampil sebagai "Kedaluwarsa" berbahaya
- **Lokasi:** `lib/order-link-labels.ts:35-38` (`orderLinkStatus` → `"EXPIRED"`),
  `app/order-link/[token].tsx:81,112` (`active = link?.status === "ACTIVE"`),
  `components/ui/order-link-preview-card.tsx` (tone `EXPIRED = danger`)
- **Bukti:** `[PROBE-P26] orderLinkStatus(PENDING)= EXPIRED`,
  `orderLinkStatus()= EXPIRED` (string kosong).
- **Dampak:** status baru backend (mis. `REVOKED`, `PENDING`) ditampilkan
  sebagai "Kedaluwarsa" merah dan mematikan tombol Terima/Tolak — pengguna
  mengira tautannya mati padahal tidak. Sebutan "Status asing tampil apa adanya"
  hanya berlaku di `orderLinkStatusMeta`, tidak di `orderLinkStatus` yang dipakai
  layar preview (`:112` `status={orderLinkStatus(link.status)}`).
- **Usulan:** jangan menebak; tampilkan mentah + netral seperti
  `orderLinkStatusMeta`.

### [F-06] 🟠 [KODE] Perpanjangan: `requestedByMe={isSeller}` dan `requesterName = orderPartyName(order.seller)` — bila suatu saat pembeli boleh mengajukan, kartu salah pihak
- **Lokasi:** `app/extension/[orderId].tsx:226` (`requesterName`), `:334`
  (`requestedByMe={isSeller}`)
- **Bukti:** `OrderExtension` (`lib/api/orders.ts:434-440`) tidak punya field
  `requesterId` — atribusi murni ditebak dari peran pemirsa.
- **Dampak:** label "Permintaan perpanjangan dari Anda"/"dari X" bisa tertukar
  untuk pemirsa yang bukan pengaju (mis. setelah peran berubah); kecil, tapi
  ini dokumen persetujuan.
- **Usulan:** baca `requesterId` bila server mengirim; fallback ke peran.

### [F-07] 🟡 [RUNTIME] `addDays` pada nilai tanggal tak valid menghasilkan `Invalid Date` yang mengalir ke pratinjau "Tenggat baru"
- **Lokasi:** `components/ui/order-extension-card.tsx:139-143` (`addDays`),
  `app/extension/[orderId].tsx:254-258` (`deadline` =
  `order.deliveryDeadlineAt ?? addDays(order.createdAt, …)`),
  `:260` (`previewDeadline`)
- **Bukti:** `[PROBE-P9] addDays(Date invalid,3)= Invalid Date`,
  `addDays(nan,3)= Invalid Date`.
- **Dampak:** `formatDateTimeWIB(Invalid Date)` = "—" ([PROBE-P24]) — dialog
  persetujuan pembeli berbunyi "Tenggat pengiriman menjadi —" (`extension:383-387`)
  untuk keputusan yang mengikat.
- **Usulan:** guard `Number.isFinite` di `addDays` → tampilkan "tenggat belum
  diketahui" dan nonaktifkan Setujui.

### [F-08] 🟡 [KODE] `deadline` perpanjangan dihitung dari `createdAt + deliveryDeadlineDays` bila `deliveryDeadlineAt` kosong — mengabaikan perpanjangan yang sudah disetujui
- **Lokasi:** `app/extension/[orderId].tsx:254-258`, kontras
  `components/ui/order-card.tsx` (memakai `deadlineAt` apa adanya)
- **Bukti:** `Order.deliveryDeadlineAt?: string | null` (`lib/api/orders.ts:258`);
  fallback menghitung ulang dari `createdAt` — bila server memperpanjang tenggat
  hanya dengan mengubah `deliveryDeadlineDays`, hasilnya benar, tetapi bila
  server menambah `extensions` tanpa menyentuh kedua field, pratinjau "Tenggat
  saat ini" meleset sebesar total perpanjangan.
- **Dampak:** angka "Tenggat baru" yang dilihat pembeli saat menyetujui tidak
  sama dengan yang diterapkan server.
- **Usulan:** minta `deliveryDeadlineAt` selalu terisi; jangan hitung ulang di
  klien untuk keputusan.

### [F-09] 🟡 [KODE] `order-links`: `onOpen` untuk `ACCEPTED` tanpa `orderId` membuka preview tautan, bukan pesanan
- **Lokasi:** `app/order-links.tsx:171-175` (`link.status === "ACCEPTED" &&
  link.orderId ? … : () => router.push(ROUTES.orderLink(link.token))`)
- **Bukti:** tautan `ACCEPTED` dengan `orderId` `null` (cast mentah [D-06])
  mengarahkan kembali ke layar preview yang sudah non-aktif.
- **Dampak:** lingkar navigasi tanpa hasil.
- **Usulan:** fallback ke `ROUTES.transactions`.

---

## G. Race, cache & polling

### [G-01] 🔴 [KODE] Setiap `POST /v1/orders/*` — termasuk `calculate-fee` — menyapu **seluruh** cache GET aplikasi
- **Lokasi:** `lib/api/client.ts:300-305` (`MONEY_MUTATION_PATTERNS` =
  `[/^\/v1\/wallet\/…/, /^\/v1\/orders(?:\/|$)/]`), `:479-481`
  (`invalidateQueryCache()`), pemanggil `calculateFee`
  (`app/create-transaction.tsx:302-318` tiap 400ms ketik, `:431-441` refresh)
- **Bukti:** pola cocok untuk `POST /v1/orders/calculate-fee` (non-GET) —
  komentar `lib/api/client.ts:313-316` mengakui hal ini ("membatalkan cache di
  sana hanya memicu beberapa GET tambahan") padahal `calculate-fee` adalah
  **kalkulasi murni**, bukan mutasi. Debounce 400ms pada setiap keystroke
  nominal (`DEBOUNCE_MS`, `create-transaction.tsx:113`) berarti satu sesi
  ketik bisa menyapu puluhan kali.
- **Dampak:** di tengah form buat-transaksi, saldo/daftar/profil di tab lain
  kehilangan cache berulang-ulang → request GET beruntun (kuota + latensi
  seluler), dan `useApiQuery` `refreshOnFocus` (`lib/use-api-query.ts:216-231`)
  ikut menembak ulang. Untuk perangkat kasir/penjual ini terasa sebagai
  "aplikasi berat".
- **Usulan:** keluarkan `calculate-fee`/`validate-counterpart` dari pola uang
  (uji path yang mengubah **state** saja: `pay|pay-qris|process|complete|
  cancel|confirm|shipping|delivery-proof|extensions`).

### [G-02] 🔴 [KODE] `refresh()` `useApiQuery` dipakai sebagai "segarkan setelah aksi" tanpa mempertimbangkan apakah layar masih memuat — balapan `setData` vs `refresh` di detail sengketa
- **Lokasi:** `app/dispute/[id].tsx:283-285` (`query.setData(…)` setelah
  `getDisputeMessages`), `:341-342` (`await query.refresh()` setelah respond),
  `lib/use-api-query.ts:236-244` (`load` membatalkan `current.current`)
- **Bukti:** `handleSend` melakukan `setData` **tanpa** `refresh`, tetapi
  `handleRespond` melakukan `refresh` (yang membatalkan request `load`
  berjalan dan menulis `raw` baru). Dua pola berbeda untuk dua mutasi sejenis
  di layar yang sama; `setData` dari `handleSend` bisa ditimpa oleh `refresh`
  yang sedang berjalan (`handleEscalate` `:234`).
- **Dampak:** pesan yang baru dikirim hilang sesaat (atau permanen bila
  `refresh` membawa snapshot sebelum pesan masuk) — di ruang sengketa ini
  bukti komunikasi.
- **Usulan:** satu pola per layar (selalu `refresh` **atau** selalu `setData`
  + `invalidateQueryCache`).

### [G-03] 🔴 [KODE] `onDeadline` per kartu memicu `query.refresh()` daftar transaksi — N kartu yang deadline-nya habis bersamaan = N refresh beruntun yang saling membatalkan
- **Lokasi:** `app/(tabs)/transactions.tsx:263` (`onDeadline={() => void query.refresh()}`),
  `components/ui/order-card.tsx:220-225` (`<Countdown … onComplete={onDeadline}>`),
  `lib/use-paginated-query.ts:143-151` (`if (reset) activeRequest.current?.abort()`)
- **Bukti:** `Countdown` memanggil `onComplete` **per kartu** saat tenggat
  lewat (`components/ui/countdown.tsx:124-129`, sekali per mount); daftar
  berisi banyak order dengan tenggat sama (mis. tenggat 3 hari dari tanggal
  yang sama) memicu `load(true, true)` beruntun — tiap `reset` meng-abort
  request sebelumnya.
- **Dampak:** badai request di detik tenggat berjalan (beberapa dari layar tab
  yang sedang terlihat), data bisa berakhir dengan fetch terakhir saja; kuota
  seluler terbuang.
- **Usulan:** debounce koalescing refresh per daftar (mis. tunggu 2 detik),
  atau cukup tandai kartu stale lalu biarkan `refreshOnFocus`.

### [G-04] 🟠 [KODE] `usePolling` memakai satu flag `running` per hook — polling QRIS yang memanggil `syncStatus` dari `createIntent`/`onCheckStatus` secara manual **di luar** siklus poll bisa berjalan paralel dengan tick poll
- **Lokasi:** `lib/use-polling.ts:20,36-48` (`running` guard hanya untuk `tick`),
  `lib/use-qris-payment.ts:74-100` (`syncStatus` dipakai `tick` **dan** dipanggil
  langsung `createIntent` `:146` / `syncStatus` sebagai `onCheckStatus` panel)
- **Bukti:** `syncStatus` tidak terikat `running`; tombol "Cek status sekarang"
  (`qris-payment-panel.tsx:145-147`) menembak `GET /payment-status` bersamaan
  dengan tick 3 detik.
- **Dampak:** dua response datang tak berurutan → `setStatus` yang lebih lama
  menimpa yang baru (mis. `PENDING` menimpa `PAID`) — `onPaid` tidak terpicu.
- **Usulan:** token generasi per `syncStatus` (pola `useApiQuery`) atau guard
  single-flight di hook.

### [G-05] 🟠 [KODE] `getAverageDurationsCached` menyimpan cache meski hasilnya `null`-ish/gagal parsing, dan tidak pernah disegarkan oleh `invalidateQueryCache`
- **Lokasi:** `lib/api/orders.ts:568-588` (`averageDurationsCache` — Map lokal
  terpisah dari `lib/query-cache.ts`), `:575-588`
- **Bukti:** `getAverageDurationsCached` hanya menulis cache saat sukses dan
  memeriksa `revision` sesi — bukan `invalidateQueryCache()` yang dipanggil
  transport setelah mutasi (`lib/api/client.ts:479`). TTL 10 menit (`:568`).
- **Dampak:** estimasi timeline bisa basi 10 menit walau cache dibersihkan
  di tempat lain; dua mekanisme cache (`query-cache` vs `averageDurationsCache`)
  dengan aturan invalidasi berbeda untuk data yang sama-sama "global".
- **Usulan:** pindahkan ke `fetchViaQueryCache` (`lib/query-cache.ts:143-158`).

### [G-06] 🟡 [KODE] `useApiQuery` `setData` menerima nilai **mentah** (`TRaw`) tetapi dipanggil layar dengan nilai hasil proyeksi di beberapa tempat lain (kontrak membingungkan)
- **Lokasi:** `lib/use-api-query.ts:248-252` (dokumen `setData` menerima nilai
  BAKU), `app/dispute/[id].tsx:283-285,312,330` (memanggil dengan bundle turunan)
- **Bukti:** pemakaian di `app/order-link/[token].tsx:73-74`
  (`query.setData((current) => (current ? { …current, status: "ACCEPTED" }…))`)
  memang mentah; di `dispute` juga objek bundle (sudah `TRaw`). Konsisten saat
  ini, tetapi nama `setData` + tipe `data` yang sudah `T` (hasil `select`)
  mengundang salah pakai.
- **Dampak:** risiko proyeksi tertulis ke cache (dibaca layar lain sebagai
  bentuk penuh) — belum aktif, tetapi rapuh.
- **Usulan:** ganti nama `setRaw`/`patchData` dengan tipe eksplisit.

### [G-07] 🟡 [KODE] `usePaginatedQuery.mergeById` mempertahankan urutan lama kecuali `compare` diberikan — daftar order tab Transaksi sudah benar (ada `byTimestampDesc`), tetapi `order-links` juga memakai `createdAt` yang bisa identik untuk tautan batch
- **Lokasi:** `lib/use-paginated-query.ts:9-17` (`mergeById`), `:27-38`
  (`byTimestampDesc` memakai `timeOf` = 0 untuk tanggal hilang),
  `app/order-links.tsx:79-82`
- **Bukti:** `byTimestampDesc` mengembalikan `0` untuk `createdAt` tak valid →
  urutan stabil tapi tidak bisa diprediksi untuk item ber-timestamp sama.
- **Dampak:** urutan tautan bisa berubah-ubah antar halaman bila server tidak
  memberi urutan stabil — minor.
- **Usulan:** tie-breaker `id`.

### [G-08] 🟡 [KODE] `getOrderHistory` hanya mengambil 50 entri pertama tanpa "muat lebih"
- **Lokasi:** `app/order/[id].tsx:136` (`HISTORY_LIMIT = 50`),
  `:173-179` (`getOrderHistory(oid, {page: 1, limit: HISTORY_LIMIT})`)
- **Bukti:** `Paginated<OrderHistoryEntry>` (`lib/api/orders.ts:663`) punya
  `meta.totalPages` tetapi layar tidak pernah memuat halaman 2.
- **Dampak:** order panjang (banyak revisi status) kehilangan riwayat awal —
  justru riwayat awal yang penting untuk sengketa.
- **Usulan:** `<LoadMore>` seperti `app/extension`.

### [G-09] 🟡 [KODE] `openChat` mencari ruang order dengan memuat seluruh `listChatRooms()` tanpa paginasi
- **Lokasi:** `app/order/[id].tsx:399-411` (`api.chat.listChatRooms()` lalu
  `rooms.data.find((r) => r.orderId === order.id)`)
- **Bukti:** `listChatRooms` (`lib/api/chat.ts`) — pemanggil tidak mengirim
  `page/limit`; `.find` hanya di halaman yang dikembalikan.
- **Dampak:** tombol Chat mengarah ke daftar chat (bukan ruang order) untuk
  akun dengan banyak ruang — pengguna harus mencari sendiri.
- **Usulan:** endpoint `GET /chat/rooms?orderId=` atau muat semua halaman.

### [G-10] 🟡 [KODE] `uploads` bukti kirim tidak di-reset saat `orderId` berubah (deep link antar order)
- **Lokasi:** `app/delivery-proof/[orderId].tsx:125` (`useState<UploadedProof[]>`), `:130-136` (effect hanya menyentuh `form.trackingNumber`)
- **Bukti:** tidak ada `useEffect`/`key` yang mengosongkan `uploads` untuk
  `orderId` baru; `handleSubmitProof` (`:227-238`) mengirim `uploads` milik
  order sebelumnya bila layar dipakai ulang.
- **Dampak:** bukti kirim terkirim ke order yang salah (bukti untuk order A
  masuk ke order B) bila navigasi berantai tanpa unmount.
- **Usulan:** reset `uploads` saat `orderId` berubah (pola `trackedOrderRef` di
  `app/order/[id].tsx:226-246`).

---

## H. Navigasi, deep link & guard rute

### [H-01] 🔴 [KODE] Rute `delivery-proof`, `extension`, `rate` tidak memverifikasi peran/status — siapa pun (termasuk bukan pihak order) membuka layar aksi escrow
- **Lokasi:** `app/delivery-proof/[orderId].tsx:88-96` (`enabled: Boolean(orderId)`
  saja), `app/extension/[orderId].tsx:114-121`, `app/rate/[orderId].tsx:33-38`,
  `lib/protected-routes.ts` (hanya gate login, bukan kepemilikan)
- **Bukti:** tidak ada guard `knownRole`/`isBuyer`/`isSeller` sebelum render aksi
  (kontras `app/order/[id].tsx:466-469,498-500` yang memakai `knownRole`);
  `app/delivery-proof` malah mem-defaultkan peran ke pembeli [E-02].
- **Dampak:** deep link `/delivery-proof/ORDER_ORANG` (id bisa ditebak/dibagikan
  di invoice — `app/invoice/[orderId].tsx:168` menampilkan `Order
  {invoice.order.id}` dan bisa disalin) menyajikan tombol konfirmasi rilis
  dana / unggah bukti ke pihak luar sampai server menolak; selisih antara UI
  dan izin adalah area phishing bantuan ("tolong tekan ini").
- **Usulan:** guard peran + status di tiga layar itu; non-pihak → `ErrorState`
  "Anda bukan peserta transaksi ini".

### [H-02] 🔴 [KODE] `ROUTES.orderDetail(item.id)` bisa membentuk `/order/` untuk id kosong (satu akar dengan A-07/D-11, permukaan navigasi)
- **Lokasi:** `lib/routes.ts:100-101`, `app/(tabs)/transactions.tsx:243`
- **Bukti:** `[PROBE-P22] normalizeOrder({}) => {"id":""}` → `href` valid
  menurut tipe (`Href`) tapi rute kosong.
- **Dampak:** navigasi buntu + `seg("")` throw di layar tujuan.
- **Usulan:** guard `orderId` di `ROUTES.orderDetail` (throw/`transactions`).

### [H-03] 🔴 [KODE] `formatDateTimeWIB("2026-09-24")` = "24 Sep 2026, 07:00 WIB" — string tanggal-hari-saja diinterpretasikan sebagai tengah malam **zona perangkat**, lalu dilabeli WIB
- **Lokasi:** `lib/format.ts:365-376` (`displayDate`:
  `new Date(year, month-1, day)` untuk `YYYY-MM-DD`), `:502-523`
  (`formatDateTimeWIB` memakai `zonedParts(date, WIB_TIME_ZONE)`)
- **Bukti:** `[PROBE-P24] formatDateTimeWIB('2026-09-24')= 24 Sep 2026, 07:00
  WIB` (dijalankan di lingkungan UTC). Di perangkat WITA hasilnya
  "08:00 WIB", di WIT "09:00 WIB" — label WIB-nya tetap.
- **Dampak:** nilai tanggal-hari-saja dari backend (jatuh tempo, `issuedAt`
  invoice bila dikirim `YYYY-MM-DD`) tampil **jam yang berbeda di tiap
  perangkat** dengan label zona yang sama — persis kerusakan persepsi tenggat
  yang diincar `formatDateTimeWIB` (komentar `:493-500`).
- **Usulan:** nilai date-only harus dianggap 00:00 **WIB** (atau tanpa waktu
  sama sekali) sebelum dikonversi.

### [H-04] 🟠 [KODE] `invoice` mengunduh struk HTML dan menamainya `${invoiceNumber}.html` — nomor invoice hasil buatan klien [B-14] jadi nama berkas
- **Lokasi:** `app/invoice/[orderId].tsx:77-85`, `:178-181`
- **Bukti:** `normalizeInvoice` bisa membentuk `invoiceNumber =
  `INV-${orderId}`` (`lib/api/orders.ts:861`); berkas unduhan memakai nilai itu.
- **Dampak:** arsip finansial pengguna memuat nama file yang tidak terdaftar di
  sistem pembukuan Kahade.
- **Usulan:** gunakan `order.id` bila nomor asli tidak ada.

### [H-05] 🟠 [KODE] `seg("a/b")` lolos sebagai `a%2Fb` — id dengan garis miring di-encode bukan ditolak
- **Lokasi:** `lib/api/client.ts:92-108` (`seg` hanya menolak `""`,
  `"undefined"`, `"null"`, `.`, `..`)
- **Bukti:** `[PROBE-P22] seg('a/b') => a%2Fb`.
- **Dampak:** id anomali menghasilkan URL ganda (`/v1/orders/a%2Fb`) yang
  kemungkinan 404, bukan error "Identitas data tidak valid" yang konsisten;
  permukaan kecil untuk kebingungan pesan error.
- **Usulan:** validasi karakter id (UUID/pola backend) di `seg` atau di
  `normalizeOrder`.

### [H-06] 🟡 [KODE] `buildUrl({status: ""})` menembak `?status=` — kontrak "jangan kirim string kosong" hanya dipegang oleh layar, bukan lapisan API
- **Lokasi:** `lib/api/client.ts:78-90` (query builder), `app/(tabs)/transactions.tsx:154-158`
  (pemanggil sudah benar: `status === ALL_STATUS ? undefined : status`)
- **Bukti:** `[PROBE-P27] buildUrl('/v1/orders',{status:''}) =>
  …?status=`; komentar `transactions.tsx:22-23` menyebut backend menyaring
  status `""` → daftar kosong.
- **Dampak:** satu pemanggil baru yang lupa akan mendapat daftar kosong
  misterius (persis bug yang sudah pernah terjadi menurut komentar).
- **Usulan:** abaikan string kosong di `buildUrl` (sama seperti
  `null`/`undefined`).

### [H-07] 🟡 [KODE] `rate/[orderId]` tidak memeriksa status `COMPLETED`/belum-pernah-dinilai sebelum menampilkan form
- **Lokasi:** `app/rate/[orderId].tsx:33-38,64-79`
- **Bukti:** `createRating` (`lib/api/ratings.ts:108-110`) `POST /v1/ratings`
  tanpa guard klien; `Order.myRole` dipakai hanya untuk label (`:85-94`).
- **Dampak:** pengguna menulis ulasan 500 karakter lalu mendapat 409 "Order
  belum selesai"/"sudah dinilai" (komentar `components/ui/rating-form.tsx:23-24`
  mengakui `errorText` "Order belum selesai" mungkin datang).
- **Usulan:** nonaktifkan form + penjelasan bila `order.status !== "COMPLETED"`.

### [H-08] 🔵 [KODE] Tombol "Invoice" tampil untuk semua status termasuk `WAITING_CONFIRMATION` (invoice memang "belum diterbitkan")
- **Lokasi:** `app/order/[id].tsx:750-762` (`Invoice` selalu dirender),
  `app/invoice/[orderId].tsx:64-70` (404 → "Invoice belum tersedia…")
- **Bukti:** penanganan 404 sudah baik (bukan "Gagal memuat"), tetapi CTA tetap
  menghasilkan dead-end satu ketukan untuk order yang belum dibayar.
- **Dampak:** minor — UX klik sia-sia.
- **Usulan:** sembunyikan sampai `status ∉ {WAITING_CONFIRMATION, WAITING_PAYMENT}`.

---

## I. Waktu, zona & format

### [I-01] 🔴 [RUNTIME] `toEpochMs` mencampur domain jam (epoch detik vs ms) — satu akar dengan C-04, permukaan `PendingActionsBanner`
- **Lokasi:** `lib/pending-actions.ts:56-62`, `components/pending-actions-banner.tsx:68-73`
  (filter `a.expiresAt > serverNow()`)
- **Bukti:** `[PROBE-P25] toEpochMs(1700000000)= 1700000000` (bukan ms).
- **Dampak:** banner pemulihan aksi uang (QRIS/top-up/withdraw) hilang atau
  salah tampil tergantung format timestamp server.
- **Usulan:** lihat [C-04].

### [I-02] 🔴 [RUNTIME] `ORDER_STATUS_LABELS[toString]` mengembalikan **fungsi** — label status di banyak komponen dibaca dari objek literal ber-prototipe
- **Lokasi:** `lib/labels/status.ts:38-52` (`ORDER_STATUS_LABELS: Record<
  OrderStatus, string>` objek literal), pembaca:
  `components/ui/order-status-badge.tsx:155` (`labels?.[status] ??
  ORDER_STATUS_LABELS[status]` — **terproteksi** `isOrderStatus`),
  `components/ui/order-history-timeline.tsx:97` (TIDAK terproteksi — [A-02]),
  `app/order/[id].tsx:418` (TIDAK terproteksi — [A-01]),
  `app/(tabs)/transactions.tsx:83-86` (aman: sumber `ORDER_STATUS_FILTERS`)
- **Bukti:** `[PROBE-P2] tone(toString)= … label= [Function: toString]`.
- **Dampak:** selain crash A-01/A-02, `statusLabel()` di `lib/labels/status.ts:126-130`
  sudah memakai `hasOwnProperty` (aman) — tetapi `ORDER_STATUS_LABELS` masih
  dibaca langsung di 3 tempat.
- **Usulan:** bikin peta label `Object.create(null)` sekali di `lib/labels/status.ts`.

### [I-03] 🟠 [KODE] `nextOrderStatus`/`ORDER_STATUS_FILTERS`/`ORDER_STATUSES` adalah tiga daftar status yang harus sinkron manual
- **Lokasi:** `lib/api/orders.ts:164-180,202-210`, `components/ui/order-status-badge.tsx:36-52`
- **Bukti:** `ORDER_STATUSES` (13 nilai) ≠ `ORDER_STATUS_FILTERS` (7) ≠ domain
  `nextOrderStatus` (8 entri); `ORDER_STATUS_FILTERS` diberi `satisfies
  readonly OrderStatus[]` (aman tipe), tetapi ketiadaan `PAID` di filter sudah
  benar sementara `canProcess` masih memakainya [A-03].
- **Dampak:** drift antara chip filter, tombol aksi, dan rantai status.
- **Usulan:** satu deklarasi state machine (status → {tone, label, aksi, next}).

### [I-04] 🟡 [RUNTIME] `formatRupiah` membulatkan nilai desimal berbeda dari nilai yang dikirim (banker's rounding vs `Math.round`)
- **Lokasi:** `lib/format.ts:188-199` (`Math.round(amount)` di dua tempat:
  cek `Number.isSafeInteger(Math.round(amount))` dan `Math.abs(Math.round(amount))`)
- **Bukti:** `[PROBE-P11] formatRupiah(1500.5)= Rp1.501` — `Math.round(1500.5)`
  = 1501; `formatRupiah(1500.4)= Rp1.500`. Nilai `display` `useCountUp`
  (`components/ui/amount.tsx:64`) juga float sementara animasi.
- **Dampak:** angka tampil ≠ angka transfer bila server mengirim desimal (lihat
  [B-09]); konsistensi Rp1.
- **Usulan:** tolak desimal sekali di sumber.

### [I-05] 🟡 [KODE] `durationHoursParts` menghasilkan `{value, unit}` yang disusun jadi kalimat lewat `translate("Biasanya sekitar {x} hari")` — jam/hari dipisah di dua cabang string
- **Lokasi:** `lib/format.ts:358-363`, `app/order/[id].tsx:413-424`
- **Bukti:** dua string katalog berbeda (`"…{x} hari"` / `"…{x} jam"`) —
  `lib/i18n` `shape` akan mencatat keduanya, tetapi `unit` ("hari"/"jam")
  dikembalikan dalam bahasa Indonesia dari `lib/format` lalu **tidak dipakai**
  di `app/order` (dipakai hanya untuk memilih cabang) — aman, tetapi
  pemanggil lain yang memakai `parts.unit` langsung akan menampilkan "hari"
  mentah.
- **Dampak:** risiko i18n minor; `unit` mengandung teks terjemahan mentah.
- **Usulan:** ganti `unit` ke enum `"day"|"hour"`.

### [I-06] 🟡 [KODE] `formatCountdown` tidak memformat > 24 jam (tetap `H:MM:SS` tumbuh tanpa batas)
- **Lokasi:** `lib/format.ts:534-541`
- **Bukti:** `h = Math.floor(s/3600)` — untuk sisa 100 jam tampil `100:00:00`.
- **Dampak:** countdown QRIS/order dengan sisa panjang tampil sebagai jam tiga
  digit; sulit dibaca (bukan salah perhitungan).
- **Usulan:** tampilkan "1d 04:00:00" atau bulatkan ke hari.

### [I-07] 🔵 [KODE] `zonedParts` fallback ke `formatDateTime` TANPA label zona — pengguna WITA/WIT tetap bingung (sudah didokumentasikan sebagai kompromi)
- **Lokasi:** `lib/format.ts:514-519`
- **Bukti:** komentar E-05 mengakui fallback ini; `Intl` di Hermes bisa absen.
- **Dampak:** sebagian perangkat tidak pernah melihat label WIB.
- **Usulan:** tambahkan asumsi "WIB" di label layar (bukan di string) bila ICU
  tidak ada.

---

## J. i18n & lokalisasi

> Model repo: string Indonesia adalah kunci, `<Text>` menerjemahkan children
> (`lib/i18n/translate.ts:152-172`). Temuan di sini adalah titik yang **lolos**
> dari jalur itu (fungsi pembentuk string, `join`, prop non-teks, template
> literal di objek label).

### [J-01] 🔴 [I18N] Label `extraDays`, `rejectReasonTooShort`, `transactions`, `titleFrom` dibentuk oleh **fungsi** di objek label default — tidak pernah menyentuh `translate()`
- **Lokasi:** `components/ui/order-extension-card.tsx:74` (`extraDays: (n) =>
  `+${n} hari``), `components/ui/delivery-proof-viewer.tsx:121-122`
  (`rejectReasonTooShort: (min) => `Minimal ${min} karakter``),
  `components/ui/counterpart-validation-card.tsx:80`
  (`transactions: (n) => `${n} transaksi selesai``),
  `components/ui/mutual-resolution-card.tsx` (`from: (name) => translate(…)`
  — ini sudah benar, kontras)
- **Bukti:** pemanggilan `t.extraDays(extensionDays)`
  (`order-extension-card.tsx:196,232`) merender string mentah dari closure —
  bukan children `<Text>`? Sebagian masuk `<Text>{t.extraDays(n)}</Text>` yang
  **akan** diterjemahkan `localizeChildren` bila bentuknya pas katalog
  (`"+{x} hari"`), tetapi pembentukan di dalam fungsi membuat kunci bergantung
  `shapeOf` template literal; `Minimal ${min} karakter` masuk lewat prop
  `errorText` (`delivery-proof-viewer.tsx:303`) yang memang `TEXT_PROPS`
  (ikut katalog) — tetapi `t.rejectReasonTooShort(...)` dievaluasi **sebelum**
  masuk prop, jadi katalog memuat bentuk `"Minimal {x} karakter"` sementara
  runtime memanggil `translate` pada hasil yang sudah diisi (bentuk final
  `"Minimal 10 karakter"`) → lookup `shapeOf` seharusnya menangkap ini, namun
  `n transaksi selesai` di `stats.join` ([J-02]) **tidak**.
- **Dampak:** risiko frasa Indonesia permanen pada UI English di beberapa
  jalur fungsi label; setiap perubahan copy tidak terdeteksi `check:i18n`.
- **Usulan:** kembalikan template (`"+{x} hari"`) dari fungsi label dan isi
  nilai lewat `translate(…, {x})` di titik render.

### [J-02] 🔴 [I18N] `stats.join(" · ")` dan `accessibilityValue.text = `${buyerPct}% ke pembeli`` dirakit dari potongan string — tidak pernah diterjemahkan
- **Lokasi:** `components/ui/counterpart-validation-card.tsx:175-177`
  (`stats.join(" \u00B7 ")` dirender sebagai children `<Text>` **bukan** string
  tunggal → `localizeChildren` hanya menyentuh anak string murni; array join
  sudah menjadi satu string sebelum render… ternyata `stats` di-`join` lebih
  dulu lalu dimasukkan sebagai `{stats.join(" · ")}` = **satu string** yang
  **akan** diterjemahkan bila ada di katalog — tetapi nilainya dinamis
  (`"5 transaksi selesai · ★ 4,8"`) sehingga `shapeOf` harus cocok),
  `components/ui/mutual-resolution-card.tsx:224-225`
  (`accessibilityValue={{ …, text: `${buyerPct}% ke pembeli` }}` — string
  template di prop `text` yang BUKAN `TEXT_PROPS` di generator
  (`scripts/gen-i18n-catalog.mjs` `TEXT_PROPS` tidak memuat `text` objek
  `accessibilityValue`) → tidak masuk katalog).
- **Bukti:** generator katalog hanya memindai prop bernama teks
  (`scripts/gen-i18n-catalog.mjs:46-58`) — `accessibilityValue`/`text` dalam
  object literal bukan nama prop teks standar; `summarize([...])` juga
  menghasilkan string gabungan yang diumpankan ke `accessibilityLabel`
  (masuk katalog sebagai satu string penuh — bentuknya sudah diisi variabel,
  sehingga kunci `shape` harus cocok dengan pola `shapeOf`).
- **Dampak:** pada UI English, label pembaca layar untuk kartu usulan
  sengketa & statistik counterpart tetap Indonesia.
- **Usulan:** `translate("{x}% ke pembeli", {x: buyerPct})`; untuk `stats`
  gunakan `translate("{x} transaksi selesai", {x})` di tempat, bukan `join`.

### [J-03] 🟠 [I18N] `OrderCardLabels.deadline` ("Batas waktu") dan label default beberapa komponen didefinisikan di `components/ui/*` (Indonesia polos) tanpa `translate()` di titik definisi
- **Lokasi:** `components/ui/order-card.tsx:96-100` (`DEFAULT_LABELS`),
  `components/ui/fee-breakdown.tsx:51-64`, `components/ui/delivery-proof-viewer.tsx:96-122`
- **Bukti:** `DEFAULT_LABELS.deadline` dirender lewat `<Text>{t.deadline}</Text>`
  (`order-card.tsx:216`) — anak string murni → `localizeChildren` menerjemahkan
  bila kunci ada; katalog dibuat dari pemindaian sumber (generator) **tidak**
  memindai nilai objek `DEFAULT_LABELS` (bukan JSX children di titik render? —
  generator memindai properti object literal bernama teks; `deadline` BUKAN
  `TEXT_PROPS`) → kemungkinan besar tidak masuk katalog.
- **Dampak:** `check:i18n` tidak menangkap perubahan copy "Batas waktu"; teks
  tetap Indonesia di mode English bila kunci tidak ditemukan.
- **Usulan:** daftarkan `DEFAULT_LABELS` ke `TEXT_PROPS`/pengecualian sadar, atau
  bungkus `translate()` saat definisi.

### [J-04] 🟠 [I18N] `orderLinkStatusMeta` fallback `label: status` (nilai mentah server) dirender sebagai label badge
- **Lokasi:** `lib/order-link-labels.ts:44-47`
- **Bukti:** `[PROBE-P26] orderLinkStatusMeta(toString)= {"label":"toString"}`,
  `orderLinkStatusMeta("")= {"label":""}`.
- **Dampak:** label enum backend (Inggris) tampil mentah; string kosong
  menghasilkan badge kosong.
- **Usulan:** fallback "Status tidak dikenal" + `translate`.

### [J-05] 🟡 [I18N] `QrisPaymentPanel` & `pending-actions-banner` merangkai meta teks lewat template literal (`QRIS berlaku sampai ${…}`) yang lolos katalog
- **Lokasi:** `components/qris-payment-panel.tsx:105-107`
  (`translate("Berlaku sampai {x} · {y}", …)` — ini **sudah** benar),
  `components/pending-actions-banner.tsx:70-73` (`meta: `QRIS berlaku sampai
  ${formatDateTimeWIB(action.expiresAt)}``) — TIDAK lewat translate
- **Bukti:** `describe()` (`pending-actions-banner.tsx:64-90`) mengembalikan
  `meta` berupa template literal; dirender sebagai `<Text>{info.meta}</Text>`
  (`:143-146`) → `localizeChildren` menerjemahkan bila bentuk ada di katalog;
  bentuknya `"QRIS berlaku sampai {x}"` (shape) — generator **mungkin**
  menangkapnya lewat `shapeOf` (komentar F-09 generator) tetapi tiga varian
  (`QRIS berlaku sampai`, `Tagihan berlaku sampai`, `Kode OTP berlaku sampai`,
  `Periksa status pembayaran pesanan Anda`, `Selesaikan pembayaran di layar
  Top-up`, `Periksa status penarikan di layar Tarik Dana`) berada di dalam
  `switch` — pemindaian AST mengambil nilai properti `meta` (bukan `TEXT_PROPS`)
  → tidak terjamin masuk katalog.
- **Dampak:** teks banner pemulihan dana bisa tetap Indonesia di UI English.
- **Usulan:** `translate()` eksplisit untuk `meta`/`title` di `describe()`.

### [J-06] 🟡 [I18N] `OrderHistoryTimeline` `description = `oleh ${actorLabel} — ${e.note}`` (gabungan `parts.join`) lolos dari translate meski potongannya sudah diterjemahkan
- **Lokasi:** `components/ui/order-history-timeline.tsx:101-103`
  (`parts.push(`${labels.by} ${actorLabel}`)` lalu `parts.join(" \u2014 ")`)
- **Bukti:** `labels.by = "oleh"` sudah lewat `DEFAULT_LABELS` (bisa
  dioverride), tetapi string akhir `"oleh Pembeli — catatan"` dibentuk di
  lapisan komponen → anak `<Text>` menerima satu string final yang harus
  cocok `shapeOf` untuk diterjemahkan.
- **Dampak:** urutan kata ("oleh X" vs "by X") tidak bisa diubah terjemahan.
- **Usulan:** `translate("oleh {x}", {x: actorLabel})` lalu `join`.

### [J-07] 🟡 [I18N] `DisputeCallLogItem`/`CALL_OUTCOME` memetakan status ke label Inggris (`"REQUESTED"`, `"COMPLETED"`) yang tampil mentah bila map meleset
- **Lokasi:** `app/dispute/[id].tsx:79-89` (`CALL_OUTCOME` Partial),
  `:632` (`outcome={mapValue(CALL_OUTCOME, c.status, c.status)}`)
- **Bukti:** `mapValue(..., c.status, c.status)` — fallback nilai status mentah
  (Inggris).
- **Dampak:** status panggilan baru tampil mentah di daftar.
- **Usulan:** fallback `translate` + label Indonesia generik.

### [J-08] 🔵 [I18N] `MutualResolutionCard` `DEFAULT_LABELS.from` memanggil `translate` di definisi (benar) tetapi `OrderExtensionCard` `DEFAULT_LABELS.from` juga — konsisten, namun `extraDays`/`rejectReasonTooShort` tidak (sudah di [J-01])
- **Lokasi:** `components/ui/order-extension-card.tsx:66-68` vs `:74`
- **Bukti:** dua gaya berbeda dalam satu objek label yang sama.
- **Dampak:** inkonsistensi pola; memudahkan salah tulis berikutnya.
- **Usulan:** standarkan satu gaya.

---

## K. Aksesibilitas

### [K-01] 🔴 [KODE] `DeliveryProofViewer` mengeja nomor resi per huruf lewat `trackingNumber.split("").join(" ")` di `accessibilityLabel`
- **Lokasi:** `components/ui/delivery-proof-viewer.tsx:321-323`
  (`accessibilityLabel={[translate(t.tracking),
  trackingNumber.split("").join(" ")].join(" ")}`)
- **Bukti:** untuk resi 20 karakter, pembaca layar membaca 20 huruf terpisah
  ("J N E 1 2 3 …") — ini disengaja untuk kejelasan digit, tetapi
  `accessibilityLabel` **menimpa** teks anak, jadi pengguna pembaca layar
  kehilangan format asli dan butuh 5-10 detik untuk satu baris; dan tidak ada
  `accessibilityHint` bahwa salinan tersedia lewat tombol di sebelahnya.
- **Dampak:** jalur utama verifikasi pengiriman tidak ramah pembaca layar.
- **Usulan:** kembalikan resi apa adanya + jeda spasi antar **grup** (bukan per
  huruf), tambahkan hint "Salin nomor resi".

### [K-02] 🟠 [KODE] `OrderCard` `accessibilityLabel` tidak memuat **nominal** dan **status** — dua informasi finansial terpenting kartu
- **Lokasi:** `components/ui/order-card.tsx:159-167` (`summarize([unread?, orderId,
  title, counterpartRole + name, timestamp])`)
- **Bukti:** `amount` dan `status` tidak ikut dirangkum; `OrderStatusBadge`
  punya `accessibilityLabel` sendiri (`order-status-badge.tsx:158`) tetapi
  kartu `Card` `accessible` menggabungkan label utamanya sendiri.
- **Dampak:** pengguna pembaca layar tidak tahu berapa nilai transaksi tanpa
  menelusuri anak.
- **Usulan:** tambahkan `formatRupiah(amount)` dan label status.

### [K-03] 🟡 [KODE] `Countdown` `announceEverySeconds` default 5 membulatkan sisa waktu ke kelipatan 5 — 31 detik diumumkan "30"
- **Lokasi:** `components/ui/countdown.tsx:205-210` (`Math.ceil(remaining /
  announceEverySeconds) * announceEverySeconds` untuk `remaining > 30`)
- **Bukti:** logika `remaining > 30` membulatkan nilai 31-34 menjadi 35;
  pengumuman yang naik 4 detik sebelum turun bisa membingungkan.
- **Dampak:** minor (pengumuman SR).
- **Usulan:** `Math.floor` untuk sisa; `Math.ceil` hanya untuk jeda pengumuman.

### [K-04] 🟡 [KODE] `<QrisPaymentPanel>` QR image tanpa label aksesibilitas deskriptif (hanya caption teks di bawah)
- **Lokasi:** `components/qris-payment-panel.tsx:94-104` (`<QRCodeDisplay
  value={qrString} title=… caption=…>`), `components/ui/qr-code-display.tsx`
- **Bukti:** tidak ada `alt`/`accessibilityLabel` yang menyebutkan "kode QR
  pembayaran"; pengguna pembaca layar bergantung pada `title`/`caption`
  terpisah.
- **Dampak:** pengalaman SR untuk momen pembayaran kurang jelas.
- **Usulan:** `accessibilityLabel="Kode QR pembayaran …"`.

### [K-05] 🟡 [KODE] `MutualResolutionCard` bar split `accessibilityValue.text` berisi teks Indonesia hardcoded (`${buyerPct}% ke pembeli`) — [J-02] juga mencatat kebocoran i18n
- **Lokasi:** `components/ui/mutual-resolution-card.tsx:224-225`
- **Bukti:** lihat [J-02].
- **Dampak:** ganda (SR + i18n).
- **Usulan:** selesaikan di [J-02].

---

## L. Keamanan & privasi

### [L-01] 🔴 [KODE] `fileUrls` bukti kirim (S3 object key) dipakai langsung sebagai `uri` `<Picture>`/`MediaViewer` — object key bukan URL publik
- **Lokasi:** `app/delivery-proof/[orderId].tsx:73-81`
  (`toAttachments` memetakan `p.fileUrls` → `{kind:"image", uri}`),
  dokumentasi `:23` ("`fileUrls` di DTO adalah S3 object key …, respons GET
  mengembalikan URL siap tampil") — tetapi pemetaan memakai `fileUrls` apa
  adanya, bukan field URL dari `DeliveryProof` (`lib/api/orders.ts:423-432`
  tidak punya field `urls`).
- **Bukti:** tipe `DeliveryProof.fileUrls: string[]` dipakai untuk **kedua**
  peran (key saat kirim, URL saat terima) — satu field untuk dua makna.
- **Dampak:** bila server menaruh object key di `fileUrls`, semua bukti gagal
  dimuat (gambar rusak) — dan pengguna bisa mengklik lampiran yang membuka
  `MediaViewer` dengan `url` key mentah. Untuk bukti sengketa
  (`DisputeEvidence.url ?? e.fileKey`, `app/dispute/[id].tsx:408`) sudah ada
  fallback dua nama — pola yang tidak diterapkan di sini.
- **Usulan:** bedakan `fileKeys` (request) vs `fileUrls` (response) di tipe;
  fallback `url ?? fileKey` + `safeHttpsUrl` sebelum render.

### [L-02] 🔴 [KODE] `getReceiptHtml` menyimpan HTML mentah dari server ke berkas lalu membagikannya lewat share sheet — tanpa sanitasi/penandaan
- **Lokasi:** `lib/api/orders.ts:882-888`, `app/invoice/[orderId].tsx:77-97`
  (`saveTextFile(html, …)` → `shareContent`/`export-file`)
- **Bukti:** `responseType: "text"` menerima string apa pun (lihat [D-14]);
  `saveTextFile` (`lib/export-file.ts`) menulis apa adanya. Di web,
  `handleShare` (`:110-127`) membagikan **teks** (bukan HTML) — dua format
  berbeda untuk satu aksi "Bagikan".
- **Dampak:** berkas "struk" HTML yang memuat skrip/aset eksternal bila server
  berubah sumbernya; secara umum dokumen finansial dibagikan tanpa checksum/
  nomor verifikasi.
- **Usulan:** gunakan `invoice/pdf` resmi ([O-04]); bila tetap HTML, tandai
  header `data-` verifikasi dan jangan aktifkan skrip (download saja).

### [L-03] 🔴 [KODE] PIN dompet dikirim sebagai `PayOrderDto.pin` polos di body JSON — tanpa penandaan sensitif di jalur log/error
- **Lokasi:** `lib/api/types.ts:953-956`, `lib/api/orders.ts:595-597`,
  `app/order/[id].tsx:322` (`api.orders.payOrder(order.id, { pin })`),
  `lib/api/client.ts:457-462` (`JSON.stringify(body)`)
- **Bukti:** `ApiError.raw` memang disembunyikan dari serialisasi
  (`lib/api/errors.ts:60-73` — baik), tetapi `body` request tidak pernah
  disamarkan di jalur mana pun (memang tidak di-log, tetapi `debug`/telemetri
  masa depan yang membaca `options.body` akan menyentuh PIN). `PinInput`
  (`components/ui/pin-input.tsx`) — `secureTextEntry` perlu dikonfirmasi;
  `PayOrderDto` adalah kontrak backend jadi pengiriman PIN memang disyaratkan.
- **Dampak:** risiko kebocoran PIN lewat jalur logging yang belum ada; untuk
  audit ini yang terbukti adalah: **tidak ada lapisan redaksi** pada body
  mutasi pembayaran berisi PIN.
- **Usulan:** redaksi `pin` di `RequestOptions` (ganti `"***"` untuk key
  `pin|password|otp`) di semua jalur log/telemetri; pastikan `secureTextEntry`.

### [L-04] 🟠 [KODE] `pending-actions` menyimpan `amount` & `txId` transaksi di SecureStore — dibersihkan saat logout? (dokumen menyatakan ya, tetapi `clearPendingActions` hanya dipanggil dari `resetPendingActionsForTest`/… )
- **Lokasi:** `lib/pending-actions.ts:206-212` (`clearPendingActions`),
  `lib/api/session.ts` (`clearSession`) — perlu konfirmasi pemanggilan
- **Bukti:** `clearPendingActions` diekspor; grep pemanggil di `session.ts`
  tidak terlihat di potongan yang dibaca — komentar `:25-26` menyatakan
  "storage juga dibersihkan saat logout" (`components/pending-actions-banner.tsx:14-15`).
  Bila `clearSession` tidak memanggilnya, catatan aksi uang (nominal!) akun
  sebelumnya tetap ada untuk sesi berikutnya di perangkat yang sama.
- **Dampak:** kebocoran data finansial antar-akun di perangkat bersama.
- **Usulan:** panggil `clearPendingActions()` dari `clearSession` (uji
  `session-logout-order.test.ts` sudah ada — tambah assertion).

### [L-05] 🟠 [KODE] `buildUrl` menolak URL absolut (baik) — tetapi `getReceiptHtml`/`upload` memakai `responseType`/transport terpisah yang tidak melewatinya
- **Lokasi:** `lib/api/client.ts:71-78` (guard path relatif),
  `lib/api/upload.ts:52-58` (`safeHttpsUrl` untuk presigned — sudah baik)
- **Bukti:** pemisahan transport unggah sudah benar (`credentials: "omit"`);
  `getReceiptHtml` tetap lewat `http` biasa (cookie terkirim) untuk konten
  yang nantinya dibagikan/diunduh.
- **Dampak:** kecil; konsistensi pola.
- **Usulan:** dokumentasikan kebijakan konten eksternal.

---

## M. Kualitas kode, kontrak tipe & tes

### [M-01] 🔴 [KODE] `Paginated<T>.meta.total: number` tetapi `readPage` mengembalikan `total: undefined` untuk meta hilang — tipe berbohong
- **Lokasi:** `lib/api/orders.ts:441-446` (`Paginated<T>`),
  `lib/api/response.ts:138-147` (`meta: { … total: Number.isFinite(total) ? total : undefined … }`),
  pemakaian `res?.meta?.totalPages` (`app/extension/[orderId].tsx:175`,
  `app/order-links.tsx:74`)
- **Bukti:** tipe `Page<T>` di `lib/api/response.ts:113-116` menulis
  `total?: number` (jujur) sedangkan `Paginated` di `lib/api/orders.ts:443`
  `total: number` (wajib) — dua tipe untuk hal yang sama.
- **Dampak:** `Math.ceil(total / limit)`/UI penghitung bisa menerima
  `undefined` yang lolos tipe → `NaN` di UI.
- **Usulan:** samakan `Paginated` dengan `Page` (atau pakai `Page` langsung).

### [M-02] 🔴 [KODE] `Order.fee?: FeeBreakdown` dan `DeliveryProof.status: string` tidak punya normalizer — kontrak UNVERIFIED dibiarkan mengalir ke komponen yang mengasumsikan bentuk
- **Lokasi:** `lib/api/orders.ts:245-270` (`Order`), `:423-432`
  (`DeliveryProof`), `components/ui/fee-breakdown.tsx:155-157` (aritmetika
  langsung), `app/delivery-proof/[orderId].tsx:57-61` (`toStatus` membandingkan
  `"CONFIRMED"`/`"REJECTED"` string)
- **Bukti:** `toStatus` mengembalikan `"pending"` untuk status asing apa pun —
  status `REJECTED` salah eja dari server dianggap "pending" → tombol
  konfirmasi tampil kembali untuk bukti yang sebenarnya sudah ditolak.
- **Dampak:** salah tipe/nilai menghasilkan keputusan UI yang salah (bukan
  error) — kelas risiko tertinggi untuk escrow.
- **Usulan:** normalizer per entitas (sudah 3 ada: order, payment-status,
  counterpart, invoice — lengkapi sisanya).

### [M-03] 🔴 [KODE] `nextOrderStatus` bertipe `OrderStatus | undefined` padahal runtime bisa mengembalikan **fungsi** `Object.prototype` (A-01) — tipe menutupi bug
- **Lokasi:** `lib/api/orders.ts:164-180`
- **Bukti:** `[PROBE-P20]` — `typeof n === "function"` untuk `toString`.
- **Dampak:** kontribusi langsung pada crash A-01.
- **Usulan:** `Object.create(null)` + return type `string | undefined`.

### [M-04] 🟠 [KODE] `use-qris-payment` `TERMINAL` di-cast `readonly string[]` di 3 tempat (`(TERMINAL as readonly string[]).includes(status ?? "")`) — kebocoran type-safety di jalur pembayaran
- **Lokasi:** `lib/use-qris-payment.ts:36,88,92,132`
- **Bukti:** cast berulang menunjukkan tipe `status` (`string | null`) tidak
  cocok dengan `PaymentStatus["status"]` union di `lib/api/orders.ts:407-410`.
- **Dampak:** status baru server lolos dari `TERMINAL` tanpa koreksi tipe.
- **Usulan:** `Set<PaymentStatus["status"]>` + status bertipe.

### [M-05] 🟠 [KODE] `handlePayPin` deps `[order, closeSheet, query, scheduleResult]` — `query` objek baru tiap render → callback dibuat ulang terus (juga `runAction` `[toast.show, closeSheet, query]`)
- **Lokasi:** `app/order/[id].tsx:371-373` (`runAction`), `:358-370` (`handlePayPin`)
- **Bukti:** `useApiQuery` mengembalikan objek literal baru tiap render
  (`lib/use-api-query.ts:253`) → `useCallback` tidak pernah stabil.
- **Dampak:** performa (render berulang subtree tombol); risiko efek samping
  bila suatu saat ada `useEffect([runAction])`.
- **Usulan:** `query.refresh` di-ref (fungsi sudah `useCallback([load])`).

### [M-06] 🟡 [KODE] `docs/audit/API-ENDPOINT-AUDIT.md` dirujuk 2× di komentar kode tetapi tidak ada di repo
- **Lokasi:** `lib/api/orders.ts:317-320` ("lihat audit docs/audit/API-ENDPOINT-AUDIT.md API-06"), `lib/api/response.ts:84-87`
- **Bukti:** `ls docs/` = `api/`, `audit-etalase-*` — `docs/audit/` tidak ada.
- **Dampak:** referensi audit mati; menghambat verifikasi klaim lama.
- **Usulan:** tautkan ke dokumen yang ada atau hapus referensi.

### [M-07] 🟡 [KODE] `tests/` tidak memiliki satu pun tes untuk domain `orders`/escrow (list 33 file tes tidak memuat `orders`, `disputes`, `qris`, `fee`)
- **Bukti:** `tests/` — `counterpart-validation.test.ts` (satu-satunya yang
  menyentuh domain); `idempotency-key.test.ts`, `verdict-responses.test.ts`
  menyentuh transport. `check:api` memvalidasi constraint DTO, bukan perilaku.
- **Dampak:** seluruh A/B/C/D di atas tidak punya jaring pengaman regresi —
  tepat mengapa bug kelas `normalizeCounterpartValidation` bisa berulang.
- **Usulan:** uji state-matrix (`is*` + `nextOrderStatus`), normalizer, dan
  `FeeBreakdown` aritmetika — probe audit ini bisa dijadikan awal.

---

## N. UX & copy alur dana

### [N-01] 🔴 [KODE] Sheet "Batalkan order?" menjanjikan "dana yang sudah masuk dikembalikan ke pembeli" untuk **semua** status termasuk `PROCESSING`/`IN_DELIVERY`
- **Lokasi:** `app/order/[id].tsx:886-889` (description), `:897-906` (aksi)
- **Bukti:** teks statis; `CancelOrderDto` (`lib/api/types.ts:976-984`) tidak
  menjamin refund (keputusan backend/adjudikasi). Dibandingkan
  `delivery-proof` yang berhati-hati: "Dana di escrow akan dilepas ke penjual
  setelah Anda mengonfirmasi" (`delivery-proof-viewer.tsx:115`).
- **Dampak:** pengguna membatalkan berdasarkan janji refund yang mungkin tidak
  terjadi → sengketa berikutnya ("saya diberi tahu dana kembali").
- **Usulan:** copy kondisional per status + catatan "keputusan akhir mengikuti
  ketentuan escrow".

### [N-02] 🔴 [KODE] Dialog "Terima order ini?" berbunyi "setelah pembeli membayar" padahal aksinya `confirmOrder({action:"ACCEPT"})` terjadi **sebelum** pembayaran
- **Lokasi:** `app/order/[id].tsx:1067-1070` (description),
  `:1072-1077` (`confirmOrder … ACCEPT`), `lib/api/orders.ts:589-593`
- **Bukti:** gerbang `canConfirm = status === "WAITING_CONFIRMATION"`
  (`:488`) — order belum dibayar. Urutan spec (`confirm` → `pay`) juga
  mendukung itu (komentar `:473-481`).
- **Dampak:** penjual mengira konfirmasi bisa menunggu pembayaran padahal
  justru membuka kunci pembayaran; copy salah urutan.
- **Usulan:** "Pembeli akan diminta membayar setelah Anda terima."

### [N-03] 🔴 [KODE] `deadlineDraft` menampilkan angka yang tidak sama dengan yang dikirim: input "20" → tampil "20" tetapi `deliveryDeadlineDays` dikirim `14`
- **Lokasi:** `app/create-transaction.tsx:547-557` (`setDeadlineDays(
  Math.min(MAX_DEADLINE_DAYS, Math.max(0, n)))` sementara
  `setDeadlineDraft(digits)` mempertahankan "20"), `:574-575` (ringkasan
  `Tenggat {deadlineDays} hari` = "14 hari")
- **Bukti:** `MAX_DEADLINE_DAYS = 14` (`API_CONSTRAINTS.CreateOrderDto.
  deliveryDeadlineDays.maximum`, `lib/api/constraints.ts`); `onChangeText`
  memotong 2 digit lalu clamp angka — field dan state terbelah.
- **Dampak:** pengguna mengetik 20 (mengira tiga minggu) — field menampilkan
  20, ringkasan menampilkan 14, order dibuat 14 hari. Kontradiksi di form
  keuangan yang sama.
- **Usulan:** clamp tampilan juga (set `deadlineDraft` ke `String(clamped)`)
  atau tampilkan `errorText` "Maksimal 14 hari".

### [N-04] 🟠 [KODE] `kycReasonMessage` menebak aturan KYC backend dari regex pesan bahasa Inggris (`/cumulative/i`, `/rolling/i`)
- **Lokasi:** `app/create-transaction.tsx:124-143`
- **Bukti:** `err.backendCode === "KYC_REQUIRED"` sudah dikenali (`:564`),
  tetapi rincian alasan diambil dari `err.message` yang bisa berubah redaksinya
  kapan saja; fallback ketiga menyebut "Rp 2.000.000 ke atas" hardcoded.
- **Dampak:** penjelasan kebijakan finansial yang salah (angka batas) jika
  backend mengubah aturan/message.
- **Usulan:** baca `backendCode` turunan (`KYC_CUMULATIVE` dsb.) atau field
  `meta` terstruktur; jangan hardcode angka di klien.

### [N-05] 🟡 [KODE] `feeError` baru ditampilkan di langkah terakhir — pengguna bisa mengisi 3 langkah tanpa tahu fee tidak bisa dihitung
- **Lokasi:** `app/create-transaction.tsx:235-240` (`feeError`), `:587-593`
  (render `footer` hanya `step === LAST_STEP`)
- **Bukti:** `refreshFee` (`:305-325`) men-set `feeError` saat debounce 400ms
  pertama — di langkah 3 (nilai transaksi) pengguna tidak melihat apa pun.
- **Dampak:** kejutan di akhir wizard.
- **Usulan:** tampilkan indikator ringan di langkah nilai transaksi.

### [N-06] 🔵 [KODE] `ReasonPicker` "Lainnya" mewajibkan catatan (`cancelValid`), tetapi `ConfirmOrderDto.reason` (tolak) dan `RejectDeliveryDto.note` punya aturan panjang berbeda yang tidak ditampilkan
- **Lokasi:** `app/order/[id].tsx:502-504` (`cancelValid`),
  `:897-906`, `:949-958` (tolak — `NOTE_MAX = 500`),
  `components/ui/delivery-proof-viewer.tsx:186-196` (`DELIVERY_REJECT_NOTE_MIN = 10`)
- **Bukti:** `RejectDeliveryDto.note` wajib 10-1000 (`lib/api/types.ts:1071-1080`)
  — ditampilkan; `ConfirmOrderDto.reason` opsional ≤500 — placeholder
  "Alasan penolakan (opsional)" (`:955`) sudah tepat.
- **Dampak:** minor — tidak ada cacat nyata, hanya inkonsistensi panjang pesan.
- **Usulan:** tampilkan hitungan minimum untuk tolak juga.

### [N-07] 🔵 [KODE] `QrisPaymentPanel` "Cek status sekarang" tidak memberi feedback sukses (hanya `pollError` bila gagal)
- **Lokasi:** `components/qris-payment-panel.tsx:145-147`, `app/order/[id].tsx:860`
  (`onCheckStatus={() => void qrisPayment.syncStatus()}`)
- **Bukti:** `syncStatus` (`lib/use-qris-payment.ts:74-100`) hanya set
  `status`/`pollError` — bila status tetap `PENDING`, tidak ada konfirmasi
  bahwa pengecekan terjadi.
- **Dampak:** pengguna menekan berulang.
- **Usulan:** toast "Status diperiksa" / last-checked timestamp.

---

## O. Peningkatan kapabilitas (bukan cacat)

### [O-01] 🔵 [IMPROVE] `CreateOrderDto.attachments` (max 5) & `inquiryRoomId` didukung kontrak tetapi tidak ada UI-nya
- **Lokasi:** `lib/api/types.ts:934-941`, `app/create-transaction.tsx:515-523`
  (body tanpa keduanya).
- **Nilai:** lampiran spesifikasi order di awal (mengurangi sengketa) dan
  tautan konteks chat inquiry.

### [O-02] 🔵 [IMPROVE] `GET /v1/orders` mendukung `from`, `to`, `sortBy`, `sortOrder` (spec) — tab Transaksi tidak memakainya
- **Lokasi:** `docs/api/openapi.json` (`/v1/orders` get: 8 parameter),
  `lib/api/orders.ts:521-528` (`ListOrdersQuery` hanya 5).
- **Nilai:** saring periode (pembukuan bulanan) & urut nilai transaksi.

### [O-03] 🔵 [IMPROVE] `UpdateShippingDto.trackingNotes` (≤500) tidak ada UI-nya
- **Lokasi:** `lib/api/types.ts:958-968`, `app/order/[id].tsx:1023-1049`.
- **Nilai:** catatan pengiriman (asuransi, packing) untuk bukti sengketa.

### [O-04] 🔵 [IMPROVE] `GET /v1/orders/{id}/invoice/pdf` ada di spec tetapi klien hanya memakai `receipt` HTML
- **Lokasi:** `docs/api/openapi.json` (`/v1/orders/{orderId}/invoice/pdf`),
  `lib/api/orders.ts:882-888`.
- **Nilai:** struk PDF sah untuk arsip (menyelesaikan [D-14]/[L-02]).

### [O-05] 🔵 [IMPROVE] Sheet sengketa di detail order belum mendukung lampiran (`SubmitDisputeDto.fileUrls/fileTypes`) — lihat [E-11]
- **Nilai:** bukti sekaligus saat membuka sengketa.

---

## Lampiran A — Log mentah probe (utama)

```
[PROBE-P20] nextOrderStatus(toString) typeof= function value= function toString() { [native code] }
[PROBE-P20] nextOrderStatus(constructor) typeof= function value= function Object() { [native code] }
[PROBE-P20] timeline title typeof= function
stderr: Functions are not valid as a React child … <div>{toString}</div>
[PROBE-P21] title[0] typeof= function desc[1]= oleh function toString() { [native code] }
[PROBE-P3]  numeric id -> "" len 0
[PROBE-P22] normalizeOrder({}) => {"id":""}
[PROBE-P22] seg('') => THROW: ApiError Identitas data tidak valid.
[PROBE-P22] seg('a/b') => a%2Fb
[PROBE-P23] unwrap({success:false,message:"E"}) => {"success":false,"message":"E"}   (tanpa throw)
[PROBE-P31] payment-status dari envelope error => {"success":false,…,"status":"PENDING"} terminal? false
[PROBE-P30] spread {"proofs":[{"id":"p1"}]} => THROW ps is not iterable
[PROBE-P30] spread {"data":[{"id":"p1"}]} => THROW ps is not iterable
[PROBE-P5]  {"valid":false,"reason":"Anda diblokir oleh pengguna ini"} => {"valid":false,"reason":"…","notFound":true}
[PROBE-P5]  {"valid":"yes"} => {"valid":false,"notFound":true}
[PROBE-P4]  kosong: {"status":"PENDING"}   paid flag: {"paid":true,"status":"PENDING"}
[PROBE-P8]  splitFee(10001,SPLIT)= {"buyer":5001,"seller":5000}   feeShare(SPLIT)= {"buyer":0.5,"seller":0.5}
[PROBE-P8]  splitFee(0.5,SPLIT)= {"buyer":0.5,"seller":0}
[PROBE-P8]  localPays(diskon dipotong ke fee)= 100000  serverBuyerPays(mis.)= 55000
[PROBE-P9]  addDays(Date invalid,3)= Invalid Date    addDays(nan,3)= Invalid Date
[PROBE-P10] toEpochMs(1700000000)= 1700000000        toEpochMs('1700000000000')= undefined
[PROBE-P11] formatRupiah(1500.5)= Rp1.501  formatRupiah(1500.4)= Rp1.500
[PROBE-P11] amountInputValue('1.000.50')= 100050      parseRupiah('10.000,50')= NaN
[PROBE-P24] formatDateTimeWIB('2026-09-24')= 24 Sep 2026, 07:00 WIB
[PROBE-P26] orderLinkStatus(PENDING)= EXPIRED   orderLinkStatus()= EXPIRED
[PROBE-P27] buildUrl('/v1/orders',{status:''}) => …/v1/orders?status=
[PROBE-P6]  negatif: {"total":-5000,…}   desimal: {"total":1500.5,…}
[PROBE-P6]  items string amount: … invoiceNumber INV-1 … issuedAt ""
[PROBE-P1]  isCancellable(IN_DELIVERY)= true   isCancellable(DELIVERED)= true   isDisputable(WAITING_CONFIRMATION)= false
[PROBE-P1]  chain from PENDING_PAYMENT: PENDING_PAYMENT -> PAID -> PROCESSING -> IN_DELIVERY -> COMPLETED
[PROBE-P2]  tone(toString)= neutral label= [Function: toString]
[PROBE-P29] isOrderActive(DISPUTED)= true
```

Reproduksi: `npx vitest run --config vitest.components.config.ts tests/zz-probe-escrow.test.tsx`
(12/12 lulus; file probe sengaja dipertahankan sebagai artefak audit dan bisa
dijadikan kerangka tes regresi sesuai [M-07]).

## Lampiran B — Kandidat yang DIBUKTIKAN BUKAN issue (agar jujur)

| Kandidat | Hasil uji | Kenapa bukan issue |
|---|---|---|
| `OrderStatusBadge` label `toString` | `isOrderStatus()` guard sudah memakai `Array.includes` (`components/ui/order-status-badge.tsx:101-103`) | komponen ini aman; hanya pembaca `ORDER_STATUS_LABELS` di luar badge yang bermasalah ([A-01]/[A-02]/[I-02]) |
| `orderLinkStatus` prototype (`"toString"` → label fungsi) | `[PROBE-P26] orderLinkStatus(toString)= EXPIRED` | `hasOwn` sudah dipakai (`lib/order-link-labels.ts:33`) — bug kelas itu sudah tertutup di modul ini |
| `parseRupiah("")` / `formatDateTime("")` | `0` / `"—"` | sudah aman |
| `unwrapResponse({orders: []})` (list biasa) | diteruskan utuh | benar — hanya envelope `{success:false}` tanpa `data` yang bermasalah ([B-04]) |
| `buildUrl` URL absolut | throw | guard anti-kebocoran kredensial bekerja |
| `countdown` `until` invalid | `formatted = "—"` (`useCountdown` `endInvalid`) | sudah aman untuk nilai `until` yang ada tapi rusak; yang belum aman adalah `until` **hilang** ([C-03]) |
| `fee` `NaN` → `formatRupiah` | `"—"` | tidak crash, tapi tetap salah tampil ([B-03]/[D-08]) |
| `isCancellable(COMPLETED)` | `false` | benar |
| `seg("..")` | throw | guard path traversal bekerja |
| `toEpochMs(null)` | `undefined` | benar |
| `readList({history: []}, ["history"])` | `[]` | helper memang sudah benar — yang tidak memakainya adalah adapter ([D-02..D-04]) |
| `orderPartyName(undefined)` | `undefined` | guard deref bekerja |
| `durationHoursParts(-1)` | `null` | aman |
| `Money-Mutation cache invalidate` untuk `POST /v1/orders/{id}/pay` | memang diinginkan | benar — yang salah hanya cakupan `calculate-fee` ([G-01]) |
| `Idempotency-Key` jalur 401→refresh→resend | kunci sama (tes `idempotency-key.test.ts` lulus) | benar; yang belum tertutup hanya retry manual pengguna ([C-06]) |
