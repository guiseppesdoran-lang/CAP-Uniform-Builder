// Cadet NCO / Airman chevrons, flat colour vector, traced from the Vanguard cadet chevron photos (images/ranks/C) after a CHROMA
// classification (navy = blue-dominant & dark, red = strongly red, chrome = every neutral shade -> one flat silver). This removes the
// chrome shading and keeps the real proportions: the same 381 px chevron width in every photo, per-grade heights as photographed.
// Size: CMSgt (613 px tall) = 1.75 in so it fills the 2 in OCP square leaving 1/8 in top and bottom (Ethan); same px->in for every grade.
// Traces: base-art/board/chroma-trace.js -> base-art/rank-traces/vc_<grade>.json
const fs=require('fs'),path=require('path');
const HERE=__dirname,OUT=path.join(HERE,'insignia'),TR=path.join(HERE,'..','base-art','rank-traces');
const U=100,SQ=2.0,BORDER=0.125,f2=n=>(+n).toFixed(2),esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const C={navy:'#010066',silver:'#d3d6d7',red:'#d03638',cloth:'#142347'};
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return Math.abs(a/2);};
const bbox=ps=>{let a=1e9,b=-1e9,c=1e9,d=-1e9;for(const p of ps)for(const q of p){a=Math.min(a,q[0]);b=Math.max(b,q[0]);c=Math.min(c,q[1]);d=Math.max(d,q[1]);}return [a,b,c,d];};
const GRADES=[['airman','Cadet Airman','C/Amn','Amn'],['airman-first-class','Cadet Airman First Class','C/A1C','A1C'],['senior-airman','Cadet Senior Airman','C/SrA','SrA'],
  ['staff-sergeant','Cadet Staff Sergeant','C/SSgt','SSgt'],['technical-sergeant','Cadet Technical Sergeant','C/TSgt','TSgt'],
  ['master-sergeant','Cadet Master Sergeant','C/MSgt','MSgt'],['senior-master-sergeant','Cadet Senior Master Sergeant','C/SMSgt','SMSgt'],
  ['chief-master-sergeant','Cadet Chief Master Sergeant','C/CMSgt','CMSgt']];
const load=g=>JSON.parse(fs.readFileSync(path.join(TR,'vc_'+g+'.json')));
const big=t=>t.sil.slice().sort((a,b)=>area(b)-area(a))[0];
const cmB=bbox([big(load('CMSgt'))]);
const H_CM_PX=(cmB[3]-cmB[2])/4,W_PX=(cmB[1]-cmB[0])/4;               // photo px (traces are 4x)
const KPX=(SQ-2*BORDER)/H_CM_PX;                                          // inches per photo px (CMSgt height -> 1.75 in)
const written=[];
// First sergeant diamond (CAPR 39-1 10.10.4, Fig A5-5): small silver rhombus on the chevron's centre line in the open field above the shield.
// Measured on the A5-5 MSgt/SMSgt/CMSgt "with diamond" figures: width 0.211 of chevron width (0.216/0.209/0.209), width:height 1.34,
// centre 0.475 / 0.571 / 0.658 chevron-widths below the apex (grade height differs, so offset is per grade).
const DIA={w_over_chev_w:0.211,w_over_h:1.34,cy_over_chev_w:{'master-sergeant':0.475,'senior-master-sergeant':0.571,'chief-master-sergeant':0.658}};
const BORDER_NOTE='border: CAPR 39-1 5.1.1.1.1.1 / 5.1.1.1.1.3 (ABU) and 7.1.1.8 (OCP/tactical cap), 1/8 in showing past the widest and tallest point';
// Mount rules by form (regulation audit 2026-10-13): cadet NCOs and Airmen wear METAL chevrons on both sides of the collar / coat lapels, and
// on the 2 in OCP square; they wear NO insignia on the OCP/ABU/tactical/patrol caps (7.1.1.8, 6.2.11.1).
const MOUNT_METAL=[{uniform:'Class A / old-style / mess-less service coat lapels',rule:'metal chevrons on both coat lapels, halfway up the seam, resting on but not over it, parallel with the ground; Airman Basic wears none (4.1.5.2.1.4, 4.1.7.2.1.2, 4.1.9.3.5, 4.1.10.1.1.2)'},
  {uniform:'Class B / blue shirt, blouse, aviator-style shirt, sweaters, jackets, topcoat: collar',rule:'both sides of the collar, 1 in from and parallel to the front of the collar, centered; Fig A5-5; Airman Basic wears none (4.1.11.1.1.1.4, 4.1.12.2.3.5, 4.2.5.1.1.5, 4.2.6.2.5, 6.1.1.4, 6.1.3.4). Not worn on the blue shirt under the service coat (4.1.6.1.5). Removed for the Corporate Service Uniform (4.2.5.1.1.5 note).'},
  {uniform:'ABU / BDU / blue field uniform coat collar',rule:'metal chevrons on both sides of the collar, 1 in from and parallel to the front of the collar, centered (5.1.1.1.1.4, 5.1.2.2.6, 5.2.1.1.1.6)'},
  {uniform:'OCP coat / fleeces',rule:'metal device on the 2 in dark blue square (7.1.1.2.2, 6.1.10.2.2, 6.1.14.4.2); Airman Basic wears no device and no blue material'},
  {uniform:'OCP / ABU / tactical / patrol caps',rule:'NONE: cadet NCOs and Airmen wear no insignia on these caps (7.1.1.8, 6.2.11.1)'}];
