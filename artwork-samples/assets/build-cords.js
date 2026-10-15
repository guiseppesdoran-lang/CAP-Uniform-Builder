// Cadet shoulder cords (CAPR 39-1 9.3, 9.4.1) + the USAF aide-de-camp aiguillette cord (9.3.4; DAFI 36-2903 10.7.7).
// Shoulder cords: worn on the left shoulder along the shoulder seam, under the epaulet; one at a time, cadets only, Class A / Class B only.
//   group CAC kelly green, wing CAC red, region CAC blue, national CAC gold (9.3.1.4-9.3.1.1), color guard white (9.3.2), honor guard silver (9.3.3, 9.6.7.5).
// One braided-cord construction. Braid + colours are measured from the app's cord images (images/cords/*.webp). Length is fitted to the garment
// assets: the left shoulder seam measures ~5.0 in on the Class A coat and ~4.1-4.3 in on the Class B shirt (strap landmark), so the cord is 4.5 in
// (estimated: the regulation gives no cord dimensions). Thickness 0.40 in (ratio measured on the cord images: 0.064-0.095 of length).
const fs=require('fs'),path=require('path');
const OUT=path.join(__dirname,'cords'),U=100,f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const CORDS=[
  {id:'group',   name:'Group CAC shoulder cord (kelly green)',  main:'#066e2d',dark:'#015317',cite:'CAPR 39-1 9.3.1.4'},
  {id:'wing',    name:'Wing CAC shoulder cord (red)',           main:'#d70d10',dark:'#a80506',cite:'CAPR 39-1 9.3.1.3'},
  {id:'region',  name:'Region CAC shoulder cord (blue)',        main:'#0a2ba8',dark:'#011077',cite:'CAPR 39-1 9.3.1.2'},
  {id:'national',name:'National CAC shoulder cord (gold)',      main:'#c48f1a',dark:'#8e5f03',cite:'CAPR 39-1 9.3.1.1'},
  {id:'color_guard',name:'Color Guard / Drill team shoulder cord (white)',main:'#f1f2f4',dark:'#aeb4bc',cite:'CAPR 39-1 9.3.2'},
  {id:'honor_guard',name:'Honor Guard shoulder cord (metallic silver)',main:'#cdd2d7',dark:'#7f8790',cite:'CAPR 39-1 9.3.3, 9.6.7.5'}];
const GARMENT_FIT={
  note:'strap axis = line from the neck end to the arm end of the garment\'s left epaulet strap / shoulder strip (garment user units, 0.01 in; wearer\'s left shoulder is on the viewer\'s right). Place: centre the cord on the axis with shoulder_seam_attach_neck_end at the neck end, rotate so the neck->arm anchors follow the axis, shift the chord 0.125 in toward the neck side so the 0.25 in bow is centred on the strap; draw order garment, layers, cord, then the epaulet sleeve/strip over it',
  class_a_coat:{asset:'garment-blues-class-a-coat',left_shoulder_seam_in:5.04,strap_axis:[[1652,244],[2022,341]],strap_len_in:3.82,note:'strap from the garment-blues-class-a-cadet-officer-insignia shoulder-strip-left'},
  class_a_coat_female:{asset:'garment-blues-class-a-coat-female',strap_axis:[[1656.5,191],[2008.5,265]],strap_len_in:3.6,note:'strap from garment-blues-class-a-cadet-officer-insignia-female shoulder-strip-left'},
  class_b_shirt:{asset:'garment-blues-class-b-shirt-male',left_shoulder_seam_in:4.1,strap_axis:[[1368.2,193.3],[1775.4,345]],strap_len_in:4.35,note:'epaulet_left landmark: pointed neck end to the mid of the arm end'},
  class_b_blouse_female:{asset:'garment-blues-class-b-blouse-female',strap_axis:[[1332.6,203.8],[1777.9,305.9]],strap_len_in:4.57,note:'epaulet_left landmark: pointed neck end to the mid of the arm end'}};
// ---- generic braided cord along a path (points in inches)
const resample=(P,step)=>{const out=[P[0]];let acc=0;for(let i=1;i<P.length;i++){let a=out[out.length-1],b=P[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);while(acc+d>=step){const t=(step-acc)/d;a=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];out.push(a);d=Math.hypot(b[0]-a[0],b[1]-a[1]);acc=0;}acc+=d;}
  if(Math.hypot(out[out.length-1][0]-P[P.length-1][0],out[out.length-1][1]-P[P.length-1][1])>1e-3)out.push(P[P.length-1]);return out;};
