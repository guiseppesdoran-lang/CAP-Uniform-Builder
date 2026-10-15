// Measure the size of each military device from the precomposed ribbon variants:
// diff a single-device variant against the same award's zero-device variant (both 100x30 = 1 3/8 x 3/8 in).
const fs=require('fs'),zlib=require('zlib'),path=require('path'),vm=require('vm');
const REPO=path.join(__dirname,'../../../..');
const sb={};vm.createContext(sb);sb.globalThis=sb;sb.window=sb;sb.self=sb;
vm.runInContext(fs.readFileSync(path.join(REPO,'military/military-data.js'),'utf8'),sb);
const R=sb.CAPUBMilitaryData.deviceVariants.ribbonAssets;
function dec(f){const b=fs.readFileSync(f);let p=8,W,H,ct,id=[];while(p<b.length){const l=b.readUInt32BE(p),t=b.toString('latin1',p+4,p+8),d=b.subarray(p+8,p+8+l);if(t==='IHDR'){W=d.readUInt32BE(0);H=d.readUInt32BE(4);ct=d[9];}else if(t==='IDAT')id.push(d);p+=12+l;}
  const ch={2:3,6:4}[ct];if(!ch)throw new Error('unsupported png type '+ct+' '+f);
  const raw=zlib.inflateSync(Buffer.concat(id)),st=W*ch,o=Buffer.alloc(H*st);
  for(let y=0;y<H;y++){const ft=raw[y*(st+1)];for(let x=0;x<st;x++){const v=raw[y*(st+1)+1+x],a=x>=ch?o[y*st+x-ch]:0,u=y?o[(y-1)*st+x]:0,c=(x>=ch&&y)?o[(y-1)*st+x-ch]:0;let r=v;
    if(ft===1)r=v+a;else if(ft===2)r=v+u;else if(ft===3)r=v+((a+u)>>1);else if(ft===4){const pp=a+u-c,pa=Math.abs(pp-a),pb=Math.abs(pp-u),pc=Math.abs(pp-c);r=v+(pa<=pb&&pa<=pc?a:pb<=pc?u:c);}o[y*st+x]=r&255;}}
  return {W,H,ch,o};}
const base={};
for(const r of R)if(r.devices.length===0&&!base[r.awardId])base[r.awardId]=r.asset;
const res={};
for(const r of R){
  if(r.devices.length!==1||!base[r.awardId])continue;
  const A=dec(path.join(REPO,base[r.awardId])),B=dec(path.join(REPO,r.asset));
  if(A.W!==B.W||A.H!==B.H)continue;
  let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<A.H;y++)for(let x=0;x<A.W;x++){const i=(y*A.W+x)*A.ch,j=(y*B.W+x)*B.ch;
    const d=Math.abs(A.o[i]-B.o[j])+Math.abs(A.o[i+1]-B.o[j+1])+Math.abs(A.o[i+2]-B.o[j+2]);
    if(d>60){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}}
  if(x1<0)continue;
  const dev=r.devices[0];(res[dev]=res[dev]||[]).push({award:r.awardId,w:x1-x0+1,h:y1-y0+1,cx:(x0+x1+1)/2,cy:(y0+y1+1)/2});
}
const out={};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
for(const [d,L] of Object.entries(res))out[d]={samples:L.length,w_px:med(L.map(l=>l.w)),h_px:med(L.map(l=>l.h)),
  w_in:+(med(L.map(l=>l.w))*1.375/100).toFixed(4),h_in:+(med(L.map(l=>l.h))*0.375/30).toFixed(4),
  center_x_frac:+(med(L.map(l=>l.cx))/100).toFixed(3),center_y_frac:+(med(L.map(l=>l.cy))/30).toFixed(3)};
fs.writeFileSync(path.join(__dirname,'../../devices/_military-device-sizes.json'),JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
