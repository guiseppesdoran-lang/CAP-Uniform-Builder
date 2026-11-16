#!/usr/bin/env node
'use strict';
// A stand-in for Chrome for tests/lib-chrome.test.cjs: it takes the flags scripts/lib-chrome.cjs gives a browser, answers the DevTools socket's handshake
// (nothing more), writes DevToolsActivePort into the profile folder, records its pid in FAKE_CHROME_PIDFILE and then waits like a browser does. It leaves
// a file in its profile folder, as Chrome does, so removing the folder takes more than an empty rmdir. FAKE_CHROME_IGNORE_TERM=1 makes it ignore SIGTERM
// (a browser that does not close when asked); FAKE_CHROME_NO_PORT=1 makes it never write the port file (a browser that does not start).
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const flag = name => (process.argv.find(a => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
const dir = flag('user-data-dir');
if(process.env.FAKE_CHROME_PIDFILE) fs.appendFileSync(process.env.FAKE_CHROME_PIDFILE, `${process.pid}\n`);
fs.mkdirSync(path.join(dir, 'Default'), { recursive: true });
fs.writeFileSync(path.join(dir, 'Default', 'Preferences'), '{}');
if(process.env.FAKE_CHROME_IGNORE_TERM === '1') process.on('SIGTERM', () => {});
const server = http.createServer((req, res) => res.end('fake'));
server.on('upgrade', (req, socket) => {
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.on('error', () => {});
});
server.listen(0, '127.0.0.1', () => {
  if(process.env.FAKE_CHROME_NO_PORT === '1') return;
  fs.writeFileSync(path.join(dir, 'DevToolsActivePort'), `${server.address().port}\n/devtools/browser/fake\n`);
});
setInterval(() => {}, 1000);
