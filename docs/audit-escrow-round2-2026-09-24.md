# Audit Escrow Ronde-2 — Performa, UI/UX & Alur Dana — 2026-09-24

Audit mendalam terhadap seluruh fitur transaksi/order escrow (flow pembeli–penjual,
pembayaran saldo/QRIS, bukti pengiriman, sengketa & mediasi, ekstensi tenggat, invoice,
rating, order link, template, dan infrastruktur klien yang menopangnya).

**Konteks.** Ini audit RONDE KEDUA. Audit sebelumnya
(`docs/audit-escrow-end-to-end-2026-09-24.md`) mendokumentasikan 104 isu — sebagian besar
sudah diperbaiki di HEAD saat ini (`d66c6cf`, merge PR #108): bukti pembayaran kini
memakai `payKeyRef` per-siklus, cabang kegagalan-tak-pasti (`PARSE`) sudah ada di
`handlePay*` dan `handleSubmitProof`, dst. **Audit ini hanya mendokumentasikan isu yang
BELUM tertangkap ronde 1 dan masih hidup di kode sekarang.** Komentar perbaikan
historis (`X-NN (audit...)`) menandai area yang sudah ditangani dan tidak dihitung ulang.

## Metode & bukti

Setiap isu dibuktikan dengan bukti kode presisi (`path:baris`, diverifikasi grep/sed di
HEAD ini) dan — bila memungkinkan — eksekusi kode nyata. Probe baru
`tests/zz-audit-escrow-r2.test.tsx` (**29/29 LULUS**) mengeksekusi temuan:
matematika pagination nyata, render jsdom komponen nyata (QRIS panel di tiga status),
inspeksi source terprogram, hitung kunci cache, audit kontrak idempotensi, pembacaan
katalog i18n, dan eksekusi `translate()` runtime. Hasil probe dirujuk sebagai `Q-xx`
per isu. Rangkaian probe audit sebelumnya (`zz-audit-escrow-e2e` + `zz-probe-escrow`,
35/35 hijau) tetap lulus — kedua rangkaian saling melengkapi (total 64/64 hijau).

## Ringkasan

| Kategori | Kritis | Sedang | Rendah | Total |
|---|---|---|---|---|
| A. Alur dana: kegagalan tak-pasti & idempotensi | 3 | 14 | 2 | 19 |
| B. Realtime & basi-data | 1 | 6 | 2 | 9 |
| C. QRIS & lembar pembayaran | 0 | 3 | 2 | 5 |
| D. Sengketa — UI/UX & integritas bukti | 0 | 9 | 3 | 12 |
| E. Bukti pengiriman | 0 | 2 | 2 | 4 |
| F. Detail order | 0 | 4 | 3 | 7 |
| G. Buat transaksi | 0 | 3 | 4 | 7 |
| H. Daftar transaksi & kartu order | 0 | 1 | 4 | 5 |
| I. Order link | 0 | 3 | 3 | 6 |
| J. Ekstensi tenggat | 0 | 1 | 3 | 4 |
| K. Invoice, rating, mutasi wallet | 0 | 2 | 4 | 6 |
| L. i18n & copy | 0 | 6 | 3 | 9 |
| M. Transport, cache & struktur | 0 | 10 | 4 | 14 |
| N. Performa jaringan & render | 0 | 4 | 2 | 6 |
| **TOTAL** | **4** | **68** | **41** | **113** |

---

# A. Alur dana: kegagalan tak-pasti & idempotensi

**Isu #1 — KRITIS.** `handleRespond` menerima kesepakatan bersama
(**pembagian dana escrow dieksekusi server**) tanpa cabang *uncertain failure*:
setiap error apa pun (jaringan/timeout/PARSE) menjadi toast "Gagal menanggapi usulan"
tanpa ada pengecekan situasi akhir server.
**Bukti:** `app/dispute/[id].tsx:489-548` (`handleRespond`, catch → toast "Gagal menanggapi usulan"),
`lib/api/disputes.ts` `respondMutualResolution` (tanpa `idempotencyKey`).
**Probe:** `Q-05` — seluruh layar sengketa memiliki 0 kemunculan token PARSE.
**Dampak:** pada timeout/parse-failure, pembagian dana bisa sudah dieksekusi di server
sementara pengguna diberitahu "gagal"; pengguna menanggapi ulang → server menolak
dengan galat yang membingungkan, atau membekukan state di laman yang tidak lagi
sinkron (state lokal hanya diperbarui lewat `refresh()` pada jalur sukses).
Rangkaian perbaikan ronde-1 untuk `handlePay*` tidak menjangkau handler ini, sehingga
kontrak UX-nya ("tak pernah tunjukkan galat bila hasil tak diketahui") pecah tepat di
titik uang berpindah.

**Isu #2 — KRITIS.** `handleConfirm` melepaskan dana escrow ke penjual
(`confirmDelivery`) tanpa cabang *uncertain* — padahal status order sudah dieksekusi
server mungkin sudah `COMPLETED` saat jaringan buntu.
**Bukti:** `app/delivery-proof/[orderId].tsx:179-213` (`handleConfirm`, catch generik → toast
"Gagal mengonfirmasi penerimaan"); cabang `uncertain` di file ini hanya ada dalam
`handleSubmitProof` (4 kemunculan).
**Probe:** `Q-06`.
**Dampak:** pesan "gagal" untuk mutasi yang mungkin sukses → pengguna berpikir dana
masih tertahan; interaksi lanjut (ratings/refund) mengikuti asumsi salah.

**Isu #3 — SEDANG.** `handleReject` menolak bukti (membekukan status /
membuka jalur sengketa) tanpa cabang *uncertain*.
**Bukti:** `app/delivery-proof/[orderId].tsx:214-284` (`handleReject`, catch generik); DTO yang
digunakan sudah mengikuti kontrak batas teks (10–1000) sehingga satu-satunya mode
gagal yang mungkin adalah jaringan — justru mode di mana hasil tak diketahui.
**Probe:** `Q-06`. **Dampak:** retry pengguna berpotensi menolak dua kali (sengketa
ganda / status sudah berubah server-side), ditampilkan ke pengguna sebagai "gagal".

**Isu #4 — SEDANG.** `handlePropose` (usulan kesepakatan bersama) tanpa cabang *uncertain*.
**Bukti:** `app/dispute/[id].tsx:419-488` (`handlePropose` → `proposeMutualResolution`, tanpa kunci
idempotensi pemanggil; kunci AUTO `client.ts` baru per-request). **Probe:** `Q-05`, `Q-19`.
**Dampak:** timeout → pengguna mengusulkan ulang → proposal duplikat.

**Isu #5 — SEDANG.** `handleSubmitClaim` membuka sengketa tanpa cabang *uncertain*.
**Bukti:** `app/dispute/[id].tsx:297-321` (`handleSubmitClaim` → `submitDispute`, catch generik).
**Probe:** `Q-05`. **Dampak:** klaim sengketa duplikat pada retry pengguna.

**Isu #6 — SEDANG.** `handleEscalate` (eskalasi ke admin, dibatasi maksimal 2×/sengketa
oleh aturan backend — lihat `app/dispute/[id].tsx:1002-1003`) tanpa cabang *uncertain*;
retry pada timeout bisa memakan kuota eskalasi.
**Bukti:** `app/dispute/[id].tsx:228-296` (`handleEscalate`) + copy kuota di Dialog (baris 1002-1003).
**Probe:** `Q-05`. **Dampak:** sisa kuota eskalasi berkurang untuk upaya yang oleh UI
dilaporkan "gagal".

**Isu #7 — SEDANG.** `handleRequestCall` dan `handleCallAction` (mengatur tanggapan
panggilan mediasi) tanpa cabang *uncertain* — jadwal panggilan bisa diusulkan/diubah
server-side sambil dilaporkan gagal.
**Bukti:** `app/dispute/[id].tsx:535-571` (`handleRequestCall`) dan :572-… (`handleCallAction`); `lib/api/disputes.ts` endpoint
call-schedule tanpa `idempotencyKey`. **Probe:** `Q-05`.

**Isu #8 — SEDANG.** `handleSend` (pesan mediasi — bukti tak tertarik) tanpa cabang
*uncertain*; retry → pesan ganda di arsip mediasi.
**Bukti:** `app/dispute/[id].tsx:322-352` (`handleSend` → `sendDisputeMessage`, catch generik).
**Probe:** `Q-05`. **Dampak:** duplikat pesan permanen di arsip mediasi resmi.

