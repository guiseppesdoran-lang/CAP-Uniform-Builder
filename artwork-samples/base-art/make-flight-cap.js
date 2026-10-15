// MEN'S flight cap (USAF-style, side view, wearer's-left flap toward the viewer) for CAPR 39-1 section 6.2.2 / Attachment 5 "FLIGHT CAPS" (p.139, the men's page; the women's cap is Fig A5-9 on p.140, ids hat-flight-cap-women-*).
// Geometry is MEASURED from the regulation figure rendered at 2x (board/flightcap/*_rows.json = per-row navy extents of each cap),
// scaled by the figure's own "1 1/2 in" dimension marks (99.5 px = 1.5 in, 66.3 px/in). The figure caps differ slightly in height,
// so each variant keeps its own measured outline. Devices are NOT drawn: the cap exposes the device slot (6.2.2.2: front left flap,
// halfway between braid and bottom of the flap, 1.5 in back from the front of the cap).
const fs=require('fs'),path=require('path');
const here=__dirname,OUTDIR=path.join(here,'..','assets','accessories'),U=100,PXIN=66.3,NAVY='#071b4e';
fs.mkdirSync(OUTDIR,{recursive:true});
const f=n=>(+n).toFixed(3),esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const rdp=(p,e)=>{if(p.length<3)return p;const [a,b]=[p[0],p[p.length-1]];let m=0,k=0;const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
  for(let i=1;i<p.length-1;i++){const d=Math.abs(dy*(p[i][0]-a[0])-dx*(p[i][1]-a[1]))/L;if(d>m){m=d;k=i;}}
  return m>e?[...rdp(p.slice(0,k+1),e).slice(0,-1),...rdp(p.slice(k),e)]:[a,b];};
const VARIANTS=[
 {id:'hat-flight-cap-men-general',rows:'general_rows.json',braid:'silver',name:"Men's flight cap, general officer (solid silver braid)",who:'Major General and Brigadier General (CAPR 39-1 6.2.2.2.4)'},
 {id:'hat-flight-cap-men-officer',rows:'officer_rows.json',braid:'silverblue',name:"Men's flight cap, officer (silver and blue braid)",who:'Field grade, company grade and flight officers (6.2.2.2.5)'},
 {id:'hat-flight-cap-men-cadet',rows:'cadet_rows.json',braid:'blue',name:"Men's flight cap, NCO / cadet (plain blue with blue braid)",who:'Senior member NCOs, cadet officers, cadet NCOs and airmen (6.2.2.2.6, Attachment 5)'}];
