// USAF-style Flight Duty Uniform (FDU): olive-drab one-piece flight suit, front view, in real inches.
// Sources: CAPR 39-1 (3 Mar 2020) ch. 8, paras 8.2.2-8.2.5 and Figure 8.1 (construction only; no art is copied or traced).
// Documented sizes: nametag 2 x 4 in; flag 2 x 3 1/2 in with gold border, left sleeve 1/2 in below the shoulder seam;
// sleeve patch loop square 3 1/2 x 3 1/2 in (right sleeve); grade insignia on top of the shoulder, bottom edge 1/2 in from the seam.
// ESTIMATED: body/sleeve dimensions, pocket sizes and positions, command-patch and ES-patch zone sizes.
const fs=require('fs'),path=require('path');
// Emits both the USAF-style FDU (olive) and the Corporate FDU (CFDU, navy; CAPR 39-1 8.3, Figure 8.4 - same design, black loop tape and thread).
if(!process.env.FDU_VARIANT){for(const v of ['fdu','cfdu'])require('child_process').execSync(`node "${__filename}"`,{env:{...process.env,FDU_VARIANT:v},stdio:'inherit'});process.exit(0);}
const CF=process.env.FDU_VARIANT==='cfdu';
const commandPatch=require('./command-patch-art.js');
const f=n=>(+n).toFixed(3),STROKE=CF?'#080d18':'#2a2f20';
const FDU=CF?'#17304a':'#6e7a58',FDU_LOOP=CF?'#0c0d10':'#97a37d',ZIP=CF?'#c3c9d2':'#aeb29f',TEETH=CF?'#1a2438':'#5d6350',NAVY=CF?'#0e1014':'#142347',SILVER='#c4c8cf';
// SCALE: Figure 8.1 is drawn so that its front zipper is 591 px long at 25.55 px/in (23.13 in). MIL-C-83141A(USAF) Table II gives the
// front opening of size 40R as 28 in, so the whole suit is scaled by KF = 28 / 23.13. All geometry below is in 'figure inches' and is
// multiplied by KF at output (see BODY); patch sizes are documented TRUE inches, so they are stored divided by KF.
const KF=28/((828-237)/25.55);
const TRUE={flag:{w:3.5,h:2.0},nametag:{w:4.0,h:2.0},loopSquare:{w:3.5,h:3.5},command:{w:3.0,h:commandPatch('x',0,0,3.0).h},es:{w:3.0,h:3.0},grade:{w:1.6,h:1.25},go:{w:2.2,h:1.2}};   // grade: largest officer form (colonel eagle 1.59 w, captain bars 1.25 h); go: two 1 in stars side by side, cloth-bordered (2.15 x 1.15), assets/insignia rank-senior-*
const PATCH=Object.fromEntries(Object.entries(TRUE).map(([k,v])=>[k,{w:v.w/KF,h:v.h/KF}]));
const SLP={flagTop:0.5/KF,pocketTop:3.5,pocket:{w:2.4/KF,h:5.5/KF},pen:{w:0.95/KF,h:3.6/KF}};   // sleeve pocket: zipper 4 3/4 in (Table II), pocket size ESTIMATED   // sleeve layout, measured down from the sleeve-top seam
const HEM=31.0,CUFFY=29.75,APEX=5.6,CUFFH=2.15;
// Outer half-width of the suit (body + sleeves) down the front, measured off the CAPR 39-1 Figure 8.1 outline
// (figure height collar-tip to hem = 40 in; 1 in = 25.55 figure px). [y from collar tips, half-width]
const OUTER=[[0,2.9],[0.6,3.8],[1.2,4.5],[1.76,6.2],[2.1,7.5],[2.35,8.3],[2.5,8.8],[3.0,9.8],[3.7,10.45],[4.5,10.85],[5.2,11.05],[5.9,11.2],[7.05,11.5],[8.2,11.75],[9.4,11.95],[10.5,12.1],[11.7,12.2],[14.1,12.35],[18.2,12.3],[21.1,12.2],[23.5,11.95],[25.8,11.8],[27.6,11.5],[CUFFY,11.3]];
// armhole seam, then the sleeve's inner edge down to the cuff (torso edge shows below the waist)
const INNER=[[2.35,8.2],[3.0,8.3],[4.2,8.15],[6.0,7.8],[8.0,7.55],[11,7.4],[15.7,7.4],[17.7,6.9],[19.4,6.6],[23,7.0],[26,7.5],[27.6,7.9],[CUFFY,7.75]];
const BODY_LOW=[[CUFFY,8.7],[HEM,8.45]];   // cut off just below the cuffs: nothing is sewn on the legs, so they are not drawn
const lerpY=(arr,y)=>{for(let i=0;i<arr.length-1;i++){const a=arr[i],b=arr[i+1];if(y>=a[0]&&y<=b[0])return a[1]+(b[1]-a[1])*(y-a[0])/((b[0]-a[0])||1);}return arr[arr.length-1][1];};
const SWING=0,dxS=y=>y<=8?0:SWING*Math.min(1,(y-8)/(CUFFY-8));   // sleeves lie against the torso, as in Figure 8.1
const outerX=y=>lerpY(OUTER,y)+dxS(y);
const TORSO=[[2.35,8.3],[6,8.7],[10,8.2],[15,7.9],[19.4,7.6],[24,8.0],[27.6,8.3],[CUFFY,8.7]];   // torso edge under the sleeves
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

