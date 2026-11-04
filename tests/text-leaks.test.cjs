'use strict';
// Text a member reads states the rule and the paragraph, in the member's words (audit 4 November 2026, "text that leaks ids, developer wording and
// eServices capitals"): the import's notes, the military pickers, the unit patch status.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const NOTES = [
  'CADET PROGRAMS TECHNICIAN is in the Specialty Tracks table, but the builder does not authorize that badge for cadet members, so it is not offered.',
  'COMMUNICATIONS TECHNICIAN specialty badge imported from Specialty Tracks table only.',
  'CAC ribbon imported from Past Duty Positions as wing_bronze_star.',
  'Wing CAC shoulder cord - red imported from Current Duty Positions as a current primary representative.',
  'CAC ribbon imported as wing_bronze_star: Highest qualifying CAC level found in duty assignments: WING.',
  'Wing CAC shoulder cord - red imported from Current Duty Positions.',
  'CAC final check: Wing CAC shoulder cord - red selected from current CAC duty.',
  'CAC final check: CAC ribbon set to wing_bronze_star.',
  'Member report charter GLR-IL-049 found, but no unit patch image is mapped yet.',
  'NCSA/activity patch match(es): PJOC Patch, Cadet Officer School Patch.',
  'Wing CAC shoulder cord - red imported from Current Duty Positions.',
  'Communications patch not shown because it is not authorized on the selected OCP uniform.'
];

test('import notes: one per line, none twice, no restating check, no id, no eServices capitals; a charter and the abbreviations keep theirs', () => {
  context.__n = NOTES;
  const lines = ev('capubImportNoteLines(__n)');
  assert.equal(new Set(lines).size, lines.length, 'no line twice');
  assert.equal(lines.length, 7, lines.join('\n'));
  const all = lines.join('\n');
  assert.doesNotMatch(all, /final check/);
  assert.doesNotMatch(all, /[a-z]+_[a-z]+/, 'no internal id');
  assert.match(all, /^Cadet Programs Technician is in the Specialty Tracks table/m);
  assert.match(all, /^Communications Technician specialty badge imported/m);
  assert.match(all, /CAC ribbon imported as Wing CAC \/ Bronze Star: Highest qualifying CAC level found in duty assignments: Wing\.$/m);
  assert.equal(lines.filter(l => /shoulder cord/.test(l)).length, 1, 'the cord is said once, in its longer form');
  assert.match(all, /charter GLR-IL-049 found/);
  assert.match(all, /NCSA\/activity patch match\(es\): PJOC Patch/);
  assert.doesNotMatch(all, /\brender/i);
});

test('the import shows its notes as a heading and one line each, not one run-on line', () => {
  const src = read('js/member-report-import.js');
  assert.match(src, /\['Notes:', \.\.\.capubImportNoteLines\(parsed\.notes\)\]/);
  assert.doesNotMatch(src, /Notes: \$\{parsed\.notes\.join\('; '\)\}/);
  assert.doesNotMatch(src, /not rendered because/);
});

test('a military service is named for the member, never by its catalog token', () => {
  assert.equal(ev(`militaryServiceLabel('JOINT_DOD')`), 'Department of Defense');
  assert.equal(ev(`militaryServiceLabel('SPACE_FORCE')`), 'Space Force');
  assert.equal(ev(`militaryServiceLabel('SOME_NEW_BRANCH')`), 'Some New Branch');
  assert.doesNotMatch(read('js/galleries.js'), /MILITARY_BRANCH_LABELS\[service\] \|\| service\)\)\.join\(' \/ '\) \|\| 'U\.S\. MILITARY'/);
});

test('the military pickers carry no developer wording', () => {
  const g = read('js/galleries.js'), w = read('js/wiring.js');
  for(const s of ['Normal mode only exposes', 'Manual / unverified configurations', 'Branch contents load when opened', 'reviewed local artwork', "'U.S. MILITARY'", "badge.family || 'OTHER'"]){
    assert.ok(!g.includes(s) && !w.includes(s), s);
  }
  assert.match(g, /Choose devices by hand/);
});

test('the unit patch status and its warnings name the unit, not the charter string, and never say render', () => {
  const c = read('js/catalog.js'), w = read('js/wiring.js');
  assert.match(c, /function getUnitPatchSpokenName\(code\)/);
  assert.doesNotMatch(c, /will render as/);
  assert.doesNotMatch(w, /getUnitPatchSelectionLabel/);
  assert.equal(ev(`getUnitPatchSpokenName('MAR-DC-026')`), ev(`CAP_UNIT_OPTIONS.find(u => u.code === 'MAR-DC-026').name`));
});
