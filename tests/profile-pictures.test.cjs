'use strict';
// The pictures of the Uniform step (js/profile-pictures.js; the owner, 2026-11-12: "make the uniform selection, and the grade selection visual. mostly everything should be
// visual atp"). A card's picture is the engine's composition of the uniform for the member as they are, bare: their cut, their grade and their garment choices, and nothing they
// chose elsewhere (ribbons, badges, patches, name, cord, cap). Honor Guard is the coat or the shirt with the honor guard items on. The composition here is the real engine on the
// real art; only the drawing (an SVG in a browser) is replaced by a record of the scene it was asked to draw.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = require('../js/engine/core.js');
const P = require('../js/engine/profiles.js');
require('../js/engine/profiles-field.js');
require('../js/engine/profiles-dress.js');
require('../js/engine/profiles-polo.js');
const HARNESS = require('../scripts/render-builds.cjs');
const RULES = require('../data/uniform-rules.js');
const PP = require('../js/profile-pictures.js');

const manifest = JSON.parse(read('images/MANIFEST.json'));
const store = core.createSpecStore(manifest, p => Promise.resolve(JSON.parse(read('images/' + p))));

// The uniform cards, as index.html lists them, with who is offered each.
const CARDS = [...read('index.html').matchAll(/<button class="uniformOption" data-uniform-id="([a-z_]+)" data-allowed-for="([a-z,]+)">/g)].map(m => ({ id: m[1], for: m[2].split(',') }));
const IDS = (membership, adult) => CARDS.filter(c => c.for.includes(membership) || (adult && membership === 'cadet' && RULES.isUniformAllowedFor(c.id, 'cadet', { adultCadet: true }))).map(c => c.id);

// What the page would hand the engine for a member who has chosen everything (ribbons, badges, patches, name, a cord, a cap) on the uniform they are on.
function member(spec){
  const m = Object.assign({ uniform: 'blues_a', gender: 'male', membership: 'cadet', rank: 'C/Maj', ribbonSel: [['wright_brothers_award'], ['curry_achievement']], badgeIds: ['observer_badge'],
    name: { first: 'Pat', last: 'Doe', show: true }, cord: 'honor_guard', opt: {} }, spec || {});
  return () => {
    const b = HARNESS.makeBuild(Object.assign({}, m, { opt: Object.assign({ headgear: 'auto' }, m.opt) }));
    b.opt = Object.assign({ rackColumns: 3, rackArrangement: 'lapel', miniStyle: 'mounting' }, b.opt);
    return b;
  };
}
function envOf(build, record){
  const log = record || { composed: [], drawn: [], released: [] };
  return {
    log,
    rules: RULES,
    build,
    compose: async b => { log.composed.push(b); return P.composeUniform(b, store); },
    draw: async (scene, pad) => { log.drawn.push({ scene, pad }); return 'picture:' + log.drawn.length; },
    release: url => log.released.push(url)
  };
}
const idsOf = scene => scene.layers.filter(l => l.type === 'asset').map(l => l.id);
const rolesOf = scene => new Set(scene.layers.map(l => l.role));

