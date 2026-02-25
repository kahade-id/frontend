/*
 * KAHADE INTEGRATION GUIDE — NEW PAGE v1.0
 *
 * Panduan integrasi escrow P2P Kahade.
 * Konteks: User/developer mengintegrasikan Kahade ke platform sendiri.
 * Design: Mengikuti design system Kahade sepenuhnya.
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
 Plug, CheckCircle, ArrowRight, Code, Broadcast,
 ShieldCheck, Clock, Warning, Lightbulb
} from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';
import { fadeInUp, staggerContainer, staggerItem } from '@kahade/utils';

const steps = [
 {
 step: '01',
 title: 'Daftar & Verifikasi',
 description: 'Buat akun Kahade dan selesaikan verifikasi identitas (KYC) untuk mendapatkan akses API.',
 details: [
 'Daftar di kahade.id/register',
 'Lengkapi profil dan verifikasi KYC',
 'Ajukan permohonan akses API ke halo@kahade.id',
 'Terima API key dan sandbox credentials',
 ]
 },
 {
 step: '02',
 title: 'Konfigurasi Webhook',
 description: 'Daftarkan URL webhook Anda untuk menerima notifikasi real-time dari semua event transaksi.',
 details: [
 'Masuk ke Dashboard → Pengaturan → Webhook',
 'Masukkan URL endpoint webhook Anda',
 'Salin secret key untuk verifikasi payload',
 'Uji koneksi dengan event test',
 ]
 },
 {
 step: '03',
 title: 'Implementasi Alur Transaksi',
 description: 'Implementasikan siklus penuh escrow: buat transaksi → setor dana → lepas dana.',
 details: [
 'POST /transactions — buat transaksi baru',
 'POST /transactions/:id/fund — setor dana',
 'POST /transactions/:id/release — lepas dana',
 'POST /transactions/:id/dispute — ajukan sengketa',
 ]
 },
 {
 step: '04',
 title: 'Uji di Sandbox',
 description: 'Gunakan lingkungan sandbox untuk menguji seluruh alur sebelum go-live ke produksi.',
 details: [
 'Base URL Sandbox: https://sandbox.api.kahade.id/v1',
 'Gunakan kartu test: 4111 1111 1111 1111',
 'Simulasikan semua status transaksi',
 'Verifikasi semua webhook events diterima',
 ]
 },
 {
 step: '05',
 title: 'Go Live ke Produksi',
 description: 'Setelah pengujian berhasil, pindah ke lingkungan produksi dengan API key produksi.',
 details: [
 'Ganti base URL ke https://api.kahade.id/v1',
 'Gunakan API key produksi',
 'Verifikasi konfigurasi keamanan (HTTPS, signature)',
 'Monitor transaksi pertama dengan teliti',
 ]
 },
];

const checklist = [
 { item: 'Akun Kahade terverifikasi (KYC selesai)', critical: true },
 { item: 'API key diperoleh dari tim Kahade', critical: true },
 { item: 'HTTPS dikonfigurasi di server Anda', critical: true },
 { item: 'Verifikasi HMAC-SHA256 untuk webhook diimplementasikan', critical: true },
 { item: 'Error handling untuk semua kemungkinan respons API', critical: false },
 { item: 'Retry logic untuk webhook gagal', critical: false },
 { item: 'Logging transaksi untuk audit trail', critical: false },
 { item: 'Pengujian di sandbox selesai 100%', critical: true },
];

export default function IntegrationDocs() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* Hero */}
 <section className="section-padding-lg relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-60" aria-hidden="true" />
 <div className="container relative z-10">
 <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto">
 <span className="badge badge-secondary mb-4 inline-block">Panduan Integrasi</span>
 <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
 Integrasikan Kahade ke Platform Anda
 </h1>
 <p className="text-lg text-muted-foreground mb-8">
 Panduan langkah demi langkah untuk mengintegrasikan escrow P2P Kahade.
 Dari sandbox hingga produksi dalam waktu singkat.
 </p>
 <Link href="/docs/api" className="block">
 <Button  variant="primary"  size="lg" >
 Lihat Referensi API
 <ArrowRight className="ml-2 w-5 h-5" weight="bold" aria-hidden="true" />
 </Button>
 </Link>
 </motion.div>
 </div>
 </section>

 {/* Quick Stats */}
 <section className="py-8 border-b border-border">
 <div className="container">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 max-w-2xl mx-auto text-center">
 {[
 { value: '5 Langkah', label: 'Integrasi Penuh' },
 { value: '< 1 Hari', label: 'Estimasi Waktu' },
 { value: 'REST API', label: 'Teknologi' },
 ].map((s) => (
 <div key={s.label}>
 <p className="text-xl md:text-2xl font-bold mb-1">{s.value}</p>
 <p className="text-xs md:text-sm text-muted-foreground">{s.label}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Steps */}
 <section className="section-padding">
 <div className="container">
 <motion.div {...fadeInUp} className="text-center mb-12 max-w-2xl mx-auto">
 <h2 className="text-3xl font-bold mb-4">Langkah-Langkah Integrasi</h2>
 <p className="text-muted-foreground">
 Ikuti 5 langkah berikut untuk mengintegrasikan escrow Kahade sepenuhnya.
 </p>
 </motion.div>

 <motion.div
 variants={staggerContainer}
 initial="initial"
 whileInView="animate"
 viewport={{ once: true }}
 className="max-w-4xl mx-auto space-y-6"
 >
 {steps.map((step, i) => (
 <motion.div
 key={step.step}
 variants={staggerItem}
 className="card card-hover p-6 md:p-8"
 >
 <div className="flex flex-col md:flex-row gap-6">
 <div className="flex-shrink-0">
 <span className="text-4xl font-bold text-muted-foreground/40 font-mono leading-none">
 {step.step}
 </span>
 </div>
 <div className="flex-1">
 <h3 className="text-xl font-bold mb-2">{step.title}</h3>
 <p className="text-muted-foreground mb-4">{step.description}</p>
 <ul className="space-y-2">
 {step.details.map((detail) => (
 <li key={detail} className="flex items-start gap-3 text-sm">
 <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" weight="fill" aria-hidden="true" />
 {detail.includes('/api/') || detail.includes('POST ') || detail.includes('https://') ? (
 <code className="font-mono text-foreground">{detail}</code>
 ) : (
 <span className="text-muted-foreground">{detail}</span>
 )}
 </li>
 ))}
 </ul>
 </div>
 </div>
 </motion.div>
 ))}
 </motion.div>
 </div>
 </section>

 {/* Pre-launch Checklist */}
 <section className="section-padding bg-muted/30">
 <div className="container">
 <div className="max-w-3xl mx-auto">
 <motion.div {...fadeInUp} className="mb-8">
 <h2 className="text-2xl font-bold mb-2">Checklist Sebelum Go-Live</h2>
 <p className="text-muted-foreground">
 Pastikan semua item berikut telah terpenuhi sebelum beralih ke produksi.
 </p>
 </motion.div>
 <motion.div
 variants={staggerContainer}
 initial="initial"
 whileInView="animate"
 viewport={{ once: true }}
 className="space-y-3"
 >
 {checklist.map((item) => (
 <motion.div
 key={item.item}
 variants={staggerItem}
 className="card p-4 flex items-center gap-4"
 >
 <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
 item.critical ? 'border-foreground' : 'border-border'
 }`} aria-hidden="true">
 <div className="w-2 h-2 rounded-sm bg-transparent" />
 </div>
 <span className="text-sm flex-1">{item.item}</span>
 {item.critical && (
 <span className="badge badge-primary text-xs flex-shrink-0">Wajib</span>
 )}
 </motion.div>
 ))}
 </motion.div>
 </div>
 </div>
 </section>

 {/* Warning & Support */}
 <section className="section-padding">
 <div className="container">
 <div className="max-w-3xl mx-auto space-y-6">
 <motion.div {...fadeInUp} className="card border-amber-200 bg-amber-50/50 p-5 flex items-start gap-3">
 <Warning className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" weight="duotone" aria-hidden="true" />
 <div>
 <p className="font-semibold text-amber-800 mb-1">Penting: Jangan Lewati Sandbox</p>
 <p className="text-sm text-amber-700">
 Selalu uji integrasi Anda secara menyeluruh di lingkungan sandbox sebelum melanjutkan ke produksi.
 Transaksi produksi melibatkan dana nyata pengguna.
 </p>
 </div>
 </motion.div>

 <motion.div {...fadeInUp} className="card p-5 flex items-start gap-3">
 <Lightbulb className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" weight="duotone" aria-hidden="true" />
 <div>
 <p className="font-semibold mb-1">Butuh Bantuan Integrasi?</p>
 <p className="text-sm text-muted-foreground mb-3">
 Tim teknis kami siap membantu proses integrasi Anda. Hubungi kami untuk konsultasi teknis gratis.
 </p>
 <a href="mailto:halo@kahade.id">
 <Button variant="outline" size="sm">
 Hubungi Tim Teknis
 </Button>
 </a>
 </div>
 </motion.div>
 </div>
 </div>
 </section>

 {/* Nav */}
 <section className="section-padding bg-muted/30">
 <div className="container">
 <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-4 justify-center">
 <Link href="/docs/api" className="block">
 <Button  variant="primary" className="w-full sm:w-auto">
 <Code className="mr-2 w-4 h-4" weight="duotone" aria-hidden="true" />
 Referensi API Lengkap
 </Button>
 </Link>
 <Link href="/docs" className="block">
 <Button variant="outline" className="w-full sm:w-auto">
 Kembali ke Dokumentasi
 </Button>
 </Link>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}