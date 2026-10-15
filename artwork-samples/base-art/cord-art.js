// Shoulder cords (CAPR 39-1 9.3: worn on the left shoulder, aligned along the shoulder seam, underneath the epaulet) drawn as a band that follows the
// wearer's LEFT armhole seam: it starts under the epaulet at the neck end of the shoulder seam, runs out over the shoulder point and down the armhole seam.
// Colours/braid from assets/cords/cord-*.spec.json. All geometry in inches in the garment frame (wearer's left = +x); K counter-scales the thickness for scaled garments.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3);
const CORDS=['group','wing','region','national','color-guard','honor-guard','aide-de-camp'];
const colours=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','cords','cord-'+name+'.spec.json'),'utf8'));
module.exports=function(armLeft,K=1){
  const S=armLeft[0],pts=[[S[0]-1.1,S[1]-0.22],[S[0]-0.35,S[1]-0.06],...armLeft.map(p=>[p[0]-0.2,p[1]])];
  const d='M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L'),t=0.36/K;
  const out={},meta={};
  for(const c of CORDS){const sp=colours(c),{main,groove}=sp.colours;
    out[c]=`<g id="cord"><title>${sp.name}, worn along the wearer's left armhole seam under the epaulet (CAPR 39-1 9.3)</title>`
      +`<path id="cord-path" d="${d}" fill="none" stroke="${groove}" stroke-width="${f(t+0.04/K)}" stroke-linejoin="round" stroke-linecap="round"/>`
      +`<path d="${d}" fill="none" stroke="${main}" stroke-width="${f(t)}" stroke-linejoin="round" stroke-linecap="round"/>`
      +`<path d="${d}" fill="none" stroke="${groove}" stroke-width="${f(t)}" stroke-dasharray="${f(0.04/K)} ${f(0.11/K)}" stroke-linejoin="round" stroke-linecap="butt"/></g>`;
    meta[c]={name:sp.name,colours:sp.colours};}
  return {bodies:out,meta,pts,CORDS};};
