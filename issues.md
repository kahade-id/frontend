# Audit Frontend Kahade — 138 Temuan Terverifikasi

**Tanggal audit:** 2026-09-22
**Branch / commit:** `arena/01a0c805-frontend` @ `ca08b6a` (main)
**Cakupan:** seluruh `app/` (99 berkas rute; 95 rute terdaftar), `components/` (248 berkas, 235 di antaranya `components/ui/`), `lib/` (112 modul), `scripts/` (30 skrip), `tests/` (23 berkas test) + `e2e/`, konfigurasi Expo/EAS/Metro/Babel/TypeScript/ESLint/CI, serta aset & berkas verifikasi web.
**Metode:** pembacaan baris-per-baris modul inti (transport HTTP, sesi, penyimpanan, i18n, format uang, waktu), eksekusi **seluruh** quality gate repo, `npm audit` analog, pemindaian pola terprogram (`scan1.mjs`, pemeriksa komponen mati, pemeriksa ekspor mati), dan **tiga bukti runtime** yang dijalankan di dalam repo ini lewat Vitest (lihat §M untuk cara reproduksi).

> **Standar bukti.** Setiap temuan menyertakan `file:line` atau keluaran perintah yang bisa direproduksi. Temuan yang hanya bisa dipastikan di perangkat/backend nyata ditandai **(perlu verifikasi runtime)**. Tiga temuan berstatus **🔬 TERBUKTI RUNTIME** karena punya reproduksi yang dijalankan di checkout ini.
>
> **Hubungan dengan `issues & improvement.md`.** Dokumen lama itu berisi 135 temuan terhadap commit `dcc76b1`; seluruh temuan di bawah ini diturunkan dari HEAD `ca08b6a`, bukan disalin. Temuan lama yang sudah benar-benar diperbaiki (mis. tombol biometrik tanpa efek di layar PIN — lihat `app/transfer.tsx:118-123`, `app/withdraw.tsx:137-141`) **tidak** diulang; beberapa hanya muncul sebagai konteks (mis. "A-13 audit lama" pada A-14/A-15).

---

## Ringkasan eksekutif

| Kategori | Jumlah | 🔴 Krit | 🟠 Tinggi | 🟡 Sedang | 🔵 Rendah |
|---|---:|---:|---:|---:|---:|
| A. Bug fungsional alur uang & transaksi | 19 | 2 | 5 | 9 | 3 |
| B. Sesi, auth & proteksi rute | 12 | 0 | 4 | 5 | 3 |
| C. Cache, kesegaran data & paginasi | 11 | 0 | 4 | 5 | 2 |
| D. Keamanan & penanganan error | 12 | 0 | 3 | 7 | 2 |
| E. Waktu, countdown & timezone | 8 | 1 | 2 | 3 | 2 |
| F. Aksesibilitas | 10 | 0 | 2 | 6 | 2 |
| G. i18n & lokalisasi | 9 | 0 | 2 | 5 | 2 |
| H. Komponen UI (perilaku & kontrak) | 14 | 1 | 3 | 8 | 2 |
| I. Dead code, duplikasi & kebersihan | 15 | 0 | 0 | 11 | 4 |
| J. Build, konfigurasi & rilis | 12 | 0 | 3 | 7 | 2 |
| K. Testing & CI | 9 | 0 | 3 | 4 | 2 |
| L. Performa & jaringan | 7 | 0 | 1 | 4 | 2 |
| **Total** | **138** | **4** | **32** | **73** | **29** |

### Baseline tooling (semua dijalankan di checkout ini, bukan diasumsikan)

```
npx tsc --noEmit                → PASS (0 error)
npx eslint .                    → PASS (0 error)
npx vitest run                  → PASS  (18 file, 239 test)
npx vitest run --config vitest.components.config.ts → PASS (5 file, 39 test)
npm run check:tokens            → OK (32 var theme, 32 var di-emit, 5 literal)
npm run check:a11y              → OK (345 file .tsx dipindai)
npm run check:screens           → OK — S1 sisa 2 · S3 sisa 25 · S5 sisa 29 · S9 plafon 5
npm run check:inventory         → OK (95 rute)
npm run check:spec              → OK (288 path mobile, 117 path admin dibuang)
npm run check:api               → OK — 310 panggilan cocok, 0 pelanggaran, 8 KNOWN_DEVIATION
npm run check:weblinks          → OK + 2 PERINGATAN (assetlinks.json & AASA kosong)
npm run check:push              → OK + CATATAN (env Firebase Web kosong → web push nonaktif)
npm run check:permissions       → OK
npm run check:i18n              → OK (1684 string, 100% diterjemahkan, 28 kognat)
npm run audit:classes           → OK (override via cn terdokumentasi)
```

**Artinya: seluruh pipeline hijau, tetapi 138 cacat di bawah ini tidak ada satu pun yang tertangkap gate tersebut.** Tiga di antaranya dibuktikan dengan reproduksi runtime yang dijalankan hari ini.

### Tiga temuan yang sudah punya bukti runtime (🔬)

```
MASK: {"10":"•••• ••78 90","11":"•••• •••8 901","12":"•••• •••• 9012",
       "13":"•••• •••• •012 3","14":"•••• •••• ••12 34","15":"•••• •••• •••2 345",
       "16":"•••• •••• •••• 3456"}
OTP VALUE SETELAH errorText DIISI: "123456"
REMAINING (harus 60) DENGAN OFFSET +300s: 0
```

1. **A-01** — `maskAccountNumber` memecah 4 digit terakhir untuk rekening 10/11/13/14/15 digit.
2. **A-03** — `<OtpInput>` tidak mengosongkan diri saat `errorText` diisi → kode baru tidak bisa diketik.
3. **E-01** — countdown cooldown OTP kolaps ke `0` saat jam perangkat menyimpang dari jam server.

---
# A. Bug fungsional — alur uang & transaksi

### A-01 🔴🔬 `maskAccountNumber` memecah 4 digit terakhir untuk sebagian besar panjang rekening Indonesia
**Bukti:** `lib/format.ts:426-431`. Masker menyusun string `"•"×hidden + 4 digit terakhir`, lalu **mengelompokkan ulang seluruh string dari awal** dengan `masked.replace(/(.{4})/g, "$1 ")`. Karena bullet tidak dihitung dari belakang, pengelompokan 4-an hanya kebetulan benar bila panjang nomor kelipatan 4.
**Reproduksi (dijalankan):**
```
maskAccountNumber("1234567890")  → "•••• ••78 90"     ← digit terakhir TERBELAH
maskAccountNumber("12345678901") → "•••• •••8 901"    ← TERBELAH
maskAccountNumber("123456789012")→ "•••• •••• 9012"   ← benar (kelipatan 4)
maskAccountNumber("1234567890123")→"•••• •••• •012 3" ← TERBELAH
maskAccountNumber("12345678901234")→"•••• •••• ••12 34"← TERBELAH
maskAccountNumber("123456789012345")→"•••• •••• •••2 345"← TERBELAH
maskAccountNumber("1234567890123456")→"•••• •••• •••• 3456" ← benar
```
**Dampak:** nomor rekening BCA/BNI (10 digit), CIMB (13), BRI (15), Mandiri (13) tampil sebagai `•••• ••78 90` — pengguna tidak bisa memverifikasi 4 digit terakhir di **layar konfirmasi penarikan** (`app/withdraw.tsx:434`, `:565`), kartu rekening tujuan (`app/withdraw.tsx:384`), daftar rekening (`app/bank-accounts.tsx:326`, `:344`), dan jadwal penarikan (`app/withdrawal-schedules.tsx:243`). Pada produk uang ini menghilangkan satu-satunya titik verifikasi visual pengguna.
**Mengapa lolos:** `tests/format.test.ts:198` hanya menguji panjang 12 (`"•••• •••• 9012"`) dan 2 — satu-satunya dua kasus yang kebetulan benar. Test justru **mengunci perilaku yang benar sebagai satu-satunya kontrak**.
**Saran:** bangun grup dari digit tersembunyinya, bukan dari string gabungan: `const head = "•".repeat(Math.ceil(hidden/4)*4)` lalu `[...head.match(/.{4}/g), ...]` dan kelompokkan `digits.slice(-visible)` secara utuh sebagai grup terakhir.

### A-02 🟠 `isStale` pada aksi uang menggantung membandingkan epoch server dengan jam perangkat
**Bukti:** `lib/pending-actions.ts:79-81` (`isStale(action, now = Date.now())`) memakai `Date.now()` perangkat, sementara `expiresAt` diisi dari respons server lewat `toEpochMs()` (`lib/pending-actions.ts:54-61`, dipanggil di `app/withdraw.tsx:208` dan `app/order/[id].tsx:413`). `sanitize()` memanggil `isStale` saat membaca (`:120`).
**Dampak:** perangkat dengan jam maju > sisa TTL akan **membuang catatan penarikan PENDING_OTP/QRIS yang masih hidup** saat boot → banner pemulihan `PendingActionsBanner` tidak pernah muncul dan saldo tetap tertahan di server tanpa jalan kembali dari aplikasi. Jam mundur → banner menawarkan pemulihan untuk aksi yang sudah kedaluwarsa.
**Kesamaan akar dengan E-01:** seluruh modul waktu memakai domain jam yang berbeda-beda. `lib/server-time.ts` sudah menyediakan `serverNow()` tetapi tidak dipakai di sini.
**Saran:** bandingkan `expiresAt` terhadap `serverNow()` dan simpan `createdAt` dengan `serverNow()` juga agar domainnya konsisten.

### A-03 🔴🔬 `<OtpInput>` tidak mengosongkan diri saat `errorText` muncul — kode baru mustahil diketik
**Bukti:** `components/ui/otp-input.tsx:143-156` menyimpan kode di state internal; tidak ada `useEffect` yang bereaksi pada `errorText` (bandingkan `components/ui/pin-input.tsx:173-178` yang **memang** mengosongkan nilai). Input tersembunyi diberi `maxLength={length}` (`:207`).
**Reproduksi (dijalankan):**
```
OTP VALUE SETELAH errorText DIISI: "123456"
```
**Dampak:** pada `app/withdraw.tsx:571-576` (OtpInput tak-terkontrol + `errorText={otpError}`) pengguna yang salah memasukkan OTP penarikan melihat pesan error, lalu **setiap ketukan digit baru tidak menghasilkan apa pun** karena nilai sudah penuh 6/6. Satu-satunya jalan adalah menekan hapus 6×. Sama pada `app/two-factor.tsx:414-418` (`errorText={enableError}`). Ini terjadi di dua alur keamanan.
**Catatan:** pemanggil lain (`reset-password.tsx:220`, `verify-2fa.tsx:189`, `verify-otp.tsx:296`, `change-phone.tsx:133`) memakai `value=` terkontrol sehingga bisa dibersihkan induknya — justru memperlihatkan ketidakkonsistenan ini, bukan alasan.
**Saran:** tambahkan di `otp-input.tsx` efek setara `pin-input.tsx` — `useEffect(() => { if (errorText) { setInternal(""); onComplete?.("") } }, [errorText])` — atau ubah kedua pemanggil itu menjadi terkontrol.

### A-04 🟠 Efek pra-isi resi/kurir menimpa ketikan pengguna saat data order disegarkan
**Bukti:** `app/order/[id].tsx:271-276` (efek `setTracking`/`setCourier`). Komentar di `:265-270` menyatakan cacat ini **diakui dan sengaja tidak diperbaiki**:
> "CATATAN PERILAKU YANG DIPERTAHANKAN: seperti kode lama, effect ini mengisi ulang tanpa syarat setiap data order segar, jadi menarik-untuk-menyegarkan menimpa resi/kurir yang sedang diketik. Itu bug yang sudah ada; tidak diperbaiki di sini…"

**Dampak:** penjual mengetik nomor resi → `query.refresh()` (pull-to-refresh, atau hasil `runAction` di `:298`) mengembalikan `order` baru dengan identitas berbeda → `useEffect([order])` memanggil `setTracking(order.trackingNumber ?? "")` dan menghapus seluruh ketikan. Sama dengan `usePolling` untuk QRIS bila sheet pengiriman terbuka.
**Saran:** isi hanya bila field belum disentuh (mis. `dirtyRef`) atau hanya saat `order.trackingNumber` berubah nilainya, bukan setiap identitas objek baru.

### A-05 🟠 Batas maksimum nominal memakai `balance > 0` — saldo Rp0 dianggap "tidak diketahui"
**Bukti:** `app/transfer.tsx:285-286`
```ts
const maxAmount = balance && balance > 0 ? Math.min(MAX_AMOUNT, balance) : MAX_AMOUNT
```
Idem `app/withdraw.tsx:372`. `balance = 0` (dompet benar-benar kosong) memenuhi `balance > 0` = false → `maxAmount = MAX_AMOUNT`.
**Dampak:** pengguna dengan saldo Rp0 bisa memasukkan nominal sampai `TransferDto.amount.maximum` lewat keypad (`components/ui/amount-keypad.tsx:160-163` hanya menolak `n > max`), lalu ditolak server. Perjalanan 3 layar berakhir di 400. `undefined` (belum termuat) dan `0` (kosong) seharusnya berbeda.
**Saran:** bedakan `balance == null` dari `balance === 0`; untuk `0` tampilkan "Saldo tidak cukup" dan matikan CTA, bukan melonggarkan batas ke maksimum kontrak.

### A-06 🟡 Tombol `00` melewati batas keras 12 digit yang ditegakkan tombol digit
**Bukti:** `components/ui/amount-keypad.tsx:152-168` membatasi `if (next.length > 12) return`, sedangkan `pressDoubleZero` (`:178-204`) **tidak** memeriksa panjang sama sekali — hanya memeriksa `max`. Rantai: 12 digit (batas digit tunggal) → `00` → 14 digit → `parseInt` masih `Number.isFinite` → `onChange` menerima nilai non-`Number.isSafeInteger` bila ditambah lagi.
**Dampak:** dua jalur input dengan kontrak berbeda pada kontrol yang sama; nilai bisa melewati 12 digit yang dianggap "batas keras" oleh komentar di `:157` dan mencapai nilai di luar presisi integer aman untuk Rupiah. Pada `app/subscriptions.tsx`/`create-transaction.tsx` (yang tidak selalu mengirim `max`) `Number.isSafeInteger` di `lib/financial.ts:14` baru menendang di lapisan berikutnya — tetapi state form sudah menyimpan angka rusak.
**Saran:** pindahkan batas panjang ke satu fungsi `pushDigits(digits, added)` yang dipakai ketiga tombol.

### A-07 🟡 Hapus-panjang (long press) punya dua mekanisme yang saling menimpa
**Bukti:** `components/ui/amount-keypad.tsx:216-228` memasang `onPressIn` timer 650 ms → `onChange(0)`, **dan** `:461` memasang `onLongPress={() => onChange(0)}` (RN memicu long-press ~500 ms). Keduanya berjalan berurutan pada satu tekanan, menghasilkan `setState` tiga kali (`onLongPress` → timer → `onPress` saat jari diangkat memanggil `pressBackspace` dengan closure `digits` yang belum tentu segar).
**Dampak:** pada tekanan panjang, `pressBackspace` dapat membangkitkan kembali nominal yang baru saja dihapus (mengembalikan `digits.slice(0,-1)`) bila re-render belum selesai saat jari diangkat. Ini kelas cacat "state dihapus lalu hidup lagi" yang paling sulit direproduksi manual.
**Saran:** hapus salah satu mekanisme (`onLongPress`) dan sisakan timer, atau pindahkan `onChange(0)` ke `onPress` tunggal dengan flag.

### A-08 🟡 `assertDtoConstraints` hanya menegakkan kontrak DTO pada 5 endpoint
**Bukti:** pemanggilan `assertDtoConstraints` hanya ada di `lib/api/orders.ts:528,738`, `lib/api/subscriptions.ts:104`, `lib/api/upload.ts:40`, `lib/api/wallet.ts:314,343,411`. Padahal `API_CONSTRAINTS` memuat 20+ DTO. Contoh yang tidak ditegakkan: `AddBankAccountDto.accountNumber` (`^\d{6,20}$`), `SubmitKycDto.nik` (`^\d{16}$`), `AskQuestionDto.question` (min 5), `AddCommentDto.content` (max 1000), `ChangePasswordDto` (min 12).
**Dampak:** lapisan "runtime counterpart of generated DTO rules" (`lib/financial.ts:49`) menciptakan kesan kontrak ditegakkan menyeluruh; pada kenyataannya sebagian besar form hanya bertumpu pada `maxLength` di JSX atau validasi server. Untuk field keuangan (nomor rekening) ini berarti nilai 1–5 digit bisa dikirim.
**Saran:** bungkus pemanggilan adapter di satu helper `withDto(API_CONSTRAINTS.XDto, dto, () => http...)` agar tidak bisa lupa per endpoint, lalu `check-api-body.mjs` dapat menggagalkan adapter baru yang tidak memakainya.

### A-09 🟡 Validasi form rekening tidak menegakkan aturan DTO yang tersedia
**Bukti:** guard di `app/bank-accounts.tsx:93` hanya memeriksa keberadaan nilai (`!bankCode || !bankName.trim() || !accountName.trim() || !cleanAccountNumber`) dan `:92` hanya membuang karakter non-digit; aturan panjang `accountNumber` ada di `lib/api/constraints.ts:26` (dict `AddBankAccountDto`), tetapi tidak dirujuk di layar maupun di `lib/api/bank-accounts.ts`. `maxLength={20}` (`:279`) hanya mengikat batas atas.
**Dampak:** nomor rekening 3 digit lolos CTA `Simpan rekening` (`:295-299`) dan baru ditolak server; pengguna kehilangan konteks karena toast generik di `:111-115`.
**Saran:** pakai `assertDtoConstraints(dto, API_CONSTRAINTS.AddBankAccountDto)` sebelum `addBankAccount` dan tampilkan error inline pada `Field`, bukan toast.

### A-10 🟡 Kegagalan pembatalan penarikan tidak terlihat saat dipicu dari dialog
**Bukti:** `app/withdraw.tsx:615-624` (`<Dialog onConfirm={() => void handleCancelOtp()} …>`). `handleCancelOtp` menaruh galat ke `setOtpError(userMessage(err))` (`:312`), tetapi `setCloseConfirmOpen(false)` hanya dijalankan pada sukses (`:308`).
**Dampak:** saat cancel gagal (jaringan) dialog tetap terbuka tanpa pesan; `otpError` tertulis ke input OTP di sheet di belakangnya yang mungkin sudah tertutup. Pengguna tidak punya jalan tahu mengapa "Batalkan penarikan" tidak melakukan apa pun, sementara dana masih tertahan.
**Saran:** tampilkan error di dalam Dialog (`description` dinamis) atau toast, dan jangan hanya bergantung pada state sheet yang tidak aktif.

