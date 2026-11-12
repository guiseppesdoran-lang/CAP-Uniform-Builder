'use strict';
// The picture picker (js/visual-picker.js): options chosen by picture, the name beneath. One radio group to assistive technology, one stop of the Tab key,
// the arrow keys move and Enter or the space bar picks, the options wrap at any width, the pick is marked by more than colour. The DOM is the small stand-in
// of tests/helpers/mini-dom.cjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDocument, keydown } = require('./helpers/mini-dom.cjs');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const doc = createDocument();
global.document = doc;
const VisualPicker = require('../js/visual-picker.js');

const SQUARE = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
const OPTIONS = [
  { value: 'a', label: 'Patrol cap', picture: SQUARE },
  { value: 'b', label: 'Tactical cap', picture: 'images/hat.svg' },
  { value: '', label: 'No headgear', picture: VisualPicker.emptyMark() }
];

function make(config){
  const host = doc.createElement('div');
  doc.body.append(host);
  const calls = [];
  const p = VisualPicker.render(host, Object.assign({ name: 'headgear', legend: 'Headgear', options: OPTIONS, value: 'a', onChange: v => calls.push(v) }, config));
  return { host, p, calls, radios: () => p.el.querySelectorAll('[role="radio"]') };
}
const checked = radios => radios.map(r => r.getAttribute('aria-checked'));

test('it is a radio group with a radio for each option, the picked one checked, the legend naming the group', () => {
  const { p, radios } = make();
  const group = p.el.querySelector('[role="radiogroup"]');
  assert.ok(group, 'a radiogroup');
  const legend = p.el.querySelector('.vpLegend');
  assert.equal(legend.textContent, 'Headgear');
  assert.equal(group.getAttribute('aria-labelledby'), legend.id);
  assert.equal(radios().length, 3);
  assert.deepEqual(radios().map(r => r.getAttribute('role')), ['radio', 'radio', 'radio']);
  assert.deepEqual(checked(radios()), ['true', 'false', 'false']);
  assert.deepEqual(radios().map(r => r.querySelector('.vpLabel').textContent), ['Patrol cap', 'Tactical cap', 'No headgear']);
  assert.ok(radios().every(r => r.nodeName === 'BUTTON' && r.getAttribute('type') === 'button'), 'real buttons, so they are reached by the keyboard');
});

test('each option carries its value, the picker its size and shape, so the page can find an option again and the styles can shape the boxes', () => {
  const { radios, p } = make({ size: 'large', shape: 'tall' });
  assert.deepEqual(radios().map(r => r.dataset.value), ['a', 'b', '']);
  assert.equal(p.el.dataset.size, 'large');
  assert.equal(p.el.dataset.shape, 'tall');
  assert.equal(p.el.dataset.name, 'headgear');
  const css = read('styles/app.css');
  assert.match(css, /\.vp\[data-shape="tall"\] \.vpPicture[^{]*\{[^}]*aspect-ratio:\s*3 \/ 4/, 'a taller box');
  assert.match(css, /\.vp\[data-size="large"\] \.vpGrid\{[^}]*minmax\(1\d\dpx/, 'two to a row at the sidebar\'s width');
  const plain = make({});
  assert.equal(plain.p.el.dataset.size, undefined);
  assert.equal(plain.p.el.dataset.shape, undefined);
});

test('the host is given the picker, replacing what it held; the ids are made from the name', () => {
  const host = doc.createElement('div');
  host.append('old');
  const p = VisualPicker.render(host, { name: 'chest layout', options: OPTIONS, value: 'a' });
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0], p.el);
  assert.equal(host.textContent.includes('old'), false);
  const ids = p.el.querySelectorAll('[role="radio"]').map(r => r.id);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every(id => /^vp-chest-layout-\d+$/.test(id)), ids.join());
  assert.equal(p.el.querySelector('[role="radiogroup"]').getAttribute('aria-label'), 'chest layout', 'no legend: the group is named by its name');
});

test('exactly one option is a stop of the Tab key: the one picked, else the first', () => {
  const { radios } = make();
  assert.deepEqual(radios().map(r => r.tabIndex), [0, -1, -1]);
  const none = make({ value: 'nope' });
  assert.deepEqual(checked(none.radios()), ['false', 'false', 'false']);
  assert.deepEqual(none.radios().map(r => r.tabIndex), [0, -1, -1]);
});

