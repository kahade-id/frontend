import React, { useState, useEffect } from 'react';
import { api } from '@kahade/utils';
import {
 ShieldCheck, DeviceMobile, EnvelopeSimple, Key, Check, X,
 Warning, QrCode, Copy, Eye, EyeSlash, Trash, Monitor, ArrowsClockwise,
 Lock
} from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Button } from '@kahade/ui';

interface MFAStatus {
 enabled: boolean;
 methods: {
 totp: boolean;
 sms: boolean;
 email: boolean;
 webauthn: boolean;
 };
 preferredMethod: string | null;
 backupCodesRemaining: number;
}

interface TrustedDevice {
 id: string;
 deviceName: string | null;
 deviceType: string | null;
 browser: string | null;
 os: string | null;
 lastUsedAt: string;
 lastIpAddress: string | null;
 createdAt: string;
}

export default function MFASettings() {
 const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
 const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
 const [loading, setLoading] = useState(true);
 const [showSetupModal, setShowSetupModal] = useState(false);
 const [showDisableModal, setShowDisableModal] = useState(false);

 useEffect(() => {
 loadMFAStatus();
 loadTrustedDevices();
 }, []);

 const loadMFAStatus = async () => {
 try {
 const response = await api.get('/auth/mfa/status');
 setMfaStatus(response.data);
 } catch (error) {
 } finally {
 setLoading(false);
 }
 };

 const loadTrustedDevices = async () => {
 try {
 const response = await api.get('/auth/mfa/devices');
 const data = response?.data;
 let deviceList: TrustedDevice[] = [];
 if (data) {
 if (Array.isArray(data.devices)) deviceList = data.devices;
 else if (Array.isArray(data.data)) deviceList = data.data;
 else if (Array.isArray(data)) deviceList = data;
 }
 setTrustedDevices(deviceList);
 } catch (error) {
 setTrustedDevices([]);
 }
 };

 const revokeDevice = async (deviceId: string) => {
 if (!confirm('Apakah Anda yakin ingin mencabut kepercayaan perangkat ini?')) return;
 try {
 await api.delete(`/auth/mfa/devices/${deviceId}`);
 loadTrustedDevices();
 } catch (error) {}
 };

 if (loading) {
 return (
 <DashboardLayout>
 <div className="flex items-center justify-center h-64">
 <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
 </div>
 </DashboardLayout>
 );
 }

 return (
 <DashboardLayout title="Keamanan Akun" subtitle="Kelola autentikasi dua faktor dan perangkat terpercaya">
 <div className="max-w-3xl mx-auto p-6 space-y-6">

 {/* MFA Status Card */}
 <div className="card p-6">
 <div className="flex items-start justify-between gap-4">
 <div className="flex items-start gap-4">
 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${mfaStatus?.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
 <ShieldCheck
 size={24}
 className={mfaStatus?.enabled ? 'text-green-600' : 'text-yellow-600'}
 weight="duotone"
 />
 </div>
 <div>
 <h2 className="font-semibold text-lg">Autentikasi Dua Faktor (2FA)</h2>
 <p className="text-sm text-muted-foreground mt-0.5">
 {mfaStatus?.enabled
 ? 'Akun Anda dilindungi dengan 2FA'
 : 'Aktifkan 2FA untuk keamanan tambahan'}
 </p>
 {mfaStatus?.enabled && (
 <p className="text-xs text-muted-foreground mt-1">
 Kode cadangan tersisa: <span className="font-semibold text-foreground">{mfaStatus.backupCodesRemaining}</span>
 </p>
 )}
 </div>
 </div>
 {mfaStatus?.enabled ? (
 <Button
 onClick={() => setShowDisableModal(true)}
 className="btn-ghost text-destructive border border-destructive/30 hover:bg-destructive/10 text-sm"
 >
 Nonaktifkan
 </Button>
 ) : (
 <Button
 onClick={() => setShowSetupModal(true)}
 className="btn-primary text-sm"
 >
 Aktifkan 2FA
 </Button>
 )}
 </div>

 {/* MFA Methods */}
 {mfaStatus?.enabled && (
 <div className="mt-6 pt-6 border-t border-border">
 <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Metode Aktif</h3>
 <div className="grid sm:grid-cols-2 gap-3">
 {[
 { key: 'totp', icon: QrCode, label: 'Aplikasi Autentikator (TOTP)', desc: 'Google Authenticator, Authy, dll' },
 { key: 'sms', icon: DeviceMobile, label: 'SMS OTP', desc: 'Kode via pesan SMS' },
 { key: 'email', icon: EnvelopeSimple, label: 'Email OTP', desc: 'Kode via email' },
 { key: 'webauthn', icon: Key, label: 'Security Key (WebAuthn)', desc: 'YubiKey atau biometrik' },
 ].map(({ key, icon: Icon, label, desc }) => {
 const enabled = mfaStatus?.methods?.[key as keyof typeof mfaStatus.methods];
 return (
 <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${enabled ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-border bg-muted/30'}`}>
 <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${enabled ? 'bg-green-100 dark:bg-green-900/40' : 'bg-muted'}`}>
 <Icon size={18} className={enabled ? 'text-green-600' : 'text-muted-foreground'} weight="duotone" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">{label}</p>
 <p className="text-xs text-muted-foreground truncate">{desc}</p>
 </div>
 <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${enabled ? 'bg-green-500' : 'bg-muted'}`}>
 {enabled ? <Check size={12} className="text-white" weight="bold" /> : <X size={12} className="text-muted-foreground" weight="bold" />}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
 </div>

 {/* Trusted Devices */}
 <div className="card p-6">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="font-semibold text-lg">Perangkat Terpercaya</h2>
 <p className="text-sm text-muted-foreground mt-0.5">{trustedDevices.length} perangkat terdaftar</p>
 </div>
 <Button
 onClick={loadTrustedDevices}
  variant="ghost" className="p-2"
 aria-label="Refresh daftar perangkat"
 >
 <ArrowsClockwise size={18} />
 </Button>
 </div>

 {trustedDevices.length === 0 ? (
 <div className="py-10 text-center">
 <Monitor size={40} className="text-muted-foreground/30 mx-auto mb-3" weight="thin" />
 <p className="text-sm text-muted-foreground">Tidak ada perangkat terpercaya</p>
 </div>
 ) : (
 <div className="space-y-3">
 {trustedDevices.map((device) => (
 <div key={device.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
 <Monitor size={20} className="text-muted-foreground" weight="duotone" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {device.deviceName || device.browser || 'Perangkat Tidak Dikenal'}
 </p>
 <p className="text-xs text-muted-foreground truncate">
 {[device.os, device.browser].filter(Boolean).join(' · ')}
 {device.lastIpAddress && ` · ${device.lastIpAddress}`}
 </p>
 <p className="text-xs text-muted-foreground mt-0.5">
 Terakhir digunakan: {new Date(device.lastUsedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
 </p>
 </div>
 <Button
 onClick={() => revokeDevice(device.id)}
 className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors shrink-0"
 aria-label="Cabut kepercayaan perangkat"
 >
 <Trash size={16} />
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Security Tips */}
 <div className="card p-6 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
 <div className="flex items-start gap-3">
 <Lock size={20} className="text-blue-600 shrink-0 mt-0.5" weight="duotone" />
 <div>
 <h3 className="font-semibold text-sm text-blue-800 dark:text-blue-300">Tips Keamanan</h3>
 <ul className="mt-2 space-y-1 text-xs text-blue-700 dark:text-blue-400">
 <li>• Simpan kode cadangan di tempat yang aman</li>
 <li>• Gunakan aplikasi autentikator (TOTP) untuk keamanan terbaik</li>
 <li>• Cabut akses perangkat yang tidak dikenal</li>
 <li>• Jangan bagikan kode OTP kepada siapapun</li>
 </ul>
 </div>
 </div>
 </div>
 </div>

 {/* TOTP Setup Modal */}
 {showSetupModal && (
 <TOTPSetupModal
 onClose={() => setShowSetupModal(false)}
 onSuccess={() => { setShowSetupModal(false); loadMFAStatus(); }}
 />
 )}

 {/* Disable MFA Modal */}
 {showDisableModal && (
 <DisableMFAModal
 onClose={() => setShowDisableModal(false)}
 onSuccess={() => { setShowDisableModal(false); loadMFAStatus(); }}
 />
 )}
 </DashboardLayout>
 );
}

function TOTPSetupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
 const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');
 const [qrCode, setQrCode] = useState<string>('');
 const [backupCodes, setBackupCodes] = useState<string[]>([]);
 const [verifyCode, setVerifyCode] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');
 const [showCodes, setShowCodes] = useState(false);
 const [secret, setSecret] = useState('');

 useEffect(() => { initSetup(); }, []);

 const initSetup = async () => {
 try {
 const response = await api.post('/auth/mfa/totp/setup');
 setQrCode(response.data.qrCode);
 setSecret(response.data.secret);
 } catch { setError('Gagal memulai setup. Coba lagi.'); }
 };

 const confirmSetup = async () => {
 if (verifyCode.length !== 6) { setError('Kode harus 6 digit'); return; }
 setLoading(true); setError('');
 try {
 const response = await api.post('/auth/mfa/totp/confirm', { code: verifyCode });
 setBackupCodes(response.data.backupCodes || []);
 setStep('backup');
 } catch { setError('Kode tidak valid. Coba lagi.');
 } finally { setLoading(false); }
 };

 const copyBackupCodes = () => {
 const codes = Array.isArray(backupCodes) ? backupCodes : [];
 navigator.clipboard.writeText(codes.join('\n'));
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="bg-background rounded-2xl w-full max-w-md p-6">
 <div className="flex items-center justify-between mb-5">
 <h3 className="font-semibold text-lg">
 {step === 'qr' ? 'Scan QR Code' : step === 'verify' ? 'Verifikasi Kode' : 'Kode Cadangan'}
 </h3>
 <Button onClick={onClose}  variant="ghost" className="p-2"><X size={18} /></Button>
 </div>

 {step === 'qr' && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground">Scan QR code ini dengan aplikasi autentikator Anda (Google Authenticator, Authy, dll)</p>
 {qrCode ? (
 <div className="flex justify-center">
 <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 border border-border rounded-xl p-2" />
 </div>
 ) : (
 <div className="flex justify-center"><div className="w-48 h-48 bg-muted rounded-xl animate-pulse" /></div>
 )}
 {secret && (
 <div className="bg-muted rounded-xl p-3 text-center">
 <p className="text-xs text-muted-foreground mb-1">Atau masukkan kode manual:</p>
 <p className="font-mono text-sm font-semibold tracking-wider">{secret}</p>
 </div>
 )}
 <Button onClick={() => setStep('verify')} className="btn-primary w-full">Lanjutkan Verifikasi</Button>
 </div>
 )}

 {step === 'verify' && (
 <div className="space-y-4">
 <p className="text-sm text-muted-foreground">Masukkan kode 6 digit dari aplikasi autentikator Anda</p>
 <input
 type="text"
 value={verifyCode}
 onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
 placeholder="000000"
 className="input text-center text-2xl tracking-widest font-mono w-full"
 autoFocus
 />
 {error && <p className="text-destructive text-sm text-center">{error}</p>}
 <div className="flex gap-3">
 <Button onClick={() => setStep('qr')} className="btn-ghost flex-1">Kembali</Button>
 <Button onClick={confirmSetup} disabled={loading || verifyCode.length !== 6}  variant="primary" className="flex-1">
 {loading ? 'Memverifikasi...' : 'Verifikasi'}
 </Button>
 </div>
 </div>
 )}

 {step === 'backup' && (
 <div className="space-y-4">
 <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
 <Warning size={18} className="text-yellow-600 shrink-0 mt-0.5" />
 <p className="text-xs text-yellow-700 dark:text-yellow-400">Simpan kode cadangan ini di tempat aman. Kode ini hanya ditampilkan sekali.</p>
 </div>
 <div className={`relative bg-muted rounded-xl p-4 ${!showCodes ? 'filter blur-sm' : ''}`}>
 <div className="grid grid-cols-2 gap-2">
 {(Array.isArray(backupCodes) ? backupCodes : []).map((code, i) => (
 <p key={i} className="font-mono text-sm text-center p-1">{code}</p>
 ))}
 </div>
 </div>
 {!showCodes && (
 <Button onClick={() => setShowCodes(true)} className="btn-ghost w-full flex items-center justify-center gap-2">
 <Eye size={16} /> Tampilkan Kode Cadangan
 </Button>
 )}
 <div className="flex gap-3">
 <Button onClick={copyBackupCodes}  variant="ghost" className="flex-1 flex items-center justify-center gap-2">
 <Copy size={16} /> Salin
 </Button>
 <Button onClick={onSuccess}  variant="primary" className="flex-1">Selesai</Button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}

function DisableMFAModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
 const [code, setCode] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState('');

 const handleDisable = async () => {
 if (code.length !== 6) { setError('Masukkan kode 6 digit'); return; }
 setLoading(true); setError('');
 try {
 await api.post('/auth/mfa/disable', { code });
 onSuccess();
 } catch { setError('Kode tidak valid. Coba lagi.');
 } finally { setLoading(false); }
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="bg-background rounded-2xl w-full max-w-sm p-6">
 <div className="flex items-center justify-between mb-5">
 <h3 className="font-semibold text-lg text-destructive">Nonaktifkan 2FA</h3>
 <Button onClick={onClose}  variant="ghost" className="p-2"><X size={18} /></Button>
 </div>
 <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 mb-4">
 <Warning size={18} className="text-red-600 shrink-0 mt-0.5" />
 <p className="text-xs text-red-700 dark:text-red-400">Menonaktifkan 2FA akan mengurangi keamanan akun Anda secara signifikan.</p>
 </div>
 <p className="text-sm text-muted-foreground mb-3">Masukkan kode dari aplikasi autentikator untuk konfirmasi:</p>
 <input
 type="text"
 value={code}
 onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
 placeholder="000000"
 className="input text-center text-2xl tracking-widest font-mono w-full mb-2"
 autoFocus
 />
 {error && <p className="text-destructive text-sm text-center mb-3">{error}</p>}
 <div className="flex gap-3 mt-4">
 <Button onClick={onClose}  variant="ghost" className="flex-1">Batal</Button>
 <Button onClick={handleDisable} disabled={loading || code.length !== 6} className="flex-1 px-4 py-2 bg-destructive text-white rounded-xl font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
 {loading ? 'Menonaktifkan...' : 'Nonaktifkan 2FA'}
 </Button>
 </div>
 </div>
 </div>
 );
}

