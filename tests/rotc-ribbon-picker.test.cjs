'use strict';
// LIVE14 E74 (Ethan: "make all of the jrotc stuff dropdowns like the mil stuff"). The JROTC/ROTC ribbons are picked in one menu the
// way the U.S. military ribbons are: a program select, a search and a dropdown of that program's ribbons; the ones chosen are tiles
// with a Remove button; three at most (CAPR 39-1 11.2.5). tests/rotc-ribbon-picker-browser.cjs drives it in headless Chrome.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const galleries = fs.readFileSync(path.join(__dirname, '..', 'js', 'galleries.js'), 'utf8');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const values = html => [...html.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
const ROTC = require('../data/rotc-ribbons.js');

test('the dropdown offers a program\'s ribbons, narrowed by the search, without the ones already chosen', () => {
  const all = ROTC.ribbons.map(r => r.id);
  ev("State.ribbonSelections = {}");
  assert.deepEqual(values(ev(`capubRotcAddOptionsHtml(${JSON.stringify(all)}, 'ALL', '')`)), all, 'all programs, in the data\'s order');
  for(const service of ROTC.services){
    const own = ROTC.ribbons.filter(r => r.service === service.key).map(r => r.id);
    assert.deepEqual(values(ev(`capubRotcAddOptionsHtml(${JSON.stringify(all)}, ${JSON.stringify(service.key)}, '')`)), own, service.label);
  }
  assert.deepEqual(values(ev(`capubRotcAddOptionsHtml(${JSON.stringify(all)}, 'army-jrotc', 'PROFIC')`)), ['rotc_army_jrotc_proficiency']);
  assert.match(ev(`capubRotcAddOptionsHtml(${JSON.stringify(all)}, 'ALL', '')`), /^<option value="">- Add a ribbon -<\/option><optgroup label="Air Force JROTC">/);
  ev("State.ribbonSelections = { rotc_army_jrotc_proficiency: { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned' } }");
  assert.deepEqual(values(ev(`capubRotcAddOptionsHtml(${JSON.stringify(all)}, 'army-jrotc', 'profic')`)), []);
  assert.match(ev(`capubRotcAddOptionsHtml(${JSON.stringify(all)}, 'army-jrotc', 'profic')`), /^<option value="">- No ribbon matches -<\/option>$/);
});

test('a fourth is refused with the 11.2.5 message, and the selections keep their saved shape', () => {
  ev("State.membership = 'cadet'; State.ribbonSelections = {}; renderRack = function(){}; renderAllBadges = function(){};");
  for(const id of ['rotc_air_force_jrotc_color_guard', 'rotc_army_jrotc_proficiency', 'rotc_navy_jrotc_unit_service_ribbon', 'rotc_marine_corps_jrotc_color_guard'])
    ev(`setRibbonSelectionFromDropdown(${JSON.stringify(id)}, 'earned', { deferRender: true })`);
  const chosen = ev("Object.keys(State.ribbonSelections).filter(id => isRotcRibbonId(id) && State.ribbonSelections[id].checked)");
  assert.deepEqual(chosen.sort(), ['rotc_air_force_jrotc_color_guard', 'rotc_army_jrotc_proficiency', 'rotc_navy_jrotc_unit_service_ribbon']);
  assert.deepEqual(ev('State.ribbonSelections.rotc_army_jrotc_proficiency'), { checked: true, devices: {}, awardValue: 'earned', awardLabel: 'Earned', imageOverride: null });
  assert.equal(ev('capubRotcLimitMessage()'), 'At most 3 JROTC/ROTC ribbons may be worn (CAPR 39-1, 11.2.5); remove one to add another.');
  assert.match(galleries, /window\.capubToastShow\(capubRotcLimitMessage\(\)\)/);
});

test('the JROTC/ROTC ribbons are not tiles of their own: one menu, after the CAP ribbons and before the U.S. military ones', () => {
  const build = galleries.slice(galleries.indexOf('function buildRibbonGallery'), galleries.indexOf('function capubRotcLimitMessage'));
  assert.match(build, /const eligible = wornIds\.filter\(id => !isRotcRibbonId\(id\)\);/);
  assert.ok(build.indexOf('capubBuildRotcRibbonMenu(rotcIds, buildTile)') > build.indexOf('section.ids.forEach(id=>wrap.appendChild(buildTile(id,false)))'));
  assert.ok(build.indexOf('capubBuildRotcRibbonMenu(rotcIds, buildTile)') < build.indexOf("militaryMenu.className='militaryRibbonMenu'"));
  const menu = galleries.slice(galleries.indexOf('function capubBuildRotcRibbonMenu'), galleries.indexOf('function wireRibbonTileControls'));
  // The military menu's look: the same details, filter row and grid classes, and its open/closed state kept the same way.
  assert.match(menu, /menu\.className = 'militaryRibbonMenu rotcRibbonMenu';/);
  assert.match(menu, /menu\.dataset\.militarySection = 'rotc-root';/);
  assert.match(menu, /filters\.className = 'militaryRibbonCatalogFilters rotcRibbonCatalogFilters';/);
  assert.match(menu, /<select class="rotcProgramSelect"/);
  assert.match(menu, /<input class="rotcRibbonSearch" type="search"/);
  // The picker window re-syncs after a change to an rbAwardSelect (js/wiring.js wireModalInteractions); adding is one.
  assert.match(menu, /<select class="rbAwardSelect rotcRibbonAddSelect"/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'js', 'wiring.js'), 'utf8'), /grid\.querySelectorAll\('\.rbAwardSelect,/);
  assert.match(menu, /grid\.className = 'militaryBranchGrid rotcChosenGrid';/);
  assert.match(menu, /remove\.className = 'ghost rotcRibbonRemove';/);
});

test('in a real browser, two JROTC ribbons picked through the program and ribbon dropdowns are drawn, and a fourth is refused (needs Chrome)', { timeout: 240000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'rotc-ribbon-picker-browser.cjs')], { encoding: 'utf8', timeout: 220000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
