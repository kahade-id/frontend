import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
 Users, ArrowsLeftRight, CurrencyDollar, Warning,
 IdentificationCard, TrendUp, TrendDown, ArrowRight,
 CheckCircle, Clock, Eye, Download
} from '@phosphor-icons/react';
import AdminLayout from '../../components/layout/AdminLayout';
import { staggerContainer, staggerItem } from '@kahade/utils';
import { Button } from '@kahade/ui';

const metrics = [
 { icon: Users, label: 'Total Pengguna', value: '10.284', delta: '+284', positive: true },
 { icon: ArrowsLeftRight, label: 'Transaksi Aktif', value: '342', delta: '+18', positive: true },
 { icon: CurrencyDollar, label: 'Total Volume', value: 'Rp 52.4M', delta: '+Rp 2.1M', positive: true },
 { icon: IdentificationCard, label: 'KYC Pending', value: '47', delta: '+12', positive: false },
 { icon: Warning, label: 'Sengketa Aktif', value: '8', delta: '-3', positive: true },
 { icon: TrendUp, label: 'Revenue Hari Ini', value: 'Rp 8.2M', delta: '+12%', positive: true },
];

const recentTx = [
 { id: 'KHD-2451', title: 'Laptop ASUS ROG', buyer: 'ahmad@email.com', seller: 'seller_081', amount: 'Rp 5.200.000', status: 'active', label: 'Aktif' },
 { id: 'KHD-2450', title: 'iPhone 15 Pro', buyer: 'budi@email.com', seller: 'store@email.com', amount: 'Rp 14.500.000', status: 'completed', label: 'Selesai' },
 { id: 'KHD-2449', title: 'Jasa Logo Design', buyer: 'sari@email.com', seller: 'designer@email.com', amount: 'Rp 800.000', status: 'completed', label: 'Selesai' },
 { id: 'KHD-2448', title: 'Kamera Sony A7', buyer: 'rizki@email.com', seller: 'camera@email.com', amount: 'Rp 18.000.000', status: 'dispute', label: 'Sengketa' },
 { id: 'KHD-2447', title: 'MacBook Air M2', buyer: 'maya@email.com', seller: 'apple@email.com', amount: 'Rp 15.000.000', status: 'pending', label: 'Menunggu' },
];

const pendingActions = [
 { label: '47 verifikasi KYC menunggu', href: '/admin/kyc', emoji: '✓', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
 { label: '12 penarikan pending', href: '/admin/withdrawals', emoji: '↓', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
 { label: '8 sengketa perlu tindakan', href: '/admin/disputes', emoji: '⚠', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
];

const statusCls: Record<string, string> = {
 active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
 completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 dispute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AdminDashboard() {
 return (
 <AdminLayout title="Dashboard" subtitle="Ikhtisar platform Kahade">
 <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">

 <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
 {metrics.map((m) => {
 const Icon = m.icon;
 return (
 <div key={m.label} className="card p-4 transition-shadow">
 <div className="flex items-start justify-between mb-3">
 <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
 <Icon size={18} className="text-primary" weight="duotone" />
 </div>
 <span className={`text-xs font-bold flex items-center gap-0.5 ${m.positive ? 'text-green-600' : 'text-red-600'}`}>
 {m.positive ? <TrendUp size={11} /> : <TrendDown size={11} />}{m.delta}
 </span>
 </div>
 <p className="text-xl font-black">{m.value}</p>
 <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
 </div>
 );
 })}
 </motion.div>

 <motion.div variants={staggerItem} className="grid lg:grid-cols-[1fr_300px] gap-6">
 <div className="card p-6">
 <div className="flex items-center justify-between mb-5">
 <div>
 <h2 className="font-bold">Volume Transaksi</h2>
 <p className="text-xs text-muted-foreground">30 hari terakhir</p>
 </div>
 <select className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
 <option>30 hari</option><option>7 hari</option><option>90 hari</option>
 </select>
 </div>
 <div className="flex items-end gap-1 h-40 px-2">
 {chartData.map((h, i) => (
 <div key={i} className="bg-primary/30 hover:bg-primary/60 rounded-t-sm flex-1 transition-colors cursor-pointer" style={{ height: `${h}%` }} title={`Hari ${i+1}`} />
 ))}
 </div>
 </div>

 <div className="card p-6">
 <h2 className="font-bold mb-4">Aksi Diperlukan</h2>
 <div className="space-y-3">
 {pendingActions.map((a) => (
 <Link key={a.label} href={a.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${a.color}`}>{a.emoji}</div>
 <p className="text-sm flex-1">{a.label}</p>
 <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
 </Link>
 ))}
 </div>
 </div>
 </motion.div>

 <motion.div variants={staggerItem} className="card overflow-hidden">
 <div className="flex items-center justify-between px-5 py-4 border-b border-border">
 <h2 className="font-bold">Transaksi Terbaru</h2>
 <Link href="/admin/transactions">
 <Button className="text-sm text-primary hover:underline flex items-center gap-1">Lihat semua <ArrowRight size={14} /></Button>
 </Link>
 </div>
 <table className="w-full text-sm">
 <thead className="bg-muted/40 border-b border-border">
 <tr>{['ID','Transaksi','Pembeli','Penjual','Nilai','Status',''].map(h => <th key={h} className="px-4 py-3 text-left text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
 </thead>
 <tbody className="divide-y divide-border">
 {recentTx.map((tx) => (
 <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
 <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tx.id}</td>
 <td className="px-4 py-3 font-semibold">{tx.title}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{tx.buyer}</td>
 <td className="px-4 py-3 text-xs text-muted-foreground">{tx.seller}</td>
 <td className="px-4 py-3 font-semibold">{tx.amount}</td>
 <td className="px-4 py-3"><span className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${statusCls[tx.status]}`}>{tx.label}</span></td>
 <td className="px-4 py-3"><Button className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all"><Eye size={14} /></Button></td>
 </tr>
 ))}
 </tbody>
 </table>
 </motion.div>

 </motion.div>
 </AdminLayout>
 );
}
