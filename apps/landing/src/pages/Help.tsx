import { useState } from 'react';
import { motion } from 'framer-motion';
import {
 Rocket, CreditCard, ShieldCheck, Briefcase, User, Code,
 MagnifyingGlass, ArrowRight, ChatCircle, Ticket, Envelope, Eye
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

const categories = [
 { icon: Rocket, title: 'Memulai', count: 8, description: 'Panduan dasar untuk pengguna baru.' },
 { icon: CreditCard, title: 'Pembayaran', count: 12, description: 'Metode pembayaran, deposit, dan pencairan.' },
 { icon: ShieldCheck, title: 'Keamanan', count: 6, description: 'KYC, 2FA, dan perlindungan akun.' },
 { icon: Briefcase, title: 'Transaksi', count: 15, description: 'Cara membuat dan mengelola transaksi.' },
 { icon: User, title: 'Akun', count: 9, description: 'Profil, pengaturan, dan preferensi.' },
 { icon: Code, title: 'API & Dev', count: 20, description: 'Dokumentasi teknis untuk developer.' },
];

const popularArticles = [
 { title: 'Cara membuat transaksi pertama Anda', views: '12.4K', category: 'Memulai' },
 { title: 'Mengapa verifikasi KYC dibutuhkan?', views: '8.9K', category: 'Keamanan' },
 { title: 'Metode pembayaran yang tersedia', views: '7.2K', category: 'Pembayaran' },
 { title: 'Cara mengajukan sengketa transaksi', views: '5.6K', category: 'Transaksi' },
 { title: 'Mengaktifkan autentikasi dua faktor', views: '4.3K', category: 'Keamanan' },
];

const quickLinks = ['Cara Memulai', 'Transaksi', 'Pembayaran', 'Keamanan'];

export default function Help() {
 const [search, setSearch] = useState('');

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 overflow-hidden">
 <div className="container max-w-3xl mx-auto text-center">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.h1 variants={staggerItem} className="text-4xl md:text-5xl font-bold mb-6">
 Pusat Bantuan Kahade
 </motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 mb-8">
 Temukan jawaban, panduan, dan dukungan yang Anda butuhkan.
 </motion.p>
 <motion.div variants={staggerItem} className="relative mb-8">
 <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <input
 type="text" value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Cari artikel, panduan, atau FAQ..."
 className="w-full pl-12 pr-4 py-4 rounded-2xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-white/30 "
 />
 </motion.div>
 <motion.div variants={staggerItem} className="flex flex-wrap gap-2 justify-center">
 {quickLinks.map(ql => (
 <Button key={ql} className="px-4 py-1.5 rounded-full border border-white/20 text-sm hover:bg-white/10 transition-colors">
 {ql}
 </Button>
 ))}
 </motion.div>
 </motion.div>
 </div>
 </section>

 {/* CATEGORY GRID */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-12">
 <h2 className="text-3xl font-bold">Jelajahi Kategori</h2>
 </motion.div>
 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
 {categories.map((cat) => {
 const Icon = cat.icon;
 return (
 <motion.div key={cat.title} variants={staggerItem} className="card p-6 group hover:border-primary transition-all hover:-translate-y-1">
 <div className="flex items-start justify-between mb-4">
 <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
 <Icon size={24} className="text-primary" weight="duotone" />
 </div>
 <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">{cat.count} artikel</span>
 </div>
 <h3 className="font-bold mb-1 group-hover:text-primary transition-colors">{cat.title}</h3>
 <p className="text-sm text-muted-foreground">{cat.description}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* POPULAR ARTICLES */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container max-w-3xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="mb-8">
 <h2 className="text-2xl font-bold">Artikel Terpopuler</h2>
 </motion.div>
 <div className="space-y-3">
 {popularArticles.map((article, i) => (
 <motion.div key={i} variants={staggerItem} className="card p-4 flex items-center justify-between group hover:border-primary transition-colors">
 <div className="flex items-center gap-4">
 <span className="text-2xl font-bold text-muted-foreground/30 w-8 text-center">{i + 1}</span>
 <div>
 <p className="font-medium text-sm group-hover:text-primary transition-colors">{article.title}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{article.category}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye size={12} /> {article.views}</span>
 <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
 </div>
 </motion.div>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* CONTACT SUPPORT CTA */}
 <section className="section-padding-md">
 <div className="container max-w-3xl mx-auto text-center">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <h2 className="text-2xl font-bold mb-3">Tidak menemukan jawaban?</h2>
 <p className="text-muted-foreground mb-8">Tim dukungan kami siap membantu Anda.</p>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <Button asChild variant="primary" className="inline-flex items-center justify-center"><a href="mailto:halo@kahade.id?subject=Live%20Chat%20Request" >
 <ChatCircle size={18} /> Chat Live
 </a></Button>
 <Button asChild variant="secondary" className="inline-flex items-center justify-center"><Link href="/contact" >
 <Ticket size={18} /> Kirim Tiket
 </Link></Button>
 <Button asChild variant="secondary" className="inline-flex items-center justify-center"><a href="mailto:halo@kahade.id" >
 <Envelope size={18} /> Email
 </a></Button>
 </div>
 </motion.div>
 </div>
 </section>

 <Footer />
 </div>
 );
}