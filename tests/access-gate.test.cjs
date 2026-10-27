'use strict';
// The access gate's "Continue as guest" (LIVE12 E55, Ethan: "also add a continue as guest thing"). The markup and the
// storage rules are read here; tests/access-gate-browser.cjs clicks through both paths in headless Chrome.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the gate offers "Continue as guest" under the code entry, as a secondary button, and keeps the hint and both notes', () => {
  const form = read('index.html').split('<form id="accessGateForm"')[1].split('</form>')[0];
  const enter = form.indexOf('<button type="submit">Enter</button>');
  const guest = form.indexOf('<button id="accessGateGuest" class="ghost" type="button">Continue as guest</button>');
  assert.ok(enter > 0 && guest > enter, 'the guest button sits below the Enter button');
  assert.ok(form.indexOf('accessGateHint') > guest, 'the hint stays below');
  assert.equal((form.match(/class="accessGateNote"/g) || []).length, 2);
});

test('a guest is kept for the session only and marked data-access="guest"; the code path is unchanged', () => {
  const js = read('js/access-gate.js');
  assert.match(js, /sessionStorage\.setItem\(GUEST_KEY, '1'\)/);
  assert.doesNotMatch(js, /localStorage\.setItem\(GUEST_KEY/);
  assert.match(js, /root\.setAttribute\('data-access', 'guest'\)/);
  assert.match(js, /remember\(\);\s*root\.setAttribute\('data-access', 'ok'\);/);
  assert.match(read('styles/app.css'), /html\[data-access="guest"\] #accessGate\{display:none\}/);
});

test('in a real browser, the guest button opens the builder for the session and the code still sets "ok" (needs Chrome)', { timeout: 120000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'access-gate-browser.cjs')], { encoding: 'utf8', timeout: 100000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS: guest opens the builder/m);
});
