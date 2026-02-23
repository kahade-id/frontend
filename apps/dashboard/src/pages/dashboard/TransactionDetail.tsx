import { useState } from 'react';
import {
 ArrowLeft, Check, FileText, Image, Clock, Warning,
 Lightning, ChatCircle, PaperclipHorizontal, PaperPlaneTilt,
 ShieldCheck, CheckCircle
} from '@phosphor-icons/react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { Link } from 'wouter';

const timeline = [
 { title: 'Transaksi dibuat', timestamp: '18 Feb 2026, 10:30', completed: true, active: false },
 { title: 'Dana disimpan di escrow', timestamp: '18 Feb 2026, 11:05', completed: true, active: false, note: 'Pembayaran Rp 5.200.000 diterima' },
 { title: 'Penjual dikonfirmasi', timestamp: '19 Feb 2026, 09:15', completed: true, active: false },
 { title: 'Menunggu konfirmasi pembeli', timestamp: 'Menunggu', completed: false, active: true },
 { title: 'Dana dilepas ke penjual', timestamp: 'Belum', completed: false, active: false },
];

const messages = [
 { sender: 'seller', text: 'Barang sudah saya kirim via JNE', time: '19 Feb, 09:15', own: false },
 { sender: 'seller', text: 'No resi: JNE-2024-XXXXX', time: '19 Feb, 09:16', own: false },
 { sender: 'me', text: 'Terima kasih, akan saya cek', time: '19 Feb, 10:30', own: true },
 { sender: 'me', text: 'Barang sudah sampai, kondisi baik 👍', time: '20 Feb, 14:00', own: true },
];

export default function TransactionDetail() {
 const [message, setMessage] = useState('');

 return (
 <DashboardLayout>
 <div className="p-6 max-w-6xl mx-auto">
 {/* Breadcrumb */}
 <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
 <Link href="/dashboard"><span className="hover:text-foreground cursor-pointer">Dashboard</span></Link>
 <span>/</span>
 <Link href="/transactions"><span className="hover:text-foreground cursor-pointer">Transaksi</span></Link>
 <span>/</span>
 <span className="text-foreground font-medium">#KHD-2451</span>
 </div>

 {/* Header */}
 <div className="card p-6 mb-6">
 <div className="flex items-start justify-between flex-wrap gap-4">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <h1 className="text-xl font-bold">Transaksi #KHD-2451</h1>
 <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">● Aktif</span>
 </div>
 <p className="text-lg font-semibold mb-1">Laptop ASUS ROG Strix G15</p>
 <p className="text-sm text-muted-foreground">Dibuat: 18 Feb 2026 · Berakhir: 25 Feb 2026</p>
 </div>
 <button className="btn-ghost gap-2 text-sm text-muted-foreground border border-border hover:border-destructive hover:text-destructive">
 <Warning size={16} /> Laporkan Masalah
 </button>
 </div>
 </div>

 {/* Main Grid */}
 <div className="grid lg:grid-cols-[1fr_380px] gap-6">
 {/* LEFT */}
 <div className="space-y-6">
 {/* Timeline */}
 <div className="card p-6">
 <h2 className="font-bold mb-6">Status Transaksi</h2>
 <div className="space-y-0 relative">
 {timeline.map((event, i) => (
 <div key={i} className="flex gap-4 relative">
 {i < timeline.length - 1 && (
 <div className={`absolute left-[19px] top-10 bottom-0 w-[2px] ${event.completed ? 'bg-green-500' : 'bg-border'}`} />
 )}
 <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${event.completed ? 'bg-green-600 text-white' : event.active ? 'bg-primary text-primary-foreground animate-pulse' : 'bg-muted text-muted-foreground'}`}>
 {event.completed ? <Check size={16} weight="bold" /> : <Clock size={16} />}
 </div>
 <div className="pb-8 flex-1 pt-1">
 <p className={`text-sm font-semibold ${event.active ? 'text-primary' : ''}`}>{event.title}</p>
 <p className="text-xs text-muted-foreground">{event.timestamp}</p>
 {event.note && <p className="text-xs text-muted-foreground mt-1.5 bg-muted px-3 py-2 rounded-lg">{event.note}</p>}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Messages */}
 <div className="card p-6">
 <h2 className="font-bold mb-4">Pesan Transaksi</h2>
 <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
 {messages.map((msg, i) => (
 <div key={i} className={`flex ${msg.own ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${msg.own ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
 {msg.text}
 <span className={`text-[0.625rem] block text-right mt-1 ${msg.own ? 'opacity-60' : 'text-muted-foreground'}`}>{msg.time}</span>
 </div>
 </div>
 ))}
 </div>
 <div className="flex gap-2 border-t border-border pt-4">
 <button className="p-2 rounded-xl hover:bg-muted transition-colors"><PaperclipHorizontal size={18} className="text-muted-foreground" /></button>
 <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Tulis pesan..." className="flex-1 px-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
 <button className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"><PaperPlaneTilt size={18} /></button>
 </div>
 </div>
 </div>

 {/* RIGHT */}
 <div className="space-y-4">
 {/* Summary */}
 <div className="card p-6">
 <h2 className="font-bold mb-4">Ringkasan Transaksi</h2>
 <div className="space-y-3 text-sm">
 {[['Nilai Transaksi', 'Rp 5.200.000'], ['Biaya Platform (2.5%)', 'Rp 130.000'], ['Total Pembayaran', 'Rp 5.330.000']].map(([label, val], i) => (
 <div key={i} className={`flex justify-between ${i === 2 ? 'border-t border-border pt-3 font-bold text-base' : ''}`}>
 <span className="text-muted-foreground">{label}</span>
 <span>{val}</span>
 </div>
 ))}
 </div>
 <div className="border-t border-border mt-4 pt-4 space-y-2 text-sm">
 <div className="flex justify-between"><span className="text-muted-foreground">Pembeli</span><span className="font-medium">Ahmad Rizki</span></div>
 <div className="flex justify-between"><span className="text-muted-foreground">Penjual</span><span className="font-medium">@seller_081</span></div>
 </div>
 </div>

 {/* Attachments */}
 <div className="card p-6">
 <h2 className="font-bold mb-4">Lampiran</h2>
 <div className="space-y-2">
 {[{ icon: FileText, name: 'Invoice.pdf', size: '124 KB' }, { icon: Image, name: 'Foto_produk.jpg', size: '2.1 MB' }].map(({ icon: Icon, name, size }) => (
 <div key={name} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
 <Icon size={20} className="text-primary shrink-0" weight="duotone" />
 <div><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{size}</p></div>
 </div>
 ))}
 </div>
 </div>

 {/* Actions */}
 <div className="card p-6 space-y-3">
 <h2 className="font-bold mb-2">Aksi</h2>
 <button className="w-full btn-primary gap-2 justify-center">
 <CheckCircle size={18} /> Konfirmasi Terima
 </button>
 <button className="w-full btn-secondary gap-2 justify-center">
 <Lightning size={18} /> Perpanjang Waktu
 </button>
 <button className="w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors flex items-center justify-center gap-2">
 <Warning size={18} /> Buka Sengketa
 </button>
 </div>
 </div>
 </div>
 </div>
 </DashboardLayout>
 );
}
