// CAP seal (CAPR 39-1 Fig A6-4, "CAP Crest and Seal": 2 1/2 in medallion, blue-background version) as clean vector art.
// Unit = inches, centred on (0,0), outer radius 1.25. Lettering is outlined Arial Bold glyphs set on the ring arcs (no <text>);
// the shield/eagle is the same measured CAP Crest art used on the blazer. No raster is embedded.
module.exports=function sealArt(GLY,crestArt){
  const f=n=>(+n).toFixed(3),R=1.25,k0=1/71.58;
  const GOLD='#d9b13c',GOLD_D='#a9791c',CREAM='#f4eed6',FIELD='#1d3a84',FIELD_D='#122a68';
  const arc=(str,r,capH,center,top,track=0.012)=>{const k=capH*k0,ch=[...str],adv=ch.map(c=>c===' '?28:GLY[c].adv);
    const w=i=>adv[i]*k+track,tot=adv.reduce((a,_,i)=>a+w(i),0)/r;let acc=0,out='';
    ch.forEach((c,i)=>{const mid=(acc+w(i)/2)/r;acc+=w(i);if(c===' ')return;
      const a=top?(-tot/2+mid)*180/Math.PI:(tot/2-mid)*180/Math.PI;
      out+=`<g transform="rotate(${f(center+a)}) translate(0 ${top?f(-r):f(r)}) scale(${(k).toFixed(5)}) translate(${f(-GLY[c].adv/2)} 0)"><path d="${GLY[c].d}"/></g>`;});
    return out;};
  const star=(cx,cy,r)=>{let p='';for(let i=0;i<10;i++){const a=(-90+i*36)*Math.PI/180,rr=i%2?r*0.4:r;p+=(i?'L':'M')+f(cx+rr*Math.cos(a))+','+f(cy+rr*Math.sin(a));}return p+'Z';};
  const stars=Array.from({length:13},(_,i)=>{const a=(-90+i*360/13)*Math.PI/180;return `<path d="${star(0.74*Math.cos(a),0.74*Math.sin(a),0.075)}"/>`;}).join('');
  const rope=Array.from({length:72},(_,i)=>{const a=i*5*Math.PI/180;return `<circle cx="${f(1.2*Math.cos(a))}" cy="${f(1.2*Math.sin(a))}" r="0.035"/>`;}).join('');
  const kc=1.0/705;
  return `<g>`
   +`<circle r="${R}" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".02"/><g fill="${GOLD_D}" fill-opacity=".55">${rope}</g>`
   +`<circle r="1.12" fill="${CREAM}" stroke="${GOLD_D}" stroke-width=".02"/>`
   +`<circle r="0.86" fill="${FIELD}" stroke="${FIELD_D}" stroke-width=".03"/>`
   +`<g fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".008">${stars}</g>`
   +`<g fill="${GOLD_D}">${arc('UNITED STATES AIR FORCE AUXILIARY',0.925,0.115,0,true,0.012)}${arc('CIVIL AIR PATROL',1.055,0.115,0,false,0.02)}</g>`
   +`<g transform="translate(0 -0.5) scale(${kc.toFixed(6)}) translate(0 -20)">${crestArt.svg}</g>`
   +`</g>`;
};
