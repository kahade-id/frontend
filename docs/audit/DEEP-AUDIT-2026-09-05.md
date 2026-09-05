# Audit mendalam frontend — reuse komponen, hardcode, dan kualitas layar

**Tanggal:** 5 September 2026 · **Lingkup:** seluruh `app/`, `components/`, `lib/`
**Baseline:** commit `9c48b61`, dengan `npm run check` sudah hijau sebelum audit ini dimulai.

Audit sebelumnya ([REPORT.md](REPORT.md), [BACKLOG.md](BACKLOG.md)) menutup token
desain, aksesibilitas statis, dan kontrak API. Ketiganya sudah dijaga skrip.
Yang **tidak dijaga siapa pun** adalah pertanyaan yang diminta di sini: apakah
layar benar-benar memakai lapisan yang sudah dibangun, dan apakah masih ada
nilai yang ditulis tangan padahal sumbernya sudah ada.

Jawabannya: tidak, dan ya. Repo ini punya design system 207 komponen dan dua
hook data yang matang — tetapi mayoritas route menyalin ulang blok yang sama
alih-alih memakainya, dan 20% komponen tidak pernah diimpor sama sekali.

Semua angka di bawah dapat direproduksi dengan `npm run check:screens`.

---

## 1. Temuan utama

### T1 (P1) — Mode gelap sudah selesai dibangun tetapi tidak bisa dipilih pengguna

