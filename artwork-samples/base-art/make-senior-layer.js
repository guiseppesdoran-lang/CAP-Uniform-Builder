// Senior member (adult) Class A layers for the new-style service dress coat, registered to the coat assets (same artwork box):
//   - officer layer : coat epaulets with button, gray epaulet sleeves (blank: grade insignia goes 5/8 in from the outer end, CAPR 39-1 4.1.5.2.1.1 / DAFI 4.5.1.1.1),
//                     US lapel insignia halfway up the lapel seam (4.1.5.2.2.1.1), 1/2 in blue sleeve braid 3 in from the sleeve end (4.1.5.2)
//   - general layer : same with 1 1/2 in sleeve braid
//   - NCO lapel     : US lapel insignia with the circle (NCOs wear the coat without epaulets; chevrons are a separate asset)
// C.K: the women's coat group is built in the traced frame and scaled by K at output (see make-blues-a-female.js COAT_K); hardware
// (US insignia, braid width, rank slot, epaulet button) is counter-scaled by 1/K so it keeps its true size.
// Geometry is read from the traced outlines used by the coats; the artwork box is recovered from the coat spec.
const fs=require('fs'),path=require('path');
const f=n=>(+n).toFixed(3),U=100,here=__dirname,OUTDIR=path.join(here,'..','assets','garments');
const GLY=JSON.parse(fs.readFileSync(path.join(here,'..','assets','tools','glyphs_arialbold_cap.json')));
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>GLY[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{d+=`<path transform="translate(${f(x)} 0)" d="${GLY[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
const CFG={
 male:{arm:[[8.5,3.2],[8.3,6.0],[7.7,10.0],[7.0,14.0]],outline:'jacket_male_outline.json',coat:'garment-blues-class-a-coat',T:8.4,I:4.7,lap:{right:[-2.78,4.08],left:[3.05,4.08]},who:"Men's"},
 female:{K:0.88,arm:[[100,105],[120,190],[137,215],[132,290],[131,352]].map(p=>[(p[0]-301)*0.047,(p[1]-46)*0.047]),outline:'jacket_female_outline.json',coat:'garment-blues-class-a-coat-female',T:9.0,I:5.0,lap:{right:[-3.71,3.38],left:[3.62,3.38]},who:"Women's"}};
const GRAY='#6e6a69',GRAY_D='#4a4746',EPAU='#03256a',STROKE='#00102f',BRAID='#2149a0',BRAID_D='#0a2260';
function cross(poly,y){const xs=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]-y)*(b[1]-y)<0)xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}return xs.sort((p,q)=>p-q);}
const TOPD={};let LAPEL_ONLY=false;
function build(key){
  const C=CFG[key],OUT=JSON.parse(fs.readFileSync(path.join(here,C.outline),'utf8')),spec=JSON.parse(fs.readFileSync(path.join(OUTDIR,C.coat+'.spec.json'),'utf8'));
  const K=C.K||1,vb={x:-spec.size_in.w/K/2,y:-spec.anchors.centerline_top[1]/U/K,w:spec.size_in.w/K,h:spec.size_in.h/K};
  C.lapRest=Object.fromEntries(['right','left'].map(t=>{const r=spec.anchors['lapel_insignia_rest_'+t];return [t,[r[0]/U/K+vb.x,r[1]/U/K+vb.y]];}));
  const o=OUT.outline,maxX=Math.max(...o.map(p=>p[0]));
  const topY=x=>{let b=1e9;for(let i=0;i<o.length;i++){const a=o[i],c=o[(i+1)%o.length],ax=Math.abs(a[0]),cx=Math.abs(c[0]);if(a[0]*c[0]<0)continue;if((ax-x)*(cx-x)<=0&&ax!==cx){const y=a[1]+(c[1]-a[1])*(x-ax)/(cx-ax);if(y<4&&y<b)b=y;}}return b;};
  const LM={};let cuffY=0;for(const p of o)if(Math.abs(p[0])>maxX*0.85&&p[1]>cuffY)cuffY=p[1];
  const parts=(kind,braidW)=>{ // kind: 'officer' | 'nco'
    let g='',tag=s=>s<0?'right':'left';
    // epaulets + gray sleeves
    if(kind==='officer'&&!LAPEL_ONLY)for(const s of [-1,1]){
      const T=[s*C.T,topY(C.T)],I=[s*C.I,topY(C.I)],dx=I[0]-T[0],dy=I[1]-T[1],L=Math.hypot(dx,dy),u=[dx/L,dy/L],n0=[-u[1],u[0]],n=n0[1]>0?n0:[u[1],-u[0]];
      const at=(t,q)=>[T[0]+u[0]*t+n[0]*q,T[1]+u[1]*t+n[1]*q],P=a=>a.map(p=>f(p[0])+','+f(p[1])).join('L');
      const w0=1.9,w1=1.55,th=0.4/K,ep=[at(0,0),at(L,0),at(L,th),at(0,th)];   // edge-on strip lying on the shoulder; the full sleeve is the top-down asset
      g+=`<g id="epaulet-${tag(s)}"><path id="epaulet-${tag(s)}-body" d="M${P(ep)}Z" fill="${EPAU}" stroke="${STROKE}" stroke-width=".05" stroke-linejoin="round"/>`
        +`<circle cx="${f(at(L-0.4,th/2)[0])}" cy="${f(at(L-0.4,th/2)[1])}" r="${f(0.16/K)}" fill="#c9ccd2" stroke="#8d939e" stroke-width=".03"/></g>`;
      const Ls=L*0.74,sl=[at(-0.02,-0.03),at(Ls,-0.03),at(Ls,th+0.03),at(-0.02,th+0.03)];if(tag(s)==='right')TOPD[key]={len:Ls*K,w:((w0+w1)/2)*K,L:L*K,w0:w0*K,w1:w1*K};
      g+=`<g id="epaulet-sleeve-${tag(s)}"><title>Gray epaulet sleeve, ${tag(s)} shoulder (blank: embroidered grade insignia centred 5/8 in from the outer end)</title><path id="epaulet-sleeve-${tag(s)}-body" d="M${P(sl)}Z" fill="${GRAY}" stroke="${GRAY_D}" stroke-width=".05" stroke-linejoin="round"/>`
        +`</g>`;
      // rank slot (compat): sits on the edge-on strip; grade goes on the top-down asset (garment-blues-class-a-epaulet-sleeve-top-*). 5/8 in rule point stays an anchor.
      const rp=at(0.625/K,th/2),sxs=sl.map(p=>p[0]),sys=sl.map(p=>p[1]);
      g+=`<g id="rank-slot-${tag(s)}"><rect x="${f(Math.min(...sxs))}" y="${f(Math.min(...sys))}" width="${f(Math.max(...sxs)-Math.min(...sxs))}" height="${f(Math.max(...sys)-Math.min(...sys))}" fill="none"/></g>`;
      g+=`<g id="rank-rule-point-${tag(s)}"><rect x="${f(rp[0]-0.01)}" y="${f(rp[1]-0.01)}" width=".02" height=".02" fill="none"/></g>`;
    }
    // US lapel insignia
    for(const s of [-1,1]){const [cx,cy0]=C.lapRest[tag(s)],cy=cy0-(kind==='nco'?0.62:0.25)/K;   // bottom of the insignia rests on the gorge seam midpoint, upright
      g+=`<g id="lapel-us-${tag(s)}"><title>US lapel insignia, ${tag(s)} lapel${kind==='nco'?' (circle: NCOs)':' (no circle: officers)'}</title>`
        +`<rect x="${f(cx-(kind==='nco'?0.62:0.45)/K)}" y="${f(cy-(kind==='nco'?0.62:0.3)/K)}" width="${f((kind==='nco'?1.24:0.9)/K)}" height="${f((kind==='nco'?1.24:0.6)/K)}" fill="none"/><g transform="translate(${f(cx)} ${f(cy)}) scale(${f(1/K)}) translate(${f(-cx)} ${f(-cy)})">`
        +(kind==='nco'?`<circle cx="${f(cx)}" cy="${f(cy)}" r=".62" fill="#b9bdc5" stroke="#6b7079" stroke-width=".04"/><circle cx="${f(cx)}" cy="${f(cy)}" r=".5" fill="#8f949d" stroke="#6b7079" stroke-width=".02"/>`:'')
        +`<g fill="#d9dce2" stroke="#6b7079" stroke-width="1.2" paint-order="stroke">${lettering('US',cx,cy,0.5,'#d9dce2',0.04,kind==='nco'?0.62:0.8)}</g></g></g>`;}
    // sleeve braid: a band clipped to the sleeve, perpendicular to the sleeve axis (follows the cuff angle); its edge nearest the sleeve end is 3 in from the end (CAPR 39-1 4.1.5.2 / 4.1.9.2)
    if(kind==='officer'&&!LAPEL_ONLY){const SP=require('./sleeve-anchors.js').profile({outline:o,holes:OUT.holes,arm:C.arm});
      for(const s of [-1,1]){const eY=SP.endY(s),cAt=y=>{const e=SP.edges(y,s);return [(e.xo+e.xi)/2,y];};
        const c1=cAt(eY-0.5),c2=cAt(eY-5),ax=[c1[0]-c2[0],c1[1]-c2[1]],al=Math.hypot(ax[0],ax[1]),u=[ax[0]/al,ax[1]/al],ee=[c1[0]+u[0]*(0.5/u[1]),eY];   // ee = axis point at the sleeve end
        const bw=braidW/K,d0=3.0/K,aOf=(x,y)=>(ee[0]-x)*u[0]+(ee[1]-y)*u[1];   // distance back from the sleeve end along the axis
        const solve=(which,t)=>{let lo=eY-12,hi=eY;for(let i=0;i<48;i++){const m=(lo+hi)/2,e=SP.edges(m,s),x=which==='o'?e.xo:e.xi;if(aOf(x,m)>t)lo=m;else hi=m;}const m=(lo+hi)/2,e=SP.edges(m,s);return [which==='o'?e.xo:e.xi,m];};
        const P1=solve('o',d0),P2=solve('o',d0+bw),P3=solve('i',d0+bw),P4=solve('i',d0),bb=[P1,P2,P3,P4],bx=bb.map(p=>p[0]),by=bb.map(p=>p[1]);
        g+=`<g id="sleeve-braid-${tag(s)}"><title>${braidW}-in blue sleeve braid, 3 in from the sleeve end, ${tag(s)} sleeve (band follows the sleeve)</title><path id="sleeve-braid-${tag(s)}-body" d="M${bb.map(p=>f(p[0])+","+f(p[1])).join("L")}Z" fill="${BRAID}" stroke="${BRAID_D}" stroke-width=".02" stroke-linejoin="round"/></g>`;}}
    return g;};
  return {vb,parts,C};
}
const sizeSrc=(w)=>`Sleeve braid width ${w} in and 3 in from the sleeve end per CAPR 39-1 4.1.5.2 / 4.1.9.2; epaulet width and length estimated from DAFI 36-2903 Figs 4.6-4.7 and the cadet board strips; US insignia size estimated.`;
const nsIds=(svg,id)=>{const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));let o=svg;for(const i of ids){o=o.split(` id="${i}"`).join(` id="${id}__${i}"`).split(`url(#${i})`).join(`url(#${id}__${i})`).split(`href="#${i}"`).join(`href="#${id}__${i}"`);}return o;};
function lm(body,id,vb){
  let xs=[],ys=[];const nums=d=>{const n=d.match(/-?\d*\.?\d+/g)||[];for(let i=0;i+1<n.length;i+=2){xs.push(+n[i]);ys.push(+n[i+1]);}};
  const pm=body.match(new RegExp(`<path id="${id}" d="([^"]+)"`));
  if(pm)nums(pm[1]);
  else{const gm=body.match(new RegExp(`<g id="${id}"[^>]*>[\\s\\S]*?</g>`));if(!gm)return null;
    const rects=gm[0].match(/<rect[^>]*>/g)||[];
    if(rects.length){for(const t of rects){const a=n=>+(t.match(new RegExp(` ${n}="([-\\d.]+)"`))||[])[1];xs.push(a('x'),a('x')+a('width'));ys.push(a('y'),a('y')+a('height'));}}
    else return null;}
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  return {x:+((x0-vb.x)*U).toFixed(2),y:+((y0-vb.y)*U).toFixed(2),w:+((x1-x0)*U).toFixed(2),h:+((y1-y0)*U).toFixed(2)};}
function emit(key,suffix,name,kind,braidW,docs){
  const B=build(key),KK=B.C.K||1,body=B.parts(kind,braidW),id=B.C.coat+'-'+suffix,W=B.vb.w*KK,H=B.vb.h*KK,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const LMs={};for(const t of ['right','left']){for(const [k,i] of [['epaulet_'+t,'epaulet-'+t+'-body'],['epaulet_sleeve_'+t,'epaulet-sleeve-'+t+'-body'],['rank_slot_'+t,'rank-slot-'+t],['rank_rule_point_'+t,'rank-rule-point-'+t],['lapel_us_'+t,'lapel-us-'+t],['sleeve_braid_'+t,'sleeve-braid-'+t+'-body']]){const r=lm(body,i,B.vb);if(r)LMs[k]={x:+(r.x*KK).toFixed(2),y:+(r.y*KK).toFixed(2),w:+(r.w*KK).toFixed(2),h:+(r.h*KK).toFixed(2)};}}
  const cen=r=>[+(r.x+r.w/2).toFixed(2),+(r.y+r.h/2).toFixed(2)];
  const anchors={top_center:[Wu/2,0],bottom_center:[Wu/2,Hu],center:[Wu/2,Hu/2],left_edge:[0,Hu/2],right_edge:[Wu,Hu/2]};
  for(const [k,r] of Object.entries(LMs))if(!/epaulet_(right|left)$/.test(k))anchors[k.replace(/^(.*)$/,'$1_center')]=cen(r);
  const meta={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],size_source:'estimated',size_basis:sizeSrc(braidW||'-'),
    anchors,landmarks:LMs,landmarks_note:'rects are {x,y,w,h} in user units (0.01 in), origin top-left of the artwork box',overlay_of:B.C.coat,documented:docs,
    assumed:['epaulet and epaulet sleeve size','US insignia size','braid colour (blue, not specified as a shade for the Class A coat)','rank insignia not drawn: placed by the rank insignia assets at rank_slot'],fit:{method:'original',score:null},grade:'accessory'};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="original" data-units="0.01in"><title>${name}</title><metadata>${JSON.stringify(meta)}</metadata><g id="art" transform="translate(${f(-B.vb.x*U*KK)} ${f(-B.vb.y*U*KK)}) scale(${f(U*KK)})">${body}</g></svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(meta,null,1));
  console.log('ok',id,svg.length);return {id,body,vb:B.vb};}
const RES=[];
for(const key of ['male','female']){const w=CFG[key].who;
  RES.push(emit(key,'senior-officer',`${w} Class A coat senior member officer layer: epaulets with gray epaulet sleeves, US lapel insignia, 1/2 in blue sleeve braid (overlay, blank grade)`,'officer',0.5,
    ['officers wear the coat with epaulets and embroidered grade on gray epaulet sleeves (CAPR 39-1 4.1.5.2, 4.1.5.2.1.1 / 4.1.9.2, 4.1.9.3.1)','US lapel insignia halfway up the seam, resting on but not over it, no circle (4.1.5.2.2.1.1 / 4.1.9.4.1.1)','1/2 in blue sleeve braid 3 in from the end of the sleeve (4.1.5.2 / 4.1.9.2)','grade insignia 5/8 in from the end of the epaulet, parallel with the sleeve seam (DAFI 36-2903 4.5.1.1.1)']));
  RES.push(emit(key,'general-officer',`${w} Class A coat general officer layer: as the officer layer with 1 1/2 in sleeve braid (overlay, blank grade)`,'officer',1.5,
    ['general officers wear 1 1/2 in blue sleeve braid, 3 in from the end of the sleeve (CAPR 39-1 4.1.5.2 / 4.1.9.2)','otherwise as the officer layer']));
  RES.push(emit(key,'senior-nco-lapel',`${w} Class A coat NCO US lapel insignia with circle (overlay; chevrons are separate assets)`,'nco',0,
    ['US lapel insignia with a circle for NCOs, halfway up the lapel seam (CAPR 39-1 4.1.5.2.2.1.1 / 4.1.9.4.1.1)','NCOs wear the coat without epaulets (4.1.5.2)']));}
// lapel insignia as their own layers (draw above the coat's lapel-foreground): US (officers), US in circle (NCOs); CAP letters are in the cadet officer insignia layer
LAPEL_ONLY=true;
for(const key of ['male','female']){const w=CFG[key].who;
  RES.push(emit(key,'lapel-us',`${w} Class A coat US lapel insignia, officers, no circle (overlay; draw above the lapel foreground)`,'officer',0,['US lapel insignia halfway up the seam, resting on but not over it, letters parallel with the ground, no circle for officers (CAPR 39-1 4.1.5.2.2.1.1 / 4.1.9.4.1.1)']));
  RES.push(emit(key,'lapel-us-nco',`${w} Class A coat US lapel insignia with circle, NCOs (overlay; draw above the lapel foreground)`,'nco',0,['circles are worn around the US insignia for NCOs only (CAPR 39-1 4.1.5.2.2.1.1 / 4.1.9.4.1.1)']));}
LAPEL_ONLY=false;
// top-down gray epaulet sleeves (officer layers), own assets with grade slot anchors, per sex (true size) and shoulder
for(const key of ['male','female']){const D=TOPD[key];if(!D)continue;
  for(const t of ['right','left']){
    const Lw=+D.len.toFixed(3),Wd=+D.w.toFixed(3),PAD=0.1,mir=t==='left',X=x=>mir?Lw-x:x,id=`garment-blues-class-a-epaulet-sleeve-top-${key}-officer-${t}`;
    const al=Math.min(2.3,Lw-0.2),sx0=Math.min(X(0.1),X(0.1+al)),lt=[X(Lw*0.68),Wd/2];
    const body=`<g id="epaulet-sleeve-top"><title>Gray epaulet sleeve, ${t} shoulder, top-down view (blank grade)</title><rect id="sleeve-body" x="0" y="0" width="${f(Lw)}" height="${f(Wd)}" rx=".08" fill="${GRAY}" stroke="${GRAY_D}" stroke-width=".04"/>`
      +`<g transform="translate(${f(lt[0])} ${f(lt[1])}) rotate(${mir?90:-90}) translate(${f(-lt[0])} ${f(-lt[1])})">${lettering('CAP',lt[0],lt[1],0.34,'#e9ecf2',0.08,0.8)}</g></g>`;
    const sl2={x:+((sx0+PAD)*U).toFixed(2),y:+((0.1+PAD)*U).toFixed(2),w:+(al*U).toFixed(2),h:+((Wd-0.2)*U).toFixed(2)},Wu=+((Lw+2*PAD)*U).toFixed(2),Hu=+((Wd+2*PAD)*U).toFixed(2);
    const meta={asset_id:id,name:`${CFG[key].who} Class A epaulet sleeve, gray, ${t} shoulder, top-down (blank grade)`,size_in:{w:+(Lw+2*PAD).toFixed(4),h:+(Wd+2*PAD).toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],size_source:'estimated',
      size_basis:'Length and mean width of the senior layer epaulet sleeve (true size on this coat); gray sampled from the reference photo (images/base/lt_col_blues_class_b_male, #6e6a69); the regulation gives no dimension.',
      anchors:{...{top_center:[Wu/2,0],bottom_center:[Wu/2,Hu],center:[Wu/2,Hu/2],left_edge:[0,Hu/2],right_edge:[Wu,Hu/2]},rank_slot_center:[+(sl2.x+sl2.w/2).toFixed(2),+(sl2.y+sl2.h/2).toFixed(2)],rank_rule_point:[+((X(0.625)+PAD)*U).toFixed(2),+((Wd/2+PAD)*U).toFixed(2)],outer_end_center:[+(((mir?Lw:0)+PAD)*U).toFixed(2),+((Wd/2+PAD)*U).toFixed(2)]},
      landmarks:{sleeve:{x:PAD*U,y:PAD*U,w:Lw*U,h:Wd*U},rank_slot:sl2},landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); rank_slot holds the largest regular-size grade form (Major General star pair 2.2 x 1.2 in); rank_rule_point = 5/8 in from the outer end (DAFI 36-2903 4.5.1.1.1)',
      documented:['officers wear embroidered grade on gray epaulet sleeves (CAPR 39-1 4.1.5.2.1.1 / 4.1.9.3.1)'],assumed:['sleeve size','CAP lettering placement'],fit:{method:'original',score:null},grade:'accessory'};
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${(Lw+2*PAD).toFixed(4)}in" height="${(Wd+2*PAD).toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="original" data-units="0.01in"><title>${meta.name}</title><metadata>${JSON.stringify(meta)}</metadata><g id="art" transform="translate(${f(PAD*U)} ${f(PAD*U)}) scale(${U})">${body}</g></svg>`;
    svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(meta,null,1));console.log('ok',id);}}
if(process.env.PREVIEW){const cp=require('child_process');
  for(const r of RES.filter(r=>/senior-officer|nco-lapel/.test(r.id))){const coat=fs.readFileSync(path.join(OUTDIR,r.id.replace(/-(senior-officer|senior-nco-lapel|general-officer)$/,'')+'.svg'),'utf8'),ov=fs.readFileSync(path.join(OUTDIR,r.id+'.svg'),'utf8');
    const inner=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');const tmp=path.join(process.env.PREVIEW,r.id+'.svg');fs.writeFileSync(tmp,coat.match(/^<svg[^>]*>/)[0]+inner(coat)+inner(ov)+'</svg>');}}
