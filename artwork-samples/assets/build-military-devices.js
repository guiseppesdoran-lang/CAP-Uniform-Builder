// Military ribbon devices -> real-inch SVG (assets/devices/mil-device-*). Existing CAP devices are reused (stars, V, clasps).
// Sizes: measured from the repository's precomposed ribbon variants where a device appears there
// (tools/military/measure-devices.js -> devices/_military-device-sizes.json), otherwise estimated (basis recorded).
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const HERE=__dirname,REPO=path.join(HERE,'../..'),U=100;
const f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const OUT=path.join(HERE,'devices');fs.mkdirSync(OUT,{recursive:true});
const SIZES=JSON.parse(fs.readFileSync(path.join(OUT,'_military-device-sizes.json')));
const CAPS=JSON.parse(fs.readFileSync(path.join(HERE,'tools/glyphs_arialbold_cap.json')));
const DIG=JSON.parse(fs.readFileSync(path.join(HERE,'tools/glyphs_arialblack.json')));
const METAL={
  bronze:{hi:'#e0a374',mid:'#b4713f',lo:'#6f4122',edge:'#4a2a14'},
  silver:{hi:'#f4f6f8',mid:'#c3c8ce',lo:'#7d848c',edge:'#4b5057'},
  gold:{hi:'#fff2a8',mid:'#e2b21c',lo:'#9a6a05',edge:'#5f4103'},
};
const gradDef=(id,m)=>`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>`;
// metal of each repo device raster, by sampled mean colour (so the SVG matches the colour the catalog already uses)
const tmp=fs.mkdtempSync('/tmp/mildev-');
function metalOf(rel){
  try{const out=path.join(tmp,path.basename(rel)+'.ppm');execSync(`sips -s format bmp "${path.join(REPO,rel)}" --out "${out}.bmp" >/dev/null 2>&1`);
    // read 24/32-bit BMP
    const b=fs.readFileSync(out+'.bmp'),off=b.readUInt32LE(10),w=b.readInt32LE(18),h=Math.abs(b.readInt32LE(22)),bpp=b.readUInt16LE(28),Bp=bpp/8,row=Math.ceil(w*Bp/4)*4;
    let r=0,g=0,bl=0,n=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=off+y*row+x*Bp,B=b[i],G=b[i+1],R=b[i+2];if(R>235&&G>235&&B>235)continue;r+=R;g+=G;bl+=B;n++;}
    if(!n)return 'silver';r/=n;g/=n;bl/=n;
    const sat=Math.max(r,g,bl)-Math.min(r,g,bl);
    if(sat<28)return 'silver';
    return (r>g*1.18&&g>bl*1.35&&g<r*0.82)?'bronze':'gold';
  }catch(e){return 'silver';}}
const root=({id,name,wIn,hIn,meta,defs,body})=>{
  const vbW=+(wIn*U).toFixed(2),vbH=+(hIn*U).toFixed(2);
  const m={asset_id:id,name,size_in:{w:+wIn.toFixed(4),h:+hIn.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,vbW,vbH],...meta};
  return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${wIn.toFixed(4)}in" height="${hIn.toFixed(4)}in" viewBox="0 0 ${vbW} ${vbH}" data-asset-id="${id}" data-source="original" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata><defs>${defs}</defs>${body}</svg>`,spec:m};};
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.map(x=>+(+x).toFixed(2))]));
let count=0;const made=[];
// local = [x0,y0,x1,y1] of the drawing; width of that box maps to physIn (aspect kept)
function place({id,name,mn,local,physIn,sizeSource,sizeBasis,draw,dims,feature,deviceKey}){
  const [x0,y0,x1,y1]=local,s=physIn*U/(x1-x0),W=(x1-x0)*s,H=(y1-y0)*s,gid=`${id}__grad`;
  const an=std(W,H);for(const [k,[px,py]] of Object.entries(feature||{}))an[k]=[(px-x0)*s,(py-y0)*s];
  const R=root({id,name,wIn:W/U,hIn:H/U,defs:gradDef(gid,METAL[mn]),
    body:`<g id="${id}__geometry" transform="translate(${f2(-x0*s)} ${f2(-y0*s)}) scale(${s.toFixed(5)})">${draw(gid,METAL[mn])}</g>`,
    meta:{size_source:sizeSource,size_basis:sizeBasis,anchors:r2(an),dimensions:{width_in:+(W/U).toFixed(4),height_in:+(H/U).toFixed(4),...dims},metal:mn,grade:'device',
      catalog_device:deviceKey||null,fit:{method:'n/a (original drawing)',score:null}}});
  fs.writeFileSync(path.join(OUT,id+'.svg'),R.svg);fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify(R.spec,null,1));
  made.push({id,device:deviceKey,w_in:+(W/U).toFixed(4),h_in:+(H/U).toFixed(4),size_source:sizeSource});count++;}
