'use strict';
// LIVE12 E59 (Ethan, the women's aviator shirt collar with the tie tab: "the tie tab's apex rises into the collar junction instead of sitting under the collar"; CAPR 39-1 4.1.12.4 and
// 4.2.6.3: the women's tie tab is worn under the closed collar, its tails showing below the collar points). On the sheets that wear the tab the closed collar's leaves are painted after
// it: the tab is the sheet's own `tie` group; the long aviator shirt (alone and beside the women's blazer) and the long Class B blouse draw it before their leaves, and the short aviator
// shirt redraws it over the badges on its own foreground layer below the closed pieces. LIVE12 E60b: the short Class B blouse's closed group now names its cover of the open V and its
// placket (art 626369e1: `collar-closed-cover`, `collar-closed-placket`, then each leaf's fill, `-shadow` and `-edge`): under the badges
// the base sheet draws them, the tab is drawn over the badges and then the rest of the closed group without them; the tab is never painted out by the cover.
// The overblouse has no tie tab (tieRule: not offered, 4.2.6.3) and no `tie` group. The separate -tie-tab overlay sheets are not placed (LIVE8-3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
const HARNESS = require('../scripts/render-builds.cjs');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'images/MANIFEST.json'), 'utf8'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(fs.readFileSync(path.join(ROOT, 'images', p), 'utf8'))));
const svgOf = id => fs.readFileSync(path.join(ROOT, 'images', manifest.assets.find(a => a.id === id).path), 'utf8');

// Every element of a sheet with an id, in document order, with the ids of its ancestors (the sheet prefix removed).
function elements(sheet){
  const svg = svgOf(sheet), pre = `${sheet}__`, out = [], stack = [];
  const re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let m;
  while((m = re.exec(svg))){
    if(m[1]){ stack.pop(); continue; }
    const idm = /\bid="([^"]+)"/.exec(m[3]);
    const id = idm && idm[1].startsWith(pre) ? idm[1].slice(pre.length) : null;
    if(id) out.push({ id, ancestors: stack.filter(Boolean) });
    if(!m[4]) stack.push(id);
  }
  return out;
}
// The order the scene paints the named pieces of the sheet in: its layers by z (a stable sort, as render-svg draws them), each drawing its pieces in document order,
// less the groups it hides (hideGroups) or with only the groups it shows (onlyGroups).
function paintOrder(scene, sheet, names){
  const els = elements(sheet).filter(e => names.includes(e.id));
  const seq = [];
  for(const l of [...scene.layers].sort((a, b) => (a.z || 0) - (b.z || 0))){
    if(l.type !== 'asset' || l.id !== sheet) continue;
    for(const e of els){
      const chain = [...e.ancestors, e.id];
      if(l.hideGroups && chain.some(g => l.hideGroups.includes(g))) continue;
      if(l.onlyGroups && !chain.some(g => l.onlyGroups.includes(g))) continue;
      seq.push({ id: e.id, z: l.z, role: l.role });
    }
  }
  return seq;
}
const lastIndex = (seq, id) => seq.map(s => s.id).lastIndexOf(id);

const build = (uniform, opt, extra) => Object.assign(HARNESS.makeBuild({ uniform, gender: 'female', membership: 'senior', rank: 'Capt', opt: Object.assign({ headgear: 'none' }, opt) }), extra || {});
// [label, build, sheet, the closed collar's leaves on that sheet]
const SHEETS = [
  ['aviator short, tie tab on', build('aviator', { sleeve: 'short', tie: true }), 'garment-aviator-shirt-female', ['collar-closed-right', 'collar-closed-left']],
  ['aviator long', build('aviator', { sleeve: 'long' }), 'garment-aviator-shirt-female-long', ['collar-right', 'collar-left']],
  ['aviator long beside the blazer', build('aviator_blazer', {}), 'garment-aviator-shirt-female-long', ['collar-right', 'collar-left']],
  ['Class B short, tie tab on', build('blues_b', { sleeve: 'short', tie: true }), 'garment-blues-class-b-blouse-female',
    ['collar-closed-right', 'collar-closed-right-shadow', 'collar-closed-right-edge', 'collar-closed-left', 'collar-closed-left-shadow', 'collar-closed-left-edge']],
  ['Class B long', build('blues_b', { sleeve: 'long' }), 'garment-blues-class-b-blouse-female-long', ['collar-right', 'collar-left']]
];
// Badges and the full CAP rack, so the short sheets' collar is redrawn over them (collarOverBadges) as it is in use.
const RACK = require('../data/ribbon-awards.js'), ALL_RIBBONS = Object.keys(RACK.FAMILIES).map(id => [id]);
const WITH_BADGES = { badgeIds: ['observer_badge', 'emergency_services_badge', 'christian_chaplin'], ribbonSel: ALL_RIBBONS };

