#!/usr/bin/env node
// Artwork completeness checklist for the CAP Uniform Builder.
// Read-only: scans artwork-samples/assets (+ a few generator sources) and writes COVERAGE.md / coverage.json.
// Run: node artwork-samples/coverage/coverage.js
// Source of truth for "what must exist" is CAPR 39-1 (3 Mar 2020) with ICL 21-01, 25-02, 25-06 (OCP) and 26-04.
// A requirement is BUILT when every regex in `all` matches at least one asset path (relative to assets/, no extension).
// This checks that a file exists, not that it is correct; correctness stays with validate-assets.js and review.

const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/^(v2|out|out-v\d|out-flat-v1|v2sbs|refs)$/.test(e.name)) walk(p, out); }
    else if (e.name.endsWith('.svg')) out.push(path.relative(ASSETS, p).replace(/\.svg$/, ''));
  }
  return out;
}
const FILES = walk(ASSETS);
const SRC = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const GEN = { hats: SRC('base-art/hats.js'), flightCap: SRC('base-art/make-flight-cap.js') };

const has = (re) => FILES.filter((f) => re.test(f));
const G = (n) => new RegExp('^garments/garment-' + n + '$');

// status: built | missing | decision (needs Ethan) | skip (decided not to build)
const REQ = [];
function req(section, label, ref, all, opt = {}) {
  const found = all.map((re) => has(re));
  const ok = found.every((a) => a.length > 0);
  REQ.push({ section, label, ref, status: opt.status || (ok ? 'built' : 'missing'), files: found.flat().length, note: opt.note || '' });
}
const fixed = (section, label, ref, status, note) => REQ.push({ section, label, ref, status, files: 0, note });

// ---------- 1. Base garments (current uniforms) ----------
const S1 = 'Base garments';
req(S1, 'Mess dress, male', '4.1.1', [G('mess-dress-male')]);
req(S1, 'Mess dress, female', '4.1.2', [G('mess-dress-female')]);
req(S1, 'Mess dress skirt, female: A-line (primary) and straight with split (optional)', '4.1.2.3', [G('mess-dress-skirt-female-a-line'), G('mess-dress-skirt-female-straight-split')], { note: 'Lengths and widths estimated (no reg figure shows the lower skirt).' });
req(S1, 'Semi-formal (cadet), male, new-style coat', '4.1.3.2', [G('semiformal-class-a-coat-male')]);
req(S1, 'Semi-formal (cadet), female', '4.1.4', [G('semiformal-class-a-coat-female')]);
req(S1, 'Service dress Class A, male, new style', '4.1.5', [G('blues-class-a-coat')]);
req(S1, 'Service dress Class A, female, new style', '4.1.9', [G('blues-class-a-coat-female')]);
req(S1, 'Class B, male, short sleeve', '4.1.11', [G('blues-class-b-shirt-male')]);
req(S1, 'Class B, male, long sleeve', '4.1.11', [G('blues-class-b-shirt-male-long')]);
req(S1, 'Class B, female, short sleeve', '4.1.12', [G('blues-class-b-blouse-female')]);
req(S1, 'Class B, female, long sleeve', '4.1.12', [G('blues-class-b-blouse-female-long')]);
req(S1, 'Corporate service dress blazer, male', '4.2.3', [G('corporate-service-dress-blazer-male')]);
req(S1, 'Corporate service dress blazer, female', '4.2.4', [G('corporate-service-dress-blazer-female')]);
req(S1, 'Aviator shirt, male, short', '4.2.5', [G('aviator-shirt-male')]);
req(S1, 'Aviator shirt, male, long', '4.2.5', [G('aviator-shirt-male-long')]);
req(S1, 'Aviator shirt, female, short', '4.2.6', [G('aviator-shirt-female')]);
req(S1, 'Aviator shirt, female, long', '4.2.6', [G('aviator-shirt-female-long')]);
req(S1, 'Overblouse, female (short)', '4.2.6.1', [G('overblouse-female')]);
req(S1, 'Overblouse, female, long sleeve', '4.2.6.1', [G('overblouse-female-long')]);
fixed(S1, 'White dress shirt / white shell (corporate semi-formal, blazer)', '4.2.1.2, 4.2.2.2, 4.2.3.2, 4.2.4.2', 'skip', 'Plain white, nothing customizable sits on it. Revisit only if the white shell needs a different silhouette (no collar, no tie tab).');
req(S1, 'ABU coat (authorized until 31 Oct 2028, ICL 25-06)', '5.1.1', [G('abu-coat')], { note: 'One coat for both genders; ABU_female raster exists in images/base.' });
req(S1, 'OCP coat (ICL 25-06, effective 1 Nov 2025)', '7.1', [G('ocp-coat-abu-cut')], { note: 'One coat for both genders.' });
req(S1, 'Corporate field uniform coat (dark blue, BDU style)', '5.2.1', [G('cfu-coat')]);
req(S1, 'Flight duty uniform (FDU)', '8.2', [G('fdu-flight-suit')]);
req(S1, 'Corporate flight duty uniform (CFDU)', '8.3', [G('cfdu-flight-suit')]);
fixed(S1, 'Corporate working uniform / polo', '5.3', 'skip', 'Decided not worth building.');

