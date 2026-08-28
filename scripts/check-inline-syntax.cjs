'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
let index=0;
for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
  index++;
  try{ new vm.Script(match[1],{filename:`index-inline-${index}.js`}); }
  catch(error){ console.error(error.stack); process.exitCode=1; }
}
if(!process.exitCode) console.log(`Parsed ${index} inline scripts.`);
