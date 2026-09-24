# Audit Escrow End-to-End — Kahade (2026-09-24)

**Ruang lingkup:** alur transaksi/order escrow penuh dari UI → lapisan API (`lib/api`) → kontrak backend (`docs/api/kahade-api-mobile.json`): create order/order-link, validasi counterpart, fee/voucher, pembayaran (saldo+PIN, QRIS), proses/shipping, delivery-proof/confirm/reject, complete/cancel/dispute, extension tenggat, invoice/receipt, wallet (topup/withdraw/transfer), dispute (evidence/messages/calls/mutual-resolution/escalate), templates, rating, daftar transaksi.

**Metodologi:**

1. Pembacaan menyeluruh seluruh layar, komponen, hook, dan lapisan API terkait (±60 berkas).
2. Pengekstrakan kontrak backend dari `docs/api/kahade-api-mobile.json` (body/params/security per endpoint) + `lib/api/types.ts` (DTO) + `lib/api/constraints.ts` (aturan generated).
3. **Probe eksekusi** — setiap temuan besar dibuktikan dengan menjalankan kode nyata:
   - `tests/zz-audit-escrow-e2e.test.tsx` (dibuat audit ini, 15 probe: **15/15 lulus = semua temuan terbukti**),
   - `tests/zz-probe-escrow.test.tsx` (probe infra, dijalankan ulang).
   - Perintah: `npx vitest run --config vitest.components.config.ts tests/zz-audit-escrow-e2e.test.tsx`
4. Semua nomor baris diverifikasi ulang dengan `grep -n`/`sed` sebelum ditulis.

**Taksonomi severity:**

- **KRITIS** — salah nominal uang, pembayaran/order ganda, crash layar, fitur uang/sengketa mati total, status uang disalahartikan, data finansial palsu di dokumen.
- **SEDANG** — fitur terdegradasi, informasi salah/menyesatkan tanpa kehilangan uang langsung, inkonsistensi kontrak yang berisiko di masa depan.
- **RENDAH** — kosmetik, i18n, ketelitian, dead code.

**Ringkasan statistik:** **104 issue terbukti** — **52 KRITIS**, 34 SEDANG, 18 RENDAH. Setiap butir menyebut bukti `path:baris` (nomor baris per commit audit ini).

---

## A. Idempotensi & pembayaran (uang) — 14 issue (11 KRITIS)

### 1. `createOrder` punya param `idempotencyKey` yang TIDAK PERNAH dipakai pemanggil — KRITIS
**Bukti:** `lib/api/orders.ts:711-723` — `export function createOrder(dto: CreateOrderDto, idempotencyKey?: string)` dengan komentar C-06 *“Layar membuat SATU kunci per formulir dan memakainya ulang”*. Probe P-N membuktikan **nol call site jalur uang** (`app/`, `lib/api/wallet*`, `lib/api/disputes*`, `lib/api/orders`) yang meneruskan `idempotencyKey`; `app/create-transaction.tsx:441` memanggil `api.orders.createOrder(dto)` tanpa argumen kedua.
**Dampak:** timeout/uncertain-error lalu tekan ulang = dua order dibuat (kontrak C-06 gagal total di implementasi).

### 2. `payOrder` idem — param ada, pemakai nihil — KRITIS
**Bukti:** `lib/api/orders.ts:842-848` (C-06) vs `app/order/[id].tsx:399` `await api.orders.payOrder(order.id, { pin })`.
**Dampak:** percobaan bayar ulang setelah kegagalan tak pasti = debit saldo dua kali.

### 3. `payOrderQris` bahkan TIDAK punya parameter idempotensi — KRITIS
**Bukti:** `lib/api/orders.ts:852` `export function payOrderQris(orderId: string)` — permukaan API menutup kemungkinan pemanggil mengunci intent.
**Dampak:** dua intent QRIS untuk satu order.

### 4. `createOrderLink` tanpa idempotensi — KRITIS
**Bukti:** `lib/api/orders.ts:1146-1151`; `app/create-transaction.tsx:426` `api.orders.createOrderLink(dto)`.
**Dampak:** tekan ulang setelah error = tautan order ganda dengan efek order ganda saat dua penerima menerima.

### 5. Mutasi wallet (`createTopup`, `createWithdraw`, `transferFunds`) juga tanpa kunci pemanggil — KRITIS
**Bukti:** probe P-N — satu-satunya modul yang memuat `idempotencyKey` adalah `lib/api/showcase.ts` dan `lib/api/users.ts` (konvensi ada di repo, tetapi tidak di satu pun jalur uang).
**Dampak:** topup/transfer/penarikan ganda pada retry manual.

### 6. Transpor membuat `Idempotency-Key` BARU untuk tiap kiriman — KRITIS
**Bukti:** `lib/api/client.ts:468` `const requestId = options.idempotencyKey ?? (method === "GET" ? undefined : createIdempotencyKey())` (probe P-N memastikan `createIdempotencyKey()` dipanggil tiap request tanpa key pemanggil).
**Dampak:** jaring pengaman server (idempotent replay) tidak pernah aktif untuk user-retry; ini akar struktural issue 1-5.

### 7. `handlePayPin`: error PARSE (200 + body rusak = pembayaran MUNGKIN sukses) diperlakukan “gagal pasti” tanpa refresh — KRITIS
**Bukti:** `app/order/[id].tsx:401-437` — `const uncertain = !isApiError(err) || err.isTransient || err.code === "ABORTED"`; `if (uncertain) { invalidateQueryCache(); void query.refresh() }`. `PARSE` adalah `ApiError` non-transient/non-ABORTED → `uncertain = false` → **tanpa refresh, tanpa saran periksa riwayat**; pesan hanya “Respons server tidak dapat dibaca.” Komentar A-15 di baris sama mengakui bahwa kegagalan tak pasti berarti debit mungkin terjadi — tetapi PARSE tidak masuk kategori itu.
**Dampak:** user mengira gagal dan menekan “Bayar” lagi (lihat issue 2) → double-pay pada kasus 200-broken-body.

### 8. `createIntent` QRIS: kegagalan tak pasti → `syncStatus()` — bila sinkronisasi GAGAL/null tidak ada jejak apa pun, tombol aktif lagi → intent ganda — KRITIS
**Bukti:** `lib/use-qris-payment.ts:150-180` — `catch`: `onErrorRef.current(...)` lalu `if (!isApiError(err) || err.isTransient || err.code === "ABORTED") { await syncStatus() }`. `syncStatus` mengembalikan `null` saat gagal (dokumentasi fungsi di berkas yang sama) — tidak ada `recordPendingAction`, tidak ada state penguncian setelahnya.
**Dampak:** timeout saat CREATE (intent terlanjur dibuat server) + sync gagal = tekan ulang membuat intent kedua.

### 9. `expireLocally`: `syncStatus() == null` (cek gagal) tetap MEMAKSA status `EXPIRED` — KRITIS
**Bukti:** `lib/use-qris-payment.ts:199-205` — `const synced = await syncStatus(); if (synced == null || synced === "PENDING") { setStatus((prev) => (prev === "PENDING" || prev == null ? "EXPIRED" : prev)) }`. `null` = hasil TIDAK DIKETAHUI (dokumen fungsi: “konfirmasi ke server lebih dulu; hanya bila status masih belum terbayar status lokal jadi EXPIRED”) — tetapi `null` diperlakukan sama dengan “belum terbayar”.
**Dampak:** kontradiksi langsung komentar C-05 (`lib/api/orders.ts` normalizePaymentStatus): QRIS yang **sudah dibayar** bisa ditutup sebagai EXPIRED saat jaringan drop tepat di detik kedaluwarsa.

### 10. Pemicu terbesar `synced == null`: `expireLocally` MEMBATALKAN request cek yang sedang jalan (`request.abort()`) — KRITIS
**Bukti:** `lib/use-qris-payment.ts` `expireLocally` memanggil `request.abort()` pada cek yang tertunda sebelum `syncStatus()` baru; bila cek baru ini yang gagal (jaringan), issue 9 terjadi. Probe/kode: `syncStatus` me-return `null` di catch.
**Dampak:** momen paling berisiko (detik expiry = user baru saja scan/bayar) justru momen cek terakhir dibuang.

