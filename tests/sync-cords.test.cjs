'use strict';
// scripts/sync-cords.cjs: the cord list and the braid drawing come from the art tree byte for byte (the list as the page's data file, the art tree's own notes left out),
// a list that breaks one of its rules is refused with nothing written, and the copies the tree holds are in the form the script writes. The art tree is a fixture here,
// never the real one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sync = require('../scripts/sync-cords.cjs');

const ROOT = path.join(__dirname, '..');
const PAL = () => ({ main: '#112233', dark: '#001122' });
const palette = () => { const p = {}; for(const n of ['green', 'red', 'blue', 'gold', 'white', 'silver', 'orange', 'black', 'purple']) p[n] = PAL(); return p; };
const reg = (id, colour, extra) => Object.assign({ id, name: id, style: 'solid', colours: [colour], cite: 'x' }, extra || {});
const baseList = () => ({
  about: 'a note for the art tree',
  styles: { solid: 'one', interwoven: 'two', 'edge-centre': 'box', chosen: 'picked' },
  palette: palette(), metals: { silver: PAL() },
  chosen_colours: ['orange', 'black', 'purple'],
  regulation: [reg('group', 'green'), reg('wing', 'red'), reg('region', 'blue'), reg('national', 'gold'), reg('color-guard', 'white'), reg('honor-guard', 'silver'), reg('aide-de-camp', 'silver', { aiguillette: 'silver' })],
  supplement: [
    { id: 'xx-two', name: 'Two', style: 'interwoven', colours: ['blue', 'white'], figure: 'page 2' },
    { id: 'xx-box', name: 'Box', style: 'edge-centre', edge: 'black', centre: 'gold', strand: { colour: 'gold', tip: 'silver' } },
    { id: 'xx-pick', name: 'Pick', style: 'chosen' }
  ]
});
const BRAID = '// the drawing\nmodule.exports = { draw(){ return { run: "", extras: "" }; }, resolve(){ return null; }, LOOK: {} };\n';

function site(){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-cords-'));
  const put = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  const art = path.join(tmp, 'art');
  put(path.join(tmp, 'site', 'scripts', 'sync-cords.cjs'), fs.readFileSync(path.join(ROOT, 'scripts', 'sync-cords.cjs'), 'utf8'));
  const run = (...args) => spawnSync(process.execPath, [path.join(tmp, 'site', 'scripts', 'sync-cords.cjs'), '--list', path.join(art, 'cords.json'), '--braid', path.join(art, 'cord-braid.js'), ...args], { encoding: 'utf8' });
  const out = { dataFile: path.join(tmp, 'site', 'data', 'cords.js'), braidFile: path.join(tmp, 'site', 'js', 'engine', 'cord-braid.js') };
  return { tmp, art, put, run, out, putList: l => put(path.join(art, 'cords.json'), JSON.stringify(l, null, 1)), putBraid: b => put(path.join(art, 'cord-braid.js'), b) };
}

test('a sync writes the list as window.CAP_CORDS without the art tree\'s notes and the drawing function byte for byte; a second one has nothing to write', () => {
  const s = site();
  try{
    s.putList(baseList()); s.putBraid(BRAID);
    const r = s.run();
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(fs.readFileSync(s.out.braidFile, 'utf8'), BRAID, 'cord-braid.js is the art tree\'s file, byte for byte');
    const text = fs.readFileSync(s.out.dataFile, 'utf8');
    const expected = baseList(); delete expected.about; delete expected.supplement[0].figure;
    assert.equal(text, sync.cordsText(baseList()), 'the data file is what cordsText makes of the list');
    const sandbox = { }; sandbox.self = sandbox; new Function('self', text)(sandbox);
    assert.deepEqual(JSON.parse(JSON.stringify(sandbox.CAP_CORDS)), expected, 'loaded as a classic script it sets window.CAP_CORDS to the list, less "about" and each cord\'s "figure"');
    assert.doesNotMatch(text, /a note for the art tree|page 2/);
    assert.match(s.run().stdout, /nothing to write/);
    assert.equal(s.run('--check').status, 0, 'the tree is current');
    s.putBraid(BRAID + '// changed\n');
    assert.equal(s.run('--check').status, 1, 'a changed drawing function in the art tree is a tree behind');
    assert.equal(s.run('--dry-run').status, 0);
    assert.equal(fs.readFileSync(s.out.braidFile, 'utf8'), BRAID, '--dry-run writes nothing');
  }finally{ fs.rmSync(s.tmp, { recursive: true, force: true }); }
});

