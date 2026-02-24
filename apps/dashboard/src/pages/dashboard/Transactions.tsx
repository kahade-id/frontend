import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
 Plus, MagnifyingGlass, FunnelSimple, ArrowRight,
 CaretLeft, CaretRight, ArrowDown
} from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';

const tabs = ['Semua', 'Aktif', 'Selesai', 'Dibatalkan', 'Sengketa'];
const mockTx = [
 { id: 'KHD-2451', title: 'Laptop ASUS ROG', party: '@seller_081', city: 'Jakarta', amount: 'Rp 5.200.000', status: 'active', label: 'Aktif', age: '2 hari lagi' },
 { id: 'KHD-2449', title: 'Jasa Logo Design', party: '@jasa_design', city: 'Bandung', amount: 'Rp 800.000', status: 'completed', label: 'Selesai', age: '3 hari lalu' },
 { id: 'KHD-2447', title: 'iPhone 15 Pro', party: '@iphone_store', city: 'Surabaya', amount: 'Rp 12.000.000', status: 'pending', label: 'Menunggu', age: '1 hari lagi' },
 { id: 'KHD-2440', title: 'Jasa Video Editing', party: '@editor_pro', city: 'Yogyakarta', amount: 'Rp 2.500.000', status: 'completed', label: 'Selesai', age: '5 hari lalu' },
 { id: 'KHD-2435', title: 'Kamera Sony A7R', party: '@camera_store', city: 'Jakarta', amount: 'Rp 18.000.000', status: 'dispute', label: 'Sengketa', age: '7 hari lalu' },
 { id: 'KHD-2430', title: 'Macbook Air M2', party: '@mac_seller', city: 'Jakarta', amount: 'Rp 15.000.000', status: 'cancelled', label: 'Dibatalkan', age: '10 hari lalu' },
];
const statusStyles: Record<string, string> = {
 active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
 completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 dispute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
 cancelled: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
};
export default function Transactions() {
 const [activeTab, setActiveTab] = useState('Semua');
 const [search, setSearch] = useState('');

 useEffect(() => {
  const query = new URLSearchParams(window.location.search).get('q');
  if (query) {
   setSearch(query);
  }
 }, []);
 const filtered = mockTx.filter(tx => activeTab === 'Semua' || tx.label === activeTab).filter(tx => !search || tx.title.toLowerCase().includes(search.toLowerCase()) || tx.id.toLowerCase().includes(search.toLowerCase()));
 return (
 <DashboardLayout>
 <div className="p-6 max-w-6xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <h1 className="text-2xl font-bold">Transaksi</h1>
 <Link href="/transactions/create" className="btn-primary inline-flex"><Plus size={18} /> Transaksi Baru</Link>
 </div>
 <div className="flex gap-1 bg-muted/50 p-1 rounded-xl mb-5 overflow-x-auto no-scrollbar">
 {tabs.map(tab => (
 <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{tab}</button>
 ))}
 </div>
 <div className="flex gap-3 mb-5">
 <div className="relative flex-1">
 <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <input type="text" placeholder="Cari transaksi..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
 </div>
 <button className="btn-secondary gap-2 px-3"><FunnelSimple size={16} /> Filter</button>
 <button className="btn-secondary gap-2 px-3"><ArrowDown size={16} /> Export</button>
 </div>
 <div className="hidden md:block card overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-muted/50 border-b border-border">
 <tr>
 <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Transaksi</th>
 <th className="text-left p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Pihak Lawan</th>
 <th className="text-right p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Nilai</th>
 <th className="text-center p-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
 <th className="p-4" />
 </tr>
 </thead>
 <tbody className="divide-y divide-border">
 {filtered.map((tx) => (
 <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
 <td className="p-4"><p className="font-semibold">{tx.title}</p><p className="text-xs text-muted-foreground">#{tx.id} · {tx.age}</p></td>
 <td className="p-4"><p className="font-medium">{tx.party}</p><p className="text-xs text-muted-foreground">{tx.city}</p></td>
 <td className="p-4 text-right font-semibold">{tx.amount}</td>
 <td className="p-4 text-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[tx.status]}`}>{tx.label}</span></td>
 <td className="p-4">
 <Link href={`/transactions/${tx.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-muted inline-flex"><ArrowRight size={16} className="text-muted-foreground" /></Link>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 {filtered.length === 0 && <div className="py-16 text-center text-muted-foreground text-sm">Tidak ada transaksi ditemukan.</div>}
 </div>
 <div className="md:hidden space-y-3">
 {filtered.map((tx) => (
 <Link key={tx.id} href={`/transactions/${tx.id}`}>
 <div className="card p-4 flex items-center justify-between gap-3">
 <div><p className="font-semibold text-sm">{tx.title}</p><p className="text-xs text-muted-foreground">#{tx.id} · {tx.party}</p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block ${statusStyles[tx.status]}`}>{tx.label}</span></div>
 <div className="text-right shrink-0"><p className="font-bold text-sm">{tx.amount}</p><p className="text-xs text-muted-foreground mt-0.5">{tx.age}</p></div>
 </div>
 </Link>
 ))}
 </div>
 {filtered.length > 0 && (
 <div className="flex items-center justify-between mt-5 text-sm text-muted-foreground">
 <span>Menampilkan 1–{filtered.length} dari {mockTx.length} transaksi</span>
 <div className="flex items-center gap-1">
 <button className="p-2 rounded-lg hover:bg-muted transition-colors"><CaretLeft size={16} /></button>
 <button className="w-8 h-8 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">1</button>
 <button className="p-2 rounded-lg hover:bg-muted transition-colors"><CaretRight size={16} /></button>
 </div>
 </div>
 )}
 </div>
 </DashboardLayout>
 );
}
