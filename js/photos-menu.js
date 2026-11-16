// The Photos menu of the last step: a picture tile for the whole uniform and for each part of it the build has (the ribbon rack, a side of the chest, the collar and
// shoulders, the headgear, a sleeve or pocket with a patch, the cord). Each tile is a small live picture of that part of the member's own uniform, and pressing it
// downloads the part as a PNG. The parts and their boxes come from the engine (js/engine/parts.js, worked out from the drawing in js/uniform-view.js); a part the build
// does not have is not offered. The whole uniform is the page's own download (the Download picture button), pressed from here, so it is the same picture and the same file.
//
// The tiles are the picture picker's (js/visual-picker.js, action mode). They are drawn when the member is on the step, and again a moment after the drawing changes.
(function(){
  'use strict';
  const TILE_PX = 360;          // the width a tile's picture is drawn at; it is a vector picture, scaled to the tile
  const REFRESH_MS = 450;       // after the drawing changes, wait for it to settle before drawing the tiles again

  const by = id => document.getElementById(id);
  const E = () => window.CAPUBEngine;
  const view = () => window.CAPUBUniformView;

  let picker = null;
  let urls = [];                // the object URLs of the tile pictures, let go when the tiles are drawn again
  let token = 0;                // a newer drawing of the tiles makes an older one stop
  let timer = null;
  let dirty = true;             // the drawing changed since the tiles were made
  let working = false;          // a picture is being made

  const visible = node => !!node && node.getClientRects().length > 0;

  // A picture of an <svg> to put in a tile: the drawing as a stand-alone image, its font carried inside, at TILE_PX wide.
  async function svgUrl(svg, made){
    const copy = svg.cloneNode(true);
    await E().renderSvg.embedFonts(copy);
    const vb = copy.getAttribute('viewBox').split(/\s+/).map(Number);
    copy.setAttribute('width', String(TILE_PX));
    copy.setAttribute('height', String(Math.max(1, Math.round(TILE_PX * vb[3] / vb[2]))));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
    made.push(url);
    return url;
  }

  const WHOLE = { value: 'whole', label: 'Whole uniform' };

  // A picture is loaded and decoded before its tile shows it, so a tile does not appear empty (its lettering, in the font carried inside, arrives with the picture).
  function ready(url){
    if(typeof Image !== 'function') return Promise.resolve();
    return new Promise(resolve => {
      const img = new Image();
      const done = () => resolve();
      img.onload = () => (typeof img.decode === 'function' ? img.decode().then(done, done) : done());
      img.onerror = done;
      img.src = url;
      setTimeout(done, 4000);
    });
  }

  // The tiles for a drawing: the whole uniform first, then each part the engine found in it, each with its own picture.
  // `made` collects the object URLs of the pictures, so the caller can let them go.
  async function optionsFor(h, made){
    const out = [];
    const whole = view().svg;
    out.push(Object.assign({}, WHOLE, whole ? { picture: await svgUrl(whole, made) } : {}));
    for(const part of h.plan.parts){
      out.push({ value: part.id, label: part.label, picture: await svgUrl(await view().partSvg(h, part), made) });
    }
    return out;
  }

  function setStatus(text){
    const node = by('photosMenuStatus');
    if(node && node.textContent !== text) node.textContent = text;
  }

  async function refresh(){
    const box = by('photosMenu'), host = by('photosMenuTiles');
    if(!box || !host || !view() || !E() || !E().parts || !window.VisualPicker) return;
    const mine = ++token;
    dirty = false;
    const made = [];
    let h = null, options = null;
    try{
      h = await view().parts();
      if(h && mine === token){
        options = await optionsFor(h, made);
        await Promise.all(made.map(ready));
      }
    }catch(err){
      console.error('PHOTOS MENU ERROR:', err);
    }
    if(mine !== token || !h || !options){
      // A newer drawing of the tiles took over, or there is nothing to show.
      made.forEach(u => URL.revokeObjectURL(u));
      if(mine === token) box.hidden = true;
      return;
    }
    const old = urls;
    urls = made;
    if(!picker){
      picker = window.VisualPicker.render(host, { mode: 'action', name: 'photos', size: 'large', labelledBy: 'photosMenuLabel', options, onAction: act });
    }else{
      picker.setOptions(options);
    }
    box.hidden = false;
    old.forEach(u => URL.revokeObjectURL(u));
  }

  function download(canvas, fileName){
    return new Promise((resolve, reject) => {
      const give = href => {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = href;
        document.body.appendChild(link);
        link.click();
        link.remove();
      };
      if(typeof canvas.toBlob !== 'function'){ give(canvas.toDataURL('image/png')); resolve(); return; }
      canvas.toBlob(blob => {
        if(!blob){ reject(new Error('The picture could not be saved.')); return; }
        const href = URL.createObjectURL(blob);
        give(href);
        setTimeout(() => URL.revokeObjectURL(href), 60000);
        resolve();
      }, 'image/png');
    });
  }

  // A tile was pressed.
  async function act(value){
    if(value === WHOLE.value){
      const button = by('downloadImage');
      if(button) button.click();
      return;
    }
    if(working) return;
    working = true;
    picker && picker.setBusy(value, true);
    const uniform = State.ceremonial ? 'honor_guard' : State.uniform;
    try{
      // The picture is of the drawing on screen now: if it changed since the tiles were made, its parts are found again.
      const now = await view().parts();
      const part = now && now.plan.parts.find(p => p.id === value);
      if(!part){
        refresh();
        throw new Error('That part is not on your uniform any more.');
      }
      const canvas = await view().exportPart(now, part);
      const fileName = CAPUBExportNames.exportFileName({ rank: State.rank, uniform, part: part.file }, 'png');
      await download(canvas, fileName);
      setStatus(`Downloaded ${fileName}.`);
      window.CAPUB_TELEMETRY?.track('png_download', { uniform: State.uniform, ok: true, part: part.id });
    }catch(err){
      window.CAPUB_TELEMETRY?.track('png_download', { uniform: State.uniform, ok: false, part: String(value) });
      console.error('PHOTO EXPORT ERROR:', err);
      setStatus('');
      if(typeof capubNotify === 'function') capubNotify(`The picture could not be made: ${err && err.message || err}`, 8000);
    }finally{
      working = false;
      picker && picker.setBusy(value, false);
    }
  }

  // The tiles follow the drawing, but only while the step is on screen: otherwise they wait until it is.
  function changed(){
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => { if(visible(by('finishPanel'))) refresh(); }, REFRESH_MS);
  }

  function init(){
    const panel = by('finishPanel');
    if(!panel || !by('photosMenu')) return;
    document.addEventListener('capub:rendered', changed);
    if(typeof IntersectionObserver === 'function'){
      new IntersectionObserver(entries => {
        if(entries.some(e => e.isIntersecting) && dirty) refresh();
      }).observe(panel);
    }else if(visible(panel)){
      refresh();
    }
  }

  window.CAPUBPhotos = { refresh, optionsFor, act };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
