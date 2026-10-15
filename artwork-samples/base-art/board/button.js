// Button detail measured from rendered photos: contour loops of brightness level sets inside the button disc (marching squares -> RDP).
const fs=require('fs'),dec=require('./dec.js');
function levels(file,cx,cy,r,levs,eps){
  const d=dec(file),{W,H,st,ch,out}=d;
  const v=(x,y)=>{if(x<0||y<0||x>=W||y>=H)return 0;const i=y*st+x*ch;return Math.max(out[i],out[i+1],out[i+2]);};
  const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
  const rdp=(pts,e)=>{if(pts.length<3)return pts;let dm=0,ix=0;const a=pts[0],b=pts[pts.length-1];
    for(let i=1;i<pts.length-1;i++){const p=pts[i],num=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1])),den=Math.hypot(b[0]-a[0],b[1]-a[1])||1,dd=num/den;if(dd>dm){dm=dd;ix=i;}}
    if(dm>e)return rdp(pts.slice(0,ix+1),e).slice(0,-1).concat(rdp(pts.slice(ix),e));return [a,b];};
  const res={};
  for(const [name,test] of Object.entries(levs)){if(typeof test!=='function')continue;
    const mk=(x,y)=>(Math.hypot(x-cx,y-cy)<r&&test(v(x,y)))?1:0,segs=[];
    for(let y=Math.floor(cy-r)-1;y<=cy+r+1;y++)for(let x=Math.floor(cx-r)-1;x<=cx+r+1;x++){
      const a=mk(x,y),b=mk(x+1,y),c=mk(x+1,y+1),dd=mk(x,y+1),idx=a*8+b*4+c*2+dd;if(idx===0||idx===15)continue;
      const T=[x+.5,y],Rg=[x+1,y+.5],Bt=[x+.5,y+1],Lf=[x,y+.5],add=(p,q)=>segs.push([p,q]);
      switch(idx){case 1:add(Lf,Bt);break;case 2:add(Bt,Rg);break;case 3:add(Lf,Rg);break;case 4:add(T,Rg);break;case 5:add(T,Lf);add(Bt,Rg);break;case 6:add(T,Bt);break;case 7:add(T,Lf);break;case 8:add(T,Lf);break;case 9:add(T,Bt);break;case 10:add(T,Rg);add(Lf,Bt);break;case 11:add(T,Rg);break;case 12:add(Lf,Rg);break;case 13:add(Bt,Rg);break;case 14:add(Lf,Bt);break;}}
    const m=new Map(),kk=p=>p[0]+','+p[1];segs.forEach((s,i)=>{for(const p of s){const k=kk(p);if(!m.has(k))m.set(k,[]);m.get(k).push(i);}});
    const used=new Uint8Array(segs.length),loops=[];
    for(let i=0;i<segs.length;i++){if(used[i])continue;used[i]=1;const lp=[segs[i][0],segs[i][1]];
      for(;;){const last=lp[lp.length-1],nx=(m.get(kk(last))||[]).find(j=>!used[j]);if(nx===undefined)break;used[nx]=1;const s=segs[nx];lp.push(kk(s[0])===kk(last)?s[1]:s[0]);}
      if(Math.abs(area(lp))<(levs.minArea||3))continue;const s=rdp(lp.length>3?lp.slice(0,-1):lp,eps);if(s.length>=3)loops.push(s.map(p=>[+p[0].toFixed(2),+p[1].toFixed(2)]));}
    res[name]=loops;}
  return res;}
const REPO='/Users/ethan/UniformBuilder/images/';
const SC='/private/tmp/claude-501/-Users-ethan-UniformBuilder/9323bfba-9528-4466-902d-f47b5f04de0d/scratchpad/blues/';
// board button: centre/radius fitted earlier (146,93,r36); three tone levels
const bb=levels(SC+'board_ref.png',146,93,31,{hi:v=>v>150,mid:v=>v>112&&v<=150,dark:v=>v<=112},0.45);
// coat button (581x719 base): centre (288.1,287.7), r 10.5; features darker than the silver disc
const bb2=levels(SC+'board_ref.png',146,93,31,{hi:v=>v>150,minArea:10},0.6);
const cb=levels(SC+'jacket_male.png',288.1,287.7,10.2,{dark:v=>v<190,bright:v=>v>=225},0.3);
fs.writeFileSync('buttons.json',JSON.stringify({board:{cx:146,cy:93,r:36,loops:{...bb,hiBig:bb2.hi}},coat:{cx:288.1,cy:287.7,rx:11,ry:10,loops:cb}}));
console.log('board',Object.fromEntries(Object.entries(bb).map(([k,v])=>[k,v.length])),'coat',Object.fromEntries(Object.entries(cb).map(([k,v])=>[k,v.length])));