const SVX=12.35+SWING+0.9+2.95,SVTOP=1.2;   // flat sleeve views sit beside the suit
function garment(){
  let g='';
  const Rs=OUTER.filter(([y])=>y<=2.35).map(([y,x])=>[x,y]),Ls=Rs.slice().reverse().map(([x,y])=>[-x,y]),
    RT=TORSO.slice(1).map(([y,x])=>[x,y]),LT=TORSO.slice(1).reverse().map(([y,x])=>[-x,y]),
    RB=BODY_LOW.slice(1).map(([y,x])=>[x,y]),LB=BODY_LOW.slice(1).reverse().map(([y,x])=>[-x,y]);
  const pp=a=>a.map(p=>`L${f(p[0])},${f(p[1])}`).join(' ');
  // torso silhouette: collar tip, V notch, collar tip, shoulder line, torso side (sleeves are separate pieces), hem
  const body=`M-2.9,0 L0,${APEX} L2.9,0 ${pp(Rs.slice(1))} ${pp(RT)} ${pp(RB)} ${pp(LB)} ${pp(LT)} ${pp(Ls.slice(0,Ls.length-1))} Z`;
  // CAP command scarf (CAPR 39-1 8.2.6, Figure 8.2): yellow with the red three-pronged motif, worn around the neck and tucked into the suit
  g+=`<defs><pattern id="scarfpat" patternUnits="userSpaceOnUse" width="0.9" height="0.9" patternTransform="rotate(-18)"><rect width="0.9" height="0.9" fill="#f1cf1c"/>`
    +[[0.22,0.22],[0.67,0.67]].map(([cx,cy])=>[-90,30,150].map(a=>{const r=a*Math.PI/180;return `<path d="M${f(cx)},${f(cy)} L${f(cx+0.2*Math.cos(r))},${f(cy+0.2*Math.sin(r))}" stroke="#c8321c" stroke-width=".07" stroke-linecap="round"/>`;}).join('')).join('')
    +`</pattern><linearGradient id="scarfShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity="0"/></linearGradient></defs>`;
  // crew-neck t-shirt shows in the V (the scarf is optional and is its own asset)
  g+=`<g id="tee"><path d="M-2.9,0 Q0,2.7 2.9,0 L0.1,${APEX} L-0.1,${APEX} Z" fill="${CF?'#1c1c20':'#c9b88e'}" stroke="${STROKE}" stroke-width=".05"/><path d="M-2.9,0 Q0,2.7 2.9,0" fill="none" stroke="${CF?'#0c0c0e':'#8d7d57'}" stroke-width=".16"/></g>`;
  g+=`<g id="garment-body"><path id="silhouette" d="${body}" fill="${FDU}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<clipPath id="clipBody"><path d="${body}"/></clipPath><g clip-path="url(#clipBody)"><rect x="-14" y="-2" width="28" height="44" fill="url(#shadeBody)"/><path d="${body}" fill="url(#shoulderLight)"/>`
    // chest yoke seam from the armhole across to the collar
    +`<path d="M-8.7,5.5 Q-6.6,4.6 -4.4,4.3 M8.7,5.5 Q6.6,4.6 4.4,4.3" fill="none" stroke="${CF?'#05080f':'#1d2216'}" stroke-opacity=".5" stroke-width=".07"/>`
    +`</g></g>`;
  // sleeves lie against the torso: outer edge = the silhouette, inner edge = armhole seam then the free edge below the waist
  for(const s of [-1,1]){const tag=s<0?'right':'left';
    const out=OUTER.filter(([y])=>y>=2.35).map(([y,x])=>[s*(x+dxS(y)),y]),inn=INNER.map(([y,x])=>[s*(x+dxS(y)),y]).reverse();
    const sd=P(out.concat(inn)),cuffTop=CUFFY-CUFFH,wo=outerX(cuffTop),wi=lerpY(INNER,cuffTop)+dxS(cuffTop);
    g+=`<g id="sleeve-${tag}"><clipPath id="clip-sleeve-${tag}"><path d="${sd}"/></clipPath>`
      +fab(sd,'sleeve-body-'+tag,0.08)
      +`<g clip-path="url(#clip-sleeve-${tag})"><path d="${sd}" fill="url(#shadeBox)"/>`
      +crease(`M${f(s*(wi+0.5))},${f(18.4)} Q${f(s*(wi+wo)/2)},${f(19.4)} ${f(s*(wo-0.4))},${f(18.5)}`)
      +`</g>`
      // cuff band with a closure tab
      +`<path id="cuff-${tag}" d="M${f(s*wi)},${f(cuffTop)} L${f(s*wo)},${f(cuffTop)} L${f(s*outerX(CUFFY))},${f(CUFFY)} L${f(s*(lerpY(INNER,CUFFY)+dxS(CUFFY)))},${f(CUFFY)} Z" fill="${FDU}" stroke="${STROKE}" stroke-width=".07"/>`
      +`<path d="M${f(s*(wi+0.2))},${f(cuffTop-0.1)} l${f(s*1.3)},0 l${f(s*0.45)},${f(0.85)} l${f(-s*1.75)},0 Z" fill="${FDU}" stroke="${STROKE}" stroke-width=".06"/></g>`;}
  // waist adjuster tabs, chest pockets with diagonal zips
  for(const s of [-1,1]){const tag=s<0?'right':'left',m=s;
    const pk=[[7.7,7.9],[1.85,12.3],[1.85,14.75],[7.32,14.75]].map(([x,y])=>[m*x,y]);
    g+=fab(P(pk),'chest-pocket-'+tag)
      +zipLine(m*7.4,8.4,m*(7.4-5.15*(6.5/KF)/6.49),8.4+3.95*(6.5/KF)/6.49)   // breast pocket zipper 6 1/2 in (MIL-C-83141A Table II)
      +fab(P([[1.8,17.4],[6.6,17.4],[6.6,18.4],[1.8,18.4]].map(([x,y])=>[m*x,y])),'waist-tab-'+tag,0.07);}
  // front zipper (exposed) with slider
  g+=`<path id="front-zipper" d="M-0.11,${APEX} L0.11,${APEX} L0.11,${APEX+28/KF} L-0.11,${APEX+28/KF} Z" fill="${ZIP}" stroke="${STROKE}" stroke-width=".04"/>`
    +`<path d="M0,${APEX+0.1} L0,${APEX+28/KF-0.1}" stroke="${TEETH}" stroke-width=".07" stroke-dasharray=".05 .06"/>`
    +`<rect x="-0.14" y="${f(APEX)}" width=".28" height=".55" fill="${TEETH}"/>`;
  // collar leaves: points at the top, outer edge rising from the shoulder line, inner edge along the V to the zipper apex (Figure 8.1)
  const leaf=[[2.9,0],[3.6,0.45],[4.25,0.95],[4.7,1.8],[4.55,2.9],[3.7,4.1],[2.1,5.1],[0.1,APEX+0.1],[0.1,APEX-0.15]];
  for(const q of [1,-1]){const tag=q<0?'right':'left';
    g+=`<path id="collar-${tag}" d="${P(leaf.map(([x,y])=>[q*x,y]))}" fill="${FDU}" stroke="${STROKE}" stroke-width=".07" stroke-linejoin="round"/>`
      +`<path d="M${f(q*3.3)},0.7 Q${f(q*4.0)},2.6 ${f(q*2.7)},4.5" stroke="#000" stroke-opacity=".16" stroke-width=".07" fill="none"/>`;}
  // shoulder grade zones (invisible landmarks). Officers: centred on top of the shoulder, outer edge 1/2 in from the shoulder seam (8.2.3.2 / 8.3.3.2).
  // General officers: 1 in stars centred on the shoulder halfway between the neck and the shoulder seam (8.2.3.1 / 8.3.3.1). NCOs/cadets: nothing (8.2.3.3).
  for(const s of [-1,1]){const tag=s<0?'right':'left';
    g+=`<rect id="grade-zone-${tag}" x="${f(s*(8.3-0.5/KF-PATCH.grade.w/2)-PATCH.grade.w/2)}" y="2.3" width="${PATCH.grade.w}" height="${PATCH.grade.h}" fill="#000" fill-opacity="0"><title>Officer grade insignia on top of the shoulder, outer edge 1/2 in from the shoulder seam (CAPR 39-1 8.2.3.2 / 8.3.3.2); blank placement zone</title></rect>`
      +`<rect id="grade-zone-go-${tag}" x="${f(s*6.5-PATCH.go.w/2)}" y="2.15" width="${f(PATCH.go.w)}" height="${f(PATCH.go.h)}" fill="#000" fill-opacity="0"><title>General officer stars (1 in, point-to-center; zone holds two 1 in stars side by side, cloth-bordered 2.2 x 1.2 in; the vertical pair rotates it), centred halfway between neck and shoulder seam (8.2.3.1 / 8.3.3.1); blank placement zone</title></rect>`;}
  // nametag on the wearer's left breast (image right), blank dark-blue cloth with silver border, 2 x 4 in (8.2.4.1, 8.2.5.2)
  const PCX=4.775;   // horizontal centre of the chest pocket panel (x 1.85..7.7): nametag and Command Patch are centred over it (8.2.4.1 / 8.2.4.2)
  const nt={x:PCX-PATCH.nametag.w/2,y:7.3-PATCH.nametag.h/2};
  g+=`<g id="name-tape"><rect x="${f(nt.x)}" y="${f(nt.y)}" width="${PATCH.nametag.w}" height="${PATCH.nametag.h}" fill="${NAVY}"/><rect x="${f(nt.x+0.07)}" y="${f(nt.y+0.07)}" width="${f(PATCH.nametag.w-0.14)}" height="${f(PATCH.nametag.h-0.14)}" fill="none" stroke="${SILVER}" stroke-width=".07"/><title>Nametag (blank): 2 x 4 in, wearer's left breast above the pocket</title></g>`;
  // command patch zone (wearer's right breast, directly opposite the nametag) and ES patch zone (below, centred on the pocket)
  // CAP Command (national) patch: always worn on the right breast, centred above the pocket opposite the nametag (8.2.4.2; table in ch. 10: RB on every uniform).
  // Traced from the regulation's own Command Patch figure (command-patch-art.js); width ESTIMATED, proportions exact.
  g+=commandPatch('patch-command',-PCX,7.3,PATCH.command.w).svg;
  g+=`<rect id="command-patch-zone" x="${f(-PCX-PATCH.command.w/2)}" y="${f(7.3-PATCH.command.h/2)}" width="${PATCH.command.w}" height="${PATCH.command.h}" fill="none"><title>CAP Command Patch placement area</title></rect>`
    +`<rect id="es-patch-zone" x="${f(-PCX-PATCH.es.w/2)}" y="${f(14.85)}" width="${PATCH.es.w}" height="${PATCH.es.h}" fill="#000" fill-opacity="0"><title>Optional Emergency Services patch, below and centred on the right breast pocket (8.2.4.3 / 8.3.4.3); top edge just under the pocket, over the waist tab; size ESTIMATED; blank placement zone</title></rect>`;
  // patches on the outer face of the upper arm, seen from the front (Figure 8.1): they sit on the outer part of the sleeve and run off its edge,
  // so each strip is clipped by the sleeve outline and tilted with the edge. Left sleeve: flag + zip pocket; right sleeve: the 3 1/2 in loop square.
  for(const s of [-1,1]){const tag=s<0?'right':'left';
    const strip=(y0,w,h,over,inner)=>{const yc=y0+h/2,th=Math.atan((outerX(yc+h/2)-outerX(yc-h/2))/h)*180/Math.PI,x1=outerX(yc)+over,x0=x1-w,
        X0=Math.min(s*x0,s*x1),tr=`rotate(${f(-s*th)} ${f(s*(x0+x1)/2)} ${f(yc)})`;
      return `<g clip-path="url(#clip-sleeve-${tag})"><g transform="${tr}">${inner(X0,y0,w,h)}<rect x="${f(X0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="url(#wrap${s<0?'L':'R'})"/></g></g>`;};
    if(tag==='left'){
      g+=`<g id="sleeve-front-flag-left">`+strip(2.5+0.5/KF,1.5,PATCH.flag.h,0.3,(x,y,w,h)=>{const u=w-0.14,st=(h-0.14)/13;
        return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${h}" fill="#c9a227"/><rect x="${f(x+0.07)}" y="${f(y+0.07)}" width="${f(u)}" height="${f(h-0.14)}" fill="#fff"/>`
          +[0,2,4,6,8,10,12].map(i=>`<rect x="${f(x+0.07)}" y="${f(y+0.07+i*st)}" width="${f(u)}" height="${f(st)}" fill="#b22234"/>`).join('')
          +`<rect x="${f(x+0.07)}" y="${f(y+0.07)}" width="${f(u*0.4)}" height="${f(st*7)}" fill="#3c3b6e"/>`;})+`</g>`;
      g+=`<g id="sleeve-front-pocket-left">`+strip(8.2,SLP.pocket.w,SLP.pocket.h,0.15,(x,y,w,h)=>`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${FDU}" stroke="${STROKE}" stroke-width=".07"/>`
        +zipLine(x+0.35,y+0.35,x+0.35,y+0.35+4.75/KF,0.12)+`<rect x="${f(x+w-0.8)}" y="${f(y+0.35)}" width=".6" height="${f(h-1.0)}" fill="${FDU}" stroke="${STROKE}" stroke-width=".05"/>`)+`</g>`;
    } else {
      g+=`<g id="sleeve-front-loop-right">`+strip(2.5+0.5/KF,1.5,PATCH.loopSquare.h,0.3,(x,y,w,h)=>`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${FDU_LOOP}" stroke="${STROKE}" stroke-width=".07"/><rect x="${f(x+0.18)}" y="${f(y+0.18)}" width="${f(Math.max(w-0.36,0.1))}" height="${f(h-0.36)}" fill="none" stroke="${TEETH}" stroke-width=".05" stroke-dasharray=".14 .1"/>`)+`</g>`;
    }}
  return g;}

