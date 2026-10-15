// Rebuild each CAP medal body from a public product photograph (see SOURCES.md): measure, posterise, smooth, emit.
// usage: node trace-medals.js [stem ...]      writes ../medals/<id>.svg + .spec.json ; photos in ref-hires/ (converted to png/)
const fs=require('fs'),path=require('path'),cp=require('child_process');
const {decode}=require(process.env.HOME+'/.claude/skills/badge-replicator/scripts/pngio.js');
const L=require('./lib.js');
const W_DIR=__dirname,OUT=path.join(W_DIR,'..','medals');
const BASE=require('./stems.json'); // stem -> [ribbon id, display name]
// stem -> [photo file base (png/), vendor handle, note]
const PHOTO={
 usaf_aam01:['usaf-aerial-achievement-full-size-medal','usaf-aerial-achievement-full-size-medal'],
 airmedal:['air-medal-full-size-medal','air-medal-full-size-medal'],
 distin01:['distinguished-service','civil-air-patrol-distinguished-service-miniature-medal'],
 except01:['exceptional-service','civil-air-patrol-exceptional-service-miniature-medal'],
 meriti01:['meritorious-service','civil-air-patrol-meritorious-service-miniature-medal'],
 cmdrco01:['commander-commendation','civil-air-patrol-commander-commendation-miniature-medal'],
 AA01:['achievement-award','civil-air-patrol-achievement-award-miniature-medal'],
 lifesa01:['life-saving','civil-air-patrol-life-saving-miniature-medal'],
 'unitci-nat01':['national-commander-unit-citation','civil-air-patrol-national-commander-unit-citation-medal'],
 unitci01:['unit-citation','civil-air-patrol-unit-citation-miniature-medal'],
 natcmdrcom:['national-commander-citation','civil-air-patrol-national-commander-citation-miniature-medal'],
 cadet_cop:['certificate-of-proficiency','civil-air-patrol-certificate-of-proficiency-miniature-medal'],
 wilson:['gill-robb-wilson','civil-air-patrol-gill-robb-wilson-miniature-medal'],
 garber:['garber','civil-air-patrol-garber-miniature-medal'],
 loening:['grover-loening','civil-air-patrol-grover-loening-miniature-medal'],
 leader:['leadership-award','civil-air-patrol-leadership-award-miniature-medal'],
 member:['membership-award','civil-air-patrol-membership-award-miniature-medal'],
 cmdser:['command-service','civil-air-patrol-command-service-miniature-medal'],
 wartime:['wartime-wwii-service','civil-air-patrol-wartime-wwii-service-miniature-medal'],
 senrec01:['senior-recruiter','civil-air-patrol-senior-recruiter-miniature-medal'],
 crossf:['crossfield','civil-air-patrol-crossfield-miniature-medal'],
 crisis:['copy-of-life-saving','copy-of-civil-air-patrol-miniature-medal-life-saving'],
 'redser-02yr':['service-red','civil-air-patrol-service-red-miniature-medal'],
 find01:['rescue-find','civil-air-patrol-rescue-find-miniature-medal'],
 sar01:['search-and-rescue','civil-air-patrol-search-and-rescue-miniature-medal'],
 disast01:['disaster-relief','civil-air-patrol-disaster-relief-miniature-medal'],
 iace01:['iace-award','civil-air-patrol-iace-award-miniature-medal'],
 spaatz:['carl-a-spaatz','civil-air-patrol-carl-a-spaatz-miniature-medal'],
 eaker:['ira-c-eaker','civil-air-patrol-ira-c-eaker-miniature-medal'],
 earhar:['amelia-earhart','civil-air-patrol-amelia-earhart-miniature-medal'],
 mitchel:['billy-mitchell','civil-air-patrol-billy-mitchell-miniature-medal'],
 ncc:['national-cadet-competition','civil-air-patrol-national-cadet-competition-miniature-medal'],
 ncgc:['guard-competition','civil-air-patrol-guard-competition-miniature-medal'],
 encamp01:['encampment','civil-air-patrol-encampment-miniature-medal']};
const K=+process.env.K||4,LIMIT={full:60000,miniature:25000};

