// Women's mess dress skirts, the two types authorised by CAPR 39-1 4.1.2.3 (as changed by the interim change):
//   - a-line        : primary, A-line style without the split
//   - straight-split: optional straight hanging skirt with the side split to the top of the knee
// Both are ankle length (no higher than the ankle, no longer than the bottom of the heel). Standalone assets registered to
// garment-mess-dress-female: same x origin and centreline, same y origin, taller box. Draw them BEHIND the jacket; the jacket's
// cut-away tails and the cummerbund cover the top of the skirt. Navy matches the jacket body (#001c52).
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),U=100,OUTDIR=path.join(__dirname,'..','assets','garments');
const jacket=JSON.parse(fs.readFileSync(path.join(OUTDIR,'garment-mess-dress-female.spec.json'),'utf8'));
const W=jacket.size_in.w,CX=W/2,ART_Y=0.25;             // jacket art group is translated 0.25 in down (25 uu)
const WAIST=19.2,HIP=27.2,KNEE_TOP_BELOW_WAIST=20,LEN=36; // inches below the box top / below waist (estimated, see assumed[])
const HEM=WAIST+LEN,H=HEM+0.4;
const half={waist:7.4,hip:9.4},JHEM=8.84,JHEM_Y=32.93;   // jacket hem half-width and y read from mess_dress_female_outline.json
const NAVY='#001c52',SEAM='#00102f';
const VARIANTS=[
 {key:'a-line',name:"Women's mess dress skirt, A-line without split (primary type)",hemHalf:12.7,split:false,
  doc:['primary mess dress skirt is the A-line style without the split (CAPR 39-1 4.1.2.3)','ankle length: no higher than the ankle, no longer than the bottom of the heel (4.1.2.3)']},
 {key:'straight-split',name:"Women's mess dress skirt, straight hanging with side split to the top of the knee (optional type)",hemHalf:8.5,split:true,
  doc:['optional straight hanging skirt with the side split to the top of the knee, available through AAFES or MCSS as a special order (CAPR 39-1 4.1.2.3)','ankle length: no higher than the ankle, no longer than the bottom of the heel (4.1.2.3)']}];
