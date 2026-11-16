'use strict';
// Choosers (audit 4 November 2026): a pick is its own Undo step, a chooser opens at its top, and picking more badges than the uniform wears says so.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const wiring = fs.readFileSync(path.join(root, 'js', 'wiring.js'), 'utf8');

const FIVE = ['CAPPilot1_FA9D33EA587D8', 'emergency_services_badge', 'communications_technician_badge', 'safety_senior_badge', 'finance_senior_badge'];

test('five badges chosen on a uniform that wears four: the picker footer and the Badges card say so, with the paragraph (4.1.5.2.2.4)', () => {
  ev(`State.membership = 'senior'; State.rank = 'Capt'; State.gender = 'male'; State.garment = {}; State.militaryBadges = {}; State.uniform = 'blues_a'; State.badges = ${JSON.stringify(FIVE)}; capubModalKind = 'badges'`);
  assert.match(ev(`capubModalCountText('badges')`), /^5 of 4 badges selected\. This uniform wears 4 \(CAPR 39-1, 4\.1\.5\.2\.2\.4\); choose which to show under Badges\.$/);
  context.__scene = { uniform: 'blues_a', badgesWorn: FIVE.slice(0, 4), layers: [], notes: [] };
  assert.equal(ev('capubBadgesNotShownLine(__scene)'), '1 selected badge has no place left on this uniform and is not shown. This uniform wears 4 (CAPR 39-1, 4.1.5.2.2.4). Choose which to show under Badges.');
  context.__scene = { uniform: 'blues_a', badgesWorn: FIVE, layers: [], notes: [] };
  assert.equal(ev('capubBadgesNotShownLine(__scene)'), '', 'nothing to say when all are shown');
  ev(`State.badges = ${JSON.stringify(FIVE.slice(0, 2))}`);
  assert.equal(ev(`capubModalCountText('badges')`), '2 of 4 badges selected', 'under the limit it is the plain count');
  ev(`State.badges = []`);
});

test('a change or a click anywhere records its own Undo step, once the handler has run', () => {
  assert.match(wiring, /\['change','click'\]\.forEach\(evt => document\.addEventListener\(evt, \(\) => setTimeout\(captureHistory, 30\), true\)\);/);
  // captureHistory records nothing when the setup is the same as the last one.
  assert.match(wiring, /if\(now === lastSnap\) return;/);
});

test('a chooser opens at its top: a fresh open resets the body\'s scroll and the saved military position', () => {
  assert.match(wiring, /const freshOpen = !modalOverlay\.classList\.contains\('open'\);/);
  assert.match(wiring, /if\(freshOpen\)\{\s*if\(modalHost\.parentElement\) modalHost\.parentElement\.scrollTop = 0;\s*if\(typeof getMilitaryUIState === 'function'\) getMilitaryUIState\(\)\.modalScrollTop = 0;/);
});
