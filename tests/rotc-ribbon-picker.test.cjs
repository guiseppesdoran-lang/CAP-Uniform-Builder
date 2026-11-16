'use strict';
// LIVE14 E74 (Ethan: "make all of the jrotc stuff dropdowns like the mil stuff"), then the owner (2026-11-12): ribbons chosen by picture, no checkboxes. The JROTC/ROTC ribbons
// are one menu of the chooser window, in the way the U.S. military ribbons are: a program select and a search narrow its tiles, the ones chosen stay in sight, three at most
// (CAPR 39-1 11.2.5). tests/pick-ribbon-list.test.cjs drives the menu on the page's own data; tests/rotc-ribbon-picker-browser.cjs drives it in headless Chrome.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const galleries = fs.readFileSync(path.join(__dirname, '..', 'js', 'galleries.js'), 'utf8');
const lists = fs.readFileSync(path.join(__dirname, '..', 'js', 'pick-lists.js'), 'utf8');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const ROTC = require('../data/rotc-ribbons.js');

test('every program has its ribbons in the data\'s order, which is the order of wear, and the page knows each as a JROTC/ROTC ribbon', () => {
  assert.ok(ROTC.services.length === 4);
  for(const service of ROTC.services) assert.ok(ROTC.ribbons.some(r => r.service === service.key), service.label);
  assert.ok(ROTC.ribbons.every(r => ev(`isRotcRibbonId(${JSON.stringify(r.id)})`)));
  const wearOrder = ev('ribbonList.filter(id => isRotcRibbonId(id))');
  assert.deepEqual(wearOrder, ROTC.ribbons.map(r => r.id));
});

test('a fourth is refused with the 11.2.5 message, and the selections keep their saved shape', () => {
  ev("State.membership = 'cadet'; State.ribbonSelections = {}; renderRack = function(){}; renderAllBadges = function(){};");
  for(const id of ['rotc_air_force_jrotc_color_guard', 'rotc_army_jrotc_proficiency', 'rotc_navy_jrotc_unit_service_ribbon', 'rotc_marine_corps_jrotc_color_guard'])
    ev(`setRibbonSelectionFromDropdown(${JSON.stringify(id)}, 'earned', { deferRender: true })`);
  const chosen = ev("Object.keys(State.ribbonSelections).filter(id => isRotcRibbonId(id) && State.ribbonSelections[id].checked)");
  assert.deepEqual(chosen.sort(), ['rotc_air_force_jrotc_color_guard', 'rotc_army_jrotc_proficiency', 'rotc_navy_jrotc_unit_service_ribbon']);
  assert.deepEqual(ev('State.ribbonSelections.rotc_army_jrotc_proficiency'), { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned' });
  assert.equal(ev('capubRotcLimitMessage()'), 'At most 3 JROTC/ROTC ribbons may be worn (CAPR 39-1, 11.2.5); remove one to add another.');
  assert.match(galleries, /window\.capubToastShow\(capubRotcLimitMessage\(\)\)/);
});

test('the JROTC/ROTC ribbons are not tiles among the CAP ones: one menu, after the CAP ribbons and before the U.S. military ones', () => {
  const build = lists.slice(lists.indexOf('function ribbonLists'), lists.indexOf('function rememberOpen'));
  assert.match(build, /const capIds = worn\.filter\(id => !d\.isRotc\(id\)\);/);
  assert.ok(build.indexOf('rotcMenu(container, rotcIds, d, refreshAll)') > build.indexOf("name: 'ribbons'"));
  assert.ok(build.indexOf('rotcMenu(container, rotcIds, d, refreshAll)') < build.indexOf('militaryMenu(container, d, refreshAll)'));
  const menu = lists.slice(lists.indexOf('function rotcMenu'), lists.indexOf('function militaryMenu'));
  // The military menu's look: the same details, filter row and grid classes, and its open/closed state kept the same way.
  assert.match(menu, /el\('details', 'militaryRibbonMenu rotcRibbonMenu'\)/);
  assert.match(menu, /rememberOpen\(d, menu, 'rotc-root'\)/);
  assert.match(menu, /el\('div', 'militaryRibbonCatalogFilters rotcRibbonCatalogFilters'\)/);
  // The program is the heading its ribbons are under, not a drop-down.
  assert.doesNotMatch(menu, /el\('select'|rotcProgramSelect/);
  assert.match(menu, /groups: \(\) => rotc\.services\.map\(service => \(\{ key: service\.label/);
  assert.match(menu, /el\('input', 'rotcRibbonSearch'\)/);
  // No dropdown to add from and no Remove button: a ribbon is a tile, a tap turns it on or off.
  assert.doesNotMatch(menu + galleries, /rotcRibbonAddSelect|rotcRibbonRemove|rotcChosenGrid/);
  assert.match(menu, /name: 'rotcRibbons'/);
});

test('in a real browser, JROTC ribbons picked by tapping their tiles are drawn, and a fourth is refused (needs Chrome)', { timeout: 240000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'rotc-ribbon-picker-browser.cjs')], { encoding: 'utf8', timeout: 220000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
