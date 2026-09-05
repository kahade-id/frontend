# Audit mendalam frontend Kahade

**5 September 2026 · branch `arena/01a07001-frontend`**

Basis: `bae6e0f80c69303ff1b9c8e968c6fcac7535bc3e`.

## Kesimpulan

Audit ini menghasilkan **perubahan kode**, bukan hanya daftar saran: perbaikan transport API, sesi/autentikasi, alur finansial, normalisasi data, komponen bersama, layout, pagination, aksesibilitas, pengujian, dan persiapan rilis Expo.

**Belum layak dinyatakan “semua API produksi sudah bekerja” atau “OTA sudah selesai”.** API protected belum diuji memakai akun nyata yang diizinkan; native binary/EAS belum diverifikasi. **Tidak ada OTA yang dipublikasikan.** Rincian blocker ada di bagian akhir dan [OTA.md](OTA.md).

### Hasil terukur

| Pemeriksaan | Hasil akhir |
|---|---|
| Inventaris source Expo | **82 file**, termasuk **79 screen**, 2 layout, dan dokumen HTML web |
| Kecocokan path + method API | **231 pemanggilan adapter** cocok dengan spesifikasi lokal: 220 path / 253 operasi |
| TypeScript | **PASS** |
| Konsistensi token desain | **PASS** |
| Aksesibilitas statis | **PASS**, 295 file TSX dipindai |
| Unit / hook / transport / storage tests | **122 PASS**, 14 file |
| Browser regression | **13 PASS** pada production static export, dengan API di-intercept |
| Cakupan route browser smoke | **62 screen protected** dalam kondisi API gagal + **17 entry/public/recovery screen** |
| Viewport browser | 320×568, 390×844, 1280×900; wallet light/dark; pemeriksaan overflow dan inset form/row |
| Export web | **PASS** |
| Export Hermes Android dan iOS | **PASS** — bukan build/install APK/IPA |
| Kesesuaian dependency Expo | **PASS** terhadap daftar bundled-version offline SDK 54 |
| `npm audit` | 31 temuan → **29 temuan**; masih **9 high / 20 moderate** |
| EAS identity | **Not logged in** |
| OTA preflight | **BLOCKED**: project ID, identifiers native, dan update URL belum tersedia |

**Ukuran JavaScript web:** 8.693.271 → **3.714.885 byte**, turun **57,27%** (minified, belum dikompresi jaringan). Ini pengukuran ukuran bundle, **bukan** klaim FPS, waktu startup native, atau latency API membaik sebesar persentase yang sama.

Hash bundle, ukuran Hermes, ruang lingkup, dan ringkasan pemeriksaan tersedia di [verification.json](verification.json). Pemetaan per halaman ada di [ROUTES.md](ROUTES.md); versi machine-readable ada di [inventory.json](inventory.json).

## Batas dan metode audit

1. Menelusuri semua file route dan dependensi komponen/hook; membaca spesifikasi request OpenAPI lokal serta adapter API.
2. Memeriksa respons endpoint publik `https://api.kahade.id` tanpa credential dan tanpa mutasi bisnis.
3. Memperbaiki akar masalah bersama sebelum menambah implementasi per halaman.
4. Menambahkan tes untuk kegagalan jaringan, sesi bersamaan, stale responses, pagination, angka uang, dan upload.
5. Melakukan browser regression terhadap **bundle production**, bukan hanya memastikan port development terbuka.
6. Memeriksa export ketiga platform dan kesiapan konfigurasi OTA secara terpisah.

“Tidak hardcode” di sini berarti **tidak mengarang data bisnis, harga/biaya, saldo, status sukses, tanggal, kepemilikan, role, dokumen legal, atau identitas deployment**. Label UI, copy, format lokal, token desain, enum yang bersumber dari DTO, dan timeout interaksi tetap merupakan konfigurasi/kode yang sah. Fixture sintetis hanya berada dalam `tests/`, tidak disuntikkan ke aplikasi.

