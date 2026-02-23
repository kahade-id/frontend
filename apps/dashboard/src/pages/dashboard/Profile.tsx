import { useState } from 'react';
import { Link } from 'wouter';
import { ShieldCheck, Warning, PencilSimple, CalendarBlank, Star } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const tabs = ['Info Pribadi', 'Keamanan', 'Notifikasi', 'Privasi'];

const kycStatus = 'verified'; // or 'pending'

export default function Profile() {
 const [activeTab, setActiveTab] = useState('Info Pribadi');

 return (
 <DashboardLayout>
 <div className="p-6 max-w-4xl mx-auto">
 {/* Profile Header */}
 <div className="card p-6 mb-6">
 <div className="flex items-start justify-between flex-wrap gap-4">
 <div className="flex items-center gap-4">
 <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-black text-primary">A</div>
 <div>
 <h1 className="text-xl font-bold">Ahmad Rizki</h1>
 <p className="text-muted-foreground text-sm">ahmad@email.com</p>
 <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
 <span className="flex items-center gap-1"><CalendarBlank size={12} /> Bergabung Jan 2024</span>
 <span className="flex items-center gap-1"><Star size={12} className="text-yellow-500" weight="fill" /> Level: Gold</span>
 </div>
 </div>
 </div>
 <button className="btn-secondary gap-2 text-sm"><PencilSimple size={16} /> Edit Profil</button>
 </div>

 {/* KYC Status */}
 <div className={`mt-5 rounded-xl p-4 border-2 flex items-center gap-4 ${kycStatus === 'verified' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'}`}>
 <div className={`w-12 h-12 rounded-full flex items-center justify-center ${kycStatus === 'verified' ? 'bg-green-600' : 'bg-yellow-500'} text-white`}>
 {kycStatus === 'verified' ? <ShieldCheck size={24} weight="fill" /> : <Warning size={24} weight="fill" />}
 </div>
 <div className="flex-1">
 <p className="font-bold">{kycStatus === 'verified' ? 'Identitas Terverifikasi' : 'Verifikasi Diperlukan'}</p>
 <p className="text-sm text-muted-foreground">{kycStatus === 'verified' ? 'Akun Anda telah terverifikasi penuh.' : 'Verifikasi KYC untuk transaksi tanpa batas.'}</p>
 </div>
 {kycStatus !== 'verified' && (
 <Link href="/kyc"><button className="btn-primary btn-sm text-sm">Verifikasi →</button></Link>
 )}
 </div>
 </div>

 {/* Tabs */}
 <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-5 overflow-x-auto no-scrollbar">
 {tabs.map(tab => (
 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-1 ${activeTab === tab ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{tab}</button>
 ))}
 </div>

 {/* Tab Content */}
 <div className="card p-6">
 {activeTab === 'Info Pribadi' && (
 <div className="space-y-5">
 <h2 className="font-bold">Informasi Pribadi</h2>
 {[['Nama Lengkap', 'Ahmad Rizki', false], ['Email', 'ahmad@email.com', true], ['No. HP', '+62 812-XXXX-XXXX', true], ['Kota', 'Jakarta Selatan', false], ['Bio', '—', false]].map(([label, val, verified]) => (
 <div key={String(label)} className="flex items-center justify-between py-3 border-b border-border last:border-0">
 <div>
 <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
 <p className="font-medium">{val}</p>
 </div>
 {verified && <span className="text-xs font-semibold text-green-600 flex items-center gap-1"><ShieldCheck size={12} /> Terverifikasi</span>}
 </div>
 ))}
 </div>
 )}
 {activeTab === 'Keamanan' && (
 <div className="space-y-5">
 <h2 className="font-bold">Keamanan Akun</h2>
 <div className="flex items-center justify-between py-3 border-b border-border">
 <div>
 <p className="font-medium">Password</p>
 <p className="text-xs text-muted-foreground">Terakhir diubah: 3 bulan lalu</p>
 </div>
 <button className="btn-secondary text-sm">Ubah</button>
 </div>
 <div className="flex items-center justify-between py-3 border-b border-border">
 <div>
 <p className="font-medium">Autentikasi 2 Faktor</p>
 <p className="text-xs text-muted-foreground">Aktif via Google Authenticator</p>
 </div>
 <button className="btn-secondary text-sm">Kelola</button>
 </div>
 <Link href="/security"><button className="btn-ghost text-sm text-primary">Kelola keamanan lanjutan →</button></Link>
 </div>
 )}
 {activeTab === 'Notifikasi' && (
 <div className="space-y-4">
 <h2 className="font-bold mb-4">Preferensi Notifikasi</h2>
 {[['Transaksi baru', true, true, false], ['Dana masuk', true, true, false], ['Sengketa', true, true, true], ['Newsletter', false, false, false]].map(([label, email, push, sms]) => (
 <div key={String(label)} className="flex items-center justify-between py-3 border-b border-border last:border-0">
 <span className="text-sm">{label}</span>
 <div className="flex items-center gap-6 text-xs text-muted-foreground">
 <span>Email <span className={email ? 'text-green-600 font-bold' : ''}>●</span></span>
 <span>Push <span className={push ? 'text-green-600 font-bold' : ''}>●</span></span>
 <span>SMS <span className={sms ? 'text-green-600 font-bold' : ''}>●</span></span>
 </div>
 </div>
 ))}
 </div>
 )}
 {activeTab === 'Privasi' && (
 <div className="space-y-4">
 <h2 className="font-bold">Pengaturan Privasi</h2>
 <p className="text-sm text-muted-foreground">Kelola bagaimana data Anda digunakan di platform Kahade.</p>
 {[['Tampilkan profil publik', true], ['Izinkan pencarian berdasarkan email', false], ['Bagikan data anonim untuk peningkatan layanan', true]].map(([label, val]) => (
 <div key={String(label)} className="flex items-center justify-between py-3 border-b border-border last:border-0">
 <span className="text-sm">{label}</span>
 <div className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${val ? 'bg-primary' : 'bg-muted'}`}>
 <div className={`w-5 h-5 rounded-full bg-white transition-transform m-0.5 ${val ? 'translate-x-5' : ''}`} />
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </DashboardLayout>
 );
}
