/**
 * CloudFront Function: Security Headers
 *
 * FIXES ISSUES #10, #12:
 * Adds all recommended security headers to every response.
 * Deploy to CloudFront "viewer-response" event.
 *
 * Customize CSP to match your actual API domain before deploying.
 *
 * Runtime: cloudfront-js-2.0
 */

function handler(event) {
  var response = event.response;
  var headers = response.headers;
  var request = event.request;
  var uri = request.uri;

  // ─── HSTS: enforce HTTPS for 1 year, include subdomains ────────────────────
  headers['strict-transport-security'] = {
    value: 'max-age=31536000; includeSubDomains; preload',
  };

  // ─── Prevent clickjacking ───────────────────────────────────────────────────
  headers['x-frame-options'] = { value: 'DENY' };

  // ─── Prevent MIME sniffing ──────────────────────────────────────────────────
  headers['x-content-type-options'] = { value: 'nosniff' };

  // ─── Referrer policy ───────────────────────────────────────────────────────
  headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };

  // ─── Permissions policy (disable unused browser features) ─────────────────
  headers['permissions-policy'] = {
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  };

  // ─── Content Security Policy ────────────────────────────────────────────────
  // IMPORTANT: Update API/WS domains to your actual backend domains!
  // Adjust 'connect-src' if your API is on a different domain.
  var isHtml = uri.endsWith('.html') || uri === '/';
  if (isHtml) {
    headers['content-security-policy'] = {
      value: [
        "default-src 'self'",
        // Scripts: self + inline styles needed for Vite/React
        "script-src 'self'",
        // Styles: allow inline (Tailwind CSS-in-JS)
        "style-src 'self' 'unsafe-inline'",
        // Images: self + data URIs for SVG icons
        "img-src 'self' data: blob: https:",
        // Fonts: self
        "font-src 'self' data:",
        // API & WebSocket connections — CHANGE THESE TO YOUR REAL DOMAINS
        "connect-src 'self' https://api.kahade.id wss://api.kahade.id",
        // No iframes
        "frame-src 'none'",
        // Form submissions only to self
        "form-action 'self'",
        // Base URI
        "base-uri 'self'",
        // Object/embed elements disabled
        "object-src 'none'",
      ].join('; '),
    };
  }

  // ─── Cache-Control for HTML files (never cache) ────────────────────────────
  // Hashed JS/CSS/fonts should be cached by default CloudFront TTL.
  if (isHtml || uri === '/') {
    headers['cache-control'] = {
      value: 'no-cache, no-store, must-revalidate',
    };
    headers['pragma'] = { value: 'no-cache' };
    headers['expires'] = { value: '0' };
  }

  return response;
}
