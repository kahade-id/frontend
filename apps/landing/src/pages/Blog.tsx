import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Clock } from '@phosphor-icons/react';
import { Link, useLocation } from 'wouter';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { PageHero } from '../components/common/PageHero';
import { staggerItem, fadeInUp, viewport } from '@kahade/utils';
import { Button } from '@kahade/ui';

const filters = ['Semua', 'Keamanan', 'Tips Transaksi', 'Update', 'Bisnis'] as const;

type FilterType = (typeof filters)[number];

type BlogPost = {
  id: number;
  slug: string;
  category: Exclude<FilterType, 'Semua'>;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: number;
};

const posts: BlogPost[] = [
  {
    id: 1,
    slug: 'tips-transaksi-online-aman',
    category: 'Keamanan',
    title: '7 Tips Transaksi Online yang Aman di Era Digital',
    excerpt:
      'Bertransaksi online kini semakin mudah, tapi risiko penipuan juga meningkat. Pelajari 7 langkah konkret melindungi diri Anda.',
    author: 'Tim Kahade',
    date: '15 Jan 2025',
    readTime: 5,
  },
  {
    id: 2,
    slug: 'escrow-untuk-freelancer',
    category: 'Tips Transaksi',
    title: 'Panduan Lengkap Menggunakan Escrow untuk Freelancer',
    excerpt:
      'Sebagai freelancer, escrow adalah cara terbaik memastikan pembayaran. Begini cara menggunakannya secara efektif.',
    author: 'Sari Dewi',
    date: '10 Jan 2025',
    readTime: 8,
  },
  {
    id: 3,
    slug: 'kahade-v2-update',
    category: 'Update',
    title: 'Kahade v2.0: Fitur Resolusi Sengketa AI Hadir!',
    excerpt:
      'Update terbesar dalam sejarah Kahade. AI kami kini bisa membantu menyelesaikan sengketa dalam waktu kurang dari 24 jam.',
    author: 'Tim Product',
    date: '5 Jan 2025',
    readTime: 4,
  },
  {
    id: 4,
    slug: 'umkm-perlu-escrow',
    category: 'Bisnis',
    title: 'Mengapa UMKM Perlu Menggunakan Escrow',
    excerpt:
      'UMKM sering kehilangan pelanggan karena masalah kepercayaan. Escrow adalah solusi yang affordable untuk semua skala bisnis.',
    author: 'Ahmad Rizki',
    date: '28 Des 2024',
    readTime: 6,
  },
];

const categoryColor: Record<BlogPost['category'], string> = {
  Keamanan: 'badge-error',
  'Tips Transaksi': 'badge-success',
  Update: 'badge-primary',
  Bisnis: 'badge-secondary',
};

function FeaturedPostCard({ post }: { post: BlogPost }) {
  return (
    <motion.div variants={fadeInUp} initial="initial" whileInView="animate" viewport={viewport}>
      <div className="grid md:grid-cols-[0.55fr_0.45fr] gap-8 bg-muted/30 rounded-3xl overflow-hidden border border-border">
        <div className="aspect-[4/3] md:aspect-auto bg-gradient-to-br from-primary/20 to-primary/5 min-h-[280px]" />
        <div className="p-8 md:p-12 flex flex-col justify-center">
          <span className={`badge ${categoryColor[post.category]} mb-4 self-start`}>{post.category}</span>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{post.title}</h2>
          <p className="text-muted-foreground mb-6">{post.excerpt}</p>
          <Button asChild variant="primary" className="self-start inline-flex items-center">
            <Link href={`/blog/${post.slug}`}>
              Baca Selengkapnya <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function FilterChips({ activeFilter, onFilterChange }: { activeFilter: FilterType; onFilterChange: (filter: FilterType) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mb-10">
      {filters.map((filter) => (
        <Button
          key={filter}
          variant="chip"
          data-state={activeFilter === filter ? 'active' : 'inactive'}
          onClick={() => onFilterChange(filter)}
        >
          {filter}
        </Button>
      ))}
    </div>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <motion.article variants={staggerItem}>
        <div className="rounded-2xl overflow-hidden mb-4 aspect-video bg-gradient-to-br from-primary/10 to-muted border border-border group-hover:border-primary transition-colors" />
        <span className={`badge ${categoryColor[post.category]} mb-3`}>{post.category}</span>
        <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{post.excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{post.author}</span>
          <span>·</span>
          <span>{post.date}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {post.readTime} mnt
          </span>
        </div>
      </motion.article>
    </Link>
  );
}

export default function Blog() {
  const [location, setLocation] = useLocation();

  const activeFilter = useMemo<FilterType>(() => {
    const selected = new URLSearchParams(location.split('?')[1] ?? '').get('category') ?? 'Semua';
    return filters.includes(selected as FilterType) ? (selected as FilterType) : 'Semua';
  }, [location]);

  const featured = posts[0];
  const filtered = activeFilter === 'Semua' ? posts.slice(1) : posts.slice(1).filter((post) => post.category === activeFilter);

  const handleFilterChange = (filter: FilterType) => {
    setLocation(filter === 'Semua' ? '/blog' : `/blog?category=${encodeURIComponent(filter)}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <PageHero
        eyebrow="Blog"
        title="Insight & Update Kahade"
        description="Artikel, studi kasus, dan pembaruan produk untuk membantu Anda bertransaksi lebih aman."
        chips={[{ label: 'Update Produk' }, { label: 'Tips Transaksi' }, { label: 'Keamanan' }]}
      />

      <section className="section-padding-md">
        <div className="container">
          <FeaturedPostCard post={featured} />
        </div>
      </section>

      <section className="section-padding-md">
        <div className="container">
          <FilterChips activeFilter={activeFilter} onFilterChange={handleFilterChange} />

          <AnimatePresence mode="wait">
            <motion.div
              key={activeFilter}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filtered.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <Footer />
    </div>
  );
}