Seluruh lapisan dark mode ada dan terjaga: palet `dark` penuh di
`lib/tokens.ts`, `darkMode: "class"` di Tailwind, `<ThemeProvider>` yang
mempersistenkan preferensi ke SecureStore, `<ThemeModeSelector>` lengkap dengan
`accessibilityRole="switch"`, splash gelap di `app.json`, plus dua aturan
`check:tokens` (#9, #13) yang menjaga kelengkapannya.

Yang hilang hanya satu hal: **tidak ada satu pun layar di `app/` yang merender
selector itu.** `preference` karena itu selamanya `"system"`. Pekerjaan dark
mode yang sudah diverifikasi skrip tidak pernah sampai ke pengguna.

**Perbaikan.** Route baru `app/appearance.tsx` (Tampilan) + `ROUTES.appearance`
+ entri menu "Tampilan & notifikasi" di Pengaturan. Layar ini sengaja TIDAK
memakai `<DataScreen>`: preferensi tema adalah state perangkat, bukan profil
server, jadi tidak ada fetch yang perlu di-retry.

### T2 (P1) — Layar Privasi menampilkan default hardcode sebagai fakta

`app/privacy-settings.tsx` menginisialisasi state dengan
`{ profileVisible: true, showOnlineStatus: true }`. Saat `GET /v1/settings/privacy`
gagal, layar hanya memunculkan toast (yang menghilang sendiri) lalu **merender
default itu sebagai pengaturan Anda**. Pengguna membaca "Profil terlihat
publik: aktif" tanpa nilai itu pernah dibaca dari server.

Ini bukan bug tampilan biasa: layar privasi membuat klaim yang salah tentang
data pribadi. `app/language.tsx` dan `app/account-type.tsx` punya pola identik
dengan taruhan lebih rendah (`"id"`, `"PERSONAL"`).

**Perbaikan.** Ketiga layar memakai `useApiQuery` + `<DataScreen>`; kegagalan
muat menghasilkan `<ErrorState>` + tombol "Coba lagi", dan tidak ada nilai
default yang dirender sebagai fakta.

### T3 (P1) — Kegagalan metode OTP di Register tidak punya jalan keluar

`use-otp-methods.ts` sudah fail-closed dengan benar: kanal yang tidak
ditawarkan backend tidak pernah dijadikan fallback hardcode. `register.tsx`
menghitung `methodsError` dan `refetchMethods` — dan docblock-nya mendeskripsikan
`<ErrorState compact … onRetry={refetchMethods}>` sebagai bagian dari struktur
layar.

Komponen itu **tidak pernah dirender**. Bila `GET /v1/auth/otp-methods` gagal
atau mengembalikan daftar kosong, pengguna melihat area "Kirim kode melalui"
yang kosong, lalu tombol "Kirim Kode" menolak diam-diam. Registrasi buntu tanpa
penjelasan.

Ini lolos review karena `noUnusedLocals` mati (lihat T6): dua variabel mati itu
adalah satu-satunya jejak fitur yang hilang.

**Perbaikan.** `<ErrorState>` dirender; `noUnusedLocals` dinyalakan agar sisa
refactor berikutnya gagal di CI.

### T4 (P2) — 45 dari 81 layar merakit sendiri siklus muat/refresh

Hanya 11 layar memakai `useApiQuery`/`usePaginatedQuery` (kini 23). Sisanya menyalin:

```tsx
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
const [refreshing, setRefreshing] = useState(false)
const fetchAll = useCallback(async () => {
  setLoading(true); setError(null)
  try { setItems(await api.x.y()) }
  catch { setError("Gagal memuat …") }        // ← pesan backend dibuang
  finally { setLoading(false) }
}, [])
const handleRefresh = async () => { setRefreshing(true); await fetchAll(); setRefreshing(false) }
```

Tiga akibat yang bisa diamati:

1. **Tarik-untuk-refresh mengosongkan layar.** `handleRefresh` memanggil
   fetcher yang sama, yang menyetel `setLoading(true)` — sehingga daftar
   diganti `<LoadingScreen>` (logo full-screen) selama refresh. Pemisahan
   `loading`/`refreshing` yang sudah ada di hook justru dibatalkan di sini.
2. **Tidak ada abort.** Tidak ada `AbortController`; respons lambat dari
   permintaan lama tetap menulis state setelah layar berganti filter atau
   ditinggalkan.
3. **Pesan backend dibuang.** 34 `setError("…")` literal. Pengguna yang ditolak
   karena rate limit, KYC belum selesai, atau state order berubah membaca
   kalimat yang sama dengan pengguna yang kehilangan sinyal — padahal
   `userMessage(err)` di `lib/api/errors.ts` dibangun persis untuk ini.

### T5 (P2) — Kerangka layar disalin 49 kali, bukan dipakai ulang

`useSafeAreaInsets()` + `<Screen edges={["top"]} padded={false}>` + `<Header>` +
`<PullToRefresh contentContainerClassName="px-6" scrollViewProps={{ contentContainerStyle:
{ paddingBottom: insets.bottom + tokens.space[8] } }}>` + rantai
`loading ? … : error ? … : empty ? … :` muncul di 49 berkas.

Menyalinnya membuat empat keputusan UX menjadi tidak konsisten: urutan
pengecekan state, inset bawah (satu layar yang lupa akan menyembunyikan baris
terakhir di balik home indicator), padding konten, dan pemisahan refresh/load.

**Perbaikan.** `components/ui/data-screen.tsx` — `<DataScreen>` mengunci
kerangka itu menjadi satu komponen. `state` sengaja bertipe struktural (bukan
tipe hook tertentu) supaya `useApiQuery`, `usePaginatedQuery`, atau state lokal
bisa dipasang tanpa adapter.

### T6 (P2) — 64 simbol mati lolos typecheck

`tsconfig.json` tidak menyalakan `noUnusedLocals`/`noUnusedParameters`.
Akibatnya 64 impor/konstanta/state mati ikut ke review, dan — seperti T3 —
sebagian di antaranya adalah satu-satunya jejak fitur yang tidak jadi terpasang:

| Berkas | Simbol mati | Artinya |
|---|---|---|
| `app/(auth)/register.tsx` | `methodsError`, `refetchMethods`, `ErrorState` | Pemulihan kegagalan OTP tidak terpasang (T3) |
| `app/(tabs)/notifications.tsx` | `NotifSkeletonRow`, `SKELETON_COUNT` | Skeleton sebentuk baris ditulis, lalu daftar dipindah ke `<PaginatedList>` yang hanya punya skeleton kartu |
| `app/create-transaction.tsx` | `counterpartMissing`, `counterpartInvalid` | Duplikat logika yang sudah ada di `canSubmit` |
| `app/(tabs)/wallet.tsx` | 6 impor + `insets` | Sisa migrasi ke `<PaginatedList>` |
| 9 layar | `EmptyState` diimpor tanpa dirender | Sisa refactor |

**Perbaikan.** 64 → 0, lalu kedua flag dinyalakan permanen.

### T7 (P2) — 38 komponen UI tidak pernah diimpor

19% dari `components/ui` (38 dari 207) tidak dirujuk satu pun berkas di `app/`,
`components/`, `lib/`, atau `tests/`. Bukan sekadar berat: itu pekerjaan design
system yang tidak sampai ke pengguna, dan ia membusuk — prop/token bisa berubah
tanpa ada call site yang memaksanya ikut.

Sebagian jelas layak dipakai dan menandai fitur yang hilang:
`theme-toggle-button` (T1), `banner`, `result-state`, `tabs`,
`two-factor-method-selector`, `swipeable-list-item`, `count-badge`,
`sensitive-text`, `menu-list`, `kyc-document-viewer`, `dispute-evidence-item`,
serta trio WebRTC `incoming-call-prompt` / `in-call-controls-bar` / `presence`
yang tidak punya satu pun layar panggilan.

**Perbaikan sekarang:** `theme-toggle-button` dipakai (T1). Sisanya masuk
baseline `S5` yang hanya boleh mengecil.

### T8 (P2) — Hardcode yang tersisa di JSX

| Lokasi | Hardcode | Sumber yang benar |
|---|---|---|
| `app/vouchers.tsx` | `router.push({ pathname: "/create-transaction", … })` | `ROUTES.createTransactionWithVoucher()` (ditambahkan) |
| `app/vouchers.tsx` | `3 * 86400_000` inline di prop `expiresSoon` | konstanta `EXPIRES_SOON_MS` bernama |
| `app/withdrawal-schedules.tsx` | `presets={[100_000, 500_000, 1_000_000]}` | `AMOUNT_PRESETS.withdraw` (bersebelahan dengan `AMOUNT_LIMITS` hasil generate OpenAPI) |
| `app/withdrawal-schedules.tsx` | nominal minimum jadwal tidak divalidasi | `AMOUNT_LIMITS.withdraw.minimum` |
| `app/(tabs)/settings.tsx` | `"Gagal memuat profil."` | `userMessage(err)` |

Yang **tidak** ditemukan (sudah bersih sejak audit sebelumnya): kredensial,
token, PIN, fixture API, URL selain `PRODUCTION_API_URL`, warna/spacing literal
di luar token, dan `as any`.

### T9 (P2) — UI state dirakit manual meski komponennya ada

| Lokasi | Sebelumnya | Sekarang |
|---|---|---|
| `app/(tabs)/settings.tsx` | `<View>` + `<Text tone="danger">` + `<Button>` — tanpa `accessibilityRole="alert"`, tanpa live region, beda bentuk dari layar lain | `<ErrorState compact onRetry>` |
| `app/notification-preferences.tsx` | `<Text>Memuat preferensi…</Text>` dan `<Text tone="danger">{error}</Text>` — gagal-muat terlihat sama dengan "memang kosong", tanpa retry | `<DataScreen>` (LoadingScreen + ErrorState) |
| `app/(tabs)/settings.tsx` | judul grup `<Text variant="label">` | `<SectionHeader level="h3">` (dapat `accessibilityRole="header"`) |
| `app/(tabs)/notifications.tsx` | `<PaginatedList>` memakai skeleton kartu `h-24` untuk baris notifikasi yang jauh lebih rapat → daftar melompat saat data tiba | prop baru `loadingPlaceholder` + `NotifSkeletonRow` yang sudah ada |

### T10 (P2) — Optimistic update tanpa rollback

`app/discover.tsx` menandai `following: true` setelah request sukses saja,
tetapi kegagalan hanya memunculkan toast tanpa mengembalikan state tombol pada
jalur optimistic-nya. `notification-preferences.tsx` melakukan rollback dengan
`!next[key]` (negasi nilai baru), bukan nilai server sebelumnya — dua hal yang
berbeda ketika satu aksi mengubah lebih dari satu key.

**Perbaikan.** Rollback di kedua layar mengembalikan nilai server terakhir yang
diketahui, dan pesannya menyertakan `userMessage(err)`.

---

## 2. Yang diubah

### Lapisan baru

| Berkas | Isi |
|---|---|
| `components/ui/data-screen.tsx` | `<DataScreen>` — kerangka layar berbasis data (T5) |
| `app/appearance.tsx` | Layar Tampilan; pintu masuk mode gelap (T1) |
| `scripts/check-screens.mjs` | Audit statis + ratchet baseline (lihat §3) |

### Layar yang dimigrasikan ke `useApiQuery` + `<DataScreen>`

`favorites`, `trust-score`, `blocked-users`, `badges`, `disputes`, `vouchers`,
`notification-preferences`, `privacy-settings`, `language`, `account-type`,
`discover`, `support` — 12 layar. Masing-masing memperoleh pembatalan request,
pesan galat backend, dan refresh tanpa mengosongkan layar.

### Perbaikan terarah

`register` (T3), `settings` (T1, T9, T8), `notifications` (T9),
`paginated-list` (prop `loadingPlaceholder`), `withdrawal-schedules` (T8),
`routes.ts` (dua entri baru), `tsconfig.json` (T6), dan 64 simbol mati dihapus.

---

## 3. Penjagaan agar tidak balik lagi

`npm run check:screens` (ikut dalam `npm run check`, yang sudah dijalankan CI):

| Aturan | Yang dideteksi | Sisa |
|---|---|---|
| S1 | Layar merakit sendiri state async | 33 |
| S2 | `setError("…")` literal menggantikan pesan backend | 25 |
| S3 | Kerangka Screen+Header+PullToRefresh disalin manual | 36 |
| S4 | Route literal di `app/` | **0** |
| S5 | Komponen UI tanpa satu pun pemakaian | 38 |

Setiap aturan punya baseline eksplisit berisi berkas yang masih melanggar.
Skrip gagal bila ada pelanggar **baru** (regresi) **dan** bila ada berkas
baseline yang sudah lolos tapi belum dicoret (baseline basi). Jadi angka di
kolom "sisa" hanya bisa turun — memigrasikan satu layar mengharuskan namanya
dihapus dari daftar di `scripts/check-screens.mjs`.

Komentar dibuang sebelum pencocokan: docblock di repo ini sering mengutip pola
lama sebagai catatan audit, dan mencocokkan teks komentar akan menandai berkas
yang justru sudah diperbaiki.

---

## 4. Verifikasi yang dijalankan

```
npm run check          # typecheck (kini + noUnusedLocals/Parameters),
                       # check:tokens, check:a11y, check:screens, check:api,
                       # 122 unit/hook test  → semua lolos
npm run audit:inventory # 80 screen, 231 adapter call, semua cocok spec
npm run build:web       # export produksi berhasil; /appearance ikut ter-export
npm run preview:web     # 0.0.0.0:8081; /appearance dan /favorites → HTTP 200
```

**Tidak dijalankan di sesi ini:** `npm run test:e2e`. Unduhan browser Playwright
gagal di sandbox (`ECONNRESET` ke `cdn.playwright.dev`); tidak ada perubahan
pada `tests/e2e/`, dan workflow CI tetap menjalankannya. Verifikasi visual
untuk layar `/appearance` dan 12 layar yang dimigrasikan **belum dilakukan di
browser** — statusnya lolos typecheck, lolos export produksi, dan lolos audit
statis, bukan lolos uji tampilan.

---

## 5. Yang masih terbuka

1. **32 layar sisa** pada S1/S2/S3. Migrasi berikutnya paling baik dimulai dari
   yang paling banyak dilihat: `order-links`, `transaction-templates`,
   `ratings`, `questions`, `showcase`, `bank-accounts`, `referral`, `reports`.
   `ratings.tsx` perlu perhatian ekstra — paginasinya dirakit tangan dan
   `fetchRatings` bergantung pada `me` sementara effect-nya di-`eslint-disable`
   agar hanya jalan saat mount.
2. **38 komponen mati.** Perlu keputusan per komponen: pasang (mis. `banner`
   untuk peringatan KYC/email belum terverifikasi, `count-badge` untuk badge
   tab, `two-factor-method-selector` di `two-factor.tsx`) atau hapus. Trio
   WebRTC menandai fitur panggilan yang tidak punya layar sama sekali —
   itu keputusan produk, bukan kebersihan kode.
3. **Blocker dari audit sebelumnya tetap berlaku** apa adanya: R01–R09 di
   [REPORT.md](REPORT.md). Audit ini tidak menyentuh EAS/OTA, verifikasi
   perangkat fisik, CORS/cookie deployment, maupun schema response protected —
   dan tidak mengubah statusnya.
