# QA Manual: Auth & Keamanan (Android + iOS)

Checklist uji manual untuk overhaul auth 2026-10-10 (onboarding, hub Masuk,
satu metode per halaman, posisi tombol aksi, disclaimer, OAuth, passkey).

Sandbox/CI tidak punya simulator, jadi semua yang bergantung perangkat nyata
diuji lewat daftar ini. Test otomatis yang sudah mengunci perilaku ada di
§8 — jangan menguji ulang hal yang sudah dijaga test, fokus ke yang hanya
terlihat di perangkat.

**Cara menjalankan**

```bash
npm ci                      # optionalDependencies ikut terpasang
npx expo run:ios            # butuh Mac + Xcode; scheme kahade, bundle id.kahade
npx expo run:android        # butuh device/AVD API 34+; package id.kahade
npx expo start --web        # web: app/index.tsx mengarahkan ke https://kahade.id
```

Isi kolom Hasil dengan ✅ / ❌ + catatan. Satu ❌ = bug, bukan "nanti".

---

## 1. Onboarding (bagian 1)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 1.1 | Hapus instalasi, pasang lagi, buka aplikasi dingin | Slide intro TERLIHAT (bukan layar kosong / langsung ke Masuk) | | |
| 1.2 | Geser antar slide | 3 halaman: jaminan, rilis, perlindungan; indikator titik mengikuti | | |
| 1.3 | Baca tiap slide | `eyebrow`, judul, isi, dan artefak visual semuanya terisi; tidak ada teks Bahasa Indonesia yang terpotong | | |
| 1.4 | Tombol di slide terakhir | "Daftar" dan "Masuk" menekan ke `/register` dan `/login` | | |
| 1.5 | Tutup aplikasi di tengah onboarding, buka lagi | Tidak mengulang dari awal bila sudah pernah selesai (perilaku lama dipertahankan) | | |
| 1.6 | Ganti bahasa ke English di pengaturan, lalu buka onboarding ulang (bila bisa) | Teks slide ikut English | | |

---

## 2. Hub Masuk `/login` (bagian 2)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 2.1 | Buka `/login` | Logo + judul "Masuk ke Kahade"; TIDAK ada kolom email/password/nomor di layar ini | | |
| 2.2 | Lihat urutan aksi | 1) Lanjut dengan Google 2) Lanjut dengan Apple (**iOS saja**) 3) Masuk dengan Passkey 4) pemisah "atau" 5) WhatsApp / Email / Username | | |
| 2.3 | Android: hitung tombol sosial | Hanya "Lanjut dengan Google" + "Masuk dengan Passkey". Tidak ada tombol Apple, tidak ada baris kosong bekas Apple | | n/a |
| 2.4 | iOS: tombol Apple | Tombol Apple asli (`AppleAuthenticationButtonType.CONTINUE`), tinggi sejajar tombol Google, tidak terpotong notch | n/a | |
| 2.5 | Frame pertama (sebelum kapabilitas OAuth terbaca) | Skeleton setinggi tombol (48) — layar tidak "melompat" saat tombol muncul | | |
| 2.6 | Ketuk baris WhatsApp / Email / Username | Masing-masing membuka HALAMAN SENDIRI (`/login/whatsapp`, `/login/email`, `/login/username`) — bukan menukar form di tempat | | |
| 2.7 | Tiap halaman metode | Header "Masuk" + tombol kembali, judul metode, SATU jenis kredensial, tidak ada metode lain yang menumpuk | | |
| 2.8 | Halaman metode → "Pilih metode lain" | Kembali ke hub tanpa kehilangan `?next=` | | |
| 2.9 | Kaki layar | Satu baris kecil abu-abu: "Dengan masuk, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi" — kedua dokumen bisa diketuk dan terbuka IN-APP | | |
| 2.10 | Ikon ⓘ di header | Membuka Dialog berisi poin keamanan + tautan "Baca selengkapnya di Pusat Bantuan" → artikel `data-yang-dicatat-saat-masuk` | | |
| 2.11 | "Belum punya akun? Daftar" | Ke `/register` (pendaftaran tetap nomor HP) | | |
| 2.12 | "Lupa kata sandi?" dan "Akun dihapus? Pulihkan di sini" | Ke `/forgot-password` dan `/deletion-status` | | |
| 2.13 | Deep link lama `kahade://login?method=phone` | Diarahkan ke `/login/whatsapp` (bukan layar kosong) | | |
| 2.14 | Deep link `kahade://login?method=email&next=/transactions` | Ke `/login/email`, dan setelah masuk berhasil mendarat di `/transactions` | | |
| 2.15 | Deep link `kahade://login?method=google` | Langsung memulai OAuth Google tanpa ketuk tombol | | |
| 2.16 | Screen reader (TalkBack / VoiceOver) | Baris metode terbaca sebagai daftar; tiap baris menyebut judul + subtitle; ⓘ terbaca "Detail keamanan masuk" | | |

---