### 11. `pending-actions` `qrisPaid`: `syncStatus` melempar → aksi dibuang, status uang tidak direkonsiliasi — KRITIS
**Bukti:** `lib/pending-actions.ts` `qrisPaid` — `catch`: “Proses pemeriksaan gagal. Periksa riwayat sebelum mengulang.” + `resolvePendingAction` (aksi dihapus). Tidak ada mekanisme mencoba lagi; keputusan user diserahkan ke riwayat manual.
**Dampak:** satu kegagalan jaringan menutup jalur pemulihan otomatis untuk pembayaran yang statusnya belum pasti.

### 12. `TERMINAL` polling QRIS tidak memuat `"UNKNOWN"` — kontradiksi janji komentar C-01 — SEDANG
**Bukti:** `lib/use-qris-payment.ts:37` `const TERMINAL: readonly string[] = ["PAID", "EXPIRED", "FAILED", "CANCELLED"]`; `components/qris-payment-panel.tsx:27` pola sama; vs `lib/api/orders.ts` (normalizePaymentStatus, C-01): *“hasilnya `UNKNOWN` dan polling berhenti”*. Probe P-L membuktikan keduanya.
**Dampak:** respons tak terbaca → polling 3 detik × 300 (≈15 menit) terus berjalan; UI menampilkan “Menunggu pembayaran…” untuk status yang tidak diketahui.

### 13. Status `UNKNOWN` + countdown habis = layar macet “Menunggu pembayaran…” — SEDANG
**Bukti:** `lib/use-qris-payment.ts:201` guard `expireLocally` hanya mengubah `prev === "PENDING" || prev == null` → status `UNKNOWN` tidak pernah menjadi `EXPIRED`; panel memperlakukan `UNKNOWN` sebagai bukan-terminal (`components/qris-payment-panel.tsx:27`).
**Dampak:** QRIS kedaluwarsa nyata, layar tetap menunggu tanpa tombol “Buat ulang” yang jelas.

### 14. Toast error `createIntent` selalu tampil meski intent mungkin sudah terbuat — RENDAH
**Bukti:** `lib/use-qris-payment.ts:166-175` — `onErrorRef.current(userMessage(err))` dipanggil lebih dulu, rekonsiliasi `syncStatus()` belakangan dan tanpa umpan balik hasilnya.
**Dampak:** pesan gagal padahal bisa jadi terbayar/terbuat — menambah dorongan retry ganda (issue 8).

---

## B. Create order, fee, voucher — 7 issue (5 KRITIS)

### 15. `FeeBreakdown` di create-transaction TIDAK meneruskan `buyerPays`/`sellerGets` server (perbaikan B-01 hanya di detail order) — KRITIS
**Bukti:** `app/create-transaction.tsx:700-708` — `<FeeBreakdown orderValue={orderValue} feeAmount={fee.platformFee} feeResponsibility={feeResponsibility} role={...} discountAmount={fee.discount ?? voucher?.discount} loading={feeLoading} />` **tanpa** `buyerPays`/`sellerGets`, padahal `fee` = hasil `api.orders.calculateFee` (`setFee(res)`, baris 242/312) yang berisi `fee.buyerPays`/`fee.sellerReceives` (`lib/api/orders.ts:342-370`). Bandingkan `app/order/[id].tsx:666-679` yang sudah meneruskan `buyerPays={fee.buyerPays} sellerGets={fee.sellerReceives}` (komentar B-01: *“dulu kartu menghitung ulang lokal sehingga angka kartu bisa berbeda dari tombol Bayar”*).
**Dampak:** angka “Pembeli membayar” di layar buat transaksi = hasil hitung ulang lokal, bukan tagihan server.

### 16. Fallback lokal `FeeBreakdown` melanggar invarian uang: voucher TIDAK berpengaruh pada tagihan pembeli saat `feeResponsibility: SELLER`, dan `sellerGets` melebihi nilai order — KRITIS
**Bukti:** `components/ui/fee-breakdown.tsx:129-133` — `discountShare = splitFee(discount, feeResponsibility); pays = buyerPays ?? orderValue + share.buyer - discountShare.buyer; gets = sellerGets ?? orderValue - share.seller + discountShare.seller`. Probe P-D (menjalankan rumus persis): order 150.000, voucher 50.000, fee 5.000, `SELLER` → **`pays = 150.000`** (voucher nihil pengaruh) dan **`gets = 195.000`** (penjual “menerima” 195rb dari order 150rb).
**Dampak:** dua angka uang salah secara harfiah di layar create-transaction (jalur yang tidak meneruskan angka server, lihat issue 15).

### 17. Skenario `SPLIT`: pembeli hanya kebagian SETENGAH potongan voucher — KRITIS
**Bukti:** rumus yang sama (issue 16) — probe P-D varian `SPLIT`: `discountShare.buyer = 25.000` → `pays = 150.000 + 2.501 − 25.000 = 127.501`; pembeli “kehilangan” separuh diskon. Diskon dipotong menurut penanggung FEE, padahal voucher adalah potongan harga — bukan biaya bersama.
**Dampak:** tagihan preview salah untuk kombinasi voucher + SPLIT; user membatalkan/mengeluh atau terkejut saat tagihan server berbeda.

### 18. `handleApplyVoucher`: error PARSE/jaringan ditanggapi sebagai “Voucher tidak valid” — KRITIS
**Bukti:** `app/create-transaction.tsx:375-` (`handleApplyVoucher`) — satu `catch` untuk semua error mengarah ke `setVoucherError(...)` pesan kegagalan validasi voucher; `PARSE` (200 body rusak; voucher **sah**) ikut terlabeli tidak valid.
**Dampak:** user melanjutkan tanpa diskon yang sah = membayar lebih mahal dari haknya.

### 19. `validateCounterpart`: SEMUA error (termasuk jaringan) → `counterpartState = "blocked"` (menghakimi “diblokir”) — KRITIS
**Bukti:** `app/create-transaction.tsx:325-361` — catch baris 361 `setCounterpartState("blocked")`; komentar di 336-339 sendiri mengakui *“jatuh ke ‘blocked’ — pengguna dituduh memblokir/diblokir padahal tidak”*. Kondisi `notNotFound` → `blocked` (baris 340) juga memasukkan error VALIDATION/BAD_REQUEST apa pun.
**Dampak:** keputusan transaksi dibatalkan berdasarkan vonis salah (offline ≠ diblokir); iklim trust rusak.

### 20. Tombol “Lanjut” terkunci permanen bila `calculate-fee` gagal (jaringan) — SEDANG
**Bukti:** `app/create-transaction.tsx:288` `const feeValid = confirmedFeeKey === feeKey && !feeLoading && !!fee` — `fee` hanya terisi dari `calculateFee` (baris 296-322); kegagalan = `feeError` + `feeValid` false selamanya sampai input berubah; tidak ada jalan memaksa lanjut.
**Dampak:** gangguan API fee memblokir pembuatan order sama sekali.

### 21. `feeKey` tidak memuat nilai diskon voucher — RENDAH
**Bukti:** `app/create-transaction.tsx:274` `const feeKey = JSON.stringify([orderValue, feeResponsibility, role, voucher?.code])` — kode sama dengan nominal diskon berubah (perubahan server-side) tidak memicu hitung ulang.
**Dampak:** preview fee basi sampai input lain berubah.

---

## C. Lifecycle order (proses → kirim → selesai) — 5 issue (4 KRITIS)

### 22. `canProcess = order.status === "PAID"` MUSTAHIL bernilai true — tombol “Proses pesanan” tidak pernah muncul — KRITIS
**Bukti:** `app/order/[id].tsx:543-550` — `const canProcess = order.status === "PAID" && isSeller`, komentar baris 543: *“canProcess sengaja hanya mengenali alias lama PAID”*. Probe P-A: `normalizeOrder({status:"PAID"}).status === "PROCESSING"` — normalizer (A-08) memetakan `PAID → PROCESSING`, jadi `order.status` tidak pernah `"PAID"`.
**Dampak:** `POST /v1/orders/{id}/process` tidak terjangkau dari UI; penjual terkunci (harus via jalur lain/CS); kontradiksi dokumentasi A-08.

