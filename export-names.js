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
  // The uniforms that are known by their initials: ABU, OCP, and the USAF in Semi-Formal-USAF.
  const INITIALS=new Set(['abu','ocp','usaf']);
  // A name a uniform was saved under before it was renamed reads as its present name.
  const RENAMED={ceremonials:'honor_guard',ceremonial:'honor_guard'};
  function uniformWords(uniformId){
    const id=String(uniformId || '');
    return (RENAMED[id.toLowerCase()] || id)
      .split('_')
      .filter(Boolean)
      .map(word=>word.length<=1 || INITIALS.has(word.toLowerCase()) ? word.toUpperCase() : word[0].toUpperCase()+word.slice(1))
      .join('-');
  }
  function datePart(date){
    const d=date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  // parts: {rank, uniform, part}; ext without the dot. Missing parts are left out. `part` names the part of the uniform a picture shows (the Photos menu), in lower case
  // with hyphens: CAP-Uniform_C-SSgt_Blues-A_ribbon-rack_2026-10-10.png; a picture of the whole uniform has none.
  function exportFileName({rank='',uniform='',part=''}={},ext='png',date=new Date()){
    const pieces=['CAP-Uniform',slug(rank),slug(uniformWords(uniform)),slug(part).toLowerCase(),datePart(date)].filter(Boolean);
    return `${pieces.join('_')}.${String(ext || 'png').replace(/^\./,'')}`;
  }

  return {exportFileName,slug};
});
