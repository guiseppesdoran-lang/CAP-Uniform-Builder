'use strict';
// The admin pages the service writes itself: the password form, the dashboard's shell and the "not set up" page. No inline
// script anywhere (the CSP is script-src 'self'); the shell loads /admin/app.js and /admin/app.css, which need the cookie.
// The fonts are the site's own (vendor/fonts, served by Caddy beside this service); without them the system fonts stand in.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HEAD = title => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;

// The small page style for the form (inline styles are allowed: style-src 'unsafe-inline').
const FORM_STYLE = `<style>
@font-face{font-family:"Rajdhani";src:url("/vendor/fonts/Rajdhani-Bold.woff2") format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Ubuntu";src:url("/vendor/fonts/Ubuntu-Regular.woff2") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Ubuntu";src:url("/vendor/fonts/Ubuntu-Bold.woff2") format("woff2");font-weight:700;font-display:swap}
:root{--blue:#001871;--ink:#10131A;--muted:#464B53;--line:#C9CCD3;--bg:#ECECEC;--panel:#fff;--red:#BA0C2F;--red-bg:#F1CED5;--yellow:#FFCD00}
@media (prefers-color-scheme:dark){:root{--ink:#F2F4FA;--muted:#B9BED0;--line:#2C3769;--bg:#070B22;--panel:#0F1739;--red-bg:#4a0f1d}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--ink);font:400 15px/1.5 "Ubuntu",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{width:min(400px,100%);background:var(--panel);border:1px solid var(--line);border-top:6px solid var(--blue);border-radius:8px;padding:24px}
h1{margin:0 0 4px;font:700 28px/1.1 "Rajdhani","Arial Narrow",system-ui,sans-serif;letter-spacing:.02em}
p{margin:0 0 16px;color:var(--muted)}
label{display:block;font-weight:700;margin:0 0 6px}
input{width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font:inherit}
input:focus{outline:3px solid var(--yellow);outline-offset:1px;border-color:var(--blue)}
button{margin-top:16px;width:100%;min-height:44px;border:0;border-radius:6px;background:var(--blue);color:#fff;font:700 18px/1 "Rajdhani","Arial Narrow",system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}
@media (prefers-color-scheme:dark){button{background:var(--yellow);color:#10131A}}
.error{margin:12px 0 0;padding:8px 12px;border-radius:6px;background:var(--red-bg);color:var(--ink);border-left:4px solid var(--red)}
</style>`;

function login({ error }){
  return `${HEAD('Uniform Builder admin')}
${FORM_STYLE}
</head>
<body>
<main>
  <h1>Uniform Builder admin</h1>
  <p>Usage counts and member feedback. Enter the admin password.</p>
  <form method="post" action="/admin" autocomplete="off">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
    <button type="submit">Sign in</button>
  </form>
</main>
</body>
</html>
`;
}

function notConfigured(){
  return `${HEAD('Uniform Builder admin')}
${FORM_STYLE}
</head>
<body>
<main>
  <h1>Not set up</h1>
  <p>The admin dashboard is off because ADMIN_PASSWORD is not set. Put it in deploy/.env on the server and restart the uniform-api container (see deploy/README.md).</p>
</main>
</body>
</html>
`;
}

