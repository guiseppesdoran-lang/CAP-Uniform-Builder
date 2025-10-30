// js/badges.ui.js
// ES module that encapsulates all badge UI + rendering logic.
// It relies on small, explicit dependencies you pass in (state getters,
// canvas element, calibration registrar, and rack origin helpers).
//
// Usage example (in your main app bootstrap):
// import { createBadgesUI } from "./js/badges.ui.js";
// import * as BadgeData from "./js/badges.data.js";
// const badgesUI = createBadgesUI({
//   getState: () => State,
//   uniformCanvasEl: document.getElementById("uniformCanvas"),
//   registerCalibratable,
//   uiAuthzForUniform: (u) => UI_AUTHZ[u] || { showBadges: true },
//   getRackOrigin: () => ({ x: rackBaseX, y: rackBaseY }),
//   ribbonSize: { w: RIBBON_WIDTH, h: RIBBON_HEIGHT },
//   assetBaseResolver: (p) => ASSET(p) // optional fallback if a badge img isn't preloaded
// });
// badgesUI.init({
//   addBadgeSelect: document.getElementById("badgeSelect"),
//   addBadgeBtn: document.getElementById("addBadge"),
//   removeBadgeSelect: document.getElementById("removeBadgeSelect"),
//   removeBadgeBtn: document.getElementById("removeBadge")
// });
// badgesUI.render(); // whenever state changes

import {
  badgeList,
  allowedCadetBadges,
  exclusiveBadges,
  badgeLocations,
  customBadgeSizes
} from "./badges.data.js";

/**
 * Factory that returns a tiny controller for all badge-related UI & rendering.
 * @param {{
 *  getState: () => any,
 *  uniformCanvasEl: HTMLElement,
 *  registerCalibratable: (id:string, name:string, x:number, y:number, rot:number) => void,
 *  uiAuthzForUniform: (uniformId:string) => { showBadges:boolean },
 *  getRackOrigin: () => { x:number, y:number },
 *  ribbonSize: { w:number, h:number },
 *  assetBaseResolver?: (relPath:string) => string
 * }} deps
 */
