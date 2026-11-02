'use strict';
// Ethan: "please remove the file names, and dont do stuff like L Shoulder, spell it all out". A patch tile (the sidebar gallery and the
// Choose… popup, js/catalog.js patchTileHtml) names the patch, offers Add, and says where it is worn in words ("Left sleeve, ½ in below the
// shoulder seam"), or why it is not offered. No tile text carries an id, a file name, a slot constant (L_SHOULDER) or a pixel size.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadPageScripts } = require('./helpers/page-scripts.cjs');

const ROOT = path.join(__dirname, '..');
const { context } = loadPageScripts();
const ev = src => { const v = vm.runInContext(src, context); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
const text = html => String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const UNIFORMS = ['abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit'];

test('no patch tile text carries an id, a file name, a slot constant or a pixel size, on any field uniform, for seniors and cadets', () => {
  const ids = ev('patchList.slice()');
  assert.ok(ids.length > 20);
  let tiles = 0;
  for(const uniform of UNIFORMS){
    for(const membership of ['senior', 'cadet']){
      ev(`State.uniform = ${JSON.stringify(uniform)}; State.membership = ${JSON.stringify(membership)}`);
      for(const id of ids){
        const html = ev(`patchTileHtml(${JSON.stringify(id)})`);
        const t = text(html);
        const where = `${uniform} ${membership} ${id}: "${t}"`;
        assert.ok(!t.includes(id), `the id is not printed: ${where}`);
        assert.doesNotMatch(t, /\([a-z0-9]+(?:[_-][a-z0-9]+)+\)/, `no parenthesised id: ${where}`);
        assert.doesNotMatch(t, /\b[A-Z]{2,}_[A-Z_]+\b/, `no slot constant: ${where}`);
        assert.doesNotMatch(t, /\d+\s*[×x]\s*\d+\s*px|\bpx\b/, `no pixel size: ${where}`);
        assert.doesNotMatch(t, /\.(svg|png|webp|jpe?g)\b|\//, `no file name or path: ${where}`);
        assert.doesNotMatch(t, /Slot hint/i, where);
        // The tile text is the name, Add, and one line in words.
        assert.match(t, /\bAdd\b/, where);
        if(ev(`isPatchAuthorizedForUniform(${JSON.stringify(id)})`)){
          const label = ev(`getPatchPlaceLabel(${JSON.stringify(id)})`);
          assert.ok(label, `an authorized patch has a place in words: ${where}`);
          assert.ok(t.includes(`Worn: ${label}`), `the place is spelled out: ${where}`);
        }else{
          assert.match(t, /not authorized on|only\.|OCP sleeve form/i, `the reason is in words: ${where}`);
        }
        tiles++;
      }
    }
  }
  assert.ok(tiles > 200);
});

test('places are spelled out per uniform: the sleeve and pocket names of CAPR 39-1 5.1.1.1.2.2-3, 5.2.1.1.2.2-5, 7.1.1.4.1.2, 7.1.1.4.2.1 and 8.2.4.5', () => {
  ev(`State.membership = 'senior'`);
  const label = (id, u) => ev(`getPatchPlaceLabel(${JSON.stringify(id)}, ${JSON.stringify(u)})`);
  assert.equal(label('nywg_patch', 'abu'), 'Left sleeve, ½ in below the shoulder seam');
  assert.equal(label('nesa_patch', 'abu'), 'Right breast pocket');
  assert.equal(label('nywg_patch', 'corporate_field'), 'Left sleeve, ½ in below the shoulder seam');
  assert.equal(label('nesa_patch', 'corporate_field'), 'Right sleeve, ½ in below the shoulder seam');
  assert.equal(label('comms_patch', 'corporate_field'), 'Right breast pocket');
  assert.equal(label('tn330_ocp_patch', 'corporate_field'), 'Right breast pocket');
  assert.equal(label('tn330_ocp_patch', 'ocp'), 'Right sleeve, under the flag');
  assert.equal(label('nesa_ocp_patch', 'ocp'), 'Left sleeve, under the AUX identifier');
  assert.equal(label('patch-ranger-tab-ranger', 'ocp'), 'Left sleeve, under the AUX identifier');
  assert.equal(label('nesa_patch', 'flight_suit'), 'Right sleeve, on the loop tape');
  assert.equal(label('nesa_patch', 'corporate_flight_suit'), 'Right sleeve, on the loop tape');
  // The reasons are words too: no uniform key in capitals, no membership key.
  assert.equal(ev(`getPatchAuthorizationReason('national_staff_ocp_patch', 'abu', 'senior')`), 'Not authorized on the ABU.');
  assert.equal(ev(`getPatchAuthorizationReason('nesa_patch', 'corporate_flight_suit', 'senior')`), '');
  assert.equal(ev(`getPatchAuthorizationReason('national_staff_ocp_patch', 'ocp', 'cadet')`), 'Senior members only.');
  assert.equal(ev(`getPatchAuthorizationReason('model_rocketry_patch', 'corporate_field', 'senior')`), 'Model Rocketry patch is cadet-only.');
});

test('every patch gallery in js/ draws its tiles with patchTileHtml and marks them with data-patch-id; none prints the id, a slot hint or a size', () => {
  const js = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')]);
  for(const [name, src] of js){
    assert.doesNotMatch(src, /Slot hint/, `${name}: no slot hint`);
    assert.doesNotMatch(src, /\(\$\{escapeHtml\(id\)\}\)/, `${name}: no parenthesised id in a tile`);
    assert.doesNotMatch(src, /\$\{meta\.w\}×\$\{meta\.h\} px/, `${name}: no pixel size in a tile`);
  }
  for(const name of ['galleries.js', 'patches.js']){
    const src = fs.readFileSync(path.join(ROOT, 'js', name), 'utf8');
    assert.match(src, /tile\.dataset\.patchId = id;\s*\n\s*tile\.innerHTML = patchTileHtml\(id\);/, `${name}: the gallery tile is patchTileHtml's, marked by id`);
  }
  // The popup's wiring reads the tile's data-patch-id, not a printed id.
  const patches = fs.readFileSync(path.join(ROOT, 'js', 'patches.js'), 'utf8');
  assert.match(patches, /\.galleryTile\[data-patch-id\]/);
  // The member report import names the patches it matched, not their ids.
  assert.match(patches, /NCSA\/activity patch match\(es\): \$\{ncsaPatches\.map\(id => PATCH_META\[id\]\?\.label/);
});
