'use strict';
// Serves dist/ locally with the same security headers the deploy examples set, so the
// built site can be checked in a browser before it goes on a real server.
//
//   node scripts/serve-dist.cjs [port]        (default 8780, 127.0.0.1 only)
//   CAPUB_SUBMISSION_ENDPOINT=URL node scripts/serve-dist.cjs   to match a build with submissions on
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { buildCsp, SECURITY_HEADERS } = require('./csp.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.argv[2]) || 8780;
const endpoint = (process.env.CAPUB_SUBMISSION_ENDPOINT || '').trim();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8'
};

const headers = {
  'Content-Security-Policy': buildCsp({ endpoint, forHeader: true }),
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  ...SECURITY_HEADERS
};

http.createServer((req, res) => {
  const send = (status, body, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(body); };
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Method not allowed');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { return send(400, 'Bad request'); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(DIST, pathname));
  const relative = path.relative(DIST, file);
  // Stay inside dist/ and never serve dotfiles.
  if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) return send(404, 'Not found');
  fs.readFile(file, (error, data) => {
    if (error) return send(404, 'Not found');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const cache = path.basename(file) === 'index.html' ? 'no-cache' : 'public, max-age=3600';
    send(200, req.method === 'HEAD' ? undefined : data, { 'Content-Type': type, 'Cache-Control': cache });
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Serving dist/ at http://127.0.0.1:${PORT}/`));