const measured=(key,what)=>{const m=SIZES[key];return m?{physIn:m.w_in,sizeSource:'measured',
  sizeBasis:`measured ${m.samples} composite(s) in images/military-ribbon-variants (100x30 px = 1 3/8 x 3/8 in): ${m.w_px} x ${m.h_px} px = ${m.w_in} x ${m.h_in} in. The DoD manual size was not available to this build`}:null;};

// ---- oak leaf cluster (bronze / silver): 3 oak leaves fanned from a stem, two acorns
const leaf=(rot,len,wid)=>{ // lobed oak-leaf outline along +x then rotated; base at origin
  const lobes=4;let d=`M0,0`;
  for(let i=1;i<=lobes;i++){const x=len*i/lobes,w=wid*(1-Math.abs(i-lobes*0.55)/(lobes*0.9));d+=` Q${f2(x-len/lobes*0.5)},${f2(-w*1.15)} ${f2(x)},${f2(-w*0.45)}`;}
  d+=` L${f2(len*1.06)},0`;
  for(let i=lobes;i>=1;i--){const x=len*i/lobes,w=wid*(1-Math.abs(i-lobes*0.55)/(lobes*0.9));d+=` Q${f2(x-len/lobes*0.5)},${f2(w*1.15)} ${f2(x-len/lobes)},${f2(w*0.45)}`;}
  return `<path d="${d} Z" transform="rotate(${rot})"/>`;};
for(const mn of ['bronze','silver']){
  const key=mn.toUpperCase()+'_OLC',M=measured(key);
  place({id:`mil-device-olc-${mn}`,name:`${mn[0].toUpperCase()+mn.slice(1)} Oak Leaf Cluster`,mn,deviceKey:key,local:[10,2,112,78],
    physIn:0.3125,sizeSource:'estimated',
    sizeBasis:'5/16 in long (0.3125 in): figure reported by the coordination chat from AR 670-1 (Army, secondary; DoDM 1348.33 not located) for service, unit-award and miniature suspension ribbons. The two mirror pages fetched during this build (ar670.com/?p=1328, 2ndbde.org device_appurtenances.php) do not themselves state device sizes, so it is not recorded as regulation. Composite in the repo variants measures '+(M?M.w_in:'n/a')+' in',
    feature:{stem_base:[60,78]},dims:{leaves:3,acorns:2,shape:'cluster of three oak leaves and two acorns, horizontal'},
    draw:(g,m)=>{
      // a slanted branch (bottom-left to top-right) with oak leaves alternating either side and two acorns at the base
      const stem=`<path d="M14,66 C40,58 70,44 106,24" fill="none" stroke="${m.edge}" stroke-width="3" stroke-linecap="round"/>`;
      const L=(x,y,rot,len,w)=>`<g transform="translate(${x} ${y}) rotate(${rot})" fill="url(#${g})" stroke="${m.edge}" stroke-width="1.2" stroke-linejoin="round">${leaf(0,len,w)}</g>`;
      const lv=[L(30,60,-62,34,8),L(30,60,20,32,8),L(54,48,-70,34,8),L(54,48,12,30,8),L(80,36,-76,32,8),L(80,36,2,28,7)].join('');
      const ac=[[24,70],[40,66]].map(([x,y])=>`<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" fill="url(#${g})" stroke="${m.edge}" stroke-width="1.2"/><path d="M${x-6},${y-3} Q${x},${y-10} ${x+6},${y-3} L${x+5},${y} Q${x},${y-6} ${x-5},${y} Z" fill="${m.lo}" stroke="${m.edge}" stroke-width="1"/>`).join('');
      return stem+lv+ac;}});
}
// ---- hourglass (bronze / silver / gold)
for(const mn of ['bronze','silver','gold']){
  const key=mn.toUpperCase()+'_HOURGLASS',M=measured(key);
  place({id:`mil-device-hourglass-${mn}`,name:`${mn[0].toUpperCase()+mn.slice(1)} Hourglass`,mn,deviceKey:key,local:[12,10,80,90],
    physIn:M?M.physIn:0.18,sizeSource:M?M.sizeSource:'estimated',sizeBasis:M?M.sizeBasis:'estimated',
    feature:{waist:[46,50]},dims:{shape:'two opposed triangles with end bars'},
    draw:(g,m)=>`<g fill="url(#${g})" stroke="${m.edge}" stroke-width="2" stroke-linejoin="round"><polygon points="14,12 78,12 46,50"/><polygon points="14,88 78,88 46,50"/></g><polygon points="22,18 70,18 46,46" fill="${m.hi}" opacity=".4"/>`});
}
// ---- arrowhead (Army), bronze
{const key='ARROWHEAD_DEVICE';
 place({id:'mil-device-arrowhead',name:'Arrowhead Device',mn:'bronze',deviceKey:key,local:[2,4,78,90],physIn:0.2,sizeSource:'estimated',
  sizeBasis:'not present in any precomposed variant; 0.20 in wide estimated from the other attachments in the same measured set',
  feature:{tip:[40,4]},dims:{shape:'arrowhead pointing up, notched base'},
  draw:(g,m)=>`<polygon points="40,4 78,88 40,68 2,88" fill="url(#${g})" stroke="${m.edge}" stroke-width="2.2" stroke-linejoin="round"/><polygon points="40,4 40,68 2,88" fill="${m.lo}" opacity=".45"/>`});}
