import { Download, Eye, ArrowDown } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';

const deposits = [
 { id: 'DEP-501', user: 'Ahmad Rizki', method: 'BCA Virtual Account', amount: 'Rp 1.000.000', status: 'completed', date: '20 Feb 2026 14:23' },
 { id: 'DEP-500', user: 'Sari Dewi', method: 'QRIS', amount: 'Rp 500.000', status: 'pending', date: '20 Feb 2026 13:10' },
 { id: 'DEP-499', user: 'Budi Santoso', method: 'Mandiri Virtual Account', amount: 'Rp 3.000.000', status: 'completed', date: '19 Feb 2026 18:00' },
 { id: 'DEP-498', user: 'Rizki F.', method: 'BRI Virtual Account', amount: 'Rp 10.000.000', status: 'failed', date: '19 Feb 2026 10:30' },
 { id: 'DEP-497', user: 'Maya Putri', method: 'QRIS', amount: 'Rp 750.000', status: 'completed', date: '18 Feb 2026 09:15' },
];
const statusCls: Record<string,string> = {
 completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const statusLabel: Record<string,string> = { completed: 'Berhasil', pending: 'Pending', failed: 'Gagal' };

export default function AdminDeposits() {
 return (
 <AdminLayout title="Manajemen Deposit" subtitle="Monitor semua deposit masuk ke platform">
 <div className="space-y-5">
 <div className="grid grid-cols-3 gap-4">
 {[
 { label: 'Total Hari Ini', value: 'Rp 14.5M', cls: 'bg-green-100 text-green-600 dark:bg-green-900/30' },
 { label: 'Pending', value: deposits.filter(d => d.status === 'pending').length, cls: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' },
 { label: 'Gagal', value: deposits.filter(d => d.status === 'failed').length, cls: 'bg-red-100 text-red-600 dark:bg-red-900/30' },
 ].map(({ label, value, cls }) => (
 <div key={label} className="card p-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cls}`}><ArrowDown size={20} weight="duotone" /></div>
 <p className="text-2xl font-black">{value}</p>
 <p className="text-xs text-muted-foreground">{label}</p>
 </div>
 ))}
 </div>
 <div className="card overflow-hidden">
 <div className="flex justify-end px-5 py-4 border-b border-border bg-muted/30">
 <button className="btn-secondary gap-2 text-sm px-3 py-2"><Download size={15} /> Export</button>
 </div>
 <table className="w-full text-sm">
 <thead className="border-b border-border bg-muted/20">
 <tr>{['ID','Pengguna','Metode','Jumlah','Status','Waktu',''].map(h => <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
 </thead>
 <tbody className="divide-y divide-border">
 {deposits.map(d => (
 <tr key={d.id} className="hover:bg-muted/30 group">
 <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
 <td className="px-4 py-3 font-semibold">{d.user}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{d.method}</td>
 <td className="px-4 py-3 font-bold text-green-600">{d.amount}</td>
 <td className="px-4 py-3"><span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${statusCls[d.status]}`}>{statusLabel[d.status]}</span></td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{d.date}</td>
 <td className="px-4 py-3"><button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"><Eye size={14} /></button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </AdminLayout>
 );
}
