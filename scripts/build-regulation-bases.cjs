'use strict';
// Exact extracted CAPR 39-1 artwork; SVG fabric masks remove baked accoutrements.
// The source raster is embedded unchanged. Masks do not resample the figure.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'images/base/capr39-1');fs.mkdirSync(dir,{recursive:true});
const outlines=JSON.parse(fs.readFileSync(path.join(root,'data/regulation-figure-outlines.json'),'utf8'));
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const figures=[
 ['semi_formal_male',84,425,605,'4.12',rect(276,162,57,151,'#22232d')],
 ['semi_formal_female',85,312,514,'4.13',rect(185,97,48,115,'#22232d')],
 ['aviator_blazer_male',87,406,652,'4.14',rect(259,195,77,98,'#20212b')+rect(263,104,20,19,'#20212b')],
 ['aviator_blazer_female',89,428,624,'4.15',rect(249,145,74,111,'#20212b')+rect(258,75,20,20,'#20212b')],
 ['corporate_field',106,284,372,'5.4',rect(59,55,50,79,'#172741')+rect(166,79,67,55,'#172741')+rect(237,68,31,48,'#172741')+rect(93,43,21,21,'#172741')+rect(165,43,23,23,'#172741')],
 ['polo',108,552,622,'5.5',rect(137,144,73,70,'#001b52')+rect(349,130,79,65,'#001b52')],
 ['flight_suit',133,330,495,'8.1',rect(96,104,46,39,'#788e77')+rect(166,108,59,27,'#7c8e74')+rect(86,164,52,42,'#8b9e83')+rect(262,96,24,31,'#7c8e74')+rect(33,98,25,36,'#788e77')+rect(50,72,31,14,'#8c9f84')+rect(240,73,27,16,'#8c9f84')]
];
const manifest={source:'https://www.gocivilairpatrol.com/media/cms/CAPR_391_90e08bf91538b.pdf',method:'Unchanged extracted figure raster embedded in SVG, with local fabric masks covering baked decorations.',figures:[]};
for(const [id,page,w,h,figure,masks] of figures){
 const source=fs.readFileSync(path.join(dir,`sources/${page}-Im0.png`));
 const rows=outlines[page];
 const shape=rows?`M${rows.map(([y,x])=>`${x},${y}`).join('L')}L${[...rows].reverse().map(([y,,x])=>`${x+1},${y}`).join('L')}Z`:'';
 const clipping=shape?`<defs><clipPath id="fabric"><path d="${shape}"/></clipPath></defs>`:'';
 fs.writeFileSync(path.join(dir,`${id}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="data:image/png;base64,${source.toString('base64')}"/>${clipping}<g ${shape?'clip-path="url(#fabric)"':''}>${masks}</g></svg>\n`);
 manifest.figures.push({id,pdfPage:page,figure,width:w,height:h,asset:`base/capr39-1/${id}.svg`});
}
fs.writeFileSync(path.join(root,'data/regulation-uniform-bases.json'),JSON.stringify(manifest,null,2)+'\n');
for(const [id,page,w,h,box] of [['crest',87,406,652,'271 244 46 50'],['command_patch',133,330,495,'98 105 42 34'],['flight_flag',133,330,495,'262 96 24 31']]){
 const source=fs.readFileSync(path.join(dir,`sources/${page}-Im0.png`));
 const [x,y,cw,ch]=box.split(' ');
 fs.writeFileSync(path.join(dir,`${id}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${cw}" height="${ch}"><defs><clipPath id="crop"><rect x="${x}" y="${y}" width="${cw}" height="${ch}"/></clipPath></defs><image clip-path="url(#crop)" width="${w}" height="${h}" href="data:image/png;base64,${source.toString('base64')}"/></svg>\n`);
}
