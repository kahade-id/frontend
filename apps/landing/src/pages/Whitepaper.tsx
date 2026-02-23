/*
 * KAHADE WHITEPAPER PAGE - PROFESSIONAL REDESIGN
 * 
 * Design Philosophy:
 * - Clean, modern, and professional aesthetic
 * - Fully responsive for Mobile, Tablet, and Desktop
 * - Brand color: var(--color-black)
 */

import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { FileText, Download, BookOpen, ChartLine, Shield, Users, Globe, ArrowRight, CheckCircle, Clock } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';

const tableOfContents = [
 { number: '01', title: 'Executive Summary', page: 3 },
 { number: '02', title: 'Problem Statement', page: 5 },
 { number: '03', title: 'Market Analysis', page: 8 },
 { number: '04', title: 'The Kahade Solution', page: 12 },
 { number: '05', title: 'Technology Architecture', page: 18 },
 { number: '06', title: 'Security Framework', page: 24 },
 { number: '07', title: 'Business Model', page: 28 },
 { number: '08', title: 'Roadmap', page: 32 },
 { number: '09', title: 'Team & Advisors', page: 36 },
 { number: '10', title: 'Conclusion', page: 40 },
];

const highlights = [
 { icon: Globe, stat: '$2.5T', label: 'Global P2P Market Size', description: 'The peer-to-peer marketplace is growing at 15% annually' },
 { icon: Shield, stat: '99.9%', label: 'Fraud Prevention Rate', description: 'Our escrow system prevents virtually all transaction fraud' },
 { icon: Users, stat: '10M+', label: 'Target Users by 2028', description: 'Projected user base across Southeast Asia and beyond' },
 { icon: ChartLine, stat: '40%', label: 'YoY Growth Target', description: 'Sustainable growth through product excellence' },
];

const keyPoints = [
 'Comprehensive analysis of the P2P marketplace trust problem',
 'Detailed technical architecture of our escrow platform',
 'Security measures and compliance framework',
 'Go-to-market strategy and expansion plans',
 'Financial projections and business model',
 'Team background and advisory board',
];

