// Colonel eagle: silhouette + structure lines from the CAPR 39-1 Fig A5-1 Colonel sleeve raster (3x render, ~93 px native eagle).
// usage: node eagle-detail.js p161.png out.json      (crop X0,Y0 below are the Colonel tile of the 3672 px page render)
// 1. silhouette: light mask (L>126), gaussian 1.4, iso-0.5 contour, RDP, 2x Chaikin.
// 2. body: horizontal gaps from the valley profile (b1-b2 minima at crop y 53 and 69); stripes below, evenly spaced.
// 3. wings: lines from the shoulder to the reflex vertices (feather notches) found on the unsmoothed contour.
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,OUTF]=process.argv;
const X0=2240,Y0=1200,W=275,H=160,d=dec(SRC);
const L=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=d.px(X0+x,Y0+y);L[y*W+x]=0.3*p[0]+0.59*p[1]+0.11*p[2];}
const blur=(a,s)=>{const r=Math.ceil(s*3),k=[];let ks=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*s*s));k.push(v);ks+=v;}
  const t=new Float32Array(W*H),o=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s2=0;for(let i=-r;i<=r;i++)s2+=k[i+r]*a[y*W+Math.min(W-1,Math.max(0,x+i))];t[y*W+x]=s2/ks;}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s2=0;for(let i=-r;i<=r;i++)s2+=k[i+r]*t[Math.min(H-1,Math.max(0,y+i))*W+x];o[y*W+x]=s2/ks;}return o;};
const M=new Float32Array(W*H);for(let i=0;i<W*H;i++)M[i]=L[i]>126&&L[i]<236?1:0;
// drop the page-white / tile-edge regions: keep only the 4-connected component containing the body centre
{const seen=new Uint8Array(W*H),st=[[140,70]],keep=new Uint8Array(W*H);
 while(st.length){const [x,y]=st.pop();if(x<0||y<0||x>=W||y>=H)continue;const i=y*W+x;if(seen[i]||!M[i])continue;seen[i]=1;keep[i]=1;st.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);}
 for(let i=0;i<W*H;i++)M[i]=keep[i];}
// the arrows (left talon) and olive branch (right talon) are merged blobs in the 93 px source: cut them and rebuild them as individual shapes below
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if((x<110&&y>101)||(x>166&&y>103))M[y*W+x]=0;
const F=blur(M,1.4);
// marching squares (same scheme as mask-trace.js)
function contours(f){const PW=W+2,PH=H+2,G=new Float32Array(PW*PH);for(let y=0;y<H;y++)for(let x=0;x<W;x++)G[(y+1)*PW+x+1]=f[y*W+x];
  const segs=[],ek=(t,x,y)=>t+':'+x+':'+y,val=(x,y)=>G[y*PW+x];
  const pt=(x0,y0,x1,y1)=>{const a=val(x0,y0),b=val(x1,y1),t=(0.5-a)/(b-a);return [x0+(x1-x0)*t-1+0.5,y0+(y1-y0)*t-1+0.5];};
  for(let y=0;y<PH-1;y++)for(let x=0;x<PW-1;x++){const a=val(x,y)>=0.5,b=val(x+1,y)>=0.5,c=val(x+1,y+1)>=0.5,dd=val(x,y+1)>=0.5,idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
    const T={k:ek('h',x,y),p:()=>pt(x,y,x+1,y)},R={k:ek('v',x+1,y),p:()=>pt(x+1,y,x+1,y+1)},B={k:ek('h',x,y+1),p:()=>pt(x,y+1,x+1,y+1)},Lf={k:ek('v',x,y),p:()=>pt(x,y,x,y+1)};
    const add=(p,q)=>segs.push([p,q]);
    switch(idx){case 1:add(Lf,B);break;case 2:add(B,R);break;case 3:add(Lf,R);break;case 4:add(T,R);break;case 5:add(T,Lf);add(B,R);break;case 6:add(T,B);break;case 7:add(T,Lf);break;
      case 8:add(T,Lf);break;case 9:add(T,B);break;case 10:add(T,R);add(Lf,B);break;case 11:add(T,R);break;case 12:add(Lf,R);break;case 13:add(B,R);break;case 14:add(Lf,B);break;}}
  const mp=new Map();segs.forEach((s,i)=>{for(const e of s){if(!mp.has(e.k))mp.set(e.k,[]);mp.get(e.k).push(i);}});
  const used=new Uint8Array(segs.length),loops=[];
  for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const loop=[segs[i][0].p(),segs[i][1].p()];let last=segs[i][1].k;
    for(;;){const nx=(mp.get(last)||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx],e=s[0].k===last?s[1]:s[0];loop.push(e.p());last=e.k;}
    loops.push(loop);}return loops;}
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
const raw=contours(F).filter(l=>Math.abs(area(l))>60).sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
const sil=raw[0];
// resample the silhouette evenly (0.8 px), then reflex-vertex detection by turning angle over +-4 px arcs
const resample=(P,step)=>{const out=[];let acc=0,prev=P[0];out.push(prev);for(let i=1;i<=P.length;i++){const q=P[i%P.length];let dx=q[0]-prev[0],dy=q[1]-prev[1],dl=Math.hypot(dx,dy);while(acc+dl>=step){const t=(step-acc)/dl;prev=[prev[0]+dx*t,prev[1]+dy*t];out.push(prev);dx=q[0]-prev[0];dy=q[1]-prev[1];dl=Math.hypot(dx,dy);acc=0;}acc+=dl;prev=q;}return out;};
const R=resample(sil,0.8),n=R.length,sgn=Math.sign(area(R));
const turn=i=>{const k=6,a=R[(i-k+n)%n],b=R[i],c=R[(i+k)%n];const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]];return Math.atan2(v1[0]*v2[1]-v1[1]*v2[0],v1[0]*v2[0]+v1[1]*v2[1])*sgn;};
const notches=[];
for(let i=0;i<n;i++){const t=turn(i);if(t<-0.55){ // reflex (concave) vertex
  let best=true;for(let j=-8;j<=8;j++)if(turn((i+j+n)%n)<t-1e-9){best=false;break;}
  if(best){const p=R[i];if(!notches.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<7))notches.push(p);}}}