## 3. Halaman metode (bagian 2)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 3.1 | WhatsApp: kosongkan nomor, ketuk "Minta kode verifikasi" | Tombol disabled; tidak ada layar putih, tidak ada error generik | | |
| 3.2 | WhatsApp: isi `81234567890` → lanjut | Nomor dinormalkan ke `+6281234567890`; berpindah ke layar pemicu WhatsApp dengan nomor resmi Kahade terlihat | | |
| 3.3 | WhatsApp: nomor tidak valid (`12345`) | Pesan spesifik "Nomor HP tidak valid. Gunakan nomor Indonesia yang diawali 8, 9–12 digit." | | |
| 3.4 | Email: kata sandi salah | Pesan spesifik (bukan "Terjadi kesalahan"); "Lupa kata sandi?" selalu terlihat di bawah tombol | | |
| 3.5 | Username: isi dengan spasi | Spasi ditolak/dibersihkan sesuai aturan username; pesan validasi spesifik | | |
| 3.6 | Keyboard naik saat mengisi field terakhir | Tombol submit tetap bisa dicapai dengan scroll; tidak tertutup keyboard permanen | | |
| 3.7 | Mode pesawat → ketuk submit | Pesan jaringan spesifik ("Periksa koneksi internet…"), tombol tidak macet di keadaan loading | | |
| 3.8 | Loading | Setiap submit punya keadaan loading pada tombolnya; tidak ada double-submit saat diketuk dua kali | | |

---

## 4. Tombol aksi mengikuti konten (bagian 3)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 4.1 | Keamanan → Ganti Email | "Simpan email baru" adalah elemen TERAKHIR di dalam konten; TIDAK ada pita footer berpemisah garis di bawah layar | | |
| 4.2 | Ganti Nomor HP (langkah minta kode & langkah verifikasi) | Tombolnya mengikuti konten di kedua langkah, label berganti benar | | |
| 4.3 | Ubah Kata Sandi | "Simpan password" di bawah field terakhir, ikut ter-scroll | | |
| 4.4 | PIN dompet (langkah kata sandi) | "Lanjut" di dalam konten, bukan footer | | |
| 4.5 | Keamanan | "Keluar" ada di ujung daftar (setelah Zona Berbahaya), ikut ter-scroll | | |
| 4.6 | Gulir ke paling bawah di tiap layar di atas | Ada jarak aman ke tepi bawah: tombol TIDAK menempel di home indicator / gesture bar | | |
| 4.7 | Layar pendek (mis. Keamanan di tablet/layar besar) | Tidak ada ruang kosong aneh di bawah tombol; tombol tidak melayang di tengah layar | | |
| 4.8 | Rotasi / ubah ukuran jendela (tablet, foldable) | Konten tetap bisa digulir sampai tombol terlihat | | |

---

## 5. Disclaimer & Pusat Bantuan (bagian 4)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 5.1 | Buka: register, langkah kata sandi pendaftaran, lupa kata sandi, kata sandi baru, verifikasi OTP, tambah nomor HP | TIDAK ada paragraf "Demi keamanan, lokasi perangkat dapat dicatat…" di layar mana pun | | |
| 5.2 | Tiap layar di 5.1 | Ada ikon ⓘ di header; ketuk → Dialog penjelasan yang RELEVAN dengan layarnya (bukan dialog generik) | | |
| 5.3 | Dialog ⓘ → "Baca selengkapnya di Pusat Bantuan" | Membuka artikel "Data apa yang dicatat saat saya masuk?" dengan isi terbaca (lokasi, kode WhatsApp, perangkat & sesi, yang tidak pernah diminta) | | |
| 5.4 | Langkah terakhir pendaftaran ("Buat akun") | Satu baris "Dengan membuat akun, Anda menyetujui Syarat & Ketentuan serta Kebijakan Privasi" — bukan dua paragraf | | |
| 5.5 | Lupa kata sandi | Tautan "Nomor HP tidak aktif? Minta bantuan" MASIH ADA (jalan keluar, bukan disclaimer) | | |
| 5.6 | Izin lokasi ditolak saat submit | Alur tetap jalan; tidak ada blokir, tidak ada pesan menyalahkan | | |
| 5.7 | Ganti bahasa ke English | Baris persetujuan terbaca "By signing in, you agree to the Terms & Conditions and the Privacy Policy" — TIDAK ada kata Indonesia tersisa di tengah kalimat ("serta", "menyetujui") | | |

---