function curve(pts){return pts.map(p=>f(CX+p[0])+','+f(p[1])).join('L');}
function build(v){
  const id='garment-mess-dress-skirt-female-'+v.key,hemY=HEM,splitTop=hemY-(LEN-KNEE_TOP_BELOW_WAIST);
  // right edge, waist -> hip -> hem (slight curve through hip)
  // right edge, waist -> jacket hem -> ankle. At the jacket hem the skirt is exactly as wide as the jacket (JHEM half-width), so jacket and
  // skirt read as one garment; the A-line flares below it, the straight skirt hangs.
  const R=[[half.waist,WAIST],[half.waist+0.5,WAIST+4.6],[JHEM-0.35,JHEM_Y-3.6],[JHEM,JHEM_Y],[JHEM+(v.hemHalf-JHEM)*0.42,JHEM_Y+(hemY-JHEM_Y)*0.45],[v.hemHalf,hemY]];
  const Lf=R.map(p=>[-p[0],p[1]]).reverse();
  let d='M'+curve(R)+'L'+curve(Lf)+'Z';
  let g=`<g id="art" transform="scale(100)"><path id="skirt-body" d="${d}" fill="${NAVY}" stroke="${SEAM}" stroke-width=".04" stroke-linejoin="round"/>`
   +`<path id="skirt-shade" d="${d}" fill="url(#skirtShade)"/>`
   +`<path id="waistband-line" d="M${f(CX-half.waist)},${f(WAIST+0.06)}L${f(CX+half.waist)},${f(WAIST+0.06)}" stroke="${SEAM}" stroke-width=".04" stroke-opacity=".6"/>`;
  const sideX=y=>{const t=(y-WAIST)/(hemY-WAIST);let a=R[0],b=R[1];for(let i=0;i<R.length-1;i++)if(y>=R[i][1]&&y<=R[i+1][1]){a=R[i];b=R[i+1];break;}return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);};
  const LM={};
  if(v.split){
    // side splits seen from the front: a narrow dark wedge opening at the hem and closing at the top of the knee, on both sides
    for(const s of [-1,1]){const xt=sideX(splitTop),xh=v.hemHalf,wdg=0.7;
      const P=[[s*(xt-0.0),splitTop],[s*(xh),hemY],[s*(xh-wdg),hemY]];
      g+=`<path id="side-split-${s<0?'right':'left'}" d="M${curve(P)}Z" fill="#000a26" stroke="#00102f" stroke-width=".03" stroke-linejoin="round"/>`;
      LM['side_split_'+(s<0?'right':'left')]={x:+((CX+Math.min(s*xt,s*xh,s*(xh-wdg)))*U).toFixed(2),y:+(splitTop*U).toFixed(2),w:+(Math.abs(xh-xt+0)*U).toFixed(2),h:+((hemY-splitTop)*U).toFixed(2)};}
  } else {
    // A-line: a faint centre-front gore line and two side gore lines (six-gore cut)
    for(const s of [-1,1])g+=`<path d="M${f(CX+s*3.0)},${f(WAIST+0.2)}L${f(CX+s*(v.hemHalf*0.38))},${f(hemY)}" stroke="${SEAM}" stroke-width=".03" stroke-opacity=".35"/>`;
  }
  // shadow cast by the jacket hem on the skirt (the jacket overhangs the skirt top)
  g+=`<path id="hem-shadow" d="M${f(CX-JHEM)},${f(JHEM_Y)}L${f(CX+JHEM)},${f(JHEM_Y)}L${f(CX+JHEM)},${f(JHEM_Y+0.75)}L${f(CX-JHEM)},${f(JHEM_Y+0.75)}Z" fill="url(#hemShade)"/>`;
  g+='</g>';
  const defs=`<defs><linearGradient id="hemShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient><linearGradient id="skirtShade" gradientUnits="userSpaceOnUse" x1="${f(CX-v.hemHalf)}" y1="0" x2="${f(CX+v.hemHalf)}" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset=".2" stop-color="#000" stop-opacity=".06"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>`;
  const Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2),c=W*U/2;
  const anchors={top_center:[c,0],bottom_center:[c,Hu],center:[c,Hu/2],left_edge:[0,Hu/2],right_edge:[Wu,Hu/2],
    waist_center:[c,+(WAIST*U).toFixed(2)],hip_center:[c,+(HIP*U).toFixed(2)],hem_center:[c,+(hemY*U).toFixed(2)],
    hem_right:[+((CX-v.hemHalf)*U).toFixed(2),+(hemY*U).toFixed(2)],hem_left:[+((CX+v.hemHalf)*U).toFixed(2),+(hemY*U).toFixed(2)]};
  if(v.split){anchors.split_top_right=[+((CX-sideX(splitTop))*U).toFixed(2),+(splitTop*U).toFixed(2)];anchors.split_top_left=[+((CX+sideX(splitTop))*U).toFixed(2),+(splitTop*U).toFixed(2)];}
  const meta={asset_id:id,name:v.name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],size_source:'estimated',
    size_basis:`Registered to garment-mess-dress-female (same x origin and centreline, same y origin; box extended downward to the hem). Waist ${WAIST} in below the top of the box, ${LEN} in waist-to-hem (ankle length, 4.1.2.3: no higher than the ankle, no longer than the bottom of the heel); widths are a plain pattern estimate, no figure shows the lower skirt.`,
    anchors,landmarks:LM,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in), origin top-left of the artwork box',overlay_of:'garment-mess-dress-female',
    documented:v.doc,assumed:['waist-to-hem length 36 in (ankle length, estimated for an adult woman)','waist half-width 7.4 in; half-width equals the jacket hem (8.84 in) at the jacket hem line y 32.93 in',v.split?'hem half-width 8.9 in and split opening 0.7 in; split top 20 in below the waist (top of the knee)':'hem half-width 12.7 in (kept inside the jacket box width) (flare of the A-line)','fabric colour matches the jacket body'],
    fit:{method:'original',score:null},grade:'base'};
  const svg0=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="original" data-units="0.01in"><title>${v.name}</title><metadata>${JSON.stringify(meta).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</metadata>${defs}${g}</svg>`;
  const svg=svg0.replace(/\sid="([^"]+)"/g,(m,i)=>i===id?m:` id="${id}__${i}"`).replace(/url\(#([^)]+)\)/g,(m,i)=>`url(#${id}__${i})`);
  fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(meta,null,1));console.log('ok',id,svg.length);return id;}
VARIANTS.forEach(build);
