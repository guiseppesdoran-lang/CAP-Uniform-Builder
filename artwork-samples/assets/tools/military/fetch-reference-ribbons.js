// Resumable, deliberately slow lookup of public-domain reference ribbons on Wikimedia Commons.
//   node fetch-reference-ribbons.js <ribbons dir> <references.json>
// Politeness: descriptive User-Agent, one request every >= 3 s in total, batched imageinfo (<= 50 titles per call),
// exponential backoff on 429/503 (60 s doubling to 10 min), failures are never cached, stops after 3 consecutive 429s.
// Acceptance: stripe boundaries match the raster measurement (>= 0.8), colours within Lab 75, and the file's licence
// metadata says public domain / PD-USGov. No stripe sequence is taken from memory.
const fs=require('fs'),path=require('path');
const [,,DIR,OUT]=process.argv;
const UA='UniformBuilderAssetCheck/2.0 (local uniform-asset research; low-volume, >=3s between requests; contact: repo owner)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cacheFile=OUT.replace(/\.json$/,'.cache.json');
const cache=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile)):{};
const save=()=>fs.writeFileSync(cacheFile,JSON.stringify(cache));
let last=0,consec429=0,requests=0,stopped=false;
async function throttled(url){
  let wait=60000;
  for(;;){
    const gap=Date.now()-last;if(gap<3000)await sleep(3000-gap);
    last=Date.now();requests++;
    let r;try{r=await fetch(url,{headers:{'User-Agent':UA}});}catch(e){await sleep(10000);continue;}
    if(r.status===429){consec429++;console.log('429 (consecutive',consec429+')');if(consec429>=3){stopped=true;return null;}await sleep(wait);wait=Math.min(wait*2,600000);continue;}
    if(r.status===503){console.log('503, backing off',wait/1000,'s');await sleep(wait);wait=Math.min(wait*2,600000);continue;}
    consec429=0;
    if(!r.ok)return {status:r.status,text:null};
    return {status:200,res:r};
  }}
async function apiJson(params){
  const u='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({format:'json',...params});
  const k='A:'+u;if(cache[k]&&typeof cache[k]==='object')return cache[k];
  const o=await throttled(u);if(!o||!o.res)return null;
  try{const j=await o.res.json();cache[k]=j;return j;}catch(e){return null;}}
async function getText(u){
  const k='T:'+u;if(typeof cache[k]==='string'&&/<svg/.test(cache[k].slice(0,4000)))return cache[k];
  const o=await throttled(u);if(!o||!o.res)return null;
  const x=await o.res.text();if(!/<svg/.test(x.slice(0,4000)))return null;cache[k]=x;return x;}
const STOP=new Set(['file','ribbon','svg','medal','award','the','of','and','military','service','star','for']);
const tok=s=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w));
// Flatten rect / rectangular-path elements (with translate/scale/matrix transforms) painted in document order onto a 1-D strip.
function mulM(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function parseT(t){let m=[1,0,0,1,0,0];if(!t)return m;
  for(const x of t.matchAll(/(matrix|translate|scale)\(([^)]*)\)/g)){const v=x[2].split(/[ ,]+/).filter(Boolean).map(Number);let n=[1,0,0,1,0,0];
    if(x[1]==='matrix'&&v.length===6)n=v;else if(x[1]==='translate')n=[1,0,0,1,v[0]||0,v[1]||0];else if(x[1]==='scale')n=[v[0],0,0,v.length>1?v[1]:v[0],0,0];
    m=mulM(m,n);}
  return m;}
function attrs(tag){const o={};for(const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g))o[m[1]]=m[2];return o;}
function fillOf(a){let f=a.fill;if(!f&&a.style){const m=a.style.match(/(?:^|;)\s*fill:\s*([^;]+)/);f=m&&m[1];}
  if(!f||f==='none')return null;f=f.trim();if(/^#[0-9a-fA-F]{3}$/.test(f))f='#'+f.slice(1).split('').map(c=>c+c).join('');
  return /^#[0-9a-fA-F]{6}$/.test(f)?f.slice(1).toLowerCase():null;}
function pathRects(d){ // every closed axis-aligned rectangle sub-path of d -> [[x0,y0,x1,y1],...]; null if any sub-path is not one
  const t=d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);if(!t)return null;
  const subs=[];let cur=null,i=0,x=0,y=0,sx=0,sy=0,cmd='';
  const push=()=>{if(cur&&cur.length)subs.push(cur);cur=null;};
  while(i<t.length){if(/[a-zA-Z]/.test(t[i]))cmd=t[i++];const n=()=>parseFloat(t[i++]);
    switch(cmd){
      case 'M':push();x=n();y=n();sx=x;sy=y;cur=[[x,y]];cmd='L';break;
      case 'm':push();x+=n();y+=n();sx=x;sy=y;cur=[[x,y]];cmd='l';break;
      case 'H':x=n();cur.push([x,y]);break;case 'h':x+=n();cur.push([x,y]);break;
      case 'V':y=n();cur.push([x,y]);break;case 'v':y+=n();cur.push([x,y]);break;
      case 'L':x=n();y=n();cur.push([x,y]);break;case 'l':x+=n();y+=n();cur.push([x,y]);break;
      case 'Z':case 'z':x=sx;y=sy;push();cmd='';break;
      default:return null;}}
  push();
  const out=[];
  for(const pts0 of subs){const pts=pts0.slice();
    if(pts.length>=2&&Math.abs(pts[0][0]-pts[pts.length-1][0])<1e-6&&Math.abs(pts[0][1]-pts[pts.length-1][1])<1e-6)pts.pop();
    if(pts.length!==4)return null;
    for(let k=0;k<4;k++){const a=pts[k],b=pts[(k+1)%4];if(Math.abs(a[0]-b[0])>1e-6&&Math.abs(a[1]-b[1])>1e-6)return null;}
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);out.push([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]);}
  return out.length?out:null;}
