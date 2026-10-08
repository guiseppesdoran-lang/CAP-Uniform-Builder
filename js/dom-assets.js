// Extracted verbatim from index.html: DOM shortcuts, year autofill and the asset path helpers.

/* ===========================
   DOM SHORTCUTS
   =========================== */
const $ = s => document.querySelector(s);
const by = id => document.getElementById(id);

const layoutShell      = by('layoutShell');
const hamburgerBtn     = by('hamburgerBtn');
const uniformCanvas    = by('uniformCanvas');
const assetsContainer  = by('assets');
const uniformListEl    = by('uniformList');

const membershipTypeEl = by('membershipType');
const rankSetupSelect  = by('rankSetupSelect');
const cadetFirstSergeantBlock = by('cadetFirstSergeantBlock');
const cadetFirstSergeantCheckbox = by('cadetFirstSergeantCheckbox');
const jacketSelect     = by('jacketSelect');
const garmentOverlaySelect = by('garmentOverlaySelect');
const garmentMaskSide = by('garmentMaskSide');
const editGarmentMaskBtn = by('editGarmentMaskBtn');
const resetGarmentMaskBtn = by('resetGarmentMaskBtn');
const garmentMaskEditorControls = by('garmentMaskEditorControls');
const undoGarmentMaskBtn = by('undoGarmentMaskBtn');
const saveGarmentMaskBtn = by('saveGarmentMaskBtn');
const cancelGarmentMaskBtn = by('cancelGarmentMaskBtn');
const garmentMaskStatus = by('garmentMaskStatus');
const assetBaseInput   = by('assetBase'); // removed from general UI; may be null

const genderBlock      = by('genderBlock');
const uniformBlock     = by('uniformBlock');

/* ===========================
   YEAR AUTOFILL
   =========================== */
(function setYears(){
  const y = new Date().getFullYear();
  const sidebarYear = by('sidebarYear');
  const footerYear  = by('footerYear');
  if(sidebarYear) sidebarYear.textContent = y;
  if(footerYear)  footerYear.textContent  = y;
})();

/* ===========================
   ASSET PATH HELPER
   =========================== */
