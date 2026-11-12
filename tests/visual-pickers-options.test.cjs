'use strict';
// V1 (the owner: "these should be seperate. and i think they should be visual. like a mini version of each headgear (shrunk down), and the just blank squares
// showing the different layouts, specific to each uniform config. also if a member doesnt have more than 2 badges, it shouldnt even be an option" and "this logic
// (visual rather than words) should be broadly applied"). The options a member chooses by look are drawn with the picture picker (js/visual-picker.js) from pictures
// made out of what the engine draws (js/option-pictures.js): the cap the figure wears, the blank squares the engine's own layout rule puts on the CAP tape, the
// sleeves, the skirt, the chevron, the patch. What is saved and shared is unchanged: the same keys and the same values.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, keydown } = require('./helpers/mini-dom.cjs');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const OP = require('../js/option-pictures.js');

const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));
const PILOT = 'CAPPilot1_FA9D33EA587D8', OBSERVER = 'observer_badge', GT = 'ground_team_basic_badge', EMT = 'emt_basic_badge', MED = 'medical_officer';

const env = {
  core, build: () => { throw new Error('the tests give the build'); },
  compose: b => P.composeUniform(b, store),
  spec: id => store.load(id), entry: id => store.entry(id), url: p => 'images/' + p, empty: () => '<svg id="empty"></svg>'
};
function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', membership, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' },
    name: { first: 'Pat', last: 'Doe', show: true }, ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  b.opt = Object.assign({ headgear: 'auto' }, (extra && extra.opt) || {});
  return b;
}
const badges = ids => ids.map(id => ({ id, title: id, level: null }));

// The garment options panel, in a sandbox with the small DOM, the picker and (when given) a stand-in for the pictures.
function panel(state, extra){
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  const sandbox = Object.assign({
    State: Object.assign({ uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [] }, state),
    CAPUBEngine: { grades: G }, document: doc, console, fullRender(){ renders++; }
  }, extra || {});
  let renders = 0;
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  if(sandbox.useOptionPictures) vm.runInNewContext(read('js/option-pictures.js'), sandbox);
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return { sandbox, doc, host, section, renders: () => renders, O: sandbox.CAPUBGarmentOptions };
}
const groups = host => host.querySelectorAll('.vp').map(v => v.dataset.name);
const tiles = (host, name) => host.querySelectorAll('.vp').find(v => v.dataset.name === name).querySelectorAll('[role="radio"]');
const labelsOf = (host, name) => tiles(host, name).map(t => t.querySelector('.vpLabel').textContent);

// ---- the panel -----------------------------------------------------------------------------------------------------------------------

test('headgear and the chest badge layout are two groups of their own, each a picture picker, not a drop-down', () => {
  const scene = { uniform: 'ocp', layers: [PILOT, GT, EMT].map(id => ({ role: 'badge', place: 'above the CAP tape', key: 'badge:' + id })) };
  const { host } = panel({ badges: [PILOT, GT, EMT] }, { CAPUBUniformView: { scene } });
  assert.deepEqual(groups(host), ['garmentOpt-headgear', 'garmentOpt-capGrade', 'garmentOpt-badgeLayout'], 'the cap grade (a list of its own) sits between them');
  const rows = host.children;
  const rowOf = name => rows.find(r => r.querySelector('.vp') && r.querySelector('.vp').dataset.name === name);
  assert.notEqual(rowOf('garmentOpt-headgear'), rowOf('garmentOpt-badgeLayout'), 'two rows');
  assert.equal(host.querySelectorAll('select').filter(s => ['garmentOpt-headgear', 'garmentOpt-badgeLayout'].includes(s.id)).length, 0);
  const legend = name => host.querySelectorAll('.vp').find(v => v.dataset.name === name).querySelector('.vpLegend').textContent;
  assert.equal(legend('garmentOpt-headgear'), 'Headgear');
  assert.equal(legend('garmentOpt-badgeLayout'), 'Chest badge layout');
  assert.deepEqual(labelsOf(host, 'garmentOpt-headgear'), ['Patrol cap', 'Tactical cap', 'National Blue Beret, graduates', 'No headgear']);
  assert.deepEqual(labelsOf(host, 'garmentOpt-badgeLayout'), ['Column', 'Two side by side']);
});

