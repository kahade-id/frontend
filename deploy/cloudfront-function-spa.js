/**
 * CloudFront Function: SPA Routing Handler
 *
 * FIXES ISSUE #1 & #2:
 * All routes that don't match a real file (JS/CSS/image/font) are
 * rewritten to /index.html so the React SPA handles routing client-side.
 *
 * Deploy this function to CloudFront "viewer-request" event.
 * Associate it with ALL 3 distributions (landing, dashboard, admin).
 *
 * Runtime: cloudfront-js-2.0
 */

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Pass through requests that have a file extension (assets, fonts, etc.)
  // These are real files in S3 and should be served directly.
  var hasExtension = /\.[a-zA-Z0-9]{2,5}(\?.*)?$/.test(uri);

  if (!hasExtension) {
    // Rewrite any extensionless path to index.html
    // The SPA will handle the route client-side
    request.uri = '/index.html';
  }

  return request;
}
