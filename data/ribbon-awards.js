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
  const MAX = 4; // 39-3 6b

  // How each ribbon counts. unit: how the option labels count (awards, or N sorties per award).
  // devices: 'clasps' (bronze per additional, silver = five), 'stars' (same with stars), 'olc'.
  const FAMILIES = {
    distinguished_service_award: { devices: 'clasps' },
    exceptional_service_award: { devices: 'clasps' },
    meritorious_service_award: { devices: 'clasps' },
    cap_achievment_award: { devices: 'clasps' },
    national_commander_unit_citation_award: { devices: 'clasps' },
    unit_citation_award: { devices: 'clasps' },
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
    lifesaving_award: { devices: 'clasps', lifesavingStar: true },
    cadet_recruiter_ribbon: { devices: 'recruiter', first: 2, step: 2, silverStep: 10 },
    cap_senior_recruiter_ribbon: { devices: 'recruiter', first: 7, step: 10, silverStep: 50 },
    Air_Force_Organizational_Excellence_Award: { devices: 'olc' },
    air_force_aerial_achievement_medal: { devices: 'olc' },
    air_medal: { devices: 'olc' },
    silver_medal_of_valor: { devices: 'separate' },
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
    for(let a = 1; a <= limit; a++) if(clasps(a - 1, kind).length <= room) best = a;
    return best;
  }

  // Spread a count over ribbons (39-3 6b): the first ribbon is filled first, each extra ribbon is
  // worn to the wearer's left of the one before and counts one award for itself.
  function spread(count, kind, firstFixed, firstMax){
    const ribbons = [];
    let left = Math.max(1, count | 0);
    let first = true;
    while(left > 0){
      const room = (first ? (firstMax || MAX) - firstFixed : MAX);
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
    const sel = selection || {};
    const value = String(sel.awardValue || '');
    const label = String(sel.awardLabel || '');
    const text = value + ' ' + label;
    const fam = FAMILIES[id];
    const one = devices => [{ devices, centered: false }];
    if(!fam) return one([]);

    switch(fam.devices){
      case 'separate': {
        const m = /silver_valor_(\d)/.exec(value) || /(\d)\s+Silver Medals?/i.exec(label);
        const n = Math.max(1, Number(m && m[1]) || readCount(id, value, label) || 1);
        return Array.from({ length: n }, () => ({ devices: [], centered: false }));
      }
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
        // No other cadet achievement ribbon wears a device (there is no honor credit device).
        const devices = [];
        const rocketry = id === 'goddard_achievement' &&
          (/rocketry/i.test(text) || sel.rocketryCredit || /earned_(both_)?devices?$/.test(value));
        const cosAllowed = id === 'mitchell_award' || (sel.membership !== 'cadet' && COS_MOVES_TO.has(id));
        if(rocketry) devices.push(D.starS);
        if(cosAllowed && /cos/i.test(text)) devices.push(D.starS);
        return one(devices);
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

    if(fam.propeller && /prop|aircrew/i.test(text)){
      // 21c(3)/21d(4): propeller centred, first clasp halfway to the wearer's left edge, second
      // opposite; more than three devices means a second ribbon.
      const parts = spread(count, kind, 1, 3);
      return parts.map((awards, i) => i === 0
        ? { devices: [D.propB, ...clasps(awards - 1, kind)], centered: true }
        : { devices: clasps(awards - 1, kind), centered: false });
    }
    if(fam.lifesavingStar && /star/i.test(text)){
      // 9h: silver star centred, at most two clasps beside it.
      const parts = spread(count, kind, 1, 3);
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
    const parts = spread(count, kind, lead.length, MAX);
    return parts.map((awards, i) => ({ devices: i === 0 ? [...lead, ...clasps(awards - 1, kind)] : clasps(awards - 1, kind), centered: false }));
  }

  function byMetal(a, b){
    const order = [D.starG, D.starS, D.starB];
    return order.indexOf(a) - order.indexOf(b);
  }

  return { DEVICES: D, FAMILIES, resolve, readCount, starsFromText, spread, clasps };
});