test('the picker sets the same keys and values the select did, and the panel is drawn again', () => {
  const p = panel({ badges: [PILOT, GT, EMT] }, { CAPUBUniformView: { scene: { uniform: 'ocp', layers: [PILOT, GT, EMT].map(id => ({ role: 'badge', place: 'above the CAP tape', key: 'badge:' + id })) } } });
  const State = p.sandbox.State;
  tiles(p.host, 'garmentOpt-headgear')[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(State.garment)), { headgear: 'tactical' });
  assert.equal(p.renders(), 1, 'the uniform is drawn again');
  tiles(p.host, 'garmentOpt-badgeLayout')[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(State.garment)), { headgear: 'tactical', badgeLayout: 'pair' });
  // The panel now shows what was picked.
  const picked = name => tiles(p.host, name).map(t => t.getAttribute('aria-checked'));
  assert.deepEqual(picked('garmentOpt-headgear'), ['false', 'true', 'false', 'false']);
  assert.deepEqual(picked('garmentOpt-badgeLayout'), ['false', 'true']);
});

test('the keyboard: the focus stays on the option it was on when the panel is drawn again', () => {
  const p = panel({ badges: [] });
  const r = tiles(p.host, 'garmentOpt-headgear');
  r[2].focus();
  r[2].dispatchEvent(keydown('Enter'));
  assert.equal(p.sandbox.State.garment.headgear, 'beret');
  const again = tiles(p.host, 'garmentOpt-headgear');
  assert.notEqual(again[2], r[2], 'the panel was rebuilt');
  assert.equal(p.doc.activeElement, again[2], 'and the focus is on the same option');
});

test('the layout choice is not there unless the drawing wears more than two chest badges above the CAP tape', () => {
  const layers = ids => ids.map(id => ({ role: 'badge', place: 'above the CAP tape', key: 'badge:' + id }));
  const shown = (badgesSelected, drawn, uniform) => groups(panel({ uniform: uniform || 'ocp', badges: badgesSelected }, { CAPUBUniformView: { scene: { uniform: uniform || 'ocp', layers: layers(drawn) } } }).host).includes('garmentOpt-badgeLayout');
  assert.equal(shown([], []), false);
  assert.equal(shown([PILOT, GT], [PILOT, GT]), false, 'two');
  assert.equal(shown([PILOT, GT, EMT], [PILOT, GT, EMT]), true, 'three');
  assert.equal(shown([PILOT, GT, EMT, MED], [PILOT, GT, EMT, MED]), true, 'four');
  // Three selected, two drawn (an aviation badge the member picked besides the pilot's, which is the one worn): not three worn, no choice.
  assert.equal(shown([PILOT, OBSERVER, GT], [PILOT, GT]), false, 'selected is not worn');
  // A badge that is not above the tape (the command pin over the name tape, a badge in another place) does not count.
  const mixed = panel({ badges: [PILOT, GT, EMT] }, { CAPUBUniformView: { scene: { uniform: 'ocp', layers: [...layers([PILOT, GT]), { role: 'badge', place: 'above the name tape', key: 'badge:pin' }] } } });
  assert.equal(groups(mixed.host).includes('garmentOpt-badgeLayout'), false);
  // The ABU and the Corporate Field Uniform wear two at most, whatever is selected.
  assert.equal(shown([PILOT, GT, EMT], [PILOT, GT], 'abu'), false);
  assert.equal(shown([PILOT, GT, EMT], [PILOT, GT], 'corporate_field'), false);
  // Before the first drawing of the uniform (no scene, or another uniform's) the badges selected are counted.
  assert.equal(groups(panel({ badges: [PILOT, GT, EMT] }).host).includes('garmentOpt-badgeLayout'), true, 'no scene yet');
  assert.equal(groups(panel({ badges: [PILOT, GT, EMT] }, { CAPUBUniformView: { scene: { uniform: 'abu', layers: [] } } }).host).includes('garmentOpt-badgeLayout'), true, 'the last scene is another uniform\'s');
});

