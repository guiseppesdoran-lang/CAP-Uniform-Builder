/*
  CAP Uniform Builder - submission endpoint (Google Apps Script web app).

  Two features, both optional:
    - Patch submissions: a visitor uploads a patch image; it is emailed to the
      administrators.
    - Calibration submissions: an administrator sends reviewed placement changes;
      they become a GitHub issue plus a backup email. Requires the admin key.

  Nothing identifying belongs in this file. Recipients, the admin key hash and the
  GitHub token are Script Properties (Project Settings > Script properties):

    CAPUB_PATCH_RECIPIENTS        comma-separated email addresses
    CAPUB_ADMIN_PASSWORD_SHA256   SHA-256 hex of the admin key (see ADMIN KEY below)
    CAPUB_ADMIN_SALT              optional; if set, the hash is SHA-256(salt + ":" + key)
    CAPUB_GITHUB_TOKEN            fine-grained token limited to Issues: Read and write
    CAPUB_GITHUB_REPOSITORY       owner/repository (optional if the default below is right)

  ADMIN KEY: use a long random passphrase (20+ characters) and store only its hash
  here. The hash is never sent to or stored in the web page.
*/

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

const PATCH_RECIPIENTS_PROPERTY = 'CAPUB_PATCH_RECIPIENTS';
const ADMIN_HASH_PROPERTY = 'CAPUB_ADMIN_PASSWORD_SHA256';
const ADMIN_SALT_PROPERTY = 'CAPUB_ADMIN_SALT';
const CALIBRATION_GITHUB_TOKEN_PROPERTY = 'CAPUB_GITHUB_TOKEN';
const CALIBRATION_GITHUB_REPOSITORY_PROPERTY = 'CAPUB_GITHUB_REPOSITORY';
const CALIBRATION_DEFAULT_GITHUB_REPOSITORY = 'guiseppesdoran-lang/CAP-Uniform-Builder';
const CALIBRATION_MAX_PACKAGE_CHARS = 50000;
const CALIBRATION_STATUS_CACHE_SECONDS = 300;

// Abuse limits (counted per hour across all callers; Apps Script exposes no client address).
const PATCH_SUBMISSIONS_PER_HOUR = 20;
const ADMIN_FAILURES_PER_HOUR = 10;

function doPost(e) {
  let requestId = '';
  try {
    const rawForm = e && e.parameter && e.parameter.payload ? e.parameter.payload : '';
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const data = JSON.parse(rawForm || rawBody || '{}');
    requestId = sanitize_(data.requestId, 120);

    const action = String(data.action || '');
    if (action === 'calibration_submission') return handleCalibrationSubmission_(data, requestId);
    if (action) throw new Error('Unsupported action.');
    return handlePatchSubmission_(data, requestId);
  } catch (err) {
    console.error('Request error: ' + (err && err.stack ? err.stack : err));
    return responsePage_({ ok: false, requestId: requestId, error: publicError_(err) });
  }
}

function doGet(e) {
  const mode = e && e.parameter ? String(e.parameter.mode || '') : '';
  if (mode === 'calibration_status') {
    const requestId = sanitize_(e.parameter.requestId, 120);
    const callback = String(e.parameter.callback || '');
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback)) {
      return calibrationJsonpResponse_('capubCalibrationInvalidCallback', {
        source: 'CAPUB_CALIBRATION_SUBMISSION', ok: false, requestId: requestId, error: 'Invalid calibration callback.'
      });
    }
    const cached = getCalibrationSubmissionResult_(requestId);
    return calibrationJsonpResponse_(callback, cached || {
      source: 'CAPUB_CALIBRATION_SUBMISSION', ok: false, pending: true, requestId: requestId
    });
  }
  // Deliberately reveals nothing about the account, aliases or configuration.
  return HtmlService
    .createHtmlOutput('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:20px">CAP Uniform Builder submission endpoint.</body></html>')
    .setTitle('CAP Uniform Builder');
}

/* ---------------------------------------------------------------- patch images */

