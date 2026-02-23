// Shared data for Home page components
import { 
 ShieldCheck, Lock, Lightning, CheckCircle,
 Wallet, FileText, Clock, Star, Globe, Eye, 
 IdentificationBadge, CreditCard, Warning, UserCircle,
 Package, HandCoins, Scales, ChartLineUp, Fingerprint, Bell,
 Bank, Certificate, Gavel, Broadcast
} from '@phosphor-icons/react';

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
 monthlyPrice: 299000,
 yearlyPrice: 2990000,
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
 yearlyPrice: 9990000,
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

export const testimonials = [
 {
 name: 'Sarah Wijaya',
 role: 'Desainer Freelance',
 content: 'Kahade mengubah cara saya menangani pembayaran klien. Tidak perlu lagi mengejar invoice atau khawatir tidak dibayar.',
 rating: 5,
 avatar: 'SW'
 },
 {
 name: 'Michael Chen',
 role: 'Pemilik E-commerce',
 content: 'Sebagai penjual online, kepercayaan adalah segalanya. Kahade membantu saya membangun kepercayaan dengan pelanggan baru.',
 rating: 5,
 avatar: 'MC'
 },
 {
 name: 'Emily Rodriguez',
 role: 'Digital Marketer',
 content: 'Kami menggunakan Kahade untuk semua proyek klien. Fitur transparansi dan keamanannya tepat seperti yang kami butuhkan.',
 rating: 5,
 avatar: 'ER'
 },
];

export const trustSignals = [
 { value: 'Rp 50M+', label: 'Total Diamankan' },
 { value: '10.000+', label: 'Pengguna Aktif' },
 { value: '99,9%', label: 'Tingkat Keberhasilan' },
 { value: '24/7', label: 'Dukungan' },
];

export const compliancePartners = [
 { name: 'Bank Indonesia', logo: '/images/compliance/bi.svg', abbr: 'BI', fallbackIcon: Bank },
 { name: 'PPATK', logo: '/images/compliance/ppatk.svg', abbr: 'PPATK', fallbackIcon: Certificate },
 { name: 'Kemenkumham', logo: '/images/compliance/kemenkumham.svg', abbr: 'Kemenkumham', fallbackIcon: Gavel },
 { name: 'Kominfo', logo: '/images/compliance/kominfo.svg', abbr: 'Kominfo', fallbackIcon: Broadcast },
];

export const buyerRisks = [
 'Bayar di muka tanpa jaminan pengiriman',
 'Menerima barang palsu atau rusak',
 'Penjual menghilang setelah pembayaran',
 'Tidak ada penyelesaian sengketa',
 'Sulit mendapatkan refund'
];

export const sellerRisks = [
 'Mengirim barang tanpa konfirmasi pembayaran',
 'Chargeback palsu setelah pengiriman',
 'Pembeli mengaku tidak menerima barang secara palsu',
 'Pembayaran dibatalkan dan sengketa',
 'Waktu dan sumber daya terbuang pada transaksi buruk'
];
