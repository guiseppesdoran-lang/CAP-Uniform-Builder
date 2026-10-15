// Measure the band structure of a cadet chevron figure (CAPR 39-1 Fig A5-5) by scanning pixel columns.
// For every column (outside the shield) find the silver bands as sub-pixel [yTop,yBot] intervals, track each band across
// columns, and fit y(u) = c0 + c1 u + c2 u^2 (u = |x - axis|) for its top and bottom edge. Also the outline envelope.
// usage: node chevron-measure.js fig.png x0 y0 w h out.json [shield: scx,sTop,sw,sBot as fractions-of-crop JSON | auto]
const fs=require('fs'),dec=require('./dec.js');
const [,,SRC,X0s,Y0s,Ws,Hs,OUTF,SHJ]=process.argv;
const X0=+X0s,Y0=+Y0s,W=+Ws,H=+Hs,d=dec(SRC);
const lum=(x,y)=>{const p=d.px(X0+x,Y0+y);return 0.3*p[0]+0.59*p[1]+0.11*p[2];};
const isRed=(x,y)=>{const p=d.px(X0+x,Y0+y);return p[0]>140&&p[1]<90&&p[2]<90;};
// background: near-white flood from border
const bg=new Uint8Array(W*H),q=[];
const near=(x,y)=>{const p=d.px(X0+x,Y0+y);return Math.min(p[0],p[1],p[2])>238;};
const push=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return;const i=y*W+x;if(bg[i]||!near(x,y))return;bg[i]=1;q.push(i);};
for(let x=0;x<W;x++){push(x,0);push(x,H-1);}for(let y=0;y<H;y++){push(0,y);push(W-1,y);}
while(q.length){const i=q.pop(),x=i%W,y=(i/W)|0;push(x+1,y);push(x-1,y);push(x,y+1);push(x,y-1);}
// silhouette extents
let sx0=1e9,sx1=-1e9,sy0=1e9,sy1=-1e9;
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!bg[y*W+x]){sx0=Math.min(sx0,x);sx1=Math.max(sx1,x);sy0=Math.min(sy0,y);sy1=Math.max(sy1,y);}
const axis=(sx0+sx1+1)/2,CW=sx1-sx0+1;
// shield zone from the red pixels (stripes), padded
let rx0=1e9,rx1=-1e9,ry0=1e9,ry1=-1e9;
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!bg[y*W+x]&&isRed(x,y)){rx0=Math.min(rx0,x);rx1=Math.max(rx1,x);ry0=Math.min(ry0,y);ry1=Math.max(ry1,y);}
const rh=ry1-ry0,rw=rx1-rx0;
const sh={x0:rx0-0.08*rw,x1:rx1+0.08*rw,y0:ry0-0.62*rh,y1:ry1+0.22*rh};
const inSh=(x,y)=>x>=sh.x0&&x<=sh.x1&&y>=sh.y0&&y<=sh.y1;
// per column: silver intervals (lum>128, not bg, not in shield) with sub-pixel ends
const THR=128;
const cols=[];
for(let x=sx0;x<=sx1;x++){
  const iv=[];let cur=null;
  for(let y=sy0;y<=sy1+1;y++){
    const inside=y<=sy1&&!bg[y*W+x]&&!inSh(x,y)&&lum(x,y)>THR;
    if(inside&&cur===null){ // sub-pixel start: interpolate between y-1 and y
      const l0=y>0?lum(x,y-1):0,l1=lum(x,y);const t=(THR-l0)/((l1-l0)||1);cur=y-1+Math.max(0,Math.min(1,t))+0.5;}
    if(!inside&&cur!==null){const l0=lum(x,y-1),l1=y<=sy1?lum(x,y):0;const t=(l0-THR)/((l0-l1)||1);iv.push([cur,y-1+Math.max(0,Math.min(1,t))+0.5]);cur=null;}
  }
  cols.push({x:x+0.5,iv:iv.filter(v=>v[1]-v[0]>2.0)});
}
// track bands from the left edge inward to the axis, then from right edge inward (mirror data, u = distance from axis)
function tracks(order){
  const tr=[];
  for(const c of order){const u=Math.abs(c.x-axis);
    for(const v of c.iv){let best=null,bo=0;
      for(const t of tr){const last=t.pts[t.pts.length-1];if(Math.abs(last.u-u)>3)continue;
        const ov=Math.min(v[1],last.b)-Math.max(v[0],last.a);if(ov>bo){bo=ov;best=t;}}
      if(best&&bo>0.4*(v[1]-v[0]))best.pts.push({u,a:v[0],b:v[1]});else tr.push({pts:[{u,a:v[0],b:v[1]}]});}
  }
  return tr;}
const left=tracks(cols.filter(c=>c.x<axis).sort((a,b)=>a.x-b.x));
const right=tracks(cols.filter(c=>c.x>=axis).sort((a,b)=>b.x-a.x));
function fit(pts,key){ // y = c0 + c1 u + c2 u^2
  const S=[[0,0,0],[0,0,0],[0,0,0]],B=[0,0,0];
  for(const p of pts){const u=p.u,v=[1,u,u*u],y=p[key];for(let i=0;i<3;i++){B[i]+=v[i]*y;for(let j=0;j<3;j++)S[i][j]+=v[i]*v[j];}}
  const m=S.map((r,i)=>[...r,B[i]]);
  for(let i=0;i<3;i++){let pv=i;for(let r=i+1;r<3;r++)if(Math.abs(m[r][i])>Math.abs(m[pv][i]))pv=r;[m[i],m[pv]]=[m[pv],m[i]];
    if(Math.abs(m[i][i])<1e-9)return [B[0]/pts.length,0,0];
    for(let r=0;r<3;r++)if(r!==i){const f=m[r][i]/m[i][i];for(let c=i;c<4;c++)m[r][c]-=f*m[i][c];}}
  return [m[0][3]/m[0][0],m[1][3]/m[1][1],m[2][3]/m[2][2]];}
const out=[];
for(const [side,T] of [['L',left],['R',right]])
  for(const t of T){if(t.pts.length<6)continue;
    const us=t.pts.map(p=>p.u),u0=Math.min(...us),u1=Math.max(...us);
    const ca=fit(t.pts,'a'),cb=fit(t.pts,'b');
    // fit residual (px)
    const ev=(c,u)=>c[0]+c[1]*u+c[2]*u*u;
    const rms=Math.sqrt(t.pts.reduce((s,p)=>s+(ev(ca,p.u)-p.a)**2+(ev(cb,p.u)-p.b)**2,0)/(2*t.pts.length));
    out.push({side,u0,u1,top:ca,bot:cb,rms:+rms.toFixed(2),n:t.pts.length,yMid:(ev(ca,(u0+u1)/2)+ev(cb,(u0+u1)/2))/2});}
fs.writeFileSync(OUTF,JSON.stringify({w:W,h:H,axis,sil:{x0:sx0,x1:sx1+1,y0:sy0,y1:sy1+1},shield:sh,red:{rx0,rx1,ry0,ry1},tracks:out}));
console.log('axis',axis.toFixed(1),'width',CW,'sil y',sy0,sy1,'shield',JSON.stringify(sh));
out.sort((a,b)=>a.yMid-b.yMid).forEach(t=>console.log(t.side,'u',t.u0.toFixed(0)+'-'+t.u1.toFixed(0),'n',t.n,'rms',t.rms,'top',t.top.map(v=>v.toFixed(3)).join(','),'bot',t.bot.map(v=>v.toFixed(3)).join(',')));
