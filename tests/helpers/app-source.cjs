'use strict';
// The builder's code is split between the inline scripts in index.html and the
// classic scripts under js/ that it loads. Tests that assert on source text read
// everything through here so moving code between those files does not break them.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function readAppSource() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const jsDir = path.join(ROOT, 'js');
  const extracted = fs.existsSync(jsDir)
    ? fs.readdirSync(jsDir).filter(name => name.endsWith('.js')).sort()
        .map(name => fs.readFileSync(path.join(jsDir, name), 'utf8'))
    : [];
  return [html, ...extracted].join('\n');
}

module.exports = { readAppSource, ROOT };
