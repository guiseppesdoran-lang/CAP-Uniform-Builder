// Feedback (LIVE13 E70). Ethan: "I would like a feedback button where a member can submit feedback and it would put a
// message in the admin dashboard." A "Feedback" link beside About in the footer opens a dialog: the message (required), an
// optional email or Discord name for a reply, and a box to attach the current setup as the same anonymous summary the usage
// counts send (js/telemetry.js: uniform, cut, membership, grade, item counts, options; never the name). Posts to the site's
// own API (/api/feedback, deploy/api), which puts it in the /admin inbox. CAPUB_CONFIG.feedback = false hides the link.
(function(){
  'use strict';
  const cfg = window.CAPUB_CONFIG || {};
  if(cfg.feedback === false) return;
  const ENDPOINT = '/api/feedback';
  const MAX_MESSAGE = 4000, MAX_CONTACT = 200;

  function ensureDialog(){
    let d = document.getElementById('feedbackDialog');
    if(d) return d;
    d = document.createElement('dialog');
    d.id = 'feedbackDialog';
    d.setAttribute('aria-labelledby', 'feedbackTitle');
    d.innerHTML = `<form id="feedbackForm" novalidate>
  <h2 id="feedbackTitle">Send feedback</h2>
  <p class="feedbackIntro">Something drawn wrong, something missing, or an idea? Tell the developers here.</p>
  <label class="fieldLabel" for="feedbackMessage">Your message</label>
  <textarea id="feedbackMessage" rows="6" maxlength="${MAX_MESSAGE}" required aria-describedby="feedbackCount"></textarea>
  <div class="hintText feedbackCount" id="feedbackCount" aria-live="polite">0 / ${MAX_MESSAGE}</div>
  <label class="fieldLabel" for="feedbackContact">Email or Discord (optional)</label>
  <input id="feedbackContact" type="text" maxlength="${MAX_CONTACT}" autocomplete="off" spellcheck="false" placeholder="Only if you would like a reply">
  <label class="fieldNote feedbackSetupRow"><input type="checkbox" id="feedbackSetup"> Include my current uniform setup</label>
  <div class="hintText" id="feedbackSetupHint">The uniform, cut, membership, grade, how many ribbons, badges and patches, and the options you set. Never your name.</div>
  <p class="hintText feedbackWhat"><b>What is sent:</b> your message, the contact you give, and, if you tick the box, that setup summary. No name, CAPID, nameplate text or member report goes with it.</p>
  <p class="feedbackError" id="feedbackError" role="alert" hidden></p>
  <div class="feedbackActions"><button type="button" class="ghost" id="feedbackCancel">Cancel</button><button type="submit" id="feedbackSend">Send</button></div>
</form>
<div id="feedbackThanks" class="feedbackThanks" hidden>
  <h2 tabindex="-1">Thank you</h2>
  <p>Your feedback was sent to the developers.</p>
  <div class="feedbackActions"><button type="button" id="feedbackDone">Close</button></div>
</div>`;
    document.body.appendChild(d);
    const form = d.querySelector('#feedbackForm');
    const msg = d.querySelector('#feedbackMessage');
    const count = d.querySelector('#feedbackCount');
    const error = d.querySelector('#feedbackError');
    const send = d.querySelector('#feedbackSend');
    const close = () => d.close();
    msg.addEventListener('input', () => { count.textContent = `${msg.value.length} / ${MAX_MESSAGE}`; if(msg.value.trim()) error.hidden = true; });
    d.querySelector('#feedbackCancel').addEventListener('click', close);
    d.querySelector('#feedbackDone').addEventListener('click', close);
    d.addEventListener('click', ev => { if(ev.target === d) close(); });
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const message = msg.value.trim();
      if(!message){ error.textContent = 'Write a message first.'; error.hidden = false; msg.focus(); return; }
      const contact = d.querySelector('#feedbackContact').value.trim().slice(0, MAX_CONTACT);
      const withSetup = d.querySelector('#feedbackSetup').checked;
      const T = window.CAPUB_TELEMETRY;
      const setup = withSetup && T && typeof T.summary === 'function' ? T.summary() : null;
      const body = { message: message.slice(0, MAX_MESSAGE), page: location.pathname.slice(0, 100) || '/' };
      if(contact) body.contact = contact;
      if(setup) body.setup = setup;
      error.hidden = true;
      send.disabled = true;
      send.textContent = 'Sending...';
      try{
        const r = await fetch(ENDPOINT, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        let reply = null;
        try{ reply = await r.json(); }catch(e){ reply = null; }
        if(!r.ok) throw new Error(reply && reply.error && r.status === 429 ? reply.error : `the site did not take it (error ${r.status})`);
        T && T.track && T.track('feedback_sent', { withSetup: !!setup, withContact: !!contact, length: message.length });
        form.reset();
        count.textContent = `0 / ${MAX_MESSAGE}`;
        form.hidden = true;
        const thanks = d.querySelector('#feedbackThanks');
        thanks.hidden = false;
        thanks.querySelector('h2').focus();
      }catch(e){
        const why = e && e.message && !/fetch|network/i.test(e.message) ? e.message.replace(/\.$/, '') : 'the site could not be reached';
        error.textContent = `Your feedback was not sent: ${why}. Your message is still here; try again in a moment.`;
        error.hidden = false;
      }finally{
        send.disabled = false;
        send.textContent = 'Send';
      }
    });
    return d;
  }

  function open(){
    const d = ensureDialog();
    d.querySelector('#feedbackForm').hidden = false;
    d.querySelector('#feedbackThanks').hidden = true;
    d.querySelector('#feedbackError').hidden = true;
    if(!d.open){ if(typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
    d.querySelector('#feedbackMessage').focus();
  }

  // The footer link, beside About (the page's markup is not changed: the link is added here, as js/placement-templates.js adds its button).
  function ensureLink(){
    if(document.getElementById('feedbackOpen')) return;
    const about = document.getElementById('aboutOpen');
    if(!about) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'feedbackOpen';
    btn.className = 'footerLink';
    btn.textContent = 'Feedback';
    btn.addEventListener('click', open);
    about.after(document.createTextNode(' · '), btn);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureLink); else ensureLink();

  window.CAPUBFeedback = { open };
})();
