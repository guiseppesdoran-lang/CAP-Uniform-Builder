// ABU/OCP versions of every military badge: the flat silver redraw recoloured to thread on dark blue (silver, or gold where the real badge is
// awarded in gold: CAPR 39-1 ICL 25-06 para 7.1.1.3.1), 1/8 in of blue each side, exact rectangle. Run from artwork-samples/assets/military.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const SK=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts'),io=require(SK+'/pngio.js');
const BLUE='#1b2547',SILVER='#d3d8de',GOLD='#d4af37',PAD=12.5,OUT='field';fs.mkdirSync(OUT,{recursive:true});
const CITE='OCP: CAPR 39-1 ICL 25-06 para 7.1.1.3.1 (max 4 badges, light silver embroidery on dark blue, 1/8 in of blue exposed at widest/tallest part; earned military badges per DAFI 36-2903; badges originally awarded in gold are embroidered in gold on dark blue). ABU: CAPR 39-1 (3 Mar 2020) para 5.1.1.1.2.4.';
const hex=c=>{const m=c.match(/^#([0-9a-f]{6})$/i);return m?[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)):null;};
const toHex=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const lum=a=>0.299*a[0]+0.587*a[1]+0.114*a[2],mix=(c0,c1,t)=>c0.map((v,i)=>v+(c1[i]-v)*t),B=hex(BLUE);
const recolour=(svg,thread)=>{const T=hex(thread);return svg.replace(/#[0-9a-fA-F]{6}\b/g,m=>{const c=hex(m);const t=Math.max(0,Math.min(1,(lum(c)-35)/(215-35)));return toHex(mix(B,T,Math.pow(t,0.85)));});};
// gold or silver: from the reference photo (opaque, non-white, non-grey, yellow-hued pixels share)
function isGold(refPath){try{const R=io.decode(refPath);let n=0,y=0;
  for(let i=0;i<R.W*R.H;i++){const r=R.rgba[i*4]/255,g=R.rgba[i*4+1]/255,b=R.rgba[i*4+2]/255,a=R.rgba[i*4+3];if(a<200)continue;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=mx,sat=mx?(mx-mn)/mx:0;if(v>0.92&&sat<0.12)continue;n++;
    if(sat<0.5||v<0.5)continue;const h=mx===r?60*(((g-b)/(mx-mn))%6):mx===g?60*((b-r)/(mx-mn)+2):60*((r-g)/(mx-mn)+4);const hh=(h+360)%360;
    if(hh>=32&&hh<=62)y++;}
  return n>0&&y/n>0.22;}catch(e){return false;}}
// product photos whose gold tone sits below the hue/saturation threshold; checked by eye against the reference sheet
const GOLD_FORCE=new Set(['navy-parachutist-navy-marine-corps-parachutist','navy-marine-corps-combatant-diver-default','usmc-aerial-navigator-default','usmc-diver-default','usmc-naval-aviation-observer-default','uscg-scuba-diver-default']);
const SETS=[['af','air-force'],['af2','air-force'],['army','army'],['navy','navy'],['usmc','marine-corps'],['uscg','coast-guard']];
const rows=[];
for(const [set,svc] of SETS){
  const dir=`${set}/final`;if(!fs.existsSync(dir))continue;
  for(const d of fs.readdirSync(dir).filter(x=>fs.existsSync(`${dir}/${x}/${x}.svg`)).sort()){
    const svg=fs.readFileSync(`${dir}/${d}/${d}.svg`,'utf8'),spec=JSON.parse(fs.readFileSync(`${dir}/${d}/${d}.spec.json`));
    const root=svg.match(/^<svg\b[^>]*>/)[0],vb=root.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number),M=JSON.parse(svg.match(/<metadata>([\s\S]*?)<\/metadata>/)[1]);
    const refName=(spec.reference||'').split('/').pop(),gold=GOLD_FORCE.has(d)||isGold(`${set}/ref/${refName}.png`),thread=gold?GOLD:SILVER,id=d+'-field';
    const W=vb[2]+2*PAD,H=vb[3]+2*PAD,wi=+(W/100).toFixed(5),hi=+(H/100).toFixed(5);
    let inner=svg.slice(svg.indexOf('</metadata>')+11,svg.lastIndexOf('</svg>')).split(`${d}__`).join(`${id}__`);
    inner=inner.replace(/<(linear|radial)Gradient\b[\s\S]*?<\/\1Gradient>/g,'');
    const body=recolour(inner,thread);
    const shift=a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,[+(PAD+v[0]).toFixed(3),+(PAD+v[1]).toFixed(3)]]));
    const anchors=shift(M.anchors||{});Object.assign(anchors,{top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2],art_top_center:[W/2,PAD],art_bottom_center:[W/2,PAD+vb[3]]});
    const fu={worn_on:['abu','ocp'],max_badges:{abu:2,ocp:4},backing:'dark blue rectangle (square corners)',backing_color:BLUE,thread_color:thread,thread:gold?'gold':'light silver',margin_in:0.125,corner_radius_in:0,
      backing_minus_art_in:0.25,scale_from_backing:'art width/height = backing width/height - 0.25 in (1/8 in of blue each side)',art_width_in:+(vb[2]/100).toFixed(5),art_height_in:+(vb[3]/100).toFixed(5),source_asset:d,kind:'military-badge'};
    const M2={...M,asset_id:id,width_in:wi,height_in:hi,anchors,citation:CITE,field_uniform:fu,
      size_basis:(M.size_basis||'')+' | art size unchanged; backing adds 1/8 in each side',
      notes:'ABU/OCP version of a military badge: the flat redraw as '+(gold?'gold':'light silver')+' thread on dark blue; eligibility per DAFI 36-2903 must be confirmed (list not in repo).'};
    const out=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${wi}in" height="${hi}in" viewBox="0 0 ${+W.toFixed(3)} ${+H.toFixed(3)}" data-source="${(root.match(/data-source="([^"]+)"/)||[])[1]||'reference-art-measured'}" data-asset-id="${id}"><metadata>${JSON.stringify(M2)}</metadata>`
      +`<rect id="${id}__backing" x="0" y="0" width="${+W.toFixed(3)}" height="${+H.toFixed(3)}" rx="0" ry="0" fill="${BLUE}"/><g transform="translate(${PAD} ${PAD})">${body}</g></svg>`;
    fs.mkdirSync(`${OUT}/${id}`,{recursive:true});fs.writeFileSync(`${OUT}/${id}/${id}.svg`,out);
    fs.writeFileSync(`${OUT}/${id}/${id}.spec.json`,JSON.stringify({...spec,asset_id:id,width_in:wi,height_in:hi,anchors,field_uniform:fu,citation:CITE,notes:M2.notes,fit_score:undefined,derived_from:`assets/military/${dir}/${d}`},null,1));
    const g=cp.spawnSync('node',[`${SK}/check-asset.js`,`${OUT}/${id}/${id}.svg`],{encoding:'utf8'});let c;try{c=JSON.parse(g.stdout);}catch(e){c={pass:false,fails:['check crashed']};}
    rows.push({id,set,thread:gold?'gold':'silver',pass:c.pass,fails:(c.fails||[]).join('; ')});
  }}
fs.writeFileSync(`${OUT}/ASSET_REPORT.json`,JSON.stringify(rows,null,1));
const gold=rows.filter(r=>r.thread==='gold');console.log('assets',rows.length,'pass',rows.filter(r=>r.pass).length,'gold',gold.length);
console.log(gold.map(r=>r.id).join('\n'));console.table(rows.filter(r=>!r.pass).slice(0,12));
