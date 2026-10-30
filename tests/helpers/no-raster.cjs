'use strict';
// The no-photo gate's rules, shared by tests/no-raster.test.cjs (what a build would publish, the source's scripts) and tests/security.test.cjs
// (the built dist/).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const allowlist = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'no-raster-allowlist.json'), 'utf8'));
const onList = (list, rel) => Object.keys(list).some(entry => entry.endsWith('/') ? rel.startsWith(entry) : rel === entry);
const RASTER = /\.(png|jpe?g|webp|gif)$/i;

// The rasters of a list of paths (relative to the site's root) that are not on the allowlist.
function strayRasters(paths){
  const list = allowlist();
  return paths.filter(rel => rel.startsWith('images/') && RASTER.test(rel) && !onList(list, rel));
}

function walk(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

// The picture paths a script's text names: a token ending in a raster extension that has a stem and is not a web address (a catalog's
// provenance URL names the vendor's page, not a file of this site). A bare name counts: 'curryH.png' names a file too.
function rasterNames(text){
  const out = new Set();
  for(const literal of text.matchAll(/https?:\/\/[^\s"'`]*|[^\s"'`()<>,=:{}\[\]]*\.(?:png|jpe?g|webp|gif)\b/gi)){
    const token = literal[0];
    if(/^https?:/i.test(token) || /^\.[a-z]+$/i.test(token)) continue;
    out.add(token);
  }
  return [...out];
}

// Every script the page can load: the repository's root scripts, js/, data/, military/.
function pageScripts(){
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
  for(const dir of ['js', 'data', 'military']) for(const f of walk(path.join(ROOT, dir))) if(f.endsWith('.js')) files.push(path.relative(ROOT, f).split(path.sep).join('/'));
  return files;
}

// { file, name } for every raster a page script names that the allowlist does not cover. Names are relative to images/ as often as not.
function strayNames(){
  const list = allowlist(), stray = [];
  for(const file of pageScripts()){
    if(onList(list, file)) continue;
    let text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    // The catalog's strings one by one: its provenance URLs may hold spaces, which a token scan would split.
    if(file === 'military/military-data.js'){
      const strings = (v, out) => { if(typeof v === 'string'){ if(!/^https?:/i.test(v)) out.push(v); } else if(v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out)); return out; };
      text = strings(JSON.parse(text.slice(text.indexOf('Object.freeze(') + 'Object.freeze('.length, text.lastIndexOf('); })('))), []).join('\n');
    }
    for(const name of rasterNames(text)){
      const rel = name.startsWith('images/') ? name : 'images/' + name;
      if(!onList(list, rel)) stray.push({ file, name });
    }
  }
  return stray;
}

module.exports = { ROOT, allowlist, strayRasters, strayNames, rasterNames, pageScripts, walk };
