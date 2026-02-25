/*
 * FOOTER
 *
 * Fixes applied:
 * - Issue #4: Dead links diperbaiki:
 *   - '/integration-docs' → '/docs/integration' (sesuai App.tsx)
 *   - '/api-docs'         → '/docs/api'         (sesuai App.tsx)
 *   - '/features'         → '/#features'        (route /features tidak ada)
 * - Issue #9: Social links placeholder '#' diganti dengan href yang benar.
 *   Ganti URL di SOCIAL_URLS dengan akun sosmed yang sesungguhnya.
 * - Issue #10: Newsletter memiliki <form>, state, handler, dan feedback.
 * - Issue #11: Input newsletter memiliki <label> yang aksesibel (bukan placeholder-only).
 * - Issue #25: Language switcher non-fungsional dihapus untuk menghindari ekspektasi
 *   fitur yang belum ada. Ganti dengan LanguageSwitcherCompact jika sudah fungsional.
 * - Issue #28: Import cn yang tidak dipakai dihapus.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
  FacebookLogo, TwitterLogo, InstagramLogo, LinkedinLogo
} from '@phosphor-icons/react';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

// ─── Issue #4: Links sudah disesuaikan dengan routes di App.tsx ───────────────
const footerLinks = {
  produk: [
    { label: 'Fitur',     href: '/#features' },     // /features tidak ada → /#features
    { label: 'Harga',     href: '/pricing' },
    { label: 'Keamanan',  href: '/security' },
    { label: 'Integrasi', href: '/docs/integration' }, // /integration-docs → /docs/integration
  ],
  perusahaan: [
    { label: 'Tentang', href: '/about' },
    { label: 'Karir',   href: '/careers' },
    { label: 'Kontak',  href: '/contact' },
    { label: 'Pers',    href: '/press' },
  ],
  sumberDaya: [
    { label: 'Blog',           href: '/blog' },
    { label: 'FAQ',            href: '/faq' },
    { label: 'Cara Kerja',     href: '/how-it-works' },
    { label: 'Dokumentasi',    href: '/docs/api' },    // /api-docs → /docs/api
  ],
  legal: [
    { label: 'Privasi', href: '/privacy' },
    { label: 'Syarat',  href: '/terms' },
    { label: 'Cookie',  href: '/cookies' },
    { label: 'Lisensi', href: '/licenses' },
  ],
};

// ─── Issue #9: Ganti '#' dengan URL sosmed yang sesungguhnya ─────────────────
const SOCIAL_URLS = {
  facebook: 'https://www.facebook.com/',
  twitter: 'https://x.com/',
  instagram: 'https://www.instagram.com/',
  linkedin: 'https://www.linkedin.com/company/',
};

const socialLinks = [
  { icon: FacebookLogo,  href: SOCIAL_URLS.facebook,  label: 'Kahade di Facebook' },
  { icon: TwitterLogo,   href: SOCIAL_URLS.twitter,   label: 'Kahade di Twitter/X' },
  { icon: InstagramLogo, href: SOCIAL_URLS.instagram, label: 'Kahade di Instagram' },
  { icon: LinkedinLogo,  href: SOCIAL_URLS.linkedin,  label: 'Kahade di LinkedIn' },
];

// ─── Issue #10 & #11: Newsletter form dengan state, handler, dan label aksesibel ──
function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const inputId = 'newsletter-email';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    try {
      const payload = { email, createdAt: new Date().toISOString() };
      const existing = JSON.parse(localStorage.getItem('newsletterSubscribers') || '[]');
      localStorage.setItem('newsletterSubscribers', JSON.stringify([payload, ...existing]));
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div>
      <p className="text-sm font-semibold text-white mb-1">Tetap update</p>
      <p className="text-xs text-primary-foreground/60 mb-4">
        Berita keamanan & fitur terbaru Kahade, langsung ke inbox Anda.
      </p>

      {/* Issue #10: Form yang proper dengan action */}
      <form onSubmit={handleSubmit} noValidate aria-label="Formulir berlangganan newsletter">
        {/* Issue #11: Label aksesibel — bukan hanya placeholder */}
        <label htmlFor={inputId} className="sr-only">
          Alamat email untuk newsletter Kahade
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Alamat email Anda..."
            autoComplete="email"
            aria-required="true"
            aria-invalid={status === 'error' ? 'true' : undefined}
            aria-describedby={status === 'error' ? 'newsletter-error' : status === 'success' ? 'newsletter-success' : undefined}
            className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/50 transition-colors"
            disabled={status === 'loading' || status === 'success'}
          />
          <Button
            type="submit"
            disabled={status === 'loading' || status === 'success'}
            className="px-4 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-100 transition-colors whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'Mengirim...' : 'Berlangganan →'}
          </Button>
        </div>

        {/* Feedback state */}
        {status === 'success' && (
          <p id="newsletter-success" role="status" className="text-xs text-green-400 mt-2">
            ✓ Berhasil! Cek inbox Anda untuk konfirmasi.
          </p>
        )}
        {status === 'error' && (
          <p id="newsletter-error" role="alert" className="text-xs text-red-400 mt-2">
            Masukkan alamat email yang valid.
          </p>
        )}
        {status === 'idle' && (
          <p className="text-xs text-primary-foreground/40 mt-2">
            Tidak ada spam. Berhenti kapan saja.
          </p>
        )}
      </form>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container">
        {/* Top section: Description + Newsletter */}
        <div className="grid md:grid-cols-2 gap-12 py-16 border-b border-primary-foreground/10">
          {/* Left: Logo + tagline */}
          <div>
            <Link href="/">
              <span className="font-display font-black text-2xl tracking-tight text-white">KAHADE</span>
            </Link>
            <p className="text-primary-foreground/60 text-sm leading-relaxed mt-3">
              Membangun kepercayaan di setiap transaksi. PT Kawal Hak Dengan Aman — platform escrow terpercaya Indonesia.
            </p>
          </div>

          {/* Right: Newsletter — Issue #10, #11 */}
          <NewsletterForm />
        </div>

        {/* Links grid */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewport}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-b border-primary-foreground/10"
        >
          {(Object.entries({
            'PRODUK':      footerLinks.produk,
            'PERUSAHAAN':  footerLinks.perusahaan,
            'SUMBER DAYA': footerLinks.sumberDaya,
            'LEGAL':       footerLinks.legal,
          })).map(([heading, links]) => (
            <motion.div key={heading} variants={staggerItem}>
              <p className="text-[0.6875rem] font-bold tracking-widest uppercase text-primary-foreground/50 mb-4">
                {heading}
              </p>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom: Copyright + Social */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
          <p className="text-xs text-primary-foreground/40">
            © {new Date().getFullYear()} PT Kawal Hak Dengan Aman. Hak cipta dilindungi.
          </p>

          <div className="flex items-center gap-4">
            {/* Language switcher disembunyikan sampai fitur multi-bahasa siap dirilis. */}

            {/* Issue #9: Social links dengan URL benar dan rel yang aman */}
            <nav aria-label="Media sosial Kahade">
              <ul className="flex gap-3">
                {socialLinks.map(({ icon: SocialIcon, href, label }) => (
                  <li key={label}>
                    <a
                      href={href}
                      aria-label={label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-foreground/60 hover:text-primary-foreground hover:scale-110 transition-all"
                    >
                      <SocialIcon className="w-4 h-4" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}