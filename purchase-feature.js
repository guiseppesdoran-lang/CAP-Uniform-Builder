/* CAP Uniform Builder feature loader */
(function(){
  'use strict';

  // Paste the deployed Google Apps Script /exec URL here after completing
  // PATCH_SUBMISSION_SETUP.md. Leave blank until the mail handler is deployed.
  window.CAPUB_PATCH_SUBMISSION_ENDPOINT = window.CAPUB_PATCH_SUBMISSION_ENDPOINT || '';

  function load(src,next){
    const existing=document.querySelector(`script[data-capub-loader="${src}"]`);
    if(existing){ if(next) next(); return; }
    const s=document.createElement('script');
    s.src=src; s.async=false; s.dataset.capubLoader=src;
    if(next) s.addEventListener('load',next,{once:true});
    document.body.appendChild(s);
  }

  load('purchase-feature-core.js',()=>{
    load('admin-history.js',()=>{
      load('patch-submission.js');
    });
  });
})();