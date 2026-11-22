// Which devices a CAP ribbon carries, from what the member earned (CAPR 39-3).
//
// The galleries keep their option lists (values and labels), because saved setups and the member
// report importer use them. This module reads a selection - its value and label - as an award count
// plus modifiers (aircrew propeller, Presidential "V", commander level star, PME star, honor credit
// and so on), then applies the CAPR 39-3 device rules to produce the ribbons to wear, each with its
// devices in wearer's-right-first order. The artwork is one plain ribbon per award and one asset per
// device, so every combination is drawn from the same pieces.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.CAPUBRibbonAwards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const D = {
    claspB: 'device-clasp-bronze', claspS: 'device-clasp-silver',
    starB: 'device-star-bronze', starS: 'device-star-silver', starG: 'device-star-gold',
    propB: 'device-propeller-bronze', vS: 'device-v',
    olcB: 'mil-device-olc-bronze', olcS: 'mil-device-olc-silver'
  };
  // 39-3 6b: at most four devices on a ribbon, "unless otherwise stated". An award whose own paragraph states a lower limit sets `max` in FAMILIES (the Lifesaving ribbon, 9h: three).
  const MAX = 4;

  // How each ribbon counts. unit: how the option labels count (awards, or N sorties per award).
  // devices: 'clasps' (bronze per additional, silver = five), 'stars' (same with stars), 'olc'.
  const FAMILIES = {
    distinguished_service_award: { devices: 'clasps' },
    exceptional_service_award: { devices: 'clasps' },
    meritorious_service_award: { devices: 'clasps' },
    cap_achievment_award: { devices: 'clasps' },
    national_commander_unit_citation_award: { devices: 'clasps' },
    unit_citation_award: { devices: 'clasps' },
    // 6b: a repeated Bronze Medal of Valor is the bronze clasp on the ribbon of the first award, not a ribbon for each award. The Silver Medal of Valor is worn plain, whatever the
    // count a saved setup or a report carries (the owner, 2026-11-18: "the SMOV cannot have any devices on top of it"); 6b itself names no exception.
    silver_medal_of_valor: { devices: 'clasps', once: true },
    bronze_medal_of_valor: { devices: 'clasps' },
    encampment_ribbon: { devices: 'clasps', per: { encampment: 1 } },
    cap_counterdrug_ribbon: { devices: 'clasps', per: { sortie: 10 } },
    homeland_security_ribbon: { devices: 'clasps', per: { sortie: 10 } },
    cap_cadet_orientation_pilot_ribbon: { devices: 'clasps', per: { flight: 50 } },
    community_service_ribbon: { devices: 'clasps', per: { hour: 60 } },
    cadet_special_activity_ribbon: { devices: 'stars', per: { activit: 1 } }, // 39-3 20d: a bronze star per activity
    air_search_and_rescue_ribbon: { devices: 'clasps', per: { sortie: 10 }, propeller: true },
    search_find_ribbon: { devices: 'clasps', per: { find: 1 }, propeller: true },
    disaster_relief_ribbon: { devices: 'clasps', v: true },
    commander_commendation_award: { devices: 'clasps', levelStars: true },
    lifesaving_award: { devices: 'clasps', lifesavingStar: true, max: 3 }, // 9h: "A maximum of three devices (one silver star and two clasps)", then a second ribbon
    cadet_recruiter_ribbon: { devices: 'recruiter', first: 2, step: 2, silverStep: 10 },
    cap_senior_recruiter_ribbon: { devices: 'recruiter', first: 7, step: 10, silverStep: 50 },
    // 6b: subsequent awards of the same ribbon are marked by the bronze clasp; the IACE follows that rule.
    // 21-03 para 2: one Crisis Service Ribbon is earned for each service period, and the awards of the later periods are the bronze triangle clasp on it (6b: a silver clasp for five).
    crisis_ribbon: { devices: 'clasps' },
    // `once`: awarded a single time, so no clasp and no repeat count. The Cadet of the Year awards (AFA, AFSA, VFW officer and NCO) are given for one year's winner (CAPR 39-3);
    // `devices` stays for shape compatibility.
    iace_ribbon: { devices: 'clasps' },
    afa_award: { devices: 'clasps', once: true },
    afsa_award: { devices: 'clasps', once: true },
    vfw_officer_award: { devices: 'clasps', once: true },
    vfw_nco_award: { devices: 'clasps', once: true },
    Air_Force_Organizational_Excellence_Award: { devices: 'olc' },
    air_force_aerial_achievement_medal: { devices: 'olc' },
    air_medal: { devices: 'olc' },
    red_service_ribbon: { devices: 'years' },
    cap_gill_robb_wilson_ribbon: { devices: 'pme' },
    cap_paul_e_garber_ribbon: { devices: 'pme' },
    cap_command_service_ribbon: { devices: 'command' },
    cap_leadership_ribbon: { devices: 'starList' },
    national_cadet_competition_ribbon: { devices: 'starList' },
    national_color_guard_competition_ribbon: { devices: 'starList' },
    cadet_advisory_council_ribbon: { devices: 'starList' },
    mitchell_award: { devices: 'cadet' },
    eaker_award: { devices: 'cadet' },
    goddard_achievement: { devices: 'cadet' },
    curry_achievement: { devices: 'cadet' }, hap_arnold_achievement: { devices: 'cadet' },
    mary_feik_achievement: { devices: 'cadet' }, rickenbacker_achievement: { devices: 'cadet' },
    lindbergh_achievement: { devices: 'cadet' }, doolittle_achievement: { devices: 'cadet' },
    armstrong_achievement: { devices: 'cadet' },
    earhart_award: { devices: 'cadet' }, spaatz_award: { devices: 'cadet' },
    cadet_certificate_of_proficiency: { devices: 'cadet' }, frank_borman_falcon_award: { devices: 'cadet' }
  };
  // 14j: a senior member who removes the Mitchell ribbon may move the COS star to the highest
  // cadet program ribbon earned.
  // Cadet achievements 1-8 can carry the honor credit star (Curry through Armstrong).
  const HONOR_CREDIT_RIBBONS = new Set(['curry_achievement', 'hap_arnold_achievement', 'mary_feik_achievement',
    'rickenbacker_achievement', 'lindbergh_achievement', 'doolittle_achievement', 'goddard_achievement', 'armstrong_achievement']);
  const COS_MOVES_TO = new Set(['eaker_award', 'earhart_award', 'spaatz_award', 'cadet_certificate_of_proficiency', 'frank_borman_falcon_award']);

  const ORD = /(\d+)(?:st|nd|rd|th)\b/i;

  function num(text){ return Number(String(text).replace(/,/g, '')); }

  // Read a total award count from the option value/label. Returns null when nothing says so.
  function readCount(id, value, label){
    const fam = FAMILIES[id] || {};
    let m;
    if((m = /capub_total_(\d+)/.exec(value))) return num(m[1]);
    if((m = /mcchord_level_(\d+)/.exec(value))) return num(m[1]);
    if((m = /^find_(\d+)$/.exec(value))) return num(m[1]);
    if((m = /^count_(\d+)$/.exec(value))) return num(m[1]);
    // A setup saved when repeated Silver Medals of Valor were separate ribbons: "silver_valor_2" ("2 Silver Medals of Valor") is two awards, so one bronze clasp (6b).
    if(id === 'silver_medal_of_valor' && ((m = /^silver_valor_(\d+)$/.exec(value)) || (m = /\b(\d+)\s+Silver\s+Medals?\b/i.exec(label)))) return Math.max(1, num(m[1]));
    if(fam.per){
      for(const key of Object.keys(fam.per)){
        const re = new RegExp('([\\d,]+)\\s+(?:orientation\\s+)?' + key, 'i');
        if((m = re.exec(label))) return Math.max(1, Math.round(num(m[1]) / fam.per[key]));
      }
    }
    if((m = ORD.exec(label))) return num(m[1]);
    // Descriptive labels: "6th Award / 1 Silver Clasp + 2 Bronze Clasps", "2 Bronze Clasps".
    const silver = /(\d+)?\s*silver clasps?/i.exec(label) || /silver_clasp_(\d+)/.exec(value);
    const bronze = /(\d+)?\s*bronze clasps?/i.exec(label) || /bronze_clasp_(\d+)/.exec(value);
    if(silver || bronze){
      const s = silver ? (Number(silver[1]) || 1) : 0, b = bronze ? (Number(bronze[1]) || 1) : 0;
      return 1 + 5 * s + b;
    }
    if(/basic|earned|^\s*$/i.test(label) || /^(earned|years_2|hours_60)$/.test(value)) return 1;
    return null;
  }

  // True when the label itself gives the total (an ordinal or a counted unit such as sorties).
  function statesTotal(id, label){
    const fam = FAMILIES[id] || {};
    if(ORD.test(label)) return true;
    return !!(fam.per && Object.keys(fam.per).some(k => new RegExp('[\\d,]+\\s+(?:orientation\\s+)?' + k, 'i').test(label)));
  }

  function starsFromText(text){
    const t = String(text || '');
    const out = [];
    // "S-S-B Stars"
    const combo = /\b([BSG](?:-[BSG])+)\s+Stars?\b/i.exec(t);
    if(combo){
      combo[1].toUpperCase().split('-').forEach(c => out.push(c === 'G' ? D.starG : c === 'S' ? D.starS : D.starB));
      return out;
    }
    const words = { one: 1, two: 2, three: 3, four: 4 };
    const re = /(?:(\d|one|two|three|four)[\s_]+)?(bronze|silver|gold)[\s_]+stars?\b/gi;
    let m;
    while((m = re.exec(t)) !== null){
      const n = m[1] ? (Number(m[1]) || words[m[1].toLowerCase()] || 1) : 1;
      const dev = m[2].toLowerCase() === 'gold' ? D.starG : m[2].toLowerCase() === 'silver' ? D.starS : D.starB;
      for(let i = 0; i < n; i++) out.push(dev);
    }
    return out;
  }

  // Stars named by the option: the label when it names any, else the value.
  function starsOf(label, value){
    const fromLabel = starsFromText(label);
    return fromLabel.length ? fromLabel : starsFromText(value);
  }

  function clasps(additional, kind){
    const n = Math.max(0, additional | 0);
    const silver = Math.floor(n / 5), bronze = n % 5;
    const S = kind === 'stars' ? D.starS : kind === 'olc' ? D.olcS : D.claspS;
    const B = kind === 'stars' ? D.starB : kind === 'olc' ? D.olcB : D.claspB;
    return [...Array(silver).fill(S), ...Array(bronze).fill(B)];
  }

  // The most awards (up to `limit`) one ribbon can show with `room` device slots.
  function maxAwardsWith(room, kind, limit){
    let best = 1;
    // The devices `a` awards wear are a silver clasp for each five more than the first and a bronze one for each of the rest (clasps(), of whatever kind), counted here without making them.
    for(let a = 1; a <= limit; a++){ const more = a - 1; if(Math.floor(more / 5) + more % 5 <= room) best = a; }
    return best;
  }

  // Spread a count over ribbons (39-3 6b): the first ribbon is filled first, each extra ribbon is
  // worn to the wearer's left of the one before and counts one award for itself. `firstMax` is the
  // first ribbon's limit on devices (`firstFixed` of them already placed), `max` every later one's.
  function spread(count, kind, firstFixed, firstMax, max){
    const ribbons = [];
    let left = Math.max(1, count | 0);
    let first = true;
    while(left > 0){
      const room = (first ? (firstMax || MAX) - firstFixed : (max || MAX));
      const take = maxAwardsWith(Math.max(0, room), kind, left);
      ribbons.push(take);
      left -= take;
      first = false;
    }
    return ribbons;
  }

  // The ribbons to wear for one selection. Each: { devices: [asset ids, wearer's right first],
  // centered: bool (the first device stays centred, as for a propeller) }.
  function resolve(id, selection){
    return resolveParts(id, selection).map(p => p.why ? p : Object.assign({}, p, { why: explain(id, p.devices) }));
  }

  // What each star or device on a ribbon stands for (CAPR 39-3), aligned with `devices`; '' for a
  // plain clasp. The picker words its device summary from this.
  const STAR_MEANING = {
    commander_commendation_award: { [D.starB]: 'authorized by the region commander', [D.starS]: 'authorized by the National Commander' },
    lifesaving_award: { [D.starS]: 'lifesaving other than blood or organ transport' },
    cap_command_service_ribbon: { [D.starB]: 'group commander', [D.starS]: 'wing commander', [D.starG]: 'region or National commander' },
    national_cadet_competition_ribbon: { [D.starB]: 'region competition winner', [D.starS]: 'national competition sweepstakes winner' },
    national_color_guard_competition_ribbon: { [D.starB]: 'region competition winner', [D.starS]: 'national competition sweepstakes winner' },
    cadet_advisory_council_ribbon: { [D.starB]: 'wing level', [D.starS]: 'region level', [D.starG]: 'national level' },
    cadet_special_activity_ribbon: { [D.starB]: 'additional activity', [D.starS]: 'five additional activities' },
    cap_gill_robb_wilson_ribbon: { [D.starB]: 'Squadron Officer School', [D.starS]: 'Air Command and Staff College', [D.starG]: 'Air War College' },
    cap_paul_e_garber_ribbon: { [D.starB]: 'Squadron Officer School', [D.starS]: 'Air Command and Staff College', [D.starG]: 'Air War College' },
    cap_leadership_ribbon: { [D.starB]: 'senior rating', [D.starS]: 'master rating' }
  };
  function explain(id, devices){
    return (devices || []).map(d => {
      if(d === D.propB) return 'aircrew';
      if(d === D.vS) return 'Presidentially declared disaster';
      if(/^device-years-/.test(d)) return 'years of service';
      return (STAR_MEANING[id] && STAR_MEANING[id][d]) || '';
    });
  }

  // A line under the picker for the ribbons whose counting is not plain "Nth award".
  const HINTS = {
    search_find_ribbon: 'A bronze clasp for each additional distress find, or for each additional 20 non-distress finds. A propeller marks a find made as aircrew (CAPR 39-3, 21d).',
    air_search_and_rescue_ribbon: 'A bronze clasp for each additional 10 sorties; the propeller marks aircrew sorties (CAPR 39-3, 21c).',
    crisis_ribbon: 'One award for each service period; a bronze clasp marks each later one (ICL 21-03, 2).',
    iace_ribbon: 'A bronze clasp marks each later exchange (CAPR 39-3, 6b).',
    afa_award: 'Earned once, for the year as Unit Cadet of the Year; no clasp (CAPR 39-3).',
    afsa_award: 'Earned once, for the year as Unit Cadet of the Year; no clasp (CAPR 39-3).',
    vfw_officer_award: 'Earned once, for the year as Outstanding Cadet Officer of the Year; no clasp (CAPR 39-3).',
    vfw_nco_award: 'Earned once, for the year as Outstanding Cadet NCO of the Year; no clasp (CAPR 39-3).',
    cadet_recruiter_ribbon: 'Two recruits earn the ribbon; a bronze clasp for each additional two, and a silver clasp replaces five (CAPR 39-3, 21k(1)).',
    cap_senior_recruiter_ribbon: 'Seven recruits earn the ribbon; a bronze clasp for each additional ten, and a silver clasp replaces five (CAPR 39-3, 21k(2)).',
    national_commanders_citation: 'Worn in the place of the Gill Robb Wilson Award: one of the two, not both (CAPR 39-3, Attachment 2, Note 2).',
    cap_gill_robb_wilson_ribbon: 'Worn in the place of the National Commander\'s Citation: one of the two, not both (CAPR 39-3, Attachment 2).'
  };
  function hint(id){ return HINTS[id] || ''; }

  function deviceName(d){
    let m;
    if((m = /^device-years-(\d+)$/.exec(d))) return m[1] + '-year numeral';
    if(d === D.vS) return 'silver V';
    if(d === D.propB) return 'propeller';
    if((m = /^(?:mil-)?device-(clasp|star|olc)-(bronze|silver|gold)$/.exec(d))) return m[2] + ' ' + (m[1] === 'olc' ? 'oak leaf cluster' : m[1]);
    return d.replace(/^(?:mil-)?device-/, '').replace(/-/g, ' ');
  }

  // One line saying what a selection wears: "Devices: silver star (Cadet Officer School)". A second
  // ribbon is listed on its own.
  function describe(id, selection){
    const parts = resolve(id, selection);
    const say = p => {
      if(!p.devices.length) return 'no devices';
      const runs = [];
      p.devices.forEach((d, i) => {
        const text = deviceName(d) + (p.why[i] ? ` (${p.why[i]})` : '');
        const last = runs[runs.length - 1];
        if(last && last.text === text) last.n++; else runs.push({ text, n: 1 });
      });
      return runs.map(r => r.n > 1 ? `${r.n} ${r.text.replace(/^(\S+ \S+?)(?= \(|$)/, '$1s')}` : r.text).join(', ');
    };
    if(parts.length === 1) return parts[0].devices.length ? 'Devices: ' + say(parts[0]) : 'Basic ribbon, no devices';
    return parts.map((p, i) => `Ribbon ${i + 1}: ${say(p)}`).join('; ');
  }

  function resolveParts(id, selection){
    const sel = selection || {};
    const value = String(sel.awardValue || '');
    const label = String(sel.awardLabel || '');
    const text = value + ' ' + label;
    const fam = FAMILIES[id];
    const one = devices => [{ devices, centered: false }];
    if(!fam) return one([]);
    // Awarded once: a single ribbon, no devices, whatever count a saved selection carries.
    if(fam.once) return one([]);

    switch(fam.devices){
      case 'years': {
        const m = /(\d+)\s*years?/i.exec(label) || /years_(\d+)/.exec(value);
        const years = m ? Number(m[1]) : 2;
        // 21b: a bronze clasp at 5, 10 and 15 years; from 20 years the longevity numeral alone, centred.
        if(years >= 20){
          const rounded = Math.min(75, Math.floor(years / 5) * 5);
          return [{ devices: ['device-years-' + rounded], centered: true }];
        }
        return one(Array(Math.min(3, Math.floor(years / 5))).fill(D.claspB));
      }
      case 'pme': {
        const s = starsOf(label, value);
        // 15e/15f: only one PME star on the ribbon.
        return one(s.length ? [s.sort(byMetal)[0]] : []);
      }
      case 'command': {
        // 21a: group bronze, wing silver, region gold, National Commander two gold.
        if(/national/i.test(text)) return one([D.starG, D.starG]);
        if(/region/i.test(text)) return one([D.starG]);
        if(/wing/i.test(text)) return one([D.starS]);
        if(/group/i.test(text)) return one([D.starB]);
        return one(starsOf(label, value));
      }
      case 'starList': {
        const s = starsOf(label, value);
        if(!s.length){
          // CAC levels (21j): wing bronze, region silver, national gold.
          if(/national/i.test(text)) s.push(D.starG);
          else if(/region/i.test(text)) s.push(D.starS);
          else if(/wing/i.test(text) && id === 'cadet_advisory_council_ribbon') s.push(D.starB);
        }
        return one(s.sort(byMetal).slice(0, MAX));
      }
      case 'cadet': {
        // 14h: the Goddard ribbon takes a silver star for the Model Rocketry Badge. 14j: the Mitchell
        // takes a silver star for COS; only senior members may move it to a higher cadet ribbon.
        // Honor credit (achievements 1-8, a silver star on the ribbon as on the vendor ribbons and the
        // eServices cadet report) is not in the 2012 text of CAPR 39-3, which is silent on it.
        const devices = [], why = [];
        const honor = HONOR_CREDIT_RIBBONS.has(id) &&
          (sel.honorCredit || /honor_credit|earned_both_devices/.test(value) || /honor credit/i.test(label));
        // The page sets the value when the Model Rocketry Badge is chosen and the Mitchell is earned (syncGoddardRocketryStar), so the value alone says it.
        const rocketry = id === 'goddard_achievement' &&
          (/rocketry/i.test(text) || /earned_(both_)?devices?$/.test(value));
        const cosAllowed = id === 'mitchell_award' || (sel.membership !== 'cadet' && COS_MOVES_TO.has(id));
        if(honor){ devices.push(D.starS); why.push('honor credit'); }
        if(rocketry){ devices.push(D.starS); why.push('Model Rocketry Badge'); }
        if(cosAllowed && /cos/i.test(text)){
          devices.push(D.starS);
          why.push(id === 'mitchell_award' ? 'Cadet Officer School' : 'Cadet Officer School, moved from the Mitchell');
        }
        return [{ devices, centered: false, why }];
      }
      case 'recruiter': {
        // 21k: bronze clasp per `step` additional recruits; a silver clasp replaces five and then
        // bronze clasps are no longer worn; another silver per `silverStep`.
        const m = /([\d,]+)\s*(?:recruits|members)/i.exec(label);
        let recruits = m ? num(m[1]) : null;
        if(recruits == null){
          const c = readCount(id, value, label) || 1;
          recruits = fam.first + (c - 1) * fam.step;
        }
        const additional = Math.max(0, Math.floor((recruits - fam.first) / fam.step));
        if(additional < 5) return one(Array(additional).fill(D.claspB));
        const silverAt = fam.first + 5 * fam.step;
        const silver = Math.min(MAX, 1 + Math.floor((recruits - silverAt) / fam.silverStep));
        return one(Array(silver).fill(D.claspS));
      }
      default: break;
    }

    // Repeated awards with clasps (or stars/oak leaf clusters), plus their modifiers.
    const kind = fam.devices;
    let count = readCount(id, value, label);
    if(count == null){
      // Old saved selections stored a devices map: one award per bronze, five per silver.
      const dv = sel.devices || {};
      const s = (dv['1_Silver_Star_Device'] || 0), b = (dv['1_Bronze_Star_Device'] || 0);
      count = 1 + 5 * s + b;
    }
    // "+ Additional Ribbon" options describe the clasps on the first ribbon and one more plain one.
    // When the label states only the devices on the first ribbon, the extra ribbon adds one award.
    if(/plus_base|additional (?:lifesaving )?ribbon/i.test(text) && !/capub_total|mcchord/.test(value) && !statesTotal(id, label)){
      count += 1;
    }

    // The most devices on one ribbon of this award: 39-3 6b's four, or the lower limit its own paragraph states.
    const limit = fam.max || MAX;
    if(fam.propeller && /prop|aircrew/i.test(text)){
      // 21c(3)/21d(4): propeller centred, first clasp halfway to the wearer's left edge, second
      // opposite; more than three devices means a second ribbon.
      const parts = spread(count, kind, 1, 3, limit);
      return parts.map((awards, i) => i === 0
        ? { devices: [D.propB, ...clasps(awards - 1, kind)], centered: true }
        : { devices: clasps(awards - 1, kind), centered: false });
    }
    if(fam.lifesavingStar && /star/i.test(text)){
      // 9h: silver star centred, at most two clasps beside it.
      const parts = spread(count, kind, 1, limit, limit);
      return parts.map((awards, i) => i === 0
        ? { devices: [D.starS, ...clasps(awards - 1, kind)], centered: true }
        : { devices: clasps(awards - 1, kind), centered: false });
    }
    const lead = [];
    if(fam.v && /v[-_ ]device|silver_v|silver v|w\/v/i.test(text)) lead.push(D.vS); // 21g: one V; clasps follow on its left
    if(fam.levelStars){
      // 9f: region bronze star and/or National silver star, to the wearer's right of any clasps.
      const both = /region\s*\+\s*natl|national_region|national \+ region/i.test(text);
      if(both || /national/i.test(text)) lead.push(D.starS);
      if(both || /region/i.test(text)) lead.push(D.starB);
    }
    const parts = spread(count, kind, lead.length, limit, limit);
    return parts.map((awards, i) => ({ devices: i === 0 ? [...lead, ...clasps(awards - 1, kind)] : clasps(awards - 1, kind), centered: false }));
  }

  function byMetal(a, b){
    const order = [D.starG, D.starS, D.starB];
    return order.indexOf(a) - order.indexOf(b);
  }

  // The Commander's Commendation's two star switches (CAPR 39-3, 9f): a bronze star when the region commander authorized the award, a silver star when the National Commander did, and with
  // several awards "only one bronze or silver star (one star of each type) will be worn", so both stars together are allowed from the second award on (one award has one authority).
  // The general limit of devices is 6b: at most four on a ribbon (the stars count), then a second ribbon to the wearer's left that counts as one subsequent award; `resolve` places them.
  // What turning the second star on does while the count is one is decided here and only here: 'raise' makes the count two (the dropdown shows it), 'swap' turns the first star off.
  const SECOND_STAR_AT_ONE = 'raise';
  // The count and the facts on after a press of the switch `key`: { count, flags } from the count now (a number) and the keys on now.
  function pressStar(count, have, key, mode = SECOND_STAR_AT_ONE){
    const flags = new Set(have);
    if(flags.has(key)){ flags.delete(key); return { count, flags }; }
    flags.add(key);
    if(flags.size > 1 && count < 2){
      if(mode === 'swap'){ flags.clear(); flags.add(key); return { count, flags }; }
      return { count: 2, flags };
    }
    return { count, flags };
  }
  // The facts that stay on when the count falls to one: one award has one authority, so both stars cannot stay, and the higher, the National star, is the one kept.
  function starsAtCount(count, flags){
    const on = new Set(flags);
    if(count < 2 && on.has('national') && on.has('region')) on.delete('region');
    return on;
  }

  // ---- the controls under a chosen ribbon -------------------------------------------------------------------------------------------------
  // The choices of a ribbon (its option list in js/galleries.js, which saved setups and the report import keep using) read as one dropdown for how many awards and one switch for each
  // separate fact: the option list spells out combinations ("2nd with Star", "Earned with Honor Credit"), and a combination is a count and the facts on it. `controls` splits an option
  // into its count and its facts and gives back, for every control, the option a press stores, so the stored values are the ones they always were.
  const MODS = {
    lifesaving_award: [{ key: 'star', label: 'Silver star', device: D.starS, title: 'A silver star for lifesaving other than blood or organ transport (CAPR 39-3, 9h).', test: o => /with Star/i.test(o.label), strip: /\s+with Star/i }],
    commander_commendation_award: [
      { key: 'region', label: 'Region commander star', device: D.starB, title: 'A bronze star when the region commander authorized it (CAPR 39-3, 9f).', test: o => /\((?:Region Cmdr|Region\+Natl)\)/i.test(o.label), strip: /\s*\((?:Region Cmdr|Region\+Natl)\)/i },
      { key: 'national', label: 'National commander star', device: D.starS, title: 'A silver star when the National Commander authorized it (CAPR 39-3, 9f).', test: o => /\((?:National Cmdr|Region\+Natl)\)/i.test(o.label), strip: /\s*\((?:National Cmdr|Region\+Natl)\)/i }
    ],
    search_find_ribbon: [{ key: 'aircrew', label: 'Aircrew', device: D.propB, title: 'A propeller marks a find made as aircrew (CAPR 39-3, 21d).', test: o => /w\/Prop|\(Aircrew\)/i.test(o.label), strip: /\s+w\/Prop|\s+\(Aircrew\)/i }],
    air_search_and_rescue_ribbon: [{ key: 'aircrew', label: 'Aircrew', device: D.propB, title: 'The propeller marks aircrew sorties (CAPR 39-3, 21c).', test: o => /w\/Prop|\(Aircrew\)/i.test(o.label), strip: /\s+w\/Prop|\s+\(Aircrew\)/i }],
    disaster_relief_ribbon: [{ key: 'v', label: 'V device', device: D.vS, title: 'A V device marks a Presidentially declared disaster (CAPR 39-3, 21g).', test: o => /V-Device/i.test(o.label), strip: /\s+(?:w\/|with )V-Device/i }]
  };
  function modsFor(id){
    const fam = FAMILIES[id] || {};
    if(MODS[id]) return MODS[id];
    if(HONOR_CREDIT_RIBBONS.has(id)){
      const out = [{ key: 'honor', label: 'Honor credit', device: D.starS, title: 'A silver star for honor credit.', test: o => /honor_credit/.test(o.value) }];
      // The Goddard's silver star for the Model Rocketry Badge, for a cadet who has earned the Mitchell (CAPR 39-3, 14h): a switch of its own, shown while the Mitchell is earned.
      if(id === 'goddard_achievement') out.push({ key: 'rocketry', label: 'Model rocketry', device: D.starS, title: 'A silver star for the Model Rocketry Badge, for a cadet who has earned the Mitchell (CAPR 39-3, 14h).', test: o => /rocketry/.test(o.value) });
      return out;
    }
    if(fam.devices === 'cadet' && (id === 'mitchell_award' || COS_MOVES_TO.has(id))){
      return [{ key: 'cos', label: id === 'mitchell_award' ? 'Cadet Officer School star' : 'Cadet Officer School star, moved', device: D.starS,
        title: 'A silver star on the Mitchell shows Cadet Officer School; a senior member who wears the highest cadet ribbon may move it there (CAPR 39-3, 14j).', test: o => o.value === 'earned_cos_star' }];
    }
    return [];
  }

  const LOWER_WORDS = /\b(Award|Hours|Sorties|Flights|Activities|Encampments|Years|Members|Stars?|Level)\b/g;
  const sentenceCase = t => { const x = String(t || '').replace(LOWER_WORDS, w => w.toLowerCase()); return x.charAt(0).toUpperCase() + x.slice(1); };
  const plural = (name, n) => n > 1 ? `${n} ${name}s` : name;
  // Devices in words, "silver clasp, 3 bronze clasps": the same names the picker's summary has always used.
  function deviceWords(devices){ return militaryWords((devices || []).map(deviceName).join(' + ')); }
  // What one dropdown line says about its option: the count, then the devices the rule gives it, "2nd award: bronze clasp". A count that needs a second ribbon says so.
  // The count alone, for the closed dropdown: "6th", "120", "1,320"; the unit is in the line under it.
  function countOf(name){ const m = /^([\d,]+(?:st|nd|rd|th)?)\b/i.exec(name); return m ? m[1] : name; }
  // A military award's devices from its label ("Silver Oak Leaf Cluster + Silver Oak Leaf Cluster + Bronze Oak Leaf Cluster"), counted, highest first: "2 silver and 1 bronze oak leaf
  // clusters", "4 silver oak leaf clusters", "Silver star, bronze oak leaf cluster".
  function militaryWords(text){
    const items = String(text || '').split(/\s\+\s/).map(t => t.trim()).filter(Boolean);
    if(!items.length) return '';
    const runs = [];
    for(const t of items){ const last = runs[runs.length - 1]; if(last && last.t === t) last.n++; else runs.push({ t, n: 1 }); }
    const parse = r => { const m = /^(bronze|silver|gold)\s+(.+)$/i.exec(r.t); return m ? { metal: m[1].toLowerCase(), noun: m[2] } : { metal: '', noun: r.t }; };
    const info = runs.map(parse);
    const plural = (noun, n) => n > 1 ? noun.replace(/(\S+)$/, '$1s') : noun;
    if(runs.length > 1 && info.every(i => i.metal && i.noun === info[0].noun)){
      const total = runs.reduce((a, r) => a + r.n, 0);
      return runs.map(r => `${r.n > 1 || runs.some(x => x.n > 1) ? r.n + ' ' : ''}${parse(r).metal}`).join(' and ') + ' ' + plural(info[0].noun, total);
    }
    return runs.map((r, i) => r.n > 1 ? `${r.n} ${plural(info[i].metal ? info[i].metal + ' ' + info[i].noun : info[i].noun, r.n)}` : r.t).join(', ');
  }
  function linePieces(id, opt, ctx, drop, strip){
    const fam = FAMILIES[id] || {};
    const label = (strip || []).reduce((t, re) => t.replace(re, ''), String(opt.label || ''));
    if(ctx.military){
      const [head, ...rest] = label.split(/\s-\s/);
      const name = sentenceCase(head), devs = militaryWords(rest.join(' - ').toLowerCase());
      // The line under the dropdown is what is worn for the count; a first award with nothing on it has nothing to say.
      return { short: countOf(name), words: sentenceCase(devs), text: sentenceCase(label.replace(/\s-\s/g, ': ')) };
    }
    const counted = fam.devices === 'clasps' || fam.devices === 'stars' || fam.devices === 'olc';
    // What the count is of: an award, or the thing the ribbon counts (an encampment, an activity); hours, years and the rest carry their unit in the label.
    const noun = { encampment_ribbon: 'encampment', cadet_special_activity_ribbon: 'activity' }[id] || 'award';
    const name = counted && /^Basic\b/i.test(label) ? `1st ${noun}` : sentenceCase(label).replace(/ award$/, ` ${noun}`);
    const parts = resolve(id, { awardValue: opt.value, awardLabel: opt.label, membership: ctx.membership });
    // A count that only has options with a switch on (the finds past the 21st with the propeller) is worded without that switch's device.
    for(const d of drop || []){ const at = parts[0].devices.indexOf(d); if(at >= 0) parts[0] = Object.assign({}, parts[0], { devices: parts[0].devices.filter((x, i) => i !== at) }); }
    // A second ribbon needs no list of what each carries: the picture shows it.
    const many = parts.length > 1 ? `${parts.length} ribbons` : '';
    const devs = many || deviceWords(parts[0].devices);
    const single = /^(bronze|silver|gold) star$/i.exec(name), combo = /^([bsg](?:-[bsg])+) stars?$/i.exec(name);
    // A counted ribbon: the closed dropdown says what the count is of in the fewest true words, an award or the ribbon's own thing (an encampment, an activity) by its number, a quantity
    // with its unit ("5 years", "120 hours", "10 sorties"); the open list has the full line, the count and what is worn for it.
    const countedRibbon = counted || !!fam.per || fam.devices === 'years' || fam.devices === 'recruiter';
    const unitShown = fam.devices === 'years' || !!(fam.per && (fam.per.hour || fam.per.sortie));   // flights and recruits by their number: the ribbon's name says what they are, and the unit would not fit a phone's narrow tile
    let short = name, words = devs;
    if(countedRibbon){ short = unitShown ? name.replace(/ recruited$/, '') : countOf(name); words = / award$/.test(name) ? devs : (devs ? `${name}: ${devs}` : name); }
    else if(single) short = sentenceCase(single[1]);
    else if(combo) short = combo[1].toUpperCase();
    else if(/^\d+ (?:bronze|silver|gold) stars$/i.test(name)) short = name.replace(/^(\d+) (\w)\w+ stars$/i, (m, n, c) => Array(Number(n)).fill(c.toUpperCase()).join('-'));
    short = short.replace(/ level$/, '').replace(/\/CC$/, '').replace(/^Basic award$/, 'Basic');   // "National level" under the Cadet Advisory Council's own name is "National"
    words = sentenceCase(words);
    const star = !!(single || combo);
    const text = !devs ? name : star ? sentenceCase(devs) : `${name}: ${devs}`;
    return { short, words, text };
  }
  function lineText(id, opt, ctx, drop, strip){ return linePieces(id, opt, ctx, drop, strip).text; }

  // The controls of ribbon `id` with its option list `options`, the selection's own option `current` and ctx { membership, military }:
  //   lines   [{ value, text, short, words, enabled, id }]  `short` is the count alone (what the closed dropdown shows), `words` the devices in words, `text` both  one per count, each the option a pick stores (the facts now on stay on where an option for them exists; `enabled` is false where none does)
  //   selected  the line the selection is on
  //   toggles [{ key, label, device, title, on, next }]  one per separate fact; `next` is the option a press stores, null where no option has that combination
  //   label   what the dropdown counts, for assistive technology ('Number of awards', 'Hours', 'Years of service', 'Level')
  function controls(id, options, current, ctx){
    const c = ctx || {}, fam = FAMILIES[id] || {};
    const real = (options || []).filter(o => o && o.value);
    const cur = current || real[0] || null;
    const mods = c.military ? [] : modsFor(id).filter(m => real.some(o => m.test(o)));
    const flagsOf = o => mods.filter(m => m.test(o)).map(m => m.key).sort();
    const identity = o => {
      if(c.military) return o.value;
      if(fam.devices === 'cadet') return '1';
      const n = readCount(id, o.value, String(o.label || ''));
      return String(n == null ? o.value : n);
    };
    // Each option once: its count, its facts, and the first option of every count-and-facts pair.
    const info = new Map(), first = new Map();
    for(const o of real){
      const rec = { idn: identity(o), key: flagsOf(o).join('+') };
      info.set(o, rec);
      const k = rec.idn + '\u0001' + rec.key;
      if(!first.has(k)) first.set(k, o);
    }
    const find = (idn, flags) => first.get(idn + '\u0001' + flags);
    const curId = cur ? (info.get(cur) || { idn: identity(cur) }).idn : '', curKey = cur ? (info.get(cur) || { key: flagsOf(cur).join('+') }).key : '';
    const lines = [], seen = new Set();
    const keyAt = idn => fam.levelStars && curKey ? [...starsAtCount(Number(idn), curKey.split('+'))].sort().join('+') : curKey;
    for(const o of real){
      const idn = info.get(o).idn;
      if(seen.has(idn)) continue;
      const base = find(idn, '') || o, kept = find(idn, keyAt(idn));
      seen.add(idn);
      const piece = linePieces(id, base, c, mods.filter(m => m.device && m.test(base)).map(m => m.device), mods.filter(m => m.strip && m.test(base)).map(m => m.strip));
      lines.push({ value: (kept || base).value, text: piece.text, short: piece.short, words: piece.words, enabled: !!kept, id: idn });
    }
    let selected = (lines.find(l => l.id === curId) || {}).value || '';
    if(!selected && cur && lines.length){ const piece = linePieces(id, cur, c); lines.unshift({ value: cur.value, text: piece.text, short: piece.short, words: piece.words, enabled: true, id: curId }); selected = cur.value; }
    const have = new Set(cur ? flagsOf(cur) : []);
    const toggles = mods.filter(m => !m.hidden).map(m => {
      let next = new Set(have), at = curId;
      if(fam.levelStars){ const p = pressStar(Number(curId) || 1, have, m.key); next = p.flags; at = String(p.count); }
      else if(next.has(m.key)) next.delete(m.key); else next.add(m.key);
      const target = find(at, [...next].sort().join('+'));
      return { key: m.key, label: m.label, device: m.device, title: m.title, on: have.has(m.key), next: target ? target.value : null };
    });
    const unit = fam.per ? { hour: 'Hours', sortie: 'Sorties', flight: 'Flights', find: 'Finds', encampment: 'Encampments', activit: 'Activities' }[Object.keys(fam.per)[0]] : '';
    const label = c.military || ['clasps', 'stars', 'olc'].includes(fam.devices) ? (unit || 'Number of awards') : fam.devices === 'years' ? 'Years of service' : fam.devices === 'recruiter' ? 'Members recruited' : 'Level';
    return { lines, selected, toggles, label };
  }

  return { DEVICES: D, controls, pressStar, starsAtCount, deviceWords, lineText, FAMILIES, HONOR_CREDIT_RIBBONS, resolve, describe, explain, hint, readCount, starsFromText, spread, clasps };
});
