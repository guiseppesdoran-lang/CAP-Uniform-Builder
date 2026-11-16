// Deployment settings. Nothing secret belongs in this file: it is served to every visitor.
window.CAPUB_CONFIG = Object.freeze({
  // Anonymous usage counts to this site's own /api/events (js/telemetry.js, deploy/api). false: nothing is sent.
  metrics: true,
  // The Feedback link in the footer, posting to this site's own /api/feedback (js/feedback.js). false: no link.
  feedback: true
});
