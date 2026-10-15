// Builds every badge / ribbon / device asset in the "dimensionally exact" convention:
//   * root <svg> width/height in inches, viewBox 1 user unit = 0.01 in
//   * <metadata> JSON: size, size_source (+citation), anchors, intra-asset dimensions
//   * ids namespaced with the asset id, no <text>, no filters, no data: URIs
//   * <id>.spec.json next to every <id>.svg
// Inputs: ../cap-ribbons/specs.json, ../gt-lib.js + ../gt-params.json (wreath fit), tools/glyphs_*.json (font outlines as paths)
// Output: ribbons/, devices/, badges/   (run: node build-assets.js)
const fs=require('fs'),path=require('path'),zlib=require('zlib'),{execSync}=require('child_process');
const HERE=__dirname,ART=path.join(HERE,'..');
const out=d=>{const p=path.join(HERE,d);fs.mkdirSync(p,{recursive:true});return p;};
const f2=n=>(+n).toFixed(2);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const U=100; // user units per inch

function root({id,name,wIn,hIn,source,meta,defs='',body}){
  const vbW=+(wIn*U).toFixed(2),vbH=+(hIn*U).toFixed(2);
  const m={asset_id:id,name,size_in:{w:+wIn.toFixed(4),h:+hIn.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,vbW,vbH],...meta};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${wIn.toFixed(4)}in" height="${hIn.toFixed(4)}in" viewBox="0 0 ${vbW} ${vbH}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${defs?`<defs>${defs}</defs>`:''}${body}</svg>`;
  return {svg,spec:m};
}
const write=(dir,id,r)=>{fs.writeFileSync(path.join(dir,id+'.svg'),r.svg);fs.writeFileSync(path.join(dir,id+'.spec.json'),JSON.stringify(r.spec,null,1));};
const stdAnchors=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=a=>a.map(v=>+(+v).toFixed(2));
const anchorsR=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,r2(v)]));

// ============================== ribbons ==============================
const RIB_W=1.375,RIB_H=0.375,K=RIB_W*U/110;   // old specs use a 110x30 grid
function starPts(cx,cy,r){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.382:r;p.push([cx+rr*Math.cos(a),cy+rr*Math.sin(a)]);}return p;}
function buildRibbons(){
  const dir=out('ribbons'),specs=JSON.parse(fs.readFileSync(path.join(ART,'cap-ribbons/specs.json'))).ribbons;
  const W=RIB_W*U,H=RIB_H*U;let n=0;
  for(const r of specs){
    const id='ribbon-'+r.id.replace(/_/g,'-'),P=s=>`${id}__${s}`;
    let body='',acc=0;const stripeDims=[];
    if(r.bitmap){const bg=r.bitmap.rows[0][0][0],sx=W/r.bitmap.width,sy=H/r.bitmap.height;let g='';
      r.bitmap.rows.forEach((row,y)=>{let x=0;row.forEach(([h,c])=>{if(h!==bg)g+=`<rect x="${f2(x*sx)}" y="${f2(y*sy)}" width="${f2(c*sx)}" height="${f2(sy)}" fill="#${h}"/>`;x+=c;});});
      body+=`<g id="${P('bitmap')}"><rect width="${W}" height="${H}" fill="#${bg}"/>${g}</g>`;}
    else{let g='';r.stripes.forEach((s,i)=>{const x0=acc*W,x1=Math.min(W,(acc+s.frac)*W);acc+=s.frac;
        g+=`<rect id="${P('stripe-'+i)}" x="${f2(x0)}" y="0" width="${f2(x1-x0)}" height="${H}" fill="#${s.hex}"/>`;
        stripeDims.push({index:i,hex:s.hex,fraction:s.frac,x0_in:+(x0/U).toFixed(4),x1_in:+(x1/U).toFixed(4)});});
      body+=`<g id="${P('field')}">${g}</g>`;}
    if(r.paths&&r.paths.length)body+=`<g id="${P('emblems')}">`+r.paths.map((p,i)=>`<path id="${P('emblem-'+i)}" d="${p.rings.map(rg=>'M'+rg.map(q=>f2(q[0]*K)+','+f2(q[1]*K)).join('L')+'Z').join('')}" fill="#${p.fill}" fill-rule="evenodd"/>`).join('')+'</g>';
    const devAnch={};
    if(r.devices&&r.devices.length)body+=`<g id="${P('devices')}">`+r.devices.map((d,i)=>{
      devAnch['device_'+i+'_center']=[d.cx*K,d.cy*K];
      return `<polygon id="${P('device-'+i)}" points="${starPts(d.cx*K,d.cy*K,d.r*K).map(q=>f2(q[0])+','+f2(q[1])).join(' ')}" fill="#${d.fill}" stroke="#${d.stroke}" stroke-width="${f2(0.7*K)}" stroke-linejoin="round"/>`;}).join('')+'</g>';
    const verified=String(r.source).startsWith('CAPR');
    const R=root({id,name:r.name,wIn:RIB_W,hIn:RIB_H,source:verified?'regulation':'reference-art-measured',body,
      meta:{
        size_source:'regulation',
        size_citation:'Ribbon bar 1 3/8 in x 3/8 in (11:3), as carried in cap-ribbons/specs.json physicalSize from CAPR 39-3 (28 Dec 2012). Paragraph number to be confirmed.',
        anchors:anchorsR({...stdAnchors(W,H),...devAnch}),
        dimensions:{ribbon_width_in:RIB_W,ribbon_height_in:RIB_H,aspect:'11:3',stripes:stripeDims,device_count:(r.devices||[]).length},
        color_source:r.source,color_verified_against_regulation:verified,
        grade:'ribbon'}});
    R.spec.fit={method:'n/a (stripe fractions from regulation image)',score:null};
    write(dir,id,R);n++;}
  return n;}

// ============================== devices ==============================
const METAL={
  bronze:{hi:'#e0a374',mid:'#b4713f',lo:'#6f4122',edge:'#4a2a14'},
  silver:{hi:'#f4f6f8',mid:'#c3c8ce',lo:'#7d848c',edge:'#4b5057'},
  gold:{hi:'#fff2a8',mid:'#e2b21c',lo:'#9a6a05',edge:'#5f4103'},
};
const G_BLACK=JSON.parse(fs.readFileSync(path.join(HERE,'tools/glyphs_arialblack.json')));
const G_BOLD=JSON.parse(fs.readFileSync(path.join(HERE,'tools/glyphs_arialbold.json')));
const gradDef=(id,m)=>`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.hi}"/><stop offset=".5" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>`;
function placeDevice({id,name,mn,local,physLocalPx,physIn,physWhat,sizeNote,body,feature,dims}){
  // local = bbox in the drawing's own px space; scale so that physLocalPx (a measured span of that drawing) == physIn inches
  const s=physIn*U/physLocalPx,[x0,y0,x1,y1]=local,W=(x1-x0)*s,H=(y1-y0)*s,gid=`${id}__grad`;
  const an={...stdAnchors(W,H)};
  for(const [k,[px,py]] of Object.entries(feature||{}))an[k]=[(px-x0)*s,(py-y0)*s];
  return root({id,name,wIn:W/U,hIn:H/U,source:'original',defs:gradDef(gid,METAL[mn]),
    body:`<g id="${id}__geometry" transform="translate(${f2(-x0*s)} ${f2(-y0*s)}) scale(${(s).toFixed(5)})">${body(gid)}</g>`,
    meta:{size_source:'estimated',size_basis:sizeNote,anchors:anchorsR(an),
      dimensions:{...dims,[physWhat]:physIn,drawing_scale_units_per_local_px:+s.toFixed(5)},metal:mn,grade:'device'}});}
