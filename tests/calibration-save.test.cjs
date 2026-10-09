'use strict';
// The calibrator's "Save to repo folder" button replaces a hand-pasted export. These tests cover the
// text it writes, which boxes it decides to write, and the write itself against a fake folder.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'calibration-save.js'), 'utf8');
const DATA_FILE = path.join(ROOT, 'data', 'calibration-defaults.js');

// Runs the script in a bare context with the few globals it reads when saving.
function load({ state = { calib: { byUniform: {} } }, defaults = {}, fromFile = {}, picker } = {}) {
  const context = { State: state, DEFAULT_CALIBRATION_BY_UNIFORM: defaults, console };
  context.window = context;
  context.CAPUB_CALIBRATION_DEFAULTS = fromFile;
  if (picker) context.showDirectoryPicker = picker;
  vm.createContext(context);
  vm.runInContext(SOURCE, context);
  return { api: context.CAPUB_CALIBRATION_SAVE, context };
}
// Values built inside the vm belong to another realm; copy them so deepEqual compares plain objects.
const plain = value => JSON.parse(JSON.stringify(value));

test('serialize writes one box per line, buckets and keys sorted, fields in x y w h r order', () => {
  const { api } = load();
  const text = api.serialize({
    zeta: { 'badge:b:LP:0': { r: 0, h: 20, w: 20, y: 2, x: 1 } },
    alpha: { 'badge:z:UN:0': { y: 5 }, 'badge:a:UN:0': { x: 1.23456, y: 2 } },
    empty: {}
  });
  const body = text.split('\n').filter(line => !line.startsWith('//'));
  assert.deepEqual(body, [
    'window.CAPUB_CALIBRATION_DEFAULTS = {',
    '"alpha": {',
    '  "badge:a:UN:0": {"x":1.235,"y":2},',
    '  "badge:z:UN:0": {"y":5}',
    '},',
    '"zeta": {',
    '  "badge:b:LP:0": {"x":1,"y":2,"w":20,"h":20,"r":0}',
    '}',
    '};',
    ''
  ]);
});

test('the shipped data file is already in canonical form, so a save with no edits changes nothing', () => {
  const { api } = load();
  const text = fs.readFileSync(DATA_FILE, 'utf8');
  assert.equal(api.serialize(api.parse(text)), text);
});

test('parse reads a written file back and refuses anything else', () => {
  const { api } = load();
  const map = { b: { 'badge:x:LP:0': { x: 1, y: 2 } } };
  assert.deepEqual(plain(api.parse(api.serialize(map))), map);
  assert.throws(() => api.parse('var nothing = 1;'), /Not a calibration defaults file/);
});

test('collect keeps edits and new boxes, skips untouched rule boxes, and falls back to defaults for cleared ones', () => {
  const defaults = {
    blues_a_male: { 'badge:a:LP:0': { x: 10, y: 20, w: 30, h: 30, r: 0 }, 'badge:b:LP:0': { x: 1, y: 2 } },
    ocp: { 'patch:p:L_SHOULDER:0': { x: 5, y: 6, w: 7, h: 8, r: 0 }, 'patch:q:L_SHOULDER:0': { x: 9, y: 9, w: 7, h: 8, r: 0 } }
  };
  const fromFile = { blues_a_male: { 'badge:a:LP:0': defaults.blues_a_male['badge:a:LP:0'], 'badge:b:LP:0': defaults.blues_a_male['badge:b:LP:0'] } };
  const live = {
    // a: moved by the developer. b: cleared with Reset Selected, so it is absent here.
    blues_a_male: { 'badge:a:LP:0': { x: 11, y: 20, w: 30, h: 30, r: 0 }, 'badge:new:UN:0': { x: 3, y: 4, w: 5, h: 6, r: 0 } },
    // p: untouched rule box. q: moved.
    ocp: { 'patch:p:L_SHOULDER:0': { x: 5, y: 6, w: 7, h: 8, r: 0 }, 'patch:q:L_SHOULDER:0': { x: 10, y: 9, w: 7, h: 8, r: 0 } }
  };
  const { api } = load({ state: { calib: { byUniform: live } }, defaults, fromFile });
  assert.deepEqual(plain(api.collect()), {
    blues_a_male: {
      'badge:a:LP:0': { x: 11, y: 20, w: 30, h: 30, r: 0 },
      'badge:b:LP:0': { x: 1, y: 2 },
      'badge:new:UN:0': { x: 3, y: 4, w: 5, h: 6, r: 0 }
    },
    ocp: { 'patch:q:L_SHOULDER:0': { x: 10, y: 9, w: 7, h: 8, r: 0 } }
  });
});

// A folder that records what is written into it.
function fakeRepo({ withIndex = true, withData = true } = {}) {
  const written = [];
  const file = { async createWritable() { return { async write(text) { written.push(text); }, async close() {} }; } };
  const missing = name => Object.assign(new Error(`${name} not found`), { name: 'NotFoundError' });
  const root = {
    async getFileHandle(name) { if (name === 'index.html' && withIndex) return {}; throw missing(name); },
    async getDirectoryHandle(name) {
      if (name === 'data' && withData) return { async getFileHandle(n) { if (n === 'calibration-defaults.js') return file; throw missing(n); } };
      throw missing(name);
    },
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; }
  };
  return { root, written };
}

test('save writes the canonical file into data/ of the picked repository folder', async () => {
  const repo = fakeRepo();
  const defaults = { blues_a_male: { 'badge:a:LP:0': { x: 1, y: 2, w: 3, h: 4, r: 0 } } };
  const { api } = load({ defaults, fromFile: defaults, picker: async () => repo.root });
  const message = await api.save();
  assert.equal(repo.written.length, 1);
  assert.equal(repo.written[0], api.serialize(defaults));
  assert.match(message, /Wrote 1 boxes to data\/calibration-defaults\.js/);
});

test('save refuses a folder that is not the repository root and writes nothing', async () => {
  const repo = fakeRepo({ withIndex: false });
  const { api } = load({ defaults: { b: { 'badge:a:LP:0': { x: 1, y: 2 } } }, picker: async () => repo.root });
  await assert.rejects(() => api.save(), /index\.html not found/);
  assert.deepEqual(repo.written, []);
});
