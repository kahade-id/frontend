import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { CaretDown, MagnifyingGlass, ArrowRight } from '@phosphor-icons/react';
import { Link } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { fadeInUp, viewport } from '@kahade/utils';

const faqData: Record<string, { q: string; a: string }[]> = {
 Umum: [
 { q: 'Apa itu Kahade?', a: 'Kahade adalah platform escrow digital yang mengamankan transaksi online antara pembeli dan penjual. Dana pembeli ditahan oleh Kahade hingga kedua pihak puas dengan transaksi, baru kemudian dana dicairkan ke penjual.' },
 { q: 'Siapa yang bisa menggunakan Kahade?', a: 'Siapapun yang ingin bertransaksi online dengan aman. Baik individual, UMKM, maupun perusahaan besar. Daftar gratis hanya butuh beberapa menit.' },
 { q: 'Apakah Kahade terdaftar secara resmi?', a: 'Ya. Kahade beroperasi di bawah PT Kawal Hak Dengan Aman yang terdaftar resmi di Indonesia. Kami mematuhi regulasi OJK dan Bank Indonesia.' },
 ],
 Transaksi: [
 { q: 'Bagaimana cara membuat transaksi?', a: 'Masuk ke dashboard, klik "Transaksi Baru", masukkan detail transaksi dan undang pihak lain melalui email atau link. Pihak lain akan menerima undangan dan bisa bergabung.' },
 { q: 'Berapa lama proses pencairan dana?', a: 'Setelah pembeli mengkonfirmasi penerimaan barang/jasa, dana akan dicairkan ke penjual dalam waktu kurang dari 12 jam pada hari kerja.' },
 { q: 'Apa yang terjadi jika ada sengketa?', a: 'Jika ada perselisihan, Anda bisa membuka sengketa dari halaman detail transaksi. Tim mediasi Kahade akan meninjau bukti dari kedua pihak dan memberikan keputusan dalam 3-5 hari kerja.' },
 { q: 'Bisakah transaksi dibatalkan?', a: 'Transaksi bisa dibatalkan jika belum ada pembayaran atau jika kedua pihak setuju untuk membatalkan. Dana akan dikembalikan ke pembeli dalam 1-3 hari kerja.' },
 ],
 Pembayaran: [
 { q: 'Metode pembayaran apa yang tersedia?', a: 'Kami mendukung transfer bank (semua bank di Indonesia melalui virtual account), QRIS, dan beberapa e-wallet. Metode pembayaran terus kami tambah.' },
 { q: 'Berapa biaya platform Kahade?', a: 'Biaya platform adalah 2.5% dari nilai transaksi, ditanggung oleh penjual. Tidak ada biaya tersembunyi. Gunakan kalkulator di halaman Harga untuk estimasi.' },
 { q: 'Apakah dana saya aman di Kahade?', a: 'Dana pengguna disimpan di rekening terpisah (escrow) yang tidak bercampur dengan dana operasional perusahaan. Rekening ini diaudit secara berkala.' },
 ],
 Keamanan: [
 { q: 'Bagaimana Kahade melindungi data saya?', a: 'Kami menggunakan enkripsi SSL 256-bit untuk semua data yang ditransmisikan, dan AES-256 untuk data yang disimpan. Infrastruktur kami di-audit secara berkala oleh pihak ketiga independen.' },
 { q: 'Apa itu verifikasi KYC?', a: 'KYC (Know Your Customer) adalah proses verifikasi identitas untuk memastikan keamanan semua pengguna. Caranya mudah: upload foto KTP dan selfie, proses otomatis dalam beberapa menit.' },
 { q: 'Apakah ada autentikasi dua faktor?', a: 'Ya, kami sangat menyarankan mengaktifkan 2FA melalui aplikasi authenticator (Google Authenticator, Authy). Aktifkan di Pengaturan → Keamanan.' },
 ],
 Akun: [
 { q: 'Bagaimana cara mendaftar?', a: 'Klik "Daftar Gratis" di halaman utama, masukkan email dan password, verifikasi email, lalu lengkapi profil Anda. Seluruh proses hanya 5 menit.' },
 { q: 'Lupa password, apa yang harus dilakukan?', a: 'Klik "Lupa Password" di halaman login, masukkan email Anda, dan kami akan mengirimkan link reset password. Link berlaku selama 1 jam.' },
 { q: 'Bisakah saya memiliki beberapa akun?', a: 'Satu akun per identitas (KTP). Jika Anda memiliki kebutuhan bisnis yang berbeda, hubungi tim kami untuk solusi enterprise.' },
 ],
};

const categories = Object.keys(faqData);

