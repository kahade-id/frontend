/**
 * Kahade — copy detail keamanan alur auth (overhaul auth 2026-10-10).
 *
 * Rumah baru untuk penjelasan yang dulu menjadi paragraf panjang di kaki layar
 * masuk/daftar/OTP. Di layar, pengguna hanya melihat satu baris persetujuan
 * (<LegalConsent>) + ikon ⓘ (<AuthSecurityInfo>); isi detailnya di sini.
 *
 * Keputusan non-obvious:
 *   - Poin disimpan sebagai OBJECT dengan kunci semantik, BUKAN array.
 *     Generator katalog i18n (scripts/gen-i18n-catalog.mjs) mengumpulkan SEMUA
 *     nilai string dari object literal di `lib/`, tetapi tidak menelusuri
 *     ArrayLiteralExpression — jadi `points: ["…"]` tidak pernah masuk
 *     katalog dan tidak pernah bisa diterjemahkan (pengguna English akan
 *     melihat Bahasa Indonesia). `Object.values()` di komponen mempertahankan
 *     urutan insersi, jadi tampilan tetap urutan yang ditulis di sini.
 *   - String dibiarkan Bahasa Indonesia apa adanya (tanpa `translate()` di
 *     sini): modul dievaluasi sekali saat import, sehingga menerjemahkan di
 *     module scope akan membekukan bahasa sebelum preferensi akun terbaca.
 *     Penerjemahan terjadi di render lewat auto-translate <Text> di
 *     <BulletList> — sama seperti PASSKEY_COPY di lib/passkey-instructions.ts.
 *   - Nomor WhatsApp resmi SENGAJA tidak disalin ke sini. Satu-satunya sumber
 *     adalah KAHADE_WHATSAPP_NUMBER di app/(auth)/whatsapp-trigger.tsx dan
 *     layar itu memang menampilkannya; menyalin angka ke copy kedua adalah
 *     undangan untuk berbeda saat nomornya berubah.
 *   - Tanpa istilah "escrow"/"rekber"/"ditahan" (kebijakan copy 2026-10-10).
 */

export type AuthSecurityInfoVariant = "signIn" | "signUp" | "whatsappOtp" | "password"

export type AuthSecurityInfoContent = {
  /** Label screen reader tombol ⓘ. */
  buttonLabel: string
  title: string
  description: string
  /** Object, bukan array — lihat docblock. Urutan tampil = urutan kunci. */
  points: Record<string, string>
}

export const AUTH_SECURITY_INFO: Record<AuthSecurityInfoVariant, AuthSecurityInfoContent> = {
  signIn: {
    buttonLabel: "Detail keamanan masuk",
    title: "Kenapa layar ini menanyakan hal tersebut?",
    description:
      "Beberapa data dipakai untuk melindungi akun Anda. Tidak ada yang menghalangi proses masuk.",
    points: {
      location:
        "Lokasi perangkat dapat dicatat saat masuk untuk mengenali aktivitas yang tidak wajar. Menolak izin lokasi tidak memblokir proses masuk.",
      whatsapp:
        "Kode verifikasi WhatsApp dikirim sebagai balasan setelah Anda mengirim pesan pemicu ke nomor resmi Kahade — kami tidak mengirim pesan lebih dulu.",
      neverAsk:
        "Kahade tidak pernah meminta kata sandi, PIN, atau kode verifikasi Anda lewat chat, telepon, atau tautan.",
      sessions:
        "Perangkat dan sesi yang sedang aktif dapat Anda periksa dan cabut kapan saja di menu Keamanan.",
    },
  },
  signUp: {
    buttonLabel: "Detail keamanan pendaftaran",
    title: "Data apa yang dipakai saat mendaftar?",
    description:
      "Pendaftaran memakai nomor HP sebagai identitas akun. Sisanya dipakai untuk melindungi akun sejak hari pertama.",
    points: {
      phoneOnly:
        "Nomor HP adalah identitas akun dan kanal pemulihan. Karena itu pendaftaran hanya tersedia lewat nomor HP.",
      password:
        "Kata sandi disimpan sebagai hash. Kami tidak bisa membacanya, mengirimkannya lewat chat, atau mengembalikannya bila terlupa.",
      location:
        "Lokasi perangkat dapat dicatat untuk mengenali pendaftaran otomatis. Menolak izin lokasi tidak memblokir pendaftaran.",
      whatsapp:
        "Kode verifikasi dikirim sebagai balasan WhatsApp setelah Anda mengirim pesan pemicu ke nomor resmi Kahade.",
    },
  },
  whatsappOtp: {
    buttonLabel: "Detail kode WhatsApp",
    title: "Cara kerja kode WhatsApp",
    description:
      "Kode dikirim sebagai balasan atas pesan yang Anda kirim, bukan pesan masuk yang tidak diminta.",
    points: {
      trigger:
        "Anda mengirim pesan pemicu berisi kode referensi ke nomor resmi Kahade yang tampil di layar berikutnya.",
      reply:
        "Layanan Kahade membalas dengan kode verifikasi 6 digit. Kode berlaku singkat dan hanya untuk satu percobaan.",
      official:
        "Periksa nomor tujuannya sebelum mengirim. Pesan dari nomor lain yang mengatasnamakan Kahade bukan dari kami.",
      neverShare:
        "Jangan teruskan kode kepada siapa pun, termasuk orang yang mengaku tim Kahade.",
    },
  },
  password: {
    buttonLabel: "Detail keamanan kata sandi",
    title: "Menjaga kata sandi Anda",
    description:
      "Kata sandi adalah lapisan pertama akun. Beberapa aturan di bawah berlaku otomatis.",
    points: {
      hashed:
        "Kata sandi disimpan sebagai hash. Kami tidak bisa membacanya atau mengirimkannya kepada Anda dalam bentuk apa pun.",
      relogin:
        "Setelah kata sandi berubah, semua sesi dicabut dan Anda perlu masuk kembali di setiap perangkat.",
      captcha:
        "Verifikasi tambahan muncul setelah beberapa percobaan gagal. Ini melindungi akun dari tebakan otomatis, bukan tanda akun Anda bermasalah.",
      twoFactor:
        "Aktifkan verifikasi dua langkah di menu Keamanan untuk lapisan kedua saat masuk.",
    },
  },
}
