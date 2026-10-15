// Corporate Service Dress "blazer nameplate" extras (CAPR 39-1 4.2.3.1.1.2 / Fig A6-3): black plate, CAP Crest at left, last name + state / region /
// national lines (left blank for the builder), adult variant with a grade-insignia slot at right (optional for officers and NCOs; not allowed for cadets).
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

const OUTDIR2=path.join(here,'..','assets','nameplates');fs.mkdirSync(OUTDIR2,{recursive:true});
const crestArt=require('./crest-art.js')(GLY);
const W=3.375,H=0.9;   // width from the CAP plate size; 3.75:1 read from Fig A6-3 (not dimensioned in the regulation)
function plate(id,name,adult){
  const crestH=0.625,cx0=0.12+crestH*0.4;   // 5/8 in tall: Vanguard blazer-plate CAP crest (metal screw back)       // crest box is ~0.81 as wide as it is tall; 0.4 = half of that
  const nameX=0.9,gx=adult?W-0.12-0.62:W-0.12;
  const nm={x:nameX,y:0.1,w:gx-nameX-0.1,h:0.5},st={x:nameX,y:0.62,w:gx-nameX-0.1,h:0.18},gr=adult?{x:gx,y:0.12,w:0.62,h:H-0.24}:null;
  let b=`<rect id="plate-body" x="0" y="0" width="${W}" height="${H}" rx=".06" fill="#0b0c10" stroke="#c9ceda" stroke-width=".04"/>`
    +`<rect x=".05" y=".05" width="${W-0.1}" height="${H-0.1}" rx=".035" fill="none" stroke="#5b6070" stroke-width=".015"/>`
    +`<g id="crest"><g transform="translate(${f(cx0)} ${f((H-crestH)/2)}) scale(${(crestH/705).toFixed(6)}) translate(0 -20)">${crestArt.svg}</g></g>`
    +`<rect id="name-slot" x="${nm.x}" y="${nm.y}" width="${f(nm.w)}" height="${nm.h}" fill="none" stroke="none"/>`
    +`<rect id="state-slot" x="${st.x}" y="${st.y}" width="${f(st.w)}" height="${st.h}" fill="none" stroke="none"/>`;
  if(gr)b+=`<rect id="grade-slot" x="${f(gr.x)}" y="${gr.y}" width="${gr.w}" height="${f(gr.h)}" rx=".03" fill="none" stroke="none"/>`;
  const vb={x:0,y:0,w:W,h:H},A=std(W*U,H*U);
  const LM={plate:{x:0,y:0,w:+(W*U).toFixed(2),h:+(H*U).toFixed(2)},name:{x:nm.x*U,y:nm.y*U,w:+(nm.w*U).toFixed(2),h:nm.h*U},state:{x:st.x*U,y:st.y*U,w:+(st.w*U).toFixed(2),h:st.h*U}};
  if(gr)LM.grade_insignia={x:+(gr.x*U).toFixed(2),y:gr.y*U,w:gr.w*U,h:+(gr.h*U).toFixed(2)};
  const anchors={...A,crest_center:[+((cx0)*U).toFixed(2),+(H/2*U).toFixed(2)],name_center:lmCen(LM.name),state_center:lmCen(LM.state),top_edge_center:A.top_center};
  if(gr)anchors.grade_insignia_center=lmCen(LM.grade_insignia);
  return conv0({id,name,vb,body:b,anchors,LM,adult});}
// conv for this module: write into assets/nameplates
function conv0({id,name,vb,body,anchors,LM,adult}){
  const Wu=+(vb.w*U).toFixed(2),Hu=+(vb.h*U).toFixed(2);
  const m={asset_id:id,name,size_in:{w:vb.w,h:vb.h},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],size_source:'estimated',
    size_basis:'Width reused from the CAP cadet nameplate (Vanguard CAP0599M, 3 3/8 in); 3.75:1 proportion read from CAPR 39-1 Fig A6-3. The regulation gives no dimension for the blazer nameplate.',
    anchors:Object.fromEntries(Object.entries(anchors).map(([k,v])=>[k,r2(v)])),landmarks:LM,landmarks_note:'rects are {x,y,w,h}; all in user units (0.01 in), origin top-left',
    documented:['black nameplate with CAP Crest, last name and state/region/national by unit of assignment (CAPR 39-1 4.2.3.1.1.2, Fig A6-3)',adult?'grade insignia optional for officers and NCOs':'grade insignia not allowed for cadets','worn with the top edge aligned with the top edge of the left breast pocket'],
    assumed:['plate size','name / state / grade slot sizes','CAP Crest is a redraw (assets: see ASSET_NOTES)'],fit:{method:'original',score:null},grade:'insignia-plate'};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${vb.w.toFixed(4)}in" height="${vb.h.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS2}<g id="art" transform="scale(${U})">${body}</g></svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR2,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR2,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
plate('nameplate-blazer-adult',"Corporate blazer nameplate, adult (black; CAP Crest; blank name/state; grade-insignia slot)",true);
plate('nameplate-blazer-cadet',"Corporate blazer nameplate, cadet (black; CAP Crest; blank name/state; no grade insignia)",false);
console.log('ok nameplates');
