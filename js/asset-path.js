/* js/asset-paths.js
   Robust image URL resolver for the CAP Uniform Builder.
   - Accepts absolute URLs, data/blob URLs → returns as-is
   - Normalizes relative paths against a configurable base (default "images")
   - Strips duplicate prefixes and "./", tolerates inputs already starting with "images/"
   - Logs 404s; retries lowercase path and flipped extension case once
*/

(function(){
  const DEF_BASE = "images";
  let currentBase = DEF_BASE.replace(/\/+$/,"");

  function setBase(base) {
    if (!base) return;
    currentBase = String(base).trim().replace(/\/+$/,"") || DEF_BASE;
  }

  function isAbsolute(p) {
    return /^([a-z][a-z0-9+\-.]*:)?\/\//i.test(p) || /^data:/.test(p) || /^blob:/.test(p);
  }

  function cleanPath(p) {
    let x = String(p || "").trim()
      .replace(/^\.\//, "")      // remove leading "./"
      .replace(/\/{2,}/g, "/");  // collapse //
    x = x.replace(/^images\//i, ""); // drop one leading "images/"
    return x;
  }

  function join(base, rel) {
    const b = (base || currentBase || DEF_BASE).replace(/\/+$/,"");
    const r = String(rel || "").replace(/^\/+/, "");
    return b ? `${b}/${r}` : r;
  }

  function url(baseOrState, path) {
    if (!path) return "";
    const base = (typeof baseOrState === "string")
      ? baseOrState
      : (baseOrState && baseOrState.assetBase) || currentBase;

    if (isAbsolute(path)) return path;

    let clean = cleanPath(path);
    let out = join(base, clean);
    out = out.replace(/(^|\/)(images\/){2,}/i, "$1images/"); // fix "images/images/"
    return out;
  }

  // auto 404 diagnostics & one-time fallbacks
  function attachImageErrorLogging() {
    document.addEventListener("error", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLImageElement)) return;

      // Only retry once
      if (t.dataset._retryOnce === "1") {
        console.warn("[ASSET 404]", t.getAttribute("data-original-src") || t.src);
        return;
      }
      t.dataset._retryOnce = "1";
      const original = t.getAttribute("data-original-src") || t.src;

      const lowerSrc = original.replace(/\/([^\/]+)(?=\/|$)/g, (_, seg) => "/" + seg.toLowerCase());
      if (lowerSrc !== original) {
        t.src = lowerSrc;
        return;
      }

      const flipExt = (s) => s.replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, (m) =>
        m.toLowerCase() === ".png"  ? ".PNG"  :
        m.toLowerCase() === ".jpg"  ? ".JPG"  :
        m.toLowerCase() === ".jpeg" ? ".JPEG" :
        m.toLowerCase() === ".webp" ? ".WEBP" :
        m.toLowerCase() === ".gif"  ? ".GIF"  :
        m.toLowerCase() === ".svg"  ? ".SVG"  : m
      );
      const alt = flipExt(original);
      if (alt !== original) {
        t.src = alt;
        return;
      }

      console.warn("[ASSET 404]", original);
    }, true);
  }

  attachImageErrorLogging();

  window.AssetPath = { setBase, url };
})();
