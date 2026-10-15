// Senior NCO grade on the 2 x 2 in dark blue OCP square (CAPR 39-1 7.1.1.2.1: "embroidered grade insignia on 2" x 2" dark blue material").
// Built from the measured chevron assets (insignia/rank-senior-<grade>-chevron-3p5in): the stripes group only, scaled uniformly so the chevron
// is 1.75 in tall at most (1/8 in of blue on each side), centred on the square. No new artwork is drawn.
const fs=require('fs'),path=require('path'),html=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const DIR=path.join(__dirname,'insignia'),U=100,SQ=2,BLUE='#142347',MAXH=1.75;
const GR=['staff-sergeant','technical-sergeant','master-sergeant','senior-master-sergeant','chief-master-sergeant','command-chief'];
const esc=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;');
for(const g of GR){
  const src=fs.readFileSync(path.join(DIR,`rank-senior-${g}-chevron-3p5in.svg`),'utf8');
  const meta=JSON.parse(html(src.match(/<metadata>([\s\S]*?)<\/metadata>/)[1]));
  const w=meta.size_in.w,h=meta.size_in.h,k=Math.min(MAXH/h,1.5/w),sw=w*k,sh=h*k;
  const id=`rank-senior-${g}-ocp-square`;
  const stripes=src.match(/<g id="[^"]+__stripes">[\s\S]*?<\/g>/)[0].replace(/rank-senior-[a-z-]+-chevron-3p5in__/g,id+'__');
  const ox=(SQ-sw)/2*U,oy=(SQ-sh)/2*U;
  const m={asset_id:id,name:`${meta.rank.grade} grade on the 2 in OCP square`,size_in:{w:SQ,h:SQ},units:'1 user unit = 0.01 in',viewBox:[0,0,SQ*U,SQ*U],
    size_source:'regulation',size_citation:'CAPR 39-1 7.1.1.2.1 (ICL 25-06): grade insignia on 2" x 2" dark blue material, front of the OCP coat, centre of the chest. The 2 in square is regulation; the chevron scale is estimated.',
    anchors:{top_center:[100,0],bottom_center:[100,200],center:[100,100],left_edge:[0,100],right_edge:[200,100],insignia_center:[100,100]},
    dimensions:{form:'on the 2 in OCP square',square_in:SQ,insignia_w_in:+sw.toFixed(3),insignia_h_in:+sh.toFixed(3),scale_vs_3p5in_chevron:+k.toFixed(4),fits_inside_square:true,blue_border_min_in:+((SQ-sh)/2).toFixed(3),cloth_hex:BLUE},
    estimated:'Chevron scale on the square (the regulation gives no size for NCO grade on the OCP square); source chevron is the 3 1/2 in measured form.',
    derived_from:`insignia/rank-senior-${g}-chevron-3p5in`,
    mounts:[{uniform:'OCP coat',rule:'2 in x 2 in dark blue square at the centre of the chest, between the name tape and CAP tape (7.1.1.2.1); asset baseline rotation 0',placement:{rotate_deg:0}}],
    rank:meta.rank,grade:'rank-insignia'};
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${SQ.toFixed(4)}in" height="${SQ.toFixed(4)}in" viewBox="0 0 ${SQ*U} ${SQ*U}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(m.name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>`
    +`<g id="${id}__cloth"><rect id="${id}__backing" width="${SQ*U}" height="${SQ*U}" fill="${BLUE}"/></g>`
    +`<g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(5)})">${stripes}</g></svg>`;
  fs.writeFileSync(path.join(DIR,id+'.svg'),svg);fs.writeFileSync(path.join(DIR,id+'.spec.json'),JSON.stringify(m,null,1));
  console.log(id,sw.toFixed(2),'x',sh.toFixed(2));}