Smoke test route membuktikan jalur yang diuji tidak menghasilkan uncaught render error atau overflow dokumen. Screen yang memerlukan state registrasi/challenge dapat mengalihkan ke awal alur jika dibuka langsung. Smoke test **tidak** membuktikan setiap kombinasi happy/error/empty/permission/native state pada seluruh halaman telah diverifikasi.

## Temuan yang diperbaiki

Prioritas berikut menjelaskan dampak sebelum perbaikan, bukan sertifikasi keamanan atau risiko residual seluruh produk. `P0` = potensi salah transaksi/sesi; `P1` = fungsi/data penting; `P2` = UX, performa, maintainability.

### A. Transport API dan kontrak data

| ID | Prioritas | Masalah dan perbaikan |
|---|---|---|
| F01 | P0 | Base URL development bisa mengarah ke host yang tidak dapat dijangkau perangkat/browser. Default sekarang **HTTPS api.kahade.id**, staging/dev eksplisit; localhost browser ditolak. |
| F02 | P0 | Path eksternal bisa mencampurkan transport API dengan URL upload. URL/path/query dibatasi dan segmen di-encode; upload storage menggunakan transport terpisah. |
| F03 | P1 | Envelope `{success,message,data,errors}` belum konsisten dengan pemakaian halaman. Decoder bersama membaca success/failure tanpa membuang metadata pagination. |
| F04 | P1 | Error nested `errors.code/message` dan array validasi tidak terbaca dengan benar. Parser menangani struktur tersebut dan membedakan auth, timeout, pembatalan, validation, serta server failure. |
| F05 | P1 | Respons list yang bentuknya tidak dikenal dapat berubah menjadi daftar kosong. Adapter yang diperbaiki memakai `readList`/`readPage`; shape tidak dikenal menghasilkan error, bukan “tidak ada data”. |
| F06 | P1 | Halaman pertama dianggap keseluruhan total; metadata hilang bisa menghentikan pagination. Total yang tidak diketahui tetap unknown, count string aman dinormalisasi, dan halaman penuh tetap dapat dilanjutkan. |
| F07 | P1 | Metadata page/limit nol atau tidak valid dapat menghasilkan perhitungan salah. Pembaca metadata memvalidasi integer dan menghindari pembagian nol. |
| F08 | P0 | Retry mutation berisiko menggandakan efek finansial. Retry otomatis dibatasi untuk request baca; POST/PUT/PATCH/DELETE tidak diulang otomatis akibat network/server failure. |
| F09 | P1 | Request/body parsing bisa menggantung. Timeout dan AbortSignal meliputi penerimaan serta pembacaan response body. |
| F10 | P2 | GET identik dan refresh token bersamaan menimbulkan request berulang. Ada in-flight deduplication dan single-flight refresh dengan pemisahan revisi sesi. |
| F11 | P1 | Bank, fee schedule, subscription plans, config, versi aplikasi, dan metode OTP diasumsikan punya struktur yang berbeda dari respons publik. Normalizer disesuaikan dengan payload yang diamati dan diuji dengan fixture. |
| F12 | P1 | Query global search memakai `type`/`page`, bukan kontrak `types`/`limit`. Nama parameter dikoreksi; tidak mengarang pagination yang tidak didokumentasikan. Nilai filter dan respons protected tetap memerlukan verifikasi live. |
| F13 | P1 | Help center publik memakai auth wajib dan tidak mengirim `lang`. GET help memakai akses publik dan `lang=id`; route bantuan tidak lagi memerlukan sesi. |
| F14 | P1 | Followers/following mengabaikan query halaman dan memakai panjang halaman pertama sebagai jumlah keseluruhan. Pagination ditambahkan; profil hanya menampilkan total yang benar-benar tersedia. |
| F15 | P1 | Upload mengasumsikan semua presigned request adalah PUT. Kini mendukung PUT serta signed POST fields, boundary multipart otomatis, HTTPS, timeout, dan `credentials: omit`. |

