// The wing and region supplements to the uniform regulation, one entry each (CAPR 39-1 supplements, as published by each wing or region), and what each lets a
// member wear. js/supplements.js picks the entries for a unit from its charter number (REGION-WING-NUMBER: the wing part selects the wing's supplement, the region
// part the region's) and the page shows them; the shoulder cord picker lists a supplement's cords through Supplements.cords(state).
//
// An entry: { key, kind: 'region' | 'wing', code, group, name, date, iso, items }. `code` is the part of a charter number that selects it (NE as a wing is Nebraska,
// NER as a region is Northeast, so the two kinds never meet); `group` is the heading the cord picker uses; `name` is the supplement in words and the name its
// references carry. An item is one thing the supplement says, with the paragraph it is in:
//   kind   'cord'        a shoulder cord for cadets. `id` is a cord of data/cords.js (the cord list owns how it is drawn; it is named here by id only),
//                        `label` the cord in words, `earned` how a member report can show it was earned, `limitedToActivity` true for a cord worn only during
//                        an activity (an encampment, a competition), which a report import never picks on its own.
//          'wing-patch'  the wing's patch, `required` or optional, on the uniforms in `uniforms` (page uniform ids).
//          'headgear'    a cap or hat the supplement authorizes; the builder does not draw it, so the page says it in words.
//          'accessory'   a color guard item (ascot, gloves, belt); words as well, outside the honor guard figure.
//          'note'        any other rule (shown as words). `removes: { headgear: 'beret' }` names an option the builder offers that the supplement does not allow.
//   rule   the rule as one plain sentence, without its paragraph; the page adds the paragraph in brackets (js/supplements.js), which js/citations.js hides.
//   audience  'cadet' | 'senior' | 'all' (default 'all'): who the item is for.
//
// How a cord is earned (`earned`), in a form the member report import reads (js/supplements-import.js):
//   { source: 'activity', rowAllOf: [[re, ...], ...] }   one row of the report's training and activity sections matches every group (a group is a list of
//                                                         alternatives, given as regular expression source, tested without regard to case);
//   { source: 'activity', rowsAllOf: [[re, ...], ...] }  every group is matched by some row, not necessarily the same one (the three Florida academies);
//   { source: 'duty', title: 'Cadet Commander' }          a current duty row with exactly this title, the Asst column not Yes, in a unit of the supplement's wing;
//   { source: 'none', why }                              no row of a report shows it (a cadet of the month, a grade point average): the cord is offered, never marked.
(function capubSupplementDataModule(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.CAPUBSupplementData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  // ---- the uniforms the items name (the page's uniform ids) ----
  const ABU = 'abu', CFU = 'corporate_field', FDU = 'flight_suit', CFDU = 'corporate_flight_suit';

  // ---- how a report can show a graduate cord (regular expression sources) ----
  const RCLS = ['Region\\s+Cadet\\s+Leadership\\s+School', '\\bRCLS\\b'];
  const NCOLS = ['Non-?\\s?commissioned\\s+Officer\\s+Leadership\\s+School', '\\bNCOLS\\b'];
  const NEW_HAMPSHIRE = ['New\\s+Hampshire', '\\bNHWG\\b', '\\bNH\\b'];
  const PATHFINDERS = ['Pathfinders?\\s+Technical\\s+School'];
  const MEDICAL_ORIENTATION = ['Medical\\s+Orientation\\s+Training'];
  const HONOR_GUARD_COLLEGE = ['Honor\\s+Guard\\s+College'];
  // The three Florida Leadership Academies (a cadet graduates from all three for the cord).
  const FLA_NCO = ['(?<![A-Za-z])NCO\\s+Leadership\\s+Academy', 'Non-?\\s?commissioned\\s+Officer\\s+Leadership\\s+Academy'];
  const FLA_SNCO = ['\\bSNCO\\s+Leadership\\s+Academy', 'Senior\\s+Non-?\\s?commissioned\\s+Officer\\s+Leadership\\s+Academy'];
  const FLA_CCC = ['\\bCCC\\s+Leadership\\s+Academy', 'Cadet\\s+Command(?:er)?(?:\\x27?s)?\\s+(?:Course|Leadership\\s+Academy)'];

  const activity = (...groups) => ({ source: 'activity', rowAllOf: groups });
  const duty = title => ({ source: 'duty', title });
  const none = why => ({ source: 'none', why });

  // ---- the items ----
  const item = (kind, paragraph, rule, more) => Object.assign({ kind, paragraph, rule, audience: 'all' }, more || {});
  const cord = (id, label, paragraph, rule, earned, more) => item('cord', paragraph, rule, Object.assign({ id, label, audience: 'cadet', earned, limitedToActivity: false }, more || {}));
  const wingPatch = (paragraph, required, uniforms, rule) => item('wing-patch', paragraph, rule, { required, uniforms });
  const headgear = (paragraph, rule) => item('headgear', paragraph, rule);
  const accessory = (paragraph, rule, more) => item('accessory', paragraph, rule, more);
  const note = (paragraph, rule, more) => item('note', paragraph, rule, more);

  const NOT_IN_A_REPORT = 'A member report does not list this award or its date.';
  const GPA = 'A member report does not show a grade point average.';

  const SUPPLEMENTS = [
    // ===================== regions =====================
    {
      key: 'NER', kind: 'region', code: 'NER', group: 'Northeast Region', name: 'Northeast Region Supplement 1', date: '25 March 2026', iso: '2026-03-25',
      items: [
        cord('ner-rcls', 'Region Cadet Leadership School', '9.4.1',
          'Northeast Region cadets who graduated from or served as staff of a Northeast Region Cadet Leadership School may wear a blue and white interwoven shoulder cord.',
          activity(RCLS)),
        cord('ner-ncols', 'Noncommissioned Officer Leadership School', '9.4.1.1',
          'Northeast Region cadets who graduated from or served as staff of an accredited Noncommissioned Officer Leadership School may wear a red and white interwoven shoulder cord.',
          activity(NCOLS))
      ]
    },
    {
      key: 'MAR', kind: 'region', code: 'MAR', group: 'Mid-Atlantic Region', name: 'Mid-Atlantic Region Supplement 1', date: '20 March 2026', iso: '2026-03-20',
      items: [
        wingPatch('5.1.1.1.2.2', true, [ABU, CFU], 'Wearing the wing patch is required on the utility uniforms, the ABU and the Corporate Field Uniform.'),
        note('10.9.5', 'The wing shield patch is worn.'),
        cord('mar-cadet-of-the-year', 'Region Cadet of the Year', '9.4.1.1',
          'The region\'s Cadet of the Year, Junior Cadet Officer of the Year and Cadet Noncommissioned Officer of the Year may wear a royal blue and yellow box braid cord, yellow on the outside, through 15 March of the year after they are selected, at all meetings and activities throughout the region.',
          none(NOT_IN_A_REPORT)),
        cord('mar-competition-team', 'Region Cadet Competition winning team', '9.4.1.2',
          'Cadets on the winning team of the region\'s Cadet Competition may wear a white and green box braid cord, white on the outside, from the competition award ceremony through the day before the next region competition, at all meetings and activities throughout the region.',
          none(NOT_IN_A_REPORT)),
        cord('mar-event-marshal', 'Cadet Competition Event Marshal', '9.4.1.3',
          'Cadets serving as Event Marshals at the region\'s Cadet Competition may wear a white and black box braid cord, white on the outside, during the onsite competition only.',
          none('A member report does not list competition staff.'), { limitedToActivity: true }),
        cord('mar-operations-assistant', 'Cadet Operations Assistant', '9.4.1.3',
          'Cadets serving as Cadet Operations Assistants at the region\'s Cadet Competition may wear a solid black box braid cord during the onsite competition only.',
          none('A member report does not list competition staff.'), { limitedToActivity: true }),
        headgear('6.2.8.1',
          'Members of the region headquarters unit, and members assigned to duties in it, may wear a plain navy blue baseball cap with the charter number in white or the region patch on the front, when performing region duties, with the aviator shirt, the Corporate Field Uniform, the corporate working uniform and the flight duty uniforms.'),
        headgear('6.2.8.4',
          'Mid-Atlantic Region emergency services qualified members on actual or training missions, or at other emergency services activities when the commander, activity director or incident commander allows, may wear a plain blaze or bright orange baseball cap with the charter number in black or the region patch on the front.'),
        headgear('6.2.8.5',
          'A high-visibility orange baseball cap, or a high-visibility watch cap in cold weather only, is optional during actual search and rescue missions and search and rescue training an activity director authorizes, only during the mission or activity and not for travel to and from it; the last name may be embroidered in black on the back, no rank is worn on it, and it is not worn with the flight duty uniforms.'),
        note('1.2.9', 'In cold weather, commanders and activity directors put protection from the elements ahead of the uniform standards.'),
        note('5.1.1.2', 'Unit logos on T-shirts are allowed when they meet the heraldry standards of Civil Air Patrol and have the approval of the wing historian, the wing director of personnel, the wing uniform board and the wing commander; a unit whose T-shirt does not meet the standard may wear it until it is no longer serviceable but may not buy more.'),
        note('5.1.1.2.2', 'Activity T-shirts from any CAP activity may be worn under the uniform outside the activity when they meet the color and construction the uniform requires; no unit emblem or clothing company logo shows when the ABU or OCP coat is worn.'),
        note('8.1.1.1.1', 'Senior members who have or had a CAP aeronautical rating, or who have a current aircrew mission qualification, may wear the flight duty uniform when working or utility uniforms are allowed, unless the unit commander or activity director restricts it when no flight duties are planned; others, cadets with a rating or an orientation flight included, may wear it on days when flight duty is planned.'),
        note('9.5.1', 'When the activity director allows, members marshalling aircraft on a flight line may wear a high-visibility yellow or orange T-shirt and a brimmed hat; the T-shirt may be plain or carry an approved unit patch design on the left chest or the back.')
      ]
    },

    // ===================== wings =====================
    {
      key: 'HI', kind: 'wing', code: 'HI', group: 'Hawaii Wing', name: 'Hawaii Wing Supplement 1', date: '2 October 2026', iso: '2026-10-02',
      items: [
        wingPatch('5.1.1.1.2.2.1', true, [ABU], 'The Hawaii Wing patch is worn on the ABU.'),
        headgear('9.5.6',
          'When the incident commander or activity director allows it for safety, environmental protection or mission needs during outdoor training, missions and field operations, members may wear a boonie hat, either high-visibility or matching the pattern of the utility uniform: an OCP boonie hat with the OCP uniform and an ABU boonie hat with the ABU, never mixed.')
      ]
    },
    {
      key: 'MD', kind: 'wing', code: 'MD', group: 'Maryland Wing', name: 'Maryland Wing Supplement 1', date: '30 July 2026', iso: '2026-07-30',
      items: [
        cord('md-cadet-commander', 'Cadet Commander', '9.4.1.x',
          'The current cadet commander of a Maryland Wing squadron or flight, as shown by the duty assignment in eServices, may wear an interwoven orange and black shoulder cord, only at Maryland Wing activities inside Maryland or at Maryland Wing squadron locations, and takes it off when the duty assignment ends.',
          duty('Cadet Commander'))
      ]
    },
    {
      key: 'ME', kind: 'wing', code: 'ME', group: 'Maine Wing', name: 'Maine Wing Supplement 1', date: '1 March 2024', iso: '2024-03-01',
      items: [
        cord('me-squadron-cadet-of-the-year', 'Squadron Cadet of the Year', '9.4.1.1',
          'The Squadron Cadet of the Year may wear a shoulder cord that is white in the center with a gold edge.', none(NOT_IN_A_REPORT)),
        cord('me-squadron-cadet-of-the-quarter', 'Squadron Cadet of the Quarter', '9.4.1.2',
          'The Squadron Cadet of the Quarter may wear a shoulder cord that is black in the center with a gold edge, for one quarter after the award date.', none(NOT_IN_A_REPORT)),
        cord('me-squadron-cadet-of-the-month', 'Squadron Cadet of the Month', '9.4.1.3',
          'The Squadron Cadet of the Month may wear a shoulder cord that is dark green in the center with a gold edge, for one month after the award date.', none(NOT_IN_A_REPORT)),
        cord('me-cadet-commander', 'Cadet Commander', '9.4.1.4',
          'The Cadet Commander may wear a shoulder cord that is silver in the center with a black edge, while serving as Cadet Commander.', duty('Cadet Commander')),
        cord('me-afa-nco-of-the-year', 'Outstanding Cadet Noncommissioned Officer of the Year', '9.4.1.5',
          'The wing\'s Air Force Association Outstanding Cadet Noncommissioned Officer of the Year may wear a navy blue and gray shoulder cord for one year after the award date.', none(NOT_IN_A_REPORT)),
        cord('me-wing-cadet-of-the-year', 'Wing Cadet of the Year', '9.4.1.6',
          'The wing\'s Cadet of the Year may wear a shoulder cord that is gray in the center with a gold edge, for one year after the award date.', none(NOT_IN_A_REPORT)),
        cord('me-honor-society', 'Cadet Honor Society', '9.4.1.7',
          'Members of the Basic Cadet Honor Society may wear a blue and gold shoulder cord.', none('A member report does not list an honor society induction.')),
        cord('me-honor-society-distinction', 'Cadet Honor Society with Distinction', '9.4.1.8',
          'Members of the Cadet Honor Society with Distinction may wear a blue and gold shoulder cord with one added gold strand with a silver tip.', none('A member report does not list an honor society induction.'))
      ]
    },
    {
      key: 'NH', kind: 'wing', code: 'NH', group: 'New Hampshire Wing', name: 'New Hampshire Wing Supplement 1', date: '3 December 2024', iso: '2024-12-03',
      items: [
        note('9.4', 'Uniform items the New Hampshire Wing Commander authorizes are worn only at meetings and activities hosted by the wing or its units.'),
        cord('nh-ncols', 'Wing Noncommissioned Officer Leadership School', '9.4.1.1',
          'New Hampshire Wing cadets who graduated from or served as staff of the New Hampshire Wing Noncommissioned Officer Leadership School may wear a red and white interwoven shoulder cord, only at meetings and activities hosted by the wing or its units.',
          activity(NCOLS, NEW_HAMPSHIRE)),
        cord('nh-cadet-of-the-month-quarter', 'Squadron Cadet of the Month or Quarter', '9.4.1.2',
          'A squadron with a local Cadet of the Month or Quarter program may award a solid gray interwoven shoulder cord to the cadet recognized, who may wear it until a new recipient is selected, only at meetings and activities hosted by the wing or its units.',
          none(NOT_IN_A_REPORT))
      ]
    },
    {
      key: 'MO', kind: 'wing', code: 'MO', group: 'Missouri Wing', name: 'Missouri Wing Supplement 1', date: '26 December 2025', iso: '2025-12-26',
      items: [
        cord('mo-pathfinders', 'Pathfinders Technical School', '9.4.1.1',
          'Within Missouri, cadet graduates of the Missouri Wing Pathfinders Technical School may wear an orange shoulder cord on the USAF-style service uniform; it is not worn at region or national events unless the sponsoring region headquarters or National Headquarters allows it.',
          activity(PATHFINDERS)),
        cord('mo-medical-orientation', 'Medical Orientation Training School', '9.4.1.2',
          'Within Missouri, cadet graduates of the Medical Orientation Training School may wear a maroon and black shoulder cord on the USAF-style service uniform; it is not worn at region or national events unless the sponsoring region headquarters or National Headquarters allows it.',
          activity(MEDICAL_ORIENTATION))
      ]
    },
    {
      key: 'WV', kind: 'wing', code: 'WV', group: 'West Virginia Wing', name: 'West Virginia Wing Supplement 1', date: '28 May 2020', iso: '2020-05-28',
      items: [
        headgear('6.2.8.1',
          'Members of a West Virginia Wing emergency services ground team may wear a blaze orange baseball cap printed "WV Ground Team" with the Battle Dress Uniform or the Corporate Field Uniform, only during practice, actual field missions or special events the Wing Commander allows; a member who is also aircrew or mission staff wears it only when serving directly in the field on ground team operations.'),
        cord('wv-honor-society', 'Wing Honor Society', '9.4.1.1',
          'A cadet accepted into the West Virginia Wing Honor Society before completing the Billy Mitchell Award wears a blue and gold shoulder cord and tassel on the left shoulder of the USAF-style service uniform (Class A and B).',
          none('A member report does not list an honor society induction.')),
        cord('wv-honor-society-after-mitchell', 'Wing Honor Society, inducted after the Mitchell Award', '9.4.1.1',
          'A cadet accepted into the West Virginia Wing Honor Society after completing the Billy Mitchell Award or a higher achievement wears a blue and gold shoulder cord with an added blue cord with a silver tip, on the left shoulder of the USAF-style service uniform (Class A and B).',
          none('A member report does not list an honor society induction.')),
        cord('wv-honor-society-twice', 'Wing Honor Society, inducted before and again after the Mitchell Award', '9.4.1.1',
          'A cadet inducted before the Billy Mitchell Award who meets the membership standards again after completing it wears a blue and gold shoulder cord with an added gold cord with a silver tip, on the left shoulder of the USAF-style service uniform (Class A and B).',
          none('A member report does not list an honor society induction.')),
        note('9.4.1.1', 'A cadet wearing the West Virginia Wing Honor Society cord wears no other cord at the same time.', { audience: 'cadet' })
      ]
    },
    {
      key: 'GA', kind: 'wing', code: 'GA', group: 'Georgia Wing', name: 'Georgia Wing Supplement 1', date: '25 March 2026', iso: '2026-03-25',
      items: [
        headgear('6.2.8.1',
          'A unit may adopt a dark blue baseball cap with the unit emblem embroidered on the front 2 1/2 inches high, once the Wing Commander approves it in writing; wing headquarters staff wear a black cap with the wing emblem, and members of the incident management team a dark blue or orange cap with the team emblem; none is worn outside Georgia Wing.'),
        cord('ga-honor-society', 'Cadet Honor Society', '9.4.1.1',
          'Active members of the Georgia Wing Cadet Honor Society may wear a double strand shoulder cord with a nickel tip, in maroon and dark gold, on the USAF blue dress uniforms (Class A or B), and not outside Georgia Wing.',
          none('A member report does not list an honor society induction.')),
        cord('ga-cadet-of-the-quarter-month', 'Cadet of the Quarter or Month', '9.4.1.1',
          'The Cadet of the Quarter or Month may wear a single color orange shoulder cord on the USAF blue dress uniforms (Class A or B), and not outside Georgia Wing.', none(NOT_IN_A_REPORT)),
        cord('ga-squadron-cadet-of-the-year', 'Squadron Cadet of the Year', '9.4.1.1',
          'The Squadron Cadet of the Year may wear a single color gray shoulder cord on the USAF blue dress uniforms (Class A or B), and not outside Georgia Wing.', none(NOT_IN_A_REPORT)),
        cord('ga-phase-cadet-of-the-year', 'Cadet of the Year for a phase', '9.4.1.1',
          'The Cadet of the Year for Phase I, II, III or IV may wear a two color black and gold shoulder cord on the USAF blue dress uniforms (Class A or B), and not outside Georgia Wing.', none(NOT_IN_A_REPORT)),
        cord('ga-cadet-of-the-year', 'Cadet of the Year', '9.4.1.1',
          'The overall Cadet of the Year may wear a two color black and gold shoulder cord with a knot on the USAF blue dress uniforms (Class A or B), and not outside Georgia Wing.', none(NOT_IN_A_REPORT))
      ]
    },
    {
      key: 'DE', kind: 'wing', code: 'DE', group: 'Delaware Wing', name: 'Delaware Wing Supplement 1', date: '28 February 2025', iso: '2025-02-28',
      items: [
        wingPatch('5.1.1.1.2.2', false, [ABU], 'Wearing the Delaware Wing patch on the left sleeve of the ABU coat is optional.'),
        headgear('6.2.98',
          'Delaware Wing members may wear a navy blue baseball cap with all utility uniforms except the ABU, with one inch gold block capital letters reading DE, a hyphen and the unit charter number; unit commanders may allow a unit cap with the ABU, which is not worn outside the unit and, at wing, region or national activities, only when the activity director allows.'),
        cord('de-wing-cadet-of-the-year', 'Wing Cadet of the Year', '9.3.5',
          'The Delaware Wing Cadet of the Year, Junior Cadet Officer of the Year and Noncommissioned Officer of the Year may wear a royal blue and gold woven shoulder cord on the left shoulder.',
          none(NOT_IN_A_REPORT)),
        cord('de-unit-award', 'Cadet of the Month or Quarter', '9.4.1',
          'Cadets of the month and quarter in Delaware Wing squadrons may wear a shoulder cord on the left shoulder while they hold that designation; the squadron commander chooses its color, which may not be the color of the Wing Cadet of the Year cord or of any cord the regulation names.',
          none(NOT_IN_A_REPORT))
      ]
    },
    {
      key: 'FL', kind: 'wing', code: 'FL', group: 'Florida Wing', name: 'Florida Wing Supplement 1', date: '30 October 2025', iso: '2025-10-30',
      items: [
        wingPatch('5.1.1.1.2.2', true, [ABU], 'Wearing the Florida Wing patch is required on the ABU for members of Florida Wing.'),
        cord('fl-phase-cadet-of-the-year', 'Cadet of the Year for a phase', '9.4.1.1',
          'The Florida Wing Cadet of the Year for Phase I, II, III or IV may wear a maroon box cord with Class A or B blues, only within Florida Wing, at any wing, group or squadron function where the blues are required, for as long as the cadet stays in CAP as a cadet in good standing; written disciplinary action or a suspension ends it.',
          none(NOT_IN_A_REPORT)),
        cord('fl-leadership-academy', 'Florida Leadership Academy graduate', '9.4.1.2',
          'Cadets who graduate from all three Florida Leadership Academies may wear a black and gold cord, gold in the center and black on the edge, with Class A or B blues, only within Florida Wing, at any wing, group or squadron function where the blues are required, until they leave CAP or become a senior member.',
          { source: 'activity', rowsAllOf: [FLA_NCO, FLA_SNCO, FLA_CCC] }),
        cord('fl-leadership-academy-instructor', 'Florida Leadership Academy graduate who returned as an instructor', '9.4.1.2',
          'A cadet who has earned the Florida Leadership Academy cord may add a gold aiguillette by returning to a Florida Leadership Academy as an instructor; one aiguillette is worn however many times the cadet returns, with Class A or B blues, only within Florida Wing.',
          none('A member report does not show who instructed at an academy.')),
        cord('fl-honor-society-distinction', 'Cadet Honor Society member of distinction', '9.4.1.3',
          'Cadets who earn the Florida Wing Cadet Honor Society member of distinction may wear a blue and gold cord, gold in the center and blue on the edge, with Class A or B blues, only within Florida Wing, until they leave CAP or become a senior member.',
          none('A member report does not list an honor society induction.')),
        cord('fl-honor-society-high-distinction', 'Cadet Honor Society member of high distinction', '9.4.1.3',
          'Cadets who earn the Florida Wing Cadet Honor Society member of high distinction may wear the blue and gold cord with a gold aiguillette, with Class A or B blues, only within Florida Wing, until they leave CAP or become a senior member.',
          none('A member report does not list an honor society induction.')),
        cord('fl-squadron-cadet-of-the-year', 'Squadron Cadet of the Year', '9.4.1.4',
          'A squadron\'s Cadet of the Year may wear a maroon and white box cord, maroon on the outside and white on the inside, with Class A or B blues, only within Florida Wing, for one year after the award or until the cadet leaves CAP or becomes a senior member, as long as the cadet stays in good standing.',
          none(NOT_IN_A_REPORT)),
        cord('fl-executive-leadership', 'Executive Leadership Program graduate with distinction', '9.4.1.5',
          'A cadet who graduates from the Florida Wing Executive Leadership Program with distinction may wear a gray and blue cord, gray on the outside and blue on the inside, with Class A or B blues, only within Florida Wing, until the cadet leaves CAP or becomes a senior member.',
          none('A member report does not show graduating with distinction.'))
      ]
    },
    {
      key: 'NE', kind: 'wing', code: 'NE', group: 'Nebraska Wing', name: 'Nebraska Wing Supplement 1', date: '5 December 2023', iso: '2023-12-05',
      items: [
        headgear('6.2.8.1',
          'A standard single color baseball cap in a conservative color is allowed in Nebraska Wing with the aviator shirt, the ABU, the corporate working uniforms and the flight duty uniforms, brim facing forward, with letters 3 to 5 inches high and no squadron patches; a unit sends its proposed color and design to the Wing Commander for approval.'),
        note('9.4.1.1', 'Only the shoulder cords listed here may be worn by cadets at Nebraska Wing activities when the blues uniform is worn, and not outside the wing unless the regulation allows it, as in Cadet Advisory Council, color guard and honor guard events; the white cord is the color guard cord worn by color guard team members.', { audience: 'cadet' }),
        cord('ne-cadet-of-the-year', 'Wing Cadet of the Year', '9.4.1.1',
          'The Nebraska Wing Cadet of the Year may wear a red and white shoulder cord at Nebraska Wing activities when the blues uniform is worn, until the cadet becomes a senior member.', none(NOT_IN_A_REPORT)),
        cord('ne-academic-excellence', 'Academic Excellence', '9.4.1.2',
          'Cadets who show their unit commander proof of at least a 3.5 on a 4.0 scale for each semester may wear a gold and blue Academic Excellence cord at Nebraska Wing activities when the blues uniform is worn, for the semester after the one in which they earned it.', none(GPA)),
        cord('ne-unit-award', 'Unit Level Award', '9.4.1.3',
          'A blue and white Unit Level Award cord is given from a unit program approved each year by Nebraska Wing Headquarters, for any period the unit chooses, and is worn at Nebraska Wing activities when the blues uniform is worn; no more than two cadets per unit wear it at a time.', none(NOT_IN_A_REPORT))
      ]
    },
    {
      key: 'MN', kind: 'wing', code: 'MN', group: 'Minnesota Wing', name: 'Minnesota Wing Supplement 1', date: '17 April 2024', iso: '2024-04-17',
      items: [
        headgear('6.2.8', 'A navy blue baseball cap is allowed in Minnesota Wing, with the unit charter number or a unit patch from the wing\'s approved list on it, when the unit commander allows; any other color or design needs the Wing Commander\'s written approval.'),
        note('9.4', 'Color guard items are worn only while performing color guard duties.'),
        note('9.6', 'Honor guard items are worn only while performing honor guard duties.'),
        note('9.4.1', 'Minnesota Wing cadets wear only one of the wing\'s additional shoulder cords at a time, and none outside Minnesota Wing.', { audience: 'cadet' }),
        cord('mn-encampment-executive-staff', 'Encampment Executive Staff', '9.4.1',
          'Encampment executive staff may wear a black and purple shoulder cord within Minnesota Wing, only at encampment and encampment preparation events.',
          none('A member report does not list encampment staff positions.'), { limitedToActivity: true }),
        cord('mn-encampment-squadron-staff', 'Encampment Squadron Staff', '9.4.1',
          'Encampment squadron staff may wear a black and royal blue shoulder cord within Minnesota Wing, only at encampment and encampment preparation events.',
          none('A member report does not list encampment staff positions.'), { limitedToActivity: true }),
        cord('mn-encampment-flight-commander', 'Encampment Flight Commander', '9.4.1',
          'Encampment flight commanders may wear a black and red shoulder cord within Minnesota Wing, only at encampment and encampment preparation events.',
          none('A member report does not list encampment staff positions.'), { limitedToActivity: true }),
        cord('mn-encampment-flight-sergeant', 'Encampment Flight Sergeant', '9.4.1',
          'Encampment flight sergeants may wear a black and yellow shoulder cord within Minnesota Wing, only at encampment and encampment preparation events.',
          none('A member report does not list encampment staff positions.'), { limitedToActivity: true }),
        cord('mn-encampment-support-staff', 'Encampment Support Staff', '9.4.1',
          'Encampment support staff may wear a black and gray shoulder cord within Minnesota Wing, only at encampment and encampment preparation events.',
          none('A member report does not list encampment staff positions.'), { limitedToActivity: true }),
        cord('mn-drill-down-cadet-of-the-month', 'Drill Down Winner or Cadet of the Month', '9.4.1',
          'A Drill Down winner or the Cadet of the Month may wear a yellow and green shoulder cord at unit meetings within Minnesota Wing, with the unit commander\'s approval.', none(NOT_IN_A_REPORT)),
        cord('mn-cadet-of-the-quarter', 'Cadet of the Quarter', '9.4.1',
          'The Cadet of the Quarter may wear a yellow and blue shoulder cord at unit meetings within Minnesota Wing, with the unit commander\'s approval.', none(NOT_IN_A_REPORT)),
        note('9.4.6', 'Blue berets are not allowed within Minnesota Wing.', { removes: { headgear: 'beret' } }),
        note('2.8.3.1', 'Wing-approved activity patches are not worn as part of the uniform; they may go on backpack-type equipment or T-shirts.')
      ]
    },
    {
      key: 'KS', kind: 'wing', code: 'KS', group: 'Kansas Wing', name: 'Kansas Wing Supplement 1', date: '10 August 2026', iso: '2026-08-10',
      items: [
        headgear('6.2.8.1',
          'A unit may adopt a baseball cap in a single conservative color, such as blue, gray, black, white, green, brown, tan or blaze orange, once the Wing Commander approves it in writing; red is not allowed, the unit designation is in silver or white lettering between 1/2 and 1 inch tall, and the cap is not worn outside Kansas Wing.'),
        note('9.4.1.1', 'Kansas cadets wear the wing\'s additional shoulder cords only if they meet the criteria, the one most appropriate for the event when they may wear several, and never outside Kansas Wing; a shoulder cord another wing awarded may be worn with the Wing Commander\'s written permission.', { audience: 'cadet' }),
        cord('ks-cadet-of-the-quarter', 'Squadron Cadet of the Quarter', '9.4.1.1.1',
          'The unit commander may allow one cadet in the unit to wear a yellow and red Squadron Cadet of the Quarter cord, red on the outside, for one quarter, and never for more than one quarter in a row; it is not worn outside Kansas Wing.', none(NOT_IN_A_REPORT)),
        cord('ks-academic', 'Academic cord', '9.4.1.1.2.1',
          'Cadets with a grade point average of 3.5 to 3.9 may wear a yellow and black Academic cord, black on the outside, for the 12 months after the unit commander approves it on proof of the grade point average; it is not worn outside Kansas Wing.', none(GPA)),
        cord('ks-academic-high', 'Academic cord, highest grade point average', '9.4.1.1.2.2',
          'Cadets with a grade point average of 4.0 or higher may wear a yellow and blue Academic cord, blue on the outside, for the 12 months after the unit commander approves it on proof of the grade point average; it is not worn outside Kansas Wing.', none(GPA)),
        cord('ks-competition-first', 'Cadet Competition, first place', '9.4.1.1.3.1',
          'Cadets on the first place team at the Wing Cadet Competition may wear a blue and metallic silver cord with a cord and silver tip added, blue on the outside, for the year after the competition or until a new first place team is announced; it is not worn outside Kansas Wing.', none('A member report does not list competition results.')),
        cord('ks-competition-second', 'Cadet Competition, second place', '9.4.1.1.3.2',
          'Cadets on the second place team at the Wing Cadet Competition may wear a blue and metallic silver cord, blue on the outside, for the year after the competition or until a new second place team is announced; it is not worn outside Kansas Wing.', none('A member report does not list competition results.')),
        note('9.4.1.1.4', 'A cadet who graduated from another wing\'s program may wear that wing\'s shoulder cord, after giving the unit commander documentation of the graduation.', { audience: 'cadet' }),
        note('10.9.5.1', 'The old Kansas Wing patch, a blue circle with the shape of Kansas and old style CAP pilot wings, may not be worn after 1 May 2024.')
      ]
    },
    {
      key: 'VA', kind: 'wing', code: 'VA', group: 'Virginia Wing', name: 'Virginia Wing Supplement 1', date: '17 June 2026', iso: '2026-06-17',
      items: [
        headgear('6.2.8',
          'Virginia Wing members may wear a navy blue baseball cap with the aviator shirt, the ABU, the OCP, the corporate working uniforms or the flight duty uniforms, and in civilian attire, with the unit charter number in white or silver, the wing patch or the approved unit patch on the front; emergency services qualified members on actual or training missions may wear a blaze or bright orange cap with black lettering or the unit patch.'),
        note('8.1.1.1.1', 'Senior members who have or had a CAP or military aeronautical rating, or who have a current aircrew mission qualification, may wear the flight duty uniform when working or utility uniforms are allowed; others, cadets with a rating and cadets taking an orientation flight included, may wear it on days when flight duty is planned, unless the unit commander or activity director restricts it when no flight duties are planned.'),
        cord('va-honor-guard-college', 'Virginia Wing Honor Guard College', '9.4.1.1',
          'Graduates of the Virginia Wing Honor Guard College may wear a gray shoulder cord while a cadet in Virginia Wing, only at wing and subordinate unit meetings and activities.',
          activity(HONOR_GUARD_COLLEGE)),
        cord('va-cadet-of-the-month-quarter', 'Squadron Cadet of the Month or Quarter', '9.4.1.2',
          'A squadron may award a purple box braid cord to the cadet its Cadet of the Month or Quarter program recognizes, who may wear it until a new recipient is selected, only at wing and subordinate unit meetings and activities.', none(NOT_IN_A_REPORT)),
        cord('va-wing-cadet-of-the-year', 'Wing Cadet Officer or Cadet Noncommissioned Officer of the Year', '9.4.1.3',
          'The wing\'s Cadet Officer of the Year and Cadet Noncommissioned Officer of the Year may wear a purple and gray box braid cord, gray on the outside, until a new recipient is selected, only at wing and subordinate unit meetings and activities.', none(NOT_IN_A_REPORT)),
        cord('va-government-relations-intern', 'Wing Government Relations Intern', '9.4.1.4',
          'Cadets appointed as a wing Government Relations Intern may wear a navy blue and gray box braid cord, gray on the outside, while they are appointed, only at wing and subordinate unit meetings and activities.',
          none('A member report does not list this appointment.')),
        accessory('9.4.2', 'Cadets performing color guard duties, including training, may wear a white ascot, plain or with the CAP, Virginia Wing or squadron patch.'),
        accessory('9.4.3', 'Cadets performing color guard duties, including training, may wear white parade gloves.'),
        accessory('9.4.4', 'Cadets performing color guard duties, including training, may wear a white pistol belt.'),
        note('9.5.1.1', 'When the activity director, incident commander or Wing Commander allows, qualified ground team members may wear a high-visibility orange T-shirt with the Corporate Flight Duty Uniform, the Corporate Field Uniform, the ABU or the OCP; it may be plain or carry an approved Virginia Wing patch design on the left chest or the back.'),
        note('9.5.1.2', 'When the activity director or incident commander allows, members marshalling aircraft on a flight line, directing vehicles during point of distribution operations or working on ground teams may wear a high-visibility yellow or orange shirt, a brimmed hat or both.'),
        note('9.5.6', 'Approved climbing helmets, or safety helmets that Virginia Department of Emergency Management search and rescue standards require, may be worn with the utility uniforms by ground team members and leaders on actual or training missions, marked only with the owner\'s name or the unit charter number or name.'),
        note('10.9.5', 'The legacy wing patch approved before 2021 may be worn until 1 November 2028.')
      ]
    },
    {
      key: 'NC', kind: 'wing', code: 'NC', group: 'North Carolina Wing', name: 'North Carolina Wing Supplement 1', date: '16 April 2026', iso: '2026-04-16',
      items: [
        wingPatch('5.1.1.1.2.2.1, 5.2.1.1.2.2.1, 8.2.4.5.1 and 8.3.4.5.1', true, [ABU, CFU, FDU, CFDU],
          'The North Carolina Wing shield patch is worn on the ABU, the Corporate Field Uniform, the flight duty uniform and the Corporate Flight Duty Uniform.'),
        note('5.1.1.1.1.3', 'Cadet officer grade insignia on the collar is centered and perpendicular, starting 1 inch from the bottom edge of the collar.', { audience: 'cadet' }),
        headgear('6.2.8',
          'A unit baseball cap is black, with at most one designation patch (the unit, the unit commander, the unit cadet commander or the Cadet Advisory Council) in silver lettering on black, worn at all activities within the unit only and not at wing, region or national activities unless the activity director allows; the unit may instead choose a plain black cap with no designation.'),
        headgear('6.2.8.5',
          'High-visibility orange baseball caps, or high-visibility watch caps in cold weather only, are worn during actual search and rescue missions and search and rescue training an activity director directs, only during the mission or activity; the last name may be embroidered in black on the back, no rank is worn on it, and it is not worn with the flight duty uniforms.'),
        note('9.4.1', 'The North Carolina Wing Cadet Honor Society cord is not allowed.', { audience: 'cadet' }),
        cord('nc-wing-cadet-of-the-year', 'Wing Cadet of the Year', '9.4.1.2',
          'The Wing Cadet of the Year, the Wing Air Force Sergeants Association Cadet of the Year and the Brewer Award recipient (cadet) may wear a blue and white woven shoulder cord, provided by Wing Headquarters, on the left shoulder for the 12 months after the presentation, and return it to Wing Headquarters before the next award winner is announced.',
          none(NOT_IN_A_REPORT)),
        cord('nc-unit-award', 'Unit Cadet of the Month, Quarter or Year', '9.4.1.3',
          'The unit Cadet of the Month, Quarter or Year may wear a cord of the unit commander\'s choosing, which may not conflict with a cord already in use.', none(NOT_IN_A_REPORT)),
        cord('nc-cadet-commander', 'Cadet Squadron Commander', '9.4.1.3.2',
          'Cadet squadron commanders may wear a gold shoulder cord with royal blue edging on the USAF-style Class A or B uniforms only, while serving as cadet squadron commander, and not outside North Carolina Wing.',
          duty('Cadet Commander')),
        note('9.4.5', 'The wing commander decides the color of helmet liners and hardhats, except that emergency services helmet liners are white with an Emergency Services patch decal and search and rescue hardhats are orange.'),
        note('9.7.1', 'North Carolina Wing members may wear the physical fitness uniform in any combination within the wing, and wear it during physical fitness assessments and organized physical training events when it is the uniform of the day.'),
        note('10.9.5.1', 'The old North Carolina Wing patch, a blue circle with the Wright Brothers National Memorial, may not be worn after 1 June 2022.')
      ]
    }
  ];

  // ---- the lookup tables the page and the tests use ----
  const REGIONS = Object.freeze(Object.fromEntries(SUPPLEMENTS.filter(s => s.kind === 'region').map(s => [s.code, s])));
  const WINGS = Object.freeze(Object.fromEntries(SUPPLEMENTS.filter(s => s.kind === 'wing').map(s => [s.code, s])));

  return { SUPPLEMENTS, REGIONS, WINGS };
});
