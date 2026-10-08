/* CAP Uniform Builder feature loader */
(function(){
  'use strict';


  function load(src,next){
    // index.html now loads these directly (with content-hash URLs); only chain them
    // when it does not, so a stale cached copy of the page still works.
    const existing=document.querySelector(`script[data-capub-loader="${src}"]`)
      || document.querySelector(`script[src^="${src.split('?')[0]}"]`);
    if(existing){ if(next) next(); return; }
    const s=document.createElement('script');
    s.src=src; s.async=false; s.dataset.capubLoader=src;
    if(next) s.addEventListener('load',next,{once:true});
    document.body.appendChild(s);
  }

  load('purchase-feature-core.js');
})();