test('a picture is the member bare: their cut, grade and garment choices stay, what they chose elsewhere goes', () => {
  const base = member({ gender: 'female', rank: 'C/Capt', opt: { sleeve: 'long' }, ribbonSel: [['curry_achievement']], badgeIds: ['observer_badge'], patches: [], command: null })();
  base.badgeChoices = { x: 1 }; base.badgeOrder = { occupational: ['a', 'b'] }; base.ceremonial = { role: 'flag', chinstrap: 'up' }; base.cordOnTop = true; base.cord = 'honor_guard';
  assert.ok(base.ribbons.length && base.badges.length && base.name.show, 'the member has chosen items');
  const b = PP.bare(RULES, base, { uniform: 'blues_b' });
  assert.equal(b.uniform, 'blues_b', 'the card\'s uniform');
  assert.equal(b.gender, 'female');
  assert.equal(b.membership, 'cadet');
  assert.equal(b.grade.rank, 'C/Capt');
  assert.equal(b.opt.sleeve, 'long', 'the garment choices are the member\'s');
  for(const k of ['ribbons', 'medals', 'badges', 'patches', 'militaryBadges']) assert.deepEqual(b[k], [], k);
  assert.equal(b.command, null);
  assert.equal(b.cord, null, 'no cord');
  assert.equal(b.cordColour, null);
  assert.equal(b.name.show, false, 'no name');
  assert.equal(b.name.last, '');
  assert.equal(b.opt.headgear, 'none', 'no cap, so the garment fills the picture');
  assert.deepEqual(b.badgeChoices, {});
  assert.deepEqual(b.badgeOrder, {});
  assert.equal('ceremonial' in b, false, 'the member\'s honor guard items are not on the other uniforms\' pictures');
  assert.equal('cordOnTop' in b, false);
  for(const k of ['rackColumns', 'rackAlign', 'rackArrangement', 'rackCounts', 'miniStyle']) assert.equal(k in b.opt, false, `the ribbon rack's ${k} does not change a bare garment`);
  assert.equal(base.opt.headgear, 'auto', 'the member\'s own build is not changed');
  assert.equal(base.ribbons.length > 0, true);
});

test('Honor Guard is the coat or the shirt with the honor guard items: the guard role and the silver cord, the member\'s own role, chinstrap and shirt kept', () => {
  const coat = PP.bare(RULES, member({ uniform: 'ocp' })(), { ceremonial: true });
  assert.equal(coat.uniform, 'blues_a', 'the coat when the member is not on the shirt');
  assert.deepEqual(coat.ceremonial, { role: 'guard', chinstrap: 'down' });
  assert.equal(coat.cord, 'honor_guard');
  assert.equal(coat.cordOnTop, true);
  const shirt = PP.bare(RULES, member({ uniform: 'blues_b', opt: { sleeve: 'short' } })(), { ceremonial: true });
  assert.equal(shirt.uniform, 'blues_b', 'the shirt when that is where the member is');
  assert.deepEqual(shirt.ceremonial, { role: 'guard', chinstrap: 'up' }, 'the chinstrap the guidance figure has with short sleeves');
  const own = PP.bare(RULES, member({ uniform: 'blues_b', opt: { sleeve: 'long', cerRole: 'flag', chinstrap: 'up' } })(), { ceremonial: true });
  assert.deepEqual(own.ceremonial, { role: 'flag', chinstrap: 'up' }, 'the role and the chinstrap the member picked');
});

for(const membership of ['cadet', 'senior']) for(const gender of ['male', 'female']){
  test(`${membership}, ${gender} cut: every card the member may pick is the engine's picture of that uniform, bare`, async () => {
    const rank = membership === 'cadet' ? 'C/Maj' : 'Capt';
    const env = envOf(member({ membership, rank, gender }));
    const ids = IDS(membership);
    assert.ok(ids.length >= 7, `the cards ${ids}`);
    const made = PP.create(env).uniforms(ids);
    assert.equal(made.settled, false, 'nothing is made yet');
    assert.deepEqual(Object.keys(made.now), ids, 'a picture for each card, in the page\'s order');
    assert.ok(ids.every(id => made.now[id] === undefined), 'still being made');
    const done = await made.ready;
    assert.ok(ids.every(id => /^picture:\d+$/.test(done[id])), `a picture each: ${JSON.stringify(done)}`);
    assert.equal(env.log.drawn.length, ids.length);
    ids.forEach((id, i) => {
      const scene = env.log.drawn.find(d => d.scene.uniform === (id === 'ceremonial' ? 'blues_a' : id)).scene;
      const roles = rolesOf(scene);
      assert.ok(scene.layers.some(l => l.role === 'garment'), `${id}: the garment`);
      for(const gone of ['ribbon', 'mini', 'mini-medal', 'badge', 'hat', 'hat-device', 'text']) assert.equal(roles.has(gone), false, `${id}: no ${gone}`);
      if(id !== 'ceremonial') assert.equal(idsOf(scene).some(a => /-cord-/.test(a)), false, `${id}: no cord`);
      assert.equal(scene.layers.some(l => l.type === 'clear' || l.type === 'measure'), false, `${id}: nothing laid for an overlay that is not drawn`);
      assert.ok(env.log.drawn[i].pad > 0, 'a margin of white');
    });
    for(const d of env.log.composed) assert.equal(d.gender, gender, 'the member\'s cut');
  });
}