// The dashboard's shell. app.js fills each section from /api/admin/*.
function dashboard(){
  return `${HEAD('Uniform Builder admin')}
<link rel="stylesheet" href="/admin/app.css">
<script src="/admin/app.js" defer></script>
</head>
<body>
<header class="bar">
  <div class="brand"><span class="brandName">Uniform Builder</span><span class="brandSub">Admin</span></div>
  <div class="barActions">
    <label class="rangePick">Tables for
      <select id="range">
        <option value="today">today</option>
        <option value="7d">the last 7 days</option>
        <option value="30d" selected>the last 30 days</option>
        <option value="all">all time</option>
      </select>
    </label>
    <span id="updated" class="updated" aria-live="polite"></span>
    <form method="post" action="/admin/logout"><button type="submit" class="ghost">Sign out</button></form>
  </div>
</header>
<main id="dash">
  <section aria-labelledby="tilesTitle">
    <h2 id="tilesTitle" class="sr">Totals</h2>
    <div id="tiles" class="tiles"></div>
  </section>

  <section class="card" aria-labelledby="chartTitle">
    <div class="cardHead"><h2 id="chartTitle">Builds per day</h2><span class="hint">the last 60 days, with visits</span></div>
    <div id="chart" class="chart"></div>
  </section>

  <div class="grid2">
    <section class="card" aria-labelledby="uniTitle"><div class="cardHead"><h2 id="uniTitle">Uniforms built</h2><span class="hint">once per visit per uniform</span></div><div id="uniforms"></div></section>
    <section class="card" aria-labelledby="whoTitle"><div class="cardHead"><h2 id="whoTitle">Who builds</h2></div><div id="who"></div></section>
    <section class="card" aria-labelledby="gradeTitle"><div class="cardHead"><h2 id="gradeTitle">Grades</h2></div><div id="grades"></div></section>
    <section class="card" aria-labelledby="featTitle"><div class="cardHead"><h2 id="featTitle">Features used</h2></div><div id="features"></div></section>
    <section class="card" aria-labelledby="itemsTitle"><div class="cardHead"><h2 id="itemsTitle">What goes on a uniform</h2><span class="hint">average per uniform built</span></div><div id="items"></div></section>
    <section class="card" aria-labelledby="visitTitle"><div class="cardHead"><h2 id="visitTitle">Visits</h2></div><div id="visits"></div></section>
    <section class="card" aria-labelledby="optTitle"><div class="cardHead"><h2 id="optTitle">Uniform options set</h2><span class="hint">options changed from the default</span></div><div id="options"></div></section>
    <section class="card" aria-labelledby="errTitle"><div class="cardHead"><h2 id="errTitle">Top errors</h2><span class="hint">script errors members' browsers hit</span></div><div id="errors"></div></section>
  </div>

  <section class="card" aria-labelledby="fbTitle">
    <div class="cardHead">
      <h2 id="fbTitle">Feedback</h2>
      <div class="seg" role="radiogroup" aria-label="Show">
        <button type="button" role="radio" data-status="unread" aria-checked="false">Unread</button>
        <button type="button" role="radio" data-status="all" aria-checked="true">Inbox</button>
        <button type="button" role="radio" data-status="archived" aria-checked="false">Archived</button>
      </div>
    </div>
    <div id="inbox" class="inbox"></div>
  </section>

  <section class="card" aria-labelledby="logTitle">
    <div class="cardHead"><h2 id="logTitle">Live log</h2><span class="hint">the latest 200 events, refreshed every 15 s</span></div>
    <div id="log" class="log"></div>
  </section>

  <section class="card" aria-labelledby="dataTitle">
    <div class="cardHead"><h2 id="dataTitle">Data</h2></div>
    <div class="exports">
      <a class="button" href="/api/admin/export.csv?what=events" download>Export events (CSV)</a>
      <a class="button" href="/api/admin/export.csv?what=feedback" download>Export feedback (CSV)</a>
    </div>
    <div class="notes">
      <p><b>Retention.</b> Everything is kept until Ethan says otherwise. The events are one file per month and the feedback one file, in deploy/var on the server (deploy/README.md says how to back them up or delete a month).</p>
      <p><b>What is collected.</b> Anonymous events: a random visitor id kept in the member's browser (none when the browser sends Do Not Track), a random id per page load, and what was done: the uniform, cut, membership, grade, how many ribbons, devices, badges, military badges, patches and cords, which uniform options are set, and which buttons were used. Script errors carry their message and file. Feedback carries the message, the contact the member chose to give, the page, and, if they ticked the box, the same anonymous setup summary.</p>
      <p><b>What is not collected.</b> No names, CAPIDs, nameplate or duty-title text, member report contents or file names, unit charters, IP addresses (only hashed in memory for the sign-in lockout and rate limits, never written), cookies on the member's side, or anything from other sites.</p>
    </div>
  </section>
</main>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
</body>
</html>
`;
}

module.exports = { login, notConfigured, dashboard, esc };
