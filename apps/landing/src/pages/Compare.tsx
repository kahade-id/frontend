import { motion } from 'framer-motion';
import { CheckCircle, X, ArrowRight, Star } from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { fadeInUp, staggerContainer, staggerItem, viewport } from '@kahade/utils';

const rows = [
 { feature: 'Perlindungan Escrow', kahade: true, kompetitor: true, transfer: false },
 { feature: 'Verifikasi Identitas KYC', kahade: true, kompetitor: '-', transfer: false },
 { feature: 'Resolusi Sengketa', kahade: true, kompetitor: '-', transfer: false },
 { feature: 'Biaya Platform', kahade: '2.5%', kompetitor: '3%', transfer: 'Gratis*' },
 { feature: 'Kecepatan Pencairan', kahade: '< 12 jam', kompetitor: '24-48 jam', transfer: '1-3 hari' },
 { feature: 'Support 24/7', kahade: true, kompetitor: '-', transfer: false },
 { feature: 'Akses API', kahade: true, kompetitor: false, transfer: false },
 { feature: 'Notifikasi Real-time', kahade: true, kompetitor: true, transfer: false },
 { feature: 'Mobile App', kahade: true, kompetitor: false, transfer: '-' },
 { feature: 'Audit Log', kahade: true, kompetitor: false, transfer: false },
];

const renderVal = (val: boolean | string, isKahade = false) => {
 if (typeof val === 'boolean') {
 return val
 ? <CheckCircle size={20} className="text-green-600 mx-auto" weight="fill" />
 : <X size={20} className="text-red-500/40 mx-auto" />;
 }
 return <span className={`text-sm font-medium ${isKahade ? 'text-primary font-bold' : ''}`}>{val}</span>;
};

const advantages = [
 { title: 'Tercepat', desc: 'Pencairan dalam 12 jam, bukan berhari-hari.' },
 { title: 'Teraman', desc: 'Verifikasi KYC + 2FA + enkripsi SSL 256-bit.' },
 { title: 'Terlengkap', desc: 'Escrow + sengketa + API + mobile app dalam satu platform.' },
];

export default function Compare() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 text-center overflow-hidden">
 <div className="container max-w-3xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.span variants={staggerItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium mb-8">
 Perbandingan
 </motion.span>
 <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-bold mb-6">Mengapa Kahade Lebih Unggul</motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 text-lg">Perbandingan jujur dengan alternatif yang ada di pasaran.</motion.p>
 </motion.div>
 </div>
 </section>

 {/* COMPARISON TABLE */}
 <section className="section-padding-lg">
 <div className="container max-w-5xl mx-auto">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <div className="border border-border rounded-2xl overflow-hidden ">
 <div className="overflow-x-auto">
 {/* Header */}
 <div className="grid grid-cols-4 min-w-[480px]">
 <div className="p-5 bg-muted/50" />
 <div className="p-5 bg-primary/5 border-x border-primary/20 text-center">
 <div className="flex items-center justify-center gap-1.5 mb-1">
 <Star size={16} className="text-primary" weight="fill" />
 <span className="font-bold text-primary">KAHADE</span>
 </div>
 <span className="text-xs text-muted-foreground">Platform Escrow</span>
 </div>
 <div className="p-5 bg-muted/30 text-center border-r border-border">
 <div className="font-bold text-sm mb-1">Kompetitor A</div>
 <span className="text-xs text-muted-foreground">Rekber biasa</span>
 </div>
 <div className="p-5 text-center">
 <div className="font-bold text-sm mb-1">Transfer Biasa</div>
 <span className="text-xs text-muted-foreground">Bank/e-wallet</span>
 </div>
 </div>
 {/* Rows */}
 {rows.map((row, i) => (
 <div key={i} className={`grid grid-cols-4 border-t border-border ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
 <div className="p-4 text-sm text-muted-foreground">{row.feature}</div>
 <div className="p-4 bg-primary/5 border-x border-primary/20 flex items-center justify-center">
 {renderVal(row.kahade, true)}
 </div>
 <div className="p-4 flex items-center justify-center border-r border-border">
 {renderVal(row.kompetitor)}
 </div>
 <div className="p-4 flex items-center justify-center">
 {renderVal(row.transfer)}
 </div>
 </div>
 ))}
 </div>
 </div>{/* end border card */}
 <p className="text-xs text-muted-foreground text-center mt-4 px-2">*Transfer biasa tidak memiliki perlindungan. Risiko penipuan ditanggung pengguna sendiri.</p>
 </motion.div>
 </div>
 </section>

 {/* ADVANTAGES */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.h2 variants={staggerItem} className="text-3xl font-bold text-center mb-10">Keunggulan Kahade</motion.h2>
 <div className="grid md:grid-cols-3 gap-6">
 {advantages.map((adv) => (
 <motion.div key={adv.title} variants={staggerItem} className="card p-6 text-center">
 <div className="text-2xl font-black text-primary mb-3">{adv.title}</div>
 <p className="text-muted-foreground text-sm">{adv.desc}</p>
 </motion.div>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* CTA */}
 <section className="section-padding-md">
 <div className="container text-center max-w-2xl mx-auto">
 <h2 className="text-3xl font-bold mb-4">Siap beralih ke Kahade?</h2>
 <p className="text-muted-foreground mb-8">Bergabung gratis, tanpa kartu kredit. Coba sendiri perbedaannya.</p>
 <a href="https://app.kahade.id/register">
 <button className="btn-primary px-8 py-3.5 text-base">
 Daftar Gratis <ArrowRight size={18} />
 </button>
 </a>
 </div>
 </section>

 <Footer />
 </div>
 );
}