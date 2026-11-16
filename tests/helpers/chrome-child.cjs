'use strict';
// The script tests/lib-chrome.test.cjs runs as a child process to end every way a script can end while it holds a browser started by scripts/lib-chrome.cjs.
//   node chrome-child.cjs <mode>
// It starts the stand-in browser (tests/helpers/fake-chrome.cjs), makes a download folder, prints "ready <browser pid>" and then does what the mode says.
const path = require('node:path');
const { launchChrome, tempDir } = require('../../scripts/lib-chrome.cjs');

const mode = process.argv[2];
(async () => {
  const downloads = tempDir('child-dl');
  const chrome = await launchChrome({ prefix: 'child', binary: path.join(__dirname, 'fake-chrome.cjs'), extraDirs: [downloads], timeoutMs: mode === 'no-start' ? 400 : 20000, watcher: process.env.CHILD_WATCHER === '1' });
  console.log(`ready ${chrome.proc.pid}`);
  if(mode === 'close') { await chrome.close(); process.exit(0); }
  if(mode === 'exit') process.exit(3);
  // An error nobody catches and a rejection nobody handles: Node ends the process, as it does a script whose assertion failed outside its try.
  if(mode === 'throw') setTimeout(() => { throw new Error('a failed assertion'); }, 20);
  if(mode === 'reject') setTimeout(() => { Promise.reject(new Error('a rejected promise')); }, 20);
  // 'wait': stay up until a signal arrives
  setInterval(() => {}, 1000);
})().catch(e => { console.error(String(e && e.message || e)); process.exit(mode === 'no-start' ? 4 : 1); });
