// QA: raster (left) vs the BUILT svg file itself (right, embedded as image). usage: node qa-svg.js out.svg class[,class] page size
const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'../../ribbons/military'),REPO=path.join(__dirname,'../../../..');
const [out,cls='all',pg='0',ps='30']=process.argv.slice(2);
let specs=fs.readdirSync(D).filter(f=>f.startsWith('mil-ribbon-')&&f.endsWith('.spec.json')).map(f=>JSON.parse(fs.readFileSync(path.join(D,f))));
specs=specs.filter(s=>cls==='all'||cls.split(',').includes(s.classification)||(cls.split(',').includes('framed')&&s.dimensions.frame)||(cls.split(',').includes('fallback')&&s.measurement.fallback_central_stripes_only));
const total=specs.length;specs=specs.slice(+pg*+ps,(+pg+1)*+ps);
const w=300,h=82,cols=3,gap=18;let g='';
specs.forEach((s,i)=>{const x=gap+(i%cols)*(2*w+16+gap),y=gap+Math.floor(i/cols)*(h+26);
  const img=path.join(REPO,s.measurement.source_images[0]),ext=img.split('.').pop();
  const mime=ext==='png'?'image/png':ext==='svg'?'image/svg+xml':'image/jpeg';
  g+=`<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" xlink:href="data:${mime};base64,${fs.readFileSync(img).toString('base64')}"/>`;
  g+=`<image x="${x+w+16}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" xlink:href="data:image/svg+xml;base64,${fs.readFileSync(path.join(D,s.asset_id+'.svg')).toString('base64')}"/>`;
  g+=`<text x="${x}" y="${y+h+14}" font-family="Arial" font-size="11" fill="#e6e9ee">${s.asset_id.replace('mil-ribbon-','')} [${s.classification}${s.dimensions.frame?'+frame':''}] ${s.measurement.fidelity}</text>`;});
const W=gap+cols*(2*w+16+gap),H=gap+Math.ceil(specs.length/cols)*(h+26),S=Math.max(W,H);
fs.writeFileSync(out,`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#1a1d24"/>${g}</svg>`);
console.log('items',specs.length,'of',total,'S',S);
