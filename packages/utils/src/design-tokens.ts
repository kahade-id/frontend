/**
 * KAHADE DESIGN TOKENS - COMPREHENSIVE SYSTEM
 * 
 * This file defines all design tokens for the KAHADE platform
 * Replaces hardcoded values for consistency and maintainability
 * 
 * @version 2.0.0
 * @date 2026-02-14
 */

export const designTokens = {
 /**
 * COLOR SYSTEM
 * All colors follow WCAG 2.1 AAA standards
 */
 colors: {
 // Primary Palette
 primary: {
 50: '#F0F0F0',
 100: '#E0E0E0',
 200: '#C2C2C2',
 300: '#A3A3A3',
 400: '#858585',
 500: '#000000', // Brand black
 600: '#000000',
 700: '#000000',
 800: '#000000',
 900: '#000000',
 DEFAULT: '#000000',
 },
 
 // Neutral Palette (Gray Scale)
 neutral: {
 50: '#FAFAFA', // bg-subtle
 100: '#F5F5F5', // bg-muted
 200: '#E8E8E8', // border-light
 300: '#D4D4D4', // border
 400: '#A3A3A3', // text-subtle
 500: '#737373', // text-muted (FIXED: Now meets WCAG AA)
 600: '#525252', // text-secondary
 700: '#404040', // text-primary
 800: '#262626', // text-strong
 900: '#171717', // text-emphasis
 DEFAULT: '#737373',
 },
 
 // Semantic Colors
 success: {
 50: '#F0FDF4',
 100: '#DCFCE7',
 500: '#22C55E',
 600: '#16A34A',
 700: '#15803D',
 DEFAULT: '#22C55E',
 },
 error: {
 50: '#FEF2F2',
 100: '#FEE2E2',
 500: '#EF4444',
 600: '#DC2626',
 700: '#B91C1C',
 DEFAULT: '#EF4444',
 },
 warning: {
 50: '#FFFBEB',
 100: '#FEF3C7',
 500: '#F59E0B',
 600: '#D97706',
 700: '#B45309',
 DEFAULT: '#F59E0B',
 },
 info: {
 50: '#EFF6FF',
 100: '#DBEAFE',
 500: '#3B82F6',
 600: '#2563EB',
 700: '#1D4ED8',
 DEFAULT: '#3B82F6',
 },
 },
 
 /**
 * SPACING SCALE (8px base)
 * Use instead of arbitrary values
 */
 spacing: {
 0: '0',
 0.5: '0.125rem', // 2px
 1: '0.25rem', // 4px
 1.5: '0.375rem', // 6px
 2: '0.5rem', // 8px
 3: '0.75rem', // 12px
 4: '1rem', // 16px
 5: '1.25rem', // 20px
 6: '1.5rem', // 24px
 8: '2rem', // 32px
 10: '2.5rem', // 40px
 12: '3rem', // 48px
 16: '4rem', // 64px
 20: '5rem', // 80px
 24: '6rem', // 96px
 },
 
 /**
 * TYPOGRAPHY SCALE
 * Font sizes and line heights
 */
 typography: {
 fontSize: {
 xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
 sm: ['0.875rem', { lineHeight: '1.25rem' }], // 14px
 base: ['1rem', { lineHeight: '1.5rem' }], // 16px
 lg: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
 xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
 '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
 '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
 '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
 '5xl': ['3rem', { lineHeight: '1.16' }], // 48px
 '6xl': ['3.75rem', { lineHeight: '1.08' }], // 60px
 },
 fontWeight: {
 normal: 400,
 medium: 500,
 semibold: 600,
 bold: 700,
 },
 },
 
 /**
 * BORDER RADIUS
 * Consistent rounded corners
 */
 borderRadius: {
 none: '0',
 sm: '0.25rem', // 4px
 DEFAULT: '0.5rem', // 8px
 md: '0.75rem', // 12px
 lg: '1rem', // 16px
 xl: '1.5rem', // 24px
 '2xl': '2rem', // 32px
 full: '9999px',
 },
 
 /**
 * SHADOWS
 * Elevation system
 */
 boxShadow: {
 sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
 DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
 md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
 lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
 xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
 '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
 none: 'none',
 },
 
 /**
 * Z-INDEX SCALE
 * Stacking context management
 */
 zIndex: {
 hide: -1,
 base: 0,
 dropdown: 1000,
 sticky: 1100,
 fixed: 1200,
 modalBackdrop: 1300,
 modal: 1400,
 popover: 1500,
 tooltip: 1600,
 toast: 1700,
 },
 
 /**
 * BREAKPOINTS
 * Responsive design
 */
 breakpoints: {
 sm: '640px',
 md: '768px',
 lg: '1024px',
 xl: '1280px',
 '2xl': '1536px',
 },
 
 /**
 * TRANSITIONS
 * Animation timing
 */
 transition: {
 fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
 base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
 slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
 verySlow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
 },
} as const;

/**
 * TAILWIND CLASS MAPPINGS
 * Use these instead of hardcoded values
 */
export const classTokens = {
 // Background Colors
 bg: {
 primary: 'bg-black',
 subtle: 'bg-neutral-50',
 muted: 'bg-neutral-100',
 card: 'bg-white',
 overlay: 'bg-black/50',
 },
 
 // Text Colors
 text: {
 primary: 'text-neutral-900',
 secondary: 'text-neutral-700',
 muted: 'text-neutral-600',
 subtle: 'text-neutral-500',
 onPrimary: 'text-white',
 success: 'text-success-600',
 error: 'text-error-600',
 warning: 'text-warning-600',
 },
 
 // Border Colors
 border: {
 DEFAULT: 'border-neutral-300',
 light: 'border-neutral-200',
 muted: 'border-neutral-400',
 focus: 'border-black',
 },
 
 // Common Spacing Patterns
 section: {
 padding: {
 sm: 'py-12 md:py-16',
 md: 'py-16 md:py-20',
 lg: 'py-20 md:py-28',
 },
 },
 
 // Common Component Classes
 card: {
 DEFAULT: 'bg-white rounded-xl border border-neutral-200 p-6',
 hover: 'hover:border-neutral-300 transition-all',
 },
 
 button: {
 base: 'inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2',
 size: {
 sm: 'px-3 py-1.5 text-sm',
 md: 'px-4 py-2 text-base',
 lg: 'px-6 py-3 text-lg',
 },
 },
} as const;

/**
 * ACCESSIBILITY CONSTANTS
 * WCAG 2.1 compliant values
 */
export const a11y = {
 minimumTouchTarget: 44, // px
 focusRing: 'focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-none',
 skipToContent: 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50',
 visuallyHidden: 'sr-only',
 reducedMotion: 'motion-safe:',
} as const;

/**
 * COMPONENT DEFAULTS
 * Default props for common components
 */
export const componentDefaults = {
 Button: {
 size: 'md',
 variant: 'default',
 disabled: false,
 },
 Input: {
 type: 'text',
 size: 'md',
 },
 Modal: {
 closeOnEscape: true,
 closeOnOverlayClick: true,
 },
} as const;

export default designTokens;