const xs=sil.map(q=>q[0]),ys=sil.map(q=>q[1]),bx0=Math.min(...xs),bx1=Math.max(...xs),by0=Math.min(...ys),by1=Math.max(...ys);
const cx=(bx0+bx1)/2;
// body edges at a row: leftmost / rightmost silhouette crossings nearest the centre
const rowEdges=y=>{let l=cx,r=cx;while(F[Math.round(y)*W+Math.round(l)]>0.5&&l>0)l--;while(F[Math.round(y)*W+Math.round(r)]>0.5&&r<W-1)r++;return [l,r];};
const lines=[];
// body: two horizontal gaps (valley minima at y=53 and y=69), stripes in the lower shield
for(const [y,hw] of [[53,27],[69,29]])lines.push([[cx-hw,y],[cx+hw,y]]);   // body half-width at the two band gaps (valley minima), read from the valley map
{const y0=72,y1=by1-9,l=cx-30,r=cx+30;const nst=6;for(let i=1;i<=nst;i++){const x=l+(r-l)*i/(nst+1);lines.push([[x,y0],[x,Math.min(y1,y1-Math.abs(x-cx)*0.25)]]);}}
// wings: two covert / secondary row separators following the wing between its leading edge (top) and trailing edge (bottom),
// then feather separations from each trailing-edge notch up to the lower row separator
const colRun=x=>{let y=0;while(y<H&&F[y*W+x]<=0.5)y++;if(y>=H)return null;let y1=y;while(y1<H&&F[y1*W+x]>0.5)y1++;return [y,y1-1];};
const lower={L:null,R:null};
for(const [side,xa,xb] of [['L',Math.round(bx0+14),Math.round(cx-36)],['R',Math.round(cx+36),Math.round(bx1-14)]])for(const f of [0.36,0.66]){
  const pl=[];for(let x=xa;x<=xb;x+=3){const r=colRun(x);if(r&&r[1]-r[0]>14)pl.push([x,r[0]+f*(r[1]-r[0])]);}
  if(pl.length>6){let q=pl.map(p=>p.slice());for(let it=0;it<4;it++)q=q.map((p,i)=>{let sy=0,c=0;for(let j=Math.max(0,i-4);j<=Math.min(q.length-1,i+4);j++){sy+=q[j][1];c++;}return [p[0],sy/c];});
    lines.push(q);if(f===0.66)lower[side]=q;}}
const arcY=(arc,x)=>{let b=arc[0];for(const p of arc)if(Math.abs(p[0]-x)<Math.abs(b[0]-x))b=p;return b[1];};
const SL=[cx-30,60],SR=[cx+30,60];
for(const p of notches){if(p[1]<45||p[1]>100)continue;const side=p[0]<cx-34?'L':p[0]>cx+34?'R':null;if(!side||!lower[side])continue;const S=side==='L'?SL:SR,arc=lower[side];
  let end=null;for(let t=1;t>=0;t-=0.02){const x=S[0]+(p[0]-S[0])*t,y=S[1]+(p[1]-S[1])*t;if(y<arcY(arc,x)){end=[x,y];break;}}
  if(end&&Math.hypot(end[0]-p[0],end[1]-p[1])>5)lines.push([end,[p[0],p[1]]]);}
