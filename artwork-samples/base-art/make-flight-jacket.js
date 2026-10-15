// CAP green flight jacket (MA-1 / CWU-36/P / CWU-45/P, CAPR 39-1 para 8.2.7.1, Figure 8.3), front view, in real inches.
// Outline, collar, knit bands, pockets and sleeve layout follow the regulation's Figure 8.3 (measured, nothing embedded).
// Documented: nametag 2 x 4 in; CAP Command Patch right breast opposite the nametag; US flag 2 x 3 1/2 in on the left sleeve, 1/2 in below the seam;
// 3 1/2 x 3 1/2 in sleeve loop square (right sleeve); grade insignia on top of the shoulder; "configure accoutrements like the FDU" (8.2.7.1).
// Size Medium dims from MIL-J-8279G (see geometry block). ESTIMATED: collar/knit heights, armhole depth, shoulder width, sleeve girth, ES patch zone, command patch size.
const fs=require('fs'),path=require('path');
// Emits the green USAF-style flight jacket (8.2.7.1, Figure 8.3) and the CFDU's blue flight jacket (8.3.7; no figure in the reg, same MA-1 cut recoloured).
if(!process.env.JK_VARIANT){for(const v of ['green','blue'])require('child_process').execSync(`node "${__filename}"`,{env:{...process.env,JK_VARIANT:v},stdio:'inherit'});process.exit(0);}
const BL=process.env.JK_VARIANT==='blue';
const commandPatch=require('./command-patch-art.js');
const f=n=>(+n).toFixed(3),STROKE=BL?'#080d18':'#2a2f20';
const P=pts=>'M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
const mirror=pts=>pts.map(([x,y])=>[-x,y]);
const starPts=(cx,cy,r)=>Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.382:r;return f(cx+rr*Math.cos(a))+','+f(cy+rr*Math.sin(a));}).join(' ');
// full-colour US flag patch with gold merrowed border inside the overall size; canton at the left (normal) or right (reversed)
const flagPatch=(id,X,Y,W,H,reversed=false)=>{const bd=0.1,x=X+bd,y=Y+bd,w=W-2*bd,h=H-2*bd,sh=h/13,cw=0.4*w,ch=sh*7,cx0=reversed?x+w-cw:x;
  let g=`<g id="${id}"><rect x="${f(X)}" y="${f(Y)}" width="${W}" height="${H}" fill="#c9a227"/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#fff"/>`;
  for(let i=0;i<13;i+=2)g+=`<rect x="${f(x)}" y="${f(y+i*sh)}" width="${f(w)}" height="${f(sh)}" fill="#b22234"/>`;
  g+=`<rect x="${f(cx0)}" y="${f(y)}" width="${f(cw)}" height="${f(ch)}" fill="#3c3b6e"/>`;
  const px=cw/12,py=ch/10,r=Math.min(px,py)*0.42;
  for(let row=0;row<9;row++)for(let c=0;c<(row%2?5:6);c++){const sx=cx0+px*(row%2?2+2*c:1+2*c),sy=y+py*(row+1);g+=`<polygon points="${starPts(sx,sy,r)}" fill="#fff"/>`;}
  return g+`<rect x="${f(X)}" y="${f(Y)}" width="${W}" height="${H}" fill="none" stroke="#1a1a1a" stroke-opacity=".6" stroke-width=".05"/></g>`;};
const GLY=JSON.parse(fs.readFileSync(path.join(__dirname,'..','assets','tools','glyphs_arialbold_cap.json')));
// outlined lettering (no <text>): centred on (cx,cy), cap height capH in, fitted to fitW
const lettering=(str,cx,cy,capH,fill,track=0.06,fitW=null)=>{const k=capH/71.58,ch=[...str],adv=ch.map(c=>c===' '?0.28*100:GLY[c].adv);
  const tw=adv.reduce((a,v)=>a+v,0)+track*100*(ch.length-1),kx=fitW?fitW/tw:k;let x=0,d='';
  ch.forEach((c,i)=>{if(c!==' ')d+=`<path transform="translate(${f(x)} 0)" d="${GLY[c].d}"/>`;x+=adv[i]+track*100;});
  return `<g fill="${fill}" transform="translate(${f(cx-tw*kx/2)} ${f(cy+capH/2)}) scale(${kx.toFixed(5)} ${k.toFixed(5)})">${d}</g>`;};
