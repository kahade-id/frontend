import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@kahade/utils';
import { steps } from './HomeData';
import { SectionLabel } from '@kahade/ui';

interface StepPreviewProps {
 step: number;
}

function StepPreview({ step }: StepPreviewProps) {
 const stepPreviews: Record<number, React.ReactNode> = {
 0: (
 <div className="space-y-3">
 <div className="h-9 bg-muted rounded-lg animate-pulse" />
 <div className="h-9 bg-muted rounded-lg animate-pulse" />
 <div className="flex gap-2">
 <div className="h-9 bg-muted rounded-lg animate-pulse flex-1" />
 <div className="h-9 bg-primary/10 rounded-lg w-24" />
 </div>
 <p className="text-xs text-muted-foreground text-center pt-2">Form buat transaksi — nama, nilai, durasi</p>
 </div>
 ),
 1: (
 <div className="bg-muted rounded-xl p-4 space-y-2">
 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Virtual Account BCA</p>
 <p className="font-mono text-lg font-bold tracking-widest">8277-XXXX-XXXX-0001</p>
 <p className="text-xs text-muted-foreground">Nominal: <strong>Rp 5.200.000</strong></p>
 <div className="flex items-center gap-2 text-xs text-warning">
 <span>⏰</span><span>Berlaku 2 jam</span>
 </div>
 </div>
 ),
 2: (
 <div className="space-y-2">
 {['Transaksi dibuat', 'Dana disimpan', 'Penjual dikonfirmasi'].map((label, i) => (
 <div key={i} className="flex items-center gap-3">
 <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
 <span className="text-white text-xs">✓</span>
 </div>
 <span className="text-sm">{label}</span>
 </div>
 ))}
 <div className="flex items-center gap-3">
 <div className="w-6 h-6 rounded-full bg-primary animate-pulse flex items-center justify-center">
 <span className="text-white text-xs">●</span>
 </div>
 <span className="text-sm font-semibold text-primary">Menunggu konfirmasi</span>
 </div>
 </div>
 ),
 3: (
 <div className="text-center space-y-4">
 <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
 <span className="text-3xl">📦</span>
 </div>
 <p className="text-sm text-muted-foreground">Barang sudah diterima?</p>
 <button className="btn-primary w-full">✓ Konfirmasi Terima Barang</button>
 </div>
 ),
 4: (
 <div className="text-center space-y-3">
 <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto">
 <span className="text-white text-2xl">✓</span>
 </div>
 <p className="font-bold text-success">Transaksi Selesai!</p>
 <p className="text-sm text-muted-foreground">
 Dana <strong>Rp 5.070.000</strong> telah dikirim ke penjual.
 </p>
 </div>
 ),
 };

 return (
 <div className="min-h-[160px] flex flex-col justify-center">
 {stepPreviews[step] ?? (
 <div className="text-center text-sm text-muted-foreground">Preview untuk langkah {step + 1}</div>
 )}
 </div>
 );
}

export default function HowItWorksSection() {
 const [activeStep, setActiveStep] = useState(0);
 // FIX (v3.3): pause-on-hover
 const [isPaused, setIsPaused] = useState(false);

 useEffect(() => {
 if (isPaused) return;
 const timer = setInterval(() => {
 setActiveStep(prev => (prev + 1) % steps.length);
 }, 4000);
 return () => clearInterval(timer);
 }, [isPaused]);

 return (
 <section
 className="section-padding-lg bg-muted"
 id="how-it-works"
 onMouseEnter={() => setIsPaused(true)}
 onMouseLeave={() => setIsPaused(false)}
 >
 <div className="container">
 {/* Heading */}
 <div className="section-header mb-12">
 <SectionLabel variant="light">Cara Kerja</SectionLabel>
 <h2 className="section-title">5 langkah transaksi aman</h2>
 </div>

 {/* Step tabs — FIX: role="tablist" + ARIA */}
 <div
 role="tablist"
 aria-label="Langkah-langkah proses"
 className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar"
 >
 {steps.map((step, i) => (
 <button
 key={step.step}
 role="tab"
 aria-selected={activeStep === i}
 aria-controls={`step-panel-${i}`}
 id={`step-tab-${i}`}
 onClick={() => setActiveStep(i)}
 className={cn(
 'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold',
 'whitespace-nowrap transition-all duration-200 shrink-0',
 activeStep === i
 ? 'bg-primary text-primary-foreground '
 : 'bg-background text-muted-foreground hover:text-foreground hover:bg-neutral-100'
 )}
 >
 <span className={cn(
 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
 activeStep === i ? 'bg-primary-foreground/20' : 'bg-muted'
 )}>
 {i + 1}
 </span>
 {step.title}
 </button>
 ))}
 </div>

 {/* Progress bar — FIX: scaleX (GPU-composited) */}
 <div className="h-1 bg-border rounded-full mb-10 overflow-hidden">
 <motion.div
 className="h-full bg-primary rounded-full origin-left"
 animate={{ scaleX: (activeStep + 1) / steps.length }}
 transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
 style={{ transformOrigin: 'left center', willChange: 'transform' }}
 />
 </div>

 {/* Step content */}
 <AnimatePresence mode="wait">
 <motion.div
 key={activeStep}
 initial={{ opacity: 0, y: 16 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -16 }}
 transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
 className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center"
 >
 {/* Left: step detail */}
 <div
 role="tabpanel"
 id={`step-panel-${activeStep}`}
 aria-labelledby={`step-tab-${activeStep}`}
 >
 <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-3 block">
 Langkah {activeStep + 1} dari {steps.length}
 </span>
 <h3 className="text-3xl font-bold mb-4 tracking-tight">{steps[activeStep].title}</h3>
 <p className="text-lg text-muted-foreground leading-relaxed mb-8">
 {steps[activeStep].description}
 </p>
 <div className="flex gap-3">
 <button
 onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
 disabled={activeStep === 0}
 className="btn-secondary btn-sm disabled:opacity-40"
 >
 ← Sebelumnya
 </button>
 <button
 onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
 disabled={activeStep === steps.length - 1}
 className="btn-primary btn-sm disabled:opacity-40"
 >
 Selanjutnya →
 </button>
 </div>
 </div>

 {/* Right: preview */}
 <div className="card p-6 md:p-8 bg-background border-2 border-border">
 <div className="flex items-center gap-3 mb-6">
 {(() => {
 const StepIcon = steps[activeStep].icon;
 return (
 <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center ">
 <StepIcon weight="bold" className="w-6 h-6 text-primary-foreground" />
 </div>
 );
 })()}
 <div>
 <p className="font-bold">{steps[activeStep].title}</p>
 <p className="text-xs text-muted-foreground">Preview interaksi</p>
 </div>
 </div>
 <StepPreview step={activeStep} />
 </div>
 </motion.div>
 </AnimatePresence>
 </div>
 </section>
 );
}