function buildDevices(){
  const dir=out('devices');let n=0;const put=(id,r)=>{r.spec.fit={method:'n/a (original drawing)',score:null};write(dir,id,r);n++;};
  // stars: 10 facets, point-to-point diameter 2R
  for(const mn of ['bronze','silver','gold']){const id=`device-star-${mn}`,cx=60,cy=62,R=40,r=17,p=[];
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r:R;p.push([cx+rr*Math.cos(a),cy+rr*Math.sin(a)]);}
    const m=METAL[mn];
    put(id,placeDevice({id,name:`${mn[0].toUpperCase()+mn.slice(1)} Star`,mn,local:[cx-R*Math.sin(2*Math.PI/5)-.8,cy-R-.8,cx+R*Math.sin(2*Math.PI/5)+.8,cy+R*Math.cos(Math.PI/5)+.8],
      physLocalPx:2*R,physIn:0.1875,physWhat:'point_to_point_diameter_in',
      sizeNote:'3/16 in point-to-point, the usual DoD/AF ribbon-attachment size; not stated in the CAPR 39-1 / 39-3 text held in this repo',
      feature:{star_center:[cx,cy],point_top:[cx,cy-R]},dims:{points:5,outer_radius_ratio:1,inner_radius_ratio:+(r/R).toFixed(3)},
      body:g=>{let b='';for(let i=0;i<10;i++){const a=p[i],c=p[(i+1)%10];b+=`<polygon points="${cx},${cy} ${f2(a[0])},${f2(a[1])} ${f2(c[0])},${f2(c[1])}" fill="${i%2?m.lo:m.hi}" opacity="${i%2?.55:.9}"/>`;}
        const all=p.map(q=>f2(q[0])+','+f2(q[1])).join(' ');
        return b+`<polygon points="${all}" fill="url(#${g})" opacity=".55"/><polygon points="${all}" fill="none" stroke="${m.edge}" stroke-width="1.6" stroke-linejoin="round"/>`;}}));}
  // triangles: clasp / propeller
  for(const [kind,withProp] of [['clasp',false],['propeller',true]])for(const mn of ['bronze','silver']){
    const id=`device-${kind}-${mn}`,m=METAL[mn];
    put(id,placeDevice({id,name:`${mn[0].toUpperCase()+mn.slice(1)} ${kind[0].toUpperCase()+kind.slice(1)}`,mn,local:[11,17,109,99],physLocalPx:96,physIn:0.30,physWhat:'base_width_in',
      sizeNote:'0.30 in base estimated from the ribbon-device scale used in the app; no regulation size located',
      feature:{apex:[60,18],base_center:[60,98]},dims:{shape:withProp?'triangle with 3-blade propeller':'triangle',base_to_height_ratio:+(96/80).toFixed(3)},
      body:g=>{let b=`<polygon points="60,18 108,98 12,98" fill="url(#${g})" stroke="${m.edge}" stroke-width="2" stroke-linejoin="round"/><polygon points="60,18 108,98 96,98 60,34" fill="${m.hi}" opacity=".35"/><polygon points="60,18 12,98 24,98 60,34" fill="${m.lo}" opacity=".35"/>`;
        if(withProp){const hx=60,hy=71,blade='M0,0 C-5,-3 -9.5,-10 -6.5,-20 Q0,-26 6.5,-20 C9.5,-10 5,-3 0,0 Z';
          for(const th of [0,120,240])b+=`<g transform="translate(${hx} ${hy}) rotate(${th})"><path d="${blade}" fill="${m.edge}" stroke="${m.edge}" stroke-width="1.5" stroke-linejoin="round"/><path d="M-1.2,-5 C-3.5,-10 -3.2,-15 -1.4,-19" fill="none" stroke="${m.hi}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>`;
          b+=`<circle cx="${hx}" cy="${hy}" r="5" fill="url(#${g})" stroke="${m.edge}" stroke-width="1.5"/><circle cx="${hx}" cy="${hy}" r="1.6" fill="${m.edge}"/>`;}
        return b;}}));}
  // V device
  {const id='device-v',m=METAL.silver;
   put(id,placeDevice({id,name:'"V" Device',mn:'silver',local:[13,21,107,101],physLocalPx:80,physIn:0.25,physWhat:'height_in',
     sizeNote:'1/4 in tall, the usual V-device size; not stated in the CAPR text held in this repo',feature:{vertex_bottom:[60,100]},dims:{shape:'V'},
     body:g=>`<path d="M14,22 H50 V32 H44 L60,84 L76,32 H70 V22 H106 V32 H98 L72,100 H48 L22,32 H14 Z" fill="url(#${g})" stroke="${m.edge}" stroke-width="2" stroke-linejoin="round"/><path d="M22,32 L48,100 L52,100 L28,32 Z" fill="${m.hi}" opacity=".5"/>`}));}
  // service-year numerals (Arial Black outlines converted to paths; no <text>)
  for(let y=20;y<=75;y+=5){const id=`device-years-${y}`,m=METAL.silver,sz=0.58,ls=-2,str=String(y),gl=[...str].map(c=>G_BLACK[c]);
    const tot=gl.reduce((a,g)=>a+g.adv*sz,0)+ls*(str.length-1);let x=60-tot/2;const runs=[];let minx=1e9,maxx=-1e9;
    gl.forEach(g=>{runs.push({x,g});minx=Math.min(minx,x+g.bbox[0]*sz);maxx=Math.max(maxx,x+g.bbox[2]*sz);x+=g.adv*sz+ls;});
    const top=78+Math.min(...gl.map(g=>g.bbox[1]))*sz,bot=78+Math.max(...gl.map(g=>g.bbox[3]))*sz,pad=3;
    put(id,placeDevice({id,name:`${y} Year Device`,mn:'silver',local:[minx-pad,top-pad,maxx+pad,bot+pad],physLocalPx:(bot-top),physIn:0.20,physWhat:'numeral_height_in',
      sizeNote:'0.20 in numeral height estimated; no regulation size located',feature:{baseline_center:[60,78]},dims:{numeral:y,font_outline_source:'Arial Black, converted to paths'},
      body:g=>{const layer=(attr,tx=0)=>runs.map(r=>`<path transform="translate(${f2(r.x+tx)} ${tx?76.9:78}) scale(${sz})" d="${r.g.d}" ${attr}/>`).join('');
        return `<g>${layer(`fill="${m.edge}" stroke="${m.edge}" stroke-width="${f2(5/sz)}" stroke-linejoin="round"`)}${layer(`fill="url(#${g})" stroke="${m.lo}" stroke-width="${f2(1.2/sz)}" stroke-linejoin="round"`)}${layer(`fill="none" stroke="${m.hi}" stroke-width="${f2(1.4/sz)}" stroke-linejoin="round" opacity=".85"`,-1.1)}</g>`;}}));}
  return n;}

