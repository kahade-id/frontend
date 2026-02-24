/*
 * TESTIMONIALS SECTION
 *
 * Fixes applied:
 * - Issue #8: CTA "Lihat semua ulasan" diubah dari href="/blog" ke href="/contact"
 *   (halaman yang relevan untuk user ingin tahu lebih atau meninggalkan ulasan).
 *   Alternatif: hapus CTA ini sampai ada halaman /reviews yang sesungguhnya.
 * - Issue #12: Marquee sekarang pause saat hover (pause-on-hover) untuk
 *   keterbacaan yang lebih baik.
 * - Issue #13: Testimonials diambil dari HomeData (single source) dengan
 *   klaim statistik yang lebih autentik (tanpa "40% peningkatan penjualan").
 * - Issue #26: Data testimoni sekarang dari HomeData, bukan data lokal.
 * - Issue #28: Import cn yang tidak dipakai dihapus.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { viewport } from '@kahade/utils';
import { SectionLabel } from '@kahade/ui';
import { testimonials } from './HomeData';

function TestimonialMarquee({
  items,
  direction = 'left',
}: {
  items: typeof testimonials;
  direction?: 'left' | 'right';
}) {
  // Issue #12: State untuk pause-on-hover
  const [paused, setPaused] = useState(false);

  const animateFrom = direction === 'left' ? '0%'   : '-50%';
  const animateTo   = direction === 'left' ? '-50%' : '0%';

  return (
    <div
      className="overflow-hidden"
      // Issue #12: Pause on hover
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Issue #12: Pause on focus (keyboard user)
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-label="Scroll otomatis ulasan pengguna — hover atau fokus untuk menjeda"
    >
      <motion.div
        animate={paused ? false : { x: [animateFrom, animateTo] }}
        transition={
          paused
            ? { duration: 0 }
            : { duration: 35, repeat: Infinity, ease: 'linear' }
        }
        className="flex gap-6 w-max"
        style={{ willChange: 'transform' }}
      >
        {[...items, ...items].map((t, i) => (
          <div
            key={i}
            className="w-80 shrink-0 card p-6 transition-shadow duration-300"
          >
            {/* Stars */}
            <div className="flex gap-1 mb-4" aria-label={`Rating: ${t.rating} dari 5 bintang`}>
              {[...Array(t.rating)].map((_, j) => (
                <Star key={j} weight="fill" className="w-4 h-4 text-warning" aria-hidden="true" />
              ))}
            </div>

            {/* Issue #13: Kutipan teks dari HomeData — sudah tanpa klaim statistik absolut */}
            <blockquote className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-4">
              "{t.content}"
            </blockquote>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <div
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0"
                aria-hidden="true"
              >
                {t.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Issue #12: Hint hover bagi pengguna yang ingin membaca */}
      <p className="text-center text-[0.6875rem] text-muted-foreground/50 mt-3">
        Hover untuk menjeda scroll
      </p>
    </div>
  );
}

export default function TestimonialsSection() {
  // Issue #26: Data dari HomeData (bukan lokal)
  const firstHalf  = testimonials.slice(0, 5);
  const secondHalf = testimonials.slice(5);

  return (
    <section className="section-padding-lg bg-background overflow-hidden">
      <div className="container mb-12">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          {/* Left: heading */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
          >
            <SectionLabel variant="light">Testimoni</SectionLabel>
            <h2 className="section-title">
              Dipercaya ribuan<br className="hidden md:block" /> pengguna
            </h2>
          </motion.div>

          {/* Right: rating overview */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewport}
            className="flex flex-col items-start md:items-end"
          >
            <div className="flex gap-1 mb-2" aria-label="Rating rata-rata: 4.9 dari 5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} weight="fill" className="w-5 h-5 text-warning" aria-hidden="true" />
              ))}
            </div>
            <p className="text-3xl font-black">4,9<span className="text-lg font-medium text-muted-foreground">/5</span></p>
            <p className="text-sm text-muted-foreground">2.100+ ulasan</p>

            {/* Rating bars */}
            <div className="mt-4 space-y-1.5 w-40">
              {[{ stars: 5, pct: 87 }, { stars: 4, pct: 11 }, { stars: 3, pct: 2 }].map(({ stars, pct }) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10">{stars} ★</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-warning rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Marquee rows */}
      <div className="space-y-6">
        <TestimonialMarquee items={firstHalf}  direction="left"  />
        <TestimonialMarquee items={secondHalf} direction="right" />
      </div>

      {/* Issue #8: CTA tidak lagi ke /blog (mismatch intent).
          Diarahkan ke /contact sebagai halaman yang relevan.
          Catatan: Idealnya ganti ke /reviews ketika halaman tersebut sudah ada. */}
      <div className="container mt-12 text-center">
        <a
          href="/contact"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Bagikan pengalaman Anda →
        </a>
      </div>
    </section>
  );
}
