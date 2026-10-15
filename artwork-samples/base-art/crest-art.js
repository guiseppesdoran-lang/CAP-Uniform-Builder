// CAP Crest redrawn as clean vector art in a 586 x 725 unit box (x centred on the axis, y down).
// Measured from the regulation's own illustrations (CAPR 39-1 Fig A6-4): overall proportions, shield/triangle/scroll placement from the CAP Crest;
// the triangle and three-blade prop outline traced from the (flat, vector-clean) CAP Command Patch (board/flat.js -> board/cap-prop.json);
// the eagle is drawn feather by feather here. Scroll lettering is outlined Arial Bold glyphs on the scroll arc. No raster is embedded.
const fs=require('fs'),path=require('path');
const C={NAVY:'#17194a',BLUE:'#2f4bb0',GOLD:'#e8b83c',GOLD_D:'#a8721c',GOLD_L:'#f7da7e',GOLD_M:'#cf9a2c',WHITE:'#f1f0ea',SHADE:'#d7d6cf',RED:'#d03a2c',RED_D:'#8f2217'};
const f=n=>(+n).toFixed(1),rad=a=>a*Math.PI/180;
module.exports=function crestArt(GLY){
  const PR=JSON.parse(fs.readFileSync(path.join(__dirname,'board','cap-prop.json'),'utf8'));
  const P=pts=>'M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
  // ---- eagle ----------------------------------------------------------------------------------------------------------
  // right wing silhouette: convex leading edge, six pointed primaries/secondaries along the trailing edge; the left wing is its mirror
  const J=[36,100],lead=[[76,70],[124,48],[186,32]],T=[270,20];
  const trail=[[254,86],[238,74],[230,120],[212,106],[200,152],[184,134],[164,172],[150,154],[120,182],[108,164],[74,180],[62,160]];
  const B=[42,150];
  const wingPts=[J].concat(lead,[T],trail,[B]);
  const wing=m=>P(wingPts.map(p=>[m*p[0],p[1]]));
  const vals=[[238,74],[212,106],[184,134],[150,154],[108,164],[62,160]];
  const featherLines=m=>vals.map(v=>{const e=[J[0]+0.42*(v[0]-J[0]),J[1]+0.30*(v[1]-J[1])-6];return `M${f(m*v[0])},${f(v[1])} Q${f(m*(v[0]+e[0])/2)},${f((v[1]+e[1])/2-10)} ${f(m*e[0])},${f(e[1])}`;}).join(' ');
  const covert=m=>{const pts=[[36,100],[76,70],[124,48],[186,32],[256,24]];let d=`M${f(m*pts[0][0])},${pts[0][1]}`;pts.slice(1).forEach(p=>d+=` L${f(m*p[0])},${p[1]}`);
    const low=[[220,66],[178,84],[134,98],[90,114],[50,130]];let prev=[256,24];low.forEach(p=>{const mx=(prev[0]+p[0])/2,my=(prev[1]+p[1])/2+9;d+=` Q${f(m*mx)},${f(my)} ${f(m*p[0])},${f(p[1])}`;prev=p;});return d+' Z';};
  const wings=m=>`<path d="${wing(m)}" fill="${C.GOLD}" stroke="${C.GOLD_D}" stroke-width="2.8" stroke-linejoin="round"/><path d="${featherLines(m)}" fill="none" stroke="${C.GOLD_D}" stroke-width="2.2" stroke-linecap="round"/><path d="${covert(m)}" fill="${C.GOLD_L}" stroke="${C.GOLD_D}" stroke-width="2.2" stroke-linejoin="round"/>`;
  const feathers=m=>wings(m);
  const cloud=[[0,142,88],[-104,168,52],[104,168,52],[0,64,40],[-58,92,38],[58,92,38]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const tail=[-30,-15,0,15,30].map((x,i)=>`<path d="M${x*0.35},196 Q${x*1.05},${210} ${x*1.2},238 Q${x*0.85},242 ${x*0.55},232 Q${x*0.3},216 ${x*0.35},196 Z" fill="${i%2?C.GOLD:C.GOLD_M}" stroke="${C.GOLD_D}" stroke-width="2.2" stroke-linejoin="round"/>`).join('');
  const breast=[0,1,2].map(i=>`<path d="M${-34+i*6},${118+i*26} Q0,${144+i*26} ${34-i*6},${118+i*26}" fill="none" stroke="${C.GOLD_D}" stroke-width="2.4" stroke-linecap="round"/>`).join('');
  const body=`<path d="M-50,96 Q-62,156 -34,208 L34,208 Q62,156 50,96 Q0,82 -50,96 Z" fill="${C.GOLD}" stroke="${C.GOLD_D}" stroke-width="2.6"/>`;
  const head=`<path d="M12,102 C24,82 20,54 2,45 C-12,39 -28,44 -34,58 L-58,68 C-64,76 -58,86 -48,86 C-44,80 -40,76 -34,76 C-34,92 -22,104 -8,106 Z" fill="${C.WHITE}" stroke="${C.GOLD_D}" stroke-width="2.4" stroke-linejoin="round"/>`
    +`<path d="M-34,58 L-58,68 C-64,76 -58,86 -48,86 C-46,78 -40,72 -34,70 Z" fill="${C.GOLD_L}" stroke="${C.GOLD_D}" stroke-width="2.4" stroke-linejoin="round"/>`
    +`<circle cx="-22" cy="60" r="3.8" fill="${C.NAVY}"/><path d="M-30,52 Q-20,46 -8,50" fill="none" stroke="${C.GOLD_D}" stroke-width="2.4" stroke-linecap="round"/>`;
  const bar='M-140,246 Q-140,236 -130,236 L130,236 Q140,236 140,246 L140,254 Q140,264 130,264 L-130,264 Q-140,264 -140,254 Z';
  // ---- shield / triangle / prop --------------------------------------------------------------------------------------
  const shield='M-186,278 L186,278 L184,380 Q174,440 182,500 Q184,572 0,652 Q-184,572 -182,500 Q-174,440 -184,380 Z';
  const k=0.744,pcx=333,ptop=63,tcx=-2,ttop=314;
  const tp=pts=>pts.map(p=>[tcx+(p[0]-pcx)*k,ttop+(p[1]-ptop)*k+4]);
  const tri=P(tp(PR.tri))+' '+P(tp(PR.triHole)),prop=P(tp(PR.prop)),outer=P(tp(PR.tri));
  // ---- scroll (centreline y = 679 - 114 (dx/255)^2) -----------------------------------------------------------------
  const cl=dx=>679-114*(dx/255)**2, th=dx=>25+9*(Math.abs(dx)/255)**1.5,N=40,up=[],lo=[];
  for(let i=0;i<=N;i++){const dx=-258+516*i/N;up.push([dx,cl(dx)-th(dx)]);lo.push([dx,cl(dx)+th(dx)]);}
  const scroll=P(up.concat(lo.reverse()));
  const text='CIVIL AIR PATROL',cap=34,kk=cap/71.58,ch=[...text],adv=ch.map(c=>c===' '?0.34*100*kk:GLY[c].adv*kk),gap=3,total=adv.reduce((a,v)=>a+v,0)+gap*(ch.length-1);
  const arc=[];{let s=0,px=-258,py=cl(-258);arc.push([0,px,py]);for(let i=1;i<=400;i++){const dx=-258+516*i/400,y=cl(dx);s+=Math.hypot(dx-px,y-py);px=dx;py=y;arc.push([s,dx,y]);}}
  const at=s=>{for(let i=1;i<arc.length;i++)if(arc[i][0]>=s){const a=arc[i-1],b=arc[i],t=(s-a[0])/(b[0]-a[0]||1);return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,Math.atan2(b[2]-a[2],b[1]-a[1])];}return [0,0,0];};
  let pos=(arc[arc.length-1][0]-total)/2,letters='';
  ch.forEach((c,i)=>{if(c!==' '){const mid=pos+adv[i]/2,[x,y,a]=at(mid);letters+=`<g transform="translate(${f(x)} ${f(y)}) rotate(${(a*180/Math.PI).toFixed(2)}) translate(${f(-adv[i]/2)} ${f(cap/2)}) scale(${kk.toFixed(4)})"><path d="${GLY[c].d}"/></g>`;}pos+=adv[i]+gap;});
  // ---- assemble ------------------------------------------------------------------------------------------------------
  const fat=(d,w=46)=>`<path d="${d}" fill="${C.NAVY}" stroke="${C.NAVY}" stroke-width="${w}" stroke-linejoin="round"/>`;
  const wingSil=m=>wing(m);
  const border=fat(wingSil(1))+fat(wingSil(-1))+`<g fill="${C.NAVY}" stroke="${C.NAVY}" stroke-width="46" stroke-linejoin="round">${cloud}</g>`+fat(body.match(/d="([^"]+)"/)[1])+fat(bar)+fat(shield)+fat(scroll);
  const art=
    `<g fill="${C.WHITE}" stroke="${C.SHADE}" stroke-width="3">${cloud}</g>`
   +`<g>${feathers(1)}</g><g>${feathers(-1)}</g>`
   +tail+body+breast+head
   +`<path d="${bar}" fill="${C.WHITE}" stroke="${C.GOLD_D}" stroke-width="3"/>`+[-84,0,84].map(x=>`<ellipse cx="${x}" cy="250" rx="26" ry="8" fill="${C.BLUE}" stroke="${C.GOLD_D}" stroke-width="2"/>`).join('')
   +`<path d="${shield}" fill="${C.BLUE}" stroke="${C.GOLD}" stroke-width="16" stroke-linejoin="round"/><path d="${shield}" fill="none" stroke="${C.GOLD_D}" stroke-width="2"/>`
   +`<path d="${outer}" fill="none" stroke="${C.GOLD}" stroke-width="13" stroke-linejoin="round"/><path d="${tri}" fill="${C.WHITE}" fill-rule="evenodd"/><path d="${prop}" fill="${C.RED}" stroke="${C.RED_D}" stroke-width="2"/>`
   +`<path d="${scroll}" fill="${C.WHITE}" stroke="${C.GOLD}" stroke-width="11" stroke-linejoin="round"/><path d="${scroll}" fill="none" stroke="${C.GOLD_D}" stroke-width="2"/>`
   +`<g fill="${C.GOLD_D}">${letters}</g>`;
  return {svg:`<g>${border}${art}</g>`,w:586,h:725,top:20};
};
