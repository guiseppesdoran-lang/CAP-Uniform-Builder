'use strict';
// The owner (2026-11-12): "make the uniform selection, and the grade selection visual. mostly everything should be visual atp" and "same with the ribbon rack extra selection
// things". The choices of the Items step that change what is drawn are chosen by picture (js/item-pickers.js, the picture picker of js/visual-picker.js), the pictures made from the
// engine's own rack and numbers (js/option-pictures.js). The control each replaces stays on the page, hidden, as the source of truth: the page's own code reads it, writes it and
// listens to its change event, so what is saved, shared and undone does not change.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, keydown } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
const awards = require('../js/engine/awards.js');
const G = require('../js/engine/grades.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const OP = require('../js/option-pictures.js');

const html = read('index.html');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

// ---- the page --------------------------------------------------------------------------------------------------------------------------

// The controls this file replaces by pictures, each with the host the picker is drawn in. The control stays, as a hidden source.

test('each control keeps its element, hidden from sight and from the keyboard and screen readers, with a host for its picker beside it; the script loads after the panel\'s', () => {
  for(const id of ['ribbonRackColumns', 'ribbonRackArrangement', 'miniMountStyle']){
    assert.equal([...html.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, `${id} once`);
    const host = new RegExp(`<div id="${id}Picker"[^>]*\\bhidden\\b[^>]*></div>\\s*<label class="fieldNote segmentedSource" aria-hidden="true">[^<]*<select id="${id}" tabindex="-1">`).exec(html);
    assert.ok(host, `${id}: a host, then the control as a hidden source`);
  }
  // The command insignia pin: its three radios stay inside the row (the page's handler is the row's), their list hidden, a host before it; the level's list and its label hidden too.
  assert.match(html, /<div id="commandInsigniaChoicePicker" hidden><\/div>\s*<div class="badgeChooserList segmentedSource" role="radiogroup" aria-labelledby="commandInsigniaLabel" aria-hidden="true">\s*<label class="badgeChooserOption"><input type="radio" name="commandInsignia" value="none">/);
  assert.match(html, /<div id="commandInsigniaLevelWrap" class="commandRowLevel hidden">\s*<div id="commandInsigniaLevelPicker" hidden><\/div>\s*<label class="fieldLabel segmentedSource" for="commandInsigniaLevel" aria-hidden="true">Command held<\/label>\s*<select id="commandInsigniaLevel" class="segmentedSource" tabindex="-1" aria-hidden="true">/);
  assert.equal([...html.matchAll(/<input type="radio" name="commandInsignia"/g)].length, 3, 'the radios are the page\'s, once each');
  const at = name => html.indexOf(`<script src="js/${name}`);
  assert.ok(at('garment-options.js') < at('item-pickers.js') && at('item-pickers.js') < at('wiring.js'), 'after the pictures and the picker, before the page wiring');
  assert.match(html, /<script src="js\/item-pickers\.js\?v=[0-9a-f]+" defer><\/script>/);
  // The fold's name is not repeated: the legend of the first picker is the label the control had.
  const rack = html.slice(html.indexOf('id="rackLayoutMore"'), html.indexOf('</details>', html.indexOf('id="rackLayoutMore"')));
  assert.equal((rack.match(/Ribbon rack layout/g) || []).length, 1);
});

// ---- the pictures: the member's own rack, as the engine lays it ----------------------------------------------------------------------------

const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));
const CHOICES = ['air_force_aerial_achievement_medal', 'silver_medal_of_valor', 'bronze_medal_of_valor', 'distinguished_service_award', 'exceptional_service_award', 'meritorious_service_award',
  'commander_commendation_award', 'cap_achievment_award', 'lifesaving_award', 'unit_citation_award', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon'];
// The member in the page's state: what is chosen is what the page hands the engine.
const member = o => run(`
  State.membership = ${JSON.stringify(o.membership || 'senior')}; State.uniform = ${JSON.stringify(o.uniform || 'blues_a')}; State.gender = ${JSON.stringify(o.gender || 'male')}; State.rank = ${JSON.stringify(o.rank || 'Maj')};
  State.badges = []; State.garment = ${JSON.stringify(o.garment || {})}; State.hideRibbons = false; State.cadetHighestOnly = false;
  State.ribbonRackLayout = ${JSON.stringify(o.layout || '3')}; State.ribbonRackArrangement = ${JSON.stringify(o.arrangement || 'lapel')}; State.ribbonRowOverrideEnabled = false; State.ribbonRowOverride = [];
  normalizeRibbonSelections();
  for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
  for(const id of ${JSON.stringify(CHOICES.slice(0, o.ribbons == null ? 9 : o.ribbons))}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
  rebuildRibbonsFromGallery();
  return State.ribbons.length;`);
const env = {
  core, compose: b => P.composeUniform(b, store), spec: id => store.load(id), entry: id => store.entry(id), url: p => 'images/' + p, empty: () => '<svg id="empty"></svg>',
  draw: async scene => 'drawn:' + scene.title,
  build: () => run('return CAPUBUniformView.buildFromState();'),
  // The page's own function, run in the page's context (State and the engine's build are its free names), so the pictures are made from the state as the page makes it.
  buildWith: change => JSON.parse(JSON.stringify(vm.runInContext('(' + OP.stateBuildWith.toString() + ')', context)(change)))
};
const viewBox = markup => /viewBox="([^"]+)"/.exec(markup)[1];
const near = (a, b) => Math.abs(a - b) < 0.002;
const picturesOf = async (name, values) => OP.create(env).pictures(name, values).ready;
const fmtN = n => String(Math.round(n * 1000) / 1000);
// The rack's pictures are scenes of the coat and the ribbons: the test takes the scene itself where the page would draw it.
const sceneEnv = Object.assign({}, env, { draw: async (scene, pad) => ({ scene, pad }) });
const scenesOf = async (name, values) => OP.create(sceneEnv).pictures(name, values).ready;
const ribbonBoxes = scene => scene.layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l));
const same = (a, b) => a.length === b.length && a.every((d, i) => near(d.x, b[i].x) && near(d.y, b[i].y) && near(d.w, b[i].w) && near(d.h, b[i].h));
const rowsOf = scene => { const m = new Map(); ribbonBoxes(scene).forEach(r => m.set(r.y.toFixed(3), (m.get(r.y.toFixed(3)) || 0) + 1)); return [...m.keys()].sort((a, b) => a - b).map(k => m.get(k)); };
// The lapel drawn over the ribbons: the coat's foreground layer is above every ribbon and device of the scene.
const lapelAbove = scene => {
  const fg = scene.layers.find(l => l.key === 'layer:foreground' && (l.onlyGroups || []).includes('lapel-left'));
  return !!fg && scene.layers.filter(l => l.role === 'ribbon' || l.role === 'device').every(l => fg.z > l.z);
};

