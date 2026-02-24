import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, User, ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import { Link, useRoute } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const articleBySlug: Record<string, { title: string; category: string; author: string; date: string; readTime: number }> = {
 'tips-transaksi-online-aman': { title: '7 Tips Transaksi Online yang Aman di Era Digital', category: 'Keamanan', author: 'Tim Keamanan Kahade', date: '15 Januari 2025', readTime: 8 },
 'escrow-untuk-freelancer': { title: 'Panduan Lengkap Menggunakan Escrow untuk Freelancer', category: 'Tips Transaksi', author: 'Sari Dewi', date: '10 Januari 2025', readTime: 8 },
 'kahade-v2-update': { title: 'Kahade v2.0: Fitur Resolusi Sengketa AI Hadir!', category: 'Update', author: 'Tim Product Kahade', date: '5 Januari 2025', readTime: 6 },
 'umkm-perlu-escrow': { title: 'Mengapa UMKM Perlu Menggunakan Escrow', category: 'Bisnis', author: 'Ahmad Rizki', date: '28 Desember 2024', readTime: 7 },
};

export default function BlogDetail() {
 const [, params] = useRoute<{ slug: string }>('/blog/:slug');
 const article = articleBySlug[params?.slug ?? ''] ?? articleBySlug['tips-transaksi-online-aman'];
 const [progress, setProgress] = useState(0);
 const articleRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
  const handleScroll = () => {
   const el = articleRef.current; if (!el) return;
   const { top, height } = el.getBoundingClientRect();
   setProgress(Math.max(0, Math.min(1, (-top) / (height - window.innerHeight))) * 100);
  }; window.addEventListener('scroll', handleScroll, { passive: true }); return () => window.removeEventListener('scroll', handleScroll);
 }, []);

 return (<div className="min-h-screen bg-background"><div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div><Navbar />
 <section className="pt-24 pb-12 border-b"><div className="container max-w-4xl mx-auto"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><Link href="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-8"><ArrowLeft size={16} /> Kembali ke Blog</Link><span className="badge badge-error mb-4">{article.category}</span><h1 className="text-3xl md:text-5xl font-bold mb-6">{article.title}</h1><div className="flex items-center gap-4 text-sm text-muted-foreground"><div className="flex items-center gap-1.5"><User size={14} /><span>{article.author}</span></div><span>·</span><span>{article.date}</span><span>·</span><div className="flex items-center gap-1"><Clock size={14} /><span>{article.readTime} menit baca</span></div></div></motion.div></div></section>
 <div className="w-full aspect-[21/9] bg-gradient-to-r from-primary/20 to-primary/5 max-h-96" />
 <div ref={articleRef} className="container max-w-[1200px] mx-auto py-12">...konten artikel...</div>
 <section className="section-padding-md bg-muted/30"><div className="container max-w-5xl mx-auto"><h2 className="text-2xl font-bold mb-8">Artikel Terkait</h2><div className="grid md:grid-cols-3 gap-6">{Object.entries(articleBySlug).map(([slug, post]) => (<Link key={slug} href={`/blog/${slug}`} className="card p-5 group hover:border-primary transition-colors"><div className="aspect-video rounded-xl bg-gradient-to-br from-primary/10 to-muted mb-4" /><span className="badge badge-secondary mb-2">{post.category}</span><h3 className="font-semibold text-sm group-hover:text-primary line-clamp-2 mb-2">{post.title}</h3><p className="text-xs text-muted-foreground">{post.date} · {post.readTime} mnt</p></Link>))}</div></div></section>
 <section className="section-padding-md"><div className="container max-w-2xl mx-auto text-center"><h2 className="text-2xl font-bold mb-4">Mulai transaksi aman bersama Kahade</h2><a href="https://app.kahade.id/register" className="btn-primary inline-flex items-center">Daftar Gratis <ArrowRight size={16} /></a></div></section>
 <Footer /></div>);
}