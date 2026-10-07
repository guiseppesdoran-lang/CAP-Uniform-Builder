'use strict';
// SVG compositions reuse the repository's rank artwork without resampling or
// changing the source PNGs. Keep source/provenance and preview geometry separate.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=path.join(root,'images/ranks/composed');
fs.mkdirSync(out,{recursive:true});
const wrap=(box,body)=>{const [x,y,w,h]=box.split(/\s+/).map(Number);return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${box}" width="${w}" height="${h}"><defs><clipPath id="frame"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#frame)">${body}</g></svg>\n`;};
function dimensions(data){
 if(data.subarray(1,4).toString()==='PNG')return {w:data.readUInt32BE(16),h:data.readUInt32BE(20),mime:'image/png'};
 if(data[0]!==255 || data[1]!==216)throw Error('Unsupported source image format');
 let offset=2;
 while(offset<data.length){
  if(data[offset]!==255){offset++;continue;}
  const marker=data[offset+1];offset+=2;
  if(marker===216 || marker===217 || marker===1 || marker>=208&&marker<=215)continue;
  const length=data.readUInt16BE(offset);
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {w:data.readUInt16BE(offset+5),h:data.readUInt16BE(offset+3),mime:'image/jpeg'};
  offset+=length;
 }
 throw Error('JPEG dimensions not found');
}
function embedded(file){const data=fs.readFileSync(path.join(root,'images',file));const {w,h,mime}=dimensions(data);return `<image width="${w}" height="${h}" href="data:${mime};base64,${data.toString('base64')}"/>`;}
const officerCrops=JSON.parse(fs.readFileSync(path.join(root,'data/officer-grade-crops.json'),'utf8'));
const officers={'2d Lt':'2d_lt','1st Lt':'1st_lt','Capt':'Capt','Maj':'Maj','Lt Col':'lt_col','Col':'col','Brig Gen':'brig_gen','Maj Gen':'maj_gen'};
const manifest={officers:{},cadets:{},ncos:{}};
for(const [rank,key] of Object.entries(officers)){
 const source=`base/CAP_male_${key}.png`;
 const id=rank.toLowerCase().replaceAll(' ','_');
 // Isolate the actual grade mark from the supplied detached gray sleeve.
 // The SVG alpha filter removes the gray field, retaining silver/gold pixels.
 const filter='<defs><filter id="ink" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 2.5 0 0 0 -1.1"/></filter></defs>';
 fs.writeFileSync(path.join(out,`${id}.svg`),wrap(officerCrops[key].join(' '),filter+`<g filter="url(#ink)">${embedded(source)}</g>`));
 manifest.officers[rank]={asset:`ranks/composed/${id}.svg`,source};
}
for(const [rank,count,diamond] of [['C/2d Lt',1,false],['C/1st Lt',2,false],['C/Capt',3,false],['C/Maj',1,true],['C/Lt Col',2,true],['C/Col',3,true]]){
 const shapes=Array.from({length:count},(_,i)=>{const x=50+(i-(count-1)/2)*26;return diamond?`<path d="M${x} 25 l12 25 -12 25 -12 -25z"/>`:`<ellipse cx="${x}" cy="50" rx="10" ry="16"/>`;}).join('');
 const id='cadet_'+rank.slice(2).toLowerCase().replaceAll(' ','_');
 const box=`${38-(count-1)*13} ${diamond?23:32} ${24+(count-1)*26} ${diamond?54:36}`;
 fs.writeFileSync(path.join(out,`${id}.svg`),wrap(box,`<defs><linearGradient id="metal"><stop stop-color="#fff"/><stop offset=".5" stop-color="#b9c0c9"/><stop offset="1" stop-color="#f8fafc"/></linearGradient></defs><g fill="url(#metal)" stroke="#5b6370" stroke-width="2">${shapes}</g>`));
 manifest.cadets[rank]={asset:`ranks/composed/${id}.svg`,source:'CAPR 39-1 Figure A5-2 (cadet circles/diamonds)'};
}
for(const rank of ['Amn','A1C','SrA','SSgt','TSgt','MSgt','SMSgt','CMSgt']){
 const source=`ranks/C/${rank}.png`;
 const data=fs.readFileSync(path.join(root,'images',source));
 const {w,h}=dimensions(data);
 const polygon=[[.05,.06],[.45,.22],[.55,.22],[.95,.06],[.96,.77],[.84,.90],[.5,.98],[.16,.90],[.05,.77]].map(([x,y])=>`${x*w},${y*h}`).join(' ');
 const body=`<defs><clipPath id="outline"><polygon points="${polygon}"/></clipPath></defs><g clip-path="url(#outline)">${embedded(source)}</g>`;
 const id='cadet_'+rank.toLowerCase();
 fs.writeFileSync(path.join(out,`${id}.svg`),wrap(`0 0 ${w} ${h}`,body));
 manifest.cadets['C/'+rank]={asset:`ranks/composed/${id}.svg`,source};
 if(['MSgt','SMSgt','CMSgt'].includes(rank)){
  const diamond=`<path d="M${w*.5} ${h*.2} l${w*.025} ${h*.04} -${w*.025} ${h*.04} -${w*.025} -${h*.04}z" fill="#e5e7eb" stroke="#384152"/>`;
  fs.writeFileSync(path.join(out,`${id}_first_sergeant.svg`),wrap(`0 0 ${w} ${h}`,body+diamond));
 }
}
for(const rank of ['SSgt','TSgt','MSgt','SMSgt','CMSgt']){
 const source=`base/CAP_SM_${rank}_Class_A_Jacket.png`;
 const id='senior_'+rank.toLowerCase();
 const body=`<defs><clipPath id="outline"><polygon points="68,199 94,213 79,272 52,299 46,281"/></clipPath></defs><g clip-path="url(#outline)">${embedded(source)}</g>`;
 fs.writeFileSync(path.join(out,`${id}.svg`),wrap('44 198 52 104',body));
 const right=`<defs><clipPath id="outline"><polygon points="498,199 472,213 487,272 514,299 520,281"/></clipPath></defs><g clip-path="url(#outline)">${embedded(source)}</g>`;
 fs.writeFileSync(path.join(out,`${id}_right.svg`),wrap('470 198 52 104',right));
 manifest.ncos[rank]={asset:`ranks/composed/${id}.svg`,rightAsset:`ranks/composed/${id}_right.svg`,source};
}
fs.writeFileSync(path.join(root,'data/uniform-rank-assets.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'uniform-rank-assets.js'),`window.CAPUBRankAssets=${JSON.stringify(manifest)};\n`);
console.log('Composed rank SVGs and provenance manifest written.');
