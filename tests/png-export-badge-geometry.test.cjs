const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

// The PNG is the preview's own SVG rasterized, so the download matches what is on screen.
test('Download PNG rasterizes the same SVG the preview shows', () => {
  const bootstrap = read('js/bootstrap.js');
  assert.match(bootstrap, /await CAPUBUniformView\.exportCanvas\(60\)/);
  const view = read('js/uniform-view.js');
  assert.match(view, /E\.renderSvg\.svgToCanvas\(lastSvg, vb\[2\] \* \(ppi \|\| 60\)\)/);
  const render = read('js/engine/render-svg.js');
  assert.match(render, /function svgToCanvas\(/);
});
