import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 UserPlus, CurrencyDollar, Package, CheckCircle, Wallet,
 ShoppingCart, Laptop, House, Car, ArrowRight, Question
} from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { PageHero } from '../components/common/PageHero';
import { staggerContainer, staggerItem, fadeInUp, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

const steps = [
 {
 number: '01',
 icon: UserPlus,
 title: 'Buat Transaksi',
 description: 'Pembeli atau penjual membuat transaksi di Kahade. Tentukan nilai, deskripsi barang/jasa, dan undang pihak lainnya via email atau link. Seluruh proses kurang dari 5 menit.',
 detail: 'Anda mengisi formulir sederhana: nama barang/jasa, nilai transaksi, dan syarat-syarat yang harus dipenuhi. Pihak lain akan menerima email undangan untuk bergabung.',
 },
 {
 number: '02',
 icon: CurrencyDollar,
 title: 'Pembeli Deposit',
 description: 'Pembeli melakukan deposit ke rekening escrow Kahade yang aman. Dana tidak dapat diakses oleh siapapun hingga transaksi selesai. Konfirmasi instan.',
 detail: 'Tersedia berbagai metode pembayaran: transfer bank via virtual account, QRIS, dan e-wallet. Dana langsung dikonfirmasi dan status transaksi berubah ke "Dana Diterima".',
 },
 {
 number: '03',
 icon: Package,
 title: 'Penjual Kirim',
 description: 'Setelah dana terkonfirmasi, penjual dapat mengirimkan barang atau memulai pengerjaan jasa dengan tenang. Upload bukti pengiriman ke platform.',
 detail: 'Penjual mendapat notifikasi bahwa dana sudah aman di escrow dan dapat segera mengirimkan barang. Semua bukti pengiriman dan tracking bisa diupload langsung ke platform.',
 },
 {
 number: '04',
 icon: CheckCircle,
 title: 'Pembeli Konfirmasi',
 description: 'Setelah menerima barang/jasa dengan memuaskan, pembeli mengkonfirmasi di aplikasi. Proses konfirmasi mudah dan cepat.',
 detail: 'Pembeli memeriksa barang/jasa, lalu menekan tombol "Konfirmasi Selesai". Jika ada masalah, pembeli dapat mengajukan sengketa dengan menyertakan bukti.',
 },
 {
 number: '05',
 icon: Wallet,
 title: 'Dana Dicairkan',
 description: 'Setelah konfirmasi, dana otomatis dicairkan ke rekening penjual dalam waktu kurang dari 12 jam. Transaksi selesai, semua pihak puas.',
 detail: 'Dana langsung masuk ke saldo wallet penjual di Kahade. Penjual dapat menarik dana ke rekening bank kapan saja. Biaya platform (2.5%) dipotong otomatis dari jumlah pencairan.',
 },
];

const useCases = [
 { icon: ShoppingCart, label: 'Belanja Online', description: 'Aman bertransaksi dengan penjual yang belum dikenal.' },
 { icon: Laptop, label: 'Jasa Freelance', description: 'Jaminan pembayaran untuk freelancer dan klien.' },
 { icon: House, label: 'Properti', description: 'Transaksi sewa atau jual-beli properti yang aman.' },
 { icon: Car, label: 'Otomotif', description: 'Beli-jual kendaraan dengan perlindungan penuh.' },
];

const miniFaqs = [
 { q: 'Berapa biaya menggunakan Kahade?', a: 'Biaya platform adalah 2.5% dari nilai transaksi, ditanggung oleh penjual. Tidak ada biaya tersembunyi.' },
 { q: 'Berapa lama proses pencairan dana?', a: 'Setelah konfirmasi pembeli, dana dicairkan dalam kurang dari 12 jam pada hari kerja.' },
 { q: 'Apa yang terjadi jika ada sengketa?', a: 'Anda bisa mengajukan sengketa, tim mediasi kami akan meninjau dan memberikan keputusan dalam 3-5 hari.' },
 { q: 'Apakah dana saya aman?', a: 'Dana disimpan di rekening escrow terpisah yang diaudit secara berkala. Tidak bisa diakses oleh siapapun kecuali sesuai kondisi transaksi.' },
 { q: 'Bisa digunakan untuk bisnis apa saja?', a: 'Kahade cocok untuk semua jenis transaksi online: marketplace, freelance, properti, otomotif, dan masih banyak lagi.' },
];

export default function HowItWorks() {
 const [openFaq, setOpenFaq] = useState<number | null>(null);

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <PageHero eyebrow="Cara Kerja" title="Bagaimana Kahade Melindungi Transaksi Anda" description="Alur escrow sederhana dari pembayaran hingga pencairan dana dengan perlindungan kedua pihak." chips={[{ label: 'Escrow Flow' }, { label: 'Verifikasi' }, { label: 'Penyelesaian Aman' } ]} />

 {/* FLOW VISUAL */}
 <section className="py-12 border-b overflow-hidden bg-muted/30">
 <div className="container">
 <div className="flex items-center justify-center gap-0 overflow-x-auto no-scrollbar">
 {['Pembeli', 'Buat Transaksi', 'Deposit', 'Kahade Escrow', 'Konfirmasi', 'Pencairan', 'Penjual'].map((step, i, arr) => (
 <div key={step} className="flex items-center shrink-0">
 <div className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
 step === 'Kahade Escrow' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border'
 }`}>{step}</div>
 {i < arr.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* DETAILED STEPS */}
 <section className="section-padding-lg">
 <div className="container max-w-5xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport} className="space-y-12">
 {steps.map((step, i) => {
 const Icon = step.icon;
 return (
 <motion.div key={i} variants={staggerItem} className={`grid md:grid-cols-2 gap-8 items-center ${i % 2 === 1 ? 'md:grid-flow-dense' : ''}`}>
 <div className={i % 2 === 1 ? 'md:col-start-2' : ''}>
 <div className="flex items-center gap-4 mb-4 w-full">
 <span className="text-5xl font-black text-primary/20">{step.number}</span>
 <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
 <Icon size={24} className="text-primary" weight="duotone" />
 </div>
 </div>
 <h2 className="text-2xl font-bold mb-3">{step.title}</h2>
 <p className="text-muted-foreground leading-relaxed mb-4 w-full">{step.description}</p>
 <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-4 w-full">{step.detail}</p>
 </div>
 <div className={`bg-gradient-to-br from-primary/10 to-muted rounded-3xl aspect-video border border-border flex items-center justify-center ${i % 2 === 1 ? 'md:col-start-1 md:row-start-1' : ''}`}>
 <Icon size={64} className="text-primary/30" weight="thin" />
 </div>
 </motion.div>
 );
 })}
 </motion.div>
 </div>
 </section>

 {/* USE CASES */}
 <section className="section-padding-lg bg-muted/40">
 <div className="container">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-12">
 <span className="badge badge-secondary mb-3">Cocok Untuk</span>
 <h2 className="text-3xl font-bold">Berbagai Kebutuhan Transaksi</h2>
 </motion.div>
 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
 {useCases.map((uc) => {
 const Icon = uc.icon;
 return (
 <motion.div key={uc.label} variants={staggerItem} className="card p-6 text-center group hover:border-primary hover:-translate-y-1 transition-all">
 <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
 <Icon size={28} className="text-primary" weight="duotone" />
 </div>
 <h3 className="font-bold mb-2">{uc.label}</h3>
 <p className="text-sm text-muted-foreground">{uc.description}</p>
 </motion.div>
 );
 })}
 </div>
 </motion.div>
 </div>
 </section>

 {/* MINI FAQ */}
 <section className="section-padding-lg">
 <div className="container max-w-3xl mx-auto">
 <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={viewport}>
 <motion.div variants={staggerItem} className="text-center mb-10">
 <span className="badge badge-secondary mb-3">FAQ</span>
 <h2 className="text-3xl font-bold">Pertanyaan Umum</h2>
 </motion.div>
 <div className="space-y-2">
 {miniFaqs.map((faq, i) => (
 <motion.div key={i} variants={staggerItem} className="border border-border rounded-xl overflow-hidden">
 <Button
 onClick={() => setOpenFaq(openFaq === i ? null : i)}
 className="w-full text-left p-5 flex items-center justify-between gap-4 hover:text-primary transition-colors"
 >
 <span className="font-semibold text-sm">{faq.q}</span>
 <Question size={20} className={`shrink-0 transition-transform ${openFaq === i ? 'rotate-45' : ''}`} />
 </Button>
 <AnimatePresence>
 {openFaq === i && (
 <motion.div
 initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
 className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed"
 >
 {faq.a}
 </motion.div>
 )}
 </AnimatePresence>
 </motion.div>
 ))}
 </div>
 </motion.div>
 </div>
 </section>

 {/* FINAL CTA */}
 <section className="section-padding-md bg-primary text-primary-foreground">
 <div className="container text-center max-w-2xl mx-auto">
 <h2 className="text-3xl font-bold mb-4">Siap bertransaksi dengan aman?</h2>
 <p className="text-primary-foreground/70 mb-8">Daftar gratis dan buat transaksi pertama Anda dalam 5 menit.</p>
 <a href="https://app.kahade.id/register">
 <Button className="bg-white text-primary font-semibold px-8 py-3.5 rounded-xl hover:bg-white/90 transition-colors inline-flex items-center gap-2">
 Mulai Gratis <ArrowRight size={18} />
 </Button>
 </a>
 </div>
 </section>

 <Footer />
 </div>
 );
}