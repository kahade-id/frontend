# Audit Alamat & Kurir — 10 Oktober 2026

Lingkup: kelola alamat (tambah/edit/hapus/default), pilih alamat saat checkout,
integrasi kurir (cek ongkir, tracking). Tiga repo, branch `claude-alamat`:
`frontend-wt-alamat`, `backend-wt-alamat`, `admin-wt-alamat`.

Status: ✅ diperbaiki di branch ini · ⏸ ditunda (butuh keputusan produk/backend) · ℹ️ dicatat saja.

## A. Backend — modul `courier`

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| A01 | Event `EXCEPTION` setelah `IN_TRANSIT`/`OUT_FOR_DELIVERY` tidak pernah mengubah status (rank EXCEPTION=2 < 3) → kendala pengiriman tidak terlihat | `courier.service.ts:94-103`, `:744` | ✅ |
| A02 | Setelah timeout → `UNKNOWN`, refresh berikutnya yang sukses tanpa event BARU (semua dedup) membiarkan status `UNKNOWN` selamanya | `courier.service.ts:571-590` | ✅ |
| A03 | Tidak ada polling tracking terjadwal — hanya webhook + refresh manual; provider mock tak pernah kirim webhook → "tracking tidak update" | tidak ada service di `scheduler/` | ✅ sweep baru |
| A04 | `STALE_EVENT_THRESHOLD_HOURS` & kolom `staleAlertSentAt` tidak pernah dipakai — alert tracking macet (G247) tidak ada | `courier.service.ts:133`, schema `:5514` | ✅ via sweep |
| A05 | `MaskedShipment.orderId` = cuid internal `orders.id`, bukan `orderId` publik → FE `getOrder(shipment.orderId)` 404, teks notifikasi memuat cuid | `courier.service.ts:296-330`, `:378-380`, `:799-805` | ✅ |
| A06 | Rekonsiliasi memberi nama `estimatedCostSen/actualCostSen/diffSen` padahal nilai RUPIAH (BigInt rupiah) → admin membagi 100 | `courier.service.ts:1208-1239` | ✅ rename ke rupiah |
| A07 | `ApproveShippingRefundDto.amountSen` sebenarnya rupiah — nama menyesatkan | `dto/courier.dto.ts:167-180` | ✅ `amount` |
| A08 | `listEvents` diurutkan `createdAt` — event provider out-of-order tampil salah urutan | `courier.service.ts:523-531` | ✅ `occurredAt` |
| A09 | Webhook: `occurredAt` tak valid → `Invalid Date` → Prisma 500 → provider retry tanpa henti | `courier.service.ts:689` | ✅ |
| A10 | Webhook: `trackingNumber` tidak di-trim | `courier.service.ts:672` | ✅ |
| A11 | `getQuotes`: hasil `validateAddress` dibuang (`void validated`) + query katalog per provider (N+1) | `courier.service.ts:243-264` | ✅ |
| A12 | Pesan refresh untuk resi manual "Belum ada nomor resi provider" menyesatkan | `courier.service.ts:559-561` | ✅ |
| A13 | Push `pushData.orderId` memakai cuid internal | `courier.service.ts:828` | ✅ (ikut A05) |

## B. Backend — alamat & order

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| B01 | `createOrder` mewajibkan `shippingAddressId` milik PEMBUAT walau pembuat berperan SELLER → alamat PENJUAL tersimpan sebagai tujuan kirim | `orders.service.ts:667-693` | ✅ SELLER dilewati |
| B02 | Tidak ada jalan bagi pembeli order buatan penjual untuk mengisi alamat (confirm tidak menerima alamat) | `order-state.service.ts:342`, `dto/order-actions.dto.ts:41` | ✅ `shippingAddressId` di confirm |
| B03 | Accept link buatan BUYER gagal total bila alamat link sudah dihapus pembeli — penerima (seller) tidak bisa memperbaiki | `order-links.service.ts:403-420` | ✅ fallback alamat utama pembeli |
| B04 | `deleteAddress` mempromosikan default pengganti berdasar `updatedAt` — wajar, dicatat | `addresses.service.ts:156-164` | ℹ️ |
| B05 | `limit` list alamat maks 100 (PaginationDto) vs maks 20 alamat — aman | `addresses.controller.ts:18` | ℹ️ |

