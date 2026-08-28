'use strict';

function applyServicePrecedence(awards, tables, core){
  const canonicalBySourceId=new Map();
  for(const canonical of core.canonicalizeAwards(awards)){
    canonicalBySourceId.set(canonical.id,canonical.id);
    for(const sourceId of canonical.sourceIds || []) canonicalBySourceId.set(sourceId,canonical.id);
  }
  const orderByService=new Map(Object.entries(tables || {}).map(([service,table])=>[
    service,
    new Map((table.awards || []).map((id,index)=>[id,{order:index,table}]))
  ]));
  return awards.map(award=>{
    const canonicalId=canonicalBySourceId.get(award.id) || award.canonicalId || award.id;
    const precedence={...(award.precedence || {})};
    for(const [service,orders] of orderByService){
      const match=orders.get(canonicalId);
      if(!match) continue;
      precedence[service]={
        order:match.order,
        side:'LEFT',
        verified:true,
        source:match.table.source,
        regulation:match.table.regulation,
        accessed:match.table.accessed
      };
    }
    return {...award,precedence};
  });
}

module.exports={applyServicePrecedence};
