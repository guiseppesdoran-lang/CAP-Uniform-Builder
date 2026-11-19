'use strict';
// The unit list (1,455 options) is made again only when what it is made from changes: every drawing of anything used to make it again, in the tap's own task.

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const { context } = loadPageScripts({});

test('the list is made once for the same search and the same unit, and again when either changes', () => {
  let made = 0;
  const select = { id: 'unitPatchSelect', options: [], value: '', appendChild(o){ made++; this.options.push(o); }, set innerHTML(v){ this.options = []; }, get innerHTML(){ return ''; } };
  const real = context.document;
  context.document = new Proxy({}, { get: (_t, key) => key === 'getElementById' ? id => id === 'unitPatchSelect' ? select : real.getElementById(id)
    : key === 'createElement' ? tag => tag === 'option' ? { value: '', textContent: '' } : real.createElement(tag) : real[key] });
  try{
    vm.runInContext("State.unitPatchCharter = ''; buildUnitPatchSelector('')", context);
    const first = made;
    assert.ok(first > 1400);
    vm.runInContext("buildUnitPatchSelector(''); buildUnitPatchSelector('  ')", context);
    assert.equal(made, first, 'nothing is made again for the same inputs');
    vm.runInContext("buildUnitPatchSelector('squadron')", context);
    assert.ok(made > first && made < first * 2, 'a search makes the shorter list');
    const afterSearch = made;
    vm.runInContext("State.unitPatchCharter = 'SWR-TX-818'; buildUnitPatchSelector('squadron')", context);
    assert.ok(made > afterSearch, 'a unit chosen makes it again');
  }finally{
    vm.runInContext("State.unitPatchCharter = ''", context);
    context.document = real;
  }
});
