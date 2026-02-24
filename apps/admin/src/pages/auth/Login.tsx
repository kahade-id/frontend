import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye, EyeSlash, ArrowLeft,
  ShieldCheck, Lightning, Clock, Star, ArrowRight
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import { staggerContainer, staggerItem } from '@kahade/utils';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@kahade/ui';

const features = [
  { icon: ShieldCheck, text: 'Akses Terenkripsi' },
  { icon: Lightning, text: 'Dashboard Real-time' },
  { icon: Clock, text: 'Audit Log Lengkap' },
];

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      // Redirect handled by AuthContext
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Email atau password salah.';
      toast.error('Login admin gagal', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-[0.45fr_0.55fr] overflow-x-hidden">
      {/* LEFT — Form */}
      <div className="bg-background px-5 md:px-14 py-12 flex flex-col justify-center overflow-x-hidden">
        <div className="max-w-sm mx-auto w-full">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-10">
            <ArrowLeft size={16} /> Kahade Admin
          </div>

          <motion.div variants={staggerContainer} initial="initial" animate="animate">
            <motion.h1 variants={staggerItem} className="text-3xl font-bold mb-1">Admin Panel</motion.h1>
            <motion.h1 variants={staggerItem} className="text-3xl font-bold text-muted-foreground mb-8">Login</motion.h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</label>
                <input
                  type="email" required placeholder="admin@kahade.id"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'} required placeholder="Password Admin"
                    value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm"
                  />
                  <Button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link href="/forgot-password" className="text-sm font-medium hover:text-primary transition-colors">
                  Lupa password?
                </Link>
              </div>

              <Button type="submit" disabled={loading}  variant="primary" className="w-full h-12 text-base">
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sedang masuk...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 justify-center">Masuk <ArrowRight size={18} /></span>
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>

      {/* RIGHT — Brand Visual */}
      <div className="hidden md:flex bg-primary text-primary-foreground flex-col justify-center px-14 py-12">
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="max-w-md">
          <motion.div variants={staggerItem} className="text-3xl font-black mb-2">KAHADE</motion.div>
          <motion.p variants={staggerItem} className="text-primary-foreground/60 text-sm mb-12">Admin Control Panel</motion.p>

          <motion.blockquote variants={staggerItem} className="text-xl font-semibold leading-relaxed mb-8">
            "Kelola platform escrow terpercaya Indonesia dari satu dashboard."
          </motion.blockquote>

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
              <p className="text-xs text-primary-foreground/60">Admin Team · Kahade</p>
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