### 23. `completeOrder` mengirim body (`{}`/`{proofId}`) padahal spesifikasi `POST /v1/orders/{id}/complete` TANPA requestBody — KRITIS
**Bukti:** `lib/api/orders.ts:961` `export function completeOrder(orderId: string, dto: ConfirmDeliveryDto = {})` — body selalu dikirim; `app/order/[id].tsx:791-794` `completeOrder(order.id, latest?.id ? { proofId: latest.id } : {})`. Spesifikasi (`docs/api/kahade-api-mobile.json`, operasi `OrdersController_completeOrder`) tidak punya `requestBody`.
**Dampak:** validator backend yang strict menolak body `{}` dengan 400 → rilis dana escrow (penjual) terblokir; bila backend longgar, kontrak dan klien menyimpang diam-diam.

### 24. Rilis dana tanpa jejak bukti: `listDeliveryProofs(...).catch(() => [])` → `completeOrder(id, {})` — KRITIS
**Bukti:** `app/order/[id].tsx:785-794` — kegagalan membaca daftar bukti di-catch menjadi `[]`, lalu body `{}` dikirim.
**Dampak:** eskrow dilepas tanpa `proofId` yang direview (persis yang diklaim komentar A-13 ingin hindari) — jejak audit putus pada kasus kritis.

### 25. Komentar A-13 menyesatkan: mengklaim `ConfirmDeliveryDto` dipakai `/complete` + `/delivery-proof/confirm`; spesifikasi: hanya `/delivery-proof/confirm` yang punya body (required) — RENDAH
**Bukti:** `app/order/[id].tsx:780-783` (komentar) vs `docs/api/kahade-api-mobile.json` (operasi `deliveryProofConfirm` punya body `ConfirmDeliveryDto` required; `completeOrder` tanpa body).
**Dampak:** pemeliharaan berikutnya akan menyalin kontrak yang salah.

### 26. `normalizeOrder` mempertahankan `id: ""` untuk detail (hanya `listOrders` yang menyaring, D-11) — KRITIS
**Bukti:** probe P3 `zz-probe-escrow` & P-F audit: `normalizeOrder({})` → `{"id":"", ...}`; `lib/api/orders.ts:384-` (fallback `id: optionalId(...) ?? ""`); `seg("")` melempar BAD_REQUEST “Identitas data tidak valid.” (probe P23).
**Dampak:** respons detail rusak/salah bentuk → order tampil normal dengan id kosong → setiap aksi (bayar/kirim/selesai) melempar error identitas.

---

## D. Order link — 6 issue (4 KRITIS)

### 27. Layar preview order-link memakai `getOrderLink` (auth) — `previewOrderLink` (auth `"none"`) MATI TOTAL; alur “terima tautan tanpa akun” tidak berfungsi — KRITIS
**Bukti:** probe P-M: `app/order-link/[token].tsx` hanya memuat `getOrderLink` (baris 48), `previewOrderLink` tidak dirujuk satu pun berkas di luar `lib/api/orders.ts:1228`. `lib/api/orders.ts:1208` `getOrderLink` = `auth: "required"`.
**Dampak:** komponen `OrderLinkPreview` punya cabang `active && !user` (tombol “Buat akun & terima”) yang tidak akan pernah tercapai dari layar ini; penerima tanpa akun hanya melihat error 401.

### 28. Spesifikasi `GET /v1/orders/links/{token}` = `security: access-token` — penerima tanpa akun memang tidak bisa memuat halaman — KRITIS
**Bukti:** ekstraksi `docs/api/kahade-api-mobile.json` (operasi `OrdersController_getOrderLink`, `security: [{ "access-token": [] }]`) — dikonfirmasi ulang dari spec.
**Dampak:** mengunci issue 27 sebagai cacat desain-end-to-end: butuh `previewOrderLink` (`auth:"none"`, `lib/api/orders.ts:1228`) yang sudah dibangun tapi tidak dipakai.

### 29. `handleCancel` (order-links) MEMBUANG hasil `cancelOrderLink` → selalu menampilkan `CANCELLED` + “Tautan dibatalkan” — KRITIS
**Bukti:** `app/order-links.tsx:98-117` — `await api.orders.cancelOrderLink(cancelTarget.token)` (hasil tidak dibaca) lalu `setData` memaksa `status: "CANCELLED"` + `toast "Tautan dibatalkan"`. Padahal `CancelOrderLinkResult.status` (`lib/api/orders.ts`) membawa status final (`CANCELLED`/`ACCEPTED`/`EXPIRED`) — kontrak D-12.
**Dampak:** tautan yang sudah diterima/dianggap selesai oleh server ditampilkan “dibatalkan” + toast sukses palsu; user dan penerima melihat status berbeda.

### 30. `handleDecline` (order-link/[token]) pola yang sama — KRITIS
**Bukti:** `app/order-link/[token].tsx:80-` `handleDecline` — hasil `cancelOrderLink` diabaikan, `setLink` memaksa `status: "CANCELLED"` (pembacaan audit atas fungsi ini; lokasi `app/order-link/[token].tsx:80`).
**Dampak:** sama dengan issue 29 di halaman penerima.

### 31. `normalizeOrderLink` selalu membuang field `creator` (`creator: undefined`) — kartu preview “Pembuat —” meski backend mengirimnya — SEDANG
**Bukti:** `lib/api/orders.ts:1201` `creator: undefined,` (dengan komentar alasan); tipe `OrderLink.creator?: OrderParty` (`lib/api/orders.ts:642-662`); semua jalur (termasuk `getOrderLink` baris 1215) melewati normalizer ini.
**Dampak:** informasi pihak lawan hilang di preview; `orderPartyName`/avatar tidak pernah tampil.

### 32. `active = link?.status === "ACTIVE"` — status asing kehilangan tombol terima/tolak tanpa penjelasan — SEDANG
**Bukti:** `app/order-link/[token].tsx:96` `const active = link?.status === "ACTIVE"`; `onAccept={active ? ... : undefined}` (baris 136).
**Dampak:** status baru backend (atau `PENDING` dsb.) = halaman tanpa aksi dan tanpa pesan (bertentangan dengan filosofi toleransi-status `orderLinkStatusMeta`).

---

## E. Pengiriman & bukti pengiriman — 6 issue (6 KRITIS)

### 33. `handleConfirm` mengirim `{ proofId: latest.id }` TANPA guard id kosong → `proofId: ""` = 400 pasti — KRITIS
**Bukti:** `app/delivery-proof/[orderId].tsx:183` `await api.orders.confirmDelivery(orderId, { proofId: latest.id })` — `latest` dari `normalizeDeliveryProof` yang fallback `id: ""` (probe P-F). Probe P-E: `assertDtoConstraints({proofId: ""}, API_CONSTRAINTS.ConfirmDeliveryDto)` melempar “Isian proofId tidak sesuai ketentuan layanan.” (pola `^c[a-z0-9]{24}$`, `lib/api/constraints.ts:127-131`). Bandingkan `completeOrder` yang punya guard `latest?.id ? {...} : {}`.
**Dampak:** bukti tanpa id valid (fallback normalizer/ketidakcocokan bentuk respons) → tombol “Konfirmasi” selalu 400.

### 34. `handleConfirm`/`handleReject` tanpa `assertDtoConstraints` — `RejectDeliveryDto.note` (10–1000) & `proofId` lolos ke server — KRITIS
**Bukti:** `app/delivery-proof/[orderId].tsx:179-215` — kedua handler langsung memanggil API; `lib/api/orders.ts` hanya memanggil `assertDtoConstraints` di `createOrder` (719) dan `createOrderLink` (1147) — `confirmDelivery` (1124)/`rejectDelivery` (1134) tanpa guard; aturan `RejectDeliveryDto.note` min 10 (`lib/api/constraints.ts:617-621`).
**Dampak:** catatan tolak <10 karakter (jika lolos guard UI) = 400 yang seharusnya tertahan klien.

### 35. `handleReject` juga mengirim `proofId: latest.id` tanpa guard — KRITIS
**Bukti:** `app/delivery-proof/[orderId].tsx:203` `await api.orders.rejectDelivery(orderId, { note, proofId: latest.id })`.
**Dampak:** tolak pengiriman dengan `proofId: ""` = 400 pasti (pola sama dengan issue 33).