for(const [label, b, sheet, leaves] of SHEETS){
  for(const [what, extra] of [['plain', null], ['with badges and ribbons', WITH_BADGES]]){
    test(`${sheet} (${label}, ${what}): the tie tab is drawn, and the closed collar's leaves are painted over it (4.1.12.4, 4.2.6.3)`, async () => {
      const scene = await P.composeUniform(Object.assign({}, b, extra || {}), store);
      assert.ok(scene.layers.some(l => l.type === 'asset' && l.id === sheet && l.role === 'garment'), `${sheet} is the shirt drawn`);
      assert.ok(!scene.layers.some(l => /-tie-tab$/.test(l.id || '')), 'no separate tie-tab overlay is placed');
      const seq = paintOrder(scene, sheet, ['tie-tab-body', ...leaves]);
      const tab = lastIndex(seq, 'tie-tab-body');
      assert.ok(tab >= 0, 'the tie tab is drawn with the tab on');
      for(const leaf of leaves){
        const at = lastIndex(seq, leaf);
        assert.ok(at > tab, `${leaf} is painted after the tab (last tab z ${seq[tab].z}, last ${leaf} z ${at >= 0 ? seq[at].z : 'none'})`);
      }
      // A foreground layer that redraws the tab lies below the one that redraws the leaves.
      const fg = scene.layers.filter(l => l.role === 'garment-foreground' && l.id === sheet);
      const tabFg = fg.filter(l => l.onlyGroups.includes('tie')), leafFg = fg.filter(l => l.onlyGroups.some(g => g === 'collar-closed' || leaves.includes(g) || g === 'collar-foreground'));
      for(const t of tabFg){
        assert.ok(!leafFg.includes(t), 'the tab is not redrawn on the leaves\' layer, where the sheet\'s order would decide');
        for(const l of leafFg) assert.ok(t.z < l.z, `the tab's layer (z ${t.z}) is below the leaves' (z ${l.z})`);
      }
    });
  }
}

test('the women\'s short sheets with the tab off draw no tab and redraw none', async () => {
  for(const [uniform, sheet] of [['aviator', 'garment-aviator-shirt-female'], ['blues_b', 'garment-blues-class-b-blouse-female']]){
    const scene = await P.composeUniform(build(uniform, { sleeve: 'short', tie: false }, WITH_BADGES), store);
    assert.deepEqual(paintOrder(scene, sheet, ['tie-tab-body']), [], `${sheet}: no tab painted`);
  }
});

test('the overblouse wears no tie tab: it is not offered and the sheets draw none', async () => {
  for(const sheet of ['garment-overblouse-female', 'garment-overblouse-female-long']) assert.ok(!svgOf(sheet).includes(`${sheet}__tie`), `${sheet}: no tie group`);
  for(const sleeve of ['short', 'long']){
    const scene = await P.composeUniform(build('aviator', { sleeve, femaleTop: 'overblouse', tie: true }), store);
    assert.ok(scene.layers.some(l => l.role === 'garment' && /^garment-overblouse-female/.test(l.id)), `${sleeve}: the overblouse is drawn`);
    assert.ok(!scene.layers.some(l => (l.onlyGroups || []).includes('tie')), `${sleeve}: no tab redrawn`);
  }
});

test('garment-blues-class-b-blouse-female: the cover of the open V and the placket are painted before the tab, the leaves after it, and the tab is never painted over by the cover (LIVE12 E60b)', async () => {
  const sheet = 'garment-blues-class-b-blouse-female', svg = svgOf(sheet);
  const order = ['collar-closed-cover', 'collar-closed-placket', 'collar-closed-right', 'collar-closed-right-shadow', 'collar-closed-right-edge', 'collar-closed-left', 'collar-closed-left-shadow', 'collar-closed-left-edge'];
  const at = order.map(id => svg.indexOf(`id="${sheet}__${id}"`));
  assert.ok(at.every(i => i > 0), 'the sheet names the cover, the placket and each leaf\'s fill, shadow and edge');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in that order inside the closed group');
  for(const extra of [null, WITH_BADGES]){
    const scene = await P.composeUniform(build('blues_b', { sleeve: 'short', tie: true }, extra), store);
    const seq = paintOrder(scene, sheet, ['tie-tab-body', ...order]);
    const tab = lastIndex(seq, 'tie-tab-body');
    assert.ok(tab >= 0, 'the tab is drawn');
    for(const id of ['collar-closed-cover', 'collar-closed-placket']) assert.ok(lastIndex(seq, id) < tab, `${id} is painted before the tab's last drawing`);
    for(const id of order.slice(2)) assert.ok(lastIndex(seq, id) > tab, `${id} is painted after the tab`);
    // over the badges: the tab, then the closed group without its cover and placket (the base sheet draws those under the tab; redrawn over the badges the cover would
    // paint the blouse over a ribbon lying where the open collar would be, as on the short aviator shirt)
    const fg = scene.layers.filter(l => l.role === 'garment-foreground');
    assert.deepEqual(fg.map(l => [l.onlyGroups, l.hideGroups || null]), [[['tie'], null], [['collar-closed'], ['collar-closed-cover', 'collar-closed-placket']]]);
    assert.ok(fg[0].z < fg[1].z);
  }
});