### A-11 🟡 `?resumeAmount=` dipakai apa adanya sebagai nilai uang dari URL
**Bukti:** `app/withdraw.tsx:86` — `const resumeAmount = Number(params.resumeAmount) || 0`, lalu `:147` — `if (resumeAmount > 0) setAmount(resumeAmount)`. Tidak ada pemeriksaan batas kontrak maupun sanitasi tipe (params bisa `string[]`).
**Dampak:** tautan yang ditempel (`kahade://withdraw?resume=X&resumeAmount=99999999999`) mengisi keypad dengan nominal di luar `WithdrawDto.amount.maximum`; UI menampilkan angka yang jelas tidak sah dan baru gagal di server. Karena layar ini juga punya alur OTP, nilai yang salah ikut terbawa ke layar hasil (`:424`, `:539`).
**Saran:** validasi dengan `isValidAmount(resumeAmount, AMOUNT_LIMITS.withdraw)` sebelum dipakai, dan `Array.isArray` untuk tipe param.

### A-12 🟡 Penolakan autentikasi pada Ubah PIN membuang seluruh konteks alur
**Bukti:** `app/change-pin.tsx:100-103` — bila server membalas 401/403, `setStep("password")` tanpa membersihkan/menjelaskan; `password` juga tidak dikosongkan.
**Dampak:** setelah PIN baru diketik dua kali (mode `setup`) dan server menolak, pengguna dilempar ke langkah kata sandi dengan field masih terisi dan **tanpa pesan apa pun** bahwa kata sandi itulah yang ditolak. Satu-satunya umpan balik adalah toast "Gagal mengubah PIN" dari `:95` yang sudah hilang.
**Saran:** tampilkan error pada `PasswordField` (`errorText`) dan kosongkan `password` agar alasan penolakan eksplisit.

### A-13 🟡 `balance` fallback `?? 0` menyamarkan respons cacat sebagai Rp0
**Bukti:** `app/transfer.tsx:90` dan `app/withdraw.tsx:102` — `return { balance: w.balance ?? 0 }`.
**Dampak:** meskipun audit sebelumnya (A-09) memperbaiki kegagalan *request*, respons 200 yang tidak memuat `balance` (mis. `{ data: {...} }` yang tidak di-unwrap, atau field bernama `availableBalance`) tetap dirender sebagai **"Saldo tersedia Rp0"** di keypad (`components/ui/amount-keypad.tsx:315-318`) — angka salah yang persis sama dengan yang dilarang audit sebelumnya.
**Saran:** biarkan `undefined` bila field tidak ada, dan tampilkan "saldo tidak diketahui"; `?? 0` untuk angka uang selalu salah.

### A-14 🟠 Jaring pengaman "sinkronkan status dulu" saat pembuatan QRIS tidak pernah berjalan
**Bukti:** `app/order/[id].tsx:424-425` — ketika `payOrderQris` gagal secara tak pasti (jaringan/timeout: intent **mungkin** sudah terbuat di server), kode memanggil `await pollPayment()` dengan komentar *"sinkronkan status sebelum user menekan lagi (mencegah intent ganda, A-13)"*. Tetapi `pollPayment` menolak berjalan bila `activePayment.current !== order.id` (`:348`), sedangkan `activePayment.current` diisi dari **render**, bukan dari aksi: `sheet === "pay" && qris ? id : null` (`:250`). Pada kegagalan pembuatan intent **pertama**, `qris` masih `null` (baru di-set di jalur sukses `:403-404`), sehingga `activePayment.current === null` dan `pollPayment()` keluar pada baris pertama tanpa satu pun request `getPaymentStatus`.
**Dampak:** janji kode — dan perbaikan "A-13" pada **audit lama** (`issues & improvement.md`) — tidak berlaku pada kasus yang paling penting: intent mungkin sudah hidup di server, klien tidak menyinkronkan status, lalu pengguna menekan "Bayar dengan QRIS" lagi dan meminta intent baru. Karena `Idempotency-Key` dibuat ulang untuk setiap panggilan (`lib/api/client.ts:379`), server menerima dua POST berbeda; apakah QR ganda benar-benar tercipta bergantung pada penjagaan sisi backend. **(perlu verifikasi runtime terhadap backend)** Pengguna juga tidak diberi tahu bahwa pembayaran mungkin sudah aktif.
**Saran:** jangan bergantung pada ref yang diisi saat render pada jalur *event*: pada kondisi tak pasti panggil langsung `api.orders.getPaymentStatus(order.id)` lalu `setQrisStatus`; atau tambahkan parameter `force` pada `pollPayment(orderId, { force: true })`.

### A-15 🟠 Pembayaran saldo (`payOrder`) tidak direkonsiliasi setelah kegagalan tak pasti — kontras dengan QRIS di layar yang sama
**Bukti:** `app/order/[id].tsx:331-338` — `catch` pada pembayaran saldo hanya menetapkan pesan lalu menjadwalkan hasil; tidak ada `query.refresh()`, tidak ada pemeriksaan status, tidak ada peringatan "mungkin sudah diproses". Di layar yang sama, `handlePayQris` (`:424-425`) justru memanggil `pollPayment()` untuk kasus tak pasti. `app/transfer.tsx:262-275` memberi tahu pengguna "status mungkin sudah diproses" tetapi juga tidak menyediakan rekonsiliasi (tidak ada refresh status transaksi).
**Dampak:** bila POST `/v1/orders/{id}/pay` berhasil di server namun responsnya hilang (timeout — `API_TIMEOUT_MS = 20_000`, `lib/api/config.ts:19`), pengguna melihat kegagalan dan sheet PIN dibuka ulang dengan pesan error; percobaan berikutnya memakai `Idempotency-Key` **baru** (`lib/api/client.ts:379`). Risiko debit ganda bergantung pada penjagaan backend, tetapi klien saat ini tidak melakukan apa pun untuk mencegahnya — padahal pola pencegahannya sudah ada di fungsi tetangga pada layar yang sama. **(perlu verifikasi runtime terhadap backend)**
**Saran:** terapkan pola QRIS (sinkronkan status sebelum percobaan ulang diizinkan) pada `handlePayPin`; idealnya kunci `Idempotency-Key` per `orderId + aksi` di klien sehingga percobaan ulang tidak menciptakan intent baru.

### A-16 🟡 Penutupan sheet PIN transfer tidak membatalkan timer hasil, tetapi juga tidak mereset `progressError`
**Bukti:** `app/transfer.tsx:656-671` (`onRequestClose` hanya `if (!submitting) setStep("confirm")`) sementara `progressError` diset di `:269` dan hanya dibersihkan pada submit berikutnya (`:240`).
**Dampak:** pesan kegagalan dari percobaan sebelumnya tetap terpasang; pada percobaan berikutnya `TransactionProgressOverlay` sempat merender `failureMessage={progressError}` lama sebelum stateProcessing diterapkan — kilatan pesan error basi pada layar uang.
**Saran:** bersihkan `progressError` di `onRequestClose` seperti `closeSheet()` di `app/order/[id].tsx:277-285`.

### A-17 🔵 Transfer: indikator saldo dan batas maksimum tidak pernah di-refresh setelah submit sukses
**Bukti:** `app/transfer.tsx:249-259` sukses → `setProgressState("SUCCESS")` → `scheduleResult` → `setStep("done")`. Tidak ada `balanceQuery.reload()`/`refresh()`.
**Dampak:** bila pengguna menekan "Kembali ke dompet" (`:588`, `router.replace`), tab Dompet memuat ulang karena `refreshOnFocus`, jadi dampaknya kecil — tetapi `useApiQuery` menyimpan cache 5 detik dengan key `"wallet-overview"` (`lib/use-api-query.ts:37`) sehingga saldo **basi** bisa tampil pada layar transfer berikutnya yang dibuka <5 detik.
**Saran:** panggil `invalidateQueryCache()` setelah setiap mutasi uang (lihat C-01).

### A-18 🔵 Prefix "Rp" pada `AmountKeypad` tidak mengikuti nilai nol vs kosong
**Bukti:** `components/ui/amount-keypad.tsx:330-346` — tone prefix berubah pada `digits.length === 0`, tetapi teksnya selalu `"Rp"`.
**Dampak:** nol dan kosong tidak dapat dibedakan pembaca layar (`displayed` juga `"0"` di `:126`). Bukan bug fungsional, tetapi info status hilang.
**Saran:** tambahkan `accessibilityLabel` pada baris nominal yang membedakan "belum ada nominal" dan "nol".

### A-19 🔵 `withdraw` menampilkan `accountName` kosong sebagai string kosong, bukan placeholder
**Bukti:** `app/withdraw.tsx:434` memakai `a.n. ${selected.accountName ?? ""}`.
**Dampak:** bila backend tidak mengisi `accountName`, hasilnya `a.n. ` dengan spasi menggantung pada layar konfirmasi penarikan; di `:384` tempat lain memakai `?? "—"` yang benar.
**Saran:** samakan fallback ke `"—"` di semua titik.

---

# B. Sesi, auth & proteksi rute

### B-01 🟠 `clearAccessToken()` tidak menaikkan revisi sesi dan tidak menandai "signed out"
**Bukti:** `lib/api/session.ts:126-130`:
```ts
export async function clearAccessToken(): Promise<void> {
  accessTokenCache = null
  notifySession()
  await writeInOrder(() => deleteSecureItem(SecureKeys.accessToken))
}
```
Bandingkan `clearSession()` (`:139-154`) yang menaikkan `revision`, memanggil `clearRegistrationState()`, dan menulis `sessionSignedOut = "1"`.
**Dampak:** setelah `clearAccessToken()`, `getSessionRevision()` tidak berubah sehingga request yang masih terbang **tidak di-abort** oleh `assertSession()` (`lib/api/client.ts:414-416`). Pada boot berikutnya `useAuthSession` (`lib/use-auth-session.ts:26-31`) melihat `sessionSignedOut` tak diset dan langsung mencoba refresh lagi — perilaku "logout yang tidak benar-benar logout".
**Saran:** panggil `clearSession()` di satu-satunya jalur keluar, atau tambahkan `revision += 1` + `sessionSignedOut` ke `clearAccessToken`.

### B-02 🟠 Tab Dompet tidak punya guard tamu, Beranda punya — tamu web memicu 401 berantai
**Bukti:** `app/(tabs)/home.tsx:177,192` menghitung `isGuest = !token` dan mematikan kelima query (`enabled: !isGuest`). `app/(tabs)/wallet.tsx` **tidak memiliki satu pun** referensi guest/isGuest/token meski memanggil dua endpoint ber-auth:
```
app/(tabs)/wallet.tsx:84  useApiQuery("wallet-balance", (signal) => api.wallet.getWallet(signal), true, …)
app/(tabs)/wallet.tsx:87  usePaginatedQuery("wallet-recent", (page, signal) => api.wallet.getWalletTransactions(…))
```
`/wallet` justru termasuk tab yang **diizinkan** untuk tamu (`tests/route-protection.test.ts:145-150`, entri `/wallet` di `:148`).
**Dampak:** tamu web yang membuka tab Dompet menembak `GET /v1/wallet` + `GET /v1/wallet/transactions` berkali-kali; tiap 401 memicu `refreshAccessToken()` (`lib/api/client.ts:437-443`) dan berpotensi `expireSession` → `emitSessionExpired`. Ini regresi pola B-04/B-05 pada audit sebelumnya yang sudah diperbaiki di Beranda tetapi tidak di Dompet.
**Saran:** terapkan `enabled: Boolean(token)` di tab Dompet (dan audit tab lain dengan cara yang sama).

### B-03 🟠 Guard web root layout selalu `true` — layar terproteksi tetap ter-mount sebelum gate tamu
**Bukti:** `app/_layout.tsx:386-402` — komentar menyatakan sengaja:
> "Web: guard selalu true (semua layar terdaftar); pemblokiran tamu ditangani GuestLoginPrompt di bawah."

`GuestLoginPrompt` dirender sebagai lapisan absolut di atasnya (`:407-411`).
**Dampak:** efek `useApiQuery`/`usePaginatedQuery` pada layar tersebut **sudah berjalan** sebelum gate menggambar. Untuk tamu web, deep link ke `/order/x`, `/kyc`, `/settings` tetap menghasilkan request ber-auth (401 + refresh + kemungkinan `expireSession`) yang tidak pernah bisa berhasil. Beban dan kebisingan log ini sepenuhnya dapat dihindari.
**Saran:** pakai `enabled: !guestBlocked` pada level penyedia data, atau pindahkan gate ke luar `<Stack>` dengan `Stack.Protected guard={!isWebGuest || allowedPath}`.

### B-04 🟠 `useAuthSession` melewatkan refresh saat refreshToken tidak tersimpan di native
**Bukti:** `lib/use-auth-session.ts:31`:
```ts
if (!access && (Platform.OS === "web" || (await getRefreshToken()))) { … refreshAccessToken() … }
```
Slot `SecureKeys.refreshToken` hanya terisi bila backend mengirim `refreshToken` di body (`lib/api/session.ts:113` — `if (tokens.refreshToken)`), sedangkan komentar di `lib/api/session.ts:11-16` menyatakan desainnya mengandalkan **cookie HttpOnly**.
**Dampak:** pada perangkat native yang tidak mendapat `refreshToken` di body, aplikasi **tidak pernah mencoba refresh** saat boot dan langsung menampilkan alur "belum login" meski cookie masih valid — sesi tampak terputus setiap kali app dibuka dingin. (perlu verifikasi runtime terhadap respons `/v1/auth/login` nyata)
**Saran:** jalankan refresh tanpa syarat pada native (biarkan 401 menjadi jawaban), atau pastikan backend selalu mengirim `refreshToken` untuk klien native dan hapus percabangan ini.

### B-05 🟡 `getSessionSnapshot()` mengembalikan tiga keadaan berbeda ke `useSyncExternalStore`
**Bukti:** `lib/api/session.ts:42` (`let accessTokenCache: string | null | undefined`) dan `:52-54` mengembalikannya apa adanya; konsumennya `lib/use-auth-session.ts:16`.
**Dampak:** `undefined` (belum dibaca) dan `null` (sudah dibaca, tidak ada token) dipetakan sama oleh `Boolean(session.token)` di `app/_layout.tsx:389,418`, tetapi `useSyncExternalStore` memperlakukannya sebagai dua snapshot berbeda → render ulang tambahan tiap transisi. Lebih penting: `serverSnapshot` di `use-auth-session.ts:14` mengembalikan `undefined` sehingga hidrasi web membandingkan dua nilai yang artinya berbeda.
**Saran:** normalisasi snapshot ke `string | null` (`return accessTokenCache ?? null`).

### B-06 🟡 `clearSession()` tidak menghapus `uiPrefs`, sehingga preferensi antar-akun bocor
**Bukti:** `lib/secure-storage.ts:185-197` menghapus 7 key (termasuk `pendingActions` dan `recentRecipients` dengan komentar eksplisit "akun berikutnya tidak boleh mewarisi jejak transaksi"), tetapi **tidak** menyertakan `SecureKeys.uiPrefs` yang menyimpan `ratingSnoozeUntil` **per orderId** (`lib/ui-prefs.ts:34`).
**Dampak:** akun berikutnya di perangkat yang sama mewarisi daftar snooze pengingat ulasan milik akun sebelumnya — tepat kelas data yang komentar di `:192-193` nyatakan sengaja dihindari. Selain itu blob tumbuh monoton (`:171` hanya membersihkan yang sudah lewat).
**Saran:** hapus key `uiPrefs` di `clearSession()` lalu beri nilai default; `balanceHidden`/`transactionsTab` adalah preferensi perangkat, jadi pisahkan field akun dari field perangkat.

### B-07 🟡 Kegagalan penyimpanan saat `expireSession` menyamarkan galat otentikasi
**Bukti:** `lib/api/client.ts:301-313`. `promise = clearing.finally(…)` menurunkan hasil `clearSession()`; `attempt()` di `:425` dan `:446` melakukan `await expireSession(revision)`.
**Dampak:** bila `SecureStore.deleteItemAsync` melempar (Keystore terkunci, penyimpanan penuh), promise `expireSession` **reject** sehingga pengguna melihat error penyimpanan alih-alih `UNAUTHORIZED`, dan `emitSessionExpired()` tidak pernah dipanggil karena berada di dalam `.finally` yang gagal — sesi habis tanpa redirect ke login.
**Saran:** bungkus `clearSession()` dengan `.catch(logWarn)` dan pastikan `emitSessionExpired()` selalu dijalankan.

### B-08 🟡 `sessionSignedOut` ditulis sebelum penghapusan selesai — logout yang gagal membuat app "terkunci keluar"
**Bukti:** `lib/api/session.ts:146-153` — `try { await setSecureItem(sessionSignedOut,"1") } finally { await clearSecureSession() }`.
**Dampak:** bila penghapusan gagal, flag `sessionSignedOut` **sudah tertulis**; boot berikutnya (`lib/use-auth-session.ts:26-29`) memanggil `clearSession()` lagi, menulis flag lagi, dan seterusnya. Token tersisa di perangkat tidak pernah dibersihkan sementara UI terus menganggap pengguna keluar — perangkat menjadi tidak bisa memakai sesi apa pun tanpa reinstall.
**Saran:** tulis flag hanya setelah penghapusan berhasil, atau hapus flag bila penghapusan gagal.

### B-09 🟡 Force-update tidak pernah menampilkan versi terbaru dan hanya dicek saat boot di web
**Bukti:** `app/_layout.tsx:277-306` — `latestVersion` diteruskan ke state (`:297`) tetapi tidak dipakai di Dialog (`:428-462`); pengecekan ulang lewat `AppState` dibatasi `if (Platform.OS === "web") return` (`:309`).
**Dampak:** pengguna web tidak pernah tahu ada versi lebih baru kecuali OTA SW (`:497-509`); pengguna native melihat dialog tanpa menyebut versi terkini yang tersedia, sehingga tidak tahu seberapa besar jarak versinya.
**Saran:** sertakan `latestVersion` di deskripsi dan tambahkan `visibilitychange` untuk web.

### B-10 🔵 `subscribeNotificationOpened` tidak pernah mengulang dedupe cold-start bila penyimpanan gagal
**Bukti:** `lib/push-notifications.ts:107-127`. `coldStartHandled` diset `true` sebelum blok async; blok `try/catch` gagal-baca hanya dilewati, tetapi `setSecureItem` yang gagal **tidak** membatalkan `onOpen`.
**Dampak:** kegagalan tulis berarti notifikasi yang sama akan menerima `onOpen` lagi pada peluncuran berikutnya → dua navigasi untuk satu tap (masalah yang justru ingin dicegah komentar `:112-115`).
**Saran:** simpan id di memori setelah `await` berhasil dan gunakan sebagai cadangan bila penyimpanan gagal.

