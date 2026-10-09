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
// Scripts extracted from the page live under js/ and are loaded as classic scripts.
let extracted=0;
if(fs.existsSync('js')){
  for(const name of fs.readdirSync('js').filter(file=>file.endsWith('.js')).sort()){
    extracted++;
    try{ new vm.Script(fs.readFileSync(`js/${name}`,'utf8'),{filename:`js/${name}`}); }
    catch(error){ console.error(error.stack); process.exitCode=1; }
  }
}
if(!process.exitCode) console.log(`Parsed ${index} inline scripts and ${extracted} extracted scripts.`);