## 6. OAuth sosial (bagian 5)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 6.1 | "Lanjut dengan Google" | Browser/sheet Google terbuka; setelah sukses kembali ke aplikasi dengan sesi aktif | | |
| 6.2 | Google: ketuk Batal di sheet | Kembali ke hub TANPA Alert merah, tanpa toast (pembatalan = diam) | | |
| 6.3 | Google: akun belum terdaftar | Dialog "Akun belum terdaftar" → diarahkan ke pendaftaran nomor HP (bukan dibuat diam-diam) | | |
| 6.4 | Google: akun 2FA aktif | Diarahkan ke `/verify-2fa` dan setelah kode benar masuk ke akun | | |
| 6.5 | iOS: "Lanjut dengan Apple" | Sheet Apple sistem (Face ID) muncul; setelah sukses sesi aktif | n/a | |
| 6.6 | iOS: Apple → Batal | Diam, tanpa error | n/a | |
| 6.7 | iOS: Apple dengan akun baru (belum pernah) | Ikut cabang `linkRequired`/`confirmLink` sesuai respons server — tidak ada layar kosong | n/a | |
| 6.8 | Android: cari tombol Apple | Tidak ada di hub Masuk DAN tidak ada di layar tautan akun sosial (`/social-providers`) | | n/a |
| 6.9 | Jaringan mati saat OAuth | Pesan spesifik jaringan, tombol bisa dicoba lagi | | |
| 6.10 | Setelah masuk lewat OAuth | Mendarat di tujuan `?next=` bila ada, selain itu home; tidak kembali ke `/login` | | |

---

## 7. Passkey (bagian 5)

| # | Langkah | Harapan | Android | iOS |
| --- | --- | --- | --- | --- |
| 7.1 | Hub Masuk → "Masuk dengan Passkey" | Dialog penjelasan: "Passkey belum tersedia di aplikasi native ini…" + arahan ke kata sandi / kode WhatsApp / aplikasi web. TIDAK ada crash, tidak ada spinner menggantung | | |
| 7.2 | Keamanan → Passkey → "Tambah passkey" | Toast netral dengan penjelasan yang sama (bukan error merah) | | |
| 7.3 | Keamanan → Passkey | Daftar passkey yang terdaftar di web TETAP terlihat dan bisa dihapus dari aplikasi | | |
| 7.4 | Web (browser yang mendukung WebAuthn) → `/login` | "Masuk dengan Passkey" menjalankan sheet passkey browser; setelah benar, sesi aktif | n/a | n/a |
| 7.5 | Web (browser tanpa WebAuthn / mode privat lama) | Dialog "Browser ini tidak mendukung passkey" — alasan berbeda dari native, dan itu benar | n/a | n/a |
| 7.6 | Web: batalkan sheet passkey | Diam (tanpa Alert), tombol bisa dicoba lagi | n/a | n/a |
| 7.7 | Web: passkey akun 2FA | Diarahkan ke `/verify-2fa` | n/a | n/a |
| 7.8 | Halaman Email/Username di web (mediasi conditional) | Bila browser mendukung, saran passkey muncul di kolom; bila gagal, form kata sandi tetap bisa dipakai (kegagalan autofill ditelan diam-diam) | n/a | n/a |

> Catatan: seam provider native (`lib/passkey-native.ts`) SENGAJA mati —
> `NATIVE_PASSKEY_ENABLED = false`. Jadi 7.1–7.3 adalah perilaku yang BENAR
> hari ini, bukan bug. Syarat menyalakannya ada di docs/auth-oauth-passkey.md §5.3.

---

## 8. Yang sudah dijaga test otomatis (jangan diuji manual)

| Area | Berkas test |
| --- | --- |
| Slide onboarding dirender + urutannya | `tests/onboarding-slides.test.tsx` |
| Hub Masuk, 3 halaman metode, deep link `?method=`, alur passkey | `tests/login-methods.test.tsx` |
| Baris persetujuan + terjemahan English-nya | `tests/legal-consent.test.tsx` |
| Paragraf disclaimer hilang, ⓘ terpasang di 6 layar | `tests/auth-disclaimer-cleanup.test.ts` |
| Tombol aksi di dalam ScrollView, tanpa FooterBar | `tests/action-button-placement.test.ts` |
| Gerbang platform Apple/Google + nonce | `tests/social-oauth-platform.test.ts` |
| Seam passkey native (probe, gerbang provider, encoding) | `tests/passkey-native.test.ts` |
| 5 cabang hasil `social/login` | `tests/social-login-contract.test.ts` |
| Rute baru terdaftar publik | `tests/route-protection.test.ts` |

```bash
npm run typecheck && npm run lint
npx vitest run                                                  # lapisan murni
npx vitest run --config vitest.components.config.ts             # komponen/render
npx vitest run --config lib/uiux-batch3-test.config.ts components/__tests__/uiux-batch3-auth.test.tsx
npm run check:i18n && npm run check:a11y && npm run check:tokens && npm run check:screens
```

Angka acuan (baseline sebelum overhaul, semua warisan dan tidak boleh membesar):
`check:a11y` 74 masalah · `check:tokens` 83 · `check:i18n` 463 · vitest default
10 berkas gagal · komponen 15 berkas gagal.

---

## 9. Tanda tangan

| Peran | Nama | Perangkat | Tanggal | Hasil |
| --- | --- | --- | --- | --- |
| QA Android | | | | |
| QA iOS | | | | |
| Engineer | | | | |
