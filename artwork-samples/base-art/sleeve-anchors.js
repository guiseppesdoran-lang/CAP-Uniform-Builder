// Sleeve anchors for chevron placement (CAPR 39-1 4.1.5.2.1.2 / 4.1.6.1.3 / 4.1.9.3.3 / 4.1.11.1.1.1.3 / 4.1.12.2.3.3):
// "centered on the outer arm halfway between the shoulder seam and the elbow when bent at a 90-degree angle (long sleeves) or bottom edge of the sleeve (short sleeves)".
// All inputs in inches, garment frame (x = 0 on the centreline, wearer's right = negative x). Returns inch coordinates:
//   shoulder_seam_{right,left}  top of the armhole seam on the sleeve (the shoulder-seam end)
//   elbow_{right,left}          centre of the sleeve at the elbow level (long sleeves only; elbow at 55% of the shoulder-to-sleeve-end drop, anatomical estimate)
//   chevron_halfway_{right,left} centre of the sleeve halfway between shoulder seam and elbow (long sleeves)
//   sleeve_bottom_{right,left}  centre of the sleeve end edge
// sleeve centre = midpoint between the outer silhouette edge and the armhole seam / arm-body gap at that height.
module.exports=function sleeveAnchors({outline,holes=[],arm,long=true,endMin=0.75}){
  const maxX=Math.max(...outline.map(p=>Math.abs(p[0])));
  const cross=(poly,y)=>{const xs=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]-y)*(b[1]-y)<0)xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}return xs;};
  const interp=(pts,y)=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1])return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);}return null;};
  const out={};
  for(const s of [-1,1]){
    const tag=s<0?'right':'left',seam=arm.map(p=>[s*Math.abs(p[0]),p[1]]).sort((a,b)=>a[1]-b[1]);
    const sh=seam[0],sleeveV=outline.filter(p=>Math.sign(p[0])===s&&Math.abs(p[0])>maxX*endMin&&p[1]>sh[1]);
    const endY=Math.max(...sleeveV.map(p=>p[1]).filter(y=>y<Math.max(...outline.map(q=>q[1]))*0.97));
    const centreAt=y=>{const xo=(()=>{const c=cross(outline,y).filter(x=>Math.sign(x)===s);return s<0?Math.min(...c):Math.max(...c);})();
      let xi=y<=seam[seam.length-1][1]?interp(seam,y):null;
      if(xi===null){const hc=holes.flatMap(h=>cross(h,y)).filter(x=>Math.sign(x)===s);if(hc.length)xi=s<0?Math.min(...hc):Math.max(...hc);else xi=seam[seam.length-1][0];}
      // the sleeve inner edge is the hole edge nearest the outer edge
      return (xo+xi)/2;};
    out['shoulder_seam_'+tag]=[+sh[0].toFixed(3),+sh[1].toFixed(3)];
    out['sleeve_bottom_'+tag]=[+centreAt(endY-0.3).toFixed(3),+endY.toFixed(3)];
    if(long){const ey=sh[1]+0.55*(endY-sh[1]),hy=(sh[1]+ey)/2;
      out['elbow_'+tag]=[+centreAt(ey).toFixed(3),+ey.toFixed(3)];
      out['chevron_halfway_'+tag]=[+centreAt(hy).toFixed(3),+hy.toFixed(3)];}
  }
  return out;};

// sleeve edge profile for bands that follow the sleeve (sleeve braid): returns edges(y,side) -> {xo,xi} and the sleeve end y
module.exports.profile=function({outline,holes=[],arm}){
  const cross=(poly,y)=>{const xs=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[1]-y)*(b[1]-y)<0)xs.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}return xs;};
  const interp=(pts,y)=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if((a[1]-y)*(b[1]-y)<=0&&a[1]!==b[1])return a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);}return null;};
  const maxX=Math.max(...outline.map(p=>Math.abs(p[0]))),maxY=Math.max(...outline.map(p=>p[1]));
  const edges=(y,s)=>{const c=cross(outline,y).filter(x=>Math.sign(x)===s),xo=s<0?Math.min(...c):Math.max(...c);
    const seam=arm.map(p=>[s*Math.abs(p[0]),p[1]]).sort((a,b)=>a[1]-b[1]);
    let xi=y<=seam[seam.length-1][1]?interp(seam,y):null;
    if(xi===null){const hc=holes.flatMap(h=>cross(h,y)).filter(x=>Math.sign(x)===s);
      xi=hc.length?(s<0?Math.min(...hc):Math.max(...hc)):seam[seam.length-1][0];}
    return {xo,xi};};
  const endY=s=>{const v=outline.filter(p=>Math.sign(p[0])===s&&Math.abs(p[0])>maxX*0.85&&p[1]<maxY*0.97);return Math.max(...v.map(p=>p[1]));};
  return {edges,endY};};
