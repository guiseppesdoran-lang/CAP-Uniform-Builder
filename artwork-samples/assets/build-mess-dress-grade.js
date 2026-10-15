// Mess dress grade pieces (CAPR 39-1 4.1.1.1.1.1 / .4, 4.1.2.1.1.1 / .4, Fig A5-3; DAFI 36-2903 4.1.1.2-3, 4.1.2.2-3):
//   rank-senior-<grade>-bullion              officer grade on the mess dress shoulder boards: "metal bullion" grade, gold for 2d Lt / Major, silver otherwise
//   rank-senior-<grade>-chevron-white-<w>in  enlisted "white chevron" for the outer arm (mess dress only): men 4 in, women 3 1/2 or 4 in
// Derived from the family's embroidered thread shapes / the Fig A5-4 chevron trace (same geometry, recoloured); sizes are the family sizes (CAPR gives no bullion size).
const fs=require('fs'),path=require('path');
const IN=path.join(__dirname,'insignia'),U=100,written=[];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const BUL={silver:{base:'#c6cbd1',line:'#8f969e',edge:'#7d848c'},gold:{base:'#cfa93a',line:'#9b7a1c',edge:'#7a5f10'}};
const pat=(id,c)=>`<defs><pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="3" height="3" fill="${c.base}"/><path d="M0,0.8H3" stroke="${c.line}" stroke-width="0.7"/></pattern></defs>`;
function write(id,W,H,meta,body){
  const vb=[0,0,+(W*U).toFixed(2),+(H*U).toFixed(2)];
  const m={asset_id:id,units:'1 user unit = 0.01 in',viewBox:vb,...meta,size_in:{w:+W.toFixed(4),h:+H.toFixed(4)}};
  fs.writeFileSync(path.join(IN,id+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(4)}in" height="${H.toFixed(4)}in" viewBox="${vb.join(' ')}" data-asset-id="${id}" data-source="reference-art-measured" data-units="0.01in"><title>${esc(meta.name)}</title><metadata>${esc(JSON.stringify(m))}</metadata>${body}</svg>`);
  fs.writeFileSync(path.join(IN,id+'.spec.json'),JSON.stringify({...m,fit:{method:'n/a',score:null}},null,1));written.push(id);}
const body=f=>fs.readFileSync(path.join(IN,f+'.svg'),'utf8').replace(/^[\s\S]*?<\/metadata>/,'').replace(/<\/svg>\s*$/,'');
const spec=f=>JSON.parse(fs.readFileSync(path.join(IN,f+'.spec.json'),'utf8'));

// ---- bullion officer grade
const GR=[['brigadier-general-1in','brigadier-general'],['major-general-1in-vertical','major-general'],['colonel','colonel'],['lieutenant-colonel','lieutenant-colonel'],['major','major'],['captain','captain'],
  ['first-lieutenant','first-lieutenant'],['second-lieutenant','second-lieutenant'],['flight-officer','flight-officer'],['technical-flight-officer','technical-flight-officer'],['senior-flight-officer','senior-flight-officer']];
const BOARDS=[{uniform:'Men\'s mess dress shoulder boards (garment-mess-dress-male-officer-shoulder-boards)',board_in:[5.5,2.25],button:true,braid:'1/2 in dark blue lace each side (general officer boards: silver lace with 1/2 in blue lace)',cite:'4.1.1.1.1.1, Fig A5-3'},
  {uniform:'Women\'s mess dress shoulder boards (garment-mess-dress-female-officer-shoulder-boards)',board_in:[4.5,2.0],button:false,braid:'1/4 in blue lace each side on every grade (Fig A5-3), no button',cite:'4.1.2.1.1.1, Fig A5-3'}];
for(const [src,out] of GR){
  const sid=`rank-senior-${src}-thread`,s=spec(sid),id=`rank-senior-${out}-bullion`,gold=/#f2d40a/i.test(body(sid)),C=gold?BUL.gold:BUL.silver,pid=id+'__bullion';
  let b=body(sid).split(sid+'__').join(id+'__').replace(/#eef1f4/gi,`url(#${pid})`).replace(/#f2d40a/gi,`url(#${pid})`).replace(/#aab3bc|#b8960a/gi,C.edge);
  b=pat(pid,C)+b;
  const W=s.size_in.w,H=s.size_in.h,mx=Math.max(W,H);
  write(id,W,H,{name:`${s.rank.grade} bullion grade insignia, mess dress shoulder board`,
    size_source:'estimated',size_basis:`Same shape and size as the embroidered form ${sid} (${W} x ${H} in): CAPR 39-1 Fig A5-3 says only that the grade on the boards is metal bullion and gives no size. Male boards 5 1/2 x 2 1/4 in, female 4 1/2 x 2 in.`,
    provenance:`recoloured from ${sid}: bullion ${gold?'gold':'silver'} (2d Lt and Major gold, others silver, matching the metal and thread forms); bullion texture drawn as a diagonal line pattern`,
    colours:{bullion:C.base,bullion_line:C.line,bullion_edge:C.edge,...(s.colours||{})},
    anchors:{...s.anchors,rank_slot_center:s.anchors.center,mount_center:s.anchors.center},
    dimensions:{...s.dimensions,form:'metal bullion grade insignia (mess dress shoulder board)',thread:gold?'gold bullion':'silver bullion',slot_fit:(()=>{const eagle=out==='colonel',bars=/lieutenant|captain|flight-officer/.test(out)&&out!=='lieutenant-colonel',al=eagle||bars?W:H,ac=eagle||bars?H:W;   // slot 1.5 along the board x 1.2 across (garment rank_slot_*_frame, 2026-10-13): leaf/stars stem along the board, bars across, eagle wingspan along
      return {garment_rank_slot_in:{along:1.5,across:1.2},piece_along_in:+al.toFixed(3),piece_across_in:+ac.toFixed(3),scale_to_garment_slot:+Math.min(1,1.5/al,1.2/ac).toFixed(3),note:'placement rule: leaf stem / stacked stars along the board, bars across, Colonel eagle wingspan along the board; scale < 1 only if the piece must stay inside the slot'};})()},
    mounts:BOARDS.map(m=>({uniform:m.uniform,rule:`centred on the board with the board centre line, as close to the shoulder seam as possible; board ${m.board_in[0]} x ${m.board_in[1]} in, ${m.braid}${m.button?', button at the peak':''} (${m.cite}). Lt Col / Major stem points away from the collar, Colonel eagle beak forward (4.1.1.1.1.2-3). No distance from the board end is given by CAPR 39-1 or DAFI 36-2903; use the garment rank_slot centre.`})),
    rank:s.rank,grade:'rank-insignia'},b);
}
// ---- white mess dress NCO chevrons
for(const g of ['staff-sergeant','technical-sergeant','master-sergeant','senior-master-sergeant','chief-master-sergeant','command-chief']) for(const w of ['3p5in','4in']){
  const sid=`rank-senior-${g}-chevron-${w}`,s=spec(sid),id=`rank-senior-${g}-chevron-white-${w}`;
  let b=body(sid).split(sid+'__').join(id+'__').replace(/<g id="[^"]*__field">[\s\S]*?<\/g>/,'').replace(/#dadadc/gi,'#f4f5f6');
  const men4=w==='4in';
  write(id,s.size_in.w,s.size_in.h,{name:`${s.rank.grade} white chevron (mess dress), ${s.dimensions.nominal_width_in} in`,
    size_source:'regulation',size_citation:'DAFI 36-2903 4.1.1.3 / 4.1.2.3 and CAPR 39-1 4.1.1.1.1.4 (men 4 in white chevron) / 4.1.2.1.1.4 (women 3 1/2 or 4 in white chevron); outline and proportions from Fig A5-4',
    provenance:`${sid} with the dark blue field removed and the stripes, letters and emblem in white: the mess dress sleeve is dark blue, so the chevron is white only (no regulation figure of the white chevron; colour is the regulation word "white")`,
    colours:{stripe_hex:'#f4f5f6',field:'none (the sleeve is the field)'},anchors:{...s.anchors},
    dimensions:{...s.dimensions,form:'white embroidered chevron (mess dress only), no field',field_hex:null,stripe_hex:'#f4f5f6'},
    mounts:[{uniform:'Mess dress, '+(men4?'men (4 in only)':'women (3 1/2 or 4 in)'),rule:`centred on the outer arm halfway between the shoulder seam and the elbow bent at 90 degrees (4.1.1.1.1.4${men4?'':', 4.1.2.1.1.4'}); mess dress only`}],
    first_sergeant_note:'the first sergeant diamond applies to cadet first sergeants (CAPR 39-1 10.10.4), who wear metal chevrons and no mess dress chevron; not built for the senior chevrons',
    rank:s.rank,grade:'rank-insignia'},b);
}
console.log('mess dress grade pieces:',written.length);
