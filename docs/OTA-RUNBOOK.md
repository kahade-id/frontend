# Kahade — Runbook EAS Update (OTA)

Menutup temuan audit **I-07** (`issues & improvement.md`): `runtimeVersion`
berpolicy `fingerprint` + `checkAutomatically: ON_LOAD`, tetapi sebelumnya
tidak ada prosedur rollback yang teruji. Dokumen ini adalah prosedur resminya.

Preflight lokal sebelum menyentuh OTA:

```bash
npm run check:ota   # scripts/check-ota.mjs — projectId, URL updates, policy fingerprint,
                    # versi x.y.z + cek minimum-versi LIVE (butuh jaringan ke API)
npm run check       # seluruh gate statis + 175 test
```

---

## 1. Topologi channel & branch

`eas.json` memetakan tiga channel build (`development`, `preview`,
`production`). Untuk OTA, satu **branch update** dipakai per lingkungan:

| Channel EAS  | Branch update yang disarankan | Isi                                          |
| ------------ | ----------------------------- | -------------------------------------------- |
| `preview`    | `preview`                     | kandidat rilis; smoke test OTA dilakukan di sini |
| `production` | `production`                  | hanya menerima update yang lolos preview     |

Prinsip: **tidak ada update yang pertama kali muncul di `production`.**
EAS Update tidak punya staged rollout persentase bawaan — mitigasinya adalah
alur preview → production ini, bukan angka rollout.

## 2. Menerbitkan update

```bash
# 1. pastikan working tree bersih & commit yang diterbitkan sudah di git
git status

# 2. terbitkan ke branch preview dulu
eas update --branch preview --message "deskripsi perubahan"

# 3. verifikasi artefak
eas update:list --branch preview
eas update:view <updateId>   # cek fingerprint + runtimeVersion yang ikut

# 4. uji di perangkat preview (APK channel preview, buka app → update
#    terdeteksi ON_LOAD → tutup-buka sekali lagi untuk memakainya)

# 5. baru promosikan ke production
eas update --branch production --message "deskripsi perubahan"
```

Catatan penting:

- **Fingerprint guard.** `runtimeVersion.policy: fingerprint` berarti update
  OTA HANYA diterima build dengan fingerprint native yang sama. Perubahan
  dependensi native/config plugin mengubah fingerprint → update tidak mendarat
  (benar), dan jalurnya adalah build store baru, bukan OTA.
- Jangan menerbitkan dari working tree kotor; `eas update` mengunggah state
  lokal, dan git kehilangan jejak kode yang berjalan di perangkat pengguna.

## 3. Rollback (respons insiden)

Dua cara, pilih sesuai kondisi:

**A. Re-publish kode terakhir yang diketahui baik (paling umum):**

```bash
git checkout <tag/commit terakhir yang baik>
eas update --branch production --message "rollback ke <commit>"
```

Perangkat akan memuat ulang saat app dibuka berikutnya (`ON_LOAD`).

**B. Pindahkan pointer channel (bila branch production terlanjur kotor):**

```bash
eas channel:list
eas channel:edit production --branch <branch-lama-yang-baik>
```

Verifikasi rollback:

```bash
eas update:list --branch production   # update teratas = rollback
```

Lalu uji di satu perangkat production sungguhan sebelum mengumumkan selesai.

## 4. Definisi "update OTA yang baik" (smoke test minimum)

Dijalankan di profil `preview` sebelum promosi (perangkat Android fisik):

1. Cold start → tidak ada crash; layar Home tampil < 3 detik.
2. Login → OTP masuk; sesi bertahan setelah app ditutup.
3. Satu alur uang read-only: buka Riwayat Dompet, angka muncul.
4. Push notification masih terdaftar (cek token di Settings → Notifikasi).
5. Deep link `kahade://` membuka app (bila terpasang).
6. Web (PWA) TIDAK memakai OTA — deploy web = `npm run build:web` + hosting;
   prompt "Versi baru tersedia" (I-06) menangani cache SW.

## 5. Setelah insiden

- Isi kronologi di issue tracker: updateId buruk, durasi terpasang, jumlah
  perangkat terdampak (`eas update:view`), penyebab.
- Bila penyebabnya celah gate statis: tambahkan kasus uji di `npm test` /
  `npm run test:components` sebelum menerbitkan ulang.
- Observability nyata (Sentry) masih dependensi eksternal — lihat
  `docs/audit/BACKEND-DEPENDENCIES.md` (K-07).