test('the pictures follow the member: the panel is drawn again when the grade or the badges change, not when nothing did', () => {
  const p = panel({ rank: 'Capt', badges: [PILOT, GT] });
  const first = p.host.children[0];
  p.O.render();
  assert.equal(p.host.children[0], first, 'nothing changed: the same panel');
  p.sandbox.State.rank = 'Col';
  p.O.render();
  assert.notEqual(p.host.children[0], first, 'a colonel wears another grade on the cap, in the same category as a captain');
  const second = p.host.children[0];
  p.sandbox.State.badges = [PILOT, EMT];
  p.O.render();
  assert.notEqual(p.host.children[0], second, 'other badges, as many: the squares are theirs');
});

test('the other options chosen by look are pickers too; the yes or no options and the text field are not', () => {
  const picked = (state, extra) => groups(panel(state, extra).host).map(n => n.replace('garmentOpt-', ''));
  assert.deepEqual(picked({ uniform: 'abu', rank: 'SMSgt' }), ['headgear', 'chevron']);
  assert.deepEqual(picked({ uniform: 'corporate_field', rank: 'TSgt' }), ['headgear', 'chevron', 'esPatch']);
  assert.deepEqual(picked({ uniform: 'ocp', rank: 'Maj' }), ['headgear', 'capGrade']);
  assert.deepEqual(picked({ uniform: 'mess_dress', gender: 'female', rank: 'SMSgt' }), ['skirt', 'buttons', 'chevron']);
  assert.deepEqual(picked({ uniform: 'blues_b', rank: 'Capt' }), ['sleeve', 'headgear']);
  assert.deepEqual(picked({ uniform: 'aviator', gender: 'female', rank: 'Capt' }), ['sleeve', 'femaleTop']);
  assert.deepEqual(picked({ uniform: 'aviator_blazer', rank: 'Capt' }), ['underlayer']);
  assert.deepEqual(picked({ uniform: 'polo', gender: 'female', rank: 'Capt' }), ['poloShirt', 'poloCut', 'sleeve']);
  assert.deepEqual(picked({ uniform: 'flight_suit', rank: 'Capt' }), ['headgear', 'esPatch']);
  // The flight jacket, the scarf, the tie, the clasp and the other yes or no options stay boxes; "Over the name" and the duty title keep their own controls.
  const flight = panel({ uniform: 'flight_suit', rank: 'Capt' }).host;
  assert.equal(flight.querySelectorAll('input').filter(i => /^garmentOpt-(jacket|scarf)$/.test(i.id)).length, 2);
  const polo = panel({ uniform: 'polo', rank: 'Capt', garment: { poloMark: 'title' } }).host;
  assert.ok(polo.querySelector('select'), '"Over the name" is still a list');
  assert.ok(polo.querySelector('input[type="text"]') || polo.querySelectorAll('input').some(i => i.id === 'garmentOpt-dutyTitle'));
});

test('without the picker script the panel falls back to the lists it always had (the choices are the same)', () => {
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  const sandbox = { State: { uniform: 'ocp', gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [] }, CAPUBEngine: { grades: G }, document: doc, console, fullRender(){} };
  sandbox.window = sandbox;
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  const select = host.querySelectorAll('select').find(s => s.id === 'garmentOpt-headgear');
  assert.ok(select, 'a list');
  assert.deepEqual(select.querySelectorAll('option').map(o => o.value), ['auto', 'tactical', 'beret', 'none']);
});

// ---- what is saved and shared does not change --------------------------------------------------------------------------------------

