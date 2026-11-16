'use strict';

// Resume, Load, Import and Undo set State and the control values directly, without firing the
// change handlers. The uniform and cut blocks start as .disabledBlock (pointer events off) and
// only updateSetupGates() cleared them, so after a reload + Resume the controls showed the
// restored rank, cut and membership yet no other uniform could be clicked. refreshUI() is the
// one place every restore passes through; it now unlocks the blocks from State.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const setup = read('js/setup.js');
const placement = read('js/placement.js');
const workspace = read('js/workspace-ui.js');
const wiring = read('js/wiring.js');

function slice(source, from, to) {
  const start = source.indexOf(from);
  assert.ok(start >= 0, `found ${from}`);
  const end = source.indexOf(to, start);
  assert.ok(end > start, `found ${to}`);
  return source.slice(start, end);
}

function fakeBlock() {
  const classes = new Set(['panelBlock', 'disabledBlock']);
  return {
    classList: {
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
      contains: name => classes.has(name)
    },
    has: name => classes.has(name)
  };
}

// The page as it is when it first loads: nothing chosen, both blocks locked, rank list disabled.
function page() {
  const context = {
    State: { membership: '', gender: '', rank: null, uniform: 'blues_a', ribbons: [], badges: [], patches: [] },
    rankSetupSelect: { disabled: true, value: '' },
    membershipTypeEl: { value: '' },
    jacketSelect: { value: '' },
    uniformBlock: fakeBlock(),
    genderBlock: fakeBlock(),
    by: () => null,
    syncCadetFirstSergeantControl() {},
    syncRibbonRackColumnsControl() {},
    highlightActiveUniformButton() {},
    applyMemberTypeToUniformOptions() {}
  };
  vm.createContext(context);
  vm.runInContext(slice(setup, 'function capubSyncSetupGates', '/* Membership and cut are side-by-side'), context);
  vm.runInContext(slice(placement, 'function refreshUI()', '\n}\n') + '\n}', context);
  return context;
}

test('a restored setup (cadet, C/Maj, male, Class A) unlocks the uniform and cut blocks through refreshUI', () => {
  const ctx = page();
  assert.ok(ctx.uniformBlock.has('disabledBlock') && ctx.genderBlock.has('disabledBlock'), 'locked before a restore');
  Object.assign(ctx.State, { membership: 'cadet', rank: 'C/Maj', gender: 'male', uniform: 'blues_a' });
  vm.runInContext('refreshUI()', ctx);
  assert.equal(ctx.uniformBlock.has('disabledBlock'), false, 'uniform buttons can be clicked');
  assert.equal(ctx.genderBlock.has('disabledBlock'), false, 'cut buttons can be clicked');
  assert.equal(ctx.rankSetupSelect.disabled, false, 'the rank list is usable');
  assert.equal(ctx.rankSetupSelect.value, 'C/Maj');
  assert.equal(ctx.membershipTypeEl.value, 'cadet');
  assert.equal(ctx.jacketSelect.value, 'male');
});

test('a setup with no rank (or no membership) stays locked after refreshUI', () => {
  const ctx = page();
  Object.assign(ctx.State, { membership: 'cadet', rank: null, gender: 'male' });
  vm.runInContext('refreshUI()', ctx);
  assert.ok(ctx.uniformBlock.has('disabledBlock') && ctx.genderBlock.has('disabledBlock'));
  assert.equal(ctx.rankSetupSelect.disabled, false, 'membership alone unlocks the rank list');
  Object.assign(ctx.State, { membership: '', rank: null });
  vm.runInContext('refreshUI()', ctx);
  assert.equal(ctx.rankSetupSelect.disabled, true);
});

test('the change handlers use the same gate function, so one rule decides both paths', () => {
  const update = slice(setup, 'function updateSetupGates', '/* Membership and cut are side-by-side');
  assert.match(update, /capubSyncSetupGates\(\)/);
  assert.doesNotMatch(update, /classList\.toggle\('disabledBlock'/);
  assert.match(placement, /capubSyncSetupGates\(\)/);
});

test('the profile loader finishes through refreshUI, which does the unlocking', () => {
  assert.match(slice(wiring, 'function applyProfile', 'function syncTextControls'), /\brefreshUI\(\)/);
});

test('step statuses read done for profile and uniform once a setup is restored', () => {
  const fn = slice(workspace, 'function getStepStatuses', 'const reachable=');
  const context = {
    State: { membership: 'cadet', rank: 'C/Maj', gender: 'male', uniform: 'blues_a', ribbons: [], badges: [], patches: [] },
    STEP_ORDER: ['profile', 'uniform', 'items', 'export'],
    safeBy: () => null
  };
  vm.createContext(context);
  vm.runInContext(fn, context);
  const { done, current } = vm.runInContext('getStepStatuses()', context);
  assert.equal(done.profile, true);
  assert.equal(done.uniform, true);
  assert.equal(current, 'items');
});