test('a press picks the option and calls onChange once; pressing the one already picked calls nothing', () => {
  const { radios, calls } = make();
  radios()[1].click();
  assert.deepEqual(calls, ['b']);
  assert.deepEqual(checked(radios()), ['false', 'true', 'false']);
  assert.deepEqual(radios().map(r => r.tabIndex), [-1, 0, -1]);
  radios()[1].click();
  assert.deepEqual(calls, ['b'], 'the same option again is no change');
  radios()[2].click();
  assert.deepEqual(calls, ['b', ''], 'the empty string is a value like any other');
  assert.deepEqual(checked(radios()), ['false', 'false', 'true']);
});

test('the arrow keys move the focus (wrapping), Home and End go to the ends, and none of them picks', () => {
  const { radios, calls } = make();
  const r = radios();
  r[0].focus();
  r[0].dispatchEvent(keydown('ArrowRight'));
  assert.equal(doc.activeElement, r[1]);
  r[1].dispatchEvent(keydown('ArrowDown'));
  assert.equal(doc.activeElement, r[2]);
  r[2].dispatchEvent(keydown('ArrowRight'));
  assert.equal(doc.activeElement, r[0], 'wraps to the first');
  r[0].dispatchEvent(keydown('ArrowLeft'));
  assert.equal(doc.activeElement, r[2], 'wraps to the last');
  r[2].dispatchEvent(keydown('ArrowUp'));
  assert.equal(doc.activeElement, r[1]);
  r[1].dispatchEvent(keydown('Home'));
  assert.equal(doc.activeElement, r[0]);
  r[0].dispatchEvent(keydown('End'));
  assert.equal(doc.activeElement, r[2]);
  assert.deepEqual(calls, [], 'moving is not choosing');
  assert.deepEqual(checked(radios()), ['true', 'false', 'false']);
  assert.deepEqual(radios().map(x => x.tabIndex), [-1, -1, 0], 'the Tab stop follows the focus');
});

test('Enter and the space bar pick the option the focus is on; the key is taken so the page does not scroll', () => {
  const { radios, calls } = make();
  const r = radios();
  r[1].focus();
  const enter = keydown('Enter');
  r[1].dispatchEvent(enter);
  assert.deepEqual(calls, ['b']);
  assert.equal(enter.defaultPrevented, true);
  r[2].focus();
  const space = keydown(' ');
  r[2].dispatchEvent(space);
  assert.deepEqual(calls, ['b', '']);
  assert.equal(space.defaultPrevented, true);
  const other = keydown('a');
  r[0].dispatchEvent(other);
  assert.equal(other.defaultPrevented, undefined, 'a letter is left alone');
});

test('setValue changes the pick without calling onChange; a value that is not offered picks nothing', () => {
  const { p, radios, calls } = make();
  p.setValue('b');
  assert.deepEqual(checked(radios()), ['false', 'true', 'false']);
  assert.equal(p.value, 'b');
  p.setValue('zzz');
  assert.deepEqual(checked(radios()), ['false', 'false', 'false']);
  assert.deepEqual(calls, []);
});

test('setOptions draws the new options, keeps the value if it is still offered and the focus on the option it was on', () => {
  const { p, radios, calls } = make();
  radios()[1].focus();
  p.setOptions([{ value: 'b', label: 'Tactical cap' }, { value: 'c', label: 'Boonie hat' }, { value: 'a', label: 'Patrol cap' }]);
  assert.deepEqual(radios().map(r => r.querySelector('.vpLabel').textContent), ['Tactical cap', 'Boonie hat', 'Patrol cap']);
  assert.deepEqual(checked(radios()), ['false', 'false', 'true'], 'a is still picked, now third');
  assert.equal(doc.activeElement, radios()[0], 'the focus follows its option (b), now first');
  assert.deepEqual(calls, [], 'a redraw is not a change');
  p.setOptions([{ value: 'c', label: 'Boonie hat' }]);
  assert.equal(radios().length, 1);
  assert.deepEqual(checked(radios()), ['false']);
  assert.equal(p.value, 'a', 'the value is kept; nothing offered matches it');
  p.setOptions(null);
  assert.equal(radios().length, 0);
});

