import { useState } from 'react';
import { Download, Eye, CheckCircle, X, ArrowDown } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';

const withdrawals = [
 { id: 'WD-201', user: 'Ahmad Rizki', email: 'ahmad@email.com', bank: 'BCA *1234', amount: 'Rp 2.000.000', status: 'pending', requested: '20 Feb 2026 14:00' },
 { id: 'WD-200', user: 'Sari Dewi', email: 'sari@email.com', bank: 'Mandiri *5678', amount: 'Rp 5.500.000', status: 'processing', requested: '20 Feb 2026 11:30' },
 { id: 'WD-199', user: 'Budi Santoso', email: 'budi@email.com', bank: 'BRI *9012', amount: 'Rp 850.000', status: 'completed', requested: '19 Feb 2026 16:45' },
 { id: 'WD-198', user: 'Rizki F.', email: 'rizki@email.com', bank: 'BCA *3456', amount: 'Rp 12.000.000', status: 'completed', requested: '19 Feb 2026 09:00' },
 { id: 'WD-197', user: 'Maya Putri', email: 'maya@email.com', bank: 'BNI *7890', amount: 'Rp 3.200.000', status: 'rejected', requested: '18 Feb 2026 15:20' },
];
const statusCls: Record<string,string> = {
 pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
 completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const statusLabel: Record<string,string> = { pending: 'Pending', processing: 'Diproses', completed: 'Selesai', rejected: 'Ditolak' };

export default function AdminWithdrawals() {
 const [tab, setTab] = useState('Semua');
 const tabs = ['Semua', 'Pending', 'Diproses', 'Selesai', 'Ditolak'];
 const tabMap: Record<string,string> = { Pending: 'pending', Diproses: 'processing', Selesai: 'completed', Ditolak: 'rejected' };
 const filtered = withdrawals.filter(w => tab === 'Semua' || w.status === tabMap[tab]);

 return (
 <AdminLayout title="Manajemen Penarikan" subtitle="Proses permintaan penarikan dana pengguna">
 <div className="space-y-5">
 <div className="grid grid-cols-3 gap-4">
 {[
 { label: 'Pending', value: withdrawals.filter(w => w.status === 'pending').length, cls: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' },
 { label: 'Diproses', value: withdrawals.filter(w => w.status === 'processing').length, cls: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' },
 { label: 'Selesai Hari Ini', value: 8, cls: 'bg-green-100 text-green-600 dark:bg-green-900/30' },
 ].map(({ label, value, cls }) => (
 <div key={label} className="card p-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cls}`}><ArrowDown size={20} weight="duotone" /></div>
 <p className="text-2xl font-black">{value}</p>
 <p className="text-xs text-muted-foreground">{label}</p>
 </div>
 ))}
 </div>
 <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
 {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-background ' : 'text-muted-foreground hover:text-foreground'}`}>{t}</button>)}
 </div>
 <div className="card overflow-hidden">
 <div className="flex justify-end px-5 py-4 border-b border-border bg-muted/30">
 <button className="btn-secondary gap-2 text-sm px-3 py-2"><Download size={15} /> Export</button>
 </div>
 <table className="w-full text-sm">
 <thead className="border-b border-border bg-muted/20">
 <tr>{['ID','Pengguna','Bank','Jumlah','Status','Diminta','Aksi'].map(h => <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
 </thead>
 <tbody className="divide-y divide-border">
 {filtered.map(w => (
 <tr key={w.id} className="hover:bg-muted/30 group">
 <td className="px-4 py-3 font-mono text-xs">{w.id}</td>
 <td className="px-4 py-3"><p className="font-semibold">{w.user}</p><p className="text-xs text-muted-foreground">{w.email}</p></td>
 <td className="px-4 py-3 text-xs">{w.bank}</td>
 <td className="px-4 py-3 font-bold">{w.amount}</td>
 <td className="px-4 py-3"><span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${statusCls[w.status]}`}>{statusLabel[w.status]}</span></td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{w.requested}</td>
 <td className="px-4 py-3">
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button className="p-1.5 rounded-lg hover:bg-muted"><Eye size={14} /></button>
 {w.status === 'pending' && <>
 <button className="p-1.5 rounded-lg hover:bg-green-100 text-green-600"><CheckCircle size={14} weight="fill" /></button>
 <button className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"><X size={14} weight="bold" /></button>
 </>}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </AdminLayout>
 );
}