test('rack layout: each tile is the member\'s own ribbons on the coat, as the engine lays them for that choice (the figure\'s own layers), the lapel over them, all choices in one frame', async () => {
  // A woman's Class A coat, nine ribbons, the standard arrangement: the three widths lay three different racks.
  assert.equal(member({ gender: 'female', arrangement: 'standard' }), 9);
  const pics = await scenesOf('rackColumns', ['3', '4-left', '4-center']);
  const seen = new Set();
  for(const layout of ['3', '4-left', '4-center']){
    const pic = pics[layout];
    assert.ok(pic && pic.scene && Array.isArray(pic.scene.layers), `${layout}: a drawing of the engine's layers, not a diagram`);
    const scene = pic.scene;
    assert.ok(scene.layers.some(l => l.role === 'garment'), `${layout}: the coat`);
    assert.equal(ribbonBoxes(scene).length, 9, `${layout}: the ribbon of each, with its art`);
    assert.ok(scene.layers.filter(l => l.role === 'ribbon').every(l => /^ribbon-/.test(l.id)), `${layout}: the ribbon's own sheet, not a blank`);
    // The ribbons are where the engine laid them for that choice, as the whole drawing has them.
    const full = await P.composeUniform(env.buildWith({ ribbonRackLayout: layout }), store);
    assert.ok(same(ribbonBoxes(scene), full.layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l))), `${layout}: the same rack as the figure`);
    assert.ok(ribbonBoxes(scene).every(r => near(r.w, 1.375) && near(r.h, 0.375)), `${layout}: the ribbon's size, 1 3/8 by 3/8 in (CAPR 39-1, 11.3)`);
    assert.ok(lapelAbove(scene), `${layout}: the lapel is drawn over the ribbons (11.1.8)`);
    seen.add(JSON.stringify(ribbonBoxes(scene)));
  }
  assert.equal(seen.size, 3, 'three different racks');
  const frames = ['3', '4-left', '4-center'].map(v => JSON.stringify(pics[v].scene.bounds));
  assert.equal(new Set(frames).size, 1, 'one frame, so the choices can be compared');
  const f = pics['3'].scene.bounds;
  assert.ok(near(f.w / f.h, 1.5), 'the tile\'s own shape, 3 to 2');
  // Automatic, the lapel decides where the shortened rows go: at least two widths lay different racks there.
  member({ gender: 'female' });
  const auto = await scenesOf('rackColumns', ['3', '4-left', '4-center']);
  assert.ok(new Set(['3', '4-left', '4-center'].map(v => auto[v] && JSON.stringify(ribbonBoxes(auto[v].scene)))).size >= 2, 'the automatic arrangement lays at least two different racks');
  // Four across is four ribbons a row, three across three: the rows the engine counts.
  assert.deepEqual(rowsOf(pics['4-left'].scene).slice(1), [4, 4], 'rows of four under the one ribbon of the top row');
  assert.ok(rowsOf(pics['3'].scene).every(n => n <= 3));
  // The ribbons carry their own devices: a ribbon the member holds with clasps shows them in its tile.
  member({ gender: 'female', arrangement: 'standard' });
  run(`setRibbonSelectionFromDropdown('cap_achievment_award', 'capub_total_12', { deferRender: true }); rebuildRibbonsFromGallery(); return 1;`);
  const withDevices = await scenesOf('rackColumns', ['3', '4-left', '4-center']);
  for(const layout of ['3', '4-left', '4-center']) assert.ok(withDevices[layout].scene.layers.filter(l => l.role === 'device').length >= 3, `${layout}: the clasps of the 12th award`);
});

test('a chosen four-wide rack is drawn in full with the lapel over it, on every coat that has a rack: the lapel is above the ribbons and covers part of the rack, the automatic arrangement for the same ribbons covers none where the paragraph can keep it clear', async () => {
  const wide = { '4-left': { rackColumns: 4, rackAlign: 'outboard' }, '4-center': { rackColumns: 4 } };
  const rack = n => Array.from({ length: n }, (_, i) => ({ key: 'ribbon:r' + i, id: 'r' + i, title: 'r' + i, asset: 'ribbon-armstrong-achievement', devices: [], centered: false }));
  const buildOf = (uniform, membership, rank, gender, n, opt, extra) => Object.assign({
    uniform, gender, membership, grade: G.gradeInfo(membership, rank, {}), opt: Object.assign({ headgear: 'none' }, opt), name: { first: '', last: '', show: false },
    ribbons: rack(n), medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  const coats = [['blues_a', 'senior', 'Capt', 'male'], ['blues_a', 'senior', 'Capt', 'female'], ['blues_a', 'cadet', 'C/Capt', 'male'], ['blues_a', 'cadet', 'C/Capt', 'female'],
    ['semi_formal_usaf', 'cadet', 'C/Capt', 'male'], ['semi_formal_usaf', 'cadet', 'C/Capt', 'female']];
  const checked = [];
  for(const [uniform, membership, rank, gender] of coats){
    for(const [name, opt] of Object.entries(wide)){
      const chosen = await P.composeUniform(buildOf(uniform, membership, rank, gender, 28, Object.assign({ rackArrangement: 'standard' }, opt)), store);
      const coat = chosen.layers.find(l => l.role === 'garment');
      const lapel = (await store.load(coat.id)).landmarks.lapel_left.points;
      const ribbons = chosen.layers.filter(l => l.role === 'ribbon');
      const fg = chosen.layers.find(l => l.key === 'layer:foreground' && (l.onlyGroups || []).includes('lapel-left'));
      const covered = ribbons.filter(r => awards.coverage(r, lapel) > awards.LAPEL_COVER_TOLERANCE);
      const label = `${uniform} ${membership} ${gender} ${name}`;
      assert.ok(fg, `${label}: the lapel is redrawn over the rack`);
      assert.ok(chosen.layers.filter(l => l.role === 'ribbon' || l.role === 'device').every(l => fg.z > l.z), `${label}: the lapel is above every ribbon and device`);
      assert.ok(covered.length >= 1, `${label}: a rack tall enough to reach the lapel has a ribbon partly under it`);
      // What the lapel covers is inside the part redrawn: the clip holds the lapel where it meets the rack.
      const clip = core.polygonBounds(fg.clip);
      for(const r of covered) assert.ok(r.x + r.w > clip.x && r.x < clip.x + clip.w && r.y + r.h > clip.y && r.y < clip.y + clip.h, `${label}: ${r.key} is within the redrawn lapel`);
      assert.deepEqual(ribbons.map(r => r.key).sort(), rack(28).map(r => r.key).sort(), `${label}: every ribbon drawn once (the order is tests/ribbon-rack-rule.test.cjs's)`);
      // The automatic arrangement keeps the lapel clear where the paragraph lets it (a man's coat); a woman's four across cannot be kept clear (the bottom row is covered).
      if(gender === 'male'){
        const auto = await P.composeUniform(buildOf(uniform, membership, rank, gender, 28, Object.assign({ rackArrangement: 'lapel' }, opt)), store);
        const none = auto.layers.filter(l => l.role === 'ribbon').filter(r => awards.coverage(r, lapel) > awards.LAPEL_COVER_TOLERANCE);
        assert.equal(none.length, 0, `${label}: the automatic arrangement covers no ribbon`);
      }
      checked.push(label);
    }
  }
  assert.equal(checked.length, 12);
  // The Honor Guard Uniform is the cadet's Class A coat with its own dress: the same rack, the same lapel.
  const guard = await P.composeUniform(buildOf('blues_a', 'cadet', 'C/Capt', 'male', 28, { rackArrangement: 'standard', rackColumns: 4, rackAlign: 'outboard' }, { ceremonial: { role: 'guard', chinstrap: 'up' } }), store);
  assert.ok(lapelAbove(guard), 'the Honor Guard Uniform: the lapel is over the rack');
});

test('upper-row arrangement: the standard and the automatic arrangement as the engine lays them against the lapel, the lapel over both; not offered where they are the same rack', async () => {
  member({ gender: 'female' });
  const pics = await scenesOf('rackArrangement', ['standard', 'lapel']);
  assert.ok(pics.standard && pics.standard.scene && pics.lapel && pics.lapel.scene);
  assert.ok(!same(ribbonBoxes(pics.standard.scene), ribbonBoxes(pics.lapel.scene)), 'two different racks');
  for(const arrangement of ['standard', 'lapel']){
    const full = await P.composeUniform(env.buildWith({ ribbonRackArrangement: arrangement }), store);
    assert.ok(same(ribbonBoxes(pics[arrangement].scene), full.layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l))), `${arrangement}: the rack the figure has`);
    assert.ok(lapelAbove(pics[arrangement].scene), `${arrangement}: the lapel is over the ribbons`);
  }
  // A woman's four across: the lapel covers even the bottom row, which 11.2.7 does not let be shortened, so the automatic arrangement is the regular rack there and there is
  // nothing to pick between (tests/ribbon-rack-rule.test.cjs); her three across has the choice.
  member({ gender: 'female', layout: '4-left' });
  assert.deepEqual(await picturesOf('rackArrangement', ['standard', 'lapel']), { standard: false, lapel: false });
  member({ gender: 'female', layout: '3' });
  assert.ok((await scenesOf('rackArrangement', ['standard', 'lapel'])).lapel);
  // A man's nine ribbons clear the lapel either way: the two are one rack, and there is nothing to pick between.
  member({ gender: 'male' });
  assert.deepEqual(await picturesOf('rackArrangement', ['standard', 'lapel']), { standard: false, lapel: false });
});

