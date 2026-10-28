#!/usr/bin/env node
'use strict';
// Asset packs for the site build (LIVE13 E65). The engine asks for a uniform's artwork specs one at a time, each after the
// previous one has arrived, so drawing the first uniform cost ten round trips after the 1.1 MB MANIFEST.json; on a slow
// connection that was most of the 2.7 s a member waited. This writes, into the built site only:
//
//   images/packs/manifest.json    the manifest rows the page reads (id, path, category, size, has_spec, anchors):
//                                 js/engine/core.js createSpecStore and normalizeSpec read nothing else, and the page
//                                 reads only entry(id).path. The provenance prose (basis, issues, landmarks) stays out.
//   images/packs/<uniform>-<cut>.json   every spec file the engine loads to draw that uniform bare in that cut (male or
//                                 female), for each membership and grade, found by composing each of them here with the
//                                 page's garment defaults.
//
// js/asset-packs.js fetches the uniform's pack when a uniform is drawn and serves the engine from it; a spec the pack does
// not hold (a ribbon, a badge, an option the defaults do not reach) is fetched on its own as before, so a pack only ever
// saves round trips and never changes a drawing. Each spec in a pack is its file's JSON, parsed and written back unchanged.
//
//   node scripts/build-asset-packs.cjs --out=DIR    write DIR/images/packs/ from this repository's images/
//   scripts/build-site.cjs calls applyToSite(dist) after copying the site.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// The fields of a manifest row the page reads (js/engine/core.js normalizeSpec, js/uniform-view.js entry().path).
const MANIFEST_FIELDS = ['id', 'path', 'category', 'w_in', 'h_in', 'size_source', 'has_spec', 'anchors'];

function garmentDefaults(){
  // The page's own defaults (js/uniform-view.js GARMENT_DEFAULTS), read from the source so the two cannot drift.
  const src = fs.readFileSync(path.join(ROOT, 'js', 'uniform-view.js'), 'utf8');
  const m = /const GARMENT_DEFAULTS = (\{[\s\S]*?\});/.exec(src);
  if(!m) throw new Error('js/uniform-view.js no longer has GARMENT_DEFAULTS');
  return Function(`return (${m[1]});`)();
}

function ranks(){
  const src = fs.readFileSync(path.join(ROOT, 'js', 'state.js'), 'utf8');
  const m = /const RANKS = (\{[\s\S]*?\});/.exec(src);
  if(!m) throw new Error('js/state.js no longer has RANKS');
  return Function(`return (${m[1]});`)();
}

async function build({ imagesDir = path.join(ROOT, 'images') } = {}){
  const core = require('../js/engine/core.js');
  require('../js/engine/awards.js');
  const G = require('../js/engine/grades.js');
  const P = require('../js/engine/profiles.js');
  require('../js/engine/profiles-field.js');
  require('../js/engine/profiles-dress.js');
  require('../js/engine/profiles-polo.js');
  const rules = require('../data/uniform-rules.js');

  const manifest = JSON.parse(fs.readFileSync(path.join(imagesDir, 'MANIFEST.json'), 'utf8'));
  const slim = { assets: (manifest.assets || []).map(a => {
    const row = {};
    for(const k of MANIFEST_FIELDS) if(a[k] !== undefined) row[k] = a[k];
    return row;
  }) };

  const defaults = garmentDefaults();
  const RANKS = ranks();
  const packs = {};
  for(const uniform of Object.keys(rules.RULES)) for(const gender of ['male', 'female']){
    const used = new Set();
    const store = core.createSpecStore(manifest, p => { used.add(p); return Promise.resolve(JSON.parse(fs.readFileSync(path.join(imagesDir, p), 'utf8'))); });
    for(const membership of ['senior', 'cadet']){
      if(!rules.isUniformAllowedFor(uniform, membership, { adultCadet: true })) continue;
      for(const rank of RANKS[membership]){
        // With and without a name, so the nameplate a typed name brings is in the pack too.
        for(const name of [{ first: '', last: '', state: '', show: true }, { first: 'Pat', last: 'Doe', state: 'Tennessee', show: true }]){
          const build = {
            uniform, gender, membership, grade: G.gradeInfo(membership, rank, { track: defaults.noGradeTrack }),
            opt: Object.assign({}, defaults, { rackColumns: 3, rackArrangement: 'lapel', rackCounts: null, miniStyle: 'mounting' }),
            name,
            ribbons: [], medals: [], badges: [], badgeChoices: {}, command: null, militaryBadges: [], patches: [], cord: null
          };
          try { await P.composeUniform(build, store); } catch (err) { /* a combination the page would not offer */ }
        }
      }
    }
    const specs = {};
    for(const p of [...used].sort()) specs[p] = JSON.parse(fs.readFileSync(path.join(imagesDir, p), 'utf8'));
    packs[`${uniform}-${gender}`] = specs;
  }
  return { manifest: slim, packs };
}

// Writes the packs under outDir/images/packs and returns the index js/asset-packs.js is given.
async function write(outDir){
  const { manifest, packs } = await build();
  const dir = path.join(outDir, 'images', 'packs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  const index = { manifest: 'packs/manifest.json', uniforms: {} };
  for(const [key, specs] of Object.entries(packs)){
    const file = `packs/${key}.json`;
    fs.writeFileSync(path.join(outDir, 'images', file), JSON.stringify({ specs }));
    index.uniforms[key] = file;
  }
  return index;
}

// For the site build: writes the packs into siteDir (a copy of the page with its js/ and images/), names them in
// siteDir/js/asset-packs.js and preloads the slim manifest from siteDir/index.html. The preload is at the scripts' low
// priority, so it does not hold up the first paint, and its URL is the one js/dom-assets.js ASSET() builds (images/,
// the path, ?v= the artwork version of data/asset-index.js), so the page's fetch() takes the preloaded response.
async function applyToSite(siteDir){
  const index = await write(siteDir);
  const packsPath = path.join(siteDir, 'js', 'asset-packs.js');
  const packsJs = fs.readFileSync(packsPath, 'utf8');
  if(!packsJs.includes('const PACKS = null;')) throw new Error('js/asset-packs.js no longer has "const PACKS = null;" to replace.');
  fs.writeFileSync(packsPath, packsJs.replace('const PACKS = null;', `const PACKS = ${JSON.stringify(index)};`));
  const version = require('../data/asset-index.js').version;
  const preload = `<link rel="preload" href="images/${index.manifest}?v=${version}" as="fetch" crossorigin="anonymous" fetchpriority="low">`;
  const htmlPath = path.join(siteDir, 'index.html');
  const page = fs.readFileSync(htmlPath, 'utf8');
  if(!page.includes('</head>')) throw new Error('index.html has no </head> for the manifest preload.');
  fs.writeFileSync(htmlPath, page.replace('</head>', `${preload}\n</head>`));
  return index;
}

if(require.main === module){
  const outArg = process.argv.find(a => a.startsWith('--out='));
  if(!outArg){ console.error('usage: node scripts/build-asset-packs.cjs --out=DIR'); process.exit(1); }
  write(path.resolve(outArg.slice('--out='.length))).then(index => console.log(JSON.stringify(index, null, 1)));
}
module.exports = { build, write, applyToSite, MANIFEST_FIELDS };