const chaikin=(P,k)=>{for(let j=0;j<k;j++){const Q=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];Q.push([.75*a[0]+.25*b[0],.75*a[1]+.25*b[1]],[.25*a[0]+.75*b[0],.25*a[1]+.75*b[1]]);}P=Q;}return P;};
// simplify silhouette: resampled -> keep every 2nd -> chaikin x2 (rounds only the stitch noise)
const S=chaikin(R.filter((_,i)=>i%3===0),2).map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]);
const holes=raw.slice(1).filter(l=>Math.abs(area(l))>15).map(l=>chaikin(resample(l,1.2).filter((_,i)=>i%2===0),2).map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]));
// ---- individual arrows (3) and olive-branch leaves, in crop px. Anchors read from the valley map (arrowheads ~ (47,110), (54,126), (66,104); branch tip ~ (226,108)).
const fills=[],veins=[],leaves=[];
const circ=(cx0,cy0,r,n=14)=>Array.from({length:n},(_,i)=>[cx0+r*Math.cos(i*2*Math.PI/n),cy0+r*Math.sin(i*2*Math.PI/n)]);
const quad=(p0,p1,p2,t)=>[(1-t)**2*p0[0]+2*(1-t)*t*p1[0]+t*t*p2[0],(1-t)**2*p0[1]+2*(1-t)*t*p1[1]+t*t*p2[1]];
const leaf=(bx,by,ang,len,wid)=>{ // pointed leaf from base (bx,by) along ang
  const c=Math.cos(ang),sn=Math.sin(ang),pts=[],n=10;
  for(let i=0;i<=n;i++){const u=i/n,w=wid/2*Math.sin(Math.PI*Math.pow(u,0.85));pts.push([bx+c*len*u-sn*w,by+sn*len*u+c*w]);}
  for(let i=n;i>=0;i--){const u=i/n,w=wid/2*Math.sin(Math.PI*Math.pow(u,0.85));pts.push([bx+c*len*u+sn*w,by+sn*len*u-c*w]);}
  leaves.push(pts);veins.push([[bx,by],[bx+c*len*0.9,by+sn*len*0.9]]);};
// olive branch (right): stem curve from the talon out to the right, rising slightly
{const P0=[161,125],P1=[196,133],P2=[226,111],stem=[];
 for(let i=0;i<=24;i++)stem.push(quad(P0,P1,P2,i/24));
 // stem as a thin ribbon
 const left=[],right=[];stem.forEach((q,i)=>{const a=stem[Math.max(0,i-1)],b=stem[Math.min(stem.length-1,i+1)],ang=Math.atan2(b[1]-a[1],b[0]-a[0]),w=1.3;left.push([q[0]-Math.sin(ang)*w,q[1]+Math.cos(ang)*w]);right.push([q[0]+Math.sin(ang)*w,q[1]-Math.cos(ang)*w]);});
 fills.push(left.concat(right.reverse()));
 const N=4;   // four leaf pairs (top and bottom) + one terminal leaf, spaced so each leaf stands clear of its neighbours
 for(let i=0;i<N;i++){const t=0.22+i*0.19,q=quad(P0,P1,P2,t),q2=quad(P0,P1,P2,Math.min(1,t+0.02)),tang=Math.atan2(q2[1]-q[1],q2[0]-q[0]);
   const len=17.5,wid=8.2;
   leaf(q[0],q[1],tang-0.80,len,wid);        // upper leaf
   leaf(q[0],q[1],tang+0.80,len,wid);        // lower leaf
 }
 const tq=quad(P0,P1,P2,1),tq0=quad(P0,P1,P2,0.97);leaf(tq[0]-1,tq[1]+0.5,Math.atan2(tq[1]-tq0[1],tq[0]-tq0[0]),19,8.8);   // terminal leaf
 }
// arrows (left): three arrows fanned out from the talon, heads toward the left
for(const [tx,ty] of [[48,109],[55,125],[67,103]]){
  const sx=108,sy=118,ang=Math.atan2(ty-sy,tx-sx),c=Math.cos(ang),sn=Math.sin(ang),hl=12,hw=5.6,sw=1.15;
  const bx=tx-c*hl*-1,by=ty-sn*hl*-1;  // base of the head (toward the shaft)
  const hb=[tx-c*(-hl),ty-sn*(-hl)];
  // shaft
  fills.push([[sx-sn*sw,sy+c*sw],[hb[0]-sn*sw,hb[1]+c*sw],[hb[0]+sn*sw,hb[1]-c*sw],[sx+sn*sw,sy-c*sw]]);
  // head (triangle with a small notch at the base)
  fills.push([[tx,ty],[hb[0]-sn*hw,hb[1]+c*hw],[hb[0]+c*1.6,hb[1]+sn*1.6],[hb[0]+sn*hw,hb[1]-c*hw]]);
}
fs.writeFileSync(OUTF,JSON.stringify({w:W,h:H,source:'CAPR 39-1 Fig A5-1 Colonel sleeve (3x render)',loops:[S,...holes],fills:fills.map(l=>l.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])),leaves:leaves.map(l=>l.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])),veins:veins.map(l=>l.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])),lines:lines.map(l=>l.map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)])),notches:notches.map(q=>q.map(v=>+v.toFixed(1)))}));
console.log('sil pts',S.length,'holes',holes.length,'notches',notches.length,'lines',lines.length,'bbox',bx0.toFixed(1),bx1.toFixed(1),by0.toFixed(1),by1.toFixed(1));