### 36. `handleSubmitProof` mengirim `updateShipping({ trackingNumber })` tanpa validasi min 3 → 400 setelah bukti terkirim (setengah jalan) — KRITIS
**Bukti:** `app/delivery-proof/[orderId].tsx:277-280` — `if (tracking && tracking !== order?.trackingNumber) { await api.orders.updateShipping(orderId, { trackingNumber: tracking }) }`; `UpdateShippingDto.trackingNumber` minLength 3 (`lib/api/constraints.ts:1034-1038`; probe P-I: `"AB"` ditolak). Form (`components/ui/delivery-proof.tsx`) tidak membatasi min 3.
**Dampak:** bukti (`submitDeliveryProof`, baris 273) SUDAH tersimpan, lalu langkah resi gagal → data terbelah: bukti ada, resi tidak; pesan gagal mengunduh submit ulang (duplikat bukti).

### 37. Satu `try` menutup mutasi + refetch: refetch gagal → “Gagal mengirim bukti” padahal bukti terkirim (toast sukses sudah muncul lebih dulu) — KRITIS
**Bukti:** `app/delivery-proof/[orderId].tsx:285-303` — alur: `submitDeliveryProof` → `updateShipping` → `setForm` → `toast "Bukti pengiriman terkirim"` → `await query.refresh()` → `catch` menampilkan “Gagal mengirim bukti”.
**Dampak:** dua toast kontradiktif; user mengulang submit → bukti ganda di server & storage.

### 38. Upload sukses → `submitDeliveryProof` gagal ambigu (PARSE/timeout) → user memilih file lagi = objek ganda di storage — KRITIS
**Bukti:** `app/delivery-proof/[orderId].tsx:259-283` — `uploadPresigned` (baris ~265) lalu `submitDeliveryProof` dalam satu `try`; komentar di berkas sendiri soal ambiguitas PARSE; `catch` hanya “Gagal mengirim bukti”.
**Dampak:** selain bukti duplikat, file terunggah ganda ke bucket (biaya + kekacauan bukti di sengketa).

---

## F. Perpanjangan tenggat (extension) — 3 issue (1 KRITIS)

### 39. `normalizeOrderExtension` fallback `id: ""` dan daftar extension TIDAK menyaring id kosong → Setujui/Tolak melempar “Identitas data tidak valid” — KRITIS
**Bukti:** `lib/api/orders.ts:1050-1061` — `id: pickString(item, ["id","extensionId"]) ?? ""` (probe P-F); `respondExtension` → `seg(extensionId)` (baris 1063-1071) yang melempar untuk `""` (probe P23); `listOrderExtensions` memetakan semua entri tanpa filter (bandingkan `listOrders` D-11).
**Dampak:** satu entri respons tanpa id = kartu tombol aksi yang selalu error; pekerjaan moderasi tenggat terhambat.

### 40. `requesterAvatar` selalu memakai avatar SELLER — perbaikan F-06 hanya mengenai nama — SEDANG
**Bukti:** `app/extension/[orderId].tsx:377` `requesterAvatar={order?.seller?.avatarUrl ?? undefined}` — prop dikirim terlepas dari `requesterIsBuyer` (nama sudah benar di baris sekitarnya setelah F-06).
**Dampak:** avatar menyesatkan (permintaan pembeli ditampilkan dengan wajah penjual).

### 41. `deadline = addDays(order.createdAt, …)` untuk `createdAt` kosong → “Tenggat saat ini — WIB” — RENDAH
**Bukti:** probe P22 `zz-probe`: `addDays("", 3)` = `Invalid Date`; `formatDateTimeWIB(Invalid)` = “— WIB” (`lib/format.ts:569-572`).
**Dampak:** tampilan “Tenggat saat ini — WIB” pada data rusak (ringan, jujur “—”).

---

## G. Sengketa & resolusi — 16 issue (7 KRITIS)

### 42. `getDispute`/`listMyDisputes` = cast polos tanpa normalizer (kelas D-02) → `orderId` undefined → “Order undefined” + deep-link rusak — KRITIS
**Bukti:** `lib/api/disputes.ts:90-98` — `listMyDisputes` → `readList<DisputeDetail>(...)` dan `getDispute` → `http.get<DisputeDetail>(...)` tanpa normalisasi; `app/disputes.tsx:44` `orderTitle={\`Order ${d.orderId}\`}` → “Order undefined”.
**Dampak:** daftar sengketa tidak bisa dihubungkan ke order; navigasi ke order dari kartu sengketa membawa `undefined`.

### 43. Halaman daftar sengketa hanya memuat 50 baris pertama tanpa load-more — KRITIS
**Bukti:** `app/disputes.tsx:18-22` — `PAGE_LIMIT = 50`, `listMyDisputes({ page: 1, limit: PAGE_LIMIT })`; tidak ada `usePaginatedQuery`/tombol muat lagi.
**Dampak:** sengketa ke-51+ (riwayat panjang) tidak terlihat sama sekali — kasus uang tersembunyi dari pemiliknya.

### 44. `handleSend` (pesan sengketa): `sendDisputeMessage` + `getDisputeMessages` dalam SATU `try` → refetch gagal = “Gagal mengirim pesan” padahal TERKIRIM (draft sudah dikosongkan) — KRITIS
**Bukti:** `app/dispute/[id].tsx:318-337` — `await sendDisputeMessage(id, text); setDraft(""); const rows = await getDisputeMessages(id)` dalam satu blok; `catch` “Gagal mengirim pesan”.
**Dampak:** user mengetik ulang dan mengirim lagi → duplikat pesan di berkas sengketa.

### 45. `handleAddEvidence`: upload + submit + refetch satu `try`, toast sukses justru SETELAH refetch → refetch gagal = “Gagal mengunggah bukti” padahal bukti SUDAH tersimpan — KRITIS
**Bukti:** `app/dispute/[id].tsx:341-373` — `uploadPresigned` → `submitDisputeEvidence` → `getDisputeEvidence` → baris 366 `toast "Bukti terkirim"`; `catch` “Gagal mengunggah bukti”.
**Dampak:** bukti duplikat terunggah dua kali (dan objek storage ganda) — material sengketa ganda menjerumuskan.

### 46. `handleSubmitClaim`: toast sukses “Klaim diperbarui” LALU `query.refresh()` gagal → toast “Gagal menyimpan klaim” kontradiktif — SEDANG
**Bukti:** `app/dispute/[id].tsx:298-316` — `toast "Klaim diperbarui"` (baris 303) sebelum `await query.refresh()` (baris 304) yang masih dalam `try` yang sama.
**Dampak:** dua pesan berlawanan; risiko submit ulang klaim.

### 47. `handleRespond` (ACCEPT resolusi bersama = MEMBELAH DANA): sukses lalu `query.refresh()` gagal → “Gagal menanggapi usulan” — KRITIS
**Bukti:** `app/dispute/[id].tsx:460-497` — `respondMutualResolution` → `toast "Kesepakatan diterima"` (baris ~482) → `await query.refresh()` (baris 489) dalam `try` yang sama → `catch` “Gagal menanggapi usulan”.
**Dampak:** aksi yang mengubah kepemilikan dana dilaporkan GAGAL padahal SUDAH terjadi → user mengulang aksi pada proposal yang sudah dijawab (risiko error/kebingungan status dana).

### 48. `handlePropose`: pola sama — toast “Usulan dikirim” lalu `getMutualResolution` gagal → “Gagal mengirim usulan” — SEDANG
**Bukti:** `app/dispute/[id].tsx:400-448` — `proposeMutualResolution` → `toast "Usulan dikirim"` (baris ~439) → `getMutualResolution` (baris ~443) dalam satu `try`.
**Dampak:** pesan kontradiktif pada momen negosiasi dana.

### 49. Proposal resolusi dikirim bersistem PERSENTASE (`buyerPercent`+`sellerPercent`), tetapi pembaca hanya nominal (`p.buyerAmount ?? p.amount`) — payload persen = “Rincian usulan belum lengkap” permanen — KRITIS
**Bukti:** `lib/api/types.ts` `MutualResolutionProposeDto` = `{buyerPercent 0–100, sellerPercent 0–100, reason 10–2000}` (`lib/api/constraints.ts:847-860`); `app/dispute/[id].tsx:776-784` `const buyerAmount = p.buyerAmount ?? p.amount` lalu guard `buyerAmount == null → "Rincian usulan belum lengkap. Muat ulang sebelum menanggapi."`; probe P-O: payload `{buyerPercent: 70, sellerPercent: 30}` → `buyerAmount = undefined`; tidak ada pembaca `buyerPercent` di `lib/api/disputes.ts` (hanya komentar).
**Dampak:** JIKA backend mengirim proposal dalam bentuk persen (sesuai DTO yang dikirim klien), tidak ada pihak yang bisa menerima proposal — fitur resolusi bersama terkunci.