test('of the choices that lay the same rack only one is offered: the one the member has now, else the first; fewer than two racks, none', async () => {
  const layer = (i, x) => ({ type: 'asset', role: 'ribbon', id: 'ribbon-x', key: 'ribbon:' + i, x: x + i * 1.375, y: 0, w: 1.375, h: 0.375, rotate: 0, origin: { x: 0, y: 0 }, z: 12 });
  const fake = (rackColumns, rackAlign) => ({ uniform: 'blues_a', gender: 'male', membership: 'senior', ribbons: [{ key: 'ribbon:0' }, { key: 'ribbon:1' }], opt: { rackColumns, rackAlign } });
  // '3' and '4-center' lay one rack, '4-left' another.
  const compose = b => ({ layers: [{ type: 'asset', role: 'garment', id: 'coat', x: 0, y: 0, w: 20, h: 20, rotate: 0, origin: { x: 0, y: 0 }, z: 1 }, ...[0, 1].map(i => layer(i, b.opt.rackAlign === 'outboard' ? 5 : 3))] });
  const make = now => OP.create({
    core, compose: async b => compose(b), draw: async (scene, pad) => ({ scene, pad }), build: () => fake(now === '3' ? 3 : 4, now === '4-left' ? 'outboard' : undefined),
    buildWith: over => { const w = over.ribbonRackLayout; return fake(w === '3' ? 3 : 4, w === '4-left' ? 'outboard' : undefined); }, empty: () => ''
  });
  const offered = async now => { const got = await make(now).pictures('rackColumns', ['3', '4-left', '4-center']).ready; return Object.fromEntries(Object.entries(got).map(([k, v]) => [k, !!v])); };
  assert.deepEqual(await offered('4-center'), { '3': false, '4-left': true, '4-center': true }, 'the member has four centered: three lays the same, so it is the one left out');
  assert.deepEqual(await offered('3'), { '3': true, '4-left': true, '4-center': false }, 'the member has three: four centered lays the same');
  assert.deepEqual(await offered('4-left'), { '3': true, '4-left': true, '4-center': false }, 'the first of the two that lay one rack');
});

test('the rack\'s choices are not offered with no ribbon worn, and not while the member\'s own rows are in force; the cadet semi-formal coat has them too', async () => {
  member({ ribbons: 0, gender: 'female' });
  assert.deepEqual(await picturesOf('rackColumns', ['3', '4-left', '4-center']), { '3': false, '4-left': false, '4-center': false });
  // Fewer than four ribbons lay the same single row of three whatever the width.
  member({ ribbons: 3 });
  assert.deepEqual(await picturesOf('rackColumns', ['3', '4-left', '4-center']), { '3': false, '4-left': false, '4-center': false });
  // Rows the member set themselves, where they are a layout 11.2.7 allows, are theirs: the engine lays none of its own. Any other rows are not in force (the page falls back to the
  // width and arrangement picked), so the choices are offered.
  member({ gender: 'female' });
  run('State.ribbonRowOverrideEnabled = true; State.ribbonRowOverride = [1, 4, 4]; return 1;');
  assert.deepEqual(await picturesOf('rackColumns', ['3', '4-left', '4-center']), { '3': false, '4-left': false, '4-center': false });
  run('State.ribbonRowOverrideEnabled = true; State.ribbonRowOverride = [1, 2, 3, 3]; return 1;');
  assert.ok((await picturesOf('rackColumns', ['3', '4-left', '4-center']))['4-left']);
  run('State.ribbonRowOverrideEnabled = false; State.ribbonRowOverride = []; return 1;');
  const semi = member({ membership: 'cadet', uniform: 'semi_formal_usaf', rank: 'C/Capt', gender: 'female', ribbons: 12 });
  assert.ok(semi >= 5, 'the cadet semi-formal coat with a rack of its own');
  const pics = await scenesOf('rackColumns', ['3', '4-left', '4-center']);
  assert.ok(['3', '4-left', '4-center'].every(v => pics[v] && pics[v].scene && lapelAbove(pics[v].scene)), 'a picture of each, the lapel over the ribbons');
});

test('the cache keys follow what the pictures are made from: the cut, the ribbons, the rows and the other choice; not the choice the picture is of', () => {
  member({ gender: 'female' });
  const key = (name, over) => OP.RECIPES[name].key(over ? env.buildWith(over) : env.build());
  assert.deepEqual(key('rackColumns'), key('rackColumns', { ribbonRackLayout: '4-left' }), 'the columns picture shows every width, whichever the member has');
  assert.notDeepEqual(key('rackColumns'), key('rackColumns', { ribbonRackArrangement: 'standard' }), 'it is made with the member\'s arrangement');
  assert.deepEqual(key('rackArrangement'), key('rackArrangement', { ribbonRackArrangement: 'standard' }));
  assert.notDeepEqual(key('rackArrangement'), key('rackArrangement', { ribbonRackLayout: '4-center' }));
  const before = key('rackColumns');
  member({ gender: 'female', ribbons: 10 });
  assert.notDeepEqual(key('rackColumns'), before, 'another rack');
  member({ gender: 'male' });
  assert.notDeepEqual(key('rackColumns'), before, 'another cut');
});

// ---- miniature medals: blank medals, mounted as the engine mounts them ------------------------------------------------------------------------------