test('every option keeps its keys and values: the choices offered, what a saved setup may hold, and what sanitize lets through', () => {
  const { O } = panel({});
  const choices = (key, c) => { const o = O.OPTIONS.find(x => x.key === key); return JSON.parse(JSON.stringify(typeof o.choices === 'function' ? o.choices(c) : o.choices)).map(x => x[0]); };
  const g = rank => G.gradeInfo('senior', rank, {});
  assert.deepEqual(choices('headgear', { u: 'ocp', female: false, g: g('Capt') }), ['auto', 'tactical', 'beret', 'none']);
  assert.deepEqual(choices('headgear', { u: 'corporate_field', female: false, g: g('Capt') }), ['auto', 'tactical', 'boonie', 'beret', 'none']);
  assert.deepEqual(choices('headgear', { u: 'blues_a', female: false, g: g('Capt') }), ['auto', 'service', 'none']);
  assert.deepEqual(choices('headgear', { u: 'flight_suit', female: false, g: g('Capt') }), ['auto', 'none']);
  assert.deepEqual(choices('badgeLayout', { chestBadges: 3 }), ['column', 'pair']);
  assert.deepEqual(choices('capGrade', {}), ['sewn', 'square']);
  assert.deepEqual(choices('chevron', { u: 'abu' }), ['', '3.5']);
  assert.deepEqual(choices('chevron', { u: 'blues_b' }), ['', '4']);
  assert.deepEqual(choices('esPatch', {}), ['none', 'style-1', 'style-2']);
  assert.deepEqual(choices('skirt', {}), ['a-line', 'straight-split']);
  assert.deepEqual(choices('buttons', {}), ['wing-star', 'cap-crest']);
  assert.deepEqual(choices('sleeve', {}), ['short', 'long']);
  assert.deepEqual(choices('femaleTop', {}), ['shirt', 'overblouse']);
  assert.deepEqual(choices('underlayer', { u: 'aviator_blazer', female: true }), ['shirt', 'turtleneck', 'shell']);
  assert.deepEqual(choices('poloShirt', {}), ['embroidered', 'print', 'tactical']);
  assert.deepEqual(choices('poloCut', {}), ['', 'male']);
  const clean = raw => JSON.parse(JSON.stringify(O.sanitize(raw)));
  const all = { headgear: 'beret', badgeLayout: 'pair', capGrade: 'square', chevron: '3.5', esPatch: 'style-2', skirt: 'straight-split', buttons: 'cap-crest', sleeve: 'long', femaleTop: 'overblouse', underlayer: 'shell', poloShirt: 'tactical', poloCut: 'male' };
  assert.deepEqual(clean(all), all, 'a saved setup loads as it was');
  assert.deepEqual(clean({ headgear: 'hat', badgeLayout: 'ring', esPatch: 'style-3', sleeve: 'sleeveless' }), {}, 'anything else is dropped');
});

// ---- the pictures are the engine's own ----------------------------------------------------------------------------------------------

const optionsOf = key => panel({}).O.OPTIONS.find(o => o.key === key);
const offered = (key, c) => { const o = optionsOf(key); return (typeof o.choices === 'function' ? o.choices(c) : o.choices).map(x => x[0]); };

test('headgear: a picture for every cap offered on every uniform, cut and kind of member, framed on the cap the engine seats on the figure, with what is on it', async () => {
  const missing = [];
  const members = [['cadet', 'C/AB'], ['cadet', 'C/Capt'], ['cadet', 'C/Col'], ['senior', 'Capt'], ['senior', 'SMSgt'], ['senior', 'Maj Gen']];
  for(const u of ['blues_a', 'blues_b', 'flight_suit', 'ocp', 'abu', 'corporate_field']){
    for(const gender of ['male', 'female']){
      for(const [m, r] of members){
        const g = G.gradeInfo(m, r, {});
        const values = offered('headgear', { u, female: gender === 'female', g });
        const base = build(u, m, r, { gender });
        const pics = await OP.RECIPES.headgear.make(env, base, values);
        for(const v of values){
          const spec = pics[v];
          if(v === 'none'){ assert.equal(spec.markup, '<svg id="empty"></svg>', `${u} none`); continue; }
          if(!spec){ missing.push(`${u} ${gender} ${r} ${v}`); continue; }
          // The same cap, the same device and the same place on the sheet as in the whole drawing of that member with the cap chosen.
          const full = await P.composeUniform(build(u, m, r, { gender, opt: { headgear: v }, badges: badges([PILOT, GT]), ribbons: [], name: { first: 'Pat', last: 'Doe', show: true } }), store);
          const hat = full.layers.find(l => l.role === 'hat');
          const drawn = spec.scene.layers.find(l => l.role === 'hat');
          assert.equal(drawn.id, hat.id, `${u} ${gender} ${r} ${v}: the cap's art`);
          assert.deepEqual(drawn.onlyGroups || null, hat.onlyGroups || null, `${u} ${gender} ${r} ${v}: the view of the sheet`);
          for(const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(drawn[k] - hat[k]) < 1e-6, `${u} ${v}: ${k}`);
          const device = full.layers.filter(l => (l.role === 'hat-device' || (l.role === 'grade' && /(cap|hat)_(front|back)_insignia_zone/.test(l.key))));
          const shownIds = spec.scene.layers.filter(l => l !== drawn).map(l => l.id).sort();
          assert.deepEqual(shownIds, device.map(l => l.id).sort(), `${u} ${gender} ${r} ${v}: the device or grade on the cap`);
          // The cap lies inside the frame the picture takes (the view of the sheet, or the cap's own box).
          const f = spec.scene.bounds;
          assert.ok(f.w > 0 && f.h > 0, 'a frame');
          for(const l of spec.scene.layers.filter(l => l.role !== 'hat' || !l.onlyGroups)){
            const b = core.layerBounds(l);
            assert.ok(b.x >= f.x - 1e-6 && b.y >= f.y - 1e-6 && b.x + b.w <= f.x + f.w + 1e-6 && b.y + b.h <= f.y + f.h + 1e-6, `${u} ${gender} ${r} ${v}: ${l.id} inside the frame`);
          }
        }
      }
    }
  }
  assert.deepEqual(missing, [], 'every cap offered has art to show:\n' + missing.join('\n'));
});

