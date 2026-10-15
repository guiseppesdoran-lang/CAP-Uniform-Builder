// Headgear for the base images: patrol cap (front/back) and baseball cap (front/back), real inches, drawn flat.
// ALL SIZES ARE ESTIMATES (no real cap was measured): head circumference taken as ~22.5 in (size 7 1/8) -> ~7.2 in band diameter.
// Each hat is drawn with its own top-left at (x,y) and a leading invisible bounding rect so the generators can read it as a landmark.
const f=n=>(+n).toFixed(3),STROKE='#2c271c';
const BLUE='#1d2f57',BLUE_TAPE='#0f1a3a';
const H={patrol:{w:7.8,crown:3.9,visor:1.1},ball:{w:7.6,crown:4.7,visor:1.9},boonie:{w:11.2,crown:3.2,brim:2.0,band:7.4}};
const seam=(d,o=.22,w=.07)=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity="${o}" stroke-width="${w}" stroke-linecap="round"/>`;
const grp=(id,x,y,w,h,body,title)=>`<g id="${id}" transform="translate(${f(x+w/2)} ${f(y)})"><title>${title}</title><rect x="${f(-w/2)}" y="0" width="${w}" height="${h}" fill="none"/>${body}</g>`;
const lettering=null; // blank: CAP emblem / tape lettering is added by the builder

// patrol cap, front: stiff rounded-top crown, centre + crown seams, short curved visor below the band
function patrolFront(id,x,y,fill,o={}){const {w,crown:c,visor:v}=H.patrol,hw=w/2,h=c+v;
  const crown=`M${-hw},${c} L${-hw+0.15},1.2 Q${-hw+0.3},0 -2.4,0 L2.4,0 Q${hw-0.3},0 ${hw-0.15},1.2 L${hw},${c} Z`;
  const vis=`M${-hw+0.2},${c-0.15} C${-hw+0.4},${c+v+0.05} -1.9,${c+v} 0,${c+v} C1.9,${c+v} ${hw-0.4},${c+v+0.05} ${hw-0.2},${c-0.15} Z`;
  let b=`<path d="${vis}" fill="${fill}" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/><path d="${vis}" fill="#000" opacity=".28"/>`
    +`<path d="${crown}" fill="${fill}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><path d="${crown}" fill="url(#shadeBox)"/>`
    +seam(`M0,0.1 L0,${c}`)+seam(`M-1.8,0.05 Q-2.0,2 -2.15,${c}`)+seam(`M1.8,0.05 Q2.0,2 2.15,${c}`)+seam(`M${-hw+0.05},${c-0.45} H${hw-0.05}`,.18,.06);
  if(o.insignia)b+=`<rect id="${id}-insignia-zone" x="-0.8" y="${f(c-0.5-1.6)}" width="1.6" height="1.6" fill="#000" fill-opacity="0"><title>Grade / chaplain insignia: centred, 1/2 in above the visor (CAPR 39-1 6.2.7.2, 7.1.1.8); size ESTIMATED</title></rect>`;
  return {w,h,svg:grp(id,x,y,w,h,b,o.title||'Patrol cap, front')};}

// patrol cap, back: plain crown with centre seam; OCP caps carry the name tape centred on the back (CAPR 39-1 7.1.1.8)
function patrolBack(id,x,y,fill,o={}){const {w,crown:c}=H.patrol,hw=w/2,h=c;
  const crown=`M${-hw},${c} L${-hw+0.15},1.2 Q${-hw+0.3},0 -2.4,0 L2.4,0 Q${hw-0.3},0 ${hw-0.15},1.2 L${hw},${c} Z`;
  let b=`<path d="${crown}" fill="${fill}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><path d="${crown}" fill="url(#shadeBox)"/>`
    +seam(`M0,0.1 L0,${c}`)+seam(`M-1.8,0.05 Q-2.0,2 -2.15,${c}`)+seam(`M1.8,0.05 Q2.0,2 2.15,${c}`)+seam(`M${-hw+0.05},${c-0.45} H${hw-0.05}`,.18,.06);
  if(o.tape)b+=`<g id="${id}-name-tape"><rect x="${-o.tape.w/2}" y="${f(c-o.tape.h)}" width="${o.tape.w}" height="${o.tape.h}" fill="${BLUE_TAPE}"/><title>Name tape centred on the back of the cap, flush with the bottom edge (Velcro panel), blank (matches coat name tape width; CAPR 39-1 7.1.1.8)</title></g>`;
  return {w,h,svg:grp(id,x,y,w,h,b,o.title||'Patrol cap, back')};}

