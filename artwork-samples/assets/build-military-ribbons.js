// Military base ribbons -> real-inch SVG (1 3/8 x 3/8 in), one asset per UNIQUE measured design.
// Inputs : ribbons/military/measurements.json (tools/military/measure-military-ribbons.js), ../../military/military-data.js (names, services)
//          images/military-ribbons/*.svg (6 vector sources, parsed exactly)
// Outputs: ribbons/military/<id>.svg + .spec.json, ribbons/military/_index.json (award id -> asset id), _unresolved.json
const fs=require('fs'),path=require('path'),vm=require('vm');
const HERE=__dirname,REPO=path.join(HERE,'../..'),OUTD=path.join(HERE,'ribbons/military');
const U=100,W_IN=1.375,H_IN=0.375,W=W_IN*U,H=H_IN*U;
const f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const sb={};vm.createContext(sb);sb.globalThis=sb;sb.window=sb;sb.self=sb;
vm.runInContext(fs.readFileSync(path.join(REPO,'military/military-data.js'),'utf8'),sb);
const DATA=sb.CAPUBMilitaryData,AW=new Map(DATA.awards.map(a=>[a.id,a]));
const M=JSON.parse(fs.readFileSync(path.join(OUTD,'measurements.json')));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
const snap=h=>{const c=rgb(h);if(Math.min(...c)>=232)return'ffffff';if(Math.max(...c)<=24)return'000000';return h;};
const SVC={air_force:'air-force',army:'army',navy:'navy',marine_corps:'marine-corps',coast_guard:'coast-guard',space_force:'space-force'};
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const SOURCE_NOTE='Stripe fractions and colours measured by script from the vendor raster (images/military-ribbons); not drawn by eye';

