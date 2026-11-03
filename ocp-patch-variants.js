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

  // The patch picker itself (the tiles, their wiring in the sidebar and in the Choose... popup, the one-only Ranger tab group, the place
  // picker) is js/patches.js buildPatchGallery over js/catalog.js patchTileHtml; this file only names the OCP's own patch forms above.

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
