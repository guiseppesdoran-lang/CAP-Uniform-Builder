'use strict';
// LIVE13 E131 (Doran: "it's not allowing first names... the corporate dress nameplate has first names. The polo lets me enter it"; Ethan: "yes ill change it").
// CAPR 39-1: the first name is worn on the polo (5.3.2.1.1: "First and last"), the FDU tag (8.2.4.1: "name (first and last)") and the CFDU tag (8.3.4.1). The Corporate Service
// Dress nameplate is "last name and state, region, or national" (4.2.3.1.1.2, 4.2.4.1.1.2), the aviator shirt's nametag "the last name engraved" (4.2.5.1.2.1, 4.2.6.2.6.1), and
// every other nametag and tape the last name. So the First name field is offered where the regulation prints a first name, and the line under the fields says which uniforms those are.
// 3 November 2026 (Ethan: "in the beginning, ask for all parts (first last and wing)"): the page now asks for first name, last name and wing for every member; the rule only decides what is engraved.
// 2 November 2026 (Ethan): the Corporate Service Dress nameplate takes the first name too (engraved FIRST LAST), so the field is offered there as well; the aviator shirt's tag stays last name only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const G = require('../js/engine/grades.js');
const root = path.join(__dirname, '..');

function nameUi(uniform){
  const els = { firstNameRow: { hidden: null }, plateLineRow: { hidden: null }, hint: { textContent: '' } };
  els.nameHint = els.hint;
  const State = { uniform, gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [] };
  const make = tag => ({ tag, children: [], append(){}, addEventListener(){}, set textContent(v){}, set htmlFor(v){} });
  const doc = { addEventListener(){}, getElementById: id => els[id] || (id === 'garmentOptions' ? { textContent: '', append(){} } : id === 'garmentOptionsPanel' ? { hidden: true } : null), querySelector: sel => /hintText/.test(sel) ? els.hint : null, createElement: make };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: doc, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return els;
}

test('the name block asks for every part on every uniform (first, last, wing); the line under it says which uniforms show the first name', () => {
  const all = ['blues_a', 'blues_b', 'mess_dress', 'semi_formal_usaf', 'semi_formal', 'aviator', 'aviator_blazer', 'abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit', 'polo'];
  for(const u of all){
    const ui = nameUi(u), full = ['polo', 'flight_suit', 'corporate_flight_suit', 'aviator_blazer'].includes(u);
    assert.equal(ui.firstNameRow.hidden, false, `${u}: the first name field is always offered`);
    assert.equal(ui.plateLineRow.hidden, false, `${u}: and the wing field`);
    assert.match(ui.hint.textContent, /The first name is shown on the polo \(5\.3\.2\.1\.1\)/, `${u}: the hint names the polo`);
    assert.match(ui.hint.textContent, /flight duty uniforms \(8\.2\.4\.1, 8\.3\.4\.1\)/, `${u}: and the flight duty uniforms`);
    assert.match(ui.hint.textContent, /Corporate Service Dress nameplate \(4\.2\.3\.1\.1\.2, 4\.2\.4\.1\.1\.2\)/, `${u}: and the Corporate Service Dress nameplate`);
    assert.match(ui.hint.textContent, full ? /This uniform shows the first and last name/ : /This uniform shows the last name only/, `${u}: and says what this uniform shows`);
  }
  assert.match(nameUi('aviator_blazer').hint.textContent, /4\.2\.3\.1\.1\.2/, 'the Corporate Service Dress nameplate paragraph is cited');
});

test('the page labels the three fields First name, Last name and Wing, with the wing line explained', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const block = html.slice(html.indexOf('id="capubV2TextPanel"'), html.indexOf('</details>', html.indexOf('id="capubV2TextPanel"')));
  const order = ['capubV2FirstName', 'capubV2LastName', 'capubV2PlateLine', 'capubV2ShowText'].map(id => block.indexOf(`id="${id}"`));
  assert.ok(order.every(i => i > 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'first, last, wing, then the show box');
  assert.match(block, /<label class="fieldLabel" for="capubV2FirstName">First name<\/label>/);
  assert.match(block, /<label class="fieldLabel mt-8" for="capubV2LastName">Last name<\/label>/);
  assert.match(block, /<label class="fieldLabel mt-8" for="capubV2PlateLine">Wing<\/label>\s*<input id="capubV2PlateLine" maxlength="24" placeholder="e\.g\. New York, Tennessee, etc\."\/>\s*<div class="hintText">The state or region shown on nameplates\.<\/div>/);
  assert.match(block, /Show my name on the uniform/);
  assert.doesNotMatch(block, /<details/, 'the three fields are not inside a second fold');
});

test('the first name reaches the engine only on the uniforms that print it', () => {
  const view = fs.readFileSync(path.join(root, 'js', 'uniform-view.js'), 'utf8');
  assert.match(view, /const nameWorn = \{ first: !fullNames \|\| fullNames\.includes\(State\.uniform\) \};/);
  assert.match(view, /name: \{ first: nameWorn\.first \? \(text\.firstName \|\| ''\) : ''/);
});

