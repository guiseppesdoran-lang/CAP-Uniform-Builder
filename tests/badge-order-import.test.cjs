'use strict';
// A member report import keeps the order of two badges of equal standing (State.badgeOrder) for the badges the report keeps, and a pair the report does not
// keep loses its choice, so no stale entry meets a later build. The page's scripts run in one vm context (tests/helpers/page-scripts.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const NURSE = 'nurse_officer', MASTER_GT = 'master_ground_team_badge';
const ORDER = (...ids) => ({ occupational: ids });

// ---- the member report import ----------------------------------------------------------------------------------------------

const SENIOR = read('tests/fixtures/eservices-member-details-senior-live13.txt');
function importReport(before, addBadges){
  const { context: page } = loadPageScripts();
  vm.runInContext(before, page);
  return JSON.parse(vm.runInContext(`(function(text, add){
    for(const n of ['buildRibbonGallery','rebuildRibbonsFromGallery','buildBadgeGallery','rebuildBadgesFromGallery','fullRender','refreshUI',
      'populateRankSetup','updateSetupGates','highlightActiveUniformButton','applyMemberTypeToUniformOptions','syncCadetFirstSergeantControl',
      'renderCACShoulderCord','syncShoulderCordControl','clearUnauthorizedPatchesForCurrentUniform']) globalThis[n] = function(){};
    const realDocument = globalThis.document, fields = {};
    globalThis.document = new Proxy({}, { get: (_t, key) => key === 'getElementById'
      ? id => /^capubV2(FirstName|LastName|ShowText)$/.test(id) ? (fields[id] = fields[id] || {}) : realDocument.getElementById(id)
      : realDocument[key] });
    const parsed = parseCapMemberReport(text);
    parsed.badges = [...parsed.badges, ...add];
    applyCapMemberReportImport(parsed);
    globalThis.document = realDocument;
    return JSON.stringify({ badges: State.badges, badgeOrder: State.badgeOrder });
  })`, page)(SENIOR, addBadges || []));
}

test('a member report import that keeps both badges keeps the choice; one that drops either takes it away', () => {
  const before = `State.membership = 'senior'; State.gender = 'female'; State.rank = 'Capt'; State.uniform = 'blues_a';
    State.badges = ['${NURSE}', '${MASTER_GT}']; State.badgeOrder = ${JSON.stringify(ORDER(NURSE, MASTER_GT))};`;
  // The report names the Master Ground Team badge (it is among the badges the fixture imports) and, here, the nurse badge too.
  const kept = importReport(before, [NURSE]);
  assert.ok(kept.badges.includes(MASTER_GT) && kept.badges.includes(NURSE), 'both badges are in the report');
  assert.deepEqual(kept.badgeOrder, ORDER(NURSE, MASTER_GT));
  // The report does not name the nurse badge: the pair is gone and so is the choice.
  const dropped = importReport(before, []);
  assert.ok(dropped.badges.includes(MASTER_GT) && !dropped.badges.includes(NURSE));
  assert.deepEqual(dropped.badgeOrder, {});
  // No choice before is no choice after.
  assert.deepEqual(importReport(before.replace(/State\.badgeOrder = [^;]*;/, 'State.badgeOrder = {};'), [NURSE]).badgeOrder, {});
});