test('the grade is the member\'s own on the picture: a cadet colonel\'s Class A carries the colonel\'s insignia, a C/AB\'s none', async () => {
  const gradeIds = async rank => {
    const env = envOf(member({ rank }));
    const done = await PP.create(env).uniforms(['blues_a']).ready;
    assert.ok(done.blues_a);
    return idsOf(env.log.drawn[0].scene).filter(id => /^rank-/.test(id));
  };
  const colonel = await gradeIds('C/Col'), basic = await gradeIds('C/AB');
  assert.ok(colonel.some(id => /colonel/.test(id)), `the colonel's insignia: ${colonel}`);
  assert.notDeepEqual(colonel, basic);
});

test('Honor Guard shows what makes it Honor Guard: the white pistol belt and the white ascot on the coat, the cord, and no cap', async () => {
  for(const gender of ['male', 'female']){
    const env = envOf(member({ gender }));
    const done = await PP.create(env).uniforms(['blues_a', 'ceremonial']).ready;
    const plain = env.log.drawn.find(d => d.scene.uniform === 'blues_a' && !idsOf(d.scene).some(id => /honor-guard/.test(id)));
    const guard = env.log.drawn.find(d => idsOf(d.scene).some(id => /honor-guard-belt$/.test(id)));
    assert.ok(plain && guard, `${gender}: the coat and the coat with the honor guard items`);
    assert.ok(idsOf(guard.scene).some(id => /honor-guard-ascot$/.test(id)), 'the ascot');
    assert.ok(idsOf(guard.scene).some(id => /-cord-/.test(id)), 'the silver cord');
    assert.equal(idsOf(guard.scene).some(id => /honor-guard-flag-sling$/.test(id)), false, 'the belt, not the sling');
    assert.equal(rolesOf(guard.scene).has('hat'), false, 'no cap');
    assert.ok(done.ceremonial && done.blues_a);
    assert.notEqual(done.ceremonial, done.blues_a, 'a picture of its own');
  }
});

test('a picture is made once for the member and the choices it shows, and again when one of them changes', async () => {
  let build = member({ rank: 'C/Maj' });
  const env = envOf(() => build());
  const made = PP.create(env);
  const ids = ['blues_a', 'ocp'];
  const first = await made.uniforms(ids).ready;
  assert.equal(env.log.composed.length, 2);
  const again = made.uniforms(ids);
  assert.equal(again.settled, true, 'known at once');
  assert.deepEqual(again.now, first);
  assert.equal(env.log.composed.length, 2, 'not composed again');
  // What is chosen on other steps does not change a picture: the ribbons, the badges, the name, the rack's layout, the cord.
  build = member({ rank: 'C/Maj', ribbonSel: [], badgeIds: [], name: { first: '', last: '', show: false }, cord: null, opt: { rackColumns: 4, rackArrangement: 'standard' } });
  assert.equal(made.uniforms(ids).settled, true, 'the same pictures');
  // The grade, the cut and the garment choices do.
  build = member({ rank: 'C/Lt Col' });
  assert.equal(made.uniforms(ids).settled, false, 'another grade');
  await made.uniforms(ids).ready;
  assert.equal(env.log.composed.length, 4);
  build = member({ rank: 'C/Lt Col', gender: 'female' });
  await made.uniforms(ids).ready;
  assert.equal(env.log.composed.length, 6, 'another cut');
  build = member({ rank: 'C/Lt Col', gender: 'female', opt: { sleeve: 'long' } });
  await made.uniforms(['blues_b']).ready;
  assert.equal(env.log.composed.length, 7, 'another garment choice');
});

