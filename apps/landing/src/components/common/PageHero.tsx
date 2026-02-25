import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export type HeroChipTone = 'neutral' | 'success' | 'info' | 'warning';

type HeroAlign = 'left' | 'center';

export interface HeroChip {
  label: string;
  tone?: HeroChipTone;
}

interface BaseHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  chips?: HeroChip[];
  icon?: ReactNode;
  align?: HeroAlign;
}

interface PageHeroProps extends BaseHeroProps {
  actions?: ReactNode;
  className?: string;
}

const toneStyles: Record<HeroChipTone, string> = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function HeroBody({ eyebrow, title, description, chips = [], icon, align = 'left' }: BaseHeroProps) {
  const isCentered = align === 'center';

  return (
    <>
      <div className={`flex items-center gap-2 mb-4 ${isCentered ? 'justify-center' : ''}`}>
        {icon ?? <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{eyebrow}</span>
      </div>
      <h1 className={`text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-4 ${isCentered ? 'text-center' : ''}`}>{title}</h1>
      <p className={`text-muted-foreground text-base md:text-lg max-w-3xl mb-6 ${isCentered ? 'text-center mx-auto' : ''}`}>{description}</p>
      {!!chips.length && (
        <div className={`flex flex-wrap gap-3 ${isCentered ? 'justify-center' : ''}`}>
          {chips.map(chip => (
            <span key={chip.label} className={`px-3 py-1.5 rounded-full text-sm font-medium ${toneStyles[chip.tone ?? 'neutral']}`}>
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function PageHero({ actions, className = '', align = 'left', ...props }: PageHeroProps) {
  return (
    <section className={`max-w-[1100px] mx-auto px-6 landing-hero-offset pb-12 ${className}`}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-12 pb-12 border-b">
        <HeroBody {...props} align={align} />
        {actions ? <div className={`mt-8 flex flex-wrap gap-3 ${align === 'center' ? 'justify-center' : ''}`}>{actions}</div> : null}
      </motion.div>
    </section>
  );
}

interface PageHeroArticleProps extends BaseHeroProps {
  meta?: ReactNode;
  backLink?: ReactNode;
}

export function PageHeroArticle({ backLink, meta, ...props }: PageHeroArticleProps) {
  return (
    <section className="max-w-[900px] mx-auto px-6 landing-hero-offset pb-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-10 pb-10 border-b">
        {backLink ? <div className="mb-6">{backLink}</div> : null}
        <HeroBody {...props} />
        {meta ? <div className="mt-6 text-sm text-muted-foreground">{meta}</div> : null}
      </motion.div>
    </section>
  );
}
