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
  const sources = trackedTextFiles().filter(rel => /\.js$/.test(rel) && !rel.startsWith('scripts/') && !rel.startsWith('tests/'));
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
  const sources = trackedTextFiles().filter(rel => /\.js$/.test(rel) && !rel.startsWith('scripts/') && !rel.startsWith('tests/'));
  // purchase-catalog.js only holds vendor links shown to the user and military-data.js cites where
  // each award came from; neither is requested. Namespaces are not requests.
  const allowed = [/w3\.org\/2000\/svg/, /w3\.org\/1999\/xlink/, /^purchase-catalog\.js$/, /^military\/military-data\.js$/];
  for (const rel of sources) {
    for (const match of read(rel).matchAll(/https?:\/\/[A-Za-z0-9./_-]+/g)) {
      const ok = allowed.some(rule => rule.test(rel) || rule.test(match[0]));
      assert.ok(ok, `${rel} mentions ${match[0]}`);
    }
  }
  // Replaces "the committed config leaves submissions off": the setting itself is gone, so the config is checked to hold the page's two settings and no address.
  const config = read('config.js');
  assert.doesNotMatch(config, /submission|endpoint|https?:/i, 'config.js names no endpoint and no address');
  const sandbox = { window: {} };
  require('node:vm').runInNewContext(config, sandbox);
  assert.deepEqual(Object.keys(sandbox.window.CAPUB_CONFIG), ['metrics', 'feedback']);
});

test('the page holds no code that sends a member\'s picture anywhere: no submission script, no submit button, no form posted to another origin', () => {
  const page = read('index.html');
  assert.doesNotMatch(page, /patch-submission|capubSubmitPatch|google-apps-script/, 'index.html loads or names submission code');
  const sources = trackedTextFiles().filter(rel => /\.(js|css)$/.test(rel) && !/^(scripts|tests|deploy)\//.test(rel));
  for (const rel of sources) {
    assert.doesNotMatch(read(rel), /CAPUB_PATCH_SUBMISSION|capubSubmitPatch|capubPatchSubmit|script\.google(usercontent)?\.com/, `${rel} holds submission code`);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'patch-submission.js')), false);
  // The page's own forms (the access gate, the feedback box) post to its own origin or to nothing.
  assert.doesNotMatch(page, /<form\b[^>]*\baction="(?:https?:)?\/\//i, 'a form posts to another origin');
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

test('the page asks for an access code and stays out of search', () => {
  const page = read('index.html');
  assert.match(page, /<meta name="robots" content="noindex/);
  assert.match(page, /<script src="js\/access-gate\.js/);
  assert.match(page, /<label for="accessGateInput">Access code<\/label>/);
  assert.match(page.split('</form>')[0], /Developed by C\/Col Guiseppe Doran and C\/Lt Col Ethan Hillard/);
  assert.match(page, /<details class="accessGateHint"><summary>Need a hint\?<\/summary>/);
  assert.match(read('styles/app.css'), /html\[data-access="ok"\] #accessGate\{display:none\}/);
  for (const file of ['deploy/nginx.conf.example', 'deploy/Caddyfile.example']) {
    assert.match(read(file), /X-Robots-Tag "noindex/, `${file} does not send noindex`);
  }
});

test('the policy allows no inline script, no framing and no outside origin by default', () => {
  const csp = buildCsp({ forHeader: true });
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /https?:/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  // Replaces the check that an endpoint adds its origins to connect-src: the policy is pinned word for word and no argument can add an origin.
  const exact = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
  assert.equal(buildCsp(), exact);
  assert.equal(buildCsp({ forHeader: true }), `${exact}; frame-ancestors 'none'`);
  assert.equal(buildCsp({ forHeader: true, endpoint: 'https://script.google.com/macros/s/x/exec' }), buildCsp({ forHeader: true }), 'no argument widens the policy');
  assert.match(buildCsp(), /frame-src 'none'/);
  assert.match(buildCsp(), /form-action 'self'(;|$)/);
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
  // Replaces "dist/config.js leaves submissions off": the build writes nothing into config.js, so the published copy is the committed one.
  assert.equal(fs.readFileSync(path.join(dist, 'config.js'), 'utf8'), read('config.js'));
  const stamps = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'stamp-assets.cjs'), `--root=${dist}`, '--check'], { encoding: 'utf8' });
  assert.equal(stamps.status, 0, stamps.stderr || stamps.stdout);
  // No photo is published (tests/no-raster.test.cjs).
  const noRaster = require('./helpers/no-raster.cjs');
  assert.deepEqual(noRaster.strayRasters(noRaster.walk(path.join(dist, 'images')).map(f => path.relative(dist, f).split(path.sep).join('/'))), []);
});

// Replaces "a build with an endpoint enables submissions and widens the policy to that origin only" and "an http endpoint must be refused": the build has no endpoint
// option any more, so an endpoint handed to it by argument or by the environment changes nothing: the policy and config.js are the ones of a plain build.
test('a build is not widened by an endpoint offered to it: the policy and config.js are those of a plain build', () => {
  const endpoint = 'https://script.google.com/macros/s/AKexample/exec';
  const dist = path.join(ROOT, 'dist');
  try {
    for (const [args, env] of [[[`--endpoint=${endpoint}`], {}], [['--endpoint=http://insecure.example/exec'], {}], [[], { CAPUB_SUBMISSION_ENDPOINT: endpoint }]]) {
      const built = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs'), ...args], { encoding: 'utf8', env: Object.assign({}, process.env, env) });
      assert.equal(built.status, 0, built.stderr || built.stdout);
      const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
      assert.ok(html.includes(`content="${buildCsp()}"`), 'the policy of the page is the plain one');
      assert.doesNotMatch(html, /script\.google/);
      assert.equal(fs.readFileSync(path.join(dist, 'config.js'), 'utf8'), read('config.js'));
    }
  } finally {
    spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-site.cjs')], { encoding: 'utf8' });
  }
});