test('the newest pictures are kept and the picture address of the rest is let go', async () => {
  const log = { composed: [], drawn: [], released: [] };
  let n = 0;
  const env = {
    rules: RULES, build: () => ({ uniform: 'blues_a', gender: 'male', membership: 'cadet', grade: { rank: 'C/AB' }, opt: { sleeve: 'n' + n }, name: {} }),
    compose: async b => ({ layers: [], bounds: { x: 0, y: 0, w: 1, h: 1 }, tag: b.opt.sleeve }), draw: async scene => 'pic-' + scene.tag, release: url => log.released.push(url)
  };
  const made = PP.create(env);
  for(n = 0; n < 90; n++) await made.uniforms(['blues_a']).ready;
  assert.equal(log.released.length, 10, 'the oldest ten of ninety are let go (eighty are kept)');
  assert.deepEqual(log.released.slice(0, 2), ['pic-n0', 'pic-n1']);
  n = 89;
  assert.equal(made.uniforms(['blues_a']).settled, true, 'the newest is still there');
});

test('a picture that cannot be made is null, so the card is its name alone, and the other pictures are made', async () => {
  const warned = [];
  const env = {
    rules: RULES, build: member({}), warn: (...a) => warned.push(a[0]),
    compose: async b => { if(b.uniform === 'abu') throw new Error('sheet missing'); return { layers: [], bounds: { x: 0, y: 0, w: 1, h: 1 } }; },
    draw: async () => 'ok'
  };
  const done = await PP.create(env).uniforms(['blues_a', 'abu']).ready;
  assert.deepEqual(done, { blues_a: 'ok', abu: null });
  assert.equal(warned.length, 1);
  // No member to draw (the page cannot build one yet): no pictures, and nothing asked of the engine.
  const none = PP.create({ rules: RULES, build: () => { throw new Error('no member'); }, compose: () => { throw new Error('not asked'); } }).uniforms(['blues_a']);
  assert.deepEqual(none.now, { blues_a: null });
  assert.equal(none.settled, true);
});

test('the script is on the page after the engine and the pictures\' own script before the page script, and is a classic script like its neighbours', () => {
  const html = read('index.html');
  const at = s => html.indexOf(`<script src="${s}`);
  for(const s of ['js/engine/profiles-dress.js', 'js/uniform-view.js', 'js/setup.js']) assert.ok(at(s) > 0 && at(s) < at('js/profile-pictures.js'), `after ${s}`);
  assert.ok(at('js/profile-pictures.js') < at('js/profile-pickers.js'));
  assert.match(html, /<script src="js\/profile-pictures\.js\?v=[0-9a-f]{10}" defer><\/script>/);
  assert.match(html, /<script src="js\/profile-pickers\.js\?v=[0-9a-f]{10}" defer><\/script>/);
});

// ---- the grades -----------------------------------------------------------------------------------------------------------------------

const vm = require('node:vm');
const G = require('../js/engine/grades.js');
const INDEX = require('../data/asset-index.js');
const plain = list => JSON.parse(JSON.stringify(list));
const RANKS = plain(vm.runInNewContext('(' + /const RANKS = (\{[\s\S]*?\n\});/.exec(read('js/state.js'))[1] + ')'));

test('the grades are shown under plain headings in the order of rank, each rank once, in the order js/state.js lists them', () => {
  for(const membership of ['cadet', 'senior']){
    const groups = PP.gradeGroups(membership, RANKS[membership]);
    assert.deepEqual(plain(groups.flatMap(g => g.ranks)), RANKS[membership], `${membership}: every grade, once, in the order of rank`);
    assert.ok(groups.every(g => g.group && g.ranks.length), 'every group has a heading and a grade');
  }
  assert.deepEqual(plain(PP.gradeGroups('cadet', RANKS.cadet).map(g => g.group)), ['Airmen', 'Non-commissioned officers', 'Officers']);
  assert.deepEqual(plain(PP.gradeGroups('senior', RANKS.senior).map(g => g.group)), ['No grade', 'Non-commissioned officers', 'Flight officers', 'Officers', 'General officers']);
  // A list the select holds less of (or more) than the table names is shown as it is.
  assert.deepEqual(plain(PP.gradeGroups('cadet', ['C/Maj', 'C/AB'])), [{ group: 'Airmen', ranks: ['C/AB'] }, { group: 'Officers', ranks: ['C/Maj'] }]);
  assert.deepEqual(plain(PP.gradeGroups('cadet', ['C/Maj', 'X'])), [{ group: 'Officers', ranks: ['C/Maj'] }, { group: '', ranks: ['X'] }]);
  assert.deepEqual(PP.gradeGroups('', []), []);
});

