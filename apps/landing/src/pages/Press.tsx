import { motion } from 'framer-motion';
import { ArrowRight, DownloadSimple, Envelope } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const pressReleases = [
 { date: '15 Januari 2025', title: 'Kahade Mencapai 10.000 Pengguna Aktif', summary: 'Platform escrow Kahade mengumumkan pencapaian 10.000 pengguna aktif dengan total dana yang diamankan melebihi Rp 50 Miliar.', link: '/blog/tips-transaksi-online-aman' },
 { date: '2 Oktober 2024', title: 'Kahade Luncurkan Fitur Resolusi Sengketa AI', summary: 'Fitur baru berbasis kecerdasan buatan memungkinkan penyelesaian sengketa otomatis dalam waktu kurang dari 24 jam.', link: '/blog/kahade-v2-update' },
 { date: '10 Juli 2024', title: 'Kahade Raih Pendanaan Seed dari Investor Lokal', summary: 'Pendanaan akan digunakan untuk pengembangan produk dan ekspansi ke kota-kota besar di Indonesia.', link: '/about' },
];

const mediaLogos = ['Kompas', 'Bisnis Indonesia', 'TechInAsia', 'DailySocial', 'CNBC Indonesia', 'Forbes Indonesia', 'Katadata', 'Kontan'];

export default function Press() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 overflow-hidden overflow-hidden">
 <div className="container text-center max-w-3xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.span variants={staggerItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium mb-8">
 Media & Pers
 </motion.span>
 <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-bold mb-6">Kahade di Media</motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 text-lg">
 Liputan terbaru tentang platform escrow terpercaya Indonesia.
 </motion.p>
 </motion.div>
 </div>
 </section>

 {/* MEDIA LOGOS MARQUEE */}
 <section className="border-y bg-muted/30 py-8 overflow-hidden">
 <motion.div
 className="flex gap-12 whitespace-nowrap"
 animate={{ x: ['0%', '-50%'] }}
 transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
 >
 {[...mediaLogos, ...mediaLogos].map((logo, i) => (
 <div key={i} className="text-lg font-bold text-muted-foreground/40 shrink-0">{logo}</div>
 ))}
 </motion.div>
 </section>

 {/* PRESS RELEASES */}
 <section className="section-padding-lg">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="mb-10">
 <span className="badge badge-secondary mb-3">Siaran Pers</span>
 <h2 className="text-3xl font-bold">Berita Terbaru</h2>
 </motion.div>
 <div className="space-y-4">
 {pressReleases.map((pr) => (
 <motion.a href={pr.link} key={pr.title} variants={staggerItem} className="card p-6 group hover:border-primary transition-colors block">
 <div className="flex items-start justify-between gap-4">
 <div>
 <p className="text-xs text-muted-foreground mb-2">{pr.date}</p>
 <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{pr.title}</h3>
 <p className="text-muted-foreground text-sm">{pr.summary}</p>
 </div>
 <ArrowRight size={20} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
 </div>
 </motion.a>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* MEDIA KIT + CONTACT */}
 <section className="section-padding-md bg-muted/40">
 <div className="container max-w-4xl mx-auto">
 <div className="grid md:grid-cols-2 gap-6">
 <div className="card p-8">
 <h3 className="font-bold text-xl mb-3">Media Kit</h3>
 <p className="text-muted-foreground text-sm mb-6">Unduh logo, panduan merek, dan aset visual resmi Kahade.</p>
 <a href="/files/kahade-media-kit.pdf" className="btn-primary inline-flex items-center">
 <DownloadSimple size={18} /> Unduh Media Kit
 </a>
 </div>
 <div className="card p-8">
 <h3 className="font-bold text-xl mb-3">Kontak Pers</h3>
 <p className="text-muted-foreground text-sm mb-3">Tim komunikasi kami siap membantu keperluan liputan Anda.</p>
 <a href="mailto:pers@kahade.id" className="flex items-center gap-2 text-sm text-primary font-medium">
 <Envelope size={16} /> pers@kahade.id
 </a>
 </div>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}