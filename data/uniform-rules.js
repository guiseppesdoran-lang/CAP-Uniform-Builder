// One table for what each uniform allows, taken from CAPR 39-1 (3 March 2020, with ICLs).
// Every other part of the builder that decides "may this be worn here?" reads from this
// table, so the sidebar, the renderer and the validator cannot disagree with each other.
// Each rule carries the paragraph it comes from; change a rule only with the regulation open.
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

  // ribbons: 'required' | 'optional' | 'none'
  //   mini:            miniature medals instead of ribbons (39-1 11.1.4)
  //   usafAwards:      U.S. military awards and the Air Force Organizational Excellence
  //                    Award may be worn (39-1 11.1.6, 11.2.3). This follows the style: true
  //                    for every USAF-style uniform, even one that wears no ribbons at all.
  //   rackColumns:     ribbons per row the uniform allows (39-1 11.2.7)
  //   badgeCap:        counted badges, or null where the builder does not enforce one
  const RULES=Object.freeze({
    blues_a:{group:'everyday',style:'usaf',membership:['cadet','senior'],
      ribbons:'required',mini:false,usafAwards:true,rackColumns:[3,4],badgeCap:4,
      refs:{ribbons:'11.1.2',rack:'11.2.7',badges:'4.1.5.2.2.4'}},
    blues_b:{group:'everyday',style:'usaf',membership:['cadet','senior'],minimum:true,
      ribbons:'optional',mini:false,usafAwards:true,rackColumns:[3],badgeCap:4,
      refs:{ribbons:'11.1.2',rack:'11.2.7',minimum:'1.2.2',badges:'4.1.11.1.1.2.3'}},
    mess_dress:{group:'formal',style:'usaf',membership:['senior'],
      ribbons:'none',mini:true,usafAwards:true,rackColumns:[],badgeCap:null,
      refs:{who:'4.1.1',mini:'11.1.4'}},
    semi_formal:{group:'formal',style:'corporate',membership:['senior'],
      ribbons:'none',mini:true,usafAwards:false,rackColumns:[],badgeCap:null,
      refs:{who:'4.2.1',mini:'11.1.4',awards:'11.1.6'}},
    aviator:{group:'everyday',style:'corporate',membership:['senior'],minimum:true,
      ribbons:'optional',mini:false,usafAwards:false,rackColumns:[3],badgeCap:4,
      refs:{ribbons:'4.2.5.1.2.2',rack:'11.2.7',minimum:'1.2.3',badges:'4.2.5.1.3',awards:'11.1.6'}},
    aviator_blazer:{group:'everyday',style:'corporate',membership:['senior'],
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:4,
      refs:{ribbons:'11.1.3',who:'4.2.3',awards:'11.1.6'}},
    corporate_field:{group:'field',style:'corporate',membership:['senior'],
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:null,
      refs:{ribbons:'11.1.3',awards:'11.1.6'}},
    abu:{group:'field',style:'usaf',membership:['cadet','senior'],
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:null,
      refs:{ribbons:'11.1.3'}},
    ocp:{group:'field',style:'usaf',membership:['cadet','senior'],
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:4,
      refs:{ribbons:'11.1.3'}},
    flight_suit:{group:'field',style:'usaf',membership:['cadet','senior'],
      ribbons:'none',mini:false,usafAwards:true,rackColumns:[],badgeCap:null,
      refs:{ribbons:'11.1.3'}},
    polo:{group:'field',style:'corporate',membership:['senior'],
      ribbons:'none',mini:false,usafAwards:false,rackColumns:[],badgeCap:null,
      refs:{ribbons:'11.1.3'}}
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
  function isUniformAllowedFor(uniformId,membership){
    const rule=getUniformRule(uniformId);
    if(!rule) return false;
    return membership ? rule.membership.includes(membership) : true;
  }
  // `isMilitary` is passed by the caller because the military catalog's id prefix lives with
  // the catalog, not here.
  function isAwardAllowedOnUniform(awardId,uniformId,{isMilitary=false}={}){
    const usafOnly=isMilitary || USAF_ONLY_AWARD_IDS.includes(String(awardId || ''));
    if(!usafOnly) return true;
    const rule=getUniformRule(uniformId);
    return !!(rule && rule.usafAwards);
  }
  function uniformIdsInGroup(group){
    return Object.keys(RULES).filter(id=>RULES[id].group===group);
  }

  return {
    GROUPS,RULES,USAF_ONLY_AWARD_IDS,
    getUniformRule,ribbonPolicy,allowsRibbons,allowsMiniMedals,allowsRackColumns,
    allowedMemberships,isUniformAllowedFor,isAwardAllowedOnUniform,uniformIdsInGroup
  };
});
