// Plain-language text for where a badge is worn. The builder keeps the regulation's
// abbreviations (CAPR 39-1 Attachment 4) internally; members should not have to know them.
(function capubBadgeCaptionsModule(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CAPUBBadgeCaptions=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function(){
  'use strict';

  // Attachment 4 legend, plus FON (the builder's female specialty-track row) and OLPF
  // (the NRA badge, worn on the left pocket flap).
  const PHRASES=Object.freeze({
    ORP:'Above the right pocket',
    OLP:'Above the left pocket',
    UN:'Below the nametag',
    ON:'Above the nametag',
    URBP:'Below the right pocket',
    OLPA:'Above the left pocket, over aviation badges',
    OLPU:'Above the left pocket, under aviation badges',
    LP:'On the left pocket',
    RP:'On the right pocket',
    'LP,RP':'On the left or right pocket',
    LB:'On the left breast',
    RB:'On the right breast',
    FON:'Above the nameplate',
    OLPF:'On the left pocket flap'
  });

  // Input is a slot label from getBadgeSlotLabel(): a code, optionally followed by a dash and a
  // note ("UN — graduated commander", "LP only — not rendered unless selected first").
  // Anything not recognised comes back unchanged rather than guessed at.
  function placementCaption(slotLabel){
    const label=String(slotLabel || '').trim();
    if(!label) return '';
    const match=/^([A-Z]+(?:,[A-Z]+)?)(?:\s+only)?(?:\s+[—-]\s+(.+))?$/.exec(label);
    if(!match) return label;
    const phrase=PHRASES[match[1]];
    if(!phrase) return label;
    const note=match[2] ? match[2].trim() : '';
    return note ? `${phrase} (${note})` : phrase;
  }

  return {PHRASES,placementCaption};
});
