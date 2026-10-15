// Diagonal-stripe ribbons: find the stripe direction (structure tensor on the green channel), project every cell onto the
// perpendicular axis u, and segment that 1-D profile into runs. Output: {angle_deg, runs:[{u0,u1,hex}], units:'in'}  (u in inches
// measured from the ribbon centre along the stripe normal).   node measure-diagonal.js grid.json <raster path> out.json
const fs=require('fs');
const [,,GRID,PATH,OUT]=process.argv;
const G=JSON.parse(fs.readFileSync(GRID));const key=Object.keys(G).find(p=>p.endsWith(PATH));
const d=G[key],gw=d.gw,gh=d.gh,g=d.grid;
const px=(x,y,c)=>g[(y*gw+x)*3+c];
let jxx=0,jyy=0,jxy=0;
for(let y=1;y<gh-1;y++)for(let x=1;x<gw-1;x++){
  const gx=(px(x+1,y-1,1)+2*px(x+1,y,1)+px(x+1,y+1,1))-(px(x-1,y-1,1)+2*px(x-1,y,1)+px(x-1,y+1,1));
  const gy=(px(x-1,y+1,1)+2*px(x,y+1,1)+px(x+1,y+1,1))-(px(x-1,y-1,1)+2*px(x,y-1,1)+px(x+1,y-1,1));
  jxx+=gx*gx;jyy+=gy*gy;jxy+=gx*gy;}
const thetaG=0.5*Math.atan2(2*jxy,jxx-jyy);          // gradient direction (image coords, y down)
const alpha=thetaG+Math.PI/2;                         // stripe direction
const nx=Math.cos(thetaG),ny=Math.sin(thetaG);        // stripe normal
// u in cells from the image centre
const cx=gw/2,cy=gh/2,bins=new Map();
for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){const u=(x+0.5-cx)*nx+(y+0.5-cy)*ny,b=Math.round(u*2);
  const e=bins.get(b)||[0,0,0,0];e[0]+=px(x,y,0);e[1]+=px(x,y,1);e[2]+=px(x,y,2);e[3]++;bins.set(b,e);}
const keys=[...bins.keys()].sort((a,b)=>a-b);
// middle band only (corners have partial coverage): keep bins with >= 25 cells
const prof=keys.filter(k=>bins.get(k)[3]>=4).map(k=>({u:k/2,c:bins.get(k).slice(0,3).map(v=>v/bins.get(k)[3])}));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
// run-find with a two-colour assumption refined by k-means (k=2..3)
const cols=prof.map(p=>p.c);
let cs=[cols[0]];for(const c of cols)if(dist(c,cs[0])>90){cs.push(c);break;}
for(let it=0;it<10;it++){const s=cs.map(()=>[0,0,0,0]);cols.forEach(c=>{let b=0;cs.forEach((q,i)=>{if(dist(q,c)<dist(cs[b],c))b=i;});s[b][0]+=c[0];s[b][1]+=c[1];s[b][2]+=c[2];s[b][3]++;});cs=cs.map((q,i)=>s[i][3]?[s[i][0]/s[i][3],s[i][1]/s[i][3],s[i][2]/s[i][3]]:q);}
const lab=cols.map(c=>{let b=0;cs.forEach((q,i)=>{if(dist(q,c)<dist(cs[b],c))b=i;});return b;});
const runs=[];lab.forEach((l,i)=>{const u0=prof[i].u-0.25,u1=prof[i].u+0.25;if(runs.length&&runs[runs.length-1].l===l)runs[runs.length-1].u1=u1;else runs.push({l,u0,u1});});
// absorb 1-bin flickers
const m=[];for(const r of runs){if(m.length&&(r.u1-r.u0)<0.6){m[m.length-1].u1=r.u1;}else if(m.length&&m[m.length-1].l===r.l){m[m.length-1].u1=r.u1;}else m.push({...r});}
const hex=c=>c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const out={angle_deg:+(alpha*180/Math.PI).toFixed(2),cell_in:1/160,palette:cs.map(hex),runs:m.map(r=>({u0_in:+(r.u0/160).toFixed(5),u1_in:+(r.u1/160).toFixed(5),hex:hex(cs[r.l])}))};
const widths=out.runs.map(r=>r.u1_in-r.u0_in);
console.log(JSON.stringify({angle_deg:out.angle_deg,palette:out.palette,runs:out.runs.length,widths_in:widths.slice(0,8).map(w=>+w.toFixed(4))}));
fs.writeFileSync(OUT,JSON.stringify(out,null,1));
