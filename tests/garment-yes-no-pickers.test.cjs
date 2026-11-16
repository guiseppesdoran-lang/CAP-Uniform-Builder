'use strict';
// The owner (2026-11-12): "mostly everything should be visual atp". The yes or no options of the Uniform options panel (the tie and its clasp, the flight jacket, the command
// scarf, the grade on the blazer's nameplate, the polo's embroidered name, the appointed command chief, the chaplain's chest square) are pairs of pictures, without and with, made from
// what the engine draws; "Over the name" and "Working toward" are pictures too. What is saved does not change: the same keys, true or false.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument } = require('./helpers/mini-dom.cjs');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const core = require('../js/engine/core.js');
const G = require('../js/engine/grades.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const OP = require('../js/option-pictures.js');
const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

// ---- the panel ---------------------------------------------------------------------------------------------------------------------------

function panel(state, extra){
  const doc = createDocument();
  const host = doc.createElement('div'); host.id = 'garmentOptions'; doc.body.append(host);
  const section = doc.createElement('section'); section.id = 'garmentOptionsPanel'; doc.body.append(section);
  const sandbox = Object.assign({
    State: Object.assign({ uniform: 'blues_b', gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [] }, state),
    CAPUBEngine: { grades: G }, CAPUBUniformRules: require('../data/uniform-rules.js'), document: doc, console, fullRender(){ sandbox.renders = (sandbox.renders || 0) + 1; }
  }, extra || {});
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/garment-options.js'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return { sandbox, host, State: sandbox.State };
}
const groupOf = (host, name) => host.querySelectorAll('.vp').find(v => v.dataset.name === 'garmentOpt-' + name);
const tilesOf = (host, name) => groupOf(host, name).querySelectorAll('[role="radio"]');
const labelsOf = (host, name) => tilesOf(host, name).map(t => t.querySelector('.vpLabel').textContent);
const checkedOf = (host, name) => tilesOf(host, name).map(t => t.getAttribute('aria-checked'));
const names = host => host.querySelectorAll('.vp').map(v => v.dataset.name.replace('garmentOpt-', ''));

test('the tie and its clasp: without and with, a press saves true or false under the same key, the box it started at the regulation\'s value', () => {
  const p = panel({ garment: { sleeve: 'short' } });
  assert.deepEqual(labelsOf(p.host, 'tie'), ['No tie', 'Tie']);
  assert.deepEqual(checkedOf(p.host, 'tie'), ['true', 'false'], 'optional with short sleeves: off to begin with');
  tilesOf(p.host, 'tie')[1].click();
  assert.deepEqual(JSON.parse(JSON.stringify(p.State.garment)), { sleeve: 'short', tie: true });
  assert.equal(p.sandbox.renders, 1, 'the uniform is drawn again');
  assert.deepEqual(checkedOf(p.host, 'tie'), ['false', 'true']);
  assert.deepEqual(labelsOf(p.host, 'tieClasp'), ['No clasp', 'Clasp'], 'the clasp is offered once the tie is worn');
  tilesOf(p.host, 'tieClasp')[1].click();
  assert.equal(p.State.garment.tieClasp, true);
  tilesOf(p.host, 'tie')[0].click();
  assert.equal(p.State.garment.tie, false);
  assert.ok(!names(p.host).includes('tieClasp'), 'the clasp goes with the tie');
  assert.deepEqual(labelsOf(panel({ gender: 'female', garment: { sleeve: 'short' } }).host, 'tie'), ['No tie tab', 'Tie tab'], 'the women\'s tab');
  assert.equal(groupOf(p.host, 'tie').querySelector('.vpLegend').textContent, 'Tie');
  assert.ok(!p.host.querySelectorAll('input').some(i => /^garmentOpt-(tie|tieClasp)$/.test(i.id)), 'no box');
});

test('every other yes or no option is a pair too, with its words, its start (on or off) and its key', () => {
  const cases = [
    [{ uniform: 'flight_suit' }, 'jacket', ['Without the jacket', 'With the jacket'], 'false'],
    [{ uniform: 'flight_suit' }, 'scarf', ['No scarf', 'Command scarf'], 'false'],
    [{ uniform: 'aviator_blazer', rank: 'Maj' }, 'plateGrade', ['No grade', 'Grade'], 'true'],
    [{ uniform: 'polo' }, 'poloName', ['No name', 'Name'], 'true'],
    [{ uniform: 'blues_b', rank: 'CMSgt' }, 'commandChief', ['Chief Master Sergeant', 'Command Chief Master Sergeant'], 'false'],
    [{ uniform: 'ocp', rank: 'Maj', badges: ['christian_chaplin'] }, 'chaplainAsWritten', ['Two inches, as worn', 'Two feet, as written'], 'false']
  ];
  for(const [state, key, labels, start] of cases){
    const extra = state.badges ? { CAPUBBadgeCatalog: { family: id => /chaplin/.test(id) ? 'chaplain' : 'other' } } : {};
    const p = panel(state, extra);
    assert.deepEqual(labelsOf(p.host, key), labels, key);
    assert.deepEqual(checkedOf(p.host, key), start === 'true' ? ['false', 'true'] : ['true', 'false'], `${key}: starts ${start === 'true' ? 'on' : 'off'}`);
    tilesOf(p.host, key)[start === 'true' ? 0 : 1].click();
    assert.equal(p.State.garment[key], start !== 'true', `${key}: saved as ${start !== 'true'}`);
    assert.ok(!p.host.querySelectorAll('input').some(i => i.id === 'garmentOpt-' + key), `${key}: no box`);
  }
  // "Working toward" and "Over the name" are pictures too, their values as the lists held them.
  const noGrade = panel({ rank: 'SM', uniform: 'blues_b' });
  assert.deepEqual(labelsOf(noGrade.host, 'noGradeTrack'), ['Officer grade (1.4.1)', 'NCO grade (1.4.2)']);
  tilesOf(noGrade.host, 'noGradeTrack')[1].click();
  assert.equal(noGrade.State.garment.noGradeTrack, 'nco');
  const polo = panel({ uniform: 'polo' });
  assert.deepEqual(labelsOf(polo.host, 'poloMark'), ['One badge (chosen under Badges)', 'A duty title']);
  tilesOf(polo.host, 'poloMark')[1].click();
  assert.equal(polo.State.garment.poloMark, 'title');
  assert.ok(polo.host.querySelectorAll('input').some(i => i.id === 'garmentOpt-dutyTitle'), 'the title is typed: the one field left');
});

test('the polo with the screen-printed seal takes no name, badge or title: they are not offered, not greyed, and the paragraph is said once', () => {
  const print = panel({ uniform: 'polo', garment: { poloShirt: 'print', poloMark: 'title' } });
  assert.deepEqual(names(print.host), ['poloShirt', 'sleeve']);
  assert.equal(print.host.querySelectorAll('select').length + print.host.querySelectorAll('input').length, 0, 'no list, box or field');
  const notes = print.host.querySelectorAll('.fieldNote').map(n => n.textContent).filter(t => /5\.3\.2\.1\.2/.test(t));
  assert.deepEqual(notes, ['No accoutrements are worn with the screen-printed seal (CAPR 39-1, 5.3.2.1.2).'], 'once, for the three');
  const knit = panel({ uniform: 'polo', garment: { poloShirt: 'embroidered', poloMark: 'title' } });
  assert.deepEqual(names(knit.host), ['poloShirt', 'poloName', 'poloMark', 'sleeve']);
  assert.ok(knit.host.querySelectorAll('input').some(i => i.id === 'garmentOpt-dutyTitle'));
  assert.deepEqual(knit.host.querySelectorAll('.fieldNote').map(n => n.textContent).filter(t => /5\.3\.2\.1\.2/.test(t)), []);
});

test('a pair the engine draws alike without and with the item is not offered, and comes back with the pictures that tell them apart', async () => {
  let alike = true;
  const pictures = { pictures: (key, values) => { const now = Object.fromEntries(values.map(v => [v, alike && v === 'on' ? false : '<svg viewBox="0 0 4 3"></svg>'])); return { now, ready: Promise.resolve(now), settled: true }; } };
  const p = panel({ uniform: 'flight_suit' }, { CAPUBOptionPictures: pictures });
  assert.ok(groupOf(p.host, 'scarf'), 'the group is there');
  assert.equal(groupOf(p.host, 'scarf').parentNode.hidden, true, 'hidden');
  alike = false;
  p.sandbox.CAPUBGarmentOptions.render(true);
  assert.equal(groupOf(p.host, 'scarf').parentNode.hidden, false);
});

// ---- the pictures: what the engine draws ------------------------------------------------------------------------------------------------------

const env = {
  core, compose: b => P.composeUniform(b, store), spec: id => store.load(id), entry: id => store.entry(id), url: p => 'images/' + p, empty: () => '<svg id="empty"></svg>',
  draw: async scene => 'drawn:' + scene.title, build: () => { throw new Error('the tests give the build'); }
};
function build(uniform, membership, rank, extra){
  const b = Object.assign({
    uniform, gender: 'male', membership, grade: G.gradeInfo(membership, rank, {}), opt: { headgear: 'auto' },
    name: { first: 'Pat', last: 'Doe', show: true }, ribbons: [], medals: [], badges: [], command: null, militaryBadges: [], patches: [], cord: null
  }, extra || {});
  b.opt = Object.assign({ headgear: 'auto' }, (extra && extra.opt) || {});
  return b;
}
const make = (key, b, values) => OP.RECIPES[key].make(env, b, values || ['off', 'on']);
const centre = box => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

test('tie: the sheet\'s own tie group hidden and shown, in a window from the collar down the tie from the knot the sheet states (men\'s tie, women\'s tab)', async () => {
  for(const [uniform, gender, sheet] of [['blues_b', 'male', 'garment-blues-class-b-shirt-male'], ['aviator', 'male', 'garment-aviator-shirt-male'], ['aviator', 'female', 'garment-aviator-shirt-female']]){
    const pics = await make('tie', build(uniform, 'senior', 'Capt', { gender, opt: { sleeve: 'short' } }));
    const off = pics.off.scene, on = pics.on.scene;
    assert.ok(off.layers.find(l => l.role === 'garment').hideGroups.includes('tie'), `${uniform} ${gender}: without, the tie group is hidden`);
    assert.ok(!(on.layers.find(l => l.role === 'garment').hideGroups || []).includes('tie'), 'with, it is not');
    assert.deepEqual(off.bounds, on.bounds, 'one window');
    const spec = await store.load(sheet);
    const knot = spec.raw.landmarks.tie.knot;
    assert.ok(near(off.bounds.x + off.bounds.w / 2, knot.x / 100, 1e-3), `${uniform} ${gender}: centred on the knot`);
    assert.ok(off.bounds.y < knot.y / 100 && off.bounds.y + off.bounds.h > knot.y / 100 + 1, 'the knot and the tie below it are in the window');
  }
});

test('tie clasp: the silver bar the engine centres between the knot and the tip, the window centred on it, the same window without', async () => {
  const pics = await make('tieClasp', build('blues_b', 'senior', 'Capt', { opt: { sleeve: 'short' } }));
  const clasp = scene => scene.layers.find(l => l.key === 'tie:clasp');
  assert.ok(clasp(pics.on.scene) && !clasp(pics.off.scene));
  const c = centre(core.layerBounds(clasp(pics.on.scene)));
  assert.ok(near(pics.on.scene.bounds.x + pics.on.scene.bounds.w / 2, c.x, 1e-3) && near(pics.on.scene.bounds.y + pics.on.scene.bounds.h / 2, c.y, 1e-3));
  assert.deepEqual(pics.on.scene.bounds, pics.off.scene.bounds);
  assert.equal(clasp(pics.on.scene).id, 'tie-clasp-silver');
});

test('the command scarf and the flight jacket on the flight suits: the scarf layer and the window on it; the jacket as the second figure the engine draws beside the suit, the suit alone without it, one frame', async () => {
  for(const uniform of ['flight_suit', 'corporate_flight_suit']){
    const scarf = await make('scarf', build(uniform, 'senior', 'Capt'));
    assert.ok(scarf.on.scene.layers.some(l => l.role === 'scarf') && !scarf.off.scene.layers.some(l => l.role === 'scarf'), uniform);
    assert.deepEqual(scarf.on.scene.bounds, scarf.off.scene.bounds);
    const jacket = await make('jacket', build(uniform, 'senior', 'Capt'));
    const figures = scene => new Set(scene.layers.map(l => l.figure || 1)).size;
    assert.equal(figures(jacket.off.scene), 1, `${uniform}: the suit alone`);
    assert.equal(figures(jacket.on.scene), 2, `${uniform}: and the jacket beside it`);
    assert.deepEqual(jacket.on.scene.bounds, jacket.off.scene.bounds, 'one frame');
    assert.ok(jacket.on.scene.layers.some(l => /flight-jacket/.test(l.id)));
  }
});

test('the grade on the blazer\'s nameplate: the plate with and without the insignia it carries, the window centred on the plate; not for a cadet', async () => {
  const pics = await make('plateGrade', build('aviator_blazer', 'senior', 'Maj'));
  const grade = scene => scene.layers.find(l => l.key === 'grade:plate');
  assert.ok(grade(pics.on.scene) && !grade(pics.off.scene));
  const plate = pics.on.scene.layers.find(l => l.role === 'nametag');
  const c = centre(core.layerBounds(plate));
  assert.ok(near(pics.on.scene.bounds.x + pics.on.scene.bounds.w / 2, c.x, 1e-3));
  assert.deepEqual(pics.on.scene.bounds, pics.off.scene.bounds);
  assert.deepEqual(await make('plateGrade', build('aviator_blazer', 'cadet', 'C/Capt')), { off: false, on: false }, 'a cadet\'s plate carries none: nothing to tell apart');
});

test('the chaplain\'s chest square on the OCP: 2 inches as worn, 2 feet as the letter reads, in the frame of the figure\'s chest', async () => {
  const b = build('ocp', 'senior', 'Maj', { badges: [{ id: 'christian_chaplin', title: 'Chaplain', level: null }] });
  const pics = await make('chaplainAsWritten', b);
  const badge = scene => core.layerBounds(scene.layers.find(l => l.role === 'badge'));
  const square = scene => scene.layers.find(l => l.key === 'grade:chest-meme');
  assert.ok(!square(pics.off.scene), 'as worn there is no such square');
  assert.equal(square(pics.on.scene).w, 24, 'twenty-four inches across, as the letter reads');
  assert.ok(badge(pics.on.scene).w > 10 * badge(pics.off.scene).w, 'the badge scaled to it');
  assert.deepEqual(pics.on.scene.bounds, pics.off.scene.bounds);
});

test('the polo\'s embroidered name is the engine\'s text in white thread (the member\'s own name, or the word NAME where none is typed); "Over the name" is the badge or the title 1/2 in over it', async () => {
  const named = await make('poloName', build('polo', 'senior', 'Capt', { name: { first: 'Pat', last: 'Doe', show: true } }));
  const text = scene => scene.layers.find(l => l.key === 'text:polo-name');
  assert.ok(text(named.on.scene) && !text(named.off.scene));
  assert.equal(text(named.on.scene).text, 'PAT DOE');
  const unnamed = await make('poloName', build('polo', 'senior', 'Capt', { name: { first: '', last: '', show: false } }));
  assert.equal(text(unnamed.on.scene).text, 'NAME', 'shown even where the member has the name hidden or none typed');
  const mark = await make('poloMark', build('polo', 'senior', 'Capt', { opt: { dutyTitle: 'Commander' } }), ['badge', 'title']);
  const title = mark.title.scene.layers.find(l => l.key === 'text:polo-title');
  assert.equal(title.text, 'COMMANDER', 'the member\'s own title');
  assert.ok(mark.badge.scene.layers.some(l => l.role === 'blank'), 'no badge chosen: the place of one is a blank square');
  const blank = mark.badge.scene.layers.find(l => l.role === 'blank');
  assert.ok(near(blank.y + blank.h, title.y + title.h / 2 + 0, 2), 'on the title\'s line, 1/2 in over the name');
  assert.deepEqual(mark.badge.scene.bounds, mark.title.scene.bounds);
  const withBadge = await make('poloMark', build('polo', 'senior', 'Capt', { badges: [{ id: 'ground_team_basic_badge', title: 'Ground Team', level: null }] }), ['badge', 'title']);
  assert.ok(withBadge.badge.scene.layers.some(l => l.role === 'badge') && !withBadge.badge.scene.layers.some(l => l.role === 'blank'), 'the member\'s own badge, where the engine puts it');
});

// The state as the page makes the builds the next ones need.
const { context } = loadPageScripts();
const run = code => JSON.parse(vm.runInContext(`JSON.stringify((function(){ ${code} })())`, context));
const pageEnv = Object.assign({}, env, {
  build: () => run('return CAPUBUniformView.buildFromState();'),
  buildWith: change => JSON.parse(JSON.stringify(vm.runInContext('(' + OP.stateBuildWith.toString() + ')', context)(change)))
});
const state = (rank, uniform, membership) => run(`State.membership = ${JSON.stringify(membership || 'senior')}; State.uniform = ${JSON.stringify(uniform)}; State.gender = 'male'; State.rank = ${JSON.stringify(rank)}; State.badges = []; State.garment = {}; return 1;`);

test('the appointed command chief: the chief master sergeant\'s chevron and the command chief\'s, as the engine draws the grade, at one scale; the garment options are put back', async () => {
  state('CMSgt', 'blues_b');
  const pics = await OP.RECIPES.commandChief.make(pageEnv, pageEnv.build(), ['off', 'on']);
  const id = scene => scene.layers.find(l => l.role === 'grade').id;
  assert.match(id(pics.off.scene), /^rank-senior-chief-master-sergeant-chevron-/);
  assert.match(id(pics.on.scene), /^rank-senior-command-chief-chevron-/);
  assert.deepEqual(pics.off.scene.bounds, pics.on.scene.bounds);
  assert.deepEqual(run('return State.garment;'), {}, 'the state is as it was');
  state('MSgt', 'blues_b');
  assert.deepEqual(await OP.RECIPES.commandChief.make(pageEnv, pageEnv.build(), ['off', 'on']), { off: false, on: false }, 'another grade has no command chief');
});

test('working toward a grade: the cap each track wears (the officer\'s with its device, the NCO\'s without), where the uniform has one; not offered where it draws the same', async () => {
  state('SM', 'blues_b');
  const pics = await OP.RECIPES.noGradeTrack.make(pageEnv, pageEnv.build(), ['officer', 'nco']);
  const ids = scene => scene.layers.map(l => l.id);
  assert.ok(ids(pics.officer.scene).some(id => /cap-device-officer-flight/.test(id)));
  assert.ok(!ids(pics.nco.scene).some(id => /cap-device/.test(id)));
  state('SM', 'aviator');
  assert.deepEqual(await OP.RECIPES.noGradeTrack.make(pageEnv, pageEnv.build(), ['officer', 'nco']), { officer: false, nco: false }, 'no cap on the aviator shirt');
  assert.deepEqual(run('return State.garment;'), {});
});
