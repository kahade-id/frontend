// Shared data for Home page components
import { 
  ShieldCheck, Lock, Lightning, CheckCircle,
  Wallet, FileText, Clock, Star, Globe, Eye, 
  IdentificationBadge, CreditCard, Warning, UserCircle,
  Package, HandCoins, Scales, ChartLineUp, Fingerprint, Bell,
  Bank, Certificate, Gavel, Broadcast
} from '@phosphor-icons/react';

// ─── SINGLE SOURCE OF TRUTH: Marketing metrics ────────────────────────────────
// Update these values in ONE place; all sections read from here.
export const SITE_STATS = {
  totalFundSecured: 'Rp 50M+',           // Dana diamankan (format display)
  totalFundNumeric: 50,                   // Nilai numerik untuk count-up (juta)
  activeUsers: '10.000+',                 // Pengguna aktif (format display)
  activeUsersNumeric: 10000,              // Nilai numerik untuk count-up
  uptime: '99,9%',                        // Uptime sistem
  uptimeNumeric: 999,                      // Nilai numerik untuk count-up
  avgSettlement: '< 12 Jam',             // Rata-rata pencairan (format display)
  avgSettlementNumeric: 12,               // Nilai numerik untuk count-up
  disputeRate: '0,8%',                    // Tingkat sengketa
  satisfactionRate: '98%',               // Kepuasan pengguna
};

// ─── COMPLIANCE / TRUST BADGES ────────────────────────────────────────────────
// Wording "dalam proses" atau "ready" mencegah klaim terlalu absolut (Issue #5, #27)
export const trustBadges = [
  { label: 'OJK Ready', sublabel: 'Dalam proses perizinan' },
  { label: 'Bank Indonesia', sublabel: 'Mengikuti regulasi BI' },
  { label: 'ISO 27001 Standard', sublabel: 'Standar keamanan enterprise' },
  { label: 'KYC-Ready', sublabel: 'Verifikasi identitas aktif' },
];

// ─── FEATURES ─────────────────────────────────────────────────────────────────
export const features = [
  {
    icon: ShieldCheck,
    title: 'Eskrow Aman',
    description: 'Dana disimpan aman hingga kedua pihak mengonfirmasi kepuasan atas transaksi.',
  },
  {
    icon: CreditCard,
    title: 'Multi Pembayaran',
    description: 'Mendukung transfer bank, e-wallet, QRIS, dan virtual account.',
  },
  {
    icon: Lock,
    title: 'Keamanan Setara Bank',
    description: 'Enkripsi 256-bit, 2FA, dan infrastruktur keamanan setara enterprise.',
  },
  {
    icon: Lightning,
    title: 'Proses Cepat',
    description: 'Transaksi diproses dalam hitungan menit dengan status real-time.',
  },
  {
    icon: Eye,
    title: 'Transparansi Penuh',
    description: 'Lacak setiap tahapan transaksi dengan visibilitas penuh dan jejak audit.',
  },
  {
    icon: IdentificationBadge,
    title: 'Verifikasi KYC',
    description: 'Sistem verifikasi identitas untuk meningkatkan keamanan dan kepercayaan.',
  },
  {
    icon: Scales,
    title: 'Resolusi Sengketa',
    description: 'Layanan mediasi profesional untuk penyelesaian sengketa yang adil.',
  },
  {
    icon: Bell,
    title: 'Notifikasi Real-time',
    description: 'Notifikasi instan untuk semua aktivitas dan update transaksi.',
  },
  {
    icon: Fingerprint,
    title: 'Autentikasi Biometrik',
    description: 'Autentikasi biometrik canggih untuk pengguna aplikasi mobile.',
  },
];

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────
export const steps = [
  {
    step: '01',
    title: 'Buat Transaksi',
    description: 'Mulai transaksi baru dengan detail dan ketentuan lengkap.',
    icon: FileText,
  },
  {
    step: '02',
    title: 'Setor Dana',
    description: 'Pembeli menyetor dana ke rekening escrow yang aman.',
    icon: Wallet,
  },
  {
    step: '03',
    title: 'Kirim Barang',
    description: 'Penjual mengirim barang dan mengunggah bukti pengiriman.',
    icon: Package,
  },
  {
    step: '04',
    title: 'Konfirmasi Penerimaan',
    description: 'Pembeli mengonfirmasi penerimaan dan kepuasan.',
    icon: CheckCircle,
  },
  {
    step: '05',
    title: 'Lepaskan Dana',
    description: 'Dana otomatis dilepas ke penjual.',
    icon: HandCoins,
  },
];

