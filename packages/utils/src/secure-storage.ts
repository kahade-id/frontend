/**
 * Secure Token Storage Utility
 * 
 * SECURITY IMPROVEMENT:
 * - Moves JWT tokens from localStorage to httpOnly cookies
 * - Prevents XSS attacks from stealing tokens
 * - Implements secure cookie handling
 * 
 * MIGRATION GUIDE:
 * 1. Backend must set tokens in httpOnly cookies instead of response body
 * 2. Frontend reads CSRF token from response header
 * 3. Frontend includes CSRF token in request headers
 * 4. Tokens are automatically sent with requests (credentials: 'include')
 */

export class SecureStorage {
 private static readonly CSRF_TOKEN_KEY = 'csrf_token';

 /**
 * Store CSRF token (not httpOnly, needs to be read by JS)
 */
 static setCsrfToken(token: string): void {
 sessionStorage.setItem(this.CSRF_TOKEN_KEY, token);
 }

 /**
 * Get CSRF token for request headers
 * Token is sourced from response headers and stored in sessionStorage.
 */
 static getCsrfToken(): string | null {
 const sessionToken = sessionStorage.getItem(this.CSRF_TOKEN_KEY);
 if (sessionToken) {
 return sessionToken;
 }

 return null;
 }

 /**
 * Clear CSRF token on logout
 */
 static clearCsrfToken(): void {
 sessionStorage.removeItem(this.CSRF_TOKEN_KEY);
 }

 /**
 * Clear all stored data
 */
 static clearAll(): void {
 sessionStorage.clear();
 // Note: httpOnly cookies are cleared by backend on logout
 }

 /**
 * DEPRECATED: Remove JWT from localStorage
 * This function helps migrate existing tokens
 */
 static migrateFromLocalStorage(): void {
 const oldToken = localStorage.getItem('kahade_token');
 if (oldToken) {
 console.warn('⚠️ JWT token found in localStorage. Please re-login for secure cookie-based authentication.');
 localStorage.removeItem('kahade_token');
 }
 }
}

// Run migration on module load
SecureStorage.migrateFromLocalStorage();