// ---------- flat sleeve views beside the suit ----------
function sleeveView(s){
  const tag=s<0?'right':'left',cx=s*SVX,top=SVTOP;
  const T=[[0,5.6],[6,5.6],[13,5.0],[23,4.3],[CUFFY-2.94,4.2]],W=l=>{for(let i=0;i<T.length-1;i++)if(l<=T[i+1][0])return T[i][1]+(T[i+1][1]-T[i][1])*(l-T[i][0])/(T[i+1][0]-T[i][0]);return T[T.length-1][1];};
  const len=CUFFY-2.94,ls=[];for(let l=0;l<len;l+=0.5)ls.push(l);ls.push(len);
  const Rt=ls.map(l=>[cx+W(l)/2,top+l]),Lt=ls.map(l=>[cx-W(l)/2,top+l]).reverse();
  const sd=`M${f(Lt[Lt.length-1][0])},${f(top)} Q${f(cx)},${f(top-1.0)} ${f(Rt[0][0])},${f(top)} `+Rt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' '+Lt.map(q=>'L'+f(q[0])+','+f(q[1])).join(' ')+' Z';
  const cuffTop=top+len-CUFFH;
  let g=`<g id="sleeve-view-${tag}"><clipPath id="clip-sv-${tag}"><path d="${sd}"/></clipPath><path id="sleeve-view-body-${tag}" d="${sd}" fill="${FDU}" stroke="${STROKE}" stroke-width=".09" stroke-linejoin="round"/>`
    +`<g clip-path="url(#clip-sv-${tag})"><path d="${sd}" fill="url(#shadeBox)"/>`
    +crease(`M${f(cx-W(15)/2+0.4)},${f(top+14.6)} Q${f(cx)},${f(top+15.6)} ${f(cx+W(15)/2-0.4)},${f(top+14.5)}`)
    +`<rect id="cuff-flat-${tag}" x="${f(cx-W(len)/2-.3)}" y="${f(cuffTop)}" width="${f(W(len)+.6)}" height="${CUFFH}" fill="${FDU}" stroke="${STROKE}" stroke-width=".07"/></g>`;
  if(tag==='left'){
    g+=flagPatch('patch-flag-left',cx-PATCH.flag.w/2,top+SLP.flagTop,PATCH.flag.w,PATCH.flag.h,false);
    const px=cx-0.5-SLP.pocket.w/2+0.5,py=top+SLP.pocketTop;
    g+=`<g id="sleeve-pocket-left"><title>Left sleeve zip pocket with pen pocket (Figure 8.1); size ESTIMATED</title>`
      +`<rect id="sleeve-pocket-body-left" x="${f(cx-SLP.pocket.w/2)}" y="${f(py)}" width="${SLP.pocket.w}" height="${SLP.pocket.h}" fill="${FDU}" stroke="${STROKE}" stroke-width=".08"/>`
      +zipLine(cx-SLP.pocket.w/2+0.4,py+0.35,cx-SLP.pocket.w/2+0.4,py+0.35+4.75/KF,0.14)
      +`<rect id="pen-pocket-left" x="${f(cx+SLP.pocket.w/2-SLP.pen.w-0.15)}" y="${f(py+0.4)}" width="${SLP.pen.w}" height="${SLP.pen.h}" fill="${FDU}" stroke="${STROKE}" stroke-width=".06"/></g>`;
  } else {
    g+=`<rect id="patch-loop-right" x="${f(cx-PATCH.loopSquare.w/2)}" y="${f(top+0.5)}" width="${PATCH.loopSquare.w}" height="${PATCH.loopSquare.h}" fill="${FDU_LOOP}" stroke="${STROKE}" stroke-width=".07"><title>3 1/2 x 3 1/2 in OD green loop tape for a sleeve patch (8.2.5.5); position ESTIMATED</title></rect>`
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
  return {x:+((+at.x*KF-vb.x)*U).toFixed(2),y:+((+at.y*KF-vb.y)*U).toFixed(2),w:+(at.width*KF*U).toFixed(2),h:+(at.height*KF*U).toFixed(2)};}
function lmPoly(svg,id,vb){const e=el(svg,id);if(!e)return null;const n=e.at.d.match(/-?\d*\.?\d+/g).map(Number),p=[];
  for(let i=0;i+1<n.length;i+=2)p.push([+((n[i]*KF-vb.x)*U).toFixed(2),+((n[i+1]*KF-vb.y)*U).toFixed(2)]);return p;}
const lmCen=r=>[+(r.x+r.w/2).toFixed(2),+(r.y+r.h/2).toFixed(2)];
function conv({id,name,vb,body,source,meta}){const W=vb.w,H=vb.h,Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2);
  const art=`<g id="art" transform="translate(${f(-vb.x*U)} ${f(-vb.y*U)}) scale(${U})"><g transform="scale(${KF.toFixed(5)})">${body}</g></g>`;
  const m={asset_id:id,name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],...meta};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${id}" data-source="${source}" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${DEFS}${art}</svg>`;
  svg=nsIds(svg,id);fs.writeFileSync(path.join(OUTDIR,id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,id+'.spec.json'),JSON.stringify(m,null,1));return svg;}
