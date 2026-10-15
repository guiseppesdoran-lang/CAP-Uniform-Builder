// Polite fetch of the ROTC/JROTC reference images listed in rotc-list.json from Wikimedia Commons.
//   node fetch-rotc.js rotc-list.json <scratch cache dir> rotc-fetch.json
// Rules: descriptive User-Agent, >= 3 s between requests, batched imageinfo (<= 50 titles), 429/503 backoff 60 s doubling to 10 min,
// stop after 3 consecutive 429s, failures are never recorded as "not found". Files are saved only in the scratch dir (never in the repo).
const fs=require('fs'),path=require('path');
const [,,LIST,CACHE,OUT]=process.argv;
const UA='UniformBuilderAssetCheck/2.0 (local uniform-asset research; low-volume, >=3s between requests; contact: repo owner)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(CACHE,{recursive:true});
let last=0,c429=0,stopped=false,requests=0;
async function get(url,asBuffer){
  let wait=60000;
  for(;;){
    const gap=Date.now()-last;if(gap<3000)await sleep(3000-gap);
    last=Date.now();requests++;
    let r;try{r=await fetch(url,{headers:{'User-Agent':UA}});}catch(e){await sleep(10000);continue;}
    if(r.status===429){c429++;console.log('429 (consecutive',c429+')');if(c429>=3){stopped=true;return null;}await sleep(wait);wait=Math.min(wait*2,600000);continue;}
    if(r.status===503){console.log('503 backoff',wait/1000,'s');await sleep(wait);wait=Math.min(wait*2,600000);continue;}
    c429=0;if(!r.ok)return {status:r.status};
    return {status:200,body:asBuffer?Buffer.from(await r.arrayBuffer()):await r.text()};
  }}
const L=JSON.parse(fs.readFileSync(LIST));
const out=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT)):{};
const titles=[...new Set(L.items.map(i=>i.commons_file))];
(async()=>{
  const need=titles.filter(t=>!(out[t]&&out[t].url));
  for(let i=0;i<need.length&&!stopped;i+=50){
    const b=need.slice(i,i+50);
    const u='https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({format:'json',action:'query',titles:b.join('|'),prop:'imageinfo',iiprop:'url|size|mime|extmetadata'});
    const o=await get(u,false);if(!o||!o.body)break;
    const j=JSON.parse(o.body);
    const norm={};(j.query.normalized||[]).forEach(n=>norm[n.to]=n.from);
    for(const p of Object.values(j.query.pages||{})){
      const key=norm[p.title]||p.title,ii=p.imageinfo&&p.imageinfo[0];
      if(!ii){out[key]={missing:true};continue;}
      const em=ii.extmetadata||{};
      out[key]={url:ii.url,mime:ii.mime,width:ii.width,height:ii.height,
        license:em.LicenseShortName&&em.LicenseShortName.value||null,
        artist:em.Artist&&String(em.Artist.value).replace(/<[^>]+>/g,'').slice(0,120)||null,
        file_page:'https://commons.wikimedia.org/wiki/'+encodeURI(p.title.replace(/ /g,'_'))};}
    fs.writeFileSync(OUT,JSON.stringify(out,null,1));
  }
  // downloads (only public-domain-like licences)
  const isPD=s=>!!s&&/public domain|^pd\b|pd-usgov|pd-us|us government|cc0/i.test(s);
  for(const t of titles){
    if(stopped)break;const r=out[t];if(!r||!r.url||r.saved)continue;
    if(!isPD(r.license)){r.skipped='licence not public domain';continue;}
    const o=await get(r.url,true);if(!o||!o.body){if(o&&o.status)r.error='HTTP '+o.status;continue;}
    const fn=t.replace(/^File:/,'').replace(/[^A-Za-z0-9._-]+/g,'_');
    fs.writeFileSync(path.join(CACHE,fn),o.body);r.saved=fn;
    fs.writeFileSync(OUT,JSON.stringify(out,null,1));
  }
  fs.writeFileSync(OUT,JSON.stringify(out,null,1));
  const have=titles.filter(t=>out[t]&&out[t].saved).length;
  console.log(stopped?'STOPPED after 3 consecutive 429s':'done','| requests',requests,'| files saved',have,'/',titles.length);
  console.log('checked');
})();
