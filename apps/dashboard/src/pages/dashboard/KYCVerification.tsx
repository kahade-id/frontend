import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadSimple, Check, ArrowRight, ArrowLeft, CheckCircle, X } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Button } from '@kahade/ui';

const steps = ['Tipe ID', 'Upload Dokumen', 'Selfie', 'Info Tambahan', 'Review'];
const idTypes = [{ value: 'ktp', label: 'KTP', desc: 'Kartu Tanda Penduduk' }, { value: 'passport', label: 'Paspor', desc: 'Paspor Indonesia / Internasional' }, { value: 'sim', label: 'SIM', desc: 'Surat Izin Mengemudi' }];

function UploadZone({ label, tips }: { label: string; tips: string[] }) {
 const [file, setFile] = useState<string | null>(null);
 const [drag, setDrag] = useState(false);
 return (
 <div>
 <p className="text-sm font-medium mb-2">{label}</p>
 {file ? (
 <div className="border-2 border-green-500 bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 flex items-center gap-4">
 <CheckCircle size={32} className="text-green-600" weight="fill" />
 <div><p className="font-semibold text-green-700 dark:text-green-400">{file}</p><p className="text-xs text-muted-foreground">File diterima</p></div>
 <Button onClick={() => setFile(null)} className="ml-auto text-muted-foreground hover:text-destructive"><X size={18} /></Button>
 </div>
 ) : (
 <div
 onDrop={e => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files[0]?.name || null); }}
 onDragOver={e => { e.preventDefault(); setDrag(true); }}
 onDragLeave={() => setDrag(false)}
 className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary hover:bg-primary/5'}`}
 >
 <UploadSimple size={36} className="mx-auto mb-3 text-muted-foreground" weight="thin" />
 <p className="font-semibold text-sm mb-1">Drag & drop atau klik untuk pilih</p>
 <p className="text-xs text-muted-foreground mb-4">JPG, PNG, PDF · Maks 5MB</p>
 <div className="text-xs text-left bg-muted rounded-xl p-3 space-y-1">
 {tips.map((t, i) => (
 <p key={i} className={`flex items-center gap-2 ${t.startsWith('✗') ? 'text-red-500' : 'text-muted-foreground'}`}>{t}</p>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}

export default function KYCVerification() {
 const [step, setStep] = useState(0);
 const [idType, setIdType] = useState('ktp');
 const [address, setAddress] = useState('');
 const [purpose, setPurpose] = useState('');

 return (
 <DashboardLayout>
 <div className="p-6 max-w-2xl mx-auto">
 <h1 className="text-2xl font-bold mb-2">Verifikasi Identitas</h1>
 <p className="text-muted-foreground text-sm mb-8">Verifikasi diperlukan untuk transaksi tanpa batas</p>

 {/* Step indicator */}
 <div className="flex items-center gap-1 mb-8 overflow-x-auto no-scrollbar">
 {steps.map((s, i) => (
 <div key={s} className="flex items-center gap-1 flex-shrink-0">
 <div className="flex items-center gap-1.5">
 <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-all ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
 {i < step ? <Check size={12} weight="bold" /> : i + 1}
 </div>
 <span className={`text-xs font-medium hidden sm:block ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
 </div>
 {i < steps.length - 1 && <div className={`w-6 h-[2px] rounded-full mx-1 ${i < step ? 'bg-green-600' : 'bg-muted'}`} />}
 </div>
 ))}
 </div>

 <div className="card p-8">
 <AnimatePresence mode="wait">
 <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
 {step === 0 && (
 <div className="space-y-4">
 <h2 className="text-lg font-bold mb-4">Pilih Tipe Identitas</h2>
 {idTypes.map(t => (
 <Button key={t.value} type="button" onClick={() => setIdType(t.value)} className={`w-full text-left p-4 rounded-xl border-2 transition-all ${idType === t.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
 <div className="flex items-center gap-3">
 <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${idType === t.value ? 'border-primary' : 'border-border'}`}>
 {idType === t.value && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
 </div>
 <div>
 <p className="font-semibold text-sm">{t.label}</p>
 <p className="text-xs text-muted-foreground">{t.desc}</p>
 </div>
 </div>
 </Button>
 ))}
 </div>
 )}
 {step === 1 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-4">Upload Dokumen</h2>
 <UploadZone label="Foto KTP (Depan)" tips={['✓ Pastikan semua teks terbaca jelas', '✓ Pencahayaan cukup', '✓ Tidak ada pantulan atau bayangan', '✗ Foto tidak buram atau terpotong']} />
 {idType === 'ktp' && (
 <UploadZone label="Foto KTP (Belakang)" tips={['✓ Semua teks terbaca', '✓ Tidak ada pantulan', '✗ Tidak terpotong']} />
 )}
 </div>
 )}
 {step === 2 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-4">Foto Selfie</h2>
 <p className="text-sm text-muted-foreground">Foto selfie memegang KTP Anda agar kami bisa memverifikasi identitas.</p>
 <UploadZone label="Selfie dengan ID" tips={['✓ Wajah terlihat jelas', '✓ KTP terbaca', '✓ Pencahayaan cukup', '✗ Tidak menggunakan kacamata hitam atau masker']} />
 </div>
 )}
 {step === 3 && (
 <div className="space-y-5">
 <h2 className="text-lg font-bold mb-4">Informasi Tambahan</h2>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Alamat sesuai KTP</label>
 <textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="Jl. Contoh No. 1, Kota, Provinsi" className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm resize-none" />
 </div>
 <div>
 <label className="text-sm font-medium mb-1.5 block">Tujuan Penggunaan</label>
 <select value={purpose} onChange={e => setPurpose(e.target.value)} className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm appearance-none">
 <option value="">Pilih tujuan...</option>
 <option>Transaksi personal</option>
 <option>Bisnis UMKM</option>
 <option>Freelance</option>
 <option>Investasi</option>
 </select>
 </div>
 </div>
 )}
 {step === 4 && (
 <div className="space-y-4">
 <h2 className="text-lg font-bold mb-4">Review & Submit</h2>
 <div className="bg-muted/50 rounded-2xl p-5 space-y-3 text-sm">
 {[['Tipe ID', idTypes.find(t => t.value === idType)?.label || '—'], ['Dokumen', 'Diupload ✓'], ['Selfie', 'Diupload ✓'], ['Alamat', address || '—'], ['Tujuan', purpose || '—']].map(([label, val]) => (
 <div key={label} className="flex justify-between">
 <span className="text-muted-foreground">{label}</span>
 <span className="font-medium">{val}</span>
 </div>
 ))}
 </div>
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
 ℹ Proses verifikasi memakan waktu 24–48 jam. Kami akan mengirimkan notifikasi ke email Anda.
 </div>
 </div>
 )}
 </motion.div>
 </AnimatePresence>

 <div className={`flex gap-3 mt-8 ${step > 0 ? '' : 'justify-end'}`}>
 {step > 0 && <Button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1"><ArrowLeft size={16} /> Kembali</Button>}
 <Button onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : null} className="btn-primary flex-1">
 {step === steps.length - 1 ? 'Kirim Verifikasi' : 'Lanjut'} {step < steps.length - 1 && <ArrowRight size={16} />}
 </Button>
 </div>
 </div>
 </div>
 </DashboardLayout>
 );
}
