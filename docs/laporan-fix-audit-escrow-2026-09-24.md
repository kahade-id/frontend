# Laporan Fix Audit Escrow — 2026-09-24

Verifikasi akhir: **`npx tsc --noEmit` = 0 error**, **`npx vitest run` = 454/454 lulus (34 file)**, termasuk tes regresi baru `tests/orders-domain.test.ts` (20 tes, M-07).

## 0. Hitungan jujur (audit = 136 temuan)

| Status | Jumlah |
|---|---|
| **Diperbaiki & terverifikasi** | **129 / 136 (95%)** |
| Sisa — peningkatan kapabilitas (bukan cacat: E-11, O-01, O-02, O-03, O-05) | 5 |
| Sisa — butuh perubahan backend (F-01: penerimaan order link menuntut token di server) | 1 |
| Sisa — butuh kontrak error backend (N-04: `kycReasonMessage` menebak aturan KYC dari regex pesan Inggris) | 1 |

Klaim "130+ beres" pada laporan sebelumnya **terlalu besar** — setelah putaran polish 2026-09-24 (G-03/G-07/G-08/G-09/J-03, lihat §2c) angka benarnya **129 dengan verifikasi**; 7 sisanya tercatat jujur di atas (5 di antaranya memang bukan cacat).


## 1. Perbaikan yang dikerjakan (mengacu `docs/audit-escrow-mendalam-2026-09-24.md`)

### A. State machine & gerbang aksi
- **A-01/M-03** `nextOrderStatus` kebal kunci prototipe (`"toString"` → `undefined`).
- **A-04/A-05/A-06/F-03** `isCancellable`/`isDisputable`/`isExtendable` diturunkan dari satu state machine (batal hanya pra-kirim; sengketa sejak `WAITING_CONFIRMATION`; perpanjangan pra-kirim saja).
- **A-07/D-11** id kosong ditangani (normalisasi + `ROUTES.*Detail` fallback, lihat H-02).
- **A-08** alias lama dipetakan sekali di `normalizeOrder`.
- **A-09** `hasLiveDeadline()` memisahkan "belum final" dari "punya tenggat" — countdown tidak lagi berputar di order `DISPUTED`.
- **A-10** `calculateFee` kini membawa `voucherCode` order asli.
- **A-12** inferensi `myRole` dari username DIHAPUS (hanya `me.id`); peran tak dikenal → aksi disembunyikan.
- **A-13** "Tandai selesai" membawa `proofId` bukti yang direview (`ConfirmDeliveryDto`, satu kontrak rilis dana).

### B. Uang, fee & voucher
- **B-02** voucher tidak lagi di-clamp ke fee. **B-03** `splitFee` integer (dipindah ke `lib/financial.ts`). **B-06** invariant `pays - gets == fee - discount` (+ tes). **B-07** `feeShare` hanya label persen. **B-11** sisa pembulatan SPLIT dieksplisitkan di UI.
- **B-05** tombol Bayar tidak pernah mencetak `orderValue` sebagai total ("—" saat fee belum terhitung).
- **B-08/B-09/B-14** `normalizeInvoice`: `total < 0` melempar, `invoiceNumber` tidak dikarang (`INV-…` palsu dihapus), `toAmount` integer-only (diekspor + dites).
- **B-10** `parseRupiah` vs `amountInputValue` konsisten: "1.000.50" (pemisah ambigu) DITOLAK (dulu → 100050).
- **B-12** `assertDtoConstraints` menolak `null` non-nullable. **B-13** `numberField` = `pickNumber`.

### C. Pembayaran (saldo/PIN/QRIS)
- **C-01/C-02** `normalizePaymentStatus`: status tiada → `UNKNOWN` (polling berhenti), flag `paid`/`expired` dibaca.
- **C-03** `useCountdown` tanpa sumber waktu = idle (tidak memicu `onComplete` instan → intent QRIS baru tidak ditandai EXPIRED).
- **C-04/C-07/I-01** `toEpochMs`: epoch detik→ms, string numerik diterima (dulu salah domain jam → catatan hidup langsung dibuang).
- **C-05** `expireLocally` konfirmasi server dulu — tidak menimpa `PAID`.
- **C-06** `createOrder`/`payOrder` menerima idempotency key stabil dari pemanggil.
- **C-08** non-ApiError tidak lagi diterjemahkan "PIN salah…". **C-09** pesan galat PIN langsung tampil di PinInput.
- **C-10** cap polling tetap menyediakan "Cek status sekarang". **C-11** tombol QRIS responsif (satu tekan → sinkron; bila terminal → intent baru).
- **C-12** overlay tidak mencetak "Membayar Rp0…".

