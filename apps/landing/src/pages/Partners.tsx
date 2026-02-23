import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowRight, PaperPlaneTilt } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const partnerBenefits = [
 'Co-marketing dan promosi bersama',
 'Akses ke API dan webhook eksklusif',
 'Dedicated partnership manager',
 'Revenue share yang kompetitif',
 'Priority support dan SLA',
 'Co-branding opportunities',
];

const tiers = [
 { name: 'Bronze', min: '0', desc: 'Untuk bisnis yang baru bergabung dalam ekosistem Kahade.', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
 { name: 'Silver', min: '50', desc: 'Untuk partner aktif dengan volume transaksi signifikan.', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
 { name: 'Gold', min: '500', desc: 'Untuk partner strategis dengan komitmen jangka panjang.', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
];

export default function Partners() {
 const [form, setForm] = useState({ company: '', name: '', email: '', message: '' });
 const [submitted, setSubmitted] = useState(false);

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 overflow-hidden overflow-hidden">
 <div className="container text-center max-w-3xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.span variants={staggerItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium mb-8">
 Kemitraan
 </motion.span>
 <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-bold mb-6">Ekosistem Partner Kahade</motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 text-lg">
 Bergabunglah dengan ekosistem mitra kami dan tumbuh bersama platform escrow terpercaya Indonesia.
 </motion.p>
 </motion.div>
 </div>
 </section>

 {/* PARTNER TIERS */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-14">
 <span className="badge badge-secondary mb-3">Program Kemitraan</span>
 <h2 className="text-3xl md:text-4xl font-bold">Tingkatan Partner</h2>
 </motion.div>
 <div className="grid md:grid-cols-3 gap-6 mb-16">
 {tiers.map((tier) => (
 <motion.div key={tier.name} variants={staggerItem} className="card p-8 text-center">
 <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-4 ${tier.color}`}>{tier.name}</span>
 <div className="text-3xl font-bold mb-1">Rp {tier.min}M+</div>
 <p className="text-xs text-muted-foreground mb-4">Volume transaksi/bulan</p>
 <p className="text-sm text-muted-foreground">{tier.desc}</p>
 </motion.div>
 ))}
 </div>

 {/* Benefits */}
 <motion.div variants={staggerItem} className="bg-muted/40 rounded-3xl p-10">
 <h3 className="text-2xl font-bold text-center mb-8">Keuntungan Menjadi Partner</h3>
 <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
 {partnerBenefits.map((b) => (
 <div key={b} className="flex items-center gap-3">
 <CheckCircle size={20} className="text-green-600 shrink-0" weight="fill" />
 <span className="text-sm">{b}</span>
 </div>
 ))}
 </div>
 </motion.div>
 </motion.div>
 </div>
 </section>

 {/* INQUIRY FORM */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container max-w-2xl mx-auto">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <div className="text-center mb-10">
 <span className="badge badge-secondary mb-3">Daftar</span>
 <h2 className="text-3xl font-bold">Mulai Kemitraan</h2>
 <p className="text-muted-foreground mt-2">Tim kami akan menghubungi Anda dalam 2 hari kerja.</p>
 </div>
 {submitted ? (
 <div className="card p-10 text-center">
 <CheckCircle size={48} className="text-green-600 mx-auto mb-4" weight="fill" />
 <h3 className="font-bold text-xl mb-2">Formulir Terkirim!</h3>
 <p className="text-muted-foreground">Tim partnership kami akan menghubungi Anda segera.</p>
 </div>
 ) : (
 <form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="card p-8 space-y-5">
 <div className="grid md:grid-cols-2 gap-5">
 <div>
 <label className="text-sm font-medium mb-1.5 block">Nama Perusahaan</label>
 <input type="text" required placeholder="PT Maju Jaya" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={form.company} onChange={e => setForm({...form, company: e.target.value})} />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Nama PIC</label>
 <input type="text" required placeholder="Ahmad Rizki" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
 </div>
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Email Bisnis</label>
 <input type="email" required placeholder="pic@perusahaan.com" className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Ceritakan Kebutuhan Anda</label>
 <textarea rows={4} placeholder="Kami adalah platform e-commerce dengan 10.000 transaksi/bulan dan ingin mengintegrasikan escrow..." className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none" value={form.message} onChange={e => setForm({...form, message: e.target.value})} />
 </div>
 <button type="submit" className="btn-primary w-full">
 <PaperPlaneTilt size={18} /> Kirim Formulir
 </button>
 </form>
 )}
 </motion.div>
 </div>
 </section>

 <Footer />
 </div>
 );
}
