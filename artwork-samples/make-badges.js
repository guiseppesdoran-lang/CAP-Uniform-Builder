// Procedural CAP-style badge artwork: SVG out (rasterise with qlmanage / any SVG renderer).
const fs=require('fs'),path=require('path');
const out=path.join(__dirname,'badges');

const DEFS=`<defs>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
 <stop offset="0" stop-color="#ffffff"/><stop offset=".28" stop-color="#cfd4da"/>
 <stop offset=".55" stop-color="#8d949c"/><stop offset=".78" stop-color="#e4e7ea"/><stop offset="1" stop-color="#9aa1a9"/></linearGradient>
<linearGradient id="metalV" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stop-color="#f7f8f9"/><stop offset=".5" stop-color="#b4bac1"/><stop offset="1" stop-color="#7d848c"/></linearGradient>
<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9ddd0"/><stop offset="1" stop-color="#aeb4a6"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a0"/><stop offset=".5" stop-color="#e0a800"/><stop offset="1" stop-color="#a87400"/></linearGradient>
<linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e5fc4"/><stop offset="1" stop-color="#12307a"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".35"/></filter>
</defs>`;

const star=(cx,cy,r,fill='url(#metal)')=>{
  const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.42:r;p.push((cx+rr*Math.cos(a)).toFixed(1)+','+(cy+rr*Math.sin(a)).toFixed(1));}
  return `<polygon points="${p.join(' ')}" fill="${fill}" stroke="#5d646c" stroke-width="1.2" stroke-linejoin="round"/>`;
};
const prop=(cx,cy,r,col)=>[0,120,240].map(a=>
  `<ellipse cx="${cx}" cy="${cy-r*0.55}" rx="${r*0.28}" ry="${r*0.62}" fill="${col}" stroke="#2a2f36" stroke-width="1" transform="rotate(${a} ${cx} ${cy})"/>`).join('')
  +`<circle cx="${cx}" cy="${cy}" r="${r*0.2}" fill="#d8dce0" stroke="#2a2f36" stroke-width="1"/>`;
const wreath=(cx,cy,r)=>{
  let s='';for(const side of [-1,1])for(let i=0;i<7;i++){
    const t=(i/6)*Math.PI*0.95+0.1,x=cx+side*r*Math.sin(t),y=cy+r*0.9-r*1.5*(1-Math.cos(t))/1.0*0.55-i*0;
    const ang=side*(30+i*12);
    s+=`<ellipse cx="${x.toFixed(1)}" cy="${(cy-r*0.15+r*Math.cos(t)*0.9).toFixed(1)}" rx="3.4" ry="8" fill="url(#metalV)" stroke="#5d646c" stroke-width=".8" transform="rotate(${ang} ${x.toFixed(1)} ${(cy-r*0.15+r*Math.cos(t)*0.9).toFixed(1)})"/>`;}
  return s;};

function shield(level){   // level: tech | senior | master
  const body=`M58,62 H182 V132 Q182,186 120,218 Q58,186 58,132 Z`;
  const inner=`M68,72 H172 V132 Q172,178 120,206 Q68,178 68,132 Z`;
  let s=`<g filter="url(#sh)">`;
  if(level==='master') s+=wreath(120,34,30);
  if(level!=='tech') s+=star(120,32,17);
  s+=`<path d="${body}" fill="url(#metal)" stroke="#555c64" stroke-width="2" stroke-linejoin="round"/>
  <path d="${inner}" fill="url(#face)" stroke="#6b727a" stroke-width="1.5"/>`;
  s+=prop(96,100,15,'#c23030')+prop(120,100,15,'#f4f4f4')+prop(144,100,15,'#2f5fc4');
  s+=`<path d="M128,122 L104,152 H120 L108,184 L142,146 H125 Z" fill="url(#gold)" stroke="#6e4a00" stroke-width="1.2" stroke-linejoin="round"/>`;
  s+=`<path d="M82,150 q-8,10 4,22 q14,-4 30,-14 z" fill="#efe6c8" stroke="#8a7f5a" stroke-width="1"/>
      <path d="M152,128 q-30,14 -42,52" fill="none" stroke="#2a2f36" stroke-width="5" stroke-linecap="round"/>
      <path d="M152,128 q-30,14 -42,52" fill="none" stroke="#f4f4f4" stroke-width="2" stroke-linecap="round"/>`;
  return s+`</g>`;
}

function wings(level){    // 240 x 110 canvas
  const rows=[[104,44,10,22,38],[104,54,6,40,54],[104,64,14,58,68],[104,73,26,76,82]];
  const feather=(x0,y0,len,ty)=>`<path d="M${x0},${y0} C${x0-len*0.35},${y0-10} ${x0-len*0.8},${ty-6} ${x0-len},${ty} C${x0-len*0.7},${ty+9} ${x0-len*0.35},${y0+9} ${x0},${y0+8} Z" fill="url(#metalV)" stroke="#555c64" stroke-width="1.4"/>`;
  let half='';
  [[106,36,98,8],[106,46,92,22],[106,56,82,40],[106,66,70,58],[106,75,56,74]].forEach(r=>{half+=feather(...r);});
  for(let i=0;i<5;i++){const y=38+i*9;half+=`<path d="M100,${y} Q70,${y-6+i*3} ${44+i*10},${12+i*17}" stroke="#6b727a" stroke-width=".8" fill="none"/>`;}
  let s=`<g filter="url(#sh)">`+half+`<g transform="translate(240 0) scale(-1 1)">`+half+`</g>`;
  if(level==='master') s+=wreath(120,24,26);
  if(level!=='basic') s+=star(120,12,12);
  s+=`<circle cx="120" cy="58" r="23" fill="url(#metal)" stroke="#555c64" stroke-width="2"/>
      <circle cx="120" cy="58" r="17" fill="url(#blue)" stroke="#2a2f36" stroke-width="1"/>
      <path d="M120,44 L131,70 H109 Z" fill="#f4f4f4" stroke="#2a2f36" stroke-width="1" stroke-linejoin="round"/>
      <circle cx="120" cy="60" r="4" fill="url(#gold)" stroke="#6e4a00" stroke-width=".8"/></g>`;
  return s;
}

const badges={
  shield_technician:{w:240,h:240,body:shield('tech')},
  shield_senior:{w:240,h:240,body:shield('senior')},
  shield_master:{w:240,h:240,body:shield('master')},
  wings_basic:{w:240,h:110,body:wings('basic')},
  wings_senior:{w:240,h:110,body:wings('senior')},
  wings_master:{w:240,h:110,body:wings('master')},
};
for(const [n,b] of Object.entries(badges)){
  fs.writeFileSync(path.join(out,n+'.svg'),
   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.w} ${b.h}" width="${b.w}" height="${b.h}">${DEFS}${b.body}</svg>`);
}
// contact sheet
let x=20,sheet='';
const bg='#1a1d24';
for(const n of ['shield_technician','shield_senior','shield_master']){sheet+=`<g transform="translate(${x} 20)">${badges[n].body}</g>`;x+=260;}
x=20;for(const n of ['wings_basic','wings_senior','wings_master']){sheet+=`<g transform="translate(${x} 290)">${badges[n].body}</g>`;x+=260;}
fs.writeFileSync(path.join(out,'badges-contact-sheet.svg'),
 `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420" width="800" height="420"><rect width="800" height="420" fill="${bg}"/>${DEFS}${sheet}</svg>`);
console.log('ok');