test('each grade is shown by the insignia the engine draws for it on the blues, the device alone: metal chevrons and discs, thread, the senior chevron without its field', () => {
  const assetIds = new Set(manifest.assets.map(a => a.id));
  for(const membership of ['cadet', 'senior']) for(const rank of RANKS[membership]){
    const d = PP.gradeDevice(G, membership, rank);
    const g = G.gradeInfo(membership, rank, {});
    if(!g.key){ assert.equal(d, null, `${rank} wears none`); assert.equal(PP.gradeArt(G, membership, rank), null); continue; }
    assert.ok(/^rank-/.test(d.id), `${rank}: ${d.id}`);
    assert.equal(PP.gradeArt(G, membership, rank), d.id);
    assert.ok(assetIds.has(d.id), `${rank}: ${d.id} is in the artwork manifest`);
    assert.ok(INDEX[d.id], `${rank}: ${d.id} has a file the page can address`);
    const svg = read('images/' + INDEX[d.id]);
    const groups = [...svg.matchAll(/<g id="[^"]*?__([^"]*)"/g)].map(m => m[1]);
    // No backing: no cloth group in the file, and the one field a sheet has that is its backing (the senior chevron's) is left off by name.
    assert.equal(groups.includes('cloth'), false, `${rank}: ${d.id} has no cloth`);
    for(const name of d.hide) assert.ok(groups.includes(name), `${rank}: the group ${name} is in the file`);
    assert.equal(groups.filter(n => !d.hide.includes(n)).includes('cloth'), false);
    if(g.category === 'senior-nco') assert.deepEqual(plain(d.hide), ['field'], `${rank}: the navy field the chevron is sewn on`);
    else assert.deepEqual(plain(d.hide), [], `${rank}: nothing to leave off`);
  }
  assert.deepEqual(RANKS.cadet.filter(r => !PP.gradeArt(G, 'cadet', r)), ['C/AB'], 'only a cadet airman basic has no insignia');
  assert.deepEqual(RANKS.senior.filter(r => !PP.gradeArt(G, 'senior', r)), ['SM'], 'only a senior member without grade has none');
  // The forms the Class A coat and its epaulet sleeves wear (js/engine/profiles-dress.js).
  assert.equal(PP.gradeArt(G, 'cadet', 'C/TSgt'), G.cadetNcoChevron(G.gradeInfo('cadet', 'C/TSgt', {}), 'metal'));
  assert.equal(PP.gradeArt(G, 'cadet', 'C/Lt Col'), G.cadetOfficerInsignia(G.gradeInfo('cadet', 'C/Lt Col', {}), 'metal-regular'));
  assert.equal(PP.gradeArt(G, 'senior', 'MSgt'), G.seniorChevron(G.gradeInfo('senior', 'MSgt', {}), {}));
  assert.equal(PP.gradeArt(G, 'senior', 'Maj'), 'rank-senior-major-thread');
  assert.equal(PP.gradeArt(G, 'senior', 'Maj Gen'), 'rank-senior-major-general-1in-vertical-thread');
  assert.equal(PP.gradeArt(G, 'senior', 'TFO'), 'rank-senior-technical-flight-officer-thread');
  assert.equal(new Set(RANKS.cadet.map(r => PP.gradeArt(G, 'cadet', r))).size, RANKS.cadet.length, 'no two cadet grades share a picture (the one without insignia counts once)');
  assert.equal(new Set(RANKS.senior.map(r => PP.gradeArt(G, 'senior', r))).size, RANKS.senior.length, 'no two senior grades share a picture');
});

test('the first sergeant\'s diamond is the cadet chevron the engine draws for it, for the three grades that take it', () => {
  for(const rank of ['C/MSgt', 'C/SMSgt', 'C/CMSgt']){
    const plainId = PP.gradeArt(G, 'cadet', rank), diamond = PP.gradeArt(G, 'cadet', rank, { firstSergeant: true });
    assert.equal(diamond, plainId.replace(/-metal$/, '-first-sergeant-metal'));
    assert.ok(manifest.assets.some(a => a.id === diamond), `${rank}: ${diamond}`);
  }
  assert.equal(PP.gradeArt(G, 'cadet', 'C/SSgt', { firstSergeant: true }), PP.gradeArt(G, 'cadet', 'C/SSgt'), 'a grade that does not take it is as it was');
});

test('the devices are drawn one to a picture, centred in a square its larger side fills, the field of a senior chevron left off, none made twice', async () => {
  const drawn = [], released = [];
  const sizesOf = id => JSON.parse(read('images/' + INDEX[id].replace(/\.svg$/, '.spec.json'))).size_in;
  const env = { rules: RULES, build: member({}), compose: async () => { throw new Error('no composition for a device'); },
    spec: async id => sizesOf(id), draw: async (scene, pad) => { drawn.push({ scene, pad }); return 'pic-' + drawn.length; }, release: u => released.push(u) };
  const made = PP.create(env);
  const items = ['C/SSgt', 'C/Capt', 'C/Maj'].map(r => ({ key: r, ...PP.gradeDevice(G, 'cadet', r) })).concat(['SSgt', 'Col'].map(r => ({ key: r, ...PP.gradeDevice(G, 'senior', r) })));
  const first = made.grades(items);
  assert.equal(first.settled, false);
  assert.deepEqual(Object.keys(first.now), ['C/SSgt', 'C/Capt', 'C/Maj', 'SSgt', 'Col']);
  assert.ok(Object.values(first.now).every(v => v === undefined), 'still being made');
  const done = await first.ready;
  assert.deepEqual(Object.keys(done), ['C/SSgt', 'C/Capt', 'C/Maj', 'SSgt', 'Col']);
  assert.ok(Object.values(done).every(u => /^pic-\d+$/.test(u)));
  assert.equal(drawn.length, 5);
  for(const d of drawn){
    const [layer] = d.scene.layers;
    assert.equal(d.scene.layers.length, 1, 'the device alone: no other layer, no ground');
    assert.equal(layer.type, 'asset');
    assert.equal(d.pad, 0);
    const b = d.scene.bounds, size = sizesOf(layer.id);
    assert.equal(b.w, b.h, 'a square frame');
    assert.ok(Math.abs(b.w - Math.max(size.w, size.h) * 1.08) < 1e-9, 'the larger side of the device fills it');
    assert.ok(Math.abs((layer.x + layer.w / 2) - (b.x + b.w / 2)) < 1e-9 && Math.abs((layer.y + layer.h / 2) - (b.y + b.h / 2)) < 1e-9, 'centred');
    assert.equal(layer.w, size.w); assert.equal(layer.h, size.h, 'at its real size in the frame: a device is not stretched');
  }
  assert.deepEqual(plain(drawn.find(d => /staff-sergeant-chevron-4in$/.test(d.scene.layers[0].id)).scene.layers[0].hideGroups), ['field'], 'the senior chevron without its field');
  assert.equal(drawn.filter(d => d.scene.layers[0].hideGroups).length, 1);
  // The same items again: known at once, nothing drawn again.
  const again = made.grades(items);
  assert.equal(again.settled, true);
  assert.deepEqual(plain(again.now), plain(done));
  assert.equal(drawn.length, 5);
  // A grade that wears none, no items, or nothing to size by: no pictures asked of the engine.
  assert.deepEqual(plain(made.grades([]).now), {});
  const noSpec = PP.create(Object.assign({}, env, { spec: undefined }));
  assert.deepEqual(plain(noSpec.grades(items).now), { 'C/SSgt': null, 'C/Capt': null, 'C/Maj': null, SSgt: null, Col: null });
});

test('a device that cannot be drawn is null and the others are made; the oldest sets are let go', async () => {
  const warned = [], released = [];
  let n = 0;
  const env = { rules: RULES, build: member({}), spec: async () => ({ w: 1, h: 1 }), warn: m => warned.push(m), release: u => released.push(u),
    draw: async scene => { if(scene.layers[0].id === 'rank-cadet-nco-airman-metal') throw new Error('sheet missing'); return 'pic-' + (++n); } };
  const made = PP.create(env);
  const done = await made.grades([{ key: 'C/Amn', id: 'rank-cadet-nco-airman-metal', hide: [] }, { key: 'C/SrA', id: 'rank-cadet-nco-senior-airman-metal', hide: [] }]).ready;
  assert.deepEqual(plain(done), { 'C/Amn': null, 'C/SrA': 'pic-1' });
  assert.equal(warned.length, 1);
  for(let i = 0; i < 7; i++) await made.grades([{ key: 'k', id: 'rank-x' + i, hide: [] }]).ready;
  assert.ok(released.length >= 2, 'sets beyond the newest six are let go, their picture addresses with them');
  assert.ok(released.includes('pic-1'));
});

test('every grade has its name in words', () => {
  assert.equal(PP.gradeName('cadet', 'C/Maj'), 'Cadet Major');
  assert.equal(PP.gradeName('senior', 'SFO'), 'Senior Flight Officer');
  for(const membership of ['cadet', 'senior']) for(const rank of RANKS[membership]){
    const name = PP.gradeName(membership, rank);
    assert.ok(name && name !== rank, `${rank}: ${name}`);
    assert.equal(/^Cadet /.test(name), membership === 'cadet' && rank !== 'SM', `${rank}: cadet names say Cadet`);
  }
});

// ---- the cut ------------------------------------------------------------------------------------------------------------------------

test('the cut is shown by the member\'s own uniform in each cut: the engine\'s pictures of it, the member\'s grade on both, the one in the member\'s own cut shared with its card', async () => {
  const env = envOf(member({ uniform: 'blues_b', gender: 'male', opt: { sleeve: 'long' } }));
  const made = PP.create(env);
  const cards = await made.uniforms(['blues_b']).ready;
  assert.equal(env.log.composed.length, 1);
  const cuts = made.cuts();
  assert.deepEqual(Object.keys(cuts.now), ['male', 'female']);
  assert.equal(cuts.now.male, cards.blues_b, 'the male cut of the uniform the member is on is its card\'s picture, not made again');
  assert.equal(cuts.now.female, undefined, 'the female cut is still to be made');
  const done = await cuts.ready;
  assert.match(done.female, /^picture:\d+$/);
  assert.equal(env.log.composed.length, 2, 'one more composition');
  const female = env.log.composed[1];
  assert.equal(female.gender, 'female');
  assert.equal(female.uniform, 'blues_b', 'the uniform the member is on');
  assert.equal(female.opt.sleeve, 'long', 'with the member\'s own garment choices');
  assert.equal(female.grade.rank, 'C/Maj');
  const scene = env.log.drawn[1].scene;
  assert.ok(idsOf(scene).some(id => /blouse/.test(id)), 'the women\'s blouse sheet, not the men\'s shirt');
});

test('Honor Guard is pictured for the cut as the uniform it rides on, without its items: the cut is the garment\'s', async () => {
  const env = envOf(member({ uniform: 'blues_a' }));
  const base = env.build();
  env.build = () => Object.assign(base, { ceremonial: { role: 'flag', chinstrap: 'up' }, cordOnTop: true, cord: 'honor_guard' });
  await PP.create(env).cuts().ready;
  for(const d of env.log.drawn) assert.equal(idsOf(d.scene).some(id => /honor-guard/.test(id)), false, 'no belt, sling or ascot');
});
