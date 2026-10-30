'use strict';
// scripts/sync-military-medals.cjs: a body SVG in assets/military/v3/out-medals finds its award and its gate decides. Reads a fixture art tree and
// writes nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sync = require('../scripts/sync-military-medals.cjs');

function asset(root, id, spec, svg){
  const dir = path.join(root, 'military', 'v3', 'out-medals', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.spec.json'), JSON.stringify(Object.assign({ asset_id: id, width_in: 0.7, height_in: 0.8, anchors: { ribbon_attach: [35, 0] } }, spec)));
  fs.writeFileSync(path.join(dir, id + '.svg'), svg || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 80"><path d="M0 0"/></svg>');
}

test('the plan matches by reference, keeps the gate, and reports what it cannot use', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'medals-art-'));
  const was = process.env.ARTWORK_SRC;
  process.env.ARTWORK_SRC = root;
  try{
    asset(root, 'medal-air-force-air-medal-mini', { reference: 'images/military-mini-medals/air-force/air_medal.png', fidelity: { pass: true } });
    asset(root, 'medal-air-force-aerial-achievement-medal-mini', { dimensions: { service: 'air-force', medal: 'aerial_achievement_medal' }, fidelity: { pass: false, note: 'iou' } });
    asset(root, 'medal-nobody', { reference: 'images/military-mini-medals/navy/no_such_medal', fidelity: { pass: true } });
    asset(root, 'medal-bad', { reference: 'images/military-mini-medals/air-force/air_medal' }, '<svg viewBox="0 0 70 80"><image href="x"/></svg>');
    const p = sync.plan();
    assert.deepEqual(p.sync.map(s => s.a.id), ['medal-air-force-air-medal-mini']);
    assert.deepEqual(p.excluded.map(e => e.id), ['medal-air-force-aerial-achievement-medal-mini']);
    assert.deepEqual(p.unmatched.map(u => u.id), ['medal-nobody']);
    assert.deepEqual(p.broken.map(b => b.id), ['medal-bad']);
    assert.equal(p.table.air_medal.artId, 'medal-air-force-air-medal-mini');
    assert.equal(p.sync[0].rel, 'medals/military/medal-air-force-air-medal-mini.svg');
    assert.deepEqual(p.sync[0].row.anchors, { ribbon_attach: [35, 0] });
    assert.match(sync.tableText(p.table), /"air_medal": \{"artId":"medal-air-force-air-medal-mini","w":0\.7,"h":0\.8\}/);
    assert.equal(sync.plan({ all: true }).sync.length, 2, '--all takes the gate-failed asset');
  }finally{
    if(was === undefined) delete process.env.ARTWORK_SRC; else process.env.ARTWORK_SRC = was;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('data/military-medals.js is in the form the script writes, and every body it names is in the manifest (--check says whether it is behind the art tree)', () => {
  const table = require('../data/military-medals.js');
  assert.equal(fs.readFileSync(sync.OUT, 'utf8'), sync.tableText(table));
  const ids = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'images', 'MANIFEST.json'), 'utf8')).assets.map(a => a.id));
  for(const row of Object.values(table)) assert.ok(ids.has(row.artId), row.artId);
});
