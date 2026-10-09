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
  const REPRESENTATION_STATUSES = Object.freeze([
    'AVAILABLE', 'NOT_APPLICABLE', 'MISSING_ASSET', 'UNVERIFIED'
  ]);

  // Source discovery can encounter navigation, marketing, and rank pages whose
  // titles resemble catalog records. Keep these records in the raw import for
  // provenance, but never promote them into the wearable canonical catalog.
  const NON_AWARD_PATTERNS = Object.freeze([
    /free military graphics and designs/i,
    /\b(?:air force|army|coast guard|space force) rank\b/i
  ]);

  function isWearableAwardRecord(award){
    if(!award) return false;
    const type=String(award.type || 'RIBBON').toUpperCase();
    if(type !== 'RIBBON') return false;
    const text=[award.id,award.name,award.officialName,award.sourceName].filter(Boolean).join(' ');
    return !NON_AWARD_PATTERNS.some(pattern=>pattern.test(text));
  }

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

  function canonicalAwardKey(award){
    return slugify(normalizeName(award?.officialName || award?.name || award?.sourceName || award?.id))
      .replace(/^(?:air_force|army|coast_guard|navy|marine_corps|space_force)_medal_of_honor$/, 'medal_of_honor');
  }

  function canonicalizeAwards(awards){
    const groups=new Map();
    for(const award of awards || []){
      if(!isWearableAwardRecord(award)) continue;
      const key=canonicalAwardKey(award);
      if(!key) continue;
      const existing=groups.get(key);
      if(!existing){
        groups.set(key, {
          ...award,
          id:key,
          canonicalId:key,
          sourceIds:unique([award.id]),
          aliases:unique([...(award.aliases || []), award.name, award.officialName]),
          authorizedServices:unique((award.authorizedServices || []).map(normalizeService)),
          precedence:{...(award.precedence || {})},
          devices:{...(award.devices || award.deviceRules || {})},
          images:{...(award.images || {})},
          representations:{...(award.representations || {})}
        });
        continue;
      }
      existing.sourceIds=unique([...(existing.sourceIds || []), award.id]);
      existing.aliases=unique([...(existing.aliases || []), ...(award.aliases || []), award.name, award.officialName]);
      existing.authorizedServices=unique([...(existing.authorizedServices || []), ...(award.authorizedServices || [])].map(normalizeService));
      existing.precedence=Object.assign({}, existing.precedence, award.precedence || {});
      existing.devices=Object.assign({}, existing.devices, award.devices || award.deviceRules || {});
      if(!existing.images?.ribbon && award.images?.ribbon) existing.images={...(award.images || {})};
      existing.representations=Object.assign({}, existing.representations || {}, award.representations || {});
      if(award.verificationStatus === 'OFFICIALLY_VERIFIED') existing.verificationStatus=award.verificationStatus;
    }
    return [...groups.values()];
  }

  function compareAwardsUniversal(a,b){
    const sideA=Object.values(a?.precedence || {}).find(Boolean)?.side || 'LEFT';
    const sideB=Object.values(b?.precedence || {}).find(Boolean)?.side || 'LEFT';
    if(sideA !== sideB) return sideA === 'LEFT' ? -1 : 1;
    const categoryA=inferredCategory(a), categoryB=inferredCategory(b);
    const categoryIndexA=DEFAULT_CATEGORY_ORDER.indexOf(categoryA);
    const categoryIndexB=DEFAULT_CATEGORY_ORDER.indexOf(categoryB);
    if(categoryIndexA !== categoryIndexB) return categoryIndexA - categoryIndexB;
    const orderA=categoryA === 'MEDAL_OF_HONOR' ? -1 : minimumKnownPrecedenceOrder(a);
    const orderB=categoryB === 'MEDAL_OF_HONOR' ? -1 : minimumKnownPrecedenceOrder(b);
    if(orderA !== orderB) return orderA-orderB;
    return String(a?.officialName || a?.name || a?.id || '').localeCompare(String(b?.officialName || b?.name || b?.id || ''));
  }

  function inferDeviceRules(award,service,{allowUnverified=false}={}){
    const serviceKey=normalizeService(service);
    const explicit=award?.devices?.[serviceKey] || award?.deviceRules?.[serviceKey];
    if(explicit) return explicit;
    // A branch/category convention is useful for discovery and manual testing,
    // but it is not proof that a specific award authorizes that device. Keep
    // inference out of the normal validated path unless advanced mode opts in.
    if(!allowUnverified) return null;
    const category=inferredCategory(award);
    const personal=new Set([
      'MEDAL_OF_HONOR','SERVICE_CROSS','DISTINGUISHED_SERVICE','VALOR','SUPERIOR_SERVICE',
      'LEGION_OF_MERIT','DISTINGUISHED_FLYING_CROSS','HEROISM','BRONZE_STAR','PURPLE_HEART',
      'MERITORIOUS_SERVICE','COMMENDATION','ACHIEVEMENT'
    ]);
    const campaign=new Set(['CAMPAIGN','EXPEDITIONARY','SERVICE']);
    const allowedSpecialDevices=['V_DEVICE','C_DEVICE','R_DEVICE','ARROWHEAD_DEVICE'];
    if(personal.has(category)){
      const naval=['NAVY','MARINE_CORPS','COAST_GUARD'].includes(serviceKey);
      return {
        repeatAward:naval
          ? {bronzeDevice:'GOLD_AWARD_STAR',silverDevice:'SILVER_AWARD_STAR'}
          : {bronzeDevice:'BRONZE_OLC',silverDevice:'SILVER_OLC'},
        allowedSpecialDevices,
        devicePrecedence:['V_DEVICE','C_DEVICE','R_DEVICE','ARROWHEAD_DEVICE','SILVER_OLC','BRONZE_OLC','SILVER_AWARD_STAR','GOLD_AWARD_STAR'],
        inferred:true
      };
    }
    if(campaign.has(category)){
      return {
        repeatAward:{bronzeDevice:'BRONZE_SERVICE_STAR',silverDevice:'SILVER_SERVICE_STAR'},
        allowedSpecialDevices,
        devicePrecedence:['ARROWHEAD_DEVICE','V_DEVICE','C_DEVICE','R_DEVICE','SILVER_SERVICE_STAR','BRONZE_SERVICE_STAR'],
        inferred:true
      };
    }
    return null;
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

  function isBadgeAuthorizedForService(badge,service){
    const serviceKey=normalizeService(service);
    return (badge?.authorizedServices || []).map(normalizeService).includes(serviceKey);
  }

  function getAirForceBadgeFallbackOrder(badge){
    const id=String(badge?.id || '').toLowerCase();
    const family=String(badge?.family || '').toUpperCase();

    // DAFI 36-2903, paragraphs 12.1 and 12.6.7: Presidential and Vice
    // Presidential Service Badges are the two highest-precedence duty badges.
    if(id==='presidential_service_badge') return 0;
    if(id==='vice_presidential_service_badge') return 1;

    // DAFI 36-2903, paragraph 12.1.1: the chaplain badge is worn above all
    // other occupational badges. Religious-affairs badges share this catalog
    // family but do not outrank an explicit chaplain badge when one is added.
    if(/(^|_)chaplain(_|$)/.test(id)) return 10;
    if(family==='CHAPLAIN') return 11;

    // DAFI 36-2903 treats aeronautical, space, cyberspace, multi-domain and
    // missile badges as an equal-precedence group. Keep a stable catalog order
    // within the group without implying a regulatory distinction.
    if(['AVIATION','AIRCREW','SPACE','CYBER','MISSILE'].includes(family) || id.includes('multi_domain')) return 20;

    // Parachutist badges follow the rated/space/cyber/missile group and precede
    // occupational badges. Other qualification badges retain equal fallback
    // precedence rather than receiving an invented regulatory order.
    if(id.includes('parachutist')) return 30;
    if(family==='EOD') return 31;
    if(family==='QUALIFICATION') return 32;

    // DAFI 36-2903, paragraph 12.6.12: when both are worn, the Munitions badge
    // precedes the Aircraft Maintenance badge.
    if(id==='air_force_munitions_badge') return 40;
    if(id==='air_force_aircraft_maintenance_badge') return 41;
    if(['OCCUPATIONAL','MEDICAL','OTHER'].includes(family)) return 42;

    // Command insignia and identification badges use their own placement rules;
    // keep them after the above-the-ribbon occupational stack unless an explicit
    // service precedence record says otherwise.
    if(family==='COMMAND') return 80;
    if(family==='IDENTIFICATION') return 90;
    return 100;
  }

  function getBadgePrecedence(badge,service){
    const serviceKey=normalizeService(service);
    const record=badge?.precedence?.[serviceKey];
    const explicitOrder=Number.isFinite(record) ? record : (Number.isFinite(record?.order) ? record.order : null);
    const fallbackOrder=['AIR_FORCE','SPACE_FORCE'].includes(serviceKey)
      ? getAirForceBadgeFallbackOrder(badge)
      : Number.MAX_SAFE_INTEGER;
    return {
      service:serviceKey,
      order:explicitOrder ?? fallbackOrder,
      verified:!!record?.verified,
      name:String(badge?.officialName || badge?.name || badge?.id || '')
    };
  }

  function sortBadgesForMember(badges,member){
    const service=normalizeService(member?.organization || member?.service);
    return [...(badges || [])].sort((a,b)=>{
      const pa=getBadgePrecedence(a,service),pb=getBadgePrecedence(b,service);
      return pa.order-pb.order || pa.name.localeCompare(pb.name);
    });
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

  function normalizeRepresentations(award){
    const configured=award?.representations || {};
    const legacy=award?.images || {};
    const normalize=(value,fallbackAsset,{applicable=true}={})=>{
      if(value && typeof value === 'object'){
        const asset=value.asset || fallbackAsset || null;
        let status=String(value.status || '').toUpperCase();
        if(!REPRESENTATION_STATUSES.includes(status)){
          if(value.available === true && asset) status='AVAILABLE';
          else if(value.notApplicable === true || applicable === false) status='NOT_APPLICABLE';
          else if(value.verificationStatus === 'UNVERIFIED' && asset) status='UNVERIFIED';
          else status=asset ? 'UNVERIFIED' : 'MISSING_ASSET';
        }
        return {...value,status,available:status === 'AVAILABLE',asset};
      }
      const asset=typeof value === 'string' ? value : fallbackAsset;
      return {
        status:applicable === false ? 'NOT_APPLICABLE' : (asset ? 'AVAILABLE' : 'MISSING_ASSET'),
        available:applicable !== false && !!asset,
        asset:asset || null
      };
    };
    return {
      ribbon:normalize(configured.ribbon,legacy.ribbon),
      miniatureMedal:normalize(configured.miniatureMedal,legacy.miniatureMedal || legacy.miniMedal),
      fullSizeMedal:normalize(configured.fullSizeMedal,legacy.fullSizeMedal || legacy.medal)
    };
  }

  function createAwardSelection(awardId,{quantity=1,specialDevices=[],manualDevices=[]}={}){
    return {
      awardId:String(awardId || ''),
      quantity:Math.max(1,Math.trunc(Number(quantity) || 1)),
      specialDevices:unique(specialDevices),
      manualDevices:unique(manualDevices)
    };
  }

  function canonicalDeviceVariantKey({awardId,service,representation='RIBBON',awardCount=1,specialDevices=[]}={}){
    const normalizedRepresentation=String(representation || 'RIBBON').trim().toUpperCase();
    const count=Math.max(1,Math.trunc(Number(awardCount) || 1));
    const specials=unique((specialDevices || []).map(value=>String(value || '').trim().toUpperCase()))
      .sort();
    return [
      slugify(awardId),normalizeService(service),normalizedRepresentation,`COUNT_${count}`,
      specials.length ? specials.join('+') : 'NO_SPECIAL_DEVICE'
    ].join('::');
  }

  function resolveBadgeRepresentation(badge,{service,uniformFamily,preferred='AUTO',assetProfiles=null,variant=null}={}){
    const reps=badge?.representations || {};
    const serviceKey=normalizeService(service);
    const family=String(uniformFamily || '').trim().toUpperCase();
    const utility=/OCP|ABU|ODU|NWU|MCCUU|UTILITY/.test(family);
    const requested=String(preferred || 'AUTO').trim().toLowerCase();
    const representationName=requested === 'auto' ? (utility ? 'embroidered' : 'metal') : requested;
    const configured=reps[representationName] || {
      status:'NOT_APPLICABLE',available:false,asset:null
    };
    const base=configured.byService?.[serviceKey] || configured;
    const variantId=variant || base.defaultVariant;
    const selected=variantId && base.variants?.[variantId] ? base.variants[variantId] : base;
    const backingId=selected.backingProfile || base.backingProfile ||
      assetProfiles?.serviceDefaults?.[serviceKey]?.embroideredBacking || null;
    return {
      ...selected,
      representation:representationName,
      variant:variantId || null,
      backingProfile:backingId,
      backing:backingId ? assetProfiles?.backingProfiles?.[backingId] || null : null
    };
  }

  function getAwardRepresentation(award,context){
    const key={RIBBON:'ribbon',MINIATURE_MEDAL:'miniatureMedal',FULL_SIZE_MEDAL:'fullSizeMedal'}[String(context || '').toUpperCase()] || context;
    return normalizeRepresentations(award)[key] || {available:false,asset:null};
  }

  function calculateDevices({ award, service, awardCount=1, campaignCount=0, specialAuthorizations=[], manualDevices=[], deviceCatalog=[], allowUnverifiedRules=false, representation='RIBBON' }){
    const serviceKey = normalizeService(service);
    const warnings=[];
    const count = Math.max(1, Math.trunc(Number(awardCount) || 1));
    const serviceRules = inferDeviceRules(award,serviceKey,{allowUnverified:allowUnverifiedRules});
    if(!serviceRules){
      if(count > 1) warnings.push(`No repeat-award device rule is available for ${award?.name || award?.id} in ${serviceKey}.`);
      if(allowUnverifiedRules && (manualDevices || []).length){
        warnings.push('MANUAL / UNVERIFIED CONFIGURATION: manual devices are not regulatory validation.');
        return {devices:[...manualDevices],valid:false,warnings};
      }
      return { devices:[], valid:count === 1, warnings };
    }

    const representationKey={RIBBON:'ribbon',MINIATURE_MEDAL:'miniatureMedal',FULL_SIZE_MEDAL:'fullSizeMedal'}[String(representation || '').toUpperCase()] || representation;
    const representationRules=serviceRules.representations?.[representationKey] || serviceRules;
    const repeatRule = representationRules.repeatAward || representationRules;
    const repeats = expandRepeatDevices(repeatRule, count - 1);
    if(repeats === null){
      warnings.push(`Award count ${count} cannot be represented by the configured ${serviceKey} device rule.`);
      return { devices:[], valid:false, warnings };
    }

    const devices=[...repeats];
    if(campaignCount > 0 && representationRules.campaignParticipation){
      const campaignDevices = expandRepeatDevices(representationRules.campaignParticipation, Math.trunc(campaignCount));
      if(campaignDevices === null) warnings.push('Campaign participation count cannot be represented by the configured rule.');
      else devices.push(...campaignDevices);
    }
    for(const id of specialAuthorizations || []){
      const allowed = representationRules.allowedSpecialDevices || [];
      if(!allowed.includes(id)) warnings.push(`${id} is not authorized by the configured rule.`);
      else devices.push(id);
    }
    if((manualDevices || []).length){
      if(!allowUnverifiedRules) warnings.push('Manual devices require Manual / unverified configuration mode.');
      else{
        devices.push(...manualDevices);
        warnings.push('MANUAL / UNVERIFIED CONFIGURATION: manual devices are not regulatory validation.');
      }
    }

    const unknown = devices.filter(id => deviceCatalog.length && !deviceDefinition(deviceCatalog,id));
    if(unknown.length) warnings.push(`Unknown device definition(s): ${unique(unknown).join(', ')}.`);
    const order = representationRules.devicePrecedence || [];
    devices.sort((a,b) => {
      const ai=order.indexOf(a), bi=order.indexOf(b);
      if(ai < 0 && bi < 0) return 0;
      if(ai < 0) return 1;
      if(bi < 0) return -1;
      return ai-bi;
    });
    return { devices, valid:warnings.length === 0, warnings };
  }

  function splitRibbonAwardInstances({
    award, service, awardCount=1, campaignCount=0, specialAuthorizations=[],
    manualDevices=[], deviceCatalog=[], allowUnverifiedRules=false, maxDevices=4
  }){
    const totalCount=Math.max(1,Math.trunc(Number(awardCount) || 1));
    const limit=Math.max(1,Math.trunc(Number(maxDevices) || 4));
    const shared={award,service,deviceCatalog,allowUnverifiedRules,representation:'RIBBON'};
    const complete=calculateDevices({
      ...shared,awardCount:totalCount,campaignCount,specialAuthorizations,manualDevices
    });
    if((complete.devices || []).length <= limit){
      return [{awardCount:totalCount,...complete}];
    }

    const instances=[];
    let remaining=totalCount;
    let first=true;
    while(remaining > 0){
      let selected=null;
      for(let candidate=remaining;candidate>=1;candidate-=1){
        const calculated=calculateDevices({
          ...shared,
          awardCount:candidate,
          campaignCount:first ? campaignCount : 0,
          specialAuthorizations:first ? specialAuthorizations : [],
          manualDevices:first ? manualDevices : []
        });
        if((calculated.devices || []).length <= limit){
          selected={awardCount:candidate,...calculated};
          break;
        }
      }
      if(!selected){
        return [{
          awardCount:totalCount,
          ...complete,
          valid:false,
          warnings:[...(complete.warnings || []),`The configured devices cannot be divided into groups of ${limit} without changing the represented award count.`]
        }];
      }
      instances.push(selected);
      remaining-=selected.awardCount;
      first=false;
    }
    return instances;
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
    ORGANIZATIONS, COMPONENTS, VERIFICATION_STATUSES, AWARD_STATUSES, REPRESENTATION_STATUSES,
    DEFAULT_CATEGORY_ORDER, normalizeService, normalizeName, slugify, inferredCategory,
    isWearableAwardRecord,
    isCapAward, isAuthorizedForService, getAwardPrecedence, compareAwardsForMember,
    sortAwardsForMember, canonicalAwardKey, canonicalizeAwards, compareAwardsUniversal,
    isBadgeAuthorizedForService, getBadgePrecedence, sortBadgesForMember,
    inferDeviceRules, normalizeRepresentations, createAwardSelection, canonicalDeviceVariantKey,
    resolveBadgeRepresentation, getAwardRepresentation,
    calculateDevices, splitRibbonAwardInstances, mergeAwardRecords, validateCatalog
  };
});
