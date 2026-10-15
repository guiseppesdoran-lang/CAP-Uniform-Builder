// Procedural ribbon generator: stripe spec in, shaded PNG out. No dependencies.
const fs=require('fs'),zlib=require('zlib'),path=require('path');

const C={navy:'#0b1f5c',blue:'#1f4fb8',sky:'#4aa3e8',gold:'#f2b705',white:'#f4f4f0',red:'#b3122b',
  green:'#1f6b3a',olive:'#6b6b2a',black:'#161616',orange:'#e8761a',purple:'#5b2a86',silver:'#b8bcc2',
  maroon:'#6e1423',tan:'#c8b07a'};

// widths are relative units, left to right; each ribbon is symmetric by construction
const RIBBONS={
  air_medal_style:[['gold',2],['blue',1],['sky',6],['blue',1],['gold',2]].map(s=>s),
  achievement_style:[['navy',3],['white',1],['sky',4],['white',1],['navy',3]],
  valor_style:[['red',4],['white',1],['blue',6],['white',1],['red',4]],
  service_style:[['green',5],['gold',1],['white',1],['gold',1],['green',5]],
  meritorious_style:[['purple',3],['white',1],['gold',2],['white',1],['purple',3]],
  cadet_prof_style:[['olive',3],['black',1],['tan',6],['black',1],['olive',3]],
  commander_style:[['maroon',4],['silver',1],['navy',6],['silver',1],['maroon',4]],
  campaign_style:[['orange',2],['white',1],['black',2],['white',1],['orange',2]],
};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));

function render(spec,W,H,S){
  const w=W*S,h=H*S,total=spec.reduce((a,s)=>a+s[1],0);
  const cols=[];let acc=0;
  for(const [name,u] of spec){acc+=u;cols.push([acc/total,hex(C[name])]);}
  const px=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const fx=x/w;let base=cols[cols.length-1][1];
    for(const [edge,c] of cols){if(fx<edge){base=c;break;}}
    const ny=(y+0.5)/h*2-1;                        // -1..1
    let k=1.06-0.16*ny*ny;                          // gentle cylindrical sheen
    k+=0.025*Math.sin(y/S*Math.PI*2*1.5);           // fine horizontal ribs
    const ex=Math.min(x,w-1-x)/S,ey=Math.min(y,h-1-y)/S;
    const e=Math.min(ex,ey);
    if(e<1) k*=0.45+0.55*e;                         // dark 1px border
    else if(ex<2) k*=0.92;                          // soft side falloff
    const i=(y*w+x)*4;
    for(let c=0;c<3;c++)px[i+c]=Math.max(0,Math.min(255,Math.round(base[c]*k)));
    px[i+3]=255;
  }
  return {w,h,px};
}

const crcT=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcT[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);
  const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);}
function png({w,h,px}){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;px.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

const out=path.join(__dirname,'ribbons');
for(const [name,spec] of Object.entries(RIBBONS)){
  fs.writeFileSync(path.join(out,`${name}.png`),png(render(spec,100,30,1)));      // native size, matches images/ribbons
  fs.writeFileSync(path.join(out,`${name}@4x.png`),png(render(spec,100,30,4)));   // hi-res
}

// contact sheet: 2 columns x 4 rows of 4x ribbons on a dark ground
const names=Object.keys(RIBBONS),pad=24,cw=400,ch=120,cols2=2,rows=Math.ceil(names.length/cols2);
const SW=pad+cols2*(cw+pad),SH=pad+rows*(ch+pad);
const sheet={w:SW,h:SH,px:Buffer.alloc(SW*SH*4)};
for(let i=0;i<SW*SH;i++){sheet.px[i*4]=0x1a;sheet.px[i*4+1]=0x1d;sheet.px[i*4+2]=0x24;sheet.px[i*4+3]=255;}
names.forEach((n,idx)=>{
  const r=render(RIBBONS[n],100,30,4),ox=pad+(idx%cols2)*(cw+pad),oy=pad+Math.floor(idx/cols2)*(ch+pad);
  for(let y=0;y<ch;y++)r.px.copy(sheet.px,((oy+y)*SW+ox)*4,y*cw*4,(y+1)*cw*4);
});
fs.writeFileSync(path.join(__dirname,'ribbons-contact-sheet.png'),png(sheet));
console.log('wrote',names.length*2+1,'files');