### B. Autentikasi, sesi, dan state lintas akun

| ID | Prioritas | Masalah dan perbaikan |
|---|---|---|
| F16 | P0 | Halaman sensitif bisa mulai mengambil data sebelum status sesi selesai dipulihkan. Guard Expo Router dan state pemulihan eksplisit mencegah fetch finansial saat belum terautentikasi. |
| F17 | P0 | Refresh/network error sementara bisa dianggap logout. Auth failure dibedakan dari timeout/429/5xx; tersedia jalur retry pemulihan sesi. |
| F18 | P0 | Respons refresh/GET dari akun lama berpotensi menimpa login baru. Revisi sesi dan pemeriksaan respons terlambat mencegah state lintas akun. |
| F19 | P0 | Penulisan token parsial/bersamaan dapat meninggalkan sesi campuran. Penulisan diserialisasi, state signed-in diterbitkan setelah persist berhasil, dan ada rollback saat storage gagal. |
| F20 | P0 | PIN hash, biometric flag, dan push token akun lama dapat diwarisi akun baru. State secure per-akun dibersihkan ketika sesi baru dimulai. |
| F21 | P0 | Logout offline dapat diikuti cookie auto-login pada reload. Logout tetap membersihkan lokal dan menyimpan tanda signed-out eksplisit; pending registration/2FA juga dihapus. |
| F22 | P1 | Kegagalan unregister push dapat menghalangi logout. Cleanup lokal tidak bergantung pada keberhasilan push/server request. |
| F23 | P1 | Token web berisiko menjadi data persisten yang mudah terbaca JavaScript. Secret tetap memory-only; hanya device/onboarding/theme/signed-out yang boleh memakai localStorage. |
| F24 | P1 | Badge unread dapat membawa angka akun sebelumnya atau ditimpa poll lama sesudah read-all. Reset berbasis sesi/generation dan pembatalan hasil stale ditambahkan serta diuji. |
| F25 | P2 | Tema kembali ke default dan late read dapat menimpa pilihan terbaru. Preferensi disimpan dan pilihan pengguna yang lebih baru dilindungi. |

### C. Akurasi finansial dan tindakan penting

