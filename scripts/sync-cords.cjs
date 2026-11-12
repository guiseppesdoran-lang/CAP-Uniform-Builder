#!/usr/bin/env node
// Brings the cord list and the braid drawing of the artwork tree into this tree: every shoulder cord the builder offers (the seven of the regulation and the
// wing and region supplement cords) as data, and the one function that draws any of them.
//
//   node scripts/sync-cords.cjs              copy, then rewrite data/cords.js and js/engine/cord-braid.js
//   node scripts/sync-cords.cjs --dry-run    report what a sync would do; write nothing
//   node scripts/sync-cords.cjs --check      exit 1 when a sync would change a file (the tree is behind the art tree) or the list is malformed
//   node scripts/sync-cords.cjs --list <file> --braid <file>    take the two files from there (CORDS_LIST, CORDS_BRAID in the environment do the same)
//
// Sources (ARTWORK_SRC as scripts/sync-artwork.cjs: <art tree>/artwork-samples/assets):
//   <ARTWORK_SRC>/cords/cords.json                  the cord list: styles, extras, the palette (colour name -> main and dark hex), the metals of the strands' tips,
//                                                   the colours a unit commander's own choice may take, the seven regulation cords and the supplement cords
//   <ARTWORK_SRC>/../base-art/cord-braid.js         CordBraid, the drawing: draw(points, cord, opts), resolve(list, id, colour), LOOK
//
// What a sync writes:
//   * data/cords.js              the list as window.CAP_CORDS (module.exports in node), less the art tree's own notes ("about" and each cord's "figure": where in the
//                                supplement's pages its picture is, not data the page reads)
//   * js/engine/cord-braid.js    the drawing function, byte for byte
// A list that breaks one of its own rules (an id twice, a colour not in the palette, a chosen colour that is a regulation cord's, a cord of a style that has the
// wrong number of colours) is refused and nothing is written. A missing braid file leaves the drawing function as it is. Idempotent; never touches index.html.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'cords.js');
const BRAID_OUT = path.join(ROOT, 'js', 'engine', 'cord-braid.js');

const artRoot = () => process.env.ARTWORK_SRC || path.join(ROOT, '..', 'UniformBuilder', 'artwork-samples', 'assets');
const sources = (o = {}) => ({
  list: o.list || process.env.CORDS_LIST || path.join(artRoot(), 'cords', 'cords.json'),
  braid: o.braid || process.env.CORDS_BRAID || path.join(artRoot(), '..', 'base-art', 'cord-braid.js')
});

// The seven cords of CAPR 39-1 9.3, by the ids the list gives them (the page's state keeps them with underscores: group, color_guard, honor_guard, aide_de_camp).
const REGULATION = ['group', 'wing', 'region', 'national', 'color-guard', 'honor-guard', 'aide-de-camp'];
const STYLES = ['solid', 'interwoven', 'edge-centre', 'chosen'];
const ID = /^[a-z][a-z0-9-]*$/;
// Notes of the art tree that are not data for the page.
const NOT_DATA = new Set(['about', 'figure']);

