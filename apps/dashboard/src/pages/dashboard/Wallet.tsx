import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowsLeftRight, CopySimple, Check, Clock } from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { staggerContainer, staggerItem } from '@kahade/utils';

const txHistory = [
 { type: 'deposit', label: 'Deposit dari BCA', amount: '+Rp 1.000.000', date: '20 Feb 2026 · 14:23', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
 { type: 'incoming', label: 'Dana cair dari #KHD-2449', amount: '+Rp 800.000', date: '19 Feb 2026 · 18:00', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
 { type: 'outgoing', label: 'Escrow #KHD-2451', amount: '-Rp 5.200.000', date: '18 Feb 2026 · 11:05', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
 { type: 'withdrawal', label: 'Penarikan ke BCA *1234', amount: '-Rp 2.000.000', date: '15 Feb 2026 · 10:00', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
];

const filters = ['Semua', 'Deposit', 'Penarikan', 'Dana Masuk', 'Dana Keluar'];
const vaNumber = '7008 1234 5678 9012';

export default function Wallet() {
 const [activeFilter, setActiveFilter] = useState('Semua');
 const [showDeposit, setShowDeposit] = useState(false);
 const [copied, setCopied] = useState(false);
 const [countdown] = useState('01:45:32');

 const copyVA = () => { navigator.clipboard.writeText(vaNumber.replace(/\s/g, '')); setCopied(true); setTimeout(() => setCopied(false), 2000); };

 return (
 <DashboardLayout>
 <div className="p-6 max-w-4xl mx-auto">
 <h1 className="text-2xl font-bold mb-6">Dompet</h1>

 {/* Balance Card */}
 <motion.div variants={staggerContainer} initial="initial" animate="animate">
 <motion.div variants={staggerItem} className="bg-primary text-primary-foreground rounded-3xl p-8 mb-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
 <p className="text-primary-foreground/60 text-sm mb-2">Saldo Dompet Anda</p>
 <p className="text-4xl font-black mb-6">Rp 2.500.000</p>
 <div className="flex gap-3 flex-wrap relative z-10">
 <button onClick={() => setShowDeposit(true)} className="flex items-center gap-2 bg-white text-primary px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors">
 <ArrowDown size={18} /> Deposit
 </button>
 <button className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors">
 <ArrowUp size={18} /> Tarik
 </button>
 <button className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/20 transition-colors">
 <ArrowsLeftRight size={18} /> Transfer
 </button>
 </div>
 </motion.div>

 {/* VA Box (shown after deposit clicked) */}
 {showDeposit && (
 <motion.div variants={staggerItem} className="card p-6 mb-6 border-primary/30 bg-primary/5">
 <p className="font-bold mb-4">Transfer ke Virtual Account BCA:</p>
 <div className="flex items-center justify-between bg-background border-2 border-border rounded-xl px-4 py-3 mb-3">
 <span className="text-xl font-black tracking-widest">{vaNumber}</span>
 <button onClick={copyVA} className="ml-4 flex items-center gap-1.5 text-sm text-primary font-semibold">
 {copied ? <Check size={16} /> : <CopySimple size={16} />} {copied ? 'Disalin!' : 'Salin'}
 </button>
 </div>
 <p className="text-sm font-semibold mb-1">Nominal TEPAT: <span className="text-primary">Rp 1.000.000</span></p>
 <p className="text-xs text-muted-foreground mb-3">(Jangan lebih atau kurang)</p>
 <div className="flex items-center gap-2 text-sm text-orange-600">
 <Clock size={16} /><span>Berlaku hingga: <strong>{countdown}</strong></span>
 </div>
 </motion.div>
 )}

 {/* Filter + History */}
 <motion.div variants={staggerItem}>
 <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
 {filters.map(f => (
 <button key={f} onClick={() => setActiveFilter(f)} className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>{f}</button>
 ))}
 </div>
 <div className="card overflow-hidden">
 {txHistory.map((tx, i) => (
 <div key={i} className="flex items-center justify-between p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.color}`}>
 {tx.type === 'deposit' || tx.type === 'incoming' ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
 </div>
 <div>
 <p className="font-medium text-sm">{tx.label}</p>
 <p className="text-xs text-muted-foreground">{tx.date}</p>
 </div>
 </div>
 <span className={`font-bold text-sm ${tx.amount.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>{tx.amount}</span>
 </div>
 ))}
 </div>
 </motion.div>
 </motion.div>
 </div>
 </DashboardLayout>
 );
}
