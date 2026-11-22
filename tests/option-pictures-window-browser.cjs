#!/usr/bin/env node
'use strict';
// Browser check that a picture of an option drawn from only the layers that reach its window (js/option-pictures.js inWindow) is the picture of the whole scene: for six windows on the
// OCP, the Mess Dress and the Class A, the two drawings are rasterized and compared pixel by pixel. Prints PASS when no pixel differs and some layers were left out.
//
//   node tests/option-pictures-window-browser.cjs
require('../scripts/lib-chrome.cjs');   // the browser is started through it, by openSession (scripts/interaction-perf.cjs)
const { openSession } = require('../scripts/interaction-perf.cjs');
const { setupJs } = require('../scripts/interaction-scenarios.cjs');
(async () => {
  let total = 0, bad = 0, cut = 0;
  const s = await openSession({ view: 'desktop' });
  for(const cfg of ['senior-ocp', 'senior-mess', 'cadet']){
    await s.load(); await s.ev(setupJs(cfg));
    const r = await s.ev(`(async () => {
      const E = CAPUBEngine, sc = CAPUBUniformView.scene;
      const assets = CAPUBAssetPacks.createLoader((p, c) => fetch(ASSET(p), c ? { cache: c } : undefined).then(r => r.ok ? r.json() : null));
      const m = await assets.manifest(); const store = E.core.createSpecStore(m, p => assets.spec(p));
      const b = sc.bounds, out = [];
      const wins = [[0.1,0.05,0.5,0.3],[0.3,0.3,0.4,0.3],[0,0,1,0.4],[0.5,0.5,0.5,0.5],[0.2,0.6,0.6,0.4],[0.35,0.15,0.3,0.2]];
      for(const w of wins){
        const scene = Object.assign({}, sc, { bounds: { x: b.x + w[0]*b.w, y: b.y + w[1]*b.h, w: w[2]*b.w, h: w[3]*b.h } });
        const cut = CAPUBOptionPictures.inWindow(E.core, scene, 0.1);
        const a = await E.renderSvg.buildSvg(scene, id => store.entry(id).path, { pad: 0.1 });
        const c = await E.renderSvg.buildSvg(cut, id => store.entry(id).path, { pad: 0.1 });
        const ca = await E.renderSvg.svgToCanvas(a, 600), cc = await E.renderSvg.svgToCanvas(c, 600);
        const da = ca.getContext('2d').getImageData(0,0,ca.width,ca.height).data, dc = cc.getContext('2d').getImageData(0,0,cc.width,cc.height).data;
        let diff = 0; for(let i = 0; i < da.length; i++) if(Math.abs(da[i]-dc[i]) > 2) diff++;
        out.push({ layers: scene.layers.length + '>' + cut.layers.length, diff, chars: a.outerHTML.length + '>' + c.outerHTML.length });
      }
      return JSON.stringify(out);
    })()`);
    console.log(cfg, r); for(const o of JSON.parse(r)){ total++; if(o.diff) bad++; const [a, c] = o.layers.split('>').map(Number); if(c < a) cut++; }
  }
  await s.close();
  console.log(`${total} windows, ${bad} differ, ${cut} with layers left out`);
  const ok = !bad && cut > 0;
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
})();
