#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { setTimeout:delay } = require('node:timers/promises');
const {
  normalizeName, normalizeService, slugify, mergeAwardRecords
} = require('../military/military-core.js');

const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'data', 'import', 'raw', 'official_military_ribbons');
const NORMALIZED_PATH = path.join(ROOT, 'data', 'import', 'normalized', 'military-awards.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'imports', 'official_military_ribbons_manifest.json');
const REPORT_PATH = path.join(ROOT, 'reports', 'official-military-ribbons-import.md');
const OVERRIDES_PATH = path.join(ROOT, 'data', 'rules', 'verified', 'manual-overrides.json');
const VERIFIED_PRECEDENCE_PATH = path.join(ROOT, 'data', 'rules', 'verified', 'service-precedence.json');
const BASE_URL = 'https://www.officialmilitaryribbons.com/';
const USER_AGENT = 'CAP-US-Military-Uniform-Builder/1.0 catalog audit; contact via repository owner';

const PRECEDENCE_PAGES = Object.freeze({
  AIR_FORCE:'united_states_air_force_ribbons_in_precedence.html',
  ARMY:'united_states_army_ribbons_in_precedence.html',
  COAST_GUARD:'united_states_coast_guard_ribbons_in_precedence.html',
  MARINE_CORPS:'united_states_marine_corps_ribbons_in_precedence.html',
  NAVY:'united_states_navy_ribbons_in_precedence.html'
});

const START_PAGES = Object.freeze([
  'index.html', 'shop.html', 'military_ribbons_.html', ...Object.values(PRECEDENCE_PAGES)
]);

function parseArgs(argv){
  const opts={ maxPages:250, delayMs:700, retries:2, saveRaw:true, refresh:false };
  for(let i=2;i<argv.length;i++){
    const arg=argv[i];
    if(arg === '--no-raw') opts.saveRaw=false;
    else if(arg === '--refresh') opts.refresh=true;
    else if(arg === '--max-pages') opts.maxPages=Number(argv[++i]);
    else if(arg === '--delay-ms') opts.delayMs=Number(argv[++i]);
    else if(arg === '--retries') opts.retries=Number(argv[++i]);
    else if(arg === '--help') opts.help=true;
  }
  return opts;
}

function usage(){
  console.log('Usage: npm run import:military-catalog -- [--max-pages 250] [--delay-ms 700] [--retries 2] [--no-raw] [--refresh]');
}

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function rawPathForUrl(url){ return path.join(RAW_DIR,`${crypto.createHash('sha1').update(url).digest('hex')}.html`); }
function decodeEntities(text){
  const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
  return String(text || '')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
    .replace(/&([a-z]+);/gi,(m,n)=>named[n.toLowerCase()] ?? m);
}
function stripTags(html){ return decodeEntities(String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()); }
function attr(tag,name){
  const match=String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}
function canonicalUrl(value, from=BASE_URL){
  try{
    const url=new URL(value,from);
    if(url.hostname.replace(/^www\./,'') !== 'officialmilitaryribbons.com') return null;
    url.hash='';
    for(const key of [...url.searchParams.keys()]) if(/^utm_|^(ref|source|affiliate)$/i.test(key)) url.searchParams.delete(key);
    return url.href;
  }catch{ return null; }
}
function isRelevantUrl(url){
  const pathname=new URL(url).pathname.toLowerCase();
  if(/\.(?:jpe?g|png|gif|webp|svg|pdf|css|js)$/i.test(pathname)) return false;
  if(/(?:knife|ammo|magazine|backpack|bag|tactical|coin|sticker|decal|hat|flag)/.test(pathname)) return false;
  return /(?:ribbon|medal|badge|device|attachment|lapel|rank|insignia|index\.html|shop\.html|military_products)/.test(pathname);
}
function pageCategory(url, title){
  const haystack=`${url} ${title}`.toLowerCase();
  if(/precedence/.test(haystack)) return 'PRECEDENCE';
  if(/lapel/.test(haystack)) return 'LAPEL_PIN';
  if(/badge/.test(haystack)) return 'BADGE';
  if(/device|attachment/.test(haystack)) return 'DEVICE';
  if(/rank/.test(haystack)) return 'RANK';
  if(/medal/.test(haystack) && !/ribbon/.test(haystack)) return 'MEDAL';
  if(/ribbon/.test(haystack)) return 'RIBBON';
  return 'INDEX';
}
function canonicalIdFromSourceUrl(url,label=''){
  let basename='';
  try{ basename=path.posix.basename(new URL(url).pathname).replace(/\.[^.]+$/,''); }catch{}
  const cleaned=basename
    .replace(/^(?:usaf|usa|usn|usmc|uscg)_/i,'')
    .replace(/_(?:military_)?(?:ribbon|medal)$/i,'')
    .replace(/_military_ribbon$/i,'');
  return slugify(cleaned || label)
    .replace(/_miltiary$/,'')
    .replace(/_good_condcut$/,'_good_conduct');
}
function inferServices(text){
  const out=[];
  const pairs=[
    ['ARMY',/\bArmy\b/i],['MARINE_CORPS',/Marine Corps|Marines/i],['NAVY',/\bNavy\b/i],
    ['AIR_FORCE',/Air Force/i],['SPACE_FORCE',/Space Force/i],['COAST_GUARD',/Coast Guard/i],
    ['NATIONAL_GUARD',/National Guard/i],['JOINT_DOD',/Joint|Defense /i],['CAP',/Civil Air Patrol/i]
  ];
  for(const [service,re] of pairs) if(re.test(text)) out.push(service);
  return out;
}
function extractDocument(html,url){
  const title=stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const heading=stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || title);
  const links=[];
  for(const match of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)){
    const href=canonicalUrl(attr(match[0],'href'),url);
    if(!href) continue;
    const text=stripTags(match[0]);
    const imageTag=match[0].match(/<img\b[^>]*>/i)?.[0];
    links.push({ href, text, imageAlt:imageTag ? attr(imageTag,'alt') : '', imageSrc:imageTag ? canonicalUrl(attr(imageTag,'src'),url) || new URL(attr(imageTag,'src'),url).href : null });
  }
  const images=[];
  for(const match of html.matchAll(/<img\b[^>]*>/gi)){
    const raw=attr(match[0],'src');
    if(!raw) continue;
    let src=null; try{ src=new URL(raw,url).href; }catch{}
    images.push({ src, alt:attr(match[0],'alt'), title:attr(match[0],'title'), width:attr(match[0],'width'), height:attr(match[0],'height') });
  }
  return { url, title, heading, category:pageCategory(url,`${title} ${heading}`), services:inferServices(`${url} ${title} ${heading}`), links, images };
}

