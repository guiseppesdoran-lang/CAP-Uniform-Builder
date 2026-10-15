// CAP service-cap and flight-cap devices (CAPR 39-1 6.2.1.1.1, 6.2.1.2.1, 6.2.2.2; Fig A5-8 / A5-9 "CAP DEVICES").
//   cap-device-officer-service        officer / NCO-grade-less service cap insignia (eagle, wreath, CAP emblem), men's and women's service caps
//   cap-device-cadet-officer-service  cadet officer service cap insignia (wreath, fanned eagle, CAP shield)
//   cap-device-officer-flight         officer flight cap insignia (same art as the officer service device, smaller)
// Shape = silhouette traced from the Fig A5-8 device row (base-art/rank-traces/capdev_*.json; ~190 px faint grey source, so LOW FIDELITY: outline and
// large shading only, no feather/leaf detail) with the CAP disc / shield + triangle drawn parametrically. Sizes scaled from the figure (see size_basis).
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'accessories'),U=100,R=path.join(__dirname,'..','base-art','rank-traces'),f=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const C={silver:'#d3d7dc',silverL:'#e3e6ea',silverD:'#8f969e',shade:'#b4bac2'};
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return Math.abs(a/2);};
const load=n=>{const s=JSON.parse(fs.readFileSync(path.join(R,`capdev_${n}_sil.json`))),h=JSON.parse(fs.readFileSync(path.join(R,`capdev_${n}_shade.json`)));
  const big=s.loops.filter(l=>area(l)>3000).flat(),b=[Math.min(...big.map(p=>p[0])),Math.min(...big.map(p=>p[1])),Math.max(...big.map(p=>p[0])),Math.max(...big.map(p=>p[1]))];
  return {sil:s.loops.filter(l=>area(l)>700),shade:h.loops.filter(l=>area(l)>1500),b};};