const std=(W,H)=>({top_center:[W/2,0],bottom_center:[W/2,H],center:[W/2,H/2],left_edge:[0,H/2],right_edge:[W,H/2]});
const r2=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.map(n=>+(+n).toFixed(2))]));

const vbC={x:-(SVX+3.2+0.3)*KF,y:-2.2*KF,w:2*(SVX+3.2+0.3)*KF,h:(HEM+3.0)*KF};
const body=garment()+sleeveView(-1)+sleeveView(1),LM={};
{const R=(k,id)=>{const r=lmRect(body,id,vbC);if(r)LM[k]=r;},Pg=(k,id)=>{const p=lmPoly(body,id,vbC);if(p)LM[k]=p;};
 R('name_tape','name-tape');R('patch_command_right_breast','command-patch-zone');R('es_patch_zone','es-patch-zone');
 R('grade_zone_left','grade-zone-left');R('grade_zone_right','grade-zone-right');R('grade_zone_go_left','grade-zone-go-left');R('grade_zone_go_right','grade-zone-go-right');
 R('patch_flag_left','patch-flag-left');R('patch_loop_square_right','patch-loop-right');R('sleeve_pocket_left','sleeve-pocket-body-left');R('pen_pocket_left','pen-pocket-left');
 for(const t of ['right','left']){Pg('chest_pocket_'+t,'chest-pocket-'+t);Pg('waist_tab_'+t,'waist-tab-'+t);Pg('cuff_'+t,'cuff-'+t);}
 Pg('front_zipper','front-zipper');}
