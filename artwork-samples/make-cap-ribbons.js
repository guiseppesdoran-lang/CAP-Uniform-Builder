// CAP ribbons at the physical 1 3/8" x 3/8" proportion (11:3), from cap-ribbons/specs.json.
//   svg/<id>.svg      flat vector, 110x30 viewBox, stripes at exact fractional positions
//   png/<id>.png      110x30 raster with the app's subtle sheen + edge shading
//   png@4x/<id>.png   440x120 of the same
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const dir=path.join(__dirname,'cap-ribbons');
const specs=JSON.parse(fs.readFileSync(path.join(dir,'specs.json'))).ribbons;
for(const d of ['svg','png','png@4x'])fs.mkdirSync(path.join(dir,d),{recursive:true});
const hex=h=>[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
const PW=110,PH=30;

function starPts(cx,cy,r){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*0.382:r;p.push([cx+rr*Math.cos(a),cy+rr*Math.sin(a)]);}return p;}
function inPoly(p,x,y){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;}return c;}
function segDist(p,x,y){let m=1e9;for(let i=0,j=p.length-1;i<p.length;j=i++){const ax=p[j][0],ay=p[j][1],bx=p[i][0],by=p[i][1],dx=bx-ax,dy=by-ay;let t=((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy);t=Math.max(0,Math.min(1,t));m=Math.min(m,Math.hypot(ax+t*dx-x,ay+t*dy-y));}return m;}
function bitmapRects(r,sx,sy){let out='';r.bitmap.rows.forEach((row,y)=>{let x=0;row.forEach(([h,n])=>{if(h!==r.bitmap.bg)out+=`<rect x="${(x*sx).toFixed(3)}" y="${(y*sy).toFixed(3)}" width="${(n*sx).toFixed(3)}" height="${sy}" fill="#${h}"/>`;x+=n;});});return out;}
function deviceSvg(r){return (r.devices||[]).map(d=>`<polygon points="${starPts(d.cx,d.cy,d.r).map(p=>p[0].toFixed(2)+','+p[1].toFixed(2)).join(' ')}" fill="#${d.fill}" stroke="#${d.stroke}" stroke-width=".7" stroke-linejoin="round"/>`).join('');}
function bounds(stripes,W){let acc=0;return stripes.map(s=>{const a=acc;acc+=s.frac;return [a*W,Math.min(W,acc*W)];});}
function svg(r){
  let x=0,out='';
  const b=bounds(r.stripes,PW);
  if(r.bitmap){const bg=r.bitmap.rows[0][0][0];r.bitmap.bg=bg;out+=`<rect width="${PW}" height="${PH}" fill="#${bg}"/>`+bitmapRects(r,PW/r.bitmap.width,PH/r.bitmap.height);}
  else r.stripes.forEach((s,i)=>{out+=`<rect x="${b[i][0].toFixed(3)}" y="0" width="${(b[i][1]-b[i][0]).toFixed(3)}" height="${PH}" fill="#${s.hex}"/>`;});
  out+=(r.paths||[]).map(p=>`<path d="${p.rings.map(rg=>'M'+rg.map(q=>q[0]+','+q[1]).join('L')+'Z').join('')}" fill="#${p.fill}" fill-rule="evenodd"/>`).join('');
  out+=deviceSvg(r);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" shape-rendering="crispEdges"><title>${r.name.replace(/&/g,'&amp;')}</title>${out}</svg>`;
}
function render(r,S){
  const w=PW*S,h=PH*S,px=Buffer.alloc(w*h*4),b=bounds(r.stripes,w),cols=r.stripes.map(s=>hex(s.hex));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let k=0;for(;k<b.length-1;k++)if(x+0.5<b[k][1])break;
    let base=cols[k];
    if(r.bitmap){const bx=Math.min(r.bitmap.width-1,Math.floor((x+0.5)/w*r.bitmap.width)),by=Math.min(r.bitmap.height-1,Math.floor((y+0.5)/h*r.bitmap.height));
      let xx=0;for(const [hh,n] of r.bitmap.rows[by]){if(bx<xx+n){base=hex(hh);break;}xx+=n;}}
    const ny=(y+0.5)/h*2-1;
    let f=1.05-0.12*ny*ny+0.02*Math.sin(y/S*Math.PI*3);
    const e=Math.min(Math.min(x,w-1-x),Math.min(y,h-1-y))/S;
    if(e<1)f*=0.55+0.45*e;
    const i=(y*w+x)*4;
    let col=base.map(v=>v*f);
    for(const p of (r.paths||[])){let inside=false;for(const rg of p.rings)if(inPoly(rg.map(q=>[q[0]*S,q[1]*S]),x+0.5,y+0.5))inside=!inside;if(inside)col=hex(p.fill).map(v=>v*f);}
    for(const d of (r.devices||[])){const P=starPts(d.cx*S,d.cy*S,d.r*S);
      if(inPoly(P,x+0.5,y+0.5)){const edge=segDist(P,x+0.5,y+0.5)<0.55*S;const c=hex(edge?d.stroke:d.fill);const shade=0.92+0.1*(1-(y/h));col=c.map(v=>v*(edge?1:shade));}}
    for(let c=0;c<3;c++)px[i+c]=Math.max(0,Math.min(255,Math.round(col[c])));
    px[i+3]=255;
  }
  return {w,h,px};
}
const T=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=T[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
function png({w,h,px}){const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;px.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
for(const r of specs){
  fs.writeFileSync(path.join(dir,'svg',r.id+'.svg'),svg(r));
  fs.writeFileSync(path.join(dir,'png',r.id+'.png'),png(render(r,1)));
  fs.writeFileSync(path.join(dir,'png@4x',r.id+'.png'),png(render(r,4)));
}
// contact sheet (SVG, rendered to PNG separately): 5 columns, square canvas for qlmanage
const cols=5,cw=232,ch=64,lab=26,pad=20;
const rows=Math.ceil(specs.length/cols),H=pad+rows*(ch+lab+8);
const size=Math.max(cols*cw+pad*2,H);
let cells='';
specs.forEach((r,i)=>{
  const x=pad+(i%cols)*cw,y=pad+Math.floor(i/cols)*(ch+lab+8);
  const b=bounds(r.stripes,200);
  let inner=r.stripes.map((s,k)=>`<rect x="${b[k][0].toFixed(2)}" y="0" width="${(b[k][1]-b[k][0]).toFixed(2)}" height="54.5" fill="#${s.hex}"/>`).join('');
  if(r.bitmap){inner=`<rect width="200" height="54.5" fill="#${r.bitmap.rows[0][0][0]}"/>`+bitmapRects(r,200/r.bitmap.width,54.5/r.bitmap.height);}
  inner+=(r.paths||[]).map(p=>`<path d="${p.rings.map(rg=>'M'+rg.map(q=>(q[0]/110*200).toFixed(1)+','+(q[1]/30*54.5).toFixed(1)).join('L')+'Z').join('')}" fill="#${p.fill}" fill-rule="evenodd"/>`).join('');
  inner+=(r.devices||[]).map(d=>`<polygon points="${starPts(d.cx/110*200,27.25,d.r*1.8).map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="#${d.fill}" stroke="#${d.stroke}" stroke-width="1" stroke-linejoin="round"/>`).join('');
  const src=r.source.startsWith('CAPR')?'':' *';
  cells+=`<g transform="translate(${x} ${y})"><g shape-rendering="crispEdges">${inner}</g><rect x=".5" y=".5" width="199" height="53.5" fill="none" stroke="#000" stroke-opacity=".5"/>`
    +`<text x="0" y="68" font-family="Arial,Helvetica,sans-serif" font-size="9" fill="#d8dce2">${r.name.replace(/&/g,'&amp;').slice(0,38)}${src}</text></g>`;
});
fs.writeFileSync(path.join(dir,'contact-sheet.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#1a1d24"/>${cells}</svg>`);
console.log('ribbons',specs.length,'sheet',size);
