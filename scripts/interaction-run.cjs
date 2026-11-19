#!/usr/bin/env node
'use strict';
// Runs the scenarios of scripts/interaction-scenarios.cjs through scripts/interaction-perf.cjs and prints one line for each (the median of the runs).
//   node scripts/interaction-run.cjs [--cpu 4] [--view phone|desktop] [--runs 3] [--only "ribbon tile on,badge level"] [--trace] [--profile] [--json OUT]
const fs = require('node:fs');
const { openSession, parseArgs, sleep, median } = require('./interaction-perf.cjs');
const { SCENARIOS, setupJs } = require('./interaction-scenarios.cjs');

(async () => {
  const o = parseArgs(process.argv.slice(2));
  const s = await openSession(o);
  const rows = [];
  try {
    await s.setCpu(o.cpu);
    let loaded = null;
    for(const sc of SCENARIOS){
      if(o.only && !o.only.includes(sc.name)) continue;
      process.stdout.write(`${sc.name.padEnd(28)} `);
      try{
        if(loaded !== sc.config || sc.open){
          await s.setCpu(1);
          await s.load();
          const info = await s.ev(setupJs(sc.config));
          if(sc.open) await s.ev(sc.open);
          await s.setCpu(o.cpu);
          loaded = sc.open ? null : sc.config;
          if(rows.length === 0 || rows[rows.length - 1].config !== sc.config) console.log('\n  ' + sc.config + ' ' + info);
        }
        const runs = [];
        for(let i = 0; i < o.runs; i++){
          if(sc.prep){ await s.setCpu(1); await s.ev(sc.prep); await sleep(300); await s.setCpu(o.cpu); }
          const r = await s.tap({ sel: sc.sel, pred: sc.pred, act: sc.act, trace: o.trace && i === o.runs - 1, profile: o.profile && i === o.runs - 1 });
          runs.push(r);
        }
        const row = { name: sc.name, config: sc.config, feedback: median(runs.map(r => r.feedback)), result: median(runs.map(r => r.result)), drawings: median(runs.map(r => r.drawings)), longMax: median(runs.map(r => r.longMax)), longSum: median(runs.map(r => r.longSum)), longCount: median(runs.map(r => r.longCount)), last: runs[runs.length - 1] };
        rows.push(row);
        console.log(`feedback ${String(row.feedback).padStart(6)}  result ${String(row.result).padStart(6)}  drawings ${row.drawings}  ${row.last.hit === 'ok' ? '' : row.last.hit + ' '}  long max ${row.longMax} sum ${row.longSum} (${row.longCount})`);
        if(o.trace && row.last.timeline) console.log('    trace: ' + JSON.stringify(row.last.timeline));
        if(o.profile && row.last.profile) console.log('    profile:\n      ' + row.last.profile.join('\n      '));
        if(o.trace || o.profile) for(const l of row.last.loaf.slice(0, 3)) console.log('    loaf ' + JSON.stringify(l));
      }catch(e){ console.log('ERROR ' + e.message.slice(0, 200)); rows.push({ name: sc.name, config: sc.config, error: e.message }); }
    }
    if(o.json) fs.writeFileSync(o.json, JSON.stringify({ cpu: o.cpu, view: o.view, rows }, null, 1));
  }finally{ await s.close(); process.exit(0); }
})();
