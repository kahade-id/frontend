import React from 'react';
import { cn } from '@kahade/utils';

// FIX (v3.3): TypeScript interface lengkap untuk SectionLabel
interface SectionLabelProps {
 children: React.ReactNode;
 icon?: React.ElementType; // prop tetap lowercase di interface
 variant?: 'dark' | 'light';
 className?: string;
}

export function SectionLabel({ children, icon: Icon, variant = 'dark', className }: SectionLabelProps) {
 return (
 <span className={cn(
 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full',
 'text-[0.6875rem] font-bold tracking-widest uppercase mb-4',
 variant === 'dark'
 ? 'bg-primary text-primary-foreground'
 : 'bg-neutral-100 text-neutral-600 border border-neutral-200',
 className
 )}>
 {/* FIX: Icon sudah di-destructure ke PascalCase — aman sebagai JSX */}
 {Icon && <Icon className="w-3.5 h-3.5" weight="fill" />}
 {children}
 </span>
 );
}

export default SectionLabel;
