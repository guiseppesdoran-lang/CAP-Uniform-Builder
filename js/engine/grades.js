// Uniform engine: what a member's grade means for the insignia they wear.
(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else { root.CAPUBEngine = root.CAPUBEngine || {}; root.CAPUBEngine.grades = api; }
})(typeof self !== 'undefined' ? self : this, function(){
  'use strict';

  // Builder rank labels -> asset grade keys and categories.
  const SENIOR = {
    'SM': { key: null, category: 'senior-none' },
    'SSgt': { key: 'staff-sergeant', category: 'senior-nco' },
    'TSgt': { key: 'technical-sergeant', category: 'senior-nco' },
    'MSgt': { key: 'master-sergeant', category: 'senior-nco' },
    'SMSgt': { key: 'senior-master-sergeant', category: 'senior-nco' },
    'CMSgt': { key: 'chief-master-sergeant', category: 'senior-nco' },
    'FO': { key: 'flight-officer', category: 'flight-officer' },
    'TFO': { key: 'technical-flight-officer', category: 'flight-officer' },
    'SFO': { key: 'senior-flight-officer', category: 'flight-officer' },
    '2d Lt': { key: 'second-lieutenant', category: 'senior-officer' },
    '1st Lt': { key: 'first-lieutenant', category: 'senior-officer' },
    'Capt': { key: 'captain', category: 'senior-officer' },
    'Maj': { key: 'major', category: 'senior-officer' },
    'Lt Col': { key: 'lieutenant-colonel', category: 'senior-officer' },
    'Col': { key: 'colonel', category: 'senior-officer' },
    'Brig Gen': { key: 'brigadier-general', category: 'general' },
    'Maj Gen': { key: 'major-general', category: 'general' }
  };
  const CADET = {
    'C/AB': { key: null, category: 'cadet-basic' },
    'C/Amn': { key: 'airman', category: 'cadet-nco' },
    'C/A1C': { key: 'airman-first-class', category: 'cadet-nco' },
    'C/SrA': { key: 'senior-airman', category: 'cadet-nco' },
    'C/SSgt': { key: 'staff-sergeant', category: 'cadet-nco' },
    'C/TSgt': { key: 'technical-sergeant', category: 'cadet-nco' },
    'C/MSgt': { key: 'master-sergeant', category: 'cadet-nco' },
    'C/SMSgt': { key: 'senior-master-sergeant', category: 'cadet-nco' },
    'C/CMSgt': { key: 'chief-master-sergeant', category: 'cadet-nco' },
    'C/2d Lt': { key: 'second-lieutenant', category: 'cadet-officer' },
    'C/1st Lt': { key: 'first-lieutenant', category: 'cadet-officer' },
    'C/Capt': { key: 'captain', category: 'cadet-officer' },
    'C/Maj': { key: 'major', category: 'cadet-officer' },
    'C/Lt Col': { key: 'lieutenant-colonel', category: 'cadet-officer' },
    'C/Col': { key: 'colonel', category: 'cadet-officer' }
  };
  const FIRST_SERGEANT_GRADES = new Set(['master-sergeant', 'senior-master-sergeant', 'chief-master-sergeant']);

  // { cadet, key, category, officer, nco, general, firstSergeant, label }
  function gradeInfo(membership, rank, opts){
    const o = opts || {};
    const isCadet = membership === 'cadet' || /^C\//.test(String(rank || ''));
    const table = isCadet ? CADET : SENIOR;
    const hit = table[rank] || { key: null, category: isCadet ? 'cadet-basic' : 'senior-none' };
    const category = hit.category;
    return {
      cadet: isCadet,
      rank: rank || '',
      key: hit.key,
      category,
      officer: category === 'cadet-officer' || category === 'senior-officer' || category === 'general' || category === 'flight-officer',
      nco: category === 'cadet-nco' || category === 'senior-nco',
      general: category === 'general',
      firstSergeant: !!o.firstSergeant && isCadet && FIRST_SERGEANT_GRADES.has(hit.key),
      // Adults without grade wear the uniform of the grade they are working toward (1.4.1, 1.4.2).
      track: category === 'senior-none' ? (o.track === 'nco' ? 'nco' : 'officer') : null
    };
  }

  // Asset ids for the grade insignia in a given form. Returns null when the grade wears none.
  function cadetNcoChevron(g, form){
    if(!g.key) return null;
    const fs = g.firstSergeant ? '-first-sergeant' : '';
    return `rank-cadet-nco-${g.key}${fs}-${form}`; // form: metal | cloth-bordered | ocp-square
  }
  function cadetOfficerInsignia(g, form){
    if(!g.key) return null;
    return `rank-cadet-officer-${g.key}-${form}`; // metal-regular | metal-miniature | cloth-bordered-regular | ocp-square ...
  }
  // Senior officer grade in a form: thread | cloth-bordered | ocp-square | bullion. Generals take
  // the 1 in stars; the Maj Gen pair is stacked (vertical) or side by side (horizontal).
  function seniorOfficerInsignia(g, form, opts){
    if(!g.key) return null;
    if(g.key === 'brigadier-general') return form === 'bullion' ? 'rank-senior-brigadier-general-bullion' : `rank-senior-brigadier-general-1in-${form}`;
    if(g.key === 'major-general'){
      if(form === 'bullion') return 'rank-senior-major-general-bullion';
      const dir = (opts && opts.horizontal) ? 'horizontal' : 'vertical';
      return `rank-senior-major-general-1in-${dir}-${form}`;
    }
    return `rank-senior-${g.key}-${form}`;
  }
  function seniorChevron(g, opts){
    if(!g.key || g.category !== 'senior-nco') return null;
    const white = opts && opts.white ? 'white-' : '';
    const size = (opts && opts.size === '3.5') ? '3p5in' : '4in';
    return `rank-senior-${g.key}-chevron-${white}${size}`;
  }

  return { SENIOR, CADET, gradeInfo, cadetNcoChevron, cadetOfficerInsignia, seniorOfficerInsignia, seniorChevron };
});