| ID | Prioritas | Masalah dan perbaikan |
|---|---|---|
| F26 | P0 | Angka string, unsafe integer, NaN, atau nominal negatif dapat tampil/terkirim secara keliru. Wallet normalization dan guard nominal IDR integer ditambahkan. |
| F27 | P0 | Paste `10.000,50` berpotensi menjadi `1.000.050`; minus/scientific notation dapat berubah makna. Parser menolak nilai pecahan/ambigu dan menerima format IDR integer yang valid. |
| F28 | P1 | Batas nominal/field/enum tersebar di halaman. Constraint request dihasilkan dari OpenAPI dan digunakan dalam validasi UI/API. |
| F29 | P1 | Saldo kosong disamakan dengan Rp0; available balance disamakan dengan total balance walau dana tertahan belum diketahui. Unknown ditampilkan sebagai unknown; pengurangan hold hanya dilakukan jika nilainya tersedia. |
| F30 | P1 | Status mutasi kosong/baru disamakan dengan SUCCESS dan arah tidak dikenal dianggap debit. Mapping UNKNOWN dipakai di wallet overview, history, search, dan detail. |
| F31 | P1 | Biaya gabungan, min/max/free limit, rentang nominal dan availability metode hilang. Model selector mempertahankan rincian tersebut; metadata availability yang tidak terkonfirmasi tidak dianggap aktif. Tidak ada klaim gratis dari fee kosong. |
| F32 | P0 | Top-up rentan double tap/poll overlap dan respons status dapat menghapus instruksi. Ada synchronous lock, lifecycle polling, merge status, serta error/retry yang terlihat. Status tak dikenal tidak disulap menjadi sukses. |
| F33 | P0 | Callback PIN withdrawal memakai state rekening/loading lama. Dependensi diperbaiki dan pengiriman dilindungi lock. Pesan error tidak selalu menuduh PIN salah. |
| F34 | P0 | Gagal membatalkan withdrawal tetap menghapus transaksi pending dan kembali ke form. Kini transaksi/OTP dipertahankan saat gagal; pembatalan berhasil mengarah ke riwayat. |
| F35 | P1 | Withdrawal/transfer selalu menampilkan keberhasilan meski respons pending/unknown. Copy sekarang membedakan permintaan diterima dari status selesai yang dikonfirmasi server. |
| F36 | P1 | Lookup penerima transfer dapat menampilkan respons untuk username lama. Debounce/cancellation/latest-result guard dipakai; kegagalan layanan dibedakan dari hasil kosong. |
| F37 | P0 | Quote biaya dan validasi counterpart order dapat berasal dari draft sebelumnya. Pengiriman dikunci ke draft/key yang sudah diperiksa; quote lama tidak membuka tombol untuk nominal/role baru. |
| F38 | P0 | Detail order/dispute mengasumsikan role BUYER. Role tidak diketahui menjadi read-only untuk tindakan terkait role; identitas lawan dan pembagian dana tidak ditebak. |
| F39 | P1 | Proposals dispute mengarang nilai alokasi dari Rp0; call status asing dianggap completed dan requested dianggap ongoing. Rincian tidak lengkap tidak membuka tindakan finansial; requested/accepted/ongoing/completed dibedakan. |
| F40 | P1 | Subscription menelan kegagalan prasyarat dan memilih metode default yang belum terkonfirmasi. Prasyarat pembayaran wajib berhasil, enum/rentang metode diperiksa, submit dilindungi, dan response tidak otomatis disebut aktif. |
| F41 | P0 | Penghapusan akun menganggap kegagalan pengecekan saldo/order/2FA sebagai aman. Pemeriksaan gagal atau hold balance unknown menghalangi submit. |
| F42 | P1 | Masa penghapusan 30 hari tidak bersumber dari API. Klaim grace period di halaman dan default form dihapus; jadwal mengikuti informasi resmi yang perlu dikonfirmasi. |

**Batas proteksi finansial:** lock UI bukan pengganti idempotency backend. Timeout atau aplikasi yang ditutup dapat meninggalkan hasil request belum diketahui. Sebelum mengirim ulang, periksa riwayat/status; verifikasi end-to-end tetap memerlukan dukungan backend.

### D. Isi halaman, komponen, layout, dan performa

