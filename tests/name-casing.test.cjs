'use strict';
// LIVE13 E103 (Ethan): "military ribbons need to be capitalized (everything should be properly capitalized)".
// Every user-visible name in the data files reads properly cased: none starts with a lowercase letter (sUAS
// and the like excepted), no acronym in the wrong case ("nco", "Usaf", "Nato"), no doubled or edge spaces,
// none of the known spelling slips. scripts/case-names.cjs holds the rules and fixes the data; this test
// checks the data against the same lists and that a run of the script would change nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CASE = require('../scripts/case-names.cjs');

function runInContext(rel){
  const context = {};
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), context);
  return context;
}

// Acronyms that are also ordinary words ("baseball cap", "CAP seal") are not checked for case.
const ORDINARY_WORDS = new Set(['cap', 'seal', 'stem', 'us', 'dot', 'un']);
const TYPOS = new Set([...Object.keys(CASE.TYPOS), 'chaplin', 'buddist', 'yaeger', 'bridgadier', 'ribb0n', 'rbbon']);

function defects(name){
  const out = [];
  const s = String(name);
  const first = (s.match(/^[^\s,(:]+/) || [''])[0];
  if(/^[a-z]/.test(s) && !CASE.MIXED_CASE_OK.has(first)) out.push('starts lowercase');
  if(/ {2}/.test(s) || /^\s|\s$/.test(s)) out.push('doubled or edge space');
  for(const token of s.match(/[A-Za-z][A-Za-z']*/g) || []){
    const lower = token.toLowerCase();
    const canon = CASE.ACRONYMS[lower];
    if(canon && !ORDINARY_WORDS.has(lower) && token !== canon && token !== canon.toUpperCase()) out.push(`"${token}" should be ${canon}`);
    if(TYPOS.has(lower)) out.push(`typo "${token}"`);
  }
  return out;
}

function check(label, entries){
  const offenders = [];
  for(const [where, name] of entries){
    if(typeof name !== 'string') continue;
    const found = defects(name);
    if(found.length) offenders.push(`${where}: ${JSON.stringify(name)} (${found.join('; ')})`);
  }
  assert.ok(entries.length > 0, `${label}: no names found to check`);
  assert.deepEqual(offenders, [], `${label} names with casing defects:\n  ${offenders.join('\n  ')}`);
}

test('military ribbon and badge names are properly cased (military/military-data.js)', () => {
  const data = runInContext('military/military-data.js').CAPUBMilitaryData;
  const entries = [];
  for(const a of data.awards.filter(a => String(a.type || 'RIBBON').toUpperCase() === 'RIBBON')){
    entries.push([`awards.${a.id}.name`, a.name], [`awards.${a.id}.officialName`, a.officialName]);
  }
  for(const b of data.badges) entries.push([`badges.${b.id}.name`, b.name], [`badges.${b.id}.officialName`, b.officialName]);
  check('military-data', entries.filter(([, n]) => n !== undefined));
});

test('the named military ribbons read as the services print them', () => {
  const data = runInContext('military/military-data.js').CAPUBMilitaryData;
  const byId = Object.fromEntries(data.awards.map(a => [a.id, a]));
  const want = {
    air_force_medal_of_honor: 'Medal of Honor', air_force_distinguished_service: 'Air Force Distinguished Service',
    airmans_medal: "Airman's Medal", bronze_star: 'Bronze Star Medal', prisoner_of_war: 'Prisoner of War',
    air_force_good_conduct: 'Air Force Good Conduct', nco_professional_military_education_graduate: 'Air Force NCO Professional Military Education Graduate',
    air_and_space_campaign: 'Air and Space Campaign', kuwait_liberation_saudi: 'Kuwait Liberation (Saudi Arabia)',
    kuwait_liberation_kuwait: 'Kuwait Liberation (Kuwait)', nato_medal: 'NATO', republic_of_korean_war_service: 'ROK War Service',
    coast_guard_commandants_letter_of_commendation: "Commandant's Letter of Commendation",
    navy_marine_corps_medal: 'Navy and Marine Corps Medal', world_war_2: 'World War II Victory',
    air_and_space_nuclear_deterrence_operations_service_medal: 'Nuclear Deterrence Operations Service Medal'
  };
  for(const [id, name] of Object.entries(want)){
    assert.equal(byId[id].name, name, `${id}.name`);
    assert.equal(byId[id].officialName, name, `${id}.officialName`);
  }
});

test('a renamed ribbon keeps its old canonical id for saved setups', () => {
  const data = runInContext('military/military-data.js').CAPUBMilitaryData;
  const core = require('../military/military-core.js');
  for(const a of data.awards.filter(a => a.legacyCanonicalIds)){
    assert.ok(Array.isArray(a.legacyCanonicalIds) && a.legacyCanonicalIds.length, a.id);
    for(const old of a.legacyCanonicalIds) assert.notEqual(old, core.canonicalAwardKey(a), `${a.id}: the legacy id differs from the current one`);
  }
  const df = data.awards.find(a => a.id === 'air_force_distinguished_service');
  assert.deepEqual(Array.from(df.legacyCanonicalIds), ['air_force_distinguishd_service']);
});

test('ROTC ribbon and program names are properly cased (data/rotc-ribbons.js)', () => {
  const R = runInContext('data/rotc-ribbons.js').CAPUBRotcRibbons;
  check('rotc-ribbons', [...R.ribbons.map(r => [`ribbons.${r.id}`, r.name]), ...R.services.map(s => [`services.${s.key}`, s.label])]);
});

test('CAP badge names and their option labels are properly cased (data/badge-catalog.js)', () => {
  const B = require('../data/badge-catalog.js').BADGES;
  const entries = [];
  for(const [id, b] of Object.entries(B)){
    entries.push([`${id}.name`, b.name]);
    for(const opt of b.options || b.variants || []) if(Array.isArray(opt) && typeof opt[1] === 'string') entries.push([`${id}.option ${opt[0]}`, opt[1]]);
  }
  check('badge-catalog', entries);
});

test('unit names: the data keeps the eServices string; the page shows it in title case with the abbreviations spelled out', () => {
  const units = runInContext('data/unit-options.js').CAP_UNIT_OPTIONS;
  check('unit-options', units.map(u => [u.code, u.name]));
  // eServices prints unit names in upper case; the data file keeps that string (the search reads it), a name typed in mixed case among them reads as a slip.
  assert.deepEqual(Array.from(units.filter(u => /[a-z]/.test(u.name)), u => `${u.code} ${u.name}`), [], 'every raw unit name in upper case');
  const { context } = require('./helpers/page-scripts.cjs').loadPageScripts();
  const ev = src => JSON.parse(JSON.stringify(vm.runInContext(src, context)));
  const shown = ev('CAP_UNIT_OPTIONS.map(u => [u.code, u.name, u.raw])');
  assert.equal(shown.length, units.length);
  assert.deepEqual(shown.filter(([, name, raw], i) => raw !== units[i].name), [], 'the raw string is kept on each row');
  // Nothing is left in capitals but the exceptions: CAP, HQ, NHQ, USAF, state codes, Roman numerals, initials and the few abbreviations kept as written.
  const KEEP = new Set(['HQ', 'CAP', 'NHQ', 'USAF', 'ANGB', 'AFB', 'ANG', 'ARS', 'JRB', 'AB', 'DC', 'NC', 'ND', 'WV', 'WA', 'MS', 'PRWG', 'SRQ', 'NRAT', 'FCHS', 'SP', 'WISTAC', 'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII']);
  const caps = [];
  for(const [code, name] of shown) for(const w of name.match(/[A-Za-z]+/g) || []) if(w.length > 1 && w === w.toUpperCase() && !KEEP.has(w)) caps.push(`${code} ${name}`);
  assert.deepEqual(caps, [], 'no word left in capitals outside the exceptions');
  // No eServices abbreviation left in the shown names.
  const abbr = shown.filter(([, name]) => /\b(SQDN|SQ|SQD|COMP|WG|NATL|HQS|HEADQRTS|GRP|FLT|MASS|ISL|SQUADRODN)\b/i.test(name.replace(/\bMass\b/g, '')));
  assert.deepEqual(abbr.map(a => `${a[0]} ${a[1]}`), []);
  const by = Object.fromEntries(shown.map(([code, name]) => [code, name]));
  assert.equal(by['SER-TN-185'], 'Music City Composite Squadron');
  assert.equal(by['NHQ-NHQ-000'], 'National Headquarters Unit');
  assert.equal(by['GLR-IL-049'], 'Palwaukee Composite Squadron');
  assert.equal(by['MAR-SC-000'], 'South Carolina Wing HQ Squadron');
  assert.equal(by['GLR-IL-090'], 'Col. Charles Compton Composite Squadron');
  assert.equal(by['GLR-IL-282'], 'Lake in the Hills Composite Squadron');
  assert.equal(by['GLR-IL-000'], 'Illinois Wing HQ Squadron');
  assert.equal(by['MAR-NC-000'], 'NC Wing HQ Squadron');
  assert.equal(by['GLR-MI-702'], 'Oakland-Macomb-St. Clair Group');
  assert.equal(by['SWR-AR-040'], '40th Composite Squadron (Hot Springs)');
  assert.equal(by['SWR-TX-447'], 'West Houston S.A.B.R.E. Senior Squadron');
  assert.match(by['NHQ-NHQ-004'], /^Aero Education Association Squadron$/);
});

test('purchase list item and vendor names are properly cased (purchase-catalog.js)', () => {
  const C = require('../purchase-catalog.js');
  check('purchase-catalog', [
    ...Object.entries(C.items).map(([id, it]) => [`items.${id}`, it.name]),
    ...Object.entries(C.vendors).map(([id, v]) => [`vendors.${id}`, v.name]),
    ['cordInfo(unknown)', C.cordInfo('some-cord').name]
  ]);
});

test('McChord ribbon option labels are properly cased (mcchord-ribbon-variants.js)', () => {
  const V = runInContext('mcchord-ribbon-variants.js').MCCHORD_RIBBON_VARIANTS;
  const entries = [];
  for(const [id, list] of Object.entries(V)) for(const v of list){
    entries.push([`${id}.${v.value}.label`, v.label]);
    for(const d of v.duplicates || []) if(d.awardLabel) entries.push([`${id}.${v.value}.awardLabel`, d.awardLabel]);
  }
  check('mcchord-ribbon-variants', entries);
});

test('CAP ribbon display names are properly cased (js/catalog.js RIBBON_DISPLAY_NAMES)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'catalog.js'), 'utf8');
  const m = /const RIBBON_DISPLAY_NAMES = (\{[\s\S]*?\n\});/.exec(src);
  assert.ok(m, 'RIBBON_DISPLAY_NAMES found');
  const names = vm.runInNewContext(`(${m[1]})`);
  check('RIBBON_DISPLAY_NAMES', Object.entries(names));
});

test('the casing script would change nothing (it has been run, and it is idempotent)', () => {
  assert.deepEqual(CASE.run({ write: false }).map(c => `${c.file} ${c.id}.${c.field}: ${c.before} -> ${c.after}`), []);
});

test('the title-case rules', () => {
  const t = CASE.titleCase;
  assert.equal(t('air force nco professional military education graduate'), 'Air Force NCO Professional Military Education Graduate');
  assert.equal(t('prisoner of war'), 'Prisoner of War');
  assert.equal(t('air and space campaign'), 'Air and Space Campaign');
  assert.equal(t('non-commissioned officer of the year'), 'Non-Commissioned Officer of the Year');
  assert.equal(t('kuwait liberation (saudi arabia)'), 'Kuwait Liberation (Saudi Arabia)');
  assert.equal(t('navy/marine corps parachutist insignia'), 'Navy/Marine Corps Parachutist Insignia');
  assert.equal(t('af combat action'), 'AF Combat Action');
  assert.equal(t('covid-19 service'), 'COVID-19 Service');
  assert.equal(t('dod identification'), 'DoD Identification');
  assert.equal(t('senior suas pilot badge'), 'Senior sUAS Pilot Badge');
  assert.equal(t("commandant's letter of commendation"), "Commandant's Letter of Commendation");
  assert.equal(t('what it stands for'), 'What It Stands For');
  for(const s of ['Medal of Honor', 'Special Warfare Insignia (SEAL)', 'Office of the Secretary of Defense Identification Badge']) assert.equal(t(s), s, 'already cased: unchanged');
  assert.deepEqual(defects('air force nco ribbon'), ['starts lowercase', '"nco" should be NCO']);
  assert.deepEqual(defects('Air Force  Cross'), ['doubled or edge space']);
  assert.deepEqual(defects('Air Force Distinguishd Service'), ['typo "Distinguishd"']);
});

// A saved setup may still hold a military ribbon id built from a misspelt name ("air_force_distinguishd_service").
// canonicalizeAwards folds each award's legacyCanonicalIds into sourceIds, which js/catalog.js indexes (LIVE13 E103).
test('legacy canonical ids from corrected award names still resolve to their award', () => {
  const vm = require('node:vm');
  const root = {}; const ctx = { root, window: root, self: root, globalThis: root, console };
  vm.createContext(ctx);
  for (const f of ['military/military-core.js', 'military/military-device-layout.js', 'military/military-data.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  const data = root.CAPUBMilitaryData; const mil = root.CAPUBMilitary;
  const legacy = data.awards.filter(a => Array.isArray(a.legacyCanonicalIds)).flatMap(a => a.legacyCanonicalIds);
  assert.ok(legacy.length >= 13, `expected the 13 legacy ids, found ${legacy.length}`);
  const canon = mil.canonicalizeAwards(data.awards);
  const unresolved = legacy.filter(id => !canon.some(a => (a.sourceIds || []).includes(id)));
  assert.equal(unresolved.length, 0, `unresolved legacy ids: ${unresolved.join(", ")}`);
});
