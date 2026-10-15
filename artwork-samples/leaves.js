// Count leaves + measure their angles on the reference wreath.
//  1) tips: radial residual of the outer silhouette -> one bump per leaf tip on the outer row
//  2) orientation: structure tensor along the band centreline -> stroke angle vs. the band tangent
const dec=require('./measure.js');
const {W,H,lum,alpha}=dec(process.argv[2]);
const CX=120,CY=126;
// ---- 1) outer silhouette by rays
const rays=[];
for(let deg=0;deg<=112;deg+=1){          // 0 = straight down, increasing toward the left side, up
  const a=deg*Math.PI/180;let r=0;
  for(let rr=40;rr<140;rr+=0.25){const x=CX-rr*Math.sin(a),y=CY+rr*Math.cos(a);
    const xi=Math.round(x),yi=Math.round(y);if(xi<0||yi<0||xi>=W||yi>=H)continue;if(alpha[yi*W+xi]>100)r=rr;}
  rays.push(r);}
const sm=rays.map((_,i)=>{let s=0,n=0;for(let k=-12;k<=12;k++){const j=i+k;if(j>=0&&j<rays.length&&rays[j]>0){s+=rays[j];n++;}}return s/n;});
const res=rays.map((r,i)=>r-sm[i]);
const peaks=[];
for(let i=2;i<res.length-2;i++)if(res[i]>=res[i-1]&&res[i]>res[i+1]&&res[i]>res[i-2]&&res[i]>res[i+2]&&res[i]>0.35)peaks.push(i);
console.log('outer-edge radial residual peaks (deg from straight-down, residual px):');
console.log(peaks.map(i=>i+'°('+res[i].toFixed(1)+')').join('  '));
console.log('tip count on left side (rows of outer leaves):',peaks.length);
// ---- 2) orientation field
const g=(x,y)=>lum[Math.max(0,Math.min(H-1,y))*W+Math.max(0,Math.min(W-1,x))];
const gx=new Float32Array(W*H),gy=new Float32Array(W*H);
for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  gx[y*W+x]=(g(x+1,y-1)+2*g(x+1,y)+g(x+1,y+1))-(g(x-1,y-1)+2*g(x-1,y)+g(x-1,y+1));
  gy[y*W+x]=(g(x-1,y+1)+2*g(x,y+1)+g(x+1,y+1))-(g(x-1,y-1)+2*g(x,y-1)+g(x+1,y-1));}
const E={a:90,cy:122,up:58,low:60};          // approximate band centreline
const pt=(deg)=>{const a=deg*Math.PI/180,s=Math.cos(a),b=s>=0?E.low:E.up;return [CX-E.a*Math.sin(a),E.cy+b*s];};
console.log('\n deg   x     y    stroke-angle  tangent   rel   coherence');
const rel=[];
for(let deg=0;deg<=100;deg+=5){
  const [x,y]=pt(deg),[x2,y2]=pt(deg+1);
  const tang=Math.atan2(y2-y,x2-x)*180/Math.PI;
  let jxx=0,jyy=0,jxy=0;const R=6;
  for(let yy=Math.round(y)-R;yy<=Math.round(y)+R;yy++)for(let xx=Math.round(x)-R;xx<=Math.round(x)+R;xx++){
    if(xx<0||yy<0||xx>=W||yy>=H||alpha[yy*W+xx]<100)continue;
    const a=gx[yy*W+xx],b=gy[yy*W+xx];jxx+=a*a;jyy+=b*b;jxy+=a*b;}
  const th=0.5*Math.atan2(2*jxy,jxx-jyy)*180/Math.PI+90;     // edge (stroke) direction
  const coh=Math.sqrt((jxx-jyy)**2+4*jxy*jxy)/(jxx+jyy+1e-9);
  let d=((th-tang+90)%180+180)%180-90;rel.push(d);
  console.log(String(deg).padStart(4),x.toFixed(0).padStart(5),y.toFixed(0).padStart(5),th.toFixed(0).padStart(10),tang.toFixed(0).padStart(9),d.toFixed(0).padStart(6),coh.toFixed(2).padStart(9));}

// ---- 3) leaf outlines: dark-line crossings along curves running parallel to the outer edge
console.log('\ndark-outline crossings along offset curves (deg from straight-down):');
for(const off of [6,12,18,24,30]){
  const prof=[];
  for(let d10=0;d10<=1100;d10+=2){const deg=d10/10,a=deg*Math.PI/180,i=Math.round(deg);
    const r=(rays[Math.min(rays.length-1,i)]||0)-off;
    const x=CX-r*Math.sin(a),y=CY+r*Math.cos(a);
    const xi=Math.round(x),yi=Math.round(y);
    prof.push([deg,(xi>=0&&yi>=0&&xi<W&&yi<H)?lum[yi*W+xi]:255]);}
  const s=prof.map((p,i)=>{let t=0,n=0;for(let k=-2;k<=2;k++){const j=i+k;if(j>=0&&j<prof.length){t+=prof[j][1];n++;}}return t/n;});
  const mins=[];
  for(let i=4;i<s.length-4;i++){
    if(s[i]<=s[i-1]&&s[i]<s[i+1]){
      let lo=i,hi=i;let lmax=s[i],rmax=s[i];
      for(let k=1;k<=8&&i-k>=0;k++)lmax=Math.max(lmax,s[i-k]);
      for(let k=1;k<=8&&i+k<s.length;k++)rmax=Math.max(rmax,s[i+k]);
      const depth=Math.min(lmax,rmax)-s[i];
      if(depth>14&&(!mins.length||prof[i][0]-mins[mins.length-1][0]>3.5))mins.push([prof[i][0],depth]);}}
  console.log('offset',String(off).padStart(2),'px  n='+mins.length+'  ',mins.map(m=>m[0].toFixed(0)).join(' '));
}
