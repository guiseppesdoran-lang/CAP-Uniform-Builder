/* CAP Uniform Builder feature loader */
(function(){
  'use strict';

  window.CAPUB_PATCH_SUBMISSION_ENDPOINT = window.CAPUB_PATCH_SUBMISSION_ENDPOINT || 'https://script.google.com/macros/s/AKfycbwH_AxRVmX58qRHPxauJsLfjfYNCYPbGO1AG6tBYPpl5_BmrKoW90hTj73lqmlmzZZJ6A/exec';

  function load(src,next){
    const existing=document.querySelector(`script[data-capub-loader="${src}"]`);
    if(existing){ if(next) next(); return; }
    const s=document.createElement('script');
    s.src=src; s.async=false; s.dataset.capubLoader=src;
    if(next) s.addEventListener('load',next,{once:true});
    document.body.appendChild(s);
  }

  load('purchase-feature-core.js',()=>{
    load('admin-history.js?v=2');
  });
})();