const smooth=(P,n)=>{let Q=P.map(p=>p.slice());for(let k=0;k<n;k++)Q=Q.map((p,i)=>i===0||i===Q.length-1?p:[(Q[i-1][0]+2*p[0]+Q[i+1][0])/4,(Q[i-1][1]+2*p[1]+Q[i+1][1])/4]);return Q;};
function cordSvg(id,spine,T,pitch,main,dark,sm=6){
  const S=resample(smooth(spine,sm),0.02),n=S.length;
  const norm=i=>{const a=S[Math.max(0,i-2)],b=S[Math.min(n-1,i+2)],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [dy/l,-dx/l];};
  const cum=[0];for(let i=1;i<n;i++)cum.push(cum[i-1]+Math.hypot(S[i][0]-S[i-1][0],S[i][1]-S[i-1][1]));
  const total=cum[n-1],at=s=>{let i=0;while(i<n-1&&cum[i+1]<s)i++;return i;};
  const off=(s,o)=>{const i=at(s),p=S[i],nn=norm(i);return [(p[0]+nn[0]*o)*U,(p[1]+nn[1]*o)*U];};
  const pts=S.map(p=>f2(p[0]*U)+','+f2(p[1]*U)).join('L');
  const half=T/2-0.025;let g='';
  const nP=Math.floor((total-0.5)/pitch);
  for(let k=0;k<nP;k++){const s0=0.25+k*pitch,a0=off(s0,-half),a1=off(s0,-0.02);g+='M'+f2(a0[0])+','+f2(a0[1])+'L'+f2(a1[0])+','+f2(a1[1]);
    const s1=s0+pitch*0.5;if(s1<total-0.25){const b0=off(s1,0.02),b1=off(s1,half);g+='M'+f2(b0[0])+','+f2(b0[1])+'L'+f2(b1[0])+','+f2(b1[1]);}}
  const centre=S.slice(3,n-3).map(p=>f2(p[0]*U)+','+f2(p[1]*U)).join('L');
  return {length:total,svg:`<g id="${id}__ground"><path d="M${pts}" fill="none" stroke="${dark}" stroke-width="${f2(T*U)}" stroke-linecap="round" stroke-linejoin="round"/>`
    +`<path d="M${pts}" fill="none" stroke="${main}" stroke-width="${f2((T-0.07)*U)}" stroke-linecap="round" stroke-linejoin="round"/></g>`
    +`<g id="${id}__weave"><path d="M${centre}" fill="none" stroke="${dark}" stroke-width="2.2" stroke-linecap="round"/><path d="${g}" fill="none" stroke="${dark}" stroke-width="2.0" stroke-linecap="round"/></g>`};
}
const written=[];
const write=(id,name,W,H,body,m)=>{const vb=[0,0,+(W*U).toFixed(2),+(H*U).toFixed(2)];
  const meta={asset_id:id,name,size_in:{w:+W.toFixed(3),h:+H.toFixed(3)},units:'1 user unit = 0.01 in',viewBox:vb,...m};
  fs.writeFileSync(path.join(OUT,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(3)}in" height="${H.toFixed(3)}in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(name)}</title><metadata>${esc(JSON.stringify(meta))}</metadata>${body}</svg>`);
  fs.writeFileSync(path.join(OUT,id+'.spec.json'),JSON.stringify({...meta,fit:{method:'n/a',score:null}},null,1));written.push(id);};
const baseAnch=(W,H)=>({top_center:[W*U/2,0],bottom_center:[W*U/2,H*U],center:[W*U/2,H*U/2],left_edge:[0,H*U/2],right_edge:[W*U,H*U/2]});
// ---- shoulder cords
{
  const L=4.1,T=0.40,SAG=0.25,PITCH=0.15,M=0.06,W=T+SAG+2*M,H=L+2*M;
  const sp=s=>{const t=s/L,bulge=SAG*(1-Math.pow(2*t-1,2));return [M+T/2+SAG-bulge,M+s];};
  const spine=Array.from({length:61},(_,i)=>sp(L*i/60));
  for(const c of CORDS){
    const id=`cord-${c.id.replace(/_/g,'-')}`,r=cordSvg(id,spine,T,PITCH,c.main,c.dark),a=sp(0),b=sp(L),mid=sp(L/2);
    write(id,c.name,W,H,r.svg,{size_source:'estimated',
      size_basis:'No cord dimensions in CAPR 39-1. Length 4.1 in = the Class B shirt shoulder seam (~4.1 in on garment-blues-class-b-shirt-male) and 0.3 in longer than the 3.8 in epaulet strap on the Class A coat (seam 5.04 in), so the cord stays inside the coat silhouette (composed against garment-blues-class-a-coat, -female, class-b shirt/blouse in a throwaway preview 2026-10-13; was 4.5 in); thickness 0.40 in from the cord/length ratio of the app\'s cord images; colours and braid read from images/cords/*.webp',
      provenance:'in-house vector: braid pattern and colours measured from the app\'s existing cord images',
      colours:{main:c.main,groove:c.dark},
      anchors:{...baseAnch(W,H),shoulder_seam_attach:[a[0]*U,a[1]*U],shoulder_seam_attach_neck_end:[a[0]*U,a[1]*U],shoulder_seam_attach_arm_end:[b[0]*U,b[1]*U],cord_mid:[mid[0]*U,mid[1]*U]},
      dimensions:{form:'braided shoulder cord',length_in:L,thickness_in:T,sagitta_in:SAG,weave_pitch_in:PITCH,orientation:'drawn vertically: top = neck end of the shoulder seam, bottom = sleeve (arm) end; the bow (0.25 in) falls toward the body, i.e. down the garment front when the cord lies on the shoulder',
        attach:'align cord_start (neck end) with the neck end of the wearer\'s LEFT shoulder seam and run it down the seam toward the shoulder point; rotate to the seam angle'},
      garment_fit:GARMENT_FIT,
      mounts:[{uniform:'Class A (service dress) and Class B (blue service), cadets only',rule:'worn on the left shoulder, aligned along the shoulder seam, underneath the epaulet if present; one cord at a time; not worn on working uniforms (CAPR 39-1 9.3, 9.4.1)'}],
      regulation:c.cite,grade:'cord'});
  }
}
// ---- USAF aide-de-camp aiguillette (silver, single loop, chrome tip): hangs from the left shoulder seam down the chest
{
  const T=0.30,PITCH=0.12,main='#cdd2d7',dark='#7f8790',id='cord-aide-de-camp';
  const arc=(cx,cy,r,a0,a1,n=10)=>Array.from({length:n+1},(_,i)=>{const a=a0+(a1-a0)*i/n;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];});
  const spine=[[4.5,0.2],[3.0,0.2],[1.6,0.2],...arc(0.8,0.7,0.5,-Math.PI/2,-Math.PI,8).slice(0),[0.30,2.0],[0.30,4.0],[0.31,6.0],[0.34,7.1],...arc(0.58,7.1,0.28,Math.PI,0,10),[0.86,7.1],[0.88,6.0],[0.9,4.0],[0.9,2.0],[0.9,1.2]];
  const r=cordSvg(id,spine,T,PITCH,main,dark,1);
  const tip=`<g id="${id}__tip"><path d="M${f2(0.58*U)},${f2(7.38*U)}L${f2(0.58*U)},${f2(7.62*U)}" stroke="${dark}" stroke-width="3"/><rect x="${f2(0.46*U)}" y="${f2(7.6*U)}" width="${f2(0.24*U)}" height="${f2(1.15*U)}" rx="${f2(0.1*U)}" fill="#e6e9ec" stroke="#7f8790" stroke-width="1.4"/></g>`;
  const W=5.0,H=8.9;
  write(id,'USAF aide de camp aiguillette cord (silver, single loop, chrome tip)',W,H,r.svg+tip,{size_source:'estimated',
    size_basis:'Not dimensioned in CAPR 39-1 or DAFI 36-2903. Shoulder run 4.2 in matches the garment shoulder seam; loop length ~7.4 in and tip ~1.15 in are estimates of a ceremonial single-loop aiguillette',
    provenance:'in-house construction from DAFI 36-2903 10.7.7.1 ("silver, single loop, chrome tip with raised wing and star emblem"); same braid as the shoulder cords',
    colours:{main,groove:dark,tip:'#e6e9ec'},
    anchors:{...baseAnch(W,H),shoulder_seam_attach:[4.5*U,0.2*U],shoulder_seam_attach_neck_end:[0.8*U,0.2*U],shoulder_seam_attach_arm_end:[4.5*U,0.2*U],loop_bottom:[0.58*U,7.38*U],tip_end:[0.58*U,8.75*U]},
    dimensions:{form:'aiguillette, single loop with chrome tip',shoulder_run_in:4.2,loop_length_in:7.4,thickness_in:T,orientation:'top run lies along the left shoulder seam (arm end at the right of the asset, neck end at the left); the loop then hangs down the chest'},
    garment_fit:GARMENT_FIT,
    mounts:[{uniform:'USAF-style service and service dress (Class A / Class B) - aides de camp to general officers (senior and cadet)',rule:'worn on the left sleeve/shoulder only while acting as an aide de camp; open end grounded under the epaulet at the left shoulder seam (CAPR 39-1 9.3.4; DAFI 36-2903 10.7.7.1)'}],
    regulation:'CAPR 39-1 9.3.4; DAFI 36-2903 10.7.7.1',grade:'cord'});
}
console.log('cords:',written.length,written.join(' '));