function load(name){ // -> {W,H,rgb Uint8, fg Uint8}
  const f=path.join(W_DIR,'png',name+'.png'),im=decode(f),W=im.W,H=im.H,bg=new Uint8Array(W*H);
  const near=i=>{const r=im.rgba[i*4],g=im.rgba[i*4+1],b=im.rgba[i*4+2];return Math.min(r,g,b)>=(+process.env.WHITE||226)&&Math.max(r,g,b)-Math.min(r,g,b)<=14;};
  const st=[];for(let x=0;x<W;x++){st.push(x,(H-1)*W+x);}for(let y=0;y<H;y++){st.push(y*W,y*W+W-1);}
  while(st.length){const p=st.pop();if(p<0||p>=W*H||bg[p]||!near(p))continue;bg[p]=1;const x=p%W;if(x>0)st.push(p-1);if(x<W-1)st.push(p+1);st.push(p-W,p+W);}
  const fg=new Uint8Array(W*H);for(let i=0;i<W*H;i++)fg[i]=bg[i]?0:1;
  return {W,H,rgba:im.rgba,fg};
}
function bodyBox(im){
  const {W,H,fg}=im,w=new Int32Array(H),x0=new Int32Array(H).fill(1e9),x1=new Int32Array(H).fill(-1);
  let top=-1,bot=-1;for(let y=0;y<H;y++){for(let x=0;x<W;x++)if(fg[y*W+x]){x0[y]=Math.min(x0[y],x);x1[y]=Math.max(x1[y],x);}
    if(x1[y]>=0){w[y]=x1[y]-x0[y]+1;if(top<0)top=y;bot=y;}}
  const lo=Math.floor(bot-(bot-top)*0.38);let yM=lo,dW=0;for(let y=lo;y<=bot;y++)if(w[y]>dW){dW=w[y];yM=y;}
  let y=yM;while(y>top&&w[y]>=0.5*dW)y--;               // leave the disc upward
  while(y>top&&w[y]<0.5*dW)y--;                           // through the suspension ring / fold
  const t=y+1;let a=1e9,b=-1;for(let r=t;r<=bot;r++){a=Math.min(a,x0[r]);b=Math.max(b,x1[r]);}
  let ax=0,an=0;for(let r=t;r<t+Math.max(2,Math.round((bot-t)*0.06));r++)for(let x=x0[r];x<=x1[r];x++){ax+=x;an++;}
  return {top:t,bot,x0:a,x1:b,discW:dW,attachX:ax/an};
}
function crop(im,bb){ // area-averaged crop, integer downscale so the body is <= ~240 px wide
  const k=Math.max(1,Math.round((bb.x1-bb.x0+1)/240)),W=Math.ceil((bb.x1-bb.x0+1)/k),H=Math.ceil((bb.bot-bb.top+1)/k);
  const A=new Uint8Array(W*H),rgb=new Float32Array(W*H*3);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){let n=0,f=0,r=0,g=0,b=0;
    for(let dy=0;dy<k;dy++)for(let dx=0;dx<k;dx++){const X=bb.x0+x*k+dx,Y=bb.top+y*k+dy;if(X>bb.x1||Y>bb.bot)continue;n++;
      if(im.fg[Y*im.W+X]){f++;const i=(Y*im.W+X)*4;r+=im.rgba[i];g+=im.rgba[i+1];b+=im.rgba[i+2];}}
    if(n&&f/n>0.5){A[y*W+x]=1;rgb[(y*W+x)*3]=r/f;rgb[(y*W+x)*3+1]=g/f;rgb[(y*W+x)*3+2]=b/f;}}
  return {W,H,A,rgb,k};
}
function median(c,passes){ // 3x3 per-channel median over the foreground only: removes engraving texture before posterising
  const {W,H,A}=c;let src=c.rgb;
  for(let k=0;k<passes;k++){const dst=new Float32Array(src.length);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x;if(!A[p])continue;
      for(let ch=0;ch<3;ch++){const v=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const q=Y*W+X;if(A[q])v.push(src[q*3+ch]);}
        v.sort((a,b)=>a-b);dst[p*3+ch]=v[v.length>>1];}}
    src=dst;}
  return src;}
