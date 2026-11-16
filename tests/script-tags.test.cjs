'use strict';
// The page's script tags load without blocking the parser (LIVE13 E65, Ethan: "right now it's kind of slow. I'd like it
// to load faster"). Every app script is `defer`, so the browser paints the page and the access gate answers while the
// scripts download; they still run in document order before DOMContentLoaded. The access gate is the one exception:
// it stays a plain script in <head> so a returning member never sees the gate flash. And npm run stamp:assets still
// gives every script and stylesheet tag its ?v= content hash, so a deploy never pairs a new page with an old file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// A comment must not name a tag either: stamp-assets.cjs would try to stamp it.
assert.doesNotMatch(html.match(/<!--[\s\S]*?-->/g).join(''), /<(script|link)\b/, 'a script or link tag inside a comment');
const [head, body] = html.split('</head>');
const tags = src => [...src.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);

test('the access gate is the only script in <head>, a plain blocking script', () => {
  const inHead = tags(head);
  assert.deepEqual(inHead.map(t => t.replace(/\?v=[^"]*/, '')), ['<script src="js/access-gate.js">']);
});

test('every script in <body> is a local file with src first and defer, and none is async', () => {
  const inBody = tags(body);
  assert.ok(inBody.length >= 40, `expected the app's script tags, found ${inBody.length}`);
  for(const tag of inBody){
    assert.match(tag, /^<script src="[^":]+"/, `src first and local: ${tag}`);
    assert.match(tag, /\sdefer(?=[\s>])/, `defer: ${tag}`);
    assert.doesNotMatch(tag, /\sasync\b/, `async would break the order: ${tag}`);
  }
  assert.doesNotMatch(body, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script');
});

test('the gate wires its buttons when parsing ends, before the deferred scripts run', () => {
  const gate = fs.readFileSync(path.join(ROOT, 'js/access-gate.js'), 'utf8');
  assert.match(gate, /addEventListener\('readystatechange'/);
  assert.doesNotMatch(gate, /addEventListener\('DOMContentLoaded'/, 'DOMContentLoaded waits for every deferred script');
});

test('stamping still covers every script and stylesheet tag', () => {
  // Stamp a copy of the page and the files it names, then check each tag carries its file's hash.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stamp-check-'));
  const urls = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"?#]+)/g)].map(m => m[1]).filter(u => !/^([a-z]+:)?\/\//i.test(u));
  for(const url of new Set(urls)){
    fs.mkdirSync(path.dirname(path.join(dir, url)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, url), path.join(dir, url));
  }
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/stamp-assets.cjs'), `--root=${dir}`], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const stamped = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const hash = file => crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, file))).digest('hex').slice(0, 10);
  const all = [...stamped.matchAll(/<script\b[^>]*>|<link\b[^>]*rel="(?:stylesheet|preload)"[^>]*>/g)].map(m => m[0]);
  assert.ok(all.length >= 45);
  for(const tag of all){
    const m = /\b(?:src|href)="([^"?]+)\?v=([0-9a-f]{10})"/.exec(tag);
    assert.ok(m, `not stamped: ${tag}`);
    assert.equal(m[2], hash(m[1]), `stale stamp: ${tag}`);
  }
  const check = spawnSync(process.execPath, [path.join(ROOT, 'scripts/stamp-assets.cjs'), '--check', `--root=${dir}`], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
});
