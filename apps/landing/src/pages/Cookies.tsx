/*
 * KAHADE COOKIE POLICY PAGE - PROFESSIONAL REDESIGN
 * 
 * Design Philosophy:
 * - Clean, modern, and professional aesthetic
 * - Fully responsive for Mobile, Tablet, and Desktop
 * - Brand color: var(--color-black)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cookie, Calendar, Printer, Gear, List } from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { PageHero } from '../components/common/PageHero';
import { Button } from '@kahade/ui';

const cookieTypes = [
 { name: 'Cookie Esensial', description: 'Cookie ini diperlukan agar situs web dapat berfungsi dan tidak bisa dinonaktifkan.', examples: ['Manajemen sesi', 'Otentikasi', 'Token keamanan', 'Load balancing'], canDisable: false },
 { name: 'Cookie Analitik', description: 'Cookie ini membantu kami menghitung kunjungan dan sumber trafik untuk mengukur serta meningkatkan performa situs.', examples: ['Tampilan halaman', 'Pelacakan perjalanan pengguna', 'Metrik performa', 'Pencatatan error'], canDisable: true },
 { name: 'Cookie Fungsional', description: 'Cookie ini memungkinkan situs menyediakan fungsi tambahan dan personalisasi.', examples: ['Preferensi bahasa', 'Pengaturan wilayah', 'Preferensi pengguna', 'Widget chat'], canDisable: true },
 { name: 'Cookie Pemasaran', description: 'Cookie ini dapat dipasang oleh mitra iklan kami untuk membangun profil minat Anda.', examples: ['Penargetan iklan', 'Retargeting', 'Integrasi media sosial', 'Pelacakan konversi'], canDisable: true }
];

const sections = [
 { id: 'what', title: 'Apa Itu Cookie?', content: `Cookie adalah file teks kecil yang ditempatkan di komputer atau perangkat mobile Anda saat mengunjungi situs web. Cookie digunakan secara luas untuk membuat situs bekerja lebih efisien dan memberikan informasi kepada pemilik situs.

Cookie dapat berupa "persisten" atau "sesi":
• Cookie persisten tetap ada di perangkat Anda hingga kedaluwarsa atau dihapus
• Cookie sesi dihapus saat Anda menutup browser

Kami menggunakan kedua jenis cookie tersebut di platform kami.` },
 { id: 'how', title: 'Bagaimana Kami Menggunakan Cookie', content: `Kami menggunakan cookie untuk berbagai tujuan, termasuk:

• Otentikasi: Mengenali Anda saat masuk ke platform kami
• Keamanan: Mendukung fitur keamanan dan mendeteksi aktivitas berbahaya
• Preferensi: Mengingat pengaturan dan preferensi Anda
• Analitik: Memahami cara Anda menggunakan layanan kami dan meningkatkannya
• Pemasaran: Menyajikan iklan yang relevan dan mengukur efektivitasnya

Kami juga dapat menggunakan teknologi serupa seperti web beacon, pixel, dan penyimpanan lokal.` },
 { id: 'third-party', title: 'Cookie Pihak Ketiga', content: `Beberapa cookie dipasang oleh layanan pihak ketiga yang muncul di halaman kami. Kami menggunakan layanan pihak ketiga berikut:

• Google Analytics: Untuk analitik situs dan pemantauan performa
• Stripe: Untuk pemrosesan pembayaran
• Intercom: Untuk chat dukungan pelanggan
• Facebook Pixel: Untuk iklan dan pelacakan konversi
• Cloudflare: Untuk keamanan dan optimasi performa

Pihak ketiga tersebut dapat menggunakan cookie untuk mengumpulkan informasi tentang aktivitas online Anda di berbagai situs web.` },
 { id: 'manage', title: 'Mengelola Cookie', content: `Anda dapat mengontrol dan mengelola cookie dengan beberapa cara:

Pengaturan Browser:
Sebagian besar browser memungkinkan Anda menolak atau menerima cookie, menghapus cookie yang ada, serta mengatur preferensi untuk situs tertentu. Berikut cara mengelola cookie di browser populer:

• Chrome: Settings > Privacy and Security > Cookies
• Firefox: Options > Privacy & Security > Cookies
• Safari: Preferences > Privacy > Cookies
• Edge: Settings > Privacy & Security > Cookies

Perlu dicatat bahwa menonaktifkan cookie tertentu dapat memengaruhi fungsi situs web kami.` },
 { id: 'retention', title: 'Retensi Cookie', content: `Masa penyimpanan cookie berbeda-beda tergantung tujuannya:

• Cookie sesi: Dihapus saat Anda menutup browser
• Cookie esensial: Hingga 1 tahun
• Cookie analitik: Hingga 2 tahun
• Cookie fungsional: Hingga 1 tahun
• Cookie pemasaran: Hingga 2 tahun

Anda dapat menghapus cookie kapan saja melalui pengaturan browser.` },
 { id: 'updates', title: 'Pembaruan Kebijakan', content: `Kami dapat memperbarui Kebijakan Cookie ini dari waktu ke waktu untuk mencerminkan perubahan praktik kami atau alasan operasional, hukum, maupun regulasi lainnya.

Kami akan memberi tahu perubahan material dengan memposting kebijakan terbaru di situs web kami beserta tanggal "Terakhir Diperbarui" yang baru. Kami mendorong Anda untuk meninjau kebijakan ini secara berkala.` },
 { id: 'contact', title: 'Hubungi Kami', content: `Jika Anda memiliki pertanyaan tentang penggunaan cookie kami atau Kebijakan Cookie ini, silakan hubungi kami:

Email: privacy@kahade.com
Alamat: Jakarta, Indonesia

Anda juga dapat mengelola preferensi cookie Anda kapan saja melalui tombol Pengaturan Cookie di bawah.` }
];

export default function Cookies() {
 const [showToc, setShowToc] = useState(false);
 
 return (
 <div className="min-h-screen bg-background">
 <Navbar />
 
 {/* Hero Section */}
 <PageHero eyebrow="Legal" title="Kebijakan Cookie" description="Penjelasan penggunaan cookie untuk pengalaman produk, keamanan, dan analitik di ekosistem Kahade." chips={[{ label: 'Terakhir diperbarui' }, { label: 'Privasi' }, { label: 'Kepatuhan' } ]} />
 
 {/* Cookie Types */}
 <section className="py-10 md:py-12 bg-muted">
 <div className="container">
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 className="text-center mb-8 md:mb-12"
 >
 <span className="inline-block px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-semibold mb-4">
 Ringkasan
 </span>
 <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-foreground">Jenis Cookie yang Kami Gunakan</h2>
 <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
 Kami menggunakan berbagai jenis cookie untuk beragam kebutuhan di platform kami.
 </p>
 </motion.div>
 
 <div className="grid sm:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto">
 {cookieTypes.map((cookie, index) => (
 <motion.div
 key={cookie.name}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.1 }}
 className="bg-card rounded-xl md:rounded-2xl p-4 md:p-5 border border-border"
 >
 <div className="flex items-center justify-between mb-3 md:mb-4">
 <h3 className="font-bold text-sm md:text-base text-foreground">{cookie.name}</h3>
 <span className={`text-[10px] md:text-xs px-2 py-1 rounded-lg ${
 cookie.canDisable 
 ? 'bg-muted text-muted-foreground' 
 : 'bg-black text-white'
 }`}>
 {cookie.canDisable ? 'Opsional' : 'Wajib'}
 </span>
 </div>
 <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">{cookie.description}</p>
 <div className="flex flex-wrap gap-1.5 md:gap-2">
 {cookie.examples.map((example) => (
 <span key={example} className="text-[10px] md:text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">
 {example}
 </span>
 ))}
 </div>
 </motion.div>
 ))}
 </div>
 </div>
 </section>
 
 {/* Mobile TOC Toggle */}
 <div className="lg:hidden sticky top-[65px] z-20 bg-card border-b border-border">
 <div className="container py-3">
 <Button 
 variant="outline" 
 className="w-full h-10 justify-between border-border rounded-xl"
 onClick={() => setShowToc(!showToc)}
 >
 <span className="flex items-center gap-2">
 <List className="w-4 h-4" aria-hidden="true" weight="bold" />
 Daftar Isi
 </span>
 <span className="text-xs text-muted-foreground">{showToc ? 'Sembunyikan' : 'Tampilkan'}</span>
 </Button>
 {showToc && (
 <nav className="mt-3 p-4 bg-muted rounded-xl space-y-2 max-h-60 overflow-y-auto">
 {sections.map((section) => (
 <a
 key={section.id}
 href={`#${section.id}`}
 onClick={() => setShowToc(false)}
 className="block text-sm text-muted-foreground hover:text-neutral-900 transition-colors py-1"
 >
 {section.title}
 </a>
 ))}
 </nav>
 )}
 </div>
 </div>
 
 {/* Content */}
 <section className="py-8 md:py-12">
 <div className="container">
 <div className="grid lg:grid-cols-4 gap-6 lg:gap-12">
 {/* Table of Contents - Desktop */}
 <motion.aside
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 className="hidden lg:block lg:col-span-1"
 >
 <div className="sticky top-24 bg-muted rounded-xl md:rounded-2xl border border-border p-4 md:p-6">
 <h3 className="font-bold mb-4 text-foreground">Daftar Isi</h3>
 <nav className="space-y-2">
 {sections.map((section) => (
 <a
 key={section.id}
 href={`#${section.id}`}
 className="block text-sm text-muted-foreground hover:text-neutral-900 transition-colors py-1"
 >
 {section.title}
 </a>
 ))}
 </nav>
 </div>
 </motion.aside>
 
 {/* Main Content */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="lg:col-span-3"
 >
 <div className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-8">
 {sections.map((section, index) => (
 <motion.div
 key={section.id}
 id={section.id}
 initial={{ opacity: 0, y: 20 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={{ once: true }}
 transition={{ delay: index * 0.03 }}
 className="mb-8 md:mb-12 scroll-mt-32 lg:scroll-mt-24"
 >
 <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-foreground">{section.title}</h2>
 <div className="text-sm md:text-base text-muted-foreground whitespace-pre-line leading-relaxed">
 {section.content}
 </div>
 </motion.div>
 ))}
 </div>
 
 {/* Cookie Settings Button */}
 <div className="mt-6 md:mt-8 p-4 md:p-6 rounded-xl md:rounded-2xl bg-black">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h3 className="font-bold text-base md:text-lg mb-1 text-white">Kelola Preferensi Cookie Anda</h3>
 <p className="text-xs md:text-sm text-white/70">
 Sesuaikan cookie mana yang ingin Anda izinkan di platform kami.
 </p>
 </div>
 <Button className="h-10 md:h-11 bg-card text-foreground hover:bg-gray-100 font-semibold rounded-xl gap-2">
 <Gear className="w-5 h-5" aria-hidden="true" weight="bold" />
 Pengaturan Cookie
 </Button>
 </div>
 </div>
 </motion.div>
 </div>
 </div>
 </section>
 
 <Footer />
 </div>
 );
}