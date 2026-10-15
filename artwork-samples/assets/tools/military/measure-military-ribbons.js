// Stage 1: measure the vendor-raster military ribbons by script (no eyeballing).
//   swiftc gridsample.swift -o gridsample && ./gridsample list.txt grid.json      (area-averaged 220x60 RGB grid per image)
//   node measure-military-ribbons.js grid.json awards.json measurements.json
// For each image: trims white margin rows, segments column (vertical-stripe) and row (horizontal-stripe) profiles by
// hysteresis, scores both models by block-mean residual, finds white star blobs, and assigns a model class.
const fs=require('fs');
const [,,GRID,AWARDS,OUT]=process.argv;
const G=JSON.parse(fs.readFileSync(GRID)),AW=JSON.parse(fs.readFileSync(AWARDS)); // AW: {imagePath:[awardId,...]}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function segment(cols,{T=34,T2=26,minFrac=0.014}={}){
  const minW=Math.max(2,Math.round(cols.length*minFrac));
  const mean=r=>r.sum.map(v=>v/r.n);
  let runs=[],cur={a:0,b:0,sum:[...cols[0]],n:1};
  for(let x=1;x<cols.length;x++){const m=mean(cur);
    if(dist(cols[x],m)>T&&(x+1>=cols.length||dist(cols[x+1],m)>T*0.8)){cur.b=x-1;runs.push(cur);cur={a:x,b:x,sum:[...cols[x]],n:1};}
    else{cur.b=x;cur.n++;for(let k=0;k<3;k++)cur.sum[k]+=cols[x][k];}}
  cur.b=cols.length-1;runs.push(cur);
  let changed=true;
  while(changed&&runs.length>1){changed=false;
    for(let i=0;i<runs.length;i++){const w=runs[i].b-runs[i].a+1;
      if(w<minW){const L=runs[i-1],R=runs[i+1],m=mean(runs[i]);
        const tgt=(L&&R)?(dist(m,mean(L))<=dist(m,mean(R))?L:R):(L||R);if(!tgt)continue;
        tgt.a=Math.min(tgt.a,runs[i].a);tgt.b=Math.max(tgt.b,runs[i].b);tgt.n+=runs[i].n;for(let k=0;k<3;k++)tgt.sum[k]+=runs[i].sum[k];
        runs.splice(i,1);changed=true;break;}}}
  for(let i=0;i<runs.length-1;){
    if(dist(mean(runs[i]),mean(runs[i+1]))<T2){const r=runs[i],s=runs[i+1];r.b=s.b;r.n+=s.n;for(let k=0;k<3;k++)r.sum[k]+=s.sum[k];runs.splice(i+1,1);}else i++;}
  return runs.map(r=>({a:r.a,b:r.b,rgb:mean(r)}));
}
const hex=c=>c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const profX=(g,gw,y0,y1,mask)=>{const o=[];for(let x=0;x<gw;x++){let r=0,gg=0,b=0,n=0;for(let y=y0;y<y1;y++){if(mask&&mask[y*gw+x])continue;const k=(y*gw+x)*3;r+=g[k];gg+=g[k+1];b+=g[k+2];n++;}
  o.push(n?[r/n,gg/n,b/n]:[255,255,255]);}return o;};
const profY=(g,gw,gh)=>{const o=[];for(let y=0;y<gh;y++){let r=0,gg=0,b=0;for(let x=0;x<gw;x++){const k=(y*gw+x)*3;r+=g[k];gg+=g[k+1];b+=g[k+2];}o.push([r/gw,gg/gw,b/gw]);}return o;};
function residX(g,gw,y0,y1,runs){let s=0,N=0;const B=6;
  for(let x=0;x<gw;x++){const run=runs.find(q=>x>=q.a&&x<=q.b)||runs[runs.length-1];
    for(let by=y0;by+B<=y1;by+=B){let r=0,gg=0,b=0;for(let y=by;y<by+B;y++){const k=(y*gw+x)*3;r+=g[k];gg+=g[k+1];b+=g[k+2];}s+=dist([r/B,gg/B,b/B],run.rgb);N++;}}
  return s/N;}
function residY(g,gw,gh,runs){let s=0,N=0;const B=6;
  for(let y=0;y<gh;y++){const run=runs.find(q=>y>=q.a&&y<=q.b)||runs[runs.length-1];
    for(let bx=0;bx+B<=gw;bx+=B){let r=0,gg=0,b=0;for(let x=bx;x<bx+B;x++){const k=(y*gw+x)*3;r+=g[k];gg+=g[k+1];b+=g[k+2];}s+=dist([r/B,gg/B,b/B],run.rgb);N++;}}
  return s/N;}
