/**
 * SECURITY UTILITIES
 * Client-side security helpers for input sanitization and validation.
 */

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(input: string): string {
  return input
    .trim()
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validate that a URL is safe (http/https only, no javascript:)
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Mask sensitive data for display (e.g., email, phone)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.charAt(0) + '***' + local.charAt(local.length - 1);
  return `${masked}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(0, 3) + '****' + digits.slice(-3);
}

/**
 * Rate limiting utility for client-side debouncing of sensitive operations
 */
export function createRateLimiter(maxCalls: number, windowMs: number) {
  const calls: number[] = [];
  return function isAllowed(): boolean {
    const now = Date.now();
    // Remove calls outside the window
    while (calls.length > 0 && calls[0] < now - windowMs) {
      calls.shift();
    }
    if (calls.length >= maxCalls) return false;
    calls.push(now);
    return true;
  };
}
