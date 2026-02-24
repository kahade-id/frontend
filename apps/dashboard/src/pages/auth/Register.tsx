import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeSlash, GoogleLogo, ArrowLeft, ArrowRight,
  Check, ShieldCheck, Star, Lightning, Clock
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import { staggerContainer, staggerItem } from '@kahade/utils';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const steps = ['Info Dasar', 'Kontak', 'Verifikasi'];

const preferences = ['Membeli dari marketplace', 'Menjual produk', 'Jasa freelance', 'Keperluan bisnis'];

interface FormData {
  name: string;
  email: string;
  password: string;
  phone: string;
  referralCode: string;
  prefs: string[];
}

interface StepContentProps {
  step: number;
  data: FormData;
  onChange: (key: keyof FormData, val: any) => void;
}

function StepContent({ step, data, onChange }: StepContentProps) {
  const [showPwd, setShowPwd] = useState(false);

  if (step === 0) return (
    <div className="space-y-4">
      <div>
        <label htmlFor="full-name" className="text-sm font-medium mb-1.5 block">Nama Lengkap</label>
        <input type="text" required placeholder="Ahmad Rizki" value={data.name} onChange={e => onChange('name', e.target.value)}
          className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</label>
        <input id="email" type="email" required placeholder="email@contoh.com" value={data.email} onChange={e => onChange('email', e.target.value)}
          className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</label>
        <div className="relative">
          <input id="new-password" type={showPwd ? 'text' : 'password'} required minLength={8} placeholder="Min. 8 karakter" value={data.password} onChange={e => onChange('password', e.target.value)}
            className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
          <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            {showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Minimal 8 karakter, harus ada huruf besar, kecil, dan angka.</p>
      </div>
    </div>
  );

  if (step === 1) return (
    <div className="space-y-4">
      <div>
        <label htmlFor="phone" className="text-sm font-medium mb-1.5 block">Nomor HP <span className="text-muted-foreground font-normal">(opsional)</span></label>
        <input id="phone" type="tel" placeholder="+62 812-XXXX-XXXX" value={data.phone} onChange={e => onChange('phone', e.target.value)}
          className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
      </div>
      <div>
        <label htmlFor="referral-code" className="text-sm font-medium mb-1.5 block">Kode Referral <span className="text-muted-foreground font-normal">(opsional)</span></label>
        <input type="text" placeholder="Kode referral" value={data.referralCode} onChange={e => onChange('referralCode', e.target.value)}
          className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
      </div>
    </div>
  );

  if (step === 2) return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
        <Check size={32} className="text-green-600" weight="bold" />
      </div>
      <div>
        <p className="font-semibold mb-2 text-lg">Hampir Selesai!</p>
        <p className="text-sm text-muted-foreground">
          Kami telah mengirimkan email verifikasi ke <strong>{data.email}</strong>. 
          Periksa inbox Anda dan klik tautan verifikasi untuk mengaktifkan akun.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">(Juga cek folder spam)</p>
    </div>
  );

  return null;
}

