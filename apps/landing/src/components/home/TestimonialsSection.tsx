import { motion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { cn } from '@kahade/utils';
import { viewport } from '@kahade/utils';
import { SectionLabel } from '@kahade/ui';

const testimonials = [
 { name: 'Ahmad Rizki', role: 'Penjual Online', rating: 5, avatar: 'AR', content: 'Kahade membuat transaksi online jadi jauh lebih aman. Pembeli percaya dan saya tidak khawatir lagi soal penipuan.' },
 { name: 'Siti Wahyuni', role: 'Freelancer Desainer', rating: 5, avatar: 'SW', content: 'Sebagai freelancer, saya sering khawatir soal pembayaran. Dengan Kahade, klien saya lebih percaya dan pembayaran selalu tepat waktu.' },
 { name: 'Budi Santoso', role: 'Pembeli Online', rating: 5, avatar: 'BS', content: 'Pernah kena tipu sekali sebelum pakai Kahade. Sekarang saya tidak akan belanja online tanpa escrow dari Kahade.' },
 { name: 'Dewi Kurnia', role: 'Pemilik Toko Online', rating: 5, avatar: 'DK', content: 'Fitur resolusi sengketa sangat membantu. Tim Kahade profesional dan adil dalam menangani masalah.' },
 { name: 'Rudi Hermawan', role: 'Developer Freelance', rating: 5, avatar: 'RH', content: 'API Kahade mudah diintegrasikan. Dokumentasinya lengkap dan tim support sangat responsif.' },
 { name: 'Maya Putri', role: 'Importir Barang', rating: 5, avatar: 'MP', content: 'Untuk transaksi nilai besar, Kahade adalah pilihan terbaik. Dana saya terlindungi dengan baik.' },
 { name: 'Faisal Rahman', role: 'Pengusaha Muda', rating: 5, avatar: 'FR', content: 'Proses cepat, aman, dan transparan. Kahade benar-benar mengubah cara saya berbisnis online.' },
 { name: 'Linda Susanti', role: 'Penjual Properti', rating: 4, avatar: 'LS', content: 'Untuk transaksi properti, kepercayaan adalah segalanya. Kahade memberikan rasa aman yang tidak bisa digantikan.' },
 { name: 'Hendra Gunawan', role: 'Pedagang Elektronik', rating: 5, avatar: 'HG', content: 'Pelanggan saya lebih puas karena mereka tahu uang mereka aman. Penjualan meningkat 40% sejak pakai Kahade.' },
 { name: 'Rina Maharani', role: 'Kreator Konten', rating: 5, avatar: 'RM', content: 'Untuk brand deal dan kolaborasi, Kahade memastikan semua pihak memenuhi kewajiban mereka.' },
];

function TestimonialMarquee({ items, direction = 'left' }: {
 items: typeof testimonials;
 direction?: 'left' | 'right';
}) {
 return (
 <div className="overflow-hidden">
 <motion.div
 animate={{ x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'] }}
 transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
 className="flex gap-6 w-max"
 style={{ willChange: 'transform' }}
 >
 {[...items, ...items].map((t, i) => (
 <div
 key={i}
 className="w-80 shrink-0 card p-6 transition-shadow duration-300"
 >
 <div className="flex gap-1 mb-4">
 {[...Array(t.rating)].map((_, j) => (
 <Star key={j} weight="fill" className="w-4 h-4 text-warning" />
 ))}
 </div>
 <blockquote className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-4">
 "{t.content}"
 </blockquote>
 <div className="flex items-center gap-3 pt-4 border-t border-border">
 <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
 {t.avatar}
 </div>
 <div>
 <p className="text-sm font-semibold">{t.name}</p>
 <p className="text-xs text-muted-foreground">{t.role}</p>
 </div>
 </div>
 </div>
 ))}
 </motion.div>
 </div>
 );
}

export default function TestimonialsSection() {
 const firstHalf = testimonials.slice(0, 5);
 const secondHalf = testimonials.slice(5);

 return (
 <section className="section-padding-lg bg-background overflow-hidden">
 <div className="container mb-12">
 <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
 {/* Left: heading */}
 <motion.div
 initial={{ opacity: 0, y: 24 }}
 whileInView={{ opacity: 1, y: 0 }}
 viewport={viewport}
 >
 <SectionLabel variant="light">Testimoni</SectionLabel>
 <h2 className="section-title">
 Dipercaya ribuan<br className="hidden md:block" /> pengguna
 </h2>
 </motion.div>

 {/* Right: rating overview */}
 <motion.div
 initial={{ opacity: 0, x: 24 }}
 whileInView={{ opacity: 1, x: 0 }}
 viewport={viewport}
 className="flex flex-col items-start md:items-end"
 >
 <div className="flex gap-1 mb-2">
 {[...Array(5)].map((_, i) => (
 <Star key={i} weight="fill" className="w-5 h-5 text-warning" />
 ))}
 </div>
 <p className="text-3xl font-black">4.9<span className="text-lg font-medium text-muted-foreground">/5</span></p>
 <p className="text-sm text-muted-foreground">2.100+ ulasan</p>

 {/* Rating bars */}
 <div className="mt-4 space-y-1.5 w-40">
 {[{ stars: 5, pct: 87 }, { stars: 4, pct: 11 }, { stars: 3, pct: 2 }].map(({ stars, pct }) => (
 <div key={stars} className="flex items-center gap-2">
 <span className="text-xs text-muted-foreground w-10">{stars} ★</span>
 <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
 <div className="h-full bg-warning rounded-full" style={{ width: `${pct}%` }} />
 </div>
 <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
 </div>
 ))}
 </div>
 </motion.div>
 </div>
 </div>

 {/* Marquee rows */}
 <div className="space-y-6">
 <TestimonialMarquee items={firstHalf} direction="left" />
 <TestimonialMarquee items={secondHalf} direction="right" />
 </div>

 {/* CTA */}
 <div className="container mt-12 text-center">
 <a href="/blog" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4">
 Lihat semua ulasan →
 </a>
 </div>
 </section>
 );
}
