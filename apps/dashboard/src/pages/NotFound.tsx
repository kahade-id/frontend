/*
 * KAHADE 404 NOT FOUND PAGE - PROFESSIONAL REDESIGN
 * 
 * Design Philosophy:
 * - Clean, modern, and professional aesthetic
 * - Fully responsive for Mobile, Tablet, and Desktop
 * - Brand color: var(--color-black)
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { House, MagnifyingGlass, ArrowLeft } from '@phosphor-icons/react';
import { Button } from '@kahade/ui';

export default function NotFound() {
 return (
 <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
 {/* Background Pattern */}
 <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-neutral-100)_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" aria-hidden="true" />
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="text-center max-w-lg relative z-10"
 >
 {/* 404 Number */}
 <div className="relative mb-6 md:mb-8">
 <h1 className="text-[100px] sm:text-[150px] md:text-[200px] font-bold text-neutral-50 leading-none select-none">
 404
 </h1>
 <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
 <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl bg-black flex items-center justify-center">
 <MagnifyingGlass className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" aria-hidden="true" weight="bold" />
 </div>
 </div>
 </div>
 
 <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3 md:mb-4">
 Halaman Tidak Ditemukan
 </h2>
 
 <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8 max-w-sm mx-auto">
 Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan ke lokasi lain.
 </p>
 
 <div className="flex flex-col sm:flex-row gap-4 md:gap-4 justify-center">
 <Link href="/" className="block block">
 <Button className="h-10 md:h-11 px-5 md:px-6 bg-black text-white hover:bg-black/90 font-semibold rounded-xl gap-2">
 <House className="w-5 h-5" aria-hidden="true" weight="bold" />
 Kembali ke Beranda
 </Button>
 </Link>
 <Button 
 variant="outline"
 className="h-10 md:h-11 px-5 md:px-6 border-border font-semibold rounded-xl gap-2"
 onClick={() => window.history.back()}
 >
 <ArrowLeft className="w-5 h-5" aria-hidden="true" weight="bold" />
 Kembali
 </Button>
 </div>
 
 {/* Quick Links */}
 <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-border">
 <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">Atau kunjungi halaman populer berikut:</p>
 <div className="flex flex-wrap justify-center gap-4 md:gap-4">
 <Link href="/how-it-works" className="block text-xs md:text-sm text-foreground hover:underline font-semibold">
 Cara Kerja
 </Link>
 <Link href="/about" className="block text-xs md:text-sm text-foreground hover:underline font-semibold">
 Tentang Kami
 </Link>
 <Link href="/contact" className="block text-xs md:text-sm text-foreground hover:underline font-semibold">
 Kontak
 </Link>
 <Link href="/faq" className="block text-xs md:text-sm text-foreground hover:underline font-semibold">
 FAQ
 </Link>
 </div>
 </div>
 </motion.div>
 </div>
 );
}
