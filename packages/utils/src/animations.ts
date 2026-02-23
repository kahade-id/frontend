// src/lib/animations.ts — EXTENDED VERSION v3.3
// FIX (v3.3): import WAJIB di PALING ATAS file, SEBELUM semua export.
import { useState, useEffect, useRef } from 'react';
import type { Variants } from 'framer-motion';

// =============================================================================
// FADE ANIMATIONS
// =============================================================================

export const fadeIn: Variants = {
 initial: { opacity: 0 },
 animate: {
 opacity: 1,
 transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 opacity: 0,
 transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
 },
};

export const fadeInUp: Variants = {
 initial: { opacity: 0, y: 24 },
 animate: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 opacity: 0,
 y: 24,
 transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
 },
};

export const fadeInDown: Variants = {
 initial: { opacity: 0, y: -24 },
 animate: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 opacity: 0,
 y: -24,
 transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
 },
};

export const fadeInLeft: Variants = {
 initial: { opacity: 0, x: -32 },
 animate: {
 opacity: 1,
 x: 0,
 transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 opacity: 0,
 x: -32,
 transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
 },
};

export const fadeInRight: Variants = {
 initial: { opacity: 0, x: 32 },
 animate: {
 opacity: 1,
 x: 0,
 transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 opacity: 0,
 x: 32,
 transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
 },
};

// =============================================================================
// SCALE ANIMATIONS
// =============================================================================

export const scaleIn: Variants = {
 initial: { opacity: 0, scale: 0.92 },
 animate: {
 opacity: 1,
 scale: 1,
 transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }
 },
 exit: {
 opacity: 0,
 scale: 0.92,
 transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
 },
};

export const blurIn: Variants = {
 initial: { opacity: 0, filter: 'blur(10px)' },
 animate: {
 opacity: 1,
 filter: 'blur(0px)',
 transition: { duration: 0.4, ease: 'easeOut' }
 },
 exit: {
 opacity: 0,
 filter: 'blur(10px)',
 transition: { duration: 0.3, ease: 'easeIn' }
 },
};

// =============================================================================
// SLIDE ANIMATIONS
// =============================================================================

export const slideInDown: Variants = {
 initial: { opacity: 0, y: -10 },
 animate: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 opacity: 0,
 y: -10,
 transition: { duration: 0.15, ease: [0.4, 0, 1, 1] }
 },
};

export const slideUp: Variants = {
 initial: { y: '100%' },
 animate: {
 y: 0,
 transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
 },
 exit: {
 y: '100%',
 transition: { duration: 0.25, ease: [0.4, 0, 1, 1] }
 },
};

// =============================================================================
// STAGGER ANIMATIONS
// =============================================================================

// FIX (v3.3): staggerContainer — flat structure (tidak nested `variants` key)
export const staggerContainer: Variants = {
 initial: {},
 animate: {
 transition: {
 staggerChildren: 0.08,
 delayChildren: 0.1,
 }
 }
};
// Cara pemakaian — whileInView (lebih sering dipakai):
// <motion.div variants={staggerContainer} initial="initial" whileInView="animate"
// viewport={{ once: true, margin: "0px 0px -80px 0px" }}>

// FIX (v3.3): staggerItem — flat structure
export const staggerItem: Variants = {
 initial: { opacity: 0, y: 24 },
 animate: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
 }
};

export const scrollReveal: Variants = {
 initial: { opacity: 0, y: 30 },
 animate: {
 opacity: 1,
 y: 0,
 transition: { duration: 0.5, ease: 'easeOut' }
 },
};

// =============================================================================
// SPECIAL EFFECTS
// =============================================================================

export const rotateIn: Variants = {
 initial: { opacity: 0, rotate: -10, scale: 0.9 },
 animate: {
 opacity: 1,
 rotate: 0,
 scale: 1,
 transition: { duration: 0.4, ease: 'easeOut' }
 },
 exit: {
 opacity: 0,
 rotate: 10,
 scale: 0.9,
 transition: { duration: 0.3, ease: 'easeIn' }
 },
};

export const bounceIn: Variants = {
 initial: { opacity: 0, scale: 0.3 },
 animate: {
 opacity: 1,
 scale: 1,
 transition: {
 type: 'spring',
 stiffness: 260,
 damping: 20,
 duration: 0.6,
 }
 },
 exit: {
 opacity: 0,
 scale: 0.5,
 transition: { duration: 0.2 }
 },
};

export const flipIn: Variants = {
 initial: { opacity: 0, rotateX: -90 },
 animate: {
 opacity: 1,
 rotateX: 0,
 transition: { duration: 0.4, ease: 'easeOut' }
 },
 exit: {
 opacity: 0,
 rotateX: 90,
 transition: { duration: 0.3, ease: 'easeIn' }
 },
};

export const expandVertical: Variants = {
 initial: { height: 0, opacity: 0 },
 animate: {
 height: 'auto',
 opacity: 1,
 transition: {
 height: { duration: 0.3 },
 opacity: { duration: 0.25, delay: 0.05 },
 }
 },
 exit: {
 height: 0,
 opacity: 0,
 transition: {
 height: { duration: 0.3 },
 opacity: { duration: 0.2 },
 }
 },
};

// =============================================================================
// VIEWPORT SETTINGS
// =============================================================================

export const viewport = {
 once: true,
 margin: "0px 0px -80px 0px"
};

// =============================================================================
// SPRING ANIMATIONS
// =============================================================================

export const spring = {
 type: "spring",
 stiffness: 400,
 damping: 30
};

export const softSpring = {
 type: "spring",
 stiffness: 200,
 damping: 25
};

// =============================================================================
// PAGE TRANSITION
// =============================================================================

export const pageTransition = {
 initial: { opacity: 0, y: 8 },
 animate: { opacity: 1, y: 0 },
 exit: { opacity: 0, y: -8 },
 transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
};

// =============================================================================
// useCountUp HOOK
// FIX (v3.3): Definisi hook ini — direferensikan di TrustSignals tapi tidak ada.
// Import: import { useCountUp } from '@kahade/utils';
// =============================================================================

export function useCountUp(target: number, duration: number = 2.5, enabled: boolean = true) {
 const [count, setCount] = useState(0);
 const startTime = useRef<number | null>(null);
 const rafRef = useRef<number | null>(null);

 useEffect(() => {
 if (!enabled) return;
 startTime.current = null;

 const animate = (timestamp: number) => {
 if (!startTime.current) startTime.current = timestamp;
 const elapsed = (timestamp - startTime.current) / 1000;
 const progress = Math.min(elapsed / duration, 1);
 const eased = 1 - Math.pow(1 - progress, 3);
 setCount(Math.floor(eased * target));
 if (progress < 1) {
 rafRef.current = requestAnimationFrame(animate);
 } else {
 setCount(target);
 }
 };

 rafRef.current = requestAnimationFrame(animate);
 return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
 }, [target, duration, enabled]);

 return count;
}

// =============================================================================
// ALL ANIMATIONS OBJECT
// =============================================================================

export const animations = {
 fadeIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight,
 scaleIn, blurIn,
 slideInDown, slideUp,
 scrollReveal,
 staggerContainer, staggerItem,
 rotateIn, bounceIn, flipIn,
 expandVertical,
};