const medalsOf = o => member(Object.assign({ uniform: 'mess_dress' }, o));
const partsOf = markup => ({
  drapes: [...markup.matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1].split(' ').map(p => p.split(',').map(Number))),
  bodies: [...markup.matchAll(/<ellipse cx="([-\d.]+)" cy="([-\d.]+)" rx="([-\d.]+)" ry="([-\d.]+)"/g)].map(m => ({ x: +m[1] - +m[3], y: +m[2] - +m[4], w: 2 * +m[3], h: 2 * +m[4] }))
});

test('miniature medals: a blank drape and a blank body for every medal the member wears, where the engine hangs it for that style, in one frame', async () => {
  for(const uniform of ['mess_dress', 'semi_formal']){
    assert.equal(medalsOf({ uniform, ribbons: 12 }), 12);
    const pics = await picturesOf('miniMount', ['mounting', 'holding']);
    if(uniform === 'semi_formal'){
      // The blazer's lapel (CAPR 39-1 11.2.8: nothing of the rack lies under it) arranges the rows by the same rule whichever way the medals are mounted: the two hang alike, so the choice is not offered.
      assert.deepEqual(pics, { mounting: false, holding: false }, 'the lapel gives both mountings the same rows');
      continue;
    }
    assert.equal(typeof pics.mounting, 'string', uniform);
    assert.equal(viewBox(pics.mounting), viewBox(pics.holding), `${uniform}: one frame`);
    for(const style of ['mounting', 'holding']){
      const { drapes, bodies } = partsOf(pics[style]);
      const full = await P.composeUniform(env.buildWith({ miniMountStyle: style }), store);
      const drapeLayers = full.layers.filter(l => l.role === 'mini-drape'), bodyLayers = full.layers.filter(l => l.role === 'mini-medal');
      assert.equal(drapes.length, drapeLayers.length, `${uniform} ${style}: a drape for each`);
      assert.equal(bodies.length, bodyLayers.length, `${uniform} ${style}: a body for each`);
      assert.ok(drapes.length >= 12);
      for(const l of drapeLayers){
        const poly = l.clip.map(q => [+fmtN(q.x), +fmtN(q.y)]);
        assert.ok(drapes.some(d => d.length === poly.length && d.every((q, i) => near(q[0], poly[i][0]) && near(q[1], poly[i][1]))), `${uniform} ${style}: the drape cut to its V point where the engine hangs it`);
      }
      for(const l of bodyLayers){ const b = core.layerBounds(l); assert.ok(bodies.some(x => near(x.x, b.x) && near(x.y, b.y) && near(x.w, b.w) && near(x.h, b.h)), `${uniform} ${style}: a body at ${JSON.stringify(b)}`); }
    }
    // Rows of four (the last row the full one) against rows of up to seven overlapped: different racks.
    const rows = markup => new Set(partsOf(markup).bodies.map(b => b.y.toFixed(2))).size;
    assert.ok(rows(pics.mounting) > rows(pics.holding), `${uniform}: more rows mounted than held`);
  }
});

test('miniature medals: not offered where the two ways hang alike (four or fewer medals, or eight) or with none', async () => {
  for(const n of [0, 1, 4]){
    medalsOf({ ribbons: n });
    assert.deepEqual(await picturesOf('miniMount', ['mounting', 'holding']), { mounting: false, holding: false }, `${n} medals`);
  }
  medalsOf({ ribbons: 8 });
  assert.deepEqual(await picturesOf('miniMount', ['mounting', 'holding']), { mounting: false, holding: false }, 'eight: two rows of four either way');
  medalsOf({ ribbons: 5 });
  assert.equal(typeof (await picturesOf('miniMount', ['mounting', 'holding'])).holding, 'string', 'five differ');
  // The cache follows the medals and the cut, not the style the picture is of.
  medalsOf({ ribbons: 12 });
  const key = over => OP.RECIPES.miniMount.key(over ? env.buildWith(over) : env.build());
  assert.deepEqual(key(), key({ miniMountStyle: 'holding' }));
  const before = key();
  medalsOf({ ribbons: 11 });
  assert.notDeepEqual(key(), before);
});

// ---- the command insignia pin -----------------------------------------------------------------------------------------------------------------------------------

const withPin = (uniform, rank, level) => run(`
  State.membership = 'senior'; State.uniform = ${JSON.stringify(uniform)}; State.gender = 'male'; State.rank = ${JSON.stringify(rank || 'Capt')}; State.garment = {};
  State.badgeSelections = {}; State.badges = ${JSON.stringify(level ? [`${level}_commander_badge`] : [])};
  for(const id of State.badges) State.badgeSelections[id] = { checked: true };
  State.commandInsignia = { graduatedCommander: false }; return State.badges.length;`);
const pinKey = (scene, id) => scene.layers.filter(l => l.role === 'badge' && String(l.key).startsWith('badge:' + id));
const boxOf = layer => core.layerBounds(layer);

test('command insignia pin: not worn is the empty mark; current and graduated are the uniform as the engine draws each, in a window centred on the pin (over the name tag, then under it)', async () => {
  withPin('blues_a', 'Capt', 'squadron');
  const pics = await OP.create(env).pictures('commandWorn', ['none', 'current', 'graduated']).ready;
  assert.equal(pics.none, '<svg id="empty"></svg>');
  for(const [choice, graduated] of [['current', false], ['graduated', true]]){
    // The picture is a scene (it is drawn by the page); here the recipe itself.
    const made = await OP.RECIPES.commandWorn.make(env, env.build(), [choice]);
    const scene = made[choice].scene;
    const full = await P.composeUniform(env.buildWith({ commandInsignia: { graduatedCommander: graduated } }), store);
    const pin = pinKey(full, 'squadron_commander_badge');
    assert.equal(pin.length, 1);
    const drawn = pinKey({ layers: scene.layers }, 'squadron_commander_badge');
    assert.equal(drawn.length, 1, `${choice}: the pin is in the picture`);
    for(const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(drawn[0][k] - pin[0][k]) < 1e-6, `${choice}: the pin where the engine puts it (${k})`);
    const b = boxOf(pin[0]), f = scene.bounds;
    assert.ok(near(f.x + f.w / 2, b.x + b.w / 2) && near(f.y + f.h / 2, b.y + b.h / 2), `${choice}: centred on the pin`);
    assert.ok(f.w > 4 * b.w && f.h > 3 * b.h, `${choice}: a window that shows what the pin is worn over or under`);
    assert.ok(scene.layers.some(l => l.role === 'garment'), `${choice}: on the garment`);
  }
  const cur = await OP.RECIPES.commandWorn.make(env, env.build(), ['current']), grad = await OP.RECIPES.commandWorn.make(env, env.build(), ['graduated']);
  const y = made => { const l = pinKey({ layers: made.scene.layers }, 'squadron_commander_badge')[0]; return l.y; };
  assert.ok(y(cur.current) < y(grad.graduated), 'a current commander\'s pin is over the name tag, a graduated commander\'s under it (CAPR 39-1, 10.2.5)');
});

