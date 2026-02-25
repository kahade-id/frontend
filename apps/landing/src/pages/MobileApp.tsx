import { motion } from 'framer-motion';
import {
 DeviceMobile, BellRinging, ShieldCheck, Lightning,
 Star, ArrowRight, GooglePlayLogo, AppStoreLogo
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { PageHero } from '../components/common/PageHero';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

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
 <PageHero eyebrow="Mobile App" title="Kahade di Genggaman Anda" description="Pantau, kelola, dan selesaikan transaksi escrow kapan pun melalui aplikasi mobile Kahade." chips={[{ label: 'iOS & Android' }, { label: 'Notifikasi Real-time' }, { label: 'Secure Access' } ]} />

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
 <div className="flex gap-4 overflow-x-auto scrollbar-thin pb-4 justify-center">
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
 <Button asChild variant="primary" className="inline-flex items-center gap-2 px-6 py-3"><a href="/contact" >
 Dapatkan Early Access <ArrowRight size={18} />
 </a></Button>
 <Button asChild variant="secondary" className="inline-flex items-center gap-3 px-6 py-3 border-white/30 text-white hover:text-primary hover:bg-white"><a href="https://play.google.com" target="_blank" rel="noreferrer" >
 <GooglePlayLogo size={24} /> Play Store
 </a></Button>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}