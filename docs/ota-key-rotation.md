# Rotasi Private Key OTA Code Signing — Kahade Frontend

> Status kunci saat ini (2026-09-28): `app.json` → `updates.codeSigningCertificate`
> = `./certificates/certificate.pem`, metadata `keyid: "main"`, `alg: "rsa-v1_5-sha256"`.
> Sertifikat (publik) ikut di Git. **Private key TIDAK BOLEH di Git.**

Kenapa dokumen ini ada: EAS Update code signing (SEC-401) membuat setiap
bundle OTA ditandatangani dengan private key milik kita; aplikasi hanya
menerapkan update yang tanda tangannya cocok dengan sertifikat yang
**tertanam di binary**. Kalau private key hilang/bocor/kedaluwarsa tanpa
prosedur, konsekuensinya: tidak bisa menerbitkan OTA sama sekali, atau
lebih buruk — penyerang yang memegang key bisa menerbitkan update
berbahaya yang terinstal otomatis (`checkAutomatically: ON_LOAD`).

## 1. Lokasi key

| Artefak | Lokasi | Di Git? |
|---|---|---|
| Sertifikat (`certificate.pem`) | `frontend/certificates/certificate.pem` | YA (publik, tidak sensitif) |
| Public key (`public-key.pem`) | di samping private key | Tidak sensitif, boleh di vault |
| **Private key (`private-key.pem`)** | **di luar repo** — konvensi Expo: direktori `--key-output-directory` saat generate (mis. `../keys/private-key.pem`), atau path yang diberikan ke `eas update --private-key-path` | **TIDAK PERNAH** |

Aturan penyimpanan private key (setara rahasia produksi lain):

- Simpan di password manager / KMS / vault offline yang aksesnya tercatat.
- Minimal 2 pemegang terpisah (founder + 1 ops tepercaya) — jangan single point of failure.
- File permission `600`, tidak di-share lewat chat/email tanpa enkripsi.
- Backup terenkripsi di media offline (seperti passphrase backup DB).

> ⚠️ **Aksi terbuka:** lokasi & pemegang private key `keyid "main"` saat ini
> belum tercatat di dokumen mana pun. Pastikan ia tersimpan di vault offline
> (minta konfirmasi ke pemegang terakhir yang menjalankan `codesigning:generate`).

## 2. Kapan harus rotasi

1. **Rutin / best practice** — berkala (mis. tiap 1–2 tahun), atau sebelum
   `certificate-validity-duration-years` habis. Binary dengan sertifikat
   kedaluwarsa **menolak semua update baru**.
2. **Key bocor/tereexpose** — rotasi DARURAT (lihat §4).
3. **Key hilang** — rotasi DARURAT (lihat §4).

## 3. Langkah rotasi (rutin)

> Prinsip: sertifikat tertanam di binary saat build, jadi rotasi key =
> keypair baru + **build APK baru**. Tidak ada jalan memutar.

1. **Backup key lama.** Simpan `private-key.pem` + `certificate.pem` lama di
   vault dengan label `ota-key-main-<tanggal>-retired`. Jangan dihapus —
   masih dibutuhkan selama masa transisi (§3.6).
2. **Generate keypair baru** (di mesin tepercaya, direktori di luar Git):
   ```bash
   npx expo-updates codesigning:generate \
     --key-output-directory ../keys-baru \
     --certificate-output-directory ./certificates \
     --certificate-validity-duration-years 5 \
     --certificate-common-name "Kahade"
   ```
   Ini menimpa `certificates/certificate.pem` dengan sertifikat baru.
   Simpan `../keys-baru/private-key.pem` sesuai §1.
3. **(Opsional tapi disarankan) ganti `keyid`** di `app.json`
   (`updates.codeSigningMetadata.keyid`, mis. `"main-2026"`) — membantu
   debugging: dari metadata update ketahuan key mana yang menandatangani.
4. **Konfigurasi ulang proyek:**
   ```bash
   npx expo-updates codesigning:configure \
     --certificate-input-directory ./certificates \
     --key-input-directory ../keys-baru
   ```