export default function FAQ() {
 const [activeCategory, setActiveCategory] = useState('Umum');
 const [openItem, setOpenItem] = useState<string | null>(null);
 const [search, setSearch] = useState('');
 const [debouncedSearch, setDebouncedSearch] = useState('');
 const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const handleSearch = (val: string) => {
 setSearch(val);
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 searchTimerRef.current = setTimeout(() => setDebouncedSearch(val), 300);
 };

 const filteredItems = useMemo(() => {
 if (!debouncedSearch) return faqData[activeCategory] || [];
 const q = debouncedSearch.toLowerCase();
 return Object.values(faqData).flat().filter(
 item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
 );
 }, [activeCategory, debouncedSearch]);

 return (
 <div className="min-h-screen bg-background">
 <Navbar />

 {/* HERO */}
 <section className="bg-muted/50 pt-24 pb-12 border-b">
 <div className="container max-w-2xl mx-auto text-center">
 <motion.div variants={fadeInUp} initial="initial" animate="animate">
 <span className="badge badge-secondary mb-4">FAQ</span>
 <h1 className="text-2xl md:text-4xl font-bold mb-6 leading-tight">Pertanyaan yang Sering Ditanyakan</h1>
 <div className="relative">
 <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
 <input
 type="text" value={search} onChange={e => handleSearch(e.target.value)}
 placeholder="Cari pertanyaan..."
 className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm box-border"
 />
 </div>
 </motion.div>
 </div>
 </section>

 {/* TWO-PANEL */}
 <section className="section-padding-lg">
 <div className="container max-w-6xl mx-auto">
 {/* Mobile: Horizontal scroll pills */}
 <div className="flex gap-2 overflow-x-auto pb-4 mb-8 md:hidden no-scrollbar">
 {categories.map(cat => (
 <button
 key={cat} onClick={() => { setActiveCategory(cat); setSearch(''); setDebouncedSearch(''); }}
 className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
 >
 {cat}
 </button>
 ))}
 </div>

 <div className="grid md:grid-cols-[220px_1fr] gap-12">
 {/* Desktop Sticky Sidebar */}
 <div className="hidden md:block">
 <div className="sticky top-24 space-y-1">
 {categories.map(cat => (
 <button
 key={cat} onClick={() => { setActiveCategory(cat); setSearch(''); setDebouncedSearch(''); }}
 className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
 >
 {cat}
 </button>
 ))}
 </div>
 </div>

 {/* Content */}
 <div>
 {debouncedSearch && (
 <p className="text-sm text-muted-foreground mb-6">
 {filteredItems.length} hasil untuk "<strong>{debouncedSearch}</strong>"
 </p>
 )}
 {!debouncedSearch && (
 <h2 className="text-2xl font-bold mb-6">{activeCategory}</h2>
 )}
 <div className="space-y-2">
 {filteredItems.map((item, i) => (
 <div key={i} className="border border-border rounded-xl overflow-hidden group">
 <button
 onClick={() => setOpenItem(openItem === `${activeCategory}-${i}` ? null : `${activeCategory}-${i}`)}
 className="w-full text-left flex items-center justify-between gap-4 p-5 hover:text-primary transition-colors"
 >
 <div className="flex items-center gap-3">
 <div className="w-6 h-6 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-colors">
 <CaretDown
 size={14}
 className={`transition-transform duration-300 ${openItem === `${activeCategory}-${i}` ? 'rotate-180' : ''}`}
 />
 </div>
 <span className="font-semibold text-sm md:text-base">{item.q}</span>
 </div>
 </button>
 {openItem === `${activeCategory}-${i}` && (
 <div className="px-5 pb-5 pl-14 text-muted-foreground text-sm leading-relaxed">
 {item.a}
 </div>
 )}
 </div>
 ))}
 {filteredItems.length === 0 && (
 <div className="text-center py-16">
 <p className="text-muted-foreground mb-4">Tidak ada hasil untuk "{debouncedSearch}".</p>
 <p className="text-sm text-muted-foreground">Coba kata lain atau</p>
 <Link href="/contact" className="text-primary font-medium text-sm inline-flex items-center gap-1 mt-1">
 hubungi kami <ArrowRight size={14} />
 </Link>
 </div>
 )}
 </div>

 {!debouncedSearch && (
 <div className="mt-12 bg-muted/40 rounded-2xl p-8 text-center">
 <p className="text-muted-foreground mb-3">Tidak menemukan jawaban yang dicari?</p>
 <Link href="/contact">
 <button className="btn-primary">Hubungi Support <ArrowRight size={16} /></button>
 </Link>
 </div>
 )}
 </div>
 </div>
 </div>
 </section>

 <Footer />
 </div>
 );
}
