import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowLeft, ArrowRight, UploadSimple, X } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Button } from '@kahade/ui';

const steps = ['Detail', 'Pihak Lawan', 'Lampiran', 'Konfirmasi'];

function fee(val: number) { return Math.round(val * 0.025); }
function fmt(n: number) { return new Intl.NumberFormat('id-ID').format(n); }

export default function CreateTransaction() {
 const [step, setStep] = useState(0);
 const [drag, setDrag] = useState(false);
 const [files, setFiles] = useState<string[]>([]);
 const [data, setData] = useState({ title: '', desc: '', amount: 5000000, days: 7, feeSplit: 'seller', counterEmail: '', note: '' });

 const update = (k: string, v: any) => setData(p => ({ ...p, [k]: v }));

 return (
 <DashboardLayout>
 <div className="p-6 max-w-3xl mx-auto">
 <h1 className="text-2xl font-bold mb-2">Buat Transaksi Baru</h1>
 <p className="text-muted-foreground text-sm mb-8">Lengkapi detail transaksi escrow Anda</p>

 {/* Step indicator */}
 <div className="flex items-center gap-1 mb-8">
 {steps.map((s, i) => (
 <div key={s} className="flex items-center gap-1 flex-1">
 <div className={`flex items-center gap-1.5 text-xs font-medium ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
 <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-all ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
 {i < step ? <Check size={13} weight="bold" /> : i + 1}
 </div>
 <span className="hidden sm:block">{s}</span>
 </div>
 {i < steps.length - 1 && <div className={`flex-1 h-[2px] rounded-full mx-1 ${i < step ? 'bg-green-600' : 'bg-muted'}`} />}
 </div>
 ))}
 </div>

 <div className="card p-8">
 <AnimatePresence mode="wait">
 <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

 {step === 0 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-6">Detail Transaksi</h2>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Nama Produk / Jasa</label>
 <input type="text" placeholder="cth: Laptop ASUS ROG" value={data.title} onChange={e => update('title', e.target.value)} className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Deskripsi</label>
 <textarea rows={3} placeholder="Deskripsi detail produk/jasa..." value={data.desc} onChange={e => update('desc', e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm resize-none" />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Nilai Transaksi</label>
 <div className="relative">
 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
 <input type="number" value={data.amount} onChange={e => update('amount', Number(e.target.value))} className="w-full h-12 pl-10 pr-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
 </div>
 {data.amount > 0 && <p className="text-xs text-muted-foreground mt-1">Biaya platform: Rp {fmt(fee(data.amount))}</p>}
 </div>
 <div>
 <label className="text-sm font-medium mb-3 block">Durasi Escrow: <span className="text-primary font-bold">{data.days} hari</span></label>
 <input type="range" min={1} max={30} value={data.days} onChange={e => update('days', Number(e.target.value))} className="w-full accent-primary" />
 <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>1 hari</span><span>30 hari</span></div>
 </div>
 <div>
 <label className="text-sm font-medium mb-3 block">Siapa yang menanggung biaya?</label>
 <div className="grid grid-cols-3 gap-3">
 {[['seller', 'Penjual'], ['buyer', 'Pembeli'], ['split', 'Dibagi']].map(([val, label]) => (
 <Button key={val} type="button" onClick={() => update('feeSplit', val)} className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${data.feeSplit === val ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>{label}</Button>
 ))}
 </div>
 </div>
 </div>
 )}

 {step === 1 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-6">Pihak Lawan Transaksi</h2>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Email atau Username</label>
 <input type="email" placeholder="penjual@email.com" value={data.counterEmail} onChange={e => update('counterEmail', e.target.value)} className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
 <p className="text-xs text-muted-foreground mt-1">Mereka akan menerima undangan via email</p>
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Catatan (opsional)</label>
 <textarea rows={4} placeholder="Pesan untuk pihak lawan..." value={data.note} onChange={e => update('note', e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm resize-none" />
 </div>
 </div>
 )}

 {step === 2 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-6">Lampiran (Opsional)</h2>
 <div
 onDrop={e => { e.preventDefault(); setDrag(false); const f = Array.from(e.dataTransfer.files).map(f => f.name); setFiles(p => [...p, ...f]); }}
 onDragOver={e => { e.preventDefault(); setDrag(true); }}
 onDragLeave={() => setDrag(false)}
 className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'}`}
 >
 <UploadSimple size={40} className="mx-auto mb-4 text-muted-foreground" weight="thin" />
 <p className="font-semibold mb-1">Drag & drop file di sini</p>
 <p className="text-sm text-muted-foreground mb-4">PNG, JPG, PDF hingga 10MB</p>
 <Button type="button"  variant="secondary" className="text-sm px-4 py-2">Pilih dari perangkat</Button>
 </div>
 {files.length > 0 && (
 <div className="space-y-2">
 {files.map((f, i) => (
 <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl text-sm">
 <span>{f}</span>
 <Button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors"><X size={16} /></Button>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {step === 3 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-6">Review & Konfirmasi</h2>
 <div className="bg-muted/50 rounded-2xl p-5 space-y-3 text-sm">
 {[['Produk/Jasa', data.title || '—'], ['Nilai Transaksi', `Rp ${fmt(data.amount)}`], ['Biaya Platform (2.5%)', `Rp ${fmt(fee(data.amount))}`], ['Durasi', `${data.days} hari`], ['Pihak Lawan', data.counterEmail || '—']].map(([label, val]) => (
 <div key={label} className="flex justify-between">
 <span className="text-muted-foreground">{label}</span>
 <span className="font-semibold">{val}</span>
 </div>
 ))}
 <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
 <span>Total Pembayaran</span>
 <span className="text-primary">Rp {fmt(data.amount + fee(data.amount))}</span>
 </div>
 </div>
 <p className="text-xs text-muted-foreground">Dengan membuat transaksi, Anda menyetujui Syarat & Ketentuan Kahade.</p>
 </div>
 )}
 </motion.div>
 </AnimatePresence>

 <div className={`flex gap-3 mt-8 ${step > 0 ? '' : 'justify-end'}`}>
 {step > 0 && <Button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1"><ArrowLeft size={16} /> Kembali</Button>}
 <Button onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : null} className="btn-primary flex-1">
 {step === steps.length - 1 ? 'Buat Transaksi' : 'Lanjut'} {step < steps.length - 1 && <ArrowRight size={16} />}
 </Button>
 </div>
 </div>
 </div>
 </DashboardLayout>
 );
}
