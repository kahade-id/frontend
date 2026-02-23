import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TwitterLogo, LinkedinLogo, Link as LinkIcon, Clock, User, ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

const toc = [
 { id: 'intro', label: 'Pendahuluan' },
 { id: 'masalah', label: 'Masalah Utama' },
 { id: 'solusi', label: 'Solusi Kahade' },
 { id: 'tips', label: 'Tips Praktis' },
 { id: 'kesimpulan', label: 'Kesimpulan' },
];

const relatedPosts = [
 { title: '7 Tips Transaksi Online yang Aman', category: 'Keamanan', date: '10 Jan 2025', readTime: 5 },
 { title: 'Cara Menggunakan Escrow untuk Freelancer', category: 'Tips Transaksi', date: '5 Jan 2025', readTime: 8 },
 { title: 'Kenali Modus Penipuan Online', category: 'Keamanan', date: '28 Des 2024', readTime: 7 },
];

export default function BlogDetail() {
 const [progress, setProgress] = useState(0);
 const [copied, setCopied] = useState(false);
 const articleRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 const handleScroll = () => {
 const el = articleRef.current;
 if (!el) return;
 const { top, height } = el.getBoundingClientRect();
 const scrolled = Math.max(0, Math.min(1, (-top) / (height - window.innerHeight)));
 setProgress(scrolled * 100);
 };
 window.addEventListener('scroll', handleScroll, { passive: true });
 return () => window.removeEventListener('scroll', handleScroll);
 }, []);

 const copyLink = () => {
 navigator.clipboard.writeText(window.location.href);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 };

 return (
 <div className="min-h-screen bg-background">
 {/* Reading progress bar */}
 <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
 <div className="h-full bg-primary transition-all duration-75" style={{ width: `${progress}%` }} />
 </div>

 <Navbar />

 {/* HERO */}
 <section className="pt-24 pb-12 border-b">
 <div className="container max-w-4xl mx-auto">
 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
 <Link href="/blog">
 <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
 <ArrowLeft size={16} /> Kembali ke Blog
 </button>
 </Link>
 <span className="badge badge-error mb-4">Keamanan</span>
 <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
 Panduan Lengkap Keamanan Transaksi Online di Indonesia
 </h1>
 <div className="flex items-center gap-4 text-sm text-muted-foreground">
 <div className="flex items-center gap-1.5"><User size={14} /><span>Tim Keamanan Kahade</span></div>
 <span>·</span><span>15 Januari 2025</span>
 <span>·</span><div className="flex items-center gap-1"><Clock size={14} /><span>8 menit baca</span></div>
 </div>
 </motion.div>
 </div>
 </section>

 {/* Featured Image */}
 <div className="w-full aspect-[21/9] bg-gradient-to-r from-primary/20 to-primary/5 max-h-96" />

 {/* CONTENT LAYOUT */}
 <div ref={articleRef} className="container max-w- mx-auto[1200px] py-12">
 <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_140px] gap-12">
 {/* TOC Sticky */}
 <aside className="hidden lg:block">
 <div className="sticky top-24">
 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Daftar Isi</p>
 <nav className="space-y-2">
 {toc.map((item) => (
 <a key={item.id} href={`#${item.id}`} className="block text-sm text-muted-foreground hover:text-primary transition-colors py-1">
 {item.label}
 </a>
 ))}
 </nav>
 <div className="mt-6 pt-6 border-t">
 <p className="text-xs text-muted-foreground mb-2">Progress</p>
 <div className="h-1 bg-muted rounded-full overflow-hidden">
 <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
 </div>
 </div>
 </div>
 </aside>

 {/* Article */}
 <article className="prose prose-neutral dark:prose-invert max-w-none" style={{ fontSize: '1.0625rem', lineHeight: 1.8 }}>
 <section id="intro">
 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2em', marginBottom: '0.75em' }}>Pendahuluan</h2>
 <p style={{ marginBottom: '1.5em' }}>Transaksi online di Indonesia terus berkembang pesat. Namun seiring dengan pertumbuhan ini, ancaman penipuan juga semakin canggih. Dalam panduan ini, kami akan membahas cara-cara konkret untuk melindungi diri Anda dalam bertransaksi online.</p>
 </section>
 <section id="masalah">
 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2em', marginBottom: '0.75em' }}>Masalah Utama</h2>
 <p style={{ marginBottom: '1.5em' }}>Salah satu masalah terbesar dalam transaksi online adalah ketiadaan jaminan bagi kedua pihak. Pembeli takut barang tidak dikirim, penjual takut pembayaran tidak masuk. Kondisi ini menciptakan hambatan kepercayaan yang merugikan semua pihak.</p>
 <blockquote style={{ borderLeft: '4px solid var(--color-primary)', paddingLeft: '1.5rem', fontStyle: 'italic', color: 'var(--color-muted-foreground)', margin: '2em 0' }}>
 "Lebih dari 60% pembeli online Indonesia pernah mengalami atau menghindari transaksi karena khawatir dengan keamanannya." — Survei Internal Kahade 2024
 </blockquote>
 </section>
 <section id="solusi">
 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2em', marginBottom: '0.75em' }}>Solusi Kahade</h2>
 <p style={{ marginBottom: '1.5em' }}>Escrow adalah jawaban untuk masalah ini. Dengan escrow, dana pembeli ditahan oleh pihak ketiga yang terpercaya — dalam hal ini Kahade — hingga semua syarat transaksi terpenuhi.</p>
 <pre style={{ backgroundColor: '#0a0a0a', color: '#f5f5f5', padding: '1.5rem', borderRadius: '0.75rem', overflow: 'auto', fontSize: '0.875rem', border: '1px solid #262626', marginBottom: '1.5em' }}>
 <code>{`// Contoh flow transaksi Kahade
Pembeli deposit → Dana ditahan Kahade
Penjual kirim barang → Bukti upload
Pembeli konfirmasi → Dana dicairkan ✓`}</code>
 </pre>
 </section>
 <section id="tips">
 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2em', marginBottom: '0.75em' }}>Tips Praktis</h2>
 <p style={{ marginBottom: '1em' }}>Beberapa langkah yang bisa Anda lakukan segera:</p>
 <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', marginBottom: '1.5em' }}>
 <li style={{ marginBottom: '0.5em' }}>Selalu gunakan platform escrow untuk transaksi di atas Rp 500.000</li>
 <li style={{ marginBottom: '0.5em' }}>Verifikasi identitas penjual sebelum melakukan pembayaran</li>
 <li style={{ marginBottom: '0.5em' }}>Simpan semua bukti komunikasi dan pembayaran</li>
 <li style={{ marginBottom: '0.5em' }}>Aktifkan notifikasi email/SMS untuk setiap transaksi</li>
 </ul>
 </section>
 <section id="kesimpulan">
 <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '2em', marginBottom: '0.75em' }}>Kesimpulan</h2>
 <p style={{ marginBottom: '1.5em' }}>Keamanan transaksi online adalah tanggung jawab bersama. Dengan menggunakan alat yang tepat seperti escrow, Anda bisa bertransaksi dengan tenang. Kahade hadir untuk memastikan setiap transaksi Anda terlindungi dari awal hingga selesai.</p>
 </section>
 </article>

 {/* Share Panel */}
 <aside className="hidden lg:block">
 <div className="sticky top-24">
 <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Bagikan</p>
 <div className="space-y-2">
 {[
 { icon: TwitterLogo, label: 'Twitter' },
 { icon: LinkedinLogo, label: 'LinkedIn' },
 ].map(({ icon: Icon, label }) => (
 <button key={label} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-sm">
 <Icon size={16} /> {label}
 </button>
 ))}
 <button onClick={copyLink} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary hover:text-primary transition-all text-sm">
 <LinkIcon size={16} /> {copied ? 'Disalin!' : 'Copy Link'}
 </button>
 </div>
 <div className="mt-6 pt-6 border-t">
 <p className="text-xs text-muted-foreground">Estimasi</p>
 <p className="text-sm font-semibold mt-1">8 mnt baca</p>
 </div>
 </div>
 </aside>
 </div>
 </div>

 {/* Author Bio */}
 <section className="border-t py-12">
 <div className="container max-w-2xl mx-auto">
 <div className="flex items-center gap-4 p-6 bg-muted/30 rounded-2xl">
 <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
 <span className="text-primary font-bold text-xl">T</span>
 </div>
 <div>
 <p className="font-bold">Tim Keamanan Kahade</p>
 <p className="text-sm text-muted-foreground">Tim keamanan kami terdiri dari para ahli di bidang cybersecurity dan fintech, berkomitmen menjaga keamanan setiap transaksi pengguna Kahade.</p>
 </div>
 </div>
 </div>
 </section>

 {/* Related Posts */}
 <section className="section-padding-md bg-muted/30">
 <div className="container max-w-5xl mx-auto">
 <h2 className="text-2xl font-bold mb-8">Artikel Terkait</h2>
 <div className="grid md:grid-cols-3 gap-6">
 {relatedPosts.map((post) => (
 <div key={post.title} className="card p-5 group cursor-pointer hover:border-primary transition-colors">
 <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/10 to-muted mb-4" />
 <span className="badge badge-secondary mb-2">{post.category}</span>
 <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2 mb-2">{post.title}</h3>
 <p className="text-xs text-muted-foreground">{post.date} · {post.readTime} mnt</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* CTA */}
 <section className="section-padding-md">
 <div className="container max-w-2xl mx-auto text-center">
 <h2 className="text-2xl font-bold mb-4">Mulai transaksi aman bersama Kahade</h2>
 <p className="text-muted-foreground mb-6">Bergabung dengan 10.000+ pengguna yang sudah mempercayakan transaksinya kepada kami.</p>
 <Link href="/register">
 <button className="btn-primary">Daftar Gratis <ArrowRight size={16} /></button>
 </Link>
 </div>
 </section>

 <Footer />
 </div>
 );
}
