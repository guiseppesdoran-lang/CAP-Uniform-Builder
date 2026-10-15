// node fix-floaters.js <svg> [<svg>...] : render each flat svg in Chrome on magenta at 4 px/unit, find connected components of the art
// (>= 0.3% of art area), and bridge every floating component to the main body with a small mount (silver fill, outline on the long sides),
// overlapping both by ~1.5 units. Edits the file in place; prints what it did. Idempotent (a bridged file has one component).
const fs=require('fs'),cp=require('child_process'),path=require('path');
const dec=require('/Users/ethan/UniformBuilder/artwork-samples/base-art/board/dec.js');
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',K=+(process.env.K||2),FILL='#dfe3ea',LINE='#3d4756';
for(const f of process.argv.slice(2)){
  let s=fs.readFileSync(f,'utf8');const vb=s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number),W=Math.round(vb[2]*K),H=Math.round(vb[3]*K);
  const tmp=`/private/tmp/ff_${path.basename(f,'.svg')}`;
  const render=()=>{fs.writeFileSync(tmp+'.html',`<html><body style="margin:0;width:${W}px;height:${H}px;background:#ff00ff"><img src="file://${path.resolve(f)}" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px"></body></html>`);
    cp.spawnSync(CH,['--headless=new','--disable-gpu','--allow-file-access-from-files','--hide-scrollbars',`--window-size=${W},${H}`,`--screenshot=${tmp}.png`,'--default-background-color=ff00ff',`file://${tmp}.html`],{stdio:'ignore'});
    return dec(tmp+'.png');};
  const comps=im=>{const isBg=(x,y)=>{const i=y*im.st+x*im.ch;return Math.abs(im.out[i]-255)<40&&im.out[i+1]<60&&Math.abs(im.out[i+2]-255)<40;};
    const lab=new Int32Array(W*H).fill(-1),cs=[];
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(lab[y*W+x]>=0||isBg(x,y))continue;const id=cs.length,st=[[x,y]];lab[y*W+x]=id;const pts=[];
      while(st.length){const [cx,cy]=st.pop();pts.push([cx,cy]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=W||ny>=H||lab[ny*W+nx]>=0||isBg(nx,ny))continue;lab[ny*W+nx]=id;st.push([nx,ny]);}}
      cs.push(pts);}
    return cs;};
  let im=render();if(!im){console.log(f,'render failed');continue;}
  let cs=comps(im);const tot=cs.reduce((a,c)=>a+c.length,0);cs.sort((a,b)=>b.length-a.length);
  const main=cs[0],fl=cs.slice(1).filter(c=>c.length>=tot*0.003);
  if(!fl.length){console.log(f,'ok (1 component)');continue;}
  // main boundary sample for nearest search
  const mset=new Set(main.map(p=>p[1]*W+p[0])),mb=main.filter(([x,y])=>!(mset.has(y*W+x-1)&&mset.has(y*W+x+1)&&mset.has((y-1)*W+x)&&mset.has((y+1)*W+x)));
  let add='',mc=0;
  for(const c of fl){
    const cset=new Set(c.map(p=>p[1]*W+p[0])),cb=c.filter(([x,y])=>!(cset.has(y*W+x-1)&&cset.has(y*W+x+1)&&cset.has((y-1)*W+x)&&cset.has((y+1)*W+x)));
    let best=1e18,p=null,q=null;for(const a of cb){if((a[0]+a[1])%2)continue;for(const b of mb){const d=(a[0]-b[0])**2+(a[1]-b[1])**2;if(d<best){best=d;p=a;q=b;}}}
    const xs=c.map(a=>a[0]),ys=c.map(a=>a[1]),cw=(Math.max(...xs)-Math.min(...xs)+1)/K,ch=(Math.max(...ys)-Math.min(...ys)+1)/K;
    const gapU=Math.sqrt(best)/K;if(c.length>tot*0.12&&gapU>3){console.log(f,'SKIP large component',(100*c.length/tot).toFixed(1)+'% gap',gapU.toFixed(1),'(needs a manual look)');continue;}
    if(gapU>8){console.log(f,'SKIP gap',(Math.sqrt(best)/K).toFixed(1),'units');continue;}
    const px=p[0]/K+vb[0],py=p[1]/K+vb[1],qx=q[0]/K+vb[0],qy=q[1]/K+vb[1];let dx=qx-px,dy=qy-py;const L=Math.hypot(dx,dy)||1;
    // direction: if the nearest points coincide/touch, mount straight down (stars sit on top of the badge)
    if(L<0.8){dx=0;dy=1;}else{dx/=L;dy/=L;}
    const ex=1.6,ax=px-dx*ex,ay=py-dy*ex,bx=qx+dx*ex,by=qy+dy*ex,w=Math.max(4,Math.min(cw,ch)*0.32),nx=-dy*w/2,ny=dx*w/2;
    const P=[[ax+nx,ay+ny],[bx+nx,by+ny],[bx-nx,by-ny],[ax-nx,ay-ny]].map(v=>v.map(n=>+n.toFixed(2)));
    add+=`<g id="${path.basename(f,'.svg')}__mount${mc++}"><path d="M${P[0]}L${P[1]}L${P[2]}L${P[3]}Z" fill="${FILL}" stroke="none"/><path d="M${P[0]}L${P[1]}M${P[3]}L${P[2]}" fill="none" stroke="${LINE}" stroke-width="0.8" stroke-linecap="round"/></g>`;
    console.log(f,'bridged component',(100*c.length/tot).toFixed(1)+'% gap',(Math.sqrt(best)/K).toFixed(2),'units');
  }
  if(!add){continue;}
  s=s.replace(/<\/svg>\s*$/,add+'</svg>');fs.writeFileSync(f,s);
  const im2=render(),c2=comps(im2),t2=c2.reduce((a,c)=>a+c.length,0);console.log('  after:',c2.filter(c=>c.length>=t2*0.003).length,'component(s)');
}
