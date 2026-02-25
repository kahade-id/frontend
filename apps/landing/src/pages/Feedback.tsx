/*
 * KAHADE FEEDBACK PAGE - PROFESSIONAL REDESIGN
 *
 * Design Philosophy:
 * - Clean, modern, and professional aesthetic
 * - Fully responsive for Mobile, Tablet, and Desktop
 * - Brand color: var(--color-black)
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChatCircleDots, Star, PaperPlaneTilt, Lightbulb,
  Bug, Sparkle, ThumbsUp, CheckCircle
} from '@phosphor-icons/react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import { Button } from '@kahade/ui';
import { Input } from '@kahade/ui';
import { Textarea } from '@kahade/ui';
import { Label } from '@kahade/ui';
import { toast } from 'sonner';
import { PageHero } from '../components/common/PageHero';

type FeedbackSubmission = {
  email: string;
  subject: string;
  message: string;
  feedbackType: string;
  rating: number;
  createdAt: string;
  target: string;
};

const feedbackTypes = [
  { id: 'suggestion', icon: Lightbulb, label: 'Saran', description: 'Bagikan ide untuk perbaikan' },
  { id: 'bug', icon: Bug, label: 'Laporan Bug', description: 'Laporkan masalah atau gangguan' },
  { id: 'feature', icon: Sparkle, label: 'Permintaan Fitur', description: 'Ajukan fitur baru' },
  { id: 'praise', icon: ThumbsUp, label: 'Apresiasi', description: 'Beritahu kami yang Anda sukai' },
];

export default function Feedback() {
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [formData, setFormData] = useState({ email: '', subject: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      toast.error('Silakan masukkan feedback Anda');
      return;
    }

    setIsSubmitting(true);
    const payload: FeedbackSubmission = { ...formData, feedbackType, rating, createdAt: new Date().toISOString(), target: 'feedback@kahade.id' };
    const rawSubmissions = localStorage.getItem('feedbackSubmissions');
    const parsed: unknown = rawSubmissions ? JSON.parse(rawSubmissions) : [];
    const existing: FeedbackSubmission[] = Array.isArray(parsed)
      ? parsed.filter((item): item is FeedbackSubmission => typeof item === 'object' && item !== null)
      : [];
    localStorage.setItem('feedbackSubmissions', JSON.stringify([payload, ...existing]));
    setIsSubmitting(false);
    setIsSubmitted(true);
    toast.success('Feedback berhasil dikirim.');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="landing-hero-offset pb-16 md:pb-20">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto text-center"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-black flex items-center justify-center mx-auto mb-5 md:mb-6">
                <CheckCircle className="w-8 h-8 md:w-10 md:h-10 text-white" aria-hidden="true" weight="fill" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-foreground">Terima Kasih!</h1>
              <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">
                Feedback Anda sudah masuk ke sistem kami. Terima kasih sudah membantu meningkatkan layanan Kahade.
              </p>
              <Button onClick={() => setIsSubmitted(false)} variant="primary" size="lg" className="px-6">
                Kirim Feedback Lainnya
              </Button>
            </motion.div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--muted)_1px,transparent_1px),linear-gradient(to_bottom,var(--muted)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" aria-hidden="true" />
        <div className="relative z-10">
          <PageHero
            eyebrow="Masukan"
            title="Kami Menghargai Masukan Anda"
            description="Bantu kami meningkatkan Kahade dengan berbagi opini, ide, dan saran Anda."
            icon={<ChatCircleDots size={20} className="text-primary" weight="duotone" />}
            align="center"
            className="pb-10 md:pb-12"
          />
        </div>
      </section>

      <section className="py-10 md:py-12 lg:py-16 bg-muted">
        <div className="container">
          <div className="max-w-2xl mx-auto">
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleSubmit}
              className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-8 space-y-6 md:space-y-8"
            >
              <div className="space-y-3 md:space-y-4">
                <Label className="text-sm md:text-base font-bold text-foreground">Jenis masukan apa yang Anda miliki?</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                  {feedbackTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFeedbackType(type.id)}
                      aria-pressed={feedbackType === type.id}
                      className={`p-3 md:p-4 rounded-xl border-2 transition-all text-center focus-visible-ring ${
                        feedbackType === type.id
                          ? 'border-black bg-muted'
                          : 'border-border hover:border-neutral-900'
                      }`}
                    >
                      <type.icon
                        className={`w-6 h-6 md:w-8 md:h-8 mx-auto mb-1.5 md:mb-2 ${
                          feedbackType === type.id ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                        weight={feedbackType === type.id ? 'fill' : 'regular'}
                      />
                      <div className="font-semibold text-xs md:text-sm text-foreground">{type.label}</div>
                      <p className="text-[11px] md:text-xs text-muted-foreground mt-1">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <Label className="text-sm md:text-base font-bold text-foreground">Bagaimana penilaian pengalaman Anda?</Label>
                <div className="flex flex-wrap items-center gap-1 md:gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="h-11 w-11 md:h-12 md:w-12 transition-transform hover:scale-105"
                    >
                      <Star
                        className={`w-5 h-5 md:w-6 md:h-6 ${
                          star <= (hoverRating || rating)
                            ? 'text-foreground'
                            : 'text-neutral-200'
                        }`}
                        weight={star <= (hoverRating || rating) ? 'fill' : 'regular'}
                      />
                    </Button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 md:ml-4 text-xs md:text-sm text-muted-foreground">
                      {rating === 1 && 'Buruk'}
                      {rating === 2 && 'Cukup'}
                      {rating === 3 && 'Baik'}
                      {rating === 4 && 'Sangat Baik'}
                      {rating === 5 && 'Luar Biasa'}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base font-bold text-foreground">Email (opsional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-card border-border focus:border-black focus:ring-black h-10 md:h-11 rounded-xl text-sm md:text-base"
                />
                <p className="text-xs md:text-sm text-muted-foreground">
                  Cantumkan email jika Anda ingin kami menindaklanjuti masukan Anda.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm md:text-base font-bold text-foreground">Subjek</Label>
                <Input
                  id="subject"
                  placeholder="Ringkasan singkat feedback Anda"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="bg-card border-border focus:border-black focus:ring-black h-10 md:h-11 rounded-xl text-sm md:text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm md:text-base font-bold text-foreground">Masukan Anda *</Label>
                <Textarea
                  id="message"
                  placeholder="Ceritakan lebih lanjut tentang pengalaman, ide, atau kendala Anda..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="bg-card border-border focus:border-black focus:ring-black min-h-[120px] md:min-h-[150px] resize-none rounded-xl text-sm md:text-base"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full gap-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  'Mengirim...'
                ) : (
                  <>
                    <PaperPlaneTilt className="w-5 h-5" aria-hidden="true" weight="bold" />
                    Kirim Feedback
                  </>
                )}
              </Button>
            </motion.form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
