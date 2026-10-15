// Audit of the flight-uniform assets against CAPR 39-1 ch. 8 (documented sizes, symmetry, opposition, anchors, containment).
const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'..','assets','garments');
const ids=['garment-fdu-flight-suit','garment-cfdu-flight-suit','garment-flight-jacket-green','garment-flight-jacket-blue'];
let bad=0;const ck=(ok,msg)=>{if(!ok){bad++;console.log('  FAIL',msg);}};
const cen=r=>[r.x+r.w/2,r.y+r.h/2],near=(a,b,t=1.5)=>Math.abs(a-b)<=t;
for(const id of ids){const sp=JSON.parse(fs.readFileSync(path.join(D,id+'.spec.json'))),L=sp.landmarks,A=sp.anchors,W=sp.viewBox[2],H=sp.viewBox[3],cx=A.centerline_top[0];
  console.log(id);
  const nt=L.name_tape,cp=L.patch_command_right_breast,fl=L.patch_flag_left,lp=L.patch_loop_square_right,es=L.es_patch_zone;
  ck(near(nt.w,400)&&near(nt.h,200),`nametag 2x4 in, got ${nt.w}x${nt.h}`);
  ck(near(fl.w,350)&&near(fl.h,200),`flag 2x3.5 in, got ${fl.w}x${fl.h}`);
  ck(near(lp.w,350)&&near(lp.h,350),`loop square 3.5x3.5 in, got ${lp.w}x${lp.h}`);
  ck(near(cen(nt)[1],cen(cp)[1]),`command patch not level with nametag (${cen(cp)[1]} vs ${cen(nt)[1]})`);
  ck(near(cen(nt)[0]-cx,cx-cen(cp)[0]),`command patch not mirrored about the zip line`);
  ck(cen(cp)[0]<cx&&cen(nt)[0]>cx,`command patch must be wearer's right (image left), nametag wearer's left`);
  ck(cen(fl)[0]>cx,`flag must be on wearer's left (image right)`);
  ck(sp.anchors.zipper_min_closed,'zipper_min_closed anchor (8.1.2.4 / 8.2.7.1)');
  ck(sp.flag&&/normal/.test(sp.flag.orientation)&&sp.flag.side.includes('left'),'flag orientation documented (normal, left sleeve)');
  ck(!Object.keys(L).some(k=>/loop_square_left/.test(k)),'no loop-tape square on the left sleeve');
  ck(cen(lp)[0]<cx,'loop square on wearer\'s right (image left)');
  ck(L.grade_zone_left&&L.grade_zone_right&&near(cen(L.grade_zone_left)[0]-cx,cx-cen(L.grade_zone_right)[0])&&near(cen(L.grade_zone_left)[1],cen(L.grade_zone_right)[1]),'officer grade zones symmetric');
  ck(L.grade_zone_left.w>=159&&L.grade_zone_left.h>=125,'officer grade zone holds the largest form (>= 1.59 x 1.25 in)');
  ck(L.grade_zone_go_left&&near(cen(L.grade_zone_go_left)[0]-cx,cx-cen(L.grade_zone_go_right)[0])&&L.grade_zone_go_left.w>=215&&L.grade_zone_go_left.h>=115,'GO zone holds two 1 in stars side by side (>= 2.15 x 1.15 in), symmetric');
  ck(cen(es)[1]>cen(cp)[1]+cp.h/2,'ES patch zone below the command patch');
  if(/suit/.test(id)){const ck2=L.chest_pocket_left;const xs=ck2.map(p=>p[0]),pc=(Math.min(...xs)+Math.max(...xs))/2;ck(near(cen(nt)[0],pc,2),'nametag centred over the left chest pocket (8.2.4.1)');ck(near(cx-cen(cp)[0],pc-cx,2),'command patch centred over the right chest pocket, opposite the nametag (8.2.4.2)');ck(near(cx-cen(es)[0],pc-cx,2),'ES patch centred on the right chest pocket (8.2.4.3)');const yb=Math.max(...ck2.map(p=>p[1]));ck(es.y>=yb-1,'ES patch top below the pocket bottom');}
  for(const [k,v] of Object.entries(L)){const pts=Array.isArray(v)?v:[[v.x,v.y],[v.x+v.w,v.y+v.h]];
    ck(pts.every(p=>p[0]>=-1&&p[0]<=W+1&&p[1]>=-1&&p[1]<=H+1),`landmark ${k} outside the artwork box`);}
  for(const t of ['pocket','cuff','flap_pocket','waist_tab']){const a=L[t+'_left'],b=L[t+'_right'];if(a&&b){const mx=p=>p.map(q=>q[0]),ca=(Math.min(...mx(a))+Math.max(...mx(a)))/2,cb=(Math.min(...mx(b))+Math.max(...mx(b)))/2;ck(near(ca-cx,cx-cb,2),`${t} left/right not symmetric`);}}
  const cpk=['chest_pocket'];for(const t of cpk){const a=L[t+'_left'],b=L[t+'_right'];if(a&&b){const ca=a.reduce((s,p)=>s+p[0],0)/a.length,cb=b.reduce((s,p)=>s+p[0],0)/b.length;ck(near(ca-cx,cx-cb,2),'chest pockets symmetric');}}
  for(const [k,v] of Object.entries(A))ck(v[0]>=0&&v[0]<=W&&v[1]>=0&&v[1]<=H,`anchor ${k} outside box`);
  ck((sp.size_source==='estimated'&&sp.size_basis)||(sp.size_source==='regulation'&&sp.size_citation),'size_source estimated+basis or regulation+citation');
}
const sc=JSON.parse(fs.readFileSync(path.join(D,'garment-cap-command-scarf.spec.json'))),su=JSON.parse(fs.readFileSync(path.join(D,ids[0]+'.spec.json')));
console.log('scarf'); const scale=(sc.viewBox[2]/sc.size_in.w);
ck(sc.anchors.suit_apex&&su.anchors.collar_apex,'scarf suit_apex / suit collar_apex present');
console.log(bad?`${bad} failure(s)`:'all checks pass');process.exit(bad?1:0);
