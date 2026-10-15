// QA sheet: vendor raster (left) vs built SVG geometry (right), from the built .spec.json files.
// usage: node qa-built.js out.svg <class|all> <page> [pageSize]
const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'../../ribbons/military'),REPO=path.join(__dirname,'../../../..');
const [out,cls='all',pg='0',ps='30']=process.argv.slice(2);
let specs=fs.readdirSync(D).filter(f=>f.endsWith('.spec.json')).map(f=>JSON.parse(fs.readFileSync(path.join(D,f))));
if(cls!=='all')specs=specs.filter(s=>cls.split(',').includes(s.classification));
const total=specs.length;specs=specs.slice(+pg*+ps,(+pg+1)*+ps);
const w=300,h=82,cols=3,gap=18;let g='';
specs.forEach((s,i)=>{
  const x=gap+(i%cols)*(2*w+16+gap),y=gap+Math.floor(i/cols)*(h+26);
  const img=path.join(REPO,s.measurement.source_images[0]);const ext=img.split('.').pop();
  const mime=ext==='png'?'image/png':ext==='svg'?'image/svg+xml':'image/jpeg';
  g+=`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" xlink:href="data:${mime};base64,${fs.readFileSync(img).toString('base64')}"/>`;
  const dm=s.dimensions;
  if(dm.orientation==='horizontal-bands')dm.stripes.forEach(st=>{g+=`<rect x="${x+w+16}" y="${y+st.y0_in/0.375*h}" width="${w}" height="${st.fraction*h+0.4}" fill="#${st.hex}"/>`;});
  else dm.stripes.forEach(st=>{g+=`<rect x="${x+w+16+st.x0_in/1.375*w}" y="${y}" width="${st.fraction*w+0.4}" height="${h}" fill="#${st.hex}"/>`;});
  if(dm.traced_layers&&s.trace_paths){}
  (dm.stars||[]).forEach(st=>{const cx=x+w+16+st.center_in[0]/1.375*w,cy=y+st.center_in[1]/0.375*h,r=st.outer_radius_in/1.375*w;
    const p=[];for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr=k%2?r*0.382:r;p.push((cx+rr*Math.cos(a)).toFixed(1)+','+(cy+rr*Math.sin(a)*(h/w)*(1.375/0.375)).toFixed(1));}
    g+=`<polygon points="${p.join(' ')}" fill="#fff"/>`;});
  g+=`<text x="${x}" y="${y+h+14}" font-family="Arial" font-size="11" fill="#e6e9ee">${s.asset_id.replace('mil-ribbon-','')}  [${s.classification}] n=${dm.stripes.length}</text>`;
});
const W=gap+cols*(2*w+16+gap),H=gap+Math.ceil(specs.length/cols)*(h+26),S=Math.max(W,H);
fs.writeFileSync(out,`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#1a1d24"/>${g}</svg>`);
console.log('page',pg,'of',Math.ceil(total/+ps),'W',W,'H',H,'S',S);
