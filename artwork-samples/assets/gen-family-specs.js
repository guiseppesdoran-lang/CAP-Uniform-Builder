// Generates the NAMED-VALUE spec tables for the two shared-body families (ground team, wings) from their fitted parameter files, so the
// emitted asset specs expose intra-badge dimensions + regulation-style landmarks (in the art's own source units; emit converts to inches).
const fs=require('fs'),path=require('path');
const R=p=>path.join(__dirname,'..',p);
const out={};
// ---------------- ground team (body units = 240x203 reference grid of the senior badge)
{
  const gt=JSON.parse(fs.readFileSync(R('family/ground-team/body-params.json')));
  const gtb=JSON.parse(fs.readFileSync(R('family/ground-team/body-params-basic.json')));
  const xf=JSON.parse(fs.readFileSync(R('family/ground-team/master-transform.json')));
  const tri={apexX:118,apexY:61,baseY:138,left:80.5,right:155.5};
  const mk=(P,withStar,device)=>{const F=P.fixed,d=F.disc,s=F.star,rb=F.ribbon;
    const dims={disc_radius:d.R,disc_rim_radius:d.rim,triangle_height:tri.baseY-tri.apexY,triangle_base_width:tri.right-tri.left,
      wreath_band_width:P.bandW,wreath_leaf_length:P.leaf.adv,wreath_leaf_width:P.leaf.wid,ribbon_width:rb.w,ribbon_length:rb.y1-rb.y0,
      wreath_semi_axis_x:P.stem.a,wreath_semi_axis_up:P.stem.up,wreath_semi_axis_low:P.stem.low};
    const anchors={disc_center:[d.cx,d.cy],disc_top:[d.cx,d.cy-d.R],triangle_apex:[tri.apexX,tri.apexY],triangle_base_center:[(tri.left+tri.right)/2,tri.baseY],
      ribbon_tail_left:[d.cx-rb.half,rb.y1],ribbon_tail_right:[d.cx+rb.half,rb.y1],wreath_bottom:[d.cx,P.stem.cy+P.stem.low]};
    const counts={wreath_nodes_per_branch:P.nodes.n,wreath_leaf_rows:2};
    if(withStar){dims.star_radius=s.R;counts.star_inner_ratio=s.ratio;counts.star_points=5;anchors.star_center=[s.cx,s.cy];anchors.star_base=[s.cx,s.cy+s.R*Math.cos(Math.PI/5)];anchors.star_top=[s.cx,s.cy-s.R];}
    if(device==='master'){const D=xf.device;dims.device_wreath_outer_radius=D.R;anchors.device_center=[D.cx,D.cy];anchors.device_base=[D.cx,D.cy+D.R];}
    return {dimensions:dims,anchors,counts};};
  out['senior_ground_team_badge']={family:'ground-team',variant:'senior',...mk(gt,true,'senior')};
  out['master_ground_team_badge']={family:'ground-team',variant:'master',...mk(gt,false,'master')};
  out['ground_team_basic_badge']={family:'ground-team',variant:'basic',...mk(gtb,false,'none')};
}
// ---------------- wings (body grid 240 wide; variant svgs place it with translate/scale, handled in the build via the emitted transform)
{
  const P=JSON.parse(fs.readFileSync(R('wings/q12.json')));const CX=120;
  const r=P.roundel,st=P.star;
  const body={roundel_rx:r.rx,roundel_ry:r.ry,star_radius:st.R,wing_semi_span:CX-P.T[0][0],feather_count:P.T.length-1};
  const A={roundel_center:[CX,r.cy],roundel_bottom:[CX,r.cy+r.ry],roundel_top:[CX,r.cy-r.ry],star_center:[CX,st.cy],wing_tip_left:[P.T[0][0],P.T[0][1]],wing_tip_right:[2*CX-P.T[0][0],P.T[0][1]],centerline_bottom:[CX,r.cy+r.ry]};
  out['__wings_body']={family:'wings',body_grid_width:240,dimensions:body,anchors:A};
}
fs.writeFileSync(path.join(__dirname,'specs/families.spec.json'),JSON.stringify(out,null,1));
console.log(Object.keys(out).join(', '));