function handlePatchSubmission_(data, requestId) {
  if (String(data.honeypot || '').trim()) {
    return responsePage_({ ok: true, requestId: requestId });
  }
  takeRateLimitSlot_('patch', PATCH_SUBMISSIONS_PER_HOUR);

  const patchName = sanitize_(data.patchName, 120);
  const unitName = sanitize_(data.unitName, 120);
  const submitterName = sanitize_(data.submitterName, 100);
  const submitterEmail = sanitize_(data.submitterEmail, 160);
  const notes = sanitize_(data.notes, 1000);
  const fileName = safeFileName_(data.fileName) || 'patch-image';
  const mimeType = String(data.mimeType || '').trim().toLowerCase();
  const fileData = String(data.fileData || '').replace(/\s/g, '');
  const declaredSize = Number(data.fileSize || 0);

  if (!patchName && !unitName) throw new Error('Patch name or unit/activity is required.');
  if (!fileData) throw new Error('Image data is required.');
  if (!ALLOWED_MIME.has(mimeType)) throw new Error('Unsupported image type.');
  if (declaredSize && declaredSize > MAX_FILE_BYTES) throw new Error('Image is too large.');

  const bytes = Utilities.base64Decode(fileData);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('Image is too large after decoding.');
  if (!matchesImageSignature_(bytes, mimeType)) throw new Error('The file is not a valid image of the declared type.');

  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const subject = ['CAP Uniform Builder Patch Submission', patchName || unitName].filter(Boolean).join(' - ');
  const body = [
    'A patch image was submitted through the CAP Uniform Builder.',
    '',
    'Patch name: ' + (patchName || '(not provided)'),
    'Unit / activity: ' + (unitName || '(not provided)'),
    'Submitted by: ' + (submitterName || '(not provided)'),
    'Submitter email: ' + (submitterEmail || '(not provided)'),
    'Submitted at: ' + sanitize_(data.submittedAt, 80),
    'Builder page: ' + sanitize_(data.pageUrl, 500),
    '',
    'Notes:',
    notes || '(none)',
    '',
    'Image file: ' + fileName,
    'Request ID: ' + (requestId || '(none)')
  ].join('\n');

  const sent = sendEmails_(subject, body, [blob], submitterEmail, 'CAP Uniform Builder Patch Submission');
  console.log(JSON.stringify({ event: 'patch_submission_sent', requestId: requestId, delivered: sent.delivered, failed: sent.failed }));
  // Report counts only: never echo the administrators' addresses back to the visitor.
  return responsePage_({ ok: true, requestId: requestId, data: { delivered: sent.delivered } });
}

/* Magic-number check, so a renamed file or script cannot ride in as an image. */
function matchesImageSignature_(bytes, mimeType) {
  const b = bytes.map(function(v) { return (v + 256) % 256; });
  if (mimeType === 'image/png') {
    return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 &&
           b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A;
  }
  if (mimeType === 'image/jpeg') return b.length > 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  if (mimeType === 'image/webp') {
    return b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
           b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  }
  return false;
}

function safeFileName_(value) {
  return sanitize_(value, 120).replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^\.+/, '');
}

/* ---------------------------------------------------------- calibration updates */

function handleCalibrationSubmission_(data, requestId) {
  const source = 'CAPUB_CALIBRATION_SUBMISSION';
  let result;
  try {
    verifyAdmin_(data.adminPassword);
    if (!requestId) throw new Error('A calibration request ID is required.');
    const existingResult = getCalibrationSubmissionResult_(requestId);
    if (existingResult) return responsePage_(existingResult);

    const calibrationPackage = data.calibrationPackage;
    if (!calibrationPackage || typeof calibrationPackage !== 'object' || Array.isArray(calibrationPackage)) {
      throw new Error('A valid calibration package is required.');
    }
    if (String(calibrationPackage.type || '') !== 'capub-calibration-change-request') {
      throw new Error('Unsupported calibration package type.');
    }
    if (!Array.isArray(calibrationPackage.changes) || !calibrationPackage.changes.length) {
      throw new Error('The calibration package contains no selected changes.');
    }
    if (calibrationPackage.changes.length > 100) throw new Error('Too many calibration changes in one submission.');

    const packageJson = JSON.stringify(calibrationPackage, null, 2);
    if (packageJson.length > CALIBRATION_MAX_PACKAGE_CHARS) {
      throw new Error('The calibration package is too large. Select fewer assets and submit again.');
    }

    const previewBlob = calibrationPreviewBlob_(data.previewDataUrl, requestId);
    let issue = null;
    let issueError = '';
    try {
      issue = createCalibrationGitHubIssue_(calibrationPackage, packageJson, requestId);
    } catch (err) {
      issueError = String(err && err.message ? err.message : err);
      console.error('Calibration GitHub issue creation failed: ' + issueError);
    }

    let delivered = 0;
    let emailError = '';
    try {
      delivered = sendCalibrationEmails_(calibrationPackage, packageJson, previewBlob, requestId, issue, issueError).delivered;
    } catch (err) {
      emailError = String(err && err.message ? err.message : err);
      console.error('Calibration backup email failed: ' + emailError);
    }

    const emailFallback = !issue && delivered > 0;
    result = {
      source: source,
      ok: !!issue,
      requestId: requestId,
      error: issue ? '' : ('GitHub issue creation failed: ' + (issueError || 'unknown error')),
      data: {
        issueNumber: issue ? issue.number : null,
        issueUrl: issue ? issue.html_url : '',
        repository: issue ? issue.repository : configuredCalibrationRepository_(),
        emailFallback: emailFallback,
        emailError: emailError
      }
    };
  } catch (err) {
    result = {
      source: source,
      ok: false,
      requestId: requestId,
      error: publicError_(err),
      data: { emailFallback: false }
    };
  }

  cacheCalibrationSubmissionResult_(requestId, result);
  return responsePage_(result);
}

