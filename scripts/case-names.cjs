'use strict';
// Proper-cases the user-visible names in the data files (LIVE13 E103: "military ribbons need to be
// capitalized (everything should be properly capitalized)").
//
//   node scripts/case-names.cjs          dry run: print every name that would change
//   node scripts/case-names.cjs --write  rewrite the data files
//
// Idempotent: a second run changes nothing. Ids, keys, aliases, paths and regulation citations are never
// touched; aliases stay lowercase (military-core.js and the importers match on lowercased strings).
//
// What it changes:
//   military/military-data.js  award `name` and `officialName` (type RIBBON; the RANK records are scraped
//                              page titles that canonicalizeAwards never offers). Title case by the rules
//                              below, the spelling slips fixed (TYPOS), the scrape suffixes dropped
//                              ("military ribbon", "Military Medal &"), "&" spelled "and", and the official
//                              forms in OFFICIAL_NAMES. Badge names are checked with the same rules.
//                              The canonical ribbon id is derived from the name (canonicalAwardKey), so
//                              where a fix moves it, the old canonical id is kept in `legacyCanonicalIds`
//                              (only when the old id is not the record's own id, which already migrates).
//   data/unit-options.js       the two unit names typed in mixed case among 1,454 eServices upper-case
//                              names are written in upper case like the rest.
// The rules live here so tests/name-casing.test.cjs checks the data against the same lists.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// Articles, conjunctions and short prepositions: lower case except as the first or last word.
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'nor', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'with', 'from', 'as']);

// Acronyms and set forms, by their lowercase spelling.
const ACRONYMS = Object.freeze({
  usaf: 'USAF', ussf: 'USSF', usa: 'USA', usn: 'USN', usmc: 'USMC', uscg: 'USCG', us: 'US',
  nco: 'NCO', pow: 'POW', mia: 'MIA', rotc: 'ROTC', jrotc: 'JROTC', afjrotc: 'AFJROTC', afrotc: 'AFROTC',
  nrotc: 'NROTC', dod: 'DoD', osd: 'OSD', un: 'UN', nato: 'NATO', sar: 'SAR', emt: 'EMT', rok: 'ROK',
  rvn: 'RVN', gwot: 'GWOT', wwii: 'WWII', nasa: 'NASA', af: 'AF', puc: 'PUC', muc: 'MUC', dot: 'DOT',
  cap: 'CAP', suas: 'sUAS', uas: 'UAS', hq: 'HQ', nhq: 'NHQ', stem: 'STEM', cac: 'CAC', afa: 'AFA',
  afsa: 'AFSA', vfw: 'VFW', iace: 'IACE', seal: 'SEAL', eod: 'EOD', ocp: 'OCP', abu: 'ABU', cfu: 'CFU',
  fdu: 'FDU', nra: 'NRA', ns: 'NS',
  ii: 'II', iii: 'III', iv: 'IV', vi: 'VI', vii: 'VII', viii: 'VIII', xii: 'XII'
});
// Multi-part set forms the token rules cannot build.
const SET_FORMS = Object.freeze({ 'covid-19': 'COVID-19' });

// Spelling slips in names (lowercase, whole words). The id keeps its spelling.
const TYPOS = Object.freeze({
  distinguishd: 'distinguished', distinguihsed: 'distinguished', condcut: 'conduct', kuwiat: 'kuwait',
  componets: 'components', comabt: 'combat', sercurity: 'security', rediness: 'readiness',
  "womens's": "women's", miltiary: 'military', commedation: 'commendation', achievment: 'achievement'
});

