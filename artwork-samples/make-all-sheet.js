// One PNG with every CAP ribbon (440x120 each, exact 11:3), names underneath. * = not from the official PDF.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'cap-ribbons');
const specs=JSON.parse(fs.readFileSync(path.join(dir,'specs.json'))).ribbons;
const cols=6,cw=440,ch=120,gap=36,lab=42,pad=40;
const rows=Math.ceil(specs.length/cols);
const devs=JSON.parse(fs.readFileSync(path.join(__dirname,'cap-devices','devices.json')));
const dcols=10,dcell=250,dsz=190,dlab=36,dhead=70;
const drows=Math.ceil(devs.length/dcols);
const ribbonsH=rows*(ch+lab)+(rows-1)*gap;
const W=pad*2+cols*cw+(cols-1)*gap,H=pad*2+ribbonsH+dhead+drows*(dsz+dlab+gap);
const S=Math.max(W,H);
let g='';
specs.forEach((r,i)=>{
  const x=pad+(i%cols)*(cw+gap),y=pad+Math.floor(i/cols)*(ch+lab+gap);
  const b64=fs.readFileSync(path.join(dir,'png@4x',r.id+'.png')).toString('base64');
  const star=r.source.startsWith('CAPR')?'':' *';
  g+=`<image x="${x}" y="${y}" width="${cw}" height="${ch}" xlink:href="data:image/png;base64,${b64}"/>`
   +`<text x="${x}" y="${y+ch+26}" font-family="Arial,Helvetica,sans-serif" font-size="20" fill="#e6e9ee">${r.name.replace(/&/g,'&amp;')}${star}</text>`;
});
const sx=(W-pad*2-dcols*dcell)/2+pad;
g+=`<text x="${pad}" y="${pad+ribbonsH+46}" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="700" fill="#e6e9ee">Devices</text>`;
devs.forEach((d,i)=>{
  const x=sx+(i%dcols)*dcell,y=pad+ribbonsH+dhead+Math.floor(i/dcols)*(dsz+dlab+gap);
  const b64=fs.readFileSync(path.join(__dirname,'cap-devices',d.id+'.png')).toString('base64');
  g+=`<image x="${x}" y="${y}" width="${dsz}" height="${dsz}" xlink:href="data:image/png;base64,${b64}"/>`
   +`<text x="${x+dsz/2}" y="${y+dsz+24}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="19" fill="#e6e9ee">${d.name.replace(/&/g,'&amp;')}</text>`;
});
const oy=(S-H)/2;
fs.writeFileSync(path.join(dir,'all-ribbons.svg'),`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#1a1d24"/><g transform="translate(${(S-W)/2} ${oy})">${g}</g></svg>`);
console.log({W,H,S,oy});
