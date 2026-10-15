// ROTC / JROTC ribbons measured from vendor product photographs (Vanguard Industries, vanguardmil.com).
// The photographs are measurement input only: they are read from a scratch directory, never copied into the repo, and no pixel is reused.
// Inputs : $VG_DIR/meas.json (measure-military-ribbons.js output), $VG_DIR/map.json (rotc-no-reference index -> image stem), $VG_DIR/products.json (titles, handles)
// Output : ribbons/military/mil-ribbon-rotc-<service>-<slug>.svg + .spec.json, ribbons/military/_rotc-vendor-index.json; rewrites _rotc-no-reference.json without the items built here
const fs=require('fs'),path=require('path');
const HERE=__dirname,OUTD=path.join(HERE,'ribbons/military');
const VG=process.env.VG_DIR;if(!VG){console.error('set VG_DIR');process.exit(1);}
const U=100,W_IN=1.375,H_IN=0.375,W=W_IN*U,H=H_IN*U;
const f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const rgb=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
function lab(h){const c=rgb(h).map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
  const X=(c[0]*0.4124+c[1]*0.3576+c[2]*0.1805)/0.95047,Y=c[0]*0.2126+c[1]*0.7152+c[2]*0.0722,Z=(c[0]*0.0193+c[1]*0.1192+c[2]*0.9505)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;return [116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))];}
