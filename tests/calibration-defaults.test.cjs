'use strict';
// Field-uniform badges are laid out by rule in js/patches.js and never read stored boxes, so a
// `badge:` entry for a field uniform in the calibration data is dead weight. An "Export All
// Coords" file pasted into data/calibration-corrections.js used to bring thousands of them in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FIELD_BUCKETS = ['ocp', 'abu', 'corporate_field', 'cfu', 'cfdu', 'fdu', 'flight_suit'];

function loadCorrections() {
  const context = {};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'calibration-corrections.js'), 'utf8'), context);
  return context.CAPUB_IMPORTED_COORDINATE_CORRECTIONS;
}

test('the calibration data holds no badge boxes for field uniforms', () => {
  const data = loadCorrections();
  const found = [];
  for (const bucket of FIELD_BUCKETS) {
    for (const key of Object.keys(data[bucket] || {})) if (key.startsWith('badge:')) found.push(`${bucket} ${key}`);
  }
  assert.deepEqual(found.slice(0, 5), [], `${found.length} unread field-uniform badge boxes`);
});

test('every stored box has numeric x, y, width, height or is a partial override of them', () => {
  const data = loadCorrections();
  const bad = [];
  for (const [bucket, boxes] of Object.entries(data)) {
    for (const [key, box] of Object.entries(boxes)) {
      for (const [prop, value] of Object.entries(box)) {
        if (!['x', 'y', 'w', 'h', 'r'].includes(prop) || !Number.isFinite(value)) bad.push(`${bucket} ${key} ${prop}`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 5), []);
});
