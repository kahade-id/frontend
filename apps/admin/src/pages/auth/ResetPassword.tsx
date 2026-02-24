import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeSlash, CheckCircle, LockKey, Warning } from '@phosphor-icons/react';
import { Link } from 'wouter';
import { fadeInUp } from '@kahade/utils';
import { authApi } from '@kahade/utils';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    setToken(t);
    if (t) {
      authApi.validateResetToken(t)
        .then(() => setTokenValid(true))
        .catch(() => setTokenValid(false));
    } else {
      setTokenValid(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.password || form.password !== form.confirm || !token) return;
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password: form.password });
      setDone(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Gagal mereset password.';
      toast.error('Reset gagal', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" />
          <p className="text-sm text-muted-foreground">Memverifikasi tautan...</p>
        </div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <Warning size={32} className="text-destructive" weight="duotone" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Tautan Tidak Valid</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Tautan reset password sudah kedaluwarsa atau tidak valid.
          </p>
          <Link href="/forgot-password" className="btn-primary w-full inline-flex justify-center">Minta Tautan Baru</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {!done ? (
          <motion.div variants={fadeInUp} initial="initial" animate="animate">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <LockKey size={32} className="text-primary" weight="duotone" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Reset Password Admin</h1>
            <p className="text-muted-foreground text-sm mb-8">Buat password baru yang kuat untuk akun admin Anda.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="text-sm font-medium mb-1.5 block">Password Baru</label>
                <div className="relative">
                  <input id="new-password" type={showPwd ? 'text' : 'password'} required minLength={8} placeholder="Min. 8 karakter" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-border bg-background focus:outline-none focus:border-foreground transition-colors text-sm" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirm-password" className="text-sm font-medium mb-1.5 block">Konfirmasi Password</label>
                <div className="relative">
                  <input id="confirm-password" type={showConfirm ? 'text' : 'password'} required placeholder="Ulangi password" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})}
                    className={`w-full h-12 px-4 pr-12 rounded-xl border-2 bg-background focus:outline-none focus:border-foreground transition-colors text-sm ${form.confirm && form.password !== form.confirm ? 'border-destructive' : 'border-border'}`} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {form.confirm && form.password !== form.confirm && (
                  <p className="text-xs text-destructive mt-1">Password tidak cocok</p>
                )}
              </div>
              <button type="submit" className="btn-primary w-full h-12" disabled={loading || !form.password || form.password !== form.confirm}>
                {loading ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyimpan...
                  </span>
                ) : 'Reset Password'}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div variants={fadeInUp} initial="initial" animate="animate" className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
              <CheckCircle size={32} className="text-green-600" weight="fill" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Password Berhasil Diubah!</h1>
            <p className="text-muted-foreground text-sm mb-8">Gunakan password baru untuk masuk ke admin panel.</p>
            <Link href="/login" className="btn-primary w-full inline-flex justify-center">Masuk Sekarang</Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
