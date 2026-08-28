(function militaryDeviceLayoutModule(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CAPUBMilitaryDeviceLayout=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function(){
  'use strict';

  const DEFAULT_CONTEXTS=Object.freeze({
    ribbon:Object.freeze({
      width:100,height:30,
      slots:Object.freeze({
        1:[0.50],2:[0.36,0.64],3:[0.27,0.50,0.73],
        4:[0.20,0.40,0.60,0.80],5:[0.14,0.32,0.50,0.68,0.86]
      }),
      centerY:0.50,maxSpan:[0.12,0.88]
    }),
    miniatureMedal:Object.freeze({
      width:100,height:176,
      // Suspension devices occupy only the top ribbon, never the pendant.
      slots:Object.freeze({
        1:[0.50],2:[0.39,0.61],3:[0.31,0.50,0.69],
        4:[0.25,0.42,0.58,0.75],5:[0.20,0.35,0.50,0.65,0.80]
      }),
      centerY:0.19,maxSpan:[0.18,0.82]
    }),
    fullSizeMedal:Object.freeze({
      width:120,height:240,
      slots:Object.freeze({
        1:[0.50],2:[0.39,0.61],3:[0.31,0.50,0.69],
        4:[0.25,0.42,0.58,0.75],5:[0.20,0.35,0.50,0.65,0.80]
      }),
      centerY:0.18,maxSpan:[0.18,0.82]
    })
  });

  function normalizedSlots(count,context){
    const slots=context.slots[count];
    if(slots) return [...slots];
    const [left,right]=context.maxSpan;
    if(count<=1) return [0.5];
    return Array.from({length:count},(_,index)=>left+(right-left)*(index/(count-1)));
  }

  function layoutDevices(devices,{context='ribbon',contextOverride=null,deviceSizes={},awardOverride=null}={}){
    const base=DEFAULT_CONTEXTS[context];
    if(!base) throw new Error(`Unknown military device placement context: ${context}`);
    const config={...base,...(contextOverride || {}),...(awardOverride || {})};
    const list=[...(devices || [])];
    const slots=normalizedSlots(list.length,config);
    return list.map((deviceId,index)=>{
      const size=deviceSizes[deviceId] || (context==='ribbon' ? {width:16,height:16} : {width:13,height:13});
      return {
        deviceId,
        x:Math.round(config.width*slots[index]-size.width/2),
        y:Math.round(config.height*config.centerY-size.height/2),
        width:size.width,
        height:size.height,
        context
      };
    });
  }

  return {DEFAULT_CONTEXTS,normalizedSlots,layoutDevices};
});
