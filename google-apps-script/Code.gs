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
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const data = JSON.parse(raw || '{}');

    // Honeypot: bots that fill this hidden field are silently ignored.
    if (String(data.honeypot || '').trim()) {
      return json_({ ok: true });
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

    MailApp.sendEmail({
      to: PATCH_SUBMISSION_RECIPIENTS.join(','),
      subject: subjectParts.join(' — '),
      body: body,
      attachments: [blob],
      name: 'CAP Uniform Builder Patch Submission'
    });

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet() {
  return ContentService
    .createTextOutput('CAP Uniform Builder patch submission endpoint is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function sanitize_(value, maxLen) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLen || 500);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
