// OCP variants: take the finished metal-badge assets, FLATTEN them (every gradient -> one flat colour), and put a rounded blue
// backing behind them with 1/4 in of margin on every side. Real units kept (1 unit = 0.01 in). Nothing is redrawn.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const CHECK=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts/check-asset.js');
const BLUE='#1b2547',SILVER='#d3d8de',PAD=12.5,RX=0;   // CAPR 39-1 ICL 25-06 para 7.1.1.3.1: 1/8 in of blue exposed at the widest and tallest parts; light silver embroidery on dark blue
const OUT='field';fs.mkdirSync(OUT,{recursive:true});
const CITE='OCP: CAPR 39-1 ICL 25-06 para 7.1.1.3.1 (max 4 badges, light silver embroidery on dark blue, 1/8 in of blue exposed at widest/tallest part). ABU: CAPR 39-1 (3 Mar 2020) para 5.1.1.1.2.4 (two aviation/occupational badges, embroidered silver on dark blue, 1/8 in of blue showing) and 5.1.1.1.2.5 (command insignia). Eligible list: Attachment 7 aviation + occupational badges';
const LIST={
 silver:['aircrew','senior-aircrew','master-aircrew','observer','senior-observer','master-observer','pilot','senior-pilot','master-pilot','glider-pilot','balloon-pilot','solo','pre-solo',
  'cap-suas-pilot','uas-pilot-senior','uas-pilot-master','uas-technician-basic','uas-technician-senior','uas-technician-master','cadet-suas',
  'ground-team-basic','senior-ground-team','master-ground-team','basic-incident-commander','incident-commander-1','incident-commander-2','legal-officer','medical-officer','nurse'],
 enamel:['enamel-emt-basic','enamel-emt-intermediate','enamel-emt-paramedic','enamel-buddist-chaplin','enamel-christian-chaplin','enamel-jewish-chaplin','enamel-muslim-chaplin'],
 mini:null};   // minis: every -mini asset whose full-size twin is in the list
const CMDR=['group-commander','squadron-commander'];  // commander's insignia: 1 in x 1 in dark blue cloth patch (para 7.1.1.3.1.7), not a chest badge
const lum=a=>0.299*a[0]+0.587*a[1]+0.114*a[2];
const mix=(c0,c1,t)=>c0.map((v,i)=>v+(c1[i]-v)*t);
function toSilver(svg){ // every flat colour -> a point between the blue backing and light silver, by luminance (silver thread on blue)
  return svg.replace(/(?<!url\()#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g,(m)=>{const c=hex(m);if(!c)return m;
    const t=Math.max(0,Math.min(1,(lum(c)-35)/(215-35)));return toHex(mix(B,S,Math.pow(t,0.85)));})
    .replace(/="white"/g,`="${SILVER}"`).replace(/="black"/g,`="${BLUE}"`);}
