// Deployment settings. Nothing secret belongs in this file: it is served to every visitor.
window.CAPUB_CONFIG = Object.freeze({
  // URL of a submission endpoint for patch images and calibration updates.
  // Leave empty to turn those features off; the page then makes no outbound requests.
  submissionEndpoint: '',
  // Anonymous usage counts to this site's own /api/events (js/telemetry.js, deploy/api). false: nothing is sent.
  metrics: true,
  // The Feedback link in the footer, posting to this site's own /api/feedback (js/feedback.js). false: no link.
  feedback: true
});
