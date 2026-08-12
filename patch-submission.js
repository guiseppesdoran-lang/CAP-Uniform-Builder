/* CAP Uniform Builder — Patch Submission UI
   Sends patch images to a configured Google Apps Script mail handler.
*/
(function(){
  'use strict';

  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const LAST_SUBMIT_KEY = 'CAPUB_PATCH_SUBMIT_LAST_V3';
  const CONFIRMATION_TIMEOUT_MS = 60000;
  const ALLOWED_TYPES = new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
  const ALLOWED_EXTENSIONS = new Set(['png','jpg','jpeg','webp','svg']);

  function endpoint(){ return String(window.CAPUB_PATCH_SUBMISSION_ENDPOINT || '').trim(); }
  function field(form,name){ return form.elements.namedItem(name); }
  function isAllowedFile(file){
    if(!file) return false;
    const extension=String(file.name || '').split('.').pop().toLowerCase();
    return ALLOWED_TYPES.has(file.type) || (!file.type && ALLOWED_EXTENSIONS.has(extension));
  }

  function esc(v){
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function injectStyles(){
    if(document.getElementById('capubPatchSubmitStyles')) return;
    const s=document.createElement('style');
    s.id='capubPatchSubmitStyles';
    s.textContent=`
      #capubSubmitPatchButton{margin-top:8px;width:100%;font-weight:700}
      .capub-patch-overlay{position:fixed;inset:0;z-index:100050;background:rgba(0,0,0,.64);display:none;align-items:center;justify-content:center;padding:20px}
      .capub-patch-overlay.open{display:flex}
      .capub-patch-modal{width:min(620px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#172033;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.38)}
      .capub-patch-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #d9dee8;background:#f7f9fc;position:sticky;top:0;z-index:2}
      .capub-patch-head h2{font-size:20px;margin:0 0 4px}.capub-patch-sub{font-size:12px;color:#5f6b7d;line-height:1.4}
      .capub-patch-close{width:auto!important;margin:0!important;border:0;background:#e8ecf3;color:#172033;border-radius:8px;padding:7px 11px;cursor:pointer;font-size:18px;line-height:1}
      .capub-patch-body{padding:18px 20px 20px}
      .capub-patch-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .capub-patch-field{margin-bottom:12px}.capub-patch-field.full{grid-column:1/-1}
      .capub-patch-field label{display:block;font-size:12px;font-weight:700;margin-bottom:5px}
      .capub-patch-field input,.capub-patch-field textarea{width:100%;padding:9px 10px;border:1px solid #cbd3df;border-radius:8px;background:#fff;color:#172033;font:inherit;font-size:13px;margin:0}
      .capub-patch-field textarea{min-height:80px;resize:vertical}
      .capub-patch-help{font-size:10px;color:#6b7484;margin-top:4px;line-height:1.35}
      .capub-patch-preview{display:none;margin-top:10px;border:1px solid #dce2eb;border-radius:10px;background:#f8fafc;padding:10px;text-align:center}
      .capub-patch-preview.show{display:block}.capub-patch-preview img{max-width:220px;max-height:180px;object-fit:contain;background:#fff;border:1px solid #e2e6ed;border-radius:8px}
      .capub-patch-status{display:none;margin:10px 0;padding:9px 11px;border-radius:8px;font-size:12px;line-height:1.4}.capub-patch-status.show{display:block}.capub-patch-status.ok{background:#e8f6ed;color:#165b32}.capub-patch-status.err{background:#fdecec;color:#8f1d1d}.capub-patch-status.info{background:#edf4ff;color:#174a88}
      .capub-patch-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.capub-patch-actions button{width:auto;margin:0;padding:9px 14px}.capub-patch-actions .ghost{background:#fff;color:#172033;border:1px solid #c7cfdb}
      .capub-patch-honey{position:absolute!important;left:-9999px!important;opacity:0!important;pointer-events:none!important}
      @media(max-width:620px){.capub-patch-grid{grid-template-columns:1fr}.capub-patch-field.full{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function ensureButton(){
    if(document.getElementById('capubSubmitPatchButton')) return;
    const btn=document.createElement('button');
    btn.id='capubSubmitPatchButton';
    btn.type='button';
    btn.textContent='Submit a Patch';
    btn.title='Upload a patch image for review and addition to the builder.';
    btn.addEventListener('click',openModal);

    const patchesButton=document.getElementById('expandPatches');
    if(patchesButton?.parentElement){
      patchesButton.insertAdjacentElement('afterend',btn);
      return;
    }

    const controls=document.querySelector('.controlsScrollArea') || document.getElementById('controls') || document.body;
    const wrap=document.createElement('section');
    wrap.className='panelBlock';
    wrap.innerHTML='<label class="fieldLabel">Patch Submission</label><div class="hintText">Send a unit or activity patch image to the builder administrators for review.</div>';
    wrap.appendChild(btn);
    controls.appendChild(wrap);
  }

  function ensureModal(){
    if(document.getElementById('capubPatchSubmitOverlay')) return;
    const overlay=document.createElement('div');
    overlay.id='capubPatchSubmitOverlay';
    overlay.className='capub-patch-overlay';
    overlay.innerHTML=`
      <div class="capub-patch-modal" role="dialog" aria-modal="true" aria-labelledby="capubPatchSubmitTitle">
        <div class="capub-patch-head">
          <div><h2 id="capubPatchSubmitTitle">Submit a Patch</h2><div class="capub-patch-sub">Upload a patch image and identify the patch or the unit/activity it belongs to. The image will be emailed to the builder administrators for review.</div></div>
          <button type="button" class="capub-patch-close" id="capubPatchSubmitClose" aria-label="Close">×</button>
        </div>
        <div class="capub-patch-body">
          <form id="capubPatchSubmitForm" novalidate>
            <div class="capub-patch-grid">
              <div class="capub-patch-field"><label for="capubPatchName">Patch name</label><input id="capubPatchName" name="patchName" maxlength="120" placeholder="Example: Sequoyah Cadet Squadron Patch"><div class="capub-patch-help">Enter the patch name if known.</div></div>
              <div class="capub-patch-field"><label for="capubPatchUnit">Unit / activity</label><input id="capubPatchUnit" name="unitName" maxlength="120" placeholder="Example: TN-330 / Sequoyah Cadet Squadron"><div class="capub-patch-help">At least the patch name or unit/activity is required.</div></div>
              <div class="capub-patch-field"><label for="capubPatchSubmitter">Your name <span style="font-weight:400">(optional)</span></label><input id="capubPatchSubmitter" name="submitterName" maxlength="100" autocomplete="name"></div>
              <div class="capub-patch-field"><label for="capubPatchEmail">Your email <span style="font-weight:400">(optional)</span></label><input id="capubPatchEmail" name="submitterEmail" type="email" maxlength="160" autocomplete="email"><div class="capub-patch-help">Used only if the administrators need to follow up about the patch.</div></div>
              <div class="capub-patch-field full"><label for="capubPatchFile">Patch image</label><input id="capubPatchFile" name="patchFile" type="file" required accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"><div class="capub-patch-help">PNG, JPG/JPEG, WEBP, or SVG. Maximum file size: 4 MB.</div><div id="capubPatchPreview" class="capub-patch-preview"><img alt="Patch preview" id="capubPatchPreviewImg"></div></div>
              <div class="capub-patch-field full"><label for="capubPatchNotes">Notes <span style="font-weight:400">(optional)</span></label><textarea id="capubPatchNotes" name="notes" maxlength="1000" placeholder="Anything the administrators should know about the patch, authorization, current unit name, etc."></textarea></div>
            </div>
            <input class="capub-patch-honey" tabindex="-1" autocomplete="off" name="website" id="capubPatchWebsite">
            <div id="capubPatchStatus" class="capub-patch-status" role="status" aria-live="polite"></div>
            <div class="capub-patch-actions"><button class="ghost" type="button" id="capubPatchCancel">Cancel</button><button type="submit" id="capubPatchSend">Submit Patch</button></div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) closeModal(); });
    document.getElementById('capubPatchSubmitClose')?.addEventListener('click',closeModal);
    document.getElementById('capubPatchCancel')?.addEventListener('click',closeModal);
    document.getElementById('capubPatchFile')?.addEventListener('change',handleFilePreview);
    document.getElementById('capubPatchSubmitForm')?.addEventListener('submit',submitPatch);
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && overlay.classList.contains('open')) closeModal(); });
  }

  function setStatus(text,type='info'){
    const el=document.getElementById('capubPatchStatus');
    if(!el) return;
    el.textContent=text;
    el.className=`capub-patch-status show ${type}`;
  }

  function clearStatus(){
    const el=document.getElementById('capubPatchStatus');
    if(el){ el.textContent=''; el.className='capub-patch-status'; }
  }

  function openModal(){
    ensureModal();
    clearStatus();
    document.getElementById('capubPatchSubmitOverlay')?.classList.add('open');
  }
  function closeModal(){ document.getElementById('capubPatchSubmitOverlay')?.classList.remove('open'); }

  function handleFilePreview(e){
    const file=e.target.files?.[0];
    const box=document.getElementById('capubPatchPreview');
    const img=document.getElementById('capubPatchPreviewImg');
    if(!file || !box || !img){ box?.classList.remove('show'); return; }
    if(file.size>MAX_FILE_BYTES){
      e.target.value='';
      box.classList.remove('show');
      setStatus('That image is larger than 4 MB. Please upload a smaller file.','err');
      return;
    }
    if(!isAllowedFile(file)){
      e.target.value='';
      box.classList.remove('show');
      setStatus('Unsupported file type. Please use PNG, JPG/JPEG, WEBP, or SVG.','err');
      return;
    }
    const url=URL.createObjectURL(file);
    img.onload=()=>URL.revokeObjectURL(url);
    img.src=url;
    box.classList.add('show');
    clearStatus();
  }

  function readFileAsDataURL(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=()=>resolve(String(r.result||''));
      r.onerror=()=>reject(new Error('Could not read the selected image.'));
      r.readAsDataURL(file);
    });
  }

  function postConfirmed(payload){
    return new Promise((resolve,reject)=>{
      const requestId=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      payload.requestId=requestId;
      const frame=document.createElement('iframe');
      const frameName=`capub_patch_${requestId.replace(/[^a-z0-9]/gi,'')}`;
      frame.name=frameName;
      frame.title='Patch submission response';
      frame.hidden=true;
      const transport=document.createElement('form');
      transport.method='POST';
      transport.action=endpoint();
      transport.target=frameName;
      transport.hidden=true;
      const input=document.createElement('input');
      input.type='hidden';
      input.name='payload';
      input.value=JSON.stringify(payload);
      transport.appendChild(input);
      let settled=false;
      let timer;
      const cleanup=()=>{
        clearTimeout(timer);
        window.removeEventListener('message',onMessage);
        setTimeout(()=>{ transport.remove(); frame.remove(); },100);
      };
      const finish=(callback,value)=>{
        if(settled) return;
        settled=true;
        cleanup();
        callback(value);
      };
      const onMessage=e=>{
        const data=e.data;
        if(!data || data.source!=='CAPUB_PATCH_SUBMISSION' || data.requestId!==requestId) return;
        if(data.ok) finish(resolve,data);
        else finish(reject,new Error(data.error || 'The submission service rejected the patch.'));
      };
      window.addEventListener('message',onMessage);
      document.body.append(frame,transport);
      frame.addEventListener('error',()=>finish(reject,new Error('The submission service could not be reached.')),{once:true});
      timer=setTimeout(()=>finish(reject,new Error('The submission service did not confirm delivery. Please wait before trying again so the patch is not sent twice.')),CONFIRMATION_TIMEOUT_MS);
      transport.submit();
    });
  }

  async function submitPatch(e){
    e.preventDefault();
    const form=e.currentTarget;
    const patchName=field(form,'patchName').value.trim();
    const unitName=field(form,'unitName').value.trim();
    const submitterName=field(form,'submitterName').value.trim();
    const submitterEmail=field(form,'submitterEmail').value.trim();
    const notes=field(form,'notes').value.trim();
    const honeypot=field(form,'website').value.trim();
    const file=field(form,'patchFile').files?.[0];

    if(!patchName && !unitName){ setStatus('Enter either the patch name or the unit/activity it belongs to.','err'); return; }
    if(!file){ setStatus('Select a patch image to upload.','err'); return; }
    if(file.size>MAX_FILE_BYTES){ setStatus('The selected image is larger than 4 MB.','err'); return; }
    if(!isAllowedFile(file)){ setStatus('Unsupported image type. Use PNG, JPG/JPEG, WEBP, or SVG.','err'); return; }
    if(submitterEmail && !field(form,'submitterEmail').checkValidity()){ setStatus('Enter a valid email address or leave the email field blank.','err'); return; }
    if(!endpoint() || /PASTE_|YOUR_|EXAMPLE/i.test(endpoint())){
      setStatus('Patch submission email service has not been activated yet. The administrator needs to finish the one-time mail-service setup.','err');
      return;
    }

    const last=Number(localStorage.getItem(LAST_SUBMIT_KEY)||0);
    if(Date.now()-last<20000){ setStatus('Please wait a few seconds before sending another patch submission.','err'); return; }

    const button=document.getElementById('capubPatchSend');
    if(button){ button.disabled=true; button.textContent='Sending…'; }
    setStatus('Uploading the patch image…','info');

    try{
      const dataUrl=await readFileAsDataURL(file);
      const base64=dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const payload={
        patchName, unitName, submitterName, submitterEmail, notes, honeypot,
        fileName:file.name, mimeType:file.type || 'application/octet-stream', fileData:base64,
        fileSize:file.size, submittedAt:new Date().toISOString(), pageUrl:location.href
      };

      await postConfirmed(payload);

      localStorage.setItem(LAST_SUBMIT_KEY,String(Date.now()));
      form.reset();
      document.getElementById('capubPatchPreview')?.classList.remove('show');
      setStatus('Patch submitted. The image and patch information were sent to the builder administrators for review.','ok');
    }catch(err){
      console.error('CAPUB patch submission failed:',err);
      setStatus(`Submission failed: ${err?.message || 'The patch could not be submitted. Please try again later.'}`,'err');
    }finally{
      if(button){ button.disabled=false; button.textContent='Submit Patch'; }
    }
  }

  function init(){ injectStyles(); ensureButton(); ensureModal(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();

  window.CAPUB_PATCH_SUBMISSION={open:openModal,endpointConfigured:!!endpoint(),version:3};
})();
