import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { Check, ArrowRight } from '@phosphor-icons/react';
import { cn } from '@kahade/utils';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';
import { pricingPlans } from './HomeData';
import { SectionLabel } from '@kahade/ui';

export default function PricingSection() {
 const [isYearly, setIsYearly] = useState(false);

 return (
 <section className="section-padding-lg bg-background" id="pricing">
 <div className="container">
 {/* Heading */}
 <motion.div
 initial={{ opacity: 0, y: 24 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={viewport}
 className="section-header mb-10"
 >
 <SectionLabel>Harga</SectionLabel>
 <h2 className="section-title mb-4">Harga yang Jelas & Transparan</h2>
 <p className="text-muted-foreground text-lg">Tidak ada biaya tersembunyi. Selalu.</p>
 </motion.div>

 {/* Toggle */}
 <div className="flex justify-center mb-12">
 <div className="flex items-center gap-1 p-1.5 bg-muted rounded-full border border-border">
 <button
 onClick={() => setIsYearly(false)}
 className={cn(
 'px-5 py-2 rounded-full text-sm font-semibold transition-all',
 !isYearly ? 'bg-background text-foreground' : 'text-muted-foreground'
 )}
 >
 Bulanan
 </button>
 <button
 onClick={() => setIsYearly(true)}
 className={cn(
 'px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2',
 isYearly ? 'bg-background text-foreground' : 'text-muted-foreground'
 )}
 >
 Tahunan
 <span className="text-[0.625rem] font-bold bg-success text-white px-1.5 py-0.5 rounded-full">-20%</span>
 </button>
 </div>
 </div>

 {/* Pricing cards */}
 <motion.div
 variants={staggerContainer}
 initial="initial"
 whileInView="animate"
 viewport={viewport}
 className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start"
 >
 {pricingPlans.map((plan, i) => {
 const isPopular = i === 1;
 const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
 return (
 <motion.div
 key={plan.name}
 variants={staggerItem}
 className={cn(
 'relative rounded-2xl border-2 p-8 flex flex-col',
 isPopular
 ? 'border-primary bg-primary/5 scale-[1.03] '
 : 'border-border bg-background'
 )}
 >
 {isPopular && (
 <div className="absolute -top-4 left-1/2 -translate-x-1/2">
 <span className="badge badge-primary px-4 py-1.5 ">⭐ Paling Populer</span>
 </div>
 )}

 <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-3">{plan.name}</p>
 <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{plan.description}</p>

 {/* Price with animation */}
 <div className="mb-8">
 <AnimatePresence mode="wait">
 <motion.div
 key={isYearly ? 'yearly' : 'monthly'}
 initial={{ opacity: 0, y: -10 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: 10 }}
 transition={{ duration: 0.2 }}
 >
 {price === 0 ? (
 <p className="text-4xl font-black tracking-tight">Gratis</p>
 ) : (
 <div>
 <span className="text-lg font-semibold text-muted-foreground">Rp </span>
 <span className="text-4xl font-black tracking-tight">{price.toLocaleString('id-ID')}</span>
 <span className="text-sm text-muted-foreground">/bulan</span>
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>

 {/* Features */}
 <ul className="space-y-3 mb-8 flex-1">
 {plan.features.map((feature) => (
 <li key={feature} className="flex items-start gap-3 text-sm">
 <Check className="w-4 h-4 text-success shrink-0 mt-0.5" weight="bold" />
 <span>{feature}</span>
 </li>
 ))}
 </ul>

 {/* CTA */}
 <Link href={plan.monthlyPrice === 0 ? '/register' : plan.name === 'Enterprise' ? '/contact' : '/register'}>
 <button className={cn(
 'w-full flex items-center justify-center gap-2',
 isPopular ? 'btn-primary' : 'btn-secondary'
 )}>
 {plan.monthlyPrice === 0 ? 'Mulai Gratis' :
 plan.name === 'Enterprise' ? 'Hubungi Kami' : 'Coba 14 Hari Gratis'}
 <ArrowRight className="w-4 h-4" weight="bold" />
 </button>
 </Link>
 {isPopular && (
 <p className="text-xs text-muted-foreground text-center mt-3">Tidak butuh kartu kredit</p>
 )}
 </motion.div>
 );
 })}
 </motion.div>

 {/* Platform fee note */}
 <motion.p
 initial={{ opacity: 0 }}
 whileInView={{ opacity: 1 }}
 viewport={viewport}
 className="text-center text-sm text-muted-foreground mt-8"
 >
 Platform fee: <strong className="text-foreground">2.5% per transaksi</strong> (min. Rp 2.500, maks. Rp 250.000)
 </motion.p>

 {/* Social proof avatar stack */}
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={viewport}
 className="flex items-center gap-3 justify-center mt-6 text-sm text-muted-foreground"
 >
 <div className="flex -space-x-2">
 {['AR', 'SW', 'MB', 'DK', 'RT'].map((initials, i) => (
 <div
 key={i}
 className="w-8 h-8 rounded-full bg-neutral-300 border-2 border-background flex items-center justify-center text-xs font-bold text-neutral-600"
 >
 {initials}
 </div>
 ))}
 </div>
 <span>Dipercaya <strong className="text-foreground">8.000+</strong> pengguna aktif</span>
 </motion.div>
 </div>
 </section>
 );
}