const crease=d=>`<path d="${d}" fill="none" stroke="#000" stroke-opacity=".10" stroke-width=".11" stroke-linecap="round"/>`;
const zipLine=(x1,y1,x2,y2,w=0.16)=>`<path d="M${f(x1)},${f(y1)} L${f(x2)},${f(y2)}" stroke="${ZIP}" stroke-width="${w}" stroke-linecap="butt" fill="none"/><path d="M${f(x1)},${f(y1)} L${f(x2)},${f(y2)}" stroke="${TEETH}" stroke-width="${f(w*0.45)}" stroke-dasharray=".05 .06" fill="none"/>`;
const fab=(d,id,sw=0.08)=>`<path ${id?`id="${id}" `:''}d="${d}" fill="${FDU}" stroke="${STROKE}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const DEFS=`<defs><linearGradient id="wrapR" x1="0" x2="1" y1="0" y2="0"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient><linearGradient id="wrapL" x1="1" x2="0" y1="0" y2="0"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient><linearGradient id="shadeBox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".22" stop-color="#000" stop-opacity=".06"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>`
  +`<linearGradient id="shadeBody" gradientUnits="userSpaceOnUse" x1="-13.2" y1="0" x2="13.2" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".1" stop-color="#000" stop-opacity=".10"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset=".9" stop-color="#000" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity=".30"/></linearGradient>`
  +`<linearGradient id="shoulderLight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;

const ZIP=BL?'#c3c9d2':'#aeb29f',TEETH=BL?'#1a2438':'#5d6350',NAVY=BL?'#0e1014':'#142347',SILVER='#c4c8cf';
const FDU=BL?'#0c2152':'#7e9477';const JK=FDU,JK_LOOP=BL?'#0c0d10':'#93a98b';   // blue: Figure 6.6 navy sampled (6,25,80); green: Figure 8.3 sage (124,143,117)
const PATCH={flag:{w:3.5,h:2.0},nametag:{w:4.0,h:2.0},loopSquare:{w:3.5,h:3.5},command:{w:3.0,h:commandPatch('x',0,0,3.0).h},es:{w:3.0,h:3.0},grade:{w:1.6,h:1.25},go:{w:2.2,h:1.2}};
// ---------------- flight jacket geometry (inches; y down from the top of the collar, x from the zip line, + = wearer's left) ----------------
// ---------------- flight jacket geometry (inches; y down from the top of the collar, x from the zip line, + = wearer's left) ----------------
// SIZE MEDIUM, from MIL-J-8279G (18 Mar 1988) Table V, p. 19 and Table IV ops 3/4/6 (verified against the page images):
//   back length 22 1/2 (centre back, bottom of undercollar to the seam above the knit)   -> WB_TOP - NECK_SEAM
//   1/2 chest 26 (folded edge to folded edge at the armhole base)                          -> body half-width 13.0 at ARMPIT
//   1/2 bottom 23 1/2 (at the seam above the knit)                                         -> body half-width 11.75 at WB_TOP
//   sleeve inseam 16 3/8 (underarm seam, armhole to the seam above the knit)               -> CUFF_TOP - ARMPIT
//   pocket flap 7 1/2 x 2 3/8 in, snap 3/4 in from the edge; cigarette/pencil sleeve pocket 5 3/4 x 3 1/4 in, pencil openings 7/8 in
// The garment shape (collar, shoulder line, flap slant, band proportions) follows the CAPR 39-1 Figure 8.3 illustration; knit heights,
// collar height, armhole depth, shoulder width and sleeve girth are ESTIMATES (the spec table does not give them).
const NECK_SEAM=1.6,BACK_LEN=22.5,WB_TOP=NECK_SEAM+BACK_LEN,KNIT_H=2.4,WB_BOT=WB_TOP+KNIT_H;
const ARMPIT=NECK_SEAM+10.9,INSEAM=16.375,CUFF_TOP=ARMPIT+INSEAM,CUFF_H=2.2,CUFF_BOT=CUFF_TOP+CUFF_H,SEAM=3.7;
const HC=13.0,HB=11.75;   // half chest / half bottom (flat width / 2)
// sleeve outer edge (silhouette) [y, x] and inner edge against the body [y, x]
const OUT=[[3.3,9.5],[3.7,10.7],[5.8,12.8],[9.0,14.9],[12.5,17.6],[17,18.6],[22,18.0],[26,17.3],[CUFF_TOP,16.9],[CUFF_BOT,16.6]];
const SIN=[[4.6,10.2],[8.0,11.4],[ARMPIT,HC],[18,12.6],[23,12.3],[CUFF_TOP,12.2],[CUFF_BOT,12.1]];
const lerp=(arr,y)=>{for(let i=0;i<arr.length-1;i++){const a=arr[i],b=arr[i+1];if(y>=a[0]&&y<=b[0])return a[1]+(b[1]-a[1])*(y-a[0])/((b[0]-a[0])||1);}return y<arr[0][0]?arr[0][1]:arr[arr.length-1][1];};
const outerX=y=>lerp(OUT,y);
const RIB=BL?'#1a2944':'#6c8266',RIBL=BL?'#0f1a2e':'#5a7054',LINING='#e7892a',GOLD='#cfa22a';
const SHX=[[1.8,3.75],[3.3,9.5]],shY=x=>1.8+(x-3.75)*(3.3-1.8)/(9.5-3.75);   // shoulder line: collar base to the armhole top
const FLAP={L:7.5,W:2.375,lean:25*Math.PI/180,top:[6.2,16.6]};   // spec flap length/width; lean and position from Figure 8.3
const flapPts=s=>{const {L,W,lean,top}=FLAP,d=[Math.sin(lean),Math.cos(lean)],n=[Math.cos(lean),-Math.sin(lean)];
  const P2=(u,v)=>[s*(top[0]+d[0]*u+n[0]*v),top[1]+d[1]*u+n[1]*v];
  return [P2(0,-W/2),P2(0,W/2),P2(L*0.84,W/2),P2(L,0),P2(L*0.84,-W/2)];};
const garment=()=>{
  let g='';
  const body='M-3.75,1.8 L-9.5,3.3 L-10.2,4.6 L-11.4,8.0 L-13.0,'+f(ARMPIT)+' L-12.6,18 L-'+HB+','+f(WB_TOP)+' L'+HB+','+f(WB_TOP)+' L12.6,18 L13.0,'+f(ARMPIT)+' L11.4,8.0 L10.2,4.6 L9.5,3.3 L3.75,1.8 Z';
  g+=`<g id="garment-body"><path id="silhouette" d="${body}" fill="${JK}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<clipPath id="clipBody"><path d="${body}"/></clipPath><g clip-path="url(#clipBody)"><rect x="-14" y="-2" width="28" height="44" fill="url(#shadeBody)"/><path d="${body}" fill="url(#shoulderLight)"/></g></g>`;
  // sleeves: separate pieces; outer edge = silhouette, inner edge = armhole seam / free edge against the body
  for(const s of [-1,1]){const tag=s<0?'right':'left';
    const ys=OUT.map(p=>p[0]),yi=SIN.map(p=>p[0]).slice().reverse();
    const o=ys.map(y=>[s*outerX(y),y]),i=yi.map(y=>[s*lerp(SIN,y),y]);
    const sd=P(o.concat(i)),wo=outerX(CUFF_TOP),wi=lerp(SIN,CUFF_TOP);
    g+=`<g id="sleeve-${tag}"><clipPath id="clip-sleeve-${tag}"><path d="${sd}"/></clipPath>`
      +`<path id="sleeve-body-${tag}" d="${sd}" fill="${JK}" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`
      +`<g clip-path="url(#clip-sleeve-${tag})"><path d="${sd}" fill="url(#shadeBox)"/>`
      +crease(`M${f(s*(wi+0.8))},${f(CUFF_TOP-6)} Q${f(s*(wi+wo)/2)},${f(CUFF_TOP-5)} ${f(s*(wo-0.6))},${f(CUFF_TOP-5.9)}`)+`</g>`
      +ribBand(`cuff-${tag}`,[[s*wi,CUFF_TOP],[s*wo,CUFF_TOP],[s*outerX(CUFF_BOT),CUFF_BOT],[s*lerp(SIN,CUFF_BOT),CUFF_BOT]],'v')
      +`</g>`;}
  // knitted waistband (narrower than the bottom of the body, as in Figure 8.3)
  g+=ribBand('waistband',[[-HB,WB_TOP],[HB,WB_TOP],[HB-0.75,WB_BOT],[-(HB-0.75),WB_BOT]],'v');
  // lower slanted flap pockets (7 1/2 x 2 3/8 in) with a snap 3/4 in from the edge; wearer's right = image left
  for(const s of [-1,1]){const tag=s<0?'right':'left',pp=flapPts(s<0?-1:1);
    const {L,lean,top}=FLAP,u=L-0.75-0.2,sx=s<0?-1:1,cxs=sx*(top[0]+Math.sin(lean)*u),cys=top[1]+Math.cos(lean)*u;
    g+=`<path id="flap-pocket-${tag}" d="${P(pp)}" fill="${JK}" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`
      +`<circle cx="${f(cxs)}" cy="${f(cys)}" r=".3" fill="none" stroke="${STROKE}" stroke-width=".07"/>`;}
  // gold front zip with pull
  const ZT=4.6;
  g+=`<path id="front-zipper" d="M-0.13,${ZT} L0.13,${ZT} L0.13,${WB_BOT} L-0.13,${WB_BOT} Z" fill="${GOLD}" stroke="${STROKE}" stroke-width=".04"/>`
    +`<path d="M0,${ZT+0.1} L0,${WB_BOT-0.1}" stroke="#7a5a12" stroke-width=".07" stroke-dasharray=".05 .06"/>`
    +`<rect x="-0.17" y="${ZT-0.1}" width=".34" height=".6" fill="#8a6a16"/>`;
  // ribbed stand-up collar with the orange lining showing in the opening
  const collar=[[-2.86,0.2],[-1.4,0.0],[1.4,0.0],[2.86,0.2],[3.33,1.3],[3.9,1.9],[1.0,ZT],[-1.0,ZT],[-3.9,1.9],[-3.33,1.3]];
  g+=ribBand('collar',collar,'v')
    +`<path id="collar-lining" d="${P([[-2.0,1.6],[0,1.45],[2.0,1.6],[0.0,ZT]])}" fill="${LINING}" stroke="${STROKE}" stroke-width=".05" stroke-linejoin="round"/>`;
  // grade zones (blank landmarks): officers centred on top of the shoulder, outer edge 1/2 in from the shoulder seam (8.2.3.2);
  // general officers: 1 in stars halfway between neck and shoulder seam (8.2.3.1); NCOs/cadets none (8.2.3.3)
  const gx=9.5-0.5-PATCH.grade.w/2;   // outer edge 1/2 in inside the armhole top
  for(const s of [-1,1]){const tag=s<0?'right':'left';
    g+=`<rect id="grade-zone-${tag}" x="${f(s*gx-PATCH.grade.w/2)}" y="${f(shY(gx+PATCH.grade.w/2)+0.15)}" width="${PATCH.grade.w}" height="${PATCH.grade.h}" fill="#000" fill-opacity="0"><title>Officer grade insignia on top of the shoulder, outer edge 1/2 in from the shoulder seam (CAPR 39-1 8.2.3.2, jacket configured like the FDU); blank placement zone</title></rect>`
      +`<rect id="grade-zone-go-${tag}" x="${f(s*6.625-PATCH.go.w/2)}" y="${f(shY(6.625+PATCH.go.w/2)+0.15)}" width="${PATCH.go.w}" height="${PATCH.go.h}" fill="#000" fill-opacity="0"><title>General officer stars (1 in; zone holds two side by side, cloth-bordered 2.2 x 1.2 in), halfway between neck and shoulder seam (8.2.3.1); blank placement zone</title></rect>`;}
  // nametag (wearer's left breast) and Command Patch (wearer's right breast, opposite) — mandatory on the flight jacket (8.2.7.1)
  const CX=6.5,CY=8.8;
  const nt={x:CX-PATCH.nametag.w/2,y:CY-PATCH.nametag.h/2};
  g+=`<g id="name-tape"><rect x="${f(nt.x)}" y="${f(nt.y)}" width="${PATCH.nametag.w}" height="${PATCH.nametag.h}" fill="${NAVY}"/><rect x="${f(nt.x+0.07)}" y="${f(nt.y+0.07)}" width="${f(PATCH.nametag.w-0.14)}" height="${f(PATCH.nametag.h-0.14)}" fill="none" stroke="${SILVER}" stroke-width=".07"/><title>Nametag (blank): 2 x 4 in, wearer's left breast</title></g>`;
  g+=commandPatch('patch-command',-CX,CY,PATCH.command.w).svg;
  g+=`<rect id="command-patch-zone" x="${f(-CX-PATCH.command.w/2)}" y="${f(CY-PATCH.command.h/2)}" width="${PATCH.command.w}" height="${PATCH.command.h}" fill="none"><title>CAP Command Patch placement area</title></rect>`
    +`<rect id="es-patch-zone" x="${f(-CX-PATCH.es.w/2)}" y="${f(CY+PATCH.command.h/2+0.4)}" width="${PATCH.es.w}" height="${PATCH.es.h}" fill="#000" fill-opacity="0"><title>Optional Emergency Services patch, below and centred under the Command Patch (jacket has no breast pocket; position ESTIMATED); blank placement zone</title></rect>`;
  // sleeve patches seen from the front, clipped by the sleeve and tilted with its edge (as on the FDU)
  for(const s of [-1,1]){const tag=s<0?'right':'left';
    const strip=(y0,w,h,over,inner)=>{const yc=y0+h/2,th=Math.atan((outerX(yc+h/2)-outerX(yc-h/2))/h)*180/Math.PI,x1=outerX(yc)+over,x0=x1-w,
        X0=Math.min(s*x0,s*x1),tr=`rotate(${f(-s*th)} ${f(s*(x0+x1)/2)} ${f(yc)})`;
      return `<g clip-path="url(#clip-sleeve-${tag})"><g transform="${tr}">${inner(X0,y0,w,h)}<rect x="${f(X0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="url(#wrap${s<0?'L':'R'})"/></g></g>`;};
    if(tag==='left'){
      g+=`<g id="sleeve-front-flag-left">`+strip(SEAM+0.5,2.4,PATCH.flag.h,0.3,(x,y,w,h)=>{const u=w-0.14,st=(h-0.14)/13;
        return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${h}" fill="#c9a227"/><rect x="${f(x+0.07)}" y="${f(y+0.07)}" width="${f(u)}" height="${f(h-0.14)}" fill="#fff"/>`
          +[0,2,4,6,8,10,12].map(i=>`<rect x="${f(x+0.07)}" y="${f(y+0.07+i*st)}" width="${f(u)}" height="${f(st)}" fill="#b22234"/>`).join('')
          +`<rect x="${f(x+0.07)}" y="${f(y+0.07)}" width="${f(u*0.4)}" height="${f(st*7)}" fill="#3c3b6e"/>`;})+`</g>`;
      g+=`<g id="sleeve-front-pocket-left">`+strip(SEAM+6.3,3.25,5.75,0.1,(x,y,w,h)=>`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${JK}" stroke="${STROKE}" stroke-width=".07"/>`
        +zipLine(x+0.45,y+0.4,x+0.45,y+h-0.4,0.14).replace(new RegExp(ZIP,'g'),GOLD)+`<rect x="${f(x+w-1.15)}" y="${f(y+0.4)}" width=".875" height="${f(h-1.1)}" fill="${JK}" stroke="${STROKE}" stroke-width=".05"/>`)+`</g>`;
    } else {
      g+=`<g id="sleeve-front-loop-right">`+strip(SEAM+0.5,2.4,PATCH.loopSquare.h,0.3,(x,y,w,h)=>`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${JK_LOOP}" stroke="${STROKE}" stroke-width=".07"/><rect x="${f(x+0.18)}" y="${f(y+0.18)}" width="${f(Math.max(w-0.36,0.1))}" height="${f(h-0.36)}" fill="none" stroke="${TEETH}" stroke-width=".05" stroke-dasharray=".14 .1"/>`)+`</g>`;
    }}
  return g;};