// The rules of the list, checked before anything is written. Returns the problems, empty when the list is sound.
function problems(list){
  const out = [];
  const bad = msg => out.push(msg);
  if(!list || typeof list !== 'object' || Array.isArray(list)) return ['the list is not an object'];
  const palette = list.palette || {}, metals = list.metals || {};
  for(const [name, p] of Object.entries(palette)) if(!p || !/^#[0-9a-f]{6}$/i.test(p.main) || !/^#[0-9a-f]{6}$/i.test(p.dark)) bad(`palette "${name}" is not a main and a dark hex colour`);
  for(const [name, p] of Object.entries(metals)) if(!p || !/^#[0-9a-f]{6}$/i.test(p.main) || !/^#[0-9a-f]{6}$/i.test(p.dark)) bad(`metal "${name}" is not a main and a dark hex colour`);
  const reg = Array.isArray(list.regulation) ? list.regulation : [], sup = Array.isArray(list.supplement) ? list.supplement : [];
  if(!reg.length) bad('the list has no regulation cords');
  if(JSON.stringify(reg.map(c => c && c.id)) !== JSON.stringify(REGULATION)) bad(`the regulation cords are not ${REGULATION.join(', ')}`);
  const seen = new Set();
  const regColours = new Set();
  for(const [group, cords] of [['regulation', reg], ['supplement', sup]]){
    for(const c of cords){
      const id = c && c.id;
      if(typeof id !== 'string' || !ID.test(id)){ bad(`a ${group} cord has no usable id: ${JSON.stringify(c)}`); continue; }
      if(seen.has(id)) bad(`cord id ${id} is in the list twice`);
      seen.add(id);
      if(typeof c.name !== 'string' || !c.name) bad(`${id}: no name`);
      if(!STYLES.includes(c.style)){ bad(`${id}: style ${JSON.stringify(c.style)} is not one of ${STYLES.join(', ')}`); continue; }
      const names = c.style === 'edge-centre' ? [c.edge, c.centre] : c.style === 'chosen' ? [] : c.colours;
      const want = c.style === 'solid' ? 1 : c.style === 'chosen' ? 0 : 2;
      if(!Array.isArray(names) || names.length !== want || names.some(n => typeof n !== 'string')) bad(`${id}: a ${c.style} cord takes ${want} colour name(s)`);
      else for(const n of names){ if(!palette[n]) bad(`${id}: colour "${n}" is not in the palette`); if(group === 'regulation') regColours.add(n); }
      if(c.style === 'edge-centre' && c.colours) bad(`${id}: an edge-centre cord names "edge" and "centre", not "colours"`);
      if(c.strand){
        if(!palette[c.strand.colour]) bad(`${id}: strand colour "${c.strand.colour}" is not in the palette`);
        if(!metals[c.strand.tip]) bad(`${id}: strand tip "${c.strand.tip}" is not in the metals`);
      }
      if(c.aiguillette !== undefined && !palette[c.aiguillette]) bad(`${id}: aiguillette colour "${c.aiguillette}" is not in the palette`);
      if(c.knot !== undefined && c.knot !== true) bad(`${id}: knot is true or absent`);
      if(group === 'regulation' && c.style === 'chosen') bad(`${id}: a regulation cord's colour is not chosen`);
    }
  }
  // The colours a unit commander's own choice may take: in the palette, and never a colour of a regulation cord (Delaware and North Carolina supplements).
  const chosen = list.chosen_colours;
  if(!Array.isArray(chosen) || !chosen.length) bad('chosen_colours is empty');
  else for(const n of chosen){
    if(!palette[n]) bad(`chosen colour "${n}" is not in the palette`);
    if(regColours.has(n)) bad(`chosen colour "${n}" is the colour of a regulation cord`);
  }
  if(sup.some(c => c && c.style === 'chosen') && (!Array.isArray(chosen) || !chosen.length)) bad('a cord takes a chosen colour and the list offers none');
  return out;
}

// The page's copy of the list: the art tree's notes left out, everything else as given, a cord or a table row to a line.
function strip(v){
  if(Array.isArray(v)) return v.map(strip);
  if(v && typeof v === 'object'){
    const o = {};
    for(const k of Object.keys(v)) if(!NOT_DATA.has(k)) o[k] = strip(v[k]);
    return o;
  }
  return v;
}
function cordsText(list){
  const data = strip(list);
  const rows = Object.keys(data).map(k => {
    const v = data[k];
    if(Array.isArray(v)) return `    ${JSON.stringify(k)}: [\n${v.map(x => '      ' + JSON.stringify(x)).join(',\n')}\n    ]`;
    if(v && typeof v === 'object') return `    ${JSON.stringify(k)}: {\n${Object.keys(v).map(n => '      ' + JSON.stringify(n) + ': ' + JSON.stringify(v[n])).join(',\n')}\n    }`;
    return `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  });
  return `// Generated by scripts/sync-cords.cjs from the artwork tree's cord list. Do not edit by hand.
// Every shoulder cord the builder offers. "regulation": the seven cords of the regulation (ids with hyphens; the page's state keeps them with underscores);
// "supplement": the cords of the wing and region supplements, one entry each (the supplement data refers to them by id only). A cord names its style (solid,
// interwoven, edge-centre or chosen) and its colours by name; "palette" and "metals" give each name's main and dark hex, "chosen_colours" the colours a
// unit commander's own choice may take. js/engine/cord-braid.js draws them.
(function(root){
  const cords = {
${rows.join(',\n')}
  };
  if(typeof module === 'object' && module.exports) module.exports = cords;
  else root.CAP_CORDS = cords;
})(typeof self !== 'undefined' ? self : this);
`;
}

const read = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;

// What a sync would do: the list (parsed, with its problems), the texts to write and which of them differ from what the tree holds.
function plan(o = {}){
  const src = sources(o), out = { src, list: null, problems: [], files: [] };
  const listText = read(src.list);
  if(listText === null) out.problems.push('the cord list is not in the art tree');
  else{
    try{ out.list = JSON.parse(listText); }catch(e){ out.problems.push('the cord list is not JSON (' + e.message + ')'); }
    if(out.list) out.problems.push(...problems(out.list));
  }
  if(!out.problems.length){
    const text = cordsText(out.list), have = read(OUT);
    out.files.push({ dest: OUT, rel: 'data/cords.js', text, change: have === null ? 'new' : have === text ? 'same' : 'updated' });
  }
  const braid = read(src.braid);
  if(braid !== null){
    const have = read(BRAID_OUT);
    out.files.push({ dest: BRAID_OUT, rel: 'js/engine/cord-braid.js', text: braid, change: have === null ? 'new' : have === braid ? 'same' : 'updated' });
  }else out.braidMissing = true;
  return out;
}

function apply(p){
  if(p.problems.length) throw new Error('the cord list is refused, nothing written:\n  ' + p.problems.join('\n  '));
  let changed = 0;
  for(const f of p.files) if(f.change !== 'same'){ fs.mkdirSync(path.dirname(f.dest), { recursive: true }); fs.writeFileSync(f.dest, f.text); changed++; }
  return changed;
}

const pending = p => p.problems.length > 0 || p.files.some(f => f.change !== 'same') || !!p.braidMissing && !fs.existsSync(BRAID_OUT);

function report(p, out){
  const n = p.list ? (p.list.regulation || []).length + (p.list.supplement || []).length : 0;
  out(`cord list: ${p.list ? `${n} cords (${(p.list.regulation || []).length} regulation, ${(p.list.supplement || []).length} supplement)` : 'not read'}`);
  for(const f of p.files) out(`${f.rel}: ${f.change}`);
  if(p.braidMissing) out('cord-braid.js: not in the art tree yet, the drawing function is left as it is');
  if(p.problems.length) out('problems:\n  ' + p.problems.join('\n  '));
}

if(require.main === module){
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const p = plan({ list: opt('--list'), braid: opt('--braid') });
  if(args.includes('--check')){
    if(pending(p)){ report(p, console.error); console.error('the tree is behind the art tree: run node scripts/sync-cords.cjs'); process.exit(1); }
    console.log('cord list and braid drawing are current.');
  }else if(args.includes('--dry-run')) report(p, console.log);
  else{
    report(p, console.log);
    if(p.problems.length) process.exit(1);
    const changed = apply(p);
    console.log(changed ? `${changed} file(s) written` : 'nothing to write');
  }
}
module.exports = { plan, apply, pending, problems, cordsText, strip, sources, REGULATION, OUT, BRAID_OUT };
