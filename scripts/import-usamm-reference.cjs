#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const ROOT=path.resolve(__dirname,'..');
const RAW=path.join(ROOT,'data','import','raw','usamm');
const MANIFEST=path.join(ROOT,'data','imports','usamm_ezrackbuilder_manifest.json');
const REPORT=path.join(ROOT,'reports','usamm-ezrackbuilder-audit.md');
const START='https://ezrackbuilder.usamm.com/rack-builder/home';
const USER_AGENT='CAP-US-Military-Uniform-Builder/1.0 public reference audit; contact via repository owner';

function ensure(dir){fs.mkdirSync(dir,{recursive:true});}
function canonical(value,base){try{const u=new URL(value,base);if(u.hostname!=='ezrackbuilder.usamm.com')return null;u.hash='';return u.href;}catch{return null;}}
function attrs(html,tag,attribute){const out=[];const re=new RegExp(`<${tag}\\b[^>]*\\b${attribute}\\s*=\\s*(?:"([^"]+)"|'([^']+)')`,'gi');for(const m of html.matchAll(re))out.push(m[1]||m[2]);return out;}
async function get(url){const response=await fetch(url,{headers:{'User-Agent':USER_AGENT,'Accept':'text/html,application/javascript'}});if(!response.ok)throw new Error(`HTTP ${response.status} ${url}`);return response.text();}
function rawName(url,extension='.txt'){return `${crypto.createHash('sha256').update(url).digest('hex')}${extension}`;}

async function main(){
  ensure(RAW); ensure(path.dirname(MANIFEST)); ensure(path.dirname(REPORT));
  const discoveredAt=new Date().toISOString();
  const pages=[],scripts=[],endpoints=[],errors=[];
  let html='';
  try{html=await get(START);fs.writeFileSync(path.join(RAW,rawName(START,'.html')),html);pages.push(START);}catch(error){errors.push(String(error));}
  for(const src of attrs(html,'script','src').map(value=>canonical(value,START)).filter(Boolean)){
    try{
      const body=await get(src); scripts.push(src); fs.writeFileSync(path.join(RAW,rawName(src,'.js')),body);
      for(const match of body.matchAll(/(?:fetch|axios\.(?:get|post)|url\s*:?)\s*\(?\s*["'`]([^"'`]+)["'`]/gi)){
        const endpoint=canonical(match[1],src); if(endpoint) endpoints.push(endpoint);
      }
    }catch(error){errors.push(String(error));}
  }
  const branchLinks=attrs(html,'a','href').map(value=>canonical(value,START)).filter(url=>/select-branch/i.test(url));
  const manifest={
    source:'USAMM_EZ_RACK_BUILDER',sourceUrl:START,discoveredAt,
    accessStatus:errors.length?'PARTIAL':'PUBLIC_HTML_INSPECTED',
    assetPolicy:'SOURCE_ONLY',services:['ARMY','NAVY','MARINE_CORPS','AIR_FORCE','SPACE_FORCE','COAST_GUARD','CAP'],
    pages:[...new Set(pages)],branchLinks:[...new Set(branchLinks)],scripts:[...new Set(scripts)],
    structuredEndpoints:[...new Set(endpoints)],ribbons:[],devices:[],relationships:[],referenceComposites:[],errors
  };
  fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
  const lines=['# USAMM EZ Rack Builder Data Audit','',`Discovered: ${discoveredAt}`,
    `Branches represented by the public selector: ${manifest.services.join(', ')}`,
    `Public HTML pages saved: ${manifest.pages.length}`,`JavaScript bundles saved: ${manifest.scripts.length}`,
    `Structured endpoints identified: ${manifest.structuredEndpoints.length}`,'',
    'No ribbon, device, relationship, or composite is treated as verified merely because it appears in this commercial builder.',
    'External artwork remains SOURCE_ONLY and is not packaged into production.','',
    '## Endpoints','',...(manifest.structuredEndpoints.length?manifest.structuredEndpoints.map(x=>`- ${x}`):['- None exposed in the publicly reachable HTML/bundles inspected.']),'',
    '## Access notes','',...(errors.length?errors.map(x=>`- ${x}`):['- None'])];
  fs.writeFileSync(REPORT,lines.join('\n')+'\n');
  console.log(JSON.stringify({pages:manifest.pages.length,scripts:manifest.scripts.length,endpoints:manifest.structuredEndpoints.length,errors:errors.length},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
