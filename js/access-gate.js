// Access code gate. A courtesy so the builder is not a public, searchable page; it is not security
// and the code is in the source on purpose. Runs in <head> so a returning member never sees the box.
(function(){
  'use strict';
  const ACCESS_CODE = '656335';
  const KEY = 'cap_uniform_builder_access_v1';
  const root = document.documentElement;
  const remembered = () => { try { return localStorage.getItem(KEY) === '1'; } catch(e){ return false; } };
  const remember = () => { try { localStorage.setItem(KEY, '1'); } catch(e){} };
  if(remembered()){ root.setAttribute('data-access', 'ok'); return; }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('accessGateForm');
    const input = document.getElementById('accessGateInput');
    const error = document.getElementById('accessGateError');
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
  });
})();