const MOUNT_OCP=[MOUNT_METAL[3]];
const MOUNT_CLOTH=[{uniform:'(no regulation mount)',rule:'the regulation prescribes METAL chevrons for cadet NCOs and Airmen on every uniform (see MOUNT_METAL); this cloth-bordered form was built at the requester\'s direction and has no authorized position (7.1.1.8 and 6.2.11.1 bar insignia on the caps). Not for use on caps.'}];

for(const [key,name,abbr,file] of GRADES){
  const t=load(file),sil=big(t),[x0,x1,y0,y1]=bbox([sil]);
  const k=KPX/4;                                                          // inches per trace unit
  const Wi=+((x1-x0)*k).toFixed(4),Hi=+((y1-y0)*k).toFixed(4),W=Wi*U,H=Hi*U;
  const tr=q=>[(q[0]-x0)*k*U,(q[1]-y0)*k*U];
  const D=ps=>ps.map(p=>'M'+p.map(q=>{const r=tr(q);return f2(r[0])+','+f2(r[1]);}).join('L')+'Z').join('');
  const keep=ps=>ps.filter(p=>area(p)>3*16);                              // drop sub-3px specks (photo px^2 at 4x)
  const an=(w,h)=>({top_center:[w/2,0],bottom_center:[w/2,h],center:[w/2,h/2],left_edge:[0,h/2],right_edge:[w,h/2]});
  for(const fs1 of (DIA.cy_over_chev_w[key]?[false,true]:[false])){
    const tag=fs1?'-first-sergeant':'',label=fs1?' with first sergeant diamond':'';
    let dia=null;
    if(fs1){const dw=DIA.w_over_chev_w*Wi*U,dh=dw/DIA.w_over_h,cx=W/2,cy=DIA.cy_over_chev_w[key]*Wi*U;
      dia={w_in:+(dw/U).toFixed(4),h_in:+(dh/U).toFixed(4),cx,cy,pts:[[cx,cy-dh/2],[cx+dw/2,cy],[cx,cy+dh/2],[cx-dw/2,cy]]};}
    const body=pre=>`<g id="${pre}__field"><path d="${D([sil])}" fill="${C.navy}"/></g>`
      +`<g id="${pre}__silver"><path d="${D(keep(t.silver))}" fill="${C.silver}" stroke="${C.silver}" stroke-width="0.4" stroke-linejoin="round" fill-rule="evenodd"/></g>`
      +`<g id="${pre}__red"><path d="${D(keep(t.red))}" fill="${C.red}" stroke="${C.red}" stroke-width="0.4" stroke-linejoin="round" fill-rule="evenodd"/></g>`
      +`<g id="${pre}__navy"><path d="${D(keep(t.navy))}" fill="${C.navy}" fill-rule="evenodd"/></g>`
      +(dia?`<g id="${pre}__first_sergeant_diamond"><path d="M${dia.pts.map(q=>f2(q[0])+','+f2(q[1])).join('L')}Z" fill="${C.silver}"/></g>`:'');
    const base={size_source:'estimated',size_basis:`Scale ${(1/KPX).toFixed(1)} photo px per inch: the Vanguard Cadet CMSgt photo (${H_CM_PX.toFixed(0)} px tall) is set to 1.75 in, from the requester's statement (2026-10-12) that it nearly fills the 2 in OCP square leaving about 1/8 in top and bottom; CAPR 39-1 Fig A5-5 gives no inch size. Every grade uses the same scale (the photos share one scale: 381 px chevron width).`
        +(fs1?` Diamond: measured on CAPR 39-1 Fig A5-5 (width ${DIA.w_over_chev_w} of chevron width, width:height ${DIA.w_over_h}).`:''),
      colours:C,provenance:'traced from the Vanguard cadet chevron photos (images/ranks/C) at the requester\'s direction; chrome shading flattened by chroma classification'+(fs1?'; first sergeant diamond drawn from CAPR 39-1 Fig A5-5 measurements':''),
      mounts:MOUNT_METAL,
      rank:{grade:name,abbrev:abbr,membership:'cadet',first_sergeant:fs1},grade:'rank-insignia'};
    if(fs1)base.wear_rule='Cadet MSgt/SMSgt/CMSgt appointed cadet first sergeant only, for the period of appointment (CAPR 39-1 10.10.4)';
    const mk=(sid,nm,w,h,anchors,dims,inner,extra={})=>{const vb=[0,0,+(w*U).toFixed(2),+(h*U).toFixed(2)];
      const m={asset_id:sid,name:nm,size_in:{w:+w.toFixed(4),h:+h.toFixed(4)},units:'1 user unit = 0.01 in',viewBox:vb,...base,...extra,anchors,dimensions:dims};
      fs.writeFileSync(path.join(OUT,sid+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(4)}in" height="${h.toFixed(4)}in" viewBox="${vb.join(' ')}" data-asset-id="${sid}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(nm)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${inner}</svg>`);
      fs.writeFileSync(path.join(OUT,sid+'.spec.json'),JSON.stringify({...m,fit:{method:'n/a',score:null}},null,1));written.push(sid);};
    const dd=dia?{first_sergeant_diamond_w_in:dia.w_in,first_sergeant_diamond_h_in:dia.h_in}:{};
    const id=`rank-cadet-nco-${key}${tag}-metal`;
    mk(id,`${name}${label} metal chevron`,Wi,Hi,{...an(W,H),...(dia?{diamond_center:[dia.cx,dia.cy]}:{})},
      {form:'metal chevron (cadet NCO / Airman), flat colour',nominal_width_in:Wi,height_in:Hi,aspect_h_over_w:+(Hi/Wi).toFixed(4),...dd},body(id));
    const sid=`rank-cadet-nco-${key}${tag}-ocp-square`,SW=SQ*U,ox=(SW-W)/2,oy=(SW-H)/2;
    mk(sid,`${name}${label} metal chevron on the 2 in OCP square`,SQ,SQ,{...an(SW,SW),insignia_center:[SW/2,SW/2]},
      {form:'metal chevron centred on a 2x2 square canvas (no cloth: place on rank-ocp-square-blank)',backing:'none',square_in:SQ,chevron_w_in:Wi,chevron_h_in:Hi,clear_blue_top_bottom_in:+((SQ-Hi)/2).toFixed(4),clear_blue_left_right_in:+((SQ-Wi)/2).toFixed(4),...dd},
      `<g id="${sid}__device" transform="translate(${f2(ox)} ${f2(oy)})">${body(sid+'__dev')}</g>`,{mounts:MOUNT_OCP});
    // cloth-bordered: dark blue cloth showing 1/8 in past the widest and tallest point (ABU collar, OCP/ABU/tactical cap)
    const bid=`rank-cadet-nco-${key}${tag}-cloth-bordered`,B=BORDER*U,CW=W+2*B,CH=H+2*B;
    mk(bid,`${name}${label} chevron on cloth (1/8 in border)`,CW/U,CH/U,{...an(CW,CH),insignia_center:[CW/2,CH/2],insignia_left:[B,CH/2],insignia_right:[CW-B,CH/2]},
      {form:'chevron on cloth',border_each_side_in:BORDER,insignia_w_in:Wi,insignia_h_in:Hi,cloth_w_in:+(CW/U).toFixed(4),cloth_h_in:+(CH/U).toFixed(4),...dd},
      `<g id="${bid}__cloth"><rect id="${bid}__backing" width="${f2(CW)}" height="${f2(CH)}" fill="${C.cloth}"/></g><g id="${bid}__device" transform="translate(${f2(B)} ${f2(B)})">${body(bid+'__dev')}</g>`,
      {mounts:MOUNT_CLOTH,regulation_authorized_mount:false,regulation_note:'Kept at the requester\'s direction. CAPR 39-1 prescribes METAL chevrons for cadet NCOs and Airmen on every uniform and bars all insignia for them on the OCP/ABU/tactical caps (7.1.1.8, 6.2.11.1); no cloth chevron position exists. The importer should not offer this form by default.',size_citation:BORDER_NOTE,cloth_color:{hex:C.cloth,note:'dark blue cloth; same hex as the utility-uniform rank square and tapes (make-ocp-abu.js)'}});
  }
}
console.log('flat cadet NCO chevrons:',written.length,'assets; scale',(1/KPX).toFixed(1),'px/in');