function trim(g,gw,gh){const white=y=>{let m=[0,0,0];for(let x=0;x<gw;x++){const k=(y*gw+x)*3;m[0]+=g[k];m[1]+=g[k+1];m[2]+=g[k+2];}m=m.map(v=>v/gw);
    let v=0;for(let x=0;x<gw;x++){const k=(y*gw+x)*3;v+=Math.abs(g[k]-m[0])+Math.abs(g[k+1]-m[1])+Math.abs(g[k+2]-m[2]);}return Math.min(...m)>236&&v/gw<18;};
  let t=0,b=gh-1;while(t<gh-4&&white(t))t++;while(b>t+4&&white(b))b--;return {t,b};}
function blobs(g,gw,gh){const W=(x,y)=>{const k=(y*gw+x)*3;return Math.min(g[k],g[k+1],g[k+2])>200;};
  const seen=new Uint8Array(gw*gh),out=[];
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){if(seen[y*gw+x]||!W(x,y))continue;
    const st=[[x,y]];seen[y*gw+x]=1;let n=0,sx=0,sy=0,x0=x,x1=x,y0=y,y1=y;
    while(st.length){const [a,b]=st.pop();n++;sx+=a;sy+=b;x0=Math.min(x0,a);x1=Math.max(x1,a);y0=Math.min(y0,b);y1=Math.max(y1,b);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const u=a+dx,v=b+dy;if(u<0||v<0||u>=gw||v>=gh||seen[v*gw+u]||!W(u,v))continue;seen[v*gw+u]=1;st.push([u,v]);}}
    out.push({n,cx:sx/n,cy:sy/n,w:x1-x0+1,h:y1-y0+1});}
  return out.filter(b=>b.n>=6&&b.n<400);}
const goldish=(r,g,b)=>r>=100&&r>b+20&&g>b+8&&(r-g)<110;
function detectFrame(g,gw,gh){
  const cell=(x,y)=>{const k=(y*gw+x)*3;return [g[k],g[k+1],g[k+2]];};
  const rowFrac=y=>{let n=0;for(let x=0;x<gw;x++){const c=cell(x,y);if(goldish(c[0],c[1],c[2]))n++;}return n/gw;};
  let tT=0;while(tT<20&&rowFrac(tT)>=0.55)tT++;
  let tB=0;while(tB<20&&rowFrac(gh-1-tB)>=0.55)tB++;
  const y0=tT,y1=gh-tB,colFrac=x=>{let n=0,m=0;for(let y=y0;y<y1;y++){const c=cell(x,y);m++;if(goldish(c[0],c[1],c[2]))n++;}return m?n/m:0;};
  let tL=0;while(tL<20&&colFrac(tL)>=0.55)tL++;
  let tR=0;while(tR<20&&colFrac(gw-1-tR)>=0.55)tR++;
  if(!(tT>=1&&tB>=1&&tL>=1&&tR>=1))return null;
  const mean=(tT+tB+tL+tR)/4;if(mean<1.5||mean>16)return null;
  let r=0,gg=0,b=0,n=0;
  const add=(x,y)=>{const c=cell(x,y);if(goldish(c[0],c[1],c[2])){r+=c[0];gg+=c[1];b+=c[2];n++;}};
  for(let y=0;y<tT;y++)for(let x=0;x<gw;x++)add(x,y);
  for(let y=gh-tB;y<gh;y++)for(let x=0;x<gw;x++)add(x,y);
  for(let y=tT;y<gh-tB;y++){for(let x=0;x<tL;x++)add(x,y);for(let x=gw-tR;x<gw;x++)add(x,y);}
  return {cells:{top:tT,bottom:tB,left:tL,right:tR},hex:hex([r/n,gg/n,b/n].map(Math.round)),gw,gh};}