### B-11 🔵 `AppLockGate` hanya native, tetapi `biometric-settings` tetap menawarkan fitur di web
**Bukti:** `app/_layout.tsx:418` — `{Platform.OS !== "web" ? <AppLockGate … /> : null}`; `components/app-lock-gate.tsx:71` memasang `AppState` listener (tidak ada cabang web).
**Dampak:** halaman pengaturan biometrik di web (build statis) menampilkan opsi kunci aplikasi yang tidak akan pernah aktif di platform itu.
**Saran:** sembunyikan bagian kunci aplikasi bila `Platform.OS === "web"` atau `canUseBiometricStorage()` false (`lib/secure-storage.ts:204`).

### B-12 🔵 `useAuthSession` menyembunyikan kegagalan refresh di web tanpa jejak
**Bukti:** `lib/use-auth-session.ts:37-41` — `catch (error) { if (Platform.OS !== "web") throw error }`.
**Dampak:** kegagalan refresh di web ditelan tanpa `logWarn`, sehingga `lib/telemetry.ts` tidak pernah menerima sinyal "sesi web gagal dipulihkan" — persis kelas kegagalan yang paling sering berubah di produksi.
**Saran:** `logWarn("auth:restore-web", error)` sebelum menelan.

---

# C. Cache, kesegaran data & paginasi

### C-01 🟠 `invalidateQueryCache` tidak pernah dipanggil dari mana pun — cache uang tidak bisa dibatalkan
**Bukti:** `lib/use-api-query.ts:67-70` mendefinisikan `invalidateQueryCache(key?)`, tetapi satu-satunya kemunculan di seluruh `app/`, `components/`, `lib/` adalah definisi itu sendiri:
```
$ grep -rn "invalidateQueryCache" app components lib
lib/use-api-query.ts:67:export function invalidateQueryCache(key?: string): void {
```
**Dampak:** tidak ada satu pun mutasi uang (transfer, top-up, withdraw, bayar order) yang membatalkan cache. Setiap pembacaan berikutnya dalam `QUERY_CACHE_TTL_MS = 5_000` (`:37`) menyajikan data **sebelum** mutasi. Untuk saldo, ini berarti saldo pasca-transfer bisa tampil basi (lihat A-17).
**Saran:** panggil `invalidateQueryCache()` (tanpa argumen) setelah setiap mutasi yang mengubah saldo/status, dan tambahkan gate `check:` yang menolak adapter mutasi tanpa invalidasi.

### C-02 🟠 Satu endpoint di-query di bawah 5 kunci cache berbeda — klaim "dedupe lintas layar" tidak benar
**Bukti:** `GET /v1/wallet`:
```
app/(tabs)/home.tsx:194            "home-wallet"
app/(tabs)/wallet.tsx:84           "wallet-balance"
app/transfer.tsx:87                "wallet-overview"
app/withdraw.tsx:99                "wallet-overview"
components/ui/showcase-header.tsx:97 "showcase-header-wallet"
```
Komentar yang mengklaim dedupe: `app/transfer.tsx:84-85` — *"Key disatukan dengan withdraw (\"wallet-overview\") agar cache F-03 mendedupe GET /v1/wallet lintas layar"* dan `app/withdraw.tsx:96-97` — *"key \"wallet-overview\" dibagi dengan transfer/home"*. Faktanya **home memakai kunci lain**.
`GET /v1/users/me` bahkan punya ≥7 kunci: `home-profile`, `user-me`, `change-email-me`, `change-phone-me`, `receive-profile`, `showcase-header` (inline), `(tabs)/discover.tsx:257` (tanpa hook).
**Dampak:** empat salinan saldo yang berbeda dapat hidup bersamaan dan tidak ada satupun invalidasi yang menjangkau semuanya. Ini juga membuat C-01 tidak bisa diperbaiki tanpa menyatukan kunci lebih dulu.
**Saran:** pusatkan kunci di `lib/query-keys.ts` (`queryKeys.wallet()`, `queryKeys.me()`) dan pakai di semua layar.

### C-03 🟠 `queryCache` tidak pernah dipangkas berdasarkan ukuran — hanya dihapus saat dibaca
**Bukti:** `lib/use-api-query.ts:45` (`const queryCache = new Map<string, CacheEntry>()`), `:47-59` (`readQueryCache` menghapus entri kedaluwarsa **hanya bila kunci itu dibaca lagi**), `:62-64` (`writeQueryCache` selalu menyimpan).
**Dampak:** kunci ber-parameter tinggi — `order-detail:${id}` (`app/order/[id].tsx:154`), `recipients:${debounced}` (`app/transfer.tsx:127`), `analytics:${period}` (`app/analytics.tsx:101`), `search:*` — menumpuk entri yang tidak akan pernah dibaca lagi dan tidak pernah dibuang. Pada sesi panjang (aplikasi kasir/penjual yang jarang restart) ini pertumbuhan memori tanpa batas. `lib/i18n/translate.ts:42,89-99` sudah memecahkan masalah identik dengan FIFO 4000 — cache query tidak.
**Saran:** batasi ukuran (mis. 200 entri) dengan eviksi FIFO/LRU, atau prune berkala.

### C-04 🟠 `useApiQuery` menyajikan data cache 5 detik tanpa indikator bahwa itu cache
**Bukti:** `lib/use-api-query.ts:37` (`QUERY_CACHE_TTL_MS = 5_000`), `:117-124` (bila cache hit: `setData(cached)`, `setLoading(false)`, `setRefreshing(false)`, `setError(null)`, dan `return` — **tanpa** memulai request latar).
**Dampak:** untuk 5 detik setelah penulisan terakhir, layar menampilkan data lama sebagai data segar; tidak ada `refreshing`, tidak ada request latar. Pada layar uang (saldo, daftar transaksi) ini adalah tampilan yang salah tanpa penanda.
**Saran:** pola stale-while-revalidate: tampilkan cache tetapi tetap jalankan `load(true)` di latar.

### C-05 🟡 `totalPages` fallback menebak keberadaan halaman berikutnya dari panjang data
**Bukti:** `lib/api/response.ts:109-112`:
```ts
const totalPages = numberOr(meta?.totalPages ?? meta?.total_pages,
  Number.isFinite(total) ? Math.ceil(total / limit) : page + Number(data.length >= limit))
```
`limit` sendiri jatuh ke `query.limit ?? (data.length || 1)` (`:105`).
**Dampak:** bila backend tidak mengirim meta (spec memang tidak mendokumentasikan bentuk list — lihat komentar `:64-69`), `hasNext` di `lib/use-paginated-query.ts:88` bergantung sepenuhnya pada asumsi "halaman penuh = masih ada". Halaman terakhir yang kebetulan penuh akan menghasilkan satu request kosong tambahan; sebaliknya, bila `limit` yang dikirim lebih besar dari yang dipatuhi server, `data.length >= limit` salah → paginasi **berhenti lebih awal** dan item tak terjangkau.
**Saran:** kirim `limit` eksplisit di setiap adapter paginasi (bukan `undefined`) dan tambahkan heuristik "berhenti setelah halaman kosong" seperti komentar `:107-108`.

### C-06 🟡 `readList` memilih "array pertama yang bukan metadata" — bisa mengambil koleksi yang salah
**Bukti:** `lib/api/response.ts:74-86` + daftar `NON_COLLECTION_KEYS` (`:48-56`).
**Dampak:** respons seperti `{ users: [...], recommendations: [...] }` atau `{ advertisements: [...], orders: [...] }` akan mengambil array menurut urutan kunci objek, bukan menurut domain. `keys` eksplisit menghindarinya, tetapi fallback ini membuat kesalahan bentuk respons berubah menjadi **data yang salah**, bukan error yang terlihat.
**Saran:** bila fallback ini terpakai, catat `logWarn("api:list-fallback", key)` sehingga pemakaian jalur rapuh ini terlihat di telemetri.

### C-07 🟡 `readPage` mengambil `page`/`limit` dari objek root sehingga dapat bertabrakan dengan field domain
**Bukti:** `lib/api/response.ts:103` — `const meta = asRecord(record?.meta) ?? asRecord(record?.pagination) ?? record`.
**Dampak:** untuk endpoint yang mengirim paginasi datar, seluruh root dianggap meta; field domain bernama `page`, `limit`, atau `total` (mis. detail dokumen legal, invoice bernomor "total") akan dibaca sebagai metadata paginasi. Kolom `total` pada baris bisnis cukup umum.
**Saran:** batasi fallback root pada kunci yang dikenal (`total`, `totalPages`, `hasNext`, `hasPrev`) alih-alih menerima seluruh record.

### C-08 🟡 `mergeById` mempertahankan posisi lama, sehingga baris yang naik peringkat tidak berpindah
**Bukti:** `lib/use-paginated-query.ts:6-10`; opsi `compare` (`:31`, `:78-80`) menyediakan jalan keluar tetapi **hanya dipakai bila pemanggil mengisinya**.
**Dampak:** pada daftar terurut waktu (notifikasi, transaksi) yang datanya berubah selama sesi, urutan dapat berbeda dari server tanpa indikasi. Ini sudah didokumentasikan sebagai F-10, tetapi tidak ada satu pun pemanggil `usePaginatedQuery` yang mengirim `compare` — mari verifikasi: `grep -rn "compare:" app components` tidak mengembalikan hasil pada checkout ini.
**Saran:** jadikan `compare` wajib untuk daftar kronologis, atau urutkan ulang berdasarkan tanda waktu bila tersedia.

### C-09 🟡 `usePolling` tidak punya backoff setelah kegagalan berulang
**Bukti:** `lib/use-polling.ts:42-53` — apa pun hasilnya, `finally` memanggil `schedule()` dengan `intervalMs` tetap.
**Dampak:** saat server mengembalikan 5xx/429 berantai (mis. `GET /v1/orders/{id}/payment-status` selama insiden), klien terus menembak pada interval yang sama untuk seluruh sesi pengguna; `retryAfterMs` dari `ApiError` (`lib/api/errors.ts:51-54`) tidak pernah dibaca oleh polling — hanya `useApiQuery` yang menghormatinya (`lib/use-api-query.ts:151`).
**Saran:** simpan `retryAfterMs` pada kegagalan dan pakai sebagai interval minimum berikutnya (dengan batas atas).

### C-10 🔵 `usePaginatedQuery` tidak membatalkan `loadMore` saat layar kehilangan fokus
**Bukti:** `lib/use-paginated-query.ts:57-106` — pembatalan hanya terjadi pada `reset` (`:60`) atau unmount.
**Dampak:** pengguna yang menekan "muat lebih banyak" lalu segera berpindah layar tetap menunggu respons dan tetap memanggil `setData` bila komponen masih ter-mount (tab Expo Router tetap ter-mount). Tidak salah, tetapi membuang kuota dan memicu render di layar yang tidak terlihat.
**Saran:** abort `active.current` saat `!focused`.

### C-11 🔵 Cache tidak di-scope ke `deviceId`, hanya ke `sessionRevision`
**Bukti:** `lib/use-api-query.ts:36-41` (perbandingan `entry.revision !== getSessionRevision()`).
**Dampak:** `revision` naik pada `startSession`/`clearSession` (`lib/api/session.ts:102,140`) sehingga antar-akun aman. Namun logout yang hanya memanggil `clearAccessToken()` (B-01) **tidak** menaikkan revisi → cache akun lama dapat dibaca akun baru pada perangkat yang sama.
**Saran:** perbaiki B-01; revisi sesi harus menjadi satu-satunya jalan logout.

---

# D. Keamanan & penanganan error

### D-01 🟠 `Linking.openURL` tanpa validasi skema di 3 jalur yang datanya berasal dari server/parameter
**Bukti:**
- `app/privacy-settings.tsx:95-98` — `canOpenURL` lalu `openURL(target)`; `target` berasal dari data (`:98`).
- `components/legal-document-screen.tsx:48` — `openURL(target)` dari konfigurasi server (`api.public.getPublicConfig`, `:19`).
- `app/(auth)/whatsapp-trigger.tsx:159` — `openURL(waUrl)`.
  Sementara itu repo sudah membuktikan sadar risiko ini: `lib/version.ts` mengekspor `safeHttpsUrl` dan dipakai di `app/_layout.tsx:318-322` untuk `storeUrl`, serta `lib/media.ts:49` membatasi skema lokal.
**Dampak:** URL `javascript:`, `intent://`, atau skema aplikasi lain dari respons backend akan dijalankan/ diluncurkan tanpa saringan; pada web `Linking.openURL("javascript:…")` adalah jalur eksekusi skrip. Skema aman untuk ketiga jalur ini hanya `https:` (dan `whatsapp:` untuk satu kasus).
**Saran:** wajibkan helper `safeExternalUrl(url, { allow: ["https:"] })` di ketiga tempat; jangan pernah memanggil `openURL` dengan nilai dari server tanpa allowlist.

### D-02 🟠 Tidak ada satu pun sink telemetri yang terpasang — crash reporting tetap kosong
**Bukti:** `lib/telemetry.ts:68-73` (`addTelemetrySink`) dan `:60-62` (`getTelemetryBuffer`); pencarian menunjukkan keduanya **tidak dipanggil dari mana pun**:
```
$ grep -rn "addTelemetrySink\|getTelemetryBuffer" app components lib
lib/telemetry.ts:60:export function getTelemetryBuffer(): readonly TelemetryEvent[] {
lib/telemetry.ts:68:export function addTelemetrySink(sink: TelemetrySink): () => void {
```
`installTelemetry()` dipanggil (`app/_layout.tsx:86-88`) dan `captureError` dipakai untuk font (`:101`), tetapi tidak ada UI debug maupun pengiriman yang membaca buffer.
**Dampak:** audit sebelumnya (D-03/K-07) menyatakan "observability belum dipasang"; sekarang ada abstraksinya tetapi datanya jatuh ke array memori 50 entri yang **tidak pernah dibaca siapa pun**, termasuk oleh layar dukungan. Remote sink hanya aktif bila `EXPO_PUBLIC_TELEMETRY_URL` diisi (`:117-118`) dan variabel itu tidak ada di `.env.example`.
**Saran:** (1) tambahkan `EXPO_PUBLIC_TELEMETRY_URL` ke `.env.example`; (2) ekspos `getTelemetryBuffer()` di layar diagnostik/dukungan; (3) putuskan vendor crash reporting.

### D-03 🟡 29 komponen UI cadangan roadmap tidak pernah dijalankan kode mana pun
**Bukti:** gate `check:screens` (dijalankan di checkout ini) melaporkan **S5 sisa 29**, dan daftar `UNUSED_UI_BASELINE` di `scripts/check-screens.mjs:440-472` memuat tepat 29 berkas:
```
components/ui/{accordion, banner, biometric-prompt-trigger, box, bullet-list, captcha-field,
checkbox-group, count-badge, data-table, dispute-evidence-item, filter-sheet-content,
incoming-call-prompt, kyc-document-viewer, menu-list, order-summary-strip, presence,
result-state, search-overlay, show, signature-pad, slider, surface, swipeable-list-item,
tag-input, tooltip, two-factor-method-selector, typography, wallet-balance-card, z-stack}.tsx
```
**Konteks penting — ini bukan kelalaian, melainkan keputusan produk:** `scripts/check-screens.mjs:421-439` mencatatnya sebagai *"Baseline S5 — KEPUTUSAN PRODUK (amandemen audit 2026-09-06)"*: 38 komponen pernah dihapus lalu **dipulihkan** karena memetakan fitur roadmap (captcha, pemilihan metode 2FA, tanda tangan bukti terima, UI panggilan sengketa). Gate-nya sendiri jujur soal konsekuensinya:
> *"Komponen di baseline ini TIDAK diuji oleh layar mana pun. Saat token, prop, atau aturan design system berubah, TIDAK ADA yang memaksa berkas-berkas ini ikut berubah — mereka pasti menyimpang perlahan."*

**Dampak yang tetap nyata:** berkas-berkas ini dikompilasi terhadap design system yang sudah bergerak, tanpa satu pun pemanggil yang memaksanya ikut berubah. Yang paling sensitif: `kyc-document-viewer.tsx` (dokumen identitas, sementara KYC sudah aktif di `app/kyc.tsx`), `incoming-call-prompt.tsx` (panggilan sengketa), `signature-pad.tsx` (bukti penerimaan), dan `biometric-prompt-trigger.tsx` — yang komentarnya sudah menunjuk `PinDots`, padahal `PinDots` (`components/ui/pin-input.tsx:214`) kini juga tidak pernah dipakai (lihat I-02).
**Saran:** tukarkan per klaster (pakai di layar nyata, lalu hapus dari baseline pada PR yang sama) dan tambahkan test render minimal untuk tiap komponen baseline, agar penyimpangan API terdeteksi meski belum dipakai.

### D-04 🟠 `as any` dipakai 87× dengan konsentrasi di lapisan API yang menyentuh uang
**Bukti:**
```
$ grep -rn "as any" lib components app --include=*.ts --include=*.tsx | wc -l   → 87
lib/api/users.ts        25
lib/api/auth.ts         22
lib/api/bank-accounts.ts 21
lib/api/wallet.ts       19
(semua modul lib/api lain: 0)
```
**Dampak:** `lib/api/bank-accounts.ts:67-73` meng-cast `account as any` untuk tujuh field sekaligus (snake_case fallback) pada **objek rekening bank**; `lib/api/wallet.ts` melakukannya 19× pada aliran dana. Fallback alias memang disengaja, tetapi ditulis sebagai cast sehingga kesalahan penamaan tidak pernah menjadi error tipe. Karena `strict` menyala, cast ini justru satu-satunya lubang tipe di lapisan yang paling perlu aman.
**Saran:** ganti dengan helper bertipe `pickString(record, ["accountNumber","account_number"])` yang sudah ada di `lib/api/response.ts:158-169`, sehingga tidak ada cast tersisa di empat modul itu.

### D-05 🟡 `.catch(() => undefined)` dan `catch {}` menelan kegagalan pada jalur yang menyentuh uang/pengaturan
**Bukti:**
```
components/theme-provider.tsx:94,111     (baca/tulis preferensi tema)
components/ui/pull-to-refresh.tsx:172,545,558
lib/api/session.ts:66,116,117            (antrean tulis sesi)
lib/i18n/store.ts:77,78                  (antrean tulis bahasa)
lib/use-reduced-motion.ts:29
```
**Dampak:** `lib/api/session.ts:116` — `.catch(() => undefined)` pada `setSecureItem(sessionSignedOut)` di dalam jalur **rollback** `startSession`; kegagalan di sana berarti akun baru tidak dapat membedakan dirinya dari akun lama, dan tidak ada jejak sama sekali. `lib/telemetry.ts` sudah ada justru untuk kasus ini.
**Saran:** ganti dengan `.catch((err) => logWarn("scope", err))`; sisakan `.catch(() => undefined)` hanya untuk operasi yang benar-benar kosmetik.