// ============================== Senior Ground Team badge ==============================
function dec(file){const b=fs.readFileSync(file);let p=8,W,H,ct,id=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+l);
  if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}if(t==='IDAT')id.push(d);p+=12+l;}
  const ch={2:3,6:4}[ct],raw=zlib.inflateSync(Buffer.concat(id)),st=W*ch,o=Buffer.alloc(H*st);
  for(let y=0;y<H;y++){const f=raw[y*(st+1)];for(let x=0;x<st;x++){const v=raw[y*(st+1)+1+x],a=x>=ch?o[y*st+x-ch]:0,u=y?o[(y-1)*st+x]:0,c=(x>=ch&&y)?o[(y-1)*st+x-ch]:0;
    let r=v;if(f===1)r=v+a;else if(f===2)r=v+u;else if(f===3)r=v+((a+u)>>1);else if(f===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}o[y*st+x]=r&255;}}
  return {W,H,ch,o};}
function buildGroundTeam(){
  const dir=out('badges'),L=require(path.join(ART,'gt-lib.js')),pf=path.join(ART,'gt-params.json');
  const P=fs.existsSync(pf)?JSON.parse(fs.readFileSync(pf)):L.DEFAULT,Fx=P.fixed||L.FIXED;
  const M={star:Fx.star,disc:Fx.disc,ribbon:Fx.ribbon,tri:{apexX:118,apexY:61,baseY:138,left:80.5,right:155.5,stripe:4.6}};
  const id='badge-senior-ground-team',N=s=>`${id}__${s}`;
  // tight bbox of the drawn silhouette, in the reference's px space
  const sil=L.silhouette(P);let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<L.H;y++)for(let x=0;x<L.W;x++)if(sil[y*L.W+x]){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);}
  x0-=1;y0-=1;x1+=1;y1+=1;
  const PHYS_W_IN=1.75,s=PHYS_W_IN*U/(x1-x0),Wu=(x1-x0)*s,Hu=(y1-y0)*s;
  const pathOf=pts=>pts.map((p,i)=>(i?'L':'M')+f2(p[0])+','+f2(p[1])).join('')+'Z';
  const W_=L.wreath(P);let wreath='';
  for(const b of W_.bands){const d=b.map((p,i)=>(i?'L':'M')+f2(p[0])+','+f2(p[1])).join('');
    wreath+=`<path d="${d}" fill="none" stroke="#8e959d" stroke-width="${f2(P.bandW)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#a9afb6" stroke-width="${f2(P.bandW*0.7)}" stroke-linecap="round" stroke-linejoin="round"/>`;}
  for(const r of W_.rims){const d=r.map((p,i)=>(i?'L':'M')+f2(p[0])+','+f2(p[1])).join('');
    wreath+=`<path d="${d}" fill="none" stroke="#555c64" stroke-width="${f2((P.rimW||6)+1.2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#c3c8ce" stroke-width="${f2(P.rimW||6)}" stroke-linecap="round" stroke-linejoin="round"/>`;}
  for(const row of ['i','o'])for(const l of W_.leaves){if(l.row!==row)continue;
    wreath+=`<path d="${pathOf(l.poly)}" fill="url(#${N('leaf')})" stroke="#555c64" stroke-width=".6" stroke-linejoin="round"/><path d="M${f2(l.spine[0][0])},${f2(l.spine[0][1])} L${f2(l.spine[1][0])},${f2(l.spine[1][1])}" stroke="#7d848c" stroke-width=".5"/>`;}
  const T=M.tri;let stripes='';for(let y=T.apexY+5;y<T.baseY-2;y+=T.stripe)stripes+=`<rect x="70" y="${f2(y)}" width="100" height="2.2" fill="#69707a"/>`;
  const rb=M.ribbon;
  const ribbon=[[-1,1],[1,-1]].map(([a,b])=>{const A=[120+a*rb.half,rb.y0],B=[120+b*rb.half,rb.y1],dx=B[0]-A[0],dy=B[1]-A[1],Ln=Math.hypot(dx,dy),ux=dx/Ln,uy=dy/Ln,nx=-uy*rb.w/2,ny=ux*rb.w/2;
    const pts=[[A[0]+nx,A[1]+ny],[B[0]+nx,B[1]+ny],[B[0]-ux*5,B[1]-uy*5],[B[0]-nx,B[1]-ny],[A[0]-nx,A[1]-ny]];
    return `<path d="M${pts.map(p=>f2(p[0])+','+f2(p[1])).join('L')}Z" fill="url(#${N('m')})" stroke="#444b52" stroke-width="1" stroke-linejoin="round"/><path d="M${f2(A[0]+nx*.35)},${f2(A[1]+ny*.35)} L${f2(B[0]+nx*.35)},${f2(B[1]+ny*.35)}" stroke="#ffffff" stroke-width="1.2" opacity=".8"/>`;}).join('');
  const sp=L.starPts(M.star);
  const star=`<polygon points="${sp.map(p=>f2(p[0])+','+f2(p[1])).join(' ')}" fill="url(#${N('m')})" stroke="#444b52" stroke-width="1.3" stroke-linejoin="round"/>`
    +sp.map(p=>`<path d="M${f2(M.star.cx)},${f2(M.star.cy)} L${f2(p[0])},${f2(p[1])}" stroke="#444b52" stroke-width=".9"/>`).join('');
  // "GT": Arial Bold outlines as paths, size 38, centred on x=115.3, baseline y=135
  const gsz=0.38,gl=[...'GT'].map(c=>G_BOLD[c]),gtot=gl.reduce((a,g)=>a+g.adv*gsz,0);let gx=115.3-gtot/2;
  const letters=gl.map(g=>{const r=`<path transform="translate(${f2(gx)} 135) scale(${gsz})" d="${g.d}" fill="#eef0f2" stroke="#2f353b" stroke-width="${f2(1/gsz)}" stroke-linejoin="round" paint-order="stroke"/>`;gx+=g.adv*gsz;return r;}).join('');
  const defs=`<linearGradient id="${N('m')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfbfc"/><stop offset=".35" stop-color="#cdd1d6"/><stop offset=".65" stop-color="#8f969e"/><stop offset="1" stop-color="#dfe2e6"/></linearGradient>`
    +`<linearGradient id="${N('leaf')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d3d7dc"/><stop offset="1" stop-color="#9aa1a9"/></linearGradient>`
    +`<linearGradient id="${N('disc')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eceef0"/><stop offset="1" stop-color="#b9bfc5"/></linearGradient>`
    +`<linearGradient id="${N('tri')}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1a8"/><stop offset=".5" stop-color="#e9ebed"/><stop offset="1" stop-color="#8b929a"/></linearGradient>`
    +`<clipPath id="${N('tri-clip')}"><path d="M${T.apexX},${T.apexY} L${T.right},${T.baseY} H${T.left} Z"/></clipPath>`;
  const body=`<g id="${N('geometry')}" transform="translate(${f2(-x0*s)} ${f2(-y0*s)}) scale(${s.toFixed(5)})">`
    +`<g id="${N('wreath')}">${wreath}</g><g id="${N('ribbons')}">${ribbon}</g>`
    +`<circle id="${N('disc-outer')}" cx="${M.disc.cx}" cy="${M.disc.cy}" r="${M.disc.R}" fill="url(#${N('m')})" stroke="#444b52" stroke-width="1.8"/>`
    +`<circle id="${N('disc-inner')}" cx="${M.disc.cx}" cy="${M.disc.cy}" r="${M.disc.rim}" fill="url(#${N('disc')})" stroke="#6c737b" stroke-width="1.4"/>`
    +`<path id="${N('triangle')}" d="M${T.apexX},${T.apexY} L${T.right},${T.baseY} H${T.left} Z" fill="url(#${N('tri')})" stroke="#444b52" stroke-width="1.5" stroke-linejoin="round"/>`
    +`<g id="${N('triangle-stripes')}" clip-path="url(#${N('tri-clip')})">${stripes}</g><g id="${N('letters')}">${letters}</g><g id="${N('star')}">${star}</g></g>`;
  // fit vs the reference art (alpha mask IoU), reference decoded through sips
  let fit={method:'silhouette IoU vs images/badges/senior_ground_team_badge.webp (alpha>100), canvas 240x203 px',score:null};
  try{const tmp=path.join(require('os').tmpdir(),'gt_ref.png');
    execSync(`sips -s format png "${path.join(ART,'..','images/badges/senior_ground_team_badge.webp')}" --out "${tmp}" >/dev/null 2>&1`);
    const r=dec(tmp);let I=0,Un=0;for(let y=0;y<Math.min(r.H,L.H);y++)for(let x=0;x<Math.min(r.W,L.W);x++){
      const a=r.ch===4?r.o[(y*r.W+x)*4+3]>100:true,b=sil[y*L.W+x]>0;if(a&&b)I++;if(a||b)Un++;}
    fit.score=+(I/Un).toFixed(4);fit.metric='iou';fit.threshold=0.88;}catch(e){fit.error=String(e).slice(0,120);}
  const R=root({id,name:'Senior Ground Team Badge',wIn:Wu/U,hIn:Hu/U,source:'reference-art-measured',defs,body,
    meta:{size_source:'estimated',size_basis:`No CAP regulation size located. 1.75 in overall width assumed (typical CAP metal-badge pin width); reference art is ${L.W}x${L.H} px with no stated scale. Replace with a measured physical badge.`,
      anchors:anchorsR({...stdAnchors(Wu,Hu),wreath_center:[(L.CX-x0)*s,(Fx.disc.cy-y0)*s],disc_center:[(M.disc.cx-x0)*s,(M.disc.cy-y0)*s],star_center:[(M.star.cx-x0)*s,(M.star.cy-y0)*s],triangle_apex:[(T.apexX-x0)*s,(T.apexY-y0)*s],ribbon_tails_y:[Wu/2,(rb.y1-y0)*s]}),
      dimensions:{disc_radius_in:+(M.disc.R*s/U).toFixed(4),disc_inner_radius_in:+(M.disc.rim*s/U).toFixed(4),star_outer_radius_in:+(M.star.R*s/U).toFixed(4),
        wreath_band_width_in:+(P.bandW*s/U).toFixed(4),leaves_per_side:{outer:(P.nodes&&P.nodes.n)||null,counted_from_art:'see gt-fit-counts.json'},triangle_base_in:+((T.right-T.left)*s/U).toFixed(4),triangle_height_in:+((T.baseY-T.apexY)*s/U).toFixed(4),
        drawing_scale_units_per_ref_px:+s.toFixed(5)},fit,grade:'badge'}});
  R.spec.fit=fit;write(dir,id,R);return 1;}

const nR=buildRibbons(),nD=buildDevices(),nB=buildGroundTeam();
console.log({ribbons:nR,devices:nD,badges:nB});
