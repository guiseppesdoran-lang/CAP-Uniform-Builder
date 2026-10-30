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
      width:50,height:176,
      // Match the McChord CAP miniature-medal series: devices stack vertically
      // on the suspension ribbon, centered at y=62 with 21px between centers.
      orientation:'vertical',centerX:0.50,centerY:(62/176),verticalStep:21,
      slots:Object.freeze({
        1:[0.50],2:[0.39,0.61],3:[0.31,0.50,0.69],
        4:[0.25,0.42,0.58,0.75],5:[0.20,0.35,0.50,0.65,0.80]
      }),
      centerY:0.19,maxSpan:[0.18,0.82]
    }),
    fullSizeMedal:Object.freeze({
      width:100,height:220,
      orientation:'vertical',centerX:0.50,centerY:(66/220),verticalStep:27,
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
    if(config.orientation==='vertical'){
      const centerX=config.width*(config.centerX ?? 0.5);
      const centerY=config.height*(config.centerY ?? 0.5);
      const step=Number(config.verticalStep) || 21;
      const firstCenterY=centerY-((list.length-1)*step/2);
      return list.map((deviceId,index)=>{
        const size=deviceSizes[deviceId] || {width:13,height:13};
        return {
          deviceId,
          x:Math.round(centerX-size.width/2),
          y:Math.round(firstCenterY+index*step-size.height/2),
          width:size.width,
          height:size.height,
          context
        };
      });
    }
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

  // The artwork of each catalog device on a ribbon: the manifest id, and the scale that reproduces the size the device had on the
  // catalog's precomposed ribbons (assets/ribbons/military-variants.json device_assets, scale_to_match_raster).
  const RIBBON_DEVICE_ART=Object.freeze({
    BRONZE_OLC:{asset:'mil-device-olc-bronze',scale:0.924},SILVER_OLC:{asset:'mil-device-olc-silver',scale:0.924},
    BRONZE_SERVICE_STAR:{asset:'device-star-bronze',scale:1.208},SILVER_SERVICE_STAR:{asset:'device-star-silver',scale:1.208},
    GOLD_AWARD_STAR:{asset:'device-star-gold',scale:1},SILVER_AWARD_STAR:{asset:'device-star-silver',scale:1},
    V_DEVICE:{asset:'device-v',scale:1},C_DEVICE:{asset:'mil-device-letter-c',scale:1},R_DEVICE:{asset:'mil-device-letter-r',scale:1},
    M_DEVICE:{asset:'mil-device-letter-m',scale:1.345},N_DEVICE:{asset:'mil-device-letter-n',scale:1.295},
    BRONZE_HOURGLASS:{asset:'mil-device-hourglass-bronze',scale:1},SILVER_HOURGLASS:{asset:'mil-device-hourglass-silver',scale:1},
    GOLD_HOURGLASS:{asset:'mil-device-hourglass-gold',scale:1},ARROWHEAD_DEVICE:{asset:'mil-device-arrowhead',scale:1}
  });
  function ribbonDeviceArt(deviceId){
    if(RIBBON_DEVICE_ART[deviceId]) return RIBBON_DEVICE_ART[deviceId];
    const numeral=/^NUMERAL_(\d+)$/.exec(String(deviceId));
    return numeral ? {asset:`mil-device-numeral-${Number(numeral[1])}`,scale:1} : null;
  }

  // Where a ribbon's devices go in inches from its top-left: the 'ribbon' slots above on the real ribbon, device centres (the recipes of
  // assets/ribbons/military-variants.json are this rule; tests/military-ribbon-art.test.cjs compares all 344). The engine draws the plan.
  function ribbonDevicePlan(devices,{ribbonW=1.375,ribbonH=0.375}={}){
    const config=DEFAULT_CONTEXTS.ribbon;
    const known=[...(devices || [])].filter(ribbonDeviceArt);
    const slots=normalizedSlots(known.length,config);
    return known.map((deviceId,index)=>{
      const art=ribbonDeviceArt(deviceId);
      return {deviceId,id:art.asset,x:ribbonW*slots[index],y:ribbonH*config.centerY,scale:art.scale};
    });
  }

  return {DEFAULT_CONTEXTS,normalizedSlots,layoutDevices,ribbonDeviceArt,ribbonDevicePlan};
});
