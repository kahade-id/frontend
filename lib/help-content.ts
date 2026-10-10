/**
 * Pusat Bantuan offline-first.
 *
 * Konten inti sengaja dibundel bersama aplikasi, bukan dianggap sebagai cache
 * GET berumur pendek. Dengan begitu daftar kategori dan isi artikel tersedia
 * pada first-launch maupun sesudah restart tanpa koneksi.
 */
import type { HelpArticle, HelpCategory, HelpCategoryDetail } from "@/lib/api/help-center"

export type BundledHelpCategory = HelpCategoryDetail & { articles: HelpArticle[] }

export const BUNDLED_HELP: readonly BundledHelpCategory[] = [
  {
    slug: "transaksi",
    name: "Transaksi aman",
    description: "Alur pesanan, pembayaran, dan penyelesaian transaksi.",
    articleCount: 3,
    articles: [
      {
        id: "cara-kerja-transaksi-aman",
        slug: "cara-kerja-transaksi-aman",
        category: "transaksi",
        title: "Bagaimana cara kerja transaksi aman di Kahade?",
        content: `## Sebelum membuat transaksi\n\nSepakati barang atau jasa, harga, dan rincian pekerjaan dengan pihak lain. Pastikan deskripsi transaksi sesuai dengan kesepakatan.\n\n## Selama transaksi\n\nPembayaran dilakukan melalui metode yang tersedia di aplikasi. Dana transaksi ditahan sesuai alur escrow Kahade dan tidak langsung diteruskan kepada penjual.\n\n## Setelah pesanan diterima\n\nPeriksa barang atau hasil pekerjaan terlebih dahulu. Konfirmasikan penerimaan hanya jika pesanan sudah sesuai. Setelah konfirmasi, dana diteruskan mengikuti ketentuan transaksi.\n\nJika ada kendala, buka detail transaksi untuk melihat langkah yang tersedia.`,
      },
      {
        id: "pesanan-belum-diterima",
        slug: "pesanan-belum-diterima",
        category: "transaksi",
        title: "Apa yang perlu dilakukan jika pesanan belum diterima?",
        content: `## Periksa detail pesanan\n\nBuka transaksi di aplikasi dan periksa status serta informasi pengiriman yang tersedia. Hubungi pihak lain melalui percakapan transaksi bila perlu.\n\n## Jika masalah belum selesai\n\nJangan konfirmasikan penerimaan sebelum barang atau jasa benar-benar diterima dan diperiksa. Gunakan pilihan bantuan atau sengketa yang tersedia pada detail transaksi, lalu sertakan bukti yang relevan.\n\nBatas waktu dan pilihan yang tersedia mengikuti informasi pada transaksi Anda.`,
      },
      {
        id: "konfirmasi-penerimaan",
        slug: "konfirmasi-penerimaan",
        category: "transaksi",
        title: "Kapan saya sebaiknya mengonfirmasi penerimaan?",
        content: `## Periksa sebelum mengonfirmasi\n\nKonfirmasikan penerimaan setelah barang sampai atau pekerjaan selesai dan Anda sudah memeriksanya. Pastikan hasilnya sesuai dengan rincian transaksi.\n\nKonfirmasi dapat meneruskan dana kepada penjual. Jika pesanan belum sesuai, jangan konfirmasikan dulu; buka detail transaksi dan ikuti pilihan bantuan yang tersedia.`,
      },
    ],
  },
  {
    slug: "pembayaran-dompet",
    name: "Pembayaran & dompet",
    description: "Informasi dasar pembayaran dan keamanan saldo.",
    articleCount: 2,
    articles: [
      {
        id: "status-pembayaran",
        slug: "status-pembayaran",
        category: "pembayaran-dompet",
        title: "Pembayaran belum terlihat di transaksi",
        content: `## Periksa status terlebih dahulu\n\nBuka kembali detail transaksi dan lihat status pembayaran terbaru. Pastikan pembayaran dilakukan melalui metode yang tercantum di aplikasi.\n\nJangan membayar ulang sebelum memeriksa status atau petunjuk pada layar transaksi. Simpan bukti pembayaran dan gunakan bantuan pada transaksi bila status belum berubah setelah mengikuti petunjuk tersebut.`,
      },
      {
        id: "lindungi-pin-dan-kode",
        slug: "lindungi-pin-dan-kode",
        category: "pembayaran-dompet",
        title: "Bagaimana menjaga PIN dan kode verifikasi tetap aman?",
        content: `## Jaga rahasia akun\n\nJangan bagikan PIN dompet, kata sandi, kode OTP, kode cadangan, atau tautan masuk kepada siapa pun. Tim Kahade tidak memerlukan kode rahasia Anda melalui chat.\n\nLakukan pembayaran dan pengelolaan saldo hanya dari aplikasi. Jika merasa akun tidak aman, buka menu Keamanan untuk mengubah kredensial dan memeriksa sesi perangkat.`,
      },
    ],
  },
  {
    slug: "akun-keamanan",
    name: "Akun & keamanan",
    description: "Pengaturan akun, akses, dan perlindungan perangkat.",
    articleCount: 4,
    articles: [
      {
        // Tujuan tautan "Baca selengkapnya" pada ikon ⓘ di layar masuk/daftar
        // (components/auth/auth-security-info.tsx). Sejak overhaul auth
        // 2026-10-10 penjelasan panjang TIDAK lagi dicetak di kaki layar auth —
        // isinya pindah ke sini supaya layar masuk tetap satu baris persetujuan.
        id: "data-yang-dicatat-saat-masuk",
        slug: "data-yang-dicatat-saat-masuk",
        category: "akun-keamanan",
        title: "Data apa yang dicatat saat saya masuk?",
        content: `## Lokasi perangkat

Saat Anda masuk, mendaftar, atau mengatur ulang kata sandi, aplikasi dapat meminta izin lokasi. Bila Anda mengizinkan, lokasi dicatat bersama peristiwa keamanan untuk membantu mengenali aktivitas yang tidak wajar, misalnya percobaan masuk dari kota lain beberapa menit setelahnya.

Menolak izin lokasi **tidak** memblokir proses masuk maupun pendaftaran.

## Kode verifikasi WhatsApp

Kode verifikasi dikirim sebagai **balasan** setelah Anda mengirim pesan pemicu ke nomor resmi Kahade. Kahade tidak mengirim pesan lebih dulu, dan kode hanya berlaku singkat untuk satu percobaan.

Periksa nomor tujuan sebelum mengirim pesan. Jangan teruskan kode kepada siapa pun, termasuk orang yang mengaku sebagai tim Kahade.

## Perangkat dan sesi

Setiap perangkat yang berhasil masuk tercatat pada menu **Keamanan** → **Perangkat & Log**. Cabut sesi yang tidak Anda kenali, lalu ubah kata sandi bila perlu.

## Yang tidak pernah kami minta

Kahade tidak pernah meminta kata sandi, PIN dompet, kode verifikasi, atau kode cadangan melalui chat, telepon, email, maupun tautan. Permintaan semacam itu adalah percobaan penipuan.`,
      },
      {
        id: "ubah-kredensial-akun",
        slug: "ubah-kredensial-akun",
        category: "akun-keamanan",
        title: "Di mana saya mengubah email, nomor HP, atau kata sandi?",
        content: `Buka menu **Keamanan** untuk menemukan pilihan ganti email, nomor HP, kata sandi, PIN, dan pengaturan verifikasi dua langkah.\n\nSebagian perubahan memerlukan koneksi internet, verifikasi tambahan, atau konfirmasi di perangkat. Menu Keamanan tetap dapat dibuka tanpa koneksi; perubahan baru diproses setelah layar terkait tersambung ke layanan Kahade.`,
      },
      {
        id: "biometrik-dan-verifikasi-dua-langkah",
        slug: "biometrik-dan-verifikasi-dua-langkah",
        category: "akun-keamanan",
        title: "Apa bedanya kunci biometrik dan verifikasi dua langkah?",
        content: `**Kunci biometrik** melindungi aplikasi di perangkat ini dan menggunakan kemampuan perangkat, seperti sidik jari atau pengenalan wajah.\n\n**Verifikasi dua langkah** menambah pemeriksaan saat masuk ke akun. Pengaturannya tersedia dari menu Keamanan dan memerlukan koneksi untuk perubahan yang disimpan ke akun.`,
      },
      {
        id: "perangkat-hilang",
        slug: "perangkat-hilang",
        category: "akun-keamanan",
        title: "Apa yang harus dilakukan jika perangkat hilang?",
        content: `Gunakan perangkat lain untuk masuk ke akun, lalu buka menu **Keamanan** dan periksa bagian **Perangkat & Log**. Cabut sesi yang tidak dikenali dan perbarui kata sandi bila diperlukan.\n\nJangan membagikan kode verifikasi kepada orang lain. Jika tidak dapat masuk atau memerlukan bantuan, gunakan kanal bantuan resmi Kahade.`,
      },
    ],
  },
  {
    slug: "etalase-sosial",
    name: "Etalase & interaksi",
    description: "Konten etalase dan fitur sosial Kahade.",
    articleCount: 2,
    articles: [
      {
        id: "mengelola-etalase",
        slug: "mengelola-etalase",
        category: "etalase-sosial",
        title: "Bagaimana mengelola barang atau jasa di etalase?",
        content: `Buka **Kelola Etalase** untuk melihat dan mengatur konten etalase Anda. Periksa kembali informasi dan gambar sebelum menyimpan perubahan.\n\nPembuatan, penyuntingan, dan penghapusan konten memerlukan koneksi internet. Saat offline, Anda tetap dapat membuka menu aplikasi; perubahan akan tersedia setelah tersambung dan dimuat kembali.`,
      },
      {
        id: "suka-dan-ikuti-offline",
        slug: "suka-dan-ikuti-offline",
        category: "etalase-sosial",
        title: "Apa yang terjadi saat saya menyukai atau mengikuti ketika offline?",
        content: `Suka dan ikuti dapat disimpan dalam antrean sosial pada perangkat. Aksi tersebut akan dikirim otomatis saat koneksi kembali tersedia.\n\nAksi lain yang mengubah data akun atau transaksi tidak otomatis dimasukkan ke antrean. Untuk transaksi dan saldo, tunggu sampai aplikasi tersambung sebelum melanjutkan.`,
      },
    ],
  },
  {
    slug: "bantuan-dokumen",
    name: "Bantuan & dokumen",
    description: "Cara mencari bantuan dan membaca dokumen Kahade.",
    articleCount: 2,
    articles: [
      {
        id: "menghubungi-bantuan",
        slug: "menghubungi-bantuan",
        category: "bantuan-dokumen",
        title: "Bagaimana cara menghubungi tim Kahade?",
        content: `Buka Pusat Bantuan untuk mencari panduan yang tersedia. Jika masih memerlukan bantuan, pilih **Chat dengan tim Kahade** atau buka daftar tiket bantuan dari aplikasi.\n\nSaat menghubungi tim, sertakan nomor atau tautan transaksi bila relevan. Jangan kirim PIN, kata sandi, kode OTP, atau kode cadangan.`,
      },
      {
        id: "dokumen-kahade",
        slug: "dokumen-kahade",
        category: "bantuan-dokumen",
        title: "Di mana saya membaca Syarat & Ketentuan dan Kebijakan Privasi?",
        content: `Kedua dokumen tersedia langsung di aplikasi dan dapat dibaca tanpa koneksi internet.\n\n- [Syarat & Ketentuan](https://kahade.id/terms)\n- [Kebijakan Privasi](https://kahade.id/privacy-policy)\n\nAnda juga dapat membukanya dari menu Tentang Kami.`,
      },
    ],
  },
] satisfies readonly BundledHelpCategory[]

