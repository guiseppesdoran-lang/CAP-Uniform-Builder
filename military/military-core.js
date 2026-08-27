(function militaryCoreModule(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.CAPUBMilitary = Object.assign(root.CAPUBMilitary || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  'use strict';

  const ORGANIZATIONS = Object.freeze([
    'ARMY', 'MARINE_CORPS', 'NAVY', 'AIR_FORCE', 'SPACE_FORCE', 'COAST_GUARD', 'CAP'
  ]);
  const COMPONENTS = Object.freeze(['ACTIVE', 'RESERVE', 'NATIONAL_GUARD']);
  const VERIFICATION_STATUSES = Object.freeze([
    'DISCOVERED', 'CROSS_REFERENCED', 'OFFICIALLY_VERIFIED', 'CONFLICT', 'UNVERIFIED', 'PENDING'
  ]);
  const AWARD_STATUSES = Object.freeze([
    'CURRENT', 'HISTORICAL', 'OBSOLETE_BUT_WEARABLE', 'FOREIGN', 'UNKNOWN'
  ]);

  const DEFAULT_CATEGORY_ORDER = Object.freeze([
    'MEDAL_OF_HONOR', 'SERVICE_CROSS', 'DISTINGUISHED_SERVICE', 'VALOR',
    'SUPERIOR_SERVICE', 'LEGION_OF_MERIT', 'DISTINGUISHED_FLYING_CROSS',
    'HEROISM', 'BRONZE_STAR', 'PURPLE_HEART', 'MERITORIOUS_SERVICE',
    'AIR_MEDAL', 'COMMENDATION', 'ACHIEVEMENT', 'PRISONER_OF_WAR',
    'GOOD_CONDUCT', 'UNIT_AWARD', 'CAMPAIGN', 'EXPEDITIONARY', 'SERVICE',
    'RESERVE', 'TRAINING', 'FOREIGN_DECORATION', 'FOREIGN_UNIT_AWARD',
    'FOREIGN_SERVICE_MEDAL', 'STATE_NATIONAL_GUARD', 'CAP', 'UNKNOWN'
  ]);

  const SERVICE_ALIASES = Object.freeze({
    US_ARMY:'ARMY', ARMY_NATIONAL_GUARD:'ARMY',
    USMC:'MARINE_CORPS', MARINES:'MARINE_CORPS',
    US_NAVY:'NAVY', USAF:'AIR_FORCE', USSF:'SPACE_FORCE',
    USCG:'COAST_GUARD', CIVIL_AIR_PATROL:'CAP'
  });

  function normalizeService(value){
    const key = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return SERVICE_ALIASES[key] || key;
  }

  function slugify(value){
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\bmilitary\s+ribbon\b/g, ' ')
      .replace(/\bribbon\b$/g, ' ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/commedation/g, 'commendation')
      .replace(/achievment/g, 'achievement');
  }

  function normalizeName(value){
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\bMilitary Ribbon\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function unique(values){
    return [...new Set((values || []).filter(Boolean))];
  }

  function precedenceRecord(award, service){
    const serviceKey = normalizeService(service);
    const raw = award?.precedence?.[serviceKey];
    if(Number.isFinite(raw)) return { order:raw, side:'LEFT', verified:false };
    if(raw && Number.isFinite(raw.order)) return raw;
    return null;
  }

  function inferredCategory(award){
    const explicit = String(award?.category || '').trim().toUpperCase();
    if(explicit && explicit !== 'UNKNOWN') return explicit;
    const text = `${award?.id || ''} ${award?.officialName || ''} ${award?.name || ''}`
      .toLowerCase().replace(/[_-]+/g, ' ');
    if(/\bmedal of honor\b/.test(text)) return 'MEDAL_OF_HONOR';
    if(/\b(?:distinguished service|navy|air force|coast guard) cross\b/.test(text)) return 'SERVICE_CROSS';
    if(/\bdistinguished service medal\b/.test(text)) return 'DISTINGUISHED_SERVICE';
    if(/\bsilver star\b/.test(text)) return 'VALOR';
    if(/\bdefense superior service\b/.test(text)) return 'SUPERIOR_SERVICE';
    if(/\blegion of merit\b/.test(text)) return 'LEGION_OF_MERIT';
    if(/\bdistinguished flying cross\b/.test(text)) return 'DISTINGUISHED_FLYING_CROSS';
    if(/\b(?:airman'?s|soldier'?s|navy and marine corps) medal\b/.test(text)) return 'HEROISM';
    if(/\bbronze star\b/.test(text)) return 'BRONZE_STAR';
    if(/\bpurple heart\b/.test(text)) return 'PURPLE_HEART';
    if(/\bmeritorious service\b/.test(text)) return 'MERITORIOUS_SERVICE';
    if(/\bair medal\b/.test(text)) return 'AIR_MEDAL';
    if(/\bcommendation\b/.test(text)) return 'COMMENDATION';
    if(/\bachievement\b/.test(text)) return 'ACHIEVEMENT';
    if(/\bprisoner of war\b/.test(text)) return 'PRISONER_OF_WAR';
    if(/\bgood conduct\b/.test(text)) return 'GOOD_CONDUCT';
    if(/\bunit (?:award|citation|commendation)\b/.test(text)) return 'UNIT_AWARD';
    if(/\bcampaign\b/.test(text)) return 'CAMPAIGN';
    if(/\bexpeditionary\b/.test(text)) return 'EXPEDITIONARY';
    if(/\breserve\b/.test(text)) return 'RESERVE';
    if(/\btraining\b/.test(text)) return 'TRAINING';
    if(/\bservice\b/.test(text)) return 'SERVICE';
    return 'UNKNOWN';
  }

  function minimumKnownPrecedenceOrder(award){
    const orders = Object.values(award?.precedence || {}).map(value =>
      Number.isFinite(value) ? value : value?.order
    ).filter(Number.isFinite);
    return orders.length ? Math.min(...orders) : Number.MAX_SAFE_INTEGER;
  }

  function isCapAward(award){
    const awardClass = String(award?.awardClass || '').trim().toUpperCase();
    const category = String(award?.category || '').trim().toUpperCase();
    const services = (award?.authorizedServices || []).map(normalizeService);
    return awardClass === 'CAP' || category === 'CAP' || (
      services.includes('CAP') && !services.some(service => service !== 'CAP')
    );
  }

  function isAuthorizedForService(award, service, component){
    const serviceKey = normalizeService(service);
    if(serviceKey === 'CAP') return isCapAward(award);

    // A member may have earned federal, service, joint, foreign, or state
    // military awards while serving in another branch. Keep the source-service
    // metadata for precedence and auditing, but do not use it as a catalog
    // visibility restriction. CAP-earned awards remain isolated to CAP.
    return ORGANIZATIONS.includes(serviceKey) && !isCapAward(award);
  }

  function getAwardPrecedence(award, member, uniform){
    const service = normalizeService(member?.organization || member?.service);
    const record = precedenceRecord(award, service);
    const side = record?.side || award?.wearSide?.[service] || 'LEFT';
    const category = inferredCategory(award);
    const categoryIndex = DEFAULT_CATEGORY_ORDER.indexOf(category);
    const medalOfHonor = category === 'MEDAL_OF_HONOR';
    const fallbackOrder = minimumKnownPrecedenceOrder(award);
    return {
      service,
      side,
      uniform:uniform?.id || uniform || null,
      // The Medal of Honor is the senior U.S. military decoration in every
      // service table. Protect that invariant even when an imported
      // service-specific record is missing a table entry (for example USCG).
      sourceOrder:medalOfHonor ? -1 : (
        Number.isFinite(record?.order) ? record.order : fallbackOrder
      ),
      categoryOrder:categoryIndex >= 0 ? categoryIndex : DEFAULT_CATEGORY_ORDER.length,
      name:String(award?.officialName || award?.name || award?.id || ''),
      verified:!!record?.verified,
      known:!!record || Number.isFinite(fallbackOrder)
    };
  }

  function compareAwardsForMember(a, b, member, uniform){
    const pa = getAwardPrecedence(a, member, uniform);
    const pb = getAwardPrecedence(b, member, uniform);
    if(pa.side !== pb.side) return pa.side === 'LEFT' ? -1 : 1;
    if(pa.sourceOrder !== pb.sourceOrder) return pa.sourceOrder - pb.sourceOrder;
    if(pa.categoryOrder !== pb.categoryOrder) return pa.categoryOrder - pb.categoryOrder;
    return pa.name.localeCompare(pb.name);
  }

  function sortAwardsForMember(awards, member, uniform){
    return [...(awards || [])].sort((a,b) => compareAwardsForMember(a,b,member,uniform));
  }

  function deviceDefinition(deviceCatalog, id){
    return (deviceCatalog || []).find(device => device.id === id) || null;
  }

  function expandRepeatDevices(rule, additionalAwards){
    if(additionalAwards <= 0) return [];
    if(rule?.countMapping && Array.isArray(rule.countMapping[String(additionalAwards)])){
      return [...rule.countMapping[String(additionalAwards)]];
    }
    const bronze = rule?.bronzeDevice;
    const silver = rule?.silverDevice;
    const bronzeValue = Number(rule?.bronzeValue || 1);
    const silverValue = Number(rule?.silverValue || 5);
    const devices=[];
    let remaining=additionalAwards;
    if(silver && silverValue > 0){
      while(remaining >= silverValue){ devices.push(silver); remaining -= silverValue; }
    }
    if(bronze && bronzeValue > 0){
      while(remaining >= bronzeValue){ devices.push(bronze); remaining -= bronzeValue; }
    }
    return remaining === 0 ? devices : null;
  }

  function calculateDevices({ award, service, awardCount=1, campaignCount=0, specialAuthorizations=[], deviceCatalog=[] }){
    const serviceKey = normalizeService(service);
    const warnings=[];
    const count = Math.max(1, Math.trunc(Number(awardCount) || 1));
    const serviceRules = award?.devices?.[serviceKey] || award?.deviceRules?.[serviceKey] || null;
    if(!serviceRules){
      if(count > 1) warnings.push(`No verified repeat-award device rule is available for ${award?.name || award?.id} in ${serviceKey}.`);
      return { devices:[], valid:count === 1, warnings };
    }

    const repeatRule = serviceRules.repeatAward || serviceRules;
    const repeats = expandRepeatDevices(repeatRule, count - 1);
    if(repeats === null){
      warnings.push(`Award count ${count} cannot be represented by the configured ${serviceKey} device rule.`);
      return { devices:[], valid:false, warnings };
    }

    const devices=[...repeats];
    if(campaignCount > 0 && serviceRules.campaignParticipation){
      const campaignDevices = expandRepeatDevices(serviceRules.campaignParticipation, Math.trunc(campaignCount));
      if(campaignDevices === null) warnings.push('Campaign participation count cannot be represented by the configured rule.');
      else devices.push(...campaignDevices);
    }
    for(const id of specialAuthorizations || []){
      const allowed = serviceRules.allowedSpecialDevices || [];
      if(!allowed.includes(id)) warnings.push(`${id} is not authorized by the configured rule.`);
      else devices.push(id);
    }

    const unknown = devices.filter(id => deviceCatalog.length && !deviceDefinition(deviceCatalog,id));
    if(unknown.length) warnings.push(`Unknown device definition(s): ${unique(unknown).join(', ')}.`);
    const order = serviceRules.devicePrecedence || [];
    devices.sort((a,b) => {
      const ai=order.indexOf(a), bi=order.indexOf(b);
      if(ai < 0 && bi < 0) return 0;
      if(ai < 0) return 1;
      if(bi < 0) return -1;
      return ai-bi;
    });
    return { devices, valid:warnings.length === 0, warnings };
  }

  function mergeAwardRecords(records){
    const merged = new Map();
    for(const source of records || []){
      if(!source) continue;
      const officialName = normalizeName(source.officialName || source.name || source.sourceName);
      const id = source.canonicalId || source.id || slugify(officialName);
      if(!id) continue;
      const existing = merged.get(id) || {
        id, name:officialName, officialName, aliases:[], type:source.type || 'RIBBON',
        awardClass:source.awardClass || 'FEDERAL_MILITARY', category:source.category || 'UNKNOWN',
        authorizedServices:[], precedence:{}, devices:{}, images:{}, sources:{ catalog:[] },
        verificationStatus:'PENDING', status:'UNKNOWN'
      };
      existing.aliases = unique([...(existing.aliases || []), ...(source.aliases || []), source.sourceName]);
      existing.authorizedServices = unique([...(existing.authorizedServices || []), ...(source.authorizedServices || [])].map(normalizeService));
      existing.precedence = Object.assign({}, existing.precedence, source.precedence || {});
      existing.devices = Object.assign({}, existing.devices, source.devices || source.deviceRules || {});
      existing.images = Object.assign({}, existing.images, source.images || {});
      const catalogs = existing.sources?.catalog;
      existing.sources = Object.assign({}, existing.sources, source.sources || {});
      existing.sources.catalog = unique([...(Array.isArray(catalogs) ? catalogs : [catalogs]), source.sourceUrl, source.sources?.catalog].flat());
      if(source.verificationStatus === 'OFFICIALLY_VERIFIED') existing.verificationStatus = source.verificationStatus;
      if(source.status && source.status !== 'UNKNOWN') existing.status = source.status;
      merged.set(id, existing);
    }
    return [...merged.values()];
  }

  function validateCatalog({ awards=[], devices=[] }){
    const errors=[];
    const warnings=[];
    const ids=new Set();
    const names=new Map();
    const deviceIds=new Set((devices || []).map(device => device.id));
    for(const award of awards || []){
      if(!award?.id){ errors.push('Award missing id.'); continue; }
      if(ids.has(award.id)) errors.push(`Duplicate award id: ${award.id}.`);
      ids.add(award.id);
      const key=String(award.officialName || award.name || '').toLowerCase();
      if(key && names.has(key) && names.get(key) !== award.id) warnings.push(`Duplicate canonical name: ${award.name}.`);
      names.set(key, award.id);
      if(!award.authorizedServices?.length) warnings.push(`${award.id}: missing service authorization.`);
      if(!award.sources?.catalog?.length && !award.sources?.catalog) warnings.push(`${award.id}: missing catalog source.`);
      if(!Object.keys(award.precedence || {}).length) warnings.push(`${award.id}: unknown precedence.`);
      for(const rules of Object.values(award.devices || {})){
        const text=JSON.stringify(rules);
        for(const id of deviceIds){ void id; }
        const refs=[...text.matchAll(/"([A-Z][A-Z0-9_]+)"/g)].map(match => match[1]);
        for(const ref of refs){
          if(/DEVICE|STAR|CLUSTER|NUMERAL|ARROWHEAD|OLC/.test(ref) && !deviceIds.has(ref)) warnings.push(`${award.id}: unknown device reference ${ref}.`);
        }
      }
    }
    return { valid:errors.length === 0, errors:unique(errors), warnings:unique(warnings) };
  }

  return {
    ORGANIZATIONS, COMPONENTS, VERIFICATION_STATUSES, AWARD_STATUSES,
    DEFAULT_CATEGORY_ORDER, normalizeService, normalizeName, slugify, inferredCategory,
    isCapAward, isAuthorizedForService, getAwardPrecedence, compareAwardsForMember,
    sortAwardsForMember, calculateDevices, mergeAwardRecords, validateCatalog
  };
});
