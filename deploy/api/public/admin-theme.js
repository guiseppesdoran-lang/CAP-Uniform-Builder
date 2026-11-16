// The admin pages' light/dark switch (LIVE13 E114: "theres also no light mode button on the admin portal"). Loaded in
// <head> without defer on the sign-in form, the "not set up" page and the dashboard, so a saved choice is on <html> before
// the first paint (no inline script: the CSP is script-src 'self'). Served at /admin/theme.js without the cookie, because
// the sign-in form has the switch too and this file holds nothing else. The choice is kept in this browser under its own
// key (capubAdminTheme; the builder's is capubTheme); with nothing kept the system setting decides (prefers-color-scheme in
// admin.css and the form's style), as on the builder. data-theme="light" or "dark" on <html>, as on the builder.
(function(){
  'use strict';
  const KEY = 'capubAdminTheme';
  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function saved(){
    try{ const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; }catch(e){ return null; }
  }
  function current(){ return root.getAttribute('data-theme') || (media && media.matches ? 'dark' : 'light'); }
  function apply(v){ if(v) root.setAttribute('data-theme', v); else root.removeAttribute('data-theme'); }
  apply(saved());

  // Every [data-theme-toggle] button: it names the theme it switches to, like the builder's ("Light mode" while dark).
  function label(){
    const dark = current() === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.textContent = dark ? 'Light mode' : 'Dark mode';
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.dataset.mode = dark ? 'dark' : 'light';
    });
  }
  function wire(){
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.addEventListener('click', () => {
        const next = current() === 'dark' ? 'light' : 'dark';
        apply(next);
        try{ localStorage.setItem(KEY, next); }catch(e){ /* not kept; this page still switches */ }
        label();
      });
      b.hidden = false;   // in the markup hidden, so a page whose script did not load shows no dead button
    });
    label();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  // The system setting changed while nothing is kept, or another admin tab switched.
  if(media){
    const onChange = () => { if(!saved()) label(); };
    if(media.addEventListener) media.addEventListener('change', onChange); else if(media.addListener) media.addListener(onChange);
  }
  window.addEventListener('storage', e => { if(e.key === KEY || e.key === null){ apply(saved()); label(); } });
})();
