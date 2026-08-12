/* Backward-compatible loader for cached copies of purchase-feature.js. */
(function () {
  'use strict';
  if (window.CAPUB_PATCH_SUBMISSION?.version >= 3 || document.querySelector('script[data-capub-patch-canonical]')) return;
  const script = document.createElement('script');
  script.src = 'patch-submission.js?v=3';
  script.dataset.capubPatchCanonical = 'true';
  document.body.appendChild(script);
})();
