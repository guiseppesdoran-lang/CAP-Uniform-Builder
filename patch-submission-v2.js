/* CAP Uniform Builder — Patch Submission v2
   Uses a hidden form/iframe so Apps Script can confirm success or return an error.
*/
(function(){
  'use strict';
  const ENDPOINT=String(window.CAPUB_PATCH_SUBMISSION_ENDPOINT||'').trim();
  const MAX=4*1024*1024;
  const TYPES=new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
  const LAST='CAPUB_PATCH_SUBMIT_LAST_V2';

  function styles(){
    if(document.getElementById('capubPatchV2Styles')) return;
    const s=document.createElement('style'); s.id='capubPatchV2Styles'; s.textContent=`
      #capubSubmitPatchButton{margin-top:8px;width:100%;font-weight:700}
      .cpv2ov{position:fixed;inset:0;z-index:100060;background:rgba(0,0,0,.64);display:none;align-items:center;justify-content:center;padding:20px}.cpv2ov.open{display:flex}
      .cpv2m{width:min(620px,96vw);max-height:92vh;overflow:auto;background:#fff;color:#172033;border-radius:14px;box-shadow:0 24px 80px rgba(0,0,0,.38)}
      .cpv2h{display:flex;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #d9dee8;background:#f7f9fc}.cpv2h h2{margin:0 0 4px;font-size:20px}.cpv2sub{font-size:12px;color:#5f6b7d;line-height:1.4}
      .cpv2close{width:auto!important;margin:0!important;padding:7px 11px!important;background:#e8ecf3!important;color:#172033!important;border:0!important;font-size:18px!important}
      .cpv2b{padding:18px 20px 20px}.cpv2grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cpv2f{margin-bottom:12px}.cpv2f.full{grid-column:1/-1}.cpv2f label{display:block;font-size:12px;font-weight:700;margin-bottom:5px}.cpv2f input,.cpv2f textarea{width:100%;margin:0;padding:9px 10px;border:1px solid #cbd3df;border-radius:8px;background:#fff;color:#172033;font:inherit;font-size:13px}.cpv2f textarea{min-height:80px;resize:vertical}.cpv2help{font-size:10px;color:#6b7484;margin-top:4px}
      .cpv2preview{display:none;margin-top:10px;padding:10px;text-align:center;background:#f8fafc;border:1px solid #dce2eb;border-radius:10px}.cpv2preview.show{display:block}.cpv2preview img{max-width:220px;max-height:180px;object-fit:contain}
      .cpv2status{display:none;margin:10px 0;padding:9px 11px;border-radius:8px;font-size:12px;line-height:1.4}.cpv2status.show{display:block}.cpv2status.ok{background:#e8f6ed;color:#165b32}.cpv2status.err{background:#fdecec;color:#8f1d1d}.cpv2status.info{background:#edf4ff;color:#174a88}
      .cpv2actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.cpv2actions button{width:auto;margin:0;padding:9px 14px}.cpv2hp{position:absolute!important;left:-9999px!important;opacity:0!important}
      @media(max-width:620px){.cpv2grid{grid-template-columns:1fr}.cpv2f.full{grid-column:auto}}
    `; document.head.appendChild(s);
  }

  function button(){
    if(document.getElementById('capubSubmitPatchButton')) return;
    const b=document.createElement('button'); b.id='capubSubmitPatchButton'; b.type='button'; b.textContent='Submit a Patch'; b.onclick=open;
    const p=document.getElementById('expandPatches');
    if(p?.parentElement) p.insertAdjacentElement('afterend',b);
    else {
      const w=document.createElement('section'); w.className='panelBlock'; w.innerHTML='<label class="fieldLabel">Patch Submission</label><div class="hintText">Send a unit or activity patch image to the builder administrators for review.</div>'; w.appendChild(b); (document.querySelector('.controlsScrollArea')||document.getElementById('controls')||document.body).appendChild(w);
    }
  }

  function modal(){
    if(document.getElementById('capubPatchV2')) return;
    const o=document.createElement('div'); o.id='capubPatchV2'; o.className='cpv2ov'; o.innerHTML=`<div class="cpv2m"><div class="cpv2h"><div><h2>Submit a Patch</h2><div class="cpv2sub">Upload a patch image and identify the patch or the unit/activity it belongs to.</div></div><button type="button" class="cpv2close" id="cpv2Close">×</button></div><div class="cpv2b"><form id="cpv2Form"><div class="cpv2grid">
      <div class="cpv2f"><label>Patch name</label><input name="patchName" maxlength="120" placeholder="Example: Sequoyah Cadet Squadron Patch"></div>
      <div class="cpv2f"><label>Unit / activity</label><input name="unitName" maxlength="120" placeholder="Example: TN-330 / Sequoyah Cadet Squadron"><div class="cpv2help">Patch name or unit/activity is required.</div></div>
      <div class="cpv2f"><label>Your name (optional)</label><input name="submitterName" maxlength="100"></div>
      <div class="cpv2f"><label>Your email (optional)</label><input name="submitterEmail" type="email" maxlength="160"></div>
      <div class="cpv2f full"><label>Patch image</label><input name="patchFile" id="cpv2File" type="file" required accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"><div class="cpv2help">PNG, JPG/JPEG, WEBP, or SVG. Maximum 4 MB.</div><div class="cpv2preview" id="cpv2Preview"><img id="cpv2Img" alt="Patch preview"></div></div>
      <div class="cpv2f full"><label>Notes (optional)</label><textarea name="notes" maxlength="1000"></textarea></div>
      </div><input class="cpv2hp" name="website" tabindex="-1" autocomplete="off"><div id="cpv2Status" class="cpv2status"></div><div class="cpv2actions"><button type="button" id="cpv2Cancel" class="ghost">Cancel</button><button type="submit" id="cpv2Send">Submit Patch</button></div></form></div></div>`;
    document.body.appendChild(o);
    o.onclick=e=>{if(e.target===o) close();};
    document.getElementById('cpv2Close').onclick=close; document.getElementById('cpv2Cancel').onclick=close;
    document.getElementById('cpv2File').onchange=preview; document.getElementById('cpv2Form').onsubmit=submit;
  }

  function status(t,k='info'){const e=document.getElementById('cpv2Status'); if(e){e.textContent=t;e.className=`cpv2status show ${k}`;}}
  function clear(){const e=document.getElementById('cpv2Status'); if(e){e.textContent='';e.className='cpv2status';}}
  function open(){modal();clear();document.getElementById('capubPatchV2').classList.add('open');}
  function close(){document.getElementById('capubPatchV2')?.classList.remove('open');}

  function preview(e){
    const f=e.target.files?.[0],box=document.getElementById('cpv2Preview'),img=document.getElementById('cpv2Img'); if(!f){box?.classList.remove('show');return;}
    if(f.size>MAX){e.target.value='';box?.classList.remove('show');status('That image is larger than 4 MB.','err');return;}
    if(f.type&&!TYPES.has(f.type)){e.target.value='';box?.classList.remove('show');status('Unsupported image type.','err');return;}
    const u=URL.createObjectURL(f); img.onload=()=>URL.revokeObjectURL(u); img.src=u; box.classList.add('show'); clear();
  }

  function read64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||'').split(',')[1]||'');r.onerror=()=>rej(new Error('Could not read the image.'));r.readAsDataURL(f);});}

  function postConfirmed(payload){
    return new Promise((resolve,reject)=>{
      const id=(crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`); payload.requestId=id;
      const frame=document.createElement('iframe'); const frameName=`capub_patch_${id.replace(/[^a-z0-9]/gi,'')}`; frame.name=frameName; frame.style.display='none';
      const form=document.createElement('form'); form.method='POST'; form.action=ENDPOINT; form.target=frameName; form.style.display='none';
      const input=document.createElement('input'); input.type='hidden'; input.name='payload'; input.value=JSON.stringify(payload); form.appendChild(input);
      let timer;
      const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);setTimeout(()=>{form.remove();frame.remove();},100);};
      const onMessage=e=>{const d=e.data;if(!d||d.source!=='CAPUB_PATCH_SUBMISSION'||d.requestId!==id)return;cleanup();d.ok?resolve(d):reject(new Error(d.error||'The mail service reported an error.'));};
      window.addEventListener('message',onMessage);
      document.body.append(frame,form);
      timer=setTimeout(()=>{cleanup();reject(new Error('No confirmation was received from the email service. Check the Apps Script execution log.'));},45000);
      form.submit();
    });
  }

  async function submit(e){
    e.preventDefault(); const f=e.currentTarget; const patchName=f.patchName.value.trim(),unitName=f.unitName.value.trim(),file=f.patchFile.files?.[0];
    if(!patchName&&!unitName){status('Enter the patch name or unit/activity.','err');return;} if(!file){status('Select a patch image.','err');return;} if(file.size>MAX){status('The image is larger than 4 MB.','err');return;} if(file.type&&!TYPES.has(file.type)){status('Unsupported image type.','err');return;} if(!ENDPOINT){status('The email endpoint is not configured.','err');return;}
    const last=Number(localStorage.getItem(LAST)||0); if(Date.now()-last<20000){status('Please wait a few seconds before another submission.','err');return;}
    const b=document.getElementById('cpv2Send'); b.disabled=true;b.textContent='Sending…';status('Sending patch to the administrators…','info');
    try{
      const fileData=await read64(file); const result=await postConfirmed({patchName,unitName,submitterName:f.submitterName.value.trim(),submitterEmail:f.submitterEmail.value.trim(),notes:f.notes.value.trim(),honeypot:f.website.value.trim(),fileName:file.name,mimeType:file.type||'application/octet-stream',fileData,fileSize:file.size,submittedAt:new Date().toISOString(),pageUrl:location.href});
      localStorage.setItem(LAST,String(Date.now())); f.reset(); document.getElementById('cpv2Preview')?.classList.remove('show'); status(`Patch submitted successfully. Email service confirmed delivery request.${result.quotaRemaining!=null?` Remaining daily recipient quota: ${result.quotaRemaining}.`:''}`,'ok');
    }catch(err){console.error(err);status(`Submission failed: ${err.message}`,'err');}
    finally{b.disabled=false;b.textContent='Submit Patch';}
  }

  function init(){styles();button();modal();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.CAPUB_PATCH_SUBMISSION={open,endpointConfigured:!!ENDPOINT,version:2};
})();