function normalizeAssetSubpath(p){
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .replace(/^images\//i, '');
}
// Escape text before it goes into an HTML template string. Use it for every value that is not
// a compile-time constant (ids, labels, anything that came from saved or imported data).
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function ASSET(p){
  const b=(State.assetBase||'images').replace(/\\/g,'/').replace(/\/$/,'');
  const sub = normalizeAssetSubpath(p);
  // Encode each path segment without encoding slash separators. This fixes
  // filenames containing spaces, #, %, apostrophes, and other URL characters.
  const safeSub = sub.split('/').map(seg => encodeURIComponent(decodeURIComponent(seg))).join('/');
  return `${b}/${safeSub}`;
}

/* ===========================
   GLOBAL IMAGE PATH RESOLVER
   ===========================
   Every image now gets the same retry behavior. Previously only a few asset
   types (mainly badges and shoulder cords) had fallbacks, while jackets,
   ribbons, ranks, patches, devices, medals, and gallery thumbnails failed
   after one exact path returned 404.
*/
// Extensions the asset resolver will probe, in order. Every miss costs a real
// 404, so this list only contains formats actually present under images/:
// png dominates, then webp, with a handful of jpg/jpeg. There are no svg
// assets in the repo, and probing for them generated a 404 for every rank and
// utility badge that fell through the chain.
const CAPUB_IMAGE_EXTENSIONS = ['png','webp','jpg','jpeg'];
const CAPUB_ASSET_SPELLING_ALIASES = Object.freeze({
  'achievment':'achievement',
  'comendation':'commendation',
  'commanders_comendation':'commanders_commendation',
  'bridgadier':'brigadier',
  'technicianibadge':'technician_badge'
});

function capubDecodeAssetUrl(url){
  try { return decodeURIComponent(String(url || '')); }
  catch (_) { return String(url || ''); }
}
function capubAssetRelativeFromUrl(url){
  const decoded = capubDecodeAssetUrl(url).replace(/\\/g,'/').split(/[?#]/)[0];
  const base = String(State.assetBase || 'images').replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\//,'').replace(/\/$/,'');
  const marker = `/${base}/`;
  const markerIndex = decoded.toLowerCase().indexOf(marker.toLowerCase());
  if(markerIndex >= 0) return normalizeAssetSubpath(decoded.slice(markerIndex + marker.length));
  const relativeIndex = decoded.toLowerCase().indexOf(`${base.toLowerCase()}/`);
  if(relativeIndex >= 0) return normalizeAssetSubpath(decoded.slice(relativeIndex + base.length + 1));
  return normalizeAssetSubpath(decoded);
}
function capubPushAssetCandidate(list, value){
  const clean = normalizeAssetSubpath(capubDecodeAssetUrl(value));
  if(clean && !list.includes(clean)) list.push(clean);
}
function capubReplaceExtension(path, ext){
  return String(path || '').replace(/\.(png|webp|jpg|jpeg|svg)$/i, '') + `.${ext}`;
}
function capubImagePathCandidates(path){
  const original = normalizeAssetSubpath(path);
  const candidates = [];
  capubPushAssetCandidate(candidates, original);

  // Try all supported extensions while preserving the requested filename.
  CAPUB_IMAGE_EXTENSIONS.forEach(ext => capubPushAssetCandidate(candidates, capubReplaceExtension(original, ext)));

  const slash = original.lastIndexOf('/');
  const folder = slash >= 0 ? original.slice(0, slash) : '';
  const file = slash >= 0 ? original.slice(slash + 1) : original;
  const stem = file.replace(/\.(png|webp|jpg|jpeg|svg)$/i, '');
  const variants = new Set([
    stem,
    stem.toLowerCase(),
    stem.replace(/\s+/g,'_'),
    stem.replace(/[-\s]+/g,'_').toLowerCase(),
    stem.replace(/[_\s]+/g,'-').toLowerCase(),
    stem.replace(/[_-]+/g,' ')
  ]);

  // Correct known misspellings that exist in older program IDs/path maps.
  for(const [wrong,right] of Object.entries(CAPUB_ASSET_SPELLING_ALIASES)){
    [...variants].forEach(v => {
      if(v.toLowerCase().includes(wrong)) variants.add(v.replace(new RegExp(wrong,'ig'), right));
    });
  }

  variants.forEach(v => CAPUB_IMAGE_EXTENSIONS.forEach(ext => {
    capubPushAssetCandidate(candidates, `${folder ? folder + '/' : ''}${v}.${ext}`);
  }));

  // Utility badge folders have appeared in both layouts in prior asset packs.
  if(/^badges\//i.test(original) && !/^badges\/utility\//i.test(original)){
    candidates.slice().forEach(v => capubPushAssetCandidate(candidates, v.replace(/^badges\//i,'badges/utility/')));
  } else if(/^badges\/utility\//i.test(original)){
    candidates.slice().forEach(v => capubPushAssetCandidate(candidates, v.replace(/^badges\/utility\//i,'badges/')));
  }

  return candidates;
}
function capubInstallImageFallback(img, paths){
  if(!img) return img;
  const expanded = [];
  (Array.isArray(paths) ? paths : [paths]).filter(Boolean).forEach(p => {
    capubImagePathCandidates(p).forEach(c => capubPushAssetCandidate(expanded, c));
  });
  img.__capubAssetCandidates = expanded;
  img.__capubAssetCandidateIndex = 0;
  img.onerror = function(){
    const list = this.__capubAssetCandidates || [];
    const next = ++this.__capubAssetCandidateIndex;
    if(next < list.length){
      this.src = ASSET(list[next]);
      return;
    }
    this.dataset.missing = 'true';
    const requested = list[0] || capubAssetRelativeFromUrl(this.src);
    window.CAPUB_RUNTIME_MISSING_ASSETS = window.CAPUB_RUNTIME_MISSING_ASSETS || new Set();
    window.CAPUB_RUNTIME_MISSING_ASSETS.add(requested);
    console.warn('[CAPUB IMAGE MISSING]', requested, 'Tried:', list);
  };
  if(expanded.length) img.src = ASSET(expanded[0]);
  return img;
}

// Catch image elements created by legacy code or gallery HTML strings. This
// makes the resolver apply to every image type without requiring each renderer
// to implement its own one-off onerror handler.
window.addEventListener('error', function capubGlobalImageError(event){
  const img = event.target;
  if(!(img instanceof HTMLImageElement) || img.__capubGlobalRetryActive) return;
  const relative = capubAssetRelativeFromUrl(img.getAttribute('src') || img.src);
  if(!relative) return;
  img.__capubGlobalRetryActive = true;
  capubInstallImageFallback(img, relative);
}, true);