### D-06 🟡 Klaster `catch {}` kosong tanpa penjelasan pada `pull-to-refresh` (881 baris)
**Bukti:** `components/ui/pull-to-refresh.tsx:545` dan `:558` (`.catch(() => undefined)`), `:172` — semuanya di dalam mesin gesture yang menurut header file pernah menyebabkan force-close.
**Dampak:** kegagalan callback refresh dari layar pemanggil hilang tanpa jejak; bila gesture kembali bermasalah, tidak ada data untuk diagnosis.
**Saran:** gunakan `logWarn` dengan scope `pull-to-refresh:callback`, dan pertahankan UI tetap bersih.

### D-07 🟡 `feedbackQueue` menyimpan email/konteks transaksi dan di web sengaja hanya memori — tetapi tidak ada peringatan ke pengguna
**Bukti:** `lib/secure-storage.ts:74-80` (docblock), `WEB_PERSISTENT_KEYS` (`:115-123`) tidak memuat `feedbackQueue`.
**Dampak:** di web, umpan balik yang sedang diantrekan **hilang tanpa pemberitahuan** saat reload. Pengguna yang percaya laporannya terkirim kehilangan laporan tersebut (kegagalan senyap pada alur dukungan). Di native antrean masuk SecureStore, yang OK.
**Saran:** sebelum reload/navigasi, tampilkan indikator "1 laporan menunggu terkirim" dari `usePendingActions`-style store, atau kirim segera saat online.

### D-08 🟡 `X-Device-Info` tetap dikirim ke endpoint publik yang ber-`auth: "optional"` secara default
**Bukti:** `lib/api/client.ts:351` (`auth = "optional"`) + `:390` (`...(auth === "none" ? {} : await deviceHeaders())`).
**Dampak:** perlindungan yang ditulis di komentar `:384-389` (minimalisasi data) hanya berlaku bila adapter mengingat `auth: "none"`. Adapter yang salah default ikut mengirim `X-Device-Id`, `X-Device-Info` (model + OS + versi app), dan `credentials: "include"` (`:407`) ke endpoint publik. `check-api-body.mjs` memverifikasi path/metode, bukan mode auth.
**Saran:** jadikan `auth` **wajib** di `RequestOptions` dan pindahkan keputusan itu ke `check-api` sebagai gate.

### D-09 🟡 `Idempotency-Key` dibuat walau pemanggil sudah menyediakan kuncinya
**Bukti:** `lib/api/client.ts:379` (`const idempotencyKey = method !== "GET" ? createIdempotencyKey() : null`) dijalankan tanpa syarat, dan `:393` hanya *tidak menimpa* header yang sudah ada.
**Dampak:** setiap mutasi memanggil `crypto.randomUUID()` bahkan bila pemanggil mengirim `Idempotency-Key` sendiri (mis. percobaan ulang terkendali). Selain pemborosan, ini membuat sulit menerapkan pola "satu kunci untuk rangkaian percobaan manual" — kemampuan yang dibutuhkan untuk pemulihan aksi menggantung (J-04).
**Saran:** hitung kunci hanya bila header belum ada di `extraHeaders`.

### D-10 🔵 `parseErrorBody` menampilkan pesan backend mentah ke pengguna tanpa penyaringan panjang untuk jalur array
**Bukti:** `lib/api/errors.ts:122-129` memotong string ke 500 karakter untuk body non-objek, tetapi `validationMessages` (`:137-139`) tidak dipotong dan `message` untuk array mengambil elemen pertama apa adanya (`:140-141`).
**Dampak:** pesan class-validator sangat panjang (mis. nested constraint) dapat langsung tampil pada toast/`ErrorState`. Tidak berbahaya, tetapi bisa memuat detail internal validasi.
**Saran:** potong juga `validationMessages` (mis. 300 karakter) sebelum ditampilkan.

### D-11 🔵 `ApiError.raw` menyimpan body respons mentah dan ikut dikirim oleh `JSON.stringify` bila error di-log
**Bukti:** `lib/api/errors.ts:45,61` (`readonly raw: unknown` + komentar "JANGAN tampilkan ke user"), pengisian di `lib/api/client.ts:185` (body gagal di-parse) dan `:200` (`raw` hasil `parseBody` di `toApiError`).
**Dampak:** `lib/telemetry.ts:84-91` sengaja **tidak** menyentuh `raw` (baik), tetapi siapa pun yang menambahkan `logWarn(scope, err)` atau `JSON.stringify(err)` akan mengirim body mentah — yang pada endpoint order/auth dapat berisi data akun.
**Saran:** jadikan `raw` `#private`/getter non-enumerable, atau tandai sebagai `Symbol` sehingga tidak ikut serialisasi.

### D-12 🔵 `check-a11y.mjs` memindai `.tsx` saja — berkas `.ts` komponen tidak terjangkau
**Bukti:** `scripts/check-a11y.mjs:59-67` (`else if (p.endsWith(".tsx")) out.push(p)`) sehingga setiap modul `.ts` di `components/` dan `app/` tidak diperiksa, meski `app/+html.tsx`-sejenis dan hook yang mengembalikan JSX ada.
**Dampak:** gate aksesibilitas memiliki batas cakupan yang tidak dicetak pada ringkasannya (ringkasan hanya menyebut "345 file .tsx dipindai").
**Saran:** pindai `.ts` yang mengandung JSX, atau cetak jumlah berkas yang dilewati agar cakupannya terlihat.

---

# E. Waktu, countdown & timezone

### E-01 🔴🔬 Countdown cooldown OTP membandingkan timestamp `Date.now()` dengan `serverNow()` — cooldown kolaps ke nol
**Bukti:** `app/withdraw.tsx:200` dan `:283` menetapkan `otpCooldownUntil` dengan **jam perangkat**:
```ts
setOtpCooldownUntil(Date.now() + DEFAULT_OTP_COOLDOWN_S * 1000)
```
`components/ui/countdown.tsx:90` menghitung sisa dengan **jam server**:
```ts
const ms = endAt - serverNow()   // serverNow() = Date.now() + offset
```
`lib/server-time.ts:9-12,58-60` menyatakan kontraknya: *"`serverNow()` dipakai komponen waktu (Countdown, deadline)"*.
**Reproduksi (dijalankan, offset server +300 s):**
```
REMAINING (harus 60) DENGAN OFFSET +300s: 0
```
**Dampak:** perangkat yang jamnya lebih lambat ~1 menit dari server (kasus umum: zona waktu salah, jam tidak pernah dikoreksi) menghitung `60 − offset ≤ 0` → `cooldownActive = false` (`app/withdraw.tsx:135`) → tombol **"Kirim ulang OTP"** langsung aktif, dan penjaga rate-limit di `handleResend` (`:278`) ikut lolos. Ini membatalkan perbaikan A-07 pada audit sebelumnya (spam SMS berbiaya + memperpanjang throttle server). Kebalikannya (jam perangkat maju) membuat tombol terkunci jauh lebih lama dari 60 detik — pengguna yang salah OTP terjebak tanpa bisa meminta kode baru.
**Saran:** buat timestamp cooldown di domain server: `setOtpCooldownUntil(serverNow() + cooldownS * 1000)`. Audit semua `Date.now()` yang hasilnya masuk ke `until=` — saat ini hanya dua lokasi ini.

### E-02 🟠 `restart()` pada `useCountdown` adalah no-op untuk sumber waktu absolut (dead API)
**Bukti:** `components/ui/countdown.tsx:107-110` — `setEndAt(computeEnd())`. Bila `until` tetap (`until` paling umum dipakai: `app/withdraw.tsx:579`, `components/ui/order-card.tsx:244`, `components/ui/topup-status-card.tsx:285`, `components/ui/mutual-resolution-card.tsx:282`), `computeEnd()` mengembalikan angka yang **sama**, `setEndAt` dengan nilai identik di-bail-out React, sehingga efek `[endAt]` (`:86-105`) tidak dijalankan ulang. Setelah `tick()` mencapai `s <= 0`, timer sudah `return` tanpa menjadwalkan ulang (`:98`).
**Dampak:** memanggil `restart()` setelah countdown selesai tidak melakukan apa pun. Fungsi ini diekspor dan tampak sebagai API publik yang berfungsi. Saat ini tidak ada pemanggil (`grep -rn "\.restart()" app components lib` kosong) sehingga cacat ini laten — tetapi akan langsung menggigit pemakai pertama (mis. "kirim ulang OTP" yang ingin memulai ulang hitungan).
**Saran:** tambahkan `setEndAt(null)` di antara (`setEndAt(null); setEndAt(computeEnd())`) atau gunakan `useState(() => ({...}))`/`key` untuk memaksa remount; atau hapus `restart` dari API publik.

### E-03 🟠 `snoozeRatingReminder` memakai jam perangkat untuk data yang umurnya lintas sesi
**Bukti:** `lib/ui-prefs.ts:168-173` (`untilMs` dari `app/order/[id].tsx:469` = `Date.now() + RATING_SNOOZE_MS`), penyaringan saat muat di `:77` (`value > Date.now()`).
**Dampak:** perangkat dengan jam mundur 1 hari memperpanjang snooze 3 hari menjadi 4; jam maju memangkasnya. Untuk penunda pengingat dampaknya kecil, tetapi ini domain waktu ketiga yang independen di repo (`Date.now()` mentah, `serverNow()`, dan timestamp server dari respons) tanpa satu konvensi pun.
**Saran:** dokumenkan domain waktu per modul di `docs/` dan tambahkan lint/gate yang menolak `Date.now()` di modul yang menyimpan timestamp lintas sesi.

### E-04 🟡 Semua tenggat dari server dirender/dibandingkan tanpa normalisasi zona
**Bukti:** `lib/format.ts:384-403` (`formatDateTimeWIB`) sadar masalah ini dan memakai `Intl` + `Asia/Jakarta`, tetapi `formatDateTime` polos (`:370-372`) masih dipakai untuk tenggat di banyak layar, mis. `app/order/[id].tsx:72` mengimpor keduanya dan `:823` (QR "Berlaku sampai …") memakai `formatDateTime`.
**Dampak:** perbedaan "batas waktu" pada sengketa/QRIS/penawaran dibaca relatif terhadap zona perangkat, sedangkan backend beroperasi WIB — sumber perselisihan "saya masih dalam tenggat".
**Saran:** gunakan `formatDateTimeWIB` untuk **semua** tenggat yang mengikat secara hukum, dan sisakan `formatDateTime` untuk cap waktu aktivitas.

### E-05 🟡 `formatDateTimeWIB` bergantung pada `Intl` dan gagal senyap ke format tanpa label
**Bukti:** `lib/format.ts:387-402` — `try { new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta" }) } catch { return formatDateTime(date) }`. Komentar `:380-382` mengakui ini.
**Dampak:** pada build Hermes tanpa full-ICU, tenggat yang seharusnya bertanda "WIB" kembali menjadi waktu lokal tanpa penanda — perbedaan yang justru ingin dihilangkan modul ini, dan tidak ada telemetri yang menandai fallback itu terjadi.
**Saran:** deteksi sekali saat boot dan `logWarn("format:wib-fallback")` bila ICU tidak tersedia agar kejadiannya terlihat.

### E-06 🟡 `formatDate`/`formatTime` memakai zona perangkat tanpa opsi
**Bukti:** `lib/format.ts:355-367` (`getHours`, `getDate`).
**Dampak:** tidak ada satu pun jalur untuk menampilkan tanggal/waktu dalam zona tertentu selain lewat `formatDateTimeWIB` yang formatnya sudah baku (`"3 Sep 2026, 14:30 WIB"`). Layar yang ingin "3 Sep 2026" dengan zona Jakarta tidak punya API.
**Saran:** tambahkan opsi `timeZone` pada `displayDate`/`formatDate`.

### E-07 🔵 `recordServerDate` memperbarui offset hanya bila delta ≥ 1,5 detik — koreksi besar tidak pernah terdeteksi bila berulang kecil
**Bukti:** `lib/server-time.ts:44-47`:
```ts
if (recordedAt !== 0 && Math.abs(nextOffset - offsetMs) < MIN_UPDATE_DELTA_MS) {
  recordedAt = Date.now(); return
}
```
**Dampak:** untuk perangkat yang jamnya bergeser perlahan (NTP bertahap, 1 detik per menit), setiap sampel delta < 1,5 s sehingga `offsetMs` **tidak pernah** diperbarui, dan offset menyimpan nilai pertama. Efeknya kecil untuk countdown menit, tetapi `getTimeOffsetMs()` dapat memuat galat tetap selama sesi.
**Saran:** tambahkan pembaruan paksa bila selisih akumulatif melewati ambang, atau ratakan (rata-rata bergerak).

### E-08 🔵 Tidak ada penanganan kasus jam perangkat berubah **selama** aplikasi berjalan
**Bukti:** offset hanya direkam saat respons API datang (`lib/api/client.ts:235`) dan tidak ada listener perubahan jam/zona (`AppState` hanya dipakai di `app/_layout.tsx:310` dan `components/app-lock-gate.tsx:71` untuk keperluan lain).
**Dampak:** pengguna yang memperbaiki jam perangkat saat aplikasi terbuka melihat countdown melompat tanpa penjelasan sampai respons API berikutnya tiba.
**Saran:** rekam ulang offset dari header `Date` respons berikutnya (sudah terjadi) dan tambahkan interval pengaman `serverNow()` berbasis pengukuran terakhir.

---

# F. Aksesibilitas

### F-01 🟠 `accessible` pada kontainer keypad nominal menelan 12 tombol digit dari pembaca layar
**Bukti:** `components/ui/amount-keypad.tsx:405-410`:
```tsx
<View
  accessible
  accessibilityLabel="Keypad nominal"
  className={cn("w-full items-center px-2", …)}
```
Anak-anaknya adalah 12 `<Key>` yang masing-masing merender `<PressableScale accessibilityRole="button" accessibilityLabel={label}>` (`:259-262`). Pada RN, `accessible` pada sebuah View menjadikan seluruh subtree **satu** elemen aksesibilitas sehingga anak-anaknya berhenti menjadi target fokus.
**Kontradiksi internal repo:** `scripts/check-a11y.mjs:202` mendaftarkan `pin-pad.tsx` ke `CONTAINER_LABEL_ALLOWLIST` dengan alasan persis ini:
> *"Keypad berisi 12 `<Key>` (PressableScale role=keyboardkey). Label \"Keypad PIN\" adalah penanda area; `accessible` akan menyembunyikan seluruh tombol dari screen reader."*

`amount-keypad.tsx` **tidak** ada di allowlist itu dan tetap memakai `accessible`.
**Mengapa lolos gate:** pemeriksa audit #4 (`scripts/check-a11y.mjs:215-235`) melewati setiap `<View accessibilityLabel>` yang **sudah** punya `accessible` (`:222`), dan keputusan "kontainer atau daun" untuk kasus lain diambil dari `CONTAINER_LABEL_ALLOWLIST` yang ditulis manusia (`:198-210`) — `amount-keypad.tsx` tidak ada di sana. `<Key>` adalah komponen lokal sehingga tidak ada aturan berbasis nama tag yang dapat mengenalinya sebagai kontrol. Allowlist hanya diperiksa terhadap **kebasian** (`:237-239`), bukan terhadap berkas yang seharusnya masuk.
**Bukti tambahan:** `check-a11y` mengizinkan `pin-pad.tsx` berlabel kontainer **justru karena tidak memakai `accessible`**; `amount-keypad.tsx` melakukan kebalikannya. Jadi bukan sekadar inkonsistensi gaya — ini menetralkan satu-satunya jalan masuk nominal pada layar uang.
**Dampak:** pengguna TalkBack/VoiceOver **tidak dapat memasukkan nominal** pada layar transfer, tarik dana, top-up, dan langganan — alur uang utama tidak dapat diselesaikan tanpa bantuan orang lain.
**Saran:** hapus `accessible` dari kontainer (labelkan area lewat `<Text>` sebelum keypad), dan tambahkan `Key`/`Dot` sebagai nama komponen yang dikenali aturan B agar cakupannya tidak bergantung allowlist manual.

### F-02 🟠 Blind spot aturan B: komponen pembungkus lokal tidak dikenali pemeriksa aksesibilitas
**Bukti:** `scripts/check-a11y.mjs:161-181` (`INTERACTIVE` = daftar nama tetap) dan `:224-230` (alasan allowlist manual: *"Anak fokusabel tidak selalu terdeteksi dari nama tag (banyak yang dibungkus komponen lokal seperti `<Key>`/`<Dot>`), jadi keputusan … diambil dari allowlist yang ditulis manusia"*).
**Dampak:** setiap komponen baru yang membungkus `PressableScale` (pola yang dipakai puluhan tempat) secara otomatis tidak terlihat oleh gate; F-01 adalah bukti nyata pertama.
**Saran:** deteksi interaktif secara transitif (komponen lokal yang merender `Pressable*`/`Button`), atau ubah allowlist menjadi opt-out eksplisit per berkas dengan komentar alasan.

### F-03 🟡 `<OtpInput>` memasang `accessibilityRole="none"` pada pembungkus yang justru target ketuk
**Bukti:** `components/ui/otp-input.tsx:176-182` — `<Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="none" accessibilityLabel={…}>`.
**Dampak:** elemen yang bisa ditekan dideklarasikan "none" sehingga pembaca layar tidak mengumumkannya sebagai kontrol; label yang dipasang (`:180`) juga diduplikasi pada `TextInput` (`:215`) yang secara visual tersembunyi (`opacity-0`, `h-1 w-1`), sehingga dapat diumumkan dua kali.
**Saran:** `accessibilityRole="button"` pada pembungkus, lalu `importantForAccessibility="no-hide-descendants"`/`accessible={false}` pada input tersembunyi di Android.

### F-04 🟡 Tidak ada label aksesibilitas pada baris nominal `AmountKeypad` itu sendiri
**Bukti:** `components/ui/amount-keypad.tsx:326-356` — `Animated.View` dengan `Text` "Rp" dan `displayed`, tanpa `accessibilityLabel` gabungan. Yang diumumkan adalah dua `<Text>` terpisah ("Rp", "1.000.000").
**Dampak:** pembaca layar membacakan "Rp" lalu angka sebagai dua entri; pengguna tidak mendengar "nominal saat ini Rp1.000.000".
**Saran:** bungkus dengan `<View accessible accessibilityLabel={`Nominal ${formatRupiah(value)}`}>` — di area yang **tidak** berisi kontrol (berbeda dari F-01).

### F-05 🟡 `Countdown` mengumumkan ulang setiap detik dan tidak punya mode senyap
**Bukti:** `components/ui/countdown.tsx:156-160` (`accessible`, `accessibilityRole="timer"`, `accessibilityLiveRegion="polite"`), dengan `remaining` di-`setState` setiap detik (`:89-101`).
**Dampak:** pada `app/withdraw.tsx:579` ("Kirim ulang dalam 00:59") pembaca layar mengantre pengumuman setiap detik dan menutupi konten lain. Standar yang umum adalah mengumumkan tiap 10–30 detik atau hanya pada ambang penting.
**Saran:** tambahkan prop `announceEveryMs` (default mis. 10_000) dan pakai `accessibilityLiveRegion="off"` di antaranya.

