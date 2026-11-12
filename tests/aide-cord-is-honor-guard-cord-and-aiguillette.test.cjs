// B8 (Ethan, 2026-11-10): "aide de camp cord is just the agiulete at the moment. merge that with the existing honor guard cord and you have the aide de camp cord".
// The shipped standalone asset is the honor guard shoulder cord and the aiguillette in one drawing, the shoulder cord the same braid as the honor guard cord (its length and bow, its two
// colours, the one braid function at the aiguillette's width); on every dress garment the aide overlay's run is the honor guard overlay's centre line in the honor guard's silver, and the
// engine draws that run along the seam beside the aiguillette (tests/engine-live-aiguillette.test.cjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, 'images', p), 'utf8');
const spec = p => JSON.parse(read(p));

test('cord-aide-de-camp is the honor guard shoulder cord and the aiguillette in one asset, in the honor guard cord\'s silver', () => {
  const aide = spec('cords/cord-aide-de-camp.spec.json'), hg = spec('cords/cord-honor-guard.spec.json');
  const sc = aide.dimensions.shoulder_cord, hd = hg.dimensions;
  assert.deepEqual([sc.length_in, sc.sagitta_in], [hd.length_in, hd.sagitta_in], 'the shoulder cord is the honor guard cord\'s length and bow');
  // the one braid function, at the aide cord's width: the link is the same fraction of the braid's width
  assert.ok(Math.abs(sc.link_pitch_in / sc.thickness_in - hd.link_pitch_in / hd.thickness_in) < 0.002, 'the same braid at another width: the link keeps its proportion');
  assert.deepEqual(aide.colours.cord, { main: hg.colours.main, groove: hg.colours.groove, source: aide.colours.cord.source }, 'the shoulder cord has the honor guard cord\'s two colours');
  assert.equal(aide.colours.main, hg.colours.main); assert.equal(aide.colours.groove, hg.colours.groove, 'and so has the aiguillette\'s braid');
  const svg = read('cords/cord-aide-de-camp.svg');
  for(const id of ['shoulder-cord__braid', 'aiguillette-short__braid', 'aiguillette-long__braid', 'hang']) assert.ok(svg.includes(`id="cord-aide-de-camp__${id}"`), `${id} is drawn`);
  // the shoulder cord's braid is drawn in the honor guard cord's two colours
  const hgSvg = read('cords/cord-honor-guard.svg');
  const fills = (text, id) => [...new Set(new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`).exec(text)[1].match(/fill="(#[0-9a-f]{6})"/g))].sort();
  assert.deepEqual(fills(svg, 'cord-aide-de-camp__shoulder-cord__braid'), fills(hgSvg, 'cord-honor-guard__braid'), 'the shoulder cord\'s braid is in the honor guard cord\'s colours');
  // the shoulder cord and the aiguillette both start at the top, under the epaulet, the cord on the arm side
  const a = aide.anchors;
  assert.ok(Math.abs(a.shoulder_seam_attach_neck_end[1] - (a.aiguillette_attach[1] - 1.25 * aide.dimensions.braid_thickness_in * 100)) < 1, 'the neck end is level with the tops of the aiguillette\'s braids');
  assert.ok(a.shoulder_seam_attach_neck_end[0] > a.aiguillette_attach[0], 'the shoulder cord is on the arm side of the aiguillette');
  for(const k of ['aiguillette_loop', 'aiguillette_pendant', 'aiguillette_tip']) assert.ok(aide.landmarks[k], `${k} is stated`);
});

const OVERLAYS = ['garment-blues-class-a-coat', 'garment-blues-class-a-coat-female', 'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long'];
test('on every dress garment the aide overlay\'s run is the honor guard overlay\'s centre line in the same silver, and its aiguillette groups hang beside it', () => {
  const line = svg => /<path id="[^"]*__cord-path" d="([^"]+)"/.exec(svg)[1];
  const fills = svg => [...new Set(/<g id="[^"]*__cord"[^>]*>([\s\S]*?)<g id="[^"]*__aiguillette-hang"/.exec(svg)[1].match(/fill="(#[0-9a-f]{6})"/g))].sort();
  for(const gid of OVERLAYS){
    const aide = read(`garments/${gid}-cord-aide-de-camp.svg`), hg = read(`garments/${gid}-cord-honor-guard.svg`);
    assert.equal(line(aide), line(hg), `${gid}: the run follows the honor guard cord's line`);
    assert.deepEqual(fills(aide), ['fill="#7f8790"', 'fill="#cdd2d7"'], `${gid}: the run is in the honor guard cord's silver`);
    for(const id of ['aiguillette-loop', 'aiguillette-hang', 'aiguillette-tip-long']) assert.ok(aide.includes(`__${id}"`), `${gid}: ${id}`);
  }
});
