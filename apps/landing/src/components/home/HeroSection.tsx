import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
 ArrowRight, Play, ShieldCheck, IdentificationBadge,
 Clock, Scales, Wallet, ChartLineUp, Lock, CheckCircle
} from '@phosphor-icons/react';
import { cn } from '@kahade/utils';
import { fadeInUp, staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { compliancePartners } from './HomeData';

const liveActivities = [
 '🟢 Transaksi #KHD-2483 selesai · Rp 5.200.000 diamankan',
 '🟢 Dana cair ke penjual dalam 8 jam',
 '🔵 Pengguna baru bergabung dari Surabaya',
 '🟢 Sengketa diselesaikan dalam 2 hari',
 '🟢 Transaksi #KHD-2491 dikonfirmasi · Rp 12.000.000',
];

const heroStats = [
 { value: '98%', label: 'Kepuasan', icon: CheckCircle },
 { value: '<12j', label: 'Pencairan', icon: Clock },
 { value: '0.8%', label: 'Sengketa', icon: Scales },
 { value: '50M+', label: 'Diamankan', icon: Wallet },
];

const trustBadges = [
 { label: 'OJK Compliant', icon: IdentificationBadge },
 { label: 'Bank Indonesia', icon: ShieldCheck },
 { label: 'ISO 27001', icon: Lock },
 { label: 'KYC Verified', icon: CheckCircle },
];

export default function HeroSection() {
 const [activityIndex, setActivityIndex] = useState(0);

 useEffect(() => {
 const t = setInterval(() => setActivityIndex(i => (i + 1) % liveActivities.length), 3000);
 return () => clearInterval(t);
 }, []);

 return (
 <section className="section-padding-hero relative overflow-hidden">
 {/* Background grid — LEBIH SUBTLE (opacity 30%) */}
 <div
 className="absolute inset-0 pointer-events-none"
 aria-hidden="true"
 style={{
 backgroundImage: 'radial-gradient(var(--neutral-200, #e8e8e8) 1px, transparent 1px)',
 backgroundSize: '24px 24px',
 opacity: 0.3,
 }}
 />
 {/* Gradient blobs */}
 <div className="absolute -top-20 right-0 w-[520px] h-[520px] bg-gradient-radial from-muted to-transparent rounded-full blur-3xl opacity-70 pointer-events-none" aria-hidden="true" />
 <div className="absolute -bottom-24 left-0 w-[360px] h-[360px] bg-gradient-radial from-muted to-transparent rounded-full blur-3xl opacity-40 pointer-events-none" aria-hidden="true" />

 <div className="container relative z-10">
 <motion.div
 className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center"
 variants={staggerContainer}
 initial="initial"
 animate="animate"
 >
 {/* ── KIRI ── */}
 <div className="text-center lg:text-left">
 {/* Badge */}
 <motion.div variants={staggerItem} className="mb-8 flex justify-center lg:justify-start">
 <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
 border border-neutral-200 bg-background 
 text-xs font-semibold tracking-wide text-neutral-600
 hover:border-neutral-400 transition-colors cursor-default">
 <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
 10.000+ Pengguna Aktif
 </div>
 </motion.div>

 {/* Headline — clamp(2.75rem, 5.5vw + 1rem, 6.5rem) */}
 <motion.h1
 variants={staggerItem}
 className="font-display font-black leading-[1.0] tracking-[-0.05em] mb-8"
 style={{ fontSize: 'clamp(2.75rem, 5.5vw + 1rem, 6.5rem)' }}
 >
 <span className="block text-foreground">-</span>
 <span className="block text-foreground">Penipuan.</span>
 <span className="block mt-2 md:mt-3 relative">
 <span className="relative z-10 text-foreground">+</span>
 {' '}
 <span className="relative z-10 text-foreground">Kepercayaan.</span>
 <motion.div
 initial={{ scaleX: 0, originX: 0 }}
 animate={{ scaleX: 1 }}
 transition={{ delay: 0.7, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
 className="absolute -bottom-1 left-0 right-0 h-[10px] bg-primary/10 rounded-full"
 style={{ transformOrigin: 'left center' }}
 />
 </span>
 </motion.h1>

 {/* Lead text */}
 <motion.p
 variants={staggerItem}
 className="text-muted-foreground mb-8 leading-relaxed"
 style={{ fontSize: 'clamp(1.0625rem, 1.5vw, 1.25rem)' }}
 >
 Kahade menahan dana Anda hingga transaksi selesai dengan sempurna.
 Aman, transparan, dan terpercaya.
 </motion.p>

 {/* CTA Buttons */}
 <motion.div
 variants={staggerItem}
 className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-10"
 >
 <Link href="/register">
 <button className="btn-primary btn-lg w-full sm:w-auto">
 Mulai Transaksi
 <ArrowRight className="w-5 h-5" weight="bold" />
 </button>
 </Link>
 <button
 className="btn-secondary btn-lg w-full sm:w-auto"
 onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
 >
 <Play className="w-4 h-4" weight="fill" />
 Lihat Demo
 </button>
 </motion.div>

 {/* Trust badges */}
 <motion.div
 variants={staggerItem}
 className="flex flex-wrap gap-2 justify-center lg:justify-start"
 >
 {trustBadges.map(({ label, icon: BadgeIcon }) => (
 <div
 key={label}
 className="flex items-center gap-2 px-3 py-2 rounded-lg
 border border-border bg-background text-xs font-medium"
 >
 <BadgeIcon className="w-4 h-4 text-muted-foreground" weight="duotone" />
 <span>{label}</span>
 </div>
 ))}
 </motion.div>
 </div>

 {/* ── KANAN — Hero Card ── */}
 <motion.div
 variants={staggerItem}
 className="relative"
 >
 <div className="card border-2 border-border rounded-[20px] p-6 md:p-8 bg-background">
 {/* Live activity pulse */}
 <div className="mb-6 p-3 bg-muted rounded-xl">
 <motion.p
 key={activityIndex}
 initial={{ opacity: 0, y: 6 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -6 }}
 transition={{ duration: 0.3 }}
 className="text-xs text-muted-foreground"
 >
 {liveActivities[activityIndex]}
 </motion.p>
 </div>

 {/* Transaction header */}
 <div className="flex items-center justify-between mb-4">
 <div>
 <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Escrow Terlindungi</p>
 <p className="text-sm font-bold mt-0.5">Transaksi #KHD-2451</p>
 </div>
 <span className="badge badge-success">● Aktif</span>
 </div>

 {/* Amount */}
 <p className="text-3xl font-black tracking-tight mb-6">Rp 12.500.000</p>

 {/* Stats grid 2x2 */}
 <div className="grid grid-cols-2 gap-3 mb-6">
 {heroStats.map(({ value, label, icon: StatIcon }) => (
 <div key={label} className="bg-muted rounded-xl p-3">
 <div className="flex items-center gap-1.5 mb-1">
 <StatIcon className="w-3.5 h-3.5 text-muted-foreground" weight="duotone" />
 <span className="text-[0.625rem] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
 </div>
 <p className="text-lg font-black tracking-tight">{value}</p>
 </div>
 ))}
 </div>

 {/* Progress bar */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-semibold text-muted-foreground">Dana Aman</span>
 <span className="text-xs font-bold">Rp 50M+</span>
 </div>
 <div className="h-2 bg-muted rounded-full overflow-hidden">
 <motion.div
 initial={{ scaleX: 0 }}
 animate={{ scaleX: 0.82 }}
 transition={{ delay: 0.5, duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
 className="h-full bg-success rounded-full origin-left"
 style={{ transformOrigin: 'left center', willChange: 'transform' }}
 />
 </div>
 </div>
 </div>
 </motion.div>
 </motion.div>

 {/* Scroll indicator */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 1.5, duration: 0.5 }}
 className="flex flex-col items-center mt-16 text-muted-foreground"
 >
 <span className="text-xs font-medium mb-2">Scroll untuk jelajahi</span>
 <motion.div
 animate={{ y: [0, 6, 0] }}
 transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
 >
 <ArrowRight className="w-4 h-4 rotate-90" weight="bold" />
 </motion.div>
 </motion.div>
 </div>
 </section>
 );
}