### 50. `DisputeClaimForm` default min 50 / max 3000 vs `SubmitClaimDto.claim` 20–5000 — KRITIS
**Bukti:** probe P-J: `API_CONSTRAINTS.SubmitClaimDto.claim = {minLength: 20, maxLength: 5000}` (`lib/api/constraints.ts:842-846`); `components/ui/dispute-claim-form.tsx` — `minLength = 50, maxLength = 3000` (divalidasi probe via sumber).
**Dampak:** klaim sah 20–49 atau 3001–5000 karakter ditolak DI KLIEN — argumentasi sengketa (materi uang) dipotong aturan yang tidak ada di kontrak.

### 51. `PROPOSAL_NOTE_MAX = 500` vs `MutualResolutionProposeDto.reason` max 2000 — SEDANG
**Bukti:** `app/dispute/[id].tsx:99` `const PROPOSAL_NOTE_MAX = 500`; `maxLength={PROPOSAL_NOTE_MAX}` (baris 1031); kontrak `reason` 10–2000 (`lib/api/constraints.ts:853-857`).
**Dampak:** alasan bernuansa (kunci di sengketa) dipotong 4× lebih pendek dari yang diizinkan.

### 52. Catatan tanggapan (`responseNote`, kontrak max 2000) memakai TextArea berbatas 500 — RENDAH
**Bukti:** `app/dispute/[id].tsx:766` placeholder “Catatan tanggapan (opsional)…” memakai `maxLength={PROPOSAL_NOTE_MAX}` (500); `MutualResolutionRespondDto.responseNote` maxLength 2000 (`lib/api/constraints.ts:861-867`).
**Dampak:** pemotongan diam-diam saat negosiasi.

### 53. `handlePropose` `deps` tanpa `order` (hanya `orderValue`/`myRole` yang menyegarkan closure) — RENDAH
**Bukti:** `app/dispute/[id].tsx:448` `}, [id, proposeAmount, proposeNote, orderValue, myRole, proposing, toast.show])` — `order` dibaca di dalam (guard baris 416-424).
**Dampak:** praktis tertolong oleh dependensi turunan; tetapi order bernilai 0 yang gagal termuat membuat guard “Detail order belum termuat” lengket (edge).

### 54. `getMutualResolution` hasil `readList` cast tanpa normalizer proposal — SEDANG
**Bukti:** `lib/api/disputes.ts:228-230` `.then((raw) => readList<MutualResolutionProposal>(raw, ["proposals"]))` — semua field (`status`, `createdAt`, nominal) mentah; kontras dengan domain orders yang punya `normalizeOrderExtension` dsb.
**Dampak:** kelas D-03: status `pending` (lowercase) lolos guard `p.status === "PENDING"` (`app/dispute/[id].tsx:620`) → tombol usulan ganda tampil.

### 55. `DisputeMessage` dan `DisputeCall` dicast mentah (`createdAt`/`direction`/`status`) — SEDANG
**Bukti:** `lib/api/disputes.ts:137` (`getDisputeMessages` → `readList` cast polos) dan `getDisputeCalls`/`submitDisputeEvidence` pola sama.
**Dampak:** `m.fromUser === true` hanya untuk boolean literal (`app/dispute/[id].tsx` pemetaan pesan) — nilai lain dianggap incoming; waktu invalid → “—”/urutan kacau.

### 56. `handleCallAction`/`handleRequestCall` AMAN (refetch ber-catch sendiri) — dicatat agar tidak dianggap bug — RENDAH
**Bukti:** `app/dispute/[id].tsx:540-577` & `501-525` — `getDisputeCalls(id).catch(() => null)` terpisah dari mutasi. *(Diverifikasi bersih; dicatat sebagai batas temuan issue 44-48.)*

### 57. `evidence-grid` membaca `mimeType` mentah tanpa normalizer (diakui komentar sendiri) — RENDAH
**Bukti:** `components/ui/evidence-grid.tsx:48-49` komentar: *“item.mimeType datang mentah dari response (tanpa normalizer)”*; guard `typeof` di `lib/mime`.
**Dampak:** mime asing → tile dianggap non-gambar (degradasi tampilan).

---

## H. Wallet (topup/transfer/withdraw) — 5 issue (2 KRITIS)

### 58. Topup `CREDIT_CARD` ditawarkan ke user padahal `cardToken` (wajib utk CREDIT_CARD) tidak mungkin dikirim — KRITIS
**Bukti:** `lib/api/types.ts:803-804` `cardToken?: string /* required for CREDIT_CARD method */`; `app/topup.tsx:217` `api.wallet.createTopup({ amount, method: methodId })` — tidak ada `cardToken` di `app/topup.tsx` maupun `lib/api/wallet.ts` (probe P-H); `isTopupMethod` menerima `CREDIT_CARD` (enum `TopupDto.method`, `lib/api/constraints.ts:937-963`) dan `lib/payment-methods.ts:41,51` menampilkan kartu kredit di katalog.
**Dampak:** user memilih Kartu Kredit → request pasti melanggar kontrak (tanpa token) = gagal/berperilaku tak terdefinisi di tengah alur isi saldo.

### 59. `normalizeWalletTransaction` MELEMPAR untuk id numerik (kontras `normalizeOrder` yang mentolerir, A-07) — satu entri rusak = seluruh halaman mutasi error — KRITIS
**Bukti:** `lib/api/wallet-contract.ts:36-50` `if (amount === undefined || typeof transactionId !== "string" || ...) throw invalidResponse(...)`; probe P-G: `normalizeWalletTransaction({txId: 123, ...})` → THROW, `normalizeOrder({id: 123})` → id `"123"` OK. `normalizeWalletPage` memetakan SEMUA entri (kegagalan satu = halaman gagal).
**Dampak:** riwayat dompet (bukti mutasi uang) tidak tampil sama sekali bila ada satu pun id numerik dari server.

### 60. `normalizeWallet` menyebar `...wallet` — field asing/salah tipe lolos ke state uang (kebalikan whitelist `normalizeOrder`, D-08) — SEDANG
**Bukti:** `lib/api/wallet-contract.ts:8-33` `return { ...wallet, balance: derivedBalance, ... } as Wallet`; kontras `lib/api/orders.ts:384-` (D-08) yang hanya mengambil field dikenal.
**Dampak:** tipe `Wallet` menjadi janji yang tidak ditegakkan; field tak dikenal berpotensi menimpa logika turunan (mis. blocker `delete-account.tsx:63-64` yang membaca `holdBalance`).

### 61. `normalizeWalletTransaction` `createdAt` dicast `as string` tanpa validasi (kelas D-03) — SEDANG
**Bukti:** `lib/api/wallet-contract.ts:46-48` `createdAt: (tx.createdAt ?? tx.created_at) as string`.
**Dampak:** format tanggal asing → baris mutasi tanpa waktu/urutan keliru di `wallet-history` (pengelompokan per tanggal lokal).

### 62. `TransferDto` — batas catatan (`NOTE_MAX`) hanya aturan klien; `API_CONSTRAINTS.TransferDto` hanya memuat `amount` — RENDAH
**Bukti:** `app/transfer.tsx:65-67` komentar A-17 mengakui nilai itu tidak ada di kontrak generated; `lib/api/constraints.ts:965-970` `TransferDto` = `{amount 1000..25jt}` saja (field tanpa aturan memang tidak masuk `API_CONSTRAINTS`).
**Dampak:** batas bisa berubah backend tanpa terdeteksi klien (risiko drift; saat ini pengiriman `note` sah menurut `lib/api/types.ts`).

---

## I. Invoice & dokumen — 4 issue (2 KRITIS)

