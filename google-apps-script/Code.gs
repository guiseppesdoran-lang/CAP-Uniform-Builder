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
    if (!ALLOWED_MIME.has(mimeType)) throw new Error('Unsupported image type.');
    if (declaredSize && declaredSize > MAX_FILE_BYTES) throw new Error('Image is too large.');

    const bytes = Utilities.base64Decode(fileData);
    if (bytes.length > MAX_FILE_BYTES) throw new Error('Image is too large.');

    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const subjectParts = ['CAP Uniform Builder Patch Submission'];
    if (patchName) subjectParts.push(patchName);
    else if (unitName) subjectParts.push(unitName);

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
      'Image file: ' + fileName
    ].join('\n');

    const quotaBefore = MailApp.getRemainingDailyQuota();
    MailApp.sendEmail({
      to: PATCH_SUBMISSION_RECIPIENTS.join(','),
      subject: subjectParts.join(' — '),
      body: body,
      attachments: [blob],
      name: 'CAP Uniform Builder Patch Submission'
    });
    const quotaAfter = MailApp.getRemainingDailyQuota();

    console.log('Patch submission email sent', {
      requestId: requestId,
      patchName: patchName,
      unitName: unitName,
      recipients: PATCH_SUBMISSION_RECIPIENTS,
      quotaBefore: quotaBefore,
      quotaAfter: quotaAfter
    });

    return responsePage_({
      ok: true,
      requestId: requestId,
      quotaRemaining: quotaAfter
    });
  } catch (err) {
    console.error('Patch submission error', err);
    return responsePage_({
      ok: false,
      requestId: requestId,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function doGet() {
  return HtmlService
    .createHtmlOutput('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:20px">CAP Uniform Builder patch submission endpoint is running.</body></html>')
    .setTitle('CAP Uniform Builder Patch Submission');
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
    quotaRemaining: result.quotaRemaining == null ? null : Number(result.quotaRemaining)
  }).replace(/</g, '\\u003c');

  const html = '<!doctype html><html><body>' +
    '<script>' +
    'try{' +
      'var data=' + json + ';' +
      'if(window.parent){window.parent.postMessage(data,"*");}' +
    '}catch(e){}' +
    '<\/script>' +
    '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}