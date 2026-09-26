/**
 * Kahade — daftar 7 benefit Kahade+ (copy produk Bahasa Indonesia).
 *
 * Copy ini didefinisikan di sisi frontend karena kontrak baru
 * GET /v1/subscriptions/plans hanya mengembalikan { plan, label, price,
 * durationDays } — tidak ada daftar benefit. Bila backend kelak menyediakan
 * endpoint benefit untuk kontrak baru, ganti sumber data ini (bentuk item
 * disamakan dengan props <SubscriptionBenefitList> supaya layar tidak berubah).
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