test('headgear: "No headgear" is the plain empty mark, and nothing else carries one', async () => {
  const pics = await OP.RECIPES.headgear.make(env, build('ocp', 'senior', 'Capt'), ['auto', 'none']);
  assert.ok(pics.none.markup && !pics.none.scene);
  assert.ok(pics.auto.scene && pics.auto.markup === undefined);
});

test('the National Blue Beret is drawn from the OCP sheet on the OCP, the ABU and the CFU, as the engine does', async () => {
  for(const u of ['ocp', 'abu', 'corporate_field']){
    const pics = await OP.RECIPES.headgear.make(env, build(u, 'senior', 'Capt'), ['beret']);
    const hat = pics.beret.scene.layers.find(l => l.role === 'hat');
    assert.equal(hat.id, 'garment-ocp-coat-abu-cut', u);
    assert.deepEqual(hat.onlyGroups, ['hat-beret-nbb-front'], u);
  }
});

test('cap grade: the OCP cap with the grade sewn on and on the hook-and-loop square, as the engine draws them', async () => {
  const pics = await OP.RECIPES.capGrade.make(env, build('ocp', 'senior', 'Maj'), ['sewn', 'square']);
  const ids = v => pics[v].scene.layers.map(l => l.id).sort();
  assert.notDeepEqual(ids('sewn'), ids('square'), 'two different forms');
  assert.equal(pics.sewn.scene.layers.filter(l => l.role === 'hat').length, 1);
  const full = await P.composeUniform(build('ocp', 'senior', 'Maj', { opt: { capGrade: 'square' } }), store);
  assert.ok(ids('square').every(id => id === 'garment-ocp-coat-abu-cut' || full.layers.some(l => l.id === id)), 'the square is the engine\'s art');
});

test('chest badge layout: a blank square for each badge at the place the engine puts it, and the CAP tape, both layouts in one frame', async () => {
  for(const ids of [[PILOT, GT, EMT], [PILOT, GT, EMT, MED]]){
    const base = build('ocp', 'senior', 'Capt', { badges: badges(ids) });
    const pics = await OP.RECIPES.badgeLayout.make(env, base, ['column', 'pair']);
    const viewBox = m => /viewBox="([^"]+)"/.exec(m)[1];
    assert.equal(viewBox(pics.column.markup), viewBox(pics.pair.markup), 'one frame');
    assert.notEqual(pics.column.markup, pics.pair.markup);
    const sheet = await store.load('garment-ocp-coat-abu-cut');
    const tape = core.landmarkBounds(sheet, 'cap_tape');
    for(const layout of ['column', 'pair']){
      const markup = pics[layout].markup;
      const rects = [...markup.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
      assert.equal(rects.length, ids.length + 1, `${layout}: the tape and one square per badge`);
      const near = (a, b) => Math.abs(a - b) < 0.002;
      assert.ok(near(rects[0].x, tape.x) && near(rects[0].y, tape.y) && near(rects[0].w, tape.w) && near(rects[0].h, tape.h), `${layout}: the tape is the sheet's cap_tape`);
      // The squares are where the engine drew the badges, with the whole drawing (ribbons, name, patches) as the member has it.
      const full = await P.composeUniform(Object.assign(build('ocp', 'senior', 'Capt', { badges: badges(ids), opt: { badgeLayout: layout } })), store);
      const drawn = full.layers.filter(l => l.role === 'badge' && l.place === 'above the CAP tape').map(l => core.layerBounds(l));
      assert.equal(drawn.length, ids.length);
      for(const d of drawn) assert.ok(rects.slice(1).some(r => near(r.x, d.x) && near(r.y, d.y) && near(r.w, d.w) && near(r.h, d.h)), `${layout}: a square at ${JSON.stringify(d)}`);
    }
    // The regulation's two forms: three badges in a column have one on the tape and the pair form has two side by side on it (7.1.1.3.1.3).
    const rowOnTape = layout => [...pics[layout].markup.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)].slice(1)
      .filter(m => Math.abs(+m[2] + +m[4] - tape.y) < 0.05).length;
    if(ids.length === 3){ assert.equal(rowOnTape('column'), 1); assert.equal(rowOnTape('pair'), 2); }
    else assert.equal(rowOnTape('pair'), 2);
  }
});

