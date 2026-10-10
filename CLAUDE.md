# CLAUDE.md — Kahade Frontend

> Panduan wajib untuk setiap sesi Claude Code di repo ini. Baca seluruh file ini sebelum menyentuh kode.

---

## 1. Apa itu Kahade

**Satu kalimat resmi:** "Kahade adalah aplikasi jual-beli pengguna ke pengguna yang tampilannya seperti media sosial."

- **Tagline:** Jual Beli Semudah Scroll Medsos
- **Perusahaan:** PT Kawal Hak Dengan Aman
- **Target:** Gen Z Indonesia (thrift, sneakers, K-pop merch, jasa, produk digital)
- **Launch:** 8 Desember 2026 | **Status:** Early access Android via kahade.id/download/android

**Model bisnis:**
- Biaya transaksi 2,5% (min Rp2.500, maks Rp250.000) — dibayar buyer, eksplisit di ringkasan
- Kahade Plus: Rp99rb/bln atau Rp899rb/thn (diskon 50% fee, kuota gratis Rp990rb/periode, prioritas CS, badge Plus)
- 1000 transaksi pertama GRATIS biaya

**Kompetitor:** TikTok Shop, Shopee, jual-beli via DM manual.

**Whitepaper = source of truth** untuk semua keputusan produk, bahasa, dan positioning.

---

## 2. Aturan Bahasa Produk (WAJIB)

| Dilarang | Ganti dengan |
|---|---|
| escrow, rekber, rekening bersama | (jangan sebut — itu hal normal semua marketplace) |
| ditahan, penahanan (untuk dana) | (jangan sebut) |
| "Beli Sekarang" | lihat aturan tombol di bawah |

Kosakata baku bila dana perlu disebut: "Dana disimpan aman oleh Kahade", "Dana aman di Kahade", saldo "Dalam transaksi" (`lib/labels/escrow.ts`), "Dana dibekukan" (sengketa). Dokumen legal memakai istilah "Pengamanan Dana".

**Aturan tombol:**
- Membeli dari produk/etalase → **"Beli via Kahade"** (tombol beli resmi)
- Memulai transaksi umum tanpa produk (mis. dari profil, menu buat) → **"Buat Transaksi"**

---

## 3. Standar Desain

- **Filosofi:** Sebersih website Apple. Minimalis, hanya yang penting. TIDAK banyak teks di sana-sini.
- **Referensi UX:** Threads / Instagram / TikTok / WhatsApp / Telegram.
- **Butuh penjelasan panjang = desain belum intuitif.** Bantuan harus terpusat, bukan teks penjelasan tersebar.
- **UI harus optimistis** dengan rollback saat backend gagal. Contoh: pin pesan langsung update di frontend, revert bila API gagal.
- **Error message:** spesifik dan jujur. "Terjadi kesalahan" untuk kondisi offline = BUG. Bedakan: timeout → "Koneksi lambat, coba lagi", 413 → "File terlalu besar", benar-benar offline → "Tidak ada koneksi internet".
- **Semua teks via i18n.** Jangan hardcode string Indonesia/Inggris di komponen.
- **Shimmer, bukan layar putih** saat loading.

---

## 4. Stack Teknis

- **Expo SDK 58**, React Native 0.88, React 19, expo-router, NativeWind 4, TypeScript
- **EAS project:** c3931e6f-… | Channel: `preview` (jangan ubah channel tanpa instruksi)
- **Runtime version:** fingerprint policy
- **API:** `https://api.kahade.id` + prefix `/v1`
- **Env penting:** `EXPO_PUBLIC_STORY_API=live` — WAJIB disertakan di setiap `eas update`, atau Story kembali ke mock

### Perintah kunci
```bash
npx tsc --noEmit -p tsconfig.json   # type check (WAJIB lolos sebelum commit)
```

