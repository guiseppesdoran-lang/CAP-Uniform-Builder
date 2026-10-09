/* Developer tool: write the calibrated boxes straight into data/calibration-defaults.js.

   The calibrator used to export a JSON file that someone pasted into the data file by hand and
   pushed. "Save to repo folder" does that step: it works out which boxes differ from what the
   rules already produce, writes them in one fixed format (one box per line, keys sorted, fields in
   the order x, y, w, h, r) and leaves the commit to git, so a save shows up as a small diff.

   Chrome and Edge can write into a folder the developer picks once (File System Access API). Other
   browsers get the same file as a download. Nothing here runs unless the page is opened with
   ?dev=1, and nothing leaves the browser. */
(function(){
  'use strict';

  const MARKER = 'window.CAPUB_CALIBRATION_DEFAULTS = ';
  const HEADER = [
    '// Hand-calibrated boxes for badges, patches, shoulder cords and ribbons, one box per line.',
    '// Each key is "<kind>:<id>[:<slot>:<index>]" and each box has x, y, width, height and rotation',
    '// in canvas pixels. A box may list only some fields; the rest come from the badge\'s regulation',
    '// size and the slot anchor. Boxes that the rules in js/calibration.js and js/patches.js already',
    '// produce are not listed. Written by the calibrator\'s "Save to repo folder" button.',
    '// See docs/CALIBRATION.md.'
  ].join('\n');
  const FIELDS = ['x', 'y', 'w', 'h', 'r'];

  function pickBox(value){
    const box = {};
    for(const field of FIELDS){
      const n = Number(value?.[field]);
      if(value && value[field] !== undefined && value[field] !== null && Number.isFinite(n)) box[field] = Math.round(n * 1000) / 1000;
    }
    return box;
  }
  const sameBox = (a, b) => FIELDS.every(field => a[field] === b[field]);
  const formatBox = box => '{' + FIELDS.filter(field => box[field] !== undefined).map(field => `"${field}":${box[field]}`).join(',') + '}';

  // The map in its canonical shape: only buckets with boxes, sorted, each box reduced to its fields.
  function canonical(map){
    const out = {};
    for(const bucket of Object.keys(map).sort()){
      const keys = Object.keys(map[bucket]).sort();
      if(!keys.length) continue;
      out[bucket] = Object.fromEntries(keys.map(key => [key, pickBox(map[bucket][key])]));
    }
    return out;
  }

  // Canonical text for a { bucket: { key: box } } map.
  function serialize(map){
    const shaped = canonical(map);
    const body = Object.keys(shaped).map(bucket => {
      const lines = Object.keys(shaped[bucket]).map(key => `  ${JSON.stringify(key)}: ${formatBox(shaped[bucket][key])}`);
      return `${JSON.stringify(bucket)}: {\n${lines.join(',\n')}\n}`;
    }).join(',\n');
    return `${HEADER}\n${MARKER}{\n${body}\n};\n`;
  }

  // Reads the map back out of a file written by serialize(), without evaluating it (the page's
  // content security policy has no eval, and a data file should not need one).
  function parse(text){
    const start = text.indexOf(MARKER);
    if(start < 0) throw new Error('Not a calibration defaults file.');
    return JSON.parse(text.slice(start + MARKER.length).replace(/;\s*$/, ''));
  }

  // The boxes to write: what the page holds now (browser edits over the shipped defaults), minus
  // boxes that a rule produces and nobody changed.
  function collect(){
    const live = (typeof State !== 'undefined' && State.calib?.byUniform) || {};
    const defaults = typeof DEFAULT_CALIBRATION_BY_UNIFORM !== 'undefined' ? DEFAULT_CALIBRATION_BY_UNIFORM : {};
    const fromFile = window.CAPUB_CALIBRATION_DEFAULTS || {};
    const out = {};
    for(const bucket of new Set([...Object.keys(defaults), ...Object.keys(live)])){
      for(const key of new Set([...Object.keys(defaults[bucket] || {}), ...Object.keys(live[bucket] || {})])){
        const value = live[bucket]?.[key] || defaults[bucket]?.[key];
        if(!value) continue;
        const box = pickBox(value);
        if(!Object.keys(box).length) continue;
        const ruleBox = !fromFile[bucket]?.[key] && defaults[bucket]?.[key];
        if(ruleBox && sameBox(pickBox(ruleBox), box)) continue;
        (out[bucket] ||= {})[key] = box;
      }
    }
    return out;
  }

  // The folder handle is kept in IndexedDB so the picker only appears once per browser.
  function idb(){
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('capub-calibration-save', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('handles');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
  }
  async function remembered(){
    try{
      const db = await idb();
      return await new Promise(resolve => { const get = db.transaction('handles').objectStore('handles').get('repo'); get.onsuccess = () => resolve(get.result || null); get.onerror = () => resolve(null); });
    }catch(_){ return null; }
  }
  async function remember(handle){
    try{
      const db = await idb();
      await new Promise(resolve => { const put = db.transaction('handles', 'readwrite').objectStore('handles').put(handle, 'repo'); put.onsuccess = resolve; put.onerror = resolve; });
    }catch(_){ /* the picker will simply appear next time */ }
  }
  async function repoFolder(){
    const saved = await remembered();
    if(saved){
      if(await saved.queryPermission({mode:'readwrite'}) === 'granted') return saved;
      if(await saved.requestPermission({mode:'readwrite'}) === 'granted') return saved;
    }
    const picked = await window.showDirectoryPicker({id:'capub-repo', mode:'readwrite'});
    await remember(picked);
    return picked;
  }

  function download(text){
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], {type:'text/javascript'}));
    link.download = 'calibration-defaults.js';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function save(){
    const map = collect();
    const text = serialize(map);
    // Check what is about to be written before it replaces anything.
    if(JSON.stringify(parse(text)) !== JSON.stringify(canonical(map))) throw new Error('The file did not read back the same; nothing was written.');
    const count = Object.values(map).reduce((sum, boxes) => sum + Object.keys(boxes).length, 0);
    if(typeof window.showDirectoryPicker !== 'function'){
      download(text);
      return `This browser cannot write into a folder, so ${count} boxes were downloaded as calibration-defaults.js. Put it in the repository's data/ folder.`;
    }
    const root = await repoFolder();
    // The picked folder must be the repository root, not some other project.
    await root.getFileHandle('index.html');
    const dataDir = await root.getDirectoryHandle('data');
    const file = await dataDir.getFileHandle('calibration-defaults.js');
    const writable = await file.createWritable();
    await writable.write(text);
    await writable.close();
    return `Wrote ${count} boxes to data/calibration-defaults.js. Check it with git diff, then commit.`;
  }

  window.CAPUB_CALIBRATION_SAVE = { serialize, parse, collect, save };

  if(typeof document !== 'undefined'){
    const wire = () => {
      const button = document.getElementById('calibSaveRepo');
      const status = document.getElementById('calibSaveStatus');
      if(!button) return;
      button.addEventListener('click', async () => {
        button.disabled = true;
        if(status) status.textContent = 'Saving...';
        try{ if(status) status.textContent = await save(); }
        catch(error){ if(status) status.textContent = error?.name === 'AbortError' ? 'Cancelled.' : `Not saved: ${error?.message || error}`; }
        button.disabled = false;
      });
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  }
})();