test('a list that breaks one of its rules is refused and nothing is written', () => {
  const cases = {
    'an id twice': l => { l.supplement.push(Object.assign({}, l.supplement[0])); },
    'a colour that is not in the palette': l => { l.supplement[0].colours = ['blue', 'chartreuse']; },
    'an interwoven cord of one colour': l => { l.supplement[0].colours = ['blue']; },
    'an edge-centre cord with no centre': l => { delete l.supplement[1].centre; },
    'a style that does not exist': l => { l.supplement[0].style = 'plaid'; },
    'a strand tip that is not a metal': l => { l.supplement[1].strand.tip = 'gold'; },
    'a chosen colour that is a regulation cord\'s': l => { l.chosen_colours.push('green'); },
    'a chosen colour that is not in the palette': l => { l.chosen_colours.push('teal'); },
    'no chosen colours for a cord that takes one': l => { l.chosen_colours = []; },
    'a regulation cord missing': l => { l.regulation.pop(); },
    'a colour hex that is not a hex': l => { l.palette.orange = { main: 'orange', dark: '#000000' }; },
    'an id that is not an id': l => { l.supplement[0].id = 'Two Cords'; }
  };
  for(const [what, change] of Object.entries(cases)){
    const s = site();
    try{
      const l = baseList(); change(l);
      s.putList(l); s.putBraid(BRAID);
      const r = s.run();
      assert.equal(r.status, 1, `${what}: refused`);
      assert.ok(!fs.existsSync(s.out.dataFile), `${what}: no data file written`);
      assert.ok(sync.problems(l).length > 0, `${what}: problems() says why`);
      assert.equal(s.run('--check').status, 1, `${what}: --check fails`);
    }finally{ fs.rmSync(s.tmp, { recursive: true, force: true }); }
  }
  assert.deepEqual(sync.problems(baseList()), [], 'the fixture itself is sound');
});

test('a braid file that is not in the art tree yet leaves the drawing function as it is, and a missing list is a problem', () => {
  const s = site();
  try{
    s.put(s.out.braidFile, 'old drawing');
    s.putList(baseList());
    const r = s.run();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(s.out.braidFile, 'utf8'), 'old drawing');
    assert.match(r.stdout, /not in the art tree yet/);
    fs.rmSync(path.join(s.art, 'cords.json'));
    assert.equal(s.run().status, 1);
  }finally{ fs.rmSync(s.tmp, { recursive: true, force: true }); }
});

test('data/cords.js is in the form the script writes, the list is sound, and it holds the seven regulation cords and the supplement cords', () => {
  const list = require('../data/cords.js');
  assert.equal(fs.readFileSync(sync.OUT, 'utf8'), sync.cordsText(list), 'the form the script writes');
  assert.deepEqual(sync.problems(list), []);
  assert.deepEqual(list.regulation.map(c => c.id), sync.REGULATION);
  assert.equal(list.supplement.length, 58);
  assert.ok(!('about' in list) && list.supplement.every(c => !('figure' in c)), 'the art tree\'s notes are not shipped');
  assert.doesNotMatch(fs.readFileSync(sync.OUT, 'utf8'), /\.scratch|\/Users\/|\/private\/tmp/, 'no local path in a tracked file');
});

test('js/engine/cord-braid.js, once it is synced, loads as a module and as window.CordBraid and draws the list\'s cords', { skip: !fs.existsSync(sync.BRAID_OUT) && 'the drawing function is not in the tree yet' }, () => {
  const braid = require('../js/engine/cord-braid.js');
  assert.equal(typeof braid.draw, 'function');
  assert.equal(typeof braid.resolve, 'function');
  assert.ok(braid.LOOK && braid.LOOK.width > 0);
  const list = require('../data/cords.js');
  const src = fs.readFileSync(sync.BRAID_OUT, 'utf8');
  const sandbox = {}; sandbox.self = sandbox; new Function('self', src)(sandbox);
  assert.equal(typeof sandbox.CordBraid.draw, 'function', 'as a classic script it sets window.CordBraid');
  for(const c of [].concat(list.regulation, list.supplement)){
    const cord = braid.resolve(list, c.id, c.style === 'chosen' ? list.chosen_colours[0] : undefined);
    assert.ok(cord, c.id);
    const d = braid.draw([[0, 0], [0.2, 3]], cord, { unit: 1, width: 0.5, idPrefix: 't-' });
    assert.ok(d.run.length > 100, `${c.id} draws a braid`);
  }
});