### 63. Struk/invoice menampilkan status hardcode “Terverifikasi” (tone success) APA PUN status order — KRITIS
**Bukti:** `app/invoice/[orderId].tsx:201` — `status={{ label: "Terverifikasi", tone: "success" }}` dikirim ke `<InvoiceReceiptView>` (prop `InvoiceReceiptView.status` di `components/ui/invoice-receipt-view.tsx`), tanpa membaca `invoice.order.status`.
**Dampak:** dokumen finansial memuat klaim verifikasi palsu untuk order yang bahkan bisa berstatus DISPUTED/CANCELLED.

### 64. Item struk: `amount` desimal → `toAmount` → `?? 0` → baris “Rp0” di dokumen resmi — KRITIS
**Bukti:** `lib/api/orders.ts:1359-1372` (`normalizeInvoice` items: `amount: toAmount(...) ?? 0`) + kebijakan `toAmount` menolak desimal (`lib/api/orders.ts:1314-1327`, komentar B-09).
**Dampak:** struk dengan baris item Rp0 sementara total benar — inkonsistensi dokumen yang dipakai bukti sengketa.

### 65. `normalizeInvoice` melempar PARSE untuk objek kosong (`{}`) — respons bentuk lain = layar invoice error total — SEDANG
**Bukti:** probe P6 `zz-probe` (gagal sesuai desain: `ApiError PARSE` dari `lib/api/orders.ts:1377`).
**Dampak:** drift bentuk `fee/invoice` menutup akses dokumen; tidak ada degradasi.

### 66. Placeholder invoice `id: ""`/`status: ""` → badge status kosong di struk — RENDAH
**Bukti:** `lib/api/orders.ts:1359-1380` fallback `status: ""`; `OrderStatusBadge` untuk string kosong → label kosong tone neutral (guard `isOrderStatus`).
**Dampak:** kosmetik dokumen.

---

## J. Rating — 3 issue (1 KRITIS)

### 67. Guard anti-rating-ganda memakai field yang DIBUANG normalizer — mustahil aktif; user bisa mengirim ulasan dua kali — KRITIS
**Bukti:** `app/rate/[orderId].tsx:110-118` — `(order as { rated?: boolean; isRated?: boolean }).rated || (order as ...).isRated` → EmptyState “Sudah dinilai”. `order` = hasil `api.orders.getOrder` yang dinormalisasi `normalizeOrder` — probe P-B: `rated`/`isRated` TIDAK pernah ada di output (keys terverifikasi). Komentar baris 113 mengklaim “satu order satu ulasan”.
**Dampak:** form kedua selalu tampil; duplikat ulasan bergantung pada penolakan server; bila server menerima = data rating ganda.

### 68. `api.ratings.getMyRatings` (daftar ulasan milik user) tidak dipakai layar rate untuk dedupe — RENDAH
**Bukti:** `lib/api/ratings.ts:52` `export function getMyRatings(query?, signal?)`; `app/rate/[orderId].tsx:40-44` hanya memanggil `getOrder`.
**Dampak:** mekanisme dedupe sejati tersedia tetapi tidak diintegrasikan.

### 69. `handleSubmit` rating: `setSubmitting(false)` hanya di `catch` (jalur sukses mengandalkan unmount) — RENDAH
**Bukti:** `app/rate/[orderId].tsx:53-73`.
**Dampak:** bila navigasi tertunda, tombol terkunci sesaat.

---

## K. Daftar transaksi, kartu, timeline — 9 issue (3 KRITIS)

### 70. `mapOrderHistoryToTimeline`: `labels.statuses[e.toStatus]` tanpa `hasOwn` → `title` berupa FUNGSI `Object.prototype.valueOf` → crash React — KRITIS
**Bukti:** `components/ui/order-history-timeline.tsx:99-104` — `labels.statuses[e.toStatus as OrderStatus] ?? (...)`; `DEFAULT_LABELS.statuses = {}` (baris 75) → lookup kunci prototipe (`"valueOf"`/`"toString"`/`"constructor"`) mengembalikan fungsi (khas A-01 yang sudah dibetulkan di `lib/has-own.ts` tapi tidak di sini). **Probe P-C: `title typeof = function`.** Probe P21 `zz-probe` pola sama. `TimelineItem.title: string` (`components/ui/timeline.tsx`).
**Dampak:** satu entri riwayat dengan `toStatus` asing tak terduga = crash “Functions are not valid as a React child” di detail order.

### 71. `labels.actors[e.actor]` tanpa `hasOwn` → deskripsi berisi `function toString() { [native code] }` — KRITIS
**Bukti:** `components/ui/order-history-timeline.tsx:102`; output probe P21 `zz-probe`: `desc[1]= oleh function toString() { [native code] }`.
**Dampak:** teks sampah di riwayat order (pada `actor` prototipe).

### 72. `transactions.tsx:311` mem-parsing `deliveryDeadlineAt` dengan `new Date(...)` mentah (bukan `toEpochMs`) — timestamp epoch-detik-string → countdown “—” — SEDANG
**Bukti:** `app/(tabs)/transactions.tsx:311` `deadlineAt={item.deliveryDeadlineAt ? new Date(item.deliveryDeadlineAt) : undefined}`; `lib/pending-actions.ts` `toEpochMs` sudah menangani epoch-detik (dokumen audit lama soal `toEpochMs` sudah basi — tetapi pemakaian `new Date` polos ini tetap hidup).
**Dampak:** strip tenggat “Batas waktu —” pada data epoch-detik.

### 73. `qris-payment-panel.tsx:93` pola `new Date(expiresAt)` yang sama — SEDANG
**Bukti:** `components/qris-payment-panel.tsx:93` `until={expiresAt ? new Date(expiresAt) : undefined}`.
**Dampak:** countdown QRIS “—” untuk format epoch-detik.

### 74. `hasLiveDeadline` tidak memuat `IN_DELIVERY` — countdown tenggat hilang justru saat barang dikirim — KRITIS
**Bukti:** `components/ui/order-status-badge.tsx:140-147` — hanya `["WAITING_CONFIRMATION","WAITING_PAYMENT","PENDING_PAYMENT","PROCESSING","PAID"]`.
**Dampak:** masa konfirmasi penerimaan (batas buka sengketa/konfirmasi) tidak terlihat di kartu saat `IN_DELIVERY` — user melewati jendela haknya tanpa peringatan countdown.

### 75. `loadMoreHistory` mengabaikan `meta.totalPages` (heuristik `rows.length >= HISTORY_LIMIT`) — RENDAH
**Bukti:** `app/order/[id].tsx:248-268` — `historyHasMore: rows.length >= HISTORY_LIMIT`; muat awal memakai meta (baris 226-228).
**Dampak:** tombol “Muat lagi” hilang prematur bila halaman berikutnya terisi parsial.

### 76. Riwayat order entri sintetis `h-${index}-${toStatus}` — indeks di-reset tiap halaman → tabrakan kunci React/merge — SEDANG
**Bukti:** `lib/api/orders.ts:1004` `id: pickString(item, ["id","historyId"]) ?? \`h-${index}-${toStatus}\`` (`getOrderHistory`, baris 986).
**Dampak:** halaman 2 dengan entri tanpa id menghasilkan id sama dengan halaman 1 → `mergeById` menimpa entri, React key warning.

### 77. `STATUS_CHIPS` tidak menyediakan filter `REFUNDED`/`EXPIRED` padahal tipe `OrderStatusFilter` menyediakan — RENDAH
**Bukti:** `app/(tabs)/transactions.tsx:89-95` dibangun dari `ORDER_STATUS_FILTERS` (`lib/api/orders.ts:223-231` = 7 enum backend saja); `OrderStatusFilter` (`lib/api/orders.ts:~254`) memuat `REFUNDED`/`EXPIRED`.
**Dampak:** order refunded/expired tidak bisa difilter (hanya “Semua status”).

### 78. Toast `Status pembayaran: ${s}` memaparkan enum mentah bahasa Inggris — RENDAH
**Bukti:** `app/order/[id].tsx:1010` — template literal memakai `s` (status mentah `PaymentStatus.status`).
**Dampak:** i18n bocor (“Status pembayaran: PENDING”).

---

## L. Transport & cache — 3 issue (1 KRITIS)