test('command insignia pin: a way the uniform does not draw is not offered (no graduated pin on the flight suit), and the pin sewn on the left sleeve is found by its whole piece', async () => {
  withPin('flight_suit', 'Capt', 'squadron');
  const fs = await OP.create(env).pictures('commandWorn', ['none', 'current', 'graduated']).ready;
  assert.equal(typeof fs.current === 'string', true);
  assert.equal(fs.graduated, false, 'the flight suit has no graduated pin');
  withPin('ocp', 'Capt', 'squadron');
  const made = await OP.RECIPES.commandWorn.make(env, env.build(), ['current', 'graduated']);
  const full = await P.composeUniform(env.buildWith({ commandInsignia: { graduatedCommander: true } }), store);
  const pieces = pinKey(full, 'squadron_commander_badge');
  assert.equal(pieces.length, 2, 'the whole pin and its edge piece lie apart');
  const main = pieces.sort((a, b) => b.w * b.h - a.w * a.h)[0], f = made.graduated.scene.bounds;
  assert.ok(near(f.x + f.w / 2, main.x + main.w / 2) && near(f.y + f.h / 2, main.y + main.h / 2), 'the window is centred on the whole piece, so the pin is in it');
});

test('command insignia pin: the insignia of each level is the art the engine draws for it on this uniform, at its own size, in one frame', async () => {
  for(const [uniform, art] of [['blues_a', { squadron: 'squadron-commander', group: 'group-commander' }], ['ocp', { squadron: 'squadron-commander-field', group: 'group-commander-field' }]]){
    withPin(uniform, 'Capt', 'squadron');
    const made = await OP.RECIPES.commandLevel.make(env, env.build(), ['squadron', 'group']);
    assert.deepEqual(made.squadron.scene.bounds, made.group.scene.bounds, `${uniform}: one frame`);
    for(const level of ['squadron', 'group']){
      const [layer] = made[level].scene.layers;
      assert.equal(layer.id, art[level], `${uniform} ${level}`);
      const spec = await store.load(art[level]);
      assert.ok(Math.abs(layer.w - spec.w) < 1e-6 && Math.abs(layer.h - spec.h) < 1e-6, `${uniform} ${level}: its own size`);
      assert.equal(made[level].scene.layers.length, 1, 'the insignia alone');
    }
  }
  // The level's badge is the page's own (js/workspace-ui.js COMMAND_PINS).
  const ui = read('js/workspace-ui.js');
  assert.match(ui, /const COMMAND_PINS=\{squadron:'squadron_commander_badge',group:'group_commander_badge'\};/);
  withPin('polo', 'Capt', 'squadron');
  assert.deepEqual(await picturesOf('commandLevel', ['squadron', 'group']), { squadron: null, group: null }, 'a uniform that wears neither pin has none to show: the names alone');
});

// ---- the page's side: the picker beside the control ------------------------------------------------------------------------------------

