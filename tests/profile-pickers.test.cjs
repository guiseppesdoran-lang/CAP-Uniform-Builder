'use strict';
// The Uniform step's cards carry a picture of the uniform (js/profile-pickers.js; the owner, 2026-11-12: "make the uniform selection, and the grade selection visual. mostly
// everything should be visual atp"). The cards stay the buttons (button.uniformOption[data-uniform-id]) that js/setup.js, js/wiring.js and js/workspace-ui.js handle, so what the
// page does with them is unchanged; the script only puts a picture box above each card's name, and the pictures into the boxes as they are made. Here the script runs in a
// sandbox with the small DOM and a stand-in for the pictures; the pictures themselves are tests/profile-pictures.test.cjs.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, Node } = require('./helpers/mini-dom.cjs');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// The small DOM has no insertBefore; the script uses it to put a box first in a card.
if(!Node.prototype.insertBefore) Node.prototype.insertBefore = function(node, ref){
  if(node.parentNode) node.parentNode.removeChild(node);
  node.parentNode = this;
  const at = ref ? this.childNodes.indexOf(ref) : -1;
  if(at < 0) this.childNodes.push(node); else this.childNodes.splice(at, 0, node);
  return node;
};

const IDS = ['blues_a', 'blues_b', 'ceremonial', 'mess_dress', 'abu'];

