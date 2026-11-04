'use strict';
// Ethan, 2 November 2026: "Take out every mention of anyone's ruling, or any justification from these chats. That wouldn't be in any professional app." Text a member
// reads (engine notes, chooser and tile notes, help lines, panel text, template text, About) states the rule and cites the regulation paragraph, nothing else: no "ruling",
// no names, no chat or run names, no critique or item ids, no "overrides the regulation". That history belongs in commit messages and code comments, which this test does
// not read: it scans every string literal (single, double and template quotes; comments excluded) of the page's scripts and the visible text of index.html.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stringLiterals } = require('./helpers/string-literals.cjs');

const root = path.join(__dirname, '..');
const BAD = /ruling|Doran|Ethan|Discord|LIVE\d|\b[ED]\d{2,3}\b|\bB\d\b|critique/i;
// The developer credit lines, the only place the names appear.
const CREDIT = /Developed by C\/Col\. Guiseppe Doran and C\/Lt Col\. Ethan Hillard/;

const walk = (dir, out = []) => {
  for(const f of fs.readdirSync(dir, { withFileTypes: true })){
    const p = path.join(dir, f.name);
    if(f.isDirectory()){ if(f.name !== 'node_modules') walk(p, out); }
    else if(/\.js$/.test(f.name)) out.push(p);
  }
  return out;
};
const rel = p => path.relative(root, p);

const FILES = [
  ...walk(path.join(root, 'js')),
  ...fs.readdirSync(path.join(root, 'data')).filter(f => /\.js$/.test(f)).map(f => path.join(root, 'data', f)),
  ...fs.readdirSync(path.join(root, 'military')).filter(f => /\.js$/.test(f)).map(f => path.join(root, 'military', f)),
  ...fs.readdirSync(path.join(root, 'deploy', 'api', 'public')).filter(f => /\.js$/.test(f)).map(f => path.join(root, 'deploy', 'api', 'public', f)),
  path.join(root, 'deploy', 'api', 'pages.js')
].filter(f => fs.existsSync(f));

test('the lexer reads strings and skips comments and regexes', () => {
  const lits = stringLiterals("const a = 'one'; // 'no'\n/* \"no\" */ const b = `x ${f('in')} y`; const r = /'/.test(s); const c = \"two\";").map(l => l.text);
  assert.deepEqual(lits, ['one', 'x ', 'in', ' y', 'two']);
});

test('no string literal of the page\'s scripts mentions a ruling, a person, a chat, a run or an item id', () => {
  const hits = [];
  for(const f of FILES){
    for(const { text, line } of stringLiterals(fs.readFileSync(f, 'utf8'))){
      if(/^https?:\/\/\S+$/.test(text)) continue;   // an address is not text a member reads (a hash in it can look like an id)
      if(BAD.test(text)) hits.push(`${rel(f)}:${line}: ${text.slice(0, 140)}`);
    }
  }
  assert.deepEqual(hits, [], 'user-facing text states the rule and the paragraph only:\n' + hits.join('\n'));
});

test('the visible text of index.html mentions none of them either, but the developer credit lines', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // Visible text: the body without scripts, styles and comments; attribute values (titles, labels, placeholders) are checked as well.
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const texts = [...body.replace(/<[^>]*>/g, '\n').split('\n'), ...[...body.matchAll(/\b(?:title|aria-label|placeholder|alt|value)="([^"]*)"/g)].map(m => m[1])];
  const hits = texts.map(t => t.trim()).filter(t => t && BAD.test(t) && !CREDIT.test(t));
  assert.deepEqual(hits, [], 'index.html text:\n' + hits.join('\n'));
});

// The engine's notes (js/engine) are text a member reads on the figure: no process wording (artwork, overlay, pending), no commentary on the regulation (typo, joke,
// contradicts), no abbreviation a member has to decode (CSAG, NEC, HHQ; AUX stays, it is the patch's own text), and no bare id interpolated into a note (E156).
test('the engine\'s string literals carry no process wording, commentary or undecoded abbreviation, and no note prints an id', () => {
  const PROCESS = /\b(artwork|overlay|pending|typo|joke|contradict\w*|CSAG|NEC|HHQ)\b/i;
  const dir = path.join(root, 'js', 'engine');
  const hits = [];
  for(const f of fs.readdirSync(dir).filter(n => /\.js$/.test(n))){
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for(const { text, line } of stringLiterals(src)) if(PROCESS.test(text)) hits.push(`js/engine/${f}:${line}: ${text.slice(0, 140)}`);
    src.split('\n').forEach((l, i) => { if(/\bnote\(`[^`]*\$\{(?:[\w.]*\.)?id\}/.test(l)) hits.push(`js/engine/${f}:${i + 1}: a note prints an id: ${l.trim().slice(0, 120)}`); });
  }
  assert.deepEqual(hits, [], 'engine notes state the rule and the paragraph in plain words:\n' + hits.join('\n'));
});