5. **Build APK/AAB baru** (EAS managed build). Karena `runtimeVersion`
   memakai policy `fingerprint`, perubahan sertifikat otomatis menghasilkan
   runtime version baru — binary lama dan baru **tidak akan saling
   tertukar update** (inilah yang membuat transisi aman).
6. **Masa transisi — publish ganda bila perlu.** Binary lama (sertifikat
   lama) menolak update bertanda tangan key baru, dan sebaliknya. Selama
   masih banyak pengguna di binary lama dan ada perbaikan OTA kritis:
   publish update yang sama dua kali — sekali dengan key lama
   (`--private-key-path ../keys-lama/private-key.pem`) untuk runtime lama,
   sekali dengan key baru untuk runtime baru. Setelah adopsi binary baru
   ~penuh (pantau di EAS dashboard), hentikan publish dengan key lama,
   lalu arsipkan key lama (tetap simpan backup-nya).
7. **Verifikasi:** instal APK baru → `eas update` dengan key baru →
   pastikan update terunduh & teraplikasi; cek `node scripts/check-ota.mjs`
   tetap hijau (SEC-401).

## 4. Checklist darurat

### 4a. Private key BOCOR (tereexpose ke pihak tak berotoritas)

Anggap penyerang bisa menerbitkan update berbahaya yang diterima semua
binary saat ini (ON_LOAD). Bertindak sebagai insiden keamanan:

- [ ] **Cabut akses** yang menyebabkan bocor (revoke token/akses mesin,
      rotasi kredensial EAS/GitHub yang ikut terexpose bila ada).
- [ ] **Rotasi segera** mengikuti §3 (keypair baru + `keyid` baru +
      build APK baru). Ini satu-satunya "revoke": binary baru hanya
      percaya sertifikat baru.
- [ ] **Dorong pengguna update binary** secepatnya (banner in-app,
      notifikasi, Play Store staged rollout dipercepat). Binary lama
      tetap rentan sampai diganti.
- [ ] Pertimbangkan **menonaktifkan channel production** sementara
      (`eas channel:pause` / batasi rollout) bila ada indikasi update
      jahat sudah diterbitkan — lalu audit update yang terbit sejak
      perkiraan waktu bocor (`eas update:list`).
- [ ] Catat insiden: kapan, bagaimana bocor, siapa terdampak, apa yang
      dirotasi. Post-mortem → perbaiki prosedur penyimpanan (§1).

### 4b. Private key HILANG (tidak bocor, tapi tidak ketemu)

- [ ] Cari dulu di semua lokasi wajar: mesin build terakhir, backup
      vault, password manager pemegang sebelumnya.
- [ ] Bila benar-benar hilang: **tidak ada cara memulihkan** — ikuti
      rotasi §3. Konsekuensi: selama belum ada binary baru, **tidak bisa
      menerbitkan OTA** untuk binary saat ini (publish butuh private key).
      Perbaikan kritis harus lewat rilis binary baru via Play Store.
- [ ] Setelah rotasi, tetapkan 2 pemegang + backup offline (§1) agar
      tidak terulang.

## 5. Larangan

- Jangan commit `private-key.pem` (atau `*.pem` berisi private key) ke Git
  — tidak di repo ini, tidak di repo lain, tidak di gist.
- Jangan kirim private key lewat chat/email tanpa enkripsi.
- Jangan memakai key yang sama untuk proyek/app lain.
- Jangan menghapus backup key lama sebelum masa transisi selesai.

## Referensi

- Expo: "End-to-end code signing with EAS Update" (`docs.expo.dev/eas-update/code-signing/`)
  — prosedur `codesigning:generate`, `codesigning:configure`, dan key rotation.
- Gate lokal: `node scripts/check-ota.mjs` (SEC-401 — code signing wajib aktif).
- Konfigurasi: `app.json` → `expo.updates` (`url: https://u.expo.dev/<projectId>`,
  `checkAutomatically: ON_LOAD`, `runtimeVersion.policy: fingerprint`).
