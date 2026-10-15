// Contact sheets of the built military ribbons (the built SVG files themselves).  node sheet.js outPrefix [perPage=64]
const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'../../ribbons/military');
const [prefix,pp='64']=process.argv.slice(2);
const ids=fs.readdirSync(D).filter(f=>f.startsWith('mil-ribbon-')&&f.endsWith('.svg')).map(f=>f.replace(/\.svg$/,'')).sort();
const cols=8,cw=190,ch=52,lab=34,gap=12,pad=14;
for(let page=0;page*+pp<ids.length;page++){
  const list=ids.slice(page*+pp,(page+1)*+pp);let g='';
  list.forEach((id,i)=>{const x=pad+(i%cols)*(cw+gap),y=pad+Math.floor(i/cols)*(ch+lab+gap);
    g+=`<image x="${x}" y="${y}" width="${cw}" height="${ch}" preserveAspectRatio="none" xlink:href="data:image/svg+xml;base64,${fs.readFileSync(path.join(D,id+'.svg')).toString('base64')}"/>`;
    const nm=id.replace('mil-ribbon-','');const a=nm.slice(0,30),b=nm.slice(30,60);
    g+=`<text font-family="Arial" font-size="9.5" fill="#e6e9ee"><tspan x="${x}" y="${y+ch+12}">${a}</tspan><tspan x="${x}" y="${y+ch+23}">${b}</tspan></text>`;});
  const W=pad*2+cols*(cw+gap),H=pad*2+Math.ceil(list.length/cols)*(ch+lab+gap),S=Math.max(W,H);
  fs.writeFileSync(`${prefix}${page}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#1a1d24"/>${g}</svg>`);
  console.log('page',page,'items',list.length,'W',W,'H',H,'S',S);}
