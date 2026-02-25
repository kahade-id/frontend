import { useState } from 'react';
import { motion } from 'framer-motion';
import {
 ShieldCheck, Target, Eye, Heart, Globe, Lightning, ArrowRight,
 Users, Buildings, MapPin, Envelope, LinkedinLogo, CheckCircle,
 Clock, Medal, Handshake
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import { Button } from '@kahade/ui';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { PageHero } from '../components/common/PageHero';
import { fadeInUp, staggerContainer, staggerItem, viewport } from '@kahade/utils';

const stats = [
 { label: 'Pengguna Aktif', value: '10.000+' },
 { label: 'Dana Diamankan', value: 'Rp 50M+' },
 { label: 'Uptime', value: '99.9%' },
 { label: 'Rating', value: '4.9/5' },
];

const values = [
 { icon: ShieldCheck, title: 'Keamanan Utama', description: 'Enkripsi setara bank dan autentikasi multi-faktor melindungi setiap transaksi Anda dari ancaman digital.' },
 { icon: Eye, title: 'Transparansi Penuh', description: 'Semua biaya, proses, dan status transaksi ditampilkan secara jelas tanpa biaya tersembunyi.' },
 { icon: Handshake, title: 'Kepercayaan Bersama', description: 'Membangun ekosistem di mana pembeli dan penjual merasa aman dalam setiap interaksi.' },
 { icon: Lightning, title: 'Inovasi Tanpa Henti', description: 'Terus berkembang menghadirkan teknologi terbaru untuk pengalaman transaksi yang semakin baik.' },
];

const timeline = [
 { year: '2023', title: 'Kahade Didirikan', description: 'PT Kawal Hak Dengan Aman resmi berdiri dengan visi membangun kepercayaan digital Indonesia.' },
 { year: '2023 Q3', title: 'Peluncuran Beta', description: 'Versi beta diluncurkan dengan 500 pengguna awal. Feedback positif dari transaksi perdana.' },
 { year: '2024 Q1', title: '1.000 Pengguna', description: 'Melampaui 1.000 pengguna terdaftar dan Rp 5 Miliar dana yang diamankan.' },
 { year: '2024 Q3', title: 'Fitur Sengketa', description: 'Peluncuran sistem resolusi sengketa otomatis dengan tingkat penyelesaian 98%.' },
 { year: '2025', title: '10.000+ Pengguna', description: 'Melampaui 10.000 pengguna aktif dengan dana yang diamankan melebihi Rp 50 Miliar.' },
];

const team = [
 { name: 'Alfiansyah Zahro', role: 'CEO & Founder', quote: 'Kepercayaan adalah fondasi dari setiap transaksi yang sukses.' },
 { name: 'Dafenka Nielsen', role: 'CTO & Founder', quote: 'Teknologi yang kuat adalah kunci membangun kepercayaan di era digital.' },
];

export default function About() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* SECTION 1: HERO — EDITORIAL */}
 <PageHero eyebrow="Tentang Kahade" title="Membangun Kepercayaan di Setiap Transaksi" description="Kami membangun infrastruktur escrow modern agar transaksi digital di Indonesia lebih aman, transparan, dan dapat diandalkan." chips={[{ label: 'PT Kawal Hak Dengan Aman' }, { label: 'Sejak 2023' }, { label: 'Indonesia' } ]} />

 {/* SECTION 2: STATS BAR */}
 <section className="border-y bg-background">
 <div className="container">
 <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
 {stats.map((stat) => (
 <div key={stat.label} className="py-8 px-6 text-center">
 <div className="text-2xl md:text-3xl font-bold text-primary mb-1">{stat.value}</div>
 <div className="text-sm text-muted-foreground">{stat.label}</div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* SECTION 3: MISI & VISI — SPLIT PANEL */}
 <section>
 <div className="grid md:grid-cols-2">
 <div className="bg-muted px-8 md:px-16 py-16 md:py-24">
 <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Misi</p>
 <h2 className="text-3xl md:text-4xl font-bold mb-6">Mendorong kepercayaan digital Indonesia</h2>
 <p className="text-muted-foreground leading-relaxed text-lg">
 Mendorong kepercayaan digital di Indonesia dengan menyediakan platform escrow yang aman, transparan, dan mudah digunakan — memungkinkan jutaan orang bertransaksi online dengan tenang.
 </p>
 </div>
 <div className="bg-primary text-primary-foreground px-8 md:px-16 py-16 md:py-24">
 <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-4">Visi</p>
 <h2 className="text-3xl md:text-4xl font-bold mb-6">Platform escrow paling tepercaya di Asia Tenggara</h2>
 <p className="text-primary-foreground/80 leading-relaxed text-lg">
 Menjadi platform escrow paling tepercaya di Asia Tenggara, di mana setiap orang — dari penjual kecil hingga perusahaan besar — bisa bertransaksi dengan penuh keyakinan.
 </p>
 </div>
 </div>
 </section>

 {/* SECTION 4: VALUES */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-16">
 <span className="badge badge-secondary mb-4">Nilai Kami</span>
 <h2 className="text-3xl md:text-4xl font-bold">Yang Kami Pegang Teguh</h2>
 </motion.div>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
 {values.map((value) => {
 const Icon = value.icon;
 return (
 <motion.div key={value.title} variants={staggerItem} className="text-center">
 <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center">
 <Icon size={32} className="text-primary" weight="duotone" />
 </div>
 <h3 className="font-bold text-lg mb-3">{value.title}</h3>
 <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* SECTION 5: TIMELINE */}
 <section className="section-padding-lg bg-muted/40 overflow-hidden">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-16">
 <span className="badge badge-secondary mb-4">Perjalanan Kami</span>
 <h2 className="text-3xl md:text-4xl font-bold">Dari Ide ke Kenyataan</h2>
 </motion.div>
 <div className="relative">
 <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-border md:-translate-x-px" />
 <div className="space-y-8">
 {timeline.map((item, i) => (
 <motion.div key={i} variants={staggerItem} className={`relative flex gap-6 md:gap-0 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
 <div className={`hidden md:block md:w-1/2 ${i % 2 === 0 ? 'pr-12 text-right' : 'pl-12 text-left'}`}>
 <span className="text-xs font-bold uppercase tracking-widest text-primary">{item.year}</span>
 <h3 className="font-bold text-lg mt-1 mb-2">{item.title}</h3>
 <p className="text-muted-foreground text-sm">{item.description}</p>
 </div>
 <div className="absolute left-[14px] md:left-1/2 top-1 w-3 h-3 rounded-full bg-primary border-2 border-background md:-translate-x-1.5" />
 <div className="pl-10 md:hidden">
 <span className="text-xs font-bold uppercase tracking-widest text-primary">{item.year}</span>
 <h3 className="font-bold text-lg mt-1 mb-2">{item.title}</h3>
 <p className="text-muted-foreground text-sm">{item.description}</p>
 </div>
 <div className="hidden md:block md:w-1/2" />
 </motion.div>
 ))}
 </div>
 </div>
 </motion.div>
 </div>
 </section>

 {/* SECTION 6: TEAM */}
 <section className="section-padding-lg">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-16">
 <span className="badge badge-secondary mb-4">Tim Kami</span>
 <h2 className="text-3xl md:text-4xl font-bold">Orang-orang di Balik Kahade</h2>
 </motion.div>
 <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
 {team.map((member) => (
 <motion.div key={member.name} variants={staggerItem} className="card p-6 text-center group transition-all duration-300">
 <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl font-bold text-primary">{member.name.charAt(0)}</span>
 </div>
 <div className="border-t border-border pt-4 mb-3">
 <h3 className="font-bold">{member.name}</h3>
 <p className="text-sm text-muted-foreground">{member.role}</p>
 </div>
 <div className="border-t border-border pt-3">
 <p className="text-sm text-muted-foreground italic">"{member.quote}"</p>
 </div>
 <Button className="mt-4 flex items-center gap-1 text-sm text-primary mx-auto opacity-0 group-hover:opacity-100 transition-opacity">
 <LinkedinLogo size={16} /> LinkedIn
 </Button>
 </motion.div>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* SECTION 7: LEGAL INFO */}
 <section className="section-padding-md bg-muted/40 overflow-hidden">
 <div className="container max-w-2xl mx-auto">
 <div className="border border-border rounded-2xl p-8">
 <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Informasi Hukum</p>
 <h3 className="font-bold text-lg mb-4">PT Kawal Hak Dengan Aman</h3>
 <div className="space-y-3 text-sm text-muted-foreground">
 <div className="flex items-start gap-3">
 <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
 <span>Gg. Abot, Cihideung Udik, Kec. Ciampea, Kabupaten Bogor, Jawa Barat 16620</span>
 </div>
 <div className="flex items-center gap-3">
 <Envelope size={16} className="shrink-0 text-primary" />
 <span>halo@kahade.id</span>
 </div>
 <div className="flex items-center gap-3">
 <Buildings size={16} className="shrink-0 text-primary" />
 <span>NPWP: — &nbsp;|&nbsp; NIB: —</span>
 </div>
 </div>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}