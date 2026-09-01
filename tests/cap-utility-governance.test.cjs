const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('National Staff uses a dedicated OCP sleeve patch selection', () => {
  assert.match(source, /'national_staff_ocp_patch'/);
  assert.match(source, /img:'badges\/utility\/national_staff_badge\.png'/);
  assert.match(source, /authorizedUniforms:\['ocp'\]/);
  assert.match(source, /'national_staff_badge':'national_staff_ocp_patch'/);
});

test('utility uniforms replace the metal badge picker with patch selection', () => {
  assert.match(source, /<section id="groupBadges" class="panelBlock">/);
  assert.match(source, /by\('groupBadges'\)\.classList\.toggle\('hidden', !auth\.showBadges\)/);
  assert.match(source, /badgeCommand\.classList\.toggle\('hidden', !auth\.showBadges\)/);
  assert.match(source, /patchCommand\.classList\.toggle\('hidden', !auth\.showPatches\)/);
  assert.doesNotMatch(source, /UI_AUTHZ\[id\]\.showBadges = true/);
  for(const id of ['corporate_field','abu','ocp','flight_suit']){
    assert.match(source, new RegExp(`${id}:\\{ showRibbons:(?:true|false), showBadges:false, showPatches:true \\}`));
  }
});

test('reviewed OCP cloth qualification insignia are selectable as patches', () => {
  assert.match(source, /const CAPUB_UTILITY_BADGE_PATCH_BY_BADGE_ID = new Map\(\)/);
  assert.match(source, /function capubUtilityBadgePatchId\(id\)\{ return `\$\{id\}_ocp_patch`; \}/);
  assert.match(source, /utilityBadgePatch:true/);
  assert.match(source, /slotHint:'OCP_BADGE_GRID'/);
  assert.match(source, /if\(meta\.utilityBadgePatch\) continue/);
  assert.match(source, /\.map\(patchId => CAPUB_UTILITY_BADGE_ID_BY_PATCH_ID\.get\(patchId\)\)/);
  assert.match(source, /ALTERNATES\.badgeToPatch\[id\] = patchId/);
  assert.match(source, /ALTERNATES\.patchToBadge\[patchId\] = id/);
  assert.match(source, /capubRenderUtilityBadges\(\);/);
});

test('utility patch badges participate in validation and survive uniform conversion', () => {
  assert.match(source, /getRenderableCountedBadgeIds = function capubGetRenderableCountedBadgeIdsUtilityAware\(\)\{[\s\S]*?return capubUtilityBadgeIds\(\)\.filter\(id => !isCommandInsigniaBadge\(id\)\)/);
  assert.match(source, /getRenderableCommandBadgeIds = function capubGetRenderableCommandBadgeIdsUtilityAware\(\)\{[\s\S]*?return capubUtilityBadgeIds\(\)\.filter\(id => isCommandInsigniaBadge\(id\)\)/);
  const availability = source.match(/function updateAvailabilityUI\(prevUniform\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(availability.indexOf('applyAlternates(prevUniform, State.uniform)') < availability.indexOf('clearUnauthorizedPatchesForCurrentUniform()'));
});

test('governance metal badges are absent from the utility chest-badge catalog', () => {
  const utilityList = source.match(/const CAPUB_DOCUMENT_UTILITY_BADGE_IDS = \[([\s\S]*?)\n\s*\];/)?.[1] || '';
  for(const id of [
    'national_staff_badge',
    'command_council_badge',
    'senior_advisory_group_badge',
    'national_executive_committee_badge',
    'cap_national_command_board_badge'
  ]) assert.doesNotMatch(utilityList, new RegExp(id));
});