// ---------- 2. Layers on the base (nametags, boards, epaulets, ties) ----------
const S2 = 'Layers on garments';
req(S2, 'Nametag, Class A coat male: cadet + officer/NCO', '4.1.5.2', [G('blues-class-a-coat-nametag-cadet'), G('blues-class-a-coat-nametag-officer-nco')]);
req(S2, 'Nametag, Class A coat female: cadet + officer/NCO', '4.1.9', [G('blues-class-a-coat-female-nametag-cadet'), G('blues-class-a-coat-female-nametag-officer-nco')]);
req(S2, 'Nametag, Class B male: adult + cadet, short and long', '4.1.11', [G('blues-class-b-shirt-male-nametag-adult'), G('blues-class-b-shirt-male-nametag-cadet'), G('blues-class-b-shirt-male-long-nametag-adult'), G('blues-class-b-shirt-male-long-nametag-cadet')]);
req(S2, 'Nametag, Class B female: adult + cadet, short and long', '4.1.12', [G('blues-class-b-blouse-female-nametag-adult'), G('blues-class-b-blouse-female-nametag-cadet'), G('blues-class-b-blouse-female-long-nametag-adult'), G('blues-class-b-blouse-female-long-nametag-cadet')]);
req(S2, 'Nameplate, blazer: adult + cadet', '4.2.3.1.1.2', [/^nameplates\/nameplate-blazer-adult$/, /^nameplates\/nameplate-blazer-cadet$/]);
req(S2, 'Nameplate, 3-line (adult + cadet)', '4.1.5.2', [/^nameplates\/nameplate-3line-adult$/, /^nameplates\/nameplate-3line-cadet$/]);
req(S2, 'Nametag, aviator shirt (adult gray, same plate as the 3-line nameplate)', '4.2.5.1.2.1, 4.2.6.2.6.1.1', [/^nameplates\/nameplate-3line-adult$/], { note: 'Aviator shirts carry a nameplate-slot 3.375 x 0.75 in on the wearer\'s right pocket (Corp Blues chat).' });
fixed(S2, 'Nametag, corporate field uniform / ABU / OCP (name tape)', '5.1.1.1, 5.2.1.1, 7.1.1.1.2', 'skip', 'Blank name-tape rectangles are already in the coat assets; text is added by the builder.');
req(S2, 'Nametag, FDU / CFDU (black leather or blue cloth)', '8.2.4.1, 8.3.4.1', [/^garments\/garment-(fdu|cfdu)-flight-suit$/], { note: 'Landmark only, inside suit assets.' });
req(S2, 'Blank cloth name tape + CAP tape (ultramarine and dark blue), blue field / fleeces', 'A6-3, 10.9.8-9', [/^nameplates\/nametape-cloth-blank-ultramarine$/, /^nameplates\/nametape-cloth-blank-dark-blue$/, /^nameplates\/captape-cloth-blank-ultramarine$/, /^nameplates\/captape-cloth-blank-dark-blue$/], { note: 'Shape, border, stitch and text_zone only; no lettering.' });
req(S2, 'Blank flight suit name tags: black leather, dark blue embroidered, jacket', 'A6-3, 8.2.4.1, 8.3.4.1', [/^nameplates\/nametag-flight-leather-blank$/, /^nameplates\/nametag-flight-embroidered-blank$/, /^nameplates\/nametag-flight-jacket-leather-blank$/], { note: 'name / grade / CAP / badge zones as landmarks.' });
req(S2, 'Collar / lapel insignia: CAP (metal, cloth), U.S., circled U.S.', 'A6-5, 4.1.5.2.2.1', [/^insignia\/collar-insignia-cap-metal$/, /^insignia\/collar-insignia-cap-cloth$/, /^insignia\/collar-insignia-us-metal$/, /^insignia\/collar-insignia-us-circle-metal$/]);
req(S2, 'Class A cadet officer shoulder boards + lapel letters, male', '4.1.5.2', [G('blues-class-a-cadet-officer-insignia')]);
req(S2, 'Class A cadet officer shoulder boards + lapel letters, female', '4.1.9', [G('blues-class-a-cadet-officer-insignia-female')]);
req(S2, 'Class A senior officer layer, male + female', '4.1.5.3', [G('blues-class-a-coat-senior-officer'), G('blues-class-a-coat-female-senior-officer')]);
req(S2, 'Class A general officer layer, male + female', '4.1.5.3', [G('blues-class-a-coat-general-officer'), G('blues-class-a-coat-female-general-officer')]);
req(S2, 'Class A senior NCO lapel layer, male + female', '4.1.5.3', [G('blues-class-a-coat-senior-nco-lapel'), G('blues-class-a-coat-female-senior-nco-lapel')]);
req(S2, 'Class B epaulet sleeves (officer gray, cadet officer blue), male+female, short+long', '4.1.11, 4.1.12', [
  G('blues-class-b-shirt-male-epaulet-sleeve-officer'), G('blues-class-b-shirt-male-epaulet-sleeve-cadet-officer'),
  G('blues-class-b-shirt-male-long-epaulet-sleeve-officer'), G('blues-class-b-shirt-male-long-epaulet-sleeve-cadet-officer'),
  G('blues-class-b-blouse-female-epaulet-sleeve-officer'), G('blues-class-b-blouse-female-epaulet-sleeve-cadet-officer'),
  G('blues-class-b-blouse-female-long-epaulet-sleeve-officer'), G('blues-class-b-blouse-female-long-epaulet-sleeve-cadet-officer')]);
