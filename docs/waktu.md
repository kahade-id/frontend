# Domain waktu di frontend Kahade

Dokumen ini menetapkan **domain jam mana yang boleh dipakai di modul mana**.
Latar belakangnya temuan audit E-03 (dan A-02 sebelumnya): repo ini punya tiga
sumber waktu yang berbeda, dan mencampurnya dalam satu perbandingan menghasilkan
bug yang tidak terlihat di perangkat dengan jam akurat — countdown yang kolaps,
banner pemulihan yang hilang, atau penawaran yang tampak kedaluwarsa.

## Tiga domain

| Domain | Sumber | Dipakai untuk | Modul |
|---|---|---|---|
| **Perangkat** | `Date.now()` | hal-hal yang murni lokal & sesaat: TTL cache memori, throttle pemeriksaan versi, jendela ketuk tersembunyi, nama berkas, urutan daftar "terakhir dipakai" | `lib/query-cache.ts`, `lib/use-api-query.ts`, `app/_layout.tsx`, `components/ui/app-version-info-row.tsx`, `lib/telemetry.ts`, `lib/image-picker.ts`, `lib/ui-prefs.ts` (`usedAt`) |
| **Server** | `serverNow()` dari `lib/server-time.ts` | SEMUA tenggat/cooldown yang nilainya datang dari server atau dibandingkan dengan nilai server: cooldown OTP, kedaluwarsa QRIS/top-up, tenggat pengiriman, masa tunda pengingat ulasan, aksi menggantung | `app/withdraw.tsx`, `lib/ui-prefs.ts` (snooze), `lib/pending-actions.ts`, `components/pending-actions-banner.tsx`, `components/ui/countdown.tsx` |
| **Server (baku, ISO)** | timestamp ISO dari respons API | ditampilkan/dibandingkan apa adanya; JANGAN ditambah `Date.now()` | payload `expiresAt`/`deadlineAt`/`createdAt` dari adapter |

Aturannya sederhana: **satu perbandingan waktu harus berada di satu domain**.
Kalau nilai yang dibandingkan berasal dari server (ISO atau epoch hasil
`toEpochMs`), sisi "sekarang"-nya wajib `serverNow()`.

## Konsekuensi praktis

- `serverNow()` = `Date.now() + offset`, offset direkam dari header `Date`
  respons API (`lib/api/client.ts`). Tanpa satu pun respons API, offset = 0 dan
  `serverNow()` = jam perangkat — jadi tidak ada modul yang "macet" saat offline.
- Nilai yang disimpan lintas sesi di domain server (`ratingSnoozeUntil`,
  `pendingActions.expiresAt`) tetap dibaca di domain server, walaupun sesi
  berikutnya belum menerima respons API apa pun. Offset yang lebih tua dari
  24 jam diabaikan (lihat `lib/server-time.ts`), jadi pembacaan jatuh ke jam
  perangkat — konsekuensi yang diterima: menunda pengingat ulasan 3 hari tidak
  boleh bergantung pada sesi lama yang mungkin sudah tidak valid.
- Kalau sebuah modul memang sengaja memakai jam perangkat sementara nama
  variabelnya mengandung "until/deadline/expires/cooldown", tandai barisnya
  dengan komentar `waktu-perangkat:` beserta alasannya. Gate
  `npm run check:time-domains` menuntut penanda itu.

## Menegakkan aturan

`scripts/check-time-domains.mjs` (bagian dari `npm run check`) menolak:

1. `Date.now()` di modul yang wajib domain server (`lib/ui-prefs.ts`,
   `lib/pending-actions.ts`, `components/pending-actions-banner.tsx`) kecuali
   barisnya bertanda `waktu-perangkat:`.
2. Pola `until = Date.now()` / `until: Date.now()` / `deadline = Date.now()` /
   `cooldownUntil = Date.now()` di mana pun (kelas bug E-01: timestamp cooldown
   dibuat di jam perangkat lalu dibandingkan `Countdown` di jam server).
3. `until={Date.now()…}` yang diteruskan langsung ke komponen countdown.

Pelanggaran dilaporkan dengan berkas:baris dan saran perbaikannya, sehingga
reviewer tidak perlu tahu sejarah audit untuk memahami kenapa gate ini ada.