### F-06 🟡 Tidak ada `accessibilityRole="alert"` pada pesan error form
**Bukti:** `components/ui/field.tsx:85` (debounce announce 300 ms sudah ada) tetapi galat yang dirender lewat `errorText` pada `Input`/`Field` tidak selalu memakai live region; mis. `app/bank-accounts.tsx:271-280` tidak memasang `errorText` sama sekali.
**Dampak:** pengguna pembaca layar mengirim form tanpa pernah diberi tahu mengapa gagal; pada alur uang hal ini berujung pada pengiriman berulang.
**Saran:** bakukan klaster error ke satu live region tingkat form dan pastikan setiap `Field` wajib punya `errorText`.

### F-07 🟡 Hit area tombol kunci keypad di mode padat tidak diverifikasi terhadap 44pt
**Bukti:** `components/ui/amount-keypad.tsx:96` (`COMPACT_BELOW_HEIGHT = 760`) dan `:271` (`compact ? "h-14 w-14" : "h-16 w-16"` = 56/64 px). `lib/hit-slop.ts` menyediakan `hitSlopToReach` tetapi tidak dipakai di sini, dan `check-a11y` aturan G hanya menolak `hitSlop` literal — tidak memverifikasi ukuran efektif.
**Dampak:** tombol 56 px tanpa hit slop pada layar kecil; jarak antar-kolom mengandalkan `justify-around` (`:412`) sehingga lebar area tekan efektif bergantung lebar layar, bukan angka tetap. Pada layar 320 px, celah antar tombol menyusut di bawah 8 px.
**Saran:** pasang `hitSlopToReach("44")` pada setiap `Key` dan tambahkan `maxWidth`/`minWidth` eksplisit.

### F-08 🟡 `CheckboxGroup`, `Radio`, dan `SegmentedControl` tidak membentuk grup ber-label
**Bukti:** `components/ui/checkbox-group.tsx` tidak dipakai sama sekali (F-03/D-03), `components/ui/radio.tsx` diekspor tanpa `accessibilityRole="radiogroup"` pada pembungkusnya, `components/ui/segmented-control.tsx` dipakai di `app/order/[id].tsx:98` untuk memilih metode bayar.
**Dampak:** pilihan metode pembayaran (Saldo Kahade / QRIS) tidak diumumkan sebagai satu grup berlabel, sehingga pengguna tidak tahu berapa opsi yang tersedia maupun mana yang terpilih kecuali menelusuri satu-satu. **(perlu verifikasi runtime)** — saya memverifikasi pemakaian komponennya, bukan keluaran TalkBack-nya.
**Saran:** bungkus dalam `accessibilityRole="radiogroup"` + `accessibilityLabel` dan pastikan tiap opsi memakai `accessibilityState={{ checked }}`.

### F-09 🔵 `accessibilityLabel` pada `<View>` tanpa `accessible` masih ada di beberapa tempat
**Bukti:** perintah pemeriksaan mencari pola ini (`scripts/check-a11y.mjs:213-235`) melaporkan OK, tetapi `components/ui/amount.tsx`, `components/ui/amount-input.tsx` dan layar-layar lain memasang label pada komponen kustom yang **meneruskan** label — aman. Namun `app/saved.tsx:79` menyusun label deskriptif dari template string yang tidak diterjemahkan (lihat G-02).
**Dampak:** kelas cacat "label ditulis tapi tidak berefek" sudah ditutup gate untuk `<View>`, tetapi belum untuk string label yang dibangun dinamis.
**Saran:** perluas pemeriksa ke `accessibilityLabel={`…`}` berisi template dan wajibkan `t()`/`translateProp` (lihat G-02).

### F-10 🔵 Tidak ada uji aksesibilitas otomatis (axe/jest-axe) di atas snapshot DOM
**Bukti:** `npm run check:a11y` adalah pemeriksa regex/AST kustom; `tests/` tidak memuat satu pun pengujian aksesibilitas berbasis render (`grep -rln "axe\|toBeAccessible" tests` kosong).
**Dampak:** semua temuan F di atas lolos gate karena gate-nya berbasis pola teks, bukan pohon aksesibilitas hasil render.
**Saran:** tambahkan `jest-axe`/`vitest-axe` untuk 10 layar terpenting dan jalankan di `vitest.components.config.ts`.

---

# G. i18n & lokalisasi

### G-01 🟠 String yang dibangun dinamis tidak pernah masuk katalog terjemahan
**Bukti:** `lib/i18n/translate.ts:127-138` (`localizeChildren`) hanya menerjemahkan `children` bertipe string murni atau array string. Komentar `:121-125` mengakui: *"Children campuran (`Halo {name}`) sengaja TIDAK digabung lalu diterjemahkan … Teks bercampur seperti itu tetap Indonesia sampai penulis layar memakainya lewat `t(\"… {name}\", { name })`."*
Contoh nyata: `app/withdraw.tsx:565` (`… untuk menarik ${formatRupiah(amount)} ke ${selected?.bankName ?? "rekening Anda"} …`), `app/transfer.tsx:576`, `app/_layout.tsx:430` (dialog force-update: `…${forceUpdate?.message ? `\n\n${forceUpdate.message}` : ""}`), `app/saved.tsx:79` (`${n} transaksi · ${rating}`), `app/withdraw.tsx:618`.
**Dampak:** pengguna mode English melihat kalimat campuran ID/EN pada momen paling penting (konfirmasi penarikan, transfer berhasil, dialog update wajib). `check:i18n` melaporkan 100% karena hanya memindai literal, bukan template.
**Saran:** ubah klaster tersebut menjadi `t("… {amount} ke {bank} …", { amount, bank })` dan perluas `gen-i18n-catalog.mjs` agar template literal ber-`${}` ikut menjadi kandidat kunci.

### G-02 🟠 String yang dibangun di dalam template literal untuk label aksesibilitas tidak diterjemahkan
**Bukti:** `components/ui/countdown.tsx:146` (`[prefix, formatted, suffix].filter(Boolean).join(" ")`) — `prefix`/`suffix` datang dari pemanggil sebagai string mentah (`app/withdraw.tsx:579` — `prefix="Kirim ulang dalam"`) dan digabung di luar jalur `<Text>`; juga `components/ui/key-value.tsx:81`, `components/ui/order-summary-strip.tsx:110`, `components/ui/mutual-resolution-card.tsx:260`.
**Dampak:** pengguna EN mendengar label aksesibilitas berbahasa Indonesia; `components/ui/pressable-scale.tsx:104-109` sudah memperbaiki kelas ini untuk `PressableScale` (memakai `translateProp`) tetapi tidak untuk penggabungan string.
**Saran:** wajibkan `translateProp()` pada setiap `accessibilityLabel` hasil gabungan, dan tambahkan aturan pemeriksa.

### G-03 🟡 Kunci terjemahan = teks sumber; mengubah copy mematikan terjemahan secara senyap
**Bukti:** `lib/i18n/translate.ts:4-15` (desain), penegakan lewat `npm run gen:i18n -- --check`.
**Dampak:** `check:i18n` **hanya gagal bila katalog tidak sinkron dengan kode**, bukan bila terjemahan hilang untuk kunci baru — katalog di-generate ulang sehingga kunci baru selalu "100% translated" hanya karena `translate()` jatuh ke teks sumber. Bukti: `lib/i18n/coverage.json` berisi `{"translated":1667,"total":1667,"percent":100}` — tidak ada mekanisme yang membuktikan 1667 entri itu **memang** ada terjemahannya, kecuali `hasTranslation()` yang tidak dipanggil dari mana pun:
```
$ grep -rn "hasTranslation" app components lib
lib/i18n/translate.ts:142:export function hasTranslation(source: string, lang = getLanguage()): boolean {
```
**Saran:** panggil `hasTranslation` di `check-i18n.mjs` untuk setiap kunci katalog dan gagalkan bila ada yang jatuh ke sumber; itulah arti "100%" yang sesungguhnya.

### G-04 🟡 28 katalog "identik" diterima begitu saja sebagai kognat
**Bukti:** keluaran gate: `Katalog 1684 string · terjemah 1684 (100.0%) · belum 0 · identik 28 (kognat/merek, bukan bug)`.
**Dampak:** klaim "bukan bug" tidak diverifikasi otomatis; sebagian dari 28 entri itu bisa berupa string yang seharusnya diterjemahkan (mis. "Buka", "Tutup" yang kebetulan sama, atau singkatan). Tidak ada daftar putih eksplisit.
**Saran:** ganti heuristik "identik = kognat" dengan allowlist eksplisit berisi 28 kunci itu beserta alasannya.

### G-05 🟡 `formatDurationHours` mengembalikan kalimat Indonesia dari lapisan format
**Bukti:** `lib/format.ts:331-335`:
```ts
if (hours >= 24) return `Biasanya sekitar ${formatDecimal(hours / 24)} hari`
return `Biasanya sekitar ${formatDecimal(hours, 0)} jam`
```
**Dampak:** modul format (yang seharusnya bebas bahasa; bagian lain memakai tabel `MONTHS_EN`/`DAYS_EN` justru untuk menghindari ini) mengembalikan kalimat utuh. Karena hasilnya di-render lewat `<Text>`, `localizeChildren` hanya bisa mencocokkannya bila angkanya **tepat** sama dengan kunci katalog — untuk angka arbitrer selalu gagal. Pemakai: `app/order/[id].tsx:454`.
**Saran:** pisahkan menjadi `t("Biasanya sekitar {n} hari", { n })`.

### G-06 🟡 `formatCountdown` mengembalikan `"—"` sehingga countdown yang gagal-parse tampil sebagai em-dash tanpa konteks
**Bukti:** `lib/format.ts:413-420` + `components/ui/countdown.tsx:118`.
**Dampak:** pengguna melihat "Kirim ulang dalam —" tanpa tahu apakah itu error atau memang belum ada tenggat. Teks alternatifnya sudah disiapkan konsumen (`helperText`) tetapi tidak dipakai untuk kasus ini.
**Saran:** berikan prop `invalidLabel` sehingga layar dapat menulis "belum tersedia" dan bukan dash.

### G-07 🔵 Nama bulan/hari dipilih lewat `getLanguage()` di dalam fungsi murni — tidak reaktif
**Bukti:** `lib/format.ts:96-108` membaca `getLanguage()` pada saat pemanggilan. Komponen yang memformat tanggal tetapi tidak memanggil `useLanguage()`/`<Text>` tidak akan re-render saat bahasa berganti.
**Dampak:** beberapa baris (mis. label grafik `components/ui/bar-chart.tsx` yang menyusun nilai non-`Text`) dapat tertinggal berbahasa lama hingga render berikutnya.
**Saran:** dokumentasikan kewajiban `useLanguage()` pada pemakai formatter, atau pindahkan pemilihan nama ke lapisan komponen.

### G-08 🟡 `formatDateTimeWIB` memaksa format `"id-ID"` walau bahasa aktif English
**Bukti:** `lib/format.ts:388` — `new Intl.DateTimeFormat("id-ID", …)` tanpa memeriksa `getLanguage()`, lalu `:399` menempelkan literal `" WIB"`.
**Dampak:** pengguna EN mendapat "3 Sep 2026, 14:30 WIB" dari locale `id-ID` (bukan "Sep" versi EN melalui tabel `MONTHS_EN`, yang justru dipakai `formatDate`). Dua format tanggal berbeda dalam satu layar.
**Saran:** pilih locale dari `getLanguage()` dan sediakan label "WIB"/"UTC+7" yang diterjemahkan.

### G-09 🔵 `translate()` meng-cache hasil tetapi tidak pernah dibersihkan saat kamus berubah
**Bukti:** `lib/i18n/translate.ts:42-48` (`CACHE_MAX`, `clearTranslationCache`), kunci cache = `${lang}\u0001${source}` (`:83`), sehingga pergantian bahasa menghasilkan kunci berbeda — aman untuk kasus normal. Namun kamus adalah modul statis (`DICTS`, `:38`) sehingga tidak ada jalur di mana kamus berubah saat runtime.
**Dampak:** `clearTranslationCache()` diekspor sebagai "uji manual/tes" tetapi tidak dipakai tes mana pun khusus untuk itu; API publik tanpa pemakai.
**Saran:** hapus atau pakai di tes yang menukar kamus.

---

# H. Komponen UI — perilaku & kontrak

### H-01 🔴 `Snackbar/Toast` mengantre tanpa batas; toast yang terlambat tampil sudah tidak relevan
**Bukti:** `components/ui/toast.tsx:88-92` (`show` hanya menambah ke array) dan `:96-97` (`slice(0, MAX_VISIBLE)` = 2 per posisi). `ToastItem` (dan timer `duration` di `:243`) hanya hidup saat benar-benar dirender.
**Dampak:** kegagalan berantai — mis. `runAction` di `app/order/[id].tsx:288-311` yang gagal pada jaringan — menghasilkan beberapa toast; yang ke-3 dan seterusnya baru muncul setelah yang sebelumnya selesai, hingga belasan detik setelah kejadian, sudah tidak dapat dikaitkan pengguna dengan aksinya. Kasus terburuknya laten: `duration: 0` berarti "persist sampai ditutup manual" (`components/ui/toast.tsx:54`), dan bila suatu saat ada dua toast seperti itu di depan, antrean **tidak pernah** terkuras (saat ini belum ada pemanggil yang memakainya — `grep -rn "duration: 0" app components` kosong).
**Saran:** batasi panjang antrean (mis. 5) dan buang yang tertua; koalesensikan toast identik (judul+tone sama) dalam jendela pendek.

### H-02 🟠 `AmountKeypad` dapat mengirim nilai non-`Number.isSafeInteger` ke state form (lihat A-06)
**Bukti:** jalur `pressDoubleZero` di `components/ui/amount-keypad.tsx:187-203` hanya memeriksa `Number.isFinite`.
**Dampak:** `Number.isFinite(1e21)` benar, dan `parseInt("999999999999999999")` mengembalikan nilai non-aman secara presisi. State form menyimpan angka yang salah sebelum `lib/financial.ts:13-15` menolaknya pada submit — untuk sesaat UI menampilkan nominal yang berbeda dari yang diketik.
**Saran:** gunakan `Number.isSafeInteger` di seluruh jalur keypad, bukan hanya di lapisan DTO.

### H-03 🟠 `PressableScale` meneruskan `onPressIn/onPressOut` komponen ke `GesturePressable` tanpa menjamin urutan dengan timer internal
**Bukti:** `components/ui/pressable-scale.tsx:171-188` memanggil `onPressIn?.(e)` **setelah** animasi/haptic, sementara `components/ui/amount-keypad.tsx:216-228` bergantung pada `onPressIn` tepat waktu untuk memulai timer 650 ms.
**Dampak:** pada perangkat lambat, `onPressIn` tertunda oleh `animateTo` + `fireHaptic` (sinkron) sehingga ambang 650 ms bergeser; digabung A-07 (dua mekanisme long-press), perilaku "hapus semua" menjadi tidak deterministik.
**Saran:** panggil callback pemanggil lebih dulu, atau pindahkan gestur long-press ke `Pressable` bawaan (`delayLongPress`) sebagai satu-satunya sumber.

### H-04 🟠 `PullToRefresh` (881 baris) menyembunyikan mesin gestur PanResponder khusus di dalam komponen monolitik
**Bukti:** `components/ui/pull-to-refresh.tsx` 881 baris, memuat `lib/pull-math.ts` (aritmetika murni, sudah terpisah), `:172/:545/:558` `.catch(() => undefined)`, `:535` timer terkontrol. `check:screens` S9 membatasi 5 berkas "god component" — berkas ini ada di urutan ke-11 daftar terpanjang sehingga **tidak** tercakup plafon.
**Dampak:** berkas dengan risiko force-close tertinggi (pernyataan header) tidak masuk pagar S9, sehingga dapat terus tumbuh.
**Saran:** turunkan plafon S9 menjadi ukuran absolut (mis. 700 baris) atau tambahkan berkas ini ke daftar yang dipantau.

### H-05 🟡 `BottomSheet` memaksa `pb-4`/`px-5` dan pemanggil harus melakukan override via `cn`
**Bukti:** keluaran `npm run audit:classes`:
```
components/ui/showcase-comments-sheet.tsx:103  <BottomSheet contentClassName="px-0 pb-0">
    default components/ui/bottom-sheet.tsx:336 → "px-5" vs kiriman "px-0"
    default components/ui/bottom-sheet.tsx:336 → "pb-4" vs kiriman "pb-0"
components/ui/showcase-header.tsx:239  <Input className="rounded-full border-0 bg-surface px-4">
    default components/ui/input.tsx:217 → "rounded-sm" vs kiriman "rounded-full"
    default components/ui/input.tsx:217 → "border-error" vs kiriman "border-0"
    default components/ui/input.tsx:217 → "px-[15px]" vs kiriman "px-4"
```
**Dampak:** kontrak kelas default vs override hanya dijaga `tailwind-merge`; setiap perubahan default berpotensi diam-diam mengubah tampilan pemanggil yang meng-override (`resolved-by-cn` berarti tidak ada error, hanya efek diam). Ini utang desain, bukan bug hari ini.
**Saran:** jadikan padding/radius sebagai prop eksplisit (`padding="none"`, `radius="pill"`) untuk kasus yang memang sah, alih-alih mengandalkan override string.

### H-06 🟡 `Input` menyertakan `border-error` pada default sehingga `border-0` pemanggil harus menang lewat urutan
**Bukti:** `audit:classes` di atas — `components/ui/input.tsx:217` default memuat `border-error` (state), sedangkan pemanggil `components/ui/showcase-header.tsx:239` mengirim `border-0`.
**Dampak:** bilamana `tailwind-merge` tidak mengenali varian konflik ini (mis. `border-0` vs `border-error` dianggap properti berbeda), input header showcase bisa menampilkan garis error permanen. **(perlu verifikasi visual)**
**Saran:** pisahkan warna border error ke kelas bersyarat (`errorText && "border-error"`), bukan kelas default.

### H-07 🟡 `Field` melakukan debounce pengumuman 300 ms tetapi tidak membatalkan saat unmount
**Bukti:** `components/ui/field.tsx:85` (komentar "debounce announce 300 ms").
**Dampak:** **perlu verifikasi runtime** — pola debounce umumnya aman bila memakai `useEffect` dengan cleanup, tetapi berkas ini tidak menampilkan pemeriksaan `alive`. Saya memverifikasi keberadaan mekanisme, bukan kebocorannya.
**Saran:** pastikan cleanup `clearTimeout` ada, dan tambahkan test seperti `tests/hooks.test.tsx`.

