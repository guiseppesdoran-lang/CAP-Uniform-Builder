'use strict';
// The admin pages' light/dark switch (LIVE13 E114). Ethan: "theres also no light mode button on the admin portal".
// Both pages (the sign-in form and the dashboard, and the "not set up" page) carry a "Light mode" / "Dark mode" button and
// load /admin/theme.js in <head>; the script is served without the cookie; admin.css and the form's style give every colour
// a light and a dark value; the choice is kept under its own key and the system setting decides when nothing is kept.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const pages = require('../deploy/api/pages.js');
const { createService } = require('../deploy/api/service.js');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'deploy', 'api', 'public');
const PASSWORD = 'test-admin-password-not-real';

function head(html){ return html.slice(0, html.indexOf('</head>')); }

test('the sign-in form, the "not set up" page and the dashboard carry the switch and load theme.js early', () => {
  for(const [name, html] of [['login', pages.login({})], ['login with an error', pages.login({ error: 'x' })], ['notConfigured', pages.notConfigured()], ['dashboard', pages.dashboard()]]){
    const h = head(html);
    assert.match(h, /<script src="\/admin\/theme\.js"><\/script>/, `${name}: theme.js in <head>, not deferred`);
    assert.match(h, /<meta name="color-scheme" content="light dark">/, `${name}: a color-scheme default for the first paint`);
    assert.doesNotMatch(html, /<script>(?!<)|<script(?![^>]*\bsrc=)[^>]*>/, `${name}: no inline script`);
    const btn = html.match(/<button type="button" class="[^"]*\bthemeToggle\b[^"]*" data-theme-toggle hidden>(Light|Dark) mode<\/button>/);
    assert.ok(btn, `${name}: the Light mode / Dark mode button`);
  }
  const dash = pages.dashboard();
  // In the dashboard's header beside Sign out; theme.js comes before the stylesheet and app.js.
  const bar = dash.slice(dash.indexOf('<header class="bar">'), dash.indexOf('</header>'));
  assert.match(bar, /data-theme-toggle/);
  assert.ok(dash.indexOf('/admin/theme.js') < dash.indexOf('/admin/app.css') && dash.indexOf('/admin/app.css') < dash.indexOf('/admin/app.js'));
  // The form's own style has the same three rules as admin.css: light default, system dark unless light is kept, kept dark.
  const form = pages.login({});
  assert.match(form, /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{/);
  assert.match(form, /:root\[data-theme="dark"\]\{/);
  assert.match(form, /:root\{--ink:#001871;[^}]*--line:#9EA2A2;[^}]*--action:#FFCD00;[^}]*--on-action:#001871;/, 'light: Symbol Blue text, Silver Gray borders, yellow primary with dark text');
});

// The custom properties a rule block defines.
function defined(block){ return new Set([...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1])); }
function blockAfter(css, selector){
  const i = css.indexOf(selector);
  assert.ok(i >= 0, `${selector} in admin.css`);
  const open = css.indexOf('{', i + selector.length - 1);
  return css.slice(open + 1, css.indexOf('}', open));
}

test('admin.css: every colour is a token with a light value and the same dark value under both dark rules', () => {
  const css = fs.readFileSync(path.join(PUBLIC, 'admin.css'), 'utf8');
  const js = fs.readFileSync(path.join(PUBLIC, 'admin.js'), 'utf8');
  const rootBlocks = [...css.matchAll(/(^|\n):root\{([^}]*)\}/g)].map(m => m[2]);
  const light = new Set(rootBlocks.flatMap(b => [...defined(b)]));
  const sysDark = blockAfter(css, ':root:not([data-theme="light"]){');
  const keptDark = blockAfter(css, ':root[data-theme="dark"]{');
  assert.match(css, /@media \(prefers-color-scheme:dark\)\{\s*:root:not\(\[data-theme="light"\]\)\{/);
  const used = new Set([...(css + js).matchAll(/var\((--[a-z0-9-]+)\)/g)].map(m => m[1]));
  for(const v of used) assert.ok(light.has(v), `${v} has a light value`);
  // Both dark rules set the same colours to the same values.
  const norm = b => b.replace(/\s+/g, '');
  assert.equal(norm(sysDark), norm(keptDark), 'the system-dark and kept-dark rules agree');
  for(const v of used){
    if(/^--font-/.test(v)) continue;
    assert.ok(defined(sysDark).has(v), `${v} has a dark value`);
  }
  // The CAP light palette.
  const lightText = rootBlocks.join(';');
  for(const [k, v] of [['--ink', '#001871'], ['--line', '#9EA2A2'], ['--action', '#FFCD00'], ['--on-action', '#001871'], ['--bar', '#001871'], ['--panel', '#FFFFFF']]){
    assert.match(lightText, new RegExp(`${k}:${v};`), `light ${k} ${v}`);
  }
  assert.match(lightText, /color-scheme:light/);
  assert.match(sysDark, /color-scheme:dark/);
  // No colour outside the token blocks.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)\s*(:root(:not\(\[data-theme="light"\]\))?|:root\[data-theme="dark"\])\{[^}]*\}/g, '');
  assert.doesNotMatch(rules, /#[0-9A-Fa-f]{3,8}\b|rgba?\(/, 'a colour written into a rule instead of a token');
});

// admin-theme.js in a small stand-in for the page.
function runTheme({ stored = null, systemDark = false } = {}){
  const store = new Map(stored ? [['capubAdminTheme', stored]] : []);
  const attrs = new Map();
  const listeners = {};
  const button = { hidden: true, textContent: 'Dark mode', dataset: {}, attrs: {}, setAttribute(k, v){ this.attrs[k] = v; }, addEventListener(t, f){ this.click = f; } };
  const document = {
    readyState: 'complete',
    documentElement: { getAttribute: k => attrs.has(k) ? attrs.get(k) : null, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k) },
    querySelectorAll: sel => (sel === '[data-theme-toggle]' ? [button] : []),
    addEventListener(){}
  };
  const window = {
    matchMedia: q => ({ matches: q === '(prefers-color-scheme: dark)' && systemDark, addEventListener(){} }),
    addEventListener: (t, f) => { listeners[t] = f; }
  };
  const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
  vm.runInNewContext(fs.readFileSync(path.join(PUBLIC, 'admin-theme.js'), 'utf8'), { window, document, localStorage });
  return { store, attrs, button, listeners };
}

test('admin-theme.js: the system decides until a choice is kept under capubAdminTheme; the button names the other theme', () => {
  const src = fs.readFileSync(path.join(PUBLIC, 'admin-theme.js'), 'utf8');
  assert.doesNotMatch(src, /'capubTheme'/, 'not the builder\'s key');

  let t = runTheme({ systemDark: false });
  assert.equal(t.attrs.get('data-theme'), undefined, 'nothing kept: no attribute, the CSS follows the system');
  assert.equal(t.button.hidden, false);
  assert.equal(t.button.textContent, 'Dark mode');
  t.button.click();
  assert.equal(t.attrs.get('data-theme'), 'dark');
  assert.equal(t.store.get('capubAdminTheme'), 'dark');
  assert.equal(t.button.textContent, 'Light mode');
  assert.equal(t.button.attrs['aria-label'], 'Switch to light mode');
  t.button.click();
  assert.equal(t.attrs.get('data-theme'), 'light');
  assert.equal(t.store.get('capubAdminTheme'), 'light');
  assert.equal(t.button.textContent, 'Dark mode');

  t = runTheme({ systemDark: true });
  assert.equal(t.button.textContent, 'Light mode', 'a dark system shows Light mode');
  t.button.click();
  assert.equal(t.attrs.get('data-theme'), 'light');

  t = runTheme({ stored: 'light', systemDark: true });
  assert.equal(t.attrs.get('data-theme'), 'light', 'a kept choice wins over the system, before the page is read');
  assert.equal(t.button.textContent, 'Dark mode');
  t = runTheme({ stored: 'nonsense', systemDark: true });
  assert.equal(t.attrs.get('data-theme'), undefined, 'a bad value is ignored');
  // Another admin tab switched.
  t = runTheme({});
  t.store.set('capubAdminTheme', 'dark');
  t.listeners.storage({ key: 'capubAdminTheme' });
  assert.equal(t.attrs.get('data-theme'), 'dark');
  assert.equal(t.button.textContent, 'Light mode');
});

function get(port, p, headers = {}){
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p, headers: Object.assign({ Host: `127.0.0.1:${port}` }, headers) }, res => {
      const chunks = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

test('the service sends /admin/theme.js without the cookie (also when admin is off); app.js and app.css stay gated', async () => {
  for(const adminPassword of [PASSWORD, '']){
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uniform-api-theme-'));
    const svc = createService({ dataDir, adminPassword, cookieSecure: false, log: () => {} });
    await new Promise(r => svc.server.listen(0, '127.0.0.1', r));
    const port = svc.server.address().port;
    try{
      const r = await get(port, '/admin/theme.js');
      assert.equal(r.status, 200, `theme.js with admin ${adminPassword ? 'on' : 'off'}`);
      assert.match(r.headers['content-type'], /^text\/javascript/);
      assert.match(r.headers['content-security-policy'], /script-src 'self'/);
      assert.equal(r.text, fs.readFileSync(path.join(PUBLIC, 'admin-theme.js'), 'utf8'));
      const page = await get(port, '/admin');
      assert.match(page.text, /data-theme-toggle/);
      if(adminPassword){
        assert.equal((await get(port, '/admin/app.js')).status, 401);
        assert.equal((await get(port, '/admin/app.css')).status, 401);
      }
    }finally{
      await svc.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }
});
