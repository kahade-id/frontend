import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
 CurrencyDollar, Users, Lightning, Clock
} from '@phosphor-icons/react';
import { useCountUp } from '@kahade/utils';

const signals = [
 {
 icon: CurrencyDollar,
 label: 'Dana Diamankan',
 numericValue: 50,
 prefix: 'Rp ',
 suffix: 'M+',
 },
 {
 icon: Users,
 label: 'Pengguna Aktif',
 numericValue: 10000,
 prefix: '',
 suffix: '+',
 },
 {
 icon: Lightning,
 label: 'Uptime Sistem',
 numericValue: 99,
 prefix: '',
 suffix: '.9%',
 },
 {
 icon: Clock,
 label: 'Rata-rata Cair',
 numericValue: 12,
 prefix: '< ',
 suffix: ' Jam',
 },
];

const activities = [
 '🟢 Transaksi #KHD-2483 selesai · Rp 5.200.000 diamankan',
 '🟢 Dana cair ke penjual dalam 8 jam',
 '🔵 Pengguna baru bergabung dari Surabaya',
 '🟢 Sengketa diselesaikan dalam 2 hari',
 '🟢 Transaksi #KHD-2491 dikonfirmasi · Rp 12.000.000',
 '🟢 Transaksi #KHD-2499 selesai · Rp 3.800.000 diamankan',
 '🔵 Pengguna baru bergabung dari Medan',
 '🟢 KYC #U-3841 disetujui',
];

function StatCard({
 icon: Icon, label, numericValue, prefix, suffix, index
}: typeof signals[0] & { index: number }) {
 const ref = useRef<HTMLDivElement>(null);
 const [visible, setVisible] = useState(false);

 useEffect(() => {
 const obs = new IntersectionObserver(
 ([entry]) => { if (entry.isIntersecting) setVisible(true); },
 { threshold: 0.3 }
 );
 if (ref.current) obs.observe(ref.current);
 return () => obs.disconnect();
 }, []);

 const count = useCountUp(numericValue, 2.5, visible);

 return (
 <motion.div
 ref={ref}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.1 }}
 className="flex flex-col items-center md:items-start gap-2 px-6 py-6
 border-r border-border last:border-r-0 first:border-l-0"
 >
 <div className="flex items-center gap-2">
 {(() => { const SignalIcon = Icon; return (
 <SignalIcon className="w-5 h-5 text-success" weight="fill" />
 ); })()}
 <span className="text-[0.6875rem] font-semibold tracking-widest uppercase text-muted-foreground">
 {label}
 </span>
 </div>
 <p className="text-4xl md:text-5xl font-black tracking-tight stat-number">
 {prefix}{count}{suffix}
 </p>
 </motion.div>
 );
}

function ActivityMarquee() {
 return (
 <div className="overflow-hidden border-t border-border py-3 bg-background">
 <motion.div
 animate={{ x: ['0%', '-50%'] }}
 transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
 className="flex gap-12 whitespace-nowrap text-sm text-muted-foreground"
 style={{ willChange: 'transform' }}
 >
 {[...activities, ...activities].map((a, i) => (
 <span key={i} className="shrink-0">{a}</span>
 ))}
 </motion.div>
 </div>
 );
}

export default function TrustSignals() {
 return (
 <section className="border-y border-border bg-muted">
 {/* Stats bar */}
 <div className="container py-10">
 <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
 {signals.map((signal, index) => (
 <StatCard key={signal.label} {...signal} index={index} />
 ))}
 </div>
 </div>

 {/* Live activity marquee */}
 <ActivityMarquee />
 </section>
 );
}