| ID | Prioritas | Masalah dan perbaikan |
|---|---|---|
| F43 | P1 | Legal screens memuat kebijakan yang belum terverifikasi. Terms/privacy memakai komponen bersama untuk tautan HTTPS resmi dari config, atau state dokumen belum tersedia. |
| F44 | P1 | Metode OTP/fasilitas paket berpotensi berasal dari fallback buatan. Metode yang ditawarkan dan paket berasal dari respons layanan; enum tidak otomatis dianggap enabled. |
| F45 | P1 | Lencana diberi tanggal “sekarang” atau dianggap belum diraih jika tanggal tidak ada. Kepemilikan berasal dari koleksi milik pengguna; tanggal tidak dikarang, completeness pagination diperhitungkan. |
| F46 | P1 | Support thread membuat pesan/timestamp kosong buatan. State kosong yang jujur menggantikan pesan sintetis. |
| F47 | P1 | Tombol voucher hanya memberi toast seolah dipakai, serta expiry ditampilkan sebagai waktu penggunaan. Voucher kini membuka form transaksi dengan kode terisi; waktu penggunaan memakai field penggunaan, bukan expiry. |
| F48 | P1 | Kategori FAQ selalu membuka artikel pertama. Kategori menampilkan artikel-artikelnya dan detail memilih ID/slug yang benar. |
| F49 | P1 | Search awal yang gagal dapat tidak terlihat; filter lama dapat menimpa hasil baru. Layar memakai query state bersama dan error awal yang dapat di-retry. |
| F50 | P2 | Wallet/history/list merender banyak baris sekaligus. Wallet, transactions, notifications, kedua history, search, FAQ, dan followers memakai list virtualized/shared pagination. |
| F51 | P2 | Load-more overlap, ID ganda, atau server mengabaikan page dapat menghasilkan daftar tak berujung. Helper menserialisasi load-more, dedup ID, mempertahankan data saat gagal, dan menghentikan halaman tanpa item baru. |
| F52 | P2 | Interval polling dapat overlap atau terus berjalan di screen/background tersembunyi. Shared polling menjadwalkan setelah request selesai dan mengikuti focus/visibility. |
| F53 | P2 | Tiap komponen membuat listener reduce-motion sendiri. Subscription preferensi dipusatkan, termasuk perubahan media query web. |
| F54 | P1 | **`PullToRefresh` kehilangan padding/content style** karena animated GHScrollView tidak terdaftar pada NativeWind. `cssInterop` eksplisit memperbaiki pemetaan `contentContainerClassName`; posisi judul top-up diuji di browser. |
| F55 | P2 | Padding row berlipat dan override `px-0` tidak andal karena `cn()` adalah join, bukan class conflict resolver. Row mendapat prop `padded`; 13 `SectionHeader` inset ganda dalam container berpadded dihapus. |
| F56 | P2 | Header/safe area/footer tidak konsisten, tombol besar menyempitkan judul. Perbaikan shared Screen/Header, safe-area footer, keyboard layout, dan aksi icon-only pada header notifikasi. |
| F57 | P2 | Input berisiko clipping dan SearchField menimpa event/autofocus pemanggil. Min-height/scaling dan komposisi callback diperbaiki; `autoFocus={false}` dihormati dan diuji di FAQ. |
| F58 | P2 | Gambar recycled/error dapat tetap memuat state sumber sebelumnya. State Avatar/Picture mengikuti identitas sumber; recycling key tidak lagi menutupi perubahan URI. |
| F59 | P2 | Formatter menampilkan invalid date/number atau memangkas digit telepon terakhir. Validasi kalender, angka, durasi, ukuran file dan format nomor diperbaiki. |
| F60 | P2 | Import barrel ikon membundel ribuan definisi tak terpakai. Babel meresolve impor ikon spesifik; hasil keseluruhan perubahan menurunkan JS web 57,27%. |
| F61 | P2 | Halaman bahasa menjanjikan UI terjemahan yang belum diimplementasikan. Copy menjelaskan preferensi akun dan keterbatasan bahasa antarmuka yang sebenarnya. |
| F62 | P2 | Error render/deep link tidak punya pemulihan yang jelas dan judul HTML kosong. ErrorBoundary, not-found, header fallback, `lang=id`, serta judul dokumen dari konfigurasi ditambahkan. |

### E. Reproducibility dan rilis

| ID | Prioritas | Masalah dan perbaikan |
|---|---|---|
| F63 | P1 | React Native 0.81.0 tidak cocok dengan bundled recommendation Expo SDK 54. Diperbarui ke **0.81.5**; dependency check offline lolos. |
| F64 | P1 | Lockfile npm/pnpm berbeda menyebabkan dependency graph dan pemilihan package manager EAS ambigu. npm menjadi sumber tunggal; clean install lockfile diuji. |
| F65 | P1 | PostCSS transitif masih memakai versi rentan. Override 8.5.28 disinkronkan dengan lockfile dan clean install, lalu export web/native diuji. Temuan lain belum dipaksa lewat upgrade mayor. |
| F66 | P1 | `runtimeVersion` salah posisi, project/update URL tidak tersedia, versi/channel display ditebak. Config EAS berbasis environment, fingerprint runtime, versi native sebenarnya, dan preflight fail-closed ditambahkan. |
| F67 | P1 | Minimum iOS/Android mengunci web; kegagalan membuka toko bisa menutup gate; retry tidak fetch ulang. Gate dibatasi ke native, menggunakan URL platform yang benar, tetap terbuka jika link gagal, dan melakukan retry versi. |
| F68 | P2 | Tidak ada regression suite/CI untuk perubahan luas. Unit/hook/browser tests, check scripts, inventory generator, dan workflow GitHub ditambahkan. Workflow remote belum dijalankan karena tidak ada push dalam sesi ini. |