const res={};
for(const [p,d] of Object.entries(G)){
  const gw=d.gw,{t,b}=trim(d.grid,gw,d.gh),gh=b-t+1,g=d.grid.slice(t*gw*3,(b+1)*gw*3);
  const rv=segment(profX(g,gw,0,gh)),rh=segment(profY(g,gw,gh),{minFrac:0.02});
  const ev=residX(g,gw,0,gh,rv),eh=residY(g,gw,gh,rh);
  const y0=Math.floor(gh*0.3),y1=Math.floor(gh*0.7);
  const rc=segment(profX(g,gw,y0,y1)),central=residX(g,gw,y0,y1,rc);
  const bl=blobs(g,gw,gh);
  // field fraction for star detection
  const cnt=new Map();for(let i=0;i<gw*gh;i++){const c=[g[i*3],g[i*3+1],g[i*3+2]];if(Math.min(...c)>200)continue;const k=c.map(v=>v>>5).join(',');cnt.set(k,(cnt.get(k)||0)+1);}
  const fieldFrac=cnt.size?Math.max(...cnt.values())/(gw*gh):0;
  // horizontal bands only when that model is decisively better (a mostly-uniform ribbon with thin vertical lines also scores low on rows)
  const mode=(eh<ev*0.5&&ev>20)?'H':'V',best=mode==='H'?eh:ev;
  let cls;
  if(mode==='V'&&best<28)cls='stripes';
  else if(mode==='H'&&best<14)cls='hstripes';
  else if(bl.length>=3&&bl.length<=8&&fieldFrac>0.45&&best>=28)cls='starfield';
  else if(mode==='V'&&central<24)cls='stripes_framed_or_photo';
  else cls='unresolved';
  const mk=rs=>rs.map(r=>({x0:+(r.a/(mode==='H'?gh:gw)).toFixed(4),x1:+((r.b+1)/(mode==='H'?gh:gw)).toFixed(4),hex:hex(r.rgb)}));
  // border test: do the top/bottom 12% rows disagree with the central colour in most columns? (unit-award frame etc.)
  const bandN=Math.max(1,Math.floor(gh*0.12));
  const topP=profX(g,gw,0,bandN),botP=profX(g,gw,gh-bandN,gh),midP=profX(g,gw,y0,y1);
  let bd=0;for(let x=0;x<gw;x++)if(dist(topP[x],midP[x])>70||dist(botP[x],midP[x])>70)bd++;
  const border=bd/gw>0.6;
  const o={awards:AW[p]||[],w:d.w,h:d.h,border_frame_detected:border,trimRows:{top:t,bottom:d.gh-1-b},residual:{vertical:+ev.toFixed(1),horizontal:+eh.toFixed(1),central_vertical:+central.toFixed(1)},class:cls,mode};
  if(cls==='hstripes')o.runs=rh.map(r=>({x0:+(r.a/gh).toFixed(4),x1:+((r.b+1)/gh).toFixed(4),hex:hex(r.rgb)}));
  else if(cls==='stripes')o.runs=rv.map(r=>({x0:+(r.a/gw).toFixed(4),x1:+((r.b+1)/gw).toFixed(4),hex:hex(r.rgb)}));
  else if(cls==='stripes_framed_or_photo')o.runs=rc.map(r=>({x0:+(r.a/gw).toFixed(4),x1:+((r.b+1)/gw).toFixed(4),hex:hex(r.rgb)}));
  else if(cls==='starfield'){
    // stripes from the unmasked pixels (stars masked, dilated by 1 cell)
    const mask=new Uint8Array(gw*gh);
    for(const s of bl)for(let y=Math.floor(s.cy-s.h/2)-1;y<=Math.ceil(s.cy+s.h/2)+1;y++)for(let x=Math.floor(s.cx-s.w/2)-1;x<=Math.ceil(s.cx+s.w/2)+1;x++)if(x>=0&&y>=0&&x<gw&&y<gh)mask[y*gw+x]=1;
    const rs=segment(profX(g,gw,0,gh,mask));
    o.runs=rs.map(r=>({x0:+(r.a/gw).toFixed(4),x1:+((r.b+1)/gw).toFixed(4),hex:hex(r.rgb)}));
    o.stars=bl.map(s=>({cx:+(s.cx/gw).toFixed(4),cy:+((s.cy+0.5)/gh).toFixed(4),width_frac:+(s.w/gw).toFixed(4),height_frac:+(s.h/gh).toFixed(4)}));
  }
  // gold frame (unit-award style): measure its thickness and read the stripes from the interior only
  const fr=detectFrame(g,gw,gh);
  if(fr){
    const {top:a,bottom:bb,left:l,right:r2}=fr.cells,iw=gw-l-r2,ih=gh-a-bb;
    const gi=new Float32Array(iw*ih*3);for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)for(let c=0;c<3;c++)gi[(y*iw+x)*3+c]=g[((y+a)*gw+x+l)*3+c];
    const ir=segment(profX(gi,iw,0,ih),{minFrac:0.014});
    o.frame={thickness_in:{top:+(a*0.375/gh).toFixed(4),bottom:+(bb*0.375/gh).toFixed(4),left:+(l*1.375/gw).toFixed(4),right:+(r2*1.375/gw).toFixed(4)},
      cells:fr.cells,hex:fr.hex,note:'gold unit-award frame; thickness measured on the 220x60 grid (1/160 in cells), colour sampled; laurel texture not modeled'};
    o.interior_runs=ir.map(r=>({x0:+((r.a+l)/gw).toFixed(4),x1:+((r.b+1+l)/gw).toFixed(4),hex:hex(r.rgb)}));
  }
  o.central_runs=rc.map(r=>({x0:+(r.a/gw).toFixed(4),x1:+((r.b+1)/gw).toFixed(4),hex:hex(r.rgb)}));
  res[p]=o;
}
fs.writeFileSync(OUT,JSON.stringify(res,null,1));
const h={};Object.values(res).forEach(o=>h[o.class]=(h[o.class]||0)+1);console.log('classes',h);
