'use strict';
// The wing and region supplements (data/supplements.js, js/supplements.js): which supplements a unit's charter number brings in, that every item says its rule and
// its paragraph in the words a member reads, that the cords it names are cords of the cord list (data/cords.js), the cords a member is offered, and the citation form.
// The owner: "when members select units within a wing/region that is a supplement, the supplement should load, allowing for specific items. for example, if someone
// selects a unit in NER, it should allow them to wear the RCLS and NCOLS cord".

const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../data/supplements.js');
const S = require('../js/supplements.js');
const C = require('../js/citations.js');
const CORDS = require('../data/cords.js');

const WINGS = ['MD', 'ME', 'NH', 'MO', 'WV', 'GA', 'DE', 'FL', 'NE', 'MN', 'KS', 'VA', 'NC', 'HI'];
const REGIONS = ['NER', 'MAR'];
const cadet = (unit, more) => Object.assign({ membership: 'cadet', unitPatchCharter: unit, uniform: 'blues_a' }, more || {});
const keys = unit => S.forUnit(unit).map(s => s.key);
const everyItem = fn => { for(const e of D.SUPPLEMENTS) for(const item of e.items) fn(e, item); };

test('one entry per supplement: the two regions and the fourteen wings, each with its name in words, its date and its items', () => {
  assert.equal(D.SUPPLEMENTS.length, 16);
  assert.deepEqual(D.SUPPLEMENTS.filter(e => e.kind === 'region').map(e => e.code).sort(), [...REGIONS].sort());
  assert.deepEqual(D.SUPPLEMENTS.filter(e => e.kind === 'wing').map(e => e.code).sort(), [...WINGS].sort());
  for(const e of D.SUPPLEMENTS){
    assert.match(e.name, /^[A-Z][A-Za-z -]+ (?:Region|Wing) Supplement 1$/, e.key);
    assert.match(e.date, /^\d{1,2} [A-Z][a-z]+ 20\d\d$/, e.key);
    assert.match(e.iso, /^20\d\d-\d\d-\d\d$/);
    assert.ok(e.group && e.items.length, e.key);
  }
  // The names are in words: the region is not "NER" and the wing is not "NE".
  assert.equal(D.REGIONS.NER.name, 'Northeast Region Supplement 1');
  assert.equal(D.REGIONS.MAR.name, 'Mid-Atlantic Region Supplement 1');
  assert.equal(D.WINGS.NE.name, 'Nebraska Wing Supplement 1');
  assert.equal(D.WINGS.NC.group, 'North Carolina Wing');
});

test('a unit code is REGION-WING-NUMBER: the wing part selects the wing\'s supplement and the region part the region\'s', () => {
  assert.deepEqual(S.parseUnit(' ner-ny-135 '), { code: 'NER-NY-135', region: 'NER', wing: 'NY', number: '135' });
  assert.equal(S.parseUnit('TN-185'), null);
  assert.equal(S.parseUnit(''), null);
  assert.equal(S.parseUnit(null), null);
  // A Northeast unit of a wing with no supplement: the region's alone. A Maine unit: the region's and the wing's.
  assert.deepEqual(keys('NER-NY-135'), ['NER']);
  assert.deepEqual(keys('NER-ME-010'), ['NER', 'ME']);
  assert.deepEqual(keys('NER-NH-003'), ['NER', 'NH']);
  // A Maryland unit has Maryland Wing's supplement and the Mid-Atlantic Region's; so does a North Carolina, a Virginia and a West Virginia unit, a Delaware one too.
  for(const [unit, wing] of [['MAR-MD-014', 'MD'], ['MAR-NC-020', 'NC'], ['MAR-VA-002', 'VA'], ['MAR-WV-001', 'WV'], ['MAR-DE-005', 'DE']]) assert.deepEqual(keys(unit), ['MAR', wing], unit);
  // The District of Columbia and South Carolina are in the region and have no wing supplement.
  assert.deepEqual(keys('MAR-DC-026'), ['MAR']);
  assert.deepEqual(keys('MAR-SC-001'), ['MAR']);
  // The other regions' wings.
  assert.deepEqual(keys('SER-GA-118'), ['GA']);
  assert.deepEqual(keys('SER-FL-010'), ['FL']);
  assert.deepEqual(keys('PCR-HI-073'), ['HI']);
  assert.deepEqual(keys('NCR-MO-100'), ['MO']);
  assert.deepEqual(keys('NCR-MN-001'), ['MN']);
  assert.deepEqual(keys('NCR-KS-020'), ['KS']);
  // No supplement, no unit, a unit that is not a charter number.
  assert.deepEqual(keys('GLR-IL-049'), []);
  assert.deepEqual(keys('SWR-TX-030'), []);
  assert.deepEqual(keys(''), []);
  assert.deepEqual(keys(undefined), []);
  assert.deepEqual(keys('not a unit'), []);
});