function configuredCalibrationRepository_() {
  const configured = String(PropertiesService.getScriptProperties().getProperty(CALIBRATION_GITHUB_REPOSITORY_PROPERTY) || '').trim();
  const repository = configured || CALIBRATION_DEFAULT_GITHUB_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('CAPUB_GITHUB_REPOSITORY must use the owner/repository format.');
  }
  return repository;
}

function createCalibrationGitHubIssue_(calibrationPackage, packageJson, requestId) {
  const properties = PropertiesService.getScriptProperties();
  const token = String(properties.getProperty(CALIBRATION_GITHUB_TOKEN_PROPERTY) || '').trim();
  if (!token) throw new Error('Add the CAPUB_GITHUB_TOKEN Script Property before submitting calibrations.');

  const repository = configuredCalibrationRepository_();
  const context = calibrationPackage.context || {};
  const submitter = calibrationPackage.submitter || {};
  const notes = sanitize_(calibrationPackage.notes, 2000) || '(none)';
  // The repository issue may be public. Keep the submitter's email only in the
  // private backup email attachment, never in the GitHub issue body.
  const publicPackage = JSON.parse(packageJson);
  if (publicPackage.submitter) publicPackage.submitter.email = '';
  const safePackageJson = JSON.stringify(publicPackage, null, 2).replace(/```/g, '`\u200b``');
  const titleText = sanitize_(calibrationPackage.title, 140) || 'Calibration update';
  const title = '[Calibration] ' + titleText;
  const body = [
    '## CAP Uniform Builder calibration submission',
    '',
    '- **Uniform:** ' + sanitize_(context.uniform, 80),
    '- **Calibration bucket:** `' + sanitize_(context.calibrationBucket, 120) + '`',
    '- **Gender:** ' + sanitize_(context.gender, 40),
    '- **Membership:** ' + sanitize_(context.membership, 40),
    '- **Rank:** ' + sanitize_(context.rank, 80),
    '- **Selected assets:** ' + Number((calibrationPackage.changes || []).length),
    '- **Submitted by:** ' + (sanitize_(submitter.name, 100) || '(not provided)'),
    '- **Request ID:** `' + requestId + '`',
    '',
    '### Requested correction',
    notes,
    '',
    '### Applying this correction',
    'Apply the machine-readable calibration package below to the matching gender-specific uniform bucket. Preserve unrelated coordinates, verify proportions and layer behavior, run the repository checks, and open or update a pull request.',
    '',
    '<details><summary>Machine-readable calibration package</summary>',
    '',
    '```json',
    safePackageJson,
    '```',
    '</details>'
  ].join('\n');

  const response = UrlFetchApp.fetch('https://api.github.com/repos/' + repository + '/issues', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ title: title, body: body }),
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CAP-Uniform-Builder-Calibration'
    },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const text = response.getContentText();
  if (status < 200 || status >= 300) {
    let detail = text;
    try { detail = JSON.parse(text).message || text; } catch (_) {}
    throw new Error('GitHub returned HTTP ' + status + ': ' + sanitize_(detail, 500));
  }
  const issue = JSON.parse(text);
  return { number: issue.number, html_url: issue.html_url, repository: repository };
}