// ---- gather every image (raster measurements + exact SVG sources)
const items=[];
for(const [p,o] of Object.entries(M)){
  const file=p.split('/').pop(),stem=file.replace(/\.[^.]+$/,'');
  items.push({frame:o.frame||null,interior:o.interior_runs||null,central:o.central_runs||null,border:o.border_frame_detected,file,stem,path:p.replace(/^\/Users\/ethan\/UniformBuilder\//,''),awards:o.awards,cls:o.class,mode:o.mode,res:o.residual,runs:o.runs||null,stars:o.stars||null,src:'raster'});
}
const svgFiles=[];
for(const d of ['images/military-ribbons','images/military-ribbons/source-patterns'])
  for(const f of fs.readdirSync(path.join(REPO,d)).filter(x=>x.endsWith('.svg')))svgFiles.push([d,f]);
for(const [d,f] of svgFiles){
  const txt=fs.readFileSync(path.join(REPO,d,f),'utf8'),vb=txt.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if(!vb){continue;}const vw=+vb[1];
  const cell=new Array(Math.round(vw)).fill(null);
  for(const m of txt.matchAll(/<rect\b([^>]*)\/>/g)){const a=m[1],g=n=>(a.match(new RegExp('\\b'+n+'="([^"]*)"'))||[])[1];
    const x=+(g('x')||0),w=+(g('width')||vw),fill=(g('fill')||'').replace('#','').toLowerCase();
    for(let i=Math.round(x);i<Math.round(x+w)&&i<cell.length;i++)cell[i]=fill;}
  const runs=[];cell.forEach((c,i)=>{if(runs.length&&runs[runs.length-1].hex===c)runs[runs.length-1].x1=(i+1)/vw;else runs.push({x0:i/vw,x1:(i+1)/vw,hex:c});});
  const stem=f.replace(/\.svg$/,'');
  const awards=DATA.awards.filter(a=>a.images&&a.images.ribbon&&a.images.ribbon===d+'/'+f).map(a=>a.id);
  items.push({file:f,stem,path:d+'/'+f,awards,cls:'stripes',mode:'V',res:{exact_svg:true},runs,stars:null,src:'svg'});
}
// ---- AF award bases derived from the precomposed variants (devices excluded; see tools/military/measure-variant-bases.js)
const VB=JSON.parse(fs.readFileSync(path.join(OUTD,'variant-bases.json')));
for(const [aw,v] of Object.entries(VB))
  items.push({file:aw+'.png',stem:aw,path:v.source_images[0],awards:[aw],cls:'stripes',mode:'V',res:{variant_bases_measured:v.variants_measured,variants_agreeing:v.agreeing,exact_svg:false},
    runs:v.runs,stars:null,src:'variant'});
// ---- unresolved designs: simplified vector trace when the posterised raster fits (flat art), otherwise the central stripes
const TR=fs.existsSync(path.join(OUTD,'traces.json'))?JSON.parse(fs.readFileSync(path.join(OUTD,'traces.json'))):{};
for(const it of items){
  if(it.cls!=='unresolved')continue;
  const t=TR['/Users/ethan/UniformBuilder/'+it.path]||TR[it.path];
  if(it.stem==='air_force_combat_action'){it.cls='diagonal';it.mode='V';it.runs=[{x0:0,x1:1,hex:'ef3e26'}];}
  else if(t&&t.residual<=12){it.cls='traced';it.trace=t;it.mode='V';}
  else{it.cls='stripes_framed_or_photo';it.fallback=true;it.runs=it.central;it.mode='V';}
}
// ---- frames: keep only consistent ones (all four sides within a factor of 2.2 and >= 0.03 in)
for(const it of items){
  if(!it.frame||it.cls==='traced'||it.src!=='raster'){continue;}
  const t=it.frame.thickness_in,v=[t.top,t.bottom,t.left,t.right];
  if(Math.min(...v)<0.03||Math.max(...v)/Math.min(...v)>2.2){it.frame=null;continue;}
  it.runs=it.interior.map(r=>({...r}));
  it.runs[0].x0=0;it.runs[it.runs.length-1].x1=1;     // the first/last stripe runs under the frame to the ribbon edge
  it.hasFrame=true;
}
const unresolved=[];
const usable=items.filter(i=>i.cls!=='unresolved');
// ---- clean runs: snap neutrals, trim gold edge frames on framed/photo class, merge equal neighbours
function clean(it){
  if(it.cls==='traced')return [];
  let r=it.runs.map(x=>({x0:x.x0,x1:x.x1,hex:snap(x.hex)}));
  if(it.cls==='stripes_framed_or_photo'&&!it.hasFrame){
    const gold=h=>{const [R,G,B]=rgb(h);return R>150&&G>110&&B<120&&R>B+60;};
    let trimmed=0;
    while(r.length>3&&gold(r[0].hex)&&(r[0].x1-r[0].x0)<0.07){r.shift();trimmed++;}
    while(r.length>3&&gold(r[r.length-1].hex)&&(r[r.length-1].x1-r[r.length-1].x0)<0.07){r.pop();trimmed++;}
    it.edgeFrameTrimmed=trimmed;
  }
  const out=[];for(const x of r){if(out.length&&out[out.length-1].hex===x.hex)out[out.length-1].x1=x.x1;else out.push({...x});}
  const lo=out[0].x0,hi=out[out.length-1].x1,sp=hi-lo;
  return out.map(x=>({hex:x.hex,frac:(x.x1-x.x0)/sp}));
}
usable.forEach(it=>{it.stripes=clean(it);});
// ---- dedupe: same orientation/class family, same stripe count, fractions within 0.02, colours within 36
const same=(a,b)=>a.cls!=='traced'&&b.cls!=='traced'&&!a.hasFrame&&!b.hasFrame&&a.mode===b.mode&&a.stripes.length===b.stripes.length&&
  a.stripes.every((s,i)=>Math.abs(s.frac-b.stripes[i].frac)<0.02&&dist(rgb(s.hex),rgb(b.stripes[i].hex))<36)&&
  (!!a.stars===!!b.stars)&&(!a.stars||a.stars.length===b.stars.length);

// ============ colour quality pass: palette snapping, noise-stripe removal, clean-source preference ============
const REFS=fs.existsSync(path.join(OUTD,'references.json'))?JSON.parse(fs.readFileSync(path.join(OUTD,'references.json'))):{};
const DIAG=fs.existsSync(path.join(OUTD,'diagonal-air-force-combat-action.json'))?JSON.parse(fs.readFileSync(path.join(OUTD,'diagonal-air-force-combat-action.json'))):null;
const VBI=JSON.parse(fs.readFileSync(path.join(OUTD,'variant-bases.json')));
const MIN_FRAC_V=(1/64)/W_IN,MIN_FRAC_H=(1/64)/H_IN;   // stripes narrower than 1/64 in are noise
function lab(h){const c=rgb(h).map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
  const X=(c[0]*0.4124+c[1]*0.3576+c[2]*0.1805)/0.95047,Y=c[0]*0.2126+c[1]*0.7152+c[2]*0.0722,Z=(c[0]*0.0193+c[1]*0.1192+c[2]*0.9505)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))];}
