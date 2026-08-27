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

const HISTORY_PASSWORD_HASH_PROPERTY = 'CAPUB_ADMIN_PASSWORD_SHA256';
const HISTORY_SPREADSHEET_ID_PROPERTY = 'CAPUB_HISTORY_SPREADSHEET_ID';
const HISTORY_SHEET_NAME = 'Uniform History';
const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;
const HISTORY_MAX_RECORDS = 500;
const HISTORY_MAX_PROFILE_CHARS = 45000;
const CALIBRATION_GITHUB_TOKEN_PROPERTY = 'CAPUB_GITHUB_TOKEN';
const CALIBRATION_GITHUB_REPOSITORY_PROPERTY = 'CAPUB_GITHUB_REPOSITORY';
const CALIBRATION_DEFAULT_GITHUB_REPOSITORY = 'guiseppesdoran-lang/CAP-Uniform-Builder';
const CALIBRATION_MAX_PACKAGE_CHARS = 50000;
const CALIBRATION_STATUS_CACHE_SECONDS = 300;

function doPost(e) {
  let requestId = '';
  try {
    const rawForm = e && e.parameter && e.parameter.payload ? e.parameter.payload : '';
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const raw = rawForm || rawBody;
    const data = JSON.parse(raw || '{}');
    requestId = sanitize_(data.requestId, 120);

    if (/^history_/.test(String(data.action || ''))) {
      return handleHistoryRequest_(data, requestId);
    }
    if (String(data.action || '') === 'calibration_submission') {
      return handleCalibrationSubmission_(data, requestId);
    }

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
  if (mode === 'history_list') {
    const requestId = sanitize_(e.parameter.requestId, 120);
    const callback = String(e.parameter.callback || '');
    try {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback)) throw new Error('Invalid history callback.');
      verifyHistoryProof_(
        mode,
        requestId,
        String(e.parameter.timestamp || ''),
        sanitize_(e.parameter.nonce, 160),
        String(e.parameter.signature || '')
      );
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      let records;
      try {
        cleanupHistorySheet_();
        records = readHistoryRecords_().slice(0, HISTORY_MAX_RECORDS);
      } finally {
        lock.releaseLock();
      }
      return historyJsonpResponse_(callback, { ok: true, requestId: requestId, data: { records: records } });
    } catch (err) {
      return historyJsonpResponse_(callback, { ok: false, requestId: requestId, error: String(err && err.message ? err.message : err) });
    }
  }
  if (mode === 'status') {
    let account = '';
    const properties = PropertiesService.getScriptProperties();
    try { account = Session.getEffectiveUser().getEmail(); } catch (_) {}
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: true,
        service: 'CAP Uniform Builder Patch Submission',
        effectiveUser: account,
        gmailAliases: safeAliases_(),
        sharedHistoryConfigured: !!properties.getProperty(HISTORY_PASSWORD_HASH_PROPERTY),
        calibrationGitHubConfigured: !!properties.getProperty(CALIBRATION_GITHUB_TOKEN_PROPERTY),
        calibrationRepository: configuredCalibrationRepository_()
      }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService
    .createHtmlOutput('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:20px">CAP Uniform Builder patch submission endpoint is running.</body></html>')
    .setTitle('CAP Uniform Builder Patch Submission');
}