function layers(c,mult){
  const {W,H,A}=c;let satSum=0,satN=0;for(let p=0;p<W*H;p++)if(A[p]){const r=c.rgb[p*3],g=c.rgb[p*3+1],b=c.rgb[p*3+2];satSum+=(Math.max(r,g,b)-Math.min(r,g,b))/Math.max(1,Math.max(r,g,b));satN++;}
  const coarse0=satSum/satN>0.28,rgb=median(c,+process.env.MED||(coarse0?2:1)),idx=[],px=[];for(let p=0;p<W*H;p++)if(A[p]){idx.push(p);px.push([rgb[p*3],rgb[p*3+1],rgb[p*3+2]]);}
  // preset by metal: saturated (gold/bronze) bodies are specular and noisy -> coarser; grey/silver bodies keep fine detail
  const sat=px.reduce((t,p)=>t+(Math.max(...p)-Math.min(...p))/Math.max(1,Math.max(...p)),0)/px.length;
  const coarse=sat>0.28,MEDn=coarse?2:1,speck=coarse?0.004:0.0007,blur=coarse?2:1;
  // contrast-stretch for clustering only (dark patina medals are low contrast), colours stay the sampled originals
  const lum=p=>0.3*p[0]+0.59*p[1]+0.11*p[2],ls=px.map(lum).sort((a,b)=>a-b),lo=ls[Math.floor(ls.length*0.02)],hi=ls[Math.floor(ls.length*0.98)],sc=255/Math.max(30,hi-lo);
  const st=px.map(p=>p.map(v=>Math.max(0,Math.min(255,(v-lo)*sc))));
  const km=L.kmeans(st,K),rk=new Uint8Array(W*H).fill(255);idx.forEach((p,i)=>rk[p]=km.rank[i]);
  const sum=Array.from({length:K},()=>[0,0,0,0]);px.forEach((p,i)=>{const t=sum[km.rank[i]];t[0]+=p[0];t[1]+=p[1];t[2]+=p[2];t[3]++;});
  km.centers=sum.map((t,j)=>t[3]?[t[0]/t[3],t[1]/t[3],t[2]/t[3]]:km.centers[j]);
  const D=Math.sqrt(4*idx.length/Math.PI),minA=Math.max(4,(+process.env.SPECK||speck)*idx.length*mult),eps=1.2*mult; // eps in 4x px units
  const post=l=>L.chaikin(l,2,38);
  const out=[{col:km.centers[0],loops:L.trace(A,W,H,eps,1).map(post).filter(l=>Math.abs(L.area(l))>minA)}];
  for(let j=1;j<K;j++){let m=new Uint8Array(W*H);for(let p=0;p<m.length;p++)m[p]=(A[p]&&rk[p]>=j)?1:0;
    m=L.smoothMask(m,W,H,+process.env.BLUR||blur);m=L.dropSmall(m,W,H,Math.round(minA),true);
    out.push({col:km.centers[j],loops:L.trace(m,W,H,eps,0).map(post).filter(l=>Math.abs(L.area(l))>minA)});}
  return {layers:out,D,minA};
}
function emit(stem,c,lay,kind,oldSpec){
  const [rid,name]=BASE[stem],id=oldSpec.asset_id,wIn=kind==='full'?1.375:0.625; // standard disc width (ribbon 1 3/8 in / 5/8 in)
  // bbox of the silhouette
  const pts=lay.layers[0].loops.flat();let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const [x,y] of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const s=wIn*100/(x1-x0),wu=(x1-x0)*s,hu=(y1-y0)*s,fx=x=>((x-x0)*s).toFixed(2),fy=y=>((y-y0)*s).toFixed(2);
  const d=loops=>loops.map(l=>'M'+l.map(([x,y])=>fx(x)+','+fy(y)).join('L')+'Z').join('');
  const attach=((c.attachX-x0)*s);
  const anchors={top_center:[wu/2,0],bottom_center:[wu/2,hu],center:[wu/2,hu/2],left_edge:[0,hu/2],right_edge:[wu,hu/2],ribbon_attach:[attach,0]};
  for(const k of Object.keys(anchors))anchors[k]=anchors[k].map(v=>+v.toFixed(2));
  return {id,s,x0,y0,x1,y1,wu,hu,anchors,body:lay.layers.map((l,i)=>`<path id="${id}__tone-${i}" fill="${L.hex(l.col)}" fill-rule="evenodd" d="${d(l.loops)}"/>`).join(''),
    palette:lay.layers.map(l=>L.hex(l.col)),rid,name};
}
function gate(c,lay){ // silhouette IoU and mean colour error at the working resolution
  const {W,H,A,rgb}=c,sil=lay.layers[0].loops;let inter=0,uni=0,mae=0,n=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=y*W+x,mine=L.inside(sil,x+0.5,y+0.5),src=A[p]===1;if(mine&&src)inter++;if(mine||src)uni++;
    if(src){let col=lay.layers[0].col;for(let j=1;j<lay.layers.length;j++)if(L.inside(lay.layers[j].loops,x+0.5,y+0.5))col=lay.layers[j].col;
      mae+=(Math.abs(col[0]-rgb[p*3])+Math.abs(col[1]-rgb[p*3+1])+Math.abs(col[2]-rgb[p*3+2]))/3;n++;}}
  return {iou:inter/uni,mae:mae/n};
}
const stems=process.argv.slice(2).length?process.argv.slice(2):Object.keys(PHOTO);
const report=[];
for(const stem of stems){
  const [photo,handle]=PHOTO[stem],im=load(photo),bb=bodyBox(im),c=crop(im,bb);c.attachX=(bb.attachX-bb.x0)/c.k;
  const g0=null;
  for(const kind of ['full','miniature']){
    const id=`medal-${BASE[stem][0]}-${kind}`,idf=stem==='usaf_aam01'&&kind==='full'?'medal-cap-catalog-air-force-aerial-achievement-medal-full':id;
    const sp=path.join(OUT,idf+'.spec.json'),old=JSON.parse(fs.readFileSync(sp,'utf8'));
    let res=null;
    for(const mult of [1,1.5,2.2,3.2,4.5,6.5]){
      const lay=layers(c,mult),e=emit(stem,c,lay,kind,old);
      const meta={...old,size_in_previous:old.size_in,size_in:{w:+(e.wu/100).toFixed(4),h:+(e.hu/100).toFixed(4)},viewBox:[0,0,+e.wu.toFixed(2),+e.hu.toFixed(2)],anchors:e.anchors,
        fidelity:'traced_from_public_reference',
        source:`https://vanguardmil.com/products/${handle}; vendor product photograph (Vanguard Military Products), used only as a measurement reference; licence not stated by the vendor`,
        source_detail:{page:`https://vanguardmil.com/products/${handle}`,local_photo:`medals-work/ref-hires/${photo}.*`,photo_px:{w:im.W,h:im.H},body_px:{w:bb.x1-bb.x0+1,h:bb.bot-bb.top+1},work_scale_1_over:c.k,
          photo_shows:handle.includes('miniature')?'miniature medal':'full-size medal'},
        palette:e.palette,tone_layers:K,detail_reduction:mult};
      const gt=gate(c,lay);meta.fit={metric:'silhouette IoU vs photo foreground mask at working resolution',score:+gt.iou.toFixed(4),threshold:0.95,colour_mae_0_255:+gt.mae.toFixed(1),
        note:'Posterised to 5 flat sampled tones (smoothed, Chaikin + RDP, specks dropped); 4 nested tone layers over the traced silhouette.'};
      meta.size_basis=(old.size_basis||'').replace(/\s*Absolute size.*$/,'')+` Width kept from the previous asset; the product photo shows the medal disc and suspension ring, height now ${meta.size_in.h} in (was ${old.size_in.h}).`;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.size_in.w.toFixed(4)}in" height="${meta.size_in.h.toFixed(4)}in" viewBox="0 0 ${e.wu.toFixed(2)} ${e.hu.toFixed(2)}" data-asset-id="${e.id}" data-source="reference-art-traced" data-units="0.01in"><title>${meta.name}</title><metadata>${JSON.stringify(meta)}</metadata><g id="${e.id}__body">${e.body}</g></svg>\n`;
      res={svg,meta,bytes:Buffer.byteLength(svg),mult};
      if(res.bytes<=LIMIT[kind])break;
    }
    fs.writeFileSync(path.join(OUT,idf+'.svg'),res.svg);fs.writeFileSync(sp,JSON.stringify(res.meta,null,1));
    report.push({stem,id:idf,kind,bytes:res.bytes,mult:res.mult,iou:res.meta.fit.score,mae:res.meta.fit.colour_mae_0_255,w:res.meta.size_in.w,h:res.meta.size_in.h});
    console.log(idf.padEnd(62),String(res.bytes).padStart(6),'B x'+res.mult,'IoU',res.meta.fit.score,'MAE',res.meta.fit.colour_mae_0_255,res.meta.size_in.w+'x'+res.meta.size_in.h);
  }
}
fs.writeFileSync(path.join(W_DIR,'trace-report.json'),JSON.stringify(report,null,1));
