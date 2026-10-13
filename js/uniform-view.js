// The uniform preview: turns the page state into a build for the uniform engine (js/engine/*),
// draws the composed scene as one <svg> inside #uniformCanvas, and exports it as a PNG.
//
// Everything placed on the uniform comes from the engine's regulation rules and the artwork's own
// anchors; there is no per-uniform pixel calibration.
(function(){
  'use strict';
  const E = window.CAPUBEngine;
  let store = null;
  let manifestPromise = null;
  let renderSeq = 0;
  let lastScene = null;
  let lastSvg = null;

  function getStore(){
    if(store) return Promise.resolve(store);
    if(!manifestPromise){
      // Artwork is updated in place, so the manifest and specs are revalidated (a 304 when unchanged).
      manifestPromise = fetch(ASSET('MANIFEST.json'), { cache: 'no-cache' })
        .then(r => { if(!r.ok) throw new Error('MANIFEST.json ' + r.status); return r.json(); })
        .then(manifest => {
          store = E.core.createSpecStore(manifest, path => fetch(ASSET(path), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null));
          return store;
        });
    }
    return manifestPromise;
  }

  // ---- state -> build ---------------------------------------------------------------------

  // Options for the garment itself (sleeve length, skirt, headgear...). Defaults per uniform.
  const GARMENT_DEFAULTS = {
    sleeve: 'short', femaleTop: 'shirt', underlayer: 'shirt', skirt: 'a-line', headgear: 'auto',
    chevron: '', scarf: false, jacket: false, esPatch: 'none', noGradeTrack: 'officer', plateGrade: true
  };
  function garmentOptions(){
    const g = Object.assign({}, GARMENT_DEFAULTS, State.garment || {});
    return g;
  }

  const RIBBON_DEVICE_IDS = {
    BRONZE_OLC: 'mil-device-olc-bronze', SILVER_OLC: 'mil-device-olc-silver',
    BRONZE_SERVICE_STAR: 'device-star-bronze', SILVER_SERVICE_STAR: 'device-star-silver',
    GOLD_AWARD_STAR: 'device-star-gold', SILVER_AWARD_STAR: 'device-star-silver',
    V_DEVICE: 'device-v', C_DEVICE: 'mil-device-letter-c', R_DEVICE: 'mil-device-letter-r',
    M_DEVICE: 'mil-device-letter-m', N_DEVICE: 'mil-device-letter-n',
    BRONZE_HOURGLASS: 'mil-device-hourglass-bronze', SILVER_HOURGLASS: 'mil-device-hourglass-silver',
    GOLD_HOURGLASS: 'mil-device-hourglass-gold', ARROWHEAD_DEVICE: 'mil-device-arrowhead'
  };
  function militaryDeviceAsset(id){
    if(RIBBON_DEVICE_IDS[id]) return RIBBON_DEVICE_IDS[id];
    const m = /^NUMERAL_(\d+)$/.exec(id);
    return m ? 'mil-device-numeral-' + Number(m[1]) : null;
  }

  function ribbonAssetId(id){ return 'ribbon-' + String(id).replace(/_/g, '-'); }

  // The ribbons to wear, in precedence order, each split into the ribbons its devices need.
  function buildRibbons(){
    const out = [];
    const seen = new Set();
    const ordered = typeof sortRibbons === 'function' ? sortRibbons(State.ribbons || []) : (State.ribbons || []);
    for(const inst of ordered){
      const id = inst.id;
      if(isMilitaryRibbonId(id)){
        const award = getMilitaryRibbonAward(id);
        const href = award?.images?.ribbon ? ASSET(award.images.ribbon) : null;
        const devices = (inst.militaryDevices || []).map(militaryDeviceAsset).filter(Boolean);
        out.push({ key: `ribbon:${id}#${out.length}`, title: getRibbonDisplayName(id), raster: href, devices, centered: false, military: true });
        continue;
      }
      if(seen.has(id)) continue; // the engine makes the extra ribbons itself
      seen.add(id);
      const sel = Object.assign({}, State.ribbonSelections?.[id] || {}, { awardValue: inst.awardValue, awardLabel: inst.awardLabel, membership: State.membership });
      if(sel.awardValue && /_duplicate_/.test(sel.awardValue)) continue;
      const parts = CAPUBRibbonAwards.resolve(id, sel);
      parts.forEach((p, i) => out.push({
        key: i ? `ribbon:${id}#${i}` : `ribbon:${id}`,
        id,
        title: getRibbonDisplayName(id) + (i ? ' (additional ribbon)' : ''),
        asset: ribbonAssetId(id),
        devices: p.devices,
        centered: p.centered
      }));
    }
    return out;
  }

  function buildMedals(ribbons){
    return ribbons.map(r => {
      if(r.military){
        const award = getMilitaryRibbonAward(r.key.replace(/^ribbon:|#\d+$/g, ''));
        const rep = window.CAPUBMilitary?.getAwardRepresentation?.(award, 'MINIATURE_MEDAL');
        return { key: r.key.replace(/^ribbon:/, 'mini:'), title: r.title, raster: rep?.available && rep.asset ? ASSET(rep.asset) : null, devices: [] };
      }
      const base = r.asset.replace(/^ribbon-/, '');
      return { key: r.key.replace(/^ribbon:/, 'mini:'), title: r.title, ribbonAsset: r.asset, medal: `medal-${base}-miniature`, devices: r.devices };
    });
  }

  function buildBadges(){
    const ids = State.badges || [];
    const badges = [];
    let command = null;
    for(const id of ids){
      const title = typeof getBadgeWornName === 'function' ? getBadgeWornName(id) : id;
      if(typeof isCommandInsigniaBadge === 'function' ? isCommandInsigniaBadge(id) : /commander_badge$/.test(id)){
        if(!command) command = { id, title, graduated: !!State.commandInsignia?.graduatedCommander };
        continue;
      }
      badges.push({ id, title, level: State.badgeSelections?.[id]?.level || null });
    }
    return { badges, command };
  }

  function buildMilitaryBadges(){
    const out = [];
    if(!CAPUBUniformRules.isAwardAllowedOnUniform('', State.uniform, { isMilitary: true })) return out;
    for(const [id, sel] of Object.entries(State.militaryBadges || {})){
      if(!sel?.selected) continue;
      const badge = (window.CAPUBMilitaryData?.badges || []).find(b => b.id === id);
      if(!badge) continue;
      const rep = getMilitaryBadgeRepresentation(badge);
      if(!rep?.asset) continue;
      out.push({ id, title: badge.officialName || id, href: ASSET(rep.asset), family: String(badge.family || '').toUpperCase() });
    }
    return out;
  }

  function patchAspect(meta){
    const w = Number(meta?.w) || 1, h = Number(meta?.h) || 1;
    return w / h;
  }

  // The patches/ocp images are crops of the old sleeve drawing, not whole patches. The engine draws
  // the patch's full-colour artwork instead (the full patches are square images); a patch that
  // only exists as a crop is left off.
  const OCP_CROP_BASE = { 'TN-330_ocp_patch': 'patches/sequoyah_cadet_squadron_patch.webp' };
  function wholePatchImage(id, meta){
    const img = String(meta.img || '');
    if(!/(^|\/)ocp\//.test(img)) return img;
    const file = img.split('/').pop().replace(/\.webp$/, '');
    if(OCP_CROP_BASE[file]) return OCP_CROP_BASE[file];
    const baseId = String(id).replace(/_ocp_patch$/, '_patch');
    return baseId !== id && PATCH_META[baseId] && PATCH_META[baseId].img && !/\/ocp\//.test(PATCH_META[baseId].img) ? PATCH_META[baseId].img : null;
  }

  let patchNotes = [];
  function buildPatches(){
    const out = [];
    patchNotes = [];
    const add = (id, kind) => {
      const resolved = typeof window.capubResolvePatchIdForUniform === 'function' ? window.capubResolvePatchIdForUniform(id, State.uniform) : id;
      const meta = PATCH_META[resolved] || PATCH_META[id];
      if(!meta || !meta.img) return;
      if(typeof isPatchAuthorizedForUniform === 'function' && !isPatchAuthorizedForUniform(resolved)) return;
      if(out.some(p => p.id === resolved)) return;
      const img = wholePatchImage(resolved, meta);
      if(!img){ patchNotes.push(`${meta.label || resolved} has no full patch artwork yet, so it is not shown`); return; }
      out.push({ id: resolved, title: meta.label || resolved, href: ASSET(img), aspect: img === meta.img ? patchAspect(meta) : 1, slot: kind === 'unit' ? 'R_SHOULDER' : (meta.slotHint || 'L_SHOULDER'), kind });
    };
    const unit = typeof getSelectedUnitPatchId === 'function' ? getSelectedUnitPatchId() : null;
    if(unit) add(unit, 'unit');
    (State.patches || []).forEach(id => add(id, 'general'));
    return out;
  }

  // Class A rack options (11.2.7): automatic (rows of three, upper rows kept clear of the lapel
  // as Figure 11-1 allows), or a fixed width: three across, four aligned with the wearer's left
  // edge, or four centred; or the member's own row counts.
  function rackOptions(){
    const layout = String(State.ribbonRackLayout || '3');
    const automatic = State.ribbonRackArrangement !== 'standard';
    const custom = State.uniform === 'blues_a' && State.ribbonRowOverrideEnabled && Array.isArray(State.ribbonRowOverride) && State.ribbonRowOverride.length;
    if(custom) return { rackColumns: 4, rackArrangement: 'standard', rackCounts: [...State.ribbonRowOverride].reverse() };
    if(automatic) return { rackColumns: 3, rackArrangement: 'lapel', rackCounts: null };
    return {
      rackColumns: layout === '3' ? 3 : 4,
      rackAlign: layout === '4-left' ? 'outboard' : undefined,
      rackArrangement: 'standard',
      rackCounts: null
    };
  }

  // Ribbons per row in the last drawing, top row first (for the custom row controls).
  function rackRowCounts(){
    if(!lastScene) return [];
    const rows = new Map();
    for(const l of lastScene.layers){
      if(l.role !== 'ribbon') continue;
      const y = l.y.toFixed(3);
      rows.set(y, (rows.get(y) || 0) + 1);
    }
    return [...rows.keys()].sort((a, b) => a - b).map(y => rows.get(y));
  }

  function buildFromState(){
    const opt = garmentOptions();
    const g = E.grades.gradeInfo(State.membership, State.rank, { firstSergeant: !!State.cadetFirstSergeant, track: opt.noGradeTrack });
    const ribbons = CAPUBUniformRules.allowsRibbons(State.uniform) ? buildRibbons() : [];
    const mini = CAPUBUniformRules.allowsMiniMedals(State.uniform);
    const allRibbons = mini ? buildRibbons() : ribbons;
    const { badges, command } = buildBadges();
    const text = State.text || {};
    return {
      uniform: State.uniform,
      gender: State.gender === 'female' ? 'female' : 'male',
      membership: State.membership,
      grade: g,
      opt: Object.assign(opt, rackOptions(), {
        miniStyle: State.miniMountStyle === 'holding' ? 'holding' : 'mounting'
      }),
      name: { first: text.firstName || '', last: text.lastName || '', state: text.plateLine || '', capTape: text.capTape || 'CIVIL AIR PATROL', show: text.show !== false },
      ribbons: mini ? [] : ribbons,
      medals: mini ? buildMedals(allRibbons) : [],
      badges,
      command,
      militaryBadges: buildMilitaryBadges(),
      patches: buildPatches(),
      cord: CAPUBUniformRules.allowsShoulderCord(State.uniform, State.membership) ? (State.shoulderCord || null) : null
    };
  }

  // ---- render ---------------------------------------------------------------------------------

  function canvasEl(){ return document.getElementById('uniformCanvas'); }

  async function render(){
    const seq = ++renderSeq;
    const host = canvasEl();
    if(!host) return null;
    if(!State.membership || !State.gender || !State.rank || !CAPUBEngine.profiles.PROFILES[State.uniform]){
      host.querySelectorAll('svg.uniformSvg').forEach(n => n.remove());
      lastScene = null; lastSvg = null;
      return null;
    }
    try{
      const s = await getStore();
      const build = buildFromState();
      const scene = await E.profiles.composeUniform(build, s);
      patchNotes.forEach(n => { if(!scene.notes.includes(n)) scene.notes.push(n); });
      if(seq !== renderSeq) return null; // a newer render started
      const svg = await E.renderSvg.buildSvg(scene, id => s.entry(id).path, { pad: 0.4 });
      if(seq !== renderSeq) return null;
      host.querySelectorAll('svg.uniformSvg, .layer').forEach(n => n.remove());
      sizeStage(svg);
      host.appendChild(svg);
      lastScene = scene; lastSvg = svg;
      host.dataset.rendered = String(seq);
      document.dispatchEvent(new CustomEvent('capub:rendered', { detail: { scene } }));
      return scene;
    }catch(err){
      console.error('[uniform] render failed', err);
      if(typeof capubNotify === 'function' && seq === renderSeq) capubNotify('The uniform could not be drawn. Try another selection or reload the page.');
      return null;
    }
  }

  // The preview stage takes the drawing's proportions at a fixed height, so a wide field uniform
  // sheet and a tall coat both fill it; the zoom control then fits the stage to the window.
  const STAGE_HEIGHT = 640;
  function sizeStage(svg){
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const w = Math.round(Math.min(1200, Math.max(360, STAGE_HEIGHT * vb[2] / vb[3])));
    for(const node of [document.getElementById('previewArea'), canvasEl()]){
      if(!node) continue;
      node.style.width = w + 'px';
      node.style.height = STAGE_HEIGHT + 'px';
      node.dataset.renderWidth = String(w);
      node.dataset.renderHeight = String(STAGE_HEIGHT);
    }
  }

  // Coalesce bursts of changes into one render per frame. The timer is the fallback for hidden
  // tabs, where the browser pauses animation frames.
  let pending = null;
  function scheduleRender(){
    if(pending) return pending;
    pending = new Promise(resolve => {
      let ran = false;
      const run = () => { if(ran) return; ran = true; pending = null; resolve(render()); };
      requestAnimationFrame(run);
      setTimeout(run, 100);
    });
    return pending;
  }

  // PNG export: the same SVG rasterized at `ppi` pixels per inch (default 60, a ~1500 px wide coat).
  async function exportCanvas(ppi){
    if(!lastSvg) await render();
    if(!lastSvg) return null;
    const vb = lastSvg.getAttribute('viewBox').split(/\s+/).map(Number);
    return E.renderSvg.svgToCanvas(lastSvg, vb[2] * (ppi || 60));
  }

  // ---- Ribbon picker: what a selection puts on the ribbon -------------------------------------

  // "device-clasp-bronze" -> "bronze clasp"; "device-years-25" -> "25-year numeral".
  function deviceWords(id){
    let m;
    if((m = /^device-years-(\d+)$/.exec(id))) return `${m[1]}-year numeral`;
    if((m = /^device-(clasp|star|propeller)-(bronze|silver|gold)$/.exec(id))) return m[1] === 'propeller' ? 'propeller' : `${m[2]} ${m[1]}`;
    if(id === 'device-v') return 'silver V';
    if((m = /^mil-device-(.+)$/.exec(id))) return m[1].replace(/-/g, ' ');
    return id.replace(/^device-/, '').replace(/-/g, ' ');
  }
  function countWords(ids){
    const counts = new Map();
    ids.forEach(id => counts.set(deviceWords(id), (counts.get(deviceWords(id)) || 0) + 1));
    return [...counts].map(([w, n]) => n > 1 ? `${n} ${w.replace(/([^s])$/, '$1s')}` : `1 ${w}`).join(', ');
  }
  // One line for the ribbon picker, from the same rule the uniform uses (data/ribbon-awards.js).
  function describeRibbon(id, sel){
    const parts = CAPUBRibbonAwards.resolve(id, Object.assign({ membership: State.membership }, sel));
    const say = p => p.devices.length ? countWords(p.devices) : 'no devices';
    if(parts.length === 1) return parts[0].devices.length ? `Devices: ${say(parts[0])}` : 'Basic ribbon, no devices';
    return parts.map((p, i) => `Ribbon ${i + 1}: ${say(p)}`).join('; ');
  }
  // The ribbon (and any extra ribbons the devices need) drawn by the engine with its devices.
  async function ribbonPreview(id, sel){
    const s = await getStore();
    const parts = CAPUBRibbonAwards.resolve(id, Object.assign({ membership: State.membership }, sel));
    const items = parts.map((p, i) => ({ key: `ribbon:${id}#${i}`, title: id, asset: ribbonAssetId(id), devices: p.devices, centered: p.centered }));
    const ctx = E.compose.createContext({}, s);
    await E.compose.drawRack(ctx, items, { centerX: 0, bottomY: 0 }, { perRow: Math.min(3, items.length) });
    const scene = E.compose.finish(ctx, id);
    if(!scene.layers.length) return null;
    const svg = await E.renderSvg.buildSvg(scene, aid => s.entry(aid).path, { pad: 0.02 });
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.classList.add('ribbonPreviewSvg');
    return svg;
  }
  // Swap a picker tile's <img> for the drawn ribbon; the plain image stays if anything fails.
  function fillRibbonPreview(img, id, sel){
    if(!img) return;
    ribbonPreview(id, sel).then(svg => {
      if(!svg || !img.isConnected) return;
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', img.getAttribute('alt') || id);
      img.replaceWith(svg);
    }).catch(() => {});
  }

  window.CAPUBUniformView = {
    render, scheduleRender, exportCanvas, buildFromState, rackRowCounts, describeRibbon, ribbonPreview, fillRibbonPreview,
    get scene(){ return lastScene; },
    get svg(){ return lastSvg; },
    GARMENT_DEFAULTS
  };
})();