// The page: the Uniform step, the cards (the first of the cadet's folded away as locked, the ceremonial card hidden for a senior member), the engine's pieces as stand-ins.
function page(state, pictures){
  const doc = createDocument();
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  const shell = doc.createElement('main'); shell.id = 'layoutShell'; doc.body.append(shell);
  const step = doc.createElement('div'); step.id = 'stepGroup-uniform'; step.hidden = false; doc.body.append(step);
  const list = doc.createElement('div'); list.id = 'uniformList'; step.append(list);
  const cards = IDS.map(id => {
    const card = doc.createElement('button');
    card.className = 'uniformOption';
    card.dataset.uniformId = id;
    const name = doc.createElement('div'); name.className = 'uName'; name.textContent = id;
    card.append(name);
    list.append(card);
    return card;
  });
  const asked = [];
  const sandbox = {
    document: doc, console, setTimeout: () => 0,
    State: Object.assign({ membership: 'cadet', rank: 'C/Maj', gender: 'male', uniform: 'blues_a', ceremonial: false }, state),
    CAPUBProfilePictures: { create: env => ({ uniforms: ids => { asked.push([...ids]); return pictures(ids, env); } }) },
    CAPUBUniformRules: {}, CAPUBUniformView: { buildFromState: () => ({}) },
    CAPUBEngine: { core: { createSpecStore: () => ({}) }, profiles: {}, renderSvg: {} },
    CAPUBAssetPacks: { createLoader: () => ({ manifest: () => Promise.resolve({}), prepare: () => Promise.resolve(), spec: () => Promise.resolve({}) }) },
    fetch: () => Promise.reject(new Error('offline')), ASSET: p => 'images/' + p, URL, Blob: function(){}, XMLSerializer: function(){}
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  return { sandbox, doc, step, cards, asked, sync: () => sandbox.CAPUBProfilePickers.sync() };
}
const boxOf = card => card.children.find(n => n.classList.contains('uPicture'));
const imgOf = card => { const b = boxOf(card); return b && b.children.find(n => n.nodeName === 'IMG'); };
const settle = () => new Promise(r => setImmediate(r));
const known = map => (ids => ({ now: Object.fromEntries(ids.map(id => [id, map[id]])), ready: Promise.resolve(Object.fromEntries(ids.map(id => [id, map[id]]))), settled: ids.every(id => map[id] !== undefined) }));

test('each card the member may pick gets a box above its name, and its picture once it is made', async () => {
  const p = page({}, known({ blues_a: 'pic-a', blues_b: 'pic-b', ceremonial: 'pic-c', mess_dress: 'pic-m', abu: 'pic-abu' }));
  p.sync();
  await settle();
  for(const card of p.cards){
    const box = boxOf(card);
    assert.ok(box, `${card.dataset.uniformId}: a box`);
    assert.equal(card.firstChild, box, 'above the name');
    assert.equal(box.getAttribute('aria-hidden'), 'true', 'the name is the card\'s name; the picture is only seen');
    assert.equal(imgOf(card).getAttribute('src'), 'pic-' + { blues_a: 'a', blues_b: 'b', ceremonial: 'c', mess_dress: 'm', abu: 'abu' }[card.dataset.uniformId]);
    assert.equal(imgOf(card).getAttribute('alt'), '');
    assert.ok(card.children.some(n => n.classList.contains('vpTick')), 'the tick for the card picked');
    assert.ok(card.children.some(n => n.classList.contains('uName')), 'the name is still there');
  }
  assert.deepEqual(p.asked, [IDS]);
});

test('a card the member may not pick has no picture asked for: a locked card (folded away) and a hidden one (Honor Guard for a senior member)', async () => {
  const map = { blues_a: 'a', blues_b: 'b', abu: 'abu' };
  const p = page({ membership: 'senior', rank: 'Capt' }, ids => known(map)(ids));
  p.cards[3].classList.add('locked');          // mess dress: locked
  p.cards[2].hidden = true; p.cards[2].classList.add('hidden');   // ceremonial
  p.sync();
  await settle();
  assert.deepEqual(p.asked, [['blues_a', 'blues_b', 'abu']]);
  assert.equal(boxOf(p.cards[3]), undefined, 'no box on the locked card');
  assert.equal(boxOf(p.cards[2]), undefined, 'none on the hidden one');
  assert.ok(imgOf(p.cards[0]) && imgOf(p.cards[1]) && imgOf(p.cards[4]));
  // The member may now pick it (the adult cadet box, a change of membership): it gets its box and its picture.
  map.mess_dress = 'm';
  p.cards[3].classList.remove('locked');
  p.sync();
  await settle();
  assert.deepEqual(p.asked[1], ['blues_a', 'blues_b', 'mess_dress', 'abu']);
  assert.equal(imgOf(p.cards[3]).getAttribute('src'), 'm');
});

test('the boxes hold the cards\' places while the pictures are made, then the pictures arrive', async () => {
  let release;
  const p = page({}, ids => ({ now: Object.fromEntries(ids.map(id => [id, id === 'blues_a' ? 'pic-a' : undefined])), settled: false,
    ready: new Promise(r => { release = () => r(Object.fromEntries(ids.map(id => [id, 'pic-' + id]))); }) }));
  p.sync();
  assert.ok(p.cards.every(c => boxOf(c) && !boxOf(c).hidden), 'every card has its box at once');
  assert.ok(imgOf(p.cards[0]), 'the picture already known is there');
  assert.equal(imgOf(p.cards[1]), undefined, 'the others wait');
  release();
  await settle();
  assert.deepEqual(p.cards.map(c => imgOf(c).getAttribute('src')), IDS.map(id => 'pic-' + id));
});

test('a picture that could not be made leaves the card as its name', async () => {
  const p = page({}, known({ blues_a: 'a', blues_b: null, ceremonial: 'c', mess_dress: 'm', abu: 'abu' }));
  p.sync();
  await settle();
  assert.equal(boxOf(p.cards[1]).hidden, true);
  assert.equal(imgOf(p.cards[1]), undefined);
  assert.equal(boxOf(p.cards[0]).hidden, false);
});

test('no pictures are asked for until the Uniform step is shown and the member has a membership, a rank and a cut', async () => {
  const p = page({}, known({ blues_a: 'a' }));
  p.step.hidden = true;
  p.sync();
  assert.deepEqual(p.asked, [], 'the step is not shown');
  assert.equal(boxOf(p.cards[0]), undefined, 'no boxes either');
  p.step.hidden = false;
  p.sandbox.State.gender = '';
  p.sync();
  assert.deepEqual(p.asked, [], 'no cut yet');
  p.sandbox.State.gender = 'female'; p.sandbox.State.rank = null;
  p.sync();
  assert.deepEqual(p.asked, [], 'no rank');
  p.sandbox.State.rank = 'C/Maj';
  p.sync();
  assert.equal(p.asked.length, 1);
});

test('the card picked is told to assistive technology as well as by its edge and tick', () => {
  const p = page({}, known({}));
  p.step.hidden = true;
  p.cards[1].classList.add('activeUniform');
  p.sync();
  assert.deepEqual(p.cards.map(c => c.getAttribute('aria-pressed')), ['false', 'true', 'false', 'false', 'false']);
  p.cards[1].classList.remove('activeUniform'); p.cards[0].classList.add('activeUniform');
  p.sync();
  assert.deepEqual(p.cards.map(c => c.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false', 'false']);
});

test('the page runs it on every change its steps reach: the rendered drawing, the history, and the Profile step\'s selects', () => {
  const p = page({}, known({ blues_a: 'a' }));
  assert.ok(p.doc.listeners['capub:rendered'].length && p.doc.listeners['capub:history'].length, 'listens for both');
  p.doc.listeners['capub:rendered'][0]();
  assert.equal(p.asked.length, 1);
  const setup = read('js/setup.js');
  assert.match(setup, /function capubSyncSegments\(\)\{[\s\S]*?if\(window\.CAPUBProfilePickers\) window\.CAPUBProfilePickers\.sync\(\);\n\}/, 'the selects\' mirror calls it');
});

test('the cards stay the buttons the page handles: the markup of index.html is unchanged by the pictures', () => {
  const html = read('index.html');
  const cards = [...html.matchAll(/<button class="uniformOption" data-uniform-id="([a-z_]+)" data-allowed-for="([a-z,]+)">\s*<div class="uName">[^<]+<\/div>\s*<div class="uDesc smallText">[^<]+<\/div>\s*<\/button>/g)];
  assert.equal(cards.length, 14, 'fourteen cards, each a name and a description: the picture is put in by the script');
  assert.doesNotMatch(read('js/profile-pickers.js'), /uniformList\.addEventListener|addEventListener\('click'/, 'it handles no click: the page\'s handler does');
});

test('the stylesheet: the picture box is the picker\'s own, in a square, the card picked has its tick, a locked card keeps to its words, and a phone has two cards to a row', () => {
  const css = read('styles/app.css');
  assert.match(css, /\.uniformOption \.uPicture\{aspect-ratio:1 \/ 1;/);
  assert.match(css, /\.uniformOption\.activeUniform \.vpTick\{display:flex\}/);
  assert.match(css, /\.uniformOption\.locked \.uPicture,\.uniformOption\.locked \.vpTick\{display:none\}/);
  assert.match(css, /\.uniformOption \.uPicture\[hidden\]\{display:none\}/);
  const start = css.indexOf('@media (max-width:700px)');
  const phone = css.slice(start, css.indexOf('@media (max-width:360px)', start));
  assert.match(phone, /\.uniformGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
});

// ---- the grade ------------------------------------------------------------------------------------------------------------------------

const G = require('../js/engine/grades.js');
const INDEX = require('../data/asset-index.js');
const RANKS = JSON.parse(JSON.stringify(vm.runInNewContext('(' + /const RANKS = (\{[\s\S]*?\n\});/.exec(read('js/state.js'))[1] + ')')));
const keydown = (key) => ({ type: 'keydown', key, bubbles: true });

// The Profile step's grade: the hidden select (as populateRankSetup fills it for the membership), the host of the picture group, the Profile step, the real picker, the real
// grades' module for the headings and the devices, and a stand-in for drawing them (`devices(items)` answers for the pictures; the default makes 'pic-<grade>' at once).
const madeNow = items => { const now = Object.fromEntries(items.map(i => [i.key, 'pic-' + i.key])); return { now, ready: Promise.resolve(now), settled: true }; };
function gradePage(state, devices){
  const doc = createDocument();
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  const shell = doc.createElement('main'); shell.id = 'layoutShell'; doc.body.append(shell);
  const step = doc.createElement('div'); step.id = 'stepGroup-profile'; step.hidden = false; doc.body.append(step);
  const host = doc.createElement('div'); host.id = 'rankSetupPicker'; step.append(host);
  const select = doc.createElement('select'); select.id = 'rankSetupSelect'; select.value = ''; select.options = []; step.append(select);
  const changes = [], asked = [];
  select.addEventListener('change', e => changes.push(select.value));
  const sandbox = {
    document: doc, console, setTimeout: () => 0, Event: function(type, init){ this.type = type; Object.assign(this, init || {}); },
    State: Object.assign({ membership: '', rank: null, gender: '', uniform: 'blues_a' }, state),
    CAPUBEngine: { grades: G, core: { createSpecStore: () => ({}) }, profiles: {}, renderSvg: {} }, CAPUBAssetIndex: INDEX, ASSET: p => 'images/' + p,
    CAPUBUniformRules: {}, CAPUBUniformView: { buildFromState: () => ({}) },
    CAPUBAssetPacks: { createLoader: () => ({ manifest: () => Promise.resolve({}), prepare: () => Promise.resolve(), spec: () => Promise.resolve({}) }) },
    fetch: () => Promise.reject(new Error('offline')), URL, Blob: function(){}, XMLSerializer: function(){}
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  const real = (() => { const m = {}; vm.runInNewContext(read('js/profile-pictures.js'), Object.assign(m, { window: m, self: m })); return m.CAPUBProfilePictures; })();
  const none = { now: {}, ready: Promise.resolve({}), settled: true };
  sandbox.CAPUBProfilePictures = Object.assign({}, real, { create: () => ({ uniforms: () => none, cuts: () => none, grades: items => { asked.push(JSON.parse(JSON.stringify(items))); return (devices || madeNow)(items); } }) });
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  // What js/setup.js populateRankSetup does for a membership.
  const offer = membership => { sandbox.State.membership = membership; select.options = [{ value: '' }, ...(RANKS[membership] || []).map(value => ({ value }))]; };
  return { sandbox, doc, host, step, select, changes, asked, offer, sync: () => sandbox.CAPUBProfilePickers.sync() };
}
const radios = host => host.querySelectorAll('[role="radio"]');
const headings = host => host.querySelectorAll('.vpGroupHead').map(h => h.textContent);

test('no grade is offered before a membership is chosen: the word Rank and a line saying why, no pictures', () => {
  const p = gradePage({});
  p.sync();
  assert.equal(radios(p.host).length, 0);
  assert.equal(p.host.textContent, 'RankChoose a membership type first.');
});

test('a cadet is shown the cadet grades under their headings, each by its insignia with its name beneath; a senior member the senior grades', async () => {
  const p = gradePage({});
  p.offer('cadet'); p.sync();
  await settle();
  assert.deepEqual(headings(p.host), ['Airmen', 'Non-commissioned officers', 'Officers']);
  assert.deepEqual(radios(p.host).map(r => r.dataset.value), RANKS.cadet);
  assert.deepEqual(radios(p.host).map(r => r.querySelector('.vpLabel').textContent), RANKS.cadet, 'the name as the select has it');
  const art = rank => { const r = radios(p.host).find(x => x.dataset.value === rank); return r.querySelector('.vpPicture'); };
  assert.equal(art('C/Maj').children[0].getAttribute('src'), 'pic-C/Maj', 'the picture made for a cadet major');
  assert.equal(art('C/TSgt').children[0].getAttribute('src'), 'pic-C/TSgt');
  assert.match(art('C/AB').innerHTML, /stroke-dasharray/, 'a grade without insignia is the empty mark');
  p.offer('senior'); p.sync();
  await settle();
  assert.deepEqual(headings(p.host), ['No grade', 'Non-commissioned officers', 'Flight officers', 'Officers', 'General officers']);
  assert.deepEqual(radios(p.host).map(r => r.dataset.value), RANKS.senior);
  assert.equal(art('Col').children[0].getAttribute('src'), 'pic-Col');
  assert.match(art('SM').innerHTML, /stroke-dasharray/);
});

test('the pictures are the devices alone, as worn on the blues: metal chevrons and discs for the cadets, thread for the officers, the chevron without its field and the flight officer\'s bar without its cloth, never a cloth patch', () => {
  const ids = membership => { const p = gradePage({}); p.offer(membership); p.sync(); return p.asked[0]; };
  const cadet = ids('cadet'), senior = ids('senior');
  assert.deepEqual(cadet.map(i => i.key), RANKS.cadet.filter(r => r !== 'C/AB'), 'every grade that wears insignia, not C/AB');
  assert.deepEqual(senior.map(i => i.key), RANKS.senior.filter(r => r !== 'SM'), 'and not SM');
  for(const i of [...cadet, ...senior]){
    assert.doesNotMatch(i.id, /ocp-square|bullion/, `${i.key}: ${i.id}`);
    if(/cloth/.test(i.id)) assert.ok(i.hide.includes('cloth'), `${i.key}: ${i.id} is drawn without its cloth`);
    assert.ok(INDEX[i.id], `${i.key}: ${i.id} is an asset the page has`);
  }
  assert.equal(cadet.find(i => i.key === 'C/SSgt').id, 'rank-cadet-nco-staff-sergeant-metal');
  assert.equal(cadet.find(i => i.key === 'C/Maj').id, 'rank-cadet-officer-major-metal-regular');
  assert.equal(senior.find(i => i.key === 'Capt').id, 'rank-senior-captain-thread');
  assert.deepEqual(senior.filter(i => i.hide.length).map(i => [i.key, i.hide]), [...['SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt'].map(k => [k, ['field']]), ...['FO', 'TFO', 'SFO'].map(k => [k, ['cloth']])], 'the senior chevron\'s navy field and the flight officer bar\'s cloth are what is left off');
  assert.deepEqual(cadet.filter(i => i.hide.length), []);
});

test('the devices are made while the Profile step is shown, and a tile whose picture is still being made holds its place; one that could not be made is its name alone', async () => {
  let release;
  const p = gradePage({}, items => ({ now: Object.fromEntries(items.map(i => [i.key, i.key === 'C/Amn' ? 'pic-known' : undefined])), settled: false,
    ready: new Promise(r => { release = () => r(Object.fromEntries(items.map(i => [i.key, i.key === 'C/Col' ? null : 'pic-' + i.key]))); }) }));
  p.step.hidden = true;
  p.offer('cadet'); p.sync();
  assert.equal(p.asked.length, 0, 'the Profile step is not shown: nothing is made');
  assert.ok(radios(p.host).every(r => !r.querySelector('.vpPicture') || !r.querySelector('.vpPicture').children.some(n => n.nodeName === 'IMG')), 'the boxes are blank');
  p.step.hidden = false; p.sync();
  assert.equal(p.asked.length, 1);
  const tile = rank => radios(p.host).find(r => r.dataset.value === rank);
  const src = rank => { const b = tile(rank).querySelector('.vpPicture'); return b && b.children[0] && b.children[0].getAttribute ? b.children[0].getAttribute('src') : null; };
  assert.equal(src('C/Amn'), 'pic-known', 'the picture known is there');
  assert.equal(src('C/Maj'), null, 'the others wait in blank boxes');
  assert.ok(tile('C/Maj').querySelector('.vpPicture'));
  release(); await settle();
  assert.equal(src('C/Maj'), 'pic-C/Maj');
  assert.equal(tile('C/Col').classList.contains('noPicture'), true, 'a grade whose picture could not be made is its name alone');
  assert.match(tile('C/AB').querySelector('.vpPicture').innerHTML, /stroke-dasharray/);
});

test('it is a radio group named Rank, with a note of the grade picked in words, and the grade picked is the select\'s', () => {
  const p = gradePage({ rank: 'C/Maj' });
  p.offer('cadet'); p.select.value = 'C/Maj'; p.sync();
  const picker = p.host.querySelector('.vp');
  assert.equal(picker.querySelector('.vpLegend').textContent, 'Rank');
  assert.equal(picker.querySelector('[role="radiogroup"]').getAttribute('aria-labelledby'), picker.querySelector('.vpLegend').id);
  assert.equal(picker.dataset.size, 'small', 'small pictures: the grades are many');
  assert.equal(picker.dataset.pickerFor, 'rankSetupSelect', 'the page finds the picture group that stands for the hidden select');
  assert.deepEqual(radios(p.host).filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.value), ['C/Maj']);
  assert.equal(picker.querySelector('.vpNote').textContent, 'Cadet Major');
  // The page sets the select (a saved setup, the report import, Undo): the next sync shows it.
  p.select.value = 'C/Capt'; p.sync();
  assert.deepEqual(radios(p.host).filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.value), ['C/Capt']);
  assert.equal(picker.querySelector('.vpNote').textContent, 'Cadet Captain');
  p.select.value = ''; p.sync();
  assert.equal(radios(p.host).filter(r => r.getAttribute('aria-checked') === 'true').length, 0);
});

test('a pick writes the grade to the select and fires its change, which is what the page\'s own handler listens for', () => {
  const p = gradePage({});
  p.offer('cadet'); p.sync();
  radios(p.host).find(r => r.dataset.value === 'C/SSgt').click();
  assert.equal(p.select.value, 'C/SSgt');
  assert.deepEqual(p.changes, ['C/SSgt']);
  radios(p.host).find(r => r.dataset.value === 'C/Col').click();
  assert.deepEqual(p.changes, ['C/SSgt', 'C/Col']);
  p.select.value = 'C/Col'; p.sync();
  p.sync();
  assert.deepEqual(p.changes, ['C/SSgt', 'C/Col'], 'following the select does not write to it');
});

test('the keyboard: one stop of the Tab key, the arrow keys move through the grades across the headings, Enter picks', () => {
  const p = gradePage({});
  p.offer('senior'); p.select.value = 'Capt'; p.sync();
  const all = radios(p.host);
  assert.deepEqual(all.filter(r => r.tabIndex === 0).map(r => r.dataset.value), ['Capt'], 'the Tab key lands on the grade picked');
  all.find(r => r.dataset.value === 'Capt').focus();
  all.find(r => r.dataset.value === 'Capt').dispatchEvent(keydown('ArrowRight'));
  assert.equal(p.doc.activeElement.dataset.value, 'Maj');
  p.doc.activeElement.dispatchEvent(keydown('End'));
  assert.equal(p.doc.activeElement.dataset.value, 'Maj Gen');
  p.doc.activeElement.dispatchEvent(keydown('Home'));
  assert.equal(p.doc.activeElement.dataset.value, 'SM');
  p.doc.activeElement.dispatchEvent(keydown('Enter'));
  assert.equal(p.select.value, 'SM');
  assert.deepEqual(p.changes, ['SM']);
});

test('the grades are drawn again only when the membership changes the list, so the focus stays on the grade being picked', () => {
  const p = gradePage({});
  p.offer('cadet'); p.sync();
  const first = radios(p.host)[0];
  p.sync(); p.sync();
  assert.equal(radios(p.host)[0], first, 'the same buttons while nothing changes');
  p.offer('senior'); p.sync();
  assert.notEqual(radios(p.host)[0], first);
  p.offer(''); p.select.options = [{ value: '' }]; p.sync();
  assert.equal(radios(p.host).length, 0, 'no membership: no grades again');
  assert.match(p.host.textContent, /Choose a membership type first/);
});

test('index.html: the grade select stays as the hidden source of truth, the way the membership select does, with the host of the pictures before it', () => {
  const html = read('index.html');
  assert.match(html, /<div id="rankSetupPicker" class="mt-10"><\/div>\s*<select id="rankSetupSelect" class="segmentedSource" tabindex="-1" aria-hidden="true" disabled>\s*<option value="">Select rank<\/option>\s*<\/select>/);
  assert.doesNotMatch(html, /for="rankSetupSelect"/, 'no label for a control that cannot be seen or reached');
  assert.match(read('styles/app.css'), /\.segmentedSource\{position:absolute;width:1px;height:1px;margin:-1px;opacity:0;pointer-events:none;overflow:hidden\}/);
});

test('the stylesheet: small tiles wrap to four or five to a row with a square box, for the grades', () => {
  const css = read('styles/app.css');
  assert.match(css, /\.vp\[data-size="small"\] \.vpGrid\{grid-template-columns:repeat\(auto-fill,minmax\(60px,1fr\)\)/);
  assert.match(css, /\.vp\[data-size="small"\] \.vpPicture\{aspect-ratio:1 \/ 1/);
});

test('a notice\'s Choose button for the grade lands the focus on the picture the Tab key stops at', () => {
  const ui = read('js/workspace-ui.js');
  assert.match(ui, /document\.querySelector\(`\.segmented\[data-segments-for="\$\{id\}"\] button, \[data-picker-for="\$\{id\}"\] \[role="radio"\]\[tabindex="0"\]`\)/);
});

// ---- the cut and the first sergeant's diamond -----------------------------------------------------------------------------------------

// The Profile step's cut and diamond: the hidden select and box, their hosts, the step, the real picker, and stand-ins for the pictures.
function cutPage(state, pictures){
  const doc = createDocument();
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  const shell = doc.createElement('main'); shell.id = 'layoutShell'; doc.body.append(shell);
  const step = doc.createElement('div'); step.id = 'stepGroup-profile'; step.hidden = false; doc.body.append(step);
  const cutHost = doc.createElement('div'); cutHost.id = 'cutPicker'; step.append(cutHost);
  const select = doc.createElement('select'); select.id = 'jacketSelect'; select.value = ''; step.append(select);
  const block = doc.createElement('div'); block.id = 'cadetFirstSergeantBlock'; block.className = 'hidden'; step.append(block);
  const box = doc.createElement('input'); box.id = 'cadetFirstSergeantCheckbox'; box.checked = false; block.append(box);
  const fsHost = doc.createElement('div'); fsHost.id = 'firstSergeantPicker'; block.append(fsHost);
  const changes = [], boxChanges = [], asked = [];
  select.addEventListener('change', () => changes.push(select.value));
  box.addEventListener('change', () => boxChanges.push(box.checked));
  const sandbox = {
    document: doc, console, setTimeout: () => 0, Event: function(type, init){ this.type = type; Object.assign(this, init || {}); },
    State: Object.assign({ membership: 'cadet', rank: 'C/MSgt', gender: '', uniform: 'blues_a' }, state),
    CAPUBEngine: { grades: G, core: { createSpecStore: () => ({}) }, profiles: {}, renderSvg: {} }, CAPUBAssetIndex: INDEX, ASSET: p => 'images/' + p,
    CAPUBUniformRules: {}, CAPUBUniformView: { buildFromState: () => ({}) },
    CAPUBAssetPacks: { createLoader: () => ({ manifest: () => Promise.resolve({}), prepare: () => Promise.resolve(), spec: () => Promise.resolve({}) }) },
    fetch: () => Promise.reject(new Error('offline')), URL, Blob: function(){}, XMLSerializer: function(){}
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  const real = (() => { const m = {}; vm.runInNewContext(read('js/profile-pictures.js'), Object.assign(m, { window: m, self: m })); return m.CAPUBProfilePictures; })();
  sandbox.CAPUBProfilePictures = Object.assign({}, real, { create: env => ({ uniforms: () => ({ now: {}, ready: Promise.resolve({}), settled: true }), cuts: () => { asked.push(1); return pictures(env); } }) });
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  return { sandbox, doc, step, cutHost, select, box, block, fsHost, changes, boxChanges, asked, sync: () => sandbox.CAPUBProfilePickers.sync() };
}
const knownCuts = map => () => ({ now: map, ready: Promise.resolve(map), settled: !Object.values(map).includes(undefined) });
const picked = host => radios(host).filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.dataset.value);

test('the cut is two pictures, male and female, under the word Cut, large tall boxes, with the select behind them as the source of truth', async () => {
  const p = cutPage({}, knownCuts({ male: 'pic-male', female: 'pic-female' }));
  p.sync();
  const picker = p.cutHost.querySelector('.vp');
  assert.equal(picker.querySelector('.vpLegend').textContent, 'Cut');
  assert.equal(picker.dataset.size, 'large');
  assert.equal(picker.dataset.shape, 'tall');
  assert.equal(picker.dataset.pickerFor, 'jacketSelect');
  assert.deepEqual(radios(p.cutHost).map(r => r.dataset.value), ['male', 'female']);
  assert.deepEqual(radios(p.cutHost).map(r => r.querySelector('.vpLabel').textContent), ['Male cut', 'Female cut']);
  await settle();
  assert.deepEqual(radios(p.cutHost).map(r => r.querySelector('.vpPicture').children[0].getAttribute('src')), ['pic-male', 'pic-female']);
  assert.deepEqual(picked(p.cutHost), [], 'no cut chosen yet');
  radios(p.cutHost)[1].click();
  assert.equal(p.select.value, 'female');
  assert.deepEqual(p.changes, ['female']);
  p.select.value = 'male'; p.sync();
  assert.deepEqual(picked(p.cutHost), ['male'], 'the page sets the select (a saved setup, Undo): the picture shows it');
  assert.deepEqual(p.changes, ['female'], 'and does not write to it');
});

test('the cut\'s pictures are made once the member has a membership and a grade and the Profile step is shown; before that the boxes hold their places', () => {
  const p = cutPage({ membership: '', rank: null }, knownCuts({ male: 'm', female: 'f' }));
  p.sync();
  assert.equal(p.asked.length, 0, 'no member yet');
  assert.ok(radios(p.cutHost).every(r => r.querySelector('.vpPicture') && !r.querySelector('.vpPicture').querySelector('img')), 'blank boxes, not pictures');
  p.sandbox.State.membership = 'cadet';
  p.sync();
  assert.equal(p.asked.length, 0, 'no grade yet');
  p.sandbox.State.rank = 'C/Maj'; p.step.hidden = true;
  p.sync();
  assert.equal(p.asked.length, 0, 'the Profile step is not the one shown');
  p.step.hidden = false;
  p.sync();
  assert.equal(p.asked.length, 1);
});

test('a change of grade keeps the last pictures until the new ones are made, so the cut does not blink; a picture that cannot be made is the name alone', async () => {
  let phase = 0, release;
  const p = cutPage({}, () => phase === 0 ? { now: { male: 'm1', female: 'f1' }, ready: Promise.resolve({ male: 'm1', female: 'f1' }), settled: true }
    : phase === 1 ? { now: { male: undefined, female: undefined }, ready: new Promise(r => { release = () => r({ male: 'm2', female: 'f2' }); }), settled: false }
      : { now: { male: 'm2', female: null }, ready: Promise.resolve({ male: 'm2', female: null }), settled: true });
  p.sync();
  const srcs = () => radios(p.cutHost).map(r => { const b = r.querySelector('.vpPicture'); return b && b.children[0] && b.children[0].getAttribute ? b.children[0].getAttribute('src') : null; });
  assert.deepEqual(srcs(), ['m1', 'f1']);
  phase = 1; p.sandbox.State.rank = 'C/Col'; p.sync();
  assert.deepEqual(srcs(), ['m1', 'f1'], 'the last pictures stay while the new ones are made');
  release(); await settle();
  assert.deepEqual(srcs(), ['m2', 'f2']);
  phase = 2; p.sandbox.State.rank = 'C/Lt Col'; p.sync();
  assert.deepEqual(srcs(), ['m2', null]);
  assert.equal(radios(p.cutHost)[1].classList.contains('noPicture'), true, 'the cut without a picture is its name alone');
});

test('the first sergeant\'s diamond is two pictures of the member\'s chevron, plain and with the diamond, over the checkbox that stays as the source of truth', () => {
  const p = cutPage({ rank: 'C/SMSgt' }, knownCuts({ male: 'm', female: 'f' }));
  p.sync();
  assert.equal(radios(p.fsHost).length, 0, 'nothing while the block is hidden (a grade that does not take it)');
  p.block.className = '';   // js/catalog.js syncCadetFirstSergeantControl shows the block for C/MSgt, C/SMSgt and C/CMSgt
  p.sync();
  const picker = p.fsHost.querySelector('.vp');
  assert.equal(picker.querySelector('.vpLegend').textContent, 'Cadet First Sergeant diamond');
  assert.equal(picker.dataset.pickerFor, 'cadetFirstSergeantCheckbox');
  assert.deepEqual(radios(p.fsHost).map(r => r.querySelector('.vpLabel').textContent), ['Plain chevron', 'With diamond']);
  assert.deepEqual(radios(p.fsHost).map(r => r.querySelector('.vpPicture').children[0].getAttribute('src')),
    ['images/' + INDEX['rank-cadet-nco-senior-master-sergeant-metal'], 'images/' + INDEX['rank-cadet-nco-senior-master-sergeant-first-sergeant-metal']]);
  assert.deepEqual(picked(p.fsHost), ['plain']);
  radios(p.fsHost)[1].click();
  assert.equal(p.box.checked, true);
  assert.deepEqual(p.boxChanges, [true]);
  radios(p.fsHost)[0].click();
  assert.deepEqual(p.boxChanges, [true, false]);
  p.box.checked = true; p.sync();
  assert.deepEqual(picked(p.fsHost), ['diamond'], 'the page sets the box (a saved setup, Undo): the picture shows it');
  // Another grade that takes it: its own chevron.
  p.sandbox.State.rank = 'C/CMSgt'; p.sync();
  assert.match(radios(p.fsHost)[0].querySelector('.vpPicture').children[0].getAttribute('src'), /rank-cadet-nco-chief-master-sergeant-metal\.svg/);
});

test('index.html: the cut and the diamond stand behind their hosts, the selects and the box kept hidden as the source of truth; the stylesheet has no leftover buttons for them', () => {
  const html = read('index.html');
  assert.match(html, /<section id="genderBlock" class="panelBlock disabledBlock">\s*<div id="cutPicker"><\/div>\s*<select id="jacketSelect" class="segmentedSource" tabindex="-1" aria-hidden="true">/);
  assert.doesNotMatch(html, /id="cutLabel"/);
  assert.match(html, /<div id="cadetFirstSergeantBlock" class="hidden mt-10">\s*<input type="checkbox" id="cadetFirstSergeantCheckbox" class="segmentedSource" tabindex="-1" aria-hidden="true">\s*<div id="firstSergeantPicker"><\/div>\s*<div class="hintText">For C\/MSgt, C\/SMSgt and C\/CMSgt appointed first sergeant \(CAPR 39-1, 10\.10\.4\)\.<\/div>/);
  assert.match(read('js/setup.js'), /cadetFirstSergeantCheckbox\.addEventListener\('change'/, 'the page\'s own handler still listens to the box');
});

// ---- the unit field's shadow text -------------------------------------------------------------------------------------------------------

test('the unit field shows REG-WG-UN while it is empty, and keeps its accessible name; no other input of the page is where a unit charter is typed or searched', () => {
  const html = read('index.html');
  const input = /<input id="unitPatchSearch"[^>]*>/.exec(html)[0];
  assert.match(input, /placeholder="REG-WG-UN"/, 'the shadow text: region, wing, unit');
  assert.match(input, /aria-label="Search your unit"/, 'the label a screen reader reads is as it was');
  assert.match(input, /type="search"/);
  assert.doesNotMatch(html, /Search charter number/, 'the old placeholder is gone');
  // The only other place a unit is typed is the patch submission form, which asks for a unit or an activity by name, not a charter.
  const submit = read('patch-submission.js');
  assert.match(submit, /<label for="capubPatchUnit">Unit \/ activity<\/label>/);
  assert.equal([...html.matchAll(/placeholder="REG-WG-UN"/g)].length, 1, 'one input of the page takes a unit charter');
  assert.equal([...html.matchAll(/placeholder="[^"]*charter[^"]*"/gi)].length, 0);
});

test('the grade tiles are their own dark surface on either theme, the insignia sits on it with no box behind it, no cloth and no white', () => {
  const css = read('styles/app.css');
  // The tokens are the dark theme's own values, defined once on :root (the light block) and so there in both themes.
  const tokens = Object.fromEntries([...css.matchAll(/--grade-([\w-]+):(#[0-9A-Fa-f]{6});/g)].map(m => [m[1], m[2]]));
  const dark = Object.fromEntries([...css.slice(css.indexOf('@media (prefers-color-scheme:dark)')).matchAll(/--(panel|panel-2|ink|line|line-strong|select-bg|select-line):(#[0-9A-Fa-f]{6});/g)].slice(0, 7).map(m => [m[1], m[2]]));
  assert.deepEqual(tokens, { panel: dark.panel, 'panel-2': dark['panel-2'], ink: dark.ink, line: dark.line, 'line-strong': dark['line-strong'], 'select-bg': dark['select-bg'], 'select-line': dark['select-line'] }, 'the dark theme\'s values');
  assert.equal(css.indexOf('--grade-panel:'), css.lastIndexOf('--grade-panel:'), 'once');
  assert.ok(css.indexOf('--grade-panel:') < css.indexOf('@media (prefers-color-scheme:dark)'), 'in the light block, which every theme inherits');
  assert.match(css, /\.vp\[data-name="rank"\] \.vpOption,\.vp\[data-name="firstSergeant"\] \.vpOption\{--panel:var\(--grade-panel\);--panel-2:var\(--grade-panel-2\);--ink:var\(--grade-ink\);--line:var\(--grade-line\);--line-strong:var\(--grade-line-strong\);--select-bg:var\(--grade-select-bg\);--select-line:var\(--grade-select-line\)\}/);
  assert.match(css, /\.vp\[data-name="rank"\] \.vpPicture,\.vp\[data-name="firstSergeant"\] \.vpPicture\{background:transparent;border-color:transparent\}/);
  assert.doesNotMatch(css, /\.vp\[data-name="rank"\][^{]*\{[^}]*(?:filter|drop-shadow)/, 'no halo: Safari did not draw it, and the dark surface needs none');
  assert.doesNotMatch(css.slice(css.indexOf('.badgeChooser{')), /#[0-9a-fA-F]{3,6}\b/, 'and the stylesheet holds no hex outside its tokens');
});

// ---- an image that did not decode, and an address let go too soon ---------------------------------------------------------------------

// The page, with everything the pictures need but the engine's drawing, which is a stand-in that makes a drawing with one <use>; the pictures are the real module's. Object
// addresses are 'blob:<n>' and the ones revoked are kept, so a test can see an address revoked while an image still has it. `compose` answers from `composing` so a test can
// hold the pictures of a member back.
function livePage(state){
  const doc = createDocument();
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  const shell = doc.createElement('main'); shell.id = 'layoutShell'; doc.body.append(shell);
  const profile = doc.createElement('div'); profile.id = 'stepGroup-profile'; profile.hidden = false; doc.body.append(profile);
  const uniform = doc.createElement('div'); uniform.id = 'stepGroup-uniform'; uniform.hidden = true; doc.body.append(uniform);
  const rankHost = doc.createElement('div'); rankHost.id = 'rankSetupPicker'; profile.append(rankHost);
  const rank = doc.createElement('select'); rank.id = 'rankSetupSelect'; rank.value = ''; rank.options = []; profile.append(rank);
  const cutHost = doc.createElement('div'); cutHost.id = 'cutPicker'; profile.append(cutHost);
  const cut = doc.createElement('select'); cut.id = 'jacketSelect'; cut.value = ''; profile.append(cut);
  const list = doc.createElement('div'); list.id = 'uniformList'; uniform.append(list);
  const cards = ['blues_a', 'blues_b', 'abu'].map(id => { const c = doc.createElement('button'); c.className = 'uniformOption'; c.dataset.uniformId = id; list.append(c); return c; });
  const made = [], revoked = new Set(), composing = [];
  let n = 0;
  const sandbox = {
    document: doc, console, Event: function(type, init){ this.type = type; Object.assign(this, init || {}); },
    setTimeout: fn => { fn(); return 0; },
    State: Object.assign({ membership: 'cadet', rank: 'C/Maj', gender: 'male', uniform: 'blues_a', garment: {} }, state),
    CAPUBAssetIndex: INDEX, ASSET: p => 'images/' + p,
    CAPUBUniformRules: RULES_FOR_PAGE, CAPUBUniformView: { buildFromState: () => ({ uniform: sandbox.State.uniform, gender: sandbox.State.gender, membership: sandbox.State.membership, grade: G.gradeInfo(sandbox.State.membership, sandbox.State.rank, {}), opt: {}, name: {} }) },
    CAPUBEngine: {
      grades: G, core: { createSpecStore: () => ({ load: async () => ({ w: 1, h: 1 }), entry: () => ({ path: 'x.svg' }) }) },
      profiles: { composeUniform: build => new Promise(res => { const job = { build, res: () => res({ layers: [], bounds: { x: 0, y: 0, w: 1, h: 1 } }) }; composing.push(job); if(!sandbox.hold) job.res(); }) },
      renderSvg: { buildSvg: async () => ({ tag: 'svg' }) }
    },
    CAPUBAssetPacks: { createLoader: () => ({ manifest: () => Promise.resolve({}), prepare: () => Promise.resolve(), spec: () => Promise.resolve({}) }) },
    fetch: () => Promise.reject(new Error('offline')),
    Blob: function(parts){ this.parts = parts; },
    XMLSerializer: function(){ this.serializeToString = () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"><use href="#a"/></svg>'; },
    URL: { createObjectURL: () => { const u = 'blob:' + (++n); made.push(u); return u; }, revokeObjectURL: u => revoked.add(u) }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/profile-pictures.js'), sandbox);
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  const offer = membership => { sandbox.State.membership = membership; rank.options = [{ value: '' }, ...(RANKS[membership] || []).map(value => ({ value }))]; };
  const srcs = () => doc.body.querySelectorAll('img').map(i => i.getAttribute('src'));
  return { sandbox, doc, rankHost, cutHost, cards, uniform, profile, made, revoked, composing, offer, srcs, sync: () => sandbox.CAPUBProfilePickers.sync(), settle: () => new Promise(r => setImmediate(r)) };
}
const RULES_FOR_PAGE = require('../data/uniform-rules.js');

test('an image the browser cannot decode is not left as its broken-image mark: a grade tile is its name alone, a uniform card its words, and the others\' images are left alone', async () => {
  const p = livePage({});
  p.offer('cadet'); p.sync(); await p.settle(); await p.settle();
  const tiles = radios(p.rankHost);
  const imgOf = tile => tile.querySelector('.vpPicture') && tile.querySelector('.vpPicture').children.find(n => n.nodeName === 'IMG');
  assert.ok(!!imgOf(tiles.find(t => t.dataset.value === 'C/2d Lt')), 'the picture is there');
  const listener = p.doc.listeners.error[0];
  assert.ok(!!(listener && p.doc.listeners.load[0]), 'listens for both, on the page, in the capture phase');
  const bad = imgOf(tiles.find(t => t.dataset.value === 'C/2d Lt'));
  listener({ type: 'error', target: bad });
  const tile = tiles.find(t => t.dataset.value === 'C/2d Lt');
  assert.ok(tile.querySelector('.vpPicture') === null, 'no box, so no broken mark');
  assert.equal(tile.classList.contains('noPicture'), true, 'the name alone');
  assert.ok(tile.querySelector('.vpLabel').textContent === 'C/2d Lt');
  // A picture that loads but has no size is the same failure.
  const zero = imgOf(tiles.find(t => t.dataset.value === 'C/Capt')); zero.naturalWidth = 0;
  p.doc.listeners.load[0]({ type: 'load', target: zero });
  assert.equal(tiles.find(t => t.dataset.value === 'C/Capt').classList.contains('noPicture'), true);
  const good = imgOf(tiles.find(t => t.dataset.value === 'C/Maj')); good.naturalWidth = 320;
  p.doc.listeners.load[0]({ type: 'load', target: good });
  assert.equal(tiles.find(t => t.dataset.value === 'C/Maj').classList.contains('noPicture'), false, 'one that decoded stays');
  // A uniform card's picture.
  p.doc.querySelectorAll('#stepGroup-uniform').length;
  p.uniform.hidden = false; p.sandbox.State.membership = 'cadet'; p.sync(); await p.settle(); await p.settle();
  const card = p.cards[0], box = card.children.find(n => n.classList.contains('uPicture')), img = box.children.find(n => n.nodeName === 'IMG');
  assert.ok(!!img, 'the card has its picture');
  listener({ type: 'error', target: img });
  assert.equal(box.hidden, true, 'the card is its words');
  // An image of another picker or of the page is not ours to take out.
  const other = p.doc.createElement('div'); other.className = 'vp'; other.dataset.name = 'garmentOpt-headgear';
  const oBox = p.doc.createElement('span'); oBox.className = 'vpPicture'; const oImg = p.doc.createElement('img'); oBox.append(oImg); other.append(oBox); p.doc.body.append(other);
  listener({ type: 'error', target: oImg });
  assert.equal(other.querySelector('.vpPicture') !== null, true);
});

test('every picture on the page is one the page still holds: switching membership, grade and cut over and over (more than the pictures kept) never leaves a tile on an address that was let go', async () => {
  const p = livePage({});
  p.uniform.hidden = false;
  const states = [];
  for(let i = 0; i < 2; i++) for(const rank of RANKS.cadet) for(const gender of ['male', 'female']) states.push({ membership: 'cadet', rank, gender, uniform: i % 2 ? 'blues_b' : 'blues_a' });
  assert.ok(states.length * 3 > 80, 'more pictures than are kept');
  let checked = 0;
  for(const state of states){
    Object.assign(p.sandbox.State, state); p.offer(state.membership); p.rank = p.rank;
    p.sync(); await p.settle(); await p.settle();
    // Every image the page shows has an address that has not been let go.
    for(const src of p.srcs()) if(/^blob:/.test(src)){ checked++; assert.equal(p.revoked.has(src), false, `${src} was let go but is on the page`); }
  }
  p.offer('senior'); p.sync(); await p.settle(); await p.settle();
  for(const src of p.srcs()) if(/^blob:/.test(src)) assert.equal(p.revoked.has(src), false, `${src}`);
  assert.ok(checked > 200, `${checked} images checked`);
  assert.ok(p.made.length > 90, `${p.made.length} pictures made, more than the ${80} kept`);
  assert.ok(p.revoked.size > 0, 'old pictures were let go');
});

test('a picture dropped from the kept ones is let go only when no image has it: held while a tile shows it, then revoked at the next change', async () => {
  const p = livePage({ rank: 'C/Maj' });
  p.uniform.hidden = false;
  p.sync(); await p.settle(); await p.settle();
  const shown = p.srcs().filter(s => /^blob:/.test(s));
  assert.ok(shown.length >= 3);
  // Hold back the pictures of every later state, and ask for more than the kept number of them: the first are dropped from the cache, and the tiles still show them.
  p.sandbox.hold = true;
  for(const rank of RANKS.cadet){ for(const gender of ['male', 'female']){ Object.assign(p.sandbox.State, { rank, gender }); p.sync(); } }
  Object.assign(p.sandbox.State, { membership: 'senior', rank: 'Capt' }); p.offer('senior');
  for(const rank of RANKS.senior){ for(const gender of ['male', 'female']){ Object.assign(p.sandbox.State, { rank, gender }); p.sync(); } }
  await p.settle();
  const still = p.srcs().filter(s => /^blob:/.test(s));
  for(const src of still) assert.equal(p.revoked.has(src), false, `${src} is on the page and is held`);
  assert.ok(still.some(s => shown.includes(s)), 'the tiles still show the pictures they had, whose pictures were dropped from the cache');
  // The new pictures arrive, the tiles change, and the addresses nothing shows are let go.
  p.sandbox.hold = false;
  p.composing.splice(0).forEach(job => job.res());
  await p.settle(); await p.settle();
  p.sync();
  for(const src of p.srcs().filter(s => /^blob:/.test(s))) assert.equal(p.revoked.has(src), false, `${src} is on the page`);
  assert.ok(shown.some(s => !p.srcs().includes(s)), 'the old pictures left the page');
  assert.ok(shown.some(s => p.revoked.has(s)), 'and were let go once nothing showed them');
});

// ---- the membership, the weight standard, the name and the unit's emblem ---------------------------------------------------------------

// The Profile step's other choices: the hidden select or box of each, its host, the step, the real picker and the real module (for the pictures' words), and stand-ins for the
// pictures: `stubs` answer for memberships(), adults() and names().
function ownPage(state, stubs){
  const doc = createDocument();
  doc.querySelectorAll = sel => doc.body.querySelectorAll(sel);
  const shell = doc.createElement('main'); shell.id = 'layoutShell'; doc.body.append(shell);
  const step = doc.createElement('div'); step.id = 'stepGroup-profile'; step.hidden = false; doc.body.append(step);
  const el = (tag, id, parent, extra) => { const n = doc.createElement(tag); n.id = id; Object.assign(n, extra || {}); (parent || step).append(n); return n; };
  const memberSel = el('select', 'membershipType', null, { value: '' }), memberHost = el('div', 'membershipPicker');
  const adultRow = el('div', 'adultCadetRow', null, { className: 'hidden mt-10' }), adultBox = el('input', 'adultCadetCheckbox', adultRow, { checked: false }), adultHost = el('div', 'adultCadetPicker', adultRow);
  const nameBox = el('input', 'capubV2ShowText', null, { checked: true }), nameHost = el('div', 'showNamePicker');
  const emblem = el('img', 'unitEmblem', null, { hidden: true });
  const changes = { member: [], adult: [], name: [] }, asked = { memberships: 0, adults: 0, names: 0 };
  memberSel.addEventListener('change', () => changes.member.push(memberSel.value));
  adultBox.addEventListener('change', () => changes.adult.push(adultBox.checked));
  nameBox.addEventListener('change', () => changes.name.push(nameBox.checked));
  const timers = [];
  const sandbox = {
    document: doc, console, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout: id => { if(timers[id - 1]) timers[id - 1].dead = true; },
    Event: function(type, init){ this.type = type; Object.assign(this, init || {}); },
    State: Object.assign({ membership: '', rank: null, gender: '', uniform: 'blues_a' }, state),
    CAPUBEngine: { grades: G, core: { createSpecStore: () => ({}) }, profiles: {}, renderSvg: {} }, CAPUBAssetIndex: INDEX, ASSET: p => 'images/' + p,
    CAPUBUniformRules: {}, CAPUBUniformView: { buildFromState: () => ({}) },
    CAPUBAssetPacks: { createLoader: () => ({ manifest: () => Promise.resolve({}), prepare: () => Promise.resolve(), spec: () => Promise.resolve({}) }) },
    fetch: () => Promise.reject(new Error('offline')), URL, Blob: function(){}, XMLSerializer: function(){}
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  const real = (() => { const m = {}; vm.runInNewContext(read('js/profile-pictures.js'), Object.assign(m, { window: m, self: m })); return m.CAPUBProfilePictures; })();
  const none = { now: {}, ready: Promise.resolve({}), settled: true };
  const answer = (key, fallback) => () => { asked[key]++; return ((stubs && stubs[key]) || (() => fallback))(); };
  sandbox.CAPUBProfilePictures = Object.assign({}, real, { create: () => ({ uniforms: () => none, cuts: () => none, grades: () => none,
    memberships: answer('memberships', { now: { cadet: 'pic-cadet', senior: 'pic-senior' }, ready: Promise.resolve({}), settled: true }),
    adults: answer('adults', { now: { no: 'pic-no', yes: 'pic-yes' }, ready: Promise.resolve({}), settled: true }),
    names: answer('names', { now: { on: 'pic-on', off: 'pic-off' }, ready: Promise.resolve({}), settled: true }) }) });
  vm.runInNewContext(read('js/profile-pickers.js'), sandbox);
  return { sandbox, doc, step, memberSel, memberHost, adultRow, adultBox, adultHost, nameBox, nameHost, emblem, changes, asked, timers, sync: () => sandbox.CAPUBProfilePickers.sync() };
}
const labelsOf = host => radios(host).map(r => r.querySelector('.vpLabel').textContent);
const srcOf = tile => { const b = tile.querySelector('.vpPicture'); const i = b && b.children.find(n => n.nodeName === 'IMG'); return i ? i.getAttribute('src') : null; };

test('the membership is two pictures, the Class A coat of a cadet and of a senior member, over the select that stays the source of truth', () => {
  const p = ownPage({});
  p.sync();
  const picker = p.memberHost.querySelector('.vp');
  assert.equal(picker.querySelector('.vpLegend').textContent, 'Membership type');
  assert.deepEqual(radios(p.memberHost).map(r => r.dataset.value), ['cadet', 'senior']);
  assert.deepEqual(labelsOf(p.memberHost), ['Cadet', 'Senior member']);
  assert.equal(picker.dataset.size, 'large'); assert.equal(picker.dataset.shape, 'tall'); assert.equal(picker.dataset.pickerFor, 'membershipType');
  assert.deepEqual(radios(p.memberHost).map(srcOf), ['pic-cadet', 'pic-senior']);
  assert.deepEqual(picked(p.memberHost), [], 'nothing chosen yet');
  radios(p.memberHost)[1].click();
  assert.equal(p.memberSel.value, 'senior'); assert.deepEqual(p.changes.member, ['senior']);
  p.memberSel.value = 'cadet'; p.sync();
  assert.deepEqual(picked(p.memberHost), ['cadet'], 'the page sets the select (a saved setup, the report import, Undo): the picture shows it');
  assert.deepEqual(p.changes.member, ['senior'], 'and does not write to it');
  p.step.hidden = true; const before = p.asked.memberships; p.sync();
  assert.equal(p.asked.memberships, before, 'the pictures are made while the Profile step is shown');
});

test('a membership picture still being made holds its place, and one that could not be made is the name alone', async () => {
  let release;
  const p = ownPage({}, { memberships: () => ({ now: { cadet: undefined, senior: null }, settled: false, ready: new Promise(r => { release = () => r({ cadet: 'pic-late', senior: null }); }) }) });
  p.sync();
  const [cadet, senior] = radios(p.memberHost);
  assert.ok(cadet.querySelector('.vpPicture') && srcOf(cadet) === null, 'a blank box');
  assert.equal(senior.classList.contains('noPicture'), true, 'its name alone');
  release(); await settle();
  assert.equal(srcOf(radios(p.memberHost)[0]), 'pic-late');
});

test('a cadet who is 18 or older and does not meet the weight standard: two pictures over the box, shown to cadets only, the Corporate blazer with its sentence', async () => {
  const p = ownPage({ membership: 'cadet' });
  p.sync();
  assert.equal(p.asked.adults, 0, 'the row is hidden (js/setup.js shows it to cadets): nothing is made');
  p.adultRow.className = 'mt-10'; p.sync();
  const picker = p.adultHost.querySelector('.vp');
  assert.equal(picker.querySelector('.vpLegend').textContent, 'USAF weight standard');
  assert.deepEqual(labelsOf(p.adultHost), ['Meets it, or under 18', '18 or older, does not meet it']);
  assert.deepEqual(radios(p.adultHost).map(srcOf), ['pic-no', 'pic-yes']);
  assert.deepEqual(picked(p.adultHost), ['no']);
  assert.equal(picker.dataset.pickerFor, 'adultCadetCheckbox');
  radios(p.adultHost)[1].click();
  assert.equal(p.adultBox.checked, true); assert.deepEqual(p.changes.adult, [true]);
  assert.equal(picker.querySelector('.vpNote').textContent, 'Cadets in this position may wear the Corporate uniforms (CAPR 39-1, 1.2.5.2).');
  radios(p.adultHost)[0].click();
  assert.deepEqual(p.changes.adult, [true, false]);
  p.adultBox.checked = true; p.sync();
  assert.deepEqual(picked(p.adultHost), ['yes'], 'the page sets the box (a saved setup, Undo): the picture shows it');
  p.sandbox.State.membership = 'senior'; const n = p.asked.adults; p.sync();
  assert.equal(p.asked.adults, n, 'not for a senior member');
});

test('the name on the uniform: two pictures of the uniform at its name, with the name and without it, over the box; none where the uniform draws no name', async () => {
  const p = ownPage({ membership: 'cadet', rank: 'C/Maj', gender: 'male' });
  p.sync();
  const picker = p.nameHost.querySelector('.vp');
  assert.equal(picker.querySelector('.vpLegend').textContent, 'Name on the uniform');
  assert.deepEqual(labelsOf(p.nameHost), ['Show my name', 'Leave it off']);
  assert.deepEqual(radios(p.nameHost).map(srcOf), ['pic-on', 'pic-off']);
  assert.deepEqual(picked(p.nameHost), ['on'], 'the box is checked');
  radios(p.nameHost)[1].click();
  assert.equal(p.nameBox.checked, false); assert.deepEqual(p.changes.name, [false]);
  p.nameBox.checked = true; p.sync();
  assert.deepEqual(picked(p.nameHost), ['on']);
  assert.equal(p.nameHost.hidden, false);
  // The mess dress and the semi-formal coats draw no name: the engine says so (false), and the group is not offered.
  const q = ownPage({ membership: 'senior', rank: 'Capt', gender: 'male', uniform: 'mess_dress' }, { names: () => ({ now: { on: false, off: false }, ready: Promise.resolve({}), settled: true }) });
  q.sync();
  assert.equal(q.nameHost.hidden, true);
  assert.equal(radios(q.nameHost).length, 0);
});

test('the name pictures wait for a pause while the member is typing, and are made at once otherwise; none are made before there is a membership, a grade and a cut', () => {
  const p = ownPage({ membership: 'cadet', rank: 'C/Maj', gender: 'male' });
  const field = p.doc.createElement('input'); field.type = 'text';
  const panel = p.doc.createElement('section'); panel.id = 'capubV2TextPanel'; panel.append(field); p.step.append(panel);
  p.sync();
  const calls = p.asked.names;
  assert.ok(calls >= 1);
  p.doc.activeElement = field;
  p.sync();
  assert.equal(p.asked.names, calls, 'typing: not yet');
  const wait = p.timers.filter(t => !t.dead && t.ms === 500);
  assert.ok(wait.length >= 1, 'a pause of half a second is waited for');
  wait[wait.length - 1].fn();
  assert.equal(p.asked.names, calls + 1, 'then the pictures are made');
  p.doc.activeElement = null;
  const none = ownPage({ membership: 'cadet', rank: null, gender: 'male' });
  none.sync();
  assert.equal(none.asked.names, 0);
});

test('the unit\'s emblem is shown beside its name for a unit that has one, and not otherwise', () => {
  const p = ownPage({});
  const meta = { 'patch-sequoyah': { img: 'patches/patch-sequoyah/patch-sequoyah.png' } };
  p.sandbox.PATCH_META = meta;
  p.sandbox.getSelectedUnitPatchId = () => 'patch-sequoyah';
  p.sync();
  assert.equal(p.emblem.hidden, false);
  assert.equal(p.emblem.getAttribute('src'), 'images/patches/patch-sequoyah/patch-sequoyah.png');
  p.sandbox.getSelectedUnitPatchId = () => null;
  p.sync();
  assert.equal(p.emblem.hidden, true);
  assert.equal(p.emblem.getAttribute('src'), null);
  p.sandbox.getSelectedUnitPatchId = () => 'patch-no-art';
  p.sync();
  assert.equal(p.emblem.hidden, true, 'a unit with no emblem art: its name alone');
  const html = read('index.html');
  assert.match(html, /<div class="unitRow">\s*<select id="unitPatchSelect">[\s\S]*?<\/select>\s*<img id="unitEmblem" class="unitEmblem" alt="" hidden>\s*<\/div>/);
  assert.match(read('styles/app.css'), /\.unitEmblem\{flex:0 0 auto;width:44px;height:44px;object-fit:contain\}/);
});

test('an image of any of these pickers that fails is taken out, and the pictures of the membership, the weight standard and the name are in the guard\'s list', () => {
  const p = ownPage({ membership: 'cadet', rank: 'C/Maj', gender: 'male' });
  p.adultRow.className = 'mt-10';
  p.sync();
  const listener = p.doc.listeners.error[0];
  for(const host of [p.memberHost, p.adultHost, p.nameHost]){
    const tile = radios(host)[0], img = tile.querySelector('.vpPicture').children.find(n => n.nodeName === 'IMG');
    listener({ type: 'error', target: img });
    assert.ok(tile.querySelector('.vpPicture') === null && tile.classList.contains('noPicture'), `${host.id}: the name alone`);
  }
});
