// Acceptance gates for the dimensionally-exact asset convention. Exit code 1 on any failure.
// usage: node validate-assets.js [dir ...]   (default: ribbons devices badges)
const fs=require('fs'),path=require('path');
const dirs=process.argv.slice(2).length?process.argv.slice(2):['ribbons','devices','badges','garments','nameplates','accessories','insignia','cords'];
const REQUIRED=['top_center','bottom_center','center','left_edge','right_edge'];
const SOURCES=new Set(['regulation','reference-art-measured','reference-art-traced','original','vendor-photo-raster']);
let fails=0,files=0;const allIds=new Map();
const bad=(f,m)=>{fails++;console.log('FAIL',path.basename(f),'-',m);};
for(const d of dirs){const dir=path.join(__dirname,d);if(!fs.existsSync(dir))continue;
  for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.svg'))){
    const fp=path.join(dir,file),s=fs.readFileSync(fp,'utf8');files++;
    const root=s.match(/<svg\b[^>]*>/)[0],attr=n=>(root.match(new RegExp('\\b'+n+'="([^"]*)"'))||[])[1];
    const w=attr('width'),h=attr('height'),vb=(attr('viewBox')||'').split(/\s+/).map(Number);
    if(!/in$/.test(w||'')||!/in$/.test(h||''))bad(fp,'root width/height not in inches');
    const wi=parseFloat(w),hi=parseFloat(h);
    if(vb.length!==4||vb.some(isNaN))bad(fp,'viewBox missing');
    else{
      if(Math.abs(vb[2]/vb[3]-wi/hi)>0.002)bad(fp,`aspect mismatch viewBox ${(vb[2]/vb[3]).toFixed(4)} vs size ${(wi/hi).toFixed(4)}`);
      if(Math.abs(vb[2]-wi*100)>0.05||Math.abs(vb[3]-hi*100)>0.05)bad(fp,'viewBox is not 0.01 in per unit');
      if(vb[0]!==0||vb[1]!==0)bad(fp,'viewBox origin not 0,0');}
    if(!SOURCES.has(attr('data-source')))bad(fp,'data-source missing/invalid');
    const mm=s.match(/<metadata>([\s\S]*?)<\/metadata>/);let meta=null;
    if(!mm)bad(fp,'no <metadata>');else{try{meta=JSON.parse(mm[1].replace(/&lt;/g,'<').replace(/&amp;/g,'&'));}catch(e){bad(fp,'metadata not JSON');}}
    if(meta){
      if(!['regulation','measured','estimated'].includes(meta.size_source))bad(fp,'size_source not set');
      if(meta.size_source==='regulation'&&!(meta.size_citation||meta.citation))bad(fp,'size_source=regulation but no citation');
      if(meta.size_source!=='regulation'&&!meta.size_basis)bad(fp,'non-regulation size has no size_basis');
      for(const a of REQUIRED){const p=meta.anchors&&meta.anchors[a];if(!p)bad(fp,'missing anchor '+a);}
      for(const [k,p] of Object.entries(meta.anchors||{})){if(!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'))continue;
        if(p[0]<-0.01||p[1]<-0.01||p[0]>vb[2]+0.01||p[1]>vb[3]+0.01)bad(fp,`anchor ${k} outside bbox`);}
      if(meta.fit&&typeof meta.fit.score==='number'&&meta.fit.threshold&&meta.fit.score<meta.fit.threshold)bad(fp,`fit ${meta.fit.score} below ${meta.fit.threshold}`);
      if(!fs.existsSync(fp.replace(/\.svg$/,'.spec.json')))bad(fp,'no .spec.json');}
    if(/<text\b/.test(s))bad(fp,'contains <text>');
    if(/<filter\b|filter=/.test(s))bad(fp,'contains filter');
    if(/data:/.test(s))bad(fp,'contains data: URI');
    if(/<image\b/.test(s)&&attr('data-source')!=='vendor-photo-raster')bad(fp,'contains <image> but is not a declared vendor-photo-raster asset');
    const ids=[...s.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]),seen=new Set();
    const aid=attr('data-asset-id');
    for(const i of ids){if(seen.has(i))bad(fp,'duplicate id '+i);seen.add(i);
      if(!i.startsWith(aid+'__')&&i!==aid)bad(fp,`id not namespaced: ${i}`);
      if(allIds.has(i)&&allIds.get(i)!==fp)bad(fp,`id collides with ${path.basename(allIds.get(i))}: ${i}`);allIds.set(i,fp);}
    for(const m of s.matchAll(/url\(#([^)]+)\)/g))if(!seen.has(m[1]))bad(fp,'dangling url(#'+m[1]+')');
  }}
console.log(`${files} assets checked, ${fails} failure(s)`);process.exit(fails?1:0);
