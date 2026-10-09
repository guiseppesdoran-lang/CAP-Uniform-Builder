'use strict';
// Guards for things that must not come back: committed secrets and addresses, third-party
// code, inline script, and a site build that publishes more than the page needs.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildCsp, SECURITY_HEADERS } = require('../scripts/csp.cjs');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function trackedTextFiles() {
  const listed = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  return listed.stdout.split('\n').filter(Boolean)
    // Artwork, vendored third-party code and the rack baseline are not hand-written source.
    .filter(rel => !/^(images|vendor)\//.test(rel) && rel !== 'scripts/baseline.tsv')
    .filter(rel => !/\.(png|webp|jpe?g|gif|ico|woff2?)$/i.test(rel));
}

test('no email addresses are committed (test addresses on example.test are allowed)', () => {
  const found = [];
  for (const rel of trackedTextFiles()) {
    for (const match of read(rel).matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
      if (!/@example\.(test|com)$/.test(match[0])) found.push(`${rel}: ${match[0]}`);
    }
  }
  assert.deepEqual(found, []);
});

test('no 64-character hex constants (password hashes, keys) are committed', () => {
  const found = [];
  for (const rel of trackedTextFiles()) {
    let text = read(rel);
    // military-data.js lists a checksum for each artwork file; only those fields are exempt.
    if (rel === 'military/military-data.js') text = text.replace(/"(?:source)?[Ss]ha256":"[0-9a-fA-F]{64}"/g, '');
    if (/\b[0-9a-fA-F]{64}\b/.test(text)) found.push(rel);
  }
  assert.deepEqual(found, []);
});

test('the page ships no admin login, native prompts or client-side password checks', () => {
  const sources = trackedTextFiles().filter(rel => /\.js$/.test(rel) && !rel.startsWith('scripts/') && !rel.startsWith('tests/') && !rel.startsWith('google-apps-script/'));
  for (const rel of sources) {
    // bootstrap.js deletes the keys older builds left in localStorage; that is the only allowed mention.
    const text = read(rel).replace(/localStorage\.removeItem\('CAPUB_ADMIN_HISTORY[A-Z_0-9]*'\);?|sessionStorage\.removeItem\('CAPUB_ADMIN_AUTH_V1'\);?/g, '');
    assert.ok(!/\bprompt\(/.test(text), `${rel} uses prompt()`);
    assert.ok(!/admin-history|CAPUB_ADMIN_HISTORY|CAPUB_ADMIN_AUTH|ADMIN_SHA256/.test(text), `${rel} references the removed admin history`);
    assert.ok(!/entered\s*===|password\s*===/i.test(text), `${rel} compares a password in the browser`);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'admin-history.js')), false);
});

test('index.html has no inline script, inline event handlers or third-party script/style loads', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'inline <script>');
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, 'inline event handler attribute');
  assert.doesNotMatch(html, /(?:src|href)="(?:https?:)?\/\//i, 'third-party src/href');
});

test('application code requests nothing from other origins at load time', () => {
  const sources = trackedTextFiles().filter(rel => /\.js$/.test(rel) && !rel.startsWith('scripts/') && !rel.startsWith('tests/') && !rel.startsWith('google-apps-script/'));
  // purchase-catalog.js only holds vendor links shown to the user and military-data.js cites where
  // each award came from; neither is requested. Namespaces are not requests.
  const allowed = [/w3\.org\/2000\/svg/, /^purchase-catalog\.js$/, /^military\/military-data\.js$/];
  for (const rel of sources) {
    for (const match of read(rel).matchAll(/https?:\/\/[A-Za-z0-9./_-]+/g)) {
      const ok = allowed.some(rule => rule.test(rel) || rule.test(match[0]));
      assert.ok(ok, `${rel} mentions ${match[0]}`);
    }
  }
  assert.match(read('config.js'), /submissionEndpoint:\s*''/, 'the committed config leaves submissions off');
});

test('pdf.js is vendored with its license and loaded from the same origin', () => {
  for (const file of ['pdf.min.js', 'pdf.worker.min.js', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'vendor', 'pdfjs', file)), `vendor/pdfjs/${file}`);
  }
  const loader = read('js/member-report-import.js');
  assert.match(loader, /vendor\/pdfjs\/pdf\.min\.js/);
  assert.match(loader, /vendor\/pdfjs\/pdf\.worker\.min\.js/);
});

test('the deploy examples carry the exact policy and headers the page is tested with', () => {
  const csp = buildCsp({ forHeader: true });
  for (const file of ['deploy/nginx.conf.example', 'deploy/Caddyfile.example']) {
    const text = read(file);
    assert.ok(text.includes(csp), `${file} has a different Content-Security-Policy than scripts/csp.cjs`);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.ok(text.includes(name) && text.includes(value), `${file} is missing ${name}`);
    }
    assert.match(text, /Strict-Transport-Security/);
  }
});

test('the policy allows no inline script, no framing and no outside origin by default', () => {
  const csp = buildCsp({ forHeader: true });
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /https?:/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  const withEndpoint = buildCsp({ forHeader: true, endpoint: 'https://script.google.com/macros/s/x/exec' });
  assert.match(withEndpoint, /connect-src 'self' https:\/\/script\.google\.com https:\/\/script\.googleusercontent\.com/);
});

test('the site build publishes only runtime files and carries the policy', () => {
  const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs')], { encoding: 'utf8' });
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const dist = path.join(ROOT, 'dist');
  for (const name of ['.git', 'tests', 'scripts', 'docs', 'deploy', 'google-apps-script', 'package.json', 'PATCH_SUBMISSION_SETUP.md', 'admin-history.js']) {
    assert.equal(fs.existsSync(path.join(dist, name)), false, `dist/${name} must not be published`);
  }
  for (const name of ['index.html', 'config.js', 'LICENSE', 'NOTICE.md', 'favicon.svg', 'js/state.js', 'styles/app.css', 'vendor/pdfjs/pdf.min.js', 'images']) {
    assert.ok(fs.existsSync(path.join(dist, name)), `dist/${name} is missing`);
  }
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  assert.ok(html.includes(`content="${buildCsp()}"`), 'dist/index.html is missing the policy meta tag');
  assert.match(fs.readFileSync(path.join(dist, 'config.js'), 'utf8'), /submissionEndpoint:\s*''/);
  const stamps = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'stamp-assets.cjs'), `--root=${dist}`, '--check'], { encoding: 'utf8' });
  assert.equal(stamps.status, 0, stamps.stderr || stamps.stdout);
});

test('a build with an endpoint enables submissions and widens the policy to that origin only', () => {
  const endpoint = 'https://script.google.com/macros/s/AKexample/exec';
  const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs'), `--endpoint=${endpoint}`], { encoding: 'utf8' });
  try {
    assert.equal(built.status, 0, built.stderr || built.stdout);
    const dist = path.join(ROOT, 'dist');
    assert.ok(fs.readFileSync(path.join(dist, 'config.js'), 'utf8').includes(JSON.stringify(endpoint)));
    assert.ok(fs.readFileSync(path.join(dist, 'index.html'), 'utf8').includes(buildCsp({ endpoint })));
  } finally {
    // Leave the default (submissions off) build behind for anyone serving dist/ afterwards.
    spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs')], { encoding: 'utf8' });
  }
  const refused = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs'), '--endpoint=http://insecure.example/exec'], { encoding: 'utf8' });
  assert.notEqual(refused.status, 0, 'an http endpoint must be refused');
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs')], { encoding: 'utf8' });
});
