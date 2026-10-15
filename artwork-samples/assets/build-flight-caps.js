// Flight (garrison) caps, side view with the wearer's left flap toward the viewer, front at left: CAPR 39-1 Fig A5-9 "FLIGHT CAPS" (p.140).
// Outline = per-column profile of the figure (base-art/rank-traces/capprof_{mg,off,cn,co}.json, 6x render); scale from the figure's own
// "1 1/2 in" dimension marks (157 px/in). Replaces the flatter p.139 silhouette of base-art/make-flight-cap.js (same ids, anchors re-derived).
// Draws: crown with the sloped top, the fold/braid line (silver for general officers, silver and blue twist for other officers, plain blue for NCOs and cadets),
// the curtain below the braid, bottom opening with lining line. The device is NOT drawn: slot only (6.2.2.2: 1 1/2 in from the front, halfway between braid and bottom).
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'accessories'),TR=path.join(__dirname,'..','base-art','rank-traces'),PXIN=157,U=100,PAD=0.12,f=n=>(+n).toFixed(2);
const NAVY='#0b1f5e',NAVYD='#06143f',NAVYL='#16328a';
const VAR=[
 {id:'hat-flight-cap-general',prof:'capprof_mg',braid:'silver',doc:'general officers: solid silver braid (6.2.2.2.4)'},
 {id:'hat-flight-cap-officer',prof:'capprof_off',braid:'silverblue',doc:'field grade, company grade and flight officers: silver and blue braid (6.2.2.2.5)'},
 {id:'hat-flight-cap-cadet',prof:'capprof_cn',braid:'blue',doc:'NCOs and cadets: plain blue with blue braid (6.2.2.2.6)'}];
