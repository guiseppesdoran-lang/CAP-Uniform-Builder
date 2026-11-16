'use strict';
// The duty rows and the patches js/patches.js reads from a member report (I2, an independent tester's findings): an assistant is not the
// commander, an End Date still to come does not end a command, a unit patch is the member's own unit, and an Orientation Pilot ribbon is not a
// current Cadet Orientation Pilot qualification (CAPR 39-1, 10.9.15).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const SENIOR = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-senior-live13.txt'), 'utf8');
const CADET = fs.readFileSync(path.join(__dirname, 'fixtures', 'eservices-member-details-cadet-live12.txt'), 'utf8');
const { context } = loadPageScripts();
const parse = text => JSON.parse(vm.runInContext('(t) => { const p = parseCapMemberReport(t); return JSON.stringify({ badges: p.badges, ribbons: p.ribbons.map(r => r.id + "=" + r.value), status: p.commandStatus || null, patches: p.patches || [], charter: p.unitPatchCharter || null, cord: p.shoulderCord || null }); }', context)(text));
const COMMANDER = 'Commander GLR-IL-049 UNIT No 01 Jan 2025';
const pins = r => r.badges.filter(id => /_commander_badge$/.test(id));

test('an assistant (Asst Yes) is not the commander: no pin and no Command Service Ribbon', () => {
  const r = parse(SENIOR.replace(COMMANDER, 'Commander GLR-IL-049 UNIT Yes 01 Jan 2025'));
  assert.deepEqual(pins(r), []);
  assert.ok(!r.ribbons.some(x => /^cap_command_service_ribbon/.test(x)));
  assert.deepEqual(pins(parse(SENIOR)), ['squadron_commander_badge']);
});

test('a command whose End Date is still to come is a current command: the pin over the name tag, the group pin for a group, the ribbon counted to today', () => {
  const unit = parse(SENIOR.replace(COMMANDER, `${COMMANDER} 31 Dec 2099`));
  assert.equal(unit.status, 'current');
  assert.deepEqual(pins(unit), ['squadron_commander_badge']);
  const group = parse(SENIOR.replace(COMMANDER, 'Commander GLR-IL-001 GROUP No 01 Jan 2025 31 Dec 2099'));
  assert.equal(group.status, 'current');
  assert.deepEqual(pins(group), ['group_commander_badge']);
  assert.ok(group.ribbons.some(x => /^cap_command_service_ribbon=group_bronze_star/.test(x)));
  // An End Date that has passed ends it: a graduated commander of a year or more.
  assert.equal(parse(SENIOR.replace(COMMANDER, `${COMMANDER} 01 Jun 2026`)).status, 'graduated');
});

test('the unit patch is the member\'s own unit, the Unit column of the General Information row, never the wing\'s from a duty row', () => {
  assert.equal(parse(CADET).charter, 'GLR-IL-049');
  assert.equal(parse(CADET.replace('GLR-IL-049', 'XXX-YY-123')).charter, null, 'a unit that is not in the list is no unit, and the wing in the duty rows is not it');
});

test('the Cadet Orientation Pilot patch needs a current qualification, not the ribbon for fifty flights', () => {
  assert.ok(!parse(SENIOR).patches.includes('orientation_pilot_patch'));
  assert.ok(parse(SENIOR.replace('Mission Scanner (MS) QUALIFIED 01 Jan 2027', 'Mission Scanner (MS) QUALIFIED 01 Jan 2027\nCadet Orientation Pilot QUALIFIED 01 Jan 2027')).patches.includes('orientation_pilot_patch'));
});

test('only the unit commander\'s own title qualifies: Flight, Encampment, Honor Guard, Ground Team, Drill Team and Acting Commander do not', () => {
  for(const title of ['Flight Commander', 'Encampment Commander', 'Honor Guard Commander', 'Ground Team Commander', 'Drill Team Commander', 'Acting Commander', 'Incident Commander', 'Deputy Commander', 'Cadet Commander']){
    const r = parse(SENIOR.replace(COMMANDER, `${title} GLR-IL-049 UNIT No 01 Jan 2025`));
    assert.deepEqual(pins(r), [], title);
    assert.ok(!r.ribbons.some(x => /^cap_command_service_ribbon/.test(x)), title);
  }
  for(const title of ['Commander', 'Squadron Commander']) assert.deepEqual(pins(parse(SENIOR.replace('Commander GLR-IL-049', `${title} GLR-IL-049`))), ['squadron_commander_badge'], title);
  assert.deepEqual(pins(parse(SENIOR.replace(COMMANDER, 'Group Commander GLR-IL-001 GROUP No 01 Jan 2025'))), ['group_commander_badge']);
  // A commander row after another row, on the line a PDF makes.
  assert.deepEqual(pins(parse(SENIOR.replace(/\n/g, ' '))), ['squadron_commander_badge']);
});

test('an assistant on the Cadet Advisory Council (Asst Yes) earns no council cord and no ribbon level', () => {
  const yes = parse(CADET.replace('GLR-IL-001 WING No 01 Jun 2025', 'GLR-IL-001 WING Yes 01 Jun 2025'));
  assert.equal(yes.cord, null);
  assert.ok(!yes.ribbons.some(x => /^cadet_advisory_council_ribbon=wing/.test(x)), yes.ribbons.join(','));
  assert.equal(parse(CADET).cord, 'wing');
});

test('a unit in lower case is still the member\'s unit', () => {
  assert.equal(parse(CADET.replace('GLR-IL-049', 'glr-il-049')).charter, 'GLR-IL-049');
});
