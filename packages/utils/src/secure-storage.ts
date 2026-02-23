/**
 * Secure Token Storage Utility
 *
 * SECURITY: JWT tokens are stored in HttpOnly cookies (set by backend).
 * Frontend only stores CSRF token in sessionStorage for request headers.
 * XSS attacks cannot steal auth tokens.
 *
 * FIX (Issue #15): Replaced direct console.warn with logger utility.
 */

import { logger } from './logger';

export class SecureStorage {
  private static readonly CSRF_TOKEN_KEY = 'csrf_token';

  /**
   * Store CSRF token (not HttpOnly — must be readable by JS for request headers)
   */
  static setCsrfToken(token: string): void {
    sessionStorage.setItem(this.CSRF_TOKEN_KEY, token);
  }

  /**
   * Get CSRF token for inclusion in mutating request headers.
   */
  static getCsrfToken(): string | null {
    return sessionStorage.getItem(this.CSRF_TOKEN_KEY);
  }

  /**
   * Clear CSRF token on logout.
   */
  static clearCsrfToken(): void {
    sessionStorage.removeItem(this.CSRF_TOKEN_KEY);
  }

  /**
   * Clear all session data. HttpOnly cookies are cleared by the backend.
   */
  static clearAll(): void {
    sessionStorage.clear();
  }

  /**
   * DEPRECATED: Migrate old JWT from localStorage if present.
   * FIX (Issue #15): Use logger instead of console.warn.
   */
  static migrateFromLocalStorage(): void {
    const oldToken = localStorage.getItem('kahade_token');
    if (oldToken) {
      // FIX: use logger so this message is suppressed in production
      logger.warn(
        '⚠️ JWT token found in localStorage. Please re-login for secure cookie-based authentication.'
      );
      localStorage.removeItem('kahade_token');
    }
  }
}

// Run migration on module load
SecureStorage.migrateFromLocalStorage();
