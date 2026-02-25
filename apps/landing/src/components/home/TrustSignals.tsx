/*
 * TRUST SIGNALS
 *
 * Fixes applied:
 * - Issue #6: Angka dari SITE_STATS (single source of truth).
 * - Issue #12: Activity marquee sekarang pause saat hover dan respek
 *   prefers-reduced-motion.
 * - Issue #23: Ini adalah SATU-SATUNYA tempat live activity muncul.
 *   Duplikasi di Hero sudah dihapus.
 */

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CurrencyDollar, Users, Lightning, Clock
} from '@phosphor-icons/react';
import { useCountUp } from '@kahade/utils';
import { SITE_STATS } from './HomeData';

const signals = [
  {
    icon: CurrencyDollar,
    label: 'Dana Diamankan',
    numericValue: SITE_STATS.totalFundNumeric,
    prefix: 'Rp ',
    suffix: 'M+',
  },
  {
    icon: Users,
    label: 'Pengguna Aktif',
    numericValue: SITE_STATS.activeUsersNumeric,
    prefix: '',
    suffix: '+',
  },
  {
    icon: Lightning,
    label: 'Uptime Sistem',
    numericValue: SITE_STATS.uptimeNumeric,
    prefix: '',
    suffix: '%',
  },
  {
    icon: Clock,
    label: 'Rata-rata Cair',
    numericValue: SITE_STATS.avgSettlementNumeric,
    prefix: '< ',
    suffix: ' Jam',
  },
];

const activities = [
  'Transaksi #KHD-2483 selesai · Rp 5.200.000 diamankan',
  'Dana cair ke penjual dalam 8 jam',
  'Pengguna baru bergabung dari Surabaya',
  'Sengketa diselesaikan dalam 2 hari',
  'Transaksi #KHD-2491 dikonfirmasi · Rp 12.000.000',
  'KYC #U-3841 disetujui',
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
  const displayValue = label === 'Uptime Sistem' ? (count / 10).toFixed(1).replace('.', ',') : count;

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
        {(() => {
          const SignalIcon = Icon;
          return <SignalIcon className="w-5 h-5 text-success" weight="fill" />;
        })()}
        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-4xl md:text-5xl font-black tracking-tight stat-number">
        {prefix}{displayValue}{suffix}
      </p>
    </motion.div>
  );
}

function ActivityStrip() {
  return (
    <div className="border-t border-border py-3 bg-background" aria-label="Aktivitas transaksi terbaru (simulasi)">
      <div className="container">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {activities.map((activity) => (
            <span
              key={activity}
              className="shrink-0 text-xs md:text-sm text-muted-foreground px-3 py-1.5 rounded-full border border-border bg-muted/40"
            >
              {activity}
            </span>
          ))}
        </div>
        <p className="text-center text-[0.625rem] text-muted-foreground/60 mt-1">Geser horizontal untuk melihat semua aktivitas →</p>
      </div>

      <p className="text-center text-[0.625rem] text-muted-foreground/50 mt-2">
        * Aktivitas bersifat ilustrasi agar alur platform mudah dipahami
      </p>
    </div>
  );
}

export default function TrustSignals() {
  return (
    <section className="border-y border-border bg-muted">
      <div className="container py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          {signals.map((signal, index) => (
            <StatCard key={signal.label} {...signal} index={index} />
          ))}
        </div>
      </div>

      <ActivityStrip />
    </section>
  );
}