// Award names as the services print them, where casing and the typo list are not enough (by record id).
const OFFICIAL_NAMES = Object.freeze({
  airmans_medal: "Airman's Medal",
  army_soldiers_medal: "Soldier's Medal",
  bronze_star: 'Bronze Star Medal',
  army_womens_army_corps_service: "Women's Army Corps Service",
  coast_guard_commandants_letter_of_commendation: "Commandant's Letter of Commendation",
  coast_guard_combat_action: 'Coast Guard Combat Action',          // was "Comabt Action"; "Combat Action" alone would merge it into the Navy/USMC ribbon
  european_african_middle_eastern_campaign: 'European-African-Middle Eastern Campaign',
  asiatic_pacific_campaign: 'Asiatic-Pacific Campaign',
  inter_american_defense_board: 'Inter-American Defense Board',
  kuwait_liberation_saudi: 'Kuwait Liberation (Saudi Arabia)',
  kuwait_liberation_kuwait: 'Kuwait Liberation (Kuwait)',
  national_defense_service: 'National Defense Service',             // was "national defense military service"
  us_antarctic_expedition: 'U.S. Antarctic Expedition',             // was "us antarctic expedition ribbon"; a medal
  army_occupation_of_germany: 'Army of Occupation of Germany Medal', // was "Army Occupation of Germany Military Medal &"
  china_relief_expedition: 'China Relief Expedition Medal',         // was "China Relief Expedition Military Medal"
  dot_9_11_ribbon: 'DOT 9-11 Ribbon'                                // was "DOT-9-11 Ribbon"
});

// Mixed-case spellings that are correct as written (a word starting lowercase, an inner capital).
const MIXED_CASE_OK = new Set(['sUAS', 'DoD', 'McChord', 'eServices']);

function casePart(part, { start, last }){
  if(!part) return part;
  const lower = part.toLowerCase();
  if(Object.prototype.hasOwnProperty.call(ACRONYMS, lower)) return ACRONYMS[lower];
  if(MIXED_CASE_OK.has(part)) return part;
  if(/[A-Z]/.test(part.slice(1)) && /[a-z]/.test(part)) return part;    // deliberate inner capital (McChord)
  if(part.length > 1 && part === part.toUpperCase() && /[A-Z]/.test(part)) return part; // an acronym already
  if(!start && !last && SMALL_WORDS.has(lower)) return lower;
  const i = lower.search(/[a-z]/);
  if(i < 0) return part;                                                // digits or punctuation
  return lower.slice(0, i) + lower[i].toUpperCase() + lower.slice(i + 1);
}

