// Long-sleeve Class B silhouettes, measured from CAPR 39-1 Figure 4.8 (men, first shirt) and Figure 4.11 (women, top-right blouse):
// the figure silhouettes were traced (trace-silhouette.js, px of the 2.2x page render) and are scaled to inches with the horizontal scale
// that registers the figure's short-sleeve twin (Fig 4.9 / 4.10) onto the short-sleeve base image (0.0301 / 0.0300 in/px) and a vertical
// scale that lands the figure's belt line on the base image's belt line (the long-sleeve figures are drawn at a different height).
// Also measures the navy trousers/skirt profile per row (colour mask) so the generator only paints the lower garment where it is.
const fs=require('fs'),path=require('path'),dec=require('./board/dec.js');
// Sleeve length rule (QC 2026-10-13): the women's figure (Fig 4.11) hangs its sleeves 4.4 in lower than the men's (Fig 4.8) relative to the
// shoulder, which is not plausible (a woman's arm is about 1-2 in shorter). After scaling, the women's forearm tube is shortened (a slab of the
// straight part removed, the cuff kept whole and moved up) so shoulder-to-cuff = men's shoulder-to-cuff minus ARM_DIFF. Torso, collar, belt,
// epaulet and skirt vertices are not touched.
const ARM_DIFF=1.5;let MEN_DROP=null;
const CONF={
 male:{base:'class_b_male_outline.json',trace:'fig48_long_male_trace.json',img:'fig48_long_male.png',out:'class_b_male_long_outline.json',kx:0.0301,beltFigPx:689,beltBaseIn:(489-95)*0.0474},
 female:{base:'class_b_female_outline.json',trace:'fig411_long_female_trace.json',img:'fig411_long_female.png',out:'class_b_female_long_outline.json',kx:0.0300,beltFigPx:552,beltBaseIn:(465-18)*0.0385}};
for(const [k,C] of Object.entries(CONF)){
  const B=JSON.parse(fs.readFileSync(path.join(__dirname,C.base),'utf8')),T=JSON.parse(fs.readFileSync(path.join(__dirname,'board','longsleeve',C.trace),'utf8'));
  const ky=C.beltBaseIn/C.beltFigPx,kx=C.kx,sc=p=>[+(p[0]*kx).toFixed(3),+(p[1]*ky).toFixed(3)];
  let outline=T.outline.map(sc);const holes=T.holes.map(h=>h.map(sc));
  const sleeveV=outline.filter(p=>Math.abs(p[0])>7.4),shoulderY=Math.min(...sleeveV.map(p=>p[1])),cuffBot0=Math.max(...sleeveV.map(p=>p[1]));
  let cuffShift=0,cuffFlag=null;
  if(k==='male')MEN_DROP=cuffBot0-shoulderY;
  else if(MEN_DROP!==null){
    const target=MEN_DROP-ARM_DIFF,D=+(cuffBot0-shoulderY-target).toFixed(3);
    if(D>0.05){
      // cuff run (right side): from the first sleeve vertex below y=27 to just before the notch where the sleeve meets the skirt side
      const iR=outline.findIndex(p=>p[0]>0&&p[1]>27);let jR=iR;while(jR+1<outline.length&&!(Math.abs(outline[jR+1][0])<6.9&&outline[jR+1][1]<outline[iR][1]+0.35))jR++;
      const run=new Set();for(let i=iR;i<=jR;i++)run.add(i);
      const cuffTopY=outline[iR][1],slabTop=cuffTopY-D,notchR=outline[jR+1];
      // left cuff run: starts just after the left notch (mirror of the right one), walking forward while still in the cuff band (the traced sides are not exactly mirrored)
      let kL=-1,bd=9;outline.forEach((p,i)=>{if(p[0]<0&&Math.abs(p[0])<6.9){const d=Math.hypot(p[0]+notchR[0],p[1]-notchR[1]);if(d<bd){bd=d;kL=i;}}});
      if(kL>=0)for(let m=kL+1;m<outline.length&&outline[m][1]>cuffTopY-0.7;m++)run.add(m);
      const isCuff=outline.map((p,i)=>run.has(i));
      const keep=outline.map((p,i)=>isCuff[i]||!(Math.abs(p[0])>7.4&&p[1]>slabTop+0.4&&p[1]<cuffTopY));
      cuffFlag=isCuff.filter((c,i)=>keep[i]);
      outline=outline.map((p,i)=>isCuff[i]?[p[0],+(p[1]-D).toFixed(3)]:p).filter((p,i)=>keep[i]);
      cuffShift=D;}}
  let hem=Math.max(...outline.map(p=>p[1]));
  // navy (trousers / skirt) profile, right half, rows from the belt down
  const d=dec(path.join(__dirname,'board','longsleeve',C.img)),cx=T.cx,y0=T.y0,belt=y0+C.beltFigPx;
  const isNavy=p=>p[2]-p[0]>40&&p[0]<70&&p[2]<150;
  const prof=[];
  for(let y=belt+2;y<d.H;y+=12){let mx=-1,mn=1e9;for(let x=0;x<d.W;x++){if(isNavy(d.px(x,y))){mx=Math.max(mx,x);mn=Math.min(mn,x);}}
    if(mx<0)continue;const half=(mx-mn)/2;if(half<60)continue;prof.push([+(half*kx).toFixed(3),+((y-y0)*ky).toFixed(3)]);}
  if(cuffFlag){ // close the gap between the moved cuff and the skirt side with the measured skirt profile (otherwise a shirt-coloured sliver shows)
    const xs=y=>{let a=prof[0];for(let i=0;i<prof.length;i++){if(prof[i][1]<=y)a=prof[i];}let b=prof.find(p=>p[1]>y)||a;return a[1]===b[1]?a[0]:a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);};
    const out=[],n=outline.length;
    for(let i=0;i<n;i++){out.push(outline[i]);const j=(i+1)%n,a=outline[i],b=outline[j];
      if(cuffFlag[i]&&!cuffFlag[j]&&Math.abs(a[0])<7.2&&Math.abs(b[0])<7.2&&b[1]>a[1]+0.3){const sg=Math.sign(a[0]);for(let y=a[1]+0.25;y<b[1]-0.1;y+=0.4)out.push([+(sg*(xs(y)+0.06)).toFixed(3),+y.toFixed(3)]);}
      if(!cuffFlag[i]&&cuffFlag[j]&&Math.abs(b[0])<7.2&&Math.abs(a[0])<7.2&&a[1]>b[1]+0.3){const sg=Math.sign(b[0]);for(let y=a[1]-0.25;y>b[1]+0.1;y-=0.4)out.push([+(sg*(xs(y)+0.06)).toFixed(3),+y.toFixed(3)]);}}
    outline=out;hem=Math.max(...outline.map(p=>p[1]));}
  fs.writeFileSync(path.join(__dirname,C.out),JSON.stringify({scale:B.scale,cx:B.cx,y0:B.y0,heightIn:+hem.toFixed(3),outline,holes,bottoms:prof,long_sleeve:{kx,ky,beltFigPx:C.beltFigPx,beltBaseIn:C.beltBaseIn,source:C.trace,cuff_shift_in:cuffShift,shoulder_to_cuff_in:+(Math.max(...outline.filter(p=>Math.abs(p[0])>7.4).map(p=>p[1]))-shoulderY).toFixed(2)}}));
  console.log(k,'ky',ky.toFixed(4),'hem',hem.toFixed(2),'pts',outline.length,'holes',holes.length,'profile',prof.length,prof.slice(0,3).map(p=>p.join(',')).join(' | '));
}