const A=std(vbC.w*U,vbC.h*U),cxU=-vbC.x*U;
Object.assign(A,{zipper_min_closed:[cxU,(7.3*KF-vbC.y)*U],centerline_top:[cxU,(0-vbC.y)*U],collar_apex:[cxU,(APEX*KF-vbC.y)*U],hem_center:[cxU,(HEM*KF-vbC.y)*U],
  name_tape_center:lmCen(LM.name_tape),command_patch_center:lmCen(LM.patch_command_right_breast),es_patch_center:lmCen(LM.es_patch_zone),
  flag_left_center:lmCen(LM.patch_flag_left),loop_square_right_center:lmCen(LM.patch_loop_square_right)});
const id=CF?'garment-cfdu-flight-suit':'garment-fdu-flight-suit';
conv({id,name:CF?'Corporate Flight Duty Uniform (CFDU, navy) with blank nametag':'USAF-style Flight Duty Uniform (FDU) with blank nametag',vb:vbC,body,source:'reference-art-measured',
  meta:{size_source:'estimated',
    size_citation:'MIL-C-83141A(USAF), Coveralls, Flyer\'s, CWU-27/P, 8 Aug 1974, Table II (length of slide fasteners), pp. 6-7, read from the page images: size 40R front opening 28 in, breast pockets 6-1/2, left sleeve pocket 4-3/4.',
    size_basis:'Shape follows CAPR 39-1 Figure 8.1. The whole figure is scaled so that its front zipper (591 px at 25.55 px/in = 23.13 in) equals the 28 in front-opening slide fastener of a 40R coverall: scale factor '+KF.toFixed(3)+'. This is ONE linear constraint, not a pattern measurement: the spec has no finished body table, and the figure is stylised (its pockets are larger than the spec zipper lengths imply, so pocket zippers are drawn at 6.5 in and 4.75 in and the pocket panels are estimates). Nominal size 40R, chosen to match the MA-1 jacket Medium. The suit is a top only, cut about 37.5 in below the collar tips.',
    flag:{side:'wearer\'s left sleeve (image right)',drawn:'in the garment image (flat sleeve view and, clipped to the arm, the front view)',size_in:[3.5,2.0],border:'gold',position:'1/2 in below the shoulder seam',orientation:'normal: canton (union) toward the wearer\'s front / the viewer\'s left on the outer face of the left sleeve; the reversed flag is for the right sleeve, which this reg does not give a flag',basis:'CAPR 39-1 8.2.4.4 / 8.3.4.4 (left sleeve only); orientation convention per DAFI 36-2903 (flag worn so the union leads forward; reversed on the right shoulder)',loop_tape_left:'not drawn: the 3 1/2 in loop tape on the left is the same colour as the garment and invisible',loop_square_right:'drawn as the right-sleeve patch slot (8.2.5.5 / 8.3.5.5)'},
    anchors:r2(A),landmarks:LM,optional_landmarks:{pen_pocket_left:'pen/pencil pocket cover may be removed (8.1.2.5)',es_patch_zone:'optional patch (8.2.4.3 / 8.3.4.3)',grade_zone_go_left:'general officers only (8.2.3.1 / 8.3.3.1)',grade_zone_go_right:'general officers only',grade_zone_left:'officers only (8.2.3.2 / 8.3.3.2); NCOs and cadets wear no grade (8.2.3.3 / 8.3.3.3)',grade_zone_right:'officers only'},zipper_note:'8.1.2.4: the centerline zipper is closed to no lower than the middle of the nametag; anchors.zipper_min_closed is that height. The artwork shows it fully closed.',views_note:'Front view plus a flat view of each sleeve: the figures (8.1, 8.3) foreshorten the sleeve patches, and 8.2.4.4 / 8.2.5.5 fix their sizes on the sleeve, so the flat views carry the true-size flag, pocket and loop-tape slot for placement. Decision, not a regulation requirement.',landmarks_note:'rects are {x,y,w,h}; polygons are [[x,y]...]; user units (0.01 in), origin top-left of the artwork box. Right/left = wearer\'s. Zones with no artwork are invisible placement landmarks.',
    dimensions:{collar_to_hem_in:+(HEM*KF).toFixed(2),max_width_in:+(2*(12.35+SWING)*KF).toFixed(2),front_opening_zipper_in:28,breast_pocket_zipper_in:6.5,sleeve_pocket_zipper_in:4.75,nametag_in:[TRUE.nametag.w,TRUE.nametag.h],flag_in:[TRUE.flag.w,TRUE.flag.h],loop_square_in:[TRUE.loopSquare.w,TRUE.loopSquare.h],scale_factor_from_figure:+KF.toFixed(4)},
    documented:[(CF?'navy blue one-piece suit, Nomex or cotton-polyester, of similar design to the USAF-style FDU (8.3.2, Figure 8.4)':'olive drab Nomex one-piece suit (8.2.2)'),(CF?'nametag 2 x 4 in over the left breast pocket, on a 2 x 4 in piece of black loop tape sewn with black thread (8.3.4.1, 8.3.5.2)':'nametag 2 x 4 in over the left breast pocket, on a 2 x 4 in loop tape (8.2.4.1, 8.2.5.2)'),'CAP Command Patch centred above the right breast pocket, opposite the nametag (8.2.4.2)','optional ES patch below/centred on the right breast pocket (8.2.4.3)','left sleeve: US flag 2 x 3 1/2 in with gold border, 1/2 in below the seam (8.2.4.4)',(CF?'right sleeve: authorized patch on a 3 1/2 x 3 1/2 in square of black loop tape (8.3.4.5, 8.3.5.5)':'right sleeve: authorized patch on a 3 1/2 x 3 1/2 in loop square (8.2.4.5, 8.2.5.5)'),'officer grade on top of each shoulder, bottom edge 1/2 in from the seam (8.2.3.2)','CAP Command Patch drawn on the right breast, centred above the pocket opposite the nametag (8.2.4.2)'],
    assumed:['overall scale from ONE constraint (front opening 28 in, size 40R); widths and lengths otherwise follow the stylised figure','pocket panel sizes and positions (from Figure 8.1); only their zipper lengths are specified (6 1/2 in breast, 4 3/4 in sleeve)','command patch size and simplified art','ES patch zone size','scarf is optional: its own asset (garment-cap-command-scarf), anchored bottom_center to this suit\'s collar_apex','legs and thigh pockets omitted (nothing is sewn on them); hem cut just below the cuffs',CF?'navy shade (Figure 8.4 is a small low-contrast figure)':'OD green shade'],
    fit:{method:'n/a',score:null},grade:'garment'}});
