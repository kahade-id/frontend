import { useState } from 'react';
import { Plus, Tag, Pencil, Trash } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';

const promos = [
 { id: 'PROMO-001', code: 'KAHADE10', type: 'Persentase', value: '10%', minTx: 'Rp 500.000', used: 84, limit: 100, expires: '28 Feb 2026', status: 'active' },
 { id: 'PROMO-002', code: 'GRATIS50K', type: 'Nominal', value: 'Rp 50.000', minTx: 'Rp 1.000.000', used: 200, limit: 200, expires: '15 Feb 2026', status: 'expired' },
 { id: 'PROMO-003', code: 'NEWUSER', type: 'Persentase', value: '5%', minTx: 'Rp 0', used: 456, limit: 1000, expires: '31 Mar 2026', status: 'active' },
 { id: 'PROMO-004', code: 'FLASH25', type: 'Persentase', value: '25%', minTx: 'Rp 2.000.000', used: 0, limit: 50, expires: '25 Feb 2026', status: 'inactive' },
];
const statusCls: Record<string,string> = {
 active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 expired: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
 inactive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};
const statusLabel: Record<string,string> = { active: 'Aktif', expired: 'Kadaluarsa', inactive: 'Nonaktif' };

export default function AdminPromos() {
 return (
 <AdminLayout title="Manajemen Promo" subtitle="Kelola kode voucher dan promosi platform">
 <div className="space-y-5">
 <div className="flex items-center justify-between">
 <div className="grid grid-cols-3 gap-4 flex-1 mr-4">
 {[
 { label: 'Promo Aktif', value: promos.filter(p => p.status === 'active').length, cls: 'bg-green-100 text-green-600 dark:bg-green-900/30' },
 { label: 'Total Penggunaan', value: '740', cls: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' },
 { label: 'Kadaluarsa', value: promos.filter(p => p.status === 'expired').length, cls: 'bg-muted text-muted-foreground' },
 ].map(({ label, value, cls }) => (
 <div key={label} className="card p-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${cls}`}><Tag size={20} weight="duotone" /></div>
 <p className="text-2xl font-black">{value}</p>
 <p className="text-xs text-muted-foreground">{label}</p>
 </div>
 ))}
 </div>
 <button className="btn-primary shrink-0"><Plus size={18} /> Buat Promo</button>
 </div>
 <div className="card overflow-hidden">
 <table className="w-full text-sm">
 <thead className="border-b border-border bg-muted/20">
 <tr>{['ID','Kode','Tipe','Nilai','Min. Transaksi','Penggunaan','Kadaluarsa','Status','Aksi'].map(h => <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
 </thead>
 <tbody className="divide-y divide-border">
 {promos.map(p => (
 <tr key={p.id} className="hover:bg-muted/30 group">
 <td className="px-4 py-3 font-mono text-xs">{p.id}</td>
 <td className="px-4 py-3"><span className="font-mono font-bold bg-muted px-2 py-0.5 rounded-lg text-xs">{p.code}</span></td>
 <td className="px-4 py-3 text-xs">{p.type}</td>
 <td className="px-4 py-3 font-bold text-primary">{p.value}</td>
 <td className="px-4 py-3 text-xs">{p.minTx}</td>
 <td className="px-4 py-3">
 <div className="flex items-center gap-2">
 <div className="flex-1 bg-muted rounded-full h-1.5 w-20"><div className="bg-primary h-full rounded-full" style={{ width: `${Math.min((p.used / p.limit) * 100, 100)}%` }} /></div>
 <span className="text-xs text-muted-foreground">{p.used}/{p.limit}</span>
 </div>
 </td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{p.expires}</td>
 <td className="px-4 py-3"><span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${statusCls[p.status]}`}>{statusLabel[p.status]}</span></td>
 <td className="px-4 py-3">
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button className="p-1.5 rounded-lg hover:bg-muted"><Pencil size={14} /></button>
 <button className="p-1.5 rounded-lg hover:bg-red-100 text-red-600"><Trash size={14} /></button>
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