## C. Frontend — buku alamat & picker

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| C01 | `AddressPicker.load` closure basi (`selected` selalu null) → setiap buka sheet pilihan user DITIMPA alamat utama | `components/ui/address-picker.tsx:45-61,133` | ✅ |
| C02 | Alamat terpilih tidak direkonsiliasi setelah diubah/dihapus di buku alamat → data basi / 400 "alamat tidak ditemukan" | `address-picker.tsx:45-61` | ✅ |
| C03 | Form inline tanpa validasi kode pos 5 digit & nomor HP → bolak-balik 400 | `address-picker.tsx:93-111` | ✅ |
| C04 | Toast "Gagal memuat alamat" generik walau offline (melanggar aturan error spesifik) | `address-picker.tsx:56` | ✅ `userMessage` |
| C05 | Saat memuat, sheet kosong tanpa indikator | `address-picker.tsx:213` | ✅ |
| C06 | Buku alamat: validasi lokal tidak mencakup `customLabel` (LAINNYA), kode pos 5 digit, panjang HP | `app/addresses.tsx:145-152` | ✅ |
| C07 | `maxLength` kode pos 10 vs backend 5; `customLabel` 30 vs 40 | `app/addresses.tsx:415,453` | ✅ |
| C08 | Jadikan utama & hapus tidak optimistis (aturan CLAUDE.md §3) | `app/addresses.tsx:181-232` | ✅ optimistis + rollback |
| C09 | Setelah simpan, daftar menunggu refetch penuh | `app/addresses.tsx:171-173` | ✅ `setData` |
| C10 | Copy "akan dihapus permanen" padahal soft-delete | `app/addresses.tsx:360` | ✅ |
| C11 | Batas 20 alamat tidak dikomunikasikan — tombol + menghasilkan 400 | `app/addresses.tsx:285-289` | ✅ |
| C12 | Daftar tidak refresh saat kembali fokus (alamat ditambah dari checkout tidak muncul) | `app/addresses.tsx:98-102` | ✅ `refreshOnFocus` |
| C13 | `addressLabelText` & `LABEL_OPTIONS` hardcode "Rumah/Kantor/Lainnya" tanpa translate | `lib/api/commerce.ts:190-193`, `app/addresses.tsx:48-52` | ✅ |
| C14 | `addressMissingFields` mengembalikan nama field Indonesia yang disisipkan ke `translate("{x}")` tanpa diterjemahkan | `lib/wallet-batch139.ts:170-179` | ✅ |
| C15 | Ubah alamat: `province` kosong dikirim `undefined` → PATCH backend "biarkan" → provinsi lama tidak pernah bisa dikosongkan | `app/addresses.tsx:82-93` | ✅ `""` saat update |
| C16 | Validasi HP klien menolak 20 digit tanpa `+` yang diterima backend (`^[0-9+][0-9 ]{7,19}$`); pesan "8–15 digit" tidak sesuai aturan | `lib/address-validation.ts:51` | ✅ regex disamakan |

## D. Frontend — checkout & detail order

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| D01 | Mode langsung sebagai SELLER: penjual diminta memilih alamatnya sendiri sebagai "alamat pengiriman" | `app/create-transaction.tsx:875-876` | ✅ hanya BUYER |
| D02 | Snapshot `shippingAddress` dibuang normalizer → penjual tak tahu kirim ke mana (K9 di branch transaksi) | `lib/api/orders-shared.ts:547` | ✅ cherry-pick 867db06 |
| D03 | Pembeli order buatan penjual: tidak ada UI pilih alamat saat Terima pesanan; `canConfirm` hanya seller | `components/screens/order-detail-screen.tsx:1118`, `:1654` | ✅ |
| D04 | Kartu alamat tidak tampil bila snapshot kosong — tidak ada petunjuk "alamat belum ada" | `order-detail-screen.tsx:1437-1450` | ✅ |
| D05 | `ShippingInfoCard` label default tidak lewat `translate` | `components/ui/shipping-info-card.tsx:58-69` | ✅ |
| D07 | `ShippingAddressCard` label default ("Alamat pengiriman/Penerima/Telepon") tidak lewat `translate` | `components/ui/shipping-address-card.tsx:64` | ✅ |
| D09 | `shippingAddressId` dikirim walau peran diganti ke SELLER setelah memilih alamat sebagai BUYER → alamat penjual terkirim sebagai tujuan | `app/create-transaction.tsx:1248` | ✅ gerbang `shippingAddressRequired` |
| D10 | `ShippingAddressSummaryCard` (ringkasan checkout): judul/alert/tombol hardcode tanpa `translate`; nomor HP penerima tidak ditampilkan sebelum bayar | `components/create-transaction-review.tsx:345-355` | ✅ |

