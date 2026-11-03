'use strict';
// LIVE13 E131 (Doran: "it's not allowing first names... the corporate dress nameplate has first names. The polo lets me enter it"; Ethan: "yes ill change it").
// CAPR 39-1: the first name is worn on the polo (5.3.2.1.1: "First and last"), the FDU tag (8.2.4.1: "name (first and last)") and the CFDU tag (8.3.4.1). The Corporate Service
// Dress nameplate is "last name and state, region, or national" (4.2.3.1.1.2, 4.2.4.1.1.2), the aviator shirt's nametag "the last name engraved" (4.2.5.1.2.1, 4.2.6.2.6.1), and
// every other nametag and tape the last name. So the First name field is offered where the regulation prints a first name, and the line under the fields says which uniforms those are.
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
  const State = { uniform, gender: 'male', membership: 'senior', rank: 'Capt', garment: {}, badges: [] };
  const make = tag => ({ tag, children: [], append(){}, addEventListener(){}, set textContent(v){}, set htmlFor(v){} });
  const doc = { addEventListener(){}, getElementById: id => els[id] || (id === 'garmentOptions' ? { textContent: '', append(){} } : id === 'garmentOptionsPanel' ? { hidden: true } : null), querySelector: sel => /hintText/.test(sel) ? els.hint : null, createElement: make };
  const sandbox = { State, CAPUBEngine: { grades: G }, document: doc, window: {}, console };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'garment-options.js'), 'utf8'), sandbox);
  sandbox.CAPUBGarmentOptions.render(true);
  return els;
}

test('the First name field is offered on the polo, both flight duty uniforms and the Corporate Service Dress nameplate only, and the hint under the fields says so for every uniform', () => {
  const all = ['blues_a', 'blues_b', 'mess_dress', 'semi_formal_usaf', 'semi_formal', 'aviator', 'aviator_blazer', 'abu', 'ocp', 'corporate_field', 'flight_suit', 'corporate_flight_suit', 'polo'];
  for(const u of all){
    const ui = nameUi(u), full = ['polo', 'flight_suit', 'corporate_flight_suit', 'aviator_blazer'].includes(u);
    assert.equal(ui.firstNameRow.hidden, !full, `${u}: first name field ${full ? 'offered' : 'hidden'}`);
    assert.match(ui.hint.textContent, /polo \(5\.3\.2\.1\.1\)/, `${u}: the hint names the polo`);
    assert.match(ui.hint.textContent, /flight duty uniforms \(8\.2\.4\.1, 8\.3\.4\.1\)/, `${u}: and the flight duty uniforms`);
    assert.match(ui.hint.textContent, /Corporate Service Dress nameplate \(4\.2\.3\.1\.1\.2, 4\.2\.4\.1\.1\.2\)/, `${u}: and the Corporate Service Dress nameplate`);
    assert.match(ui.hint.textContent, full ? /This uniform shows the first and last name/ : /This uniform shows the last name only/, `${u}: and says what this uniform shows`);
  }
  assert.equal(nameUi('aviator_blazer').plateLineRow.hidden, false, 'the blazer keeps its state line');
  assert.match(nameUi('aviator_blazer').hint.textContent, /4\.2\.3\.1\.1\.2/, 'the Corporate Service Dress nameplate paragraph is cited');
});
