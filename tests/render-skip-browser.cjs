#!/usr/bin/env node
'use strict';
// Browser check that keeping the drawing on screen when a change leaves the scene as it was gives the drawing a fresh build would give (js/uniform-view.js render: the same layers,
// bounds, title and options make the same drawing). For twelve setups across the uniforms a member chooses a ribbon, a badge and a second badge and takes the ribbon off again, the page drawing
// after each; the drawing it ends with must be, apart from the number its ids are scoped by, the one a page makes that goes to the same choices in one step. Prints how many of the
// drawings were kept (the SVG node unchanged) and PASS when every setup agrees. Not part of `npm test` runs that lack Chrome (tests/render-skip.test.cjs runs it).
//
//   node tests/render-skip-browser.cjs
require('../scripts/lib-chrome.cjs');   // the browser is started through it, by openSession (scripts/interaction-perf.cjs)
const { openSession } = require('../scripts/interaction-perf.cjs');

const SETUPS = [
  ['blues_a', 'senior', 'Capt', 'male'], ['blues_a', 'cadet', 'C/Lt Col', 'female'], ['blues_b', 'senior', 'Maj', 'male'], ['mess_dress', 'senior', 'Capt', 'male'],
  ['semi_formal', 'senior', 'Lt Col', 'female'], ['aviator', 'senior', 'Capt', 'male'], ['polo', 'senior', 'Capt', 'male'], ['abu', 'senior', 'Capt', 'male'],
  ['ocp', 'senior', 'Capt', 'male'], ['ocp', 'cadet', 'C/Capt', 'male'], ['flight_suit', 'senior', 'Capt', 'female'], ['corporate_field', 'senior', 'Capt', 'male']
];
const STEPS = [
  { ribbons: ['lifesaving_award'] },
  { ribbons: ['lifesaving_award'], badges: ['ground_team_basic_badge'] },
  { ribbons: ['lifesaving_award'], badges: ['ground_team_basic_badge', 'emt_basic_badge'] },
  { ribbons: [], badges: ['ground_team_basic_badge', 'emt_basic_badge'] }
];

const apply = (setup, step) => `(async () => {
  const [uniform, membership, rank, gender] = ${JSON.stringify(setup)};
  const step = ${JSON.stringify(step)};
  const fire = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
  if(State.uniform !== uniform || State.membership !== membership || State.rank !== rank || State.gender !== gender){
    fire(document.getElementById('membershipType'), membership); fire(document.getElementById('rankSetupSelect'), rank); fire(document.getElementById('jacketSelect'), gender);
    await new Promise(r => setTimeout(r, 200));
    const card = document.querySelector('.uniformOption[data-uniform-id="' + uniform + '"]'); if(card) card.click();
    State.membership = membership; State.gender = gender; State.rank = rank; State.uniform = uniform;
  }
  State.ribbonSelections = {}; State.badgeSelections = {}; State.badges = [];
  for(const id of step.ribbons || []) State.ribbonSelections[id] = { checked: true, devices: {}, awardValue: '', awardLabel: '' };
  for(const id of step.badges || []){ State.badgeSelections[id] = { checked: true }; }
  State.badges = (step.badges || []).slice();
  rebuildRibbonsFromGallery();
  try { refreshUI(); } catch(e) {}
  await CAPUBUniformView.render();
  await new Promise(r => setTimeout(r, 60));
  const svg = CAPUBUniformView.svg;
  return { html: svg ? svg.outerHTML.replace(/--d[0-9a-z]+/g, '--dX') : null, node: svg ? (window.__nodes = window.__nodes || new WeakMap(), window.__nodes.has(svg) ? 'same' : (window.__nodes.set(svg, 1), 'new')) : null };
})()`;

(async () => {
  const s = await openSession({ view: 'desktop' });
  const fails = [];
  let kept = 0, total = 0;
  try {
    for(const setup of SETUPS){
      await s.load();
      let last = null;
      for(const step of STEPS){
        const r = await s.ev(apply(setup, step));
        total++; if(r.node === 'same') kept++;
        last = r;
      }
      await s.load();
      const fresh = await s.ev(apply(setup, STEPS[STEPS.length - 1]));
      const ok = last.html === fresh.html;
      console.log(setup.join(' ').padEnd(40), ok ? 'same drawing' : 'DIFFERENT', last.html ? last.html.length + ' chars' : 'no drawing');
      if(!ok) fails.push(setup.join(' '));
    }
    console.log(`drawings kept: ${kept} of ${total}`);
    console.log(fails.length ? fails.map(f => 'FAIL ' + f).join('\n') : 'PASS');
    process.exitCode = fails.length ? 1 : 0;
  } catch (e) { console.error(e); process.exitCode = 2; }
  finally { await s.close(); process.exit(process.exitCode); }
})();
