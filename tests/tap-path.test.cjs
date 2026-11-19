'use strict';
// The path of a tap on a phone, held by its structure (the timings are in scripts/interaction-run.cjs): nothing that asks the browser for a layout runs in the check of the zoom
// after a drawing, the drawing and the refresh wait for the frame that shows the tap, a tap's work waits for that frame too, and the window opens once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('the check of whether the zoom needs a new fit reads no layout', () => {
  const ui = read('js/workspace-ui.js');
  const at = ui.indexOf('function fitSignature(){');
  const sig = ui.slice(at, ui.indexOf('\n  }', at));
  assert.ok(sig.length > 50);
  assert.doesNotMatch(sig, /offsetWidth|offsetHeight|clientWidth|clientHeight|getBoundingClientRect|getComputedStyle|innerWidth|innerHeight/, 'the signature is made from what the page already holds');
  assert.match(ui, /document\.addEventListener\('capub:rendered',fitIfChanged\)/, 'a drawing refits only when the signature changed');
  assert.match(ui, /V3\.fitSig=fitSignature\(\)/);
});

test('setZoom reads every size before it writes a style', () => {
  const ui = read('js/workspace-ui.js');
  const body = ui.slice(ui.indexOf('function setZoom(z){'), ui.indexOf('function syncChromeHeights'));
  const firstWrite = body.indexOf('area.style.');
  for(const read of ['area.offsetWidth', 'getComputedStyle', 'wrap.clientWidth']) assert.ok(body.indexOf(read) >= 0 && body.indexOf(read) < firstWrite, `${read} is read before the first write`);
});

test('the drawing and the screen refresh are made in the task after the frame of the tap', () => {
  const view = read('js/uniform-view.js'), ui = read('js/workspace-ui.js');
  assert.match(view, /requestAnimationFrame\(\(\) => setTimeout\(run, 0\)\)/);
  assert.match(ui, /requestAnimationFrame\(\(\)=>setTimeout\(run,0\)\)/);
});

test('a tap on a tile sets its own state first and the page\'s work after the frame, where the page has turned that on', () => {
  const vp = read('js/visual-picker.js'), boot = read('js/bootstrap.js');
  assert.match(vp, /afterFrame\(\(\) => cfg\.onToggle\(t\.option\.value, on\)\)/);
  assert.match(vp, /if\(typeof cfg\.onToggle === 'function'\)/);
  assert.ok(vp.indexOf("paint();\n        if(typeof cfg.onToggle") > 0, 'the tile is painted before the work is asked for');
  assert.match(boot, /VisualPicker\.deferTaps = true/);
});

test('the fail-safe repair of the Ribbons, Badges and Patches buttons does not open a window that is open', () => {
  const boot = read('js/bootstrap.js');
  for(const kind of ['ribbons', 'badges', 'patches']) assert.match(boot, new RegExp(`!capubWindowOpenFor\\('${kind}'\\)\\) openGalleryModal\\('${kind}'\\)`));
});
