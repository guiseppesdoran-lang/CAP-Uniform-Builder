// Senior Ground Team badge SVG. Wreath geometry comes from gt-lib.js (parameters fitted by optimize-gt.js
// to images/badges/senior_ground_team_badge.webp); disc / triangle / GT / star numbers were measured by hand
// from the same reference (see BADGE_REPLICATION_PROCESS.md).
const fs=require('fs'),path=require('path');
const L=require('./gt-lib.js');
const f=n=>n.toFixed(2);
const P=fs.existsSync(path.join(__dirname,'gt-params.json'))?JSON.parse(fs.readFileSync(path.join(__dirname,'gt-params.json'))):L.DEFAULT;
const M={
  star:(P.fixed||L.FIXED).star,disc:(P.fixed||L.FIXED).disc,ribbon:(P.fixed||L.FIXED).ribbon,
  tri:{apexX:118,apexY:61,baseY:138,left:80.5,right:155.5,stripe:4.6},
};

const DEFS=`<defs>
<linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfbfc"/><stop offset=".35" stop-color="#cdd1d6"/><stop offset=".65" stop-color="#8f969e"/><stop offset="1" stop-color="#dfe2e6"/></linearGradient>
<linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#d3d7dc"/><stop offset="1" stop-color="#9aa1a9"/></linearGradient>
<linearGradient id="disc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eceef0"/><stop offset="1" stop-color="#b9bfc5"/></linearGradient>
<linearGradient id="tri" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa1a8"/><stop offset=".5" stop-color="#e9ebed"/><stop offset="1" stop-color="#8b929a"/></linearGradient>
<clipPath id="trip"><path d="M${M.tri.apexX},${M.tri.apexY} L${M.tri.right},${M.tri.baseY} H${M.tri.left} Z"/></clipPath>
</defs>`;

const pathOf=pts=>pts.map((p,i)=>(i?'L':'M')+f(p[0])+','+f(p[1])).join('')+'Z';
const W_=L.wreath(P);
let wreath='';
for(const b of W_.bands){const d=b.map((p,i)=>(i?'L':'M')+f(p[0])+','+f(p[1])).join('');
  wreath+=`<path d="${d}" fill="none" stroke="#8e959d" stroke-width="${f(P.bandW)}" stroke-linecap="round" stroke-linejoin="round"/>`
        +`<path d="${d}" fill="none" stroke="#a9afb6" stroke-width="${f(P.bandW*0.7)}" stroke-linecap="round" stroke-linejoin="round"/>`;}
for(const r of W_.rims){const d=r.map((p,i)=>(i?'L':'M')+f(p[0])+','+f(p[1])).join('');
  wreath+=`<path d="${d}" fill="none" stroke="#555c64" stroke-width="${f((P.rimW||6)+1.2)}" stroke-linecap="round" stroke-linejoin="round"/>`
        +`<path d="${d}" fill="none" stroke="#c3c8ce" stroke-width="${f(P.rimW||6)}" stroke-linecap="round" stroke-linejoin="round"/>`;}
for(const row of ['i','o'])for(const l of W_.leaves){if(l.row!==row)continue;
  wreath+=`<path d="${pathOf(l.poly)}" fill="url(#leaf)" stroke="#555c64" stroke-width=".6" stroke-linejoin="round"/>`
        +`<path d="M${f(l.spine[0][0])},${f(l.spine[0][1])} L${f(l.spine[1][0])},${f(l.spine[1][1])}" stroke="#7d848c" stroke-width=".5"/>`;}

const T=M.tri;let stripes='';
for(let y=T.apexY+5;y<T.baseY-2;y+=T.stripe)stripes+=`<rect x="70" y="${f(y)}" width="100" height="2.2" fill="#69707a"/>`;
const rb=M.ribbon;
const ribbon=[[-1,1],[1,-1]].map(([a,b])=>{
  const A=[120+a*rb.half,rb.y0],B=[120+b*rb.half,rb.y1],dx=B[0]-A[0],dy=B[1]-A[1],Ln=Math.hypot(dx,dy),ux=dx/Ln,uy=dy/Ln,nx=-uy*rb.w/2,ny=ux*rb.w/2;
  // swallow-tail end: V notch cut into the far end
  const pts=[[A[0]+nx,A[1]+ny],[B[0]+nx,B[1]+ny],[B[0]-ux*5,B[1]-uy*5],[B[0]-nx,B[1]-ny],[A[0]-nx,A[1]-ny]];
  const d='M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
  return `<path d="${d}" fill="url(#m)" stroke="#444b52" stroke-width="1" stroke-linejoin="round"/>`
        +`<path d="M${f(A[0]+nx*.35)},${f(A[1]+ny*.35)} L${f(B[0]+nx*.35)},${f(B[1]+ny*.35)}" stroke="#ffffff" stroke-width="1.2" opacity=".8"/>`;}).join('');
const star=`<polygon points="${L.starPts(M.star).map(p=>f(p[0])+','+f(p[1])).join(' ')}" fill="url(#m)" stroke="#444b52" stroke-width="1.3" stroke-linejoin="round"/>`;

// star: facets drawn as lines from the centre to every vertex
const sp=L.starPts(M.star);
const starLines=sp.map(p=>`<path d="M${f(M.star.cx)},${f(M.star.cy)} L${f(p[0])},${f(p[1])}" stroke="#444b52" stroke-width=".9"/>`).join('');
const body=`<g>
 ${wreath}
 ${ribbon}
 <circle cx="${M.disc.cx}" cy="${M.disc.cy}" r="${M.disc.R}" fill="url(#m)" stroke="#444b52" stroke-width="1.8"/>
 <circle cx="${M.disc.cx}" cy="${M.disc.cy}" r="${M.disc.rim}" fill="url(#disc)" stroke="#6c737b" stroke-width="1.4"/>
 <path d="M${T.apexX},${T.apexY} L${T.right},${T.baseY} H${T.left} Z" fill="url(#tri)" stroke="#444b52" stroke-width="1.5" stroke-linejoin="round"/>
 <g clip-path="url(#trip)">${stripes}</g>
 <text x="115.3" y="135" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="38" fill="#eef0f2" stroke="#2f353b" stroke-width="1" stroke-linejoin="round" paint-order="stroke">GT</text>
 ${star}
 ${starLines}
</g>`;

const out=path.join(__dirname,'badges');
const svg=(extra='',vb='0 0 240 203',w=240,h=203)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}" width="${w}" height="${h}">${DEFS}${extra}${body}</svg>`;
fs.writeFileSync(path.join(out,'senior_ground_team.svg'),svg());
fs.writeFileSync(path.join(__dirname,'gt-measure.svg'),svg('<rect x="0" y="-18" width="240" height="240" fill="#ff00ff"/>','0 -18 240 240',240,240));
if(process.argv[2]){
  const ref=fs.readFileSync(process.argv[2]).toString('base64');
  fs.writeFileSync(path.join(__dirname,'gt-compare.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 -148.5 520 520" width="520" height="520"><rect y="-148.5" width="520" height="520" fill="#fff"/>
  <image x="10" y="10" width="240" height="203" xlink:href="data:image/png;base64,${ref}"/><g transform="translate(270 10)">${DEFS}${body}</g></svg>`);
}
