// Authorized but not drawn yet. CAPR 39-1 allows a few uniforms (and a badge on the polo) that
// the builder has no artwork or placement for. They are shown, with what the regulation says, so
// a member does not conclude the regulation has no such thing. They are never selectable.
(function capubPlannedUniforms(){
  const by=id=>document.getElementById(id);
  let lastKey=null;

  function el(tag,cls,text){
    const n=document.createElement(tag);
    if(cls) n.className=cls;
    if(text!==undefined) n.textContent=text;
    return n;
  }

  function render(){
    const rules=window.CAPUBUniformRules;
    const list=by('uniformList');
    if(!rules || !list || typeof State==='undefined') return;
    const items=rules.plannedUniformsFor(State.membership,{adultCadet:!!State.adultCadet});
    const key=items.map(i=>i.id).join('|');
    if(key===lastKey) return;
    lastKey=key;

    let box=by('plannedUniforms');
    if(!box){
      box=el('div','plannedUniforms'); box.id='plannedUniforms';
      list.after(box);
    }
    box.textContent='';
    box.hidden=items.length===0;
    if(!items.length) return;

    box.append(el('div','plannedTitle','Authorized, not drawn yet'));
    box.append(el('div','hintText','CAPR 39-1 allows these. The builder cannot show them yet, so they are here to read about.'));
    items.forEach(item=>{
      const card=el('details','plannedCard');
      card.dataset.planned=item.id;
      const summary=el('summary','plannedSummary');
      summary.append(el('span','plannedName',item.label),el('span','plannedTag','Not drawn yet'));
      const facts=el('ul','plannedFacts');
      item.facts.forEach(f=>facts.append(el('li','',f)));
      card.append(summary,facts);
      box.append(card);
    });
  }

  let queued=false;
  function schedule(){
    if(queued) return;
    queued=true;
    let ran=false;
    const run=()=>{ if(ran) return; ran=true; queued=false; render(); };
    requestAnimationFrame(run);
    setTimeout(run,100);
  }
  ['change','click'].forEach(evt=>document.addEventListener(evt,schedule,true));
  document.addEventListener('capub:history',schedule);
  setTimeout(render,350);
})();
