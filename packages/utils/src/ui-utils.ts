import React from "react";

/**
 * ARIA Properties Helper
 *
 * Generates proper ARIA attributes for accessibility
 * Prevents common ARIA mistakes and ensures WCAG compliance
 *
 * @example
 * ```tsx
 * <button {...ariaProps('Close dialog', 'dialog-description', false, undefined, false)}>
 *   <X size={24} />
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
 *
 * @example
 * ```tsx
 * <div
 *   tabIndex={0}
 *   onKeyDown={keyboardNav({
 *     onEnter: () => handleSelect(),
 *     onEscape: () => handleClose(),
 *   })}
 * >
 *   Navigable Element
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
    const preventDefaultKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (preventDefaultKeys.includes(e.key)) {
      e.preventDefault();
    }

    switch (e.key) {
      case 'Enter':
        handlers.onEnter?.();
        break;
      case ' ':
        e.preventDefault();
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
 *
 * @example
 * ```tsx
 * function Modal() {
 *   const modalRef = useRef<HTMLDivElement>(null);
 *   useEffect(() => {
 *     const trap = focusTrap(modalRef);
 *     trap.enable();
 *     return () => trap.disable();
 *   }, []);
 *   return <div ref={modalRef}>...</div>;
 * }
 * ```
 */
export function focusTrap(containerRef: React.RefObject<HTMLElement>) {
  let isEnabled = false;
  let previousActiveElement: HTMLElement | null = null;

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

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isEnabled || e.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  return {
    enable: () => {
      if (isEnabled) return;
      isEnabled = true;
      previousActiveElement = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0]?.focus();
      }
    },
    disable: () => {
      if (!isEnabled) return;
      isEnabled = false;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && previousActiveElement.focus) {
        previousActiveElement.focus();
      }
      previousActiveElement = null;
    },
  };
}

/**
 * Format relative time (unique to ui-utils — not in utils.ts)
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

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

// NOTE: cn, formatCurrency, formatDate, debounce, throttle have been removed
// from this file. They are exported by ./utils and re-exported via index.ts.
// Keeping them here caused TS2308 duplicate export errors.