// ---- letter devices C, R, M, N (outlines of Arial Bold capitals converted to paths; no <text>)
for(const [ch,key] of [['C','C_DEVICE'],['R','R_DEVICE'],['M','M_DEVICE'],['N','N_DEVICE']]){
  const gl=CAPS[ch],[bx0,by0,bx1,by1]=gl.bbox,mn=metalOf(`images/devices/military/${ch.toLowerCase()}_device.png`);
  const M=SIZES[key];
  // size the letter by its measured composite height when we have one; otherwise use N's measured height
  const hIn=M?M.h_in:(SIZES.N_DEVICE?SIZES.N_DEVICE.h_in:0.1875);
  const physIn=hIn*(bx1-bx0)/(by1-by0);
  place({id:`mil-device-letter-${ch.toLowerCase()}`,name:`"${ch}" Device`,mn,deviceKey:key,local:[bx0-2,by0-2,bx1+2,by1+2],
    physIn:physIn*((bx1-bx0+4)/(bx1-bx0)),sizeSource:M?'measured':'estimated',
    sizeBasis:M?`letter height measured in composites: ${M.h_px} px of 30 = ${M.h_in} in; width follows the Arial Bold capital`:`not present in any precomposed variant; height set to the measured N device (${hIn} in)`,
    feature:{baseline_center:[(bx0+bx1)/2,by1]},dims:{letter:ch,cap_height_in:hIn,font_outline_source:'Arial Bold, converted to paths'},
    draw:(g,m)=>`<path d="${gl.d}" fill="url(#${g})" stroke="${m.edge}" stroke-width="1.6" stroke-linejoin="round"/>`});
}
// ---- numerals 2..99 (Arial Black outlines)
const NUM_METAL=metalOf('images/devices/military/numeral_12.png');
for(let n=2;n<=99;n++){
  const str=String(n),gs=[...str].map(c=>DIG[c]),sz=1,ls=-1.5;let x=0;const runs=[];
  gs.forEach(g=>{runs.push({x,g});x+=g.adv*sz+ls;});
  const minx=Math.min(...runs.map(r=>r.x+r.g.bbox[0])),maxx=Math.max(...runs.map(r=>r.x+r.g.bbox[2]));
  const top=Math.min(...gs.map(g=>g.bbox[1])),bot=Math.max(...gs.map(g=>g.bbox[3]));
  const hIn=0.1875,physIn=hIn*(maxx-minx+4)/(bot-top+4);
  place({id:`mil-device-numeral-${n}`,name:`Numeral ${n}`,mn:NUM_METAL,deviceKey:'NUMERAL',local:[minx-2,top-2,maxx+2,bot+2],physIn,
    sizeSource:'estimated',sizeBasis:'numeral height 3/16 in estimated (same height as the measured service star); no numeral appears in the precomposed variants',
    feature:{baseline_center:[(minx+maxx)/2,bot]},dims:{numeral:n,height_in:hIn,font_outline_source:'Arial Black, converted to paths'},
    draw:(g,m)=>runs.map(r=>`<path transform="translate(${f2(r.x)} 0)" d="${r.g.d}" fill="url(#${g})" stroke="${m.edge}" stroke-width="1.4" stroke-linejoin="round"/>`).join('')});
}
fs.writeFileSync(path.join(OUT,'_military-devices.json'),JSON.stringify(made,null,1));
console.log('devices built',count);