test('a picture given as markup is set as the picture; given as a URL it is an image of that address; both are hidden from assistive technology', () => {
  const { radios } = make();
  const [svg, url, empty] = radios();
  const box = r => r.querySelector('.vpPicture');
  assert.equal(box(svg).innerHTML, SQUARE);
  assert.equal(box(svg).getAttribute('aria-hidden'), 'true');
  const img = box(url).querySelector('img');
  assert.ok(img, 'an image');
  assert.equal(img.getAttribute('src'), 'images/hat.svg');
  assert.equal(img.getAttribute('alt'), '');
  assert.equal(box(url).getAttribute('aria-hidden'), 'true');
  assert.match(box(empty).innerHTML, /^<svg[^>]*>.*<rect[^>]*stroke-dasharray/, 'the empty mark is a dashed outline');
  assert.ok(!/<text/.test(box(empty).innerHTML), 'with nothing written in it');
});

test('markup is cleaned of scripts and event handlers before it is set', () => {
  const { p, radios } = make();
  p.setOptions([{ value: 'x', label: 'X', picture: '<svg onload="alert(1)" viewBox="0 0 1 1"><script>alert(2)</script><rect onclick=\'bad()\' width="1" height="1"/></svg>' }]);
  const html = radios()[0].querySelector('.vpPicture').innerHTML;
  assert.ok(!/script|alert|onload|onclick|bad/.test(html), html);
  assert.match(html, /<rect[^>]*width="1"/);
});

test('an option with no picture shows its name alone', () => {
  const { p, radios } = make();
  p.setOptions([{ value: 'x', label: 'Boonie hat' }]);
  const r = radios()[0];
  assert.equal(r.querySelector('.vpPicture'), null);
  assert.ok(r.classList.contains('noPicture'));
  assert.equal(r.querySelector('.vpLabel').textContent, 'Boonie hat');
});