## E. Frontend — tracking & kurir

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| E01 | Ongkir dibagi 100 (`/100`) padahal backend kirim RUPIAH → ongkir tampil 100× lebih kecil | `app/tracking/[shipmentId].tsx:160,168` | ✅ |
| E02 | `refreshTracking` diketik `Shipment` padahal respons `{status, events, timeout}`; `timeout:true` tidak pernah disampaikan ke user | `lib/api/courier.ts:110-112`, `app/tracking/[shipmentId].tsx:69-88` | ✅ |
| E03 | Tombol "Muat Ulang Tracking" tampil untuk resi manual → selalu 400 | `app/tracking/[shipmentId].tsx:175` | ✅ disembunyikan |
| E04 | Timeline urut lama→baru & mengikuti `createdAt` (bukan `occurredAt`) | `app/tracking/[shipmentId].tsx:196` | ✅ terbaru di atas |
| E05 | `serviceName`, ETA (`etaMinDays/etaMaxDays`), `slaBreached` tidak ditampilkan | `app/tracking/[shipmentId].tsx:144-153` | ✅ |
| E06 | Nomor resi tidak bisa disalin | `app/tracking/[shipmentId].tsx:137-139` | ✅ `CopyableField` |
| E07 | Badge status tanpa tone semantik | `app/tracking/[shipmentId].tsx:142` | ✅ |
| E08 | Status order gagal dimuat karena `shipment.orderId` internal (lihat A05) | `app/tracking/[shipmentId].tsx:60-63` | ✅ (BE) |
| E09 | `CourierQuote.providerName` tidak ada di backend; tidak ada fungsi `getQuotes` → cek ongkir tak bisa dipanggil | `lib/api/courier.ts:35-47` | ✅ tipe selaras + `getQuotes` |
| E10 | `formatIdrSen` di-reexport dari domain kurir yang nilainya rupiah — jebakan | `lib/api/courier.ts:115` | ✅ dihapus |
| E11 | `SHIPMENT_STATUS_LABEL` tidak diterjemahkan di titik pakai | `lib/api/courier.ts:24-33` | ✅ helper `shipmentStatusText` |
| E12 | Empty state resi manual buntu — tidak menyebut resi bisa disalin dari detail order | `app/prepare-navigation.tsx:94` | ✅ copy |
| E13 | `useOrderTracking` menerima `_toastShow` yang tidak dipakai | `lib/use-order-tracking.ts:7` | ✅ dibersihkan |
| E14 | `prepare-navigation`: judul, pesan memuat, judul/deskripsi empty-state, tombol "Kembali" semuanya hardcode (tracking & DM) | `app/prepare-navigation.tsx:55-118` | ✅ `translate` |

## F. Admin — kurir

| # | Temuan | Lokasi | Status |
|---|---|---|---|
| F01 | Estimasi/aktual ongkir diformat `formatIdrSen` (÷100) padahal rupiah | `src/app/(panel)/courier/page.tsx:112` | ✅ |
| F02 | Rekonsiliasi: sama (÷100) | `courier/page.tsx:238-245` | ✅ |
| F03 | Logika refund terbalik: refund saat `diff = aktual − estimasi > 0` (buyer justru kurang bayar); alasan default "aktual < estimasi" | `courier/page.tsx:212-224` | ✅ kelebihan = estimasi − aktual |
| F04 | Tidak ada filter "tracking basi" padahal API mendukung `staleHours` | `courier/page.tsx:80-95` | ✅ |
| F05 | Kolom Order menampilkan cuid internal terpotong (ikut A05) | `courier/page.tsx:106` | ✅ (BE) |
| F06 | Kontrak `AdminShipmentItem` tanpa `slaBreached` | `src/lib/api/admin/courier.ts:9-23` | ✅ |

## Ditunda / di luar lingkup

- Booking label kurir dari aplikasi (seller membuat shipment + pilih layanan) — belum ada UI; endpoint BE ada. Butuh keputusan produk soal siapa menanggung ongkir (`costBearer`) di ringkasan biaya.
- Cek ongkir di checkout memerlukan kode pos asal penjual yang belum tersedia secara publik (buku alamat privat per user).
