// Access code gate. A courtesy so the builder is not a public, searchable page; it is not security
// and the code is in the source on purpose. Runs in <head> so a returning member never sees the box.
// A member who enters the code is remembered in this browser (localStorage) and gets data-access="ok".
// "Continue as guest" opens the builder without the code for this browser session only (sessionStorage),
// so a returning guest sees the gate again; it sets data-access="guest" so the app can tell the two apart.
(function(){
  'use strict';
  const ACCESS_CODE = '656335';
  const KEY = 'cap_uniform_builder_access_v1';
  const GUEST_KEY = 'cap_uniform_builder_guest_v1';
  const root = document.documentElement;
  const remembered = () => { try { return localStorage.getItem(KEY) === '1'; } catch(e){ return false; } };
  const remember = () => { try { localStorage.setItem(KEY, '1'); } catch(e){} };
  const guestThisSession = () => { try { return sessionStorage.getItem(GUEST_KEY) === '1'; } catch(e){ return false; } };
  const rememberGuest = () => { try { sessionStorage.setItem(GUEST_KEY, '1'); } catch(e){} };
  if(remembered()){ root.setAttribute('data-access', 'ok'); return; }
  if(guestThisSession()){ root.setAttribute('data-access', 'guest'); return; }

  // The buttons answer as soon as the page is parsed: readyState turns "interactive" before the app's deferred
  // scripts run, and DOMContentLoaded only fires after all of them (LIVE13 E65).
  function wire(){
    const form = document.getElementById('accessGateForm');
    const input = document.getElementById('accessGateInput');
    const error = document.getElementById('accessGateError');
    const guest = document.getElementById('accessGateGuest');
    if(!form || !input) { root.setAttribute('data-access', 'ok'); return; }
    input.focus();
    form.addEventListener('submit', event => {
      event.preventDefault();
      if(input.value.trim() === ACCESS_CODE){
        remember();
        root.setAttribute('data-access', 'ok');
        return;
      }
      error.textContent = 'That code is not right.';
      input.select();
    });
    if(guest) guest.addEventListener('click', () => {
      rememberGuest();
      root.setAttribute('data-access', 'guest');
    });
  }
  const onReady = () => {
    if(document.readyState === 'loading') return;
    document.removeEventListener('readystatechange', onReady);
    wire();
  };
  document.addEventListener('readystatechange', onReady);
})();
