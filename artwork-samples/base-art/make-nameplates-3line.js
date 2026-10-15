// CAP 3-line nameplates (CAPR 39-1 Fig A6-3): gray for adults, blue for cadets; "CIVIL AIR PATROL / UNITED STATES AIR FORCE AUXILIARY" + last name (blank).
// Used on the Class B shirt/blouse and the aviator shirt (nametag centred on / resting on the wearer's right pocket).
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),STROKE='#00102f';
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;
fs.mkdirSync(OUTDIR,{recursive:true});
const DEFS2=`<defs>
<linearGradient id="coatShade" gradientUnits="userSpaceOnUse" x1="-12" y1="0" x2="12" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".12" stop-color="#000" stop-opacity=".08"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset=".88" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>
<linearGradient id="topLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="btn" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#cfd3da"/><stop offset="1" stop-color="#8d939e"/></radialGradient>
<linearGradient id="collarIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7e8bb8"/><stop offset="1" stop-color="#b3bcdc"/></linearGradient>
<linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ea"/><stop offset="1" stop-color="#a9aeb8"/></linearGradient>
</defs>`;
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
const GLYB=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialblack_cap.json')));
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null,T=GLY)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:T[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${T[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
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

const OUTD=path.join(here,'..','assets','nameplates');fs.mkdirSync(OUTD,{recursive:true});
const W=3.375,H=0.75;
function plate(id,name,fill,edge,cadet){
  const b=`<rect id="plate-body" x="0" y="0" width="${W}" height="${H}" rx=".04" fill="${fill}" stroke="${edge}" stroke-width=".03"/>`
   +lettering('CIVIL AIR PATROL',W/2,0.12,0.085,'#f2f4f8',0.05,1.28)
   +lettering('UNITED STATES AIR FORCE AUXILIARY',W/2,0.255,0.075,'#f2f4f8',0.04,3.0)
   +`<rect id="name-slot" x="0.35" y="0.36" width="${W-0.7}" height="0.32" fill="none" stroke="none"/>`;
  const LM={plate:{x:0,y:0,w:W*U,h:H*U},name:{x:35,y:36,w:+((W-0.7)*U).toFixed(2),h:32}};
  const m={asset_id:id,name,size_in:{w:W,h:H},units:'1 user unit = 0.01 in',viewBox:[0,0,+(W*U).toFixed(2),H*U],size_source:'estimated',
    size_basis:'Width and height of the Vanguard CAP cadet name plate (CAP0599M, 3 3/8 x 3/4 in); the regulation gives no dimension. Adult plate assumed the same size.',
    anchors:Object.fromEntries(Object.entries({...std(W*U,H*U),name_center:lmCen(LM.name)}).map(([k,v])=>[k,r2(v)])),landmarks:LM,landmarks_note:'rects are {x,y,w,h}; user units (0.01 in)',
    documented:[cadet?'blue for cadets, three-line, last name engraved in white (CAPR 39-1 4.2.5.1.2.1, 4.1.11.1.1.2.1)':'gray for adult members, three-line, last name engraved in white','centred on, resting on (not over) the edge of the pocket on the wearer\'s right (aviator shirt, Class B shirt)'],
    assumed:['plate size','lettering proportions read from Fig A6-3','blue/gray tones sampled from Fig A6-3'],fit:{method:'original',score:null},grade:'insignia-plate'};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}in" height="${H}in" viewBox="0 0 ${+(W*U).toFixed(2)} ${H*U}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}<g id="art" transform="scale(${U})">${b}</g></svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTD,id+'.svg'),svg);fs.writeFileSync(path.join(OUTD,id+'.spec.json'),JSON.stringify(m,null,1));console.log('ok',id);}
plate('nameplate-3line-adult','CAP 3-line nameplate, adult (gray, blank name line)','#8a8a8c','#b9b9bd',false);
plate('nameplate-3line-cadet','CAP 3-line nameplate, cadet (blue, blank name line)','#14208f','#5c68c8',true);