// The controls and their hosts in the small DOM, the picker script and a stand-in for the pictures that records what it was asked.
function page(state, pictures, before){
  const doc = createDocument();
  const mk = (tag, id, parent) => { const e = doc.createElement(tag); if(id) e.id = id; (parent || doc.body).append(e); return e; };
  const sources = {};
  const select = (id, values, now, parent) => {
    const host = mk('div', id + 'Picker', parent); host.hidden = true;
    const sel = mk('select', id, parent);
    values.forEach(v => { const o = doc.createElement('option'); o.setAttribute('value', v); o.value = v; sel.append(o); });
    sel.value = now;
    sel.changes = [];
    sel.addEventListener('change', () => sel.changes.push(sel.value));
    sources[id] = { host, select: sel };
    return sel;
  };
  select('ribbonRackColumns', ['3', '4-left', '4-center'], '3');
  select('ribbonRackArrangement', ['standard', 'lapel'], 'lapel');
  // The miniature medals' control sits in a label the page hides by a class when the uniform wears none.
  const label = mk('label'); label.className = 'fieldNote segmentedSource';
  select('miniMountStyle', ['mounting', 'holding'], 'mounting', label);
  sources.miniMountStyle.label = label;
  sources.miniMountStyle.host.remove(); doc.body.append(sources.miniMountStyle.host);
  // The command pin: a row with its three radios and, in a wrap the page hides when no pin is worn, the level.
  const row = mk('div', 'commandInsigniaRow');
  const head = mk('span', 'commandInsigniaLabel', row); head.textContent = 'Command insignia pin';
  const host = mk('div', 'commandInsigniaChoicePicker', row); host.hidden = true;
  const list = mk('div', null, row); list.className = 'badgeChooserList segmentedSource';
  const radios = ['none', 'current', 'graduated'].map(v => { const i = mk('input', null, list); i.setAttribute('type', 'radio'); i.value = v; i.checked = v === 'none'; i.disabled = false; return i; });
  row.changes = [];
  row.addEventListener('change', e => { row.changes.push(e.target.value); radios.forEach(r => { r.checked = r === e.target; }); });
  const wrap = mk('div', 'commandInsigniaLevelWrap', row); wrap.className = 'commandRowLevel';
  select('commandInsigniaLevel', ['squadron', 'group'], 'squadron', wrap);
  sources.commandInsigniaChoice = { host, row, radios, list };
  // Two boxes, each in a row the page hides by a class, with the host before the box.
  for(const id of ['cadetHighestOnly', 'removeRibbons']){
    const rowEl = mk('div', id + 'Row');
    const host = mk('div', id + 'Picker', rowEl); host.hidden = true;
    const box = mk('input', id, rowEl); box.setAttribute('type', 'checkbox'); box.checked = false; box.changes = [];
    box.addEventListener('change', () => box.changes.push(box.checked));
    sources[id] = { host, box, row: rowEl };
  }
  if(before) before(sources);
  const asked = [];
  const sandbox = {
    State: Object.assign({ uniform: 'blues_a', gender: 'male', rank: 'Capt', ribbons: [], badges: [], ribbonRackLayout: '3', ribbonRackArrangement: 'lapel' }, state), document: doc, console,
    Event: function(type, init){ this.type = type; Object.assign(this, init); },
    CAPUBOptionPictures: { pictures(name, values){ asked.push(name); return pictures(name, values); } }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/item-pickers.js'), sandbox);
  // The page's drawing: every listener of it runs, then (as the picker script waits for) the rest of the turn.
  const rendered = async () => { (doc.listeners['capub:rendered'] || []).forEach(f => f()); await Promise.resolve(); await Promise.resolve(); };
  return { doc, sandbox, sources, asked, rendered, tiles: id => sources[id].host.querySelectorAll('[role="radio"]') };
}
const settled = now => ({ now, ready: Promise.resolve(now), settled: true });
const SQUARE = '<svg viewBox="0 0 4 3"></svg>';
const all = values => Object.fromEntries(values.map(v => [v, SQUARE]));
const shownAll = (name, values) => settled(all(values));

test('a picker is drawn from the control\'s own choices, in its order, with the words of each, and a press sets the control and gives the change the page listens to', async () => {
  const p = page({}, shownAll);
  await p.rendered();
  const cols = p.tiles('ribbonRackColumns');
  assert.deepEqual(cols.map(t => t.querySelector('.vpLabel').textContent), ['3 across, centered', '4 across, left edge on the pocket', '4 across, centered on the pocket']);
  assert.deepEqual(cols.map(t => t.dataset.value), ['3', '4-left', '4-center']);
  assert.deepEqual(cols.map(t => t.getAttribute('aria-checked')), ['true', 'false', 'false'], 'the control\'s value is the one picked');
  assert.equal(p.sources.ribbonRackColumns.host.hidden, false);
  assert.equal(p.sources.ribbonRackColumns.host.querySelector('.vpLegend').textContent, 'Ribbon rack layout');
  assert.deepEqual(p.tiles('ribbonRackArrangement').map(t => t.querySelector('.vpLabel').textContent), ['Standard, centered top row', 'Automatic, clear of the lapel']);
  cols[1].click();
  assert.equal(p.sources.ribbonRackColumns.select.value, '4-left');
  assert.deepEqual(p.sources.ribbonRackColumns.select.changes, ['4-left'], 'one change, as a press on the list would give');
  // The keyboard works through the picker as it does everywhere: the arrow keys move, Enter picks.
  const again = p.tiles('ribbonRackColumns');
  again[1].focus();
  again[1].dispatchEvent(keydown('ArrowRight'));
  p.doc.activeElement.dispatchEvent(keydown('Enter'));
  assert.equal(p.sources.ribbonRackColumns.select.value, '4-center');
});

test('the picker follows the control when the page sets it (a saved setup, undo): after the next drawing it shows what the control holds', async () => {
  const p = page({}, shownAll);
  await p.rendered();
  p.sources.ribbonRackColumns.select.value = '4-center';
  await p.rendered();
  assert.deepEqual(p.tiles('ribbonRackColumns').map(t => t.getAttribute('aria-checked')), ['false', 'false', 'true']);
  assert.deepEqual(p.sources.ribbonRackColumns.select.changes, [], 'the page setting it is not a change of the member\'s');
});

test('a choice that does not apply is not offered, and a group with nothing to pick between is hidden, not greyed; it comes back when it applies', async () => {
  let apply = false;
  const p = page({}, (name, values) => settled(Object.fromEntries(values.map(v => [v, apply ? SQUARE : false]))));
  await p.rendered();
  assert.equal(p.sources.ribbonRackColumns.host.hidden, true, 'nothing to pick between: hidden');
  assert.equal(p.sources.ribbonRackArrangement.host.hidden, true);
  apply = true;
  p.sandbox.State.ribbons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  await p.rendered();
  assert.equal(p.sources.ribbonRackColumns.host.hidden, false);
  assert.equal(p.tiles('ribbonRackColumns').length, 3);
  // One of three does not apply: the other two are offered.
  const q = page({}, (name, values) => settled(Object.fromEntries(values.map((v, i) => [v, i === 1 && values.length === 3 ? false : SQUARE]))));
  await q.rendered();
  assert.deepEqual(q.tiles('ribbonRackColumns').map(t => t.dataset.value), ['3', '4-center']);
  // ...unless it is the one the control holds: the member's own choice is always there.
  q.sources.ribbonRackColumns.select.value = '4-left';
  q.sandbox.State.ribbons = [{ id: 'x' }];
  await q.rendered();
  assert.deepEqual(q.tiles('ribbonRackColumns').map(t => t.dataset.value), ['3', '4-left', '4-center']);
  // A control the page has disabled (the cut or the uniform has no choice) offers none.
  const r = page({}, shownAll);
  r.sources.ribbonRackColumns.select.disabled = true;
  await r.rendered();
  assert.equal(r.sources.ribbonRackColumns.host.hidden, true);
});

test('the pictures are asked for again only when what they are made from has changed; a picture still being made keeps the host out of sight until it is there', async () => {
  let release;
  const slow = new Promise(res => { release = res; });
  const p = page({}, (name, values) => ({ now: {}, ready: slow.then(() => all(values)), settled: false }));
  assert.equal(p.sources.ribbonRackColumns.host.hidden, true, 'nothing to show yet: the host is not drawn as a row of blank boxes');
  release();
  await slow;
  await Promise.resolve(); await Promise.resolve();
  assert.equal(p.sources.ribbonRackColumns.host.hidden, false, 'drawn when the pictures arrive');
  const asked = p.asked.length;
  await p.rendered(); await p.rendered();
  assert.equal(p.asked.length, asked, 'nothing changed, nothing asked');
  p.sandbox.State.ribbons = [{ id: 'a' }];
  await p.rendered();
  assert.ok(p.asked.length > asked, 'the ribbons changed');
  const after = p.asked.length, columns = p.asked.filter(x => x === 'rackColumns').length;
  p.sandbox.State.ribbonRackLayout = '4-left';
  await p.rendered();
  assert.equal(p.asked.filter(x => x === 'rackColumns').length, columns, 'the width is the choice the columns picture is of: not asked again');
  assert.ok(p.asked.length > after, 'but the arrangement picture is made with it');
});

test('the miniature medals\' picker follows the class the page puts on its control: hidden where the uniform wears none, drawn where it does', async () => {
  const p = page({ uniform: 'blues_a' }, shownAll, sources => sources.miniMountStyle.label.classList.add('hidden'));
  await p.rendered();
  assert.equal(p.sources.miniMountStyle.host.hidden, true, 'a uniform with no medals');
  assert.equal(p.asked.includes('miniMount'), false, 'and no picture made for it');
  p.sources.miniMountStyle.label.classList.remove('hidden');
  p.sandbox.State.uniform = 'mess_dress';
  await p.rendered();
  assert.equal(p.sources.miniMountStyle.host.hidden, false);
  assert.deepEqual(p.tiles('miniMountStyle').map(t => t.querySelector('.vpLabel').textContent), ['Mounting bars, 4 per row (up to 24)', 'Holding bars, custom overlap (up to 28)']);
  p.tiles('miniMountStyle')[1].click();
  assert.equal(p.sources.miniMountStyle.select.value, 'holding');
  assert.deepEqual(p.sources.miniMountStyle.select.changes, ['holding']);
  // Hidden again with the control: it stays so when nothing else changed, and comes back at once when the class goes.
  p.sources.miniMountStyle.label.classList.add('hidden');
  await p.rendered();
  assert.equal(p.sources.miniMountStyle.host.hidden, true);
  p.sources.miniMountStyle.label.classList.remove('hidden');
  await p.rendered();
  assert.equal(p.sources.miniMountStyle.host.hidden, false, 'with the picker it had');
});

test('the command pin\'s three radios are one picker; a press checks the radio and gives the change the row listens to; a radio the page disabled is not offered unless it is checked', async () => {
  const p = page({}, shownAll);
  await p.rendered();
  const { host, row, radios } = p.sources.commandInsigniaChoice;
  assert.equal(host.hidden, false);
  assert.deepEqual(p.tiles('commandInsigniaChoice').map(t => t.querySelector('.vpLabel').textContent), ['Not worn', 'Current commander', 'Graduated commander']);
  assert.equal(host.querySelector('.vpLegend'), null, 'the row\'s own line names it');
  const group = host.querySelector('[role="radiogroup"]');
  assert.equal(group.getAttribute('aria-labelledby'), 'commandInsigniaLabel', 'named by the line above it');
  assert.equal(group.getAttribute('aria-label'), null);
  p.tiles('commandInsigniaChoice')[2].click();
  assert.deepEqual(row.changes, ['graduated']);
  assert.equal(radios[2].checked, true);
  // The page (a grade that may not wear the pin) disables two: only "Not worn" is left and there is nothing to pick between.
  radios[1].disabled = true; radios[2].disabled = true; radios[2].checked = false; radios[0].checked = true;
  await p.rendered();
  assert.equal(host.hidden, true);
  // A pin already worn stays offered with its own choice, though the grade no longer allows a new one.
  radios[1].checked = true; radios[0].checked = false;
  await p.rendered();
  assert.equal(host.hidden, false);
  assert.deepEqual(p.tiles('commandInsigniaChoice').map(t => t.dataset.value), ['none', 'current']);
});

test('the command level is set by a press, and its picker is the wrap\'s: hidden with it when no pin is worn', async () => {
  const p = page({}, shownAll);
  await p.rendered();
  const lvl = p.sources.commandInsigniaLevel;
  assert.deepEqual(p.tiles('commandInsigniaLevel').map(t => t.querySelector('.vpLabel').textContent), ['Squadron commander', 'Group commander']);
  assert.equal(lvl.host.querySelector('.vpLegend').textContent, 'Command held');
  p.tiles('commandInsigniaLevel')[1].click();
  assert.equal(lvl.select.value, 'group');
  assert.deepEqual(lvl.select.changes, ['group']);
});

test('the pictures of the Items step are made by recipes of js/option-pictures.js, one for each picker, and a recipe has the cache key the pictures depend on', () => {
  const p = page({}, shownAll);
  for(const def of p.sandbox.CAPUBItemPickers.PICKERS){
    assert.ok(OP.RECIPES[def.recipe], `${def.id}: the recipe ${def.recipe}`);
    assert.ok(Object.keys(def.labels).length >= 2, `${def.id}: the words of each choice`);
    assert.ok(def.deps.length, `${def.id}: what it depends on`);
  }
});

test('a box is a pair of pictures, without and with: a press checks or unchecks the box and gives the change the page listens to; the notes are those of the choice picked', async () => {
  const p = page({ membership: 'cadet' }, shownAll);
  await p.rendered();
  for(const [id, labels] of [['cadetHighestOnly', ['All achievement ribbons', 'Highest only']], ['removeRibbons', ['Ribbons worn', 'No ribbons']]]){
    const { host, box } = p.sources[id];
    assert.equal(host.hidden, false, id);
    assert.deepEqual(p.tiles(id).map(t => t.querySelector('.vpLabel').textContent), labels);
    assert.deepEqual(p.tiles(id).map(t => t.getAttribute('aria-checked')), ['true', 'false'], 'unchecked: without');
    p.tiles(id)[1].click();
    assert.equal(box.checked, true, `${id}: checked`);
    assert.deepEqual(box.changes, [true], `${id}: one change`);
    assert.match(host.querySelector('.vpNote').textContent, /^(Only the highest cadet achievement ribbon is worn|Ribbons are optional on this shirt)/);
    p.tiles(id)[0].click();
    assert.equal(box.checked, false);
    assert.deepEqual(box.changes, [true, false]);
  }
  // The page sets the box (a saved setup, undo): the picker follows after the next drawing.
  p.sources.removeRibbons.box.checked = true;
  await p.rendered();
  assert.deepEqual(p.tiles('removeRibbons').map(t => t.getAttribute('aria-checked')), ['false', 'true']);
  // Nothing to pick between (the same rack with and without): hidden with it, not greyed.
  const same = page({ membership: 'cadet' }, (name, values) => settled(Object.fromEntries(values.map(v => [v, name === 'shortStack' ? false : SQUARE]))));
  await same.rendered();
  assert.equal(same.sources.cadetHighestOnly.host.hidden, true);
  assert.equal(same.sources.removeRibbons.host.hidden, false);
});

test('the boxes\' rows stay the page\'s to show and hide: the hosts are inside them', () => {
  const html = read('index.html');
  assert.match(html, /<div id="cadetHighestOnlyRow" class="hidden">\s*<div id="cadetHighestOnlyPicker" class="mt-8" hidden><\/div>\s*<label class="fieldNote optionWithHint segmentedSource" aria-hidden="true">\s*<input type="checkbox" id="cadetHighestOnly" tabindex="-1">/);
  assert.match(html, /<div id="removeRibbonsRow" class="hidden">\s*<div id="removeRibbonsPicker" class="mt-8" hidden><\/div>\s*<label class="fieldNote optionWithHint segmentedSource" aria-hidden="true">\s*<input type="checkbox" id="removeRibbons" tabindex="-1">/);
});

test('Short Stack: the member\'s own ribbons with every cadet achievement ribbon and with only the highest, the page listing them again with the box as each picture shows it', async () => {
  const set = (on, ids) => run(`
    State.membership = 'cadet'; State.uniform = 'blues_a'; State.gender = 'male'; State.rank = 'C/Capt'; State.badges = []; State.garment = {}; State.hideRibbons = false; State.cadetHighestOnly = ${on};
    normalizeRibbonSelections(); for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
    for(const id of ${JSON.stringify(ids)}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
    rebuildRibbonsFromGallery(); return State.ribbons.map(r => r.id);`);
  const achievements = ['armstrong_achievement', 'goddard_achievement', 'doolittle_achievement', 'mitchell_award', 'earhart_award'];
  // The box is off: the state lists every ribbon. The picture "with" lists them as the box on lists them, and the state is as it was afterwards.
  assert.equal(set(false, achievements).length, 5);
  let pics = await OP.RECIPES.shortStack.make(env, env.build(), ['off', 'on']);
  assert.equal(pics.off.scene.layers.filter(l => l.role === 'ribbon').length, 5);
  assert.equal(pics.on.scene.layers.filter(l => l.role === 'ribbon').length, 1, 'only the highest');
  assert.deepEqual(pics.off.scene.bounds, pics.on.scene.bounds, 'one frame');
  assert.equal(run('return [State.cadetHighestOnly, State.ribbons.length];').join(), 'false,5', 'the state is put back');
  // The box is on: the state lists one ribbon; the picture "without" still shows all five.
  assert.equal(set(true, achievements).length, 1);
  pics = await OP.RECIPES.shortStack.make(env, env.build(), ['off', 'on']);
  assert.equal(pics.off.scene.layers.filter(l => l.role === 'ribbon').length, 5, 'the ribbons the box leaves out are shown without it');
  assert.equal(pics.on.scene.layers.filter(l => l.role === 'ribbon').length, 1);
  assert.equal(run('return [State.cadetHighestOnly, State.ribbons.length];').join(), 'true,1');
  // One achievement ribbon only: the box changes nothing, so it is not offered.
  set(false, ['earhart_award']);
  assert.deepEqual(await OP.create(env).pictures('shortStack', ['off', 'on']).ready, { off: false, on: false });
});

test('Short Stack follows the rack layout the member chose: each tile is the engine\'s rack for that layout with every achievement ribbon and with the highest only, and changes with the layout and the ribbons', async () => {
  const achievements = ['armstrong_achievement', 'goddard_achievement', 'doolittle_achievement', 'mitchell_award', 'earhart_award'];
  const others = ['community_service_ribbon', 'cap_leadership_ribbon', 'cap_membership_ribbon', 'lifesaving_award', 'unit_citation_award', 'cap_gill_robb_wilson_ribbon', 'cap_paul_e_garber_ribbon'];
  const set = (o, ids) => run(`
    State.membership = 'cadet'; State.uniform = 'blues_a'; State.gender = ${JSON.stringify(o.gender || 'male')}; State.rank = 'C/Capt'; State.badges = []; State.garment = {}; State.hideRibbons = false; State.cadetHighestOnly = ${!!o.on};
    State.ribbonRackLayout = ${JSON.stringify(o.layout || '3')}; State.ribbonRackArrangement = ${JSON.stringify(o.arrangement || 'standard')}; State.ribbonRowOverrideEnabled = false; State.ribbonRowOverride = [];
    normalizeRibbonSelections(); for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
    for(const id of ${JSON.stringify(ids)}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
    rebuildRibbonsFromGallery(); return State.ribbons.length;`);
  const ids = [...achievements, ...others.slice(0, 5)];
  const tiles = async o => { set(o, ids); return OP.RECIPES.shortStack.make(env, env.build(), ['off', 'on']); };
  const boxes = scene => scene.layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l));
  const rowCounts = scene => { const m = new Map(); boxes(scene).forEach(r => m.set(r.y.toFixed(3), (m.get(r.y.toFixed(3)) || 0) + 1)); return [...m.keys()].sort((a, b) => a - b).map(k => m.get(k)); };
  const rackFor = async (over) => (await P.composeUniform(env.buildWith(over), store)).layers.filter(l => l.role === 'ribbon').map(l => core.layerBounds(l));
  const results = {};
  for(const layout of ['3', '4-left']){
    const total = set({ layout }, ids);
    assert.ok(total >= 8, 'a rack with the five achievement ribbons and others');
    const pics = await OP.RECIPES.shortStack.make(env, env.build(), ['off', 'on']);
    results[layout] = pics;
    // Each tile is the rack the engine lays in this layout for those ribbons, and the coat's lapel is over it.
    assert.ok(same(boxes(pics.off.scene), await rackFor({ cadetHighestOnly: false })), `${layout}: every achievement ribbon, as the figure has it`);
    assert.ok(same(boxes(pics.on.scene), await rackFor({ cadetHighestOnly: true })), `${layout}: the highest only, as the figure has it`);
    assert.ok(pics.off.scene.layers.some(l => l.role === 'garment') && pics.on.scene.layers.some(l => l.role === 'garment'), `${layout}: on the coat`);
    assert.equal(boxes(pics.off.scene).length, total);
    assert.equal(boxes(pics.on.scene).length, total - 4, 'four of the five achievements are left out');
    assert.deepEqual(pics.off.scene.bounds, pics.on.scene.bounds, `${layout}: one frame`);
  }
  assert.ok(rowCounts(results['3'].off.scene).every(n => n <= 3), 'three across: rows of three');
  assert.ok(rowCounts(results['4-left'].off.scene).slice(1).every(n => n === 4) && rowCounts(results['4-left'].off.scene)[0] <= 4 && rowCounts(results['4-left'].off.scene).length >= 2, 'four across: rows of four, the top row the incomplete one');
  assert.notDeepEqual(boxes(results['3'].off.scene), boxes(results['4-left'].off.scene), 'the full rack differs with the layout');
  assert.notDeepEqual(boxes(results['3'].on.scene), boxes(results['4-left'].on.scene), 'the short stack differs with the layout: its rows are the layout\'s');
  // The coat's lapel over the ribbons on a woman's coat with the chosen four across.
  set({ layout: '4-center', gender: 'female' }, ids);
  const woman = await OP.RECIPES.shortStack.make(env, env.build(), ['off', 'on']);
  for(const v of ['off', 'on']) assert.ok(lapelAbove(woman[v].scene), `a woman, four across: the lapel is over the ribbons (${v})`);
  // The cache follows the layout, the arrangement and the ribbons, those the box leaves out too.
  const key = () => JSON.stringify(OP.RECIPES.shortStack.key(env.build(), env));
  set({ layout: '3' }, ids); const k3 = key();
  set({ layout: '4-left' }, ids); assert.notEqual(key(), k3, 'the layout');
  set({ layout: '3', arrangement: 'lapel' }, ids); assert.notEqual(key(), k3, 'the arrangement');
  set({ layout: '3', on: true }, ids); assert.equal(key(), k3, 'the box the picture is of is not in it: all the ribbons are, whether or not it is checked');
  set({ layout: '3', on: true }, ids.filter(id => id !== 'goddard_achievement')); assert.notEqual(key(), k3, 'a ribbon the box leaves out of the rack, taken off');
  // The page asks again when the layout or a ribbon changes: the picker's inputs name them.
  const items = read('js/item-pickers.js');
  const dep = items.slice(items.indexOf("id: 'cadetHighestOnly'"), items.indexOf("id: 'removeRibbons'"));
  for(const field of ['ribbonRackLayout', 'ribbonRackArrangement', 'ribbonSelections', 'ribbonRowOverrideEnabled', 'ribbonRowOverride', 'membership']) assert.ok(dep.includes(field) || /\.\.\.RACK/.test(dep) && ['ribbonRowOverrideEnabled', 'ribbonRowOverride'].includes(field), `Short Stack depends on ${field}`);
  // Nothing to pick between: one achievement ribbon only, or a layout that leaves no difference, is hidden.
  set({ layout: '4-left' }, ['earhart_award']);
  assert.deepEqual(await OP.create(env).pictures('shortStack', ['off', 'on']).ready, { off: false, on: false });
});

