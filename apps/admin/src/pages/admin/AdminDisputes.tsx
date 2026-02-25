import { useState } from 'react';
import { Eye, Warning, Clock, CheckCircle } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Button } from '@kahade/ui';

const disputes = [
 { id: 'D-089', tx: 'KHD-2448', title: 'Kamera Sony A7', buyer: 'rizki@email.com', seller: 'camera_store', amount: 'Rp 18.000.000', reason: 'Barang tidak sesuai deskripsi', status: 'open', priority: 'high', opened: '18 Feb 2026' },
 { id: 'D-088', tx: 'KHD-2440', title: 'Jasa Video Editing', buyer: 'dito@email.com', seller: 'editor_pro', amount: 'Rp 2.500.000', reason: 'Pekerjaan tidak selesai tepat waktu', status: 'reviewing', priority: 'medium', opened: '15 Feb 2026' },
 { id: 'D-087', tx: 'KHD-2430', title: 'MacBook Pro 14', buyer: 'hana@email.com', seller: 'mac_store', amount: 'Rp 28.000.000', reason: 'Barang cacat saat diterima', status: 'resolved', priority: 'high', opened: '12 Feb 2026' },
 { id: 'D-086', tx: 'KHD-2425', title: 'Jasa Desain Interior', buyer: 'andi@email.com', seller: 'interior_pro', amount: 'Rp 12.000.000', reason: 'Kualitas di bawah ekspektasi', status: 'open', priority: 'low', opened: '10 Feb 2026' },
];

const statusCls: Record<string,string> = {
 open: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
 reviewing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};
const statusLabel: Record<string,string> = { open: 'Terbuka', reviewing: 'Ditinjau', resolved: 'Selesai' };
const priorityCls: Record<string,string> = {
 high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
 medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function AdminDisputes() {
 const [tab, setTab] = useState('Semua');
 const tabs = ['Semua', 'Terbuka', 'Ditinjau', 'Selesai'];
 const tabMap: Record<string,string> = { Terbuka: 'open', Ditinjau: 'reviewing', Selesai: 'resolved' };
 const filtered = disputes.filter(d => tab === 'Semua' || d.status === tabMap[tab]);

 return (
 <AdminLayout title="Manajemen Sengketa" subtitle="Review dan selesaikan sengketa pengguna">
 <div className="space-y-5">
 <div className="grid grid-cols-3 gap-4">
 {[
 { label: 'Terbuka', value: disputes.filter(d => d.status === 'open').length, icon: Warning, cls: 'bg-red-100 text-red-600 dark:bg-red-900/30' },
 { label: 'Ditinjau', value: disputes.filter(d => d.status === 'reviewing').length, icon: Clock, cls: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' },
 { label: 'Selesai Bulan Ini', value: 24, icon: CheckCircle, cls: 'bg-green-100 text-green-600 dark:bg-green-900/30' },
 ].map(({ label, value, icon: Icon, cls }) => (
 <div key={label} className="card p-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cls}`}><Icon size={20} weight="duotone" /></div>
 <p className="text-2xl font-black">{value}</p>
 <p className="text-xs text-muted-foreground">{label}</p>
 </div>
 ))}
 </div>
 <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
 {tabs.map(t => <Button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-background ' : 'text-muted-foreground hover:text-foreground'}`}>{t}</Button>)}
 </div>
 <div className="card overflow-hidden">
 <table className="w-full text-sm">
 <thead className="border-b border-border bg-muted/20">
 <tr>{['ID','Transaksi','Alasan','Pembeli','Penjual','Nilai','Prioritas','Status','Dibuka',''].map(h => <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
 </thead>
 <tbody className="divide-y divide-border">
 {filtered.map(d => (
 <tr key={d.id} className="hover:bg-muted/30 transition-colors group">
 <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
 <td className="px-4 py-3"><p className="font-semibold text-xs">{d.title}</p><p className="text-[0.65rem] text-muted-foreground">{d.tx}</p></td>
 <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{d.reason}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{d.buyer}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{d.seller}</td>
 <td className="px-4 py-3 font-semibold text-xs">{d.amount}</td>
 <td className="px-4 py-3"><span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full capitalize ${priorityCls[d.priority]}`}>{d.priority}</span></td>
 <td className="px-4 py-3"><span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${statusCls[d.status]}`}>{statusLabel[d.status]}</span></td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{d.opened}</td>
 <td className="px-4 py-3"><Button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"><Eye size={14} /></Button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </AdminLayout>
 );
}