// ─── PRICING ──────────────────────────────────────────────────────────────────
export const pricingPlans = [
  {
    name: 'Pemula',
    description: 'Untuk individu dan transaksi kecil',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Hingga 5 transaksi/bulan',
      'Perlindungan escrow dasar',
      'Dukungan email',
      'Pemrosesan standar',
      'Analitik dasar',
    ],
    cta: 'Mulai',
    popular: false,
  },
  {
    name: 'Profesional',
    description: 'Untuk freelancer dan bisnis yang berkembang',
    monthlyPrice: 99000,
    yearlyPrice: 79000, // harga per bulan jika bayar tahunan (−20%)
    yearlyTotal: 948000, // total dibayar tahunan
    features: [
      'Transaksi tanpa batas',
      'Perlindungan escrow lanjutan',
      'Dukungan prioritas 24/7',
      'Pemrosesan cepat',
      'Analitik lanjutan',
      'Akses API',
      'Branding kustom',
    ],
    cta: 'Coba Gratis',
    popular: true,
  },
  {
    name: 'Enterprise',
    description: 'Untuk organisasi besar',
    monthlyPrice: 999000,
    yearlyPrice: 799000, // harga per bulan jika bayar tahunan (−20%)
    yearlyTotal: 9588000, // total dibayar tahunan
    features: [
      'Semua fitur Profesional',
      'Manajer akun khusus',
      'Integrasi kustom',
      'Jaminan SLA',
      'Solusi white-label',
      'Keamanan lanjutan',
      'Dukungan kepatuhan',
    ],
    cta: 'Hubungi Sales',
    popular: false,
  },
];

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
// Dibuat lebih autentik, menghapus klaim statistik yang terlalu absolut (Issue #13)
export const testimonials = [
  {
    name: 'Ahmad Rizki',
    role: 'Penjual Online',
    rating: 5,
    avatar: 'AR',
    content: 'Kahade membuat transaksi online jadi jauh lebih aman. Pembeli lebih percaya dan saya tidak khawatir soal penipuan.',
  },
  {
    name: 'Siti Wahyuni',
    role: 'Freelancer Desainer',
    rating: 5,
    avatar: 'SW',
    content: 'Sebagai freelancer, saya sering khawatir soal pembayaran. Dengan Kahade, klien lebih percaya dan pembayaran selalu tepat waktu.',
  },
  {
    name: 'Budi Santoso',
    role: 'Pembeli Online',
    rating: 5,
    avatar: 'BS',
    content: 'Pernah kena tipu sebelum pakai Kahade. Sekarang saya tidak akan belanja online tanpa perlindungan escrow.',
  },
  {
    name: 'Dewi Kurnia',
    role: 'Pemilik Toko Online',
    rating: 5,
    avatar: 'DK',
    content: 'Fitur resolusi sengketa sangat membantu. Tim Kahade profesional dan adil dalam menangani masalah.',
  },
  {
    name: 'Rudi Hermawan',
    role: 'Developer Freelance',
    rating: 5,
    avatar: 'RH',
    content: 'API Kahade mudah diintegrasikan. Dokumentasinya lengkap dan tim support sangat responsif.',
  },
  {
    name: 'Maya Putri',
    role: 'Importir Barang',
    rating: 5,
    avatar: 'MP',
    content: 'Untuk transaksi nilai besar, Kahade adalah pilihan terbaik. Dana saya terlindungi dengan baik.',
  },
  {
    name: 'Faisal Rahman',
    role: 'Pengusaha Muda',
    rating: 5,
    avatar: 'FR',
    content: 'Proses cepat, aman, dan transparan. Kahade benar-benar mengubah cara saya berbisnis online.',
  },
  {
    name: 'Linda Susanti',
    role: 'Penjual Properti',
    rating: 4,
    avatar: 'LS',
    content: 'Untuk transaksi properti, kepercayaan adalah segalanya. Kahade memberikan rasa aman yang tidak bisa digantikan.',
  },
  {
    name: 'Hendra Gunawan',
    role: 'Pedagang Elektronik',
    rating: 5,
    avatar: 'HG',
    // Removed: klaim "penjualan meningkat 40%" — terlalu absolut tanpa bukti
    content: 'Pelanggan lebih puas karena mereka tahu uang mereka aman selama transaksi berlangsung.',
  },
  {
    name: 'Rina Maharani',
    role: 'Kreator Konten',
    rating: 5,
    avatar: 'RM',
    content: 'Untuk brand deal dan kolaborasi, Kahade memastikan semua pihak memenuhi kewajiban mereka.',
  },
];

// ─── TRUST SIGNALS (stat bar) ─────────────────────────────────────────────────
export const trustSignals = [
  { value: SITE_STATS.totalFundSecured, label: 'Total Diamankan' },
  { value: SITE_STATS.activeUsers, label: 'Pengguna Aktif' },
  { value: SITE_STATS.uptime, label: 'Tingkat Keberhasilan' },
  { value: '24/7', label: 'Dukungan' },
];

// ─── COMPLIANCE PARTNERS ──────────────────────────────────────────────────────
export const compliancePartners = [
  { name: 'Bank Indonesia', logo: '/images/compliance/bi.svg', abbr: 'BI', fallbackIcon: Bank },
  { name: 'PPATK', logo: '/images/compliance/ppatk.svg', abbr: 'PPATK', fallbackIcon: Certificate },
  { name: 'Kemenkumham', logo: '/images/compliance/kemenkumham.svg', abbr: 'Kemenkumham', fallbackIcon: Gavel },
  { name: 'Kominfo', logo: '/images/compliance/kominfo.svg', abbr: 'Kominfo', fallbackIcon: Broadcast },
];

// ─── BUYER / SELLER RISKS ─────────────────────────────────────────────────────
export const buyerRisks = [
  'Bayar di muka tanpa jaminan pengiriman',
  'Menerima barang palsu atau rusak',
  'Penjual menghilang setelah pembayaran',
  'Tidak ada penyelesaian sengketa',
  'Sulit mendapatkan refund',
];

export const sellerRisks = [
  'Mengirim barang tanpa konfirmasi pembayaran',
  'Chargeback palsu setelah pengiriman',
  'Pembeli mengaku tidak menerima barang secara palsu',
  'Pembayaran dibatalkan dan sengketa',
  'Waktu dan sumber daya terbuang pada transaksi buruk',
];
