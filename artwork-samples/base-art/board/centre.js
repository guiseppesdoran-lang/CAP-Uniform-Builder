// thin-strip loops (board/lines.js) -> centrelines: split each loop at its two farthest points, resample both chains, average.
const fs=require('fs');const [,,IN,OUTF]=process.argv;const d=JSON.parse(fs.readFileSync(IN,'utf8'));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const chainLen=c=>{let s=0;for(let i=1;i<c.length;i++)s+=dist(c[i],c[i-1]);return s;};
const resample=(c,n)=>{const L=chainLen(c),out=[];let acc=0,i=1,prev=c[0];out.push(c[0]);
  for(let k=1;k<n;k++){const target=L*k/(n-1);while(i<c.length-1&&acc+dist(prev,c[i])<target){acc+=dist(prev,c[i]);prev=c[i];i++;}
    const seg=dist(prev,c[i])||1,t=Math.min(1,(target-acc)/seg);out.push([prev[0]+(c[i][0]-prev[0])*t,prev[1]+(c[i][1]-prev[1])*t]);}
  return out;};
const paths=[];
for(const loop of d.loops){if(loop.length<4)continue;
  let bi=0,bj=0,bd=-1;for(let i=0;i<loop.length;i++)for(let j=i+1;j<loop.length;j++){const v=dist(loop[i],loop[j]);if(v>bd){bd=v;bi=i;bj=j;}}
  if(bd<10)continue;
  const a=loop.slice(bi,bj+1),b=loop.slice(bj).concat(loop.slice(0,bi+1)).reverse();
  const la=chainLen(a),lb=chainLen(b);if(Math.max(la,lb)/Math.max(1,Math.min(la,lb))>1.8)continue;   // ring-like (pocket outline) -> skipped
  const n=Math.max(4,Math.round(bd/6)),ra=resample(a,n),rb=resample(b,n);
  // thin strips only: the two chains stay close together
  let w=0;for(let k=0;k<n;k++)w=Math.max(w,dist(ra[k],rb[k]));if(w>9)continue;
  paths.push(ra.map((p,k)=>[+((p[0]+rb[k][0])/2).toFixed(1),+((p[1]+rb[k][1])/2).toFixed(1)]));}
fs.writeFileSync(OUTF,JSON.stringify({paths}));console.log('centrelines',paths.length);
