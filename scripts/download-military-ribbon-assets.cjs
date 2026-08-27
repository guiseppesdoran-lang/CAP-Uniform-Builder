#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { setTimeout:delay } = require('node:timers/promises');

const ROOT = path.resolve(__dirname, '..');
const AWARDS_PATH = path.join(ROOT, 'data', 'import', 'normalized', 'military-awards.json');
const OVERRIDES_PATH = path.join(ROOT, 'data', 'rules', 'verified', 'manual-overrides.json');
const CATALOG_MANIFEST_PATH = path.join(ROOT, 'data', 'imports', 'official_military_ribbons_manifest.json');
const ASSET_MANIFEST_PATH = path.join(ROOT, 'data', 'imports', 'military_ribbon_assets_manifest.json');
const OUTPUT_DIR = path.join(ROOT, 'images', 'military-ribbons');
const USER_AGENT = 'CAP-US-Military-Uniform-Builder/1.0 ribbon asset import; contact via repository owner';

function parseArgs(argv){
  const options={concurrency:6,retries:2,refresh:false};
  for(let index=2;index<argv.length;index++){
    const arg=argv[index];
    if(arg === '--concurrency') options.concurrency=Math.max(1,Number(argv[++index]) || 1);
    else if(arg === '--retries') options.retries=Math.max(0,Number(argv[++index]) || 0);
    else if(arg === '--refresh') options.refresh=true;
  }
  return options;
}

function detectImage(buffer, contentType=''){
  if(buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return {ext:'png',mime:'image/png'};
  if(buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return {ext:'jpg',mime:'image/jpeg'};
  if(buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0,6).toString('ascii'))) return {ext:'gif',mime:'image/gif'};
  if(buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF' && buffer.subarray(8,12).toString('ascii') === 'WEBP') return {ext:'webp',mime:'image/webp'};
  if(buffer.length >= 2 && buffer.subarray(0,2).toString('ascii') === 'BM') return {ext:'bmp',mime:'image/bmp'};
  if(/^(?:<\?xml[\s\S]*?\?>\s*)?<svg\b/i.test(buffer.toString('utf8',0,Math.min(buffer.length,1024)).trim())) return {ext:'svg',mime:'image/svg+xml'};
  throw new Error(`Response is not a supported image (${contentType || 'unknown content type'})`);
}

async function fetchImage(url,retries){
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.2'}});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer=Buffer.from(await response.arrayBuffer());
      if(!buffer.length) throw new Error('Empty response');
      return {buffer,...detectImage(buffer,response.headers.get('content-type') || ''),finalUrl:response.url || url};
    }catch(error){
      lastError=error;
      if(attempt<retries) await delay(350*(attempt+1));
    }
  }
  throw lastError;
}

function existingLocalFile(award){
  const relative=award?.images?.ribbon;
  if(!relative) return null;
  const absolute=path.join(ROOT,...relative.split('/'));
  if(!fs.existsSync(absolute)) return null;
  const buffer=fs.readFileSync(absolute);
  const detected=detectImage(buffer);
  return {relative,absolute,buffer,...detected};
}

async function main(){
  const options=parseArgs(process.argv);
  const awards=JSON.parse(fs.readFileSync(AWARDS_PATH,'utf8'));
  const overrides=fs.existsSync(OVERRIDES_PATH) ? JSON.parse(fs.readFileSync(OVERRIDES_PATH,'utf8')) : {awards:{}};
  for(const award of awards){
    const override=overrides.awards?.[award.id];
    if(override?.images) award.images={...award.images,...override.images};
  }
  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const ribbons=awards.filter(award=>award.type === 'RIBBON');
  const results=[];
  let cursor=0;

  async function worker(){
    while(true){
      const index=cursor++;
      if(index>=ribbons.length) return;
      const award=ribbons[index];
      try{
        const existing=existingLocalFile(award);
        if(existing && !options.refresh){
          results.push({id:award.id,status:'EXISTING',localAsset:existing.relative,mime:existing.mime,bytes:existing.buffer.length,sha256:crypto.createHash('sha256').update(existing.buffer).digest('hex'),sourceUrl:award.images?.source || null});
          continue;
        }
        const sourceUrl=award.images?.source;
        if(!sourceUrl) throw new Error('No source image URL');
        const downloaded=await fetchImage(sourceUrl,options.retries);
        const filename=`${award.id}.${downloaded.ext}`;
        const absolute=path.join(OUTPUT_DIR,filename);
        fs.writeFileSync(absolute,downloaded.buffer);
        const relative=`images/military-ribbons/${filename}`;
        award.images={...award.images,ribbon:relative,assetStatus:'LOCAL_IMPORTED'};
        results.push({id:award.id,status:'DOWNLOADED',localAsset:relative,mime:downloaded.mime,bytes:downloaded.buffer.length,sha256:crypto.createHash('sha256').update(downloaded.buffer).digest('hex'),sourceUrl,finalUrl:downloaded.finalUrl});
      }catch(error){
        results.push({id:award.id,status:'FAILED',sourceUrl:award.images?.source || null,error:String(error?.message || error)});
      }
    }
  }

  await Promise.all(Array.from({length:Math.min(options.concurrency,ribbons.length || 1)},worker));
  fs.writeFileSync(AWARDS_PATH,JSON.stringify(awards,null,2)+'\n');

  if(fs.existsSync(CATALOG_MANIFEST_PATH)){
    const catalog=JSON.parse(fs.readFileSync(CATALOG_MANIFEST_PATH,'utf8'));
    const byId=new Map(results.map(result=>[result.id,result]));
    for(const item of catalog.items || []){
      const result=byId.get(item.canonicalId);
      if(result?.localAsset){ item.localAsset=result.localAsset; item.assetStatus='LOCAL_IMPORTED'; }
    }
    fs.writeFileSync(CATALOG_MANIFEST_PATH,JSON.stringify(catalog,null,2)+'\n');
  }

  results.sort((a,b)=>a.id.localeCompare(b.id));
  const summary=results.reduce((counts,result)=>(counts[result.status]=(counts[result.status]||0)+1,counts),{});
  const manifest={source:'OFFICIAL_MILITARY_RIBBONS',generatedAt:new Date().toISOString(),outputDirectory:'images/military-ribbons',summary,items:results};
  fs.writeFileSync(ASSET_MANIFEST_PATH,JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({ribbons:ribbons.length,...summary},null,2));
  if(summary.FAILED) process.exitCode=1;
}

main().catch(error=>{ console.error(error); process.exitCode=1; });