export default function Whitepaper() {
 return (
 <div className="min-h-screen bg-background">
 <Navbar />
 
 {/* Hero Section */}
 <section className="pt-28 md:pt-32 lg:pt-40 pb-12 md:pb-16 lg:pb-20 relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" aria-hidden="true" />
 <div className="container relative z-10">
 <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 >
 <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4">
 Official Document
 </span>
 <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-foreground">
 Kahade Whitepaper
 </h1>
 <p className="text-base md:text-lg text-muted-foreground mb-4 md:mb-6">
 A comprehensive overview of our vision, technology, and strategy for building 
 the most trusted P2P escrow platform in the world.
 </p>
 
 <div className="flex items-center gap-4 text-xs md:text-sm text-muted-foreground mb-6 md:mb-8">
 <span className="flex items-center gap-1">
 <BookOpen className="w-4 h-4" aria-hidden="true" weight="regular" />
 42 Pages
 </span>
 <span className="flex items-center gap-1">
 <Clock className="w-4 h-4" aria-hidden="true" weight="regular" />
 Updated Jan 2026
 </span>
 </div>
 
 <div className="flex flex-col sm:flex-row gap-4 md:gap-4">
 <Button className="h-11 md:h-12 px-5 md:px-6 bg-black text-white hover:bg-black/90 font-semibold rounded-xl gap-2">
 <Download className="w-5 h-5" aria-hidden="true" weight="bold" />
 Download PDF
 </Button>
 <Button variant="outline" className="h-11 md:h-12 px-5 md:px-6 border-border font-semibold rounded-xl gap-2">
 <BookOpen className="w-5 h-5" aria-hidden="true" weight="regular" />
 Read Online
 </Button>
 </div>
 </motion.div>
 
 {/* Document Preview */}
 <motion.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.2 }}
 className="relative hidden md:block"
 >
 <div className="relative bg-card rounded-xl md:rounded-2xl border border-border p-6 md:p-8 transform rotate-2 hover:rotate-0 transition-transform">
 <div className="absolute top-4 right-4 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-black flex items-center justify-center" aria-hidden="true">
 <FileText className="w-5 h-5 md:w-6 md:h-6 text-white" aria-hidden="true" weight="bold" />
 </div>
 <div className="space-y-3 md:space-y-4">
 <div className="h-3 md:h-4 bg-muted rounded w-3/4" />
 <div className="h-2.5 md:h-3 bg-muted rounded w-full" />
 <div className="h-2.5 md:h-3 bg-muted rounded w-5/6" />
 <div className="h-2.5 md:h-3 bg-muted rounded w-4/5" />
 <div className="h-6 md:h-8" />
 <div className="h-2.5 md:h-3 bg-muted rounded w-full" />
 <div className="h-2.5 md:h-3 bg-muted rounded w-3/4" />
 <div className="h-2.5 md:h-3 bg-muted rounded w-5/6" />
 <div className="h-6 md:h-8" />
 <div className="h-16 md:h-20 bg-muted rounded-xl" />
 </div>
 </div>
 <div className="absolute -bottom-3 md:-bottom-4 -left-3 md:-left-4 bg-black rounded-xl p-4 md:p-6 " aria-hidden="true">
 <div className="text-2xl md:text-3xl font-bold text-white">v2.0</div>
 <div className="text-xs md:text-sm text-white/70">Latest Version</div>
 </div>
 </motion.div>
 </div>
 </div>
 </section>
 
 {/* Key Highlights */}
 <section className="py-12 md:py-16 lg:py-20 bg-muted">
 <div className="container">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="text-center mb-8 md:mb-12"
 >
 <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4">
 Overview
 </span>
 <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-foreground">Key Highlights</h2>
 <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
 Important metrics and projections from our whitepaper.
 </p>
 </motion.div>
 
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
 {highlights.map((item, index) => (
 <motion.div
 key={item.label}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.1 }}
 className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 border border-border text-center"
 >
 <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3 md:mb-4">
 <item.icon className="w-5 h-5 md:w-6 md:h-6 text-foreground" weight="bold" />
 </div>
 <div className="text-xl md:text-3xl font-bold text-foreground mb-0.5 md:mb-1">{item.stat}</div>
 <div className="font-semibold text-xs md:text-sm mb-1 md:mb-2 text-foreground">{item.label}</div>
 <p className="text-[10px] md:text-sm text-muted-foreground hidden sm:block">{item.description}</p>
 </motion.div>
 ))}
 </div>
 </div>
 </section>
 
 {/* Table of Contents */}
 <section className="py-12 md:py-16 lg:py-20">
 <div className="container">
 <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 >
 <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4">
 Contents
 </span>
 <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-foreground">Table of Contents</h2>
 <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">
 Explore the comprehensive coverage of our platform, technology, and vision.
 </p>
 
 <div className="space-y-2 md:space-y-3">
 {tableOfContents.map((item, index) => (
 <motion.div
 key={item.number}
 initial={{ opacity: 0, x: -20 }}
 whileInView={{ opacity: 1, x: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.03 }}
 className="flex items-center justify-between p-2 md:p-4 rounded-xl bg-muted hover:bg-muted transition-colors cursor-pointer group border border-transparent hover:border-border"
 >
 <div className="flex items-center gap-4 md:gap-4">
 <span className="text-foreground font-mono font-bold text-sm md:text-base">{item.number}</span>
 <span className="font-semibold text-sm md:text-base text-foreground">{item.title}</span>
 </div>
 <span className="text-xs md:text-sm text-muted-foreground">p. {item.page}</span>
 </motion.div>
 ))}
 </div>
 </motion.div>
 
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: 0.2 }}
 >
 <div className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 border border-border sticky top-24">
 <h3 className="text-lg md:text-xl font-bold mb-4 text-foreground">What You'll Learn</h3>
 <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
 {keyPoints.map((point, index) => (
 <li key={index} className="flex items-start gap-2 md:gap-3">
 <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-foreground flex-shrink-0 mt-0.5" aria-hidden="true" weight="fill" />
 <span className="text-xs md:text-sm text-muted-foreground">{point}</span>
 </li>
 ))}
 </ul>
 
 <Button className="w-full h-11 md:h-12 bg-black text-white hover:bg-black/90 font-semibold rounded-xl gap-2">
 <Download className="w-5 h-5" aria-hidden="true" weight="bold" />
 Download Whitepaper
 </Button>
 </div>
 </motion.div>
 </div>
 </div>
 </section>
 
 {/* CTA Section */}
 <section className="py-12 md:py-16 lg:py-20 bg-black relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-20" aria-hidden="true" />
 <div className="container relative z-10">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="text-center max-w-2xl mx-auto"
 >
 <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-white">
 Ready to Learn More?
 </h2>
 <p className="text-sm md:text-base text-white/70 mb-6 md:mb-8">
 Have questions about our whitepaper or want to discuss partnership opportunities?
 </p>
 <div className="flex flex-col sm:flex-row gap-4 md:gap-4 justify-center">
 <Link href="/contact" className="block block">
 <Button className="h-11 md:h-12 px-6 md:px-8 bg-card text-foreground hover:bg-gray-100 font-semibold rounded-xl gap-2">
 Contact Us
 <ArrowRight className="w-5 h-5" aria-hidden="true" weight="bold" />
 </Button>
 </Link>
 <Link href="/about" className="block block">
 <Button variant="outline" className="h-11 md:h-12 px-6 md:px-8 bg-transparent text-white border-white/30 hover:bg-white/10 font-semibold rounded-xl">
 About Kahade
 </Button>
 </Link>
 </div>
 </motion.div>
 </div>
 </section>
 
 <Footer />
 </div>
 );
}
