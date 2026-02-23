import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 * Handles conditional classes and deduplicates conflicting utilities
 * 
 * @example
 * ```tsx
 * cn('px-4 py-2', isActive && 'bg-primary', className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs));
}

/**
 * ARIA Properties Helper
 * 
 * Generates proper ARIA attributes for accessibility
 * Prevents common ARIA mistakes and ensures WCAG compliance
 * 
 * @param label - Accessible label for the element
 * @param describedBy - ID of element that describes this element
 * @param expanded - Whether the element is expanded (for collapsible elements)
 * @param selected - Whether the element is selected (for selectable elements)
 * @param disabled - Whether the element is disabled
 * 
 * @example
 * ```tsx
 * <button {...ariaProps('Close dialog', 'dialog-description', false, undefined, false)}>
 * <X size={24} />
 * </button>
 * ```
 */
export function ariaProps(
 label: string,
 describedBy?: string,
 expanded?: boolean,
 selected?: boolean,
 disabled?: boolean
) {
 const props: Record<string, string | boolean | undefined> = {
 'aria-label': label,
 };

 if (describedBy !== undefined) {
 props['aria-describedby'] = describedBy;
 }

 if (expanded !== undefined) {
 props['aria-expanded'] = expanded;
 }

 if (selected !== undefined) {
 props['aria-selected'] = selected;
 }

 if (disabled !== undefined) {
 props['aria-disabled'] = disabled;
 }

 return props;
}

/**
 * Keyboard Navigation Handler
 * 
 * Standardized keyboard event handling for accessibility
 * Supports Enter, Escape, Arrow keys for navigation
 * 
 * @example
 * ```tsx
 * <div 
 * tabIndex={0}
 * onKeyDown={keyboardNav({
 * onEnter: () => handleSelect(),
 * onEscape: () => handleClose(),
 * onArrowUp: () => handlePrevious(),
 * onArrowDown: () => handleNext(),
 * })}
 * >
 * Navigable Element
 * </div>
 * ```
 */
export function keyboardNav(handlers: {
 onEnter?: () => void;
 onSpace?: () => void;
 onEscape?: () => void;
 onArrowUp?: () => void;
 onArrowDown?: () => void;
 onArrowLeft?: () => void;
 onArrowRight?: () => void;
 onHome?: () => void;
 onEnd?: () => void;
}) {
 return (e: React.KeyboardEvent) => {
 // Prevent default for arrow keys to avoid page scroll
 const preventDefaultKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
 if (preventDefaultKeys.includes(e.key)) {
 e.preventDefault();
 }

 switch (e.key) {
 case 'Enter':
 handlers.onEnter?.();
 break;
 case ' ': // Space
 e.preventDefault(); // Prevent page scroll
 handlers.onSpace?.();
 break;
 case 'Escape':
 handlers.onEscape?.();
 break;
 case 'ArrowUp':
 handlers.onArrowUp?.();
 break;
 case 'ArrowDown':
 handlers.onArrowDown?.();
 break;
 case 'ArrowLeft':
 handlers.onArrowLeft?.();
 break;
 case 'ArrowRight':
 handlers.onArrowRight?.();
 break;
 case 'Home':
 handlers.onHome?.();
 break;
 case 'End':
 handlers.onEnd?.();
 break;
 }
 };
}

/**
 * Focus Trap Utility
 * 
 * Traps focus within a container (modal, dialog, etc.)
 * Ensures keyboard users can't tab out of the container
 * Essential for modal dialogs and accessibility
 * 
 * @param containerRef - React ref to the container element
 * @returns Object with enable() and disable() methods
 * 
 * @example
 * ```tsx
 * function Modal() {
 * const modalRef = useRef<HTMLDivElement>(null);
 * 
 * useEffect(() => {
 * const trap = focusTrap(modalRef);
 * trap.enable();
 * return () => trap.disable();
 * }, []);
 * 
 * return <div ref={modalRef}>...</div>;
 * }
 * ```
 */
export function focusTrap(containerRef: React.RefObject<HTMLElement>) {
 let isEnabled = false;
 let previousActiveElement: HTMLElement | null = null;

 /**
 * Get all focusable elements within the container
 */
 const getFocusableElements = (): HTMLElement[] => {
 if (!containerRef.current) return [];
 
 const focusableSelectors = [
 'a[href]',
 'button:not([disabled])',
 'textarea:not([disabled])',
 'input:not([disabled])',
 'select:not([disabled])',
 '[tabindex]:not([tabindex="-1"])',
 ].join(', ');

 return Array.from(
 containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
 );
 };

 /**
 * Handle Tab key to trap focus
 */
 const handleKeyDown = (e: KeyboardEvent) => {
 if (!isEnabled || e.key !== 'Tab') return;

 const focusableElements = getFocusableElements();
 if (focusableElements.length === 0) return;

 const firstElement = focusableElements[0];
 const lastElement = focusableElements[focusableElements.length - 1];

 // Shift + Tab on first element → go to last
 if (e.shiftKey && document.activeElement === firstElement) {
 e.preventDefault();
 lastElement?.focus();
 } 
 // Tab on last element → go to first
 else if (!e.shiftKey && document.activeElement === lastElement) {
 e.preventDefault();
 firstElement?.focus();
 }
 };

 return {
 /**
 * Enable the focus trap
 * Saves current focus and moves to first focusable element
 */
 enable: () => {
 if (isEnabled) return;
 
 isEnabled = true;
 previousActiveElement = document.activeElement as HTMLElement;
 document.addEventListener('keydown', handleKeyDown);
 
 // Focus first focusable element
 const focusableElements = getFocusableElements();
 if (focusableElements.length > 0) {
 focusableElements[0]?.focus();
 }
 },

 /**
 * Disable the focus trap
 * Restores focus to previously focused element
 */
 disable: () => {
 if (!isEnabled) return;
 
 isEnabled = false;
 document.removeEventListener('keydown', handleKeyDown);
 
 // Restore previous focus
 if (previousActiveElement && previousActiveElement.focus) {
 previousActiveElement.focus();
 }
 previousActiveElement = null;
 },
 };
}

/**
 * Format currency (IDR)
 * 
 * @example
 * ```tsx
 * formatCurrency(1000000) // "Rp 1.000.000"
 * ```
 */
export function formatCurrency(amount: number): string {
 return new Intl.NumberFormat('id-ID', {
 style: 'currency',
 currency: 'IDR',
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(amount);
}

/**
 * Format date to Indonesian locale
 * 
 * @example
 * ```tsx
 * formatDate(new Date()) // "12 Februari 2026"
 * ```
 */
export function formatDate(date: Date | string): string {
 const d = typeof date === 'string' ? new Date(date) : date;
 return new Intl.DateTimeFormat('id-ID', {
 day: 'numeric',
 month: 'long',
 year: 'numeric',
 }).format(d);
}

/**
 * Format relative time
 * 
 * @example
 * ```tsx
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 jam yang lalu"
 * ```
 */
export function formatRelativeTime(date: Date | string): string {
 const d = typeof date === 'string' ? new Date(date) : date;
 const now = new Date();
 const diffMs = now.getTime() - d.getTime();
 const diffSec = Math.floor(diffMs / 1000);
 const diffMin = Math.floor(diffSec / 60);
 const diffHour = Math.floor(diffMin / 60);
 const diffDay = Math.floor(diffHour / 24);

 if (diffSec < 60) return 'Baru saja';
 if (diffMin < 60) return `${diffMin} menit yang lalu`;
 if (diffHour < 24) return `${diffHour} jam yang lalu`;
 if (diffDay < 7) return `${diffDay} hari yang lalu`;
 return formatDate(d);
}

/**
 * Debounce function
 * Delays execution until after wait time has elapsed since last call
 * 
 * @example
 * ```tsx
 * const debouncedSearch = debounce((query: string) => {
 * api.search(query);
 * }, 300);
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
 func: T,
 wait: number
): (...args: Parameters<T>) => void {
 let timeout: NodeJS.Timeout | null = null;

 return (...args: Parameters<T>) => {
 if (timeout) clearTimeout(timeout);
 timeout = setTimeout(() => {
 func(...args);
 }, wait);
 };
}

/**
 * Throttle function
 * Ensures function is called at most once per specified time period
 * 
 * @example
 * ```tsx
 * const throttledScroll = throttle(() => {
 * }, 100);
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
 func: T,
 wait: number
): (...args: Parameters<T>) => void {
 let inThrottle = false;

 return (...args: Parameters<T>) => {
 if (!inThrottle) {
 func(...args);
 inThrottle = true;
 setTimeout(() => {
 inThrottle = false;
 }, wait);
 }
 };
}