function calibrationPreviewBlob_(dataUrl, requestId) {
  const value = String(dataUrl || '');
  if (!value) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) throw new Error('Unsupported calibration preview format.');
  const bytes = Utilities.base64Decode(match[2].replace(/\s/g, ''));
  if (bytes.length > MAX_FILE_BYTES) throw new Error('Calibration preview is too large.');
  const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
  return Utilities.newBlob(bytes, match[1], 'CAPUB_calibration_preview_' + requestId + '.' + extension);
}

function sendCalibrationEmails_(calibrationPackage, packageJson, previewBlob, requestId, issue, issueError) {
  const context = calibrationPackage.context || {};
  const submitter = calibrationPackage.submitter || {};
  const title = sanitize_(calibrationPackage.title, 140) || 'Calibration update';
  const subject = 'CAP Uniform Builder Calibration Submission - ' + title;
  const body = [
    'A calibration update was submitted through the CAP Uniform Builder.',
    '',
    'Uniform: ' + sanitize_(context.uniform, 80),
    'Calibration bucket: ' + sanitize_(context.calibrationBucket, 120),
    'Gender: ' + sanitize_(context.gender, 40),
    'Membership: ' + sanitize_(context.membership, 40),
    'Rank: ' + sanitize_(context.rank, 80),
    'Selected assets: ' + Number((calibrationPackage.changes || []).length),
    'Submitted by: ' + (sanitize_(submitter.name, 100) || '(not provided)'),
    'Submitter email: ' + (sanitize_(submitter.email, 160) || '(not provided)'),
    'Request ID: ' + requestId,
    'GitHub issue: ' + (issue ? issue.html_url : '(not created: ' + (issueError || 'unknown error') + ')'),
    '',
    'Requested correction:',
    sanitize_(calibrationPackage.notes, 2000) || '(none)',
    '',
    'The exact machine-readable package is attached as JSON.'
  ].join('\n');
  const attachments = [Utilities.newBlob(packageJson, 'application/json', 'CAPUB_calibration_' + requestId + '.json')];
  if (previewBlob) attachments.push(previewBlob);
  const sent = sendEmails_(subject, body, attachments, sanitize_(submitter.email, 160), 'CAP Uniform Builder Calibration Submission');
  return sent;
}

function cacheCalibrationSubmissionResult_(requestId, result) {
  if (!requestId) return;
  try {
    CacheService.getScriptCache().put('calibration_submission_' + requestId, JSON.stringify(result), CALIBRATION_STATUS_CACHE_SECONDS);
  } catch (err) {
    console.error('Could not cache calibration submission result: ' + err);
  }
}

function getCalibrationSubmissionResult_(requestId) {
  if (!requestId) return null;
  try {
    const value = CacheService.getScriptCache().get('calibration_submission_' + requestId);
    return value ? JSON.parse(value) : null;
  } catch (_) {
    return null;
  }
}

function calibrationJsonpResponse_(callback, result) {
  const safeCallback = /^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback) ? callback : 'capubCalibrationInvalidCallback';
  const json = JSON.stringify(result || {}).replace(/</g, '\\u003c');
  return ContentService.createTextOutput(safeCallback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* ------------------------------------------------------------------- admin key */

/* Constant-time comparison, so response timing does not reveal how much matched. */
function safeEqual_(a, b) {
  const x = String(a);
  const y = String(b);
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) {
    diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function adminHash_(password) {
  const salt = String(PropertiesService.getScriptProperties().getProperty(ADMIN_SALT_PROPERTY) || '');
  return sha256Hex_(salt ? salt + ':' + String(password || '') : String(password || ''));
}

function verifyAdmin_(password) {
  const properties = PropertiesService.getScriptProperties();
  const expected = String(properties.getProperty(ADMIN_HASH_PROPERTY) || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('Calibration submissions are not configured on this endpoint.');
  }
  // Stop guessing: after repeated failures, refuse everyone until the window passes.
  if (rateLimitCount_('admin-failures') >= ADMIN_FAILURES_PER_HOUR) {
    throw new Error('Too many failed attempts. Try again later.');
  }
  if (!safeEqual_(adminHash_(password), expected)) {
    recordRateLimitHit_('admin-failures');
    throw new Error('Incorrect admin key.');
  }
}

/* ----------------------------------------------------------------- rate limits */

function rateLimitKey_(name) {
  return 'rl_' + name + '_' + Math.floor(Date.now() / 3600000);
}

function rateLimitCount_(name) {
  const value = CacheService.getScriptCache().get(rateLimitKey_(name));
  return value ? Number(value) || 0 : 0;
}

function recordRateLimitHit_(name) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    CacheService.getScriptCache().put(rateLimitKey_(name), String(rateLimitCount_(name) + 1), 3700);
  } finally {
    lock.releaseLock();
  }
}

