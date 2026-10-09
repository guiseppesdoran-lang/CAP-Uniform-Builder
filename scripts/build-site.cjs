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

// Fail rather than ship a page whose asset hashes are stale.
const check = spawnSync(process.execPath, [path.join(__dirname, 'stamp-assets.cjs'), '--check'], { encoding: 'utf8' });
if (check.status !== 0) fail(check.stderr || check.stdout);

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
function walk(dir, out) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir.split(path.sep).join('/'), entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else if (!skipFile(entry.name)) out.add(rel);
  }
}
for (const dir of runtimeDirs) walk(dir, runtimeFiles);

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

if (endpoint) {
  const configPath = path.join(DIST, 'config.js');
  const config = fs.readFileSync(configPath, 'utf8');
  if (!/submissionEndpoint:\s*''/.test(config)) fail("config.js no longer has an empty submissionEndpoint to replace.");
  fs.writeFileSync(configPath, config.replace(/submissionEndpoint:\s*''/, `submissionEndpoint: ${JSON.stringify(endpoint)}`));
}
const restamp = spawnSync(process.execPath, [path.join(__dirname, 'stamp-assets.cjs'), `--root=${DIST}`], { encoding: 'utf8' });
if (restamp.status !== 0) fail(restamp.stderr || restamp.stdout);

console.log(`dist/: ${runtimeFiles.size} files, ${(bytes / 1048576).toFixed(1)} MB${endpoint ? `, submissions enabled for ${new URL(endpoint).origin}` : ', submissions off'}`);
