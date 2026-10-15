// Notched BDU-style collar for the ABU and Corporate Field Uniform coats, in coat inches (centreline x=0, y down).
// Shape and construction are read from the regulation's own illustration (CAPR 39-1 Figure 5.2, ABU coats, PDF p. 99): each side is
//   - an upper collar piece: tip T at the top, outer edge T->C1 down to the shoulder, stitched edge C1->B1, bottom edge B1->N1 (N1 is the notch),
//     and the notch edge N1->M back up to the front edge;
//   - a lapel piece below the notch: M->N1->N2 then the lower edge N2->AP, where AP is the point that crosses the centreline over the placket top;
//   - the front (leading) edge T->A->AP is one straight line, the V of the neck opening.
// The figure is a three-quarter drawing (left and right differ); the symmetric values below are the mean of the two sides, with the tape
// width (= pocket width) used for scale. The wearer's right leaf (-x) is drawn last and laps the left at the apex (5.1.x, figure).
const f=n=>(+n).toFixed(3);
const APEX_Y=4.9;
const T=[2.56,-0.43],C1=[3.80,1.28],B1=[4.98,3.93],N1=[2.55,3.36],N2=[3.46,4.72],AP=[-0.48,5.9],A=[0,APEX_Y];
const lerpY=(p,q,y)=>[p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1]),y];
const M=lerpY(T,A,2.6);
const UPPER=[T,C1,B1,N1,M],LAPEL=[M,N1,N2,AP];
const unit=a=>{const l=Math.hypot(a[0],a[1]);return [a[0]/l,a[1]/l];};
const centroid=P=>{let a=0,cx=0,cy=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],c=p[0]*q[1]-q[0]*p[1];a+=c;cx+=(p[0]+q[0])*c;cy+=(p[1]+q[1])*c;}a/=2;return [cx/(6*a),cy/(6*a)];};
const rotBox=(c,w,h,deg)=>{const a=deg*Math.PI/180,cw=Math.abs(Math.cos(a)),sw=Math.abs(Math.sin(a)),bw=w*cw+h*sw,bh=w*sw+h*cw;return {x:c[0]-bw/2,y:c[1]-bh/2,w:bw,h:bh};};

// silhouette chain (left, -x, to right, +x) that replaces the traced neck: shoulder corner, tip, V apex, tip, shoulder corner
function silhouetteChain(){return [[-C1[0],C1[1]],[-T[0],T[1]],[0,APEX_Y],[T[0],T[1]],[C1[0],C1[1]]];}

function slotsPlus(){   // slots for the +x leaf
  const frontDir=unit([A[0]-T[0],A[1]-T[1]]);                          // down the leading edge
  // "centred on the collar, parallel with the front (leading edge)": start at the area centroid of the upper collar and slide down the
  // leading edge only as far as needed for the largest cadet form (2.5 x 1.5 in) to lie inside the collar piece
  const cen=centroid(UPPER),inPoly=(p,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c;}return c;};
  const ang0=Math.atan2(-frontDir[0],frontDir[1]),fits=(c,w,h)=>{const a=ang0,ux=-Math.sin(a),uy=Math.cos(a),vx=Math.cos(a),vy=Math.sin(a);
    return [[1,1],[1,-1],[-1,1],[-1,-1]].every(([i,j])=>inPoly([c[0]+i*w/2*ux+j*h/2*vx,c[1]+i*w/2*uy+j*h/2*vy],UPPER));};
  let cadetC=cen;for(let sft=0;sft<=1.5;sft+=0.05){const c=[cen[0]+frontDir[0]*sft,cen[1]+frontDir[1]*sft];if(fits(c,2.5,1.5)){cadetC=c;break;}}
  const cadetAng=Math.atan2(-frontDir[0],frontDir[1])*180/Math.PI;       // clockwise-positive rotation of a vertical long axis
  const bm=[(B1[0]+N1[0])/2,(B1[1]+N1[1])/2],bd=unit([N1[0]-B1[0],N1[1]-B1[1]]);
  let nrm=[bd[1],-bd[0]];if(nrm[1]>0)nrm=[-nrm[0],-nrm[1]];              // pointing up, into the collar
  const offC=[bm[0]+nrm[0]*1.0,bm[1]+nrm[1]*1.0];                       // 1 in from the bottom of the collar
  const offAng=Math.atan2(-(-nrm[0]),-nrm[1])*180/Math.PI;              // axis perpendicular to the bottom edge (use the downward-pointing copy)
  return {frontDir,cadetC,cadetAng,bm,bd,nrm,offC,offAng};}

