'use strict';
// One definition of the Content-Security-Policy, used by the site build, the local server
// and the tests, so the deploy examples cannot drift from what the page actually needs.
//
// The page has no inline scripts and asks nothing of any other origin: every directive
// that can name an outside party names only the page's own origin or nothing, and no
// argument adds one.
function buildCsp({ forHeader = false } = {}) {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    // Inline style="" attributes and injected <style> elements are still in use.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"]
  };
  // frame-ancestors is ignored in a <meta> tag, so it is only added for real headers.
  if (forHeader) directives['frame-ancestors'] = ["'none'"];
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

module.exports = { buildCsp, SECURITY_HEADERS };
