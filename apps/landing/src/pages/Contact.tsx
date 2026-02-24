import { useState } from 'react';
import { motion } from 'framer-motion';
import {
 Envelope, Phone, MapPin, PaperPlaneTilt, Clock,
 LinkedinLogo, TwitterLogo, InstagramLogo, CheckCircle, ArrowRight
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { fadeInUp, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

const topics = [
 'Pertanyaan Umum',
 'Kerjasama Bisnis',
 'Teknis & API',
 'Keluhan & Sengketa',
 'Lainnya',
];

export default function Contact() {
 const [form, setForm] = useState({ name: '', email: '', topic: '', message: '' });
 const [submitted, setSubmitted] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsSubmitting(true);
 await new Promise((resolve) => setTimeout(resolve, 500));
 const payload = { ...form, createdAt: new Date().toISOString(), target: 'halo@kahade.id' };
 const existing = JSON.parse(localStorage.getItem('contactSubmissions') || '[]');
 localStorage.setItem('contactSubmissions', JSON.stringify([payload, ...existing]));
 setSubmitted(true);
 setIsSubmitting(false);
 };

 return (
 <div className="min-h-screen bg-background">
 <Navbar />
 <div className="min-h-[calc(100vh-64px)] grid md:grid-cols-[0.45fr_0.55fr]">
 {/* LEFT — Dark Info Panel */}
 <div className="bg-primary text-primary-foreground px-8 md:px-14 py-16 md:py-24 flex flex-col justify-center">
 <motion.div variants={fadeInUp} initial="initial" animate="animate" className="max-w-sm">
 <p className="text-primary-foreground/60 text-xs uppercase tracking-widest mb-8">Hubungi Kami</p>
 <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
 Kami siap<br />membantu Anda.
 </h1>
 <p className="text-primary-foreground/70 mb-12 leading-relaxed">
 Ada pertanyaan, masukan, atau ingin bermitra? Tim Kahade siap merespons dalam 24 jam kerja.
 </p>
 <div className="space-y-5 mb-12">
 {[
 { icon: Envelope, label: 'halo@kahade.id' },
 { icon: Phone, label: '+62 811-127-812' },
 { icon: MapPin, label: 'Ciampea, Kabupaten Bogor' },
 { icon: Clock, label: 'Sen–Jum, 09:00–18:00 WIB' },
 ].map(({ icon: Icon, label }) => (
 <div key={label} className="flex items-center gap-3 text-primary-foreground/80">
 <Icon size={18} />
 <span className="text-sm">{label}</span>
 </div>
 ))}
 </div>
 <div className="border-t border-white/10 pt-6 flex items-center gap-4">
 {[{ icon: LinkedinLogo, href: "https://www.linkedin.com" }, { icon: TwitterLogo, href: "https://x.com" }, { icon: InstagramLogo, href: "https://instagram.com" }].map(({ icon: Icon, href }) => (
 <a key={href} href={href} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors">
 <Icon size={16} />
 </a>
 ))}
 </div>
 </motion.div>
 </div>

 {/* RIGHT — Contact Form */}
 <div className="bg-background px-8 md:px-14 py-16 md:py-24 flex flex-col justify-center">
 {submitted ? (
 <motion.div variants={fadeInUp} initial="initial" animate="animate" className="max-w-md text-center mx-auto">
 <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
 <CheckCircle size={32} className="text-green-600" weight="fill" />
 </div>
 <h2 className="text-2xl font-bold mb-3">Pesan berhasil direkam</h2>
 <p className="text-muted-foreground mb-6">Pesan Anda telah disimpan dan masuk ke antrean tim kami. Kami akan menghubungi Anda melalui email.</p>
 <Button onClick={() => setSubmitted(false)} className="btn-secondary">Kirim Pesan Lain</Button>
 </motion.div>
 ) : (
 <motion.div variants={fadeInUp} initial="initial" animate="animate" className="max-w-md">
 <h2 className="text-2xl font-bold mb-2">Kirim Pesan</h2>
 <p className="text-muted-foreground text-sm mb-8">Biasanya kami merespons dalam 24 jam kerja.</p>
 <form onSubmit={handleSubmit} className="space-y-5">
 <div>
 <label className="text-sm font-medium mb-1.5 block">Nama Lengkap</label>
 <input
 type="text" required placeholder="Ahmad Rizki"
 className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
 value={form.name} onChange={e => setForm({...form, name: e.target.value})}
 />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Email</label>
 <input
 type="email" required placeholder="ahmad@email.com"
 className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
 value={form.email} onChange={e => setForm({...form, email: e.target.value})}
 />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Topik</label>
 <select
 required
 className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm appearance-none"
 value={form.topic} onChange={e => setForm({...form, topic: e.target.value})}
 >
 <option value="">Pilih topik...</option>
 {topics.map(t => <option key={t} value={t}>{t}</option>)}
 </select>
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Pesan</label>
 <textarea
 required rows={5} placeholder="Tulis pesan Anda di sini..."
 className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm resize-none"
 value={form.message} onChange={e => setForm({...form, message: e.target.value})}
 />
 </div>
 <Button type="submit" disabled={isSubmitting}  variant="primary" className="w-full disabled:opacity-60">
 <PaperPlaneTilt size={18} />
 {isSubmitting ? 'Mengirim...' : 'Kirim Pesan'}
 </Button>
 <div className="text-center">
 <Link href="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
 Atau cari jawaban di FAQ <ArrowRight size={14} />
 </Link>
 </div>
 </form>
 </motion.div>
 )}
 </div>
 </div>
 <Footer />
 </div>
 );
}