### H-08 🟡 `Button` tidak membatasi `loading` + `disabled` secara konsisten
**Bukti:** pemakaian yang berbeda antar layar — `app/business-verification.tsx:338` (`loading={submitting} disabled={!formValid}`), `app/change-email.tsx:92` (`loading={submitting} disabled={!canSubmit}`), tetapi `app/(auth)/verify-2fa.tsx:225` hanya `disabled={!canSubmit || tokenExpired}`, dan `app/withdraw.tsx:581-589` (`loading={resending}` + `disabled={submitting}`) tidak men-disable saat `resending` itu sendiri.
**Dampak:** pada `app/withdraw.tsx:581`, pengguna dapat menekan "Kirim ulang OTP" berkali-kali selama request berjalan (penjaga di `handleResend` `:278` menangkapnya, tetapi tombolnya tidak menunjukkan bahwa ia sedang bekerja → umpan balik UI hilang).
**Saran:** jadikan `loading` otomatis berarti `disabled` di dalam `<Button>`.

### H-09 🟡 `useResultTimer` membatalkan timer sebelumnya, sehingga dua hasil berurutan saling menimpa
**Bukti:** `lib/use-result-timer.ts:31-37` — `if (timer.current) clearTimeout(timer.current)`.
**Dampak:** pada jalur `handlePin` (`app/transfer.tsx:256` dan `:273`) hanya satu timer hidup pada satu waktu, dan memang benar untuk alur itu. Namun di `app/order/[id].tsx` ada dua sumber `scheduleResult` (pembayaran `:326` dan `:335`) yang dapat tiba berbarengan (poll + aksi) sehingga salah satu hasil hilang.
**Saran:** beri nama/prioritas pada `scheduleResult`, atau pisahkan timer per alur.

### H-10 🟡 `Screen` dan `Header` tidak menyediakan jalur "kembali" berbasis `canGoBack` secara seragam
**Bukti:** `app/transfer.tsx:221-232` menulis logika `router.canGoBack()` manual, `app/change-pin.tsx:24` memakai `goBackOrNavigate`, layar lain tidak menangani sama sekali sehingga tombol kembali pada deep link (tanpa tumpukan) tidak melakukan apa pun.
**Dampak:** deep link ke layar dalam (mis. `/order/x` dari notifikasi) lalu menekan back dapat meninggalkan pengguna di layar buntu.
**Saran:** pusatkan perilaku pada `<Header onBack>` default: `router.canGoBack() ? back() : replace(ROUTES.home)`.

### H-11 🟡 `Avatar` memakai `key={i}` pada fallback inisial
**Bukti:** `components/ui/avatar.tsx:182`.
**Dampak:** inisial adalah konten tunggal; kunci indeks tidak berbahaya di sini. Namun pemeriksa pola `key={index}` di repo menemukan 6 tempat lain termasuk daftar yang berubah (`app/(tabs)/discover.tsx:577`, `components/ui/showcase-comments-sheet.tsx:142`, `app/support/[ticketId].tsx:208`).
**Dampak lanjut:** pada `components/ui/showcase-comments-sheet.tsx:142` komentar tampil tanpa id (memakai `index`), sehingga menambah komentar baru menggeser identitas baris dan dapat memindahkan fokus/pengumuman. **perlu verifikasi runtime**
**Saran:** gunakan id domain sebagai `key` di ketiga tempat itu.

### H-12 🟡 `IconButton`/`SelectedBar` dan sejenisnya tidak memiliki status `selected` yang diumumkan
**Bukti:** `components/ui/selection-bar.tsx` dipakai pada daftar multi-pilih (chat, `app/chat.tsx:253-266` untuk aksi batch) tanpa `accessibilityState={{ selected }}` yang seragam.
**Dampak:** **perlu verifikasi runtime.** Saya memverifikasi absennya prop tersebut pada beberapa pemakaian, bukan keluaran pembaca layarnya.
**Saran:** tambahkan `accessibilityState={{ selected }}` pada item yang dapat dipilih.

### H-13 🔵 `show`/`Presence`/`ZStack`/`Box`/`Surface`/`Stack` menyediakan enam primitif tata letak yang tidak pernah dipakai
**Bukti:** keluaran pemeriksa: `components/ui/{show,presence,z-stack,box,surface,stack}.tsx` tidak diimpor mana pun; `HStack` dan `Spacer` juga tidak dipakai.
**Dampak:** enam cara berbeda untuk menata letak tanpa satu pun contoh pemakaian — pembaca kode baru tidak tahu mana yang kanonik (`className` + `<View>` tetap yang dominan di 235 komponen).
**Saran:** hapus, atau tulis aturan di `docs/` kapan tiap primitif dipakai dan pindahkan pemakaian lama secara bertahap.

### H-14 🔵 `ToastItem` diekspor untuk story/preview tetapi tidak ada story/preview di repo
**Bukti:** `components/ui/toast.tsx:6` (*"diekspor untuk story/preview"*); pemeriksaan menunjukkan `ToastItem` tidak diimpor mana pun dan repo tidak memuat Storybook.
**Dampak:** ekspor publik tanpa konsumen; pada pemeriksaan "49 ekspor UI tanpa pemakaian" ini satu di antaranya.
**Saran:** hapus ekspornya atau sediakan infrastruktur story yang memang dimaksud.

---

# I. Dead code, duplikasi & kebersihan

### I-01 🟡 Baseline S5 tidak bisa menyusut: gate hanya menolak penambahan, bukan jumlah
**Bukti:** `scripts/check-screens.mjs:474-492` membandingkan komponen tak terpakai dengan baseline: kegagalan hanya muncul bila (a) ada komponen **baru** yang tak terpakai, atau (b) ada entri baseline yang **jadi terpakai** (agar daftar dibersihkan). Angka `S5 sisa 29` sendiri hanya dicetak di ringkasan (`:538`) dan `check-screens: OK` tetap keluar.
**Dampak:** tidak ada tekanan apa pun untuk menurunkan 29 → 28; utang ini stabil secara struktural. Bandingkan S2/S4/S6/S7/S8 yang sisa 0 karena seluruh pelanggarannya sudah dibereskan — mekanisme ratchet-nya ada, hanya tidak dipakai untuk S5.
**Saran:** tambahkan plafon angka berjalan (mis. `S5 maksimum 25, turun 1 setiap dua minggu`) di samping pemeriksaan baseline.

### I-02 🟡 118 ekspor komponen tanpa satu pun pemakaian
**Bukti:** skrip "ekspor tanpa pemakaian" (setiap `export function/const/class` di `components/**` dicari di korpus `app/`, `lib/`, `components/`, `tests/`, `e2e/`, `scripts/`): **118 nama pada 77 berkas**.
```
  components/app-lock-gate.tsx → APP_LOCK_AFTER_MS
  components/register/otp-method-selector.tsx → OTP_METHOD_META
  components/ui/accordion.tsx → AccordionItem
  components/ui/achievement-badge.tsx → AchievementBadge, AchievementBadgeSkeleton, FALLBACK_BADGE_ICON
  components/ui/bank-select.tsx → BankRow, BankLogo
  components/ui/bar-chart.tsx → ChartLegend
  components/ui/bottom-tab-bar.tsx → VISIBLE_TAB_ROUTES
  components/ui/box.tsx → Box
  components/ui/calendar.tsx → sameDay
  components/ui/card.tsx → CardHeader, CardBody, CardFooter
  components/ui/chat-attachment-item.tsx → isImageAttachment, attachmentExtension, attachmentIcon
  components/ui/chat-composer.tsx → canSendMessage, CHAT_MESSAGE_MAX
  components/ui/checkbox-group.tsx → CheckboxGroup
  components/ui/count-badge.tsx → CountBadge, BadgedIcon
  components/ui/data-table.tsx → DataTable
  components/ui/delivery-proof-viewer.tsx → DELIVERY_REJECT_NOTE_MIN, DELIVERY_REJECT_NOTE_MAX
  components/ui/dispute-call-log-item.tsx → DISPUTE_CALL_LABELS
  components/ui/dispute-card.tsx → DisputeCardSkeleton
  components/ui/dispute-evidence-item.tsx → DisputeEvidenceItem
  components/ui/dispute-status-badge.tsx → isDisputeStatus, disputeStatusTone, DISPUTE_STATUSES, DISPUTE_STATUS_LABELS
  components/ui/evidence-grid.tsx → isImageEvidence, EvidenceTile
  components/ui/fee-breakdown.tsx → feeShare
  components/ui/filter-sheet-content.tsx → countActiveFilters, FilterSheetContent
  components/ui/form-section.tsx → FormRow
  components/ui/heading.tsx → SectionTitle
  components/ui/help-category-card.tsx → HelpCategoryCardSkeleton
  components/ui/kyc-history-list-item.tsx → KYC_DOC_LABELS
  components/ui/kyc-status-card.tsx → isKycStatus, KycStatusCardSkeleton, KYC_STATUS_LABELS
  components/ui/language-picker.tsx → DEFAULT_LANGUAGES
  components/ui/layout.tsx → Bleed, AspectRatio
  components/ui/menu-list.tsx → MenuList, MenuItem
  components/ui/mutual-resolution-card.tsx → MUTUAL_RESOLUTION_LABELS
  components/ui/notification-preferences-matrix.tsx → CATEGORY_CHANNELS, CATEGORY_ORDER
  components/ui/order-extension-card.tsx → ORDER_EXTENSION_LABELS
  components/ui/order-history-timeline.tsx → mapOrderHistoryToTimeline
  components/ui/order-link-preview-card.tsx → OrderLinkPreviewCardSkeleton
  components/ui/order-link-share-card.tsx → displayOrderUrl
  components/ui/order-summary-strip.tsx → OrderSummaryStrip
  components/ui/password-strength.tsx → scorePassword, PASSWORD_MIN_LENGTH
  components/ui/payment-method-selector.tsx → formatPaymentFee
  components/ui/phone-input.tsx → formatNationalPhoneId, PHONE_ID_PREFIX
  components/ui/pin-input.tsx → PinDots, PIN_DEFAULT_LENGTH
  components/ui/portal.tsx → useHasBlockingOverlay
  components/ui/profile-ratings-tab.tsx → RATING_FILTERS
  components/ui/rating-form.tsx → isRatingComplete
  components/ui/rating-review-card.tsx → RatingReviewCardSkeleton
  components/ui/reason-picker.tsx → isReasonComplete
  components/ui/referral-code-card.tsx → ReferralCodeCardSkeleton
  components/ui/referral-history-list-item.tsx → REFERRAL_STATUS_LABELS
  components/ui/referral-reward.tsx → ReferralApplyForm, REFERRAL_REWARD_STATUS_LABELS
  components/ui/result-state.tsx → ResultState
  components/ui/schedule-field.tsx → isScheduleComplete
  components/ui/sensitive-text.tsx → maskSensitive
  components/ui/signature-pad.tsx → SignaturePad
  components/ui/social-links-editor.tsx → socialPlatformIcon, validateSocialUrl, SOCIAL_PLATFORM_ICONS, SOCIAL_PLATFORM_LABELS
  components/ui/stack.tsx → HStack, Spacer
  components/ui/subscription-benefit-list.tsx → SubscriptionHistoryListItem, SUBSCRIPTION_PAYMENT_LABELS
  components/ui/subscription-plan-card.tsx → useInverseScopeVars
  components/ui/subscription-status-card.tsx → SubscriptionStatusCardSkeleton, EXPIRING_THRESHOLD_DAYS, SUBSCRIPTION_STATUS_LABELS
  components/ui/support-ticket-card.tsx → isTicketStatus, isTicketActive, TicketStatusBadge, SupportTicketCardSkeleton, TICKET_STATUS_LABELS
  components/ui/swipeable-list-item.tsx → useSwipeableGroup
  components/ui/tag-input.tsx → TagInput
  components/ui/theme-toggle-button.tsx → ThemeToggleButton
  components/ui/toast.tsx → ToastItem
  components/ui/toggle-group.tsx → ToggleGroupField
  components/ui/topup-status-card.tsx → paymentMethodKind
  components/ui/transaction-template-card.tsx → TransactionTemplateCardSkeleton
  components/ui/trust-score-card.tsx → TrustScoreCardSkeleton, DEFAULT_TIER_LABELS
  components/ui/two-factor-method-selector.tsx → DEFAULT_TWO_FACTOR_METHODS
  components/ui/two-factor-status-card.tsx → TWO_FACTOR_METHOD_LABELS
  components/ui/typography.tsx → Paragraph
  components/ui/upload-field.tsx → detectUploadKind, validateUploadFile, UPLOAD_DEFAULT_ACCEPT, UPLOAD_DEFAULT_MAX_MB
  components/ui/username-field.tsx → normalizeUsername, USERNAME_MIN, USERNAME_MAX
  components/ui/voucher-card.tsx → VoucherCardSkeleton
  components/ui/voucher-redeem-box.tsx → normalizeVoucherCode
  components/ui/withdrawal-schedule-card.tsx → WithdrawalScheduleCardSkeleton
  components/ui/z-stack.tsx → ZStack
```
**Dampak:** sebagian besar adalah helper murni (validator, pemformat, peta label) yang kini hidup sendiri tanpa pemanggil — termasuk `validateSocialUrl`, `validateUploadFile`, `scorePassword`, `normalizeUsername`, `isRatingComplete`, `normalizeVoucherCode`. Kelas cacat yang nyata: aturan yang sama didefinisikan dua kali dan yang **dipakai** bukan yang diuji — mis. `PASSWORD_MIN_LENGTH` (`components/ui/password-strength.tsx`) vs batas di form, `USERNAME_MIN/MAX` (`components/ui/username-field.tsx`) vs validasi layar, `UPLOAD_DEFAULT_MAX_MB` vs `lib/api/upload.ts`. `PinDots` (`components/ui/pin-input.tsx:214`) juga tidak dipakai padahal `components/ui/biometric-prompt-trigger.tsx:33` menyebutnya.
**Saran:** hapus ekspor yang tidak dipakai; untuk peta label/status (lihat I-07) pindahkan ke `lib/labels/` dan impor dari sana sehingga satu definisi melayani semua pemakai.

### I-03 🟡 Fungsi telemetri & diagnostik diekspor tanpa pemakai (lihat D-02)
**Bukti:** `lib/telemetry.ts:60` (`getTelemetryBuffer`), `:68` (`addTelemetrySink`); keduanya 0 pemanggil.
**Saran:** pakai di layar diagnostik atau hapus.

### I-04 🟡 API publik modul tanpa konsumen: `clearPendingActions`, `prunePendingActions`
**Bukti:** `lib/pending-actions.ts:171-184`. Keduanya 0 pemanggil di `app/`, `components/`, `lib/`.
**Dampak:** `prunePendingActions()` didokumentasikan "dipanggil saat baca/boot" (`:170`) tetapi tidak pernah dipanggil — penyaringan hanya terjadi di `sanitize()` saat muat (`:120`), sehingga aksi yang kedaluwarsa **selama sesi berjalan** tetap ada di memori sampai restart. Banner pemulihan dapat menawarkan aksi yang sudah mati di server.
**Saran:** panggil `prunePendingActions()` dari `PendingActionsBanner` pada interval/AppState-aktif, atau hapus fungsinya.

### I-05 🟡 `DEFAULT_CHANNEL_ID` ditandai `@deprecated` tetapi tetap diekspor dan tidak dipakai
**Bukti:** `lib/push-notifications.ts:85-86`.
**Saran:** hapus setelah satu siklus rilis.

### I-06 🟡 Dua definisi alasan laporan dengan tipe berbeda (`REPORT_REASONS` vs `USER_REPORT_REASONS`/`CONTENT_REPORT_REASONS`)
**Bukti:** `components/ui/report-form.tsx:35-49` mendefinisikan `ReportReason` + `REPORT_REASONS`, sedangkan `lib/labels/report.ts:29-85` mendefinisikan `UserReportReason`, `USER_REPORT_REASONS`, `CONTENT_REPORT_REASONS`, dan `REPORT_REASON_TO_CATEGORY`. Pemeriksa mereproduksi dua sumber label/status terpisah di dua lokasi.
**Dampak:** inilah kelas cacat G-13 audit sebelumnya (lima implementasi alasan laporan dengan enum berbeda) yang masih menyisakan dua sumber — `report-form.tsx` adalah default yang dipakai bila pemanggil tidak mengirim `reasons` (`:99`), sehingga jalur laporan yang lupa mengirim prop akan mengirim nilai enum lama.
**Saran:** hapus default di `report-form.tsx` (jadikan `reasons` wajib) sehingga hanya `lib/labels/report.ts` yang menjadi sumber.

### I-07 🟡 Label status tersebar di 5 modul berbeda
**Bukti:** `ORDER_STATUS_LABELS` (`components/ui/order-status-badge.tsx`), `DISPUTE_STATUS_LABELS` (`components/ui/dispute-status-badge.tsx:61`), `KYC_STATUS_LABELS` (`components/ui/kyc-status-card.tsx:43`), `STATUS_LABELS` (`app/reports.tsx:54`), `walletTransactionStatus` (`lib/wallet-labels.ts`).
**Dampak:** tidak ada satu tempat untuk "semua status + label + tone", sehingga konsistensi warna/label antar modul bergantung disiplin. `app/reports.tsx:54` mendefinisikan peta lokal yang tidak dapat dipakai modul lain.
**Saran:** pindahkan seluruh peta ke `lib/labels/` dan ekspor satu `statusMeta(status)`.

### I-08 🟡 `app/reports.tsx` mendefinisikan peta status lokal meski `lib/labels/` sudah ada
**Bukti:** `app/reports.tsx:54` (`const STATUS_LABELS: Record<ReportStatus, string>`).
**Saran:** pindahkan ke `lib/labels/report.ts` (modul itu sudah ada).

### I-09 🟡 Lima berkas "god component" melewati 900 baris, dan plafon S9 hanya mengunci lima yang sudah ada
**Bukti:** ukuran baris terukur:
```
lib/api/types.ts 1559        app/user/[username].tsx 1481   app/chat/[roomId].tsx 1194
lib/api/constraints.ts 1157  app/order/[id].tsx 1136        lib/api/users.ts 1126
lib/tokens.ts 1027           app/dispute/[id].tsx 919        app/showcase/[id].tsx 916
lib/api/orders.ts 881        components/ui/pull-to-refresh.tsx 880
app/create-transaction.tsx 804   app/edit-profile.tsx 765   app/subscriptions.tsx 706
app/transfer.tsx 674   app/(tabs)/discover.tsx 658   app/(tabs)/home.tsx 638
lib/api/auth.ts 636   app/withdraw.tsx 627   app/showcase-management.tsx 616   app/two-factor.tsx 600
```
Gate melaporkan `S9 plafon 5 berkas — god component hanya boleh menyusut`. Berkas ke-6 dan seterusnya (termasuk `pull-to-refresh.tsx` 881) tidak terkunci.
**Saran:** perluas daftar S9 ke semua berkas >700 baris agar tidak ada celah menambah berkas besar baru.