function handleCalibrationSubmission_(data, requestId) {
  const source = 'CAPUB_CALIBRATION_SUBMISSION';
  let result;
  try {
    verifyHistoryAdmin_(data.adminPassword);
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

    let sendResults = [];
    let emailError = '';
    try {
      sendResults = sendCalibrationEmails_(calibrationPackage, packageJson, previewBlob, requestId, issue, issueError);
    } catch (err) {
      emailError = String(err && err.message ? err.message : err);
      console.error('Calibration backup email failed: ' + emailError);
    }

    const emailFallback = !issue && sendResults.length > 0;
    result = {
      source: source,
      ok: !!issue,
      requestId: requestId,
      error: issue ? '' : ('GitHub issue creation failed: ' + (issueError || 'unknown error')),
      sendResults: sendResults,
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
      error: String(err && err.message ? err.message : err),
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
    '### Codex instructions',
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
  const subject = 'CAP Uniform Builder Calibration Submission — ' + title;
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

  const results = [];
  PATCH_SUBMISSION_RECIPIENTS.forEach(function(recipient) {
    try {
      const options = { attachments: attachments.map(function(blob) { return blob.copyBlob(); }), name: 'CAP Uniform Builder Calibration Submission' };
      const replyTo = sanitize_(submitter.email, 160);
      if (replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) options.replyTo = replyTo;
      GmailApp.sendEmail(recipient, subject, body, options);
      results.push({ recipient: recipient, ok: true });
    } catch (err) {
      results.push({ recipient: recipient, ok: false, error: String(err && err.message ? err.message : err) });
    }
  });
  const failed = results.filter(function(item) { return !item.ok; });
  if (failed.length) throw new Error('Calibration email failed for: ' + failed.map(function(item) { return item.recipient; }).join(', '));
  return results;
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

function handleHistoryRequest_(data, requestId) {
  const source = 'CAPUB_ADMIN_HISTORY';
  try {
    const action = String(data.action || '');
    if (action === 'history_record') {
      if (String(data.honeypot || '').trim()) {
        return responsePage_({ source: source, ok: true, requestId: requestId, data: { ignored: true } });
      }
      const record = normalizeHistoryRecord_(data.record, false);
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        cleanupHistorySheet_();
        upsertHistoryRecord_(record);
      } finally {
        lock.releaseLock();
      }
      return responsePage_({ source: source, ok: true, requestId: requestId, data: { id: record.id } });
    }

    verifyHistoryAdmin_(data.adminPassword);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      cleanupHistorySheet_();
      if (action === 'history_list') {
        return responsePage_({
          source: source,
          ok: true,
          requestId: requestId,
          data: { records: readHistoryRecords_().slice(0, HISTORY_MAX_RECORDS) }
        });
      }
      if (action === 'history_save') {
        setHistorySaved_(sanitize_(data.id, 120), !!data.saved);
        return responsePage_({ source: source, ok: true, requestId: requestId, data: { id: sanitize_(data.id, 120), saved: !!data.saved } });
      }
      if (action === 'history_delete') {
        deleteHistoryRecord_(sanitize_(data.id, 120));
        return responsePage_({ source: source, ok: true, requestId: requestId, data: { id: sanitize_(data.id, 120) } });
      }
      if (action === 'history_cleanup') {
        return responsePage_({ source: source, ok: true, requestId: requestId, data: { records: readHistoryRecords_().slice(0, HISTORY_MAX_RECORDS) } });
      }
      if (action === 'history_import') {
        const records = Array.isArray(data.records) ? data.records.slice(0, HISTORY_MAX_RECORDS) : [];
        records.forEach(function(raw) { upsertHistoryRecord_(normalizeHistoryRecord_(raw, true)); });
        return responsePage_({ source: source, ok: true, requestId: requestId, data: { imported: records.length } });
      }
      throw new Error('Unsupported shared-history action.');
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error('Shared history error: ' + (err && err.stack ? err.stack : err));
    return responsePage_({
      source: source,
      ok: false,
      requestId: requestId,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function getHistorySheet_() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty(HISTORY_SPREADSHEET_ID_PROPERTY);
  let spreadsheet = null;
  if (spreadsheetId) {
    try { spreadsheet = SpreadsheetApp.openById(spreadsheetId); }
    catch (_) { spreadsheet = null; }
  }
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create('CAP Uniform Builder Shared History');
    spreadsheetId = spreadsheet.getId();
    properties.setProperty(HISTORY_SPREADSHEET_ID_PROPERTY, spreadsheetId);
  }
  let sheet = spreadsheet.getSheetByName(HISTORY_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    sheet.setName(HISTORY_SHEET_NAME);
  }
  const headers = ['id', 'createdAt', 'expiresAt', 'saved', 'summaryJson', 'profileJson'];
  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() !== 'id') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function normalizeHistoryRecord_(raw, allowSaved) {
  if (!raw || typeof raw !== 'object' || !raw.profile || typeof raw.profile !== 'object') {
    throw new Error('A valid uniform profile is required.');
  }
  const profile = JSON.parse(JSON.stringify(raw.profile));
  delete profile.calib;
  delete profile.coordinatesByUniform;
  delete profile.calibration;
  const profileJson = JSON.stringify(profile);
  if (profileJson.length > HISTORY_MAX_PROFILE_CHARS) {
    throw new Error('The uniform profile is too large for shared history.');
  }
  const now = new Date();
  const created = new Date(raw.createdAt || now.toISOString());
  const createdAt = isNaN(created.getTime()) ? now.toISOString() : created.toISOString();
  const saved = !!allowSaved && !!raw.saved;
  const expiry = new Date(raw.expiresAt || (created.getTime() + HISTORY_RETENTION_MS));
  const expiresAt = saved ? '' : (isNaN(expiry.getTime()) ? new Date(now.getTime() + HISTORY_RETENTION_MS).toISOString() : expiry.toISOString());
  const summaryRaw = raw.summary && typeof raw.summary === 'object' ? raw.summary : {};
  const summary = {
    membership: sanitize_(summaryRaw.membership || profile.membership, 40),
    gender: sanitize_(summaryRaw.gender || profile.gender, 20),
    uniform: sanitize_(summaryRaw.uniform || profile.uniform, 60),
    rank: sanitize_(summaryRaw.rank || profile.rank, 60),
    ribbons: Math.max(0, Number(summaryRaw.ribbons || (Array.isArray(profile.ribbons) ? profile.ribbons.length : 0)) || 0),
    badges: Math.max(0, Number(summaryRaw.badges || (Array.isArray(profile.badges) ? profile.badges.length : 0)) || 0),
    patches: Math.max(0, Number(summaryRaw.patches || (Array.isArray(profile.patches) ? profile.patches.length : 0)) || 0),
    shoulderCord: sanitize_(summaryRaw.shoulderCord || profile.shoulderCord, 80)
  };
  return {
    id: sanitize_(raw.id, 120) || Utilities.getUuid(),
    createdAt: createdAt,
    expiresAt: expiresAt,
    saved: saved,
    summary: summary,
    profile: profile,
    profileJson: profileJson
  };
}

function historyRowValues_(record) {
  return [
    record.id,
    record.createdAt,
    record.expiresAt || '',
    !!record.saved,
    JSON.stringify(record.summary || {}),
    record.profileJson || JSON.stringify(record.profile || {})
  ];
}

function upsertHistoryRecord_(record) {
  const sheet = getHistorySheet_();
  const lastRow = sheet.getLastRow();
  let row = null;
  if (lastRow > 1) {
    row = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(record.id).matchEntireCell(true).findNext();
  }
  if (row) sheet.getRange(row.getRow(), 1, 1, 6).setValues([historyRowValues_(record)]);
  else sheet.appendRow(historyRowValues_(record));
}

function readHistoryRecords_() {
  const sheet = getHistorySheet_();
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
  return values.map(function(row) {
    try {
      return {
        id: String(row[0] || ''),
        createdAt: String(row[1] || ''),
        expiresAt: row[2] ? String(row[2]) : null,
        saved: row[3] === true || String(row[3]).toLowerCase() === 'true',
        summary: JSON.parse(String(row[4] || '{}')),
        profile: JSON.parse(String(row[5] || '{}'))
      };
    } catch (err) {
      console.warn('Skipping malformed history row: ' + err);
      return null;
    }
  }).filter(function(record) { return record && record.id && record.profile; })
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
}

function cleanupHistorySheet_() {
  const sheet = getHistorySheet_();
  if (sheet.getLastRow() < 2) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  const now = Date.now();
  for (let index = rows.length - 1; index >= 0; index--) {
    const saved = rows[index][3] === true || String(rows[index][3]).toLowerCase() === 'true';
    const expiresAt = new Date(rows[index][2]).getTime();
    if (!saved && (!expiresAt || expiresAt <= now)) sheet.deleteRow(index + 2);
  }
}

function findHistoryRow_(id) {
  const sheet = getHistorySheet_();
  if (!id || sheet.getLastRow() < 2) return null;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
}

function setHistorySaved_(id, saved) {
  const sheet = getHistorySheet_();
  const match = findHistoryRow_(id);
  if (!match) throw new Error('The shared history record was not found.');
  sheet.getRange(match.getRow(), 4).setValue(!!saved);
  sheet.getRange(match.getRow(), 3).setValue(saved ? '' : new Date(Date.now() + HISTORY_RETENTION_MS).toISOString());
}

function deleteHistoryRecord_(id) {
  const sheet = getHistorySheet_();
  const match = findHistoryRow_(id);
  if (match) sheet.deleteRow(match.getRow());
}

function verifyHistoryAdmin_(password) {
  const expected = String(PropertiesService.getScriptProperties().getProperty(HISTORY_PASSWORD_HASH_PROPERTY) || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('Shared history is not configured. Add the CAPUB_ADMIN_PASSWORD_SHA256 script property.');
  }
  if (sha256Hex_(String(password || '')) !== expected) throw new Error('Incorrect admin password for shared history.');
}

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(byte) { return ((byte + 256) % 256).toString(16).padStart(2, '0'); })
    .join('');
}

function verifyHistoryProof_(action, requestId, timestamp, nonce, signature) {
  const expectedHash = String(PropertiesService.getScriptProperties().getProperty(HISTORY_PASSWORD_HASH_PROPERTY) || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error('Shared history is not configured. Add the CAPUB_ADMIN_PASSWORD_SHA256 script property.');
  }
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) {
    throw new Error('The admin history request expired. Refresh and try again.');
  }
  if (!requestId || !nonce || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('Invalid admin history proof.');
  const message = [action, requestId, timestamp, nonce].join(':');
  const keyBytes = [];
  for (let index = 0; index < expectedHash.length; index += 2) keyBytes.push(parseInt(expectedHash.slice(index, index + 2), 16));
  const actual = Utilities.computeHmacSha256Signature(Utilities.newBlob(message).getBytes(), keyBytes)
    .map(function(byte) { return ((byte + 256) % 256).toString(16).padStart(2, '0'); })
    .join('');
  if (actual !== String(signature).toLowerCase()) throw new Error('Incorrect admin password for shared history.');
}

function historyJsonpResponse_(callback, result) {
  const safeCallback = /^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(callback) ? callback : 'capubHistoryInvalidCallback';
  const json = JSON.stringify({
    source: 'CAPUB_ADMIN_HISTORY',
    ok: !!result.ok,
    requestId: String(result.requestId || ''),
    error: result.error ? String(result.error) : '',
    data: result.data || null
  }).replace(/</g, '\\u003c');
  return ContentService.createTextOutput(safeCallback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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

/* Run once after configuring CAPUB_ADMIN_PASSWORD_SHA256. This creates the
   shared-history spreadsheet and requests the required Sheets authorization. */
function testSharedHistoryStorage() {
  const expected = String(PropertiesService.getScriptProperties().getProperty(HISTORY_PASSWORD_HASH_PROPERTY) || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new Error('Add a valid CAPUB_ADMIN_PASSWORD_SHA256 script property first.');
  }
  const sheet = getHistorySheet_();
  const result = {
    ok: true,
    spreadsheetId: sheet.getParent().getId(),
    spreadsheetUrl: sheet.getParent().getUrl(),
    sheetName: sheet.getName()
  };
  console.log(JSON.stringify(result));
  return result;
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
    source: result.source || 'CAPUB_PATCH_SUBMISSION',
    ok: !!result.ok,
    requestId: String(result.requestId || ''),
    error: result.error ? String(result.error) : '',
    sendResults: result.sendResults || null,
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