test('chest badge layout: no picture without three badges drawn, and the diagram follows what the member wears (the badges the engine skips are not squares)', async () => {
  // Three aviation badges selected: one is worn, so there is nothing to lay out.
  const pics = await OP.RECIPES.badgeLayout.make(env, build('ocp', 'senior', 'Capt', { badges: badges([PILOT, OBSERVER, 'SeniorPilot1_D9725AE959752']) }), ['column', 'pair']);
  assert.equal(pics.column, null);
  assert.equal(pics.pair, null);
});

test('chevron: the sleeve chevron at each size, to one scale; the mess dress chevron on a dark swatch because it is white', async () => {
  const abu = await OP.RECIPES.chevron.make(env, build('abu', 'senior', 'SMSgt'), ['', '3.5', '4']);
  const wide = v => abu[v].scene.layers.find(l => l.role === 'grade').w;
  assert.equal(wide('3.5'), 3.5);
  assert.equal(wide('4'), 4);
  assert.equal(wide(''), 4, 'the ABU\'s default is the 4 inch');
  assert.deepEqual(abu['3.5'].scene.bounds, abu['4'].scene.bounds, 'one frame, so the sizes can be compared');
  const dress = await OP.RECIPES.chevron.make(env, build('blues_b', 'senior', 'SMSgt', { gender: 'female' }), ['', '4']);
  assert.equal(dress[''].scene.layers.find(l => l.role === 'grade').w, 3.5, 'the women\'s Class B default is the 3 1/2 inch');
  const mess = await OP.RECIPES.chevron.make(env, build('mess_dress', 'senior', 'SMSgt', { gender: 'female' }), ['', '3.5']);
  assert.ok(mess['3.5'].scene.layers.some(l => l.role === 'swatch'));
  assert.ok(!abu['4'].scene.layers.some(l => l.role === 'swatch'), 'silver on blue needs none');
});

test('Emergency Services patch: each style as the picture file the engine places, at its own size, in one frame; none is the empty mark', async () => {
  for(const u of ['flight_suit', 'corporate_field']){
    const pics = await OP.RECIPES.esPatch.make(env, build(u, 'senior', 'Capt'), ['none', 'style-1', 'style-2']);
    assert.ok(pics.none.markup);
    for(const [v, id] of [['style-1', 'patch-es-style-1'], ['style-2', 'patch-es-style-2']]){
      const layer = pics[v].scene.layers[0];
      const spec = await store.load(id);
      assert.equal(layer.type, 'raster');
      assert.equal(layer.href, 'images/' + store.entry(id).path);
      assert.ok(Math.abs(layer.w - spec.w) < 1e-9 && Math.abs(layer.h - spec.h) < 1e-9, 'its own size');
    }
    assert.deepEqual(pics['style-1'].scene.bounds, pics['style-2'].scene.bounds);
  }
});

