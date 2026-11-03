'use strict';
// Builds dist/: only the files the page needs at runtime, ready to serve from any static
// web server. Everything else in the repository (tests, scripts, docs, the Apps Script
// source, package files, git data) stays out of the web root.
//
//   node scripts/build-site.cjs                    build dist/
//   node scripts/build-site.cjs --endpoint=URL     also enable submissions against URL
//   CAPUB_SUBMISSION_ENDPOINT=URL node scripts/build-site.cjs   same, from the environment
//
// No bundler or transform is involved: files are copied as they are, plus a
// Content-Security-Policy <meta> fallback in dist/index.html and, when an endpoint is
// given, that endpoint in dist/config.js (then asset hashes are recomputed).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { buildCsp } = require('./csp.cjs');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const endpointArg = process.argv.find(arg => arg.startsWith('--endpoint='));
const endpoint = (endpointArg ? endpointArg.slice('--endpoint='.length) : process.env.CAPUB_SUBMISSION_ENDPOINT || '').trim();
if (endpoint) {
  let url;
  try { url = new URL(endpoint); } catch (_) { fail(`Not a valid URL: ${endpoint}`); }
  if (url.protocol !== 'https:') fail('The submission endpoint must be https.');
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const referenced = new Set();
for (const match of html.matchAll(/(?:src|href)="([^"#?]+)/g)) {
  const value = match[1];
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(value) || value.startsWith('data:')) continue;
  referenced.add(value);
}
referenced.add('index.html');
// The MIT license asks for its notice to travel with copies, so the published site carries both.
referenced.add('LICENSE');
referenced.add('NOTICE.md');

const runtimeFiles = new Set();
for (const rel of referenced) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) fail(`index.html references a missing file: ${rel}`);
  runtimeFiles.add(rel);
}

// Directories the code reads from at runtime without naming each file in the HTML.
const runtimeDirs = ['images', 'vendor'];
const skipFile = name => name.startsWith('.') || name.endsWith('.md') || name.endsWith('.keep');
// No picture is a photo (LIVE13 E118): the raster directories the page stopped reading were deleted, images/military-mini-medals last
// (the medal bodies are traced in the art tree from Vanguard references; the builder keeps only its names in data/military-medals.js).
// A raster under images/ is published only while tests/no-raster-allowlist.json keeps it, for art still to come.
const NOT_SHIPPED = [];
const RASTER = /\.(png|jpe?g|webp|gif)$/i;
const allowed = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'no-raster-allowlist.json'), 'utf8')));
const onAllowlist = rel => allowed.some(entry => entry.endsWith('/') ? rel.startsWith(entry) : rel === entry);
function walk(dir, out) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir.split(path.sep).join('/'), entry.name);
    if (entry.isDirectory()) { if (!NOT_SHIPPED.includes(rel)) walk(rel, out); }
    else if (!skipFile(entry.name) && !(rel.startsWith('images/') && RASTER.test(rel) && !onAllowlist(rel))) out.add(rel);
  }
}
for (const dir of runtimeDirs) walk(dir, runtimeFiles);

// --list: the files a build would publish, and nothing else (tests/no-raster.test.cjs).
if (process.argv.includes('--list')) {
  // Written synchronously: process.exit would cut off what console.log still has queued for a pipe.
  let list = Buffer.from([...runtimeFiles].sort().join('\n') + '\n');
  while (list.length) {
    try { list = list.subarray(fs.writeSync(1, list)); } catch (err) { if (err.code !== 'EAGAIN') throw err; }
  }
  process.exit(0);
}

// Fail rather than ship a page whose asset hashes are stale.
const check = spawnSync(process.execPath, [path.join(__dirname, 'stamp-assets.cjs'), '--check'], { encoding: 'utf8' });
if (check.status !== 0) fail(check.stderr || check.stdout);

fs.rmSync(DIST, { recursive: true, force: true });
let bytes = 0;
for (const rel of [...runtimeFiles].sort()) {
  const target = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), target);
  bytes += fs.statSync(target).size;
}

// CSP fallback for hosts that cannot set headers; the real headers are in deploy/.
const csp = buildCsp({ endpoint });
const distHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
  .replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
if (!distHtml.includes('Content-Security-Policy')) fail('Could not insert the Content-Security-Policy meta tag.');
fs.writeFileSync(path.join(DIST, 'index.html'), distHtml);

// The artwork packs (scripts/build-asset-packs.cjs): a slim manifest and one spec pack per uniform and cut, named in
// dist/js/asset-packs.js, so the page draws a uniform from one request instead of a round trip per spec.
const writePacks = () => require('./build-asset-packs.cjs').applyToSite(DIST).catch(err => fail(err.message));

async function finish() {
  const packs = await writePacks();
  if (endpoint) {
    const configPath = path.join(DIST, 'config.js');
    const config = fs.readFileSync(configPath, 'utf8');
    if (!/submissionEndpoint:\s*''/.test(config)) fail("config.js no longer has an empty submissionEndpoint to replace.");
    fs.writeFileSync(configPath, config.replace(/submissionEndpoint:\s*''/, `submissionEndpoint: ${JSON.stringify(endpoint)}`));
  }
  const restamp = spawnSync(process.execPath, [path.join(__dirname, 'stamp-assets.cjs'), `--root=${DIST}`], { encoding: 'utf8' });
  if (restamp.status !== 0) fail(restamp.stderr || restamp.stdout);
  // Last, once every file in dist/ is final: brotli and gzip copies for Caddy's precompressed (scripts/precompress.cjs).
  const packed = require('./precompress.cjs').precompress(DIST);

  console.log(`dist/: ${runtimeFiles.size} files, ${(bytes / 1048576).toFixed(1)} MB, ${Object.keys(packs.uniforms).length} artwork packs, ${packed.files} precompressed (${(packed.br / 1024).toFixed(0)} KB brotli)${endpoint ? `, submissions enabled for ${new URL(endpoint).origin}` : ', submissions off'}`);
}
finish().catch(err => fail(err && err.stack || String(err)));
