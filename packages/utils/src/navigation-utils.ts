/**
 * NAVIGATION UTILITIES
 * Helpers for client-side navigation and URL management.
 */

/**
 * Get the current page path without query string
 */
export function getCurrentPath(): string {
  return window.location.pathname;
}

/**
 * Check if the current path matches a given route pattern
 */
export function isActivePath(path: string, exact = false): boolean {
  const currentPath = window.location.pathname;
  if (exact) return currentPath === path;
  return currentPath.startsWith(path);
}

/**
 * Build a URL with query parameters
 */
export function buildUrl(base: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.pathname + (url.search || '');
}

/**
 * Get a specific query parameter from the current URL
 */
export function getQueryParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Navigate to an external URL safely
 */
export function openExternalUrl(url: string, newTab = true): void {
  const link = document.createElement('a');
  link.href = url;
  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.click();
}

/**
 * Scroll to top of page smoothly
 */
export function scrollToTop(smooth = true): void {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' });
}

/**
 * Scroll to a specific element by ID
 */
export function scrollToElement(elementId: string, offset = 80): void {
  const element = document.getElementById(elementId);
  if (!element) return;
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}
