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
const NAVY='#13306f';
// ---- CAP regimental tie (four-in-hand, 4.2.3.4): navy with single thin red diagonal stripes. Same visible shape as the base blazer tie.
{ // inches, origin top-left of the visible tie; half-widths measured from the blazer base (px*0.0474 about the centreline)
  const S=0.0474,half=[[9,62],[14,71],[16,81],[12,94],[11,102],[15,140],[21,200],[27,262],[31,330]].map(p=>[p[0]*S,(p[1]-62)*S]);
  const H=(330-62)*S,W=2*31*S+0.3,cx=W/2;
  const L=half.map(p=>[cx-p[0],p[1]]),R=half.slice().reverse().map(p=>[cx+p[0],p[1]]);
  const d='M'+L.concat(R).map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
  const pitch=0.8,thick=0.065;let st='';
  for(let k=-6;k<=Math.ceil((H+W)/pitch)+2;k++){const y0=k*pitch;st+=`<path d="M${f(-1)},${f(y0)} L${f(W+1)},${f(y0+(W+2))}" stroke="#a8232f" stroke-width="${thick}"/>`;}
  const defs=`<clipPath id="tieClip"><path d="${d}"/></clipPath>`;
  const body=`<path id="tie" d="${d}" fill="${NAVY}"/><g clip-path="url(#tieClip)">${st}</g><path d="${d}" fill="none" stroke="#061a44" stroke-width=".03" stroke-linejoin="round"/>`
    +`<path d="M${f(cx-0.5)},${f(0.55)} Q${f(cx)},${f(0.7)} ${f(cx+0.5)},${f(0.55)}" fill="none" stroke="#061a44" stroke-width=".05" stroke-opacity=".7"/>`;
  emit('accessories',{id:'tie-cap-regimental',name:'CAP regimental tie, four-in-hand (navy, thin red diagonal stripes)',w:W,h:H,body,defs,
    anchors:{knot_top_center:[cx*U,0],tip_visible_center:[cx*U,H*U],tie_tack_center:[cx*U,((0.7+H)/2)*U]},LM:{},
    basis:'Visible portion of the necktie as drawn on the blazer base (same half-widths); stripe pattern read by eye from the Vanguard CAP0977F product photo (red on navy, single thin stripes). Stripe pitch, thickness and angle are estimates.',
    documented:['either the CAP regimental tie or the AF blue tie; mandatory with the corporate service dress unless a turtleneck is worn (CAPR 39-1 4.2.3.4)'],
    assumed:['stripe pitch 0.8 in (along the blade), thickness 0.065 in, 45 degrees','colours','overall shape is the blazer base tie, extended under the lapels in use']});
}
// ---- AF blue tie (4.2.3.4 / 4.2.5.1.4): plain blue polyester or silk herringbone twill, same visible shape as the blazer tie
{ const S=0.0474,half=[[9,62],[14,71],[16,81],[12,94],[11,102],[15,140],[21,200],[27,262],[31,330]].map(p=>[p[0]*S,(p[1]-62)*S]);
  const H=(330-62)*S,W=2*31*S+0.3,cx=W/2;
  const L=half.map(p=>[cx-p[0],p[1]]),R=half.slice().reverse().map(p=>[cx+p[0],p[1]]);
  const d='M'+L.concat(R).map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
  const body=`<path id="tie" d="${d}" fill="#1b3f8f" stroke="#0a2260" stroke-width=".03" stroke-linejoin="round"/>`
    +`<path d="M${f(cx-0.5)},${f(0.55)} Q${f(cx)},${f(0.7)} ${f(cx+0.5)},${f(0.55)}" fill="none" stroke="#0a2260" stroke-width=".05" stroke-opacity=".7"/>`;
  emit('accessories',{id:'tie-af-blue',name:'AF blue tie, four-in-hand (plain blue herringbone twill)',w:W,h:H,body,
    anchors:{knot_top_center:[cx*U,0],tip_visible_center:[cx*U,H*U],tie_tack_center:[cx*U,((0.7+H)/2)*U]},LM:{},
    basis:'Same visible shape as the blazer base tie; plain blue (the regulation: blue polyester or silk, herringbone twill; no pattern). Blue shade is an estimate. The tip must cover part of the belt buckle but not extend below it (4.2.5.1.4); the tie is shown cropped like the blazer base.',
    documented:['AF blue tie authorized with the corporate service dress (4.2.3.4); the aviator shirt uniform requires a blue tie (the CAP regimental tie is not authorized there, 4.2.5.1.4)','tie tack or clasp centred between the bottom of the knot and the tip (4.2.3.4, 4.2.5.1.4): `tie_tack_center`'],
    assumed:['blue shade','knot bottom at 0.7 in']});
}
// ---- black satin bow tie (semi-formal, 4.2.1.3): 5 to 5 1/2 in long, no wider than 2 1/2 in, square ends
{ const Lw=5.25,Hh=2.0,kn=0.9,x0=0,y0=0.25;
  const wing=(s)=>{const xc=Lw/2,xe=s<0?x0:Lw,xi=xc+s*kn/2;return `M${f(xi)},${f(Hh/2-0.28)} L${f(xe)},${f(y0)} L${f(xe)},${f(Hh-y0)} L${f(xi)},${f(Hh/2+0.28)} Z`;};
  const body=`<g id="bow"><path d="${wing(-1)}" fill="#0c0d12" stroke="#2a2c36" stroke-width=".03" stroke-linejoin="round"/><path d="${wing(1)}" fill="#0c0d12" stroke="#2a2c36" stroke-width=".03" stroke-linejoin="round"/>`
    +`<path d="M${f(Lw/2-kn/2)},${f(Hh/2-0.3)} L${f(Lw/2+kn/2)},${f(Hh/2-0.3)} L${f(Lw/2+kn/2)},${f(Hh/2+0.3)} L${f(Lw/2-kn/2)},${f(Hh/2+0.3)} Z" fill="#14151c" stroke="#2a2c36" stroke-width=".03" stroke-linejoin="round"/>`
    +`<path d="M${f(0.4)},${f(Hh/2)} L${f(Lw/2-kn/2-0.1)},${f(Hh/2)} M${f(Lw/2+kn/2+0.1)},${f(Hh/2)} L${f(Lw-0.4)},${f(Hh/2)}" stroke="#3a3d4a" stroke-width=".02" stroke-linecap="round"/></g>`;
  emit('accessories',{id:'tie-bow-black',name:'Black satin bow tie, square ends (corporate semi-formal)',w:Lw,h:Hh,body,anchors:{knot_center:[Lw/2*U,Hh/2*U]},
    basis:'Length and width limits from CAPR 39-1 4.2.1.3 (5 to 5 1/2 in long, no wider than 2 1/2 in); 5.25 x 2.0 in chosen inside those limits, knot size and wing shape are estimates.',
    documented:['black satin bow tie 5 to 5 1/2 in long, no wider than 2 1/2 in, square ends, silk or synthetic without design, replaces the necktie (CAPR 39-1 4.2.1.3)'],assumed:['2.0 in height','knot band size','wing shape']});
}
// ---- plain tie clasp (4.2.3.4 permits a tie tack or clasp; centred between the bottom of the knot and the tip)
for(const [id,nm,c1,c2,c3] of [['tie-clasp-silver','Tie clasp, plain silver','#eef0f4','#aeb4c0','#7c8392'],['tie-clasp-gold','Tie clasp, plain gold tone','#f6e08a','#c9a02e','#8a6a14']]){
  const Wc=2.0,Hc=0.3,g='<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset=".5" stop-color="'+c2+'"/><stop offset="1" stop-color="'+c3+'"/></linearGradient>';
  const body=`<rect id="bar" x="0.02" y="0.02" width="${Wc-0.04}" height="${Hc-0.04}" rx=".06" fill="url(#g)" stroke="${c3}" stroke-width=".03"/><path d="M.12,.09 L${Wc-0.12},.09" stroke="#fff" stroke-opacity=".6" stroke-width=".03" stroke-linecap="round"/>`;
  emit('accessories',{id,name:nm,w:Wc,h:Hc,body,defs:g,anchors:{},basis:'Typical commercial tie bar, 2.0 x 0.3 in; not dimensioned in the regulation.',
    documented:['tie tack or clasp may be worn; if worn it carries the CAP coat of arms, Wing and Star, AF symbol or grade insignia and is centred between the bottom of the knot and the tip of the tie (CAPR 39-1 4.2.3.4)'],assumed:['2.0 x 0.3 in','plain (no emblem) variant only']});}
// ---- standalone CAP Crest (the blazer pocket crest, 4.2.3.1.1.1), same art as on the base and on the nameplates
{ const Hc=2.8,Wc=Hc*586/705;
  const body=`<g id="crest" transform="scale(${(Hc/705).toFixed(6)}) translate(${f(293)} -20)">${crestArt.svg}</g>`;
  emit('insignia',{id:'insignia-cap-crest',name:'CAP Crest (embroidered eagle over shield with triangle and prop, scroll)',w:Wc,h:Hc,body,anchors:{},
    basis:'Proportions measured from the CAP Crest and CAP Command Patch illustrations in CAPR 39-1 Fig A6-4 (the figure is undimensioned); height 2.8 in = the crest measured in CAPR 39-1 Figs 4.14/4.15 against the 3 3/8 in nametag plate (about 2.6 in in Fig 4.14, 3.0 in in Fig 4.15); the figures carry no scale of their own.',
    documented:['CAP Crest attached or sewn to the centre of the left breast pocket (CAPR 39-1 4.2.3.1.1.1)'],assumed:['2.8 in height','hand-redrawn eagle, traced triangle and prop from the Command Patch']});
}
