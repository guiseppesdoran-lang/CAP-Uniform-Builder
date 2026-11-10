'use strict';
// B8 (Ethan, 2026-11-10): "aide de camp cord is just the agiulete at the moment. merge that with the existing honor guard cord and you have the aide de camp cord".
// The shipped standalone asset is the honor guard shoulder cord and the aiguillette in one drawing, the shoulder cord built from the same piece as the honor guard cord (its length,
// thickness, bow and weave, its two colours); on every dress garment the aide overlay's run is the honor guard overlay's braid, and the engine draws that run along the seam beside the
// aiguillette (tests/engine-live-aiguillette.test.cjs).
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
  assert.deepEqual([sc.length_in, sc.thickness_in, sc.sagitta_in, sc.weave_pitch_in], [hd.length_in, hd.thickness_in, hd.sagitta_in, hd.weave_pitch_in], 'the shoulder cord is the honor guard cord\'s length, thickness, bow and weave');
  assert.deepEqual(aide.colours.cord, { main: hg.colours.main, groove: hg.colours.groove, source: aide.colours.cord.source }, 'the shoulder cord has the honor guard cord\'s two colours');
  assert.equal(aide.colours.main, hg.colours.main); assert.equal(aide.colours.groove, hg.colours.groove, 'and so has the aiguillette\'s braid');
  const svg = read('cords/cord-aide-de-camp.svg');
  for(const id of ['shoulder-cord-ground', 'shoulder-cord-weave', 'braid-short-ground', 'braid-long-ground', 'hang']) assert.ok(svg.includes(`id="cord-aide-de-camp__${id}"`), `${id} is drawn`);
  // the shoulder cord's ground stroke is the honor guard cord's: the same width and the same two colours
  const hgSvg = read('cords/cord-honor-guard.svg');
  const ground = (text, id) => new RegExp(`<g id="${id}">([\\s\\S]*?)</g>`).exec(text)[1].match(/stroke="(#[0-9a-f]{6})" stroke-width="([\d.]+)"/g);
  assert.deepEqual(ground(svg, 'cord-aide-de-camp__shoulder-cord-ground'), ground(hgSvg, 'cord-honor-guard__ground'), 'the shoulder cord\'s ground strokes are the honor guard cord\'s: the same two colours and widths');
  // the shoulder cord and the aiguillette both start at the top, under the epaulet, the cord on the arm side
  const a = aide.anchors;
  assert.ok(Math.abs(a.shoulder_seam_attach_neck_end[1] - (a.aiguillette_attach[1] - 1.25 * 30)) < 1, 'the neck end is level with the tops of the aiguillette\'s braids');
  assert.ok(a.shoulder_seam_attach_neck_end[0] > a.aiguillette_attach[0], 'the shoulder cord is on the arm side of the aiguillette');
  for(const k of ['aiguillette_loop', 'aiguillette_pendant', 'aiguillette_tip']) assert.ok(aide.landmarks[k], `${k} is stated`);
});

const OVERLAYS = ['garment-blues-class-a-coat', 'garment-blues-class-a-coat-female', 'garment-blues-class-b-shirt-male', 'garment-blues-class-b-shirt-male-long', 'garment-blues-class-b-blouse-female', 'garment-blues-class-b-blouse-female-long'];
test('on every dress garment the aide overlay\'s run is the honor guard overlay\'s braid (the same drawing, the same silver), and its aiguillette groups hang beside it', () => {
  const strokes = svg => { const g = /<g id="[^"]*__cord">([\s\S]*?)<\/g>/.exec(svg)[1]; return g.replace(/<title>[\s\S]*?<\/title>/, '').replace(/id="[^"]*"/g, ''); };
  for(const gid of OVERLAYS){
    const aide = read(`garments/${gid}-cord-aide-de-camp.svg`), hg = read(`garments/${gid}-cord-honor-guard.svg`);
    assert.equal(strokes(aide), strokes(hg), `${gid}: the run is the honor guard cord's braid`);
    for(const id of ['aiguillette-loop', 'aiguillette-hang', 'aiguillette-tip-long']) assert.ok(aide.includes(`__${id}"`), `${gid}: ${id}`);
  }
});
