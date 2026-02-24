import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, ArrowRight, Question } from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';

const plans = [
 {
 name: 'Pemula',
 monthlyPrice: 0,
 yearlyPrice: 0,
 description: 'Untuk individu yang baru mencoba escrow.',
 cta: 'Mulai Gratis',
 popular: false,
 features: [
 { text: '5 transaksi/bulan', included: true },
 { text: 'Biaya platform 2.5%', included: true },
 { text: 'Virtual account & QRIS', included: true },
 { text: 'Support email', included: true },
 { text: 'Dukungan prioritas', included: false },
 { text: 'Akses API', included: false },
 { text: 'Branding kustom', included: false },
 ],
 },
 {
 name: 'Profesional',
 monthlyPrice: 99000,
 yearlyPrice: 79000,
 description: 'Untuk UMKM dan freelancer aktif.',
 cta: 'Mulai Sekarang',
 popular: true,
 features: [
 { text: 'Transaksi tidak terbatas', included: true },
 { text: 'Biaya platform 2.5%', included: true },
 { text: 'Semua metode pembayaran', included: true },
 { text: 'Dukungan prioritas 24/7', included: true },
 { text: 'Akses API penuh', included: true },
 { text: 'Branding kustom', included: true },
 { text: 'SLA 99.9%', included: false },
 ],
 },
 {
 name: 'Enterprise',
 monthlyPrice: null,
 yearlyPrice: null,
 description: 'Untuk perusahaan dengan volume tinggi.',
 cta: 'Hubungi Sales',
 popular: false,
 features: [
 { text: 'Volume tidak terbatas', included: true },
 { text: 'Biaya custom (negosiasi)', included: true },
 { text: 'Semua metode pembayaran', included: true },
 { text: 'Dukungan dedicated 24/7', included: true },
 { text: 'Akses API + webhook', included: true },
 { text: 'White-label tersedia', included: true },
 { text: 'SLA 99.9% + manajer akun', included: true },
 ],
 },
];

const comparisonFeatures = [
 { feature: 'Transaksi/bulan', pemula: '5', profesional: 'Tidak terbatas', enterprise: 'Tidak terbatas' },
 { feature: 'Biaya platform', pemula: '2.5%', profesional: '2.5%', enterprise: 'Custom' },
 { feature: 'Dukungan prioritas', pemula: false, profesional: true, enterprise: true },
 { feature: 'Akses API', pemula: false, profesional: true, enterprise: true },
 { feature: 'Branding kustom', pemula: false, profesional: true, enterprise: true },
 { feature: 'SLA 99.9%', pemula: false, profesional: false, enterprise: true },
 { feature: 'Manajer akun', pemula: false, profesional: false, enterprise: true },
];

const pricingFaqs = [
 { q: 'Apakah ada uji coba gratis?', a: 'Ya! Paket Pemula sepenuhnya gratis dan tidak memerlukan kartu kredit. Anda bisa mencoba Kahade tanpa risiko.' },
 { q: 'Bisakah saya ganti paket kapan saja?', a: 'Tentu. Anda bisa upgrade atau downgrade paket kapan saja. Perubahan berlaku di awal periode billing berikutnya.' },
 { q: 'Apakah biaya 2.5% bisa dinegosiasi?', a: 'Untuk paket Enterprise dengan volume tinggi, biaya platform bisa dinegosiasikan. Hubungi tim sales kami.' },
 { q: 'Apa yang terjadi jika melebihi batas transaksi?', a: 'Di paket Pemula, Anda akan diminta upgrade ke Profesional. Tidak ada biaya tambahan yang mengejutkan.' },
];

