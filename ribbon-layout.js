(function capubRibbonLayoutModule(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CAPUBRibbonLayout=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function(){
  'use strict';

  function findMonotonicRibbonRowCounts(capacitiesBottomFirst,total,{validator=null}={}){
    const capacities=(capacitiesBottomFirst || [])
      .map(value=>Math.max(0,Math.trunc(Number(value) || 0)));
    const target=Math.max(0,Math.trunc(Number(total) || 0));
    if(!capacities.length || target<capacities.length) return null;

    const counts=[];
    function visit(index,previous,remaining){
      if(index===capacities.length){
        if(remaining!==0) return null;
        const candidate=[...counts];
        return !validator || validator(candidate) ? candidate : null;
      }
      const rowsAfter=capacities.length-index-1;
      const maximum=Math.min(capacities[index],previous,remaining-rowsAfter);
      for(let count=maximum;count>=1;count-=1){
        const nextRemaining=remaining-count;
        let futureCapacity=0;
        for(let future=index+1;future<capacities.length;future+=1){
          futureCapacity+=Math.min(capacities[future],count);
        }
        if(nextRemaining<rowsAfter || nextRemaining>futureCapacity) continue;
        counts.push(count);
        const result=visit(index+1,count,nextRemaining);
        if(result) return result;
        counts.pop();
      }
      return null;
    }
    return visit(0,Number.POSITIVE_INFINITY,target);
  }

  function isMonotonicRibbonNarrowing(countsBottomFirst){
    return (countsBottomFirst || []).every((count,index,list)=>index===0 || count<=list[index-1]);
  }

  return {findMonotonicRibbonRowCounts,isMonotonicRibbonNarrowing};
});
