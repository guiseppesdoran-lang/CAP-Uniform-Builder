/* CAP Uniform Builder — calibration change-request handoff.
   Packages exact calibrated layers and sends them to the protected Apps Script
   backend, which creates a reviewable GitHub issue and emails a backup copy.
*/
(function(){
  'use strict';

  const SOURCE = 'CAPUB_CALIBRATION_SUBMISSION';
  const MAX_SELECTED_KEYS = 100;
  const STATUS_TIMEOUT_MS = 60000;

  const endpoint = () => String(window.CAPUB_PATCH_SUBMISSION_ENDPOINT || '').trim();
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function injectStyles(){
    if(byId('capubCalibrationSubmitStyles')) return;
    const style=document.createElement('style');
    style.id='capubCalibrationSubmitStyles';
    style.textContent=`
      #calibSubmitUpdate{width:100%;font-weight:800;background:#0b63ce;color:#fff}
      .capub-cal-submit-overlay{position:fixed;inset:0;z-index:100060;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.66)}
      .capub-cal-submit-overlay.open{display:flex}
      .capub-cal-submit-modal{width:min(650px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#172033;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.4)}
      .capub-cal-submit-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #d9dee8;background:#f7f9fc}
      .capub-cal-submit-head h2{margin:0 0 4px;font-size:20px}.capub-cal-submit-sub{font-size:12px;line-height:1.4;color:#5f6b7d}
      .capub-cal-submit-close{width:auto!important;margin:0!important;padding:7px 11px;border:0;border-radius:8px;background:#e8ecf3;color:#172033;font-size:18px}
      .capub-cal-submit-body{padding:18px 20px 20px}.capub-cal-submit-summary{margin-bottom:14px;padding:10px 12px;border:1px solid #dce3ed;border-radius:9px;background:#f8fafc;font-size:12px;line-height:1.45}
      .capub-cal-submit-field{margin-bottom:12px}.capub-cal-submit-field label{display:block;margin-bottom:5px;font-size:12px;font-weight:800}
      .capub-cal-submit-field input,.capub-cal-submit-field textarea{box-sizing:border-box;width:100%;margin:0;padding:9px 10px;border:1px solid #cbd3df;border-radius:8px;background:#fff;color:#172033;font:inherit;font-size:13px}
      .capub-cal-submit-field textarea{min-height:92px;resize:vertical}.capub-cal-submit-help{margin-top:4px;font-size:10px;line-height:1.35;color:#6b7484}
      .capub-cal-submit-status{display:none;margin:10px 0;padding:9px 11px;border-radius:8px;font-size:12px;line-height:1.4}.capub-cal-submit-status.show{display:block}.capub-cal-submit-status.ok{background:#e8f6ed;color:#165b32}.capub-cal-submit-status.err{background:#fdecec;color:#8f1d1d}.capub-cal-submit-status.info{background:#edf4ff;color:#174a88}
      .capub-cal-submit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.capub-cal-submit-actions button{width:auto;margin:0;padding:9px 14px}.capub-cal-submit-actions .ghost{border:1px solid #c7cfdb;background:#fff;color:#172033}
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    if(byId('capubCalibrationSubmitOverlay')) return;
    const overlay=document.createElement('div');
    overlay.id='capubCalibrationSubmitOverlay';
    overlay.className='capub-cal-submit-overlay';
    overlay.innerHTML=`
      <div class="capub-cal-submit-modal" role="dialog" aria-modal="true" aria-labelledby="capubCalibrationSubmitTitle">
        <div class="capub-cal-submit-head">
          <div><h2 id="capubCalibrationSubmitTitle">Submit Calibration Update</h2><div class="capub-cal-submit-sub">Sends the selected coordinates, scale, uniform setup, and a preview to the GitHub calibration queue for Codex review.</div></div>
          <button type="button" class="capub-cal-submit-close" id="capubCalibrationSubmitClose" aria-label="Close">×</button>
        </div>
        <div class="capub-cal-submit-body">
          <div id="capubCalibrationSubmitSummary" class="capub-cal-submit-summary"></div>
          <form id="capubCalibrationSubmitForm" novalidate>
            <div class="capub-cal-submit-field"><label for="capubCalibrationTitle">Update title</label><input id="capubCalibrationTitle" name="title" maxlength="140" required></div>
            <div class="capub-cal-submit-field"><label for="capubCalibrationNotes">What should this fix?</label><textarea id="capubCalibrationNotes" name="notes" maxlength="2000" required placeholder="Example: Align the National Staff badge with the wearer's right pocket and reduce it to the measured physical scale."></textarea></div>
            <div class="capub-cal-submit-field"><label for="capubCalibrationName">Your name <span style="font-weight:400">(optional)</span></label><input id="capubCalibrationName" name="submitterName" maxlength="100" autocomplete="name"></div>
            <div class="capub-cal-submit-field"><label for="capubCalibrationEmail">Your email <span style="font-weight:400">(optional)</span></label><input id="capubCalibrationEmail" name="submitterEmail" type="email" maxlength="160" autocomplete="email"></div>
            <div class="capub-cal-submit-field"><label for="capubCalibrationPassword">Admin password</label><input id="capubCalibrationPassword" name="adminPassword" type="password" required autocomplete="current-password"><div class="capub-cal-submit-help">Verified by the server. The password is not included in the GitHub issue or email attachments.</div></div>
            <div id="capubCalibrationSubmitStatus" class="capub-cal-submit-status" role="status" aria-live="polite"></div>
            <div class="capub-cal-submit-actions"><button class="ghost" type="button" id="capubCalibrationSubmitCancel">Cancel</button><button type="submit" id="capubCalibrationSubmitSend">Submit Update</button></div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',event=>{ if(event.target===overlay) closeModal(); });
    byId('capubCalibrationSubmitClose')?.addEventListener('click',closeModal);
    byId('capubCalibrationSubmitCancel')?.addEventListener('click',closeModal);
    byId('capubCalibrationSubmitForm')?.addEventListener('submit',submitCalibration);
    document.addEventListener('keydown',event=>{ if(event.key==='Escape' && overlay.classList.contains('open')) closeModal(); });
  }

  function currentSelectedKeys(){
    if(typeof getSelectedCalibKeys !== 'function') return [];
    return getSelectedCalibKeys().filter(Boolean);
  }

  function prettyUniform(){
    return String(State.uniform || 'uniform').replace(/_/g,' ').replace(/\b\w/g,char=>char.toUpperCase());
  }

  function setStatus(message,type='info',link=''){
    const status=byId('capubCalibrationSubmitStatus');
    if(!status) return;
    status.className=`capub-cal-submit-status show ${type}`;
    status.textContent=message;
    if(link){
      const anchor=document.createElement('a');
      anchor.href=link;
      anchor.target='_blank';
      anchor.rel='noopener noreferrer';
      anchor.textContent=' Open GitHub issue.';
      status.appendChild(anchor);
    }
  }

  function clearStatus(){
    const status=byId('capubCalibrationSubmitStatus');
    if(status){ status.className='capub-cal-submit-status'; status.textContent=''; }
  }

  function openModal(){
    const keys=currentSelectedKeys();
    ensureModal();
    clearStatus();
    const bucket=typeof getCurrentCalibUniform === 'function' ? getCurrentCalibUniform() : State.uniform;
    const summary=byId('capubCalibrationSubmitSummary');
    if(summary){
      summary.innerHTML=`<b>${esc(prettyUniform())}</b> · ${esc(State.gender || 'gender not selected')} · ${esc(State.membership || 'membership not selected')}<br>`+
        `Calibration bucket: <code>${esc(bucket || 'unknown')}</code><br>`+
        `Selected assets: <b>${keys.length}</b>${keys.length ? `<br><span>${esc(keys.join(', '))}</span>` : '<br><span>Select one or more items on the uniform before submitting.</span>'}`;
    }
    const title=byId('capubCalibrationTitle');
    if(title && !title.value) title.value=`Calibration: ${prettyUniform()} ${State.gender || ''}`.trim();
    byId('capubCalibrationSubmitOverlay')?.classList.add('open');
  }

  function closeModal(){ byId('capubCalibrationSubmitOverlay')?.classList.remove('open'); }

  function buildCalibrationPackage(title,notes,submitterName,submitterEmail){
    const keys=currentSelectedKeys();
    if(!keys.length) throw new Error('Select at least one badge, ribbon, medal, patch, or uniform item in Calibrate Mode first.');
    if(keys.length>MAX_SELECTED_KEYS) throw new Error(`Select no more than ${MAX_SELECTED_KEYS} assets in one submission.`);

    const bucket=typeof getCurrentCalibUniform === 'function' ? getCurrentCalibUniform() : State.uniform;
    const changes=keys.map(key=>({
      key,
      savedCalibration: typeof getCalib === 'function' ? (getCalib(key) || {}) : {},
      rendered: typeof getRenderedRecordForKey === 'function' ? getRenderedRecordForKey(key) : null
    }));

    return {
      schemaVersion:1,
      type:'capub-calibration-change-request',
      submittedAt:new Date().toISOString(),
      title,
      notes,
      submitter:{name:submitterName || '',email:submitterEmail || ''},
      builder:{pageUrl:location.href,documentLastModified:document.lastModified},
      context:{
        uniform:State.uniform || null,
        calibrationBucket:bucket || null,
        gender:State.gender || null,
        membership:State.membership || null,
        rank:State.rank || null,
        baseCandidates:typeof getBaseCandidates === 'function' ? getBaseCandidates() : [],
        canvas:typeof getCanvasRenderSize === 'function' ? getCanvasRenderSize() : null,
        garmentOverlayMode:State.garmentOverlayMode || 'both',
        ribbonRackLayout:State.ribbonRackLayout || null,
        ribbonRackArrangement:State.ribbonRackArrangement || null,
        ribbonRowOverrideEnabled:!!State.ribbonRowOverrideEnabled,
        ribbonRowOverride:Array.isArray(State.ribbonRowOverride) ? State.ribbonRowOverride : []
      },
      selectedKeys:keys,
      changes,
      selectedUniformItems:{
        ribbons:(State.ribbons || []).map(item=>({id:item.id,awardValue:item.awardValue || ''})),
        badges:[...(State.badges || [])],
        patches:[...(State.patches || [])]
      }
    };
  }

  async function buildPreview(){
    if(typeof composeUniformPngCanvas !== 'function' || !uniformCanvas) return null;
    const canvas=await composeUniformPngCanvas(uniformCanvas,1);
    return canvas.toDataURL('image/png');
  }

  function jsonpStatus(requestId){
    return new Promise((resolve,reject)=>{
      const callbackName=`capubCalibrationStatus_${requestId.replace(/[^a-z0-9]/gi,'')}_${Date.now()}`;
      const script=document.createElement('script');
      const timer=setTimeout(()=>finish(reject,new Error('Status request timed out.')),8000);
      const finish=(callback,value)=>{
        clearTimeout(timer);
        delete window[callbackName];
        script.remove();
        callback(value);
      };
      window[callbackName]=payload=>finish(resolve,payload);
      script.onerror=()=>finish(reject,new Error('Status endpoint is unavailable.'));
      const query=new URLSearchParams({mode:'calibration_status',requestId,callback:callbackName,_:String(Date.now())});
      script.src=`${endpoint()}?${query}`;
      document.head.appendChild(script);
    });
  }

  function postConfirmed(payload){
    return new Promise((resolve,reject)=>{
      const requestId=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      payload.requestId=requestId;
      const frame=document.createElement('iframe');
      frame.name=`capub_calibration_${requestId.replace(/[^a-z0-9]/gi,'')}`;
      frame.hidden=true;
      frame.title='Calibration submission response';
      const form=document.createElement('form');
      form.method='POST';
      form.action=endpoint();
      form.target=frame.name;
      form.hidden=true;
      const input=document.createElement('input');
      input.type='hidden'; input.name='payload'; input.value=JSON.stringify(payload);
      form.appendChild(input);
      let settled=false;
      let pollTimer;
      const started=Date.now();
      const cleanup=()=>{
        clearTimeout(pollTimer);
        window.removeEventListener('message',onMessage);
        setTimeout(()=>{ form.remove(); frame.remove(); },100);
      };
      const finish=(callback,value)=>{
        if(settled) return;
        settled=true;
        cleanup();
        callback(value);
      };
      const accept=data=>{
        if(!data || data.source!==SOURCE || data.requestId!==requestId) return false;
        if(data.pending) return false;
        if(data.ok) finish(resolve,data);
        else finish(reject,Object.assign(new Error(data.error || 'Calibration submission failed.'),{data}));
        return true;
      };
      const onMessage=event=>accept(event.data);
      const poll=async()=>{
        if(settled) return;
        if(Date.now()-started>STATUS_TIMEOUT_MS){
          finish(reject,new Error('The calibration backend did not confirm the submission. Update the Apps Script deployment before trying again.'));
          return;
        }
        try{
          const result=await jsonpStatus(requestId);
          if(accept(result)) return;
        }catch(_){ }
        pollTimer=setTimeout(poll,1500);
      };
      window.addEventListener('message',onMessage);
      document.body.append(frame,form);
      form.submit();
      pollTimer=setTimeout(poll,1000);
    });
  }

  async function submitCalibration(event){
    event.preventDefault();
    const form=event.currentTarget;
    const title=form.elements.namedItem('title').value.trim();
    const notes=form.elements.namedItem('notes').value.trim();
    const submitterName=form.elements.namedItem('submitterName').value.trim();
    const submitterEmail=form.elements.namedItem('submitterEmail').value.trim();
    const adminPassword=form.elements.namedItem('adminPassword').value;
    if(!title || !notes){ setStatus('Enter a title and explain what the calibration should fix.','err'); return; }
    if(!adminPassword){ setStatus('Enter the admin password.','err'); return; }
    if(submitterEmail && !form.elements.namedItem('submitterEmail').checkValidity()){ setStatus('Enter a valid email address or leave it blank.','err'); return; }
    if(!endpoint() || /PASTE_|YOUR_|EXAMPLE/i.test(endpoint())){ setStatus('The submission backend has not been configured.','err'); return; }

    const button=byId('capubCalibrationSubmitSend');
    if(button){ button.disabled=true; button.textContent='Packaging…'; }
    setStatus('Capturing the exact coordinates and uniform preview…','info');
    try{
      const calibrationPackage=buildCalibrationPackage(title,notes,submitterName,submitterEmail);
      const previewDataUrl=await buildPreview().catch(()=>null);
      if(button) button.textContent='Submitting…';
      setStatus('Sending the calibration package to the GitHub review queue…','info');
      const result=await postConfirmed({
        action:'calibration_submission',
        adminPassword,
        calibrationPackage,
        previewDataUrl:previewDataUrl || '',
        submittedAt:new Date().toISOString(),
        pageUrl:location.href
      });
      const issueUrl=result.data?.issueUrl || '';
      const issueNumber=result.data?.issueNumber;
      const fallback=result.data?.emailFallback;
      if(issueUrl){
        setStatus(`Calibration submitted as GitHub issue #${issueNumber || ''}.`, 'ok', issueUrl);
      }else if(fallback){
        setStatus('The package was emailed to the administrators, but GitHub issue creation is not configured yet.','err');
      }else{
        setStatus('Calibration package submitted for review.','ok');
      }
      form.elements.namedItem('adminPassword').value='';
    }catch(error){
      console.error('CAPUB calibration submission failed:',error);
      const fallback=error?.data?.data?.emailFallback;
      setStatus(fallback
        ? 'The backup email was sent, but GitHub issue creation failed. Check the Apps Script GitHub token configuration.'
        : `Submission failed: ${error?.message || 'Unknown error.'}`,'err');
    }finally{
      if(button){ button.disabled=false; button.textContent='Submit Update'; }
    }
  }

  function init(){
    injectStyles();
    ensureModal();
    const button=byId('calibSubmitUpdate');
    if(button) button.addEventListener('click',openModal);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();

  window.CAPUB_CALIBRATION_SUBMISSION={open:openModal,version:1};
})();
