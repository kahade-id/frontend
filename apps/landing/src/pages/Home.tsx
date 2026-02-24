/*
 * KAHADE HOME PAGE
 *
 * Fixes applied:
 * - Issue #2: scroll-to-top sekarang hanya terjadi pada route biasa,
 *   BUKAN saat hash navigation (#section). Ini mencegah anchor link
 *   langsung lompat ke atas halaman.
 * - Issue #22: Suspense tidak lagi granular per-section. Semua section
 *   digabung dalam satu Suspense boundary agar tidak terjadi "flicker
 *   skeleton" berulang-ulang pada koneksi lambat.
 */

import { useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'wouter';
import { Spinner } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

// Lazy load heavy sections
const HeroSection       = lazy(() => import('@/components/home/HeroSection'));
const TrustSignals      = lazy(() => import('@/components/home/TrustSignals'));
const ProblemSection    = lazy(() => import('@/components/home/ProblemSection'));
const FeaturesSection   = lazy(() => import('@/components/home/FeaturesSection'));
// Issue #30: SecuritySection ditambahkan sebagai pillar section di homepage
const SecuritySection   = lazy(() => import('@/components/home/SecuritySection'));
const HowItWorksSection = lazy(() => import('@/components/home/HowItWorksSection'));
const PricingSection    = lazy(() => import('@/components/home/PricingSection'));
const TestimonialsSection = lazy(() => import('@/components/home/TestimonialsSection'));
const FinalCTA          = lazy(() => import('@/components/home/FinalCTA'));

// Single page-level skeleton — mencegah flicker skeleton per-section (Issue #22)
function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Spinner className="w-8 h-8 animate-spin text-primary mx-auto" weight="bold" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Memuat halaman...</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [location] = useLocation();

  // Issue #2: Hanya scroll ke atas pada perpindahan route biasa.
  // Hash navigation (mis. /#pricing, /#features) TIDAK memicu scroll-to-top
  // karena browser perlu melakukan scrollIntoView ke section yang dimaksud.
  useEffect(() => {
    // Cek apakah URL mengandung hash (anchor navigation)
    const hasHash = window.location.hash && window.location.hash.length > 1;
    if (hasHash) {
      // Biarkan browser/anchor handler yang mengurus scroll ke section
      const el = document.querySelector(window.location.hash);
      if (el) {
        // Delay kecil untuk menunggu render selesai
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      return;
    }
    // Route biasa (tanpa hash): scroll ke atas
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      {/* Issue #22: Satu Suspense boundary untuk semua sections.
          Ini mencegah skeleton "berkedip-kedip" antar section saat load. */}
      <Suspense fallback={<PageSkeleton />}>
        <HeroSection />
        <TrustSignals />
        <ProblemSection />
        <FeaturesSection />
        {/* Issue #30: Security sebagai pillar section */}
        <SecuritySection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <FinalCTA />
      </Suspense>

      <Footer />
    </div>
  );
}