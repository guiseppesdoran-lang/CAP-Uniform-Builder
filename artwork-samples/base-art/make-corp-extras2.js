// Corporate Service Dress extras that are not badges: CAP regimental tie, black bow tie (semi-formal), tie clasp, standalone CAP Crest.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;
fs.mkdirSync(OUTDIR,{recursive:true});
const DEFS2=`<defs>
<linearGradient id="coatShade" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".12" stop-color="#000" stop-opacity=".08"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
<linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="btn" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#cfd3da"/><stop offset="1" stop-color="#8d939e"/></radialGradient>
<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ea"/><stop offset="1" stop-color="#a9aeb8"/></linearGradient>
</defs>`;
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
const GLYB=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialblack_cap.json')));
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null,T=GLY)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:T[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${T[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
const stitch=d=>`<path d="${d}" fill="none" stroke="#000a22" stroke-opacity=".55" stroke-width=".035" stroke-dasharray=".12 .08"/>`;
const seam=(d,w=.07)=>`<path d="${d}" fill="none" stroke="${STROKE}" stroke-opacity=".32" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const nsIds=(svg,prefix)=>{const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
  return svg.replace(/(\sid=")([^"]+)(")/g,(m,a,id,c)=>a+prefix+'__'+id+c).replace(/url\(#([^)]+)\)/g,(m,id)=>ids.has(id)?`url(#${prefix}__${id})`:m);};
const attrsOf=t=>Object.fromEntries([...t.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function el(svg,id){const m=svg.match(new RegExp(`<(rect|path|g|circle)\\s[^>]*\\bid="${id}"[^>]*>`));return m?{tag:m[1],at:attrsOf(m[0]),end:m.index+m[0].length}:null;}
function lmRect(svg,id,vb){const e=el(svg,id);if(!e)return null;let at=e.at;
  if(e.tag==='g'){const r=svg.slice(e.end).match(/<rect\s[^>]*>/);at=attrsOf(r[0]);}
  return {x:+((+at.x-vb.x)*U).toFixed(2),y:+((+at.y-vb.y)*U).toFixed(2),w:+(at.width*U).toFixed(2),h:+(at.height*U).toFixed(2)};}
function lmPoly(svg,id,vb){const e=el(svg,id);if(!e)return null;const n=e.at.d.match(/-?\d*\.?\d+/g).map(Number),p=[];
  for(let i=0;i+1<n.length;i+=2)p.push([+((n[i]-vb.x)*U).toFixed(2),+((n[i+1]-vb.y)*U).toFixed(2)]);return p;}
const lmCen=r=>[+(r.x+r.w/2).toFixed(2),+(r.y+r.h/2).toFixed(2)];
const lmBox=p=>{const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};};
function conv({id,name,vb,body,source,meta}){
  const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}${art}</svg>`;
  svg=nsIds(svg,id);
  fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=a=>a.map(v=>+(+v).toFixed(2));

const crestArt=require('./crest-art.js')(GLY);
function emit(dir,{id,name,w,h,body,anchors,LM,basis,documented,assumed,defs=''}){
  const OD=path.join(here,'..','assets',dir);fs.mkdirSync(OD,{recursive:true});
  const Wu=+(w*U).toFixed(2),Hu=+(h*U).toFixed(2);
  const m={asset_id:id,name,size_in:{w:+w.toFixed(4),h:+h.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],size_source:'estimated',size_basis:basis,
    anchors:Object.fromEntries(Object.entries({...std(Wu,Hu),...anchors}).map(([k,v])=>[k,r2(v)])),landmarks:LM||{},landmarks_note:'rects are {x,y,w,h}; all in user units (0.01 in), origin top-left',
    documented,assumed,fit:{method:'original',score:null},grade:'accessory'};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(4)}in" height="${h.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="original" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}<g id="art" transform="scale(${U})">${defs}${body}</g></svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OD,id+'.svg'),svg);fs.writeFileSync(path.join(OD,id+'.spec.json'),JSON.stringify(m,null,1));console.log('ok',dir+'/'+id);}
// ===== Corporate service dress extras, round 2: women's tie tab, tie tacks with emblems =====
const src=fs.readFileSync(path.join(here,'make-blues-a.js'),'utf8');
const hapSrc=src.slice(src.indexOf('const star5='),src.indexOf('const capCrest='));
const {star5,hapArnold}=new Function('f',hapSrc+';return {star5,hapArnold};')(f);
const TAB='#0d2a66';
// ---- blue inverted-V tie tab (CAPR 39-1 4.2.4.3 / 4.2.6.3): flat satin band under the collar, self-fastening tails not drawn
{ const W=2.7,H=1.6,t=0.7,top=0.5,ap=0.95;
  const P=[[-top,0],[top,0],[W/2,H],[W/2-t,H],[0,ap],[-W/2+t,H],[-W/2,H]].map(p=>[p[0]+W/2,p[1]]);
  const body=`<path id="tab" d="M${P.map(p=>f(p[0])+','+f(p[1])).join('L')}Z" fill="${TAB}" stroke="#061a44" stroke-width=".025" stroke-linejoin="round"/>`
    +`<path d="M${f(W/2-top+0.05)},.08 L${f(W/2+top-0.05)},.08" stroke="#fff" stroke-opacity=".18" stroke-width=".03" stroke-linecap="round"/>`;
  emit('accessories',{id:'tie-tab-inverted-v',name:'Blue satin inverted-V tie tab (USAF style)',w:W,h:H,body,anchors:{neck_attach_center:[W/2*U,0],apex_center:[W/2*U,ap*U]},
    basis:'Shape and colour are as the regulation names them (blue, USAF-style inverted V with self-fastening tails; 4.2.4.3, 4.2.6.3). The regulation gives no dimensions: 2.7 in wide by 1.6 in tall with 0.7 in legs is an estimate matched to the collar opening of the base shirts.',
    documented:['blue satin inverted-V tie tab with self-fastening tails (4.1.2.2.1, 4.2.4.3)','worn with the aviator shirt or a white collared blouse; not with a turtleneck or shell (4.2.4.3)','mandatory with the women\'s long-sleeve blue blouse, optional with the short sleeve (4.1.12.4)'],
    assumed:['2.7 x 1.6 in overall, 0.7 in legs','blue','tails not drawn']});
}
// ---- tie tacks with an emblem (4.2.3.4: CAP coat of arms, "Wing and Star" design, AF symbol or grade insignia; centred between knot and tip)
for(const [id,nm,metal] of [['tie-tack-wing-and-star','Tie tack, Hap Arnold "Wing and Star" (silver tone)','s'],['tie-tack-wing-and-star-gold','Tie tack, Hap Arnold "Wing and Star" (gold tone)','g']]){
  const pal=metal==='s'?['#5b5f68','#c4c8d0','#dfe2e8','#3a3d44']:['#7a5a14','#e7c660','#f4de8e','#5a4008'];
  const D=0.62;
  const body=`<g transform="translate(${D/2} ${D/2}) scale(${D/2})">${hapArnold(...pal)}</g>`;
  emit('accessories',{id,name:nm,w:D,h:D,body,anchors:{center:[D/2*U,D/2*U]},
    basis:'Round tie tack carrying the same Hap Arnold wing-and-star art as the Class A service coat button (proportions from the Vanguard 36 ligne button); tack diameter 0.62 in is an estimate, the regulation gives none.',
    documented:['tie tack or clasp may carry the "Wing and Star" design (CAPR 39-1 4.1.11.1.1.3, 4.2.3.4)'],assumed:['0.62 in diameter','metal colours']});}
{ const Hc=0.9,Wc=Hc*586/705;
  const body=`<g transform="scale(${(Hc/705).toFixed(6)}) translate(293 -20)">${crestArt.svg}</g>`;
  emit('accessories',{id:'tie-tack-cap-crest',name:'Tie tack, CAP Crest',w:Wc,h:Hc,body,anchors:{center:[Wc/2*U,Hc/2*U]},
    basis:'The same CAP Crest art as the blazer pocket crest, at 0.9 in tall (estimate; the regulation gives no tack size).',
    documented:['tie tack or clasp may carry the CAP Crest / coat of arms (CAPR 39-1 4.1.11.1.1.3, 4.2.3.4)'],assumed:['0.9 in tall']});}
