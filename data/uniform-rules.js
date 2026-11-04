// One table for what each uniform allows, taken from CAPR 39-1 (3 March 2020, with ICLs through
// 26-04, including the OCP wear instructions of ICL 26-14). Every other part of the builder that
// decides "may this be worn here?" reads from this table, so the sidebar, the renderer and the
// validator cannot disagree with each other.
//
// Each rule carries the paragraph it comes from; change a rule only with the regulation open.
// tests/uniform-rules.test.cjs states every value below against its paragraph.
(function capubUniformRulesModule(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CAPUBUniformRules=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function(){
  'use strict';

  // Table 1-1 groups uniforms by purpose.
  const GROUPS=Object.freeze({
    formal:{label:'Formal'},
    everyday:{label:'Everyday'},
    field:{label:'Field and flight'}
  });

  // membership:   who wears it as a matter of course. Corporate-style uniforms list only
  //               'senior': a cadet reaches them through adultCadet below, never by default.
  // adultCadet:   a cadet aged 18 or older who does not meet the USAF-style weight standard
  //               may wear it (39-1 1.2.5.2: all Corporate-style combinations except the
  //               Corporate Working Uniform, which allows no grade insignia).
  // ribbons:      'required' | 'optional' | 'none' (39-1 11.1.2, 11.1.3)
  // mini:         miniature medals instead of ribbons (11.1.4)
  // usafAwards:   U.S. military awards, U.S. military badges and the Air Force Organizational
  //               Excellence Award may be worn (11.1.6, 11.2.3). This follows the style: true
  //               for every USAF-style uniform, even one that wears no ribbons at all.
  // rackColumns:  ribbons per row the uniform allows (11.2.7)
  // badgeCap:     the most badges the uniform authorizes, or null where the regulation states
  //               no total for it. Command insignia never counts against it.
  // patchesShareBadgeCap: the regulation counts badges and patches together against badgeCap.
  // shoulderCord: shoulder cords may be worn on it, by cadets only (9.3, 9.4.1: cadets, on the
  //               USAF-style Service Dress and Blue Service uniforms, never on a Working Uniform)
  // aideCord:     the USAF Aide de Camp cord may be worn, by senior members and cadets alike, while they
  //               serve as an aide to a general officer, on the Service uniform (Class B) and Service
  //               Dress (Class A) (9.3.4)
  // chaplainBadgeOnly: the only occupational badge authorized is the chaplain badge
  //               (4.2.3.1.1.3; Corporate Semi-Formal is worn as for Corporate Service
  //               Dress, 4.2.1).
  // badgeFamilies: the Attachment 4 families the uniform authorizes, where it names them (the
  //               polo: one service, aviation, occupational or specialty track badge, 5.3.1.1,
  //               5.3.1.3; 5.3.2.1.1 lists the last three and a duty title); the chaplain badge is
  //               an occupational badge. Absent where the uniform names none.
  // noGrade:      no grade insignia is authorized on it, whoever wears it (5.3.2)
  const RULES=Object.freeze({
    blues_a:{group:'everyday',style:'usaf',membership:['cadet','senior'],adultCadet:false,
      ribbons:'required',mini:false,usafAwards:true,rackColumns:[3,4],badgeCap:4,shoulderCord:true,aideCord:true,
      refs:{ribbons:'11.1.2',rack:'11.2.7',badges:'4.1.5.2.2.4',cords:'9.3, 9.4.1'}},
    blues_b:{group:'everyday',style:'usaf',membership:['cadet','senior'],adultCadet:false,minimum:true,
      ribbons:'optional',mini:false,usafAwards:true,rackColumns:[3],badgeCap:4,shoulderCord:true,aideCord:true,
      refs:{ribbons:'11.1.2',rack:'11.2.7',minimum:'1.2.2',badges:'4.1.11.1.1.2.3',cords:'9.3, 9.4.1'}},
    // 4.1.1, 4.1.2, 1.4.1.1: not worn by members without grade.
    mess_dress:{group:'formal',style:'usaf',membership:['senior'],adultCadet:false,gradeRequired:true,
      ribbons:'none',mini:true,usafAwards:true,rackColumns:[],badgeCap:4,
      refs:{who:'4.1.1',ribbons:'11.1.4',mini:'11.1.4',badges:'4.1.1.1.3'}},
    // ICL 25-02 corrected 4.2.2.4 to allow CAP and military miniature medals.
    semi_formal:{group:'formal',style:'corporate',membership:['senior'],adultCadet:true,
      ribbons:'none',mini:true,usafAwards:true,rackColumns:[],badgeCap:null,chaplainBadgeOnly:true,
      refs:{who:'4.2.1',ribbons:'11.1.4',mini:'11.1.4',awards:'ICL 25-02 (4.2.2.4)',occupational:'4.2.3.1.1.3',adultCadet:'1.2.5.2'}},
    semi_formal_usaf:{group:'formal',style:'usaf',membership:['cadet'],adultCadet:false,
      ribbons:'required',mini:false,usafAwards:true,rackColumns:[3,4],badgeCap:4,
      refs:{who:'4.1.3, 4.1.4',ribbons:'11.1.2',rack:'11.2.7',badges:'4.1.3.2.2, 4.1.4.2'}},
    // ICL 25-02 rewrote 4.2.5.1.2.2 and 4.2.6.2.6.2: military and CAP ribbons on the aviator shirt.
    aviator:{group:'everyday',style:'corporate',membership:['senior'],adultCadet:true,minimum:true,
      ribbons:'optional',mini:false,usafAwards:true,rackColumns:[3],badgeCap:4,
      refs:{who:'1.2.3',ribbons:'4.2.5.1.2.2',rack:'11.2.7',minimum:'1.2.3',badges:'4.2.5.1.3',awards:'ICL 25-02 (4.2.5.1.2.2, 4.2.6.2.6.2)',adultCadet:'1.2.5.2'}},
    aviator_blazer:{group:'everyday',style:'corporate',membership:['senior'],adultCadet:true,
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:null,chaplainBadgeOnly:true,
      refs:{ribbons:'11.1.3',who:'4.2.3',awards:'11.1.6',occupational:'4.2.3.1.1.3',adultCadet:'1.2.5.2'}},
    corporate_field:{group:'field',style:'corporate',membership:['senior'],adultCadet:true,
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:8,patchesShareBadgeCap:true,
      refs:{who:'5.2.1',ribbons:'11.1.3',awards:'11.1.6',badges:'5.2.1.1.2',adultCadet:'1.2.5.2'}},
    abu:{group:'field',style:'usaf',membership:['cadet','senior'],adultCadet:false,
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:4,patchesShareBadgeCap:true,
      refs:{ribbons:'5.1.1.1.2',badges:'5.1.1.1.2'}},
    ocp:{group:'field',style:'usaf',membership:['cadet','senior'],adultCadet:false,
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:4,
      refs:{ribbons:'7.1.1.1.2',badges:'7.1.1.3.1'}},
    // The name tag draws one badge by default and a second if the member adds it (8.2.4.1 'up to two badges', 8.3.4.1 one aeronautical rating and one
    // occupational badge): Ethan, 2 November 2026, after Doran, over his ruling B8 (58a5f4d3, 22 October), which had cut the tag to one:
    // "default of 1 badge for the fdu's with the option for 2". badgeDefault is the count the panel says a member starts with. An officer's tag is the cloth one, which
    // 'may include one badge' (8.2.4.1, 8.3.4.1): officerBadgeCap.
    flight_suit:{group:'field',style:'usaf',membership:['cadet','senior'],adultCadet:false,
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:2,badgeDefault:1,officerBadgeCap:1,
      refs:{who:'8.2.1',ribbons:'11.1.3',badges:'8.2.4.1'}},
    // 8.3.1 opens it to active members, but a cadet is a member only of the USAF-style uniforms (1.2.5.2),
    // so a cadet reaches it only as an adult cadet over the weight standard.
    corporate_flight_suit:{group:'field',style:'corporate',membership:['senior'],adultCadet:true,
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:2,badgeDefault:1,officerBadgeCap:1,
      refs:{who:'8.3.1',ribbons:'11.1.3',badges:'8.3.4.1',adultCadet:'1.2.5.2'}},
    // The Corporate Working Uniform (polo, 5.3). Cadets never wear it: 1.2.5.2 lets an adult cadet wear all the
    // Corporate-style combinations "except the Corporate Working Uniform since it does not allow for wear of grade
    // insignia", so adultCadet is false. A senior member wears it with or without grade (5.3.2: none is worn).
    // No ribbons or medals (11.1.3), no military awards (11.1.6). One badge or duty title and the member's name,
    // embroidered, are the only accoutrements, and the screen-printed shirt has none at all (5.3.2.1).
    // 5.3.1.1 and 5.3.1.3 name a "service badge" among the badges; 5.3.2.1.1 does not. The shirt paragraphs
    // are two against one, so the service family is authorized (the builder has no embroidered art for it).
    polo:{group:'everyday',style:'corporate',membership:['senior'],adultCadet:false,noGrade:true,
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:1,
      badgeFamilies:['service','aviation','occupational','chaplain','specialty'],
      refs:{who:'5.3',ribbons:'11.1.3',awards:'11.1.6',badges:'5.3.2.1.1',grade:'5.3.2',adultCadet:'1.2.5.2',screenPrint:'5.3.2.1.2'}}
  });

  // Which CAP badges each uniform wears (LIVE13 E67, Ethan: "when someone is selecting on a uniform, it should only show the
  // badges applicable. like for ABU's, the ES specialty track badges shouldn't apply"). By Attachment 4 family (data/badge-catalog.js):
  //   families   the families the uniform's badge paragraphs name, read with the regulation open;
  //   fieldArt   only a badge with GENUINE field artwork is worn (Ethan's ruling LIVE-FIELD B6: the original silver-on-dark-blue set;
  //              dress enamel art never appears on a field uniform, so the specialty track, Emergency Services and service badges,
  //              which have none, are not offered on the OCP, ABU and CFU, and the polo's embroidered badge is the same art, POLO-ENG-4);
  //   serviceIds the service badges worn, where only some are (the blazers: the CSAG, Command Council, National Board or NEC badge in
  //              place of the CAP Crest, 4.2.3.1.1.1; Attachment 4 keeps the National Staff badge off);
  //   ref        the paragraphs, men's then women's where they differ.
  // The cadet-only families (rocketry, marksmanship, cadet-specialty) are named only where the paragraph names them; the membership
  // filter (badge-catalog eligibleFor) applies on top. A badge a uniform does not wear stays selected for the member's other uniforms.
  const ALL_BADGE_FAMILIES=Object.freeze(['chaplain','aviation','occupational','specialty','service','national-staff','command','rocketry','marksmanship','cadet-specialty']);
  const LEFT_BREAST_FAMILIES=Object.freeze(['chaplain','aviation','occupational','command']);
  const BLAZER_SERVICE_IDS=Object.freeze(['senior_advisory_group_badge','command_council_badge','national_executive_committee_badge','cap_national_command_board_badge']);
  const BADGE_WEAR=Object.freeze({
    // 4.1.5.2.2.4.1-4 / 4.1.9.4.4: aviation and occupational over the left pocket; service, specialty track, Model Rocketry, STEM,
    // Cyber and NRA badges on the pockets and over the nametag; the command insignia pin.
    blues_a:{families:ALL_BADGE_FAMILIES,ref:'4.1.5.2.2.4, 4.1.9.4.4'},
    // 4.1.11.1.1.2.3.1-4 / 4.1.12.2.5: the same families on the shirt and blouse.
    blues_b:{families:ALL_BADGE_FAMILIES,ref:'4.1.11.1.1.2.3, 4.1.12.2.5'},
    // 4.1.3.2.2 / 4.1.4.2: worn as on the Service Dress; only a badge over the nametag moves.
    semi_formal_usaf:{families:ALL_BADGE_FAMILIES,ref:'4.1.3.2.2, 4.1.4.2'},
    // 4.1.1.1.3.1-3 / 4.1.2.1.2.4-7: aviation and occupational, CAP service and specialty track badges, the command pin. (No cadet
    // badges: the mess dress is not a cadet uniform, 4.1.1.)
    mess_dress:{families:['chaplain','aviation','occupational','specialty','service','national-staff','command'],ref:'4.1.1.1.3, 4.1.2.1.2.4'},
    // 4.2.5.1.3.1-3 / 4.2.6.2.7: CAP aviation and occupational, service, specialty track and the cadet badges, the command pin.
    aviator:{families:ALL_BADGE_FAMILIES,ref:'4.2.5.1.3, 4.2.6.2.7'},
    // 4.2.3.1.1.1, 4.2.3.1.1.3 / 4.2.4.1.1.1, 4.2.4.1.1.3: the chaplain badge ("No other occupational badges are authorized") and,
    // in place of the CAP Crest, the CSAG, Command Council, National Board or NEC badge. The aviator shirt the builder draws beside
    // the blazer (the shirt under it, js/engine/profiles-dress.js companion) wears its own badges: see withShirt.
    aviator_blazer:{families:['chaplain','service'],serviceIds:BLAZER_SERVICE_IDS,ref:'4.2.3.1.1.1, 4.2.3.1.1.3, 4.2.4.1.1.1, 4.2.4.1.1.3',withShirt:'aviator'},
    // 4.2.1, 4.2.2: worn as the Corporate Service Dress, so the same badges.
    semi_formal:{families:['chaplain','service'],serviceIds:BLAZER_SERVICE_IDS,ref:'4.2.1, 4.2.2, 4.2.3.1.1.1, 4.2.3.1.1.3'},
    // 5.1.1.1.2.4: two aviation or occupational badges, silver on dark blue, the chaplain badge highest; 5.1.1.1.2.5: the command insignia.
    abu:{families:LEFT_BREAST_FAMILIES,fieldArt:true,ref:'5.1.1.1.2.4, 5.1.1.1.2.5'},
    // 5.2.1.1.2.6: two aviation or occupational badges (CAP only); 5.2.1.1.2.9: the command insignia pin.
    corporate_field:{families:LEFT_BREAST_FAMILIES,fieldArt:true,ref:'5.2.1.1.2.6, 5.2.1.1.2.9'},
    // 7.1.1.3.1: up to four occupational, qualification and/or skill badges, light silver on dark blue; 7.1.1.3.1.5 the order of precedence (.5.1 group 1,
    // the mandatory badges: CAP chaplain, aviation, then the military aeronautical badges; .5.2 group 2, the optional ones, CAP badges before the military
    // ones); 7.1.1.3.1.6 (ICL 26-14; was .7) the CAP Commander's Insignia, which does not count towards the four. Ethan's B6: only the genuine field set.
    ocp:{families:LEFT_BREAST_FAMILIES,fieldArt:true,ref:'7.1.1.3.1, 7.1.1.3.1.5, 7.1.1.3.1.6'},
    // 8.2.4.1: the name tag takes one CAP aeronautical rating, CAP occupational badges (the chaplain badge is one) or the current
    // commander's Command Insignia Pin; no specialty track or service badge.
    flight_suit:{families:LEFT_BREAST_FAMILIES,ref:'8.2.4.1'},
    // 8.3.4.1: one CAP aeronautical rating and one CAP occupational badge, or the Command Insignia Pin.
    corporate_flight_suit:{families:LEFT_BREAST_FAMILIES,ref:'8.3.4.1'},
    // 5.3.1.1, 5.3.1.3, 5.3.2.1.1: one service, aviation, occupational or specialty track badge (RULES.polo.badgeFamilies), embroidered,
    // so the field set only (POLO-ENG-4): no specialty track, Emergency Services or service badge has that art.
    polo:{families:['service','aviation','occupational','chaplain','specialty'],fieldArt:true,ref:'5.3.1.1, 5.3.1.3, 5.3.2.1.1'}
  });
  // What the uniform wears, for this view: the aviator blazer drawn with the shirt under it beside it (underlayer 'shirt', the
  // default) wears the blazer's badges on the blazer and the aviator shirt's on the shirt (4.2.5.1.3), so it offers both; with the
  // turtleneck or the white shell there is no shirt and only the blazer's are worn.
  function badgeWear(uniformId,{underlayer='shirt'}={}){
    const wear=BADGE_WEAR[String(uniformId||'')];
    if(!wear) return null;
    if(wear.withShirt && (underlayer||'shirt')==='shirt'){
      const shirt=BADGE_WEAR[wear.withShirt];
      return {families:[...new Set([...wear.families,...shirt.families])],fieldArt:false,serviceIds:null,ref:`${wear.ref}; on the aviator shirt beside it, ${shirt.ref}`};
    }
    return {families:[...wear.families],fieldArt:!!wear.fieldArt,serviceIds:wear.serviceIds ? [...wear.serviceIds] : null,ref:wear.ref};
  }
  // Whether the uniform wears this badge. `badge` is { id, family, field } as data/badge-catalog.js holds it (field: the field art id
  // or null). A uniform without a row, or a badge without a family, is not decided here (true).
  function isBadgeWornOn(uniformId,badge,opts={}){
    const wear=badgeWear(uniformId,opts);
    if(!wear || !badge || !badge.family) return true;
    if(!wear.families.includes(badge.family)) return false;
    if(wear.fieldArt && !badge.field) return false;
    if(badge.family==='service' && wear.serviceIds && !wear.serviceIds.includes(badge.id)) return false;
    return true;
  }

  // Uniforms the regulation authorizes that the builder does not draw yet. They are listed so
  // the table states the whole regulation; none is offered to a member. The polo was the last one
  // (it is a RULES row now), so the list is empty.
  const NOT_MODELLED=Object.freeze({});
  // Optional badges the regulation allows on a uniform the builder offers no badge placement for.
  const BADGES_NOT_PLACED=Object.freeze({});

  // Awards that are USAF-style only, other than the U.S. military catalog (which the caller
  // identifies by prefix). 39-3 Attachment 2 lists this one for seniors; 39-1 11.2.3 keeps it
  // off the Corporate uniforms.
  const USAF_ONLY_AWARD_IDS=Object.freeze(['Air_Force_Organizational_Excellence_Award']);

  // The uniforms that allow U.S. military badges (usafAwards, 5.1.1.1.2.6 for the ABU, 7.1.1.3.1 for the OCP) where the builder does not draw
  // them yet: the dress profiles are the only ones that do (js/engine/profiles-dress.js planBadges). The picker says so on these.
  const MILITARY_BADGES_NOT_DRAWN=Object.freeze(['semi_formal','abu','ocp','flight_suit']);

  function getUniformRule(uniformId){
    return RULES[String(uniformId || '')] || null;
  }
  function ribbonPolicy(uniformId){
    const rule=getUniformRule(uniformId);
    return rule ? rule.ribbons : 'none';
  }
  function allowsRibbons(uniformId){
    return ribbonPolicy(uniformId)!=='none';
  }
  function allowsMiniMedals(uniformId){
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.mini);
  }
  function allowsRackColumns(uniformId,columns){
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.rackColumns.includes(Number(columns)));
  }
  function allowedMemberships(uniformId){
    const rule=getUniformRule(uniformId);
    return rule ? [...rule.membership] : [];
  }
  // adultCadet: the member is a cadet aged 18 or older who does not meet the USAF-style weight
  // standard (39-1 1.2.5.2). It only ever widens what a cadet may wear, and only to uniforms
  // whose rule says adultCadet.
  // rank: the member's grade ('SM' is a senior member without grade), for uniforms that need one.
  function isUniformAllowedFor(uniformId,membership,{adultCadet=false,rank=null}={}){
    const rule=getUniformRule(uniformId);
    if(!rule) return false;
    if(!membership) return true;
    if(rule.gradeRequired && membership==='senior' && rank==='SM') return false;
    if(rule.membership.includes(membership)) return true;
    return membership==='cadet' && !!adultCadet && rule.adultCadet===true;
  }
  // `isMilitary` is passed by the caller because the military catalog's id prefix lives with
  // the catalog, not here.
  // Whether the builder draws U.S. military badges on the uniform: it allows them and has a place for them.
  function drawsMilitaryBadges(uniformId){
    return isAwardAllowedOnUniform('',uniformId,{isMilitary:true}) && !MILITARY_BADGES_NOT_DRAWN.includes(String(uniformId||''));
  }
  function isAwardAllowedOnUniform(awardId,uniformId,{isMilitary=false}={}){
    const rule=getUniformRule(uniformId);
    // The AFOEA is not worn on Corporate-style uniforms (11.2.3) or the mess dress (ICL 18-02, 4b);
    // ICL 25-02 opened the corporate uniforms to military awards only.
    if(USAF_ONLY_AWARD_IDS.includes(String(awardId || ''))){
      return !!(rule && rule.style==='usaf' && uniformId!=='mess_dress');
    }
    if(!isMilitary) return true;
    return !!(rule && rule.usafAwards);
  }
  // Why a uniform is not offered to this member, with the paragraph. Empty when it is.
  function lockedReason(uniformId,membership,{adultCadet=false,rank=null}={}){
    const rule=getUniformRule(uniformId);
    if(!rule || !membership || isUniformAllowedFor(uniformId,membership,{adultCadet,rank})) return '';
    if(rule.gradeRequired && membership==='senior' && rank==='SM'){
      return `Worn by officers and NCOs, not by members without grade (CAPR 39-1, ${rule.refs.who})`;
    }
    if(membership==='cadet' && rule.adultCadet){
      return `For cadets 18 and older who do not meet the USAF weight standard (CAPR 39-1, ${rule.refs.adultCadet})`;
    }
    if(membership==='cadet' && rule.noGrade){
      return `Not worn by cadets, adult cadets included: it allows no grade insignia (CAPR 39-1, ${rule.refs.adultCadet})`;
    }
    if(membership==='cadet' && rule.style==='corporate'){
      return 'Not authorized with grade insignia, so not for cadets (CAPR 39-1, 1.2.5.2)';
    }
    const ref=rule.refs && (rule.refs.who || rule.refs.minimum);
    const where=ref ? ` (CAPR 39-1, ${ref})` : '';
    if(!rule.membership.includes('cadet')) return `For senior members${where}`;
    return `Not available to ${membership} members${where}`;
  }
  function allowsShoulderCord(uniformId,membership){
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.shoulderCord && membership==='cadet');
  }
  function allowsAideCord(uniformId){
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.aideCord);
  }
  // Whether this cord may be worn on this uniform by this member: the cadet cords (CAC, color guard,
  // honor guard) by cadets on the cadet-cord uniforms (9.3, 9.4.1); the Aide de Camp cord by cadets and
  // senior members alike (9.3.4).
  function allowsCord(uniformId,membership,cord){
    if(!cord) return false;
    if(cord==='aide_de_camp') return allowsAideCord(uniformId);
    return allowsShoulderCord(uniformId,membership);
  }
  // Whether a badge of this Attachment 4 family ('aviation', 'occupational', 'chaplain', 'specialty', ...)
  // may be worn on the uniform, where the uniform names the families it authorizes (the polo, 5.3.2.1.1).
  function allowsBadgeFamily(uniformId,family){
    const rule=getUniformRule(uniformId);
    if(!rule || !rule.badgeFamilies) return true;
    return rule.badgeFamilies.includes(String(family||''));
  }
  // No grade insignia is authorized on the uniform for anyone (5.3.2).
  function allowsGrade(uniformId){
    const rule=getUniformRule(uniformId);
    return !(rule && rule.noGrade);
  }
  function allowsOnlyChaplainBadge(uniformId){
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.chaplainBadgeOnly);
  }
  // How many badges count against the uniform's limit, and whether the member is over it.
  // `badges` and `patches` are the counts the caller already has (command insignia excluded).
  function badgeLimit(uniformId,{badges=0,patches=0}={}){
    const rule=getUniformRule(uniformId);
    if(!rule || rule.badgeCap==null) return {cap:null,counted:badges,shared:false,over:false};
    const shared=!!rule.patchesShareBadgeCap;
    const counted=badges+(shared ? patches : 0);
    return {cap:rule.badgeCap,counted,shared,over:counted>rule.badgeCap};
  }
  // Authorized uniforms the builder cannot draw yet, for the member to read about. Each is shown
  // to the members the regulation names, never offered to select.
  function plannedUniformsFor(membership,{adultCadet=false}={}){
    if(!membership) return [];
    return Object.entries(NOT_MODELLED)
      .filter(([,u])=>u.membership.includes(membership))
      .map(([id,u])=>({id,label:u.label,group:u.group,facts:[...u.facts],why:u.why,refs:{...u.refs}}));
  }
  // A uniform that allows badges but has no badge placement here: say so rather than hide them.
  function plannedBadge(uniformId){
    return BADGES_NOT_PLACED[String(uniformId||'')] || null;
  }
  // The tie (men) or tie tab (women) on the shirts (CAPR 39-1): worn with the long-sleeved shirt and optional with the short-sleeved one on the Class B
  // (men 4.1.11.1.1.3, women 4.1.12.4) and the aviator shirt (men 4.2.5.1.4, women 4.2.6.3). The shirt drawn beside the Corporate Service Dress blazer
  // keeps it (men 4.2.3.4 "mandatory with this uniform combination unless wearing the turtleneck", women 4.2.4.3 "worn with the aviator shirt"). The
  // overblouse takes none. Returns { offered, defaultOn, para }: whether the page offers the choice, what is drawn until the member chooses, the paragraph.
  const TIE_PARAS={blues_b:{male:'4.1.11.1.1.3',female:'4.1.12.4'},aviator:{male:'4.2.5.1.4',female:'4.2.6.3'}};
  function tieRule(uniformId,{gender='male',sleeve='short',overblouse=false,withBlazer=false}={}){
    const sex=gender==='female' ? 'female' : 'male';
    if(withBlazer) return {offered:false,defaultOn:true,para:sex==='female' ? '4.2.4.3' : '4.2.3.4'};
    const paras=TIE_PARAS[uniformId];
    if(!paras || overblouse) return {offered:false,defaultOn:false,para:null};
    return {offered:true,defaultOn:sleeve==='long',para:paras[sex]};
  }
  function uniformIdsInGroup(group){
    return Object.keys(RULES).filter(id=>RULES[id].group===group);
  }

  return {
    GROUPS,RULES,NOT_MODELLED,BADGES_NOT_PLACED,USAF_ONLY_AWARD_IDS,
    getUniformRule,ribbonPolicy,allowsRibbons,allowsMiniMedals,allowsRackColumns,
    allowedMemberships,isUniformAllowedFor,isAwardAllowedOnUniform,drawsMilitaryBadges,MILITARY_BADGES_NOT_DRAWN,uniformIdsInGroup,
    BADGE_WEAR,ALL_BADGE_FAMILIES,badgeWear,isBadgeWornOn,
    lockedReason,allowsOnlyChaplainBadge,allowsBadgeFamily,allowsGrade,allowsShoulderCord,allowsAideCord,allowsCord,tieRule,badgeLimit,plannedUniformsFor,plannedBadge
  };
});