// baseball cap, front: six-panel dome with button, curved visor; blank (emblem is added by the builder)
function ballFront(id,x,y,fill,o={}){const {w,crown:c,visor:v}=H.ball,hw=w/2-0.2,h=c+v;
  const dome=`M${-hw},${c} L${-hw},2.7 C${-hw},0.7 -2.2,0 0,0 C2.2,0 ${hw},0.7 ${hw},2.7 L${hw},${c} Z`;
  const vis=`M${-hw},${c-0.1} C${-hw-0.9},${c+0.1} -2.9,${c+v} 0,${c+v} C2.9,${c+v} ${hw+0.9},${c+0.1} ${hw},${c-0.1} Z`;
  let b=`<path d="${vis}" fill="${fill}" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/><path d="${vis}" fill="#000" opacity=".18"/>`
    +seam(`M${-hw-0.3},${c+0.25} Q0,${c+v-0.45} ${hw+0.3},${c+0.25}`,.2,.06)
    +`<path d="${dome}" fill="${fill}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><path d="${dome}" fill="url(#shadeBox)"/>`
    +seam(`M0,0.2 L0,${c}`)+seam(`M-0.15,0.1 Q-2.2,1.0 -2.55,${c}`)+seam(`M0.15,0.1 Q2.2,1.0 2.55,${c}`)
    +`<circle cx="0" cy="0.12" r="0.2" fill="${fill}" stroke="${STROKE}" stroke-width=".06"/><circle cx="-2.75" cy="1.35" r="0.09" fill="#000" opacity=".5"/><circle cx="2.75" cy="1.35" r="0.09" fill="#000" opacity=".5"/>`;
  if(o.insignia)b+=`<rect id="${id}-insignia-zone" x="-0.8" y="${f(c-0.5-1.6)}" width="1.6" height="1.6" fill="#000" fill-opacity="0"><title>Officer rank / chaplain badge: centred, 1/2 in above the visor (CAPR 39-1 7.1.1.8, 6.2.11.1); size ESTIMATED</title></rect>`;
  return {w,h,svg:grp(id,x,y,w,h,b,o.title||'Baseball (tactical) cap, front')};}

// baseball cap, back: six-panel dome, adjustable strap closure at the bottom centre
function ballBack(id,x,y,fill,o={}){const {w,crown:c}=H.ball,hw=w/2-0.2,h=c;
  const dome=`M${-hw},${c} L${-hw},2.7 C${-hw},0.7 -2.2,0 0,0 C2.2,0 ${hw},0.7 ${hw},2.7 L${hw},${c} Z`;
  let b=`<path d="${dome}" fill="${fill}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><path d="${dome}" fill="url(#shadeBox)"/>`
    +seam(`M0,0.2 L0,${c-1.2}`)+seam(`M-0.15,0.1 Q-2.2,1.0 -2.55,${c}`)+seam(`M0.15,0.1 Q2.2,1.0 2.55,${c}`)
    +`<circle cx="0" cy="0.12" r="0.2" fill="${fill}" stroke="${STROKE}" stroke-width=".06"/><circle cx="-2.75" cy="1.35" r="0.09" fill="#000" opacity=".5"/><circle cx="2.75" cy="1.35" r="0.09" fill="#000" opacity=".5"/>`
    +`<rect x="-1.5" y="${f(c-1.05)}" width="3" height="0.8" fill="#000" opacity=".4"/><rect x="-1.3" y="${f(c-1.0)}" width="2.6" height="0.55" fill="${fill}" stroke="${STROKE}" stroke-width=".05"/><rect x="-0.55" y="${f(c-0.95)}" width="1.1" height="0.45" fill="#000" opacity=".3"/>`;
  if(o.tape)b+=`<g id="${id}-name-tape"><rect x="${-o.tape.w/2}" y="${f(c-1.2-o.tape.h)}" width="${o.tape.w}" height="${o.tape.h}" fill="${BLUE_TAPE}"/><title>Name tape centred on the back of the tactical cap, blank (CAPR 39-1 7.1.1.8, 6.2.11.1)</title></g>`;
  return {w,h,svg:grp(id,x,y,w,h,b,o.title||'Baseball (tactical) cap, back')};}