test('NE as a wing is Nebraska and NER as a region is the Northeast: the two never meet', () => {
  assert.deepEqual(keys('NCR-NE-001'), ['NE']);
  assert.equal(S.forUnit('NCR-NE-001')[0].name, 'Nebraska Wing Supplement 1');
  assert.deepEqual(keys('NER-NER-001'), ['NER'], 'the region\'s own headquarters has a region and no wing');
  assert.equal(S.forUnit('NER-NER-001')[0].kind, 'region');
  assert.deepEqual(keys('MAR-MAR-001'), ['MAR']);
  // A wing code in the region place, or a region code in the wing place, selects nothing.
  assert.deepEqual(keys('NE-NER-001'), []);
  assert.deepEqual(keys('NCR-NER-001'), []);
  assert.deepEqual(keys('NHQ-NHQ-000'), []);
});

test('Supplements.forUnit gives each supplement as { key, kind, name, date, group }, the region\'s first', () => {
  assert.deepEqual(S.forUnit('MAR-MD-014'), [
    { key: 'MAR', kind: 'region', name: 'Mid-Atlantic Region Supplement 1', date: '20 March 2026', group: 'Mid-Atlantic Region' },
    { key: 'MD', kind: 'wing', name: 'Maryland Wing Supplement 1', date: '30 July 2026', group: 'Maryland Wing' }
  ]);
});

