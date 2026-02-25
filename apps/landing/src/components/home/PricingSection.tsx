/*
 * PRICING SECTION
 *
 * Fixes applied:
 * - Issue #3: Link tidak lagi membungkus <Button>. CTA menggunakan Link as anchor.
 * - Issue #6: Angka pengguna dari SITE_STATS (single source of truth).
 * - Issue #14 & #15: Label harga tahunan sekarang menampilkan konteks yang benar:
 *   - Angka berubah sesuai toggle (monthly vs yearly)
 *   - Label "/bulan" tetap tapi ditambahkan keterangan "dibayar tahunan"
 *   - Ditampilkan total tahunan dan info hemat berapa persen
 * - Issue #28: Import cn tetap karena memang dipakai.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { Check, ArrowRight } from '@phosphor-icons/react';
import { cn } from '@kahade/utils';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { pricingPlans, SITE_STATS } from './HomeData';
import { SectionLabel, Button } from '@kahade/ui';

export default function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="section-padding-lg bg-background" id="pricing">
      <div className="container">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          className="section-header mb-10"
        >
          <SectionLabel>Harga</SectionLabel>
          <h2 className="section-title mb-4">Harga yang Jelas & Transparan</h2>
          <p className="text-muted-foreground text-lg">Tidak ada biaya tersembunyi. Selalu.</p>
        </motion.div>

        {/* Toggle */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-1 p-1.5 bg-muted rounded-full border border-border">
            <Button
              type="button"
              onClick={() => setIsYearly(false)}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-semibold transition-all',
                !isYearly ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Bulanan
            </Button>
            <Button
              type="button"
              onClick={() => setIsYearly(true)}
              className={cn(
                'px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2',
                isYearly ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              Tahunan
              <span className="text-xs font-bold bg-success text-white px-1.5 py-0.5 rounded-full">
                Hemat 20%
              </span>
            </Button>
          </div>
        </div>

        {/* Pricing cards */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewport}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start"
        >
          {pricingPlans.map((plan, i) => {
            const isPopular = i === 1;
            // Issue #15: Harga yang ditampilkan
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <motion.div
                key={plan.name}
                variants={staggerItem}
                className={cn(
                  'relative rounded-2xl border-2 p-8 flex flex-col',
                  isPopular
                    ? 'border-primary bg-primary/5 scale-[1.03]'
                    : 'border-border bg-background'
                )}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="badge badge-primary px-4 py-1.5">⭐ Paling Populer</span>
                  </div>
                )}

                <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-3">{plan.name}</p>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{plan.description}</p>

                {/* Issue #14 & #15: Price block yang jelas dan tidak ambigu */}
                <div className="mb-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isYearly ? 'yearly' : 'monthly'}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {price === 0 ? (
                        <p className="text-4xl font-black tracking-tight">Gratis</p>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-semibold text-muted-foreground">Rp</span>
                            <span className="text-4xl font-black tracking-tight">
                              {price.toLocaleString('id-ID')}
                            </span>
                            {/* Issue #15: Label "/bulan" tetap, tapi konteks lebih jelas */}
                            <span className="text-sm text-muted-foreground">/bulan</span>
                          </div>

                          {/* Issue #15: Info "dibayar tahunan" muncul saat toggle yearly aktif */}
                          {isYearly && plan.yearlyTotal && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Rp {plan.yearlyTotal.toLocaleString('id-ID')} dibayar tahunan
                              {' '}
                              <span className="text-success font-semibold">
                                (hemat Rp {((plan.monthlyPrice * 12) - plan.yearlyTotal).toLocaleString('id-ID')}/tahun)
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="w-4 h-4 text-success shrink-0 mt-0.5" weight="bold" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Issue #3: Link as anchor (bukan Link wrapping button) */}
                <Link
                  href={plan.monthlyPrice === 0 ? '/register' : plan.name === 'Enterprise' ? '/contact' : '/register'}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
                    isPopular
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                  )}
                >
                  {plan.monthlyPrice === 0 ? 'Mulai Gratis' :
                    plan.name === 'Enterprise' ? 'Hubungi Kami' : 'Coba 14 Hari Gratis'}
                  <ArrowRight className="w-4 h-4" weight="bold" />
                </Link>
                <p className="text-xs text-muted-foreground text-center mt-3">Tidak butuh kartu kredit</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Platform fee note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={viewport}
          className="text-center text-sm text-muted-foreground mt-8"
        >
          Platform fee: <strong className="text-foreground">2,5% per transaksi</strong> (min. Rp 2.500, maks. Rp 250.000)
        </motion.p>

        {/* Issue #6: Social proof — angka dari SITE_STATS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          className="flex items-center gap-3 justify-center mt-6 text-sm text-muted-foreground"
        >
          <div className="flex -space-x-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-neutral-300 border-2 border-background flex items-center justify-center text-xs font-bold text-neutral-600"
                aria-hidden="true"
              >
                •
              </div>
            ))}
          </div>
          <span>
            Dipercaya <strong className="text-foreground">{SITE_STATS.activeUsers}</strong> pengguna aktif
          </span>
        </motion.div>
      </div>
    </section>
  );
}