// ROTC / JROTC ribbons built from public-domain reference SVGs (Wikimedia Commons), 1 3/8 x 3/8 in, same conventions as build-military-ribbons.js.
// Inputs : tools/military/rotc/rotc-list.json (names from the public Wikipedia ribbon tables), tools/military/rotc/njrotc-svg-extracts.js (geometry)
// Output : ribbons/military/mil-ribbon-rotc-<service>-<slug>.svg + .spec.json, ribbons/military/_rotc-index.json, _rotc-no-reference.json
const fs=require('fs'),path=require('path');
const HERE=__dirname,OUTD=path.join(HERE,'ribbons/military'),T=path.join(HERE,'tools/military/rotc');
const U=100,W_IN=1.375,H_IN=0.375,W=W_IN*U,H=H_IN*U;
const f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
// reuse the SVG flattening code of the reference fetcher (rect / rectangular path, transform stack)
const src=fs.readFileSync(path.join(HERE,'tools/military/fetch-reference-ribbons.js'),'utf8');
const body=src.slice(src.indexOf('// Flatten rect'),src.indexOf('const rgb='));
const parseSvg=new Function(body+';return parseSvg;')();
const LIST=JSON.parse(fs.readFileSync(path.join(T,'rotc-list.json'))).items;
const EXTRACTS=require(path.join(T,'njrotc-svg-extracts.js'));
// licence metadata read from the Commons API (LicenseShortName) on 2026-10-14
const LICENSE={};
for(const k of Object.keys(EXTRACTS))LICENSE[k]='Public domain';
// CC0 PNG ribbons: stripes measured from the downloaded image (scratch copy, never committed) by measure-military-ribbons.js
const RASTER=JSON.parse(fs.readFileSync(path.join(T,'rotc-raster-measurements.json')));
const rasterKey=f=>f.replace(/[^A-Za-z0-9._-]+/g,'_');
for(const k of Object.keys(RASTER))LICENSE[Object.keys(RASTER).length?k:k]='CC0';
const neutral=h=>{const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));return Math.min(...c)>=232?'ffffff':(Math.max(...c)<=24?'000000':h);};
const SERVICE_LABEL={'navy-jrotc':'Navy JROTC','air-force-jrotc':'Air Force JROTC','army-jrotc':'Army JROTC'};
const built=[],noRef=[];
const seenFile=new Map();
for(const it of LIST){
  const file=it.commons_file.replace(/^File:/,'');
  let ex=EXTRACTS[file];
  const rk=rasterKey(file),ras=RASTER[rk];
  let runsFromRaster=null;
  if(!ex&&ras&&ras.runs&&ras.runs.length)runsFromRaster=ras.runs.map(r=>({x0:r.x0,x1:r.x1,hex:neutral(r.hex)}));
  if(!ex&&!runsFromRaster){noRef.push({service:it.service,name:it.name,file,reason:EXTRACTS[file]===undefined?'no public-domain reference geometry available (licence CC BY-SA 4.0, raster-only, or not fetched)':'' });continue;}
  // one asset per distinct file (the same Commons file is listed under several services/awards)
  if(seenFile.has(file)){seenFile.get(file).also.push({service:it.service,name:it.name});continue;}
  const runsRaw=runsFromRaster||parseSvg(ex);
  if(!runsRaw||!runsRaw.length){noRef.push({service:it.service,name:it.name,file,reason:'reference SVG could not be flattened to stripes'});continue;}
  // merge equal neighbours, drop stripes < 1/64 in
  let st=[];for(const r of runsRaw){const fr=r.x1-r.x0;if(st.length&&st[st.length-1].hex===r.hex)st[st.length-1].frac+=fr;else st.push({hex:r.hex,frac:fr});}
  const tot=st.reduce((a,s)=>a+s.frac,0);st=st.map(s=>({hex:s.hex,frac:s.frac/tot}));
  const minF=(1/64)/W_IN;
  for(;;){const i=st.findIndex(s=>s.frac<minF);if(i<0||st.length<2)break;const t=st[i-1]||st[i+1];t.frac+=st[i].frac;st.splice(i,1);
    const o=[];for(const s of st){if(o.length&&o[o.length-1].hex===s.hex)o[o.length-1].frac+=s.frac;else o.push({...s});}st=o;}
  const svcSlug=it.service==='navy-jrotc'?'navy-jrotc':it.service;
  let id='mil-ribbon-rotc-'+svcSlug+'-'+slug(it.name.replace(/^(Navy|Army|Air Force) JROTC /,''));
  let k=2;const used=new Set(built.map(b=>b.id));while(used.has(id))id=id.replace(/-\d+$/,'')+'-'+(k++);
  const P=s=>`${id}__${s}`;
  let acc=0,g='';const dims=[];
  st.forEach((s,i)=>{const x0=acc*W,x1=Math.min(W,(acc+s.frac)*W);acc+=s.frac;
    g+=`<rect id="${P('stripe-'+i)}" x="${f2(x0)}" y="0" width="${f2(x1-x0)}" height="${H}" fill="#${s.hex}"/>`;
    dims.push({index:i,hex:s.hex,fraction:+s.frac.toFixed(4),x0_in:+(x0/U).toFixed(4),x1_in:+(x1/U).toFixed(4)});});
  const page='https://commons.wikimedia.org/wiki/File:'+encodeURI(file.replace(/ /g,'_'));
  const meta={asset_id:id,name:it.name,size_in:{w:W_IN,h:H_IN},units:'1 user unit = 0.01 in',viewBox:[0,0,W,H],
    size_source:'regulation',
    size_citation:'Ribbon bar 1 3/8 in x 3/8 in (11:3): DoDM 1348.33 / CAPR 39-1 as carried in js/state.js RIBBON_HEIGHT; the reference SVG itself is drawn 34.925 x 9.525 mm = 1 3/8 x 3/8 in; paragraph numbers to be confirmed',
    anchors:{top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]},
    dimensions:{ribbon_width_in:W_IN,ribbon_height_in:H_IN,aspect:'11:3',orientation:'vertical-stripes',stripes:dims,stars:[],frame:null},
    classification:'stripes',program:'ROTC/JROTC',service:it.service,
    authorized_note:'CAPR 39-1 11.2.5: up to three JROTC/ROTC ribbons awarded by military departments may be worn after CAP ribbons while enrolled',
    measurement:{method:runsFromRaster?'stripe widths and colours measured by script from a CC0 PNG (column segmentation, neutrals snapped to white/black)':'stripe geometry read from a public-domain reference SVG (flattened rect/path, transforms applied)',
      fidelity:'reference',source_kind:'public-reference',source_images:[],
      commons_file:'File:'+file,commons_page:page,licence:LICENSE[file],award_list_source:'https://en.wikipedia.org/wiki/Junior_Reserve_Officers%27_Training_Corps (ribbon tables)',
      residual:{reference_exact:true},border_frame_detected:false,photographic_source:false,note:''},
    quality:{color_source:'public reference: Wikimedia Commons File:'+file+' ('+LICENSE[file]+')',geometry_source:runsFromRaster?'public-domain PNG measured by script (mid-height columns)':'public reference SVG, 1:1 stripe positions',snap:null,
      reference:{title:'File:'+file,url:page,license:LICENSE[file],boundary_match:null},superseded_photo_by_clean_variant:false,min_stripe_in:'1/64'},
    also_listed_as:[],
    fit:{method:'n/a (stripe geometry from the public reference SVG)',score:null,threshold:null},grade:'ribbon'};
  built.push({id,file,meta,g,it});seenFile.set(file,meta);
  meta.also=meta.also_listed_as;meta.also=undefined;
  seenFile.set(file,{also:meta.also_listed_as});
}
for(const b of built){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W_IN.toFixed(4)}in" height="${H_IN.toFixed(4)}in" viewBox="0 0 ${W} ${H}" data-asset-id="${b.id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(b.meta.name)}</title><metadata>${esc(JSON.stringify(b.meta))}</metadata><g id="${b.id}__field">${b.g}</g></svg>`;
  fs.writeFileSync(path.join(OUTD,b.id+'.svg'),svg);
  fs.writeFileSync(path.join(OUTD,b.id+'.spec.json'),JSON.stringify(b.meta,null,1));
}
// also-listed: other awards that point to a file already built
for(const it of LIST){const file=it.commons_file.replace(/^File:/,'');const b=built.find(x=>x.file===file);if(b&&b.it!==it)b.meta.also_listed_as.push({service:it.service,name:it.name});}
for(const b of built){fs.writeFileSync(path.join(OUTD,b.id+'.spec.json'),JSON.stringify(b.meta,null,1));
  const p=path.join(OUTD,b.id+'.svg');let s=fs.readFileSync(p,'utf8');
  s=s.replace(/<metadata>.*<\/metadata>/s,'<metadata>'+esc(JSON.stringify(b.meta))+'</metadata>');fs.writeFileSync(p,s);}
fs.writeFileSync(path.join(OUTD,'_rotc-index.json'),JSON.stringify(Object.fromEntries(built.map(b=>[b.file,b.id])),null,1));
fs.writeFileSync(path.join(OUTD,'_rotc-no-reference.json'),JSON.stringify(noRef,null,1));
console.log({built:built.length,no_reference:noRef.length});