function collar({fill,stroke}){
  const S=slotsPlus();
  const forms={
    'collar-cadet-officer-zone':{c:S.cadetC,w:2.5,h:1.5,ang:S.cadetAng,along:2.5,across:1.5},
    'collar-cadet-nco-zone':{c:S.cadetC,w:1.1,h:1.75,ang:S.cadetAng,along:1.75,across:1.1},
    'collar-officer-zone':{c:S.offC,w:1.6,h:1.3,ang:S.offAng,along:1.3,across:1.6}
  };
  const slots={};let svg='<g id="collar-front">';
  for(const q of [1,-1]){const side=q<0?'right':'left',P=pts=>pts.map(([x,y])=>f(q*x)+','+f(y)).join(' L');
    svg+=`<path id="collar-${side}" d="M${P(LAPEL)} Z" fill="${fill}" stroke="${stroke}" stroke-width=".07" stroke-linejoin="round"/>`
      +`<path d="M${P(UPPER)} Z" fill="${fill}" stroke="${stroke}" stroke-width=".07" stroke-linejoin="round"/>`
      +`<path d="M${P([N1,N2])}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".12" stroke-linecap="round"/>`
      +`<path d="M${P([B1,N1])}" fill="none" stroke="#000" stroke-opacity=".14" stroke-width=".1" stroke-linecap="round"/>`;
    for(const [id,m] of Object.entries(forms)){const c=[q*m.c[0],m.c[1]],ang=q*m.ang,bb=rotBox(c,m.w,m.h,ang);
      svg+=`<rect id="${id}-${side}" x="${f(bb.x)}" y="${f(bb.y)}" width="${f(bb.w)}" height="${f(bb.h)}" fill="#000" fill-opacity="0"><title>${id.replace(/-/g,' ')}: bounding box of the rotated slot (see spec collar_slots)</title></rect>`;
      (slots[side]=slots[side]||{})[id.replace('collar-','').replace('-zone','').replace(/-/g,'_')]={center:c,angle_deg:+ang.toFixed(1),size_in:{along:m.along,across:m.across},bbox:bb};}
    const cu=[q*S.frontDir[0],S.frontDir[1]];
    slots[side].cadet_axis=[[+(q*S.cadetC[0]-cu[0]*0.5).toFixed(3),+(S.cadetC[1]-cu[1]*0.5).toFixed(3)],[+(q*S.cadetC[0]+cu[0]*0.5).toFixed(3),+(S.cadetC[1]+cu[1]*0.5).toFixed(3)]];
    slots[side].front_edge={p1:[+(q*T[0]).toFixed(3),T[1]],p2:[+(q*AP[0]).toFixed(3),AP[1]],dir_down:[+(q*S.frontDir[0]).toFixed(4),+S.frontDir[1].toFixed(4)],angle_deg:+(q*S.cadetAng).toFixed(1)};
    slots[side].bottom_edge={p1:[+(q*B1[0]).toFixed(3),B1[1]],p2:[+(q*N1[0]).toFixed(3),N1[1]],mid:[+(q*S.bm[0]).toFixed(3),+S.bm[1].toFixed(3)]};
  }
  return {svg:svg+'</g>',slots};}

const {slotsToUnits}=require('./collar.js');
module.exports={collar,silhouetteChain,slotsToUnits,UPPER,LAPEL,T,C1,B1,N1,N2,AP,A,M};
