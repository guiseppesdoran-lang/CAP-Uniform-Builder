// Derive each award's BASE ribbon from its precomposed variants (McChord-style 100x30 PNGs).
// Devices sit in the middle rows, so the stripes are read from the top and bottom bands only (rows 1-6 and 23-28),
// using the brighter row parity (the art carries dark scanlines). Output: variant-bases.json
const fs=require('fs'),zlib=require('zlib'),path=require('path'),vm=require('vm');
const REPO=path.join(__dirname,'../../../..');
const sb={};vm.createContext(sb);sb.globalThis=sb;sb.window=sb;sb.self=sb;
vm.runInContext(fs.readFileSync(path.join(REPO,'military/military-data.js'),'utf8'),sb);
const RA=sb.CAPUBMilitaryData.deviceVariants.ribbonAssets;
function dec(f){const b=fs.readFileSync(f);let p=8,W,H,ct,id=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+l);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);p+=12+l;}
  const ch={2:3,6:4}[ct];if(!ch)throw new Error('png type '+ct+' '+f);
  const raw=zlib.inflateSync(Buffer.concat(id)),st=W*ch,o=Buffer.alloc(H*st);
  for(let y=0;y<H;y++){const ft=raw[y*(st+1)];for(let x=0;x<st;x++){const v=raw[y*(st+1)+1+x],a=x>=ch?o[y*st+x-ch]:0,u=y?o[(y-1)*st+x]:0,c=(x>=ch&&y)?o[(y-1)*st+x-ch]:0;let r=v;
    if(ft===1)r=v+a;else if(ft===2)r=v+u;else if(ft===3)r=v+((a+u)>>1);else if(ft===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}o[y*st+x]=r&255;}}
  return {W,H,ch,o};}
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function segment(cols,T=34,T2=26,minFrac=0.014){
  const minW=Math.max(2,Math.round(cols.length*minFrac)),mean=r=>r.sum.map(v=>v/r.n);
  let runs=[],cur={a:0,b:0,sum:[...cols[0]],n:1};
  for(let x=1;x<cols.length;x++){const m=mean(cur);
    if(dist(cols[x],m)>T&&(x+1>=cols.length||dist(cols[x+1],m)>T*0.8)){cur.b=x-1;runs.push(cur);cur={a:x,b:x,sum:[...cols[x]],n:1};}
    else{cur.b=x;cur.n++;for(let k=0;k<3;k++)cur.sum[k]+=cols[x][k];}}
  cur.b=cols.length-1;runs.push(cur);
  let ch=true;while(ch&&runs.length>1){ch=false;
    for(let i=0;i<runs.length;i++){if(runs[i].b-runs[i].a+1<minW){const L=runs[i-1],R=runs[i+1],m=mean(runs[i]);
      const t=(L&&R)?(dist(m,mean(L))<=dist(m,mean(R))?L:R):(L||R);if(!t)continue;
      t.a=Math.min(t.a,runs[i].a);t.b=Math.max(t.b,runs[i].b);t.n+=runs[i].n;for(let k=0;k<3;k++)t.sum[k]+=runs[i].sum[k];runs.splice(i,1);ch=true;break;}}}
  for(let i=0;i<runs.length-1;){if(dist(mean(runs[i]),mean(runs[i+1]))<T2){const r=runs[i],s=runs[i+1];r.b=s.b;r.n+=s.n;for(let k=0;k<3;k++)r.sum[k]+=s.sum[k];runs.splice(i+1,1);}else i++;}
  return runs.map(r=>({a:r.a,b:r.b,rgb:mean(r)}));}
const hex=c=>c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const byAward={};
for(const v of RA){(byAward[v.awardId]=byAward[v.awardId]||[]).push(v);}
const out={};
for(const [aw,list] of Object.entries(byAward)){
  const seen=new Set(),sigs=[];
  for(const v of list){
    if(seen.has(v.asset))continue;seen.add(v.asset);
    const f=path.join(REPO,v.asset);if(!fs.existsSync(f))continue;
    const im=dec(f),W=im.W;
    const rowsFor=p=>[...[1,2,3,4,5,6],...[23,24,25,26,27,28]].filter(y=>y%2===p&&y<im.H);
    const lum=rows=>rows.reduce((s,y)=>{for(let x=0;x<W;x++){const i=(y*W+x)*im.ch;s+=im.o[i]+im.o[i+1]+im.o[i+2];}return s;},0);
    const p=lum(rowsFor(0))>=lum(rowsFor(1))?0:1,rows=rowsFor(p);
    const cols=[];for(let x=0;x<W;x++){let r=0,g=0,b=0;for(const y of rows){const i=(y*W+x)*im.ch;r+=im.o[i];g+=im.o[i+1];b+=im.o[i+2];}cols.push([r/rows.length,g/rows.length,b/rows.length]);}
    const runs=segment(cols);
    sigs.push({asset:v.asset,devices:v.devices.length,runs:runs.map(r=>({x0:r.a/W,x1:(r.b+1)/W,hex:hex(r.rgb)}))});
  }
  if(!sigs.length)continue;
  // representative = the signature with the most agreeing peers (same run count, fractions within 0.03, colours within 40)
  const agree=(a,b)=>a.runs.length===b.runs.length&&a.runs.every((r,i)=>Math.abs((r.x1-r.x0)-(b.runs[i].x1-b.runs[i].x0))<0.03&&dist(parseInt(r.hex,16)&&[0,2,4].map(k=>parseInt(r.hex.slice(k,k+2),16)),[0,2,4].map(k=>parseInt(b.runs[i].hex.slice(k,k+2),16)))<40);
  let best=sigs[0],bn=-1;for(const s of sigs){const n=sigs.filter(t=>agree(s,t)).length;if(n>bn){bn=n;best=s;}}
  out[aw]={variants_measured:sigs.length,agreeing:bn,consistent:bn===sigs.length,runs:best.runs,source_images:sigs.slice(0,3).map(s=>s.asset)};
}
fs.writeFileSync(path.join(__dirname,'../../ribbons/military/variant-bases.json'),JSON.stringify(out,null,1));
const arr=Object.entries(out);
console.log('awards with variants',arr.length,'consistent',arr.filter(a=>a[1].consistent).length);
console.log('inconsistent:',arr.filter(a=>!a[1].consistent).map(a=>a[0]+' '+a[1].agreeing+'/'+a[1].variants_measured).join(', '));