test('while the page is still loading the Short Stack\'s key (which lists the ribbons again) is made from the build alone, and asking for its pictures does not throw', () => {
  member({ membership: 'cadet', rank: 'C/Capt', gender: 'male' });
  const loading = Object.assign({}, env, { buildWith: () => { throw new ReferenceError('isCommandInsigniaGradeEligible is not defined'); } });
  const asked = OP.create(loading).pictures('shortStack', ['off', 'on']);
  assert.ok(asked && asked.ready, 'a promise of the pictures, no exception');
  return asked.ready.catch(() => {});
});

test('removing the ribbons from a shirt: the shirt with the rack and without it, shown from the state with the box unchecked and checked; not offered with no ribbon', async () => {
  const set = (hide, n, uniform) => run(`
    State.membership = 'senior'; State.uniform = ${JSON.stringify(uniform || 'blues_b')}; State.gender = 'male'; State.rank = 'Maj'; State.badges = []; State.garment = {}; State.hideRibbons = ${hide}; State.cadetHighestOnly = false;
    normalizeRibbonSelections(); for(const id of Object.keys(State.ribbonSelections)) clearRibbonSelection(id);
    for(const id of ${JSON.stringify(CHOICES.slice(0, n))}) setRibbonSelectionFromDropdown(id, 'earned', { deferRender: true });
    rebuildRibbonsFromGallery(); return CAPUBUniformView.buildFromState().ribbons.length;`);
  for(const hide of [false, true]){
    assert.equal(set(hide, 6), hide ? 0 : 6, 'the build has no ribbon when they are removed');
    const pics = await OP.RECIPES.removeRibbons.make(env, env.build(), ['off', 'on']);
    assert.equal(pics.off.scene.layers.filter(l => l.role === 'ribbon').length, 6, `box ${hide}: the rack worn`);
    assert.equal(pics.on.scene.layers.filter(l => l.role === 'ribbon').length, 0, `box ${hide}: none`);
    assert.deepEqual(pics.off.scene.bounds, pics.on.scene.bounds);
    assert.ok(pics.on.scene.layers.some(l => l.role === 'garment'), 'the shirt');
  }
  set(false, 0);
  assert.deepEqual(await OP.create(env).pictures('removeRibbons', ['off', 'on']).ready, { off: false, on: false });
});
