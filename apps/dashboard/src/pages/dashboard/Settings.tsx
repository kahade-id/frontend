import { useState } from 'react';
import { Globe, Clock, ShieldCheck, Bell, Lock, CreditCard, Code, Trash, Sun } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const sidebarTabs = ['Umum', 'Keamanan', 'Notifikasi', 'Privasi', 'Billing', 'API Keys'];

export default function Settings() {
 const [activeTab, setActiveTab] = useState('Umum');
 const [language, setLanguage] = useState('Bahasa Indonesia');
 const [timezone, setTimezone] = useState('WIB (UTC+7)');

 return (
 <DashboardLayout>
 <div className="p-6 max-w-5xl mx-auto">
 <h1 className="text-2xl font-bold mb-6">Pengaturan</h1>
 <div className="grid md:grid-cols-[200px_1fr] gap-6">
 <div className="space-y-1">
 {sidebarTabs.map(tab => (
 <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{tab}</button>
 ))}
 </div>

 <div className="card p-6">
 {activeTab === 'Umum' && (
 <div className="space-y-6">
 <h2 className="font-bold text-lg">Pengaturan Umum</h2>
 <div className="space-y-4">
 <div className="flex items-center justify-between py-3 border-b border-border">
 <div className="flex items-center gap-3">
 <Globe size={18} className="text-muted-foreground" />
 <div><p className="font-medium text-sm">Bahasa</p><p className="text-xs text-muted-foreground">Pilih bahasa antarmuka</p></div>
 </div>
 <select value={language} onChange={(e) => setLanguage(e.target.value)} className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
 <option>Bahasa Indonesia</option>
 <option>English</option>
 </select>
 </div>

 <div className="flex items-center justify-between py-3 border-b border-border">
 <div className="flex items-center gap-3">
 <Clock size={18} className="text-muted-foreground" />
 <div><p className="font-medium text-sm">Zona Waktu</p><p className="text-xs text-muted-foreground">Digunakan pada histori aktivitas</p></div>
 </div>
 <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
 <option>WIB (UTC+7)</option>
 <option>WITA (UTC+8)</option>
 <option>WIT (UTC+9)</option>
 </select>
 </div>

 <div className="flex items-center justify-between py-3 border-b border-border">
 <div className="flex items-center gap-3">
 <Sun size={18} className="text-muted-foreground" />
 <div><p className="font-medium text-sm">Tema</p><p className="text-xs text-muted-foreground">Saat ini dashboard menggunakan mode terang.</p></div>
 </div>
 <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">Light only</span>
 </div>
 </div>
 <button type="button" className="btn-primary">Simpan Perubahan</button>
 </div>
 )}

 {activeTab === 'Keamanan' && (
 <div className="space-y-5">
 <h2 className="font-bold text-lg">Keamanan Akun</h2>
 <div className="space-y-3">
 {[
 { icon: Lock, title: 'Ubah Password', desc: 'Terakhir diubah 3 bulan lalu', btn: 'Ubah', color: '' },
 { icon: ShieldCheck, title: 'Autentikasi 2 Faktor', desc: 'Aktif via Google Authenticator', btn: 'Kelola', color: 'text-green-600' },
 { icon: Globe, title: 'Sesi Aktif', desc: '2 perangkat aktif', btn: 'Kelola', color: '' },
 ].map(({ icon: Icon, title, desc, btn, color }) => (
 <div key={title} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
 <div className="flex items-center gap-3">
 <Icon size={20} className={color || 'text-muted-foreground'} />
 <div><p className="font-medium text-sm">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
 </div>
 <button type="button" className="btn-secondary text-sm">{btn}</button>
 </div>
 ))}
 </div>
 </div>
 )}

 {activeTab === 'Notifikasi' && (
 <div className="space-y-4">
 <h2 className="font-bold text-lg">Preferensi Notifikasi</h2>
 <div className="grid grid-cols-4 gap-2 text-xs text-center text-muted-foreground pb-2 border-b border-border">
 <span className="text-left text-sm font-medium text-foreground">Kategori</span>
 <span>Email</span><span>Push</span><span>SMS</span>
 </div>
 {[['Transaksi baru', true, true, false], ['Dana masuk', true, true, false], ['Sengketa', true, true, true], ['Update keamanan', true, false, true], ['Newsletter', false, false, false]].map(([label, ...vals]) => (
 <div key={String(label)} className="grid grid-cols-4 gap-2 items-center py-2.5 border-b border-border last:border-0">
 <span className="text-sm">{label}</span>
 {vals.map((v, i) => (
 <div key={i} className="flex justify-center">
 <div className={`w-9 h-5 rounded-full transition-colors ${v ? 'bg-primary' : 'bg-muted'}`}>
 <div className={`w-4 h-4 rounded-full bg-white transition-transform m-0.5 ${v ? 'translate-x-4' : ''}`} />
 </div>
 </div>
 ))}
 </div>
 ))}
 </div>
 )}

 {activeTab === 'Billing' && (
 <div className="space-y-5">
 <h2 className="font-bold text-lg">Billing & Langganan</h2>
 <div className="bg-muted/50 rounded-2xl p-5">
 <div className="flex items-center justify-between mb-2">
 <div><p className="font-bold">Paket Pemula</p><p className="text-sm text-muted-foreground">Gratis selamanya</p></div>
 <span className="badge badge-success">Aktif</span>
 </div>
 </div>
 <button type="button" className="btn-primary">Upgrade ke Profesional</button>
 </div>
 )}

 {activeTab === 'API Keys' && (
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <h2 className="font-bold text-lg">API Keys</h2>
 <button type="button" className="btn-primary text-sm">+ Buat Key Baru</button>
 </div>
 <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
 ⚠ Jangan bagikan API key Anda. Gunakan hanya di server-side.
 </div>
 <div className="card p-4">
 <div className="flex items-center justify-between">
 <div><p className="font-medium text-sm">Production Key</p><p className="text-xs font-mono text-muted-foreground mt-1">kh_live_••••••••••••••••</p></div>
 <div className="flex gap-2">
 <button type="button" className="btn-secondary text-xs p-1.5"><Code size={14} /></button>
 <button type="button" className="btn-secondary text-xs p-1.5 hover:border-destructive hover:text-destructive"><Trash size={14} /></button>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'Privasi' && (
 <div className="space-y-4">
 <h2 className="font-bold text-lg">Pengaturan Privasi</h2>
 {[['Tampilkan profil publik', true], ['Izinkan pencarian berdasarkan email', false], ['Bagikan data anonim untuk peningkatan layanan', true]].map(([label, val]) => (
 <div key={String(label)} className="flex items-center justify-between py-3 border-b border-border last:border-0">
 <span className="text-sm">{label}</span>
 <div className={`w-11 h-6 rounded-full transition-colors ${val ? 'bg-primary' : 'bg-muted'}`}>
 <div className={`w-5 h-5 rounded-full bg-white transition-transform m-0.5 ${val ? 'translate-x-5' : ''}`} />
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </DashboardLayout>
 );
}
