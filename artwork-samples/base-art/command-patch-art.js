// CAP Command Patch as clean vector art, from board/cap-command-patch.json (traced from CAPR 39-1 Fig A6-4 by board/flat.js + board/cmdpatch.js).
// Returns a <g> in garment inches, centred on (cx,cy), `w` inches across the full patch (scroll curls included).
// The regulation gives no patch dimensions, so w is an ESTIMATE supplied by the caller; proportions are exactly the figure's.
const fs=require('fs'),path=require('path');
const D=JSON.parse(fs.readFileSync(path.join(__dirname,'board','cap-command-patch.json'),'utf8'));
const COL={gold:'#f0c92e',white:'#fbfbf8',navy:'#14196c',red:'#cc3a2c'};
const [x0,y0,x1,y1]=D.bbox,AR=(y1-y0)/(x1-x0);
module.exports=function commandPatch(id,cx,cy,w){
  const s=w/(x1-x0),h=w*AR,mx=(x0+x1)/2,my=(y0+y1)/2;
  const P=l=>'M'+l.map(p=>((p[0]-mx)*s+cx).toFixed(3)+','+((p[1]-my)*s+cy).toFixed(3)).join('L')+'Z';
  // hole-free underlays (outer loops only) so anti-aliased seams between neighbouring colours never show the garment through
  const pip=(pt,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
  const outer=n=>D.layers[n].filter(l=>!D.layers[n].some(o=>o!==l&&o.length>l.length&&pip(l[0],o)));
  const under=n=>`<path d="${outer(n).map(P).join('')}" fill="${COL[n]}"/>`;
  const layer=n=>`<path id="${id}-${n}" d="${D.layers[n].map(P).join('')}" fill="${COL[n]}" fill-rule="evenodd"/>`;
  return {h,svg:`<g id="${id}"><title>CAP Command Patch (traced from CAPR 39-1 Fig A6-4); width ESTIMATED</title>`+['gold','navy','white'].map(under).join('')+['gold','white','navy','red'].map(layer).join('')+`</g>`};
};