const labD=(a,b)=>Math.sqrt(0.6*(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);   // hue/chroma errors cost more than lightness
const PALETTE=(()=>{const set=new Map();const add=(h,src)=>{h=h.toLowerCase();if(!set.has(h))set.set(h,src);};
  add('ffffff','neutral');add('000000','neutral');
  // 1. CAP ribbons from the regulation (flat primaries)
  const CAPD=path.join(HERE,'ribbons');
  for(const f of fs.readdirSync(CAPD).filter(f=>f.startsWith('ribbon-')&&f.endsWith('.spec.json'))){
    const sp=JSON.parse(fs.readFileSync(path.join(CAPD,f)));
    if(sp.color_verified_against_regulation)(sp.dimensions.stripes||[]).forEach(t=>add(t.hex,'cap-regulation'));}
  // 2. vendor vector ribbons
  for(const d of ['images/military-ribbons','images/military-ribbons/source-patterns'])
    for(const f of fs.readdirSync(path.join(REPO,d)).filter(x=>x.endsWith('.svg')))
      for(const m of fs.readFileSync(path.join(REPO,d,f),'utf8').matchAll(/fill="#([0-9a-fA-F]{6})"/g))add(m[1],'vendor-svg');
  // 3. colours of the cross-validated public-domain reference ribbons (official DoD shades such as ba0c2f / 001489 / 007a33 / ffcd00)
  for(const R of Object.values(REFS))if(R&&R.accepted)R.runs.forEach(r=>add(snapNeutral(r.hex),'public-reference'));
  return [...set.entries()].map(([hex,src])=>({hex,src,lab:lab(hex)}));})();
function snapNeutral(h){return Math.min(...rgb(h))>=232?'ffffff':(Math.max(...rgb(h))<=24?'000000':h);}
function snapColor(h){h=snapNeutral(h);const L=lab(h);let best=PALETTE[0],bd=1e9;for(const p of PALETTE){const d=labD(L,p.lab);if(d<bd){bd=d;best=p;}}return {hex:best.hex,delta:bd};}
function mergeNoise(stripes,minFrac){
  let st=stripes.map(s=>({...s}));
  const join=()=>{const o=[];for(const s of st){if(o.length&&o[o.length-1].hex===s.hex)o[o.length-1].frac+=s.frac;else o.push({...s});}st=o;};
  join();
  for(;;){const i=st.findIndex(s=>s.frac<minFrac);if(i<0||st.length<=1)break;
    const L=st[i-1],R=st[i+1];
    let tgt;if(L&&R){const dl=labD(lab(st[i].hex),lab(L.hex)),dr=labD(lab(st[i].hex),lab(R.hex));tgt=dl<=dr?L:R;}else tgt=L||R;
    tgt.frac+=st[i].frac;st.splice(i,1);join();}
  const t=st.reduce((a,s)=>a+s.frac,0);return st.map(s=>({hex:s.hex,frac:s.frac/t}));}
function refine(c,g,id){
  c.colorSource='measured (vendor raster)';c.geometrySource='vendor raster';
  if(c.res&&c.res.exact_svg){c.colorSource='vendor SVG (exact)';c.geometrySource='vendor SVG (exact)';return;}
  if(c.src==='variant'){c.stripes=mergeNoise(c.stripes.map(s=>({hex:snapNeutral(s.hex),frac:s.frac})),MIN_FRAC_V);c.colorSource='McChord-style precomposed variant (flat art)';c.geometrySource='variant base, top/bottom bands';return;}
  if(c.cls==='traced')return;
  const minF=c.mode==='H'?MIN_FRAC_H:MIN_FRAC_V;
  // (a) a clean McChord-style base exists for the same award
  const aw=g.flatMap(x=>x.awards).find(a=>VBI[a]);
  if(aw){const vb=VBI[aw].runs;const st=vb.map(r=>({hex:snapNeutral(r.hex),frac:r.x1-r.x0}));
    c.stripes=mergeNoise(st,MIN_FRAC_V);c.mode='V';c.colorSource='McChord-style precomposed variant (flat art), award '+aw;c.geometrySource='McChord-style variant base';c.supersededPhoto=true;return;}
  // (b) a cross-validated public reference ribbon
  const R=REFS[id];
  if(R&&R.accepted&&R.runs&&R.runs.length){
    c.stripes=mergeNoise(R.runs.map(r=>({hex:r.hex,frac:r.x1-r.x0})),minF);c.mode='V';
    c.colorSource='public reference: Wikimedia Commons '+R.title+' ('+(R.license||'license not recorded')+'), boundary match '+R.match;c.geometrySource='public reference, cross-validated against the raster';c.reference=R;return;}
  // (c) measured stripes, colours snapped to the repo palette, noise stripes dropped
  const before=c.stripes.length;
  const snapped=c.stripes.map(s=>{const q=snapColor(s.hex);return {hex:q.hex,frac:s.frac,_d:q.delta};});
  c.stripes=mergeNoise(snapped,minF);
  c.snapInfo={stripes_before:before,stripes_after:c.stripes.length,max_snap_delta:+Math.max(...snapped.map(s=>s._d)).toFixed(1)};
  c.colorSource='measured raster, snapped to the repo palette';c.geometrySource='vendor raster (mid-height columns)';
  if(c.hasFrame){const q=snapColor(c.frame.hex);c.frame={...c.frame,hex:q.hex,sampled_hex:c.frame.hex};}
}
const groups=[];
for(const it of usable.sort((a,b)=>a.file.localeCompare(b.file))){
  const g=groups.find(g=>same(g[0],it));if(g)g.push(it);else groups.push([it]);}
// ---- name the canonical member of each group
function canon(g){
  // prefer the member whose filename carries a service prefix matching its awards; else shortest filename
  return g.slice().sort((a,b)=>(+!!svcOf(b))-(+!!svcOf(a))||a.file.length-b.file.length||a.file.localeCompare(b.file))[0];}
function svcOf(it){for(const k of Object.keys(SVC))if(it.stem.startsWith(k+'_'))return SVC[k];return null;}
function awardNames(it){return it.awards.map(id=>AW.get(id)).filter(Boolean);}
const used=new Set(),index={},variantIndex={},members=[];
const R_STAR=(wf)=>wf*W_IN/(2*Math.sin(2*Math.PI/5));   // star outer radius (in) from its measured width
function starPts(cx,cy,r){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.382:r;p.push([cx+rr*Math.cos(a),cy+rr*Math.sin(a)]);}return p;}
let n=0;
for(const g of groups){
  const c=canon(g);
  let svc=svcOf(c)||(()=>{const a=awardNames(c)[0];const s=a&&a.authorizedServices&&a.authorizedServices.length===1?a.authorizedServices[0]:'JOINT';return slug(s.replace(/_/g,'-'));})();
  if(svc==='joint-dod')svc='joint';
  const base=c.stem.replace(new RegExp('^'+Object.keys(SVC).join('|')+'_?'),'').replace(/ribb0n/g,'ribbon');
  let id='mil-ribbon-'+svc+'-'+slug(base||c.stem);
  for(let k=2;used.has(id);k++)id=`mil-ribbon-${svc}-${slug(base)}-${k}`;
  used.add(id);
  const names=[...new Set(g.flatMap(awardNames).map(a=>a.officialName||a.name))];
  const name=(awardNames(c)[0]&&(awardNames(c)[0].officialName||awardNames(c)[0].name))||c.stem;
  refine(c,g,id);
  const P=s=>`${id}__${s}`;let body='',acc=0;const dims=[];
  if(c.mode==='H'){let g2='';c.stripes.forEach((s,i)=>{const y0=acc*H,y1=Math.min(H,(acc+s.frac)*H);acc+=s.frac;
      g2+=`<rect id="${P('band-'+i)}" x="0" y="${f2(y0)}" width="${W}" height="${f2(y1-y0)}" fill="#${s.hex}"/>`;
      dims.push({index:i,hex:s.hex,fraction:+s.frac.toFixed(4),y0_in:+(y0/U).toFixed(4),y1_in:+(y1/U).toFixed(4)});});
    body+=`<g id="${P('field')}">${g2}</g>`;}
  else{let g2='';c.stripes.forEach((s,i)=>{const x0=acc*W,x1=Math.min(W,(acc+s.frac)*W);acc+=s.frac;
      g2+=`<rect id="${P('stripe-'+i)}" x="${f2(x0)}" y="0" width="${f2(x1-x0)}" height="${H}" fill="#${s.hex}"/>`;
      dims.push({index:i,hex:s.hex,fraction:+s.frac.toFixed(4),x0_in:+(x0/U).toFixed(4),x1_in:+(x1/U).toFixed(4)});});
    body+=`<g id="${P('field')}">${g2}</g>`;}
  let frameDims=null;
  if(c.stem==='air_force_combat_action'&&DIAG){
    const a=DIAG.angle_deg*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),nx=Math.sin(a),ny=-Math.cos(a),cx=W/2,cy=H/2,L=3*U;
    let q='';DIAG.runs.forEach((r,i)=>{const u0=r.u0_in*U,u1=r.u1_in*U;
      const pt=(u,sv)=>f2(cx+u*nx+sv*dx)+','+f2(cy+u*ny+sv*dy);
      q+=`<polygon id="${P('diag-'+i)}" points="${pt(u0,-L)} ${pt(u0,L)} ${pt(u1,L)} ${pt(u1,-L)}" fill="#${snapColor(r.hex).hex}"/>`;});
    body=`<defs><clipPath id="${P('clip')}"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs><g id="${P('field')}" clip-path="url(#${P('clip')})"><rect x="0" y="0" width="${W}" height="${H}" fill="#${snapColor(DIAG.palette[0]).hex}"/>${q}</g>`;
    c.mode='V';c.diagonal={angle_deg:DIAG.angle_deg,runs:DIAG.runs.length};c.colorSource='measured raster (diagonal fit), snapped to the repo palette';c.geometrySource='vendor raster: stripe angle and widths measured';
  }
  if(c.cls==='traced'){
    const T=c.trace;let tg='';
    T.layers.forEach((ly,li)=>{
      if(li===0){tg+=`<rect id="${P('trace-bg')}" x="0" y="0" width="${W}" height="${H}" fill="#${ly.hex}"/>`;return;}
      if(!ly.loops.length)return;
      const d=ly.loops.map(l=>'M'+l.map(([x,y])=>f2(x*W)+','+f2(y*H)).join('L')+'Z').join('');
      tg+=`<path id="${P('trace-'+li)}" d="${d}" fill="#${ly.hex}" fill-rule="evenodd" stroke="#${ly.hex}" stroke-width="0.3" stroke-linejoin="round"/>`;});
    body=`<g id="${P('traced-field')}">${tg}</g>`;
  }
  if(c.hasFrame){
    const t=c.frame.thickness_in,l=t.left*U,r=t.right*U,tp=t.top*U,bt=t.bottom*U;
    frameDims={color_hex:c.frame.hex,thickness_in:t,note:c.frame.note};
    body+=`<path id="${P('frame')}" d="M0,0H${W}V${H}H0Z M${f2(l)},${f2(tp)}V${f2(H-bt)}H${f2(W-r)}V${f2(tp)}Z" fill="#${c.frame.hex}" fill-rule="evenodd"/>`;
  }
  let starDims=[];
  if(c.stars){body+=`<g id="${P('stars')}">`+c.stars.map((s,i)=>{const rIn=R_STAR(s.width_frac),cx=s.cx*W,cy=s.cy*H;
      starDims.push({index:i,center_in:[+(cx/U).toFixed(4),+(cy/U).toFixed(4)],outer_radius_in:+rIn.toFixed(4),point_to_point_in:+(2*rIn).toFixed(4)});
      return `<polygon id="${P('star-'+i)}" points="${starPts(cx,cy,rIn*U).map(q=>f2(q[0])+','+f2(q[1])).join(' ')}" fill="#ffffff"/>`;}).join('')+'</g>';}
  const anchors={top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]};
  const meta={asset_id:id,name,size_in:{w:W_IN,h:H_IN},units:'1 user unit = 0.01 in',viewBox:[0,0,W,H],
    size_source:'regulation',
    size_citation:'Ribbon bar 1 3/8 in x 3/8 in (11:3): DoDM 1348.33 (military decorations, ribbons and devices) and CAPR 39-1 as carried in js/state.js RIBBON_HEIGHT; paragraph numbers to be confirmed against the current publications',
    anchors,
    dimensions:{ribbon_width_in:W_IN,ribbon_height_in:H_IN,aspect:'11:3',orientation:c.cls==='traced'?'traced-polygons':(c.mode==='H'?'horizontal-bands':'vertical-stripes'),stripes:dims,stars:starDims,frame:frameDims,
      traced_layers:c.cls==='traced'?c.trace.layers.map(l=>({hex:l.hex,area_fraction:l.area_frac,loops:l.loops.length})):undefined},
    classification:c.cls,
    quality:{color_source:c.colorSource,geometry_source:c.geometrySource,snap:c.snapInfo||null,reference:c.reference?{title:c.reference.title,url:c.reference.url,license:c.reference.license,boundary_match:c.reference.match}:null,superseded_photo_by_clean_variant:!!c.supersededPhoto,min_stripe_in:'1/64'},
    measurement:{method:SOURCE_NOTE,source_images:g.map(x=>x.path),residual:c.res,edge_frame_trimmed:c.edgeFrameTrimmed||0,
      photographic_source:c.cls==='stripes_framed_or_photo'&&!c.hasFrame,border_frame_detected:!!c.border,fidelity:c.res.exact_svg?'exact':(c.reference?'reference':(c.supersededPhoto?'clean-variant':(c.cls==='traced'?'simplified':(c.cls==='stripes_framed_or_photo'?'approximate':'measured')))),traced_from_raster_residual:c.trace?c.trace.residual:undefined,fallback_central_stripes_only:!!c.fallback,source_kind:c.src,note:c.cls==='stripes_framed_or_photo'?'Source is a photograph of fabric (ribbing, sheen, possibly a gold unit-award frame); stripe widths measured at mid-height, colours are averaged; frame/border not modeled':''},
    authorized_services:[...new Set(g.flatMap(awardNames).flatMap(a=>a.authorizedServices||[]))],
    aliases:g.map(x=>({image:x.path,award_ids:x.awards})),award_names:names,
    fit:{method:'column/row block-mean residual vs run colour',score:c.trace?c.trace.residual:(c.res.exact_svg?0:Math.min(c.res.vertical??99,c.res.horizontal??99)),threshold:null},
    grade:'ribbon'};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W_IN.toFixed(4)}in" height="${H_IN.toFixed(4)}in" viewBox="0 0 ${W} ${H}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(meta))}</metadata>${body}</svg>`;
  fs.writeFileSync(path.join(OUTD,id+'.svg'),svg);fs.writeFileSync(path.join(OUTD,id+'.spec.json'),JSON.stringify(meta,null,1));
  for(const x of g){for(const aid of x.awards)if(x.src!=='variant')index[aid]=id;if(x.src==='variant')variantIndex[x.awards[0]]=id;}
  members.push({id,class:c.cls,images:g.length});n++;
}
fs.writeFileSync(path.join(OUTD,'_index.json'),JSON.stringify(index,null,1));
fs.writeFileSync(path.join(OUTD,'_variant-base-index.json'),JSON.stringify(variantIndex,null,1));
const noBuild=DATA.awards.filter(a=>a.type==='RIBBON'&&!index[a.id]&&!(a.images&&a.images.ribbon)).map(a=>({award_id:a.id,not_buildable:'no reference',reason:'the catalog has no ribbon raster or vector for this award, so there is nothing to measure'}));
fs.writeFileSync(path.join(OUTD,'_unresolved.json'),JSON.stringify(noBuild,null,1));
const byClass={};members.forEach(m=>byClass[m.class]=(byClass[m.class]||0)+1);
console.log({images:items.length,usable:usable.length,unique_ribbons:n,not_buildable:noBuild.length,traced:members.filter(m=>m.class==='traced').length,framed:items.filter(i=>i.hasFrame).length,byClass,awards_indexed:Object.keys(index).length});