### I-10 🟡 Dua kelas cacat S1 dan S3 masih tersisa
**Bukti:** `check:screens` → `S1 sisa 2 — Layar merakit sendiri state async (bukan useApiQuery/usePaginatedQuery)`, `S3 sisa 25 — Kerangka Screen+Header+PullToRefresh disalin manual (pakai <DataScreen>)`.
**Dampak:** 25 layar menyalin kerangka yang sama; `DataScreen` yang sudah ada (`components/ui/data-screen.tsx`) tidak dipakai, sehingga setiap perbaikan kerangka (mis. F-04/§ data-freshness) harus diterapkan 25 kali.
**Saran:** konversi lima layar per PR dengan gate penurunan.

### I-11 🟡 Enam cara membangun "kartu" dan empat cara membangun "daftar" dalam satu folder komponen
**Bukti:** `components/ui/{card,surface,box,z-stack,layout,section}.tsx` (kartu/wadah) dan `components/ui/{paginated-list,data-screen,list-item,menu-list,data-table}.tsx` (daftar) dengan tiga di antaranya nol pemakaian (I-01).
**Saran:** tentukan satu kanonik per peran dan tandai sisanya `@deprecated`.

### I-12 🔵 Docblock di bawah `import` pada banyak berkas (konvensi repo tidak konsisten)
**Bukti:** contoh: `components/ui/otp-input.tsx:24-25` (import sebelum docblock? tidak — tetapi `components/ui/pin-input.tsx` memulai file dengan penjelasan lalu import di baris 22), sedangkan `components/ui/pressable-scale.tsx:50` meletakkan import tepat setelah blok komentar panjang dan `lib/api/session.ts` menaruh penjelasan di dalam header. Pemeriksa tidak memeriksa hal ini.
**Dampak:** tidak ada dampak runtime; menambah biaya review. Sebelumnya tercatat sebagai G-07 (56 berkas).
**Saran:** tambahkan pemeriksa "docblock berkas harus mendahului import pertama".

### I-13 🔵 `docs/image/IMG_20260917_224056_353.jpg` (156 KB) dan `docs/image/.dummy` tetap ter-commit
**Bukti:** `git ls-files docs/image` → `docs/image/.dummy`, `docs/image/IMG_20260917_224056_353.jpg`, `docs/image/README.md`. Berkas `.dummy` ada semata untuk mempertahankan direktori.
**Dampak:** aset mockup di dalam repo kode menambah ukuran clone; `.dummy` adalah artefak yang membingungkan.
**Saran:** pindahkan ke penyimpanan aset desain dan hapus `.dummy`.

### I-14 🔵 `tsconfig.json` mengecualikan direktori `backend` yang tidak ada
**Bukti:** `tsconfig.json:25-28` — `"exclude": ["node_modules", "backend"]`; tidak ada direktori `backend/` di checkout (`.gitignore` menyebut `/backend/` sebagai salinan referensi).
**Dampak:** tidak berbahaya, tetapi mengesankan ada modul backend di dalam proyek frontend yang membingungkan kontributor.
**Saran:** hapus entri, atau jelaskan di `docs/`.

### I-15 🔵 Komentar `check-a11y` menyebut "pnpm" sementara proyek memakai npm
**Bukti:** `scripts/check-a11y.mjs:42` — *"Jalankan: pnpm check:a11y"*; `package.json` menyatakan `packageManager: npm@10.9.8` dan seluruh skrip lain memakai `npm`.
**Saran:** samakan menjadi `npm run check:a11y`.

---

# J. Build, konfigurasi & rilis

### J-01 🟠 `assetlinks.json` dan `apple-app-site-association` kosong → App Links & Universal Links tidak berfungsi
**Bukti:** `npm run check:weblinks` (dijalankan):
```
check-weblinks: OK — 19 rute dinamis punya rewrite, berkas verifikasi & app.json konsisten
  PERINGATAN  assetlinks.json kosong: App Links belum diaktifkan sampai fingerprint signing production tersedia
  PERINGATAN  apple-app-site-association kosong: Universal Links belum diaktifkan sampai Team ID Apple tersedia
```
`app.json:45-64` memasang `intentFilters` dengan `"autoVerify": true` untuk `kahade.id` dan `www.kahade.id`, `app.json:30-33` memasang `associatedDomains` untuk kedua host. `e2e/web-smoke.spec.ts:17-22` hanya memverifikasi `content-type` JSON, bukan isinya.
**Dampak:** `autoVerify: true` tanpa assetlinks yang sah membuat Android **gagal** memverifikasi dan, pada beberapa versi, mematikan perilaku membuka aplikasi dari tautan (`autoVerify` yang gagal dapat membatalkan intent filter sehingga tautan tetap membuka browser). Kokoh: seluruh markup deep link di repo (19 rewrite, `lib/deeplinks.ts`, `docs/DEEP-LINKING.md`) belum pernah dijalankan pada rilis nyata.
**Saran:** jangan kirim `autoVerify: true` sebelum berkas verifikasi terisi (atau turunkan ke `false` untuk sementara), dan tambahkan pemeriksa isi (bukan hanya content-type) ke `check:weblinks`.

### J-02 🟠 `enableBackgroundRemoteNotifications: true` tanpa `expo-task-manager`
**Bukti:** `app.json:113-121` — plugin `expo-notifications` dengan `"enableBackgroundRemoteNotifications": true`; `app.json:35-39` — `ios.infoPlist.UIBackgroundModes: ["remote-notification"]`. Namun:
```
$ grep -rn "registerTaskAsync|TaskManager|expo-task-manager" app components lib package.json
(kosong)
```
`package.json` tidak memuat `expo-task-manager`.
**Dampak:** aplikasi mendeklarasikan kemampuan menerima **silent push** ke iOS, tetapi tidak ada handler yang mendaftar. Notifikasi latar tanpa handler tidak menghasilkan apa pun; bila payload dikirim sebagai `content-available`, iOS membangunkan aplikasi tanpa efek. Sebaliknya, deklarasi `remote-notification` meningkatkan peluang app dibunuh/ditangguhkan.
**Saran:** hapus kedua deklarasi sampai ada fitur yang benar-benar butuh, atau tambahkan `expo-task-manager` + `Notifications.registerTaskAsync`.

### J-03 🟠 `entitlements.aps-environment: "development"` tertulis di `app.json` untuk semua profil build
**Bukti:** `app.json:25-29`:
```json
"ios": { "bundleIdentifier": "id.kahade", "entitlements": { "aps-environment": "development" } }
```
`eas.json` memakai profil `production` (baris 105+) yang tidak menimpanya.
**Dampak:** bila tidak ada langkah EAS yang menimpanya saat signing, build App Store dikirim dengan entitlemen **development**, dan APNs akan menolak token produksi — push tidak pernah sampai pada build rilis. Ini kelas kesalahan yang hanya terlihat pada build store pertama (yang memang belum pernah dibuat: `eas.json:5-6` menyatakan belum ada akun).
**Saran:** hapus entitlement dari `app.json` (biarkan EAS mengelola) atau sediakan `eas.json` `production.ios.entitlements` dengan nilai `production`.

### J-04 🟡 Versi aplikasi berbeda antara `app.json` dan `package.json`
**Bukti:** `app.json:6` → `"version": "1.0.0"`; `package.json:3` → `"version": "0.1.0"`. `eas.json:32` memakai `appVersionSource: "remote"` sehingga nomor build ada di server EAS, tetapi `version` (marketing) dibaca dari `app.json` oleh `lib/runtime-info.ts`/`installedAppVersion()` dan dikirim sebagai header `X-App-Version` ke setiap request.
**Dampak:** dua sumber kebenaran versi. `compareVersions` pada force-update (`app/_layout.tsx:294`) membandingkan `app.json.version` terhadap `minVersion` server — bila tim menaikkan versi di salah satu tempat saja, pengguna bisa dipaksa update terus-menerus atau tidak pernah.
**Saran:** satukan (mis. generate `app.json.version` dari satu konstanta) dan tambahkan gate `check:` yang membandingkan keduanya.

### J-05 🟡 `slug: "frontend"` pada `app.json`
**Bukti:** `app.json:4`. `eas.json:21-25` menjelaskan alasan historis (proyek EAS dibuat dengan slug itu dan slug tidak bisa diubah).
**Dampak:** slug muncul pada URL build EAS dan pada metadata proyek; tidak memengaruhi identitas aplikasi (`name: "Kahade"`, `scheme: "kahade"`, `id.kahade`), tetapi menyesatkan pada alat pihak ketiga dan pada `expo.dev` (tautan berbagi berisi "frontend").
**Saran:** dokumentasikan di `docs/` (sebagian sudah) dan cantumkan di README agar tidak dianggap bug berulang.

### J-06 🟡 Warna latar ikon adaptif Android `#000000` bertabrakan dengan tema terang
**Bukti:** `app.json:65-68` — `adaptiveIcon.backgroundColor: "#000000"`; splash juga `#000000` (`:90-93`), notification color `#000000` (`:116`), dan `+html.tsx:45-46` memakai `#FAFAF9` (terang) / `#111110` (gelap).
**Dampak:** ikon adaptif terlihat sebagai kotak hitam pekat pada launcher tema terang, sementara identitas web adalah putih tulang. Inkonsistensi merek yang terlihat setiap hari.
**Saran:** tentukan warna latar ikon dari token merek (`lib/tokens.ts`) dan sinkronkan dengan `theme-color`.

### J-07 🟡 `manifest.json` berbeda orientasi dari build native dan hanya punya satu warna tema
**Bukti:** `public/manifest.json` memuat `"orientation": "any"` serta `theme_color`/`background_color` tunggal `#FAFAF9`, sedangkan `app.json:8` memaksa `"orientation": "portrait"` untuk native dan `app/+html.tsx:45-46` sudah menangani skema gelap (`#111110`). Manifest juga tidak punya `shortcuts`.
**Dampak:** PWA terpasang berperilaku berbeda dari aplikasi native pada perangkat yang sama (bisa berputar di web, tidak di native), dan saat sistem dalam mode gelap, bilah judul PWA tetap putih tulang terang. `shortcuts` yang tidak ada berarti tidak ada jalan pintas ("Tarik dana", "Pindai QR") dari ikon.
**Saran:** putuskan satu kebijakan orientasi dan tuangkan di kedua tempat; tambahkan `shortcuts` untuk tiga aksi tersering dan nilai tema yang mengikuti `prefers-color-scheme` (mis. lewat dua manifest atau `theme_color` netral).

### J-08 🟡 `runtimeVersion: { policy: "fingerprint" }` + OTA tanpa kanal pembatalan yang teruji
**Bukti:** `app.json:11-19` (`policy: "fingerprint"`, `checkAutomatically: "ON_LOAD"`, `fallbackToCacheTimeout: 0`); `docs/OTA-RUNBOOK.md` ada; `scripts/check-ota.mjs` memvalidasi.
**Dampak:** kebijakan fingerprint berarti setiap perubahan dependensi native membuat runtime baru sehingga bundle lama tidak kompatibel — tanpa uji rollback nyata, satu kesalahan publikasi OTA tidak dapat dibatalkan cepat. Belum ada bukti latihan rollback di repo (tidak ada skrip `ota:rollback`).
**Saran:** tambahkan skrip rollback darurat ke `scripts/` dan jalankan sekali di kanal preview sebelum rilis.

### J-09 🟡 `EXPO_PUBLIC_API_ENV` tidak ada di `.env.example` meski wajib untuk dev/staging
**Bukti:** `.env.example:1-2` hanya memuat `EXPO_PUBLIC_API_URL`; `lib/api/environment.ts:12-21` membaca `EXPO_PUBLIC_API_ENV` (atau `extra.apiEnv`) dan **melempar** bila `dev`/`staging` dipilih tanpa URL eksplisit. `app.json` tidak mendefinisikan `extra.apiEnv`.
**Dampak:** kontributor yang ingin menunjuk staging harus menemukan nama variabel dari kode; tanpa itu env tetap `prod` (default `:12`) sehingga pengembangan lokal bisa tidak sengaja menembak API produksi. `EXPO_PUBLIC_TELEMETRY_URL` (D-02) juga tidak terdaftar.
**Saran:** tambahkan keduanya ke `.env.example` dengan komentar, dan tambahkan `check:` yang memastikan variabel baru di kode muncul di `.env.example`.

### J-10 🟡 `babel.config.js` masih memuat preset `nativewind/babel` yang di v4 sudah bukan jalur utama
**Bukti:** `babel.config.js:17-21` — plugin `babel-phosphor-imports.cjs` lalu preset `babel-preset-expo` (dengan `jsxImportSource: nativewind`) dan `nativewind/babel`. Komentar `:8-9` mengakui *"di v4 ini hanya preset ringan; transformasi utama sudah pindah ke Metro"*.
**Dampak:** preset yang tidak lagi diperlukan tetap berada di jalur transform (biaya waktu build) dan menyembunyikan konfigurasi yang sebenarnya aktif.
**Saran:** uji penghapusan preset itu; bila build tetap benar, hapus.

### J-11 🔵 `google-services.json` hanya memuat klien Android; klien web memang belum ada
**Bukti:** `check:push` → *"CATATAN env Firebase Web tidak diisi — web push nonaktif di build ini"*; `.env.example:16-34` mencantumkan tujuh variabel Firebase Web yang semuanya opsional.
**Dampak:** kode web push lengkap (`lib/web-push.web.ts`, `lib/web-push-config.ts`, `scripts/gen-fcm-sw.mjs`, `public/firebase-messaging-sw.js`) tetapi tidak pernah dieksekusi di lingkungan mana pun — kondisi yang sama seperti D-03: kode tanpa jalur nyata.
**Saran:** nyalakan di satu lingkungan (staging) agar jalur ini teruji, atau tandai eksplisit "belum diaktifkan" di README aplikasi.

### J-12 🔵 `docs/audit/inventory.json` & `ROUTES.md` berada di `.gitignore` tetapi selalu ditulis ulang tiap `npm run check`
**Bukti:** `.gitignore:48-49`; `npm run check:inventory` menulis kedua berkas (`check:inventory` dijalankan pada setiap `npm run check`), dan berkas itu ada di working tree sekarang.
**Dampak:** setiap developer memiliki dua berkas yang berubah namun tidak pernah bisa di-commit; tidak berbahaya tetapi membuat `git status` selalu kotor bila `.gitignore` tidak dihormati (mis. `git add -f`).
**Saran:** tidak ada perubahan kode diperlukan; cukup pastikan tidak ada skrip yang memakai `-f`.

---

# K. Testing & CI

### K-01 🟠 Tidak ada test untuk modul waktu (`server-time`, `countdown`) — tempat E-01/E-02/E-07 berada
**Bukti:** `ls tests/` tidak memuat test untuk `server-time`, `countdown`, `use-polling`, `use-result-timer`, `pending-actions`, `ui-prefs`, `nik`, `pull-math`. Padahal `tests/hooks.test.tsx` ada dan menguji `useApiQuery`.
**Dampak:** tiga temuan hari ini (E-01, A-02, A-03) berada tepat di modul yang tidak diuji. `lib/pull-math.ts` (77 baris fungsi murni dengan komentar "pure") sama sekali tidak diuji meski merupakan kandidat terbaik untuk unit test.
**Saran:** mulai dari `pull-math` dan `server-time` (keduanya murni, tanpa stub), lalu `pending-actions` dengan `resetPendingActionsForTest` yang sudah tersedia (`lib/pending-actions.ts:202`) dan tidak dipakai tes mana pun.

### K-02 🟠 Test yang ada justru mengunci perilaku cacat `maskAccountNumber` sebagai kontrak
**Bukti:** `tests/format.test.ts:196-207` hanya menguji panjang 12 dan 2. Test lulus pada implementasi cacat (A-01) dan akan menuntut perubahan bila bug diperbaiki.
**Dampak:** memperbaiki A-01 tanpa memperbarui test ini akan membuat CI merah; reviewer mungkin menyimpulkan perilaku baru "salah" dan mengembalikan bug.
**Saran:** tambahkan tabel kasus 8–16 digit dengan keluaran yang benar sebagai bagian dari perbaikan A-01.

### K-03 🟠 E2E hanya 6 pemeriksaan tingkat request, nol interaksi UI
**Bukti:** `e2e/web-smoke.spec.ts:17-41` memeriksa `assetlinks.json`, `apple-app-site-association`, `sw.js`, `robots.txt`, `sitemap.xml`, dan judul halaman. Tidak ada `page.click`, `page.fill`, atau `expect(locator)` pada elemen interaktif.
**Dampak:** seluruh alur bernilai uang (transfer, tarik dana, top-up) tidak memiliki satu pun test otomatis yang menekan tombol. Semua cacat di §A lolos bukan karena sulit, melainkan karena tidak ada yang menjalankan UI.
**Saran:** tambahkan satu test per alur kritis dengan backend tiruan Playwright `route.fulfill` (kredensial di `tests/`), dimulai dari "transfer → PIN salah → ulangi" yang akan langsung menangkap A-03.

### K-04 🟡 Tidak ada pengukuran cakupan (coverage) sehingga "239 test lulus" tidak memberi informasi risiko
**Bukti:** `vitest.config.ts` tidak memuat konfigurasi `coverage`; CI (`github/workflows/ci.yml`) menjalankan `npm run check` tanpa artefak cakupan.
**Dampak:** jumlah test terlihat tinggi (239) sementara modul inti (transport, sesi, waktu, format uang) memiliki cakupan yang tidak diketahui. `tests/api-client.test.ts` ada tetapi tidak menutupi jalur refresh/rotate.
**Saran:** aktifkan `coverage` dengan ambang per-direktori (`lib/api/**` ≥ 60%) dan publikasikan laporan.

### K-05 🟡 `check:screens` melaporkan sisa pelanggaran tetapi tetap sukses
**Bukti:** `scripts/check-screens.mjs` dijalankan lewat `npm run check` → `check-screens: OK` sambil mencetak `S1 sisa 2 · S3 sisa 25 · S5 sisa 29`.
**Dampak:** "OK" pada CI berarti tiga kelas utang bertambah tanpa menghambat. Sementara S4/S6/S7/S8 dilaporkan 0 — jadi mekanisme ratchet ada, hanya tidak aktif untuk ketiga kelas yang tersisa.
**Saran:** naikkan ratchet bertahap (mis. turunkan batas 2 per minggu) sehingga angka itu menyusut secara terukur.

### K-06 🟡 CI tidak menjalankan `check:bundle` pada PR biasa
**Bukti:** `github/workflows/ci.yml` memisahkan job `bundle-budget` yang memang berjalan per PR — tetapi hanya setelah `npm run build:web` penuh (timeout 20 menit) dan **tidak** menggunakan cache; pemeriksaan ukuran dilaporkan sebagai anggaran ±10%.
**Dampak:** **perlu verifikasi runtime** apakah anggaran 10% cukup untuk mendeteksi regresi impor (mis. menarik `firebase` ke bundel utama). Saya memverifikasi keberadaan job dan `scripts/bundle-size-budget.json`, bukan efektivitas ambangnya.
**Saran:** tambahkan anggaran per-chunk dan gagalkan pada pertumbuhan satu chunk > 5%.

