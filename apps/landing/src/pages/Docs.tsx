/*
 * KAHADE DOCUMENTATION CENTER — NEW PAGE v1.0
 *
 * Dokumentasi untuk escrow P2P internal (user-to-user).
 * Bukan dokumentasi bisnis/B2B.
 * Mengikuti design system Kahade (bg-background, section-padding, badge, card).
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
 BookOpen, Code, Plug, FileText, ShieldCheck, Wallet,
 ArrowRight, Question, Headset, Clock, Scales, Package
} from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';
import { fadeInUp, staggerContainer, staggerItem } from '@kahade/utils';

const docCategories = [
 {
 icon: BookOpen,
 title: 'Panduan Pengguna',
 description: 'Cara memulai, membuat transaksi, dan menggunakan fitur Kahade.',
 href: '/help',
 articles: [
 { title: 'Cara membuat transaksi escrow pertama', href: '/help#create-transaction' },
 { title: 'Cara menyetor dana ke escrow', href: '/help#deposit' },
 { title: 'Cara mengonfirmasi penerimaan barang', href: '/help#confirm' },
 { title: 'Cara membuka sengketa', href: '/help#dispute' },
 ]
 },
 {
 icon: Wallet,
 title: 'Dompet & Pembayaran',
 description: 'Panduan setoran, penarikan, metode pembayaran, dan limit transaksi.',
 href: '/help#payments',
 articles: [
 { title: 'Metode pembayaran yang didukung', href: '/help#payment-methods' },
 { title: 'Cara menarik saldo ke rekening bank', href: '/help#withdraw' },
 { title: 'Limit transaksi dan verifikasi', href: '/help#limits' },
 { title: 'Biaya dan struktur tarif', href: '/pricing' },
 ]
 },
 {
 icon: ShieldCheck,
 title: 'Keamanan & KYC',
 description: 'Verifikasi identitas, keamanan akun, dan perlindungan data.',
 href: '/security',
 articles: [
 { title: 'Cara verifikasi identitas (KYC)', href: '/help#kyc' },
 { title: 'Mengaktifkan autentikasi 2 faktor', href: '/help#2fa' },
 { title: 'Kebijakan keamanan Kahade', href: '/security' },
 { title: 'Apa yang dilindungi oleh escrow', href: '/how-it-works' },
 ]
 },
 {
 icon: Scales,
 title: 'Resolusi Sengketa',
 description: 'Proses penyelesaian sengketa, bukti yang dibutuhkan, dan tenggat waktu.',
 href: '/help#dispute',
 articles: [
 { title: 'Cara mengajukan sengketa', href: '/help#open-dispute' },
 { title: 'Bukti yang dibutuhkan untuk sengketa', href: '/help#dispute-evidence' },
 { title: 'Proses keputusan mediasi', href: '/help#mediation' },
 { title: 'Tenggat waktu sengketa', href: '/help#dispute-timeline' },
 ]
 },
 {
 icon: Code,
 title: 'API untuk Developer',
 description: 'Dokumentasi API escrow P2P Kahade untuk integrasi custom.',
 href: '/docs/api',
 articles: [
 { title: 'Autentikasi API', href: '/docs/api#auth' },
 { title: 'Endpoint transaksi', href: '/docs/api#transactions' },
 { title: 'Webhook & notifikasi', href: '/docs/api#webhooks' },
 { title: 'Panduan integrasi', href: '/docs/integration' },
 ]
 },
 {
 icon: Package,
 title: 'Alur Transaksi',
 description: 'Memahami siklus lengkap transaksi escrow dari awal hingga selesai.',
 href: '/how-it-works',
 articles: [
 { title: 'Diagram alur transaksi lengkap', href: '/how-it-works#flow' },
 { title: 'Status transaksi dan artinya', href: '/how-it-works#status' },
 { title: 'Periode penahanan dan konfirmasi', href: '/how-it-works#holding' },
 { title: 'Auto-release dan kondisi kadaluarsa', href: '/how-it-works#auto-release' },
 ]
 },
];

const quickLinks = [
 { icon: Question, label: 'FAQ', href: '/faq', desc: 'Pertanyaan yang sering diajukan' },
 { icon: Headset, label: 'Pusat Bantuan', href: '/help', desc: 'Artikel dan panduan detail' },
 { icon: FileText, label: 'Cara Kerja', href: '/how-it-works', desc: 'Alur escrow P2P lengkap' },
 { icon: Clock, label: 'Kontak Support', href: '/contact', desc: 'Bicara dengan tim kami' },
];

export default function Docs() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* Hero */}
 <section className="section-padding-lg relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-60" aria-hidden="true" />
 <div className="container relative z-10">
 <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto">
 <span className="badge badge-secondary mb-4 inline-block">Dokumentasi</span>
 <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
 Pusat Dokumentasi Kahade
 </h1>
 <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
 Temukan panduan, referensi API, dan artikel bantuan untuk menggunakan
 platform escrow P2P Kahade secara optimal.
 </p>
 <div className="flex flex-wrap gap-3 justify-center">
 {quickLinks.map((link) => (
 <Link key={link.label} href={link.href}>
 <span className="badge badge-secondary inline-flex items-center gap-2 cursor-pointer hover:bg-foreground hover:text-background transition-colors px-4 py-2">
 <link.icon className="w-4 h-4" weight="duotone" aria-hidden="true" />
 {link.label}
 </span>
 </Link>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* Doc Categories */}
 <section className="section-padding">
 <div className="container">
 <motion.div
 variants={staggerContainer}
 initial="initial"
 whileInView="animate"
 viewport={{ once: true }}
 className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
 >
 {docCategories.map((cat) => (
 <motion.div key={cat.title} variants={staggerItem} className="card card-hover p-6">
 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4">
 <cat.icon className="w-5 h-5" weight="duotone" aria-hidden="true" />
 </div>
 <h3 className="font-bold text-lg mb-2">{cat.title}</h3>
 <p className="text-sm text-muted-foreground mb-4">{cat.description}</p>
 <ul className="space-y-2 mb-4">
 {cat.articles.map((article) => (
 <li key={article.title}>
 <Link href={article.href} className="block text-sm hover:text-foreground text-muted-foreground transition-colors flex items-center gap-2 group">
 <ArrowRight className="w-3 h-3 flex-shrink-0 group-hover:translate-x-1 transition-transform" weight="bold" aria-hidden="true" />
 {article.title}
 </Link>
 </li>
 ))}
 </ul>
 <Link href={cat.href} className="block text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
 Lihat semua
 <ArrowRight className="w-4 h-4" weight="bold" aria-hidden="true" />
 </Link>
 </motion.div>
 ))}
 </motion.div>
 </div>
 </section>

 {/* API Promo */}
 <section className="section-padding bg-muted/30">
 <div className="container">
 <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
 <motion.div {...fadeInUp} className="card card-premium p-6">
 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4">
 <Code className="w-5 h-5" weight="duotone" aria-hidden="true" />
 </div>
 <h3 className="font-bold text-xl mb-2">API Escrow P2P</h3>
 <p className="text-sm text-muted-foreground mb-4">
 Integrasikan Kahade langsung ke aplikasi atau platform Anda menggunakan
 REST API kami yang terdokumentasi lengkap.
 </p>
 <Link href="/docs/api" className="block">
 <Button className="btn-primary">
 Lihat Dokumentasi API
 <ArrowRight className="ml-2 w-4 h-4" weight="bold" aria-hidden="true" />
 </Button>
 </Link>
 </motion.div>
 <motion.div {...fadeInUp} className="card card-premium p-6">
 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-4">
 <Plug className="w-5 h-5" weight="duotone" aria-hidden="true" />
 </div>
 <h3 className="font-bold text-xl mb-2">Panduan Integrasi</h3>
 <p className="text-sm text-muted-foreground mb-4">
 Panduan langkah demi langkah untuk mengintegrasikan sistem escrow
 Kahade ke platform Anda dengan cepat dan aman.
 </p>
 <Link href="/docs/integration" className="block">
 <Button variant="outline" className="btn-lg">
 Panduan Integrasi
 <ArrowRight className="ml-2 w-4 h-4" weight="bold" aria-hidden="true" />
 </Button>
 </Link>
 </motion.div>
 </div>
 </div>
 </section>

 {/* Contact Support */}
 <section className="section-padding">
 <div className="container">
 <motion.div {...fadeInUp} className="text-center max-w-2xl mx-auto">
 <h2 className="text-2xl font-bold mb-4">Tidak menemukan yang dicari?</h2>
 <p className="text-muted-foreground mb-6">
 Tim dukungan kami siap membantu Anda. Hubungi kami melalui live chat,
 email, atau telepon.
 </p>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <Link href="/help" className="block">
 <Button className="btn-primary">
 Buka Pusat Bantuan
 </Button>
 </Link>
 <Link href="/contact" className="block">
 <Button variant="outline">
 Hubungi Tim Kami
 </Button>
 </Link>
 </div>
 </motion.div>
 </div>
 </section>

 <Footer />
 </div>
 );
}