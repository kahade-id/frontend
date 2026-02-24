import { motion } from 'framer-motion';
import {
 Wallet, ArrowsClockwise, CheckCircle, Star,
 Plus, ArrowDown, ArrowUp, FileText, ArrowRight,
 TrendUp, TrendDown, Clock, ShieldCheck
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Link } from 'wouter';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';

const metrics = [
 { icon: Wallet, label: 'Saldo Dompet', value: 'Rp 2.500.000', delta: '+Rp 500K', positive: true },
 { icon: ArrowsClockwise, label: 'Transaksi Aktif', value: '3', delta: 'Dalam proses', positive: null },
 { icon: CheckCircle, label: 'Selesai', value: '47', delta: '+5 bulan ini', positive: true },
 { icon: Star, label: 'Reward Poin', value: '1.240', delta: 'Level: Silver', positive: null },
];

const recentTransactions = [
 { id: 'KHD-2451', title: 'Laptop ASUS ROG', amount: 'Rp 5.200.000', status: 'active', label: 'Aktif', party: '@seller_081' },
 { id: 'KHD-2449', title: 'Jasa Logo Design', amount: 'Rp 800.000', status: 'completed', label: 'Selesai', party: '@jasa_design' },
 { id: 'KHD-2447', title: 'iPhone 15 Pro', amount: 'Rp 12.000.000', status: 'pending', label: 'Menunggu', party: '@iphone_store' },
];

const activities = [
 { text: 'Dana masuk Rp 2.5M dari #KHD-2449', time: '2 jam lalu', icon: TrendUp, color: 'text-green-600' },
 { text: 'Transaksi #KHD-2451 dikonfirmasi', time: '5 jam lalu', icon: CheckCircle, color: 'text-blue-600' },
 { text: 'KYC Anda telah disetujui', time: 'Kemarin', icon: ShieldCheck, color: 'text-primary' },
 { text: 'Reward 50 pts dari transaksi selesai', time: 'Kemarin', icon: Star, color: 'text-yellow-500' },
];

const quickActions = [
 { label: 'Transaksi Baru', icon: Plus, href: '/transactions/create', primary: true },
 { label: 'Deposit', icon: ArrowDown, href: '/wallet/deposit', primary: false },
 { label: 'Tarik Dana', icon: ArrowUp, href: '/wallet', primary: false },
 { label: 'Laporan', icon: FileText, href: '/activity', primary: false },
];

const statusStyles: Record<string, string> = {
 active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
 completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
 pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
 dispute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const now = new Date();
const hour = now.getHours();
const greeting = hour < 12 ? 'pagi' : hour < 17 ? 'siang' : 'malam';

export default function Dashboard() {
 const { user } = useAuth();
 const userName = user?.username || 'Pengguna';
 return (
 <DashboardLayout>
 <div className="p-6 max-w-6xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 {/* Header */}
 <motion.div variants={staggerItem} className="flex items-start justify-between mb-8">
 <div>
 <h1 className="text-2xl font-bold">Selamat {greeting}, {userName}! 👋</h1>
 <p className="text-muted-foreground text-sm mt-1">
 {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
 </p>
 </div>
 <Link href="/transactions/create" className="btn-primary inline-flex">
 <Plus size={18} /> Transaksi Baru
 </Link>
 </motion.div>

 {/* Metric Cards */}
 <motion.div variants={staggerItem} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
 {metrics.map((m) => {
 const Icon = m.icon;
 return (
 <div key={m.label} className="card p-5 transition-shadow duration-200">
 <div className="flex items-start justify-between mb-4">
 <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
 <Icon size={20} className="text-primary" weight="duotone" />
 </div>
 {m.positive !== null && (
 <span className={`text-xs font-semibold flex items-center gap-0.5 ${m.positive ? 'text-green-600' : 'text-red-600'}`}>
 {m.positive ? <TrendUp size={12} /> : <TrendDown size={12} />}
 {m.delta}
 </span>
 )}
 </div>
 <p className="text-2xl font-black tracking-tight">{m.value}</p>
 <p className="text-sm text-muted-foreground mt-1">{m.label}</p>
 {m.positive === null && <p className="text-xs text-muted-foreground">{m.delta}</p>}
 </div>
 );
 })}
 </motion.div>

 {/* Main Grid */}
 <motion.div variants={staggerItem} className="grid lg:grid-cols-[1fr_380px] gap-6 mb-6">
 {/* Recent Transactions */}
 <div className="card p-6">
 <div className="flex items-center justify-between mb-5">
 <h2 className="font-bold">Transaksi Terbaru</h2>
 <Link href="/transactions" className="text-sm text-primary hover:underline flex items-center gap-1">
 Lihat semua <ArrowRight size={14} />
 </Link>
 </div>
 <div className="space-y-3">
 {recentTransactions.map((tx) => (
 <Link key={tx.id} href={`/transactions/${tx.id}`}>
 <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
 {tx.id.slice(-3)}
 </div>
 <div>
 <p className="font-medium text-sm group-hover:text-primary transition-colors">{tx.title}</p>
 <p className="text-xs text-muted-foreground">#{tx.id} · {tx.party}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="font-semibold text-sm">{tx.amount}</p>
 <span className={`text-[0.625rem] font-semibold px-2 py-0.5 rounded-full ${statusStyles[tx.status]}`}>{tx.label}</span>
 </div>
 </div>
 </Link>
 ))}
 </div>
 </div>

 {/* Activity Feed */}
 <div className="card p-6">
 <h2 className="font-bold mb-5">Aktivitas Terkini</h2>
 <div className="space-y-4">
 {activities.map((act, i) => {
 const Icon = act.icon;
 return (
 <div key={i} className="flex items-start gap-3">
 <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
 <Icon size={16} className={act.color} />
 </div>
 <div>
 <p className="text-sm leading-snug">{act.text}</p>
 <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
 <Clock size={10} />{act.time}
 </p>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </motion.div>

 {/* Quick Actions */}
 <motion.div variants={staggerItem}>
 <h2 className="font-bold mb-4">Aksi Cepat</h2>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 {quickActions.map((qa) => {
 const Icon = qa.icon;
 return (
 <Link key={qa.label} href={qa.href}>
 <div className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:-translate-y-0.5 ${qa.primary ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'bg-background border-border hover:border-primary '}`}>
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${qa.primary ? 'bg-white/20' : 'bg-muted'}`}>
 <Icon size={20} className={qa.primary ? 'text-white' : 'text-primary'} weight="duotone" />
 </div>
 <span className="text-sm font-semibold">{qa.label}</span>
 </div>
 </Link>
 );
 })}
 </div>
 </motion.div>
 </motion.div>
 </div>
 </DashboardLayout>
 );
}