test('every item has its kind, its rule as one sentence and its paragraph; a cord has its id, its name and how it is earned', () => {
  const KINDS = new Set(['cord', 'wing-patch', 'headgear', 'accessory', 'note']);
  let count = 0;
  everyItem((e, item) => {
    count++;
    const where = `${e.key} ${item.paragraph}`;
    assert.ok(KINDS.has(item.kind), where);
    assert.match(item.rule, /^[A-Z"].+\.$/, `${where}: a sentence`);
    assert.ok(item.rule.length > 25 && item.rule.length < 520, `${where}: ${item.rule.length} characters`);
    assert.match(item.paragraph, /^\d+(?:\.(?:\d+|x))*(?:(?:,| and) \d+(?:\.\d+)*)*$/, `${where}: a paragraph`);
    assert.ok(['all', 'cadet', 'senior'].includes(item.audience), where);
    if(item.kind === 'cord'){
      assert.match(item.id, /^[a-z]{2,3}(?:-[a-z]+)+$/, where);
      assert.ok(item.label && !/^[a-z]/.test(item.label), where);
      assert.equal(item.audience, 'cadet', `${where}: every supplement cord is a cadet cord`);
      assert.ok(['activity', 'duty', 'none'].includes(item.earned.source), where);
      assert.equal(typeof item.limitedToActivity, 'boolean', where);
      if(item.earned.source === 'none') assert.ok(item.earned.why.length > 10, where);
    }
    if(item.kind === 'wing-patch'){
      assert.equal(typeof item.required, 'boolean', where);
      assert.ok(item.uniforms.length && item.uniforms.every(u => ['abu', 'corporate_field', 'flight_suit', 'corporate_flight_suit', 'ocp'].includes(u)), where);
    }
  });
  assert.ok(count > 90, `${count} items`);
});

test('every cord id is a cord of the cord list, and every supplement cord of the list is offered by exactly one supplement', () => {
  const listed = CORDS.supplement.map(c => c.id);
  const named = D.SUPPLEMENTS.flatMap(e => e.items.filter(i => i.kind === 'cord').map(i => i.id));
  for(const id of named) assert.ok(listed.includes(id), `${id} is not in the cord list`);
  assert.equal(new Set(named).size, named.length, 'no cord is named twice');
  assert.deepEqual([...named].sort(), [...listed].sort());
  // The id belongs to the supplement whose code starts it (ner-rcls in the Northeast, md-cadet-commander in Maryland).
  for(const e of D.SUPPLEMENTS) for(const i of e.items) if(i.kind === 'cord') assert.ok(i.id.startsWith(e.code.toLowerCase() + '-'), `${i.id} in ${e.key}`);
  assert.deepEqual(S.cordIds().sort(), listed.sort());
});

test('the words a member reads: no publication named, no abbreviation to decode, American spelling, no names or rulings', () => {
  const UNKNOWN = /\b(?:RCLS|NCOLS|NER|MAR|CAC|HHQ|NHQ|AFA|AFSA|SNCO|CCC|NCO|NCOs|GPA|SAR|ES|IMT|PTU|PFU|FDU|CFDU|CFU|BDU)\b/;
  const BAD = /ruling|Doran|Ethan|Discord|LIVE\d|\b[ED]\d{2,3}\b|\bB\d\b|critique|\bCAPR\b|\bCAPM\b|\bICL\b|\bDAFI\b/i;
  const BRITISH = /\b(?:centre|colour|colours|grey|programme|honour)\b/i;
  everyItem((e, item) => {
    const where = `${e.key} ${item.paragraph}`;
    for(const text of [item.rule, item.label || '']){
      assert.doesNotMatch(text, UNKNOWN, `${where}: ${text}`);
      assert.doesNotMatch(text, BAD, `${where}: ${text}`);
      assert.doesNotMatch(text, BRITISH, `${where}: ${text}`);
      assert.deepEqual(C.split(text).refs, [], `${where}: a reference in the sentence belongs behind its question mark only`);
    }
  });
  const text = s => [s.name, s.group, ...s.items.flatMap(i => [i.rule, i.label || ''])].join(' ');
  assert.match(text(D.REGIONS.NER), /Region Cadet Leadership School/);
  assert.match(text(D.REGIONS.NER), /Noncommissioned Officer Leadership School/);
  assert.match(text(D.WINGS.NC), /Air Force Sergeants Association/);
});

test('a cord\'s note is its rule as a sentence ending with its paragraph, the supplement\'s name in the bracket, and the place it may be worn where the supplement limits it', () => {
  const [rcls] = S.cords(cadet('NER-NY-135'));
  assert.equal(rcls.id, 'ner-rcls');
  assert.equal(rcls.note, 'Northeast Region cadets who graduated from or served as staff of a Northeast Region Cadet Leadership School may wear a blue and white interwoven shoulder cord. (CAPR 39-1 Northeast Region Supplement 1, 9.4.1)');
  const md = S.cords(cadet('MAR-MD-014')).find(c => c.id === 'md-cadet-commander');
  assert.match(md.note, /only at Maryland Wing activities inside Maryland or at Maryland Wing squadron locations/);
  assert.match(md.note, /takes it off when the duty assignment ends/);
  assert.match(md.note, /\(CAPR 39-1 Maryland Wing Supplement 1, 9\.4\.1\.x\)$/);
  for(const id of ['mn-encampment-executive-staff', 'mn-encampment-flight-sergeant']) assert.match(S.cords(cadet('NCR-MN-001')).find(c => c.id === id).note, /only at encampment and encampment preparation events/);
  assert.match(S.cords(cadet('PCR-HI-073')).length ? 'x' : 'no cords', /no cords/, 'Hawaii has no cord');
  for(const unit of ['NER-ME-010', 'MAR-MD-014', 'NCR-MN-001', 'SER-FL-010', 'SER-GA-118', 'NCR-NE-001', 'NCR-KS-020', 'MAR-VA-002', 'MAR-NC-020', 'MAR-WV-001', 'NCR-MO-100', 'MAR-DE-005', 'NER-NH-003']){
    for(const c of S.cords(cadet(unit))){
      assert.match(c.note, /\.\s\(CAPR 39-1 [A-Za-z -]+ Supplement 1, [\d.x]+(?:[, a-z\d.]+)?\)$/, c.id);
      assert.ok(c.label && c.group && c.supplement, c.id);
    }
  }
});

test('Supplements.cords(state): cadets only, none without a unit or for a unit with no supplement, the region\'s group before the wing\'s', () => {
  assert.deepEqual(S.cords(cadet('')), []);
  assert.deepEqual(S.cords(cadet('GLR-IL-049')), []);
  assert.deepEqual(S.cords({ membership: 'senior', unitPatchCharter: 'NER-ME-010' }), []);
  assert.deepEqual(S.cords({ membership: '', unitPatchCharter: 'NER-ME-010' }), []);
  assert.deepEqual(S.cords(null), []);
  assert.deepEqual(S.cords({}), []);
  const ne = S.cords(cadet('NER-NY-135'));
  assert.deepEqual(ne.map(c => [c.id, c.group, c.supplement, c.earned]), [['ner-rcls', 'Northeast Region', 'NER', false], ['ner-ncols', 'Northeast Region', 'NER', false]]);
  assert.equal(ne[0].label, 'Region Cadet Leadership School');
  assert.equal(ne[1].label, 'Noncommissioned Officer Leadership School');
  const me = S.cords(cadet('NER-ME-010'));
  assert.deepEqual([...new Set(me.map(c => c.group))], ['Northeast Region', 'Maine Wing']);
  assert.equal(me.length, 2 + 8);
  const md = S.cords(cadet('MAR-MD-014'));
  assert.deepEqual([...new Set(md.map(c => c.group))], ['Mid-Atlantic Region', 'Maryland Wing']);
  assert.deepEqual(md.map(c => c.id), ['mar-cadet-of-the-year', 'mar-competition-team', 'mar-event-marshal', 'mar-operations-assistant', 'md-cadet-commander']);
  // The counts of each unit's cords (a Virginia or West Virginia unit has the region's four besides the wing's).
  const count = (unit) => S.cords(cadet(unit)).length;
  assert.deepEqual([count('NCR-NE-001'), count('NCR-MN-001'), count('SER-FL-010'), count('NCR-KS-020'), count('MAR-VA-002'), count('MAR-WV-001'), count('SER-GA-118')], [3, 7, 7, 5, 8, 7, 5]);
});

test('the cords a report shows earned are marked and listed first, and only while the report\'s own list stands', () => {
  const state = cadet('NER-ME-010', { supplementCordsEarned: ['me-cadet-commander', 'ner-ncols'] });
  const list = S.cords(state);
  assert.deepEqual(list.slice(0, 2).map(c => [c.id, c.earned]), [['ner-ncols', true], ['me-cadet-commander', true]]);
  assert.ok(list.slice(2).every(c => c.earned === false));
  assert.equal(list.length, 10);
  // Where the page keeps a report's list (State.reportAuthorizedBadgeIds), Undo and "Clear import notes" put it back to null and the marks go with it.
  assert.ok(S.cords(Object.assign({ reportAuthorizedBadgeIds: [] }, state)).some(c => c.earned));
  assert.ok(S.cords(Object.assign({ reportAuthorizedBadgeIds: null }, state)).every(c => !c.earned));
  // A cord of another unit is not offered, so it is not marked.
  assert.ok(S.cords(cadet('NCR-MN-001', { supplementCordsEarned: ['ner-rcls'] })).every(c => !c.earned));
});

test('Supplements.items(state) gives the other items for this member: the wing patch, headgear, accessories and notes, never a cord', () => {
  const ne = S.items(cadet('NER-NY-135'));
  assert.deepEqual(ne, [], 'the Northeast supplement has cords only');
  const mar = S.items(cadet('MAR-DC-026', { uniform: 'abu' }));
  assert.ok(mar.length >= 8 && mar.every(i => i.kind !== 'cord'));
  const patch = mar.find(i => i.kind === 'wing-patch');
  assert.equal(patch.required, true);
  assert.deepEqual(patch.uniforms, ['abu', 'corporate_field']);
  assert.equal(patch.onThisUniform, true);
  assert.equal(S.items(cadet('MAR-DC-026', { uniform: 'blues_a' })).find(i => i.kind === 'wing-patch').onThisUniform, false);
  assert.match(patch.note, /^Wearing the wing patch is required on the utility uniforms, the ABU and the Corporate Field Uniform\. \(CAPR 39-1 Mid-Atlantic Region Supplement 1, 5\.1\.1\.1\.2\.2\)$/);
  // Items meant for cadets only are not shown to a senior member.
  const forCadet = S.items(cadet('NCR-MN-001')).map(i => i.paragraph + i.audience);
  const forSenior = S.items({ membership: 'senior', unitPatchCharter: 'NCR-MN-001' }).map(i => i.paragraph + i.audience);
  assert.ok(forCadet.some(x => x === '9.4.1cadet') && !forSenior.some(x => x === '9.4.1cadet'));
  assert.ok(forSenior.length > 0 && forSenior.length < forCadet.length);
  assert.deepEqual(S.items({ membership: 'senior', unitPatchCharter: '' }), []);
  // Seniors keep the caps, the notes and the wing patch of a supplement.
  assert.ok(S.items({ membership: 'senior', unitPatchCharter: 'PCR-HI-073', uniform: 'abu' }).some(i => i.kind === 'wing-patch' && i.onThisUniform));
});

test('the supplements say what the text says where the reading is easy to get wrong', () => {
  const item = (code, paragraph, id) => D.SUPPLEMENTS.find(e => e.code === code).items.find(i => i.paragraph === paragraph && (!id || i.id === id));
  // Mid-Atlantic: the last sentence of 9.4.1.3 limits both cords to the onsite competition, the Event Marshals' as well as the Operations Assistants'.
  assert.equal(item('MAR', '9.4.1.3', 'mar-event-marshal').limitedToActivity, true);
  assert.equal(item('MAR', '9.4.1.3', 'mar-operations-assistant').limitedToActivity, true);
  assert.equal(item('MAR', '9.4.1.1').limitedToActivity, false);
  // Minnesota: the five encampment cords are limited to encampment events; the cords of the unit meetings are not an activity's.
  const mn = D.WINGS.MN.items.filter(i => i.kind === 'cord');
  assert.deepEqual(mn.filter(i => i.limitedToActivity).map(i => i.id), ['mn-encampment-executive-staff', 'mn-encampment-squadron-staff', 'mn-encampment-flight-commander', 'mn-encampment-flight-sergeant', 'mn-encampment-support-staff']);
  assert.match(item('MN', '9.4.1', 'mn-cadet-of-the-quarter').rule, /at unit meetings/);
  // Kansas: a unit cap may not be red, and its lettering is silver or white (the lettering is not what is ruled out).
  assert.match(item('KS', '6.2.8.1').rule, /red is not allowed/);
  assert.match(item('KS', '6.2.8.1').rule, /silver or white lettering/);
  // The wing patch: required in Hawaii, Florida, North Carolina and the Mid-Atlantic Region, optional in Delaware.
  const patchOf = code => D.SUPPLEMENTS.find(e => e.code === code).items.find(i => i.kind === 'wing-patch');
  assert.deepEqual(['HI', 'FL', 'NC', 'MAR', 'DE'].map(c => patchOf(c).required), [true, true, true, true, false]);
  assert.deepEqual(patchOf('HI').uniforms, ['abu']);
  assert.deepEqual(patchOf('NC').uniforms, ['abu', 'corporate_field', 'flight_suit', 'corporate_flight_suit']);
  assert.deepEqual(D.SUPPLEMENTS.filter(e => e.items.some(i => i.kind === 'wing-patch')).map(e => e.code).sort(), ['DE', 'FL', 'HI', 'MAR', 'NC']);
  // Cords worn only while serving as cadet commander: Maryland, Maine and North Carolina, read from a current duty row.
  assert.deepEqual(D.SUPPLEMENTS.flatMap(e => e.items.filter(i => i.earned && i.earned.source === 'duty').map(i => i.id)), ['md-cadet-commander', 'me-cadet-commander', 'nc-cadet-commander']);
  // Minnesota Wing does not allow the blue beret: the option the page offers for the National Blue Beret is taken off.
  assert.deepEqual(S.hiddenOptions({ unitPatchCharter: 'NCR-MN-001' }), { headgear: ['beret'] });
  assert.deepEqual(S.hiddenOptions({ unitPatchCharter: 'NCR-KS-020' }), {});
  assert.deepEqual(S.hiddenOptions({}), {});
});

test('a cord is read as earned only where a report can show it: the graduate cords and the cadet commander cords', () => {
  const how = D.SUPPLEMENTS.flatMap(e => e.items.filter(i => i.kind === 'cord').map(i => [i.id, i.earned.source]));
  const readable = how.filter(([, s]) => s !== 'none').map(([id]) => id).sort();
  assert.deepEqual(readable, ['fl-leadership-academy', 'md-cadet-commander', 'me-cadet-commander', 'mo-medical-orientation', 'mo-pathfinders', 'nc-cadet-commander', 'ner-ncols', 'ner-rcls', 'nh-ncols', 'va-honor-guard-college']);
  // Every pattern is a regular expression that compiles.
  for(const e of D.SUPPLEMENTS) for(const i of e.items) if(i.earned && i.earned.source === 'activity') for(const groups of [i.earned.rowAllOf, i.earned.rowsAllOf].filter(Boolean)) for(const group of groups) for(const re of group) new RegExp(re, 'i');
});

test('a supplement citation is a reference js/citations.js takes out of the sentence and shows behind the question mark', () => {
  everyItem((e, item) => {
    const note = S.noteOf(e, item);
    const s = C.split(note);
    assert.equal(s.text, item.rule, `${e.key} ${item.paragraph}`);
    assert.deepEqual(s.refs, [`CAPR 39-1 ${e.name}, ${item.paragraph}`]);
    assert.equal(C.refLabel(s.refs[0]), s.refs[0]);
  });
  assert.ok(C.isCitation('CAPR 39-1 Northeast Region Supplement 1, 9.4.1'));
  assert.deepEqual(C.split('Cadets may wear it (CAPR 39-1 Northeast Region Supplement 1, 9.4.1).'), { text: 'Cadets may wear it.', refs: ['CAPR 39-1 Northeast Region Supplement 1, 9.4.1'] });
  // The supplement named first, without the publication, is one too, and is labelled as the regulation's supplement.
  assert.ok(C.isCitation('Northeast Region Supplement 1, 9.4.1'));
  assert.ok(C.isCitation('Mid-Atlantic Region Supplement 1; 9.4.1.1'));
  assert.equal(C.refLabel('Maine Wing Supplement 1, 9.4.1.8'), 'CAPR 39-1 Maine Wing Supplement 1, 9.4.1.8');
  // A remark that only names a supplement is not a reference.
  assert.ok(!C.isCitation('Maine Wing Supplement 1'));
  assert.ok(!C.isCitation('Texas Wing Supplement 1, see below'));
});

test('the wing\'s patch: the charter of the wing headquarters, none for a region\'s own headquarters', () => {
  assert.equal(S.wingCharter('MAR-MD-014'), 'MAR-MD-001');
  assert.equal(S.wingCharter('pcr-hi-073'), 'PCR-HI-001');
  assert.equal(S.wingCharter('NER-NER-001'), null);
  assert.equal(S.wingCharter('NHQ-NHQ-000'), null);
  assert.equal(S.wingCharter(''), null);
  // With no patch art to look up (no page here), no warning is made for a patch that cannot be shown.
  assert.deepEqual(S.warnings(cadet('MAR-MD-014', { uniform: 'abu' })), []);
});