## Pemeriksaan API produksi yang benar-benar dilakukan

Payload publik berikut diamati melalui HTTPS dan dijadikan dasar normalisasi. Tabel ini **bukan** hasil authenticated business E2E ataupun audit header/CORS.

| Endpoint | Temuan penting |
|---|---|
| `/v1/public/app-version` | Record iOS/Android terpisah; minimum/latest 1.0.0, interval 21.600.000 ms. Web tidak boleh memakai minimum native. |
| `/v1/public/config` | `configs: []`. Tidak ada tautan terms/privacy resmi yang berhasil diverifikasi. |
| `/v1/public/banks` | `data.banks`, 14 bank; bukan array langsung. |
| `/v1/public/fee-schedule` | Struktur `feeSchedule`; standard 2,5%, Plus 0,5%, min Rp5.000/max Rp250.000; bukan tabel tier yang diasumsikan semula. |
| `/v1/public/subscription-plans` | `plan`, `period`, `features`; MONTHLY Rp29.000 dan ANNUAL Rp299.000 pada snapshot. Nilai tidak dibundel sebagai harga halaman. |
| `/v1/auth/otp-methods` | Yang ditawarkan hanya `WHATSAPP`; enum SMS bukan bukti SMS diaktifkan. |
| `/v1/help-center/categories?lang=id` | Success dengan array kosong. |
| `/v1/help-center/search?q=transaksi&lang=id` | Success dengan array kosong. |
| `/v1/public/exchange-rates` | Response menyatakan `source: fallback`, `isFallback: true`; tidak boleh disebut harga pasar live yang terverifikasi. |
| `/v1/health` | Service melaporkan up; queue mode disabled perlu dikonfirmasi dengan backend, bukan langsung dianggap outage. |
| `/v1/wallet` tanpa token | Error nested UNAUTHORIZED; membuktikan kebutuhan auth/error shape saja, bukan perilaku wallet terautentikasi. |