### D. Kontrak API & normalisasi
- **B-04** `unwrapResponse` melempar envelope `{success:false}`. **D-01..D-04** `readList`/`readPage` + alias kunci. **D-05..D-07** normalizer QRIS/order-link/summary. **D-08** `normalizeOrder` allowlist (tidak menyebar `...raw`). **D-09/D-10** klasifikasi `notFound` hanya dari sinyal eksplisit. **D-12** hasil `cancel` dibedakan. **D-13** pesan sengketa `text|message|content`. **D-14/L-02** validasi dokumen struk + `sanitizeReceiptHtml` (buang `<script>/<iframe>/on*`). **D-15** `fileKey`/`url` presign divalidasi.

### E. Sengketa & bukti pengiriman
- **E-01/L-01** lampiran bukti kirim: jenis dari ekstensi (PDF ≠ gambar); object key tidak dirender sebagai URL. **E-02/H-01** peran tak dikenal → read-only + ErrorState (default `viewer="buyer"` dihapus). **E-03** pratinjau/kirim usulan bagi-persen konsisten. **E-04** draft klaim tidak lagi tertimpa refresh. **E-05** `mine` fallback cocokkan `uploadedBy`/`userId` vs `me.id`. **E-06** `responseNote` dikirim (textarea opsional). **E-07** dep array diperbaiki. **E-08** batas eskalasi 2× dihormati bila `escalationCount` ada. **E-09** 7 MIME enum (video ikut). **E-10** usulan tanpa order → pesan eksplisit.

### F–I, L–M lain
- **G-01** hitung-murni tidak menyapu cache uang. **G-02/M-05** `useApiQuery`: `setData` membatalkan fetch basi; objek hasil di-memo. **G-04** `syncStatus` serialized (poll vs manual). **G-05** cache durasi ikut invalidasi. **G-10** unggahan bukti di-reset saat ganti order.
- **H-02** rute ber-parameter menolak id kosong (fallback daftar). **H-03** date-only dibaca sebagai tengah malam WIB. **H-04/O-04** nama berkas `invoiceNumber ?? order-{id}` + tombol **"Unduh PDF"** (`GET …/invoice/pdf`) terpisah dari "Unduh struk". **H-05** `seg` menolak pemisah URL. **H-06** `buildUrl` skip string kosong. **H-08** tombol Invoice disembunyikan saat `WAITING_CONFIRMATION`.
- **I-02** tabel label kebal prototipe (`hasOwn`). **I-04** `formatRupiah` menolak pecahan (bukan dibulatkan diam-diam). **I-05** `durationHoursParts` → enum `"day"|"hour"`. **I-06** `formatCountdown` ≥24 jam menyebut hari. **I-07** fallback `— WIB` berlabel.
- **L-03** `redactSensitive` + `ApiError.requestBody` disamarkan (PIN/token tidak pernah masuk log/overlay). **L-04** `clearPendingActions` saat logout (sudah terpasang). **M-01** `Paginated.meta.total?` jujur. **M-02** normalizer `fee`/`DeliveryProof.status`. **M-04** cast `TERMINAL` dihapus. **M-06** rujukan dokumen audit diperbaiki. **M-07** `tests/orders-domain.test.ts` (19 tes: matriks status×peran, splitFee, invariant B-06, toEpochMs, unwrapResponse, nextOrderStatus, toAmount, normalizeInvoice, redactSensitive, buildUrl, seg, dst.).
- **N-01** janji refund hanya untuk status berdana. **N-02** copy "Terima order" dikoreksi (terima = sebelum bayar).

