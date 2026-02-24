/*
 * KAHADE PRIVACY POLICY PAGE - CLICKUP-INSPIRED REDESIGN
 * 
 * Design Philosophy:
 * - ClickUp-style smooth animations and micro-interactions
 * - Enhanced TOC with sticky behavior
 * - Improved readability and hierarchy
 * - Brand color: var(--color-black)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Calendar, Printer, List, CaretDown } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';
import { useState } from 'react';

const sections = [
 {
 id: 'introduction',
 title: '1. Pendahuluan',
 content: `Kahade ("kami") berkomitmen untuk melindungi privasi Anda. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan, menggunakan, mengungkapkan, dan melindungi informasi Anda saat menggunakan platform dan layanan kami.

Dengan menggunakan Kahade, Anda menyetujui praktik data yang dijelaskan dalam kebijakan ini. Jika Anda tidak setuju, mohon untuk tidak menggunakan layanan kami.`
 },
 {
 id: 'collection',
 title: '2. Informasi yang Kami Kumpulkan',
 content: `Kami mengumpulkan informasi yang Anda berikan langsung kepada kami, termasuk:

Informasi Pribadi:
• Nama dan detail kontak (email, nomor telepon)
• Dokumen identitas resmi
• Tanggal lahir dan kewarganegaraan
• Alamat tempat tinggal
• Foto profil

Informasi Keuangan:
• Detail rekening bank
• Informasi kartu pembayaran
• Riwayat transaksi
• Saldo dan aktivitas dompet

Informasi Teknis:
• Alamat IP dan informasi perangkat
• Jenis browser dan pengaturan
• Sistem operasi
• Data penggunaan dan analitik
• Cookie dan teknologi serupa`
 },
 {
 id: 'use',
 title: '3. Cara Kami Menggunakan Informasi Anda',
 content: `Kami menggunakan informasi yang kami kumpulkan untuk:

• Menyediakan, memelihara, dan meningkatkan layanan kami
• Memproses transaksi dan mengirimkan informasi terkait
• Memverifikasi identitas dan mencegah penipuan
• Mematuhi persyaratan hukum dan regulasi
• Mengirim pemberitahuan teknis dan pesan dukungan
• Menanggapi komentar dan pertanyaan Anda
• Menganalisis pola penggunaan dan meningkatkan pengalaman pengguna
• Mempersonalisasi pengalaman Anda di platform kami
• Berkomunikasi tentang produk, layanan, dan acara

Kami tidak akan menggunakan informasi pribadi Anda untuk tujuan di luar yang dijelaskan dalam kebijakan ini tanpa persetujuan Anda.`
 },
 {
 id: 'sharing',
 title: '4. Berbagi Informasi',
 content: `Kami dapat membagikan informasi Anda dalam situasi berikut:

Dengan Pengguna Lain:
• Pihak lawan transaksi menerima informasi terbatas untuk menyelesaikan transaksi
• Nama pengguna dan riwayat transaksi Anda dapat terlihat oleh pihak lain dalam transaksi

Dengan Penyedia Layanan:
• Pemroses pembayaran dan institusi keuangan
• Layanan verifikasi identitas
• Penyedia hosting dan infrastruktur cloud
• Layanan analitik dan pemantauan

Untuk Keperluan Hukum:
• Mematuhi hukum dan regulasi yang berlaku
• Menanggapi proses hukum atau permintaan pemerintah
• Melindungi hak, privasi, keselamatan, atau properti kami
• Menegakkan syarat dan perjanjian kami

Kami tidak menjual informasi pribadi Anda kepada pihak ketiga.`
 },
 {
 id: 'security',
 title: '5. Keamanan Data',
 content: `Kami menerapkan langkah teknis dan organisasi yang sesuai untuk melindungi informasi Anda, termasuk:

• Enkripsi SSL/TLS 256-bit untuk data saat transit
• Enkripsi AES-256 untuk data tersimpan
• Opsi autentikasi multi-faktor
• Audit keamanan dan pengujian penetrasi rutin
• Kontrol akses dan pelatihan karyawan
• Pusat data aman dengan pengamanan fisik

Meski kami berupaya melindungi informasi Anda, tidak ada metode transmisi di Internet yang 100% aman. Kami tidak dapat menjamin keamanan mutlak.`
 },
 {
 id: 'retention',
 title: '6. Retensi Data',
 content: `Kami menyimpan informasi pribadi Anda selama diperlukan untuk:

• Menyediakan layanan kami kepada Anda
• Mematuhi kewajiban hukum
• Menyelesaikan sengketa dan menegakkan perjanjian
• Menjaga catatan bisnis

Setelah penutupan akun, kami dapat menyimpan informasi tertentu sesuai hukum atau untuk tujuan bisnis yang sah. Catatan transaksi biasanya disimpan selama 7 tahun untuk kepatuhan regulasi.`
 },
 {
 id: 'rights',
 title: '7. Hak Anda',
 content: `Tergantung pada lokasi Anda, Anda mungkin memiliki hak berikut:

• Akses: Meminta salinan informasi pribadi Anda
• Koreksi: Meminta perbaikan data yang tidak akurat
• Penghapusan: Meminta penghapusan informasi pribadi Anda
• Portabilitas: Meminta pemindahan data ke layanan lain
• Keberatan: Menolak pemrosesan data tertentu
• Pembatasan: Meminta pembatasan pemrosesan
• Penarikan persetujuan: Menarik persetujuan saat pemrosesan berbasis persetujuan

Untuk menggunakan hak-hak ini, silakan hubungi kami di privacy@kahade.com. Kami akan merespons dalam 30 hari.`
 },
 {
 id: 'cookies',
 title: '8. Cookie dan Pelacakan',
 content: `Kami menggunakan cookie dan teknologi serupa untuk:

• Mengingat preferensi dan pengaturan Anda
• Mengautentikasi pengguna dan mencegah penipuan
• Menganalisis trafik dan pola penggunaan situs
• Menyajikan konten dan iklan yang dipersonalisasi

Jenis cookie yang kami gunakan:
• Cookie esensial: Diperlukan untuk fungsi dasar
• Cookie analitik: Membantu kami memahami penggunaan situs
• Cookie preferensi: Mengingat pengaturan dan pilihan Anda
• Cookie pemasaran: Digunakan untuk tujuan iklan

Anda dapat mengontrol cookie melalui pengaturan browser. Menonaktifkan cookie tertentu dapat memengaruhi fungsi situs.`
 },
 {
 id: 'international',
 title: '9. Transfer Internasional',
 content: `Informasi Anda dapat ditransfer dan diproses di negara selain negara tempat tinggal Anda. Negara tersebut mungkin memiliki hukum perlindungan data yang berbeda.

Saat kami mentransfer data secara internasional, kami memastikan adanya perlindungan yang sesuai, termasuk:
• Klausul kontrak standar yang disetujui otoritas terkait
• Keputusan kecukupan dari otoritas perlindungan data
• Mekanisme sertifikasi jika berlaku

Dengan menggunakan layanan kami, Anda menyetujui transfer informasi Anda ke negara di luar tempat tinggal Anda.`
 },
 {
 id: 'children',
 title: '10. Privasi Anak',
 content: `Layanan kami tidak ditujukan untuk individu di bawah 18 tahun. Kami tidak dengan sengaja mengumpulkan informasi pribadi dari anak-anak.

Jika kami mengetahui bahwa kami telah mengumpulkan informasi dari anak di bawah 18 tahun, kami akan menghapusnya sesegera mungkin. Jika Anda yakin kami mengumpulkan informasi dari anak, segera hubungi kami.`
 },
 {
 id: 'changes',
 title: '11. Perubahan Kebijakan',
 content: `Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Kami akan memberi tahu perubahan material dengan:

• Memposting kebijakan baru di situs web kami
• Mengirim pemberitahuan melalui email
• Menampilkan pemberitahuan di aplikasi kami

Penggunaan layanan secara berkelanjutan setelah perubahan berarti Anda menerima kebijakan yang diperbarui. Kami mendorong Anda untuk meninjau kebijakan ini secara berkala.`
 },
 {
 id: 'contact',
 title: '12. Hubungi Kami',
 content: `Jika Anda memiliki pertanyaan tentang Kebijakan Privasi ini atau praktik data kami, silakan hubungi kami:

Petugas Perlindungan Data
Email: privacy@kahade.com
Alamat: Jakarta, Indonesia

Bagi warga Uni Eropa, Anda juga berhak mengajukan keluhan kepada otoritas perlindungan data setempat.`
 },
];

export default function Privacy() {
 const [showToc, setShowToc] = useState(false);
 
 return (
 <div className="min-h-screen bg-background">
 <Navbar />
 
 {/* Hero Section */}
 <section className="pt-28 md:pt-32 lg:pt-40 pb-8 md:pb-12 relative overflow-hidden">
 <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-neutral-100)_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" aria-hidden="true" />
 <motion.div 
 animate={{ 
 scale: [1, 1.1, 1],
 opacity: [0.3, 0.5, 0.3]
 }}
 transition={{ duration: 8, repeat: Infinity }}
 className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-gray-100 rounded-full blur-3xl" 
 />
 <div className="container relative z-10">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.6 }}
 className="max-w-3xl"
 >
 <motion.span 
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.2, duration: 0.4 }}
 className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4"
 >
 Legal
 </motion.span>
 <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-foreground">
 Kebijakan Privasi
 </h1>
 <div className="flex flex-wrap items-center gap-4 md:gap-4 text-sm text-muted-foreground">
 <span className="flex items-center gap-2">
 <Calendar className="w-4 h-4" aria-hidden="true" weight="regular" />
 Terakhir diperbarui: 1 Januari 2026
 </span>
 <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
 <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-neutral-900" onClick={() => window.print()}>
 <Printer className="w-4 h-4" aria-hidden="true" weight="regular" />
 Cetak
 </Button>
 </motion.div>
 </div>
 </motion.div>
 </div>
 </section>
 
 {/* Mobile TOC Toggle */}
 <div className="lg:hidden sticky top-[65px] z-20 bg-background/95 backdrop-blur border-b border-border">
 <div className="container py-3">
 <motion.div whileTap={{ scale: 0.98 }}>
 <Button 
 variant="outline" 
 className="w-full h-10 justify-between border-border rounded-xl hover:border-neutral-900/30"
 onClick={() => setShowToc(!showToc)}
 >
 <span className="flex items-center gap-2">
 <List className="w-4 h-4" aria-hidden="true" weight="bold" />
 Daftar Isi
 </span>
 <motion.div animate={{ rotate: showToc ? 180 : 0 }} transition={{ duration: 0.2 }}>
 <CaretDown className="w-4 h-4" aria-hidden="true" weight="bold" />
 </motion.div>
 </Button>
 </motion.div>
 <AnimatePresence>
 {showToc && (
 <motion.nav 
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.3 }}
 className="overflow-hidden"
 >
 <div className="mt-3 p-4 bg-muted rounded-xl space-y-2 max-h-60 overflow-y-auto">
 {sections.map((section, index) => (
 <motion.a
 key={section.id}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.03 }}
 href={`#${section.id}`}
 onClick={() => setShowToc(false)}
 className="block text-sm text-muted-foreground hover:text-neutral-900 transition-colors py-1"
 >
 {section.title}
 </motion.a>
 ))}
 </div>
 </motion.nav>
 )}
 </AnimatePresence>
 </div>
 </div>
 
 {/* Content */}
 <section className="py-8 md:py-12 bg-muted">
 <div className="container">
 <div className="grid lg:grid-cols-4 gap-6 lg:gap-12">
 {/* Table of Contents - Desktop */}
 <motion.aside
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.6 }}
 className="hidden lg:block lg:col-span-1"
 >
 <div className="sticky top-24 bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6">
 <h3 className="font-bold mb-4 text-foreground flex items-center gap-2">
 <ShieldCheck className="w-5 h-5" aria-hidden="true" weight="bold" />
 Daftar Isi
 </h3>
 <nav className="space-y-2">
 {sections.map((section, index) => (
 <motion.a
 key={section.id}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: index * 0.05 }}
 href={`#${section.id}`}
 className="block text-sm text-muted-foreground hover:text-neutral-900 hover:translate-x-1 transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 py-1"
 >
 {section.title}
 </motion.a>
 ))}
 </nav>
 </div>
 </motion.aside>
 
 {/* Main Content */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2, duration: 0.6 }}
 className="lg:col-span-3"
 >
 <div className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-8">
 <p className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed">
 Privasi Anda penting bagi kami. Kebijakan Privasi ini menjelaskan bagaimana Kahade
 mengumpulkan, menggunakan, dan melindungi informasi pribadi Anda.
 </p>
 
 {sections.map((section, index) => (
 <motion.div
 key={section.id}
 id={section.id}
 initial={{ opacity: 0, y: 30 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.03, duration: 0.5 }}
 className="mb-8 md:mb-12 scroll-mt-32 lg:scroll-mt-24"
 >
 <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-foreground">{section.title}</h2>
 <div className="text-sm md:text-base text-muted-foreground whitespace-pre-line leading-relaxed">
 {section.content}
 </div>
 </motion.div>
 ))}
 </div>
 </motion.div>
 </div>
 </div>
 </section>
 
 <Footer />
 </div>
 );
}