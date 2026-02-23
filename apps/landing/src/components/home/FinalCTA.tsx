import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';

const trustItems = [
  '10K+ Pengguna Aktif',
  'Rp 50M+ Dana Aman',
  '99.9% Uptime',
  '< 12 Jam Pencairan',
];

export default function FinalCTA() {
  return (
    <section
      className="section-padding-lg relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.04) 0%, transparent 60%), #0A0A0A',
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        aria-hidden="true"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center md:text-left">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={viewport}
          >
            <motion.h2
              variants={staggerItem}
              className="font-black leading-[1.05] tracking-tight text-white mb-6"
              style={{ fontSize: 'clamp(2.5rem, 4vw + 1rem, 5.5rem)' }}
            >
              Siap mengamankan transaksi Anda?
            </motion.h2>
            <motion.p variants={staggerItem} className="text-white/60 text-lg leading-relaxed mb-2">
              Tidak butuh kartu kredit.
            </motion.p>
            <motion.p variants={staggerItem} className="text-white/60 text-lg leading-relaxed mb-8">
              Setup dalam 5 menit.
            </motion.p>
            <motion.div variants={staggerItem} className="flex flex-wrap gap-x-6 gap-y-2 mb-10">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" weight="fill" />
                  <span className="text-sm text-white/70 font-medium">{item}</span>
                </div>
              ))}
            </motion.div>
            <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <button className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-white text-black text-base font-semibold hover:bg-neutral-100 transition-colors">
                  Mulai Gratis
                  <ArrowRight className="w-5 h-5" weight="bold" />
                </button>
              </Link>
              <Link href="/contact">
                <button className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg border border-white/30 text-white text-base font-semibold hover:border-white/60 transition-colors">
                  Hubungi Sales
                </button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
