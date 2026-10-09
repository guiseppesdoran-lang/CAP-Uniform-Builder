'use strict';
// data/calibration-defaults.js is the one place hand-calibrated boxes live. These checks keep it
// well formed, keep it free of boxes nothing reads, and pin the values that calibration issues
// #110, #137 and #143 approved, so a later edit cannot move them without a test saying so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'calibration-defaults.js');
// Their badges and patches come from rules (js/patches.js, js/placement.js), not stored boxes.
const FIELD_BUCKETS = ['ocp', 'abu', 'corporate_field', 'cfu', 'cfdu', 'fdu', 'flight_suit'];

function load() {
  const context = {};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), context);
  // Copy into this realm so deepEqual compares plain objects.
  return JSON.parse(JSON.stringify(context.CAPUB_CALIBRATION_DEFAULTS));
}

test('every box has only numeric x, y, width, height and rotation', () => {
  const bad = [];
  for (const [bucket, boxes] of Object.entries(load())) {
    for (const [key, box] of Object.entries(boxes)) {
      for (const [prop, value] of Object.entries(box)) {
        if (!['x', 'y', 'w', 'h', 'r'].includes(prop) || !Number.isFinite(value)) bad.push(`${bucket} ${key} ${prop}`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});

test('the data holds no badge boxes for field uniforms', () => {
  // Field-uniform badges are laid out by rule in capubLayoutUtilityBadges() and never read one.
  const data = load();
  const found = [];
  for (const bucket of FIELD_BUCKETS) {
    for (const key of Object.keys(data[bucket] || {})) if (key.startsWith('badge:')) found.push(`${bucket} ${key}`);
  }
  assert.deepEqual(found.slice(0, 5), [], `${found.length} unread field-uniform badge boxes`);
});

test('the file keeps one box per line so changes show up as one-line diffs', () => {
  const lines = fs.readFileSync(FILE, 'utf8').split('\n').filter(line => line && !line.startsWith('//'));
  const odd = lines.filter(line => !(
    line === 'window.CAPUB_CALIBRATION_DEFAULTS = {' || line === '};' || line === '}' || line === '},' ||
    /^"[a-z_]+": \{$/.test(line) || /^  "[^"]+": \{[^{}]*\},?$/.test(line)
  ));
  assert.deepEqual(odd.slice(0, 3), []);
});

test('approved male Class A badge positions and sizes hold their final values', () => {
  const male = load().blues_a_male;
  assert.deepEqual(male['badge:master_emergency_services_badge:LP:0'], { x: 283.4, y: 248, w: 20, h: 20, r: 0 });
  assert.deepEqual(male['badge:volunteer_university_instructor_badge:RP:0'], { x: 130.4, y: 248, w: 40, h: 40, r: 0 });
  assert.deepEqual(male['badge:cadet_programs_master_badge:LP:0'], { x: 283, y: 248, w: 25, h: 35, r: 0 });
  assert.deepEqual(male['badge:group_commander_badge:UN:0'], { x: 140.8, y: 227.1, w: 20, h: 20, r: 0 });
  assert.deepEqual(male['base:jacket'], { x: 0, y: 0, w: 450, h: 600, r: 0 });
});

test('approved calibrations stay in the buckets they were approved for', () => {
  const data = load();
  // Master calibration #143 touched female Class A, male semi-formal and OCP; the male Class A
  // values above must not leak into the female or Class B coats.
  assert.deepEqual(data.blues_a_female['badge:cadet_programs_master_badge:FON:0'], { x: 136, y: 160.3 });
  assert.deepEqual(data.semi_formal_male['badge:national_staff_badge:RP:0'], { x: 288, y: 140 });
  assert.notDeepEqual(data.blues_a_female['badge:volunteer_university_instructor_badge:RP:0'], data.blues_a_male['badge:volunteer_university_instructor_badge:RP:0']);
  assert.equal(data.blues_b_male['badge:master_emergency_services_badge:LP:0']?.w === 20, false);
});

test('calibration.js builds its defaults from the data file and re-applies nothing from browser storage', () => {
  // A one-time migration used to re-apply older approved values on a visitor's first load, so a
  // new visitor saw a few badges in different places from every later visit.
  const source = fs.readFileSync(path.join(ROOT, 'js', 'calibration.js'), 'utf8');
  assert.match(source, /JSON\.parse\(JSON\.stringify\(window\.CAPUB_CALIBRATION_DEFAULTS/);
  assert.doesNotMatch(source, /_MIGRATION_KEY|migrateApprovedCalibrationIssues|applyIssue143/);
});
