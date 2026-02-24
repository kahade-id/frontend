/*
 * KAHADE NAVBAR - FIXED EDITION
 *
 * Fixes applied:
 * - Issue #1: `/#security` diubah ke `/security` (route yang ada di App.tsx).
 *   Sebelumnya klik "Keamanan" di menu tidak mengarah ke section yang ada.
 * - Issue #3: Semua pola Link membungkus <button> sudah diperbaiki.
 *   CTA autentikasi menggunakan Link as anchor dengan class styling,
 *   atau button dengan onClick handler — tidak ada nesting elemen interaktif.
 *
 * Catatan: Semua Link yang mengarah ke halaman produk dalam mega menu
 * sudah dicek terhadap routes yang ada di App.tsx.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import {
  List, X, CaretDown, CaretRight,
  Rocket, ShieldCheck, Users, CreditCard, ChartLine, Headset,
  BookOpen, FileText, Question, Newspaper, Buildings, Briefcase,
  ArrowRight, ArrowUpRight
} from '@phosphor-icons/react';
import { Button } from '@kahade/ui';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_URLS, canAccessAdmin, navigateToApp, navigateToAdmin } from '@kahade/config';
import { LanguageSwitcher, LanguageSwitcherCompact } from '@kahade/ui';
import { cn, ariaProps, keyboardNav } from '@kahade/utils';
import { fadeIn, slideInDown } from '@kahade/utils';

const megaMenuData = {
  product: {
    label: 'Produk',
    sections: [
      {
        title: 'Platform',
        links: [
          { href: '/#features', label: 'Fitur',     icon: Rocket,    description: 'Jelajahi semua fitur platform' },
          // Issue #1: Diubah dari /#security ke /security (halaman yang ada)
          { href: '/security',  label: 'Keamanan',  icon: ShieldCheck, description: 'Perlindungan setara enterprise' },
          { href: '/#pricing',  label: 'Harga',     icon: CreditCard, description: 'Rencana harga transparan' },
        ]
      },
      {
        title: 'Solusi',
        links: [
          { href: '/use-cases',            label: 'Marketplace', icon: Users,     description: 'Untuk marketplace online' },
          { href: '/use-cases#freelance',  label: 'Freelancer',  icon: Briefcase, description: 'Pembayaran freelance yang aman' },
          { href: '/contact',              label: 'Enterprise',  icon: Buildings, description: 'Solusi enterprise kustom' },
        ]
      }
    ],
    featured: {
      title: 'Rilis Terbaru',
      description: 'Kenalkan Kahade Mobile App - Transaksi aman di mana saja',
      href: '/mobile',   // sesuai route /mobile di App.tsx
      badge: 'Baru'
    }
  },
  resources: {
    label: 'Sumber Daya',
    sections: [
      {
        title: 'Pelajari',
        links: [
          { href: '/blog',         label: 'Blog',        icon: Newspaper, description: 'Berita dan update terbaru' },
          { href: '/how-it-works', label: 'Cara Kerja',  icon: BookOpen,  description: 'Panduan langkah demi langkah' },
          { href: '/faq',          label: 'FAQ',         icon: Question,  description: 'Jawaban pertanyaan umum' },
        ]
      },
      {
        title: 'Dokumentasi',
        links: [
          // Issue #4: Sesuaikan dengan routes yang ada di App.tsx (/docs/api, /docs/integration)
          { href: '/docs/api',         label: 'Dokumentasi API',     icon: FileText,  description: 'Dokumentasi untuk developer' },
          { href: '/docs/integration', label: 'Panduan Integrasi',   icon: ChartLine, description: 'Tutorial integrasi' },
          { href: '/help',             label: 'Pusat Bantuan',       icon: Headset,   description: 'Sumber bantuan 24/7' },
        ]
      }
    ]
  },
  company: {
    label: 'Perusahaan',
    links: [
      { href: '/about',    label: 'Tentang Kami' },
      { href: '/careers',  label: 'Karier' },
      { href: '/contact',  label: 'Kontak' },
      { href: '/press',    label: 'Pers' },
    ]
  }
};

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const navRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  const handleDashboardClick = useCallback(() => {
    if (canAccessAdmin(user)) navigateToAdmin();
    else navigateToApp();
  }, [user]);

  const handleMenuEnter = useCallback((menuKey: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menuKey);
  }, []);

  const handleMenuLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => setActiveMenu(null), 150);
  }, []);

  const toggleMobileSubmenu = useCallback((menuKey: string) => {
    setExpandedMobileMenu(prev => prev === menuKey ? null : menuKey);
  }, []);

  const closeAllMenus = useCallback(() => {
    setActiveMenu(null);
    setIsMobileMenuOpen(false);
  }, []);

  const navClasses = useMemo(() => cn(
    'fixed top-0 left-0 right-0 z-50 py-3 md:py-4 transition-all duration-300',
    'bg-[#FFFFFF] border-b border-[#E8E8E8]'
  ), []);

  return (
    <>
      <nav
        ref={navRef}
        className={navClasses}
        role="navigation"
        aria-label="Navigasi utama"
      >
        <div className="container flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="block flex items-center shrink-0 relative z-10">
            <img
              src="/images/logo.svg"
              alt="Kahade - Platform Escrow Terpercaya"
              className="h-8 w-auto"
              width={120}
              height={32}
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            <NavMenuItem
              menuKey="product"
              label="Produk"
              activeMenu={activeMenu}
              onMenuEnter={handleMenuEnter}
              onMouseLeave={handleMenuLeave}
            >
              <MegaMenuProduct
                data={megaMenuData.product}
                onClose={closeAllMenus}
                onMouseEnter={() => handleMenuEnter('product')}
                onMouseLeave={handleMenuLeave}
              />
            </NavMenuItem>

            <NavMenuItem
              menuKey="resources"
              label="Sumber Daya"
              activeMenu={activeMenu}
              onMenuEnter={handleMenuEnter}
              onMouseLeave={handleMenuLeave}
            >
              <MegaMenuResources
                data={megaMenuData.resources}
                onClose={closeAllMenus}
                onMouseEnter={() => handleMenuEnter('resources')}
                onMouseLeave={handleMenuLeave}
              />
            </NavMenuItem>

            <NavMenuItem
              menuKey="company"
              label="Perusahaan"
              activeMenu={activeMenu}
              onMenuEnter={handleMenuEnter}
              onMouseLeave={handleMenuLeave}
            >
              <SimpleDropdown
                links={megaMenuData.company.links}
                onClose={closeAllMenus}
                onMouseEnter={() => handleMenuEnter('company')}
                onMouseLeave={handleMenuLeave}
              />
            </NavMenuItem>
          </div>

          {/* CTA Buttons - Desktop */}
          {/* Issue #3: Tidak ada Link membungkus Button lagi.
              Untuk styled link, gunakan Link langsung dengan className.
              Untuk action button (dashboard), gunakan Button dengan onClick. */}
          <div className="hidden lg:flex items-center gap-3">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <Button
                onClick={handleDashboardClick}
                className="btn-primary"
                {...ariaProps('Pergi ke dashboard')}
              >
                Dashboard
                <ArrowRight className="ml-2 w-4 h-4" weight="bold" aria-hidden="true" />
              </Button>
            ) : (
              <>
                {/* Link as styled anchor — VALID */}
                <Link
                  href="/login"
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                  aria-label="Masuk ke akun Anda"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="btn-primary inline-flex items-center"
                  aria-label="Buat akun baru"
                >
                  Mulai
                </Link>
              </>
            )}
          </div>

          {/* Mobile: CTA + Hamburger */}
          <div className="flex lg:hidden items-center gap-3">
            {!isAuthenticated && (
              <Link href="/register" className="btn-primary btn-xs inline-flex items-center">
                Mulai
              </Link>
            )}
            {isAuthenticated && (
              <Button
                onClick={handleDashboardClick}
                className="btn-primary btn-xs"
              >
                Dashboard
              </Button>
            )}
            <button
              type="button"
              className="p-2 hover:bg-muted rounded-lg transition-colors relative z-10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              {...ariaProps(
                isMobileMenuOpen ? 'Tutup menu' : 'Buka menu',
                undefined,
                isMobileMenuOpen
              )}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" weight="bold" aria-hidden="true" />
              ) : (
                <List className="w-6 h-6" weight="bold" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <MobileMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            expandedMenu={expandedMobileMenu}
            onToggleMenu={toggleMobileSubmenu}
            isAuthenticated={isAuthenticated}
            onDashboardClick={handleDashboardClick}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

interface NavMenuItemProps {
  menuKey: string;
  label: string;
  activeMenu: string | null;
  onMenuEnter: (key: string) => void;
  onMouseLeave: () => void;
  children: React.ReactNode;
}

function NavMenuItem({ menuKey, label, activeMenu, onMenuEnter, onMouseLeave, children }: NavMenuItemProps) {
  const isActive = activeMenu === menuKey;

  return (
    <div
      className="relative"
      onMouseEnter={() => onMenuEnter(menuKey)}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
          isActive
            ? 'text-foreground bg-muted'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
        aria-expanded={isActive}
        aria-haspopup="true"
        onKeyDown={keyboardNav({
          onEnter: () => onMenuEnter(menuKey),
          onEscape: onMouseLeave,
        })}
      >
        {label}
        <CaretDown
          className={cn('w-4 h-4 transition-transform duration-200', isActive && 'rotate-180')}
          weight="bold"
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {isActive && children}
      </AnimatePresence>
    </div>
  );
}

interface MegaMenuProductProps {
  data: typeof megaMenuData.product;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function MegaMenuProduct({ data, onClose, onMouseEnter, onMouseLeave }: MegaMenuProductProps) {
  return (
    <motion.div
      {...slideInDown}
      className="absolute top-full left-0 mt-2 w-[min(600px,calc(100vw-2rem))] bg-popover rounded-lg border border-border p-6"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="grid grid-cols-2 gap-8">
        {data.sections.map((section) => (
          <div key={section.title}>
            <p className="section-label text-xs mb-4">{section.title}</p>
            <div className="space-y-1">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block flex items-start gap-4 p-2 rounded-lg hover:bg-muted transition-all duration-200 group"
                  onClick={onClose}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                    <link.icon className="w-5 h-5" weight="bold" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{link.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{link.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Featured Section */}
      <div className="mt-6 pt-6 border-t border-border">
        <Link
          href={data.featured.href}
          className="block flex items-center justify-between p-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 group"
          onClick={onClose}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{data.featured.title}</span>
              <span className="badge badge-secondary">{data.featured.badge}</span>
            </div>
            <p className="text-xs text-primary-foreground/70 mt-1">{data.featured.description}</p>
          </div>
          <ArrowUpRight
            className="w-5 h-5 text-primary-foreground/70 group-hover:text-primary-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
            weight="bold"
            aria-hidden="true"
          />
        </Link>
      </div>
    </motion.div>
  );
}

interface MegaMenuResourcesProps {
  data: typeof megaMenuData.resources;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function MegaMenuResources({ data, onClose, onMouseEnter, onMouseLeave }: MegaMenuResourcesProps) {
  return (
    <motion.div
      {...slideInDown}
      className="absolute top-full left-0 mt-2 w-[min(500px,calc(100vw-2rem))] bg-popover rounded-lg border border-border p-6"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="grid grid-cols-2 gap-8">
        {data.sections.map((section) => (
          <div key={section.title}>
            <p className="section-label text-xs mb-4">{section.title}</p>
            <div className="space-y-1">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block flex items-start gap-4 p-2 rounded-lg hover:bg-muted transition-all duration-200 group"
                  onClick={onClose}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                    <link.icon className="w-5 h-5" weight="bold" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{link.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{link.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface SimpleDropdownProps {
  links: Array<{ href: string; label: string }>;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function SimpleDropdown({ links, onClose, onMouseEnter, onMouseLeave }: SimpleDropdownProps) {
  return (
    <motion.div
      {...slideInDown}
      className="absolute top-full left-0 mt-2 w-48 bg-popover rounded-lg border border-border p-2"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="block px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all duration-200"
          onClick={onClose}
        >
          {link.label}
        </Link>
      ))}
    </motion.div>
  );
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  expandedMenu: string | null;
  onToggleMenu: (key: string) => void;
  isAuthenticated: boolean;
  onDashboardClick: () => void;
}

function MobileMenu({
  isOpen, onClose, expandedMenu, onToggleMenu, isAuthenticated, onDashboardClick
}: MobileMenuProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 bg-background z-50 lg:hidden overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Menu navigasi mobile"
    >
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
        <img src="/images/logo.svg" alt="Kahade" className="h-7 w-auto" />
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          {...ariaProps('Tutup menu')}
        >
          <X className="w-6 h-6" weight="bold" aria-hidden="true" />
        </button>
      </div>

      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Bahasa</span>
          <LanguageSwitcherCompact />
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-6 space-y-2" aria-label="Navigasi utama mobile">
        <MobileMenuItem
          title="Produk"
          menuKey="product"
          isExpanded={expandedMenu === 'product'}
          onToggle={onToggleMenu}
        >
          {megaMenuData.product.sections.flatMap(s => s.links).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block flex items-center gap-4 px-4 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <link.icon className="w-5 h-5" weight="bold" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </MobileMenuItem>

        <MobileMenuItem
          title="Sumber Daya"
          menuKey="resources"
          isExpanded={expandedMenu === 'resources'}
          onToggle={onToggleMenu}
        >
          {megaMenuData.resources.sections.flatMap(s => s.links).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block flex items-center gap-4 px-4 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <link.icon className="w-5 h-5" weight="bold" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </MobileMenuItem>

        <MobileMenuItem
          title="Perusahaan"
          menuKey="company"
          isExpanded={expandedMenu === 'company'}
          onToggle={onToggleMenu}
        >
          {megaMenuData.company.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block px-4 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </MobileMenuItem>
      </nav>

      {/* CTA Section */}
      {/* Issue #3: Menggunakan Link as anchor dan Button as button — tidak nesting */}
      <div className="p-6 border-t border-border space-y-4">
        {isAuthenticated ? (
          <Button
            onClick={() => { onDashboardClick(); onClose(); }}
            className="btn-primary w-full"
          >
            Dashboard
          </Button>
        ) : (
          <>
            <Link
              href="/register"
              onClick={onClose}
              className="btn-primary w-full flex items-center justify-center"
            >
              Mulai
            </Link>
            <Link
              href="/login"
              onClick={onClose}
              className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Masuk
            </Link>
          </>
        )}
      </div>
    </motion.div>
  );
}

interface MobileMenuItemProps {
  title: string;
  menuKey: string;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}

function MobileMenuItem({ title, menuKey, isExpanded, onToggle, children }: MobileMenuItemProps) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(menuKey)}
        className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold hover:bg-muted rounded-lg transition-colors"
        aria-expanded={isExpanded}
        onKeyDown={keyboardNav({
          onEnter: () => onToggle(menuKey),
          onSpace: () => onToggle(menuKey),
        })}
      >
        {title}
        <CaretDown
          className={cn('w-5 h-5 transition-transform', isExpanded && 'rotate-180')}
          weight="bold"
          aria-hidden="true"
        />
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-4 py-2 space-y-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
