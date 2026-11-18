'use strict';
// The render harness (scripts/render-builds.cjs) builds what the page builds for a cord: the cord, the member's colour for a cord whose colour the unit commander picks, and the
// switch that lays the cord over the epaulet (off unless a build asks); and the page it draws in loads the cord list and the braid function before the engine uses them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HARNESS = require('../scripts/render-builds.cjs');

test('a harness build carries the cord and its colour, with no colour unless asked', () => {
  const plain = HARNESS.makeBuild({ uniform: 'blues_b', gender: 'male', membership: 'cadet', rank: 'C/Capt', cord: 'wing' });
  assert.equal(plain.cord, 'wing');
  assert.equal(plain.cordColour, null);
  const asked = HARNESS.makeBuild({ uniform: 'blues_b', gender: 'male', membership: 'cadet', rank: 'C/Capt', cord: 'de-unit-award', cordColour: 'orange' });
  assert.deepEqual([asked.cord, asked.cordColour], ['de-unit-award', 'orange']);
  assert.equal('cordOnTop' in asked, false, 'there is no on-top switch');
});

test('the harness page loads the braid function and the cord list with the engine, so the figure it draws has the braid', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'render-builds.cjs'), 'utf8');
  const page = src.slice(src.indexOf('const HARNESS = `'), src.indexOf('window.__warnings'));
  for(const f of ['cord-braid', 'cords']) assert.ok(page.includes(`'${f}'`), `${f}.js is loaded`);
  assert.match(page, /<script src="\/data\/cords\.js">/);
  assert.ok(page.indexOf("'cord-braid', 'cords'") < page.indexOf("'profiles'"), 'before the profiles and the renderer');
});
