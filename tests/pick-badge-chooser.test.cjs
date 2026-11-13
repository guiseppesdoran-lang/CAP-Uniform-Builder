'use strict';
// The owner (2026-11-12, on the "CAP aviation badge, one is worn" list of radio buttons): "This ui should be visual". Which badge takes each place is chosen from picture tiles (the
// badge's own drawing and its name, the picture picker of js/visual-picker.js), one group per place; the badge shown is the picked tile. A tile is the picture and the name (the owner,
// 2026-11-13: "remove these lower letters"); what the drawing did with the badge the member just picked (its place, and the rule that decides which badge goes there, with its paragraph)
// is said once in the status line under the tiles; no "shown" or "not shown". No radio button is left in it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocument, keydown, Node } = require('./helpers/mini-dom.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PILOT = 'CAPPilot1_FA9D33EA587D8', OBSERVER = 'observer_badge', AIRCREW = 'air_crew_badge', ES = 'emergency_services_badge', COMM = 'communications_badge', IT = 'information_technology_badge';

// The page's chooser in a small DOM: the Badges card it sits in, the picker, the view that builds it.
Node.prototype.insertAdjacentElement = function(where, node){
  const parent = this.parentNode, i = parent.childNodes.indexOf(this);
  if(node.parentNode) node.parentNode.removeChild(node);
  node.parentNode = parent;
  parent.childNodes.splice(where === 'afterend' ? i + 1 : i, 0, node);
  return node;
};
// The small DOM keeps data-* in dataset only; the page's selectors read them as attributes.
const plainGet = Node.prototype.getAttribute;
Node.prototype.getAttribute = function(k){
  if(/^data-/.test(k)){ const key = k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase()); if(this.dataset && key in this.dataset) return String(this.dataset[key]); }
  return plainGet.call(this, k);
};
function page(){
  const doc = createDocument();
  const group = doc.createElement('section'); group.id = 'groupBadges'; doc.body.append(group);
  const rule = doc.createElement('div'); rule.className = 'hintText'; group.append(rule);
  const sandbox = {
    document: doc, console, State: { uniform: 'blues_a', badgeChoices: {}, badges: [] },
    CAPUBEngine: {}, CAPUBAssetPacks: { createLoader: () => ({}) }, ASSET: p => 'images/' + p,
    getBadgeAssetPath: id => `badges/${id}.svg`, requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout(){}, CSS: { escape: s => String(s) },
    Event: function(type, init){ this.type = type; Object.assign(this, init); }, CustomEvent: function(type, init){ this.type = type; Object.assign(this, init); }
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.runInNewContext(read('js/visual-picker.js'), sandbox);
  vm.runInNewContext(read('js/pick-lists.js'), sandbox);
  vm.runInNewContext(read('js/uniform-view.js'), sandbox);
  // What the drawing did with each badge chosen (js/badge-rules.js capubBadgeSummary), as the test says it.
  sandbox.badgeRows = [];
  sandbox.capubBadgeSummary = () => sandbox.badgeRows;
  return { sandbox, doc, host: () => doc.getElementById('badgeChooser') };
}
const SINGLE = { position: 'aviation', label: 'CAP aviation badge', limit: 1, candidates: [{ id: PILOT, title: 'Pilot Badge' }, { id: OBSERVER, title: 'Observer Badge' }, { id: AIRCREW, title: 'Air Crew Badge' }], shown: [OBSERVER], choice: OBSERVER,
  slots: [{ key: 'only', label: 'CAP aviation badge', choice: OBSERVER, badge: OBSERVER, shown: true }] };
const SEVERAL = { position: 'pocket', label: 'Pocket and name tag badges', limit: 3, candidates: [{ id: ES, title: 'Emergency Services' }, { id: COMM, title: 'Communications' }, { id: IT, title: 'Information Technology' }], shown: [ES, COMM],
  slots: [{ key: 'left-pocket', label: 'Left pocket', choice: ES, badge: ES, shown: true }, { key: 'right-pocket', label: 'Right pocket', choice: COMM, badge: COMM, shown: true }, { key: 'over-nametag', label: 'Over the name tag', choice: null, badge: null, shown: false }] };
const tiles = (host, place) => host.querySelectorAll('.badgeChooserList').find(l => l.dataset.place === place).querySelectorAll('[role="radio"]');

const WHY = 'Only one CAP aviation badge is worn (CAPR 39-1, 4.1.5.2.2.4.1)';
test('which badge takes a place is chosen from picture tiles: each competing badge is a tile with its own drawing and its name and nothing under the name, the one shown picked; no "shown" or "not shown", no radio button or box', () => {
  const p = page();
  p.sandbox.badgeRows = [{ id: PILOT, shown: false, place: '', why: WHY }, { id: OBSERVER, shown: true, place: 'above the Ground Team Badge', why: '' }, { id: AIRCREW, shown: false, place: '', why: WHY }];
  p.sandbox.CAPUBUniformView.updateBadgeChooser({ conflicts: [Object.assign({}, SINGLE, { why: WHY })] });
  const host = p.host();
  assert.ok(host && !host.classList.contains('hidden'));
  const t = tiles(host, 'only');
  assert.deepEqual(t.map(x => x.querySelector('.vpLabel').textContent), ['Pilot Badge', 'Observer Badge', 'Air Crew Badge']);
  assert.deepEqual(t.map(x => x.getAttribute('aria-checked')), ['false', 'true', 'false'], 'the badge shown is the picked tile');
  assert.deepEqual(t.map(x => x.querySelector('.vpMark')), [null, null, null], 'no mark on a tile');
  // Nothing under a name: no place, no reason, no question mark.
  assert.equal(host.querySelectorAll('.vpCaption').length, 0, 'no line under any name');
  assert.doesNotMatch(host.textContent, /Only one CAP|above the Ground Team|\bshown\b/i, 'no reason or place on the tiles, no "shown" or "not shown" anywhere in the chooser');
  assert.deepEqual(t.map(x => x.querySelector('img') ? x.querySelector('img').getAttribute('src') : null), [PILOT, OBSERVER, AIRCREW].map(id => `images/badges/${id}.svg`), 'the badge\'s own drawing');
  assert.equal(host.querySelectorAll('input').length, 0, 'no input at all: no radio, no checkbox');
  const group = host.querySelector('[role="radiogroup"]');
  assert.equal(group.getAttribute('aria-labelledby'), 'badgeChooserHead-aviation', 'named by the heading above it');
  assert.equal(host.querySelector('.badgeChooserCount').textContent, 'One is worn');
  const say = host.querySelector('.badgeChooserSay');
  assert.ok(say && say.getAttribute('role') === 'status' && say.hidden === true, 'a status line under the tiles, empty until a tile is tapped');
});

test('a pick says in the status line under the tiles where the badge is worn and the rule that decides which badge goes there, once', () => {
  const p = page();
  const view = p.sandbox.CAPUBUniformView;
  p.sandbox.badgeRows = [{ id: OBSERVER, name: 'Observer Badge', shown: true, place: 'above the Ground Team Badge', why: '' }];
  view.updateBadgeChooser({ conflicts: [Object.assign({}, SINGLE, { why: WHY })] });
  const say = () => p.host().querySelector('.badgeChooserSay');
  assert.equal(say().hidden, true);
  tiles(p.host(), 'only')[2].click();
  // The drawing is made with the new choice.
  p.sandbox.badgeRows = [{ id: AIRCREW, name: 'Air Crew Badge', shown: true, place: 'above the CAP tape', why: '' }];
  view.updateBadgeChooser({ conflicts: [Object.assign({}, SINGLE, { why: WHY, shown: [AIRCREW], choice: AIRCREW, slots: [{ key: 'only', label: SINGLE.label, choice: AIRCREW, badge: AIRCREW, shown: true }] })] });
  assert.equal(say().hidden, false);
  assert.equal(say().textContent, `Air Crew Badge: above the CAP tape. ${WHY}`, 'the place, then the rule with its paragraph');
  // Not said again by a later drawing of the same choice (it stays until the next pick).
  p.sandbox.badgeRows = [];
  view.updateBadgeChooser({ conflicts: [Object.assign({}, SINGLE, { why: WHY, shown: [AIRCREW], choice: AIRCREW, slots: [{ key: 'only', label: SINGLE.label, choice: AIRCREW, badge: AIRCREW, shown: true }] })] });
  assert.equal(say().textContent, `Air Crew Badge: above the CAP tape. ${WHY}`);
  // A badge the drawing leaves off gives its reason.
  tiles(p.host(), 'only')[0].click();
  p.sandbox.badgeRows = [{ id: PILOT, name: 'Pilot Badge', shown: false, place: '', why: 'No place is left for it (CAPR 39-1, 4.1.5.2.2.4)' }];
  view.updateBadgeChooser({ conflicts: [Object.assign({}, SINGLE, { why: WHY, shown: [AIRCREW], choice: PILOT, slots: [{ key: 'only', label: SINGLE.label, choice: PILOT, badge: AIRCREW, shown: true }] })] });
  assert.equal(say().textContent, `Pilot Badge is not shown. No place is left for it (CAPR 39-1, 4.1.5.2.2.4) ${WHY}`);
});

test('tapping a tile picks that badge for the place: the choice the build is made from (State.badgeChoices of the uniform) changes, and the keyboard does the same', () => {
  const p = page();
  const view = p.sandbox.CAPUBUniformView;
  view.updateBadgeChooser({ conflicts: [SINGLE] });
  tiles(p.host(), 'only')[0].click();
  assert.deepEqual(JSON.parse(JSON.stringify(p.sandbox.State.badgeChoices)), { blues_a: { aviation: PILOT } });
  // After the drawing the page reports the new choice: the tile picked follows.
  view.updateBadgeChooser({ conflicts: [Object.assign({}, SINGLE, { shown: [PILOT], choice: PILOT, slots: [{ key: 'only', label: SINGLE.label, choice: PILOT, badge: PILOT, shown: true }] })] });
  assert.deepEqual(tiles(p.host(), 'only').map(x => x.getAttribute('aria-checked')), ['true', 'false', 'false']);
  const again = tiles(p.host(), 'only');
  again[0].focus();
  again[0].dispatchEvent(keydown('ArrowRight'));
  p.doc.activeElement.dispatchEvent(keydown('Enter'));
  assert.equal(p.sandbox.State.badgeChoices.blues_a.aviation, OBSERVER);
});

test('a position with several places has a group of tiles for each place; picking a badge held by another place swaps the two', () => {
  const p = page();
  const view = p.sandbox.CAPUBUniformView;
  view.updateBadgeChooser({ conflicts: [SEVERAL] });
  const host = p.host();
  assert.deepEqual(host.querySelectorAll('.badgeChooserSlotName').map(n => n.textContent), ['Left pocket', 'Right pocket', 'Over the name tag']);
  assert.equal(host.querySelectorAll('[role="radiogroup"]').length, 3);
  assert.equal(host.querySelectorAll('input').length, 0);
  assert.deepEqual(tiles(host, 'left-pocket').map(x => x.getAttribute('aria-checked')), ['true', 'false', 'false']);
  assert.deepEqual(tiles(host, 'over-nametag').map(x => x.getAttribute('aria-checked')), ['false', 'false', 'false'], 'a place with no badge picks none');
  tiles(host, 'left-pocket')[1].click();       // the communications badge moves to the left pocket; the emergency services badge takes the place it had
  assert.deepEqual(JSON.parse(JSON.stringify(p.sandbox.State.badgeChoices.blues_a.pocket)), { 'left-pocket': COMM, 'right-pocket': ES, 'over-nametag': '' });
  assert.deepEqual(host.querySelectorAll('.badgeChooserSlotHead').map(h => h.childNodes.length), [1, 1, 1], 'a place\'s heading row is its name alone: no "shown" or "not shown"');
  assert.doesNotMatch(host.textContent, /\bshown\b/i);
});

test('the chooser is hidden with nothing to choose, and the old radio rows are gone from the code', () => {
  const p = page();
  p.sandbox.CAPUBUniformView.updateBadgeChooser({ conflicts: [SINGLE] });
  p.sandbox.CAPUBUniformView.updateBadgeChooser({ conflicts: [] });
  assert.ok(p.host().classList.contains('hidden'));
  const src = read('js/uniform-view.js');
  const chooser = src.slice(src.indexOf("const CHOOSER_ID = 'badgeChooser'"), src.indexOf('// ---- Ribbon picker'));
  assert.doesNotMatch(chooser, /type = 'radio'|createElement\('input'\)|createElement\('select'\)/);
  assert.match(chooser, /VisualPicker\.render\(/);
});

test('in a real browser, the badge for each place is picked by its tile, the engine moves it, and the arrow keys stay within the place (needs Chrome)', { timeout: 150000 }, t => {
  const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if(!fs.existsSync(chrome)) return t.skip('Chrome not installed');
  const r = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'badge-chooser-browser.cjs')], { encoding: 'utf8', timeout: 140000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS$/m);
});
