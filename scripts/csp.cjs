'use strict';
// One definition of the Content-Security-Policy, used by the site build, the local server
// and the tests, so the deploy examples cannot drift from what the page actually needs.
//
// The page has no inline scripts and loads everything from its own origin. The only
// optional outside party is a submission endpoint (see config.js); when one is configured
// its origins are added so the hidden-iframe form post and its reply can work.
function endpointOrigins(endpoint) {
  if (!endpoint) return [];
  const url = new URL(endpoint);
  // Apps Script answers from script.googleusercontent.com after a redirect.
  return url.hostname === 'script.google.com'
    ? ['https://script.google.com', 'https://script.googleusercontent.com']
    : [url.origin];
}

function buildCsp({ endpoint = '', forHeader = false } = {}) {
  const origins = endpointOrigins(endpoint);
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    // Inline style="" attributes and injected <style> elements are still in use.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", ...origins],
    'frame-src': origins.length ? origins : ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", ...origins]
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