export function createBadgesUI(deps){
  const {
    getState,
    uniformCanvasEl,
    registerCalibratable,
    uiAuthzForUniform,
    getRackOrigin,
    ribbonSize,
    assetBaseResolver
  } = deps;

  // Internal slot staging (mirrors your previous implementation)
  const badgeSlots = {
    OLPA:[], OLPU:[], OLP:[], ORP:[],
    ON:[], UN:[], LRP:[], LP:[],
    OVERSTACK:[]
  };

  const overRibbonSlots = new Set(["OLP","OLPU","OLPA","ORP"]);
  const SPACING = 5;

  /** Helpers **/
  const isCadetAuthorized = (id) => allowedCadetBadges.has(id);

  function resetBadgeSlots(){
    Object.keys(badgeSlots).forEach(k => badgeSlots[k] = []);
  }

  function enforceExclusive(newId, state){
    exclusiveBadges.forEach(pair=>{
      if(pair.includes(newId)){
        pair.forEach(conf=>{
          if(conf!==newId && state.badges.includes(conf)){
            state.badges = state.badges.filter(b => b !== conf);
          }
        });
      }
    });
  }

  function getTopRibbonY(){
    // Same heuristic as your app: if no ribbons present, return where they "would be".
    const layers = [...uniformCanvasEl.querySelectorAll(".layer.ribbonTile,.layer.ribbonMini")];
    if(!layers.length){
      const { y } = getRackOrigin();
      return y + 150;
    }
    return Math.min(...layers.map(l => parseFloat(l.style.top) || 0));
  }

  function rackCenterX(){
    // Center of a 3-wide rack: left origin + 1.5 * ribbon width.
    const { x } = getRackOrigin();
    return x + ribbonSize.w * 1.5;
  }

  function removeRenderedBadges(){
    [...uniformCanvasEl.querySelectorAll(".layer.badge")].forEach(n => n.remove());
  }

  function cloneBadgeImage(id){
    // Prefer preloaded <img id="badges-<id>">. If absent, fall back to assets resolver.
    const preloaded = document.getElementById(`badges-${id}`);
    if(preloaded){
      const node = preloaded.cloneNode();
      node.style.display = "block";
      return node;
    }
    if(assetBaseResolver){
      const fallback = new Image();
      fallback.src = assetBaseResolver(`badges/${id}.png`);
      fallback.style.display = "block";
      return fallback;
    }
    return null;
  }

  /**
   * Place one badge according to CAPR 39-1-derived rules in badgeLocations.
   * Registers each with the calibration system.
   */
  function placeBadgeByCategory(id, state){
    const img = cloneBadgeImage(id);
    if(!img) return;

    // Resolve slot, including special cases
    let slot = badgeLocations[id] || "UN";
    if(id === "nra_marksman_badge") slot = "LRP";
    if(id === "model_rocketry_badge") slot = "LP";

    const size = customBadgeSizes[id] || { width: 60, height: 25 };
    const baseRibbonY = getTopRibbonY();
    const centerX = rackCenterX();
    const { x: rackLeft } = getRackOrigin();

    // ---- Over rack (centered) slots ----
    if(overRibbonSlots.has(slot)){
      const stackIdx = badgeSlots.OVERSTACK.length;
      const bottomEdgeY = baseRibbonY - 25 - (stackIdx * (size.height + SPACING));
      const topY = bottomEdgeY - size.height;
      const leftX = centerX - (size.width / 2);

      const node = img;
      node.className = "layer badge";
      node.style.left = `${leftX}px`;
      node.style.top  = `${topY}px`;
      node.style.width  = `${size.width}px`;
      node.style.height = `${size.height}px`;

      node.dataset.tooltipTitle = id.replace(/_/g," ").toUpperCase();
      node.dataset.tooltipReg   = "Over-rack qualification badge";
      node.dataset.tooltipWhy   = "Centered 25px above top ribbon row.";

      const elId = `badge-${slot}-${stackIdx}`;
      node.id = elId;
      uniformCanvasEl.appendChild(node);

      badgeSlots.OVERSTACK.push(id);
      registerCalibratable(elId, `${slot} Badge ${stackIdx}`, leftX, topY, 0);
      return;
    }

    // ---- Pockets / name tag regions ----
    if(!badgeSlots[slot]) badgeSlots[slot] = [];

    // Mappings derived from your working layout
    const yMap = {
      ON:  baseRibbonY + 140,
      UN:  baseRibbonY + 180,
      LRP: baseRibbonY + 199,
      LP:  baseRibbonY + 244
    };
    const xMap = {
      ON:  rackLeft - 105,
      UN:  rackLeft - 105,
      LRP: rackLeft + (ribbonSize.w * 3) + 60,
      LP:  rackLeft + (ribbonSize.w * 3) + 80
    };

    let y = yMap[slot] !== undefined ? yMap[slot] : (baseRibbonY + 180);
    let x = xMap[slot] !== undefined ? xMap[slot] : (rackLeft - 105);

    // Stacking for ON / UN
    if(slot === "ON" || slot === "UN"){
      const stackIdx = badgeSlots[slot].length;
      for(let i=0;i<stackIdx;i++){
        const prev = badgeSlots[slot][i];
        const ps = customBadgeSizes[prev] || { height: 25 };
        y += ps.height + SPACING;
      }
    }

    // Interaction: model rocketry with NRA badge present
    if(id === "model_rocketry_badge" && state.badges.includes("nra_marksman_badge")){
      y += 50;
    }

    const node = img;
    node.className = "layer badge";
    node.style.left = `${x}px`;
    node.style.top  = `${y}px`;
    node.style.width  = `${size.width}px`;
    node.style.height = `${size.height}px`;

    node.dataset.tooltipTitle = id.replace(/_/g," ").toUpperCase();
    node.dataset.tooltipReg   = "CAPR 39-1 badge placement";
    node.dataset.tooltipWhy   = "Auto-placed relative to pockets / nameplate.";

    const stackPos = badgeSlots[slot].length;
    const elId = `badge-${slot}-${stackPos}`;
    node.id = elId;

    uniformCanvasEl.appendChild(node);
    badgeSlots[slot].push(id);

    registerCalibratable(elId, `${slot} Badge ${stackPos}`, x, y, 0);
  }

  /** Public rendering API **/
  function renderAllBadges(){
    const state = getState();
    removeRenderedBadges();
    resetBadgeSlots();

    if(!uiAuthzForUniform(state.uniform)?.showBadges) return;

    // Enforce cadet visibility / authorization
    if(state.member === "cadet"){
      state.badges = state.badges.filter(isCadetAuthorized);
    }

    const MAX_TOTAL = 5;
    let count = 0;

    for(const id of state.badges){
      if(state.member === "cadet" && !isCadetAuthorized(id)) continue;
      placeBadgeByCategory(id, state);
      count++;
      if(count >= MAX_TOTAL) break;
    }
  }

  /** UI helpers **/
  function populateRemoveDropdown(selectEl){
    const state = getState();
    if(!selectEl) return;
    selectEl.innerHTML = "";
    state.badges.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
      selectEl.appendChild(opt);
    });
  }

  function setBadgeOptions(selectEl){
    if(!selectEl) return;
    selectEl.innerHTML = "";
    badgeList.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase());
      selectEl.appendChild(opt);
    });
  }

  /** Public mutation API **/
  function addBadge(id){
    const state = getState();
    if(state.member === "cadet" && !isCadetAuthorized(id)){
      alert("This badge is not authorized for cadets.");
      return false;
    }
    enforceExclusive(id, state);
    if(!state.badges.includes(id)) state.badges.push(id);
    renderAllBadges();
    return true;
  }

  function removeBadge(id){
    const state = getState();
    state.badges = state.badges.filter(b => b !== id);
    renderAllBadges();
  }

  /** Wiring **/
  function init(selectors){
    const {
      addBadgeSelect,
      addBadgeBtn,
      removeBadgeSelect,
      removeBadgeBtn
    } = selectors || {};

    // Build selects
    setBadgeOptions(addBadgeSelect);
    populateRemoveDropdown(removeBadgeSelect);

    // Wire buttons
    if(addBadgeBtn && addBadgeSelect){
      addBadgeBtn.addEventListener("click", () => {
        const id = addBadgeSelect.value;
        const ok = addBadge(id);
        if(ok) populateRemoveDropdown(removeBadgeSelect);
      });
    }

    if(removeBadgeBtn && removeBadgeSelect){
      removeBadgeBtn.addEventListener("click", () => {
        const id = removeBadgeSelect.value;
        removeBadge(id);
        populateRemoveDropdown(removeBadgeSelect);
      });
    }
  }

  /** Public API surface **/
  return {
    init,
    render: renderAllBadges,
    addBadge,
    removeBadge,
    populateRemoveDropdown,
    setBadgeOptions,
  };
}