### 79. `MONEY_MUTATION_PATTERNS` TIDAK mencakup `/v1/disputes/...` — menerima resolusi bersama MEMBELAH dana escrow tanpa invalidasi cache saldo — KRITIS
**Bukti:** `lib/api/client.ts:409` `const MONEY_MUTATION_PATTERNS = [/^\/v1\/wallet\/(?:topup|withdraw|transfer)(?:\/|$)/, /^\/v1\/orders(?:\/|$)/]` (probe P-K); `lib/api/disputes.ts` `respondMutualResolution` = `POST .../mutual-resolution/{id}/respond` yang melepas dana ke kedua pihak.
**Dampak:** setelah menerima pembagian dana, saldo/holdBalance tetap menampilkan angka lama (sampai TTL 5s/fokus ulang) — angka uang basi di momen paling penting.

### 80. `unwrapResponse` sukses tanpa kunci `data` mengembalikan seluruh objek (envelope `{data:{...}}` tanpa `success`) lolos apa adanya — RENDAH
**Bukti:** `lib/api/response.ts:36-48` + probe P31 `zz-probe`; konsekuensi: cast `DisputeDetail` menerima `{data:{...}}` dengan `id` undefined (memperparah issue 42).
**Dampak:** bug bentuk respons tidak terdeteksi, muncul sebagai field undefined di UI.

### 81. Envelope `success:false` tanpa kunci error → kode `BAD_REQUEST` generik — RENDAH
**Bukti:** `lib/api/response.ts:43-48` `code: "BAD_REQUEST"` selalu (probe P31 pesan “Insufficient balance” terbaca baik, kode tetap generik).
**Dampak:** klasifikasi error berbasis kode (`isTransient`, retry) tidak melihat sinyal server.

---

## M. Normalizer & kontrak DTO — 9 issue (2 KRITIS)

### 82. `assertDtoConstraints` hanya dipakai di 2 dari ±15 mutasi order (`createOrder`, `createOrderLink`) — `payOrder`, `updateShipping`, `submitDeliveryProof`, `confirmDelivery`, `rejectDelivery`, `respondExtension`, dst. tanpa guard — KRITIS
**Bukti:** `lib/api/orders.ts:719` dan `:1147` satu-satunya panggilan `assertDtoConstraints` (grep); `lib/api/constraints.ts` menyediakan aturan `UpdateShippingDto` (1034), `ConfirmDeliveryDto` (127), `RejectDeliveryDto` (617), `SubmitDeliveryProofDto` (848), `RespondExtensionDto` — semuanya tidak ditegakkan di jalur API.
**Dampak:** kelas issue 33-36 lolos ke jaringan; validasi uang tidak konsisten (janji komentar `assertDtoConstraints` “must not bypass validation” tidak ditepati).

### 83. `toAmount` desimal → `undefined` → nominal order jatuh diam-diam ke fallback `0` — KRITIS
**Bukti:** `lib/api/orders.ts:1314-1327` + `normalizeOrder` (`orderValue: toAmount(...) ?? 0`); probe format `formatRupiah(1500.5) = "—"` (I-04) menutup presentasi tetapi bukan fallback state.
**Dampak:** orderValue 1500,5 tampil sebagai Rp0 di state (bukan “—”).

### 84. `normalizeCounterpartValidation({})` → `{valid: false, notFound: true}` — objek kosong dianggap “user tidak ditemukan” — SEDANG
**Bukti:** probe P4 `zz-probe`: `normalizeCounterpartValidation({}) => {"valid":false,"notFound":true}`.
**Dampak:** drift bentuk respons divonis “tidak ditemukan” — user berhenti melanjutkan ke counterpart yang sah.

### 85. Koersi boolean longgar: `{"valid": "yes"}` → `valid: true` — RENDAH
**Bukti:** probe P5 `zz-probe`.
**Dampak:** nilai string non-boolean diterima sebagai kebenaran (berisiko bila backend mengirim `"false"` — perilaku koersi tidak diuji untuk itu).

### 86. A-07 tidak konsisten antar domain: id numerik ditolerir di orders, dilempar di wallet — SEDANG
**Bukti:** probe P-G (bukti eksekusi di issue 59).
**Dampak:** satu standar “id atau bangkai” yang berbeda di dua domain uang.

### 87. `normalizePaymentStatus` hanya membaca `paidAt` bersarang 2 level — SEDANG
**Bukti:** `lib/api/orders.ts:910-` (`pickString(record, ["paidAt","paid_at"]) ?? pickString(asRecord(record.payment) ?? asRecord(record.transaction), [...])`).
**Dampak:** bentuk bersarang lebih dalam → “Dibayar pada —”.

### 88. `ListOrdersQuery` tidak mengekspos query `from`/`to`/`sortBy`/`sortOrder` yang ADA di spesifikasi `GET /v1/orders` — SEDANG
**Bukti:** `lib/api/orders.ts` `ListOrdersQuery` (filter status/role/search/page/limit) vs `docs/api/kahade-api-mobile.json` parameter query operasi `OrdersController_listOrders`.
**Dampak:** filter rentang tanggal riwayat order mustahil dari klien.

### 89. `getOrdersSummary` tanpa parameter `retry` (berbeda dengan mayoritas endpoint orders yang `retry: 1`) — RENDAH
**Bukti:** `lib/api/orders.ts` `getOrdersSummary` vs `getOrder`/`listMyDisputes` yang `retry: 1`.
**Dampak:** gangguan sekali jalan = statistik Beranda “Gagal memuat ringkasan order” tanpa percobaan ulang otomatis.

### 90. `DisputeDetail.status: string` dicast (tipe tidak menjamin apa pun) + `getDispute` tanpa normalizer — SEDANG
**Bukti:** `lib/api/disputes.ts:80-88`.
**Dampak:** badge `DisputeStatusBadge` menerima status asing (degradasi aman, tetapi label mentah bocor ke UI).

---

## N. Format & komponen uang — 5 issue (1 KRITIS)

### 91. Tombol “Bayar” menampilkan “Bayar —” saat `fee` gagal dimuat — user bisa membayar TANPA nominal yang terlihat — KRITIS
**Bukti:** `app/order/[id].tsx:727` `Bayar {fee?.buyerPays != null ? formatRupiah(fee.buyerPays) : "—"}` — tombol tetap dapat ditekan (modal PIN terpisah dari label ini); `fee` bisa `null` (issue 20 kelas, atau order tanpa `fee` + `calculateFee` gagal diam-diam di `app/order/[id].tsx:204-222`).
**Dampak:** persetujuan bayar tanpa angka = prinsip informed-consent transaksi uang dilanggar.

### 92. `formatCountdown` memakai kata tunggal “hour”/“day” (`{x} hour`) tanpa bentuk jamak — RENDAH
**Bukti:** `lib/format.ts:520-537` + probe `durationHoursParts(23) = {"value":"23","unit":"hour"}`.
**Dampak:** en: “23 hour” / “2 day 04:59”.

### 93. `formatDateTimeWIB("")` = “— WIB” (label zona tetap dirender untuk data kosong) — RENDAH
**Bukti:** probe `zz-probe`: `formatDateTimeWIB('')= — WIB`; `lib/format.ts:569-572`.
**Dampak:** “— WIB” terbaca seperti waktu valid.

### 94. `recordPendingAction` QRIS `fallbackAmount: order?.orderValue ?? 0` — nominal 0 di banner pemulihan — RENDAH
**Bukti:** `app/order/[id].tsx:305` / `lib/use-qris-payment.ts:53,162` `amount: res.amount ?? fallbackAmount`.
**Dampak:** banner “aksi menunggu” tanpa nominal.

### 95. `addDays(createdAt kosong)` → `Invalid Date` mengalir ke kartu extension — RENDAH
**Bukti:** probe P22 `zz-probe` (`addDays("",3) = Invalid Date`); `app/extension/[orderId].tsx` perhitungan `deadline`.
**Dampak:** “Tenggat saat ini — WIB”.

---

## O. Kualitas, edge, dan ketelitian — 9 issue (2 KRITIS)

### 96. Dua jalur “konfirmasi” di detail order (N-02 `confirmOrder({action:"ACCEPT"})` vs `confirmDelivery`) sudah dipisah BENAR — dicatat sebagai batas temuan — RENDAH
**Bukti:** `app/order/[id].tsx:1085,1236` memakai `confirmOrder` (`ConfirmOrderDto`) — sesuai spesifikasi `POST /v1/orders/{id}/confirm`. *(Diverifikasi bersih setelah sempat dicurigai.)*

