'use strict';
// The code is published to be read and is not licensed for reuse: LICENSE reserves all rights and
// asks for permission through an issue, package.json says UNLICENSED, and nothing else in the
// repository offers the code under another license. Versions published before 10 November 2026
// were offered under the MIT license; the notices may say so and may not say more.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('LICENSE names Guiseppe Doran as the permission contact and grants no permission', () => {
  const text = read('LICENSE');
  assert.match(text, /^Copyright \(c\) 2026 Guiseppe Doran\. All rights reserved\./);
  assert.match(text, /No license is granted/);
  assert.match(text, /prior written permission from Guiseppe\s+Doran/);
  assert.match(text, /open an issue in this project's repository/);
  assert.doesNotMatch(text, /Permission is hereby granted/i);
  assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'no address in the notice');
  assert.doesNotMatch(text, /https?:\/\//, 'no link in the notice');
});

test('LICENSE leaves third-party material and earlier MIT versions as they were', () => {
  const text = read('LICENSE').replace(/\s+/g, ' ');
  assert.match(text, /Third-party material listed in NOTICE\.md .* keeps its own terms and owners/);
  assert.match(text, /published before 10 November 2026 were offered under the MIT license\. That offer stands for those versions only\./);
  assert.match(text, /Using the public website this project runs is welcome/);
});

test('package.json says the code is all rights reserved', () => {
  assert.equal(JSON.parse(read('package.json')).license, 'UNLICENSED');
});

test('the notices mention MIT only for the versions published before 10 November 2026', () => {
  for (const rel of ['LICENSE', 'README.md', 'NOTICE.md']) {
    const text = read(rel).replace(/\s+/g, ' ');
    for (const match of text.matchAll(/\bMIT\b/g)) {
      const around = text.slice(Math.max(0, match.index - 160), match.index + 160);
      assert.match(around, /before 10 November 2026/, `${rel} offers the code under MIT without the date`);
    }
  }
  assert.doesNotMatch(read('NOTICE.md'), /What the MIT license covers/);
  assert.doesNotMatch(read('README.md'), /under the MIT license \(`LICENSE`\)/);
});

test('no hand-written file calls the code MIT, open source or free to reuse', () => {
  const dirs = ['js', 'styles', 'scripts', 'deploy', 'docs', 'google-apps-script', 'tests'];
  const files = fs.readdirSync(ROOT).filter(n => /\.(html|js|cjs|md|txt|json|css|svg)$/.test(n));
  const walk = dir => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  for (const dir of dirs) if (fs.existsSync(path.join(ROOT, dir))) files.push(...walk(dir));
  const skip = new Set(['LICENSE', 'README.md', 'NOTICE.md', 'tests/license.test.cjs']);
  for (const rel of files.filter(f => !skip.has(f) && /\.(html|js|cjs|md|txt|py|css|yml|example|tunnel|gs)$/.test(f) && !/(^|\/)(military-data|purchase-catalog|mcchord-ribbon-variants)\.js$/.test(f))) {
    const text = read(rel);
    assert.doesNotMatch(text, /\bMIT[- ]licen[sc]/i, `${rel} names the MIT license`);
    assert.doesNotMatch(text, /open[- ]source|free to (?:use|reuse|copy|fork)/i, `${rel} offers the code for reuse`);
  }
});
