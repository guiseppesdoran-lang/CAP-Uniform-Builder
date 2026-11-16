'use strict';
// The one way the project's scripts start headless Chrome: the browser tests (tests/*-browser.cjs), scripts/render-builds.cjs and
// scripts/perf-measure.cjs. Each of them used to make a profile folder under the system's temporary folder, start Chrome, and leave the
// folder behind on every run (nothing removed it), and Chrome itself behind whenever the script ended any way but through its own last
// line: a browser that did not start, a thrown error before the try, a timeout or an interrupt (SIGTERM), a failed assertion in a script
// that never reached its close. Here the browser and every folder made for it go on every way out of the process:
//
//   * a normal close (await chrome.close(): SIGTERM to the browser's whole process group, SIGKILL after three seconds, then the folders),
//   * a failed start (launchChrome closes what it opened before it throws),
//   * the process ending by any route Node can see: process.exit, an uncaught error, an unhandled rejection (the 'exit' event), and
//     SIGINT, SIGTERM and SIGHUP (a test timeout, Ctrl-C, a closed terminal), each of which exits 128 plus its number,
//   * the process being killed outright (SIGKILL, which nothing in the process can see): a small watcher process, started with the
//     browser, polls for the script's pid and kills the browser's group and removes the folders when the script is gone.
//
// The browser is started in its own process group (detached) so that its helper processes (renderers, GPU, utility) are killed with it.
//
//   const { launchChrome, tempDir } = require('../scripts/lib-chrome.cjs');
//   const chrome = await launchChrome({ prefix: 'access-gate' });      // { proc, dir, port, wsPath, ws, close }
//   ... new Cdp(chrome.ws) ...
//   await chrome.close();                                              // optional: the exit routes above do the same
//   const downloads = tempDir('templates-dl');                          // a folder removed on every way out too
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DEFAULT_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const live = new Set();   // every browser started and not yet closed: { dir, extraDirs, proc, reaper, closing }
const temps = new Set();  // every folder made by tempDir and not yet removed
let armed = false;

function removeDir(dir){
  try{ fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }catch(e){ /* nothing more can be done for it */ }
}

// The browser and its helpers killed at once, and the watcher with them.
function hardStop(entry){
  const p = entry.proc;
  if(p && p.pid){
    try{ process.kill(-p.pid, 'SIGKILL'); }
    catch(e){ if(p.exitCode == null && p.signalCode == null){ try{ p.kill('SIGKILL'); }catch(e2){ /* already gone */ } } }
  }
  if(entry.reaper && entry.reaper.pid){ try{ process.kill(entry.reaper.pid, 'SIGKILL'); }catch(e){ /* already gone */ } }
}

// Everything this process started, stopped and removed without waiting for anything: what 'exit' and the signals run.
function cleanupSync(){
  for(const entry of [...live]){
    hardStop(entry);
    removeDir(entry.dir);
    for(const d of entry.extraDirs) removeDir(d);
    live.delete(entry);
  }
  for(const d of [...temps]){ removeDir(d); temps.delete(d); }
}

function arm(){
  if(armed) return;
  armed = true;
  process.on('exit', cleanupSync);
  for(const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]){
    process.on(signal, () => { cleanupSync(); process.exit(code); });
  }
}

// The watcher: while the script lives it does nothing; once the script's pid is gone it kills the browser's group and removes the folders.
const REAPER = `
const fs = require('node:fs');
const [parent, group, ...dirs] = JSON.parse(process.argv[1]);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
setInterval(() => {
  if (alive(parent)) return;
  try { process.kill(-group, 'SIGKILL'); } catch (e) {}
  for (const dir of dirs) { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch (e) {} }
  process.exit(0);
}, 400);
`;
function startReaper(entry){
  const reaper = spawn(process.execPath, ['-e', REAPER, JSON.stringify([process.pid, entry.proc.pid, entry.dir, ...entry.extraDirs])], { detached: true, stdio: 'ignore' });
  reaper.on('error', () => {});
  reaper.unref();
  entry.reaper = reaper;
}

function closeEntry(entry, ws){
  if(entry.closing) return entry.closing;
  entry.closing = (async () => {
    try{ if(ws) ws.close(); }catch(e){ /* closing */ }
    const p = entry.proc;
    if(p && p.pid && p.exitCode == null && p.signalCode == null){
      const gone = new Promise(res => p.once('exit', res));
      try{ process.kill(-p.pid, 'SIGTERM'); }catch(e){ try{ p.kill('SIGTERM'); }catch(e2){ /* already gone */ } }
      const done = await Promise.race([gone.then(() => true), sleep(3000).then(() => false)]);
      if(!done){ hardStop(entry); await Promise.race([gone, sleep(2000)]); }
    }
    // Whatever of the browser's group is still alive, and the watcher; then the folders.
    hardStop(entry);
    removeDir(entry.dir);
    for(const d of entry.extraDirs) removeDir(d);
    live.delete(entry);
  })();
  return entry.closing;
}

// Starts headless Chrome on a fresh profile folder named <prefix>-chrome-XXXXXX in the temporary folder and connects to its DevTools
// socket. `flags` are added to the common ones; `extraDirs` are folders (downloads, a certificate) removed together with the browser, also
// if the script is killed. `watcher: false` leaves out the watcher process (tests/lib-chrome.test.cjs does, to see the in-process routes on their own). Resolves to
// { proc, dir, port, wsPath, ws, close }; throws, with nothing left behind, when Chrome cannot start.
async function launchChrome({ prefix = 'chrome', flags = [], extraDirs = [], stderr = false, timeoutMs = 20000, watcher = true, binary = process.env.CHROME || DEFAULT_CHROME } = {}){
  if(!fs.existsSync(binary)) throw new Error(`Chrome not found at ${binary} (set CHROME=/path/to/chrome)`);
  arm();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-chrome-`));
  const entry = { dir, extraDirs: extraDirs.slice(), proc: null, reaper: null, closing: null };
  live.add(entry);
  try{
    const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio', ...flags, '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'];
    const proc = spawn(binary, args, { stdio: ['ignore', 'ignore', stderr ? 'pipe' : 'ignore'], detached: true });
    entry.proc = proc;
    proc.on('error', () => {});
    if(!proc.pid) throw new Error(`Chrome could not be started from ${binary}`);
    let err = '';
    if(stderr) proc.stderr.on('data', d => { err += d; });
    if(watcher) startReaper(entry);
    const portFile = path.join(dir, 'DevToolsActivePort');
    const t0 = Date.now();
    while(!fs.existsSync(portFile)){
      if(proc.exitCode != null || proc.signalCode != null) throw new Error(`Chrome exited early${err ? ': ' + err.slice(-500) : ''}`);
      if(Date.now() - t0 > timeoutMs) throw new Error('Chrome did not start');
      await sleep(25);
    }
    await sleep(50);
    const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
    const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', () => rej(new Error('Could not connect to Chrome DevTools'))); });
    return { proc, dir, port, wsPath, ws, close: () => closeEntry(entry, ws) };
  }catch(e){
    await closeEntry(entry);
    throw e;
  }
}

// A temporary folder removed when the process ends by any route the browsers above are cleaned on (pass it as `extraDirs` of launchChrome as well
// to have it removed when the script is killed outright).
function tempDir(prefix){
  arm();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  temps.add(dir);
  return dir;
}

module.exports = { launchChrome, tempDir, DEFAULT_CHROME };
