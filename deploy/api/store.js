'use strict';
// Storage for the usage counts and the feedback (LIVE13 E69, E70). No database: append-only JSON Lines files in DATA_DIR,
//   events-YYYY-MM.jsonl   one anonymous event per line, a file per month (UTC)
//   feedback.jsonl         one feedback message per line
//   feedback-state.json    the read and archived flags, rewritten whole (write to a temporary file, then rename)
//   session-secret         the key that signs the admin cookie, made at first start unless SESSION_SECRET is set
// Everything is also held in memory, loaded once at start; the site's traffic is small enough for that.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FILE_MODE = 0o640;

function readLines(file){
  let text;
  try{ text = fs.readFileSync(file, 'utf8'); }catch(e){ if(e.code === 'ENOENT') return []; throw e; }
  const out = [];
  for(const line of text.split('\n')){
    if(!line.trim()) continue;
    try{ out.push(JSON.parse(line)); }catch(e){ /* a torn last line after a crash: skip it */ }
  }
  return out;
}

function monthOf(iso){ return String(iso).slice(0, 7); }

function createStore(dataDir){
  if(!dataDir) throw new Error('DATA_DIR is not set');
  fs.mkdirSync(dataDir, { recursive: true });
  try{ fs.accessSync(dataDir, fs.constants.W_OK); }
  catch(e){
    throw new Error(`cannot write ${dataDir} (${e.code}). On the server: mkdir -p deploy/var && sudo chown 1000:1000 deploy/var, then restart.`);
  }
  const file = name => path.join(dataDir, name);
  const append = (name, lines) => { if(lines.length) fs.appendFileSync(file(name), lines.map(l => JSON.stringify(l) + '\n').join(''), { mode: FILE_MODE }); };

  const events = [];
  for(const name of fs.readdirSync(dataDir).filter(n => /^events-\d{4}-\d\d\.jsonl$/.test(n)).sort()) events.push(...readLines(file(name)));
  events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  const feedback = readLines(file('feedback.jsonl'));
  let flags = {};
  try{ flags = JSON.parse(fs.readFileSync(file('feedback-state.json'), 'utf8')) || {}; }catch(e){ flags = {}; }

  function addEvents(list){
    const byMonth = new Map();
    for(const e of list){
      const m = monthOf(e.ts);
      if(!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m).push(e);
    }
    for(const [m, lines] of byMonth) append(`events-${m}.jsonl`, lines);
    events.push(...list);
  }

  function addFeedback(entry){
    const item = Object.assign({ id: 'fb_' + crypto.randomBytes(6).toString('hex') }, entry);
    append('feedback.jsonl', [item]);
    feedback.push(item);
    return item;
  }

  function writeFlags(){
    const tmp = file(`feedback-state.json.${process.pid}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(flags), { mode: FILE_MODE });
    fs.renameSync(tmp, file('feedback-state.json'));
  }

  // flag 'read' or 'archived'; on true stamps the time, on false clears it. Returns the item's flags, or null for an unknown id.
  function setFlag(id, flag, on, nowIso){
    if(!feedback.some(f => f.id === id)) return null;
    const cur = Object.assign({}, flags[id] || {});
    if(on) cur[flag] = cur[flag] || nowIso; else delete cur[flag];
    if(Object.keys(cur).length) flags[id] = cur; else delete flags[id];
    writeFlags();
    return cur;
  }

  // The admin cookie's key: SESSION_SECRET when given, else a random one kept here so a restart keeps sessions.
  function sessionSecret(given){
    if(given) return given;
    const f = file('session-secret');
    try{ const s = fs.readFileSync(f, 'utf8').trim(); if(s.length >= 32) return s; }catch(e){ /* made below */ }
    const s = crypto.randomBytes(32).toString('base64url');
    fs.writeFileSync(f, s + '\n', { mode: 0o600 });
    return s;
  }

  return { events, feedback, get flags(){ return flags; }, addEvents, addFeedback, setFlag, sessionSecret, dir: dataDir };
}

module.exports = { createStore, readLines };
