// node retrofit-mil.js <set> <idprefix> <service-folder>   e.g. af2 af air-force
// <set>/out-flat/<design>__<variant>.svg -> <set>/final/<id>/<id>.svg + .spec.json (real units, anchors, provenance).
// Sizes are ESTIMATES from the art's aspect (no AFI/AR/NAVPERS dimension tables in the repo): long wings 3.0 in wide, oval badges 2.0 in,
// squarish medallions 1.5 in, tall badges 1.5 in high.
const fs=require('fs'),cp=require('child_process'),path=require('path'),S=path.join(process.env.HOME,'.claude/skills/badge-replicator/scripts');
const [set,pre,svc]=process.argv.slice(2),OUT=`${set}/final`;fs.mkdirSync(OUT,{recursive:true});
const rows=[];
for(const f of fs.readdirSync(`${set}/out-flat`).filter(f=>f.endsWith('.svg')).sort()){
  const n=f.slice(0,-4),[d,l]=n.split('__'),slug=s=>s.replace(/_/g,'-'),id=`${pre}-${slug(d.replace(/^(army|navy|marine_corps|coast_guard)_/,''))}-${slug(l)}`;
  const mk=(w,extra=[])=>cp.spawnSync('node',[`${S}/emit-asset.js`,`${set}/out-flat/${f}`,'--id',id,'--width-in',String(w),'--size-source','estimated',...extra,'--out',`${OUT}/${id}`],{encoding:'utf8'});
  let o=mk(1,['--basis','probe']);if(o.status){console.log('FAIL',n,o.stderr.slice(0,120));continue;}
  const p=JSON.parse(fs.readFileSync(`${OUT}/${id}/${id}.spec.json`)),a=p.width_in/p.height_in;   // a = w/h
  let axis,v,cls;if(a>=2.3){axis='width';v=3.0;cls='long-wings';}else if(a>=1.5){axis='width';v=2.0;cls='oval-or-wide';}else if(a>=0.8){axis='width';v=1.5;cls='medallion';}else{axis='height';v=1.5;cls='tall';}
  const w=axis==='width'?v:v*a;
  const basis=`estimated ${axis} ${v} in from the badge aspect (${a.toFixed(2)}); service dimension table not available in repo`;
  o=mk(+w.toFixed(4),['--basis',basis,'--data-source','reference-art-measured','--generator',`artwork-samples/assets/military/${set}/g*/make*.js`,
    '--ref',`images/military-badges/${svc}/${n}`,'--dims',JSON.stringify({size_class:cls,service:svc,design:d,variant:l})]);
  if(o.status){console.log('FAIL2',n);continue;}
  const g=cp.spawnSync('node',[`${S}/check-asset.js`,`${OUT}/${id}/${id}.svg`,`${set}/ref/${n}.png`],{encoding:'utf8'});let r={};try{r=JSON.parse(g.stdout);}catch(e){r={pass:false,fails:['check crashed']};}
  const spp=`${OUT}/${id}/${id}.spec.json`,s=JSON.parse(fs.readFileSync(spp));
  s.fit_score={silhouette_iou_approx:r.silhouette_iou,note:'bbox-normalised mask IoU vs the product reference; UNRELIABLE where the reference has a camouflage/photo background'};
  s.notes='Flat single-tone silver redraw (outlines + engraving lines only). Texture, shading and small lettering omitted.';
  fs.writeFileSync(spp,JSON.stringify(s,null,1));
  rows.push({id,w:+w.toFixed(3),cls,pass:r.pass,iou:r.silhouette_iou,fails:(r.fails||[]).join('; ')});}
fs.writeFileSync(`${OUT}/ASSET_REPORT.json`,JSON.stringify(rows,null,1));
console.log(set,rows.length,'assets;',rows.filter(r=>!r.pass).length,'below gate (mostly IoU on non-clean refs)');
