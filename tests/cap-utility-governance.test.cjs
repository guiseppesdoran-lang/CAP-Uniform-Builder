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

test('utility uniforms expose both fabric badge and patch selection', () => {
  assert.match(source, /<section id="groupBadges" class="panelBlock">/);
  assert.match(source, /by\('groupBadges'\)\.classList\.toggle\('hidden', !auth\.showBadges\)/);
  assert.match(source, /badgeCommand\.classList\.toggle\('hidden', !auth\.showBadges\)/);
  assert.match(source, /patchCommand\.classList\.toggle\('hidden', !auth\.showPatches\)/);
  for(const id of ['corporate_field','abu','ocp','flight_suit']){
    assert.match(source, new RegExp(`${id}:\\{ showRibbons:(?:true|false), showBadges:true, showPatches:true \\}`));
  }
});

test('utility badge picker previews and renders fabric-only badge assets', () => {
  assert.match(source, /function capubUtilityBadgePreviewUrl\(id\)/);
  assert.match(source, /badges\/utility\/\$\{id\}\.png/);
  assert.match(source, /class="utilityBadgePreview"/);
  assert.match(source, /Never fall back to metal\/non-fabric artwork on a utility uniform/);
  assert.match(source, /return \[`badges\/utility\/\$\{id\}\.png`\]/);
  assert.match(source, /const selected = \[\.\.\.new Set\(State\.badges \|\| \[\]\)\]/);
  assert.doesNotMatch(source, /utilityBadgePatch:true/);
});

test('utility badge selections participate in validation and patch alternates survive conversion', () => {
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