if(!CF){ // ---------- the optional CAP command scarf: its own asset, placed so that its `suit_apex` anchor sits on the suit's `collar_apex` ----------
{const band=q=>`M${f(q*3.0)},0.2 L${f(q*1.7)},0.2 L${f(q*0.25)},3.6 L${f(-q*0.45)},5.0 L${f(-q*0.1)},${APEX} L${f(q*0.1)},${APEX} Z`;
  const pat=`<pattern id="scarfpat" patternUnits="userSpaceOnUse" width="0.9" height="0.9" patternTransform="rotate(-18)"><rect width="0.9" height="0.9" fill="#f1cf1c"/>`
    +[[0.22,0.22],[0.67,0.67]].map(([cx,cy])=>[-90,30,150].map(a=>{const r=a*Math.PI/180;return `<path d="M${f(cx)},${f(cy)} L${f(cx+0.2*Math.cos(r))},${f(cy+0.2*Math.sin(r))}" stroke="#c8321c" stroke-width=".07" stroke-linecap="round"/>`;}).join('')).join('')+`</pattern>`;
  const body=`<defs>${pat}</defs><g id="scarf">`+[-1,1].map(q=>`<path id="scarf-band-${q<0?'right':'left'}" d="${band(q)}" fill="url(#scarfpat)" stroke="${STROKE}" stroke-width=".06" stroke-linejoin="round"/>`).join('')+`</g>`;
  const vb={x:-3.3*KF,y:0.1*KF,w:6.6*KF,h:(APEX-0.1+0.2)*KF},Ws=vb.w*U,Hs=vb.h*U,As=std(Ws,Hs);
  Object.assign(As,{suit_apex:[Ws/2,(APEX*KF-vb.y)*U]});
  conv({id:'garment-cap-command-scarf',name:'CAP command scarf (optional; worn with the FDU and CFDU)',vb,body,source:'reference-art-measured',
    meta:{size_source:'estimated',size_basis:'Two bands lying along the FDU collar V and crossing where they are tucked in; sized to the suit\'s collar opening. CAPR 39-1 8.2.6 / Figure 8.2 give no dimensions. Motif is an original simplified three-pronged mark, not traced.',
      anchors:r2(As),landmarks:{},landmarks_note:'Optional accessory. Place so anchors.suit_apex coincides with the suit\'s anchors.collar_apex (both in the same inch scale).',
      dimensions:{width_in:+vb.w.toFixed(2),height_in:+vb.h.toFixed(2)},documented:['yellow and red CAP command scarf is authorized with the FDU (8.2.6) and CFDU (8.3.6), worn around the neck and tucked into the flight suit'],
      assumed:['band width and cross position','motif drawing','size'],fit:{method:'n/a',score:null},grade:'garment'}});}}
// preview
const sq=(inner,vb,name,px)=>{const cx=vb.x+vb.w/2,cy=vb.y+vb.h/2,s=Math.max(vb.w,vb.h);
  const x=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx-s/2} ${cy-s/2} ${s} ${s}" width="${px}" height="${px}">${DEFS}<g transform="scale(${KF})">${inner}</g></svg>`;
  const tmp=path.join(here,name+'.sq.svg');fs.writeFileSync(tmp,x);
  require('child_process').execSync(`qlmanage -t -s ${px} -o "${here}" "${tmp}" >/dev/null 2>&1 && mv "${tmp}.png" "${path.join(here,name+'_preview.png')}" && rm "${tmp}"`);};
sq(body,vbC,CF?'cfdu_suit':'fdu_suit',1400);
console.log('ok '+(CF?'cfdu':'fdu'));
