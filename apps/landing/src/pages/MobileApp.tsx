import { motion } from 'framer-motion';
import {
 DeviceMobile, BellRinging, ShieldCheck, Lightning,
 Star, ArrowRight, GooglePlayLogo, AppStoreLogo
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const appFeatures = [
 { icon: BellRinging, title: 'Notifikasi Real-time', desc: 'Dapat notifikasi instan setiap ada update transaksi.' },
 { icon: ShieldCheck, title: 'Biometrik & 2FA', desc: 'Login dengan Face ID atau fingerprint untuk keamanan ekstra.' },
 { icon: Lightning, title: 'Pembayaran QRIS', desc: 'Bayar dan konfirmasi transaksi langsung dari kamera.' },
 { icon: DeviceMobile, title: 'Offline-ready', desc: 'Cek status transaksi bahkan saat koneksi lemah.' },
];

const screens = [
 { label: 'Dashboard', bg: 'from-primary/20 to-primary/5' },
 { label: 'Buat Transaksi', bg: 'from-purple-500/20 to-purple-500/5' },
 { label: 'Status', bg: 'from-green-500/20 to-green-500/5' },
 { label: 'Wallet', bg: 'from-orange-500/20 to-orange-500/5' },
];

const reviews = [
 { name: 'Budi S.', rating: 5, text: 'Akhirnya ada rekber yang beneran aman dan cepet. Udah 20+ transaksi, ga ada masalah.' },
 { name: 'Dewi P.', rating: 5, text: 'Sebagai freelancer, ini solusi terbaik. Klien juga senang karena transparan.' },
 { name: 'Ahmad R.', rating: 4, text: 'Aplikasinya smooth, UX-nya bagus. Pencairan cepat sesuai janji.' },
];

export default function MobileApp() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 overflow-hidden">
 <div className="container">
 <div className="grid lg:grid-cols-2 gap-12 items-center">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.span variants={staggerItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium mb-8">
 Kahade Mobile
 </motion.span>
 <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
 Kahade di<br />genggaman Anda
 </motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 text-lg mb-10">
 Kelola transaksi escrow dari smartphone dengan alur yang ringan, jelas, dan aman.
 </motion.p>
 <motion.div variants={staggerItem} className="flex flex-wrap gap-4">
 <a href="https://apps.apple.com" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-white text-primary px-5 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors">
 <AppStoreLogo size={24} /> App Store
 </a>
 <a href="https://play.google.com" target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-white text-primary px-5 py-3 rounded-xl font-semibold hover:bg-white/90 transition-colors">
 <GooglePlayLogo size={24} /> Play Store
 </a>
 </motion.div>
 <motion.p variants={staggerItem} className="text-primary-foreground/60 text-sm mt-4">
 Beta terbatas · iOS 14+ · Android 8.0+
 </motion.p>
 </motion.div>

 {/* Phone Mockup */}
 <motion.div variants={fadeInUp} initial="initial" animate="animate" className="flex justify-center">
 <div className="w-64 h-[500px] bg-white/10 rounded-[3rem] border-4 border-white/20 flex items-center justify-center relative">
 <div className="absolute top-6 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-white/20 rounded-full" />
 <div className="text-center">
 <DeviceMobile size={64} className="text-white/30 mx-auto mb-4" />
 <p className="text-white/40 text-sm">Mockup App</p>
 </div>
 </div>
 </motion.div>
 </div>
 </div>
 </section>

 {/* FEATURES */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-12">
 <span className="badge badge-secondary mb-3">Fitur Unggulan</span>
 <h2 className="text-3xl font-bold">Semua yang Anda Butuhkan</h2>
 </motion.div>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
 {appFeatures.map((f) => {
 const Icon = f.icon;
 return (
 <motion.div key={f.title} variants={staggerItem} className="card p-6 text-center">
 <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
 <Icon size={24} className="text-primary" weight="duotone" />
 </div>
 <h3 className="font-bold mb-2">{f.title}</h3>
 <p className="text-sm text-muted-foreground">{f.desc}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* SCREENS SHOWCASE */}
 <section className="section-padding-lg bg-muted/40 overflow-hidden">
 <div className="container">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport} className="text-center mb-10">
 <h2 className="text-3xl font-bold">Tampilan Aplikasi</h2>
 </motion.div>
 <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 justify-center">
 {screens.map((s) => (
 <div key={s.label} className="shrink-0 w-44">
 <div className={`bg-gradient-to-b ${s.bg} rounded-3xl border border-border h-80 flex items-end p-4`}>
 <span className="text-xs font-semibold bg-background/80 px-2 py-1 rounded-full">{s.label}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* REVIEWS */}
 <section className="section-padding-lg">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-10">
 <div className="flex items-center justify-center gap-2 mb-2">
 {[...Array(5)].map((_, i) => <Star key={i} size={24} className="text-yellow-500" weight="fill" />)}
 </div>
 <div className="text-4xl font-bold mb-1">4.8<span className="text-2xl text-muted-foreground">/5</span></div>
 <p className="text-muted-foreground text-sm">Dari 500+ ulasan terverifikasi (tautan store tersedia di tombol download)</p>
 </motion.div>
 <div className="grid md:grid-cols-3 gap-5">
 {reviews.map((r) => (
 <motion.div key={r.name} variants={staggerItem} className="card p-6">
 <div className="flex items-center gap-1 mb-3">
 {[...Array(r.rating)].map((_, i) => <Star key={i} size={14} className="text-yellow-500" weight="fill" />)}
 </div>
 <p className="text-sm text-muted-foreground mb-4 leading-relaxed">"{r.text}"</p>
 <p className="text-sm font-semibold">{r.name}</p>
 </motion.div>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* DOWNLOAD CTA */}
 <section className="section-padding-md bg-primary text-primary-foreground">
 <div className="container text-center max-w-2xl mx-auto">
 <h2 className="text-3xl font-bold mb-4">Ikuti akses beta</h2>
 <p className="text-primary-foreground/70 mb-8">Store listing masih bertahap. Daftar sekarang untuk mendapat info rilis dan early access.</p>
 <div className="flex gap-4 justify-center flex-wrap">
 <a href="/contact" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
 Dapatkan Early Access <ArrowRight size={18} />
 </a>
 <a href="https://play.google.com" target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-3 px-6 py-3 border-white/30 text-white hover:text-primary hover:bg-white">
 <GooglePlayLogo size={24} /> Play Store
 </a>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}