/*
 * PROBLEM SECTION
 *
 * Fixes applied:
 * - Issue #3: Link tidak lagi membungkus <button>. CTA menggunakan Link as anchor
 *   dengan class styling, atau button dengan scrollIntoView.
 * - Issue #16: "menghilangkan semua risiko" → "mengurangi risiko secara signifikan"
 *   untuk wording yang lebih aman secara legal dan brand.
 * - Issue #28: Import cn yang tidak dipakai dihapus.
 */

import { motion } from 'framer-motion';
import { Warning, XCircle, ArrowRight } from '@phosphor-icons/react';
import { fadeInUp, staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { buyerRisks, sellerRisks } from './HomeData';

export default function ProblemSection() {
  return (
    <section className="section-padding-lg bg-background">
      <div className="container">
        <div className="grid lg:grid-cols-[0.4fr_0.6fr] gap-12 lg:gap-20">
          {/* ── KIRI — Sticky heading ── */}
          <motion.div
            {...fadeInUp}
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <span className="badge badge-error mb-6">
              ⚠ Masalah Nyata
            </span>
            <h2
              className="font-black tracking-tight leading-[1.05] mb-6 text-foreground"
              style={{ fontSize: 'clamp(2rem, 4vw + 0.5rem, 3.5rem)' }}
            >
              Risiko ada di kedua sisi.
            </h2>
            <p className="text-muted-foreground leading-relaxed text-lg mb-8">
              Tanpa perlindungan yang tepat, setiap transaksi online adalah pertaruhan.
            </p>

            {/* Issue #3: Gunakan button murni dengan scrollIntoView — VALID */}
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Lihat Solusi
              <ArrowRight className="w-4 h-4" weight="bold" />
            </button>
          </motion.div>

          {/* ── KANAN — Risk cards ── */}
          <div className="space-y-6">
            {/* Buyer risks */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={viewport}
              className="rounded-2xl bg-muted border-l-4 border-destructive p-6 md:p-8"
            >
              <motion.div variants={staggerItem} className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-destructive" weight="fill" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-destructive">Risiko Pembeli</p>
                  <p className="text-lg font-bold">Uang pergi, barang tak datang</p>
                </div>
              </motion.div>
              <ul className="space-y-3">
                {buyerRisks.map((risk, i) => (
                  <motion.li
                    key={i}
                    variants={staggerItem}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-2 shrink-0" />
                    {risk}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Seller risks */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={viewport}
              className="rounded-2xl bg-muted border-l-4 border-warning p-6 md:p-8"
            >
              <motion.div variants={staggerItem} className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Warning className="w-5 h-5 text-warning" weight="fill" />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-warning">Risiko Penjual</p>
                  <p className="text-lg font-bold">Barang terkirim, uang tak cair</p>
                </div>
              </motion.div>
              <ul className="space-y-3">
                {sellerRisks.map((risk, i) => (
                  <motion.li
                    key={i}
                    variants={staggerItem}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
                    {risk}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* Solution banner */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewport}
              className="rounded-2xl bg-primary text-primary-foreground overflow-hidden"
            >
              <div className="grid md:grid-cols-[1fr_auto] gap-0 items-center">
                <div className="p-6 md:p-8">
                  <p className="text-xs font-bold tracking-widest uppercase opacity-60 mb-3">Solusi Kahade</p>
                  {/* Issue #16: Wording diubah dari "menghilangkan semua risiko"
                      menjadi "mengurangi risiko secara signifikan" — lebih akurat & aman */}
                  <h3 className="text-2xl font-black mb-3">
                    Kahade mengurangi risiko ini secara signifikan.
                  </h3>
                  <p className="text-primary-foreground/70 text-sm leading-relaxed mb-6">
                    Dana ditahan aman hingga kedua pihak puas. Lebih sedikit risiko, lebih banyak kepercayaan.
                  </p>
                  {/* Issue #3: Link sebagai anchor (bukan Link wrapping button) */}
                  <a
                    href="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                      bg-white text-black text-sm font-semibold
                      hover:bg-neutral-100 transition-colors"
                  >
                    Mulai Transaksi Aman
                    <ArrowRight className="w-4 h-4" weight="bold" />
                  </a>
                </div>

                {/* Flow animation */}
                <div className="hidden md:flex items-center justify-center w-48 h-full bg-white/5 p-6">
                  <div className="flex flex-col items-center gap-2 text-xs text-center">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg">💰</div>
                    <div className="w-px h-6 bg-white/20" />
                    <div className="w-12 h-12 rounded-full bg-success/20 border border-success/40 flex items-center justify-center text-lg">🔒</div>
                    <p className="text-white/60 font-medium">Kahade</p>
                    <div className="w-px h-6 bg-white/20" />
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-lg">📦</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
