import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 CurrencyDollar, HouseLine, BookOpen, FirstAid,
 Lightning, Target, ArrowRight, Briefcase, MapPin, Clock
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const benefits = [
 { icon: CurrencyDollar, title: 'Gaji Kompetitif', description: 'Kompensasi di atas rata-rata industri, disesuaikan dengan pengalaman.' },
 { icon: HouseLine, title: 'Remote Fleksibel', description: 'Kerja dari mana saja. Kami percaya hasil lebih penting dari lokasi.' },
 { icon: BookOpen, title: 'Learning Budget', description: 'Rp 5 juta/tahun untuk kursus, buku, dan konferensi pilihan Anda.' },
 { icon: FirstAid, title: 'Health Insurance', description: 'BPJS Kesehatan penuh + asuransi swasta untuk Anda dan keluarga.' },
 { icon: Lightning, title: 'Fast Growth', description: 'Bergabung lebih awal berarti dampak lebih besar dan karier yang cepat.' },
 { icon: Target, title: 'Real Impact', description: 'Setiap baris kode Anda melindungi ribuan transaksi nyata setiap hari.' },
];

const filters = ['Semua', 'Engineering', 'Product', 'Marketing', 'Operations', 'Design'];

const jobs = [
 { title: 'Frontend Engineer', dept: 'Engineering', type: 'Full Time', location: 'Jakarta / Remote', badge: 'Remote' },
 { title: 'Backend Engineer (Node.js)', dept: 'Engineering', type: 'Full Time', location: 'Jakarta / Remote', badge: 'Remote' },
 { title: 'Product Manager', dept: 'Product', type: 'Full Time', location: 'Jakarta', badge: 'Onsite' },
 { title: 'UI/UX Designer', dept: 'Design', type: 'Full Time', location: 'Remote', badge: 'Remote' },
 { title: 'Growth Marketing Manager', dept: 'Marketing', type: 'Full Time', location: 'Jakarta / Remote', badge: 'Hybrid' },
 { title: 'Customer Success Lead', dept: 'Operations', type: 'Full Time', location: 'Jakarta', badge: 'Onsite' },
];

const badgeColor: Record<string, string> = {
 Remote: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 Onsite: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
 Hybrid: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function Careers() {
 const [activeFilter, setActiveFilter] = useState('Semua');

 const filtered = activeFilter === 'Semua' ? jobs : jobs.filter(j => j.dept === activeFilter);

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-24 overflow-hidden overflow-hidden">
 <div className="container">
 <div className="grid lg:grid-cols-[1fr_auto] gap-16 items-center">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.span variants={staggerItem} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 text-sm font-medium mb-8">
 Bergabung dengan Tim
 </motion.span>
 <motion.h1 variants={staggerItem} className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight mb-6">
 Bergabung dengan tim<br />yang membangun<br />masa depan transaksi<br />
 <span className="text-white/60">digital Indonesia.</span>
 </motion.h1>
 <motion.div variants={staggerItem} className="flex flex-wrap gap-3 mt-8">
 <button className="btn-secondary bg-white text-primary hover:bg-white/90">
 Lihat Lowongan <ArrowRight size={16} />
 </button>
 <button className="border border-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
 Tentang Budaya
 </button>
 </motion.div>
 </motion.div>
 <motion.div variants={fadeInUp} initial="initial" animate="animate" className="grid grid-cols-2 gap-4 min-w-[240px]">
 {[
 { label: 'Ukuran Tim', value: '25+' },
 { label: 'Remote Friendly', value: 'Ya' },
 { label: 'Tahun Berdiri', value: '2023' },
 { label: 'Stage', value: 'Seed' },
 ].map(item => (
 <div key={item.label} className="bg-white/10 rounded-xl p-4">
 <div className="text-xl font-bold">{item.value}</div>
 <div className="text-xs text-white/60 mt-0.5">{item.label}</div>
 </div>
 ))}
 </motion.div>
 </div>
 </div>
 </section>

 {/* BENEFITS BENTO */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-14">
 <span className="badge badge-secondary mb-4">Kenapa Kahade?</span>
 <h2 className="text-3xl md:text-4xl font-bold">Lebih dari Sekadar Pekerjaan</h2>
 </motion.div>
 <div className="grid md:grid-cols-3 gap-6">
 {benefits.map((b) => {
 const Icon = b.icon;
 return (
 <motion.div key={b.title} variants={staggerItem} className="card p-6">
 <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
 <Icon size={24} className="text-primary" weight="duotone" />
 </div>
 <h3 className="font-bold mb-2">{b.title}</h3>
 <p className="text-sm text-muted-foreground">{b.description}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* JOB LISTINGS */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
 <div>
 <span className="badge badge-secondary mb-3">Lowongan Kerja</span>
 <h2 className="text-3xl md:text-4xl font-bold">Posisi Terbuka</h2>
 </div>
 <div className="flex flex-wrap gap-2">
 {filters.map((f) => (
 <button
 key={f}
 onClick={() => setActiveFilter(f)}
 className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
 activeFilter === f
 ? 'bg-primary text-primary-foreground'
 : 'bg-background border border-border hover:border-primary'
 }`}
 >
 {f}
 </button>
 ))}
 </div>
 </motion.div>
 <AnimatePresence mode="wait">
 <motion.div
 key={activeFilter}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -10 }}
 transition={{ duration: 0.2 }}
 className="space-y-3"
 >
 {filtered.map((job) => (
 <div key={job.title} className="card p-5 flex items-center justify-between group hover:border-primary transition-colors cursor-pointer">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
 <Briefcase size={20} className="text-primary" weight="duotone" />
 </div>
 <div>
 <div className="flex items-center gap-2 mb-0.5">
 <h3 className="font-semibold">{job.title}</h3>
 <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor[job.badge]}`}>{job.badge}</span>
 </div>
 <p className="text-sm text-muted-foreground">{job.dept} · {job.type}</p>
 </div>
 </div>
 <div className="flex items-center gap-4">
 <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
 <MapPin size={14} />{job.location}
 </div>
 <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
 </div>
 </div>
 ))}
 {filtered.length === 0 && (
 <div className="text-center py-16 text-muted-foreground">
 Tidak ada lowongan untuk departemen ini saat ini.
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </motion.div>
 </div>
 </section>

 {/* CULTURE SECTION */}
 <section className="section-padding-lg">
 <div className="container max-w-3xl mx-auto text-center">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <span className="badge badge-secondary mb-6">Budaya Kerja</span>
 <blockquote className="text-3xl md:text-4xl font-bold leading-relaxed mb-8">
 "Kami percaya bahwa tim yang bahagia menghasilkan produk yang luar biasa."
 </blockquote>
 <p className="text-muted-foreground text-lg">— Alfiansyah Zahro, CEO Kahade</p>
 </motion.div>
 </div>
 </section>

 <Footer />
 </div>
 );
}
