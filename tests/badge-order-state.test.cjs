'use strict';
// Which of two badges of equal standing is worn higher (State.badgeOrder) is part of the setup: it survives a reload, a saved setup, a setup file someone
// sends and a member report import that keeps the badges, and a badge taken off takes the choice with it, so a later build never meets a stale entry.
// The page's scripts run in one vm context (tests/helpers/page-scripts.cjs), as the member's page does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const GT = 'ground_team_basic_badge', NURSE = 'nurse_officer', EMT = 'emt_basic_badge', PILOT = 'CAPPilot1_FA9D33EA587D8';
const ORDER = (...ids) => ({ occupational: ids });

const { context, referenceErrors } = loadPageScripts();
const ev = code => { const out = vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context); return out === undefined ? undefined : JSON.parse(out); };
const setup = (badges, order, extra = '') => ev(`State.membership = 'senior'; State.gender = 'female'; State.rank = 'Capt'; State.uniform = 'blues_a'; ${extra}
  State.badges = ${JSON.stringify(badges)}; State.badgeOrder = ${JSON.stringify(order)}; return true;`);

test('the page loads, and a setup starts with no choice: the drawing\'s own order', () => {
  assert.deepEqual(referenceErrors, []);
  assert.deepEqual(ev('return State.badgeOrder;'), {});
  assert.match(read('js/state.js'), /^\s*badgeOrder:\{\},/m);
});

test('the page hands the engine the choice with the badges, and the drawing follows it', () => {
  setup([GT, NURSE], ORDER(NURSE, GT));
  assert.deepEqual(ev('return CAPUBUniformView.buildFromState().badgeOrder;'), ORDER(NURSE, GT));
  setup([GT, NURSE], {});
  assert.deepEqual(ev('return CAPUBUniformView.buildFromState().badgeOrder;'), {});
  assert.match(read('js/uniform-view.js'), /badgeOrder: State\.badgeOrder/);
});

test('saved with the setup, in the form a saved file, the browser\'s own save and the undo list all use; it loads back as it was', () => {
  setup([GT, NURSE, PILOT], ORDER(NURSE, GT));
  const text = ev('return JSON.stringify(CAPUB_V2.collectProfile());');
  const saved = JSON.parse(text);
  assert.deepEqual(saved.badgeOrder, ORDER(NURSE, GT));
  // The reload: a fresh State, the file read back.
  ev('State.badgeOrder = {}; State.badges = [];');
  ev(`try{ CAPUB_V2.applyProfile(${JSON.stringify(JSON.parse(text))}); }catch(_){ } return true;`);
  assert.deepEqual(ev('return State.badges;'), [GT, NURSE, PILOT]);
  assert.deepEqual(ev('return State.badgeOrder;'), ORDER(NURSE, GT));
  assert.deepEqual(ev('return CAPUB_V2.collectProfile().badgeOrder;'), ORDER(NURSE, GT), 'and saves again the same');
});

test('a setup saved before the choice existed loads with no choice and draws as it did', () => {
  const old = JSON.parse(setup([GT, NURSE], ORDER(NURSE, GT)) && ev('return JSON.stringify(CAPUB_V2.collectProfile());'));
  delete old.badgeOrder;
  ev('State.badgeOrder = { occupational: ["x", "y"] };');
  ev(`try{ CAPUB_V2.applyProfile(${JSON.stringify(old)}); }catch(_){ } return true;`);
  assert.deepEqual(ev('return State.badgeOrder;'), {});
  assert.deepEqual(ev('return State.badges;'), [GT, NURSE]);
});