test('mess dress: the skirt is the skirt sheet the engine puts under the coat, the button is the coat sheet\'s own button of that design', async () => {
  const skirts = await OP.RECIPES.skirt.make(env, build('mess_dress', 'senior', 'Capt', { gender: 'female' }), ['a-line', 'straight-split']);
  assert.equal(skirts['a-line'].scene.layers[0].id, 'garment-mess-dress-skirt-female-a-line');
  assert.equal(skirts['straight-split'].scene.layers[0].id, 'garment-mess-dress-skirt-female-straight-split');
  for(const gender of ['male', 'female']){
    const out = await OP.RECIPES.buttons.make(env, build('mess_dress', 'senior', 'Capt', { gender }), ['wing-star', 'cap-crest']);
    for(const v of ['wing-star', 'cap-crest']){
      const l = out[v].scene.layers[0];
      assert.deepEqual(l.onlyGroups, ['button-right-1-' + v], `${gender} ${v}`);
      const spec = await store.load(l.id);
      assert.ok(spec.landmarks.button_designs[v].includes(l.onlyGroups[0]), 'a group the sheet names for that design');
      assert.ok(!l.hideGroups, 'the other designs are not hidden by name: only this group is drawn');
      const f = out[v].scene.bounds, box = core.landmarkBounds(spec, 'button_right_1');
      assert.ok(box.x >= f.x - l.x && f.w < 2, 'framed on the one button');
    }
  }
});

test('sleeves, the women\'s top, the polo and what is under the blazer: the uniform as the engine draws it for the choice, the figure alone', async () => {
  const sleeve = await OP.RECIPES.sleeve.make(env, build('blues_b', 'senior', 'Capt'), ['short', 'long']);
  assert.equal(sleeve.short.scene.layers.find(l => l.role === 'garment').id, 'garment-blues-class-b-shirt-male');
  assert.equal(sleeve.long.scene.layers.find(l => l.role === 'garment').id, 'garment-blues-class-b-shirt-male-long');
  assert.ok(!sleeve.short.scene.layers.some(l => l.role === 'hat'), 'no cap: the shirt alone');
  const top = await OP.RECIPES.femaleTop.make(env, build('aviator', 'senior', 'Capt', { gender: 'female' }), ['shirt', 'overblouse']);
  assert.equal(top.shirt.scene.layers.find(l => l.role === 'garment').id, 'garment-aviator-shirt-female');
  assert.equal(top.overblouse.scene.layers.find(l => l.role === 'garment').id, 'garment-overblouse-female');
  const polo = await OP.RECIPES.poloShirt.make(env, build('polo', 'senior', 'Capt'), ['embroidered', 'print', 'tactical']);
  assert.ok(polo.print.scene.layers.some(l => /seal-print/.test(l.id)));
  assert.ok(polo.tactical.scene.layers.some(l => /tactical/.test(l.id)));
  assert.ok(!polo.embroidered.scene.layers.some(l => /seal-print|tactical/.test(l.id)));
  const cut = await OP.RECIPES.poloCut.make(env, build('polo', 'senior', 'Capt', { gender: 'female' }), ['', 'male']);
  assert.equal(cut[''].scene.layers.find(l => l.role === 'garment').id, 'garment-polo-female');
  assert.equal(cut.male.scene.layers.find(l => l.role === 'garment').id, 'garment-polo-male');
  // Under the blazer: the blazer and what shows under it; the aviator shirt the engine draws beside the blazer is left out, and the frame is the upper chest.
  const under = await OP.RECIPES.underlayer.make(env, build('aviator_blazer', 'senior', 'Capt', { gender: 'female' }), ['shirt', 'turtleneck', 'shell']);
  const garment = under.shirt.scene.layers.find(l => l.role === 'garment');
  assert.ok(garment && !under.shirt.scene.layers.some(l => l.figure === 2), 'one figure');
  assert.ok(under.turtleneck.scene.layers.some(l => /turtleneck/.test(l.id)));
  assert.ok(under.shell.scene.layers.some(l => /shell/.test(l.id)));
  for(const v of ['shirt', 'turtleneck', 'shell']){
    const f = under[v].scene.bounds;
    assert.ok(f.w > f.h && f.x + f.w <= garment.x + garment.w, `${v}: the neck and chest of the blazer`);
  }
});