req(S2, 'Mess dress officer shoulder boards, male + female', '4.1.1.1, 4.1.2.1', [G('mess-dress-male-officer-shoulder-boards'), G('mess-dress-female-officer-shoulder-boards')]);
req(S2, 'Mess dress officer sleeve braid, male + female', '4.1.1.1, 4.1.2.1', [G('mess-dress-male-officer-sleeve-braid'), G('mess-dress-female-officer-sleeve-braid')]);
req(S2, 'Mess dress general officer sleeve braid, male + female', '4.1.1.1, 4.1.2.1', [G('mess-dress-male-general-officer-sleeve-braid'), G('mess-dress-female-general-officer-sleeve-braid')]);
req(S2, 'Regimental tie, black bow tie, tie clasps', '4.2.1.3, 4.2.3.4', [/^accessories\/tie-cap-regimental$/, /^accessories\/tie-bow-black$/, /^accessories\/tie-clasp-(gold|silver)$/]);
fixed(S2, 'Tie choice, corporate blazer: CAP regimental or AF blue tie', '4.2.3.4', 'built', 'Two options per reg: regimental is its own asset, blue is the base. Service dress has one tie option (blue), so no swap there.');
fixed(S2, 'Women\'s tie tab (blue satin inverted-V)', '4.1.4.4, 4.1.9.7, 4.2.4.3', 'skip', 'Only one option in the reg, mandatory (none with the white shell); drawn inside the female garments.');
req(S2, 'CAP Crest (standalone) and CAP seal', '4.2.3.1.1', [/^insignia\/insignia-cap-crest$/, /^insignia\/insignia-cap-seal$/]);
req(S2, 'CAP Crest alternates (CSAG, command council, national board, NEC): badges worn in place of the crest on the blazer', '4.2.3.1.1.1', [/^enamel\/enamel-senior-advisory-group\//, /^enamel\/enamel-command-council\//, /^enamel\/enamel-cap-national-command-board\//, /^enamel\/enamel-national-executive-committee\//], { note: 'Badge art exists (enamel set); the blazer only needs to expose the crest position as the slot they replace the crest in.' });
req(S2, 'CAP command patch', '8.2.4.2, 8.3.4.2', [/^patches\/patch-cap-command-patch\/patch-cap-command-patch$/]);

// ---------- 3. Grade insignia ----------
const S3 = 'Grade insignia';
const CADET_OFFICER = ['second-lieutenant', 'first-lieutenant', 'captain', 'major', 'lieutenant-colonel', 'colonel'];
const CADET_NCO = ['airman', 'airman-first-class', 'senior-airman', 'staff-sergeant', 'technical-sergeant', 'master-sergeant', 'senior-master-sergeant', 'chief-master-sergeant'];
for (const g of CADET_OFFICER) req(S3, 'Cadet officer ' + g + ': metal + cloth-bordered + OCP square + thread', 'Att. 5', [new RegExp('^insignia/rank-cadet-officer-' + g + '-metal-regular$'), new RegExp('^insignia/rank-cadet-officer-' + g + '-cloth-bordered-regular$'), new RegExp('^insignia/rank-cadet-officer-' + g + '-ocp-square$'), new RegExp('^insignia/rank-cadet-officer-' + g + '-thread-regular-row$')]);
for (const g of CADET_NCO) req(S3, 'Cadet NCO ' + g + ': metal + cloth-bordered + OCP square', 'Att. 5', [new RegExp('^insignia/rank-cadet-nco-' + g + '-metal$'), new RegExp('^insignia/rank-cadet-nco-' + g + '-cloth-bordered$'), new RegExp('^insignia/rank-cadet-nco-' + g + '-ocp-square$')]);
for (const g of ['master-sergeant', 'senior-master-sergeant', 'chief-master-sergeant']) req(S3, 'Cadet NCO ' + g + ' with first sergeant diamond', 'Att. 5', [new RegExp('^insignia/rank-cadet-nco-' + g + '-first-sergeant-(metal|cloth-bordered|ocp-square)$')]);
const SENIOR_OFFICER = ['flight-officer', 'technical-flight-officer', 'senior-flight-officer', 'second-lieutenant', 'first-lieutenant', 'captain', 'major', 'lieutenant-colonel', 'colonel', 'brigadier-general', 'major-general'];
for (const g of SENIOR_OFFICER) req(S3, 'Senior officer ' + g, 'Att. 5', [new RegExp('^insignia/rank-senior-' + g + '(-.*)?$')]);
for (const g of ['staff-sergeant', 'technical-sergeant', 'master-sergeant', 'senior-master-sergeant', 'chief-master-sergeant', 'command-chief']) req(S3, 'Senior NCO ' + g + ' chevron (3.5 in and 4 in)', 'Att. 5, ICL 25-02 (h)', [new RegExp('^insignia/rank-senior-' + g + '-chevron-3p5in$'), new RegExp('^insignia/rank-senior-' + g + '-chevron-4in$')]);
for (const g of ['second-lieutenant', 'first-lieutenant', 'captain', 'major', 'lieutenant-colonel', 'colonel']) req(S3, 'Cadet officer blue epaulet sleeve ' + g, 'Att. 5', [new RegExp('^insignia/rank-epaulet-sleeve-blue-cadet-' + g + '$')]);
for (const g of ['flight-officer', 'technical-flight-officer', 'senior-flight-officer', 'second-lieutenant', 'first-lieutenant', 'captain', 'major', 'lieutenant-colonel', 'colonel', 'brigadier-general', 'major-general']) req(S3, 'Senior gray epaulet sleeve ' + g, 'Att. 5', [new RegExp('^insignia/rank-epaulet-sleeve-gray-' + g + '$')]);
fixed(S3, 'Colonel eagle (senior officer insignia and gray epaulet sleeve) is built from low-res source art', 'Att. 5', 'built', 'Ethan: done. Misc Artwork chat: source is ~100 px wide. Ethan: being worked on. Files exist, so check quality before import.');
req(S3, '"CAP" patch for adults without grade', 'Att. 5', [/^insignia\/rank-cap-patch-no-grade$/]);

// ---------- 4. Headgear ----------
const S4 = 'Headgear';
req(S4, 'Flight cap: cadet, officer, general (CAPR 39-1 Att. 5 measured)', '6.2.2', [/^accessories\/hat-flight-cap-cadet$/, /^accessories\/hat-flight-cap-officer$/, /^accessories\/hat-flight-cap-general$/]);
req(S4, 'Service cap, men\'s wheel cap and women\'s bucket cap (general, field grade, officer/NCO, cadet officer)', '6.2.1', [/^accessories\/hat-service-cap-men-general$/, /^accessories\/hat-service-cap-men-field-grade$/, /^accessories\/hat-service-cap-men-officer-nco$/, /^accessories\/hat-service-cap-men-cadet-officer$/, /^accessories\/hat-service-cap-women-general$/, /^accessories\/hat-service-cap-women-field-grade$/, /^accessories\/hat-service-cap-women-officer-nco$/, /^accessories\/hat-service-cap-women-cadet-officer$/]);
req(S4, 'NCO cap device on the flight cap (ICL 25-02 (g))', '6.2.2.2', [/^accessories\/cap-device-nco-flight$/]);
req(S4, 'Cap devices: officer service cap, cadet officer service cap, officer/general flight cap', '6.2.1.1.1, 6.2.2.2', [/^accessories\/cap-device-officer-service$/, /^accessories\/cap-device-cadet-officer-service$/, /^accessories\/cap-device-officer-flight$/], { note: 'Low fidelity: only Fig A5-8 (about 190 px) as source; sizes estimated.' });
const hatsGen = (re) => re.test(GEN.hats);
REQ.push({ section: S4, label: 'Patrol cap + baseball cap, front and back (ABU/OCP/CFU) as base-art composites only', ref: '6.2.7-6.2.9, 7.1.1.8', status: hatsGen(/patrolFront/) ? 'built' : 'missing', files: 0, note: 'By design these are part of each uniform (drawn in the coat art by base-art/hats.js), not separate assets. Covers the blue ballcap/navy tactical hat on ABU and CFU.' });
fixed(S4, 'Beret (navy blue, national blue beret)', '6.2.3, 9.2.3', 'skip', 'Ethan: not needed.');
fixed(S4, 'Blue winter cap, green watch cap, black watch cap', '6.2.4-6.2.6', 'skip', 'No customization (no grade insignia worn on them).');
REQ.push({ section: S4, label: 'Blue boonie hat (corporate field uniform)', ref: '6.2.10', status: /boonie/i.test(SRC('base-art/make-cfu-top.js')) ? 'built' : 'missing', files: 0, note: 'Built inside the CFU coat image by the Utility chat (boonie_hat_front/back + insignia zone), not as a separate asset.' });
fixed(S4, 'ABU cap', '5.1.1.6', 'built', 'Covered by the ABU patrol cap in the ABU composite.');

// ---------- 5. Outer garments ----------
const S5 = 'Outer garments';
req(S5, 'Green flight jacket + blue flight jacket', '6.1.7, 8.2.7', [G('flight-jacket-green'), G('flight-jacket-blue')]);
req(S5, 'CAP command scarf', '8.2.6', [G('cap-command-scarf')]);
for (const [l, r] of [['Pullover sweater (blue)', '6.1.1'], ['Cardigan sweater (blue)', '6.1.2'], ['Lightweight blue jacket (+ general officer version, ICL 25-02)', '6.1.3'], ['Black leather jacket', '6.1.5'], ['Light blue windbreaker', '6.1.6'], ['Topcoat / all-weather coat', '6.1.8'], ['ABU Gore-Tex parka', '6.1.9'], ['Green fleece', '6.1.10'], ['Blue field jacket', '6.1.13'], ['Black fleece', '6.1.14'], ['Blue Gore-Tex parka (ICL 25-02 (d))', 'ICL 25-02']])
  fixed(S5, l, r, 'skip', 'Ethan: outer garments are out of scope; the builder covers the common uniforms, not what is worn over them.');

// ---------- 6. Badges, devices, patches (counts only; not cross-checked against Att. 4) ----------
const S6 = 'Badges, ribbons, devices, patches (counts, not checked against reg lists)';
const cnt = (label, re, note) => REQ.push({ section: S6, label, ref: '', status: has(re).length ? 'built' : 'missing', files: has(re).length, note: note || '' });
cnt('Ribbons (CAP + military)', /^ribbons\//, 'CAPR 39-3 list not cross-checked yet.');
cnt('Military ribbons', /^ribbons\/military\//, 'Builder raster catalog: images/military-ribbons (354) + variants (321, composed from base ribbon + devices).');
cnt('CAP medals and miniatures', /^medals\//, 'Builder raster catalog: images/medals (37) + images/mini_medals (434).');
cnt('Military medals (full size and miniature)', /^military\/medals\//, 'Builder raster catalog: images/military-full-size-medals (246) + military-mini-medals (239).');
cnt('Ribbon devices', /^devices\//);
cnt('Cloth aviation/occupational badges', /^cloth\//);
cnt('Field badges', /^field\//);
cnt('Mini badges', /^mini\//);
cnt('Enamel badges', /^enamel\//);
fixed(S6, 'Optional unit / school / event patches (e.g. Hawk Mountain)', 'Att. 8', 'skip', 'Ethan: out of scope. The CAP command patch and ES patch stay (uniform-defined, FDU/CFDU).');
cnt('Military badges / medals', /^military\//);

// ---------- Not covered ----------
fixed('Misc', 'Honor Guard distinctives (ascot, pistol belt, white gloves, parade rifle, cap device)', '9.6.7', 'skip', 'Ethan: Honor Guard is covered by the academy patch; the uniform itself is service dress / blue service.');
fixed('Misc', 'Soaring and ballooning uniforms', '9.1', 'skip', 'CAPR 39-1 only points to CAPR 70-1 para 9.8.2 and defines nothing itself.');
const CORDS = [['Gold: National CAC', '9.3.1.1', 'national'], ['Blue: Region CAC', '9.3.1.2', 'region'], ['Red: Wing CAC', '9.3.1.3', 'wing'], ['Kelly green: Group CAC', '9.3.1.4', 'group'], ['White: drill / color guard', '9.3.2', 'color-guard'], ['Silver: NHGA / RHGA / unit honor guard', '9.3.3', 'honor-guard'], ['USAF aide de camp cord (senior and cadet)', '9.3.4', 'aide-de-camp']];
for (const [l, r, id] of CORDS) req('Misc', 'Shoulder cord, ' + l, r, [new RegExp('^cords\\/cord-' + id + '$')], { note: 'Cadets only except aide de camp. Left shoulder seam, under the epaulet. Class A/B only.' });
fixed('Not yet checked', 'Badge and ribbon completeness: every badge in CAPR 39-1 Att. 4 and every ribbon/device in CAPR 39-3 exists as an asset', 'Att. 4, 39-3', 'skip', 'Ethan: badges are covered by the badge chats. File counts only; not cross-checked against the reg lists.');

const sym0 = { built: 'built', wip: 'in progress', missing: 'MISSING', decision: 'DECIDE', skip: 'skipped' };
// ---------- By-uniform view (hats, layers and extras travel with their uniform) ----------
const UNIFORMS = [
  ['Mess dress', /mess dress|miniature medal/i],
  ['Semi-formal (cadet, USAF style)', /semi-formal \(cadet\)/i],
  ['Service dress Class A (USAF style)', /class a|3-line|flight cap|service cap|NCO cap device|tie clasp/i],
  ['Blue service Class B (USAF style)', /class b|flight cap|service cap|NCO cap device/i],
  ['Corporate semi-formal / blazer', /blazer|nameplate, blazer|regimental|bow tie|crest|tie choice|white dress shirt|tie tab/i],
  ['Aviator shirt', /aviator|overblouse|tie tab/i],
  ['ABU (until 31 Oct 2028)', /abu|patrol cap/i],
  ['OCP', /ocp coat|patrol cap/i],
  ['Corporate field uniform', /corporate field|boonie|patrol cap|beret/i],
  ['Flight duty (FDU / CFDU)', /fdu|cfdu|flight jacket|scarf|command patch|NCO cap/i],
];
const byU = UNIFORMS.map(([name, re]) => [name, REQ.filter((r) => r.section !== S3 && r.section !== S6 && re.test(r.label))]);

// ---------- Output ----------
let uni = '## By uniform (each uniform with the hats, layers and extras that go with it)\n\nGrade insignia (section "Grade insignia") and badges/ribbons/patches are shared by every uniform and are listed once below.\n\n';
for (const [name, rows] of byU) {
  const c = {}; rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
  uni += `### ${name}\n\n${Object.entries(c).map(([k, v]) => v + ' ' + sym0[k]).join(', ') || 'nothing matched'}\n\n`;
  for (const r of rows) if (r.status !== 'built' && r.status !== 'skip') uni += `- **${sym0[r.status]}**: ${r.label}${r.note ? ' (' + r.note + ')' : ''}\n`;
  uni += '\n';
}
const by = {};
for (const r of REQ) (by[r.section] = by[r.section] || []).push(r);
const sym = { built: 'built', wip: 'in progress', missing: 'MISSING', decision: 'DECIDE', skip: 'skipped' };
let md = '# Artwork coverage checklist\n\n';
md += 'Generated by `artwork-samples/coverage/coverage.js` (read-only). Re-run it after any chat adds assets.\n';
md += 'Basis: CAPR 39-1 (3 Mar 2020) with ICL 21-01, 25-02, 25-06 (OCP, 1 Nov 2025), 26-04. Current uniforms only. Old-style Class A coats (cadet), BDU and woodland items are gone (Att. 9) and are not listed.\n';
md += '`built` means the file exists. It does not mean the file is correct or to scale.\n\n';
const tot = {};
for (const r of REQ) tot[r.status] = (tot[r.status] || 0) + 1;
md += '**Totals:** ' + Object.entries(tot).map(([k, v]) => `${v} ${sym[k]}`).join(', ') + '\n\n';
md += uni;
for (const [sec, rows] of Object.entries(by)) {
  md += `## ${sec}\n\n| Status | Item | Reg | Files | Note |\n|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${sym[r.status]} | ${r.label} | ${r.ref} | ${r.files || ''} | ${r.note} |\n`;
  md += '\n';
}
fs.writeFileSync(path.join(__dirname, 'COVERAGE.md'), md);
fs.writeFileSync(path.join(__dirname, 'coverage.json'), JSON.stringify(REQ, null, 1));
console.log('wrote COVERAGE.md;', Object.entries(tot).map(([k, v]) => `${v} ${k}`).join(', '));
for (const r of REQ.filter((x) => x.status === 'missing')) console.log('MISSING:', r.section, '|', r.label);