export const BUNDLED_HELP_CATEGORIES: readonly HelpCategory[] = BUNDLED_HELP.map(
  ({ articles: _articles, ...category }) => category,
)

export const BUNDLED_HELP_ARTICLES: readonly HelpArticle[] = BUNDLED_HELP.flatMap(
  (category) => category.articles,
)

export function getBundledHelpCategory(slug: string | undefined): BundledHelpCategory | null {
  if (!slug) return null
  return BUNDLED_HELP.find((category) => category.slug === slug) ?? null
}

export function findBundledHelpArticle(
  idOrSlug: string | undefined,
  categorySlug?: string,
): HelpArticle | null {
  if (!idOrSlug) return null
  const categories = categorySlug
    ? BUNDLED_HELP.filter((category) => category.slug === categorySlug)
    : BUNDLED_HELP
  for (const category of categories) {
    const found = category.articles.find(
      (article) => article.id === idOrSlug || article.slug === idOrSlug,
    )
    if (found) return found
  }
  return null
}

export function searchBundledHelpArticles(query: string): HelpArticle[] {
  const needle = query.trim().toLocaleLowerCase("id-ID")
  if (!needle) return []
  return BUNDLED_HELP.flatMap((category) => category.articles).filter((article) =>
    [article.title, article.content, article.category]
      .filter((value): value is string => typeof value === "string")
      .some((value) => value.toLocaleLowerCase("id-ID").includes(needle)),
  )
}