// boonie hat (Blue Boonie Hat, CAPR 39-1 6.2.10, worn with the Corporate Field Uniform): soft round crown, brim all around, vent eyelets.
// Front and back look alike; the front carries the insignia zone (grade / chaplain as for the Blue Field Cap).
function boonie(id,x,y,fill,o={},front=true){const {w,crown:c,brim:b,band}=H.boonie,hb=band/2,hw=w/2,h=c+b;
  const crown=`M${-hb},${c} L${-hb+0.05},1.3 Q${-hb+0.15},0 -2.3,0 L2.3,0 Q${hb-0.15},0 ${hb-0.05},1.3 L${hb},${c} Z`;
  const brim=`M${-hb},${c-0.35} C${-hb-0.9},${c-0.15} ${-hw},${c+0.45} ${-hw},${c+1.1} Q0,${c+b+0.1} ${hw},${c+1.1} C${hw},${c+0.45} ${hb+0.9},${c-0.15} ${hb},${c-0.35} Z`;
  let g=`<path d="${brim}" fill="${fill}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><path d="${brim}" fill="#000" opacity=".2"/>`
    +seam(`M${-hw+0.4},${c+1.2} Q0,${c+b-0.35} ${hw-0.4},${c+1.2}`,.2,.06)
    +`<path d="${crown}" fill="${fill}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/><path d="${crown}" fill="url(#shadeBox)"/>`
    +seam(`M0,0.1 L0,${c-0.3}`,.18,.06)+seam(`M${-hb+0.1},${c-0.5} H${hb-0.1}`,.2,.06)
    +`<circle cx="-2.9" cy="1.4" r="0.1" fill="#000" opacity=".55"/><circle cx="2.9" cy="1.4" r="0.1" fill="#000" opacity=".55"/>`;
  if(front&&o.insignia)g+=`<rect id="${id}-insignia-zone" x="-0.8" y="${f(c-0.4-1.6)}" width="1.6" height="1.6" fill="#000" fill-opacity="0"><title>Grade / chaplain insignia, centred on the front of the crown (as for the Blue Field Cap, CAPR 39-1 6.2.10); size ESTIMATED</title></rect>`;
  return {w,h,svg:grp(id,x,y,w,h,g,front?'Blue boonie hat, front':'Blue boonie hat, back')};}
const booniFront=(id,x,y,fill,o={})=>boonie(id,x,y,fill,o,true),booniBack=(id,x,y,fill,o={})=>boonie(id,x,y,fill,o,false);

// a row of four hats (patrol front, patrol back, baseball front, baseball back), bottoms aligned at yBottom, centred on x=0.
// fill: CSS fill for the patrol cap fabric (camo pattern or blue); ballFill: blue for the CAP baseball cap.
function hatRow({yBottom,fill,ballFill=BLUE,gap=1.0,nameTape=null,ballTape=null,boonieFill=null,tag='hat',xCenter=0,only=null}){
  const items=[['patrol-front',patrolFront,fill,{insignia:true}],['patrol-back',patrolBack,fill,nameTape?{tape:nameTape}:{}],['ball-front',ballFront,ballFill,{insignia:true}],['ball-back',ballBack,ballFill,ballTape?{tape:ballTape}:{}]].concat(boonieFill?[['boonie-front',booniFront,boonieFill,{insignia:true}],['boonie-back',booniBack,boonieFill,{}]]:[]);
  if(only){for(let i=items.length-1;i>=0;i--)if(!only.includes(items[i][0]))items.splice(i,1);}
  const sizes=items.map(([n,fn,fl,o])=>fn('x',0,0,fl,o)), total=sizes.reduce((a,s)=>a+s.w,0)+gap*(items.length-1);
  let x=xCenter-total/2,svg='';const out={};
  items.forEach(([n,fn,fl,o],i)=>{const s=sizes[i],id=`${tag}-${n}`,r=fn(id,x,yBottom-s.h,fl,o);svg+=r.svg;const it={id,x,y:yBottom-s.h,w:s.w,h:s.h};
    if(o.insignia)it.insignia={x:x+s.w/2-0.8,y:it.y+H[n.split('-')[0]==='patrol'?'patrol':n.split('-')[0]==='boonie'?'boonie':'ball'].crown-(n.startsWith('boonie')?0.4:0.5)-1.6,w:1.6,h:1.6};
    if(n==='patrol-back'&&o.tape)it.name_tape={x:x+s.w/2-o.tape.w/2,y:it.y+H.patrol.crown-o.tape.h,w:o.tape.w,h:o.tape.h};
    if(n==='ball-back'&&o.tape)it.name_tape={x:x+s.w/2-o.tape.w/2,y:it.y+H.ball.crown-1.2-o.tape.h,w:o.tape.w,h:o.tape.h};
    out[n]=it;x+=s.w+gap;});
  const top=Math.min(...Object.values(out).map(v=>v.y));
  return {svg,items:out,top,width:total,left:xCenter-total/2,right:xCenter+total/2};}
module.exports={hatRow,booniFront,booniBack,patrolFront,patrolBack,ballFront,ballBack,BLUE,BLUE_TAPE,H};