### K-07 🟡 `tests/stubs/` memiliki 18 stub native yang dipelihara manual
**Bukti:** `tests/stubs/` memuat 18 berkas (`expo-*`, `react-native*`, `nativewind*`, `react-navigation`, dll.).
**Dampak:** setiap kenaikan versi Expo/RN berpotensi membuat stub menyimpang dari perilaku asli, dan test yang lulus di atas stub bisa memberi rasa aman palsu — persis yang membuat A-03 tidak terdeteksi (stub `expo-*` tidak menyimulasikan `maxLength` native).
**Saran:** tandai berkas stub dengan versi paket yang ditiru dan gagalkan CI saat versi di `package.json` naik tanpa memperbarui stub.

### K-08 🔵 Tidak ada test untuk `lib/nik.ts` meski memuat satu kondisi yang tak terjangkau
**Bukti:** `lib/nik.ts:108` — `if (serial < 1 || serial > 9999)`. `serial = Number(nik.slice(12,16))` selalu 0–9999, sehingga `serial > 9999` **tidak pernah benar** (dead condition), dan `serial === 0` adalah satu-satunya penolakan nyata.
**Dampak:** validasi identitas yang dianggap kuat memuat cabang mati; tanpa test, batas atas palsu itu tidak pernah muncul ke permukaan.
**Saran:** hapus `serial > 9999`, dan tambahkan `tests/nik.test.ts` dengan kasus per-reason (`LENGTH`, `NOT_DIGITS`, `PROVINCE`, `BIRTH_DATE`, `SERIAL`) termasuk 29 Februari.

### K-09 🔵 Tidak ada test untuk `lib/format.ts:384-403` (`formatDateTimeWIB`) yang bergantung `try/catch` Intl
**Bukti:** `tests/format.test.ts` menguji `formatFileSize`, `formatPhoneId`, `truncateMiddle`, `maskAccountNumber`, `formatCountCompact`, tetapi tidak `formatDateTimeWIB`, `formatDateLong`, `formatCountdown`, `formatDurationHours`.
**Dampak:** keempat fungsi itu dipakai di layar tenggat (`app/order/[id].tsx:72`, `components/ui/order-card.tsx:244`) tanpa jaring regresi.
**Saran:** tambahkan test dengan `Intl` di-stub untuk kedua jalur (tersedia dan tidak tersedia).

---

# L. Performa & jaringan

### L-01 🟠 Beranda menembak 5 request paralel dan satu di antaranya murni pemborosan
**Bukti:** `app/(tabs)/home.tsx:189-215` — `home-profile` (`getMe`), `home-wallet` (`getWallet`), `home-order-summary` (`getOrdersSummary`), `home-active-orders` (`listOrders`), dan query ke-5 untuk jumlah order selesai (komentar `:209-210` menyatakan `GET /v1/orders/summary` tidak punya angka itu sehingga dipakai list). Semuanya `refreshOnFocus: true` sehingga berulang setiap kali tab difokuskan.
**Dampak:** lima round-trip per pembukaan tab, masing-masing memuat header device (`lib/api/client.ts:390`) dan `getDeviceId()` (`lib/api/session.ts:163-171`) — pada jaringan seluler lambat ini menunda seluruh layar. Komentar `:186-188` mengakui endpoint agregat belum ada, jadi ini utang yang sudah diketahui tetapi tetap layak dihitung.
**Saran:** minta backend menyediakan `GET /v1/dashboard` (satu round-trip), dan sampai itu ada, tampilkan kartu secara progresif alih-alih menunggu `loading` bersama.

### L-02 🟡 `mergeById` melakukan O(n) Map rebuild per halaman — kumulatif kuadratik pada daftar panjang
**Bukti:** `lib/use-paginated-query.ts:6-10` dipanggil pada setiap `setData` (`:77-81`) dengan `previous` yang bertambah.
**Dampak:** untuk daftar 500 item yang dimuat 20 halaman, total kerja Map ≈ 5.000 entri ditambah pembuatan array baru tiap halaman; digabungkan dengan render ulang seluruh daftar (`setData` mengganti array), ini menghasilkan jeda yang makin terasa di halaman akhir. `wallet-history`, `transactions`, `notifications`, `chat` memakai jalur ini.
**Saran:** simpan `Map` di ref dan perbarui secara inkremental, atau gunakan `FlatList` dengan `data` stabil + `keyExtractor` (virtualisasi — lihat L-03).

### L-03 🟡 Perbaikan virtualisasi F-06 hanya sampai di chat — sheet komentar showcase masih merender semuanya
**Bukti:** `app/chat/[roomId].tsx:402-405` sudah memakai `FlatList` (komentar di `:23` menyebut "F-06"), tetapi `components/ui/showcase-comments-sheet.tsx:176-179` masih merender `comments.map((root) => … (root.replies ?? []).map(…)` secara bersarang — seluruh pohon komentar + balasan dirender sekaligus, di dalam sheet yang bisa memuat ratusan entri pada postingan populer.
**Dampak:** membuka komentar postingan showcase populer melakukan satu render besar dan setiap tambahan satu komentar (optimistic/local, `:94`) me-render ulang semuanya. Karena barisnya memakai `key={index}` (`:142`), menambah komentar juga menggeser identitas baris (lihat H-11).
**Saran:** pakai `FlatList` datar dengan data yang sudah diratakan (root + balasan + penanda kedalaman), seperti yang sudah dilakukan pada thread chat.

### L-04 🟡 Tab yang tidak aktif tetap menjalankan polling
**Bukti:** `lib/use-polling.ts:20-22` bergantung pada `useIsFocused()`; tab Expo Router tetap *focused* selama tidak ada layar lain yang menumpuk di atasnya — mis. Dompet fokus sementara pengguna berada di dalam sheet/modal.
**Dampak:** **perlu verifikasi runtime.** Saya memverifikasi ketergantungan pada `useIsFocused` saja; apakah sheet mengubah status fokus bergantung perilaku navigator. Bila tidak, polling tetap berjalan selama modal terbuka.
**Saran:** tambahkan `AppState` (sudah ada, `:58`) dan matikan polling saat `document.visibilityState` tersembunyi di web (sudah ada, `:59-60`) — pastikan juga modal/sheet mematikan polling lewat prop `enabled`.

### L-05 🟡 `getDeviceId()` dipanggil untuk setiap request sehingga menambah latensi serial
**Bukti:** `lib/api/client.ts:99-106` (`deviceHeaders`) menunggu `await getDeviceId()` pada setiap request; cache-nya hanya di memori proses (`lib/api/session.ts:160-171`) dan di web `deviceId` masuk `WEB_PERSISTENT_KEYS` sehingga dibaca lagi setiap reload.
**Dampak:** setiap request menunggu `localStorage`/SecureStore pada request pertama, dan pada web pada setiap reload. Untuk polling 3 detik ini terasa sebagai jitter.
**Saran:** tunggu sekali di boot (`Promise` disimpan) dan kirim header dari nilai yang sudah tersedia; jangan jadikan header bergantung I/O async di jalur panas.

### L-06 🔵 Bucket `X-App-Version` dihitung ulang tiap request
**Bukti:** `lib/api/session.ts:186-188` (`getAppVersion`) dan `lib/runtime-info.ts` (`installedAppVersion`) dipanggil dari `deviceHeaders()` per request.
**Dampak:** pembacaan `expo-application` per request; nilainya konstan seumur proses.
**Saran:** memo di modul.

### L-07 🔵 Tidak ada timeout khusus untuk endpoint berat (export CSV/HTML)
**Bukti:** `lib/api/config.ts:19` — satu `API_TIMEOUT_MS = 20_000` untuk seluruh aplikasi; `lib/use-wallet-export.ts:44-46` mengekspor riwayat dompet lewat jalur itu.
**Dampak:** ekspor riwayat transaksi setahun pada jaringan seluler dapat melewati 20 detik dan gagal dengan "Server terlalu lama merespons", padahal server masih bekerja. Pengguna akan mencoba lagi dan membebani server berulang.
**Saran:** beri `timeoutMs` lebih besar (mis. 60 s) untuk endpoint ekspor, dan tampilkan progres yang tidak bisa diulang berkali-kali.

---

# M. Lampiran — cara mereproduksi

### M.1 Menjalankan seluruh gate
```
npm install --no-audit --no-fund
npx tsc --noEmit && npx eslint .
npx vitest run && npx vitest run --config vitest.components.config.ts
npm run check
```

### M.2 Bukti runtime A-01 / A-03 / E-01
Probe berikut **tidak di-commit** (berkas sementara; sudah dihapus setelah dijalankan). Untuk mereproduksi: tempel isinya ke `tests/zz-audit-probe.test.tsx`, lalu jalankan `npx vitest run --config vitest.components.config.ts tests/zz-audit-probe.test.tsx`. Probe versi pertama memakai assertion `expect(out[10]).not.toContain("9012")`, `expect(after).toBe("123456")`, dan `expect(remaining).toBe(0)` — ketiganya **lulus pada kode saat ini** (3 test, 1 berkas), dan itulah buktinya:


```tsx
import { describe, expect, it, vi } from "vitest"
import { render, act } from "@testing-library/react"
import { maskAccountNumber } from "@/lib/format"
import { OtpInput } from "@/components/ui/otp-input"
import { useCountdown } from "@/components/ui/countdown"
import { recordServerDate, resetServerTime } from "@/lib/server-time"
import { ThemeProvider } from "@/components/theme-provider"

// A-01
const out = {}
for (const n of [10, 11, 12, 13, 14, 15, 16]) out[n] = maskAccountNumber("1234567890123456".slice(0, n))
console.log("MASK:", JSON.stringify(out))
// → {"10":"•••• ••78 90","11":"•••• •••8 901","12":"•••• •••• 9012",
//    "13":"•••• •••• •012 3","14":"•••• •••• ••12 34","15":"•••• •••• •••2 345",
//    "16":"•••• •••• •••• 3456"}

// A-03
const onComplete = vi.fn()
const { rerender } = render(<ThemeProvider initialPreference="light">
  <OtpInput length={6} onComplete={onComplete} /></ThemeProvider>)
const input = document.querySelector("input") as HTMLInputElement
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
setter?.call(input, "123456"); input.dispatchEvent(new Event("input", { bubbles: true }))
rerender(<ThemeProvider initialPreference="light">
  <OtpInput length={6} onComplete={onComplete} errorText="Kode OTP salah." /></ThemeProvider>)
console.log("OTP VALUE SETELAH errorText DIISI:", JSON.stringify(input.value))  // → "123456"

// E-01
function Probe() {
  const until = Date.now() + 60_000        // dibuat dengan Date.now() — app/withdraw.tsx:200
  const { remaining } = useCountdown({ until })
  return <span data-testid="r">{remaining}</span>
}
resetServerTime()
recordServerDate(new Date(Date.now() + 300_000).toUTCString())  // server 5 menit di depan
const { getByTestId } = render(<Probe />)
console.log("REMAINING (harus 60):", Number(getByTestId("r").textContent))  // → 0
```

### M.3 Pemeriksaan statis yang dipakai pada laporan ini
```
# 29 komponen UI tidak pernah diimpor
node -e "…walk components/ui, cek 'from "@/components/ui/<mod>" di seluruh app|components|lib…"
# 118 ekspor UI tanpa pemakaian (nama `export function/const/class` di components/** dicari di korpus app|lib|components|tests|e2e|scripts)
# 87 cast `as any`, terkonsentrasi di 4 modul lib/api
grep -rn "as any" lib components app --include=*.ts --include=*.tsx | wc -l
grep -rc "as any" lib/api/*.ts | grep -v ":0"
# invalidateQueryCache tidak pernah dipanggil
grep -rn "invalidateQueryCache" app components lib
# telemetry tanpa sink
grep -rn "addTelemetrySink\|getTelemetryBuffer" app components lib
# tidak ada handler notifikasi latar
grep -rn "registerTaskAsync\|expo-task-manager" app components lib package.json
# ukuran berkas terbesar
find app components lib -name '*.ts*' | xargs wc -l | sort -rn | head -20
```

### M.4 Daftar prioritas perbaikan yang disarankan

| Prioritas | Temuan | Alasan |
|---|---|---|
| P0 | **A-01**, **A-03**, **E-01** | Tiga cacat yang sudah terbukti runtime, semuanya di alur uang/keamanan; masing-masing perbaikannya < 2 jam. |
| P0 | **F-01** | Alur uang tidak dapat diselesaikan pengguna pembaca layar. |
| P1 | **J-01**, **J-03** | Deep link dan push produksi tidak akan berfungsi pada rilis pertama — lebih murah diperbaiki sekarang daripada setelah build store dibuat. |
| P1 | **B-02**, **B-03** | Badai 401 untuk tamu web, regresi pola yang sebelumnya sudah pernah diperbaiki di Beranda. |
| P1 | **C-01**, **C-02** | Saldo basi antar-tab; prasyarat semua perbaikan kesegaran data lain. |
| P2 | **A-04**, **A-02**, **A-06**, **I-04** | Perilaku uang yang mengejutkan pengguna (input tertimpa, banner pemulihan hilang). |
| P2 | **D-01**, **D-02** | Validasi skema URL eksternal dan jalur observability yang masih kosong. |
| P3 | **I-01**…**I-15**, **J-04**…**J-12**, **K-01**…**K-09**, **L-02**…**L-07** | Utang yang membesar bila dibiarkan, tanpa dampak langsung hari ini. |

---

## Catatan penutup

Audit ini menemukan **138 cacat** di atas basis repo yang seluruh pipeline-nya hijau. Tiga di antaranya dibuktikan dengan reproduksi yang dijalankan di checkout ini — dan ketiganya berada di jalur yang paling sensitif: **verifikasi nomor rekening**, **pemasukan OTP penarikan**, dan **penghitung waktu kirim ulang OTP**. Itu pola yang berulang di seluruh laporan: gate repo memeriksa **bentuk kode** (token, pola aksesibilitas, kontrak path/metode, sinkronisasi katalog), sementara cacat yang tersisa hidup di **perilaku** yang hanya terlihat bila fungsinya benar-benar dijalankan dengan data yang tidak komplit (nomor rekening 10 digit, offset jam server, error yang sama dua kali).

Oleh karena itu rekomendasi tunggal yang paling berdampak bukan memperbaiki 138 butir satu per satu, melainkan menutup celah tiga gate: (1) test perilaku untuk `lib/format.ts`, `lib/server-time.ts`, dan `components/ui/{countdown,otp-input}.tsx`; (2) deteksi aksesibilitas berbasis render untuk layar uang; (3) gate yang menolak `Date.now()` pada nilai yang disimpan/dibandingkan lintas basis waktu. Ketiganya akan menangkap A-01, A-03, E-01, F-01, A-02, dan E-03 secara otomatis di kemudian hari.

---

# N. Status perbaikan

Diperbarui per batch perbaikan; nomor mengacu ke temuan di atas. Satu temuan
dianggap selesai hanya bila perbaikannya ada di kode + (bila menyangkut
perilaku) dikunci test, dan `npm run check` tetap hijau.

| Batch | Commit | Temuan yang diperbaiki |
|---|---|---|
| A — uang, waktu, aksesibilitas | `01513fa` | A-01…A-07, A-10, A-11, A-13…A-19, C-01 (pemanggil), E-01…E-03, E-05, E-07, E-08, F-01, F-03…F-05, G-02, G-05, G-06, G-08, H-02, I-04 |
| B — sesi, auth & tamu web | `7044f32` | B-01…B-12 |
| C — kesegaran & paginasi data | batch ini | C-01…C-11 |

## Catatan batch C — kesegaran & paginasi data (C-01…C-11)

Ringkas, supaya perilaku yang dikunci bisa ditelusuri tanpa membaca ulang diff:

- **C-01** — `lib/api/client.ts` membatalkan seluruh cache GET setelah mutasi
  dompet/order berhasil (`MONEY_MUTATION_PATTERNS`), jadi aturannya tidak lagi
  bergantung pada ingatan penulis layar. Bukti: `tests/api-client.test.ts`.
- **C-02** — kunci dipusatkan di `lib/query-keys.ts` (`wallet`, `me`,
  `bankAccounts`) dan seluruh 12 pemanggil dimigrasikan; layar yang butuh bentuk
  lain memakai `select`. Pembacaan imperatif lewat `api.users.getMeCached()`
  sehingga ikut cache yang sama. Query GABUNGAN (beberapa endpoint dalam satu
  fetcher) sengaja tetap memakai kunci sendiri — alasannya di `lib/query-keys.ts`.
  Bukti: `tests/query-keys-shared.test.tsx`.
- **C-03/C-04** — cache dipindah ke `lib/query-cache.ts` (tanpa React) dengan
  TTL 5 s, eviksi FIFO 200 entri, dan penyegaran latar stale-while-revalidate
  setelah 2 s. Dua bug ikut ditutup saat verifikasi: penanda `revalidating`
  bocor bila request latar dibatalkan, dan `select` dipakai untuk proyeksi
  tanpa meracuni bentuk baku. Bukti: `tests/query-cache.test.ts`.
- **C-05/C-06/C-07** — `readPage` hanya membaca kunci paginasi yang dikenal dari
  root, berhenti pada halaman kosong, dan menghitung `totalPages` dari `total`
  ÷ limit yang DIKIRIM (bukan panjang data); `limit` eksplisit kini terkirim dari
  adapter (`listOrders`, `getNotifications`, `getBusinessVerificationHistory`,
  `getTopupHistory`, `getWithdrawHistory`); fallback `readList` dicatat ke
  telemetri (`api:list-fallback`). Bukti: `tests/response-helpers.test.ts`.
- **C-08** — `byTimestampDesc` dipakai di seluruh daftar kronologis (11 berkas);
  dua daftar sengaja tanpa pembanding karena tidak punya kolom waktu (pengikut)
  atau memang berperingkat dari server (Discover). Bukti: `tests/hooks.test.tsx`.
- **C-09** — `lib/api/backpressure.ts` mencatat 429/503 dari transport
  (`Retry-After` dihormati, tumbuh 2×, batas 2 menit) dan `usePolling` memakai
  sisa cooldown sebagai interval minimum. Bukti: `tests/backpressure.test.ts`,
  `tests/api-client.test.ts`, `tests/hooks.test.tsx`.
- **C-10** — `loadMore` dibatalkan saat layar kehilangan fokus. Saat
  verifikasi, pembatalan berbasis `busy` terbukti akan menggantung skeleton
  (muat-awal juga menyalakan `busy`) — kini `inFlight` membedakan
  initial/more. Bukti: `tests/hooks.test.tsx`.
- **C-11** — logout hanya punya satu jalur (`clearSession()` dari
  `lib/api/session.ts`) yang menaikkan revisi sesi; entri cache milik revisi
  lain selalu dibuang saat dibaca. Bukti: `tests/query-cache.test.ts`.