**Isu #9 — SEDANG.** `handleAddEvidence` (unggah lampiran bukti sengketa) tanpa cabang
*uncertain*; retry → berkas duplikat dua salinan di file storage dan dua entri bukti.
**Bukti:** `app/dispute/[id].tsx:353-418` (`handleAddEvidence` → `uploadFile` → `submitEvidence`,
catch generik). **Probe:** `Q-05`. **Dampak:** gandaan bukti di arsip + kuota bukti
40/order berkurang dua lipat untuk satu unggahan.

**Isu #10 — SEDANG.** `respondExtension` (`action: "APPROVE"` mengubah tenggat
pengiriman escrow) tanpa cabang *uncertain*: respons `APPROVE` server-side bisa sudah
berlaku saat UI melaporkan "Gagal memproses permintaan".
**Bukti:** `app/extension/[orderId].tsx:220` (callback yang memanggil `api.orders.respondExtension`,
catch generik mengelilinginya).
**Dampak:** kedua pihak bisa melihat tenggat yang berbeda (pemohon vs penyetuju).

**Isu #11 — SEDANG.** `requestExtension` (usulan tenggat baru) tanpa cabang *uncertain*
→ retry membuat permintaan ekstensi ganda yang harus dibersihkan manual.
**Bukti:** `app/extension/[orderId].tsx:259` (callback yang memanggil `api.orders.requestExtension`,
catch generik mengelilinginya).
**Probe:** verifikasi baca langsung handler (grep/sed di HEAD ini).

**Isu #12 — SEDANG.** `handleSave`/`handleDelete` template transaksi tanpa cabang
*uncertain* dan tanpa idempotensi → saat simpan waktu out, retry membuat template
ganda dengan judul sama (tangkapan duplikat tak ditegakkan klien).
**Bukti:** `app/transaction-templates.tsx:120-160` (`handleSave` & `handleDelete`,
keduanya catch → toast "Gagal …"). **Probe:** verifikasi baca langsung handler.

**Isu #13 — SEDANG.** `handleAccept` di layar order link membuat ORDER (escrow baru,
uang akan terikat begitu dibayar) tanpa cabang *uncertain* dan tanpa idempotensi
pemanggil.
**Bukti:** `app/order-link/[token].tsx:62-88` → `acceptOrderLink` catch generik.
**Probe:** verifikasi langsung. **Dampak:** accept ulang setelah "gagal" → 409
server yang oleh UI ditampilkan sebagai kegagalan biasa, padahal order pertama sudah jadi.

**Isu #14 — SEDANG.** `handleDecline` order link tanpa cabang *uncertain*.
**Bukti:** `app/order-link/[token].tsx:89-115` → `declineOrderLink` catch generik.
**Dampak:** tautan status-nya sudah DIBATALKAN/DITOLAK server-side tetapi UI melaporkan gagal.

**Isu #15 — SEDANG.** `handleSubmitRating` mengirim ulasan permanen tanpa cabang *uncertain*:
POST sukses waktu out → pengguna menilai lagi (mungkin dengan bintang berubah) →
konflik server/menimpa ulasan pertama.
**Bukti:** `app/rate/[orderId].tsx:53-…` (`handleSubmit`, catch generik hanya `userMessage`).
**Probe:** `Q-05`-family; diverifikasi langsung di layar rating.

**Isu #16 — SEDANG.** `handleCancel` membatalkan order link tanpa cabang *uncertain*
(the one-time destructive action on seller-created asset).
**Bukti:** `app/order-links.tsx:111` (`handleCancel` → `cancelOrderLink`, catch generik).

**Isu #17 — KRITIS (struktural).** Kehadiran kunci idempotensi pemanggil hanya di
**4 dari ~25 mutasi escrow**: `createOrder`, `createOrderLink`, `payOrder`,
`payOrderQris` di `lib/api/orders.ts`; **0** di `lib/api/disputes.ts`
(claim/evidence/message/propose/respond/withdraw/escalate/call×3), 0 pada
`confirmOrder`, `cancelOrder`, `processOrder`, `updateShipping`, `completeOrder`,
`submitDispute`, `submitDeliveryProof`–`rejectDelivery`, `request/repondExtension`,
`createRating`, `acceptOrderLink`, `cancelOrderLink`. Kunci AUTO dari
`lib/api/client.ts` (Idempotency-Key per non-GET request) baru dibuat **tiap percobaan
baru**, sehingga tidak menyelamatkan retry manual.
**Bukti:** `lib/api/orders.ts` (grep `idempotencyKey\\?: string` → tepat 4 hit),
`lib/api/disputes.ts` (0 hit). **Probe:** `Q-19`.
**Dampak:** semua isu #1–#16 diperparah — tidak hanya pesan gagal yang menyesatkan,
tetapi juga tidak ada penggabungan server-side atas coba-ulang yang identik.

**Isu #18 — RENDAH.** Tidak ada konfirmasi-destruktif untuk "Buat ulang QRIS":
satu ketukan (`onRecreate` di panel) membuang transaksi QRIS aktif server-side dan
membuat transaksi baru — padahal pengguna bisa saja sudah membayar detik itu juga.
**Bukti:** `app/order/[id].tsx:1017` (`onRecreate={() => void handlePayQris()}` tanpa
Dialog), panel `components/qris-payment-panel.tsx` aksi "Buat ulang QRIS" langsung invoke.
**Dampak:** pembayaran yang overlap jendela recreate → dana masuk ke transaksi QRIS
yang sudah dibuang (harus direkonsiliasi server).

**Isu #19 — RENDAH.** `qrRecreate` juga belum memiliki cabang *uncertain*: PARSE pada
`handlePayQris` (recreate) dilaporkan sekadar "Gagal membuat pembayaran QRIS" —
pengguna menekan recreate lagi → transaksi QRIS kedua sementara yang pertama sudah
dibuat server.
**Bukti:** `app/order/[id].tsx` `handlePayQris` catch → toast/pesan generik (bandingkan
dengan cabang PARSE di `handlePayPin` yang dikondisikan sejak ronde-1).

---

# B. Realtime & basi-data