// Title case: every principal word capitalized, small words lower unless first or last, a capital after a
// hyphen, a slash or an opening parenthesis, acronyms in their set form, possessives kept.
function titleCase(value){
  let s = String(value || '').replace(/\s+/g, ' ').trim();
  for(const [k, v] of Object.entries(SET_FORMS)) s = s.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
  const words = s.split(' ');
  return words.map((word, wi) => {
    const parts = word.split(/([-/(])/);                                  // keep the separators
    let afterSep = false;
    return parts.map((part, pi) => {
      if(part === '-' || part === '/' || part === '(') { afterSep = true; return part; }
      if(Object.values(SET_FORMS).includes(part)) return part;
      const out = casePart(part, { start: wi === 0 || afterSep || pi > 0, last: wi === words.length - 1 });
      afterSep = false;
      return out;
    }).join('');
  }).join(' ');
}

function fixTypos(value){
  return String(value || '').replace(/[A-Za-z']+/g, w => {
    const fix = TYPOS[w.toLowerCase()];
    if(!fix) return w;
    return w[0] === w[0].toUpperCase() ? fix[0].toUpperCase() + fix.slice(1) : fix;
  });
}

// The scrape left vendor suffixes on some names; "&" is "and" in every official award name.
function stripScrape(value){
  return String(value || '')
    .replace(/\s+military\s+ribbons?\s*$/i, '')
    .replace(/\s+military\s+medal\s*&?\s*$/i, ' Medal')
    .replace(/\s*&\s*$/, '')
    .replace(/\s+&\s+/g, ' and ');
}

function properAwardName(award){
  if(OFFICIAL_NAMES[award.id]) return OFFICIAL_NAMES[award.id];
  return titleCase(fixTypos(stripScrape(award.officialName || award.name)));
}

// --- military/military-data.js -----------------------------------------------------------------------------
const MIL_FILE = path.join(ROOT, 'military', 'military-data.js');
const MIL_PRE = '(function(root){ root.CAPUBMilitaryData = Object.freeze(';
const MIL_POST = "); })(typeof globalThis !== 'undefined' ? globalThis : window);\n";

function readMilitary(){
  const text = fs.readFileSync(MIL_FILE, 'utf8');
  if(!text.startsWith(MIL_PRE) || !text.endsWith(MIL_POST)) throw new Error('military-data.js wrapper changed; update case-names.cjs');
  const json = text.slice(MIL_PRE.length, text.length - MIL_POST.length);
  const data = JSON.parse(json);
  if(JSON.stringify(data) !== json) throw new Error('military-data.js JSON does not round-trip; refusing to rewrite');
  return data;
}

function caseMilitary(data){
  const core = require(path.join(ROOT, 'military', 'military-core.js'));
  const changes = [];
  for(const award of data.awards){
    if(String(award.type || 'RIBBON').toUpperCase() !== 'RIBBON') continue;
    const before = { name: award.name, officialName: award.officialName };
    const oldKey = core.canonicalAwardKey(award);
    const next = properAwardName(award);
    for(const field of ['name', 'officialName']){
      if(award[field] !== undefined && award[field] !== next){ changes.push({ file: 'military/military-data.js', id: award.id, field, before: award[field], after: next }); award[field] = next; }
    }
    const newKey = core.canonicalAwardKey(award);
    if(newKey !== oldKey && oldKey !== award.id){
      award.legacyCanonicalIds = [...new Set([...(award.legacyCanonicalIds || []), oldKey])];
    }
    void before;
  }
  for(const badge of data.badges){
    for(const field of ['name', 'officialName']){
      if(typeof badge[field] !== 'string') continue;
      const next = titleCase(fixTypos(badge[field]));
      if(next !== badge[field]){ changes.push({ file: 'military/military-data.js', id: badge.id, field, before: badge[field], after: next }); badge[field] = next; }
    }
  }
  return changes;
}

// --- data/unit-options.js ----------------------------------------------------------------------------------
const UNIT_FILE = path.join(ROOT, 'data', 'unit-options.js');
function caseUnits(text){
  const changes = [];
  const out = text.replace(/"code":"([^"]+)","name":"([^"]*[a-z][^"]*)"/g, (m, code, name) => {
    const next = name.toUpperCase();
    changes.push({ file: 'data/unit-options.js', id: code, field: 'name', before: name, after: next });
    return `"code":"${code}","name":"${next}"`;
  });
  return { out, changes };
}

function run({ write = false } = {}){
  const all = [];
  const mil = readMilitary();
  const milChanges = caseMilitary(mil);
  all.push(...milChanges);
  if(write && milChanges.length) fs.writeFileSync(MIL_FILE, MIL_PRE + JSON.stringify(mil) + MIL_POST);

  const unitText = fs.readFileSync(UNIT_FILE, 'utf8');
  const units = caseUnits(unitText);
  all.push(...units.changes);
  if(write && units.changes.length) fs.writeFileSync(UNIT_FILE, units.out);
  return all;
}

if(require.main === module){
  const write = process.argv.includes('--write');
  const changes = run({ write });
  for(const c of changes) console.log(`${c.file}  ${c.id}.${c.field}: ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`);
  const byFile = {};
  for(const c of changes) byFile[c.file] = (byFile[c.file] || 0) + 1;
  console.log(`${write ? 'Changed' : 'Would change'} ${changes.length} string(s)`, byFile);
}

module.exports = { SMALL_WORDS, ACRONYMS, SET_FORMS, TYPOS, OFFICIAL_NAMES, MIXED_CASE_OK, titleCase, fixTypos, stripScrape, properAwardName, run };
