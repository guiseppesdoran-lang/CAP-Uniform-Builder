'use strict';
// The command insignia pin and the Command Service Ribbon are separate. CAPR 39-1 10.2.5: current and graduated commanders in the grade of
// lieutenant colonel and below wear the pin, one pin only, a current commander the pin of the assignment. CAPR 39-3 21a: the ribbon is awarded
// after a year of continuous command, and the star on it shows one level of command. So a commander in the first year wears the pin without the
// ribbon, and the pin must never set or lower the ribbon's level. The page used to force the ribbon on with the pin and drop it to the squadron
// level; these tests hold the two apart, keep the grade rule and the one pin, and keep the texts to the rule and its paragraph.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const RIBBON = 'cap_command_service_ribbon', SQUADRON = 'squadron_commander_badge', GROUP = 'group_commander_badge';

// A senior member's setup with the picks given, run through the sync, and the state it leaves.
function sync({ rank = 'Lt Col', pins = [], worn = pins, ribbon = '', graduated = false } = {}){
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  return JSON.parse(vm.runInContext(`(function(rank, pins, worn, ribbon, graduated){
    State.membership = 'senior'; State.gender = 'male'; State.rank = rank; State.uniform = 'blues_a';
    State.commandInsignia = { graduatedCommander: graduated };
    normalizeRibbonSelections(); normalizeBadgeSelections();
    for(const id of pins) State.badgeSelections[id].checked = true;
    State.badges = [...worn];
    if(ribbon) applyRibbonSelectionValue('${RIBBON}', ribbon);
    syncCommandBadgeAndRibbonSelections();
    const r = State.ribbonSelections['${RIBBON}'] || {};
    return JSON.stringify({
      ribbon: { checked: !!r.checked, value: r.awardValue || '', label: r.awardLabel || '' },
      checked: [...COMMAND_INSIGNIA_BADGE_IDS].filter(id => State.badgeSelections[id] && State.badgeSelections[id].checked),
      badges: State.badges,
      slot: Object.fromEntries([...COMMAND_INSIGNIA_BADGE_IDS].map(id => [id, getBadgeSlotSpec(id)])),
      current: hasCurrentCommanderBadgeSelected(), chosen: getSelectedCommandInsigniaId()
    });
  })`, context)(rank, pins, worn, ribbon, graduated));
}

test('the pin does not add the ribbon: a commander in the first year wears the pin alone', () => {
  const r = sync({ pins: [SQUADRON] });
  assert.deepEqual(r.checked, [SQUADRON]);
  assert.equal(r.ribbon.checked, false);
});

test('the pin does not lower the ribbon: a group, wing or region ribbon keeps its star with the pin on', () => {
  for(const [value, label] of [['mcchord_15300', 'Group/CC'], ['mcchord_15600', 'Wing/CC'], ['mcchord_15400', 'Region/CC']]){
    const r = sync({ pins: [SQUADRON], ribbon: value, graduated: true });
    assert.deepEqual(r.ribbon, { checked: true, value, label }, label);
    assert.deepEqual(r.checked, [SQUADRON]);
  }
});

test('the ribbon does not add the pin', () => {
  const r = sync({ ribbon: 'mcchord_15200' });
  assert.equal(r.ribbon.checked, true);
  assert.deepEqual(r.checked, []);
  assert.deepEqual(r.badges, []);
});

test('a colonel wears no command pin, squadron or group, and keeps the ribbon', () => {
  for(const pin of [SQUADRON, GROUP]){
    const r = sync({ rank: 'Col', pins: [pin], ribbon: 'mcchord_15600' });
    assert.deepEqual(r.checked, [], pin);
    assert.deepEqual(r.badges, [], pin);
    assert.equal(r.ribbon.value, 'mcchord_15600');
  }
});

test('one command pin: with both ticked the one on the uniform stays', () => {
  const r = sync({ pins: [SQUADRON, GROUP], worn: [GROUP] });
  assert.deepEqual(r.checked, [GROUP]);
  assert.deepEqual(r.badges, [GROUP]);
  assert.equal(r.chosen, GROUP);
});

test('the group pin is a command pin like the squadron pin: over the name tag for a current commander, under it for a graduated one', () => {
  let r = sync({ pins: [GROUP] });
  assert.equal(r.slot[GROUP], 'ON');
  assert.equal(r.current, true);
  r = sync({ pins: [GROUP], graduated: true });
  assert.equal(r.slot[GROUP], 'UN');
  assert.equal(r.slot[SQUADRON], 'UN');
  assert.equal(r.current, false);
});

test('choosing one command pin takes the other off', () => {
  const { context } = loadPageScripts();
  const out = JSON.parse(vm.runInContext(`(function(){
    State.membership = 'senior'; State.rank = 'Maj'; normalizeBadgeSelections();
    State.badgeSelections['${SQUADRON}'].checked = true; State.badges = ['${SQUADRON}'];
    State.badgeSelections['${GROUP}'].checked = true; State.badges.push('${GROUP}');
    chooseOnlyCommandInsignia('${GROUP}');
    return JSON.stringify({ squadron: State.badgeSelections['${SQUADRON}'].checked, group: State.badgeSelections['${GROUP}'].checked, badges: State.badges });
  })()`, context));
  assert.deepEqual(out, { squadron: false, group: true, badges: [GROUP] });
});