function parseSvg(txt){
  const root=txt.match(/<svg\b[^>]*>/);if(!root)return null;const ra=attrs(root[0]);
  const vb=(ra.viewBox||'').split(/[ ,]+/).map(Number);
  const vx=vb.length===4?vb[0]:0,vw=vb.length===4?vb[2]:parseFloat(ra.width);if(!vw||isNaN(vw))return null;
  const N=Math.max(200,Math.min(2000,Math.round(vw*(vw<100?20:2)))),cells=new Array(N).fill(null);
  const stack=[[1,0,0,1,0,0]];let any=false,h=null;
  for(const m of txt.matchAll(/<(\/?)(g|rect|path|svg)\b([^>]*?)(\/?)>/g)){
    const [,close,name,rest,self]=m;
    if(name==='g'||name==='svg'){if(close){if(stack.length>1)stack.pop();}else if(!self){stack.push(mulM(stack[stack.length-1],parseT(attrs('<g '+rest+'>').transform)));}continue;}
    if(close)continue;
    const a=attrs('<x '+rest+'>');const T=mulM(stack[stack.length-1],parseT(a.transform));
    const fill=fillOf(a);if(!fill)continue;
    {const om=(a.style||'').match(/(?:^|;)\s*opacity:\s*([\d.]+)/),op=om?+om[1]:(a.opacity!==undefined?+a.opacity:1);if(op<0.9)continue;} // scanline / shadow overlays
    let rects;
    if(name==='rect'){const x=+(a.x||0),y=+(a.y||0),w=+a.width,hh=+a.height;if(isNaN(w)||isNaN(hh))continue;rects=[[x,y,x+w,y+hh]];}
    else{rects=pathRects(a.d||'');if(!rects)continue;}
    for(const [x0,,x1] of rects){
      const X0=T[0]*x0+T[4],X1=T[0]*x1+T[4];
      const lo=Math.min(X0,X1),hi=Math.max(X0,X1);
      for(let i=Math.max(0,Math.round((lo-vx)/vw*N));i<Math.min(N,Math.round((hi-vx)/vw*N));i++){cells[i]=fill;any=true;}}
  }
  if(!any)return null;
  const runs=[];cells.forEach((c,i)=>{if(runs.length&&runs[runs.length-1].hex===c)runs[runs.length-1].x1=(i+1)/N;else runs.push({x0:i/N,x1:(i+1)/N,hex:c});});
  return runs.filter(r=>r.hex);}


const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
const lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
function lab(h){const c=rgb(h).map(lin),X=(c[0]*0.4124+c[1]*0.3576+c[2]*0.1805)/0.95047,Y=c[0]*0.2126+c[1]*0.7152+c[2]*0.0722,Z=(c[0]*0.0193+c[1]*0.1192+c[2]*0.9505)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))];}
const at=(runs,x)=>(runs.find(r=>x>=r.x0&&x<r.x1)||runs[runs.length-1]).hex;
function colorErr(ref,meas){const e=[];for(let i=0;i<40;i++){const x=(i+0.5)/40,a=lab(at(ref,x)),b=lab(at(meas,x));e.push(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));}
  e.sort((p,q)=>p-q);return e[Math.floor(e.length*0.6)];}
function matches(ref,meas){ // boundary agreement (reference boundaries vs measured boundaries, 0.035 of the width)
  const rb=ref.slice(1).map(s=>s.x0),mb=meas.slice(1).map(s=>s.x0);
  if(!rb.length)return meas.length<=2?1:0;
  const hit=rb.filter(b=>mb.some(m=>Math.abs(m-b)<0.035)).length/rb.length;
  const back=mb.length?mb.filter(m=>rb.some(b=>Math.abs(m-b)<0.035)).length/mb.length:1;
  return Math.min(hit,back*1.25);}
const isPD=s=>!!s&&/public domain|^pd\b|pd-usgov|pd-us|us government|united states government|cc0/i.test(s);
const specs=fs.readdirSync(DIR).filter(f=>f.startsWith('mil-ribbon-')&&f.endsWith('.spec.json')).map(f=>JSON.parse(fs.readFileSync(path.join(DIR,f))));
const prev=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT)):{};
const todo=[];
for(const s of specs){
  if(s.measurement.fidelity==='exact'||s.measurement.source_kind==='variant')continue;
  if(s.dimensions.orientation==='horizontal-bands'||s.classification==='traced'||s.classification==='diagonal')continue;
  if(prev[s.asset_id]&&prev[s.asset_id].accepted)continue;
  todo.push(s);}