### Pantangan keras
- **JANGAN** ubah `app.json`, `eas.json`, atau tambah native module tanpa persetujuan eksplisit — mengubah fingerprint → APK lama tidak bisa terima OTA
- **JANGAN** `git stash` atau `git reset --hard` di repo ini (worktree dipakai bersama)
- **JANGAN** `git add -A` / `git commit -a` — selalu `git add` dengan path eksplisit, cek `git status --short` sebelum commit
- **JANGAN** trigger EAS build/APK — user build sendiri
- Ikon Phosphor: selalu via wrapper `<Icon icon tone>` (`components/ui/icon.tsx`), jangan `className` langsung di ikon
- Jangan panggil `useToast()`/`useContext` di komponen yang me-render Provider-nya sendiri — pecah jadi komponen dalam

---

## 5. Arsitektur & Konvensi Kode

### Struktur penting
```
app/                    # expo-router screens
components/ui/          # design system lokal
components/screens/     # screen-level components
lib/api/                # API client per domain (users.ts, showcase.ts, chat.ts, ...)
lib/i18n/               # terjemahan (kunci = string Indonesia)
docs/                   # kontrak & rekomendasi backend
```

### Kontrak API
- Tipe response frontend ditulis manual — **rawan drift**. Selalu verifikasi ke backend sebelum mengarang endpoint.
- **Jangan bikin endpoint baru** kalau yang lama sudah bekerja dan terverifikasi.
- Upload: MIME `audio/mp4` untuk voice note (TIGA lapisan harus sinkron: `lib/voice-note.ts`, `lib/chat-attachment-limits.ts`, backend `upload.service.ts`)
- Upload transport terpusat — jangan bikin jalur upload baru di luar itu

### Auth
- Registrasi: **hanya via nomor HP** (OTP WhatsApp)
- Login: hub satu pintu → Google / Apple (iOS saja) / Passkey / WhatsApp / Email / Username (satu metode = satu halaman)
- OAuth pakai endpoint backend yang SUDAH ADA: `POST /v1/auth/social/login` — jangan karang `/v1/auth/oauth/*`
- Account linking: 1 email = 1 akun, gabung otomatis (hanya jika email terverifikasi provider)

---

## 6. Alur Kerja Wajib

1. **Audit dulu** — tulis temuan (file:baris) SEBELUM fix. Jangan beri saran improvement tanpa audit kode.
2. **Hanya perbaiki yang terbukti** dengan kode. Jangan mengada-ada.
3. **Test:** tiap commit lolos `tsc` + test yang relevan. Test di koneksi lambat untuk fitur network.
4. **Commit:** per kelompok logis, pesan jelas Indonesia/Inggris konsisten.
5. **Push ke `main`** setelah selesai — semua perubahan harus masuk `main`.
6. **Jangan publish OTA** — itu tugas maintainer setelah verifikasi.

### Format prompt yang diharapkan
- Satu bubble, langsung mulai `Repo: ...`, tanpa judul "Prompt"
- Spesifik dan fokus — satu sesi = satu topik

---

## 7. Konteks Bisnis Penting

- **Alur transaksi:** buyer bayar → seller kirim (maks 2 hari) → buyer konfirmasi → dana cair. Auto-confirm: fisik 3 hari, digital/jasa 1 hari.
- **Payment:** DANA Enterprise (provider utama). KahadePay DITUNDA sampai izin BI ada.
- **Story:** terlihat oleh yang menyimpan profil pembuat (bukan follow graph). Hilang 24 jam, hard-delete 7 hari.
- **Etalase:** soft delete 30 hari → hard delete otomatis.
- **DM:** banner anti-tipu di semua DM tanpa orderId kecuali seller terverifikasi.
- **Username:** `kahade` dipakai akun resmi. Reserved words untuk deeplink: `p`, `v`, `r`, `o`, dll.
- **Deeplink:** `kahade.id/<username>`, `/p/<id>`, `/v/<kode>`, `/r/<kode>`, `/o/<token>`

---

## 8. Yang Sedang Berjalan / Tertunda

- Daftar 20+ bug dari user (segera datang) — prioritas setelah ini
- UI admin moderasi Story (backend sudah ada, frontend belum)
- Backend etalase RK-01/RK-02 (di repo backend)
- Transaction Unified v2 (masih diskusi — JANGAN implementasi)
- Cache media chat ala WhatsApp (ditunda sampai bug list selesai)

---

*Terakhir diperbarui: 10 Oktober 2026*
