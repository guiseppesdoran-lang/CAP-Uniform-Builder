'use strict';
// How long a browser and Cloudflare may keep each file (LIVE13 E65, Ethan: "right now it's kind of slow. I'd like it to load
// faster"). The live config, deploy/Caddyfile.tunnel, carries scripts/cache-policy.cjs's block word for word: every ?v= URL
// is kept a year, immutable, so a returning member's browser asks nothing for the 50 scripts, the stylesheet, the packs and
// the artwork; vendor/ is kept a day; the page and anything else unstamped is revalidated on every load.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const policy = require('../scripts/cache-policy.cjs');

const ROOT = path.join(__dirname, '..');
const caddy = fs.readFileSync(path.join(ROOT, 'deploy', 'Caddyfile.tunnel'), 'utf8');

test('deploy/Caddyfile.tunnel carries the policy block as scripts/cache-policy.cjs writes it', () => {
  const block = policy.CADDY_LINES.map(l => '\t' + l).join('\n');
  assert.ok(caddy.includes(block), 'run the block from scripts/cache-policy.cjs CADDY_LINES into the :80 site block');
  // No other Cache-Control header is set, so nothing overrides the policy.
  assert.equal((caddy.match(/Cache-Control/g) || []).length, 3 + 1, 'three header lines and the comment naming it');
});

test('a stamped URL is immutable for a year, vendor/ a day, the page and the rest revalidated', () => {
  assert.equal(policy.cacheControlFor('/js/state.js', 'v=a6af080356'), 'public, max-age=31536000, immutable');
  assert.equal(policy.cacheControlFor('/images/packs/blues_a-male.json', '?v=4b4fe6e342'), 'public, max-age=31536000, immutable');
  assert.equal(policy.cacheControlFor('/vendor/fonts/Ubuntu-Regular.woff2', ''), 'public, max-age=86400');
  for(const p of ['/', '/index.html', '/favicon.svg', '/images/MANIFEST.json']) assert.equal(policy.cacheControlFor(p, ''), 'no-cache', p);
  assert.deepEqual(policy.headersFor('/styles/app.css', '/styles/app.css?v=fb0f406f4d'), { 'cache-control': 'public, max-age=31536000, immutable' });
});

test('every script and stylesheet the page names is stamped, so each gets the immutable rule', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const urls = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => /\.(js|css)(\?|$)/.test(u));
  assert.ok(urls.length > 45);
  for(const u of urls){
    const [p, q = ''] = u.split('?');
    assert.equal(policy.cacheControlFor('/' + p, q), 'public, max-age=31536000, immutable', u);
  }
  // Artwork URLs carry the artwork version (js/dom-assets.js ASSET), so they are immutable too.
  assert.match(fs.readFileSync(path.join(ROOT, 'js', 'dom-assets.js'), 'utf8'), /\?v=\$\{window\.CAPUBAssetVersion\}/);
});
