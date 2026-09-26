/**
 * Kahade — daftar 7 benefit Kahade+ (copy produk Bahasa Indonesia).
 *
 * Copy pemasaran ini SENGAJA didefinisikan di sisi frontend: backend
 * (GET /v1/subscriptions/benefits, GET /v1/subscriptions/plans → field
 * `benefits`) menyediakan daftar benefit ringkas berbahasa Inggris sebagai
 * source of truth mesin, sedangkan layar pemasaran memakai copy produk
 * Indonesia yang sudah dikurasi (7 item, urutan sesuai dokumen produk).
 * Bila daftar benefit produk berubah, perbarui KEDUA sisi.
 *
 * Urutan diselaraskan dengan penomoran benefit di dokumen produk:
 *  2 = centang abu, 5 = tema eksklusif, 6 = akses awal, 7 = custom etalase.
 */
export type KahadePlusBenefit = {
  key: string
  title: string
  description: string
}

export const KAHADE_PLUS_BENEFITS: KahadePlusBenefit[] = [
  {
    key: "fee-waiver",
    title: "Bebas biaya layanan",
    description:
      "Biaya layanan transaksi digratiskan sampai batas kuota setiap periode langganan.",
  },
  {
    key: "grey-check",
    title: "Centang abu-abu",
    description:
      "Lencana centang abu-abu tampil di profil Anda sebagai akun terverifikasi penuh.",
  },
  {
    key: "priority-support",
    title: "Dukungan prioritas",
    description: "Pertanyaan dan laporan Anda ditangani lebih dulu oleh tim Kahade.",
  },
  {
    key: "showcase-analytics",
    title: "Analitik etalase",
    description: "Lihat statistik kunjungan dan performa etalase Anda secara detail.",
  },
  {
    key: "exclusive-theme",
    title: "Tema eksklusif",
    description: "Pilih warna aksen dan ikon aplikasi khusus anggota Kahade+.",
  },
  {
    key: "early-access",
    title: "Akses awal fitur baru",
    description: "Coba fitur Patungan dan Split Bill sebelum dibuka untuk semua pengguna.",
  },
  {
    key: "custom-showcase",
    title: "Etalase kustom",
    description:
      "Deskripsi karya dengan format teks kaya (HTML) dan hingga 18 foto per karya.",
  },
]
