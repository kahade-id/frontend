import { motion } from 'framer-motion';
import { Link } from 'wouter';
import {
 FacebookLogo, TwitterLogo, InstagramLogo, LinkedinLogo
} from '@phosphor-icons/react';
import { cn } from '@kahade/utils';
import { staggerContainer, staggerItem, viewport } from '@kahade/utils';

const footerLinks = {
 produk: [
 { label: 'Fitur', href: '/features' },
 { label: 'Harga', href: '/pricing' },
 { label: 'Keamanan', href: '/security' },
 { label: 'Integrasi', href: '/integration-docs' },
 ],
 perusahaan: [
 { label: 'Tentang', href: '/about' },
 { label: 'Karir', href: '/careers' },
 { label: 'Kontak', href: '/contact' },
 { label: 'Pers', href: '/press' },
 ],
 sumberDaya: [
 { label: 'Blog', href: '/blog' },
 { label: 'FAQ', href: '/faq' },
 { label: 'Cara Kerja', href: '/how-it-works' },
 { label: 'Dokumentasi', href: '/api-docs' },
 ],
 legal: [
 { label: 'Privasi', href: '/privacy' },
 { label: 'Syarat', href: '/terms' },
 { label: 'Cookie', href: '/cookies' },
 { label: 'Lisensi', href: '/licenses' },
 ],
};


const socialLinks = [
 { icon: FacebookLogo, href: '#', label: 'Facebook' },
 { icon: TwitterLogo, href: '#', label: 'Twitter/X' },
 { icon: InstagramLogo, href: '#', label: 'Instagram' },
 { icon: LinkedinLogo, href: '#', label: 'LinkedIn' },
];

export default function Footer() {
 return (
 <footer className="bg-primary text-primary-foreground">
 <div className="container">
 {/* Top section: Description + Newsletter */}
 <div className="grid md:grid-cols-2 gap-12 py-16 border-b border-primary-foreground/10">
 {/* Left: Logo + tagline */}
 <div>
 <Link href="/">
 <span className="font-display font-black text-2xl tracking-tight text-white">KAHADE</span>
 </Link>
 <p className="text-primary-foreground/60 text-sm leading-relaxed mt-3">
 Membangun kepercayaan di setiap transaksi. PT Kawal Hak Dengan Aman — platform escrow terpercaya Indonesia.
 </p>
 </div>

 {/* Right: Newsletter */}
 <div>
 <p className="text-sm font-semibold text-white mb-1">Tetap update</p>
 <p className="text-xs text-primary-foreground/60 mb-4">
 Berita keamanan & fitur terbaru Kahade, langsung ke inbox Anda.
 </p>
 <div className="flex gap-2">
 <input
 type="email"
 placeholder="Alamat email Anda..."
 className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/50 transition-colors"
 />
 <button className="px-4 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-neutral-100 transition-colors whitespace-nowrap">
 Berlangganan →
 </button>
 </div>
 <p className="text-xs text-primary-foreground/40 mt-2">Tidak ada spam. Berhenti kapan saja.</p>
 </div>
 </div>

 {/* Links grid */}
 <motion.div
 variants={staggerContainer}
 initial="initial"
 whileInView="animate"
 viewport={viewport}
 className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-b border-primary-foreground/10"
 >
 {(Object.entries({
 'PRODUK': footerLinks.produk,
 'PERUSAHAAN': footerLinks.perusahaan,
 'SUMBER DAYA': footerLinks.sumberDaya,
 'LEGAL': footerLinks.legal,
 })).map(([heading, links]) => (
 <motion.div key={heading} variants={staggerItem}>
 <p className="text-[0.6875rem] font-bold tracking-widest uppercase text-primary-foreground/50 mb-4">
 {heading}
 </p>
 <ul className="space-y-2.5">
 {links.map(({ label, href }) => (
 <li key={label}>
 <Link href={href}>
 <span className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors cursor-pointer">
 {label}
 </span>
 </Link>
 </li>
 ))}
 </ul>
 </motion.div>
 ))}
 </motion.div>

 {/* Bottom: Copyright + Social */}
 <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
 <p className="text-xs text-primary-foreground/40">
 © {new Date().getFullYear()} PT Kawal Hak Dengan Aman. Hak cipta dilindungi.
 </p>

 <div className="flex items-center gap-4">
 {/* Language switcher placeholder */}
 <div className="flex gap-2 text-xs text-primary-foreground/40">
 <button className="hover:text-primary-foreground transition-colors">🌐 ID</button>
 <button className="hover:text-primary-foreground transition-colors">EN</button>
 </div>

 {/* Social links */}
 <div className="flex gap-3">
 {socialLinks.map(({ icon: SocialIcon, href, label }) => (
 <a
 key={label}
 href={href}
 aria-label={label}
 className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-foreground/60 hover:text-primary-foreground hover:scale-110 transition-all"
 >
 <SocialIcon className="w-4 h-4" />
 </a>
 ))}
 </div>
 </div>
 </div>
 </div>
 </footer>
 );
}