test('what a picture is made from does not change with what is chosen elsewhere: the cache keys follow the member\'s grade and cut, not ribbons or other options', () => {
  const key = (name, b) => OP.RECIPES[name].key(b);
  const base = build('ocp', 'senior', 'Capt');
  assert.deepEqual(key('headgear', base), key('headgear', Object.assign({}, base, { ribbons: [{ id: 'x' }], patches: [{ id: 'y' }], opt: Object.assign({}, base.opt, { tie: true, sleeve: 'long' }) })));
  assert.notDeepEqual(key('headgear', base), key('headgear', build('ocp', 'senior', 'Col')), 'the grade is on the cap');
  assert.notDeepEqual(key('headgear', base), key('headgear', build('ocp', 'senior', 'Capt', { gender: 'female' })), 'the cut');
  assert.notDeepEqual(key('headgear', base), key('headgear', build('abu', 'senior', 'Capt')), 'the uniform');
  assert.notDeepEqual(key('badgeLayout', build('ocp', 'senior', 'Capt', { badges: badges([PILOT, GT, EMT]) })), key('badgeLayout', build('ocp', 'senior', 'Capt', { badges: badges([PILOT, GT, MED]) })), 'the badges are the squares');
});

test('the pictures are cached per member and choice, and a choice no recipe draws has no art to show', async () => {
  let composed = 0;
  const counting = Object.assign({}, env, { build: () => build('ocp', 'senior', 'Capt'), compose: b => { composed++; return env.compose(b); }, draw: async scene => 'picture:' + scene.layers.map(l => l.id).join(), warn(){} });
  const api = OP.create(counting);
  const first = api.pictures('headgear', ['auto', 'tactical', 'none']);
  assert.deepEqual(first.now, {}, 'not made yet');
  const done = await first.ready;
  assert.ok(/^picture:/.test(done.auto) && /^picture:/.test(done.tactical));
  assert.equal(done.none, '<svg id="empty"></svg>');
  const n = composed;
  const again = api.pictures('headgear', ['auto', 'tactical', 'none']);
  assert.deepEqual(again.now, done, 'known at once');
  await again.ready;
  assert.equal(composed, n, 'nothing composed again');
  const none = api.pictures('notAnOption', ['a', 'b']);
  assert.deepEqual(none.now, { a: null, b: null });
  assert.equal(none.settled, true);
  assert.equal(first.settled, false);
  assert.equal(again.settled, true);
  // A recipe that fails leaves the choices as names alone.
  const failing = OP.create(Object.assign({}, counting, { compose: async () => { throw new Error('no art'); } }));
  assert.deepEqual(await failing.pictures('headgear', ['auto']).ready, { auto: null });
});

test('a member whose grade changes keeps the last pictures on the page until the new ones are made, and the pictures dropped from the cache are let go', async () => {
  let current = build('ocp', 'senior', 'Capt');
  const released = [];
  const api = OP.create(Object.assign({}, env, { build: () => current, draw: async scene => 'blob:' + scene.layers.map(l => l.id + l.key).join(), release: u => released.push(u), warn(){} }));
  const first = await api.pictures('headgear', ['auto', 'none']).ready;
  current = build('ocp', 'senior', 'Col');
  const next = api.pictures('headgear', ['auto', 'none']);
  assert.equal(next.settled, false, 'not made yet');
  assert.deepEqual(next.now, first, 'the last ones until then');
  const made = await next.ready;
  assert.notEqual(made.auto, first.auto, 'the colonel\'s grade is on the cap');
  assert.equal(api.pictures('headgear', ['auto', 'none']).settled, true);
  // Thirty-one members later the first has gone, and its pictures are let go.
  for(let i = 0; i < 31; i++){
    current = build('abu', 'senior', 'Capt', { gender: i % 2 ? 'female' : 'male', badges: badges(['x' + i]) });
    await api.pictures('badgeLayout', ['column', 'pair']).ready;
    current = build('ocp', 'senior', 'Capt', { badges: badges(['b' + i]) });
    await api.pictures('badgeLayout', ['column', 'pair']).ready;
  }
  const again = api.pictures('headgear', ['auto', 'none']);
  assert.equal(again.settled, false, 'the oldest set was dropped');
  assert.ok(released.includes(first.auto), 'and its picture address is let go');
  assert.ok(!released.includes(made.auto) || released.indexOf(made.auto) > released.indexOf(first.auto), 'the oldest first');
});
