import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 ShoppingCart, Laptop, House, Car,
 CheckCircle, ArrowRight, TrendUp, Clock, ShieldCheck
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { PageHero } from '../components/common/PageHero';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

const useCases = [
 {
 icon: ShoppingCart,
 title: 'Marketplace & E-commerce',
 shortDesc: 'Transaksi aman dengan penjual yang belum dikenal.',
 stats: [{ label: 'Pengguna', value: '6.000+' }, { label: 'Avg. Transaksi', value: 'Rp 2.5M' }, { label: 'Sukses', value: '99.8%' }],
 description: 'Di marketplace, pembeli sering ragu bertransaksi dengan penjual baru. Kahade menghilangkan keraguan itu dengan menjamin dana pembeli aman hingga barang diterima.',
 benefits: [
 'Pembeli bisa belanja dari penjual mana pun dengan tenang',
 'Penjual mendapat jaminan pembayaran sebelum kirim barang',
 'Sengketa diselesaikan secara adil oleh tim mediasi',
 'Riwayat transaksi lengkap untuk referensi future',
 ],
 color: 'from-blue-500/20 to-blue-500/5',
 },
 {
 icon: Laptop,
 title: 'Jasa Freelance',
 shortDesc: 'Jaminan pembayaran untuk freelancer dan klien.',
 stats: [{ label: 'Freelancer', value: '2.000+' }, { label: 'Avg. Proyek', value: 'Rp 5M' }, { label: 'On-time', value: '97%' }],
 description: 'Freelancer sering menghadapi klien yang kabur setelah pekerjaan selesai. Klien pun takut membayar di muka tanpa jaminan hasil. Kahade menyelesaikan kedua masalah ini.',
 benefits: [
 'Milestone payment — bayar bertahap sesuai progress',
 'Freelancer mulai kerja setelah dana aman di escrow',
 'Klien bayar hanya jika pekerjaan sesuai brief',
 'Kontrak digital yang legally binding',
 ],
 color: 'from-purple-500/20 to-purple-500/5',
 },
 {
 icon: House,
 title: 'Properti',
 shortDesc: 'Transaksi sewa atau jual-beli properti yang aman.',
 stats: [{ label: 'Transaksi', value: '500+' }, { label: 'Avg. Nilai', value: 'Rp 50M' }, { label: 'Waktu Selesai', value: '< 3 hari' }],
 description: 'Transaksi properti melibatkan nilai besar dan banyak pihak. Kahade memastikan proses berjalan lancar dengan dana yang aman hingga semua syarat terpenuhi.',
 benefits: [
 'Cocok untuk booking fee, uang muka, hingga full payment',
 'Integrasi notaris dan agen properti',
 'Dokumen legal tersimpan aman di platform',
 'Pencairan otomatis saat kondisi terpenuhi',
 ],
 color: 'from-green-500/20 to-green-500/5',
 },
 {
 icon: Car,
 title: 'Otomotif & Barang Besar',
 shortDesc: 'Beli-jual kendaraan dengan perlindungan penuh.',
 stats: [{ label: 'Kendaraan', value: '800+' }, { label: 'Avg. Nilai', value: 'Rp 80M' }, { label: 'Dispute Rate', value: '< 1%' }],
 description: 'Jual-beli kendaraan bekas online berisiko tinggi. Kahade memastikan pembeli mendapat kendaraan sesuai deskripsi dan penjual mendapat pembayaran penuh.',
 benefits: [
 'Dana aman hingga inspeksi kendaraan selesai',
 'Periode inspeksi 3-7 hari yang fleksibel',
 'Coverage untuk motor, mobil, hingga alat berat',
 'Integrasi cek BPKB dan STNK digital',
 ],
 color: 'from-orange-500/20 to-orange-500/5',
 },
];

export default function UseCases() {
 const [active, setActive] = useState<number | null>(null);

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <PageHero eyebrow="Use Cases" title="Kahade untuk Berbagai Kebutuhan" description="Satu platform escrow untuk marketplace, jasa freelance, jual beli aset digital, dan banyak skenario lain." chips={[{ label: 'Marketplace' }, { label: 'Freelance' }, { label: 'B2B' } ]} />

 {/* USE CASE CARDS 2x2 */}
 <section className="section-padding-lg">
 <div className="container">
 <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
 {useCases.map((uc, i) => {
 const Icon = uc.icon;
 const isActive = active === i;
 return (
 <motion.div key={i} variants={staggerItem} initial="initial" whileInView="animate" viewport={viewport}>
 <div
 className={`card overflow-hidden transition-all duration-300 ${isActive ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50 hover:-translate-y-1'}`}
 onClick={() => setActive(isActive ? null : i)}
 >
 <div className={`bg-gradient-to-br ${uc.color} p-8 pb-6`}>
 <div className="flex items-start justify-between mb-6">
 <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
 <Icon size={32} className="text-foreground" weight="duotone" />
 </div>
 <div className="grid grid-cols-3 gap-4">
 {uc.stats.map(s => (
 <div key={s.label} className="text-center">
 <div className="text-lg font-bold">{s.value}</div>
 <div className="text-xs text-muted-foreground">{s.label}</div>
 </div>
 ))}
 </div>
 </div>
 <h2 className="text-xl font-bold mb-2">{uc.title}</h2>
 <p className="text-muted-foreground text-sm">{uc.shortDesc}</p>
 </div>
 <div className="px-8 py-4 flex items-center justify-between text-sm font-medium text-primary">
 <span>{isActive ? 'Tutup detail' : 'Lihat detail'}</span>
 <ArrowRight size={16} className={`transition-transform ${isActive ? 'rotate-90' : ''}`} />
 </div>

 {/* Detail Accordion */}
 <AnimatePresence>
 {isActive && (
 <motion.div
 initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
 className="overflow-hidden"
 >
 <div className="px-8 pb-8 pt-4 border-t border-border">
 <p className="text-muted-foreground text-sm mb-5 leading-relaxed">{uc.description}</p>
 <div className="space-y-2.5">
 {uc.benefits.map((b) => (
 <div key={b} className="flex items-start gap-3">
 <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" weight="fill" />
 <span className="text-sm">{b}</span>
 </div>
 ))}
 </div>
 <Button asChild variant="primary" className="mt-6">
 <Link href="https://app.kahade.id/register">
 Mulai Sekarang <ArrowRight size={16} />
 </Link>
 </Button>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </motion.div>
 );
 })}
 </div>
 </div>
 </section>

 {/* STATS */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container max-w-4xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport} className="grid md:grid-cols-3 gap-8 text-center">
 {[
 { icon: TrendUp, value: 'Rp 50M+', label: 'Dana Diamankan' },
 { icon: Clock, label: 'Rata-rata Pencairan', value: '< 12 jam' },
 { icon: ShieldCheck, label: 'Tingkat Keberhasilan', value: '99.8%' },
 ].map(({ icon: Icon, value, label }) => (
 <motion.div key={label} variants={staggerItem} className="text-center">
 <Icon size={32} className="text-primary mx-auto mb-3" weight="duotone" />
 <div className="text-3xl font-bold mb-1">{value}</div>
 <div className="text-sm text-muted-foreground">{label}</div>
 </motion.div>
 ))}
 </motion.div>
 </div>
 </section>

 <Footer />
 </div>
 );
}