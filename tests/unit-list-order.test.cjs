'use strict';
// The unit list a member picks a unit from: every unit of CAP_UNIT_OPTIONS once, in charter order (region, wing, number as a number), the same order
// with or without a search and whether or not a unit has patch artwork. A search only filters.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context, referenceErrors } = loadPageScripts({});
assert.deepEqual(referenceErrors, []);
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };

test('the list with no search holds every unit exactly once', () => {
  const all = ev('CAP_UNIT_OPTIONS.map(u => u.code)'), listed = ev('getUnitPatchOptions().map(o => o.code)');
  assert.ok(all.length > 1400);
  assert.equal(listed.length, all.length, 'no cut-off');
  assert.deepEqual(listed.slice().sort(), all.slice().sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.ok(listed.some(c => c.startsWith('SWR-')), 'the last region of the alphabet is there');
  assert.equal(listed[listed.length - 1].slice(0, 3), 'SWR');
});

test('the order is the charter order, numbers read as numbers, and artwork does not move a unit', () => {
  const codes = ev('getUnitPatchOptions().map(o => o.code)');
  const at = c => { const i = codes.indexOf(c); assert.ok(i >= 0, c); return i; };
  assert.ok(at('GLR-IL-001') < at('GLR-IL-189') && at('GLR-IL-189') < at('GLR-IN-002'));
  assert.ok(at('GLR-IL-008') < at('GLR-IL-016') && at('GLR-IL-090') < at('GLR-IL-104'));
  assert.ok(at('GLR-GLR-001') < at('GLR-IL-000'), 'region headquarters before its wings');
  assert.ok(at('GLR-GLR-000') < at('GLR-GLR-001'), 'the region\'s own numbers in order');
  assert.ok(at('SWR-TX-999') > at('SWR-TX-818'));
  // Whole-list check: sorted by region, wing, then number.
  const key = c => { const [r, w, n] = c.split('-'); return [r, w, /^\d+$/.test(n) ? 0 : 1, /^\d+$/.test(n) ? Number(n) : n]; };
  for(let i = 1; i < codes.length; i++){
    const a = key(codes[i - 1]), b = key(codes[i]);
    let c = 0; for(let k = 0; k < 4 && !c; k++) c = a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0;
    assert.ok(c <= 0, `${codes[i - 1]} before ${codes[i]}`);
  }
  // A unit with artwork and its neighbour without: in charter order, the one with artwork is not first just for that.
  const rows = ev('getUnitPatchOptions()');
  const withArt = rows.filter(o => o.hasArtwork), without = rows.filter(o => !o.hasArtwork);
  assert.ok(withArt.length > 0 && without.length > 0);
  const i = rows.findIndex((o, k) => k > 0 && o.hasArtwork && !rows[k - 1].hasArtwork);
  assert.ok(i > 0, 'a unit with artwork follows one without');
  assert.ok(rows.findIndex(o => o.hasArtwork) > 0, 'the first unit listed has no artwork');
  assert.ok(rows.some((o, k) => k > 0 && !o.hasArtwork && rows[k - 1].hasArtwork), 'and one without follows one with');
});

test('a search returns the same relative order', () => {
  const all = ev('getUnitPatchOptions().map(o => o.code)');
  for(const q of ['composite', 'mar-md', 'sqdn', 'wing', 'a']){
    const found = ev(`getUnitPatchOptions(${JSON.stringify(q)}).map(o => o.code)`);
    assert.ok(found.length > 0, q);
    assert.deepEqual(found, all.filter(c => found.includes(c)), q);
  }
});

test('the select built with no search holds every unit in that order, and a chosen unit is not added twice', () => {
  const select = { id: 'unitPatchSelect', options: [], value: '', appendChild(o){ this.options.push(o); }, replaceChildren(...nodes){ this.options = nodes; }, set innerHTML(v){ this.options = []; }, get innerHTML(){ return ''; } };
  const real = context.document;
  context.document = new Proxy({}, { get: (_t, key) => key === 'getElementById' ? id => id === 'unitPatchSelect' ? select : id === 'unitPatchSearch' ? { value: '' } : real.getElementById(id)
    : key === 'createElement' ? tag => tag === 'option' ? { value: '', textContent: '' } : real.createElement(tag) : real[key] });
  const codes = ev('getUnitPatchOptions().map(o => o.code)');
  vm.runInContext("State.unitPatchCharter = 'SWR-TX-818'; buildUnitPatchSelector('')", context);
  context.document = real;
  assert.deepEqual(select.options.slice(1).map(o => o.value), codes);
  assert.equal(select.options.length, codes.length + 1, 'every unit and the "No unit chosen" line');
  vm.runInContext("State.unitPatchCharter = ''", context);
});

test('the select holds the same list and no note about more units', () => {
  assert.doesNotMatch(vm.runInContext('buildUnitPatchSelector.toString()', context), /350|keep typing|more unit/i);
});
