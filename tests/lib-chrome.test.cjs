'use strict';
// scripts/lib-chrome.cjs starts the headless Chrome of the browser tests, scripts/render-builds.cjs and scripts/perf-measure.cjs. Each of them once left its profile
// folder behind on every run and its browser behind on every way out but its own last line, so thousands of folders and days-old browsers piled up. These tests end a
// script every way it can end while it holds a browser, with a stand-in browser (tests/helpers/fake-chrome.cjs) so that they need no Chrome, in a private temporary folder
// (TMPDIR) so that nothing else's folders are looked at, and require that afterwards the browser is dead and the temporary folder is empty.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const CHILD = path.join(__dirname, 'helpers', 'chrome-child.cjs');
const alive = pid => { try{ process.kill(pid, 0); return true; }catch(e){ return e.code === 'EPERM'; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (ok, ms) => { for(let t = 0; t < ms; t += 50){ if(ok()) return true; await sleep(50); } return ok(); };

// Runs the child in its own temporary folder, waits for "ready <pid>", lets `act` end it, then reports what is left.
async function run(mode, act, env = {}){
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lib-chrome-test-'));
  const pidfile = path.join(tmp, '..', `${path.basename(tmp)}.pids`);
  const child = spawn(process.execPath, [CHILD, mode], { env: Object.assign({}, process.env, { TMPDIR: tmp, FAKE_CHROME_PIDFILE: pidfile }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { err += d; });
  const exited = new Promise(res => child.on('exit', (code, signal) => res({ code, signal })));
  try{
    const ready = mode === 'no-start' ? true : await until(() => /ready \d+/.test(out), 15000);
    assert.ok(ready, `the child never got its browser: ${out}${err}`);
    if(act) act(child);
    const end = await Promise.race([exited, sleep(15000).then(() => 'hung')]);
    assert.notEqual(end, 'hung', `the child did not end: ${out}${err}`);
    const pids = fs.existsSync(pidfile) ? fs.readFileSync(pidfile, 'utf8').split('\n').filter(Boolean).map(Number) : [];
    // The routes inside the process have cleaned up before the child ended (they run with no watcher): what is left is looked at at once, after a moment for the kernel to
    // reap the browser. The watcher of a process killed outright looks every 0.4 s, so that case is given five seconds.
    const gone = await until(() => pids.every(p => !alive(p)) && fs.readdirSync(tmp).length === 0, env.CHILD_WATCHER === '1' ? 5000 : 300);
    return { end, out, err, pids, gone, left: fs.readdirSync(tmp), alive: pids.filter(alive) };
  }finally{
    try{ child.kill('SIGKILL'); }catch(e){ /* ended */ }
    for(const f of [pidfile]) fs.rmSync(f, { force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
const clean = (r, label) => {
  assert.ok(r.pids.length >= 1, `${label}: a browser was started`);
  assert.deepEqual(r.alive, [], `${label}: the browser is still running`);
  assert.deepEqual(r.left, [], `${label}: folders are left in the temporary folder`);
};

test('a script that closes its browser leaves no browser and no folder', async () => {
  const r = await run('close');
  assert.equal(r.end.code, 0);
  clean(r, 'close');
});

test('a script that ends with process.exit without closing leaves no browser and no folder', async () => {
  const r = await run('exit');
  assert.equal(r.end.code, 3);
  clean(r, 'exit');
});

test('a script that dies on an uncaught error or an unhandled rejection leaves no browser and no folder', async () => {
  for(const mode of ['throw', 'reject']){
    const r = await run(mode);
    assert.equal(r.end.code, 1, mode);
    clean(r, mode);
  }
});

test('a browser that does not start is closed and its folder removed before the error reaches the script', async () => {
  const r = await run('no-start', null, { FAKE_CHROME_NO_PORT: '1' });
  assert.equal(r.end.code, 4);
  assert.match(r.err, /Chrome did not start/);
  clean(r, 'no-start');
});

test('SIGTERM and SIGINT (a test timeout, Ctrl-C) end the script with 128 plus the signal and leave no browser and no folder', async () => {
  for(const [signal, code] of [['SIGTERM', 143], ['SIGINT', 130]]){
    const r = await run('wait', child => child.kill(signal));
    assert.equal(r.end.code, code, signal);
    clean(r, signal);
  }
});

test('a script killed outright (SIGKILL, which nothing in it can see) is followed by its watcher: no browser and no folder', async () => {
  const r = await run('wait', child => child.kill('SIGKILL'), { CHILD_WATCHER: '1' });
  assert.equal(r.end.signal, 'SIGKILL');
  assert.equal(r.gone, true, `the watcher did not clean up: ${r.alive} alive, left ${r.left}`);
  clean(r, 'SIGKILL');
});

test('a browser that ignores SIGTERM is killed after the wait, and the folders go', async () => {
  const t0 = Date.now();
  const r = await run('close', null, { FAKE_CHROME_IGNORE_TERM: '1' });
  assert.equal(r.end.code, 0);
  assert.ok(Date.now() - t0 >= 2500, 'it waited for the browser to close before it killed it');
  clean(r, 'ignores SIGTERM');
});

test('every script that starts Chrome does it through the helper: none makes its own profile folder or spawns the browser itself', () => {
  const root = path.join(__dirname, '..');
  const files = [...fs.readdirSync(__dirname).filter(f => /-browser\.cjs$/.test(f)).map(f => path.join('tests', f)), 'scripts/render-builds.cjs', 'scripts/perf-measure.cjs'];
  assert.ok(files.length >= 16, `found the browser scripts (${files.length})`);
  for(const rel of files){
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(text, /require\('(?:\.\.\/scripts|\.)\/lib-chrome\.cjs'\)/, `${rel} does not use scripts/lib-chrome.cjs`);
    assert.doesNotMatch(text, /--user-data-dir|-chrome-'|spawn\(CHROME/, `${rel} starts Chrome or makes its profile folder itself`);
    assert.doesNotMatch(text, /mkdtempSync\(path\.join\(os\.tmpdir\(\), '[a-z-]+-(?:chrome|dl)-'\)/, `${rel} makes a temporary folder for the browser itself`);
  }
  // Nothing else in the repository starts a browser either.
  const { spawnSync } = require('node:child_process');
  const listed = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(f => /\.(cjs|js|mjs)$/.test(f) && !/^(images|vendor)\//.test(f) && f !== 'tests/lib-chrome.test.cjs');
  for(const rel of listed){
    if(/^(scripts\/lib-chrome\.cjs)$/.test(rel)) continue;
    assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /--headless/, `${rel} starts a headless browser outside the helper`);
  }
});
