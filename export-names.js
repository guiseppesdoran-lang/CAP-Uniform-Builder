// File names for what the builder exports, so a download says whose uniform it is
// instead of a bare timestamp: CAP-Uniform_C-SSgt_Blues-A_2026-10-10.png
(function capubExportNamesModule(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.CAPUBExportNames=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function(){
  'use strict';

  // Letters, digits and hyphens only, so the name is safe on every file system and in a URL.
  function slug(text){
    return String(text || '')
      .replace(/[\/\\\s_]+/g,'-')
      .replace(/[^A-Za-z0-9-]/g,'')
      .replace(/-{2,}/g,'-')
      .replace(/^-+|-+$/g,'');
  }
  function uniformWords(uniformId){
    return String(uniformId || '')
      .split('_')
      .filter(Boolean)
      .map(word=>word.length<=1 ? word.toUpperCase() : word[0].toUpperCase()+word.slice(1))
      .join('-');
  }
  function datePart(date){
    const d=date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  // parts: {rank, uniform}; ext without the dot. Missing parts are left out.
  function exportFileName({rank='',uniform=''}={},ext='png',date=new Date()){
    const pieces=['CAP-Uniform',slug(rank),slug(uniformWords(uniform)),datePart(date)].filter(Boolean);
    return `${pieces.join('_')}.${String(ext || 'png').replace(/^\./,'')}`;
  }

  return {exportFileName,slug};
});
