'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('regulation bases embed the unchanged extracted figure and contain no external image dependencies',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/regulation-uniform-bases.json')));
 assert.match(manifest.source,/gocivilairpatrol\.com\/media\/cms\/CAPR_391_/);
 assert.equal(manifest.figures.length,7);
 for(const figure of manifest.figures){
  const svg=fs.readFileSync(path.join(root,'images',figure.asset),'utf8');
  const embedded=svg.match(/href="data:image\/png;base64,([^"]+)"/);
  assert.ok(embedded,figure.id);
  const original=fs.readFileSync(path.join(root,`images/base/capr39-1/sources/${figure.pdfPage}-Im0.png`));
  assert.deepEqual(Buffer.from(embedded[1],'base64'),original,figure.id);
  assert.doesNotMatch(svg,/href="https?:/);
  assert.ok(figure.figure&&figure.pdfPage>0);
 }
});
test('composed grade view boxes use real image dimensions, including JPEG files named png',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/uniform-rank-assets.json')));
 for(const group of Object.values(manifest))for(const record of Object.values(group)){
  const svg=fs.readFileSync(path.join(root,'images',record.asset),'utf8');
  const box=svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  assert.ok(box.every(Number.isFinite));assert.ok(box[2]>0&&box[2]<2000&&box[3]>0&&box[3]<2000,record.asset);
  if(record.source.startsWith('ranks/C/'))assert.match(svg,/data:image\/jpeg;base64,/);
 }
});