// knitted rib band: filled polygon with fine rib lines, clipped to the band
function ribBand(id,pts,dir,hole){
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  let l='';for(let x=x0;x<=x1;x+=0.22)l+=`M${f(x)},${f(y0)} L${f(x)},${f(y1)} `;
  const d=P(pts);
  return `<g id="${id}-g"><clipPath id="clip-${id}"><path d="${d}"/></clipPath><path id="${id}" d="${d}" fill="${RIB}" stroke="${STROKE}" stroke-width=".08" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clip-${id})"><path d="${l}" stroke="${RIBL}" stroke-width=".07" fill="none"/></g></g>`;}

// ---------- flat sleeve views beside the jacket ----------
const SVX=18.6+0.9+4.0,SVTOP=0.6,SLEN=CUFF_BOT-SEAM;
function sleeveView(s){
  const tag=s<0?'right':'left',cx=s*SVX,top=SVTOP,len=SLEN;
  const T=[[0,7.4],[8,7.0],[16,5.8],[len-CUFF_H,4.7],[len,4.5]],W=l=>{for(let i=0;i<T.length-1;i++)if(l<=T[i+1][0])return T[i][1]+(T[i+1][1]-T[i][1])*(l-T[i][0])/(T[i+1][0]-T[i][0]);return T[T.length-1][1];};
  const ls=[];for(let l=0;l<len;l+=0.5)ls.push(l);ls.push(len);
  const Rt=ls.map(l=>[cx+W(l)/2,top+l]),Lt=ls.map(l=>[cx-W(l)/2,top+l]).reverse();
  const sd=`M${f(Lt[Lt.length-1][0])},${f(top)} Q${f(cx)},${f(top-0.9)} ${f(Rt[0][0])},${f(top)} `+Rt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' '+Lt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' Z';
  const cuffTop=top+len-CUFF_H;
  let g=`<g id="sleeve-view-${tag}"><clipPath id="clip-sv-${tag}"><path d="${sd}"/></clipPath><path id="sleeve-view-body-${tag}" d="${sd}" fill="${JK}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clip-sv-${tag})"><path d="${sd}" fill="url(#shadeBox)"/>`
    +crease(`M${f(cx-W(17)/2+0.5)},${f(top+16.6)} Q${f(cx)},${f(top+17.6)} ${f(cx+W(17)/2-0.5)},${f(top+16.5)}`)+`</g>`
    +ribBand('cuff-flat-'+tag,[[cx-W(len)/2,cuffTop],[cx+W(len)/2,cuffTop],[cx+W(len)/2,top+len],[cx-W(len)/2,top+len]],'v');
  if(tag==='left'){
    g+=flagPatch('patch-flag-left',cx-PATCH.flag.w/2,top+0.5,PATCH.flag.w,PATCH.flag.h,false);
    const pw=3.25,ph=5.75,px=cx-pw/2,py=top+6.3;
    g+=`<g id="sleeve-pocket-left"><title>Left sleeve cigarette/pencil pocket 5 3/4 x 3 1/4 in incl. zipper tape, pencil openings 7/8 in (MIL-J-8279G Table IV op. 6)</title>`
      +`<rect id="sleeve-pocket-body-left" x="${f(px)}" y="${f(py)}" width="${pw}" height="${ph}" fill="${JK}" stroke="${STROKE}" stroke-width=".08"/>`
      +zipLine(px+0.45,py+0.4,px+0.45,py+ph-0.4,0.14).replace(new RegExp(ZIP,'g'),GOLD)
      +`<rect id="pen-pocket-left" x="${f(px+pw-1.15)}" y="${f(py+0.4)}" width=".875" height="${f(ph-1.1)}" fill="${JK}" stroke="${STROKE}" stroke-width=".05"/></g>`;
  } else {
    g+=`<rect id="patch-loop-right" x="${f(cx-PATCH.loopSquare.w/2)}" y="${f(top+0.5)}" width="${PATCH.loopSquare.w}" height="${PATCH.loopSquare.h}" fill="${JK_LOOP}" stroke="${STROKE}" stroke-width=".07"><title>3 1/2 x 3 1/2 in loop tape for a sleeve patch (8.2.5.5, jacket configured like the FDU); position ESTIMATED</title></rect>`
      +`<rect x="${f(cx-PATCH.loopSquare.w/2+0.18)}" y="${f(top+0.68)}" width="${f(PATCH.loopSquare.w-0.36)}" height="${f(PATCH.loopSquare.h-0.36)}" fill="none" stroke="${TEETH}" stroke-width=".05" stroke-dasharray=".14 .1"/>`;
  }
  return g+'</g>';}

