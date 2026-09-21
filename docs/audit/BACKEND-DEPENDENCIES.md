# Kahade — Dependensi Backend & Infrastruktur (register tunggal)

Menutup sisi **eksternal** dari temuan audit `issues & improvement.md`.
Setiap item di sini SUDAH selesai di sisi klien (atau klien sengaja menahan
diri sampai kontrak tersedia); yang tersisa hanya bisa dikerjakan tim
backend/infra. Format: apa yang dibutuhkan → dampak → mitigasi klien saat
ini → kriteria terima saat backend siap.

Item keamanan/kredensial pihak ketiga (D-01/D-02/D-04/D-07/D-13/B-14/I-02/
I-04/K-06) TIDAK diduplikasi di sini — daftarnya di
`docs/SECURITY-CHECKLIST.md`.

---

## A-17 — Batas `note` transfer tidak ada di kontrak (🔵)

- **Butuh:** backend menambahkan aturan field `note` (maxLength, opsional) ke
  DTO `POST /v1/wallet/transfer` di OpenAPI spec.
- **Dampak:** `NOTE_MAX = 200` (`app/transfer.tsx`) adalah asumsi klien; bila
  server menerima/menolak batas lain, UI dan server tidak sinkron.
- **Mitigasi klien:** batas 200 ditegakkan di UI + komentar yang menunjuk
  dokumen ini. TIDAK dimasukkan ke `KNOWN_DEVIATIONS`
  (`scripts/check-api-body.mjs`) karena allowlist itu khusus *requestBody
  yang dikirim klien tapi tidak dideklarasikan spec* — di sini spec SUDAH
  mendeklarasikan requestBody, hanya kurang satu constraint; memasukkan
  entri ke sana akan menyalahartikan mekanismenya.
- **Kriteria terima:** jalankan `npm run gen:api` → `lib/api/constraints.ts`
  memuat aturan `note` di `TransferDto` → ganti `NOTE_MAX` dengan nilai
  generated → hapus entri ini.

## F-04 / K-05 — Endpoint agregat dashboard (🟡/🟠)

- **Butuh:** `GET /v1/orders/summary` menambah `completedCount`, atau satu
  endpoint agregat dashboard (saldo + statistik + order aktif + completed
  count dalam satu respons).
- **Dampak:** Home melakukan 5 request paralel per buka/fokus; salah
  satunya (`home-completed-count`) memanggil `listOrders({limit:1,
  status:"COMPLETED"})` hanya untuk membaca `meta.total`.
- **Mitigasi klien:** kelima query memakai `useApiQuery` dengan dedupe
  GET + cache TTL (`lib/api/client.ts`), dan `completedCount` dihitung
  dari angka yang BENAR (bukan halaman pertama).
- **Kriteria terima:** adapter baru di `lib/api/`, Home turun menjadi
  ≤ 2 request per fokus; tambah uji di `tests/hooks.test.tsx`.

## K-01 / I-10 — Staging backend untuk verifikasi runtime (🔴/🟡)

- **Butuh:** lingkungan staging yang dapat diakses (URL + kredensial uji +
  data seed) agar `npm run verify:api` tidak lagi default `localhost:3000`.
- **Dampak:** status jujur proyek tetap *"source verified, runtime
  unverified"* untuk aplikasi escrow; 8 deviasi spec yang diketahui tidak
  pernah terkonfirmasi.
- **Mitigasi klien:** `scripts/verify-live-api.mjs` siap pakai (read-only),
  gate `check:api` membandingkan adapter ↔ spec di tiap CI.
- **Kriteria terima:** `EXPO_PUBLIC_API_URL=<staging> npm run verify:api`
  hijau; jalankan per deploy (smoke read-only).

## K-02 — Chat realtime (WebSocket) (🟠)

- **Butuh:** kontrak WS/SSE untuk chat (endpoint, auth handshake, bentuk
  frame, aturan reconnect/resume).
- **Dampak:** `app/chat/[roomId].tsx` polling tiap 8 detik (`CHAT_POLL_MS`)
  — baterai & latensi kalah dari WS.
- **Mitigasi klien:** polling hanya saat layar fokus, berhenti saat blur;
  lapisan transport (`lib/api/client.ts`) tidak perlu berubah untuk
  menambah kanal WS nanti.
- **Kriteria terima:** hook `useChatSocket` di `lib/`, polling tinggal
  fallback; uji reconnect di `tests/hooks.test.tsx`.

## J-01 — Fee breakdown transfer/withdraw (💡)

- **Butuh:** kontrak fee untuk transfer sesama dompet & withdraw (endpoint
  quote fee, atau field `fee` di respons preview). Spec saat ini hanya
  memberi biaya admin untuk top-up (sudah ditampilkan `app/topup.tsx`).
- **Dampak:** transfer/withdraw tidak bisa menampilkan biaya sebelum
  konfirmasi secara JUJUR — menampilkan angka karangan lebih buruk daripada
  tidak menampilkan (prinsip yang sama dengan J-10 untuk ekspor PDF).
- **Mitigasi klien:** tanpa kontrak fee, UI sengaja tidak menebak; bila
  backend mengirim `fee` di respons, tambahkan baris rincian di sheet
  konfirmasi (pola sudah ada di topup).
- **Kriteria terima:** endpoint/field fee tersedia → tampilkan breakdown
  nominal + biaya + total diterima sebelum PIN.

## J-13 — Halaman status/health publik (💡)

- **Butuh:** keputusan produk + hosting halaman status publik; backend
  sudah punya 4 endpoint Health di spec (`docs/audit/API-ENDPOINT-AUDIT.md`
  §2.2) yang belum dipakai aplikasi.
- **Dampak:** saat insiden backend, tiket support naik karena pengguna
  tidak tahu "apakah pembayaran sedang gangguan?".
- **Mitigasi klien:** error surface in-app sudah memisahkan kegagalan
  jaringan vs server (F-02 + `lib/telemetry.ts`); halaman status adalah
  fitur baru, bukan perbaikan bug.
- **Kriteria terima:** endpoint health disetujui untuk publik → layar
  status in-app (read-only) + tautan ke halaman status web.

## K-07 — Sentry / crash reporting (🟡)

- **Butuh:** akun + DSN Sentry (atau penyedia lain); keputusan sampling.
- **Mitigasi klien:** `lib/telemetry.ts` adalah titik sambung tunggal
  (`installTelemetry`) — pemasangan provider hanya menyentuh satu file.
- **Kriteria terima:** DSN di env → `installTelemetry` memanggil SDK →
  crash & error teragregasi terlihat di dashboard.

## J-03 — Action center sticky di detail order (💡)

- **Butuh:** tidak ada; ini murni keputusan desain klien. Ditunda sebagai
  pekerjaan redesign terencana (bukan dependensi backend) — dilacak di
  `docs/audit/REFACTOR-PLAN.md` agar tidak hilang.
- **Mitigasi klien:** `app/order/[id].tsx` sudah menghitung
  `canPay/canShip/…` terpusat; memindahkan aksi ke sticky bar adalah
  refactor presentasi dengan risiko sedang pada layar escrow terpenting.