const labD=(a,b)=>Math.sqrt(0.6*(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);
// near-white (cast of up to ~20 levels from photo lighting) -> white, near-black -> black
const snapNeutral=h=>{const c=rgb(h),mn=Math.min(...c),mx=Math.max(...c);return (mn>=232||(mn>=185&&mx-mn<=22))?'ffffff':(mx<=24?'000000':h);};
// palette: regulation CAP ribbon colours + colours of the reference-grade / exact military ribbons already in the tree
const PAL=new Map();PAL.set('ffffff',1);PAL.set('000000',1);
const CAPD=path.join(HERE,'ribbons');
for(const f of fs.readdirSync(CAPD).filter(f=>f.startsWith('ribbon-')&&f.endsWith('.spec.json'))){
  const sp=JSON.parse(fs.readFileSync(path.join(CAPD,f)));
  if(sp.color_verified_against_regulation)(sp.dimensions.stripes||[]).forEach(t=>PAL.set(t.hex.toLowerCase(),1));}
for(const f of fs.readdirSync(OUTD).filter(f=>/^mil-ribbon-.*\.spec\.json$/.test(f))){
  const sp=JSON.parse(fs.readFileSync(path.join(OUTD,f)));const fid=sp.measurement&&sp.measurement.fidelity;
  if(['reference','exact','clean-variant'].includes(fid)&&sp.dimensions&&sp.dimensions.stripes)sp.dimensions.stripes.forEach(t=>PAL.set(t.hex.toLowerCase(),1));}
const PALETTE=[...PAL.keys()].map(hex=>({hex,lab:lab(hex)}));
const SHADE_D=22;const SNAP_MAX=5;    // snap only near-identical shades; wider snaps turned purples navy, so the measured colour is kept beyond this Lab distance
function snapColor(h){h=snapNeutral(h);const L=lab(h);let best=null,bd=1e9;for(const p of PALETTE){const d=labD(L,p.lab);if(d<bd){bd=d;best=p;}}
  return bd<=SNAP_MAX?{hex:best.hex,delta:bd,snapped:true}:{hex:h,delta:bd,snapped:false};}
function mergeNoise(st,minFrac){st=st.map(s=>({...s}));
  const join=()=>{const o=[];for(const s of st){if(o.length&&o[o.length-1].hex===s.hex)o[o.length-1].frac+=s.frac;else o.push({...s});}st=o;};join();
  for(;;){const i=st.findIndex(s=>s.frac<minFrac);if(i<0||st.length<=1)break;const L=st[i-1],R=st[i+1];let t;
    if(L&&R){t=labD(lab(st[i].hex),lab(L.hex))<=labD(lab(st[i].hex),lab(R.hex))?L:R;}else t=L||R;t.frac+=st[i].frac;st.splice(i,1);join();}
  const tot=st.reduce((a,s)=>a+s.frac,0);return st.map(s=>({hex:s.hex,frac:s.frac/tot}));}
// same hue family (both chromatic, hue angle within 14 degrees): a shadow darkens a stripe but does not turn it into another colour
function sameHue(h1,h2){const A=lab(h1),B=lab(h2),c1=Math.hypot(A[1],A[2]),c2=Math.hypot(B[1],B[2]);
  if(c1<18||c2<18)return false;let d=Math.abs(Math.atan2(A[2],A[1])-Math.atan2(B[2],B[1]))*180/Math.PI;if(d>180)d=360-d;return d<14;}
const MEAS=JSON.parse(fs.readFileSync(path.join(VG,'meas.json')));
const MAP=JSON.parse(fs.readFileSync(path.join(VG,'map.json')));
const PROD=JSON.parse(fs.readFileSync(path.join(VG,'products.json')));
const EXTRA=JSON.parse(fs.readFileSync(path.join(VG,'extra.json')));
const PALL={};try{for(const o of JSON.parse(fs.readFileSync(path.join(VG,'pall.json'))))PALL[o.handle.slice(0,60)]=o;}catch(e){}
const NR=JSON.parse(fs.readFileSync(path.join(OUTD,'_rotc-no-reference.json')));
const NRALL=fs.existsSync(path.join(OUTD,'_rotc-no-reference.full.json'))?JSON.parse(fs.readFileSync(path.join(OUTD,'_rotc-no-reference.full.json'))):NR;
if(!fs.existsSync(path.join(OUTD,'_rotc-no-reference.full.json')))fs.writeFileSync(path.join(OUTD,'_rotc-no-reference.full.json'),JSON.stringify(NR,null,1));
const measByStem={};for(const [p,m] of Object.entries(MEAS))measByStem[path.basename(p,'.jpg')]=m;
const prodByStem={};for(const o of PROD)prodByStem[o.handle.slice(0,60)]=o;
const built=[],left=[],used=new Set();
function buildOne(it,i,stem,basis){
  const m=stem&&measByStem[stem];const pr=stem&&prodByStem[stem]||(stem&&PALL[stem]);
  if(!m||m.class!=='stripes'||!m.runs||!m.runs.length||(m.mode&&m.mode!=='V')){left.push({...it,reason:stem?`vendor photo not a plain vertical-stripe ribbon (class ${m&&m.class}, mode ${m&&m.mode})`:'no vendor product found'});return false;}
  let fr=m.runs.map(r=>({hex:snapNeutral(r.hex),frac:r.x1-r.x0}));
  // photo margin: thin white runs at the very ends are background, not ribbon
  const trimmed=[];
  for(const end of ['first','last']){const r=end==='first'?fr[0]:fr[fr.length-1];
    if(fr.length>2&&r.hex==='ffffff'&&r.frac<0.04){fr=end==='first'?fr.slice(1):fr.slice(0,-1);trimmed.push(end);}}
  // lighting shadows on the vendor photo split one stripe into near-identical bands: merge neighbours closer than SHADE_D, keep the lightest
  let shaded=0;
  for(let j=0;j<fr.length-1;){const a=fr[j],b=fr[j+1];
    if(a.hex!==b.hex&&sameHue(a.hex,b.hex)&&labD(lab(a.hex),lab(b.hex))<SHADE_D&&Math.abs(lab(a.hex)[0]-lab(b.hex)[0])>3){
      fr.splice(j,2,{hex:lab(a.hex)[0]>=lab(b.hex)[0]?a.hex:b.hex,frac:a.frac+b.frac});shaded++;}else j++;}
  const sn=fr.map(s=>{const q=snapColor(s.hex);return {hex:q.hex,frac:s.frac,_d:q.delta,_s:q.snapped};});
  const st=mergeNoise(sn,(1/64)/W_IN);
  const svc=it.service,nm=it.name.replace(/^(Navy|Army|Air Force|Marine Corps) JROTC /,'').replace(/ Ribbon \(name not given on the public page\)$/,' Ribbon');
  let id='mil-ribbon-rotc-'+svc+'-'+slug(nm.replace(/ Ribbon$/,''));let k=2;const base=id;
  while(used.has(id)||fs.existsSync(path.join(OUTD,id+'.svg'))&&!fs.readFileSync(path.join(OUTD,id+'.svg'),'utf8').includes('vanguard'))id=base+'-'+(k++);
  used.add(id);
  const P=s=>`${id}__${s}`;let acc=0,g='';const dims=[];
  st.forEach((s,j)=>{const x0=acc*W,x1=Math.min(W,(acc+s.frac)*W);acc+=s.frac;
    g+=`<rect id="${P('stripe-'+j)}" x="${f2(x0)}" y="0" width="${f2(x1-x0)}" height="${H}" fill="#${s.hex}"/>`;
    dims.push({index:j,hex:s.hex,fraction:+s.frac.toFixed(4),x0_in:+(x0/U).toFixed(4),x1_in:+(x1/U).toFixed(4)});});
  const meta={asset_id:id,name:it.name,size_in:{w:W_IN,h:H_IN},units:'1 user unit = 0.01 in',viewBox:[0,0,W,H],
    size_source:'regulation',
    size_citation:'Ribbon bar 1 3/8 in x 3/8 in (11:3): DoDM 1348.33 / CAPR 39-1 as carried in js/state.js RIBBON_HEIGHT',
    anchors:{top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]},
    dimensions:{ribbon_width_in:W_IN,ribbon_height_in:H_IN,aspect:'11:3',orientation:'vertical-stripes',stripes:dims,stars:[],frame:null},
    classification:'stripes',program:'ROTC/JROTC',service:svc,
    authorized_note:'CAPR 39-1 11.2.5: up to three JROTC/ROTC ribbons awarded by military departments may be worn after CAP ribbons while enrolled',
    measurement:{method:'stripe widths and colours measured by script from a vendor product photograph (column segmentation at 440x120 area-averaged grid, white margins trimmed)',
      fidelity:'measured_from_vendor_image',source_kind:'vendor-photo-measured',source_images:[],
      vendor:'Vanguard Industries (vanguardmil.com)',vendor_product:pr?pr.title:null,vendor_product_url:pr?'https://www.vanguardmil.com/products/'+pr.handle:null,
      award_list_source:'https://en.wikipedia.org/wiki/Junior_Reserve_Officers%27_Training_Corps (ribbon tables)',
      residual:m.residual,border_frame_detected:!!m.border_frame_detected,photographic_source:false,
      match_basis:basis||null,note:'photograph used for measurement only and not stored; the vendor title may name a different service (ROTC vs JROTC) than the award list, check before relying on it'},
    quality:{color_source:'vendor photo, snapped to the repo palette where within Lab distance '+SNAP_MAX,geometry_source:'vendor photo, mid-height columns',
      snap:{stripes_before:fr.length,stripes_after:st.length,max_snap_delta:+Math.max(...sn.map(s=>s._d)).toFixed(1),unsnapped:sn.filter(s=>!s._s).length,margin_runs_trimmed:trimmed,shadow_bands_merged:shaded},
      min_stripe_in:'1/64'},
    fit:{method:'n/a (vendor photo measured)',score:null,threshold:null},grade:'ribbon'};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W_IN.toFixed(4)}in" height="${H_IN.toFixed(4)}in" viewBox="0 0 ${W} ${H}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(it.name)}</title><metadata>${esc(JSON.stringify(meta))}</metadata><g id="${id}__field">${g}</g></svg>`;
  fs.writeFileSync(path.join(OUTD,id+'.svg'),svg);fs.writeFileSync(path.join(OUTD,id+'.spec.json'),JSON.stringify(meta,null,1));
  built.push({id,list_index:i,service:svc,name:it.name,vendor_product:pr&&pr.title,stripes:st.length,max_snap:meta.quality.snap.max_snap_delta,unsnapped:meta.quality.snap.unsnapped});
return true;
}
NRALL.forEach((it,i)=>{
  const ex=EXTRA.items.find(e=>e.list_name===it.name);
  if(ex)buildOne(it,i,ex.stem,ex.basis);
  else if(MAP[i])buildOne(it,i,MAP[i],'vendor product title names the award');
  else left.push({...it,reason:'no vendor product found'});});
// awards not on the Wikipedia-derived list (MCJROTC): named by the vendor's own description
EXTRA.items.filter(e=>e.name).forEach((e,j)=>buildOne({service:e.service,name:e.name},1000+j,e.stem,e.basis));
fs.writeFileSync(path.join(OUTD,'_rotc-vendor-index.json'),JSON.stringify(built,null,1));
// remaining unsourced items (public-domain ones were already removed from the full list)
fs.writeFileSync(path.join(OUTD,'_rotc-no-reference.json'),JSON.stringify(left.map(({reason,...r})=>({...r,reason:r.reason||reason})),null,1));
console.table(built.map(b=>({id:b.id.replace('mil-ribbon-rotc-',''),n:b.stripes,snap:b.max_snap,uns:b.unsnapped})));
console.log({built:built.length,still_unsourced:left.length});