// ---------- write ----------
const here=__dirname,OUTDIR=path.join(here,'..','assets','garments'),U=100;fs.mkdirSync(OUTDIR,{recursive:true});
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const nsIds=(svg,prefix)=>{const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
  return svg.replace(/(\sid=")([^"]+)(")/g,(m,a,id,c)=>a+prefix+'__'+id+c).replace(/url\(#([^)]+)\)/g,(m,id)=>ids.has(id)?`url(#${prefix}__${id})`:m);};
const attrsOf=t=>Object.fromEntries([...t.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
function el(svg,id){const m=svg.match(new RegExp(`<(rect|path|g|circle)\\s[^>]*\\bid="${id}"[^>]*>`));return m?{tag:m[1],at:attrsOf(m[0]),end:m.index+m[0].length}:null;}
function lmRect(svg,id,vb){const e=el(svg,id);if(!e)return null;let at=e.at;if(e.tag==='g'){const r=svg.slice(e.end).match(/<rect\s[^>]*>/);at=attrsOf(r[0]);}
  return {x:+((+at.x-vb.x)*U).toFixed(2),y:+((+at.y-vb.y)*U).toFixed(2),w:+(at.width*U).toFixed(2),h:+(at.height*U).toFixed(2)};}
function lmPoly(svg,id,vb){const e=el(svg,id);if(!e)return null;const n=e.at.d.match(/-?\d*\.?\d+/g).map(Number),p=[];
  for(let i=0;i+1<n.length;i+=2)p.push([+((n[i]-vb.x)*U).toFixed(2),+((n[i+1]-vb.y)*U).toFixed(2)]);return p;}
const lmCen=r=>[+(r.x+r.w/2).toFixed(2),+(r.y+r.h/2).toFixed(2)];
function conv({id,name,vb,body,source,meta}){const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})">${body}</g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS}${art}</svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.map(n=>+(+n).toFixed(2))]));

const vbC={x:-(SVX+4.0+0.4),y:-0.9,w:2*(SVX+4.0+0.4),h:CUFF_BOT+1.9};
const body=garment()+sleeveView(-1)+sleeveView(1),LM={};
{const R=(k,id)=>{const r=lmRect(body,id,vbC);if(r)LM[k]=r;},Pg=(k,id)=>{const p=lmPoly(body,id,vbC);if(p)LM[k]=p;};
 R('name_tape','name-tape');R('patch_command_right_breast','command-patch-zone');R('es_patch_zone','es-patch-zone');
 R('grade_zone_left','grade-zone-left');R('grade_zone_right','grade-zone-right');R('grade_zone_go_left','grade-zone-go-left');R('grade_zone_go_right','grade-zone-go-right');
 R('patch_flag_left','patch-flag-left');R('patch_loop_square_right','patch-loop-right');R('sleeve_pocket_left','sleeve-pocket-body-left');R('pen_pocket_left','pen-pocket-left');
 for(const t of ['right','left'])Pg('flap_pocket_'+t,'flap-pocket-'+t),Pg('cuff_'+t,'cuff-'+t);
 Pg('front_zipper','front-zipper');Pg('waistband','waistband');Pg('collar','collar');}
const A=std(vbC.w*U,vbC.h*U),cxU=-vbC.x*U;
Object.assign(A,{zipper_min_closed:[cxU,((4.6+WB_BOT)/2-vbC.y)*U],centerline_top:[cxU,(0-vbC.y)*U],zip_top:[cxU,(4.6-vbC.y)*U],hem_center:[cxU,(WB_BOT-vbC.y)*U],
  name_tape_center:lmCen(LM.name_tape),command_patch_center:lmCen(LM.patch_command_right_breast),es_patch_center:lmCen(LM.es_patch_zone),
  flag_left_center:lmCen(LM.patch_flag_left),loop_square_right_center:lmCen(LM.patch_loop_square_right)});
conv({id:BL?'garment-flight-jacket-blue':'garment-flight-jacket-green',name:BL?'CAP blue flight jacket (worn with the CFDU) with blank nametag':'CAP green flight jacket (MA-1 / CWU-36/P / CWU-45/P) with blank nametag',vb:vbC,body,source:'reference-art-measured',
  meta:{size_source:BL?'estimated':'regulation',
    ...(BL?{size_basis:'CAPR 39-1 6.1.7 says the blue flight jacket is "similar to the MA-1 or CWU-45/P or -36/P flight jackets in design and construction" (Figure 6.6 shows it: navy, orange lining, gold zipper, knit collar/waist/cuffs, left sleeve pocket). The MIL-J-8279G size Medium dimensions of the MA-1 are carried over: an ASSUMPTION that the blue jacket is cut to the same finished measurements.'}
         :{size_citation:'MIL-J-8279G, Military Specification: Jacket, Cold Weather (type MA-1), 18 Mar 1988, Table V p. 19 (finished measurements, size Medium) and Table IV pp. 7-9 (pocket flap, pocket, cigarette/pencil pocket); read from the page images.',
           size_basis:'Medium: back length 22 1/2, 1/2 chest 26, 1/2 bottom 23 1/2, sleeve inseam 16 3/8 in; flap 7 1/2 x 2 3/8 in; cigarette pocket 5 3/4 x 3 1/4 in. Not given by the spec and therefore ESTIMATED: collar and knit heights, armhole depth, shoulder width, sleeve girth, flap lean, patch positions on the chest. Shape follows CAPR 39-1 Figure 8.3.'}),
    dimension_sources:{back_length_in:BL?'assumed (MA-1 Medium)':'regulation MIL-J-8279G Table V',half_chest_in:BL?'assumed (MA-1 Medium)':'regulation MIL-J-8279G Table V',half_bottom_in:BL?'assumed (MA-1 Medium)':'regulation MIL-J-8279G Table V',sleeve_inseam_in:BL?'assumed (MA-1 Medium)':'regulation MIL-J-8279G Table V',flap_in:BL?'assumed':'regulation MIL-J-8279G Table IV op. 3',sleeve_pocket_in:BL?'assumed':'regulation MIL-J-8279G Table IV op. 6',nametag_in:'regulation CAPR 39-1 8.2.4.1',flag_in:'regulation CAPR 39-1 8.2.4.4',loop_square_in:'regulation CAPR 39-1 8.2.5.5',knit_heights_collar_armhole_shoulder_sleeve_girth:'estimated',command_patch_width:'estimated'},
    flag:{side:'wearer\'s left sleeve (image right)',drawn:'in the garment image (flat sleeve view and, clipped to the arm, the front view)',size_in:[3.5,2.0],border:'gold',position:'1/2 in below the shoulder seam',orientation:'normal: canton (union) toward the wearer\'s front / the viewer\'s left on the outer face of the left sleeve; the reversed flag is for the right sleeve, which this reg does not give a flag',basis:'CAPR 39-1 8.2.4.4 / 8.3.4.4 (left sleeve only); orientation convention per DAFI 36-2903 (flag worn so the union leads forward; reversed on the right shoulder)',loop_tape_left:'not drawn: the 3 1/2 in loop tape on the left is the same colour as the garment and invisible',loop_square_right:'drawn as the right-sleeve patch slot (8.2.5.5 / 8.3.5.5)'},
    anchors:r2(A),landmarks:LM,optional_landmarks:{pen_pocket_left:'cigarette/pencil pocket on the left sleeve (MA-1 spec)',es_patch_zone:'optional patch; the jacket is configured like the FDU/CFDU (8.2.7.1 / 6.1.7)',grade_zone_go_left:'general officers only (8.2.3.1 / 8.3.3.1)',grade_zone_go_right:'general officers only',grade_zone_left:'officers only (8.2.3.2 / 8.3.3.2 / 6.1.7); NCOs and cadets wear no grade',grade_zone_right:'officers only'},zipper_note:'8.2.7.1: flight jackets are required to be zipped at least halfway; anchors.zipper_min_closed is that height. The artwork shows it fully closed.',views_note:'Front view plus a flat view of each sleeve (flag and pocket on the left, loop-tape slot on the right), as for the FDU; a presentation decision, not a regulation requirement.',landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; user units (0.01 in), origin top-left of the artwork box. Right/left = wearer\'s. Zones with no artwork are invisible placement landmarks.',
    dimensions:{collar_to_waistband_in:WB_BOT,collar_to_cuff_in:CUFF_BOT,max_width_in:+(2*18.6).toFixed(2),size_nominal:'Medium',half_chest_in:HC*1,half_bottom_in:HB,back_length_in:BACK_LEN,sleeve_inseam_in:INSEAM,flap_in:[FLAP.L,FLAP.W],sleeve_pocket_in:[5.75,3.25],nametag_in:[PATCH.nametag.w,PATCH.nametag.h],flag_in:[PATCH.flag.w,PATCH.flag.h],loop_square_in:[PATCH.loopSquare.w,PATCH.loopSquare.h]},
    documented:BL?['blue flight jacket is an authorized outer garment with the CFDU (8.3.7) and is similar to the MA-1 / CWU-45/P / CWU-36/P in design and construction (6.1.7, Figure 6.6)','nametag (black leather or blue cloth) on the left breast, CAP Command Patch on the right breast, other CFDU patches optional (6.1.7)','accoutrements follow the CFDU: Command Patch right breast opposite the nametag, US flag 2 x 3 1/2 in on the left sleeve 1/2 in below the seam, authorized patch on a 3 1/2 x 3 1/2 in square of black loop tape on the right sleeve (8.3.4, 8.3.5.5)','grade for officers on top of each shoulder, bottom edge 1/2 in from the seam; general officer stars centred on the shoulder halfway between neck and seam (8.3.3.1, 8.3.3.2)']:['green flight jacket (MA-1, CWU-36/P, CWU-45/P) is the only authorized outer garment with the FDU (8.2.7, Figure 8.3)','required zipped at least halfway','accoutrements configured like the FDU (8.2.7.1)','CAP Command Patch, US flag, grade (officers) and nametag are mandatory (8.2.7.1)','nametag 2 x 4 in on the wearer\'s left breast; CAP Command Patch on the right breast opposite it (8.2.4)','left sleeve flag 2 x 3 1/2 in with gold border, 1/2 in below the seam (8.2.4.4)','right sleeve: authorized patch on a 3 1/2 x 3 1/2 in loop square (8.2.4.5, 8.2.5.5)','officer grade centred on top of each shoulder (8.2.3.2)'],
    assumed:BL?['finished measurements of the blue jacket are not given: the green MA-1 Medium measurements are used (6.1.7 only says similar design and construction)','navy shade sampled from the Figure 6.6 illustration','knit band heights','collar and knit band heights, armhole depth, shoulder width, sleeve girth','ES patch zone position (jacket has no breast pocket)','command patch width']:['collar and knit band heights, armhole depth, shoulder width, sleeve girth (not in the spec table)','flap lean and pocket positions (from Figure 8.3)','ES patch zone position (jacket has no breast pocket)','command patch width','orange lining colour and sage-green shade','figure draws a round patch on the right sleeve; shown here as the loop square because 8.2.5.5 applies the FDU configuration'],
    fit:{method:'n/a',score:null},grade:'garment'}});
const sq=(inner,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS}${inner}</svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(body,vbC,BL?'flight_jacket_blue':'flight_jacket',1400);
console.log('ok jacket '+(BL?'blue':'green'));
