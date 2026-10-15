// Render recipe -> SVG composite next to the precomposed raster. usage: node verify-recipes.js out.svg [n=12]
const fs=require('fs'),path=require('path');
const A=path.join(__dirname,'../..'),REPO=path.join(A,'..','..');
const R=JSON.parse(fs.readFileSync(path.join(A,'ribbons/military-variants.json')));
const n=+(process.argv[3]||12);
// pick a spread: distinct device combinations, preferring different awards
const picks=[],seen=new Set();
for(const v of R.variants){const k=v.devices.map(d=>d.catalog_id).join('+');if(seen.has(k))continue;seen.add(k);picks.push(v);}
const sel=picks.filter((_,i)=>i%Math.max(1,Math.floor(picks.length/n))===0).slice(0,n);
const cw=330,ch=90,gap=22;let g='';
const specOf=id=>{const d=fs.existsSync(path.join(A,'ribbons/military',id+'.spec.json'))?path.join(A,'ribbons/military',id+'.spec.json'):path.join(A,'devices',id+'.spec.json');return JSON.parse(fs.readFileSync(d));};
sel.forEach((v,i)=>{
  const x=gap+(i%2)*(cw*2+60),y=gap+Math.floor(i/2)*(ch+40);
  g+=`<image x="${x}" y="${y}" width="${cw}" height="${ch}" preserveAspectRatio="none" xlink:href="data:image/png;base64,${fs.readFileSync(path.join(REPO,v.raster.asset)).toString('base64')}"/>`;
  const bx=x+cw+14,sx=cw/1.375,sy=ch/0.375;
  const bs=specOf(v.base_ribbon_id);
  bs.dimensions.stripes.forEach(s=>{g+=`<rect x="${bx+s.x0_in*sx}" y="${y}" width="${s.fraction*cw+0.4}" height="${ch}" fill="#${s.hex}"/>`;});
  v.devices.forEach(d=>{
    const sp=specOf(d.asset_id),svgf=fs.existsSync(path.join(A,'devices',d.asset_id+'.svg'))?path.join(A,'devices',d.asset_id+'.svg'):null;
    const sc=d.scale_to_match_raster,w=sp.size_in.w*sc,h=sp.size_in.h*sc;
    g+=`<image x="${bx+d.center_in[0]*sx-w*sx/2}" y="${y+d.center_in[1]*sy-h*sy/2}" width="${w*sx}" height="${h*sy}" xlink:href="data:image/svg+xml;base64,${fs.readFileSync(svgf).toString('base64')}"/>`;});
  g+=`<text x="${x}" y="${y+ch+14}" font-family="Arial" font-size="12" fill="#e6e9ee">${v.award_id} | ${v.devices.map(d=>d.catalog_id).join('+')||'no devices'} | base ${v.base_ribbon_id}</text>`;
});
const S=1500;fs.writeFileSync(process.argv[2],`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#1a1d24"/>${g}</svg>`);
console.log('rendered',sel.length,'recipes:',sel.map(v=>v.devices.map(d=>d.catalog_id).join('+')||'none').join(' | '));
