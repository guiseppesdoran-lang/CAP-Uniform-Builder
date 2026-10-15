const fs=require('fs');
const [,, png, x0,y0,w,h, out]=process.argv;
const b64=fs.readFileSync(png).toString('base64');
const X=+x0,Y=+y0,Wd=+w,Hd=+h,S=Math.floor(1000/Wd);
let g='';
for(let x=Math.ceil(X/10)*10;x<X+Wd;x+=10)g+=`<line x1="${x}" y1="${Y}" x2="${x}" y2="${Y+Hd}" stroke="${x%50==0?'#e00':'#08f'}" stroke-width="${0.2}"/><text x="${x+0.5}" y="${Y+3}" font-size="3" fill="#e00">${x}</text>`;
for(let y=Math.ceil(Y/10)*10;y<Y+Hd;y+=10)g+=`<line x1="${X}" y1="${y}" x2="${X+Wd}" y2="${y}" stroke="${y%50==0?'#e00':'#08f'}" stroke-width="0.2"/><text x="${X+0.5}" y="${y-0.5}" font-size="3" fill="#e00">${y}</text>`;
const side=Math.max(Wd,Hd);
fs.writeFileSync(out,`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${X} ${Y} ${side} ${side}" width="1000" height="1000"><rect x="${X}" y="${Y}" width="${side}" height="${side}" fill="#fff"/><image x="0" y="0" width="240" height="203" xlink:href="data:image/png;base64,${b64}"/>${g}</svg>`);