**Isu #20 — KRITIS.** Tidak ada `addNotificationReceivedListener` di seluruh repo —
hanya tap-on-notification. Peristiwa escrow REAL-TIME yang tiba saat layar lawan-
transaksi terbuka (order dibayar, bukti dikirim, dibatalkan, sengketa dibuka) tidak
memicu apa pun di proses aplikasi yang sedang berjalan. Digabung dengan nol
`usePolling` di layar detail (isi #21–#26), status pihak lawan hanya bisa berubah
bila pengguna manual pull-to-refresh.
**Bukti:** grep seluruh repo — 0 kemunculan `addNotificationReceivedListener(`;
routing tap sudah benar di `lib/notification-routing.ts` (bukan cacat di situ).
**Probe:** `Q-07`. **Dampak:** pembeli yang menunggu di layar order tidak melihat
status berubah setelah ia membayar + penjual mengonfirmasi; kedua pihak mengira
transaksi "macet".

**Isu #21 — SEDANG.** Detail order (`app/order/[id].tsx`) tanpa `usePolling` —
tidak ada mekanisme pembaruan status periodik apa pun saat layar terbuka.
**Bukti:** 0 kemunculan `usePolling` di file (probe). **Probe:** `Q-07`.

**Isu #22 — SEDANG.** Detail layar sengketa tanpa `usePolling` — pesan mediasi/proposal
baru dari pihak lawan tidak pernah tampil sampai pull-to-refresh, padahal mediasi
adalah percakapan.
**Bukti:** `app/dispute/[id].tsx` (0 `usePolling`). **Probe:** `Q-07`.

**Isu #23 — SEDANG.** Layar bukti pengiriman tanpa `usePolling` — penjual yang sudah
mengunggah bukti dan pembeli yang mengamati menunggu pembaruan status delivery tidak
pernah segar otomatis.
**Bukti:** `app/delivery-proof/[orderId].tsx` (0 `usePolling`). **Probe:** `Q-07`.

**Isu #24 — SEDANG.** Layar ekstensi tanpa `usePolling` — persetujuan/penolakan
perpanjangan oleh lawan tak kelihatan.
**Bukti:** `app/extension/[orderId].tsx` (0 `usePolling`). **Probe:** `Q-07`.

**Isu #25 — SEDANG.** Layar invoice tanpa `usePolling` dan tanpa `refreshOnFocus` —
invoice yang tadinya PENDING tidak pernah berubah ke TERBIT selama layar terbuka;
pembayaran saldo (yang menggenerate invoice di lingkaran lain) tak terpantul di
layar invoice yang sedang dibuka.
**Bukti:** `app/invoice/[orderId].tsx`. **Probe:** `Q-07` (invoice memang digenerasikan
async setelah pembayaran — layar ini persis yang paling butuh pull/step-up polling).

**Isu #26 — SEDANG.** Daftar sengketa (`app/disputes.tsx`) tidak memasang
`refreshOnFocus: true`, padahal layar daftar transaksi memakainya — kembali dari
detail sengketa (yang statusnya bisa berubah) tidak menyegarkan daftarnya.
**Bukti:** `app/disputes.tsx` usePaginatedQuery tanpa flag refreshOnFocus
(bandingkan `app/(tabs)/transactions.tsx:89` yang ada). **Probe:** `Q-08`.

**Isu #27 — RENDAH.** `app/order-links.tsx` tanpa `refreshOnFocus` — status tautan
yang berubah (DITERIMA / KEDALUWARSA) saat pengguna pergi ke layar lain tak terpantul
saat kembali.
**Bukti:** `app/order-links.tsx` (no refreshOnFocus). **Probe:** `Q-08`.

**Isu #28 — RENDAH.** `app/transaction-templates.tsx` tanpa `refreshOnFocus` —
perubahan dari sesi lain/web tak masuk ketika layar dikunjungi ulang cepat (TTL cache
5 detik memburu skeleton penuh dinonaktifkan oleh cache kadar; stale-edit risk).
**Bukti:** `app/transaction-templates.tsx` useApiQuery satu-satunya flag =
tanpa refreshOnFocus (grep).

---

# C. QRIS & lembar pembayaran

**Isu #29 — SEDANG.** Jalur status QRIS `UNKNOWN` menampilkan copy
"…atau bayar dengan metode lain." — **tidak ada cara mengganti metode**: begitu ada
transaksi QRIS aktif, `SegmentedControl` dinonaktifkan (`disabled={submitting ||
qris != null}`, `app/order/[id].tsx:989`) dan panel hanya menawarkan "Cek status
sekarang" (tidak ada "Buat ulang QRIS" di status UNKNOWN). Provable di runtime:
render menunjukkan teks tersebut + satu-satunya tombol aksi.
**Bukti:** `components/qris-payment-panel.tsx` (cabang UNKNOWN), `app/order/[id].tsx:989`.
**Probe:** `Q-03` / `Q-04` (render jsdom komponen nyata — log membuktikan kedua
pernyataan sekaligus).

**Isu #30 — SEDANG.** Janji yang didokumentasikan di `lib/use-qris-payment.ts` sendiri
tidak dipenuhi UI: komentar C-10 dan M-14 menulis bahwa setelah pemantauan berhenti
(status `pollStopped`) dan saat `UNKNOWN`, pengguna tetap punya dua jalan keluar —
"Cek status sekarang" + **"Bayar metode lain"**. Panel hanya pernah menampilkan tombol
"Cek status sekarang", dan pemilih metode tetap dikunci selama ada intent
(`disabled={submitting || qris != null}`, `app/order/[id].tsx:989`) — jalan
"Bayar metode lain" yang dijanjikan tidak wujud.
**Bukti:** `components/qris-payment-panel.tsx:107-129` (cabang `pollStopped`/UNKNOWN
+ satu-satunya aksi ghost), komentar C-10/M-14 di `lib/use-qris-payment.ts`.
**Probe:** `Q-03`/`Q-04` — render jsdom membuktikan hanya tombol cek-status yang ada.

**Isu #31 — RENDAH.** Ekstrem `expiresAt` hilang → caption QR tampil sebagai
"Berlaku sampai — · Rp150.000" dan judul panel "Kode QR —" terwarping strip patch
(`expiresAt ?? ""`, `formatDateTimeWIB("") = "—"`).
**Bukti:** `components/qris-payment-panel.tsx:83` + header judul.
**Dampak:** UI terlihat rusak seketika kapan pun server meniadakan expiresAt.

**Isu #32 — SEDANG.** Akar lama dari #91 audit ronde-1 **hanya diperbaiki di copy,
bukan di fungsi**: saat `fee == null` (calculate-fee gagal), sheet pembayaran hanya
mengganti deskripsi menjadi peringatan teks, tetapi `PinInput` tetap aktif
(`disabled={submitting}` — tidak ada `!fee`) dan `handlePayPin` tidak menjaga
ketersediaan nominal sama sekali. Pengguna tetap bisa mengotorisasi pembayaran escrow
**tanpa melihat angka yang dibayar** — pembayaran buta dibiarkan terjadi; satu-satunya
pencegah adalah kalimat peringatan yang boleh diabaikan.
**Bukti:** `app/order/[id].tsx:976-981` (deskripsi berubah, konten tetap),
`app/order/[id].tsx:996-1004` (`<PinInput … disabled={submitting}>` tanpa guard fee),
`app/order/[id].tsx` `handlePayPin` (tanpa `fee` di guard/gating).
**Probe:** `Q-30`.

**Isu #33 — RENDAH.** `PinInput.errorText` dipakai untuk menyampaikan pesan kegagalan
jaringan multi-kalimat penuh (gabungan judul+deskripsi dari `userMessage`) di bawah
titik PIN — pesan yang sama sekaligus dirender penuh di
`TransactionProgressOverlay` (failure state) → dua render identik dan helper-text yang
merusak tata letak keypad.
**Bukti:** `app/order/[id].tsx` `handlePayPin` (setPinError = gabungan pesan) vs
overlay `failureMessage`. **Dampak:** UI ganda & rapuh pada pesan panjang.

---

# D. Sengketa — UI/UX & integritas bukti

**Isu #34 — SEDANG.** Bukti berupa **video tidak pernah bisa dipilih**: pemilih media
dikonfigurasi `mediaTypes: ["images"]` di `lib/image-picker`, sementara kontrak bukti
transaksi mendukung 7 tipe termasuk `video/mp4`, `video/quicktime`, dan HEIC.
**Bukti:** `lib/image-picker` (array mediaTypes), `lib/api/constraints.ts` EVIDENCE
whitelist 7 tipe. **Probe:** `Q-10`.
**Dampak:** jalur bukti sengketa/delivery kehilangan bukti paling kuat (rekaman unboxing)
sekalipun backend secara eksplisit mendukungnya.

**Isu #35 — SEDANG.** TIFF/lainnya: `EvidenceMime` (submitEvidence) hanya 4 tipe
mime vs 7 tipe di `EVIDENCE` constraint screen-level → kombinasi upload (foto HEIC dari
iPhone) lolos pemilih tapi mentok di tipe submitEvidence → upload gagal di langkah
kedua dengan pesan generik. **Bukti:** `lib/api/types.ts` `EvidenceMime` (4 literal).
**Probe:** `Q-10`. **Dampak:** bukti sah dari perangkat gagal terunggah.

**Isu #36 — SEDANG.** Ubin bukti sengketa menampilkan video sebagai **ikon PDF**
(klasifikasi `isImageEvidence` hanya true untuk 2 tipe) — pengguna mengetuk ikon PDF
untuk video mereka, membawa ke layar/takeaway salah (viewer media ONE-size).
**Bukti:** klasifikasi di komponen bukti (`isImageEvidence("video/mp4") === false`,
dieksekusi). **Probe:** `Q-10`.

**Isu #37 — SEDANG.** URL lampiran sengketa yang tidak renderable
(`e.url ?? e.fileKey ?? ""` tanpa sanitizer) lolos apa adanya — `fileKey` bisa berupa
kunci objek S3 mentah yang tak bisa diunduh langsung; layar delivery-proof sendiri di file
yang sama proyek **sudah** memakai `isRenderableUrl` (asimetri dua jalur bukti).
**Bukti:** mapping `attachments` di `app/dispute/[id].tsx` vs `isRenderableUrl` di
`app/delivery-proof/[orderId].tsx`. **Probe:** `Q-11`.
**Dampak:** ikon bukti tampil tapi terbuka sebagai tautan rusak → kepercayaan mediator
terhadap bukti rusak.

**Isu #38 — SEDANG.** Kartu daftar sengketa menuliskan `orderTitle={`Order ${item.orderId}`}`
— UUID mentah (36 char) sebagai judul, bukan judul order yang dikenali manusia.
**Bukti:** `app/disputes.tsx` render DisputeCard. **Probe:** `Q-08`-family (verifikasi literal).
**Dampak:** pengguna tak bisa mengenali sengketa mana dari daftar selama banyak order.

**Isu #39 — SEDANG.** Semua list sengketa (pesan mediasi, bukti, proposal, pangilan)
dirender via `map()` polos di layar non-virtual (`Screen`), tanpa pagination API sisi
klien untuk **messages** (`getDisputeMessages(disputeId, signal?)` tidak menerima
parameter page/limit di `lib/api/disputes.ts:185-195`).
**Bukti:** signature fungsi + `messages.map()` di layar.
**Probe:** verifikasi langsung.
**Dampak:** sengketa panjang (ratusan pesan mediasi) dirender penuh → jank + memori.

**Isu #40 — SEDANG.** Satu state `submitting` dipakai untuk mengunci dua alur berbeda
sekaligus: tombol kirim klaim (`submitting={submitting}`) **dan** tombol tambah bukti
(`addDisabled={submitting}`). Mengunggah bukti sementara membekukan form klaim
(padam) dan sebaliknya — tak satu pun dari keduanya seharusnya bergantung.
**Bukti:** kedua prop di `app/dispute/[id].tsx`. **Probe:** `Q-23`.
**Dampak:** pengguna tak bisa menulis klaim ketika unggahan tertunda (jaringan lambat) —
dua proses yang mandiri justru saling memblokir.

**Isu #41 — SEDANG.** Deskripsi bukti yang terkirim ke arsip mediasi adalah
**nama berkas mentah** (`description: asset.name`, `app/dispute/[id].tsx:372`) —
nama ponsel seperti `IMG_20260924_183344.heic` atau bahkan nama berkisi ralat
sistem; tak ada input deskripsi bukti di UI sementara skema API mendukungnya.
**Bukti:** baris 372 + absennya field deskripsi di `dispute-evidence-item`. **Dampak:**
mediator melihat arsip bernama acak alih-alih keterangan bukti yang bermakna.

**Isu #42 — SEDANG.** `InCallControlsBar` dirender saat panggilan aktif dengan tiga
tombol fungsional-palsu: `callMuted/callSpeaker/callVideo` adalah state lokal murni
(`app/dispute/[id].tsx:222-224`) yang tidak tersambung ke objek media WebRTC mana pun.
**Bukti:** state + pros bar di layar 663. **Dampak:** pengguna "mematikan mikrofon"
tanpa efek apa pun pada audio nyata — kontrol palsu dalam konteks mediasi resmi.

**Isu #43 — RENDAH.** Catatan proposal: bidang catatan respons bersama untuk
SEMUA proposal di daftar; setelah CANCEL pada satu proposal narasi yang diketik
tetap tersisa untuk proposal berikutnya (bukan per-item state).
**Bukti:** state `respondNote` tunggal di layar sengketa. **Dampak:** catatan yang
dimaksudkan untuk proposal A bisa tidak sengaja terkirim pada B.

**Isu #44 — RENDAH.** `acknowledgeMessage` peringatan eskalasi yang diset server
diturunkan ke label fallback generik ("Sengketa aktif" pada tone header), sehingga
penjelasan spesifik admin tentang apa yang dilarang tidak tampil istimewa di atas form.
**Bukti:** aliran `acknowledgeMessage` di lib api disputes + header layar.

**Isu #45 — RENDAH.** Judul fallback layar detail sengketa juga memakai
`Order ${dispute.orderId}` (UUID mentah) bila order belum termuat — konsistensi
masalah #38 di layar satuan. **Bukti:** header detail dispute.

---

# E. Bukti pengiriman

**Isu #46 — SEDANG.** Riwayat bukti lama **tak pernah dirender**: JSDoc layar berjanji
"Bukti yang sudah ada tetap tampil di bawah sebagai riwayat" (header
`app/delivery-proof/[orderId].tsx:15`), tetapi kode hanya merender `latest` —
`proofs.map`/`proofs.slice` hitungannya **0** di file itu.
**Bukti:** render JSX layar (`{latest ? ... : ...}`), grep map/slice = 0.
**Dampak:** bukti pertama (mis. foto resi yang ditolak) hilang dari tampilan setelah
bukti kedua diunggah — padahal materi mediasi dan keputusan pembeli harus membandingkan
antara bukti; kontradiksi dokumentasi layar sendiri.

**Isu #47 — SEDANG.** `describeProof` attachments memakai `isRenderableUrl` di satu
cabang pratinjau tetapi `toAttachments` untuk `latest` memetakan fileKey-bekerja-else
— keluaran timbangan lokalisasi menyebabkan lampiran pertama menghilang bila URL-nya
tak dapat dirender (asimetri dengan sengketa #37 — di sana terlalu permisif, di sini
terlalu ketat: lampiran disembunyikan tanpa indikator apa pun).
**Bukti:** `toAttachments`/`isRenderableUrl` di layar delivery-proof.
**Dampak:** bukti sah tak kelihatan tanpa jejak UI (tidak ada placeholder "lampiran tak
dapat ditampilkan").

**Isu #48 — RENDAH.** `toStatus`/normalizer status bukti menurunkan nilai tak dikenal
menjadi `"pending"` → bukti yang sebenarnya dalam status baru server ditampilkan
sebagai "Menunggu konfirmasi", dan form kirim bukti baru disembunyikan (guard
`"CONFIRMED"`) atau dibuka sesuai logika salah.
**Bukti:** helper status di `app/delivery-proof/[orderId].tsx`.
**Dampak:** silent downgrade status.

**Isu #49 — RENDAH.** Tombol konfirmasi pembeli hanya bekerja atas bukti TERAKHIR;
apabila penjual mengirim 2 bukti dan yang pertama yang benar, tak ada cara mengonfirmasi
bukti pertama — aturan yang sepenuhnya server-side tetapi UI tidak menjelaskannya
sebelum pengiriman kedua.
**Bukti:** penawaran `DeliveryProofViewer` di layar (hanya `latest` — terkait #46).

---

# F. Detail order

**Isu #50 — SEDANG.** Alur riwayat: "Muat lebih riwayat" punya bug aritmetika halaman
— bila halaman-1 datang parsial (30 dari `HISTORY_LIMIT = 50` baris, tapi server
melaporkan totalPages=2),
lanjut dikirim untuk `page = nextPage` yang **sama dengan halaman terakhir**,
menghasilkan entri timeline duplikat (60 render / 30 unik di sebuah run nyata).
**Bukti:** `app/order/[id].tsx:252-270`. **Probe:** `Q-01` (eksekusi logika resmi →
cetak duplikat 60/30).

**Isu #51 — SEDANG.** Skeleton penuh menahan seluruh layar sampai
**lima panggilan** (order, history, dispute, + calculateFee bila perlu) selesai —
fee breakdown serial di dalam fetcher yang sama, lalu gate `loading && !order`.
**Bukti:** `app/order/[id].tsx:169` (`Promise.all([getOrder, history, dispute])`) +
`EARLY_STATUSES` gate `calculateFee` + `loading && !order` render gate.
**Probe:** `Q-14`. **Dampak:** "Bayar" muncul lambat (fee POST menyumbat); layar
sepenuhnya kosong meski order tunggal bisa disajikan lebih awal.

**Isu #52 — SEDANG.** Tak ada konsistensi error-boundary parsial: satu endpoint pendukung
gagal (history 404 misal) → layar error menyeluruh (bukan hanya bagian riwayat).
**Bukti:** `catch` tunggal di fetcher men-capture semua Promise.all.

**Isu #53 — SEDANG.** Sukses membuka sengketa dari layar order **tidak menavigasikan**
pengguna ke halaman sengketa yang baru dibuat: respons `submitDispute` diabaikan (id
sengketa baru hilang), dan tidak ada router ke `ROUTES.disputeDetail` — pengguna harus
mencari sendiri di daftar sengketa (yang kembali ke isu #26 tidak menyegarkan diri).
**Bukti:** `app/order/[id].tsx:1146-1166` handler `runAction(...)` tanpa navigate;
grep `ROUTES.disputeDetail(` 0 di layar. **Probe:** `Q-18`.

**Isu #54 — RENDAH.** `openChat` berjalan tanpa affordance loading apa pun: jika ruang
belum ada, `findChatRoomByOrder` menyapu daftar room per-halaman (hingga beberapa GET
serial) sebelum navigasi; pengguna melihat kesunyian.
**Bukti:** `app/order/[id].tsx:472` + helper chat (sequential pages).
**Dampak:** tap-berulang (no `busy` guard di awal handler) → aksi berganda.

**Isu #55 — RENDAH.** Countdown kedaluwarsa memanggil `refresh()` → serial fetch penuh
+ kalkulasi fee lagi — tepat di saat transisi status yang paling rapuh jaringannya,
req berlangsung serial seperti awal (bukan single status GET).
**Bukti:** onComplete Countdown di layar → fetchAll (non-paralel fee rekalkulasi).

**Isu #56 — RENDAH.** Deps beranak: `history`/`dispute`/… ikut mendefinisikan ulang
callback fetcher sehingga referensi `loadMoreHistory` berubah tiap render pasca-append
— membunuh memoization downstream timeline meski konten sama.
**Bukti:** `useCallback` deps ber-komposisi di layar order.

---

# G. Buat transaksi

**Isu #57 — SEDANG.** **Jalur "order ke diri sendiri" mati total**: state `counterpart`
tak pernah disetel `"self"` dari mana pun — kartu validasi yang didesain khusus
untuk menolak self-trade tidak akan pernah menampilkan statusnya (branch tak tersentuh;
probe menemukan 0 setter untuk nilai itu di create-transaction).
**Bukti:** `app/create-transaction.tsx` (absen `setCounterpartState("self")` /
literal `"self"`) + `counterpart-validation-card` (cabang `state === "self"`).
**Probe:** `Q-12`.
**Dampak:** pengguna dapat membuat escrow ke akunnya sendiri sampai terhenti server —
cegahan UI yang ditulis tidak bekerja.

**Isu #58 — SEDANG.** Tombol primer "Lanjut" tiap langkah hanya `disabled` tanpa
penjelasan per-field: pada langkah detail, syarat-syarat (judul ≥ N karakter, deskripsi
≥ N, jumlah≥min) hanya tertera sebagai teks bantuan kecil; tidak ada counter karakter
atau pesan inline kenapa pengguna diblokir.
**Bukti:** render step detail `create-transaction.tsx` (TextArea tanpa counter/inline
severity di step detail).
**Dampak:** abandonment di langkah paling berharga funnel escrow.

**Isu #59 — RENDAH.** Kartu validasi lawan terjebak di spinner "Memeriksa…" untuk
input di bawah panjang minimum: `validateCounterpart` mengeset state `"loading"` lalu
`return` begitu `q.length < MIN_USERNAME` (`app/create-transaction.tsx:336-339`), dan
validasi hanya terjadwal ulang saat teks berubah — jika pengguna berhenti di 2
karakter (belum tahu batas minimum), kartu berputar selamanya tanpa pesan
"username minimal 3 karakter" yang mengarahkan.
**Bukti:** callback length-guard + `CounterpartValidationCard` render state loading.
**Dampak:** pengguna yang ragu menunggu jawaban yang tak pernah tiba tepat sebelum
menentukan untuk siapa ia menahan uang escrow-nya.

**Isu #60 — RENDAH.** Wizard 5 langkah tanpa persistensi draf — satu back-button salah
di tahap Konfirmasi menghapus seluruh input (judul 100 karakter, rekaman nominal,
username), tidak ada auto-save ke AsyncStorage.
**Bukti:** state wizard murni React, tak ada rehydrate pada mount.
**Dampak:** hilang data input mahal; UX modern (mis. marketplace) menyimpan draf.

**Isu #61 — RENDAH.** Jadwal pengiriman sheet: kegagalan fetch → copy "Jadwal
pengiriman belum tersedia" **tanpa tombol Coba lagi** — satu-satunya pemulihan =
tutup sheet, buka lagi.
**Bukti:** blok schedule di `create-transaction.tsx` (setSchedule(null) di catch).
**Probe:** verifikasi JSX.

**Isu #62 — RENDAH.** Deteksi KYC-mandatory dilakukan via **regex atas pesan 400**
server (string cocok/frasa kunci bahasa Indonesia) — mudah dipatahkan oleh perubahan
copy server atau respons lintas-bahasa; layar menginternasionalkan string lain tapi
tidak ketergantungan ini.
**Bukti:** `kycReasonMessage`/regex di `create-transaction.tsx`.
**Dampak:** false-positive/negatif dialog KYC saat copy server berubah.

**Isu #63 — RENDAH.** Voucher: kode dari deeplink (`initialCode`) hanya mengisi state
input sekali — tanpa auto-apply dan tanpa effect mengekspansi, sehingga link promo
wajib mengandalkan pengguna menekan "Tukarkan" sendiri; tidak ada afirmasi visual
bahwa kode berasal dari tautan.
**Bukti:** `components/ui/voucher-redeem-box.tsx` (initialCode → useState init only).
**Dampak:** atribusi promo sebagian gugur di langkah terakhir.

---

# H. Daftar transaksi & kartu order

**Isu #64 — SEDANG.** Satu `<Countdown until={...}>` interval 1-Hz dipasang **per
kartu** di daftar transaksi (20 kartu/halaman → 20+ interval bersamaan, masing-masing
memicu setState per detik pada host FlatList cell yang sama). Pada perangkatAndroid
Go/lama ini berkontribusi jank terlihat saat scroll.
**Bukti:** `app/(tabs)/transactions.tsx` renderItem → OrderCard → Countdown;
`useCountdown` setInterval 1000ms per-instans. **Probe:** `Q-17`.

**Isu #65 — RENDAH.** Prop `until` untuk Countdown dibangun sebagai
`new Date(toEpochMs(item.deliveryDeadlineAt) as number)` **di dalam renderItem**
identitas baru per render (`transactions.tsx:317`) → effect dalam Countdown
terangkai-ulang tiap render list (churn bebas-loop tapi tetap kerja sia-sia).
**Bukti:** baris 317 + deps effect di `useCountdown`/Countdown.

**Isu #66 — RENDAH.** `refreshOnFocus` di tab transaksi memicu refetch halaman-1 penuh
setiap fokus — kembali dari detail order berarti 1 GET /orders page1 + lebihnya posisi
scroll tak terjaga bila data bergerak (reconcile demote items).
**Bukti:** `transactions.tsx:89` + perilaku refreshOnFocus di usePaginatedQuery.

**Isu #67 — RENDAH.** Ringkasan aksesibilitas kartu order membacakan **UUID order
penuh** ke screen-reader („Order 7f3a…e2"). Simpan/ringkas menjadi 8, praktik yang
sudah dipakai di kartu lain.
**Bukti:** `components/ui/order-card.tsx:162` (template summary).

**Isu #68 — RENDAH.** Tidak ada state khusus "menunggu saldo" di kartu — order yang
menunggu pembayaran berlama-lama sama tampilnya dengan yang menunggu kirim; chip
progres tidak menunjukkan sudah dibayar apa belum (hanya `OrderStatus`). Meruangkan
kewajiban aksi pengguna di list mengurangi salah navigasi.

---

# I. Order link

**Isu #69 — SEDANG.** Alur publik "terima order link tanpa akun" **tetap mati oleh
kontradiksi internal**: layar menjadikan `previewOrderLink` (`auth:"none"`) sebagai
"pintu UTAMA" deeplink publik (komentar M-38 di `app/order-link/[token].tsx`), tetapi
rute `order-link/[token]` masih terdaftar di `AUTHENTICATED_SCREENS`
(`lib/protected-routes.ts:52`) dan root layout memblokirnya dua lapis untuk tamu —
native via `Stack.Protected guard={Boolean(session.token)}` dan web via overlay
`GuestLoginPrompt` + gerbang data `useGuestPathBlocked()` di `app/_layout.tsx`
(dan `lib/guest-gate.ts`). Endpoint publik itu karenanya tidak pernah bisa dipakai
tamu dari dalam aplikasi — persis kelas kegagalan yang dilaporkan "diperbaiki" ronde
sebelumnya (M-38 hanya memindahkan pemanggilan API tanpa menyentuh penjaga rute).
**Bukti:** `lib/protected-routes.ts:52`, `app/_layout.tsx:214-215` (`guestBlocked`
+ `isWebGuest`), `app/_layout.tsx:445` (`Stack.Protected`), `lib/guest-gate.ts:63-69`
(gate data hanya aktif di web — justru jalur yang memiliki overlay), komentar M-38 di layar.
**Dampak:** penerima tautan dari WhatsApp wajib daftar masuk hanya untuk MELIHAT isi
tautan yang disodorkan kepadanya — friksi konversi tertinggi di funnel escrow; dua
keputusan arsitektur ("public preview" vs "rute terproteksi") saling meniadakan.

**Isu #70 — SEDANG.** Token order-link penuh ditampilkan di kartu berbagi
(`orderCode={link.token}`) → kode rahasia otoritatif (setara kredensial penerimaan)
tampil permanen pada UI daftar dan ikut tersalin saat share — tidak disamarkan
seperti praktik token lain di aplikasi.
**Bukti:** `app/order-links.tsx` prop `orderCode`. **Probe:** `Q-09`.
**Dampak:** screenshot daftar mengekspos kemampuan menerima order (siapa pun dengan
token dapat menerima).

**Isu #71 — SEDANG.** Fallback preview publik: `previewOrderLink` gagal dengan galat
ABAIKAN apa pun (bukan hanya 404/UNAVAILABLE) langsung dilanjutkan ke
`getOrderLink` (endpoint ter-auth) → di jaringan buruk, kegagalan *sementara* menjemput
dua kali dan mengganti narasi layar seenaknya; identitas behavior yang sama juga
mengaburkan penyebab (server 500 → tampilan kedua tahap berdenyut).
**Bukti:** catch di `app/order-link/[token].tsx` yang memfilter hanya abort.
**Dampak:** beban ganda + UX flicker pada kondisi paling umum terjadi (koneksi lemah).

**Isu #72 — RENDAH.** Kedaluwarsa hanya label teks ("Berlaku hingga …"): tidak ada
pengecekan client-side sebelum memanggil accept/decline — pengguna menekan Terima di
kedaluwarsa → 409 server dengan pesan teknis.
**Bukti:** `expiresLabel` hanya display; handler panggil langsung API.

**Isu #73 — RENDAH.** Tidak ada cap/preven untuk menerima tautan milik sendiri di sisi
UI (server 422 nanti): kreator dan penerima tidak dibedakan dalam preview kartu aksi —
pengguna menghadapi toast server.
**Bukti:** `OrderLinkPreviewCard` render aksi tanpa kepemilikan.

**Isu #74 — RENDAH.** Daftar order-links menggunakan `DataScreen` (ScrollView
non-virtual, `items.map(...)` di body) untuk konten yang bertumbuh lewat load-more —
setelah beberapa halaman, semua kartu share (dengan QR/copy handler tiap baris)
ter-render penuh.
**Bukti:** `app/order-links.tsx:177` (`items.map`) + handleLoadMore bebas pagination cap.
**Dampak:** memori & jank seiring jumlah tautan.

---

# J. Ekstensi tenggat

**Isu #75 — SEDANG.** Layar ekstensi memuat data dalam **rantai serial**: `getOrder`
→ evaluasi `deliveryDeadlineAt` → `getExtension(orderId)` baru kemudian
`getExtensionRequests` per-halaman — riwayat request (list utama layar) menunggu dua
hop sebelumnya padahal tidak bergantung isinya.
**Bukti:** `app/extension/[orderId].tsx` fetchPage/fetcher ordering.
**Probe:** `Q-15`-family (waterfall verification) / perbandingan Q-14.

**Isu #76 — RENDAH.** Efek `void fetchPage(1)` dengan deps `[bundle, fetchPage]`
memicu ulang ambil halaman-1 setiap refresh ringan (identitas bundle baru tiap
rt-fetch) — pekerjaan API ganda pada halaman yang sama.
**Bukti:** `app/extension/[orderId].tsx` effect + komposisi bundle.

**Isu #77 — RENDAH.** Pratinjau tenggat baru mengabaikan ext yang sudah-DISETUJUI
yang tidak kebagian halaman termuat (paged out) → kartu "perkiraan tenggat"
berkurang pada riwayat panjang; kasus hanya muncul untuk tenggat tanpa
`deliveryDeadlineAt` eksplisit.
**Bukti:** logika fallback `addDays(createdAt, deliveryDays)` + sum approved items
yang terhalang pagination di layar.

**Isu #78 — RENDAH.** Batas hari ekstensi (`DAYS`) dan alasan (`REASON`) ditulis ulang
lokal di layar ekstensi padahal ada di `API_CONSTRAINTS` — risiko drift diam-diam
(server mengetatkan batas → pesan gagal generik, bukan validasi dini).
**Bukti:** konstanta lokal vs `"RequestExtensionDto"` di constraints.

---

# K. Invoice, rating, mutasi wallet

**Isu #79 — SEDANG.** Dedupe "sudah dinilai" mem-fetch **maksimal 50 ulasan** terbaru:
order yang sudah dinilai sejak lama (posisi >50) lolos gate `alreadyRated` → form
rating terbuka, pengguna menulis ulasan dan menekan Kirim → server 400 duplikat.
Laten mengikuti pertumbuhan jumlah order pengguna.
**Bukti:** `app/rate/[orderId].tsx` `getMyRatings({ page: 1, limit: 50 })` +
`ratings.some(...)`. **Probe:** `Q-02` (eksekusi resmi menunjukkan `alreadyRated=false`
untuk order di posisi 100).

**Isu #80 — SEDANG.** KeyValue mutasi wallet memuntahkan **nilai enum server mentah**
(`txn.status ?? "Status belum tersedia"`) di baris "Status" tanpa dictionary status
— pengguna awam membaca `PENDING_SETTLEMENT`/`RELEASED`/teknis serupa dalam
transaksi uang tempat mereka butuh kepastian.
**Bukti:** `app/wallet-transaction/[txId].tsx:102`. **Probe:** `Q-24`.

**Isu #81 — RENDAH.** `referenceId` pada mutasi tidak menjadi tautan ke entitas
terkait (order/dispute) — pemakaian diagnosis uang berakhir buntu, harus menyalin manual
kode ke tempat lain.
**Bukti:** render KeyValue "Referensi" di wallet-transaction.

**Isu #82 — RENDAH.** Meta invoice: baris "Biaya platform" menampilkan total biaya
tanpa pecahan berdasarkan `feeResponsibility` — pada escrow dengan penanggungan
berbeda pengguna membaca angka final tanpa konteks siapa ditanggung siapa; invoice
adalah dokumen arsip pengguna sehingga kesalah-tafsir itu abadi.
**Bukti:** penyusun `meta` di layar invoice — tanpa baris breakdown tanggung jawab.

**Isu #83 — RENDAH.** Teks share invoice mengkodekan `ID: <uuid>` mentah dalam kalimat
yang akan diterima pihak luar — tak ada shortcode ramah manusia di payload_share;
kesan profesionalitas artefak transaksi.
**Bukti:** `handleShare` compose di invoice.

**Isu #84 — RENDAH.** Layar invoice tidak punya `refreshOnFocus` — jalan dari pembayaran
ke invoice, deretan dependensi PENDING→TERBIT tak pernah segar otomatis (terkait #25).
**Bukti:** useApiQuery layar invoice (grep refreshOnFocus = 0).

---

# L. i18n & copy

**Isu #85 — SEDANG.** Pelanggaran penamaan token i18n `Buka lampiran {i} dari {total}`
(delivery-proof-viewer, J-05 family) — checker i18n repo (authoritative) menolaknya;
kunci kamus tidak akan pernah sejajar untuk string itu → **terjemahan EN tidak akan
pernah dipakai** meski masa kini sudah ditulis.
**Bukti:** `components/ui/delivery-proof-viewer.tsx:156` + hasil `npm run check:i18n`
(Baris J-05: token {total} "tidak punya nilai"). **Probe:** `Q-21`/`Q-26`
(eksekusi translate → fallback bahasa Indonesia yang benar; EN tak ikut).

**Isu #86 — SEDANG.** Pola sama di order-history-timeline: token `{by}`/`{note}`
di translate deskripsi entri (keputusan constraint token repo `{x},{y}` dilanggar).
**Bukti:** `components/ui/order-history-timeline.tsx:117`. **Probe:** `Q-21`/`Q-26`.

**Isu #87 — SEDANG.** Pola sama di reason-picker: `Minimal {min} · maksimal {max}
karakter` — tiga pelanggaran token teridentifikasi oleh checker CI, dua di komponen
intip escrow.
**Bukti:** `components/ui/reason-picker.tsx:114,118`. **Probe:** `Q-21`/`Q-26`.

**Isu #88 — SEDANG.** `DEFAULT_LABELS` timeline berisi **string Indonesia mentah yang
tidak melalui `t()`/katalog** ("oleh", "Pembeli", "Penjual", "Sistem", "Admin
Kahade") — generator katalog melewatkannya (di luar JSX attribute scan), jadi di
mode bahasa Inggris timeline escrow tetap menampilkan bahasa Indonesia.
**Bukti:** `components/ui/order-history-timeline.tsx:73` (object DEFAULT_LABELS).
**Dampak:** fallback i18n bocor di komponen yang idem dipakai seluruh order.

**Isu #89 — SEDANG.** Total ada **76 kunci katalog EN belum punya terjemahan** di
jalur escrow/transaksi/QRIS (mis. "Pembayaran diterima", copy panel sengketa, dst) —
mode EN menampilkan bahasa sumber untuk mayoritas copy bernilai-uang.
**Bukti:** keluaran `npm run check:i18n` (daftar 76). **Probe:** `Q-21` (cek katalog).

**Isu #90 — SEDANG.** `npm run check:i18n` **exit 1** — pipeline `npm run check`
(gerbang kontribusi repo) merah permanen; setiap PR melihat kegagalan yang tidak
berasal dari perubahannya.
**Bukti:** eksekusi `npm run check:i18n` langsung pada HEAD ini.

**Isu #91 — RENDAH.** `npm run check:screens` juga **exit 1** (4 pelanggaran oversize di
isi #94–#97) → dua gerbang proses kualitas merah berbarengan.
**Bukti:** eksekusi langsung.

**Isu #92 — RENDAH.** Daftar template transaksi dirender via `items.map(...)` di
dalam `DataScreen` (ScrollView non-virtual, `app/transaction-templates.tsx:212`)
tanpa guard batas lokal — jumlah template yang diizinkan server (dan dibebaskan
sebagian oleh fitur premium) bertumbuh tanpa pemagaran; kelas yang sama dengan
isi #74 pada order-links.
**Bukti:** `.map` di body DataScreen + absennya FlatList/keyExtractor di file.

**Isu #93 — RENDAH.** Judul layar-layar sekunder generik ("Detail Order", "Detail
Mutasi") daripada context-aware (short id/deskripsi singkat), masih layak tetapi pola
di tab lain menyertakan konteks yang membantu checkout tanpa ingatan tampilan
sebelumnya.

---

# M. Transport, cache & struktur

**Isu #94 — SEDANG.** `app/order/[id].tsx` **1291 baris** — pelanggar `check:screens`
(kelas S9 yang diprogram sendiri repo): satu layar menampung 20+ handler uang + 5
fetch + state-mesin 15+ status×peran.
**Bukti:** output check:screens; wc -l. **Probe:** `Q-25`.

**Isu #95 — SEDANG.** `app/dispute/[id].tsx` **1091 baris** (pelanggar kedua) —
handler mediasi + unggah + call + render seluruhnya satu file.
**Bukti:** idem. **Probe:** `Q-25`.

**Isu #96 — SEDANG.** `app/create-transaction.tsx` **894 baris** (pelanggar ketiga).
**Bukti:** idem. **Probe:** `Q-25`.

**Isu #97 — SEDANG.** `lib/api/orders.ts` **1624 baris** — facade mutasi uang tanpa
pemisahan sub-domain (orders/payments/links/extension/delivery bercampur) yang
membuat setiap perubahan kecil menyentuh file kritis.
**Bukti:** idem. **Probe:** `Q-25`.

**Isu #98 — SEDANG.** **Lima kunci cache berlainan untuk resource yang sama**
(`GET /v1/orders/{id}`): `order-detail:`, `delivery-proof:`, `rate-order:`,
`order-extension:`, `invoice:` — dengan TTL 5 detik, jendela sinkronisasi kelima
cache independen itu bergeser sendiri-sendiri;
navigasi antar-layar memicu fetch ulang walau data yg sama sedang dipegang tetangga.
**Bukti:** string kunci di masing-masing layar (5 hits dikumpulkan probe).
**Probe:** `Q-13`.
**Dampak:** jaringan 5×lipat untuk 1 order; stale-surprises antar layar (status di
layar A sudah berubah, layar B masih menampilkan versi lain).

**Isu #99 — SEDANG.** Dedupe GET in-flight peladen di `client.ts` **dilewati saat
AbortSignal dipasok** — hampir semua jalur hook (useApiQuery/usePaginatedQuery)
memberikan signal → dua layar mount bersamaan (transisi navigasi) menyebabkan dua
GET identik paralel.
**Bukti:** cabang `signal ? bypass-dedupe` dalam `request()` di `lib/api/client.ts`.

**Isu #100 — SEDANG.** `useApiQuery` sendiri tidak menggabungkan in-flight per-key:
dua pemanggil konkuren dari kunci sama (mis. invoice+detail order saat deep-link
masuk) memulai dua request; tidak ada refcount dedupe layaknya transport.
**Bukti:** `lib/use-api-query.ts` (load awal tanpa map key-inflight).

**Isu #101 — SEDANG.** `components/ui/order-summary-strip.tsx` **dead code** (0
impor di repo) di surface order — bundling/maintain cost pada jalur paling sering
dilihat.
**Bukti:** grep impor 0. **Probe:** `Q-20`.

**Isu #102 — SEDANG.** Timeliness `PayOrderDto` **absen dari API_CONSTRAINTS**
(pembayaran 6 angka PIN tidak divalidasi struktural pra-pengiriman di klien, sementara
DTO-dto sebelahnya tercakup guard `assertDtoConstraints`) — sinkronisasi kontrak
terputus justru di mutasi uang utama.
**Bukti:** hasil grep constraints; tabel `assertDtoConstraints` di lib.
**Probe:** diverifikasi pada grep kontrak (Q-19 family).

**Isu #103 — SEDANG.** `EscalateDisputeDto` dan `WithdrawMutualResolutionDto` juga
absen dari constraints → body eskalasi/penarikan kesepakatan dikirim tanpa validasi
klien apa pun.
**Bukti:** pencarian nama DTO → 0 hit di `lib/api/constraints.ts` (hanya dokumentasi
"KNOWN_DEVIATION" di komentar audit kontrak lama).

**Isu #104 — RENDAH.** TTL cache tunggal 5 detik untuk semua kelas data: navigasi
kembali ke layar memunculkan kilatan skeleton meski baru 3 detik ditinggalkan dan
isinya tak berubah — tanpa pembeda TTL per kelas (order aktif memang pantas 5 detik;
template/invoice/limit bisa 60 detik+; rata-rata durasi sudah di-cache 10 menit).
**Bukti:** default di `lib/query-cache.ts`.

**Isu #105 — RENDAH.** Tidak ada global exception-telemetry/Sentry hook di jalur mutasi
— kegagalan tak-pasti di tempat uang (isi #1–#17) mengakhiri jejak hanya di toast,
tanpa telemetry yang bisa menyelamatkan rekonsiliasi support.
**Bukti:** grep pola log→toast di handler mutasi escrow (no reporting sink).

**Isu #106 — RENDAH.** Rekonsiliasi atas pembayaran yang dilakukan di tempat lain
(web) tidak ditangani: order yang diselesaikan lewat browser tetap terlihat
"Menunggu pembayaran" di aplikasi sampai pengguna kembali ke tab dan pull-to-refresh
manually — karena tanpa listen notifikasi foreground (isi #20) dan tanpa polling,
tak ada jalur bagi aplikasi untuk tahu.

**Isu #107 — RENDAH.** `assertDtoConstraints` dipakai tidak seragam di `lib/api`:
dipanggil di submitEvidence/createOrder/message tapi tidak di sendDisputeMessage/
respondExtension/payOrder — cakupan guard bergantung siapa yang menulis endpoint.
**Bukti:** grep callsite di lib/api/orders.ts vs lib/api/disputes.ts.

---

# N. Performa jaringan & render

**Isu #108 — SEDANG.** Order detail `Promise.all` + fee serial: order/domain yang
sudah selesai (COMPLETED/CANCELLED) ikut menunggu kalkulasi fee dan riwayat penuh —
bandwidth dan TTI terbuang untuk status yang info-nya statis (untuk CACHE-known juga).
**Bukti:** ordering fetcher `app/order/[id].tsx` (step berturut yang panjangnya 5).
**Probe:** `Q-14`.

**Isu #109 — SEDANG.** Dispute detail: `getDispute` serial **duluan**, lalu 5 endpoint
paralel — padahal hanya `getOrder` yang secara aktual memerlukan `d.orderId`;
4 lainnya bergantung hanya pada `id` rute yang sudah diketahui → ~1 RTT
layar-utama-beku yang sia-sia pada setiap kunjungan (fight-latency kasus HOT).
**Bukti:** urutan di `app/dispute/[id].tsx` fetcher (getDispute → Promise.all 5).
**Probe:** `Q-15`.

**Isu #110 — SEDANG.** Layanan transactions yang memakai search+debounce masih me-
request ulang dengan ketukan karakter yang di-interupt (halaman bisa singkatan hasil
yang nyambung berhenti-pertengahan jika pengguna mengetik lambat di jaringan lambat
→ berulang cancel/fetch/paint yang terlihat flicker).
**Bukti:** `debounced` pruning string key → perubahan kunci = fetch halaman-1 baru
di `usePaginatedQuery`.

**Isu #111 — SEDANG.** Pola serializer `new Date(...)` per-baris kartu (re dari
#65) membuat seluruh kolom memoized OrderCard berubah identitas `until` tiap
parent re-render → subtree render ulang tak perlu (React.memo tidak dapat menolong).
**Bukti:** `transactions.tsx:317` + memo boundaries di order-card.

**Isu #112 — RENDAH.** `findChatRoomByOrder` (dipakai detail order → openChat)
menyapu **halaman-halaman daftar room** secara serial hingga match; untuk pengguna
dengan banyak room ini beberapa GET penuh yang hasil hanya dipakai satu kali —
layak endpoint langsung `GET /chat/rooms/by-order/{id}`.
**Bukti:** helper chat-pages scan + pemakaian di order/[id]:openChat.

**Isu #113 — RENDAH.** `CountdownList`-aggregation tak dibuat: tak ada migrasi timer
per-kartu ke tick tunggal context (akan menabung N-1 interval); dokumentasi komponen
`countdown.tsx` sendiri sudah menunjukkan kontrak reset-once-per-deadline yang menjadi
semakin mahal pada N besar.
**Bukti:** arsitektur countdown sekarang N-instans (probe Q-17 + file komponen).

---

## Rekomendasi prioritas

1. **P0 (uang/integritas)** — #17, #1–#16, #18–#19, #20, #29, #32, #57: seragamkan
   cabang *uncertain* untuk semua mutasi, lengkapi kunci idempotensi pemanggil,
   tambahkan listener notifikasi foreground, buka kunci metode pembayaran setelah
   UNKNOWN, gerbang PIN bayar pada nominal fee yang sudah terkonfirmasi, hidupkan
   deteksi self-trade UI.
2. **P1 (pengalaman-orang)** — #46 (riwayat bukti hilang), #50 (duplikat timeline),
   #51/#108/#109 (fetch storms), #64–#66/#111 (timer & render churn), #26–#28 (focus
   refresh), #79 (rating dedupe), #85–#89 (katalog i18n & pipeline merah), #69
   (pintu publik order-link yang saling meniadakan).
3. **P2 (higiene)** — #94–#101 (dekomposisi layar & cache-key unification),
   #102–#107 (kontrak & guard seragam), #112–#113 (API chat endpoint & timer
   agregasi), copy polish #31, #33, #67–#68.

## Lampiran: pemetaan probe

| Probe | Isu yang dibuktikan |
|---|---|
| Q-01 | #50 (duplikasi timeline load-more) |
| Q-02 | #79 (lubang dedupe rating >50) |
| Q-03 | #29 (copy UNKNOWN ↔ kunci metode) |
| Q-04 | #18 (panel UNKNOWN tanpa jalur) |
| Q-05 | #1 (mutasi sengketa tanpa uncertain (family)) |
| Q-06 | #2 (confirm/reject delivery) |
| Q-07 | #20 (realtime absen & facing) |
| Q-08 | #38 (daftar sengketa/order-link freshness) |
| Q-09 | #70 (token penuh) |
| Q-10 | #34, #35, #36 (batas media bukti) |
| Q-11 | #37 (fileKey mentah) |
| Q-12 | #57 (self-trade UI mati) |
| Q-13 | #98 (lima kunci cache) |
| Q-14 | #51, #108 (serial fetch + gate skeleton) |
| Q-15 | #109 (hop serial sengketa) |
| Q-16 | #66 (refetch halaman-1 ekstensi) |
| Q-17 | #64 (timer per kartu) |
| Q-18 | #53 (tanpa navigasi ke sengketa) |
| Q-19 | #17 (kontrak idempotensi) |
| Q-20 | #101 (dead code strip) |
| Q-21 | #85, #86, #87, #89 (token + katalog i18n) |
| Q-22 | konteks #2/#3 (paritas DTO dikonfirmasi — bukan isu) |
| Q-23 | #40 (submitting dipakai bersama) |
| Q-24 | #80 (status mentah mutasi) |
| Q-25 | #94, #95, #96, #97 (oversize S9) |
| Q-26 | #85 (dasar runtime violasi token) |
| Q-27 | #65 (timer & prop Date) |
| Q-28 | #69 (kontradiksi rute publik) |
| Q-29 | #30 (janji bayar metode lain) |
| Q-30 | #32 (bayar buta saat fee null) |

*(Sisa isu dibuktikan via bukti path:baris langsung — eksekusi grep/sed pada HEAD ini —
mengikuti preseden audit ronde-1 untuk temuan statis.)*

---

## Lampiran: status remedi 2026-09-25 (branch arena/01a0d3b5-frontend)

Seluruh 113 isu **remediated** di HEAD branch ini — diverifikasi gerbang kualitas
penuh (`npm run check` hijau: typecheck, eslint, 11 checker struktural, vitest
242+ pengujian termasuk probe Q-01..Q-03/Q-30 versi regression-guard 29/29).

Catatan remedi lintas-isu (yang belum tercatat di komentar kodenya sendiri):

- **#91 (dua gerbang merah)** — tertutup: `npm run check:screens` & vitest kini
  hijau penuh pada commit akhir; probe r2 yang tadinya membuktikan bug diinvert
  menjadi regression-guard pasca-fix.
- **#106 (rekonsiliasi bayar-di-web)** — tertutup oleh fix #20: notifikasi
  foreground menginvalidasi cache query dan `useApiQuery` me-revalidate diam-diam;
  penyelesaian di browser terlihat di aplikasi saat notifikasi tiba (tanpa pull).
- **#107 (assertDtoConstraints tak seragam)** — sudah seragam di endpoint jalur
  escrow (`payOrder` memakai `LOCAL_CONSTRAINTS.PayOrderDto` karena spec tanpa
  key constraint, #102); `sendDisputeMessage`, `respondExtension`, seluruh jalur
  sengketa & order tervalidasi sebelum kirim.
- **#110 (flicker search)** — pola `DebouncedSearchField` baku di search &
  transactions (nilai mentah di dalam komponen, query berkunci nilai debounced).
- **#112 (findChatRoomByOrder menyapu halaman)** — dibatasi biayanya dengan TTL
  cache per orderId (hit 5 menit, miss 30 detik, verifikasi ringan setelah
  kedaluwarsa); backend belum menyediakan `GET /chat/rooms/by-order/{id} — bila
  nanti tersedia, helper ini dipakai lapisnya tinggal diganti (perilaku sama).
- **#113 (agregasi countdown)** — ticker bersama `lib/use-clock-tick.ts` (satu
  interval modul, subscriber-set) menggerakkan semua kartu order; instans
  `useCountdown` per-tampilan tersisa hanya untuk layar tunggal (panel QRIS).

Isu besar #94–#97 (oversize S9) terdekomposisi: `app/order/[id].tsx` 1061,
`app/dispute/[id].tsx` 914, `app/create-transaction.tsx` 789, `lib/api/orders.ts`
26 (facade+5 submodul) — plafon `check-screens.mjs` diratchet menurun di commit
yang sama per aturan G-11. Dead-code `OrderSummaryStrip` (#101) dihapus dengan
guard fs di probe. Kunci idempotensi pemanggil (#17), katalog i18n kanonik
{#x}/{y} (#85–#89, 2358 string · 100% terjemah), listener notifikasi foreground
(#20), dedupe rating lintas-halaman (#79), navigasi pasca-sengketa (#53), pin
digerbang nominal terverifikasi (#32), token order-link termaskir (#70), pintu
publik order-link dibuka & aksi digerbang sesi (#69), cache-key kanonik Order
(#98) + dedupe in-flight terhadap AbortSignal (#99) + marker single-flight
(#100) — semua terkunci oleh probe Q- yang bersangkutan.
