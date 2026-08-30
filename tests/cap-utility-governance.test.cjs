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
