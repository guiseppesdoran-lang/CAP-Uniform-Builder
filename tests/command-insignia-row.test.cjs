'use strict';
// The command insignia pin on the Items step (member feedback: "the control that changes the commander's insignia was hard to find"): a row in the
// Badges card, labelled in plain words with the paragraph, three choices (not worn, current commander, graduated commander) that show the current
// state and set the same two things the chooser's tick and its "Graduated commander" box set, without opening the chooser. CAPR 39-1 10.2.5:
// current commanders wear the pin, graduated commanders (a year or more in office) wear it too, in the grade of lieutenant colonel and below.
// The row's behaviour in a browser is checked by tests/items-summary-browser.cjs; here its place, wording and wiring.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'js', 'workspace-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'app.css'), 'utf8');
const gallery = fs.readFileSync(path.join(root, 'js', 'galleries.js'), 'utf8');

test('the row is in the Badges card on the Items step, a labelled group of three radios, with the paragraph', () => {
  const items = html.slice(html.indexOf('id="stepGroup-items"'), html.indexOf('id="stepGroup-export"'));
  const card = items.slice(items.indexOf('id="groupBadges"'), items.indexOf('id="groupPatches"'));
  const row = card.slice(card.indexOf('id="commandInsigniaRow"'), card.indexOf('id="badgesPlannedNote"'));
  assert.ok(row, 'the row is inside the Badges card');
  assert.match(row, /role="group" aria-labelledby="commandInsigniaLabel"/);
  assert.match(row, />Command insignia pin</);
  assert.deepEqual([...row.matchAll(/<input type="radio" name="commandInsignia" value="([a-z]+)">/g)].map(m => m[1]), ['none', 'current', 'graduated']);
  for(const label of ['Not worn', 'Current commander', 'Graduated commander']) assert.ok(row.includes(`>${label}<`), label);
  assert.match(row, /\(CAPR 39-1, 10\.2\.5\)/);
  assert.match(row, /lieutenant colonel and below/);
  assert.doesNotMatch(row, /squadron_commander_badge|graduatedCommander|ICL|critique/i, 'no ids or internal words in the text');
});

test('the row sets what the chooser sets, through the same rebuild, and asks the same grade rule', () => {
  assert.match(ui, /function wireCommandRow\(\)/);
  assert.match(ui, /State\.commandInsignia\.graduatedCommander=input\.value==='graduated'/);
  assert.match(ui, /sel\.checked=input\.value!=='none'/);
  assert.match(ui, /canSelectCommandInsigniaForCurrentRank\(true\)/);
  assert.match(ui, /rebuildBadgesFromGallery\(\)/);
  assert.match(ui, /wireCommandRow\(\); watchImporter\(\);/, 'wired with the rest of the page on load');
  assert.match(ui, /syncCommandRow\(\);\n\s*\}/, 'follows the state at every refresh');
  // The chooser's own control is untouched.
  assert.match(gallery, /class="cmdGradChk"> Graduated commander/);
});

test('the row is shown only where a senior member can wear the pin on the uniform, and the choices close for a colonel', () => {
  assert.match(ui, /isBadgeWornOnCurrentUniform\(COMMAND_ID\)/);
  assert.match(ui, /isBadgeEligibleForMembership\(COMMAND_ID,State\.membership\)/);
  assert.match(ui, /i\.disabled=!gradeOk && i\.value!=='none'/);
  assert.match(css, /\.commandRow\.hidden\{display:none\}/);
});
