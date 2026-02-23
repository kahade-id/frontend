/*
 * KAHADE HOME PAGE - OPTIMIZED V2.0
 * 
 * Performance Improvements:
 * - Lazy loaded sections for better initial load
 * - Component splitting for maintainability
 * - Design system utilities
 * - Optimized animations
 */

import { useState, useEffect, lazy, Suspense } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';

// Lazy load heavy sections
const HeroSection = lazy(() => import('@/components/home/HeroSection'));
const TrustSignals = lazy(() => import('@/components/home/TrustSignals'));
const ProblemSection = lazy(() => import('@/components/home/ProblemSection'));
const FeaturesSection = lazy(() => import('@/components/home/FeaturesSection'));
const HowItWorksSection = lazy(() => import('@/components/home/HowItWorksSection'));
const PricingSection = lazy(() => import('@/components/home/PricingSection'));
const TestimonialsSection = lazy(() => import('@/components/home/TestimonialsSection'));
const FinalCTA = lazy(() => import('@/components/home/FinalCTA'));

// Loading skeleton component
function SectionSkeleton() {
 return (
 <div className="py-16 md:py-20 lg:py-28">
 <div className="container">
 <div className="animate-pulse space-y-8">
 <div className="h-12 bg-muted rounded-lg w-1/2 mx-auto" />
 <div className="h-6 bg-muted rounded-lg w-2/3 mx-auto" />
 <div className="grid md:grid-cols-3 gap-8">
 <div className="h-64 bg-muted rounded-2xl" />
 <div className="h-64 bg-muted rounded-2xl" />
 <div className="h-64 bg-muted rounded-2xl" />
 </div>
 </div>
 </div>
 </div>
 );
}

export default function Home() {
 const [location] = useLocation();

 useEffect(() => {
 window.scrollTo({ top: 0, behavior: 'smooth' });
 }, [location]);

 return (
 <div className="min-h-screen bg-background overflow-x-hidden">
 <Navbar />
 
 {/* Hero - Always visible, not lazy loaded */}
 <Suspense fallback={<SectionSkeleton />}>
 <HeroSection />
 </Suspense>
 
 {/* Lazy loaded sections */}
 <Suspense fallback={<SectionSkeleton />}>
 <TrustSignals />
 </Suspense>
 
 <Suspense fallback={<SectionSkeleton />}>
 <ProblemSection />
 </Suspense>
 
 <Suspense fallback={<SectionSkeleton />}>
 <FeaturesSection />
 </Suspense>
 
 <Suspense fallback={<SectionSkeleton />}>
 <HowItWorksSection />
 </Suspense>
 
 <Suspense fallback={<SectionSkeleton />}>
 <PricingSection />
 </Suspense>
 
 <Suspense fallback={<SectionSkeleton />}>
 <TestimonialsSection />
 </Suspense>
 
 <Suspense fallback={<SectionSkeleton />}>
 <FinalCTA />
 </Suspense>
 
 <Footer />
 </div>
 );
}