const hex=c=>{c=c.trim();if(/^#[0-9a-f]{3}$/i.test(c))c='#'+[...c.slice(1)].map(x=>x+x).join('');const m=c.match(/^#([0-9a-f]{6})$/i);return m?[0,2,4].map(i=>parseInt(m[1].substr(i,2),16)):null;};
const toHex=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const B=hex(BLUE),S=hex(SILVER);
function flatten(svg){
  const grads={};
  for(const m of svg.matchAll(/<(linear|radial)Gradient\b([^>]*)>([\s\S]*?)<\/\1Gradient>/g)){
    const id=(m[2].match(/\bid="([^"]+)"/)||[])[1];if(!id)continue;
    const st=[...m[3].matchAll(/<stop\b([^>]*)\/?>/g)].map(s=>{const o=+(((s[1].match(/offset="([^"]+)"/)||[])[1]||'0').replace('%',''));const off=/%/.test((s[1].match(/offset="([^"]+)"/)||[])[1]||'')?o/100:o;
      const c=hex((s[1].match(/stop-color="([^"]+)"/)||[])[1]||(s[1].match(/stop-color:\s*([^;"]+)/)||[])[1]||'#808080');return {off,c:c||[128,128,128]};});
    if(!st.length)continue;
    // offset-weighted mean of the stops (trapezoid)
    let acc=[0,0,0],tot=0;const pts=[{off:0,c:st[0].c},...st,{off:1,c:st[st.length-1].c}];
    for(let i=0;i<pts.length-1;i++){const w=Math.max(0,pts[i+1].off-pts[i].off);for(let k=0;k<3;k++)acc[k]+=w*(pts[i].c[k]+pts[i+1].c[k])/2;tot+=w;}
    grads[id]=toHex(tot?acc.map(v=>v/tot):st[0].c);
  }
  let out=svg.replace(/url\(#([^)]+)\)/g,(m,id)=>grads[id]||m);
  out=out.replace(/<(linear|radial)Gradient\b[\s\S]*?<\/\1Gradient>/g,'');
  return {out,count:Object.keys(grads).length};
}
const rows=[];
const mini=fs.readdirSync('mini').filter(x=>fs.statSync(`mini/${x}`).isDirectory()).filter(x=>{const b=x.replace(/-mini$/,'');return LIST.silver.includes(b)||LIST.enamel.includes(b);});
// miniatures are dress-uniform items only: none are made for the ABU/OCP (field uniforms wear regular size)
const JOBS=[...LIST.silver.map(d=>['silver',d]),...LIST.enamel.map(d=>['enamel',d]),...CMDR.map(d=>['silver',d,'cmdr'])];
{
  for(const [src,d,kind] of JOBS){
    const f=`${src}/${d}/${d}.svg`,sp=`${src}/${d}/${d}.spec.json`;if(!fs.existsSync(f)||!fs.existsSync(sp))continue;
    let svg=fs.readFileSync(f,'utf8'),spec=JSON.parse(fs.readFileSync(sp));
    const id=d+'-field',root=svg.match(/^<svg\b[^>]*>/)[0];
    const vb=root.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number),w=+root.match(/width="([\d.]+)in"/)[1],h=+root.match(/height="([\d.]+)in"/)[1];
    const cmdr=kind==='cmdr';
    // commander's insignia: 1 in x 1 in dark blue patch, art fitted inside with the same 1/8 in margin (art scaled to fit; size of the pin is not given in 39-1)
    const k=cmdr?Math.min((100-2*PAD)/vb[2],(100-2*PAD)/vb[3]):1;
    const W=cmdr?100:vb[2]+2*PAD,H=cmdr?100:vb[3]+2*PAD,wi=+(W/100).toFixed(5),hi=+(H/100).toFixed(5);   // root size = viewBox size / 100 exactly, so the backing is an exact rectangle of art + 1/4 in (1/8 in each side)
    const ox=cmdr?(100-vb[2]*k)/2:PAD,oy=cmdr?(100-vb[3]*k)/2:PAD;
    const meta=svg.match(/<metadata>([\s\S]*?)<\/metadata>/)[1],M=JSON.parse(meta);
    const inner=svg.slice(svg.indexOf('</metadata>')+11,svg.lastIndexOf('</svg>'));
    const fl=flatten(inner);
    let body=toSilver(fl.out.split(`${d}__`).join(`${id}__`));
    const shift=a=>Object.fromEntries(Object.entries(a).map(([k2,v])=>[k2,[+(ox+v[0]*k).toFixed(3),+(oy+v[1]*k).toFixed(3)]]));
    const anchors=shift(M.anchors||{});
    anchors.top_center=[W/2,0];anchors.bottom_center=[W/2,H];anchors.center=[W/2,H/2];anchors.left_edge=[0,H/2];anchors.right_edge=[W,H/2];
    anchors.art_top_center=[W/2,oy];anchors.art_bottom_center=[W/2,oy+vb[3]*k];
    const M2={...M,asset_id:id,width_in:wi,height_in:hi,anchors,size_source:cmdr?'estimated':M.size_source,
      size_basis:cmdr?'backing: 1 in x 1 in dark blue patch (CAPR 39-1 ICL 25-06 7.1.1.3.1.7); art scaled to fit inside with 1/8 in margin; the pin size itself is not given':(M.size_basis||'')+' | art size unchanged (regular/miniature size per Attachment 7); backing adds 1/8 in each side',
      citation:CITE,
      field_uniform:{worn_on:['abu','ocp'],max_badges:{abu:2,ocp:4},backing:'dark blue rectangle (square corners)',backing_color:BLUE,thread_color:SILVER,margin_in:0.125,corner_radius_in:0,backing_minus_art_in:cmdr?null:0.25,scale_from_backing:cmdr?null:'art width/height = backing width/height - 0.25 in (1/8 in of blue each side)',art_width_in:+(vb[2]*k/100).toFixed(5),art_height_in:+(vb[3]*k/100).toFixed(5),source_asset:d,kind:cmdr?'commander-insignia-patch':'chest-badge'},
      notes:'ABU/OCP version: the finished badge art recoloured to light silver thread on dark blue (colours mapped by luminance), gradients flattened, 1/8 in blue margin. Derived from '+d+'.'};
    const out=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${wi}in" height="${hi}in" viewBox="0 0 ${+W.toFixed(3)} ${+H.toFixed(3)}" data-source="${(root.match(/data-source="([^"]+)"/)||[])[1]||'reference-art-measured'}" data-asset-id="${id}"><metadata>${JSON.stringify(M2)}</metadata>`
      +`<rect id="${id}__backing" x="0" y="0" width="${+W.toFixed(3)}" height="${+H.toFixed(3)}" rx="${RX}" ry="${RX}" fill="${BLUE}"/><g transform="translate(${+ox.toFixed(3)} ${+oy.toFixed(3)})${k!==1?` scale(${+k.toFixed(5)})`:''}">${body}</g></svg>`;
    fs.mkdirSync(`${OUT}/${id}`,{recursive:true});fs.writeFileSync(`${OUT}/${id}/${id}.svg`,out);
    const spec2={...spec,asset_id:id,width_in:wi,height_in:hi,anchors,field_uniform:M2.field_uniform,size_basis:M2.size_basis,size_source:M2.size_source,citation:CITE,notes:M2.notes,fit_score:undefined,derived_from:`assets/${src}/${d}`};
    fs.writeFileSync(`${OUT}/${id}/${id}.spec.json`,JSON.stringify(spec2,null,1));
    const g=cp.spawnSync('node',[CHECK,`${OUT}/${id}/${id}.svg`],{encoding:'utf8'});let c;try{c=JSON.parse(g.stdout);}catch(e){c={pass:false,fails:['check crashed '+(g.stderr||'').slice(0,60)]};}
    rows.push({id,src,flat:fl.count,pass:c.pass,fails:(c.fails||[]).join('; ')});
  }
}
fs.writeFileSync(`${OUT}/ASSET_REPORT.json`,JSON.stringify(rows,null,1));
console.log('assets',rows.length,'pass',rows.filter(r=>r.pass).length);console.table(rows.filter(r=>!r.pass||/data|filter|text/i.test(r.fails)).slice(0,20));