Sumber: [API Kahade](https://api.kahade.id), masing-masing path di tabel. Sebagian payload tersimpan di `tests/fixtures/public-responses.json`. OpenAPI online `/api-json` dan `/docs-json` tidak tersedia pada pemeriksaan; kontrak request menggunakan `docs/api/kahade-api-mobile.json` lokal.

Shell di sandbox mengalami kegagalan koneksi/TLS pada beberapa percobaan. Itu **bukan bukti API produksi sedang down**. Fetch payload publik berhasil melalui alat pengambilan halaman; kebijakan CORS/cookie deployment asli tetap belum diperiksa secara independen.

## Pengujian dan bukti visual

Tes otomatis mencakup URL/envelope/errors, retry safety, dedup, timeout/abort, concurrent refresh, account switching, partial storage rollback, web storage, unread state, pagination, stale query, uang, tanggal, lencana, dan multipart/presigned upload.

Browser regression juga menguji login gagal tanpa refresh berulang, deep link protected, wallet unknown status, virtualized history, batas metode dan double-submit top-up, pencarian terlambat, pemilihan artikel FAQ, role unknown, dokumen legal kosong, versi/OTA unsupported, serta recovery screen.

**Semua saldo, nama dan transaksi pada screenshot di bawah adalah fixture sintetis pengujian, bukan akun/aktivitas produksi.**

- [Wallet mobile light](screenshots/wallet-mobile-light.png)
- [Wallet mobile dark](screenshots/wallet-mobile-dark.png)
- [Wallet desktop](screenshots/wallet-desktop.png)
- [Top-up — inset dan fee selector](screenshots/topup-mobile.png)
- [Login mobile](screenshots/login-mobile.png)

Development Metro sempat kehabisan heap saat crawl panjang bersamaan dengan export. Verifikasi akhir dan live preview dipindahkan ke static production export; server preview tidak menjalankan SSR/bundling ulang untuk setiap navigasi. Tidak ada klaim bahwa perubahan ini mengukur atau memperbaiki seluruh penggunaan memori native.

## Pekerjaan/blocker yang masih terbuka

| ID | Prioritas | Yang masih diperlukan |
|---|---|---|
| R01 | Release blocker | Akun EAS yang sah, project ID/identifiers yang benar, remote environment, channel mapping, dan native runtime/build terpasang. `whoami` belum login; **OTA belum diterbitkan**. |
| R02 | Release blocker | Native build baru diperlukan karena RN/expo-application berubah. Versi 0.1.0 juga di bawah minimum produksi 1.0.0. Jangan memaksa bundle ini ke runtime lama atau menaikkan versi hanya untuk melewati gate. |
| R03 | P0/P1 | Akun staging yang diizinkan dan contoh/schema respons protected: quote/settlement fee, PIN/OTP, top-up gateway, transfer, withdrawal/cancel, refund/dispute, subscription, deletion, export, support, upload. Type assertion/adapter tidak menggantikan kontrak backend; sebagian model protected masih bertanda UNVERIFIED. |
| R04 | P1 | **29 temuan dependency masih ada**. Akar yang terdeteksi: image-size, decode-uri-component, uuid beserta rantai Expo/Metro/Xcode. Triage reachability dan upgrade/backport yang kompatibel diperlukan. Tidak dilakukan `npm audit fix --force` yang melompat SDK mayor. |
| R05 | P1 | Dokumen legal/tautan resmi perlu dipublikasikan dan field config dicocokkan dengan backend. State “belum tersedia” lebih jujur, tetapi bukan penyelesaian kebutuhan legal/consent untuk release. |
| R06 | P1 | Verifikasi perangkat fisik iOS/Android: font scaling, keyboard/notch, biometrik, SecureStore, kamera/galeri, push permission, WebRTC, background/resume, APK/IPA installation, OTA apply/rollback. Export Hermes tidak mengeksekusi fitur hardware. |
| R07 | P1 | CORS, HttpOnly cookie, SameSite/third-party-cookie policy, session expiry dan recovery pada domain deployment web asli. Browser regression memakai interception, bukan login produksi. |
| R08 | P1/P2 | Audit seluruh state kaya data belum selesai: thread chat/support/dispute, cursor/ordering/polling realtime, kalkulasi rinci response finansial, upload/proof, dan seluruh mutation workflow perlu dataset/kontrak yang sah. Tidak semua list kecil/detail telah dimigrasikan ke helper pagination baru. |
| R09 | P2 | Review manual TalkBack/VoiceOver, font besar native, kontras seluruh state, fokus/overlay dan keyboard pada seluruh halaman. Guard a11y statis + beberapa viewport web bukan audit aksesibilitas lengkap. Backlog design system lama tetap tersimpan di `BACKLOG.md`. |

## Cara melanjutkan

```bash
npm ci
npm run check
npm run audit:inventory
npx playwright install chromium
npm run test:e2e
npm run build:web
npm run preview:web
npm run ota:preflight
```

Panduan proyek/build/channel/runtime dan urutan rilis ada di [OTA.md](OTA.md). Jangan meminta/menaruh password, PIN, OTP, atau token ke chat/sumber aplikasi. Hubungkan EAS melalui lingkungan yang aman dan pakai akun pengujian backend dengan izin yang sesuai.

**Keputusan audit:** perbaikan frontend dan verifikasi lokal di atas sudah diterapkan; **belum menyatakan seluruh acceptance produksi terpenuhi**, dan **publikasi OTA tetap diblokir** sampai prasyarat serta verifikasi yang disebutkan selesai.
