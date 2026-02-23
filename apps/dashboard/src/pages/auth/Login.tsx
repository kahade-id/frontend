import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeSlash, GoogleLogo, AppleLogo, ArrowLeft,
  ShieldCheck, Lightning, Clock, Star, ArrowRight
} from '@phosphor-icons/react';
import { Link, useLocation } from 'wouter';
import { staggerContainer, staggerItem } from '@kahade/utils';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

const features = [
  { icon: ShieldCheck, text: 'Enkripsi SSL 256-bit' },
  { icon: Lightning, text: 'Pencairan dalam 12 jam' },
  { icon: Clock, text: 'Support 24/7' },
];

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      // Redirect handled by AuthContext based on role
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Email atau password salah.';
      toast.error('Login gagal', { description: msg });
    } finally {
      setLoading(false);
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

          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            <motion.h1 variants={staggerItem} className="text-3xl font-bold mb-1">Selamat Datang</motion.h1>
            <motion.h1 variants={staggerItem} className="text-3xl font-bold text-muted-foreground mb-8">Kembali</motion.h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <input
                  type="email" required placeholder="email@contoh.com"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required placeholder="Password Anda"
                    value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.remember} onChange={e => setForm({...form, remember: e.target.checked})} className="w-4 h-4 accent-primary rounded" />
                  <span className="text-sm text-muted-foreground">Ingat saya</span>
                </label>
                <Link href="/forgot-password" className="text-sm font-medium hover:text-primary transition-colors">
                  Lupa password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-base">
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sedang masuk...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">Masuk <ArrowRight size={18} /></span>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">Atau</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3">
              <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-border rounded-xl text-sm font-semibold hover:bg-muted hover:border-neutral-300 transition-all duration-200 active:scale-[0.99]">
                <GoogleLogo size={20} /> Lanjutkan dengan Google
              </button>
              <button className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-border rounded-xl text-sm font-semibold hover:bg-muted hover:border-neutral-300 transition-all duration-200 active:scale-[0.99]">
                <AppleLogo size={20} /> Lanjutkan dengan Apple
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Belum punya akun?{' '}
              <Link href="/register" className="font-semibold text-foreground hover:text-primary transition-colors">
                Buat akun gratis
              </Link>
            </p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT — Brand Visual */}
      <div className="hidden md:flex bg-primary text-primary-foreground flex-col justify-center px-14 py-12">
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="max-w-md">
          <motion.div variants={staggerItem} className="text-3xl font-black mb-2">KAHADE</motion.div>
          <motion.p variants={staggerItem} className="text-primary-foreground/60 text-sm mb-12">Platform Escrow Terpercaya Indonesia</motion.p>

          <motion.blockquote variants={staggerItem} className="text-xl font-semibold leading-relaxed mb-8">
            "Ribuan pengguna mempercayai Kahade untuk transaksi online mereka."
          </motion.blockquote>

          {/* Avatar stack + rating */}
          <motion.div variants={staggerItem} className="flex items-center gap-4 mb-12 pb-12 border-b border-white/10">
            <div className="flex -space-x-2">
              {['A','B','C','D','E'].map((l, i) => (
                <div key={i} className="w-9 h-9 rounded-full bg-white/20 border-2 border-primary flex items-center justify-center text-xs font-bold">{l}</div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} size={14} weight="fill" className="text-yellow-400" />)}
              </div>
              <p className="text-xs text-primary-foreground/60">4.9/5 · 2.100+ ulasan</p>
            </div>
          </motion.div>

          <motion.div variants={staggerItem} className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <span className="text-sm text-primary-foreground/80">{text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