test('every chooser gives each command pin the Graduated commander box and holds the one pin', () => {
  for(const f of ['js/galleries.js', 'js/wiring.js', 'js/patches.js']){
    const src = read(f);
    assert.match(src, /isCommandInsigniaBadge\(id\)[^`\n]*\? `<div class="miniRow"><label><input type="checkbox" class="cmdGradChk"> Graduated commander/, f);
    assert.doesNotMatch(src, /id\s*===?\s*'squadron_commander_badge'/, f + ' asks for the squadron pin by name');
    assert.match(src, /chooseOnlyCommandInsignia\(id\)/, f);
    assert.match(src, /gradChk\.checked = !!sel\.checked && !!State\.commandInsignia\?\.graduatedCommander/, f);
  }
});

test('the sync has no path from the pin to the ribbon or back', () => {
  const src = read('js/galleries.js');
  const fn = src.slice(src.indexOf('function syncCommandBadgeAndRibbonSelections(){'), src.indexOf('\n}\n', src.indexOf('function syncCommandBadgeAndRibbonSelections(){')));
  assert.doesNotMatch(fn, /applyRibbonSelectionValue|ribbonSelections\[|COMMAND_SERVICE_RIBBON/);
});

test('the Items row asks which command is held and moves the one pin', () => {
  const html = read('index.html'), ui = read('js/workspace-ui.js');
  const row = html.slice(html.indexOf('id="commandInsigniaRow"'), html.indexOf('id="badgesPlannedNote"'));
  assert.match(row, /<label class="fieldLabel" for="commandInsigniaLevel">Command held<\/label>/);
  assert.deepEqual([...row.matchAll(/<option value="([a-z]+)">([^<]+)<\/option>/g)].map(m => [m[1], m[2]]), [['squadron', 'Squadron commander'], ['group', 'Group commander']]);
  assert.match(row, /one pin only/);
  assert.match(row, /The Command Service Ribbon is a separate award, added under Ribbons\./);
  assert.match(ui, /const COMMAND_PINS=\{squadron:'squadron_commander_badge',group:'group_commander_badge'\}/);
  assert.match(ui, /if\(t\.id==='commandInsigniaLevel'\)\{ if\(commandChoice\(\)!=='none'\) setCommand\(commandChoice\(\),t\.value\); return; \}/);
  assert.match(ui, /sel\.checked=choice!=='none' && id===pin;/);
  assert.match(ui, /pickWrap\.classList\.toggle\('hidden',choice==='none'\)/);
  assert.match(read('styles/app.css'), /\.commandRowLevel\.hidden\{display:none\}/);
});

test('the texts give the rule and its paragraph: no slot letters, no invented exception, no browser alert', () => {
  const wiring = read('js/wiring.js'), imp = read('js/member-report-import.js');
  for(const m of wiring.matchAll(/addNotice\('[a-z]+',\s*([^\n]+)/g)) assert.doesNotMatch(m[1], /\((UN|ON|LP|RP|FON|OLP|OLPA|OLPU)\)/, m[1].slice(0, 90));
  assert.match(wiring, /worn as a graduated commander, below the name tag\. It is not counted among the four badges \(CAPR 39-1, 10\.2\.5\)\./);
  assert.match(wiring, /worn as a current commander, above the name tag\. It is not counted among the four badges \(CAPR 39-1, 10\.2\.5\)\./);
  const warn = imp.slice(imp.indexOf('function showCommandInsigniaRankWarning(){'), imp.indexOf('function canSelectCommandInsigniaForCurrentRank'));
  assert.match(warn, /capubNotify\('The command insignia pin is worn in the grade of lieutenant colonel and below \(CAPR 39-1, 10\.2\.5\)\.'/);
  assert.doesNotMatch(warn, /alert\(|Command Council|specifically authorized|will not render/);
});

test('an open chooser follows: the command cards show the one pin worn and whether it is a graduated commander\'s', () => {
  const { context, referenceErrors } = loadPageScripts();
  assert.deepEqual(referenceErrors, []);
  // Three cards as a chooser draws them: both command pins and one other badge, each with its boxes as they stood before the change.
  const card = (id, on, grad) => {
    const boxes = { '.bdChk': { checked: on }, '.cmdGradChk': grad === null ? null : { checked: grad } };
    return { dataset: { badgeId: id }, querySelector: sel => boxes[sel] || null, boxes };
  };
  const cards = [card(SQUADRON, true, true), card(GROUP, false, false), card('pilot_badge', true, null)];
  context.document = { querySelectorAll: sel => sel === '.galleryTile[data-badge-id]' ? cards : [] };
  vm.runInContext(`
    State.membership = 'senior'; State.gender = 'male'; State.rank = 'Lt Col'; State.uniform = 'blues_a';
    normalizeBadgeSelections();
    State.commandInsignia = { graduatedCommander: true };
    State.badgeSelections['${GROUP}'].checked = true; State.badgeSelections['${SQUADRON}'].checked = false;
    syncCommandInsigniaTiles();
  `, context);
  const shown = cards.map(c => [c.boxes['.bdChk'].checked, c.boxes['.cmdGradChk'] && c.boxes['.cmdGradChk'].checked]);
  assert.deepEqual(shown, [[false, false], [true, true], [true, null]], 'squadron card off, group card on as graduated, the other badge untouched');
  vm.runInContext(`State.commandInsignia.graduatedCommander = false; syncCommandInsigniaTiles();`, context);
  assert.equal(cards[1].boxes['.cmdGradChk'].checked, false, 'a current commander: the Graduated box is clear');

  for(const file of ['js/galleries.js', 'js/wiring.js', 'js/patches.js']) assert.match(read(file), /tile\.dataset\.badgeId = id;/, file + ' names its badge cards');
  assert.match(read('js/galleries.js'), /rebuildRibbonsFromGallery\(\);\n[^\n]*capubSyncBadgesNotWornNote[^\n]*\n\s*syncCommandInsigniaTiles\(\);\n\}/, 'the badge rebuild ends by bringing open cards in step');
});
