import { useState } from 'react';
import { Bell, ShieldCheck, CreditCard, ArrowsClockwise, Warning, Info } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const tabs = ['Semua', 'Belum Dibaca', 'Transaksi', 'Keamanan', 'Sistem'];

const notifs = [
 { id: 1, icon: ShieldCheck, title: 'Transaksi #KHD-2451 dikonfirmasi', body: 'Dana Rp 5.200.000 akan dicairkan dalam 24 jam', time: '2 menit lalu', read: false, type: 'Transaksi', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
 { id: 2, icon: CreditCard, title: 'Deposit Rp 1.000.000 berhasil', body: 'Dana telah ditambahkan ke dompet Anda', time: '1 jam lalu', read: true, type: 'Transaksi', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
 { id: 3, icon: ShieldCheck, title: 'KYC Anda telah disetujui', body: 'Akun Anda kini terverifikasi penuh', time: 'Kemarin', read: true, type: 'Keamanan', color: 'text-primary bg-primary/10' },
 { id: 4, icon: Warning, title: 'Sengketa #KHD-2435 diproses', body: 'Tim mediasi sedang meninjau kasus Anda', time: 'Kemarin', read: false, type: 'Transaksi', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
 { id: 5, icon: Info, title: 'Update fitur baru tersedia', body: 'Kahade v2.1 hadir dengan peningkatan keamanan', time: '3 hari lalu', read: true, type: 'Sistem', color: 'text-muted-foreground bg-muted' },
];

export default function Notifications() {
 const [activeTab, setActiveTab] = useState('Semua');
 const [readAll, setReadAll] = useState(false);

 const filtered = notifs.filter(n => {
 if (activeTab === 'Semua') return true;
 if (activeTab === 'Belum Dibaca') return !n.read && !readAll;
 return n.type === activeTab;
 });

 return (
 <DashboardLayout>
 <div className="p-6 max-w-3xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold">Notifikasi</h1>
 <button onClick={() => setReadAll(true)} className="text-sm text-primary hover:underline">Tandai semua dibaca</button>
 </div>

 <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-5 overflow-x-auto no-scrollbar">
 {tabs.map(tab => (
 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{tab}</button>
 ))}
 </div>

 {filtered.length === 0 ? (
 <div className="py-24 text-center">
 <Bell size={48} className="text-muted-foreground/30 mx-auto mb-4" weight="thin" />
 <p className="font-semibold text-muted-foreground">Tidak ada notifikasi baru</p>
 <p className="text-sm text-muted-foreground mt-1">Anda akan mendapat notifikasi untuk transaksi dan update akun</p>
 </div>
 ) : (
 <div className="space-y-2">
 {filtered.map((n) => {
 const Icon = n.icon;
 const isUnread = !n.read && !readAll;
 return (
 <div key={n.id} className={`card p-4 flex items-start gap-4 transition-colors ${isUnread ? 'border-primary/20 bg-primary/2' : ''}`}>
 {isUnread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.color}`}>
 <Icon size={20} />
 </div>
 <div className="flex-1 min-w-0">
 <p className={`text-sm ${isUnread ? 'font-bold' : 'font-semibold'}`}>{n.title}</p>
 <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
 <p className="text-xs text-muted-foreground mt-1.5">{n.time}</p>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 </DashboardLayout>
 );
}
