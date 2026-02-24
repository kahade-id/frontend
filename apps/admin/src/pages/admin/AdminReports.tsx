import { useMemo, useState } from 'react';
import { Download, TrendUp, CurrencyDollar, Users, ArrowsLeftRight } from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Button } from '@kahade/ui';

const monthlyData = [
 { month: 'Okt', volume: 38.2, tx: 1240, users: 320, revenue: 954 },
 { month: 'Nov', volume: 44.1, tx: 1480, users: 415, revenue: 1102 },
 { month: 'Des', volume: 52.8, tx: 1820, users: 560, revenue: 1320 },
 { month: 'Jan', volume: 48.5, tx: 1620, users: 490, revenue: 1212 },
 { month: 'Feb', volume: 58.3, tx: 1950, users: 620, revenue: 1457 },
];

const periodMap: Record<string, number> = {
 '7 hari': 1,
 '30 hari': 2,
 '3 bulan': 3,
 '6 bulan': monthlyData.length,
 '1 tahun': monthlyData.length,
};

export default function AdminReports() {
 const [period, setPeriod] = useState('6 bulan');
 const rows = useMemo(() => {
  const take = periodMap[period] ?? monthlyData.length;
  return monthlyData.slice(-take);
 }, [period]);
 const maxVol = Math.max(...rows.map((d) => d.volume));

 const totals = useMemo(() => rows.reduce((acc, item) => ({
  volume: acc.volume + item.volume,
  tx: acc.tx + item.tx,
  users: acc.users + item.users,
  revenue: acc.revenue + item.revenue,
 }), { volume: 0, tx: 0, users: 0, revenue: 0 }), [rows]);

 const handleDownload = () => {
  const content = [
   ['Bulan', 'Volume (Rp Juta)', 'Transaksi', 'User Baru', 'Revenue (Rp Ribu)'].join(','),
   ...rows.map((d) => [d.month, d.volume, d.tx, d.users, d.revenue].join(',')),
  ].join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `laporan-${period.replace(/\s+/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
 };

 return (
 <AdminLayout title="Laporan & Analitik" subtitle="Data performa platform Kahade">
 <div className="space-y-6">
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
 {['7 hari','30 hari','3 bulan','6 bulan','1 tahun'].map(p => (
 <Button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${period === p ? 'bg-background ' : 'text-muted-foreground hover:text-foreground'}`}>{p}</Button>
 ))}
 </div>
 <Button onClick={handleDownload}  variant="secondary" className="gap-2 text-sm"><Download size={16} /> Unduh Laporan</Button>
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 {[
 { icon: CurrencyDollar, label: 'Total Volume', value: `Rp ${totals.volume.toFixed(1)}M`, delta: '+21%' },
 { icon: ArrowsLeftRight, label: 'Total Transaksi', value: totals.tx.toLocaleString('id-ID'), delta: '+18%' },
 { icon: Users, label: 'User Baru', value: totals.users.toLocaleString('id-ID'), delta: '+32%' },
 { icon: TrendUp, label: 'Total Revenue', value: `Rp ${totals.revenue.toLocaleString('id-ID')}K`, delta: '+21%' },
 ].map(({ icon: Icon, label, value, delta }) => (
 <div key={label} className="card p-5">
 <div className="flex items-start justify-between mb-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Icon size={18} className="text-primary" weight="duotone" /></div>
 <span className="text-xs font-bold text-green-600 flex items-center gap-0.5"><TrendUp size={11} />{delta}</span>
 </div>
 <p className="text-xl font-black">{value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
 </div>
 ))}
 </div>

 <div className="card p-6">
 <h2 className="font-bold mb-6">Volume Transaksi (Rp Juta) — {period}</h2>
 <div className="flex items-end gap-6 h-48" role="img" aria-label={`Grafik volume transaksi untuk periode ${period}`}>
 {rows.map(d => (
 <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
 <span className="text-xs font-bold text-primary">{d.volume}M</span>
 <div className="w-full rounded-t-xl bg-primary/70 hover:bg-primary transition-colors cursor-pointer" style={{ height: `${(d.volume / maxVol) * 160}px` }} />
 <span className="text-xs text-muted-foreground">{d.month}</span>
 </div>
 ))}
 </div>
 </div>

 <div className="card overflow-hidden">
 <div className="px-5 py-4 border-b border-border font-bold">Detail per Bulan</div>
 <table className="w-full text-sm">
 <thead className="border-b border-border bg-muted/20">
 <tr>{['Bulan','Volume (Rp)','Transaksi','User Baru','Revenue (Rp)'].map(h => <th key={h} className="px-5 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
 </thead>
 <tbody className="divide-y divide-border">
 {rows.map(d => (
 <tr key={d.month} className="hover:bg-muted/30">
 <td className="px-5 py-3 font-semibold">{d.month} '25</td>
 <td className="px-5 py-3">Rp {d.volume}M</td>
 <td className="px-5 py-3">{d.tx.toLocaleString('id-ID')}</td>
 <td className="px-5 py-3">{d.users}</td>
 <td className="px-5 py-3 text-green-600 font-semibold">Rp {d.revenue}K</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </AdminLayout>
 );
}
