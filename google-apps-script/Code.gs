const PATCH_SUBMISSION_RECIPIENTS = [
  'guiseppe.s.doran@gmail.com',
  '658773@tncap.us'
];

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml'
]);

function doPost(e) {
  let requestId = '';
  try {
    const rawForm = e && e.parameter && e.parameter.payload ? e.parameter.payload : '';
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const raw = rawForm || rawBody;
    const data = JSON.parse(raw || '{}');
    requestId = sanitize_(data.requestId, 120);

    if (String(data.honeypot || '').trim()) {
      return responsePage_({ ok: true, requestId: requestId, ignored: true });
    }

    const patchName = sanitize_(data.patchName, 120);
    const unitName = sanitize_(data.unitName, 120);
    const submitterName = sanitize_(data.submitterName, 100);
    const submitterEmail = sanitize_(data.submitterEmail, 160);
    const notes = sanitize_(data.notes, 1000);
    const fileName = sanitize_(data.fileName, 180) || 'patch-image';
    const mimeType = String(data.mimeType || '').trim().toLowerCase();
    const fileData = String(data.fileData || '').replace(/\s/g, '');
    const declaredSize = Number(data.fileSize || 0);

    if (!patchName && !unitName) throw new Error('Patch name or unit/activity is required.');
    if (!fileData) throw new Error('Image data is required.');
    if (!ALLOWED_MIME.has(mimeType)) throw new Error('Unsupported image type: ' + mimeType);
    if (declaredSize && declaredSize > MAX_FILE_BYTES) throw new Error('Image is too large.');

    const bytes = Utilities.base64Decode(fileData);
    if (bytes.length > MAX_FILE_BYTES) throw new Error('Image is too large after decoding.');

    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const subjectParts = ['CAP Uniform Builder Patch Submission'];
    if (patchName) subjectParts.push(patchName);
    else if (unitName) subjectParts.push(unitName);
    const subject = subjectParts.join(' — ');

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

    const sendResults = sendPatchEmails_(subject, body, blob, submitterEmail);

    console.log(JSON.stringify({
      event: 'patch_submission_sent',
      requestId: requestId,
      patchName: patchName,
      unitName: unitName,
      results: sendResults
    }));

    return responsePage_({
      ok: true,
      requestId: requestId,
      sendResults: sendResults
    });
  } catch (err) {
    console.error('Patch submission error: ' + (err && err.stack ? err.stack : err));
    return responsePage_({
      ok: false,
      requestId: requestId,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function doGet(e) {
  const mode = e && e.parameter ? String(e.parameter.mode || '') : '';
  if (mode === 'status') {
    let account = '';
    try { account = Session.getEffectiveUser().getEmail(); } catch (_) {}
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        service: 'CAP Uniform Builder Patch Submission',
        effectiveUser: account,
        gmailAliases: safeAliases_()
      }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService
    .createHtmlOutput('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:20px">CAP Uniform Builder patch submission endpoint is running.</body></html>')
    .setTitle('CAP Uniform Builder Patch Submission');
}

function sendPatchEmails_(subject, body, blob, replyTo) {
  const results = [];
  PATCH_SUBMISSION_RECIPIENTS.forEach(function(recipient) {
    try {
      const options = {
        attachments: [blob.copyBlob()],
        name: 'CAP Uniform Builder Patch Submission'
      };
      if (replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) {
        options.replyTo = replyTo;
      }

      GmailApp.sendEmail(recipient, subject, body, options);
      results.push({ recipient: recipient, ok: true });
      console.log('Patch email sent to ' + recipient);
    } catch (err) {
      results.push({ recipient: recipient, ok: false, error: String(err && err.message ? err.message : err) });
      console.error('Patch email failed for ' + recipient + ': ' + (err && err.stack ? err.stack : err));
    }
  });

  const failed = results.filter(function(r) { return !r.ok; });
  if (failed.length) {
    throw new Error('Email failed for: ' + failed.map(function(r) {
      return r.recipient + ' (' + r.error + ')';
    }).join('; '));
  }
  return results;
}

/*
  Run this ONCE manually from the Apps Script editor after pasting this version.
  It forces Google to request the Gmail authorization scope and proves that the
  script account itself can send mail before the web-app upload path is tested.
*/
function testPatchEmail() {
  const subject = 'CAP Uniform Builder Patch Submission — Direct Test';
  const body = [
    'This is a direct Apps Script mail test.',
    '',
    'If you received this message, Gmail authorization and outbound mail are working.',
    'Effective user: ' + Session.getEffectiveUser().getEmail(),
    'Time: ' + new Date().toISOString()
  ].join('\n');

  const testBlob = Utilities.newBlob(
    'CAP Uniform Builder patch submission test attachment',
    'text/plain',
    'capub_patch_test.txt'
  );

  const results = sendPatchEmails_(subject, body, testBlob, '');
  console.log(JSON.stringify(results));
  return results;
}

function safeAliases_() {
  try { return GmailApp.getAliases(); }
  catch (err) { return ['ERROR: ' + String(err && err.message ? err.message : err)]; }
}

function sanitize_(value, maxLen) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen || 500);
}

function responsePage_(result) {
  const json = JSON.stringify({
    source: 'CAPUB_PATCH_SUBMISSION',
    ok: !!result.ok,
    requestId: String(result.requestId || ''),
    error: result.error ? String(result.error) : '',
    sendResults: result.sendResults || null
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
