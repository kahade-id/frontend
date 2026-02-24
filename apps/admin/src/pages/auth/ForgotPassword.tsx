import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Envelope, CheckCircle, Key } from '@phosphor-icons/react';
import { Link } from 'wouter';
import { fadeInUp } from '@kahade/utils';
import { authApi } from '@kahade/utils';
import { toast } from 'sonner';
import { Button } from '@kahade/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
      let c = 45;
      setCountdown(c);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0 && countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 1000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Gagal mengirim email. Coba lagi nanti.';
      toast.error('Gagal', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/login">
          <Button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-10 transition-colors">
            <ArrowLeft size={16} /> Kembali ke Login Admin
          </Button>
        </Link>

        {!submitted ? (
          <motion.div variants={fadeInUp} initial="initial" animate="animate">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <Key size={32} className="text-primary" weight="duotone" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Lupa Password Admin?</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Masukkan email admin Anda dan kami akan mengirimkan tautan reset password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email Admin</label>
                <div className="relative">
                  <Envelope size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email" required placeholder="admin@kahade.id" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm"
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading}  variant="primary" className="w-full h-12">
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Mengirim...
                  </span>
                ) : 'Kirim Tautan Reset'}
              </Button>
            </form>
          </motion.div>
        ) : (
          <motion.div variants={fadeInUp} initial="initial" animate="animate" className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <CheckCircle size={32} className="text-green-600" weight="fill" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Email Terkirim!</h1>
            <p className="text-muted-foreground text-sm mb-2">
              Periksa inbox <strong>{email}</strong> untuk tautan reset.
            </p>
            <p className="text-xs text-muted-foreground mb-8">(Juga cek folder spam)</p>
            {countdown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Kirim ulang dalam: <span className="font-semibold text-foreground">0:{countdown.toString().padStart(2, '0')}</span>
              </p>
            ) : (
              <Button onClick={() => { if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; } setSubmitted(false); setCountdown(0); }} className="btn-secondary">
                Kirim Ulang
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
