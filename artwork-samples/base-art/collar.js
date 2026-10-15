// Shared collar for the OCP, ABU and Corporate Field Uniform coats (BDU-style notch collar), in coat inches.
// The leaf's outer edge follows the traced silhouette (neck -> shoulder corner), its bottom edge runs from the shoulder corner
// to the placket top, and its inner edge is the V of the neck opening. Right leaf (wearer's right, -x) is drawn last and laps the left.
//
// Grade-insignia slots (CAPR 39-1 5.1.1.1.1.x / 5.2.1.1.1.x):
//   cadet   : cadet officer grade and cadet NCO metal chevrons, centred, 1 in from the FRONT edge of the collar, long axis parallel to it
//   officer : officer grade, centred 1 in from the BOTTOM edge of the collar, long axis perpendicular to that edge
// angle_deg uses the SVG rotate() convention (clockwise positive) applied to an insignia whose long axis is vertical (+y down).
const f=n=>(+n).toFixed(3);
const NECK=[[2.59,0.13],[2.81,0.22],[3.29,0.92],[4.03,1.67]];
const BOTTOM=[[4.5,2.7],[3.4,3.6],[2.2,4.3],[1.1,4.78]];
const VPT=[1.1,3.1];
const leafPts=(apex,ov)=>[...NECK,...BOTTOM,[-ov,apex],[-ov,4.0+ov*1.1],VPT];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],mul=(a,k)=>[a[0]*k,a[1]*k];
const unit=a=>{const l=Math.hypot(a[0],a[1]);return [a[0]/l,a[1]/l];};
const angleOfAxis=u=>Math.atan2(u[0],u[1])*180/Math.PI;   // clockwise from +y (screen-down) is positive when top leans right

function slotsRight(){   // for the +x leaf (wearer's left, image right); mirror for -x
  // front edge: neck point -> V point at y=3.7
  const N=NECK[0],T=[0.73,3.7],u=unit(sub(T,N)),mid=mul(add(N,T),0.5);
  const nOut=[u[1],-u[0]];                                                                      // outward (toward the shoulder): right/down
  const cadetC=add(mid,mul(nOut,1.0));
  // bottom edge: chain length midpoint
  const ch=BOTTOM,L=[];let tot=0;for(let i=0;i<ch.length-1;i++){const d=Math.hypot(ch[i+1][0]-ch[i][0],ch[i+1][1]-ch[i][1]);L.push(d);tot+=d;}
  let acc=0,mb,db;for(let i=0;i<L.length;i++){if(acc+L[i]>=tot/2){const t=(tot/2-acc)/L[i];mb=[ch[i][0]+(ch[i+1][0]-ch[i][0])*t,ch[i][1]+(ch[i+1][1]-ch[i][1])*t];db=unit(sub(ch[i+1],ch[i]));break;}acc+=L[i];}
  const nIn=unit([db[1],-db[0]]);                                                               // candidate normal
  const inward=nIn[1]<0?nIn:mul(nIn,-1);                                                        // pointing up (toward the neck)
  const offC=add(mb,mul(inward,1.0));
  return {
    cadet:{center:cadetC,axis:u,angle:-angleOfAxis([u[0],u[1]]),front_edge:[N,T]},
    officer:{center:offC,axis:inward,angle:angleOfAxis([inward[0],inward[1]]),bottom_edge_mid:mb}
  };}

function rotBox(c,w,h,angDeg){const a=angDeg*Math.PI/180,cw=Math.abs(Math.cos(a)),sw=Math.abs(Math.sin(a)),bw=w*cw+h*sw,bh=w*sw+h*cw;return {x:c[0]-bw/2,y:c[1]-bh/2,w:bw,h:bh};}