test('the note of the option picked is shown under the group, with its words kept whole for the citation marks, and goes when another is picked', () => {
  const { p, radios } = make({ options: [
    { value: 'a', label: 'A', note: 'Worn at the unit level (CAPR 39-1, 9.2.3).' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C', note: 'Another sentence.' }
  ] });
  const note = p.el.querySelector('.vpNote');
  assert.equal(note.textContent, 'Worn at the unit level (CAPR 39-1, 9.2.3).');
  assert.equal(note.hidden, false);
  assert.equal(note.getAttribute('aria-live'), 'polite');
  radios()[1].click();
  assert.equal(note.textContent, '');
  assert.equal(note.hidden, true, 'an option with no note shows none');
  radios()[2].click();
  assert.equal(note.textContent, 'Another sentence.');
  p.setValue('a');
  assert.equal(note.textContent, 'Worn at the unit level (CAPR 39-1, 9.2.3).');
  assert.ok(note.classList.contains('fieldNote'), 'the page\'s own hint style');
});

test('a mark is shown as a small tag on its option and in no other', () => {
  const { radios } = make({ options: [{ value: 'a', label: 'A', mark: 'In your report' }, { value: 'b', label: 'B' }] });
  assert.equal(radios()[0].querySelector('.vpMark').textContent, 'In your report');
  assert.equal(radios()[1].querySelector('.vpMark'), null);
});

test('options with the same group are shown together under its heading, groups in the order met, the keys following what is shown', () => {
  const { p, radios, calls } = make({ options: [
    { value: 'a', label: 'Group cord', group: 'Regulation cords' },
    { value: 'b', label: 'Region cord', group: 'Northeast Region' },
    { value: 'c', label: 'Wing cord', group: 'Regulation cords' },
    { value: 'd', label: 'Plain' },
    { value: 'e', label: 'Maine cord', group: 'Northeast Region' }
  ], value: 'a' });
  const sections = p.el.querySelectorAll('.vpSection');
  assert.deepEqual(sections.map(s => { const h = s.querySelector('.vpGroupHead'); return h ? h.textContent : null; }), ['Regulation cords', 'Northeast Region', null]);
  assert.deepEqual(sections.map(s => s.querySelectorAll('[role="radio"]').map(r => r.querySelector('.vpLabel').textContent)), [['Group cord', 'Wing cord'], ['Region cord', 'Maine cord'], ['Plain']]);
  assert.deepEqual(radios().map(r => r.querySelector('.vpLabel').textContent), ['Group cord', 'Wing cord', 'Region cord', 'Maine cord', 'Plain'], 'shown order');
  radios()[1].focus();
  radios()[1].dispatchEvent(keydown('ArrowRight'));
  assert.equal(doc.activeElement.querySelector('.vpLabel').textContent, 'Region cord', 'the arrow key follows the order shown');
  doc.activeElement.dispatchEvent(keydown('Enter'));
  assert.deepEqual(calls, ['b']);
  const head = sections[0].querySelector('.vpGroupHead');
  assert.equal(radios()[0].getAttribute('aria-describedby'), head.id, 'the heading is read with each of its options');
  assert.equal(radios()[4].getAttribute('aria-describedby'), null);
});

test('the picked option carries a tick and a heavier edge in the styles, not only a colour; the options wrap and never push the page sideways', () => {
  const css = read('styles/app.css');
  const block = css.slice(css.indexOf('/* ---- Visual pickers'));
  assert.ok(block.length > 200, 'a Visual pickers block in the stylesheet');
  assert.match(block, /\.vpOption\[aria-checked="true"\][^{]*\{[^}]*border:\s*2px solid/, 'a 2px edge on the picked option');
  assert.match(block, /\.vpOption\[aria-checked="true"\] \.vpTick\{[^}]*display:\s*flex/, 'the tick shows only on the picked option');
  assert.match(block, /\.vpGrid\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(/, 'the options wrap');
  assert.match(block, /\.vpOption\{[^}]*min-width:\s*0/, 'a tile may shrink to its column');
  assert.match(block, /\.vpLabel\{[^}]*overflow-wrap:\s*anywhere/, 'a long name wraps instead of widening the column');
  assert.match(block, /\.vpOption:focus-visible/, 'a focus ring of its own');
  assert.doesNotMatch(block, /overflow-x:\s*(auto|scroll)/, 'nothing scrolls sideways');
  // The tile is at least a finger wide at the sidebar's narrowest.
  const min = Number(/minmax\((\d+)px/.exec(block)[1]);
  assert.ok(min >= 84 && min <= 110, 'a column of ' + min + 'px');
});

test('the script is on the page before the scripts that use it, and the picker needs nothing but the document', () => {
  const html = read('index.html');
  const at = src => html.indexOf(`<script src="${src}`);
  assert.ok(at('js/visual-picker.js') > 0, 'a script tag');
  for(const later of ['js/garment-options.js', 'js/patches.js', 'js/workspace-ui.js']) assert.ok(at('js/visual-picker.js') < at(later), `before ${later}`);
  assert.match(html, /<script src="js\/visual-picker\.js\?v=[0-9a-f]+" defer><\/script>/);
  // The pictures of the garment options are made by their own script, loaded before the panel that asks for them and after the picker it hands them to.
  assert.ok(at('js/visual-picker.js') < at('js/option-pictures.js') && at('js/option-pictures.js') < at('js/garment-options.js'), 'option-pictures between the picker and the panel');
  assert.match(html, /<script src="js\/option-pictures\.js\?v=[0-9a-f]+" defer><\/script>/);
  const src = read('js/visual-picker.js');
  assert.doesNotMatch(src, /\bState\b|CAPUB|localStorage|fetch\(/, 'a component, not page logic');
});

// ---- toggle mode: any number on at once (the lists of badges, ribbons and patches) ----------------------------------------------------------------------

function makeToggle(config){
  const host = doc.createElement('div');
  doc.body.append(host);
  const calls = [];
  const p = VisualPicker.render(host, Object.assign({
    name: 'badges', mode: 'toggle', values: ['b'], onToggle: (v, on) => calls.push([v, on]),
    options: [
      { value: 'a', label: 'Pilot Badge', picture: 'images/a.svg', caption: 'Worn: above the left pocket', group: 'Aviation' },
      { value: 'b', label: 'Observer Badge', picture: 'images/b.svg', group: 'Aviation', controls: () => { const s = doc.createElement('select'); s.className = 'level'; return s; } },
      { value: 'c', label: 'Ground Team Badge', picture: SQUARE, group: 'Ground', search: 'rescue' }
    ]
  }, config));
  return { host, p, calls, buttons: () => p.el.querySelectorAll('.vpOption'), cell: v => p.el.querySelectorAll('.vpCell').find(c => c.dataset.value === v) };
}

test('toggle mode: the tiles are buttons with aria-pressed in a group, not radios; the ones on are pressed and carry the picked shade and the tick', () => {
  const { p, buttons } = makeToggle();
  assert.equal(p.el.dataset.mode, 'toggle');
  assert.equal(p.el.querySelector('[role="group"]').getAttribute('role'), 'group');
  assert.equal(p.el.querySelectorAll('[role="radio"]').length, 0);
  assert.equal(p.el.querySelectorAll('[role="radiogroup"]').length, 0);
  assert.ok(buttons().every(b => b.nodeName === 'BUTTON' && b.getAttribute('type') === 'button' && b.getAttribute('aria-pressed') !== null));
  assert.deepEqual(buttons().map(b => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(buttons().map(b => b.classList.contains('isPicked')), [false, true, false]);
  assert.deepEqual(p.values, ['b']);
  assert.deepEqual(p.el.querySelectorAll('.vpGroupHead').map(h => h.textContent), ['Aviation', 'Ground']);
  assert.equal(p.el.querySelectorAll('input').length, 0, 'no checkbox, no radio');
  assert.equal(p.el.querySelector('.vpCaption').textContent, 'Worn: above the left pocket');
  assert.equal(p.el.querySelector('img').getAttribute('loading'), 'lazy');
});

test('toggle mode: a press turns the tile on, a second turns it off, any number on at once; onToggle is called by a press and not by setValues or setOptions', () => {
  const { p, buttons, calls } = makeToggle();
  buttons()[0].click();
  buttons()[2].click();
  assert.deepEqual(calls, [['a', true], ['c', true]]);
  assert.deepEqual(buttons().map(b => b.getAttribute('aria-pressed')), ['true', 'true', 'true']);
  buttons()[1].click();
  assert.deepEqual(calls[2], ['b', false]);
  assert.deepEqual(p.values.sort(), ['a', 'c']);
  p.setValues(['b']);
  p.setOptions(p.el.querySelectorAll('.vpOption').map((b, i) => ({ value: b.dataset.value, label: 'x' + i })));
  assert.deepEqual(calls.length, 3, 'neither call told the page');
  assert.deepEqual(p.values, ['b']);
});

test('toggle mode: the keys are the radio group\'s: one tab stop, the arrows move, Enter and the space bar turn the tile', () => {
  const { buttons, calls } = makeToggle();
  assert.deepEqual(buttons().map(b => b.tabIndex), [0, -1, -1], 'one tab stop: the first tile');
  const b = buttons();
  b[1].focus();
  b[1].dispatchEvent(keydown('ArrowRight'));
  assert.equal(doc.activeElement, b[2]);
  assert.deepEqual(b.map(t => t.tabIndex), [-1, -1, 0], 'the tab stop follows the focus');
  doc.activeElement.dispatchEvent(keydown('Enter'));
  doc.activeElement.dispatchEvent(keydown(' '));
  assert.deepEqual(calls, [['c', true], ['c', false]]);
  b[2].dispatchEvent(keydown('Home'));
  assert.equal(doc.activeElement, b[0]);
});

test('toggle mode: a tile\'s controls sit under it in its cell and show only while it is on; a tile with none has none', () => {
  const { buttons, cell } = makeToggle();
  const controls = v => cell(v).querySelector('.vpControls');
  assert.equal(controls('a'), null);
  assert.equal(controls('b').hidden, false, 'on to begin with');
  assert.ok(controls('b').querySelector('select'));
  buttons()[1].click();
  assert.equal(controls('b').hidden, true, 'hidden when the tile is turned off');
  buttons()[1].click();
  assert.equal(controls('b').hidden, false);
});

test('toggle mode: the filter hides the tiles whose name, caption, search words or heading lack the text, and a heading with none left; the keys pass over the hidden', () => {
  const { p, cell, buttons } = makeToggle();
  assert.equal(p.filter('rescue'), 1, 'a search word finds a tile');
  assert.deepEqual(p.el.querySelectorAll('.vpCell').filter(c => !c.hidden).map(c => c.dataset.value), ['c']);
  assert.deepEqual(p.el.querySelectorAll('.vpSection').map(s => s.hidden), [true, false], 'the section with none left is hidden');
  assert.equal(p.filter('above the left'), 1, 'a caption');
  assert.equal(p.filter('aviation'), 2, 'a heading');
  buttons()[0].focus();
  buttons()[0].dispatchEvent(keydown('ArrowRight'));
  assert.equal(doc.activeElement, buttons()[1]);
  buttons()[1].dispatchEvent(keydown('ArrowRight'));
  assert.equal(doc.activeElement, buttons()[0], 'the hidden tile is passed over');
  assert.equal(p.filter(''), 3);
  assert.ok(cell('c') && !cell('c').hidden);
  p.filter('pilot');
  p.setOptions(p.el.querySelectorAll('.vpOption').map(() => null).filter(Boolean));
  assert.equal(p.el.querySelectorAll('.vpCell').length, 0);
});
