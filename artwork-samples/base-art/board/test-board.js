const fs=require('fs');const B=JSON.parse(fs.readFileSync('board.json')),E=JSON.parse(fs.readFileSync('emblem.json'));
const xc=148;
const sil=`M${xc-6},27 L${xc+6},27 L${xc+123.5},139 L${xc+126},600 Q${xc+126},649 ${xc+100},649 L${xc-100},649 Q${xc-126},649 ${xc-126},600 L${xc-123.5},139 Z`;
const bands=B.bands.map(b=>[b.y0-1,b.y1+1,b.color]);
const lp=ls=>'M'+ls.map(l=>l.pts.map(p=>p.join(',')).join('L')).join('ZM')+'Z';
const BT=E.button;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-192 0 672 672" width="672" height="672"><rect x="-192" width="672" height="672" fill="#fff"/><defs><clipPath id="c"><path d="${sil}"/></clipPath></defs><path d="${sil}" fill="${B.body}"/>`
 +`<g clip-path="url(#c)">`+bands.map(([a,b,c])=>`<rect x="0" y="${a}" width="288" height="${b-a+1}" fill="${c}"/>`).join('')+`</g>`
 +`<circle cx="${BT.cx}" cy="${BT.cy}" r="${BT.r}" fill="#6a6d75"/><circle cx="${BT.cx}" cy="${BT.cy}" r="${BT.r-1.8}" fill="none" stroke="#c4c7ce" stroke-width="3.6"/>`
 +`<path d="${lp(E.buttonLoops)}" fill="#c1c4cb" fill-rule="evenodd"/>`
 +`<path d="${lp(E.loops)}" fill="#bfc3cb" fill-rule="evenodd"/></svg>`;
fs.writeFileSync('test.svg',svg);
