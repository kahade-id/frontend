/*
 * FINAL CTA SECTION
 *
 * Fixes applied:
 * - Issue #3: Link tidak lagi membungkus <button>. Menggunakan Link as anchor.
 * - Issue #6: Trust items menggunakan SITE_STATS (single source of truth).
 *   Sebelumnya "10K+" — sekarang konsisten "10.000+" seperti section lain.
 * - Issue #24: Menyederhanakan CTA hierarchy — tidak ada duplikasi CTA yang
 *   sama dengan bagian Hero. Section ini fokus pada konversi akhir.
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight, CheckCircle } from '@phosphor-icons/react';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { SITE_STATS } from './HomeData';

// Issue #6: Data dari SITE_STATS — konsisten format di semua section
const trustItems = [
  `${SITE_STATS.activeUsers} Pengguna Aktif`,
  `${SITE_STATS.totalFundSecured} Dana Aman`,
  `Uptime ${SITE_STATS.uptime}`,
  `${SITE_STATS.avgSettlement} Pencairan`,
];

export default function FinalCTA() {
  return (
    <section
      className="section-padding-lg relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.04) 0%, transparent 60%), hsl(var(--primary))',
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

            <motion.p variants={staggerItem} className="text-white/60 text-lg leading-relaxed mb-8">
              Setup dalam 5 menit • tanpa kartu kredit.
            </motion.p>

            {/* Issue #6: Trust items dari SITE_STATS */}
            <motion.div variants={staggerItem} className="flex flex-wrap gap-x-6 gap-y-2 mb-10">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" weight="fill" aria-hidden="true" />
                  <span className="text-sm text-white/70 font-medium">{item}</span>
                </div>
              ))}
            </motion.div>

            {/* Issue #3: Link as anchor — bukan Link wrapping button */}
            {/* Issue #24: Hanya 2 CTA — satu primer, satu sekunder. Tidak ada duplikasi. */}
            <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4">
              <Link
                href="https://app.kahade.id/register"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-white text-black text-base font-semibold hover:bg-neutral-100 transition-colors"
              >
                Mulai Gratis
                <ArrowRight className="w-5 h-5" weight="bold" />
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg border border-white/30 text-white text-base font-semibold hover:border-white/60 transition-colors"
              >
                Hubungi Sales
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}