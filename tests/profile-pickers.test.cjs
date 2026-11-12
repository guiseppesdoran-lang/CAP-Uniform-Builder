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

test('a card the member may not pick has no picture asked for: a locked card (folded away) and a hidden one (Ceremonials for a senior member)', async () => {
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