const smooth=(P,r)=>P.map((p,i)=>{let sy=0,c=0;for(let j=Math.max(0,i-r);j<=Math.min(P.length-1,i+r);j++){sy+=P[j][1];c++;}return [p[0],sy/c];});
const written=[];
for(const V of VAR){
  const pr=JSON.parse(fs.readFileSync(path.join(TR,V.prof+'.json'),'utf8'));
  const top=smooth(pr.top.map(q=>[q[0],q[1]]),2),bot=smooth(pr.bot.map(q=>[q[0],q[1]]),2);
  const ytop=Math.min(...top.map(q=>q[1])),ybot=Math.max(...bot.map(q=>q[1]));
  const X=px=>((px-pr.x0)/PXIN+PAD)*U,Y=py=>((py-ytop)/PXIN+PAD)*U;
  const W=Math.ceil(((pr.x1-pr.x0)/PXIN+2*PAD)*100)/100,H=Math.ceil(((ybot-ytop)/PXIN+2*PAD)*100)/100;
  // braid centre line: the general-officer figure has a clean light braid; its position as a fraction of the cap height at each column is reused for every
  // variant (the officer braid is broken by the device and the dark blue braids are only ~1 grey level darker than the cap, so a scan is unreliable)
  const MG=JSON.parse(fs.readFileSync(path.join(TR,'capprof_mg.json'),'utf8'));
  const med=(P,r)=>P.map((p,i)=>{const ys=P.slice(Math.max(0,i-r),i+r+1).map(q=>q[1]).sort((a,b)=>a-b);return [p[0],ys[ys.length>>1]];});
  const mgBr=smooth(med(MG.braid.slice().sort((a,b)=>a[0]-b[0]).filter(q=>q[0]>MG.x0+30&&q[0]<MG.x1-40),9),6);   // end 30-40 px of the scan hit the figure's end edges
  const mgTop=new Map(MG.top.map(q=>[q[0],q[1]])),mgBot=new Map(MG.bot.map(q=>[q[0],q[1]]));
  const nearest=(M,x)=>{for(let d=0;d<8;d++){if(M.has(x+d))return M.get(x+d);if(M.has(x-d))return M.get(x-d);}return null;};
  const fr=mgBr.map(q=>{const t=nearest(mgTop,Math.round(q[0]/3)*3),b=nearest(mgBot,Math.round(q[0]/3)*3);return t==null||b==null?null:[(q[0]-MG.x0)/(MG.x1-MG.x0),(q[1]-t)/(b-t)];}).filter(Boolean);
  const topAt=x=>{let b=top[0];for(const q of top)if(Math.abs(q[0]-x)<Math.abs(b[0]-x))b=q;return b[1];},botAt=x=>{let b=bot[0];for(const q of bot)if(Math.abs(q[0]-x)<Math.abs(b[0]-x))b=q;return b[1];};
  let br=fr.map(([u,v])=>{const x=pr.x0+u*(pr.x1-pr.x0),t=topAt(x),bo=botAt(x);return [x,t+v*(bo-t)];});
  // the end samples of the scan are noisy: pin them to the nearest steady value
  const pin=(A,n)=>{for(let i=0;i<n;i++){A[i][1]=A[n][1];A[A.length-1-i][1]=A[A.length-1-n][1];}return A;};
  br.splice(0,br.length,...smooth(pin(br,12),3));
  const P=a=>a.map(q=>`${f(X(q[0]))},${f(Y(q[1]))}`);
  const bodyD='M'+P(top).join('L')+'L'+P(bot.slice().reverse()).join('L')+'Z';
  const braidD='M'+P(br).join('L');
  // curtain = body below the braid: braid line then bottom edge back
  const lastX=pr.x1,curtain='M'+P(br).join('L')+'L'+P(bot.filter(q=>q[0]>=br[0][0]&&q[0]<=br[br.length-1][0]).reverse()).join('L')+'Z';
  const gid=V.id+'__g';
  let b=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NAVYL}"/><stop offset="0.5" stop-color="${NAVY}"/><stop offset="1" stop-color="${NAVYD}"/></linearGradient></defs>`
   +`<path id="${V.id}__body" d="${bodyD}" fill="url(#${gid})" stroke="${NAVYD}" stroke-width="3" stroke-linejoin="round"/>`
   +`<path id="${V.id}__curtain" d="${curtain}" fill="#000" fill-opacity="0.16"/>`
   +`<path id="${V.id}__top_edge" d="M${P(top).join('L')}" fill="none" stroke="#3b57ae" stroke-width="2" stroke-opacity="0.7"/>`;
  // bottom opening: lining line 0.09 in above the bottom edge, stitched
  const lin=bot.map(q=>[q[0],q[1]-0.09*PXIN]);
  b+=`<path id="${V.id}__opening" d="M${P(lin).join('L')}" fill="none" stroke="${NAVYD}" stroke-width="2.2" stroke-dasharray="7 5" stroke-opacity="0.85"/>`;
  if(V.braid==='silver') b+=`<path id="${V.id}__braid" d="${braidD}" fill="none" stroke="#d4d8de" stroke-width="7" stroke-linecap="round"/><path d="${braidD}" fill="none" stroke="#8f969e" stroke-width="1.2" stroke-opacity="0.7" transform="translate(0 3.4)"/>`;
  else if(V.braid==='silverblue') b+=`<path id="${V.id}__braid" d="${braidD}" fill="none" stroke="#d4d8de" stroke-width="7" stroke-linecap="round"/><path d="${braidD}" fill="none" stroke="#2c4fb0" stroke-width="4.4" stroke-dasharray="5 5"/>`;
  else b+=`<path id="${V.id}__braid" d="${braidD}" fill="none" stroke="#243f93" stroke-width="5.5" stroke-linecap="round"/><path d="${braidD}" fill="none" stroke="${NAVYD}" stroke-width="1.2" stroke-opacity="0.8" transform="translate(0 3)"/>`;
  // device slot: 1 1/2 in back from the front edge, halfway between the braid and the bottom of the flap
  const px=pr.x0+1.5*PXIN,at=(P2,x)=>{let best=P2[0];for(const q of P2)if(Math.abs(q[0]-x)<Math.abs(best[0]-x))best=q;return best[1];};
  const slot=[X(px),(Y(at(br,px))+Y(at(bot,px)))/2],sw=100;
  b+=`<rect id="${V.id}__device_slot" x="${f(slot[0]-sw/2)}" y="${f(slot[1]-sw/2)}" width="${sw}" height="${sw}" fill="none"/>`;
  const old=JSON.parse(fs.readFileSync(path.join(OUT,V.id+'.spec.json'),'utf8'));
  const vb=[0,0,+(W*U).toFixed(1),+(H*U).toFixed(1)];
  const front=[X(pr.x0),(Y(top[0][1])+Y(bot[0][1]))/2];
  const meta={...old,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},viewBox:vb,size_source:'measured',
    size_basis:`Measured from CAPR 39-1 Fig A5-9 "FLIGHT CAPS" (3 March 2020, p.140) at ${PXIN} px/in from the figure's own 1 1/2 in marks. Cap body ${(W-2*PAD).toFixed(2)} x ${(H-2*PAD).toFixed(2)} in plus ${PAD} in margin. The regulation gives no cap dimensions; real caps vary by size. (Earlier build used the flatter p.139 side silhouette, 11.6 x 3.65 in.)`,
    provenance:'outline per column from Fig A5-9 (sloped crown, fold line, curtain); braid line traced from the figure; navy and braid colours sampled',
    colours:{navy:NAVY,navyD:NAVYD,braid_silver:'#d4d8de',braid_blue:'#2c4fb0'},
    anchors:{top_center:[W*U/2,0],bottom_center:[W*U/2,H*U],center:[W*U/2,H*U/2],left_edge:[0,H*U/2],right_edge:[W*U,H*U/2],front_edge_center:front.map(v=>+v.toFixed(1)),
      device_slot_center:slot.map(v=>+v.toFixed(1)),braid_front:[X(pr.x0),Y(br[0][1])].map(v=>+v.toFixed(1)),garment_attach_center:[W*U/2,H*U]},
    landmarks:{device_slot:{x:+(slot[0]-sw/2).toFixed(1),y:+(slot[1]-sw/2).toFixed(1),w:sw,h:sw}},
    landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); device_slot is a nominal 1 in box centred on the device position (the device itself is 1.15-1.36 in, see the cap-device-* assets)',
    orientation:"side view, front of cap at left (wearer facing left), wearer's left flap shown; sloped crown: tall at the front, lower at the rear (Fig A5-9)",
    braid:V.doc,fit:{method:'per-column profile of the regulation figure',score:null}};
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  fs.writeFileSync(path.join(OUT,V.id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="${vb.join(' ')}" data-asset-id="${V.id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(meta.name)}</title><metadata>${esc(JSON.stringify(meta))}</metadata>${b}</svg>`);
  fs.writeFileSync(path.join(OUT,V.id+'.spec.json'),JSON.stringify(meta,null,1));written.push(V.id);
}
console.log('flight caps:',written.join(' '));