console.log('pending ribbons',todo.length);
(async()=>{
  // phase 1: searches (cached ones are free)
  const cand={};   // asset -> [{title,score,query}]
  for(const s of todo){
    const stems=(s.measurement.source_images||[]).map(p=>p.split('/').pop().replace(/\.[^.]+$/,'').replace(/_/g,' ').replace(/ribb0n/g,'ribbon'));
    const ids=(s.aliases||[]).flatMap(a=>a.award_ids||[]).map(x=>x.replace(/_/g,' '));
    const names=[...new Set([...stems,...ids,...s.award_names,s.name].filter(Boolean).map(x=>x.replace(/\s+/g,' ').trim()))].slice(0,4);
    const list=[];
    for(const nm of names){
      const j=await apiJson({action:'query',list:'search',srsearch:`${nm} ribbon`,srnamespace:'6',srlimit:'10'});
      if(stopped)break;if(!j||!j.query)continue;
      const nt=tok(nm);
      for(const t of j.query.search.map(x=>x.title).filter(t=>/\.svg$/i.test(t)&&/ribbon/i.test(t))){
        const tt=tok(t.replace(/^File:/,''));const ov=nt.filter(w=>tt.includes(w)).length,score=ov/Math.max(1,Math.max(nt.length,tt.length));
        if(score>=0.5)list.push({title:t,score:+score.toFixed(2),query:nm});}}
    if(stopped)break;
    const seen=new Set();cand[s.asset_id]=list.sort((a,b)=>b.score-a.score).filter(c=>!seen.has(c.title)&&seen.add(c.title)).slice(0,3);
    save();}
  // phase 2: batched imageinfo for every candidate title not yet known
  const titles=[...new Set(Object.values(cand).flat().map(c=>c.title))];
  const info={};
  for(const t of titles){const k='I:'+t;if(cache[k])info[t]=cache[k];}
  const need=titles.filter(t=>!info[t]);
  for(let i=0;i<need.length&&!stopped;i+=50){
    const batch=need.slice(i,i+50);
    const j=await apiJson({action:'query',titles:batch.join('|'),prop:'imageinfo',iiprop:'url|extmetadata'});
    if(!j||!j.query)continue;
    const norm={};(j.query.normalized||[]).forEach(n=>norm[n.from]=n.to);
    for(const p of Object.values(j.query.pages||{})){const ii=p.imageinfo&&p.imageinfo[0];if(!ii)continue;
      const rec={url:ii.url,license:(ii.extmetadata&&ii.extmetadata.LicenseShortName&&ii.extmetadata.LicenseShortName.value)||null};
      cache['I:'+p.title]=rec;info[p.title]=rec;}
    save();}
  // phase 3 + 4: download only candidates of ribbons whose licence is acceptable, evaluate
  const out={...prev};
  for(const s of todo){
    if(stopped)break;
    const meas=(s.dimensions.stripes||[]).map(t=>({x0:t.x0_in!==undefined?t.x0_in/1.375:0,x1:t.x1_in!==undefined?t.x1_in/1.375:1,hex:t.hex}));
    let best=null,rejectedLicense=null;
    for(const c of cand[s.asset_id]||[]){
      const inf=info[c.title];if(!inf)continue;
      if(!isPD(inf.license)){rejectedLicense={title:c.title,license:inf.license};continue;}
      const txt=await getText(inf.url);if(stopped)break;if(!txt)continue;
      const ref=parseSvg(txt);if(!ref||!ref.length)continue;
      const m=matches(ref,meas),ce=colorErr(ref,meas);
      if(!best||(m-ce/200)>(best.match-best.color_err/200))best={title:c.title,url:inf.url,license:inf.license,match:+m.toFixed(2),color_err:+ce.toFixed(1),name_score:c.score,query:c.query,
        runs:ref.map(r=>({x0:+r.x0.toFixed(4),x1:+r.x1.toFixed(4),hex:r.hex}))};
    }
    out[s.asset_id]=best?{...best,accepted:best.match>=0.8&&best.color_err<=75}:(rejectedLicense?{accepted:false,reason:'licence not public domain',...rejectedLicense}:{accepted:false,reason:(cand[s.asset_id]||[]).length?'no parseable matching candidate':'no candidate'});
    save();fs.writeFileSync(OUT,JSON.stringify(out,null,1));
  }
  save();fs.writeFileSync(OUT,JSON.stringify(out,null,1));
  const acc=Object.values(out).filter(o=>o.accepted).length;
  console.log(stopped?'STOPPED after 3 consecutive 429s':'done','| requests this run',requests,'| entries',Object.keys(out).length,'| accepted',acc);
  console.log('checked',Object.keys(out).length,'accepted',acc);
})();