export default function Register() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<FormData>({
    name: '', email: '', password: '', phone: '', referralCode: '', prefs: [],
  });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { register } = useAuth();

  const updateData = (key: keyof FormData, val: any) => setData(prev => ({ ...prev, [key]: val }));

  const validateStep = (): boolean => {
    if (currentStep === 0) {
      if (!data.name.trim()) { toast.error('Nama lengkap wajib diisi'); return false; }
      if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { toast.error('Email tidak valid'); return false; }
      if (data.password.length < 8) { toast.error('Password minimal 8 karakter'); return false; }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
        toast.error('Password harus mengandung huruf besar, kecil, dan angka');
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    
    if (currentStep === steps.length - 2) {
      // Submit registration on last input step
      setLoading(true);
      try {
        await register({
          email: data.email,
          username: data.name.toLowerCase().replace(/\s+/g, '_'),
          password: data.password,
          phone: data.phone || undefined,
          referralCode: data.referralCode || undefined,
        });
        setCurrentStep(s => s + 1);
        setRegistered(true);
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Pendaftaran gagal. Email mungkin sudah digunakan.';
        toast.error('Gagal mendaftar', { description: msg });
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-[0.45fr_0.55fr] overflow-x-hidden">
      {/* LEFT — Form */}
      <div className="bg-background px-5 md:px-14 py-12 flex flex-col justify-center overflow-x-hidden">
        <div className="max-w-sm mx-auto w-full">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-10 transition-colors">
              <ArrowLeft size={16} /> kahade.id
            </button>
          </Link>

          <h1 className="text-3xl font-bold mb-1">Buat Akun</h1>
          <h1 className="text-3xl font-bold text-muted-foreground mb-8">Gratis</h1>

          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} />
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-8">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${i <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < currentStep ? 'bg-green-600 text-white' : i === currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {i < currentStep ? <Check size={12} weight="bold" /> : i + 1}
                  </div>
                  <span className="hidden sm:block">{step}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-[2px] rounded-full transition-colors duration-500 mx-1 ${i < currentStep ? 'bg-green-600' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <StepContent step={currentStep} data={data} onChange={updateData} />
            </motion.div>
          </AnimatePresence>

          {!registered && (
            <div className={`flex gap-3 mt-6 ${currentStep > 0 ? 'flex-row' : 'flex-col'}`}>
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(s => s - 1)} className="btn-secondary flex-1">
                  <ArrowLeft size={16} /> Kembali
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={loading}
                className="btn-primary flex-1 w-full"
              >
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses...
                  </span>
                ) : currentStep === steps.length - 2 ? (
                  <span className="flex items-center gap-2 justify-center">Daftar Sekarang <ArrowRight size={16} /></span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">Lanjut <ArrowRight size={16} /></span>
                )}
              </button>
            </div>
          )}

          {registered && (
            <div className="mt-6">
              <Link href="/login" className="btn-primary w-full inline-flex justify-center">Pergi ke Login</Link>
            </div>
          )}

          {currentStep === 0 && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">Atau</span><div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-border rounded-xl text-sm font-semibold hover:bg-muted transition-all">
                  <GoogleLogo size={20} /> Lanjutkan dengan Google
                </button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-muted-foreground mt-5">
            Sudah punya akun?{' '}
            <Link href="/login" className="font-semibold text-foreground hover:text-primary transition-colors">Masuk</Link>
          </p>
        </div>
      </div>

      {/* RIGHT */}
      <div className="hidden md:flex bg-primary text-primary-foreground flex-col justify-center px-14 py-12">
        <div className="max-w-md">
          <div className="text-3xl font-black mb-2">KAHADE</div>
          <p className="text-primary-foreground/60 text-sm mb-12">Platform Escrow Terpercaya Indonesia</p>
          <blockquote className="text-xl font-semibold leading-relaxed mb-8">
            "Daftar gratis dan mulai transaksi aman dalam 5 menit."
          </blockquote>
          <div className="flex items-center gap-4 mb-12 pb-12 border-b border-white/10">
            <div className="flex -space-x-2">
              {['A','B','C','D','E'].map((l, i) => (
                <div key={i} className="w-9 h-9 rounded-full bg-white/20 border-2 border-primary flex items-center justify-center text-xs font-bold">{l}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} weight="fill" className="text-yellow-400" />)}
              </div>
              <p className="text-xs text-primary-foreground/60">4.9/5 · 10.000+ pengguna</p>
            </div>
          </div>
          <div className="space-y-4">
            {[{ icon: ShieldCheck, text: 'Verifikasi identitas aman' }, { icon: Lightning, text: 'Setup dalam 5 menit' }, { icon: Clock, text: 'Transaksi pertama gratis' }].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Icon size={16} /></div>
                <span className="text-sm text-primary-foreground/80">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