test('a setup from a file someone sent keeps only a choice the builder could have made: occupational badge ids the setup holds, two or more', () => {
  const profile = (badges, badgeOrder) => ({ version: '2026-05-08-v2', membership: 'senior', gender: 'female', uniform: 'blues_a', rank: 'Capt', badges, badgeOrder });
  const load = p => { ev('State.badgeOrder = {};'); ev(`try{ CAPUB_V2.applyProfile(${JSON.stringify(p)}); }catch(_){ } return true;`); return ev('return State.badgeOrder;'); };
  assert.deepEqual(load(profile([GT, NURSE], ORDER(NURSE, GT))), ORDER(NURSE, GT));
  assert.deepEqual(load(profile([GT, NURSE], ORDER(NURSE, GT, EMT))), ORDER(NURSE, GT), 'a badge the setup does not hold is dropped');
  assert.deepEqual(load(profile([GT], ORDER(NURSE, GT))), {}, 'one badge is no order');
  assert.deepEqual(load(profile([GT, NURSE, PILOT], ORDER(PILOT, GT))), {}, 'an aviation badge is not of equal standing');
  assert.deepEqual(load(profile([GT, NURSE], { occupational: [NURSE, '<script>alert(1)</script>', 7, null, GT, NURSE] })), ORDER(NURSE, GT), 'junk is dropped, a repeat counts once');
  assert.deepEqual(load(profile([GT, NURSE], { occupational: 'text', other: [NURSE, GT] })), {});
  for(const bad of [null, 'text', 7, [NURSE, GT], true]) assert.deepEqual(load(profile([GT, NURSE], bad)), {}, JSON.stringify(bad));
  const evil = JSON.parse(`{"occupational":["${NURSE}","${GT}"],"__proto__":{"occupational":["x","y"]},"constructor":{"prototype":{"polluted":true}}}`);
  assert.deepEqual(load(profile([GT, NURSE], evil)), ORDER(NURSE, GT));
  assert.equal(ev('return ({}).polluted;'), undefined);
});

test('a badge taken off takes the choice for its pair with it, in the setup and in what is saved, and putting it back does not bring the choice back', () => {
  setup([GT, NURSE, EMT], ORDER(NURSE, GT, EMT));
  // One of three goes: the two left keep the order the member gave them.
  ev(`State.badges = ['${GT}', '${NURSE}'];`);
  assert.deepEqual(ev('return CAPUB_V2.collectProfile().badgeOrder;'), ORDER(NURSE, GT), 'saved without the badge that is gone');
  ev('CAPUBUniformView.buildFromState(); return true;');
  assert.deepEqual(ev('return State.badgeOrder;'), ORDER(NURSE, GT), 'and so is the setup after the next drawing');
  // A pair loses one: nothing is left of the choice.
  ev(`State.badges = ['${GT}'];`);
  assert.deepEqual(ev('return CAPUB_V2.collectProfile().badgeOrder;'), {}, 'saved with no choice');
  ev('CAPUBUniformView.buildFromState(); return true;');
  assert.deepEqual(ev('return State.badgeOrder;'), {}, 'no stale entry stays behind');
  // The badge comes back later: the drawing is the default again.
  ev(`State.badges = ['${GT}', '${NURSE}'];`);
  assert.deepEqual(ev('return CAPUBUniformView.buildFromState().badgeOrder;'), {});
  assert.deepEqual(ev('return State.badgeOrder;'), {});
  // Clear: every badge off.
  setup([GT, NURSE], ORDER(NURSE, GT));
  ev('State.badges = [];');
  assert.deepEqual(ev('return CAPUBUniformView.buildFromState().badgeOrder;'), {});
});

test('the choice is the same on every uniform: it does not belong to one of them', () => {
  setup([GT, NURSE], ORDER(NURSE, GT));
  for(const uniform of ['blues_b', 'mess_dress', 'ocp', 'abu', 'aviator']){
    ev(`State.uniform = '${uniform}';`);
    assert.deepEqual(ev('return CAPUBUniformView.buildFromState().badgeOrder;'), ORDER(NURSE, GT), uniform);
  }
  assert.deepEqual(ev('return CAPUB_V2.collectProfile().badgeOrder;'), ORDER(NURSE, GT));
});
