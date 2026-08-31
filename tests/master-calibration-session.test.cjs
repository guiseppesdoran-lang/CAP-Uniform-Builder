const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const submissionSource = fs.readFileSync(path.join(root, 'calibration-submission.js'), 'utf8');

test('admin master calibration records only changed keys grouped by uniform', () => {
  assert.match(indexSource, /id="calibMasterSession"/);
  assert.match(indexSource, /function recordMasterCalibrationChange\(key, calibration\)/);
  assert.match(indexSource, /session\.changesByUniform\[bucketId\]\[key\]=\{\.\.\.calibration\}/);
  assert.match(indexSource, /recordMasterCalibrationChange\(key,bucket\[key\]\)/);
  assert.match(indexSource, /function getMasterCalibrationSessionSnapshot\(\)/);
});

test('master calibration submission carries multiple uniform scopes in one package', () => {
  assert.match(submissionSource, /submissionMode:master \? 'MASTER_MULTI_UNIFORM' : 'SINGLE_UNIFORM'/);
  assert.match(submissionSource, /const calibrationScopes=master\?\.scopes/);
  assert.match(submissionSource, /schemaVersion:master \? 2 : 1/);
  assert.match(submissionSource, /changes\.map\(change=>`\$\{change\.calibrationBucket\}::\$\{change\.key\}`\)/);
});