async function fetchText(url,opts){
  let lastError;
  for(let attempt=0;attempt<=opts.retries;attempt++){
    try{
      const response=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml'}});
      if(response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if(!response.ok) return { ok:false, status:response.status, text:'' };
      return { ok:true, status:response.status, text:await response.text() };
    }catch(err){
      lastError=err;
      if(attempt<opts.retries) await delay(opts.delayMs * (attempt+1));
    }
  }
  throw lastError;
}

async function readRobots(opts){
  const url=new URL('/robots.txt',BASE_URL).href;
  try{
    const result=await fetchText(url,opts);
    if(!result.ok) return { url, status:result.status, disallow:[] };
    const disallow=[]; let applies=false;
    for(const raw of result.text.split(/\r?\n/)){
      const line=raw.replace(/#.*/,'').trim();
      const ua=line.match(/^User-agent:\s*(.+)$/i); if(ua){ applies=ua[1].trim()==='*' || /CAP-US-Military-Uniform-Builder/i.test(ua[1]); continue; }
      const rule=line.match(/^Disallow:\s*(.*)$/i); if(applies && rule?.[1]) disallow.push(rule[1].trim());
    }
    return { url, status:result.status, disallow };
  }catch(err){ return { url, status:'ERROR', disallow:[], error:String(err) }; }
}
function allowedByRobots(url,robots){ return !(robots.disallow || []).some(prefix => prefix && new URL(url).pathname.startsWith(prefix)); }

function awardCandidates(document){
  const candidates=[];
  if(document.category === 'PRECEDENCE'){
    for(const link of document.links){
      const label=normalizeName(link.imageAlt || link.text);
      if(!link.imageSrc || !/\/military_ribbon_info\//i.test(new URL(link.href).pathname)) continue;
      if(!label || label.length<3 || /home|products|precedence|campaign streamer|graphics/i.test(label)) continue;
      candidates.push({ canonicalId:canonicalIdFromSourceUrl(link.href,label), sourceName:label, sourceUrl:link.href, imageSourceUrl:link.imageSrc, type:'RIBBON', services:document.services });
    }
  }else if(['RIBBON','BADGE','LAPEL_PIN','MEDAL','DEVICE','RANK'].includes(document.category)){
    const label=normalizeName(document.heading || document.title);
    const sourcePath=new URL(document.url).pathname;
    const isRibbonItem=/\/military_ribbon_info\//i.test(sourcePath);
    const image=document.images.find(img=>img.alt && !/banner|logo/i.test(img.alt))?.src || null;
    if(label && (document.category !== 'RIBBON' || isRibbonItem)) candidates.push({ canonicalId:canonicalIdFromSourceUrl(document.url,label), sourceName:label, sourceUrl:document.url, imageSourceUrl:image, type:document.category, services:document.services });
  }
  return candidates;
}

function buildPrecedence(documents){
  const result={};
  for(const [service,page] of Object.entries(PRECEDENCE_PAGES)){
    const url=canonicalUrl(page);
    const doc=documents.get(url); if(!doc) continue;
    let order=0, side='LEFT';
    for(const link of doc.links){
      const label=normalizeName(link.imageAlt || link.text);
      if(/right breast/i.test(label)) { side='RIGHT'; continue; }
      if(!label || label.length<3 || /home|products|precedence|campaign|streamer|graphics|medals|badges|patches|rank/i.test(label)) continue;
      if(!link.imageSrc || !/\/military_ribbon_info\//i.test(new URL(link.href).pathname)) continue;
      const id=canonicalIdFromSourceUrl(link.href,label); if(!id) continue;
      result[id]=result[id] || {};
      result[id][service]={order:order++,side,verified:false,source:'OFFICIAL_MILITARY_RIBBONS'};
    }
  }
  return result;
}

function applyManualOverrides(awards){
  let overrides={awards:{},precedence:{},devices:{}};
  if(fs.existsSync(OVERRIDES_PATH)) overrides=JSON.parse(fs.readFileSync(OVERRIDES_PATH,'utf8'));
  return awards.map(award => {
    const merged=Object.assign({},award,overrides.awards?.[award.id] || {});
    merged.precedence=Object.assign({},award.precedence || {},overrides.precedence?.[award.id] || {});
    merged.devices=Object.assign({},award.devices || {},overrides.devices?.[award.id] || {});
    return merged;
  });
}

function applyVerifiedPrecedence(awards){
  if(!fs.existsSync(VERIFIED_PRECEDENCE_PATH)) return awards;
  const verified=JSON.parse(fs.readFileSync(VERIFIED_PRECEDENCE_PATH,'utf8'));
  const byId=new Map(awards.map(award=>[award.id,award]));
  for(const [service,table] of Object.entries(verified)){
    (table.awards || []).forEach((id,order)=>{
      const award=byId.get(id); if(!award) return;
      award.precedence=Object.assign({},award.precedence,{[service]:{order,side:'LEFT',verified:true,source:table.source}});
      award.sources=Object.assign({},award.sources,{regulation:table.source,regulationDate:table.accessed});
      award.verificationStatus='CROSS_REFERENCED';
    });
  }
  return awards;
}

async function main(){
  const opts=parseArgs(process.argv); if(opts.help){ usage(); return; }
  ensureDir(RAW_DIR); ensureDir(path.dirname(MANIFEST_PATH)); ensureDir(path.dirname(REPORT_PATH));
  const robots=await readRobots(opts);
  const queue=START_PAGES.map(page=>canonicalUrl(page)).filter(Boolean);
  const seen=new Set(), documents=new Map(), failures=[], skipped=[];
  while(queue.length && seen.size<opts.maxPages){
    const url=queue.shift(); if(!url || seen.has(url)) continue; seen.add(url);
    if(!allowedByRobots(url,robots)){ skipped.push({url,reason:'ROBOTS_DISALLOW'}); continue; }
    if(!isRelevantUrl(url)){ skipped.push({url,reason:'OUT_OF_SCOPE'}); continue; }
    try{
      const rawPath=rawPathForUrl(url);
      let html='';
      if(!opts.refresh && fs.existsSync(rawPath)) html=fs.readFileSync(rawPath,'utf8');
      else{
        const response=await fetchText(url,opts);
        if(!response.ok){ failures.push({url,status:response.status}); continue; }
        html=response.text;
        if(opts.saveRaw) fs.writeFileSync(rawPath,html);
        await delay(opts.delayMs);
      }
      const doc=extractDocument(html,url); documents.set(url,doc);
      for(const link of doc.links){ if(link.href && !seen.has(link.href) && isRelevantUrl(link.href)) queue.push(link.href); }
    }catch(err){ failures.push({url,error:String(err)}); }
  }

  const candidates=[];
  for(const doc of documents.values()) candidates.push(...awardCandidates(doc));
  const precedence=buildPrecedence(documents);
  const records=candidates.map(item => {
    const id=item.canonicalId || canonicalIdFromSourceUrl(item.sourceUrl,item.sourceName);
    const authorizedServices=(item.services || []).map(normalizeService).filter(service=>service !== 'NATIONAL_GUARD');
    return {
      id, canonicalId:id, name:item.sourceName, officialName:item.sourceName, sourceName:item.sourceName,
      aliases:[], type:item.type, awardClass:item.type === 'RIBBON' ? 'FEDERAL_MILITARY' : 'MILITARY_INSIGNIA',
      category:'UNKNOWN', authorizedServices, status:'UNKNOWN', precedence:precedence[id] || {}, devices:{},
      images:{ ribbon:item.type === 'RIBBON' ? null : undefined, source:item.imageSourceUrl || null, assetStatus:'SOURCE_ONLY' },
      sources:{ catalog:[item.sourceUrl], regulation:null }, sourceUrl:item.sourceUrl,
      verificationStatus:'DISCOVERED'
    };
  });
  const awards=applyVerifiedPrecedence(applyManualOverrides(mergeAwardRecords(records)));
  fs.writeFileSync(NORMALIZED_PATH,JSON.stringify(awards,null,2)+'\n');
  const manifest={
    source:'OFFICIAL_MILITARY_RIBBONS',sourceUrl:BASE_URL,importedAt:new Date().toISOString(),
    robots,pagesVisited:documents.size,failedPages:failures,skippedPages:skipped,
    items:records.map(item=>({sourceUrl:item.sourceUrl,sourceImageUrl:item.images?.source || null,sourceName:item.sourceName,canonicalId:item.id,canonicalName:item.name,category:item.type,servicePages:item.authorizedServices,assetStatus:'SOURCE_ONLY',verificationStatus:item.verificationStatus}))
  };
  fs.writeFileSync(MANIFEST_PATH,JSON.stringify(manifest,null,2)+'\n');
  const types=awards.reduce((map,item)=>(map[item.type]=(map[item.type]||0)+1,map),{});
  const precedenceCount=awards.reduce((sum,item)=>sum+Object.keys(item.precedence||{}).length,0);
  const report=[
    '# OfficialMilitaryRibbons.com Import Report','',`Imported: ${manifest.importedAt}`,
    `Pages visited: ${documents.size}`,`Failed pages: ${failures.length}`,`Skipped pages: ${skipped.length}`,
    `Discovered listings: ${records.length}`,`Canonical records: ${awards.length}`,
    `Ribbons: ${types.RIBBON||0}`,`Badges: ${types.BADGE||0}`,`Lapel pins: ${types.LAPEL_PIN||0}`,
    `Precedence records: ${precedenceCount}`,'',
    'All external images are SOURCE_ONLY because redistribution permission has not been established. The production builder does not hotlink them.',
    'Imported precedence is discovery data and remains unverified until matched to a current official service publication.','',
    '## Failed pages','',...(failures.length?failures.map(item=>`- ${item.url}: ${item.status||item.error}`):['- None']),''
  ];
  fs.writeFileSync(REPORT_PATH,report.join('\n'));
  console.log(JSON.stringify({pages:documents.size,listings:records.length,canonical:awards.length,types,precedenceRecords:precedenceCount,failures:failures.length},null,2));
}

main().catch(err=>{ console.error(err); process.exitCode=1; });
