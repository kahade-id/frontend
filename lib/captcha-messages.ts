/**
 * Kahade — copy pesan captcha slider (dipakai layar auth yang mewajibkannya).
 *
 * Kenapa di `lib/` dan bukan literal di layar (non-obvious): string di kode
 * adalah KUNCI terjemahan (`lib/i18n/translate.ts`) dan
 * `scripts/gen-i18n-catalog.mjs` hanya mengumpulkan literal yang muncul lewat
 * nama prop teks, JSX, atau — di direktori `lib/` — SEMUA nilai objek. Pesan
 * yang dipanggil `setFormError("…")` di dalam layar tidak terlihat skrip itu,
 * sehingga katalog (dan check:i18n) menganggap translate-nya yatim. Menaruhnya
 * sebagai map di `lib/` membuatnya ikut terdeteksi tanpa pengecualian baru di
 * skrip, sekaligus satu tempat untuk copy captcha.
 *
 * Semua pesan berorientasi tindakan: pengguna harus tahu bahwa yang salah
 * BUKAN email/password-nya, melainkan verifikasi keamanan yang perlu diulang.
 */
export const CAPTCHA_MESSAGES = {
  /** Tantangan belum dijawab saat tombol ditekan */
  required: "Selesaikan verifikasi keamanan dulu, lalu coba lagi.",
  /** Backend baru saja meminta captcha (CAPTCHA_REQUIRED) pada alur publik */
  resetRequired: "Verifikasi keamanan diperlukan sebelum mengirim kode. Geser lalu coba lagi.",
  /** Tantangan lewat 120 detik (TTL Redis backend) */
  expired: "Verifikasi keamanan sudah kedaluwarsa. Geser ulang lalu coba lagi.",
  /** Jawaban di luar toleransi ±4 poin */
  failed: "Verifikasi keamanan belum tepat. Geser ulang lalu coba lagi.",
  /** /auth/captcha/generate gagal (jaringan/server) */
  unavailable: "Verifikasi keamanan belum termuat.",
  /** Login: backend meminta captcha setelah 3 kegagalan dari IP yang sama */
  loginRequired: "Terlalu banyak percobaan gagal. Selesaikan verifikasi keamanan lalu coba lagi.",
} as const