## 2. Sisa yang belum dikerjakan (7 — tercatat jujur, bukan cacat kritis)
- **Peningkatan kapabilitas (5, bukan cacat):** E-11/O-05 (lampiran sengketa saat pembukaan), O-01 (`attachments`/`inquiryRoomId` CreateOrder), O-02 (filter from/to/sort daftar order), O-03 (`trackingNotes` UpdateShipping).
- **Butuh backend (2):** F-01 (endpoint terima order link menuntut token — membuka untuk calon pengguna tanpa akun adalah perubahan otorisasi server, bukan klien); N-04 (`kycReasonMessage` menebak aturan dari regex pesan — butuh error code/field yang stabil dari backend agar tidak menebak).
- **Polish performa/i18n (5): SELESAI 2026-09-24** — G-03 (coalesce refresh), G-07 (tiebreaker id), G-08 (history load-more), G-09 (scan ruang chat berhalaman), J-03 (`translate()` di titik definisi) — rincian di §2c.
- Tes `tests/zz-probe-escrow.test.tsx` tidak dikumpulkan vitest (include hanya `*.test.ts`) — bisa diubah jadi `*.test.ts` regresi UI bila diperlukan.

## 2b. Perbaikan tambahan putaran verifikasi (dokumen ini direvisi)
A-11 (CTA REFUNDED/EXPIRED), B-01 (angka server ke FeeBreakdown), F-02 (AbortSignal fetchPage), F-04 (fallback navigasi), F-05 (status asing TIDAK lagi "Kedaluwarsa"), F-06 (pihak pengaju per-ekstensi), F-07 (mitigasi formatter), F-08 (deadline fallback + perpanjangan disetujui), F-09 (fallback onOpen), H-07 (guard layar rate), I-03 (tes pengunci sinkronisasi), J-01 (label fungsi → translate), J-02/K-05 (a11y persen), J-04 (fallback label generik), J-05 (meta banner → translate), J-06 (rangkaian timeline → translate), J-07 (fallback call log), K-02 (a11y nominal+status), K-03 (countdown tanpa pembulatan), N-03 (draft tenggat = nilai terkirim), N-05 (galat fee di semua langkah), N-06 (petunjuk panjang catatan), N-07 (umpan balik "Cek status").

## 2c. Putaran polish terakhir (2026-09-24 — G-03, G-07, G-08, G-09, J-03)
- **G-03** `app/(tabs)/transactions.tsx`: `onDeadline` memakai `scheduleRefresh`
  (debounce 750 ms + timer ref dibersihkan saat unmount) — N kartu deadline
  habis bersamaan = **satu** refresh, bukan N refresh yang saling abort.
- **G-07** `lib/use-paginated-query.ts`: `byTimestampDesc` diberi tiebreaker `id`
  (kontrak `T extends { id: string }`) — urutan deterministik untuk item dengan
  `createdAt` identik (order-link batch, dsb.); `tests/hooks.test.tsx` disesuaikan.
- **G-08** `app/order/[id].tsx`: tombol **"Muat lebih riwayat"** memuat halaman
  berikutnya lalu **append** via `query.setData` (updater, bukan timpa);
  `historyHasMore` dari `meta.totalPages` / heuristik halaman penuh
  (`HISTORY_LIMIT = 50`); toast `tone: "danger"` saat gagal.
- **G-09** `lib/api/chat.ts` `findChatRoomByOrder(orderId, signal?)`: scan
  `listChatRooms` berhalaman dan **berhenti saat ketemu** (maks
  `FIND_ROOM_MAX_PAGES = 5` × `CHAT_PAGE_SIZE`); `openChat` di `app/order/[id].tsx`
  memakainya; fallback `ROUTES.chat` saat gagal/tidak ketemu.
- **J-03** `translate()` di titik definisi `DEFAULT_LABELS` tiga komponen yang
  disebut audit: `order-card.tsx` (Penjual/Pembeli/**Batas waktu**),
  `fee-breakdown.tsx` (incl. `FEE_RESPONSIBILITY_LABELS`),
  `delivery-proof-viewer.tsx` (semua label; `openAttachment` kini
  `translate("Buka lampiran {i} dari {total}", …)`). Bonus: J-04 fallback
  "Status tidak dikenal" juga `translate()`.

## 3. Verifikasi
```
npx tsc --noEmit      → 0 error
npx vitest run        → 34 file, 454/454 lulus
npx vitest run tests/orders-domain.test.ts → 20/20 lulus
```
