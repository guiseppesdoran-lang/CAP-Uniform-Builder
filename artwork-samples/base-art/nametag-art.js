// CAP nametag art for the overlay assets (CAPR 39-1 4.1.5.2.2.2, 4.1.9.4.2, 4.1.11.1.1.2.1, 4.1.12.2.4.1). Units = inches; centred on (cx,cy).
//  cadet : blue, three-line, white lettering, name line left blank
//  gray  : adult members on the blue shirt/blouse (Class B): same three-line plate in gray
//  silver: officers/NCOs on the Class A coat: brushed satin silver metal, last name engraved in blue (name left blank)
module.exports=function(lettering){
  const f=n=>(+n).toFixed(3);
  const three=(cx,cy,w,h,fill,stroke,ink,title)=>`<g id="nametag"><rect id="nametag-plate" x="${f(cx-w/2)}" y="${f(cy-h/2)}" width="${w}" height="${h}" rx=".05" fill="${fill}" stroke="${stroke}" stroke-width=".04"><title>${title}</title></rect>`
    +lettering('CIVIL AIR PATROL',cx,cy-h*0.3,0.11,ink,0.05,1.18)
    +lettering('UNITED STATES AIR FORCE AUXILIARY',cx,cy-h*0.1,0.09,ink,0.04,2.9)+`</g>`;
  return {
    cadet:(cx,cy,w=3.375,h=0.75)=>three(cx,cy,w,h,'#212c54','#5f6c96','#dfe3ee','Cadet nametag: blue, three-line, white lettering, name line blank'),
    gray:(cx,cy,w=3.375,h=0.75)=>three(cx,cy,w,h,'#6c727b','#9aa1ab','#f1f3f6','Adult member nametag (Class B): gray, three-line, white lettering, name line blank'),
    silver:(cx,cy,w=3.375,h=0.75)=>`<g id="nametag"><defs><linearGradient id="ntSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eceef1"/><stop offset=".5" stop-color="#c3c7ce"/><stop offset="1" stop-color="#9fa4ad"/></linearGradient></defs>`
      +`<rect id="nametag-plate" x="${f(cx-w/2)}" y="${f(cy-h/2)}" width="${w}" height="${h}" rx=".06" fill="url(#ntSilver)" stroke="#7d828b" stroke-width=".035"><title>Officer/NCO nametag: brushed satin silver metal, last name engraved in blue (name left blank)</title></rect>`
      +`<rect x="${f(cx-w/2+0.06)}" y="${f(cy-h/2+0.06)}" width="${w-0.12}" height="${h-0.12}" rx=".03" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".02"/></g>`
  };
};