const out={};
for(const V of VARIANTS){
  const {rows}=JSON.parse(fs.readFileSync(path.join(here,'board','flightcap',V.rows),'utf8'));
  const R0=rows.filter(r=>r[2]-r[1]>40).slice(4),yt=R0[0][0],yb=R0[R0.length-1][0],byPx=yt+(yb-yt)*0.33;
  const R=R0.filter(r=>Math.abs(r[0]-byPx)>12);  // the braid's silver pixels eat the edge rows around it: bridge across them
  const x0=Math.min(...R.map(r=>r[1])),x1=Math.max(...R.map(r=>r[2])),y0=R[0][0],y1=R[R.length-1][0];
  // dashed-mark front line sits ~4 px ahead of the navy front edge in the figure: the front of the cap is the leftmost navy pixel
  const PAD=0.12,X=px=>(px-x0)/PXIN+PAD,Y=py=>(py-y0)/PXIN+PAD;
  const W=(x1-x0)/PXIN+2*PAD,H=(y1-y0)/PXIN+2*PAD;
  const left=R.map(r=>[X(r[1]),Y(r[0])]),right=R.map(r=>[X(r[2]+1),Y(r[0])]).reverse();
  const poly=[...rdp(left,0.035),...rdp(right,0.035)];
  const D='M'+poly.map(p=>f(p[0])+','+f(p[1])).join('L')+'Z';
  // local top/bottom at a given x (inches)
  const lt=x=>{let b=1e9,t=-1e9;for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length];if((a[0]-x)*(c[0]-x)<=0&&a[0]!==c[0]){const y=a[1]+(c[1]-a[1])*(x-a[0])/(c[0]-a[0]);b=Math.min(b,y);t=Math.max(t,y);}}return [b,t];};
  const bx0=0,bx1=W,pts=[];
  const [tm,bm]=lt(W/2),by=tm+(bm-tm)*0.33;for(let i=0;i<=24;i++){const x=bx0+(bx1-bx0)*i/24;pts.push([x,by]);}
  const BP='M'+pts.map(p=>f(p[0])+','+f(p[1])).join('L');
  const bt=V.braid==='blue'?0.1:0.13;
  let br=`<path d="${BP}" fill="none" stroke="${V.braid==='silver'?'#c9cdd6':V.braid==='silverblue'?'#2a4a98':'#14337f'}" stroke-width="${bt}" stroke-linecap="butt"/>`;
  if(V.braid==='silver')br+=`<path d="${BP}" fill="none" stroke="#f1f3f7" stroke-width="${bt*0.35}" transform="translate(0 -0.025)"/>`;
  if(V.braid==='silverblue')br+=`<path d="${BP}" fill="none" stroke="#dfe3ea" stroke-width="${bt*0.8}" stroke-dasharray="0.07 0.07"/>`;
  const dsx=PAD+1.5,[dt,db]=lt(dsx),bY=by,slotY=(bY+db)/2;
  const body=`<defs><clipPath id="clip"><path d="${D}"/></clipPath><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient></defs>`
   +`<g id="cap"><path id="body" d="${D}" fill="${NAVY}" stroke="#03112f" stroke-width=".03" stroke-linejoin="round"/>`
   +`<g clip-path="url(#clip)"><rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="url(#shade)"/><g id="braid"><title>${V.braid==='silver'?'Solid silver braid':V.braid==='silverblue'?'Silver and blue braid':'Blue braid'} along the overlapping edge</title>${br}</g></g></g>`
   +`<rect id="device-slot" x="${f(dsx-0.5)}" y="${f(slotY-0.5)}" width="1" height="1" fill="none"><title>Cap device slot: front left flap, halfway between braid and bottom of the flap, 1.5 in back from the front of the cap (CAPR 39-1 6.2.2.2)</title></rect>`;
  const Wu=+(W*U).toFixed(2),Hu=+(H*U).toFixed(2),u=v=>+(v*U).toFixed(2);
  const meta={asset_id:V.id,name:V.name,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:[0,0,Wu,Hu],
    size_source:'measured',size_basis:`Measured from CAPR 39-1 Attachment 5 "FLIGHT CAPS" figure (3 March 2020, p.139) at 66.3 px/in, from the figure's own 1 1/2 in marks. Cap body ${(+((x1-x0)/PXIN).toFixed(2))} x ${(+((y1-y0)/PXIN).toFixed(2))} in plus 0.12 in margin. The regulation gives no cap dimensions; real caps vary by size.`,
    anchors:{top_center:[Wu/2,0],bottom_center:[Wu/2,Hu],center:[Wu/2,Hu/2],left_edge:[0,Hu/2],right_edge:[Wu,Hu/2],front_edge_center:[u(PAD),u((y1-y0)/PXIN/2+PAD)],
      device_slot_center:[u(dsx),u(slotY)],braid_front:[u(pts[0][0]),u(pts[0][1])],garment_attach_center:[Wu/2,Hu]},
    landmarks:{device_slot:{x:u(dsx-0.5),y:u(slotY-0.5),w:100,h:100}},landmarks_note:'rects are {x,y,w,h} in user units (0.01 in); device_slot is a nominal 1 in box centred on the device position',
    orientation:'side view, front of cap at left (wearer facing left), wearer\'s left flap shown',
    documented:['flight cap device on the front left flap, centred halfway between top and bottom of the flap, 1 1/2 in from the front of the cap (6.2.2.2.1-3)',V.who,'general officers silver braid; other officers silver and blue braid; NCOs and cadets plain blue (6.2.2.2.4-6)','worn slightly to the wearer\'s right, about one inch above the eyebrows (6.2.2.1)'],
    assumed:['braid band width and position (about 0.33 of cap height below the top edge, read off the figure)','navy colour sampled from the figure','shading','figure caps differ slightly in height, each variant keeps its own measured outline'],
    fit:{method:'measured per-row extents of the regulation figure',score:null},grade:'accessory'};
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="0 0 ${Wu} ${Hu}" data-asset-id="${V.id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(V.name)}</title><metadata>${esc(JSON.stringify(meta))}</metadata><g id="art" transform="scale(${U})">${body}</g></svg>`;
  const ids=new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]));
  svg=svg.replace(/(\sid=")([^"]+)(")/g,(m,a,id,c)=>a+V.id+'__'+id+c).replace(/url\(#([^)]+)\)/g,(m,id)=>ids.has(id)?`url(#${V.id}__${id})`:m);
  fs.writeFileSync(path.join(OUTDIR,V.id+'.svg'),svg);fs.writeFileSync(path.join(OUTDIR,V.id+'.spec.json'),JSON.stringify(meta,null,1));
  out[V.id]={W:+W.toFixed(2),H:+H.toFixed(2),slot:[+dsx.toFixed(2),+slotY.toFixed(2)]};
  const sq=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 ${W+1} ${W+1}" width="900" height="900"><rect x="-0.5" y="-0.5" width="${W+1}" height="${W+1}" fill="#fff"/>${body}</svg>`;
  fs.writeFileSync(path.join(here,V.id+'.sq.svg'),sq);
  require('child_process').execSync(`qlmanage -t -s 900 -o "${here}" "${path.join(here,V.id+'.sq.svg')}" >/dev/null 2>&1; mv "${path.join(here,V.id+'.sq.svg.png')}" "${path.join(here,V.id+'_preview.png')}"; rm "${path.join(here,V.id+'.sq.svg')}"`);
}
console.log(JSON.stringify(out));
