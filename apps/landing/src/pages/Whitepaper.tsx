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
import { PageHero } from '../components/common/PageHero';
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
 { icon: Globe, stat: '$2.5T', label: 'Global P2P Market (est.)', description: 'External market benchmark for long-term opportunity mapping' },
 { icon: Shield, stat: '99.9%', label: 'Target System Reliability', description: 'Reliability target based on infrastructure and monitoring design' },
 { icon: Users, stat: '10M+', label: 'Long-term User Target', description: 'Growth projection presented as scenario planning, not guarantee' },
 { icon: ChartLine, stat: '40%', label: 'YoY Growth Scenario', description: 'Modeling assumption for strategic planning in the whitepaper' },
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
 <PageHero eyebrow="Whitepaper" title="Kahade Whitepaper" description="Gambaran strategi, arsitektur teknologi, dan visi jangka panjang Kahade membangun trust infrastructure." chips={[{ label: 'v2.0' }, { label: '42 Pages' }, { label: 'Updated Jan 2026' } ]} />
 
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
 className="flex items-center justify-between p-2 md:p-4 rounded-xl bg-muted hover:bg-muted transition-colors group border border-transparent hover:border-border"
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
 
 <a href="/files/kahade-whitepaper.pdf" className="w-full h-11 md:h-12 bg-black text-white hover:bg-black/90 font-semibold rounded-xl gap-2 inline-flex items-center justify-center">
 <Download className="w-5 h-5" aria-hidden="true" weight="bold" />
 Download Whitepaper
 </a>
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
 <Link href="/contact" className="block">
 <Button className="h-11 md:h-12 px-6 md:px-8 bg-card text-foreground hover:bg-gray-100 font-semibold rounded-xl gap-2">
 Contact Us
 <ArrowRight className="w-5 h-5" aria-hidden="true" weight="bold" />
 </Button>
 </Link>
 <Link href="/about" className="block">
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