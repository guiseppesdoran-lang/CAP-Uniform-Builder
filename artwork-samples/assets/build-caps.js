// Service caps (men's wheel cap, women's bucket cap) and NCO flight-cap device (the blue boonie hat lives in the CFU coat image, see base-art/hats.js). Front views, real inches, flat colours.
//   CAPR 39-1 6.2.1 (service caps; Fig A5-8 men's, A5-9 women's), 6.2.2.2 + ICL 25-02 (g) (NCO device), 6.2.9-6.2.10 + Fig A5-10 (field cap / boonie).
// Sizes: the regulation gives only the 1 3/4 in band braid. Everything else is scaled so the cap band is 7.4 in across (head ~ 22.5 in = size 7 1/8,
// the same head assumption as base-art/hats.js), and the A5-8 / A5-9 front views are read in that scale: ESTIMATED, flagged in every spec.
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'accessories'),U=100,f=n=>(+n).toFixed(3),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const C={navy:'#0b1f5e',navyD:'#06143f',black:'#161616',strap:'#2b2b2d',silver:'#d3d7dc',silverD:'#8f969e',button:'#b9bec4',red:'#d03638',discBlue:'#14308f',cloudShade:'#9aa1a9'};
const written=[];
function emit(id,name,W,H,body,meta){
  const vb=[0,0,+(W*U).toFixed(2),+(H*U).toFixed(2)];
  const m={asset_id:id,name,size_in:{w:+W.toFixed(3),h:+H.toFixed(3)},units:'1 user unit = 0.01 in',viewBox:vb,colours:C,grade:'accessory',...meta};
  fs.writeFileSync(path.join(OUT,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(3)}in" height="${H.toFixed(3)}in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata><g transform="scale(${U})">${body}</g></svg>`);
  fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify({...m,fit:{method:'n/a',score:null}},null,1));written.push(id);}
const A=(W,H)=>({top_center:[W*U/2,0],bottom_center:[W*U/2,H*U],center:[W*U/2,H*U/2],left_edge:[0,H*U/2],right_edge:[W*U,H*U/2]});
const P=(pts)=>'M'+pts.map(q=>f(q[0])+','+f(q[1])).join('L')+'Z';
const SIZE_BASIS='Not dimensioned in CAPR 39-1 beyond the 1 3/4 in band braid (6.2.1.1.1). Scaled so the band is 7.4 in across (head ~22.5 in, as in base-art/hats.js); proportions read from CAPR 39-1 Fig A5-8 / A5-9 front views.';
// ---- cloud + dart ornament (silver embroidery on the visor / crown band): a cloud of three lobes with a dart streaking toward the outside
function cloud(id,cx,cy,s,dir){ // dir = +1 outward to the right, -1 to the left
  const lobes=[[0,0,0.20],[0.17,-0.08,0.17],[0.30,0.02,0.15],[0.12,0.10,0.15]].map(([x,y,r])=>`<circle cx="${f(cx+dir*x*s)}" cy="${f(cy+y*s)}" r="${f(r*s)}" fill="${C.silver}" stroke="${C.cloudShade}" stroke-width="0.02"/>`).join('');
  const d=[[0.30,0.0],[0.78,-0.05],[0.62,0.0],[0.78,0.07]].map(([x,y])=>[cx+dir*x*s,cy+y*s]);
  const dart=`<path d="M${f(d[0][0])},${f(d[0][1])}L${f(d[1][0])},${f(d[1][1])}L${f(d[2][0])},${f(d[2][1])}L${f(d[3][0])},${f(d[3][1])}Z" fill="${C.silver}" stroke="${C.cloudShade}" stroke-width="0.02"/>`;
  return `<g id="${id}">${dart}${lobes}</g>`;}
// ---- men's service cap (wheel cap), front view
function mensCap(key,label,n,cadet){
  const id=`hat-service-cap-men-${key}`,W=11.5,H=6.6,cx=W/2;
  const bw=7.4,bx=cx-bw/2,by=2.25,bh=1.75;            // band 1 3/4 in braid
  const crown=`M0.1,2.05 C0.15,0.55 1.6,0.12 ${f(cx)},0.1 C${f(W-1.6)},0.12 ${W-0.15},0.55 ${W-0.1},2.05 C${W-0.5},2.55 ${f(bx+bw+0.4)},2.45 ${f(bx+bw)},${by+0.05} L${f(bx)},${by+0.05} C${f(bx-0.4)},2.45 0.5,2.55 0.1,2.05 Z`;
  let b=`<path id="${id}__crown" d="${crown}" fill="${C.navy}" stroke="${C.navyD}" stroke-width="0.04" stroke-linejoin="round"/>`
   +`<rect id="${id}__band" x="${f(bx)}" y="${by}" width="${bw}" height="${bh}" fill="${C.navy}" stroke="${C.navyD}" stroke-width="0.04"/>`
   +Array.from({length:6},(_,i)=>`<path d="M${f(bx)},${f(by+0.25+i*0.25)}L${f(bx+bw)},${f(by+0.25+i*0.25)}" stroke="${C.navyD}" stroke-width="0.03"/>`).join('')
   +`<g id="${id}__visor"><path d="M${f(bx+0.3)},${f(by+bh+0.35)} C${f(bx+0.9)},${f(by+bh+2.3)} ${f(cx-1.8)},${f(by+bh+2.55)} ${f(cx)},${f(by+bh+2.55)} C${f(cx+1.8)},${f(by+bh+2.55)} ${f(bx+bw-0.9)},${f(by+bh+2.3)} ${f(bx+bw-0.3)},${f(by+bh+0.35)} Z" fill="${C.black}"/></g>`
   +`<g id="${id}__chinstrap"><rect x="${f(bx+0.05)}" y="${f(by+bh)}" width="${f(bw-0.1)}" height="0.42" fill="${C.strap}"/><circle cx="${f(bx+0.25)}" cy="${f(by+bh+0.21)}" r="0.17" fill="${C.button}" stroke="${C.silverD}" stroke-width="0.02"/><circle cx="${f(bx+bw-0.25)}" cy="${f(by+bh+0.21)}" r="0.17" fill="${C.button}" stroke="${C.silverD}" stroke-width="0.02"/></g>`;
  // clouds and darts on each side of the visor: 3 (general) / 2 (field grade)
  const vy=by+bh+0.55;
  for(let i=0;i<n;i++){const xo=0.75+i*(n===3?0.78:0.95),yy=vy+0.30+0.40*Math.pow(i/Math.max(1,n-1),2);
    b+=cloud(`${id}__cloud_r${i+1}`,cx+xo,yy,1.1,1)+cloud(`${id}__cloud_l${i+1}`,cx-xo,yy,1.1,-1);}
  const slot=[cx,1.35],sw=2.0;
  b+=`<rect id="${id}__device_slot" x="${f(slot[0]-sw/2)}" y="${f(slot[1]-sw/2)}" width="${sw}" height="${sw}" fill="none"/>`;
  emit(id,`Men's service cap (wheel cap), ${label}`,W,H,b,{size_source:'estimated',size_basis:SIZE_BASIS,
    provenance:'drawn from CAPR 39-1 Fig A5-8 (front views of the four men\'s service caps); no cap was measured',
    anchors:{...A(W,H),device_slot_center:[slot[0]*U,slot[1]*U],garment_attach_center:[cx*U,(by+bh)*U],band_top_center:[cx*U,by*U],visor_center:[cx*U,(by+bh+1.1)*U],front_center:[cx*U,H*U/2]},
    landmarks:{device_slot:{x:(slot[0]-sw/2)*U,y:(slot[1]-sw/2)*U,w:sw*U,h:sw*U},band:{x:bx*U,y:by*U,w:bw*U,h:bh*U}},
    landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); device_slot is a nominal 2 in box centred where the CAP service cap insignia sits (centred on the front of the crown)',
    dimensions:{crown_w_in:W-0.2,band_w_in:bw,band_h_in:bh,visor_drop_in:2.55,clouds_and_darts_per_side:n,visor:'black'},
    documented:['visor-type cap banded with dark blue 1 3/4 in braid, front black chinstrap (6.2.1.1.1)','general officers: three clouds and darts on each side of the visor (6.2.1.3.1)','field grade (Col, Lt Col, Maj): two on each side (6.2.1.3.2)','company grade, flight officers, NCOs, cadet officers: plain black visor (6.2.1.3.3)',cadet?'cadet officers wear the cadet service cap insignia; no clouds or darts (6.2.1.1.1)':'officers and NCOs wear the CAP service cap insignia / NCO device centred on the front (6.2.1.1.1, ICL 25-02)','worn by officers, NCOs and cadet officers with Class A and Class B; not cadet NCOs or Airmen (6.2.1.1)'],
    assumed:['all dimensions except the band height','colours sampled from the figure','chinstrap and button size','cloud/dart ornaments drawn as a simplified cluster, not the embroidered pattern']});
}
// ---- women's service cap (bucket cap), front view
function womensCap(key,label,n,cadet){
  // silhouette = per-column profile of the CAPR 39-1 Fig A5-9 service cap (A5-9 p.140, 6x render; base-art/rank-traces/capprof_sv*.json), scaled to 8.2 in wide
  const prof=JSON.parse(fs.readFileSync(path.join(__dirname,'..','base-art','rank-traces',cadet?'capprof_svc.json':'capprof_svo.json'),'utf8'));
  const id=`hat-service-cap-women-${key}`,W=8.2,k=W/(prof.x1-prof.x0);
  const ytop=Math.min(...prof.top.map(q=>q[1])),ybot=Math.max(...prof.bot.map(q=>q[1])),H=+((ybot-ytop)*k).toFixed(3),cx=W/2;
  const X=px=>(px-prof.x0)*k,Y=py=>(py-ytop)*k;
  const topPts=prof.top.map(q=>`${f(X(q[0]))},${f(Y(q[1]))}`),botPts=prof.bot.slice().reverse().map(q=>`${f(X(q[0]))},${f(Y(q[1]))}`);
  const body='M'+topPts.join('L')+'L'+botPts.join('L')+'Z';
  const gid=`${id}__g`;
  let b=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#143077"/><stop offset="0.55" stop-color="${C.navy}"/><stop offset="1" stop-color="#071a52"/></linearGradient></defs>`
   +`<path id="${id}__body" d="${body}" fill="url(#${gid})" stroke="${C.navyD}" stroke-width="0.04" stroke-linejoin="round"/>`
   // construction lines read off the figure: crown plate lower edge and the lower seam (bucket cap, sides form a front brim)
   +`<path id="${id}__plate" d="M${f(0.12*W)},${f(0.30*H)} C${f(0.35*W)},${f(0.36*H)} ${f(0.65*W)},${f(0.36*H)} ${f(0.88*W)},${f(0.30*H)}" fill="none" stroke="${C.navyD}" stroke-width="0.035" stroke-opacity="0.8"/>`
   +`<path id="${id}__seam" d="M${f(0.09*W)},${f(0.66*H)} C${f(0.30*W)},${f(0.76*H)} ${f(0.70*W)},${f(0.76*H)} ${f(0.91*W)},${f(0.66*H)}" fill="none" stroke="${C.navyD}" stroke-width="0.04"/>`
   +`<path id="${id}__edge_light" d="M${topPts.slice(0,Math.floor(topPts.length*0.5)).join('L')}" fill="none" stroke="#3a56a8" stroke-width="0.03" stroke-opacity="0.6"/>`;
  if(n>0){ // crown band panel with clouds and darts either side of the device (Fig A5-9: crown band for generals / field grade)
    for(let i=0;i<n;i++){const xo=0.95+i*0.85;b+=cloud(`${id}__cloud_r${i+1}`,cx+xo,0.62*H,0.95,1)+cloud(`${id}__cloud_l${i+1}`,cx-xo,0.62*H,0.95,-1);}
  }
  const slot=[cx,0.39*H],sw=1.8;
  b+=`<rect id="${id}__device_slot" x="${f(slot[0]-sw/2)}" y="${f(slot[1]-sw/2)}" width="${sw}" height="${sw}" fill="none"/>`;
  emit(id,`Women's service cap (bucket cap), ${label}`,W,H,b,{size_source:'estimated',
    size_basis:'Width 8.2 in kept (head ~22.5 in, as base-art/hats.js); outline measured from the CAPR 39-1 Fig A5-9 service cap (width : height = '+(1/((ybot-ytop)/(prof.x1-prof.x0))).toFixed(3)+'), so height '+H+' in. The regulation gives no cap dimensions.',
    provenance:'outline traced per column from CAPR 39-1 Fig A5-9 (women\'s service caps, p.140); crown plate and lower seam lines read off the figure',
    anchors:{...A(W,H),device_slot_center:[slot[0]*U,slot[1]*U],garment_attach_center:[cx*U,0.82*H*U],front_center:[cx*U,H*U/2]},
    landmarks:{device_slot:{x:(slot[0]-sw/2)*U,y:(slot[1]-sw/2)*U,w:sw*U,h:sw*U}},
    landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); device_slot is a nominal box centred where the CAP service cap insignia sits (centred on the front)',
    dimensions:{width_in:W,height_in:H,clouds_and_darts_per_side:n,visor:'blue (women\'s service cap visor is blue, 6.2.1.3.3)',
      difference_note:cadet?'cadet officer cap: same cap body as the officer/NCO cap; the difference is the device (cap-device-cadet-officer-service) and no clouds or darts (6.2.1.1.1, 6.2.1.2.1)':'officer/NCO cap: CAP service cap insignia (cap-device-officer-service) or NCO device; clouds and darts by grade (6.2.1.3)'},
    documented:['rounded design, sides form a front brim, solid blue hat cover (6.2.1.2.1)','Maj Gen / Brig Gen crown band: three clouds and darts per side; Col / Lt Col / Maj: two per side (Fig A5-9, 6.2.1.3.1-2)',cadet?'cadet officers wear the cadet service cap insignia; no clouds or darts':'officers and NCOs wear the CAP service cap insignia; clouds and darts by grade'],
    assumed:['width','colours sampled from the figure','construction lines']});
}
// ---- NCO device for the flight cap (Fig A5-8: "Cadet Airman and NCO flight cap"): blue disc, silver rim, silver wings, red propeller
function ncoDevice(){
  const id='cap-device-nco-flight',D0=0.9,D=1.3,K=D/D0,c=(D0+0.04)/2,W=(D0+0.04)*K,H=W;
  let b=`<circle id="${id}__rim" cx="${f(c)}" cy="${f(c)}" r="${f(D/2)}" fill="${C.silver}" stroke="${C.silverD}" stroke-width="0.015"/><circle id="${id}__field" cx="${f(c)}" cy="${f(c)}" r="${f(D/2-0.085)}" fill="${C.discBlue}"/>`;
  // wings: two mirrored swept shapes of three feather bars
  const wing=(s)=>[0,1,2].map(i=>{const y=c+0.02-i*0.0,x0=c+s*0.045,len=0.30-i*0.04,dy=i*0.055-0.02;
    return `<path d="M${f(x0)},${f(c-0.075+dy)}L${f(x0+s*len)},${f(c-0.13+dy)}L${f(x0+s*(len-0.03))},${f(c-0.085+dy)}L${f(x0+s*(len-0.02))},${f(c-0.05+dy)}Z" fill="${C.silver}"/>`;}).join('');
  b+=`<g id="${id}__wings">${wing(1)}${wing(-1)}</g>`;
  b+=`<path id="${id}__propeller" d="M${f(c)},${f(c-0.30)}L${f(c+0.035)},${f(c-0.05)}L${f(c+0.025)},${f(c+0.30)}L${f(c-0.025)},${f(c+0.30)}L${f(c-0.035)},${f(c-0.05)}Z" fill="${C.red}"/>`;
  b=`<g transform="scale(${f(K)})">${b}</g>`;
  emit(id,'NCO device, flight cap (Cadet Airman / NCO)',W,H,b,{size_source:'estimated',
    size_basis:'Diameter ~1.3 in: the disc is ~0.9 of the 1 1/2 in mark drawn on the Attachment 5 flight-cap figure (p.139, 57 px disc vs 64 px mark); the regulation gives no dimension. Earlier build used 0.9 in',
    provenance:'drawn from CAPR 39-1 Fig A5-8 "Cadet Airman and NCO flight cap" device: blue disc, silver rim, silver wings, red propeller',
    anchors:{...A(W,H),center:[W*U/2,H*U/2],mount_center:[W*U/2,H*U/2]},
    dimensions:{diameter_in:D,form:'round pin-on device',rim:'silver',field:'blue',emblem:'silver wings with red propeller'},
    mounts:[{uniform:'USAF-style flight cap (Class A / Class B / FDU)',rule:'front left flap, centred halfway between the top and bottom of the flap, 1 1/2 in back from the front of the cap (6.2.2.2.2-3; Senior Member NCOs per ICL 25-02 (g))'},
            {uniform:'Service cap',rule:'Senior Member NCOs wear the NCO device centred on the front of the cap (6.2.1.1.1 as changed by ICL 25-02)'}],
    documented:['cadet NCOs and Airmen wear the metal Cadet Airman flight cap insignia (6.2.2.2.3)','Senior Member NCOs wear the NCO device (ICL 25-02 (g), Fig A5-8/9)'],assumed:['diameter','wing and propeller proportions (figure device is ~35 px across)']});
}
// ---- blue boonie hat (corporate field uniform), front view; grade and chaplain insignia placed as on the blue field cap
function boonie(){
  const id='hat-boonie-blue',W=11.2,H=5.0,cx=W/2,band=7.4;
  const brim=`M0.05,3.85 C0.1,4.6 2.0,4.95 ${f(cx)},4.95 C9.2,4.95 11.1,4.6 11.15,3.85 C10.4,3.4 9,3.2 ${f(cx+band/2)},3.1 L${f(cx-band/2)},3.1 C2.2,3.2 0.8,3.4 0.05,3.85 Z`;
  const crown=`M${f(cx-band/2)},3.2 C${f(cx-band/2)},1.2 2.4,0.1 ${f(cx)},0.1 C${f(cx+band/2)},0.1 ${f(cx+band/2)},1.2 ${f(cx+band/2)},3.2 Z`;
  let b=`<path id="${id}__brim" d="${brim}" fill="${C.navy}" stroke="${C.navyD}" stroke-width="0.04" stroke-linejoin="round"/>`
   +`<path d="M0.4,4.0 C2,4.45 ${f(cx-1.5)},4.6 ${f(cx)},4.6 C${f(cx+1.5)},4.6 9.2,4.45 10.8,4.0" fill="none" stroke="${C.navyD}" stroke-width="0.04"/>`
   +`<path id="${id}__crown" d="${crown}" fill="${C.navy}" stroke="${C.navyD}" stroke-width="0.04" stroke-linejoin="round"/>`
   +`<path d="M${f(cx-band/2)},2.95 L${f(cx+band/2)},2.95" stroke="${C.navyD}" stroke-width="0.05"/><path d="M${f(cx)},0.1 L${f(cx)},2.95" stroke="${C.navyD}" stroke-width="0.03" stroke-opacity="0.6"/>`
   +Array.from({length:4},(_,i)=>`<circle cx="${f(cx-band/2+0.25+i*0.18)}" cy="2.0" r="0.045" fill="${C.navyD}"/>`).join('');
  const gs=[cx,1.55],gw=1.6;
  b+=`<rect id="${id}__grade_slot" x="${f(gs[0]-gw/2)}" y="${f(gs[1]-gw/2)}" width="${gw}" height="${gw}" fill="none"/>`;
  emit(id,'Blue boonie hat (Corporate Field Uniform), front',W,H,b,{size_source:'estimated',
    size_basis:'No dimensions in CAPR 39-1 6.2.10. Proportions as the boonie in base-art/hats.js (11.2 in across the brim, 2.0 in brim, 7.4 in band); 1.6 in insignia zone as on the patrol cap',
    provenance:'in-house construction from the description in CAPR 39-1 6.2.10 (dark blue boonie hat); no figure exists for it',
    anchors:{...A(W,H),grade_slot_center:[gs[0]*U,gs[1]*U],chaplain_slot_center:[cx*U,2.55*U],garment_attach_center:[cx*U,3.1*U],front_center:[cx*U,H*U/2]},
    landmarks:{grade_slot:{x:(gs[0]-gw/2)*U,y:(gs[1]-gw/2)*U,w:gw*U,h:gw*U}},
    landmarks_note:'rects are {x,y,w,h} in user units (0.01 in)',
    dimensions:{brim_w_in:W,brim_width_in:2.0,band_diameter_in:band,crown_h_in:3.1},
    documented:['dark blue boonie hat worn with the Corporate Field Uniform for extended outdoor operations when authorized (6.2.10)','grade and chaplain insignia as on the Blue Field Cap: officers and cadet officers centre grade on the front; chaplains centre the insignia 1/2 in above the visor/brim line (6.2.9.2, 6.2.9.4, Fig A5-10)','NCOs and Cadet Airmen wear no grade insignia (6.2.9.3)'],
    assumed:['all dimensions','chaplain slot placed 1/2 in above the brim line since a boonie has no visor']});
}
mensCap('general','general officers (3 clouds and darts)',3,false);
mensCap('field-grade','field grade officers (2 clouds and darts)',2,false);
mensCap('officer-nco','company grade officers, flight officers and NCOs',0,false);
mensCap('cadet-officer','cadet officers',0,true);
womensCap('general','general officers (crown band, 3 clouds and darts)',3,false);
womensCap('field-grade','field grade officers (crown band, 2 clouds and darts)',2,false);
womensCap('officer-nco','all other officers and NCOs',0,false);
womensCap('cadet-officer','cadet officers',0,true);
ncoDevice();   // blue boonie hat intentionally not built: the Utility chat's CFU coat image already carries boonie_hat_front/back + insignia zone
console.log('caps:',written.length,written.join(' '));
