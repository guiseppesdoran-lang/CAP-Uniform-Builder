'use strict';
// The owner (2026-11-12): the tiles that choose badges, ribbons and patches are too big. The ones of the Badges panel (the badge that takes each place, the command pin) are three
// to a row where they were two, those of the chooser window one more to a row at a phone's width and on a desktop; the name stays readable (13 px, wrapping to a second line), no
// tile is under 44 px, and the tiles that choose the uniform, the cut, the grade and the headgear keep their size.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'app.css'), 'utf8');
const rule = sel => {
  const i = css.indexOf(sel + '{');
  assert.ok(i >= 0, `css rule ${sel}`);
  return css.slice(i, css.indexOf('}', i));
};
const px = rem => rem * 16;

test('the switch tiles of the chooser window and the badge tiles of the Badges panel are about two thirds of the old size: 104 px minimum, 140 px on a desktop (the old tiles were 150 and 120)', () => {
  const grid = rule('.vp[data-mode="toggle"] .vpGrid,.vp[data-name^="badgeChooser-"] .vpGrid,.vp[data-name^="itemOpt-commandInsignia"] .vpGrid');
  const min = Number(/minmax\((\d+)px,1fr\)/.exec(grid)[1]);
  assert.equal(min, 104);
  assert.ok(min >= 44, 'a finger fits');
  const desktop = /@media \(min-width:700px\)\{\.vp\[data-mode="toggle"\] \.vpGrid\{grid-template-columns:repeat\(auto-fill,minmax\((\d+)px,1fr\)\)\}\}/.exec(css);
  assert.equal(Number(desktop[1]), 140);
  // At the widths that matter: the chooser window's grid is 358 px at 390 and 1066 px at 1280, the Badges panel's about 330 px, with 6 px between tiles.
  const perRow = (width, tile) => Math.floor((width + 6) / (tile + 6));
  assert.equal(perRow(358, min), 3, 'a phone: three where there were two (150 px)');
  assert.equal(perRow(1066, Number(desktop[1])), 7, 'a desktop: seven where there were six (150 px)');
  assert.equal(perRow(330, min), 3, 'the Badges panel: three where there were two (120 px)');
  assert.equal(perRow(358, 150), 2); assert.equal(perRow(1066, 150), 6); assert.equal(perRow(330, 120), 2);
});

test('the name under a tile is 13 px and its line 12 px, both wrapping, never cut; the tiles of the uniform, the cut, the grade and the headgear are as they were', () => {
  const label = rule('.vp[data-mode="toggle"] .vpLabel,.vp[data-name^="badgeChooser-"] .vpLabel,.vp[data-name^="itemOpt-commandInsignia"] .vpLabel');
  assert.ok(px(Number(/font-size:([\d.]+)rem/.exec(label)[1])) >= 12);
  assert.match(rule('.vpLabel'), /overflow-wrap:anywhere/);
  const caption = rule('.vpCaption');
  assert.ok(px(Number(/font-size:([\d.]+)rem/.exec(caption)[1])) >= 12);
  assert.match(caption, /overflow-wrap:anywhere/);
  assert.match(rule('.vpGrid'), /minmax\(92px,1fr\)/);
  assert.match(rule('.vp[data-size="large"] .vpGrid'), /minmax\(120px,1fr\)/);
  assert.match(rule('.vp[data-size="small"] .vpGrid'), /minmax\(60px,1fr\)/);
});

test('the tiles built for the badge chooser and the command pin name their pickers so the smaller size reaches those and no others', () => {
  const lists = fs.readFileSync(path.join(__dirname, '..', 'js', 'pick-lists.js'), 'utf8');
  const view = fs.readFileSync(path.join(__dirname, '..', 'js', 'uniform-view.js'), 'utf8');
  const items = fs.readFileSync(path.join(__dirname, '..', 'js', 'item-pickers.js'), 'utf8');
  assert.match(view, /name: `badgeChooser-\$\{group\.position\}-\$\{slot\.key\}`/);
  assert.match(items, /id: 'commandInsigniaChoice'/);
  assert.match(items, /id: 'commandInsigniaLevel'/);
  assert.match(lists, /mode: 'toggle'/);
});

test('a tile that is on with a row of choices under it takes the width of the list: its tile beside the row on a desktop; at a phone\'s width the tile is capped and the row under it has the whole width', () => {
  const live = ':has(> .vpControls:not([hidden]) .vpRow)';
  const sel = '.vp[data-boxed]:not([data-layout="row"]) .vpCell' + live;
  const wide = rule(sel);
  assert.match(wide, /grid-column:1\/-1;display:grid;grid-template-columns:minmax\(0,150px\) minmax\(0,1fr\)/, 'the tile (150 px) and the row beside it');
  assert.match(css, new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>\\.vpControls\\{grid-column:2;grid-row:1 / span 2\\}`));
  const at = css.indexOf('@media (max-width:699px){\n  ' + sel);
  assert.ok(at >= 0, 'a phone-width rule');
  const narrow = css.slice(at, css.indexOf('\n}', at));
  assert.match(narrow, /\{grid-template-columns:minmax\(0,1fr\)\}/, 'one column the width of the list, so the row is not held to the tile\'s width');
  assert.match(narrow, />\.vpOption,[^{]*>\.vpCaption\{max-width:150px\}/, 'the tile itself stays 150 px at most');
  assert.match(narrow, />\.vpControls\{grid-column:1\/-1;grid-row:auto\}/, 'the row under the tile');
  // A row only takes the width while its controls are shown: a badge that is off keeps its place in the grid.
  assert.doesNotMatch(css, /\.vpCell:has\(> \.vpControls \.vpRow\)/);
});

test('a picker tile draws its picture inside an even margin on all four sides (the box keeps its size, border-box), so a picture that reaches its own edge, such as the Cyber triangle, is not cut by the border or the rounded corners', () => {
  const box = rule('.vpPicture');
  const pad = /padding:(\d+)px/.exec(box);
  assert.ok(pad && Number(pad[1]) >= 4, 'the base picture box has an even inner margin of at least the corner radius');
  assert.ok(/border-radius:4px/.test(box));
  assert.ok(/aspect-ratio:4 \/ 3/.test(box), 'the outer size comes from the aspect ratio, which border-box padding does not change');
  assert.ok(/\*\{box-sizing:border-box\}/.test(css));
  const image = rule('.vpPicture>svg,.vpPicture>img');
  assert.ok(/width:100%;height:100%;object-fit:contain/.test(image), 'the picture fills the margin box, whole');
});
