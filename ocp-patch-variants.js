/* OCP patch variants and selection fix.
 * The OCP lists a patch under its own id, with the base patch's picture.
 */
(function capubOcpPatchVariants(){
  const variants = {
    ner_patch:'ner_ocp_patch', nywg_patch:'nywg_ocp_patch',
    check_pilot_patch:'check_pilot_ocp_patch', pjoc_patch:'pjoc_ocp_patch',
    nesa_patch:'nesa_ocp_patch',
    civil_engineering_academy_patch:'civil_engineering_academy_ocp_patch',
    cos_patch:'cos_ocp_patch', engineering_academy_patch:'engineering_academy_ocp_patch',
    nfa_patch:'nfa_ocp_patch', cla_patch:'cla_ocp_patch',
    proficient_pilot_patch:'proficient_pilot_ocp_patch',
    undergrad_pilot_training_patch:'undergrad_pilot_training_ocp_patch',
    nbb_patch:'nbb_ocp_patch', honor_guard_academy_patch:'honor_guard_academy_ocp_patch',
    af_space_command_patch:'af_space_command_ocp_patch', dog_patch:'dog_ocp_patch',
    archer_patch:'archer_ocp_patch', orientation_pilot_patch:'orientation_pilot_ocp_patch',
    cism_patch:'cism_ocp_patch', plane_patch:'plane_ocp_patch'
  };
  const variantIds = new Set(Object.values(variants));
  const uniformKey = (id = State.uniform) => normalizeUniformKeyForPatches(id);

  for(const [baseId, variantId] of Object.entries(variants)){
    const base = PATCH_META[baseId];
    if(!base) continue;
    if(variantId !== 'pjoc_ocp_patch'){
      PATCH_META[variantId] = {
        ...base,
        label:`${base.label} — OCP sleeve`,
        w:200, h:100,
        img:base.img, asset:base.asset || null,
        authorizedUniforms:['ocp'],
        ocpVariant:true,
        basePatchId:baseId
      };
    }else{
      Object.assign(PATCH_META[variantId], {
        label:'PJOC Patch — OCP sleeve', w:200, h:100, img:base.img, asset:base.asset || null,
        authorizedUniforms:['ocp'], ocpVariant:true, basePatchId:baseId
      });
    }
    if(!patchList.includes(variantId)) patchList.push(variantId);
  }

  const previousResolver = window.capubResolvePatchIdForUniform;
  window.capubResolvePatchIdForUniform = function(patchId, uniformId = State.uniform){
    if(uniformKey(uniformId) === 'ocp') return variants[patchId] || patchId;
    if(variantIds.has(patchId)) return PATCH_META[patchId]?.basePatchId || patchId;
    return typeof previousResolver === 'function'
      ? previousResolver(patchId, uniformId)
      : patchId;
  };

  // One of a one-only group at a time (a Ranger tab, 5.1.2.3.7): picking one drops the others (js/patches.js capubKeepOneRangerTab), and the
  // tiles shown follow.
  const tileId = tile => {
    const text = [...(tile?.querySelectorAll('.sub') || [])].map(node => node.textContent || '').find(t => /^\([^)]+\)$/.test(t.trim()));
    return text ? text.trim().slice(1, -1) : null;
  };
  function keepOne(id){
    if(PATCH_META[id]?.oneOnly && State.patchSelections[id]?.checked && typeof window.capubKeepOneRangerTab === 'function') window.capubKeepOneRangerTab(id);
  }
  function syncOneOnly(host){
    (host || document).querySelectorAll('.galleryTile').forEach(tile => {
      const id = tileId(tile), box = tile.querySelector('.ptChk');
      if(id && box && PATCH_META[id]?.oneOnly) box.checked = !!State.patchSelections[id]?.checked;
    });
  }

  buildPatchGallery = function(){
    const wrap = by('patchGallery');
    if(!wrap) return;
    normalizePatchSelections();
    wrap.innerHTML = '';
    const onOcp = uniformKey() === 'ocp';
    // A patch group of its own (the Hawk Mountain Ranger tabs, js/patches.js; LIVE13 E84, on the OCP only by Ethan's ruling of 2026-10-29): listed
    // last on the uniform that wears it, under a heading, and nowhere else.
    const grouped = id => !!PATCH_META[id]?.group;
    const ids = patchList.filter(id => {
      if(!PATCH_META[id] || FIELD_BASE_BUILT_IN_PATCH_IDS.has(id)) return false;
      if(id === 'tn185_ocp_patch' || id === 'tn330_ocp_patch' || /^unitPatch:/i.test(id)) return false;
      if(grouped(id)) return isPatchAuthorizedForUniform(id);
      return onOcp ? variantIds.has(id) : !variantIds.has(id);
    }).sort((a, b) => grouped(a) - grouped(b));
    const shown = State.patchGalleryExpanded ? ids : ids.slice(0, 10);
    let heading = null;

    for(const id of shown){
      const meta = PATCH_META[id];
      if(meta.group && meta.group !== heading){
        heading = meta.group;
        const head = document.createElement('div');
        head.className = 'galleryTile patchGroupHeading';
        head.style.gridColumn = '1 / -1';
        head.innerHTML = `<div style="flex:1;min-width:0;"><div class="title">${escapeHtml(meta.group)}</div><div class="sub">${escapeHtml(meta.note || '')}</div></div>`;
        wrap.appendChild(head);
      }
      const sel = State.patchSelections[id] || (State.patchSelections[id] = {checked:false});
      const authorized = isPatchAuthorizedForUniform(id);
      const tile = document.createElement('div');
      tile.className = `galleryTile${authorized ? '' : ' disabledBlock'}`;
      tile.innerHTML = `
        ${meta.img ? `<img src="${ASSET(meta.img)}" alt="${escapeHtml(meta.label)}">` : ''}
        <div style="flex:1;min-width:0;">
          <div class="title">${escapeHtml(meta.label)}</div>
          <div class="sub">(${escapeHtml(id)})</div>
          <div class="miniRow"><label><input type="checkbox" class="ptChk"> Add</label></div>
          <div class="sub">Slot hint: <b>${escapeHtml(meta.slotHint)}</b> &bull; Size: ${meta.w}&times;${meta.h} px</div>
        </div>`;
      const checkbox = tile.querySelector('.ptChk');
      checkbox.checked = !!sel.checked && authorized;
      checkbox.disabled = !authorized;
      checkbox.onchange = () => {
        sel.checked = authorized && checkbox.checked;
        State.patchSelections[id] = sel;
        keepOne(id);
        rebuildPatchesFromGallery();
        checkbox.checked = !!State.patchSelections[id]?.checked;
        syncOneOnly(wrap);
      };
      wrap.appendChild(tile);
    }
  };

  // The legacy modal wired filtered tiles to patchList by array position. Read
  // the explicit ID printed in each tile instead so PJOC is never mistaken for
  // the first generic patch. Capture phase survives popup rebuilds.
  if(!modalHost.dataset.ocpPatchIdWiring){
    modalHost.dataset.ocpPatchIdWiring = '1';
    modalHost.addEventListener('change', event => {
      const checkbox = event.target.closest?.('.ptChk');
      if(!checkbox) return;
      const tile = checkbox.closest('.galleryTile');
      const idText = [...(tile?.querySelectorAll('.sub') || [])]
        .map(node => node.textContent || '')
        .find(text => /^\([^)]+\)$/.test(text.trim()));
      const id = idText?.trim().slice(1, -1);
      if(!id || !PATCH_META[id]) return;
      event.stopImmediatePropagation();
      State.patchSelections[id] = {
        ...(State.patchSelections[id] || {}),
        checked:!checkbox.disabled && checkbox.checked
      };
      keepOne(id);
      rebuildPatchesFromGallery();
      checkbox.checked = !!State.patchSelections[id]?.checked;
      syncOneOnly(modalHost);
    }, true);
  }

  const previousOpenGalleryModal = openGalleryModal;
  openGalleryModal = function(kind){
    previousOpenGalleryModal(kind);
    if(kind !== 'patches') return;
    modalHost.querySelectorAll('.galleryTile').forEach(tile => {
      const idText = [...tile.querySelectorAll('.sub')]
        .map(node => node.textContent || '')
        .find(text => /^\([^)]+\)$/.test(text.trim()));
      const id = idText?.trim().slice(1, -1);
      const checkbox = tile.querySelector('.ptChk');
      if(!id || !checkbox || !PATCH_META[id]) return;
      checkbox.checked = !!State.patchSelections[id]?.checked;
      checkbox.disabled = !isPatchAuthorizedForUniform(id);
    });
  };

  const migrated = [];
  for(const rawId of State.patches || []){
    const id = window.capubResolvePatchIdForUniform(rawId);
    if(id && !migrated.includes(id)) migrated.push(id);
    if(id !== rawId){
      State.patchSelections[rawId] = {...(State.patchSelections[rawId] || {}), checked:false};
      State.patchSelections[id] = {...(State.patchSelections[id] || {}), checked:true};
    }
  }
  State.patches = migrated;
  buildPatchGallery();
  renderPatches();
})();