// fill: fabric fill string; returns {svg, slots}
function collar({fill,stroke,apex}){
  const S=slotsRight();
  // long axis along u for the cadet forms (axis points from the neck end down the edge); angle measured for a vertical long axis
  const cadetAng=Math.atan2(-S.cadet.axis[0],S.cadet.axis[1])*180/Math.PI;                      // +x leaf: top leans right ("/"), about +27.5
  const officerAng=Math.atan2(S.officer.axis[0],-S.officer.axis[1])*180/Math.PI;                 // axis points up-left -> negative
  const forms={
    'collar-cadet-officer-zone':{c:S.cadet.center,w:2.5,h:1.5,ang:cadetAng,along:2.5,across:1.5},
    'collar-cadet-nco-zone':{c:S.cadet.center,w:1.1,h:1.75,ang:cadetAng,along:1.75,across:1.1},
    'collar-officer-zone':{c:S.officer.center,w:1.6,h:1.3,ang:officerAng,along:1.3,across:1.6}
  };
  const slots={};let svg='<g id="collar-front">';
  for(const q of [1,-1]){const side=q<0?'right':'left',ov=q<0?0.6:0,P=pts=>pts.map(([x,y])=>f(q*x)+','+f(y)).join(' L');
    svg+=`<path id="collar-${side}" d="M${P(leafPts(apex,ov))} Z" fill="${fill}" stroke="${stroke}" stroke-width=".07" stroke-linejoin="round"/>`
      +`<path d="M${P(BOTTOM)}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".13" stroke-linecap="round" transform="translate(0 -0.08)"/>`
      +`<path d="M${P([[2.9,0.7],[1.75,2.9]])}" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".07"/>`;
    for(const [id,m] of Object.entries(forms)){const c=[q*m.c[0],m.c[1]],ang=q*m.ang,bb=rotBox(c,m.w,m.h,ang);
      svg+=`<rect id="${id}-${side}" x="${f(bb.x)}" y="${f(bb.y)}" width="${f(bb.w)}" height="${f(bb.h)}" fill="#000" fill-opacity="0"><title>${id.replace(/-/g,' ')}: bounding box of the rotated slot (see spec slots)</title></rect>`;
      (slots[side]=slots[side]||{})[id.replace('collar-','').replace('-zone','').replace(/-/g,'_')]={center:c,angle_deg:+ang.toFixed(1),size_in:{along:m.along,across:m.across},bbox:bb};}
    const cu=[q*S.cadet.axis[0],S.cadet.axis[1]];
    {const T0=NECK[0],P0=[0.73,3.7],fd=unit(sub(P0,T0)),mb=S.officer.bottom_edge_mid,b1=BOTTOM[0],b2=BOTTOM[BOTTOM.length-1];
     slots[side].front_edge={p1:[+(q*T0[0]).toFixed(3),T0[1]],p2:[+(q*P0[0]).toFixed(3),P0[1]],dir_down:[+(q*fd[0]).toFixed(4),+fd[1].toFixed(4)],angle_deg:+(q*cadetAng).toFixed(1)};
     slots[side].bottom_edge={p1:[+(q*b1[0]).toFixed(3),b1[1]],p2:[+(q*b2[0]).toFixed(3),b2[1]],mid:[+(q*mb[0]).toFixed(3),+mb[1].toFixed(3)]};}
    slots[side].cadet_axis=[[+(q*S.cadet.center[0]-cu[0]*0.5).toFixed(3),+(S.cadet.center[1]-cu[1]*0.5).toFixed(3)],[+(q*S.cadet.center[0]+cu[0]*0.5).toFixed(3),+(S.cadet.center[1]+cu[1]*0.5).toFixed(3)]];
  }
  return {svg:svg+'</g>',slots,front_edge:S.cadet.front_edge};}
// convert slot coordinates (coat inches) to artwork-box user units (0.01 in), origin top-left of the box
function slotsToUnits(slots,vb,U=100){const P=p=>[+((p[0]-vb.x)*U).toFixed(1),+((p[1]-vb.y)*U).toFixed(1)],out={};
  for(const [side,o] of Object.entries(slots)){out[side]={};for(const [k,v] of Object.entries(o)){
    if(k==='cadet_axis')out[side][k]=v.map(P);
    else if(k==='front_edge')out[side][k]={p1:P(v.p1),p2:P(v.p2),dir_down:v.dir_down,angle_deg:v.angle_deg};
    else if(k==='bottom_edge')out[side][k]={p1:P(v.p1),p2:P(v.p2),mid:P(v.mid)};
    else out[side][k]={center:P(v.center),angle_deg:v.angle_deg,size_in:v.size_in,bbox:{x:+((v.bbox.x-vb.x)*U).toFixed(1),y:+((v.bbox.y-vb.y)*U).toFixed(1),w:+(v.bbox.w*U).toFixed(1),h:+(v.bbox.h*U).toFixed(1)}};}}
  return out;}
module.exports={collar,leafPts,NECK,BOTTOM,slotsToUnits};
