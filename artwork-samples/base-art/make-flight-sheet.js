// Contact sheet of the flight-uniform assets at one common scale (all assets are in real inches).
const fs=require('fs'),path=require('path');
const D=path.join(__dirname,'..','assets','garments');
const items=[['garment-fdu-flight-suit','FDU'],['garment-cfdu-flight-suit','CFDU'],['garment-flight-jacket-green','green jacket'],['garment-flight-jacket-blue','blue jacket'],['garment-cap-command-scarf','scarf']];
const load=id=>{const s=fs.readFileSync(path.join(D,id+'.svg'),'utf8'),m=s.match(/<svg[^>]*width="([\d.]+)in"[^>]*height="([\d.]+)in"[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return {s,w:+m[1],h:+m[2],vw:+m[3],vh:+m[4]};};
const L=items.map(([id,n])=>({id,n,...load(id)}));
const pad=2,cols=[[0,1],[2,3]];let y=pad,out='',maxW=0;
const rows=[[L[0],L[1]],[L[2],L[3]]];
for(const r of rows){let x=pad;const rh=Math.max(...r.map(a=>a.h));
  for(const a of r){const inner=a.s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
    out+=`<svg x="${x}" y="${y}" width="${a.w}" height="${a.h}" viewBox="0 0 ${a.vw} ${a.vh}">${inner}</svg>`;x+=a.w+pad;}
  maxW=Math.max(maxW,x);y+=rh+pad;}
// scarf beside the first row's right edge, at the same scale
const sc=L[4],innerS=sc.s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
out+=`<svg x="${maxW}" y="${pad}" width="${sc.w}" height="${sc.h}" viewBox="0 0 ${sc.vw} ${sc.vh}">${innerS}</svg>`;maxW+=sc.w+pad;
const S=Math.max(maxW,y),oy=(S-y)/2;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="2200" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" fill="#fff"/><g transform="translate(0 ${oy})">${out}</g></svg>`;
// nested viewBox units are inches here, so scale root: wrap content with scale already via nested viewBox
const f=path.join(__dirname,'flight_sheet.svg');fs.writeFileSync(f,svg);
require('child_process').execSync(`qlmanage -t -s 2200 -o "${__dirname}" "${f}" >/dev/null 2>&1 && mv "${f}.png" "${path.join(__dirname,'flight_sheet_preview.png')}"`);
console.log('ok sheet',maxW.toFixed(1),y.toFixed(1));