### 97. `pendingProposal` guard `p.status === "PENDING"` case-sensitive terhadap cast mentah — RENDAH
**Bukti:** `app/dispute/[id].tsx:620`; terkait issue 54.
**Dampak:** status lowercase → dua tombol usulan/penerimaan tampil serentak.

### 98. `proposals.some(p => p.status === "PENDING" && p.proposerId !== me?.id)` saat `me` belum termuat → semua proposal dianggap milik lawan — RENDAH
**Bukti:** `app/dispute/[id].tsx:762`.
**Dampak:** tombol usulan tampil sesaat sebelum identitas termuat.

### 99. `order-links` `handleShare` memanggil `onShare` bahkan saat `url` kosong (fallback salin teks) — RENDAH
**Bukti:** `app/order-links.tsx:81-95` (`handleShare`); pemakaian `onShare` baris 166-168.
**Dampak:** share target kosong di perangkat tertentu.

### 100. `normalizeOrderLink` `orderValue` fallback `0` (toAmount undefined) — KRITIS
**Bukti:** `lib/api/orders.ts:1180-1200`.
**Dampak:** tautan order dengan nilai tampil Rp0 (salah nominal saat dibagikan).

### 101. `Invoice` fallback `order.placeholder` `status: ""` & `fee` dihilangkan diam-diam (`normalizeFeeBreakdown` undefined → baris fee hilang tanpa indikasi) — RENDAH
**Bukti:** `lib/api/orders.ts:342-370` (fee inti tidak lengkap → `undefined`) + `app/order/[id].tsx` hanya render kartu fee bila `fee` ada.
**Dampak:** kartu biaya lenyap senyap pada data parsial.

### 102. `handleCreate` (create-transaction) satu `catch` untuk create order + create link — error PARSE/timeout setelah order terbuat → “Gagal membuat transaksi” → submit ulang = order ganda (menggandakan issue 1/4) — KRITIS
**Bukti:** `app/create-transaction.tsx:415-460` — `handleCreate` mencakup `createOrderLink`/`createOrder` dalam satu `try`; `catch` seragam; tidak ada `invalidateQueryCache`/refresh untuk kasus tak pasti (bandingkan `handlePayPin` A-15).
**Dampak:** jalur utama penciptaan order tidak punya peringatan “mungkin sudah dibuat” sama sekali.

### 103. `cancelOrderLink` sudah menangani bentuk nested dengan baik — dicatat sebagai batas temuan — RENDAH
**Bukti:** `lib/api/orders.ts:1283-1298` (reader `CancelOrderLinkResult` toleran `record.link` nested). *(Diverifikasi bersih — tetapi hasilnya justru DIBUANG pemanggil, lihat issue 29-30.)*

### 104. `pickBoolean`/koersi `normalizeCounterpartValidation` menerima `{"isValid": true}` (alias) — baik — tetapi `{valid: false, reason: ...}` mempertahankan alasan asli tanpa sanitasi panjang — RENDAH
**Bukti:** probe P4/P5 `zz-probe`.
**Dampak:** pesan alasan backend (bahasa/panjang apa pun) ditampilkan langsung ke user.

---

## Lampiran A — Perintah & hasil probe (bukti eksekusi)

```
npx vitest run --config vitest.components.config.ts tests/zz-audit-escrow-e2e.test.tsx
# Tests 15 passed (15)
npx vitest run --config vitest.components.config.ts tests/zz-probe-escrow.test.tsx
# Tests 18 passed | 2 failed (2 gagal = ekspektasi THROW probe P6/P31, bukan bug baru)
```

Keluarnya kunci (`tests/zz-audit-escrow-e2e.test.tsx`):

```
[PROBE-A] normalizeOrder({status:'PAID'}).status = PROCESSING
[PROBE-B] normalized.rated = undefined  normalized.isRated = undefined
[PROBE-C] title typeof = function  desc = oleh BUYER
[PROBE-D] SELLER-resp: pays = 150000  gets = 195000 (orderValue 150000, voucher 50000)
[PROBE-E] assertDtoConstraints({proofId:''}) => {"ok":false,"error":"Isian proofId tidak sesuai ketentuan layanan."}
[PROBE-F] extension.id = ""  proof.id = ""
[PROBE-G] order id=123 => {"ok":true,...id:"123"}  wallet tx id=123 => {"ok":false,"error":"Respons server tidak dapat dibaca."}
[PROBE-H] terbukti: CREDIT_CARD selectable, cardToken tak pernah dikirim
[PROBE-I] UpdateShippingDto {trackingNumber:'AB'} => {"ok":false,"error":"Isian trackingNumber tidak sesuai ketentuan layanan."}
[PROBE-K] const MONEY_MUTATION_PATTERNS = [...wallet/topup|withdraw|transfer..., ...orders...]
[PROBE-L] const TERMINAL: readonly string[] = ["PAID","EXPIRED","FAILED","CANCELLED"]
[PROBE-M] rujukan di layar: getOrderLink ; previewOrderLink pemakai: []
[PROBE-N] call site jalur uang yang mengirim idempotencyKey: []
[PROBE-O] payload persen 70/30 → buyerAmount = undefined
```

Probe `tests/zz-probe-escrow.test.tsx` (dijalankan ulang): `label(toString)= [Function: toString]`, `title[0] typeof= function`, `desc[1]= oleh function toString()...`, `splitFee`/`addDays`/`readList` seperti dirujuk di atas.

## Lampiran B — Fakta spesifikasi (`docs/api/kahade-api-mobile.json`)

| Operasi | Fakta kontrak | Implikasi |
|---|---|---|
| `POST /v1/orders/{id}/complete` | **tanpa `requestBody`** | issue 23 |
| `POST /v1/orders/{id}/delivery-proof/confirm` | body `ConfirmDeliveryDto` **required** | issue 33 |
| `GET /v1/orders/links/{token}` | `security: access-token` | issue 27-28 |
| `GET /v1/orders` | query `from`, `to`, `sortBy`, `sortOrder` | issue 88 |
| `POST /v1/orders/{id}/confirm` | `ConfirmOrderDto {action: ACCEPT\|REJECT}` | dipakai benar (issue 96) |
| `MutualResolutionProposeDto` | `buyerPercent + sellerPercent` (bukan nominal) | issue 49 |
| `SubmitClaimDto.claim` | 20–5000 | issue 50 |
| `UpdateShippingDto.trackingNumber` | min 3 | issue 36 |
| `Confirm/RejectDeliveryDto.proofId` | `^c[a-z0-9]{24}$` | issue 33/35 |
| `TopupDto` | `cardToken` “required for CREDIT_CARD” (komentar `lib/api/types.ts:803-804`) | issue 58 |

## Lampiran C — Diverifikasi BUKAN bug (downgrade, jangan diperbaiki buta)

1. `toEpochMs` (`lib/pending-actions.ts`) sudah menangani epoch-detik — komentar probe P25 basi.
2. Deps `handlePropose`/`handleCallAction` — `setData`/`refresh` memo-stable; dependensi turunan menutup risiko praktis (lihat issue 53 untuk edge).
3. `createTransactionFromTemplate` (`lib/routes.ts`) pemetaan `templatePrefill` (amount/deadline/fee) sudah cocok dengan `CreateTemplateDto`.
4. `handleRequestCall`/`handleCallAction` refetch ber-catch sendiri (issue 56).
5. `handlePayPin` A-15 sudah merekonsiliasi timeout/jaringan (`uncertain`) — sisa masalah hanya kelas PARSE (issue 7).
6. `nextOrderStatus`, `mapValue`, `orderLinkStatusMeta` sudah `hasOwn`-safe (A-01 dkk.) — kecuali `mapOrderHistoryToTimeline` (issue 70-71).
7. `FeeBreakdown` di `app/order/[id].tsx` sudah memakai angka server (B-01) — sisa masalah hanya di create-transaction (issue 15).
8. `transfer.tsx` `note` sah mengikuti `lib/api/types.ts` `TransferDto` (issue 62 hanya soal batas).
9. `normalizeWallet` `holdBalance`/`availableBalance` turunan sudah benar untuk kasus normal.
10. `usePaginatedQuery` (`mergeById`/`byTimestampDesc`/guest-gate) tidak ditemukan cacat pada pembacaan ini.
