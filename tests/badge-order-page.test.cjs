'use strict';
// The Badges card's swap (js/badge-order.js, tests/badge-order-card.test.cjs) in the page: the script is loaded with the other feature scripts and the
// stylesheet has the card's rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the page loads the script with the other feature scripts and the stylesheet styles the card; every rule of the card is in it', () => {
  const html = read('index.html');
  assert.match(html, /<script src="js\/badge-order\.js\?v=[0-9a-f]{10}" defer><\/script>/);
  assert.ok(html.indexOf('<script src="js/badge-order.js') < html.indexOf('<script src="js/bootstrap.js'), 'before the first drawing');
  assert.ok(html.indexOf('<script src="js/badge-order.js') > html.indexOf('<script src="js/uniform-view.js'), 'after the drawing it listens to');
  const css = read('styles/app.css');
  for(const sel of ['.badgeOrder{', '.badgeOrderGroup{', '.badgeOrderList{', '.badgeOrderRow{', '.badgeOrderName{', '.badgeOrderPosition{', '.badgeOrderButton{', '.badgeOrderStatus{'])
    assert.ok(css.includes(sel), sel);
  assert.match(css, /\.badgeOrder\.hidden\{display:none\}/);
});
