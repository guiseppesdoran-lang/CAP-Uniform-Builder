'use strict';
// The grade rule of the command insignia pin (CAPR 39-1, 10.2.5) is asked for while the page is still loading: js/item-pickers.js makes the pictures of its
// choices as soon as it loads, and the picture of the Short Stack lists the ribbons again through rebuildRibbonsFromGallery (js/galleries.js), which keeps or drops
// the command pin by that rule. The rule was defined in js/member-report-import.js, which loads later, so every load logged "[option pictures] The pictures of
// shortStack could not be made ReferenceError: isCommandInsigniaGradeEligible is not defined". It is defined once now, with the badge rules.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
const NAME = 'isCommandInsigniaGradeEligible';

test('the grade rule is defined once, in the badge rules, and every script that names it loads after that definition', () => {
  const defining = scripts.filter(s => new RegExp(`function ${NAME}\\(`).test(fs.readFileSync(path.join(ROOT, s), 'utf8')));
  assert.deepEqual(defining, ['js/badge-rules.js'], 'one definition, with the badge rules');
  const from = scripts.indexOf(defining[0]);
  for (const s of scripts) {
    if (!new RegExp(`\\b${NAME}\\b`).test(fs.readFileSync(path.join(ROOT, s), 'utf8'))) continue;
    assert.ok(scripts.indexOf(s) >= from, `${s} names ${NAME} but loads before ${defining[0]}`);
  }
});

test('the ribbons can be rebuilt while the page is still loading, before the member report importer has run', () => {
  // Replay the moment js/item-pickers.js asks: everything up to it has run, js/member-report-import.js has not (its text is left out).
  const { context } = loadPageScripts({ 'js/member-report-import.js': '' });
  assert.equal(vm.runInContext(`typeof ${NAME}`, context), 'function', 'the rule exists without the importer');
  assert.equal(vm.runInContext('typeof parseCapMemberReport', context), 'undefined', 'the importer was left out');
  assert.doesNotThrow(() => vm.runInContext('rebuildRibbonsFromGallery()', context));
});

test('the rule: lieutenant colonel and below, flight officers and NCOs wear the pin; colonels and above, cadets and no grade do not', () => {
  const { context } = loadPageScripts();
  const eligible = rank => vm.runInContext(`${NAME}(${JSON.stringify(rank)})`, context);
  for (const rank of ['2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'FO', 'TFO', 'SFO', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt']) assert.equal(eligible(rank), true, rank);
  for (const rank of ['Col', 'Brig Gen', 'Maj Gen', 'C/Capt', 'C/Col', 'SM', '', null, undefined]) assert.equal(eligible(rank), false, String(rank));
});