function formatRupiah(num: number) {
 return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

export default function Pricing() {
 const [isYearly, setIsYearly] = useState(false);
 const [txValue, setTxValue] = useState(5000000);
 const [openFaq, setOpenFaq] = useState<number | null>(null);

 const fee = txValue * 0.025;
 const net = txValue - fee;

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-primary text-primary-foreground pt-24 pb-20 overflow-hidden">
 <div className="container text-center">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.h1 variants={staggerItem} className="text-4xl md:text-6xl font-bold mb-4">
 Harga yang Jelas.<br />
 <span className="text-white/60">Tidak Ada Kejutan.</span>
 </motion.h1>
 <motion.p variants={staggerItem} className="text-primary-foreground/70 text-lg mb-10">
 Mulai gratis, lalu upgrade saat volume transaksi bertumbuh.
 </motion.p>
 <motion.div variants={staggerItem} className="inline-flex items-center gap-1 bg-white/10 rounded-full p-1">
 <button
 onClick={() => setIsYearly(false)}
 className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!isYearly ? 'bg-white text-primary' : 'text-white/70'}`}
 >
 Bulanan
 </button>
 <button
 onClick={() => setIsYearly(true)}
 className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isYearly ? 'bg-white text-primary' : 'text-white/70'}`}
 >
 Tahunan
 <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">-20%</span>
 </button>
 </motion.div>
 </motion.div>
 </div>
 </section>

 {/* PRICING CARDS */}
 <section className="section-padding-lg">
 <div className="container">
 <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
 {plans.map((plan) => {
 const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
 return (
 <div key={plan.name} className={`card p-8 relative flex flex-col ${plan.popular ? 'border-primary ring-1 ring-primary/15' : ''}`}>
 {plan.popular && (
 <div className="absolute -top-3 left-1/2 -translate-x-1/2">
 <span className="badge badge-primary text-xs px-3">Paling Populer</span>
 </div>
 )}
 <div className="mb-6">
 <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
 <p className="text-sm text-muted-foreground">{plan.description}</p>
 </div>
 <div className="mb-6">
 <AnimatePresence mode="wait">
 <motion.div key={isYearly ? 'yearly' : 'monthly'} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
 {price === null ? (
 <div className="text-3xl font-bold">Custom</div>
 ) : price === 0 ? (
 <div className="text-3xl font-bold">Gratis</div>
 ) : (
 <div>
 <span className="text-3xl font-bold">{formatRupiah(price)}</span>
 <span className="text-sm text-muted-foreground">/bulan</span>
 {isYearly && <div className="text-xs text-green-600 mt-1">Hemat {formatRupiah((plan.monthlyPrice! - price) * 12)}/tahun</div>}
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 <div className="space-y-3 mb-8 flex-1">
 {plan.features.map((f) => (
 <div key={f.text} className="flex items-center gap-3">
 {f.included
 ? <CheckCircle size={18} className="text-green-600 shrink-0" weight="fill" />
 : <X size={18} className="text-muted-foreground/40 shrink-0" />
 }
 <span className={`text-sm ${f.included ? '' : 'text-muted-foreground/60'}`}>{f.text}</span>
 </div>
 ))}
 </div>
 <Link href={plan.name === 'Enterprise' ? '/contact' : '/register'} className={`w-full py-3 rounded-xl font-semibold text-sm transition-all inline-flex items-center justify-center ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}>
 {plan.cta}
 </Link>
 </div>
 );
 })}
 </div>
 </div>
 </section>

 {/* CALCULATOR */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <div className="bg-background rounded-3xl p-8 md:p-12 border border-border ">
 <div className="grid md:grid-cols-2 gap-12 items-center">
 <div>
 <h2 className="text-2xl font-bold mb-6">Kalkulator Biaya</h2>
 <div className="mb-6">
 <label className="text-sm font-medium mb-2 block">Nilai Transaksi</label>
 <input
 type="range" min={500000} max={100000000} step={500000}
 value={txValue} onChange={e => setTxValue(Number(e.target.value))}
 className="w-full accent-primary"
 />
 <div className="flex justify-between text-xs text-muted-foreground mt-1">
 <span>Rp 500K</span><span>{formatRupiah(txValue)}</span><span>Rp 100M</span>
 </div>
 </div>
 <div className="bg-muted rounded-xl px-4 py-3">
 <input
 type="number" value={txValue} onChange={e => setTxValue(Number(e.target.value))}
 className="w-full bg-transparent text-lg font-semibold focus:outline-none"
 />
 </div>
 </div>
 <div className="space-y-4">
 <div className="flex justify-between py-3 border-b border-border text-sm">
 <span className="text-muted-foreground">Nilai transaksi</span>
 <span className="font-semibold">{formatRupiah(txValue)}</span>
 </div>
 <div className="flex justify-between py-3 border-b border-border text-sm">
 <span className="text-muted-foreground">Biaya platform (2.5%)</span>
 <span className="font-semibold text-red-600">- {formatRupiah(fee)}</span>
 </div>
 <div className="flex justify-between py-3 text-sm font-bold">
 <span>Total diterima penjual</span>
 <span className="text-green-600">{formatRupiah(net)}</span>
 </div>
 <a href="https://app.kahade.id/register" className="btn-primary w-full mt-2 inline-flex items-center justify-center">
 Mulai Transaksi <ArrowRight size={16} />
 </a>
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 </section>

 {/* COMPARISON TABLE */}
 <section className="section-padding-lg">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
 <h2 className="text-3xl font-bold text-center mb-10">Perbandingan Fitur</h2>
 <div className="overflow-x-auto rounded-2xl">
 <div className="border border-border rounded-2xl overflow-hidden min-w-[480px]">
 <div className="grid grid-cols-4 bg-muted/50">
 <div className="p-4 font-medium text-sm">Fitur</div>
 {['Pemula', 'Profesional', 'Enterprise'].map(p => (
 <div key={p} className={`p-4 font-bold text-sm text-center ${p === 'Profesional' ? 'bg-primary/5 border-x border-primary/20 text-primary' : ''}`}>{p}</div>
 ))}
 </div>
 {comparisonFeatures.map((row, i) => (
 <div key={i} className={`grid grid-cols-4 border-t border-border ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
 <div className="p-4 text-sm text-muted-foreground">{row.feature}</div>
 {[row.pemula, row.profesional, row.enterprise].map((val, j) => (
 <div key={j} className={`p-4 text-sm text-center ${j === 1 ? 'bg-primary/5 border-x border-primary/20' : ''}`}>
 {typeof val === 'boolean'
 ? val ? <CheckCircle size={18} className="text-green-600 mx-auto" weight="fill" /> : <X size={18} className="text-muted-foreground/40 mx-auto" />
 : val
 }
 </div>
 ))}
 </div>
 ))}
 </div>
 </div>
 </motion.div>
 </div>
 </section>

 {/* PRICING FAQ */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container">
 <h2 className="text-3xl font-bold text-center mb-10">Pertanyaan Harga</h2>
 <div className="space-y-2">
 {pricingFaqs.map((faq, i) => (
 <div key={i} className="border border-border rounded-xl overflow-hidden bg-background">
 <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full text-left p-5 flex items-center justify-between gap-4 hover:text-primary transition-colors">
 <span className="font-semibold text-sm">{faq.q}</span>
 <Question size={18} className={`shrink-0 transition-transform ${openFaq === i ? 'rotate-45' : ''}`} />
 </button>
 <AnimatePresence>
 {openFaq === i && (
 <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
 <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* ENTERPRISE CTA */}
 <section className="section-padding-md bg-primary text-primary-foreground">
 <div className="container text-center max-w-2xl mx-auto">
 <h2 className="text-3xl font-bold mb-4">Butuh solusi enterprise?</h2>
 <p className="text-primary-foreground/70 mb-8">Volume besar, kebutuhan kustom, SLA ketat? Kami punya solusinya. Hubungi tim sales kami sekarang.</p>
 <Link href="/contact">
 <button className="bg-white text-primary font-semibold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-colors inline-flex items-center gap-2">
 Hubungi Sales <ArrowRight size={18} />
 </button>
 </Link>
 </div>
 </section>

 <Footer />
 </div>
 );
}