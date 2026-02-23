import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Clock } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const filters = ['Semua', 'Keamanan', 'Tips Transaksi', 'Update', 'Bisnis'];

const posts = [
 { id: 1, category: 'Keamanan', title: '7 Tips Transaksi Online yang Aman di Era Digital', excerpt: 'Bertransaksi online kini semakin mudah, tapi risiko penipuan juga meningkat. Pelajari 7 langkah konkret melindungi diri Anda.', author: 'Tim Kahade', date: '15 Jan 2025', readTime: 5 },
 { id: 2, category: 'Tips Transaksi', title: 'Panduan Lengkap Menggunakan Escrow untuk Freelancer', excerpt: 'Sebagai freelancer, escrow adalah cara terbaik memastikan pembayaran. Begini cara menggunakannya secara efektif.', author: 'Sari Dewi', date: '10 Jan 2025', readTime: 8 },
 { id: 3, category: 'Update', title: 'Kahade v2.0: Fitur Resolusi Sengketa AI Hadir!', excerpt: 'Update terbesar dalam sejarah Kahade. AI kami kini bisa membantu menyelesaikan sengketa dalam waktu kurang dari 24 jam.', author: 'Tim Product', date: '5 Jan 2025', readTime: 4 },
 { id: 4, category: 'Bisnis', title: 'Mengapa UMKM Perlu Menggunakan Escrow', excerpt: 'UMKM sering kehilangan pelanggan karena masalah kepercayaan. Escrow adalah solusi yang affordable untuk semua skala bisnis.', author: 'Ahmad Rizki', date: '28 Des 2024', readTime: 6 },
 { id: 5, category: 'Keamanan', title: 'Kenali Modus Penipuan Online yang Paling Umum', excerpt: 'Dari fake rekber hingga manipulation invoice — kenali modusnya sebelum jadi korban. Panduan lengkap dari tim keamanan kami.', author: 'Tim Keamanan', date: '20 Des 2024', readTime: 7 },
 { id: 6, category: 'Tips Transaksi', title: 'Cara Menulis Deskripsi Transaksi yang Baik', excerpt: 'Deskripsi transaksi yang jelas mencegah kesalahpahaman dan mempercepat proses. Ini template yang bisa Anda gunakan.', author: 'Maya Putri', date: '15 Des 2024', readTime: 3 },
 { id: 7, category: 'Bisnis', title: 'Integrasi Kahade API untuk Platform Marketplace', excerpt: 'Panduan teknis untuk developer yang ingin mengintegrasikan sistem escrow Kahade ke dalam platform mereka sendiri.', author: 'Tim Engineering', date: '10 Des 2024', readTime: 12 },
];

const featured = posts[0];
const regularPosts = posts.slice(1);

const categoryColor: Record<string, string> = {
 Keamanan: 'badge-error',
 'Tips Transaksi': 'badge-success',
 Update: 'badge-primary',
 Bisnis: 'badge-secondary',
};

export default function Blog() {
 const [activeFilter, setActiveFilter] = useState('Semua');

 const filtered = activeFilter === 'Semua'
 ? regularPosts
 : regularPosts.filter(p => p.category === activeFilter);

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="pt-24 pb-12 border-b bg-muted/30">
 <div className="container text-center">
 <motion.div variants={fadeInUp} initial="initial" animate="animate">
 <span className="badge badge-secondary mb-4">Blog</span>
 <h1 className="text-4xl md:text-5xl font-bold mb-3">Blog Kahade</h1>
 <p className="text-muted-foreground text-lg">Tips, update, dan insight untuk transaksi online yang aman.</p>
 </motion.div>
 </div>
 </section>

 {/* FEATURED POST */}
 <section className="section-padding-md">
 <div className="container">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <div className="grid md:grid-cols-[0.55fr_0.45fr] gap-8 bg-muted/30 rounded-3xl overflow-hidden border border-border">
 <div className="aspect-[4/3] md:aspect-auto bg-gradient-to-br from-primary/20 to-primary/5 min-h-[280px]" />
 <div className="p-8 md:p-12 flex flex-col justify-center">
 <span className={`badge ${categoryColor[featured.category] || 'badge-secondary'} mb-4 self-start`}>{featured.category}</span>
 <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{featured.title}</h2>
 <p className="text-muted-foreground mb-6 leading-relaxed">{featured.excerpt}</p>
 <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
 <span>{featured.author}</span><span>·</span>
 <span>{featured.date}</span><span>·</span>
 <span className="flex items-center gap-1"><Clock size={14} />{featured.readTime} menit</span>
 </div>
 <button className="btn-primary self-start">Baca Selengkapnya <ArrowRight size={16} /></button>
 </div>
 </div>
 </motion.div>
 </div>
 </section>

 {/* FILTER + GRID */}
 <section className="section-padding-md">
 <div className="container">
 {/* Filter Bar */}
 <div className="flex gap-2 flex-wrap mb-10">
 {filters.map(f => (
 <button
 key={f} onClick={() => setActiveFilter(f)}
 className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
 >
 {f}
 </button>
 ))}
 </div>

 <AnimatePresence mode="wait">
 <motion.div
 key={activeFilter}
 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
 transition={{ duration: 0.2 }}
 className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
 >
 {filtered.map((post) => (
 <motion.article key={post.id} variants={staggerItem} className="group cursor-pointer">
 <div className="rounded-2xl overflow-hidden mb-4 aspect-video bg-gradient-to-br from-primary/10 to-muted border border-border group-hover:border-primary transition-colors" />
 <span className={`badge ${categoryColor[post.category] || 'badge-secondary'} mb-3`}>{post.category}</span>
 <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
 <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{post.excerpt}</p>
 <div className="flex items-center gap-3 text-xs text-muted-foreground">
 <span>{post.author}</span><span>·</span>
 <span>{post.date}</span><span>·</span>
 <span className="flex items-center gap-1"><Clock size={12} />{post.readTime} mnt</span>
 </div>
 </motion.article>
 ))}
 </motion.div>
 </AnimatePresence>

 {filtered.length === 0 && (
 <div className="text-center py-16 text-muted-foreground">
 Belum ada artikel dalam kategori ini.
 </div>
 )}

 <div className="text-center mt-12">
 <button className="btn-secondary">Muat Lebih Banyak</button>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}
