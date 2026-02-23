import { motion } from 'framer-motion';
import {
 ShieldCheck, Lock, IdentificationCard, ClipboardText,
 Robot, Database, ArrowRight, DownloadSimple,
 Certificate, Detective, SealCheck
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const badges = ['SSL 256-bit', 'OJK Compliant', 'ISO 27001', 'Bank-grade Security'];

const features = [
 {
 icon: ShieldCheck, title: 'Enkripsi SSL 256-bit', large: true,
 description: 'Semua data yang ditransmisikan dienkripsi menggunakan SSL 256-bit — standar yang sama digunakan oleh bank-bank besar dunia. Data yang tersimpan dienkripsi dengan AES-256.',
 },
 { icon: Lock, title: '2FA Wajib', description: 'Autentikasi dua faktor melindungi akun Anda bahkan jika password bocor.' },
 { icon: IdentificationCard, title: 'Verifikasi KYC', description: 'Semua pengguna diverifikasi identitasnya untuk mencegah penipuan.' },
 { icon: ClipboardText, title: 'Audit Log Lengkap', description: 'Setiap aksi tercatat. Transparency penuh untuk ketenangan Anda.' },
 { icon: Robot, title: 'Deteksi Fraud AI', description: 'Sistem AI kami memantau transaksi 24/7 untuk aktivitas mencurigakan.' },
 {
 icon: Database, title: 'Disaster Recovery', wide: true,
 description: 'Infrastruktur multi-region dengan backup otomatis setiap jam. RTO < 4 jam, RPO < 1 jam. Uptime SLA 99.9% dengan monitoring real-time.',
 },
];

const compliance = [
 { icon: Certificate, name: 'OJK', desc: 'Terdaftar di Otoritas Jasa Keuangan Republik Indonesia.' },
 { icon: SealCheck, name: 'ISO 27001', desc: 'Standar internasional untuk keamanan informasi.' },
 { icon: Detective, name: 'KYC/AML', desc: 'Patuh pada regulasi Know Your Customer dan Anti Money Laundering.' },
 { icon: Database, name: 'Bank Indonesia', desc: 'Mengikuti panduan dan regulasi Bank Indonesia untuk fintech.' },
];

export default function Security() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 overflow-hidden overflow-hidden">
 <div className="container text-center max-w-3xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-bold mb-6">
 Keamanan setara bank.<br />
 <span className="text-white/60">Untuk semua orang.</span>
 </motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 text-lg mb-10">
 Kami menerapkan standar keamanan tertinggi agar setiap transaksi Anda terlindungi.
 </motion.p>
 <motion.div variants={staggerItem} className="flex flex-wrap gap-3 justify-center">
 {badges.map(b => (
 <span key={b} className="px-4 py-2 bg-white/10 rounded-full text-sm font-medium border border-white/20">{b}</span>
 ))}
 </motion.div>
 </motion.div>
 </div>
 </section>

 {/* SECURITY FEATURES BENTO */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-14">
 <span className="badge badge-secondary mb-3">Teknologi Keamanan</span>
 <h2 className="text-3xl md:text-4xl font-bold">Berlapis, Komprehensif, Terpercaya</h2>
 </motion.div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
 {features.map((f) => {
 const Icon = f.icon;
 const spanClass = f.large ? 'md:col-span-2 md:row-span-2' : f.wide ? 'md:col-span-2' : '';
 return (
 <motion.div key={f.title} variants={staggerItem} className={`card p-6 ${spanClass}`}>
 <div className={`${f.large ? 'w-16 h-16' : 'w-12 h-12'} bg-primary/10 rounded-2xl flex items-center justify-center mb-4`}>
 <Icon size={f.large ? 32 : 24} className="text-primary" weight="duotone" />
 </div>
 <h3 className={`font-bold mb-2 ${f.large ? 'text-xl' : ''}`}>{f.title}</h3>
 <p className={`text-muted-foreground ${f.large ? 'text-base leading-relaxed' : 'text-sm'}`}>{f.description}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* COMPLIANCE */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container max-w-5xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-12">
 <span className="badge badge-secondary mb-3">Regulasi & Kepatuhan</span>
 <h2 className="text-3xl font-bold">Kami Mematuhi Standar Tertinggi</h2>
 </motion.div>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
 {compliance.map((c) => {
 const Icon = c.icon;
 return (
 <motion.div key={c.name} variants={staggerItem} className="card p-6 text-center">
 <Icon size={32} className="text-primary mx-auto mb-3" weight="duotone" />
 <h3 className="font-bold mb-2">{c.name}</h3>
 <p className="text-xs text-muted-foreground">{c.desc}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* SECURITY REPORT */}
 <section className="section-padding-md">
 <div className="container max-w-2xl mx-auto text-center">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <h2 className="text-2xl font-bold mb-3">Transparansi Total</h2>
 <p className="text-muted-foreground mb-6">Unduh laporan keamanan dan audit kami yang tersedia untuk publik.</p>
 <button className="btn-secondary">
 <DownloadSimple size={18} /> Unduh Laporan Keamanan
 </button>
 </motion.div>
 </div>
 </section>

 <Footer />
 </div>
 );
}