const written=[];
function device(id,name,src,Wi,Hi,kind,meta){
  const d=load(src),sx=Wi/(d.b[2]-d.b[0]),sy=Hi/(d.b[3]-d.b[1]),M=0.02,W=Wi+2*M,H=Hi+2*M;
  const T=p=>[(M+(p[0]-d.b[0])*sx)*U,(M+(p[1]-d.b[1])*sy)*U];
  const path_=ls=>ls.map(l=>'M'+l.map(p=>T(p).map(f).join(',')).join('L')+'Z').join('');
  const cx=W*U/2,sw=0.012*U;
  let b=`<path id="${id}__body" fill-rule="evenodd" d="${path_(d.sil)}" fill="${C.silverL}" stroke="${C.silverD}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`
       +`<path id="${id}__shade" fill-rule="evenodd" d="${path_(d.shade)}" fill="${C.shade}" opacity="0.85"/>`;
  const tri=(x,y,s,i)=>`<path id="${id}__${i}" d="M${f(x)},${f(y-s*0.58)}L${f(x+s/2)},${f(y+s*0.29)}L${f(x-s/2)},${f(y+s*0.29)}Z" fill="${C.silver}" stroke="${C.silverD}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`;
  if(kind==='officer'){ // CAP emblem disc sits on top of the eagle (centred, top of the device)
    const r=0.165*Wi*U,cy=(M*U)+r*1.0;
    b+=`<circle id="${id}__emblem" cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${C.silver}" stroke="${C.silverD}" stroke-width="${f(sw)}"/>`+tri(cx,cy+r*0.08,r*1.05,'emblem-triangle');
  } else {              // shield carrying the CAP triangle below the eagle, centred at the bottom
    const sw_=0.25*Wi*U,sh=0.30*Hi*U,top=(M+0.62*Hi)*U,x0=cx-sw_/2;
    b+=`<path id="${id}__shield" d="M${f(x0)},${f(top)}L${f(x0+sw_)},${f(top)}L${f(x0+sw_)},${f(top+sh*0.62)}L${f(cx)},${f(top+sh)}L${f(x0)},${f(top+sh*0.62)}Z" fill="${C.silver}" stroke="${C.silverD}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`+tri(cx,top+sh*0.42,sw_*0.62,'shield-triangle');
  }
  const vb=[0,0,+(W*U).toFixed(1),+(H*U).toFixed(1)],A={top_center:[cx,0],bottom_center:[cx,H*U],center:[cx,H*U/2],left_edge:[0,H*U/2],right_edge:[W*U,H*U/2],mount_center:[cx,H*U/2]};
  const m={asset_id:id,name,size_in:{w:+W.toFixed(3),h:+H.toFixed(3)},units:'1 user unit = 0.01 in',viewBox:vb,colours:C,grade:'accessory',anchors:A,...meta};
  fs.writeFileSync(path.join(OUT,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(3)}in" height="${H.toFixed(3)}in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${b}</svg>`);
  fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify({...m,fit:{method:'n/a',score:null}},null,1));written.push(id);}
const SRC='CAPR 39-1 3 Mar 2020 Fig A5-8 (p.138, CAP DEVICES row; A5-9 shows the same devices on the women\'s caps)';
const LOW='source figure is ~190 px of faint grey embossing: outline and large shading traced, no feather or leaf detail; CAP disc / shield and triangle are parametric';
const mountService=[{uniform:'Men\'s service cap (Fig A5-8) and women\'s service cap (Fig A5-9)',rule:'centred on the front of the cap, in device_slot_center of the hat asset, with the clouds and darts for grade on the visor (6.2.1.1.1, 6.2.1.2.1)'}];
device('cap-device-officer-service','CAP service cap insignia, officers (men\'s and women\'s service caps)','svc',2.2,2.07,'officer',{size_source:'estimated',
  size_basis:'Scaled from Fig A5-8: the device is ~90 px wide against the 7.4 in cap band (300 px) drawn on the same page, ~2.2 in; height from the device figure aspect (about 1.04 wide : 1 tall). The regulation gives no dimension.',
  provenance:SRC+'; '+LOW,mounts:mountService,
  documented:['officers (and NCOs per ICL 25-02, who wear the NCO device) wear the CAP service cap insignia centred on the front of the cap (6.2.1.1.1, 6.2.1.2.1)'],assumed:['overall size','CAP disc position and size','shading detail']});
device('cap-device-cadet-officer-service','CAP cadet officer service cap insignia','cad',1.9,2.4,'cadet',{size_source:'estimated',
  size_basis:'Scaled from Fig A5-8: ~80 px wide x 97 px tall against the 7.4 in cap band (300 px), ~1.9 x 2.4 in; the regulation gives no dimension.',
  provenance:SRC+'; '+LOW,mounts:[{uniform:'Men\'s / women\'s service cap, cadet officers',rule:'centred on the front of the cap in device_slot_center; no clouds or darts (6.2.1.1.1, 6.2.1.2.1)'}],
  documented:['cadet officers wear the cadet service cap insignia; no clouds and darts for cadets (6.2.1.1.1, 6.2.1.2.1)'],assumed:['overall size','shield size and position','shading detail']});
device('cap-device-officer-flight','CAP flight cap insignia, officers and general officers','svc',1.15,1.08,'officer',{size_source:'estimated',
  size_basis:'Same art as the officer service device scaled to ~1.15 in wide: on the Attachment 5 flight-cap figure (p.139) the officer device is ~48 px against the 64 px "1 1/2 in" mark. The regulation gives no dimension.',
  provenance:SRC+' and p.139 (flight caps); '+LOW,
  mounts:[{uniform:'USAF-style flight cap (Class A / Class B / FDU), officers incl. general officers',rule:'front left flap, centred halfway between the top and bottom of the flap, 1 1/2 in from the front of the cap (6.2.2.2.1); Senior Member NCOs wear the NCO device (ICL 25-02), cadet NCOs/airmen the cap-device-nco-flight, cadet officers regular or miniature metal grade (6.2.2.2.2-3)'}],
  documented:['officers wear the flight cap insignia on the front left flap (6.2.2.2.1)'],assumed:['overall size','shading detail']});
console.log('cap devices:',written.join(' '));
