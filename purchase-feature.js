/* CAP Uniform Builder feature loader */
(function(){
  'use strict';
  function load(src,next){
    const existing=document.querySelector(`script[data-capub-loader="${src}"]`);
    if(existing){ if(next) next(); return; }
    const s=document.createElement('script');
    s.src=src; s.async=false; s.dataset.capubLoader=src;
    if(next) s.addEventListener('load',next,{once:true});
    document.body.appendChild(s);
  }
  load('purchase-feature-core.js',()=>load('admin-history.js'));
})();