'use strict';
// The pictures of the options are made after the change that asked for them has been shown, one job at a time and each drawing in a task of its own (the OCP's drawing is
// megabytes: six drawn in a row after one tap held a phone's page for seconds). Run against a made-up environment: the order of events is what is checked.

const test = require('node:test');
const assert = require('node:assert/strict');
const OP = require('../js/option-pictures.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeEnv(log){
  let active = 0;
  return {
    core: {}, build: () => ({ uniform: 'ocp', n: log.builds = (log.builds || 0) + 1 }),
    spec: async () => null, entry: () => null, url: p => p, empty: () => '',
    compose: async b => b,
    draw: async scene => {
      log.push('draw:' + scene.name);
      assert.equal(++active, 1, 'two drawings at once');
      await sleep(1);
      active--;
      return 'blob:' + scene.name;
    }
  };
}

test('a set of pictures is made after the call returns, each drawing in its own task, and one set at a time', async () => {
  const log = [];
  const env = makeEnv(log);
  const api = OP.create(env);
  OP.RECIPES.__t = { make: async (e, build, values) => Object.fromEntries(values.map(v => [v, { scene: { name: v }, pad: 0 }])), key: b => [b.uniform] };
  try{
    const a = api.pictures('__t', ['a', 'b', 'c']);
    assert.equal(a.settled, false);
    assert.deepEqual(log.filter(x => x.startsWith('draw')), [], 'nothing is drawn before the caller has returned');
    const b = api.pictures('__t', ['d', 'e']);
    const [ra, rb] = await Promise.all([a.ready, b.ready]);
    assert.deepEqual(ra, { a: 'blob:a', b: 'blob:b', c: 'blob:c' });
    assert.deepEqual(rb, { d: 'blob:d', e: 'blob:e' });
    // The second set starts after the first has ended.
    assert.deepEqual(log.filter(x => x.startsWith('draw')), ['draw:a', 'draw:b', 'draw:c', 'draw:d', 'draw:e']);
    // Asked for again with the same inputs: the pictures are at hand, nothing is drawn again.
    const again = api.pictures('__t', ['a', 'b', 'c']);
    assert.equal(again.settled, true);
    await again.ready;
    assert.equal(log.filter(x => x.startsWith('draw')).length, 5);
  }finally{ delete OP.RECIPES.__t; }
});

test('a picture draws only the layers that reach its window, and keeps one whose box cannot be told', () => {
  const core = { layerBounds: l => (l.box === 'unknown' ? null : { x: l.x, y: l.y, w: l.w, h: l.h }) };
  const layer = (name, x, y, w, h, extra) => Object.assign({ name, x, y, w, h }, extra);
  const scene = { title: 't', bounds: { x: 0, y: 0, w: 4, h: 4 }, notes: [], layers: [
    layer('sheet', -2, -2, 20, 20), layer('inside', 1, 1, 1, 1), layer('far', 30, 30, 2, 2), layer('near', 4.3, 0, 1, 1), layer('unknown', 40, 40, 1, 1, { box: 'unknown' })
  ] };
  const cut = OP.inWindow(core, scene, 0.1);
  assert.deepEqual(cut.layers.map(l => l.name), ['sheet', 'inside', 'near', 'unknown']);
  assert.equal(scene.layers.length, 5, 'the scene is not changed');
  assert.deepEqual(cut.bounds, scene.bounds);
  const all = { title: 't', bounds: scene.bounds, layers: [scene.layers[0], scene.layers[1]] };
  assert.equal(OP.inWindow(core, all, 0.1), all, 'a scene that loses nothing is handed back as it is');
});