function takeRateLimitSlot_(name, perHour) {
  if (rateLimitCount_(name) >= perHour) throw new Error('Too many submissions right now. Try again later.');
  recordRateLimitHit_(name);
}

/* ----------------------------------------------------------------------- email */

function recipients_() {
  const raw = String(PropertiesService.getScriptProperties().getProperty(PATCH_RECIPIENTS_PROPERTY) || '');
  const list = raw.split(',').map(function(item) { return item.trim(); })
    .filter(function(item) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item); });
  if (!list.length) throw new Error('Submissions are not configured on this endpoint.');
  return list;
}

function sendEmails_(subject, body, blobs, replyTo, senderName) {
  let delivered = 0;
  let failed = 0;
  recipients_().forEach(function(recipient) {
    try {
      const options = {
        attachments: blobs.map(function(blob) { return blob.copyBlob(); }),
        name: senderName
      };
      if (replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) options.replyTo = replyTo;
      GmailApp.sendEmail(recipient, subject, body, options);
      delivered++;
    } catch (err) {
      failed++;
      console.error('Email failed: ' + (err && err.message ? err.message : err));
    }
  });
  if (!delivered) throw new Error('The submission could not be delivered. Try again later.');
  return { delivered: delivered, failed: failed };
}

/* Run once from the Apps Script editor to authorise Gmail and prove outbound mail works. */
function testPatchEmail() {
  const blob = Utilities.newBlob('CAP Uniform Builder test attachment', 'text/plain', 'capub_test.txt');
  const sent = sendEmails_('CAP Uniform Builder - direct test', 'Direct Apps Script mail test sent at ' + new Date().toISOString(), [blob], '', 'CAP Uniform Builder');
  console.log(JSON.stringify(sent));
  return sent;
}

/* Run once after adding CAPUB_GITHUB_TOKEN. This is read-only: it verifies the
   repository is reachable and forces Apps Script to authorize UrlFetchApp
   without creating a calibration issue. */
function testCalibrationGitHubConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const token = String(properties.getProperty(CALIBRATION_GITHUB_TOKEN_PROPERTY) || '').trim();
  if (!token) throw new Error('Add the CAPUB_GITHUB_TOKEN Script Property first.');
  const repository = configuredCalibrationRepository_();
  const response = UrlFetchApp.fetch('https://api.github.com/repos/' + repository, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CAP-Uniform-Builder-Calibration-Test'
    },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('GitHub configuration test failed with HTTP ' + status + ': ' + sanitize_(response.getContentText(), 500));
  }
  const repositoryData = JSON.parse(response.getContentText());
  const result = { ok: true, repository: repositoryData.full_name, issuesUrl: repositoryData.html_url + '/issues' };
  console.log(JSON.stringify(result));
  return result;
}

/* --------------------------------------------------------------------- helpers */

function sanitize_(value, maxLen) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen || 500);
}

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(byte) { return ((byte + 256) % 256).toString(16).padStart(2, '0'); })
    .join('');
}

/* Error text for the web page: configuration problems are described generically. */
function publicError_(err) {
  const message = String(err && err.message ? err.message : err);
  return message.slice(0, 200);
}

function responsePage_(result) {
  const json = JSON.stringify({
    source: result.source || 'CAPUB_PATCH_SUBMISSION',
    ok: !!result.ok,
    requestId: String(result.requestId || ''),
    error: result.error ? String(result.error) : '',
    data: result.data || null
  }).replace(/</g, '\\u003c');

  const html = '<!doctype html><html><body>' +
    '<script>' +
    'try{' +
      'var data=' + json + ';' +
      'var notify=function(){' +
        'try{if(window.parent){window.parent.postMessage(data,"*");}}catch(e){}' +
        'try{if(window.top&&window.top!==window.parent){window.top.postMessage(data,"*");}}catch(e){}' +
      '};' +
      'notify();setTimeout(notify,250);setTimeout(notify,1000);' +
    '}catch(e){}' +
    '<\/script>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
