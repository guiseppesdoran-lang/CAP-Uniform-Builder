'use strict';
// Runs google-apps-script/Code.gs in a sandbox with fakes for the Apps Script services,
// so the endpoint's access rules can be tested without deploying it.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');

function signed(buffer) { return [...buffer].map(v => (v > 127 ? v - 256 : v)); }
function sha256Hex(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

function makeEndpoint(properties = {}) {
  const props = { ...properties };
  const cache = new Map();
  const sent = [];
  const fetched = [];
  const blob = (bytes, mime, name) => ({ bytes, mime, name, copyBlob() { return this; } });
  const output = html => ({ html, setXFrameOptionsMode() { return this; }, setTitle() { return this; } });
  const sandbox = {
    console: { log() {}, error() {}, warn() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => (name in props ? props[name] : null) }) },
    CacheService: { getScriptCache: () => ({ get: key => (cache.has(key) ? cache.get(key) : null), put: (key, value) => { cache.set(key, String(value)); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      base64Decode: text => signed(Buffer.from(text, 'base64')),
      computeDigest: (algorithm, text) => signed(crypto.createHash('sha256').update(text).digest()),
      newBlob: blob,
      getUuid: () => crypto.randomUUID()
    },
    GmailApp: { sendEmail: (to, subject, body, options) => { sent.push({ to, subject, body, options }); } },
    HtmlService: { createHtmlOutput: output, XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' } },
    ContentService: { createTextOutput: text => ({ text, setMimeType() { return this; } }), MimeType: { JAVASCRIPT: 'JS', JSON: 'JSON' } },
    UrlFetchApp: {
      fetch: (url, options) => {
        fetched.push({ url, options });
        return { getResponseCode: () => 201, getContentText: () => JSON.stringify({ number: 7, html_url: 'https://example.test/issues/7' }) };
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'Code.gs' });
  const reply = out => JSON.parse(/var data=(.*?);var notify/s.exec(out.html)[1].replace(/\\u003c/g, '<'));
  const post = payload => reply(sandbox.doPost({ parameter: { payload: JSON.stringify(payload) } }));
  return { sandbox, props, sent, fetched, post, get: parameter => sandbox.doGet({ parameter }) };
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(32, 1)]);
const patch = (overrides = {}) => ({
  requestId: 'r1', patchName: 'Test patch', unitName: 'Test unit', mimeType: 'image/png',
  fileName: 'patch.png', fileSize: PNG.length, fileData: PNG.toString('base64'), ...overrides
});
const RECIPIENTS = { CAPUB_PATCH_RECIPIENTS: 'a@example.test, b@example.test' };

const calibrationPackage = () => ({
  type: 'capub-calibration-change-request', title: 'Move badge', notes: 'Nudge it', context: { uniform: 'blues_a' },
  submitter: { name: 'A', email: '' }, changes: [{ key: 'badge:x:LP:0' }]
});

test('the endpoint has no shared-history or spreadsheet code and holds no addresses', () => {
  assert.doesNotMatch(SOURCE, /SpreadsheetApp|history_|HISTORY/);
  assert.doesNotMatch(SOURCE, /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
});

test('history actions are refused', () => {
  const endpoint = makeEndpoint(RECIPIENTS);
  for (const action of ['history_record', 'history_list', 'history_import']) {
    const result = endpoint.post({ action, requestId: 'x', record: { profile: {} } });
    assert.equal(result.ok, false, action);
  }
});

test('GET modes reveal nothing about the account or configuration', () => {
  const endpoint = makeEndpoint({ ...RECIPIENTS, CAPUB_GITHUB_TOKEN: 'secret-token' });
  for (const mode of ['status', 'history_list', '']) {
    const out = endpoint.get({ mode });
    const text = out.html || out.text;
    assert.doesNotMatch(text, /@|secret-token|effectiveUser|gmailAliases/i, mode);
  }
});

test('a valid patch image is delivered and the reply does not expose the recipients', () => {
  const endpoint = makeEndpoint(RECIPIENTS);
  const result = endpoint.post(patch());
  assert.equal(result.ok, true);
  assert.equal(endpoint.sent.length, 2);
  assert.deepEqual(endpoint.sent.map(item => item.to), ['a@example.test', 'b@example.test']);
  assert.doesNotMatch(JSON.stringify(result), /example\.test/);
});

test('patch images must be PNG, JPEG or WebP with a matching file signature', () => {
  const endpoint = makeEndpoint(RECIPIENTS);
  assert.equal(endpoint.post(patch({ mimeType: 'image/svg+xml' })).ok, false);
  const notAnImage = Buffer.from('<script>alert(1)</script>');
  const spoofed = endpoint.post(patch({ fileData: notAnImage.toString('base64'), fileSize: notAnImage.length }));
  assert.equal(spoofed.ok, false);
  assert.equal(endpoint.sent.length, 0);
});

test('patch submissions fail closed without configured recipients and honour the honeypot', () => {
  const unconfigured = makeEndpoint({});
  assert.equal(unconfigured.post(patch()).ok, false);
  const endpoint = makeEndpoint(RECIPIENTS);
  assert.equal(endpoint.post(patch({ honeypot: 'bot' })).ok, true);
  assert.equal(endpoint.sent.length, 0);
});

test('patch submissions are rate limited', () => {
  const endpoint = makeEndpoint(RECIPIENTS);
  const results = Array.from({ length: 22 }, (_, index) => endpoint.post(patch({ requestId: 'r' + index })));
  assert.equal(results.filter(item => item.ok).length, 20);
  assert.equal(results.at(-1).ok, false);
});

test('calibration submissions need the admin key and lock out guessing', () => {
  const key = 'a long random admin passphrase';
  const endpoint = makeEndpoint({ ...RECIPIENTS, CAPUB_ADMIN_PASSWORD_SHA256: sha256Hex(key), CAPUB_GITHUB_TOKEN: 't' });
  const submit = (adminPassword, requestId) => endpoint.post({ action: 'calibration_submission', requestId, adminPassword, calibrationPackage: calibrationPackage() });
  assert.equal(submit('wrong', 'c1').ok, false);
  assert.equal(endpoint.fetched.length, 0);
  const good = submit(key, 'c2');
  assert.equal(good.ok, true);
  assert.equal(good.data.issueNumber, 7);
  for (let i = 0; i < 10; i++) submit('wrong', 'g' + i);
  assert.equal(submit(key, 'c3').ok, false, 'even the right key is refused after repeated failures');
});

test('a salted admin hash is honoured and an unconfigured endpoint refuses calibration', () => {
  const key = 'another long random passphrase';
  const salted = makeEndpoint({ ...RECIPIENTS, CAPUB_ADMIN_SALT: 'pepper', CAPUB_ADMIN_PASSWORD_SHA256: sha256Hex('pepper:' + key), CAPUB_GITHUB_TOKEN: 't' });
  assert.equal(salted.post({ action: 'calibration_submission', requestId: 's1', adminPassword: key, calibrationPackage: calibrationPackage() }).ok, true);
  const unconfigured = makeEndpoint(RECIPIENTS);
  assert.equal(unconfigured.post({ action: 'calibration_submission', requestId: 'u1', adminPassword: key, calibrationPackage: calibrationPackage() }).ok, false);
});

test('safeEqual_ compares whole strings', () => {
  const endpoint = makeEndpoint({});
  assert.equal(endpoint.sandbox.safeEqual_('abc', 'abc'), true);
  assert.equal(endpoint.sandbox.safeEqual_('abc', 'abd'), false);
  assert.equal(endpoint.sandbox.safeEqual_('abc', 'abcd'), false);
});
