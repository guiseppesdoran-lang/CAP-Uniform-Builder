// QA: repo device raster (left) vs built SVG (right).  node qa-devices.js out.svg
const fs=require('fs'),path=require('path');const REPO=path.join(__dirname,'../../../..'),DEV=path.join(__dirname,'../../devices');
const pairs=[['bronze_olc','mil-device-olc-bronze'],['silver_olc','mil-device-olc-silver'],['bronze_hourglass','mil-device-hourglass-bronze'],['gold_hourglass','mil-device-hourglass-gold'],['arrowhead','mil-device-arrowhead'],['c_device','mil-device-letter-c'],['r_device','mil-device-letter-r'],['m_device','mil-device-letter-m'],['n_device','mil-device-letter-n'],['numeral_12','mil-device-numeral-12'],['numeral_7','mil-device-numeral-7'],['silver_hourglass','mil-device-hourglass-silver']];
let g='';const cw=250,ch=130;
pairs.forEach(([r,a],i)=>{const x=20+(i%3)*(cw*2+30),y=20+Math.floor(i/3)*(ch+30);
  g+=`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#fff"/><image x="${x}" y="${y}" width="${cw}" height="${ch}" preserveAspectRatio="xMidYMid meet" xlink:href="data:image/png;base64,${fs.readFileSync(path.join(REPO,'images/devices/military',r+'.png')).toString('base64')}"/>`;
  const svg=fs.readFileSync(path.join(DEV,a+'.svg'),'utf8'),m=JSON.parse(svg.match(/<metadata>([\s\S]*?)<\/metadata>/)[1].replace(/&lt;/g,'<').replace(/&amp;/g,'&'));
  const w=m.size_in.w,h=m.size_in.h,sc=Math.min((cw-20)/w,(ch-40)/h);
  g+=`<rect x="${x+cw+10}" y="${y}" width="${cw}" height="${ch}" fill="#fff"/><image x="${x+cw+10+(cw-w*sc)/2}" y="${y+(ch-20-h*sc)/2}" width="${w*sc}" height="${h*sc}" xlink:href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"/>`;
  g+=`<text x="${x}" y="${y+ch+14}" font-family="Arial" font-size="12" fill="#e6e9ee">${r} -> ${a}  (${m.size_in.w.toFixed(3)} x ${m.size_in.h.toFixed(3)} in, ${m.size_source}, ${m.metal})</text>`;});
const S=1650;fs.writeFileSync(process.argv[2],`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#1a1d24"/>${g}</svg>`);
