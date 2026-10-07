'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async function localPreviewRoute(page){
 const root=path.resolve(__dirname,'..');
 const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css'};
 await page.route('http://127.0.0.1:8765/**',async route=>{
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){await route.fulfill({status:403,body:''});return;}
  try{await route.fulfill({status:200,contentType:types[path.extname(file)] || 'application/octet-stream',body:await fs.readFile(file)});}
  catch{await route.fulfill({status:404,body:''});}
 });
};
