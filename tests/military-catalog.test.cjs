'use strict';
// CAP members who earned U.S. military awards can add them in the ribbon and badge galleries.
// These checks keep the shipped catalog and its artwork in step.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function loadCatalog() {
  const context = {};
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'military', 'military-data.js'), 'utf8'), context);
  return context.CAPUBMilitaryData;
}

test('the catalog carries the military ribbons and badges the galleries offer', () => {
  const data = loadCatalog();
  assert.ok(data.awards.filter(award => award.type === 'RIBBON').length >= 170, 'ribbon awards');
  assert.ok(data.badges.length >= 120, 'badges');
});

test('every local image the catalog names exists', () => {
  const data = loadCatalog();
  const wanted = new Set();
  (function walk(value, key) {
    if (typeof value === 'string') {
      if (/\.(png|webp|jpe?g)$/i.test(value) && !/^https?:/.test(value)) wanted.add(value);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) walk(child, childKey);
    }
  })(data, '');
  // A device-file template and a report contact sheet that the page never loads.
  const notLoaded = path => path.includes('{value}') || path.startsWith('reports/');
  const missing = [...wanted].filter(file => !notLoaded(file) && !fs.existsSync(path.join(ROOT, file)));
  assert.deepEqual(missing, []);
});

test('the page loads the catalog before the application scripts', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const order = ['military/military-core.js', 'military/military-device-layout.js', 'military/military-data.js', 'js/state.js']
    .map(file => html.indexOf(`src="${file}`));
  assert.ok(order.every(index => index >= 0), 'all four scripts are referenced');
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});
