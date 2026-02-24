/*
 * FEATURES SECTION
 *
 * Fixes applied:
 * - Issue #3: Link tidak lagi membungkus <button>. CTA menggunakan Link as anchor.
 * - Issue #4: Route "/features" tidak ada di App.tsx. Link diubah ke "/#features"
 *   (scroll ke section di homepage) atau ke halaman yang memang ada.
 *   Karena ini section "Pelajari lebih lanjut" pada feature besar, diarahkan ke /use-cases
 *   sebagai halaman yang memang ada dan relevan.
 * - Issue #28: Import cn yang tidak dipakai dihapus.
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowRight } from '@phosphor-icons/react';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { features } from './HomeData';
import { SectionLabel } from '@kahade/ui';

export default function FeaturesSection() {
  const feature1 = features[0];
  const smallFeatures = features.slice(1, 5);
  const feature6 = features[5];

  return (
    <section className="section-padding-lg bg-background" id="features">
      <div className="container">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewport}
          className="section-header mb-12 w-full"
        >
          <SectionLabel>Platform</SectionLabel>
          <h2 className="section-title mb-4">
            Semua yang Anda butuhkan, dalam satu platform
          </h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-xl mx-auto w-full">
            Dari keamanan setara bank hingga resolusi sengketa — Kahade melindungi setiap transaksi Anda.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewport}
          className="bento-grid"
        >
          {/* Feature 1: LARGE (row-span-2) */}
          <motion.div
            variants={staggerItem}
            className="bento-large card card-hover p-8 flex flex-col bg-background border-2 border-border group"
          >
            {(() => {
              const Feature1Icon = feature1.icon;
              return (
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                  <Feature1Icon weight="bold" className="w-8 h-8 text-primary-foreground" />
                </div>
              );
            })()}
            <h3 className="text-2xl font-bold mb-4 tracking-tight">{feature1.title}</h3>
            <p className="text-muted-foreground leading-relaxed flex-1">{feature1.description}</p>
            {/* Large visual */}
            <div className="mt-8 rounded-2xl bg-muted h-44 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                  {(() => {
                    const F1Icon = feature1.icon;
                    return <F1Icon className="w-7 h-7 text-success" weight="duotone" />;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground font-medium">Dana Aman & Terlindungi</p>
              </div>
            </div>
          </motion.div>

          {/* Features 2-5: Small */}
          {smallFeatures.map((f) => {
            const FeatureIcon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={staggerItem}
                className="card card-hover p-6 group"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-105 transition-all duration-300">
                  <FeatureIcon
                    weight="bold"
                    className="w-6 h-6 text-foreground group-hover:text-primary-foreground transition-colors duration-300"
                  />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{f.description}</p>
              </motion.div>
            );
          })}

          {/* Feature 6: Wide */}
          {feature6 && (() => {
            const Feature6Icon = feature6.icon;
            return (
              <motion.div
                variants={staggerItem}
                className="bento-wide card card-hover p-8 flex flex-col md:flex-row gap-8 items-center group bg-primary text-primary-foreground border-none"
              >
                <div className="flex-1">
                  <Feature6Icon weight="bold" className="w-10 h-10 mb-4 opacity-80" />
                  <h3 className="text-xl font-bold mb-3">{feature6.title}</h3>
                  <p className="text-primary-foreground/70 leading-relaxed">{feature6.description}</p>

                  {/* Issue #3 + #4: Link sebagai anchor (bukan Link+button).
                      Route "/features" tidak ada — diarahkan ke /use-cases yang ada. */}
                  <Link
                    href="/use-cases"
                    className="inline-flex items-center gap-2 mt-5 text-sm font-semibold hover:underline underline-offset-4"
                  >
                    Pelajari lebih lanjut <ArrowRight className="w-4 h-4" weight="bold" />
                  </Link>
                </div>
                <div className="w-full md:w-72 h-48 rounded-2xl bg-primary-foreground/10 flex items-center justify-center shrink-0">
                  <Feature6Icon weight="thin" className="w-24 h-24 opacity-20" />
                </div>
              </motion.div>
            );
          })()}
        </motion.div>
      </div>
    </section>
  );
}
