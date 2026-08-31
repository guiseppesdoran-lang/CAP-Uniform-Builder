const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('PNG export preserves the CSS border-box around every layer', () => {
  assert.match(source, /const contentBox = style\.boxSizing !== 'border-box'/);
  assert.match(source, /const outerW = contentBox \? cssW \+ horizontalChrome : cssW/);
  assert.match(source, /ctx\.translate\(x \+ outerW\/2, y \+ outerH\/2\)/);
  assert.match(source, /ctx\.drawImage\(el, contentLeft, contentTop, contentW, contentH\)/);
});

test('utility command badges honor saved calibration without whole-pixel rounding', () => {
  const commandBlock = source.match(/commandBadges\.forEach\(img => \{([\s\S]*?)\n\s*\}\);/)?.[1] || '';
  assert.match(commandBlock, /getCalib\(img\.dataset\.calibKey\)/);
  assert.match(commandBlock, /Number\.isFinite\(Number\(saved\?\.x\)\)/);
  assert.match(commandBlock, /img\.style\.left = `\$\{x\}px`/);
  assert.doesNotMatch(commandBlock, /Math\.round/);
});

test('utility qualification badges retain fractional calibrated coordinates', () => {
  assert.match(source, /img\.style\.left = `\$\{Number\(placement\?\.x \?\? positions\[i\]\.x\)\}px`/);
  assert.match(source, /img\.style\.top = `\$\{Number\(placement\?\.y \?\? positions\[i\]\.y\)\}px`/);
});
