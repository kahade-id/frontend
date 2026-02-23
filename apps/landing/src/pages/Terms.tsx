/*
 * KAHADE TERMS OF SERVICE PAGE - CLICKUP-INSPIRED REDESIGN
 * 
 * Design Philosophy:
 * - ClickUp-style smooth animations and micro-interactions
 * - Enhanced TOC with sticky behavior
 * - Improved readability and hierarchy
 * - Brand color: var(--color-black)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Calendar, Printer, List, CaretDown } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';

const sections = [
 {
 id: 'acceptance',
 title: '1. Penerimaan Syarat',
 content: `Dengan mengakses atau menggunakan layanan PT Kawal Hak Dengan Aman (Kahade), Anda setuju terikat oleh Syarat Layanan ini serta semua hukum dan peraturan yang berlaku. Jika Anda tidak menyetujui salah satu syarat, Anda dilarang menggunakan atau mengakses layanan kami.

Syarat Layanan ini berlaku untuk semua pengguna platform, termasuk namun tidak terbatas pada pengunjung, vendor, pelanggan, pedagang, dan/atau kontributor konten.`
 },
 {
 id: 'services',
 title: '2. Deskripsi Layanan',
 content: `Kahade menyediakan platform escrow peer-to-peer yang memfasilitasi transaksi aman antara pembeli dan penjual. Layanan kami meliputi:

• Penahanan dana secara aman selama transaksi
• Manajemen dan pelacakan transaksi
• Layanan penyelesaian sengketa
• Verifikasi identitas (KYC)
• Pemrosesan pembayaran dan penarikan

Kami berhak mengubah, menangguhkan, atau menghentikan aspek layanan kapan saja tanpa pemberitahuan sebelumnya.`
 },
 {
 id: 'eligibility',
 title: '3. Kelayakan',
 content: `Untuk menggunakan layanan PT Kawal Hak Dengan Aman (Kahade), Anda harus:

• Berusia minimal 18 tahun
• Memiliki kapasitas hukum untuk membuat perjanjian yang mengikat
• Tidak dilarang menggunakan layanan kami berdasarkan hukum yang berlaku
• Memberikan informasi pendaftaran yang akurat dan lengkap
• Menjaga keamanan kredensial akun Anda

Kami berhak menolak layanan, menghentikan akun, atau membatalkan transaksi atas kebijakan kami sendiri.`
 },
 {
 id: 'accounts',
 title: '4. Akun Pengguna',
 content: `Saat membuat akun, Anda wajib memberikan informasi yang akurat, lengkap, dan terkini. Kegagalan melakukan hal tersebut merupakan pelanggaran terhadap Syarat ini.

Anda bertanggung jawab atas:
• Menjaga kata sandi dan kredensial akun Anda
• Semua aktivitas yang terjadi di akun Anda
• Memberi tahu kami segera jika ada akses tidak sah
• Memastikan informasi kontak Anda selalu terbaru

Kami tidak bertanggung jawab atas kerugian akibat kegagalan Anda mematuhi ketentuan ini.`
 },
 {
 id: 'transactions',
 title: '5. Transaksi dan Escrow',
 content: `Saat menggunakan layanan escrow kami:

• Dana ditahan dengan aman hingga syarat transaksi terpenuhi
• Kedua pihak wajib memenuhi kewajiban sesuai kesepakatan
• Pelepasan dana bergantung pada konfirmasi pembeli
• Sengketa harus diajukan dalam jangka waktu yang ditentukan
• Keputusan kami atas sengketa bersifat final dan mengikat

Biaya transaksi tidak dapat dikembalikan setelah transaksi dimulai. Harap tinjau detail transaksi dengan cermat sebelum melanjutkan.`
 },
 {
 id: 'fees',
 title: '6. Biaya dan Pembayaran',
 content: `Struktur biaya kami adalah sebagai berikut:

• Biaya escrow standar: 1-3% dari nilai transaksi
• Biaya minimum: Rp 5.000 per transaksi
• Biaya penarikan dapat berlaku tergantung metode pembayaran
• Biaya konversi mata uang dapat berlaku untuk transaksi internasional

Semua biaya dapat berubah dengan pemberitahuan 30 hari. Biaya terkini selalu ditampilkan sebelum konfirmasi transaksi.`
 },
 {
 id: 'prohibited',
 title: '7. Aktivitas Terlarang',
 content: `Anda setuju untuk tidak menggunakan layanan kami untuk:

• Aktivitas atau transaksi ilegal
• Pencucian uang atau pendanaan terorisme
• Penipuan atau praktik menyesatkan
• Transaksi barang atau jasa terlarang
• Mengakali langkah keamanan kami
• Mengganggu atau mengancam pengguna lain
• Membuat banyak akun untuk tujuan penipuan
• Aktivitas apa pun yang melanggar hukum atau peraturan yang berlaku

Pelanggaran atas larangan ini dapat mengakibatkan penghentian akun secara langsung dan tindakan hukum.`
 },
 {
 id: 'intellectual',
 title: '8. Kekayaan Intelektual',
 content: `Semua konten, fitur, dan fungsi pada platform Kahade yang dioperasikan oleh PT Kawal Hak Dengan Aman yang dioperasikan oleh PT Kawal Hak Dengan Aman adalah milik PT Kawal Hak Dengan Aman dan dilindungi oleh hukum hak cipta, merek dagang, serta kekayaan intelektual internasional lainnya.

Anda dilarang:
• Menyalin, memodifikasi, atau mendistribusikan konten kami tanpa izin
• Menggunakan merek dagang kami tanpa persetujuan tertulis
• Melakukan reverse engineer terhadap perangkat lunak atau sistem kami
• Menghapus pemberitahuan hak cipta atau kepemilikan lainnya`
 },
 {
 id: 'liability',
 title: '9. Batasan Tanggung Jawab',
 content: `Sejauh diizinkan oleh hukum, Kahade tidak bertanggung jawab atas:

• Kerugian tidak langsung, insidental, atau konsekuensial
• Kehilangan keuntungan, data, atau peluang bisnis
• Kerugian akibat tindakan pihak ketiga
• Gangguan layanan atau kegagalan teknis
• Akses tidak sah ke akun Anda

Total tanggung jawab kami untuk klaim apa pun tidak melebihi biaya yang Anda bayarkan dalam 12 bulan sebelum klaim.`
 },
 {
 id: 'indemnification',
 title: '10. Ganti Rugi',
 content: `Anda setuju untuk mengganti kerugian, membela, dan membebaskan Kahade beserta pejabat, direktur, karyawan, dan agennya dari klaim, kerusakan, kerugian, atau biaya yang timbul dari:

• Penggunaan layanan kami oleh Anda
• Pelanggaran Anda terhadap Syarat ini
• Pelanggaran Anda terhadap hak pihak ketiga
• Konten apa pun yang Anda kirimkan melalui platform kami`
 },
 {
 id: 'termination',
 title: '11. Penghentian',
 content: `Kami dapat menghentikan atau menangguhkan akun Anda segera tanpa pemberitahuan sebelumnya karena alasan apa pun, termasuk:

• Pelanggaran Syarat Layanan ini
• Dugaan aktivitas penipuan atau ilegal
• Permintaan dari aparat penegak hukum
• Periode tidak aktif yang berkepanjangan

Setelah penghentian, hak Anda untuk menggunakan layanan akan berakhir segera. Ketentuan yang secara sifatnya harus tetap berlaku akan tetap berlaku.`
 },
 {
 id: 'governing',
 title: '12. Hukum yang Berlaku',
 content: `Syarat ini diatur dan ditafsirkan sesuai dengan hukum Republik Indonesia, tanpa memperhatikan ketentuan konflik hukumnya.

Sengketa apa pun yang timbul dari Syarat ini atau penggunaan layanan kami akan diselesaikan melalui arbitrase yang mengikat di Indonesia, kecuali diwajibkan lain oleh hukum yang berlaku.`
 },
 {
 id: 'changes',
 title: '13. Perubahan Syarat',
 content: `Kami berhak mengubah Syarat ini kapan saja. Kami akan memberikan pemberitahuan perubahan material melalui:

• Pemberitahuan email kepada pengguna terdaftar
• Pemberitahuan yang jelas di situs web kami
• Pemberitahuan di dalam aplikasi

Penggunaan layanan secara berkelanjutan setelah perubahan tersebut berarti Anda menerima Syarat yang diperbarui.`
 },
 {
 id: 'contact',
 title: '14. Informasi Kontak',
 content: `Untuk pertanyaan terkait Syarat Layanan ini, silakan hubungi kami:

Email: legal@kahade.com
Alamat: Jakarta, Indonesia

Kami berupaya merespons semua pertanyaan dalam 5 hari kerja.`
 },
];

export default function Terms() {
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
 Syarat Layanan
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
 <FileText className="w-5 h-5" aria-hidden="true" weight="bold" />
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
 Harap baca Syarat Layanan ini dengan saksama sebelum menggunakan platform dan layanan PT Kawal Hak Dengan Aman (Kahade).
 Dengan menggunakan layanan kami, Anda setuju terikat oleh syarat-syarat ini.
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
