// One table for what each uniform allows, taken from CAPR 39-1 (3 March 2020, with ICLs through
// 26-04, including the OCP wear instructions of ICL 25-06). Every other part of the builder that
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
  // chaplainBadgeOnly: the only occupational badge authorized is the chaplain badge
  //               (4.2.3.1.1.3; Corporate Semi-Formal is worn as for Corporate Service
  //               Dress, 4.2.1).
  const RULES=Object.freeze({
    blues_a:{group:'everyday',style:'usaf',membership:['cadet','senior'],adultCadet:false,
      ribbons:'required',mini:false,usafAwards:true,rackColumns:[3,4],badgeCap:4,
      refs:{ribbons:'11.1.2',rack:'11.2.7',badges:'4.1.5.2.2.4'}},
    blues_b:{group:'everyday',style:'usaf',membership:['cadet','senior'],adultCadet:false,minimum:true,
      ribbons:'optional',mini:false,usafAwards:true,rackColumns:[3],badgeCap:4,
      refs:{ribbons:'11.1.2',rack:'11.2.7',minimum:'1.2.2',badges:'4.1.11.1.1.2.3'}},
    mess_dress:{group:'formal',style:'usaf',membership:['senior'],adultCadet:false,
      ribbons:'none',mini:true,usafAwards:true,rackColumns:[],badgeCap:4,
      refs:{who:'4.1.1',ribbons:'11.1.4',mini:'11.1.4',badges:'4.1.1.1.3'}},
    semi_formal:{group:'formal',style:'corporate',membership:['senior'],adultCadet:true,
      ribbons:'none',mini:true,usafAwards:false,rackColumns:[],badgeCap:null,chaplainBadgeOnly:true,
      refs:{who:'4.2.1',ribbons:'11.1.4',mini:'11.1.4',awards:'11.1.6',occupational:'4.2.3.1.1.3',adultCadet:'1.2.5.2'}},
    aviator:{group:'everyday',style:'corporate',membership:['senior'],adultCadet:true,minimum:true,
      ribbons:'optional',mini:false,usafAwards:false,rackColumns:[3],badgeCap:4,
      refs:{who:'1.2.3',ribbons:'4.2.5.1.2.2',rack:'11.2.7',minimum:'1.2.3',badges:'4.2.5.1.3',awards:'11.1.6',adultCadet:'1.2.5.2'}},
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
    flight_suit:{group:'field',style:'usaf',membership:['cadet','senior'],adultCadet:false,
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:2,
      refs:{who:'8.2.1',ribbons:'11.1.3',badges:'8.2.4.1'}},
    polo:{group:'field',style:'corporate',membership:['senior'],adultCadet:false,
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:1,
      refs:{who:'5.3',ribbons:'11.1.3',badges:'5.3.2.1.1',adultCadet:'1.2.5.2'}}
  });

  // Uniforms the regulation authorizes that the builder does not draw yet. They are listed so
  // the table states the whole regulation; none is offered to a member.
  const NOT_MODELLED=Object.freeze({
    semi_formal_usaf_cadet:{style:'usaf',membership:['cadet'],ribbons:'required',
      refs:{who:'4.1.3, 4.1.4',ribbons:'11.1.2'},
      why:'Cadet-only USAF Semi-Formal. Needs ribbon-rack calibration data that does not exist.'},
    corporate_flight_duty:{style:'corporate',membership:['cadet','senior'],ribbons:'none',
      refs:{who:'8.3.1',ribbons:'11.1.3'},
      why:'Corporate Flight Duty Uniform. No base artwork.'}
  });

  // Awards that are USAF-style only, other than the U.S. military catalog (which the caller
  // identifies by prefix). 39-3 Attachment 2 lists this one for seniors; 39-1 11.2.3 keeps it
  // off the Corporate uniforms.
  const USAF_ONLY_AWARD_IDS=Object.freeze(['Air_Force_Organizational_Excellence_Award']);

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
  function isUniformAllowedFor(uniformId,membership,{adultCadet=false}={}){
    const rule=getUniformRule(uniformId);
    if(!rule) return false;
    if(!membership) return true;
    if(rule.membership.includes(membership)) return true;
    return membership==='cadet' && !!adultCadet && rule.adultCadet===true;
  }
  // `isMilitary` is passed by the caller because the military catalog's id prefix lives with
  // the catalog, not here.
  function isAwardAllowedOnUniform(awardId,uniformId,{isMilitary=false}={}){
    const usafOnly=isMilitary || USAF_ONLY_AWARD_IDS.includes(String(awardId || ''));
    if(!usafOnly) return true;
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.usafAwards);
  }
  // Why a uniform is not offered to this member, with the paragraph. Empty when it is.
  function lockedReason(uniformId,membership,{adultCadet=false}={}){
    const rule=getUniformRule(uniformId);
    if(!rule || !membership || isUniformAllowedFor(uniformId,membership,{adultCadet})) return '';
    if(membership==='cadet' && rule.adultCadet){
      return `For cadets 18 and older who do not meet the USAF weight standard (CAPR 39-1, ${rule.refs.adultCadet})`;
    }
    if(membership==='cadet' && rule.style==='corporate'){
      return 'Not authorized with grade insignia, so not for cadets (CAPR 39-1, 1.2.5.2)';
    }
    const ref=rule.refs && (rule.refs.who || rule.refs.minimum);
    const where=ref ? ` (CAPR 39-1, ${ref})` : '';
    if(!rule.membership.includes('cadet')) return `For senior members${where}`;
    return `Not available to ${membership} members${where}`;
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
  function uniformIdsInGroup(group){
    return Object.keys(RULES).filter(id=>RULES[id].group===group);
  }

  return {
    GROUPS,RULES,NOT_MODELLED,USAF_ONLY_AWARD_IDS,
    getUniformRule,ribbonPolicy,allowsRibbons,allowsMiniMedals,allowsRackColumns,
    allowedMemberships,isUniformAllowedFor,isAwardAllowedOnUniform,uniformIdsInGroup,
    lockedReason,allowsOnlyChaplainBadge,badgeLimit
  };
});
