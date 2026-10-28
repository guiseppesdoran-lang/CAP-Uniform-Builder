'use strict';
// One definition of how long a browser (and Cloudflare) may keep each file, used by deploy/Caddyfile.tunnel (the live
// config; tests/cache-policy.test.cjs fails if they differ) and by scripts/perf-measure.cjs --headers policy (LIVE13 E65).
//
// - A URL with ?v= never changes: stamp-assets.cjs gives every script and stylesheet tag its file's content hash, and
//   js/dom-assets.js ASSET() gives every artwork URL the artwork version of data/asset-index.js, which hashes every file
//   under images/ (tests/asset-index.test.cjs fails when it is stale). Such a URL is kept a year without asking.
// - vendor/ (the fonts the stylesheet names, PDF.js) has no stamp and changes only with a vendored upgrade: a day.
// - Everything else, the page itself first, is revalidated on every load (an ETag 304 when unchanged), so a deploy is
//   seen at once and the page then names the new ?v= URLs.
const RULES = [
  { name: 'versioned', test: (pathname, query) => /(^|&)v=/.test(query), value: 'public, max-age=31536000, immutable' },
  { name: 'vendor', test: pathname => pathname.startsWith('/vendor/'), value: 'public, max-age=86400' },
  { name: 'revalidate', test: () => true, value: 'no-cache' }
];

function cacheControlFor(pathname, query = ''){
  return RULES.find(r => r.test(pathname, String(query).replace(/^\?/, ''))).value;
}

// Response headers the policy adds for a request (url as the request line has it, path and query).
function headersFor(pathname, url = pathname){
  const q = String(url).includes('?') ? String(url).slice(String(url).indexOf('?') + 1) : '';
  return { 'cache-control': cacheControlFor(pathname, q) };
}

// The Caddyfile lines for the policy, tab-indented for the site block. The three matchers do not overlap, so the order
// Caddy applies header directives in does not matter.
const CADDY_LINES = [
  '# Cache-Control from scripts/cache-policy.cjs (tests/cache-policy.test.cjs checks this block matches).',
  '# A ?v= URL (content hash or artwork version) never changes: a year, immutable.',
  '@versioned query v=*',
  `header @versioned Cache-Control "${RULES[0].value}"`,
  '# vendor/ (fonts, PDF.js) has no stamp: a day.',
  '@vendor {',
  '\tnot query v=*',
  '\tpath /vendor/*',
  '}',
  `header @vendor Cache-Control "${RULES[1].value}"`,
  '# Everything else, the page first, is revalidated on every load (an ETag 304 when unchanged).',
  '@revalidate {',
  '\tnot query v=*',
  '\tnot path /vendor/*',
  '}',
  `header @revalidate Cache-Control "${RULES[2].value}"`
];

module.exports = { RULES, cacheControlFor, headersFor, CADDY_LINES };
