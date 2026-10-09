'use strict';
// Cache-busting for the static page. GitHub Pages serves files with a short
// max-age and no fingerprints, so after a deploy a browser can pair a new
// index.html with a cached older script. This rewrites each local <script src>
// and <link rel="stylesheet" href> in index.html to carry ?v=<content hash>, so
// a changed file always gets a new URL.
//
//   node scripts/stamp-assets.cjs          rewrite index.html
//   node scripts/stamp-assets.cjs --check  exit 1 if any stamp is stale (used by tests)
//   node scripts/stamp-assets.cjs --root=dist   operate on another directory (the site build)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const rootArg = process.argv.find(arg => arg.startsWith('--root='));
const ROOT = rootArg ? path.resolve(rootArg.slice('--root='.length)) : path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'index.html');
const check = process.argv.includes('--check');

const isLocal = url => !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) && !url.startsWith('data:');
const hashOf = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 10);

const html = fs.readFileSync(PAGE, 'utf8');
const stale = [];
const next = html.replace(
  /(<script\b[^>]*\bsrc="|<link\b[^>]*\brel="stylesheet"[^>]*\bhref=")([^"?#]+)(\?[^"#]*)?(")/g,
  (match, open, url, query, close) => {
    if (!isLocal(url)) return match;
    const file = path.join(ROOT, url);
    if (!fs.existsSync(file)) {
      stale.push(`${url} (missing)`);
      return match;
    }
    const stamped = `${url}?v=${hashOf(file)}`;
    if (`${url}${query || ''}` !== stamped) stale.push(url);
    return `${open}${stamped}${close}`;
  }
);

if (check) {
  if (stale.length) {
    console.error(`Stale or missing asset stamps in index.html:\n  ${stale.join('\n  ')}\nRun: npm run stamp:assets`);
    process.exit(1);
  }
  console.log('Asset stamps are current.');
} else {
  fs.writeFileSync(PAGE, next);
  console.log(stale.length ? `Restamped ${stale.length} asset(s): ${stale.join(', ')}` : 'Asset stamps already current.');
}
