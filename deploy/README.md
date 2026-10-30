# Deploying the builder

The builder is plain static files. `npm run build` copies just the files the page needs into
`dist/`; that directory is the web root. Nothing in it runs on the server. Beside it runs one small
service, `uniform-api` (`deploy/api`), for the anonymous usage counts, the feedback box and the
`/admin` dashboard; see [The API and /admin](#the-api-and-admin).

```bash
npm run build                  # dist/ with submissions off (the default)
npm run serve:dist             # preview it locally at http://127.0.0.1:8780 with the real headers
```

To enable the optional patch/calibration submissions for a deployment, give the build an endpoint
(see `PATCH_SUBMISSION_SETUP.md`); the page's policy then allows exactly that origin:

```bash
CAPUB_SUBMISSION_ENDPOINT='https://script.google.com/macros/s/.../exec' npm run build
```

## Server configuration

Pick the example for your web server and adjust the paths:

- `nginx.conf.example`
- `Caddyfile.example`

Both set HTTPS-only (`.dev` domains are HSTS-preloaded, so browsers will not use plain HTTP anyway),
the Content-Security-Policy and related headers, no directory listing, no dotfiles, `GET`/`HEAD`
only, and sensible caching (`index.html` is always revalidated; assets carry content hashes in
their URLs). The policy comes from `scripts/csp.cjs`; the security test fails if the examples
drift from it.

## Access code

The page asks for an access code before it shows the builder (`js/access-gate.js`). It keeps the
site from being a public, searchable CAP-looking page; it is not security, and the code is in the
source on purpose. Change it by editing `ACCESS_CODE` in that file. Responses also carry
`X-Robots-Tag: noindex`, and the page has a `noindex` meta tag.

## Publishing

Copy `dist/` to the web root (for example `rsync -a --delete dist/ server:/var/www/ebhq/dist/`).
Deploy as an unprivileged user that has write access to the web root only, and keep the web
server's own account read-only.

## Home-server notes

- Expose only port 443 (and 80 for the redirect). A Cloudflare Tunnel or similar keeps the home IP
  address out of public DNS and removes the need to open ports at all.
- Keep the OS, the web server and the certificate renewal job updated; check that renewal works
  before the first certificate expires.
- The static site holds no user data. The API's data is `deploy/var` on the server (below); back
  that up with the repository and the server configuration.
- Check headers after any change: `curl -sI https://ebhq.dev/ | grep -iE 'content-security|strict-transport|nosniff|referrer'`.

## The API and /admin

`uniform-api` is a Node 22 service with no dependencies (`deploy/api`: `service.js`, `store.js`,
`metrics.js`, `pages.js`, `public/`). `deploy/docker-compose.yml` builds it from `deploy/api/Dockerfile`
(node:22-alpine, runs as the `node` user, uid 1000, read-only except `/data`) and runs it on the
`proxy` network with no host port. `deploy/Caddyfile.tunnel` sends `/api/*`, `/admin` and `/admin/*`
to `uniform-api:8080` before the static rules; the GET/HEAD-only rule and the cache policy apply to
the static site only.

| Path | What |
|---|---|
| `POST /api/events` | anonymous usage events from `js/telemetry.js` (16 KB and 50 events per batch at most) |
| `POST /api/feedback` | a feedback message from `js/feedback.js` (4000 characters; contact 200) |
| `GET /api/health` | `{"ok":true,"admin":true}`; `admin` is false until the password is set |
| `GET /admin` | the password form, then the dashboard (a signed HttpOnly SameSite=Strict cookie, 12 h) |
| `GET /api/admin/summary`, `/events`, `/feedback`, `/export.csv?what=events\|feedback` | the dashboard's data (cookie only) |
| `POST /api/admin/feedback/:id/read`, `/archive`, `POST /admin/logout` | inbox flags and sign-out (cookie only) |

Five wrong passwords from one address lock sign-in from it for 60 s. Addresses are only hashed in
memory for that and for the rate limits (120 event batches per 10 min, 8 feedback messages an hour);
they are never written down.

### deploy/.env: the admin password

The service reads its settings from `deploy/.env` on the server (`env_file` in the compose file). It
is in `.gitignore`; never create it, or `deploy/var`, in a local checkout, because the deploy rsync
copies every local file and would overwrite the server's.

```bash
# on the Services VM, in ~/stacks/apps/uniform-builder
umask 077
cat > deploy/.env <<'ENV'
ADMIN_PASSWORD=choose-a-long-passphrase-here
TIMEZONE=America/New_York
ENV
mkdir -p deploy/var && sudo chown 1000:1000 deploy/var   # the container runs as uid 1000
docker compose -f deploy/docker-compose.yml up -d --build
```

- `ADMIN_PASSWORD` (required for `/admin`; without it `/admin` answers 503 and the log says why;
  the counts and feedback still work). Use a long passphrase.
- `TIMEZONE` (optional, default UTC): the dashboard's days, an IANA name.
- `SESSION_SECRET` (optional): the key that signs the admin cookie. Without it one is made at first
  start and kept in `deploy/var/session-secret`.

To change the password, edit `ADMIN_PASSWORD` in `deploy/.env` and run
`docker compose -f deploy/docker-compose.yml up -d uniform-api` (compose recreates the container when
its environment changes). Every open admin session is signed out, since the cookie key depends on
the password.

### Checking it

```bash
docker compose -f deploy/docker-compose.yml ps                  # uniform-api healthy
docker logs uniform-api                                         # "listening on 0.0.0.0:8080, data in /data ..."
curl -s https://uniform.ebhq.dev/api/health                     # {"ok":true,"admin":true}
curl -sI https://uniform.ebhq.dev/admin | grep -i cache-control # no-store
```

Then open `https://uniform.ebhq.dev/admin`, sign in, and build a uniform on the site in another tab:
the visit and the build show in the live log within about 15 s.

### The data, backups and retention

Everything is in `deploy/var` on the server (the container's `/data`):

- `events-YYYY-MM.jsonl`: one anonymous event per line, a file per month (UTC).
- `feedback.jsonl`: one feedback message per line; `feedback-state.json`: the read and archived flags.
- `session-secret`: the cookie key, if `SESSION_SECRET` is not set.

The files are only ever appended to (the flags file is replaced whole), so a copy taken at any time
is consistent: `tar czf uniform-api-$(date +%F).tgz -C deploy var` and keep it off the VM. Nothing
is deleted automatically: the data is kept until Ethan decides otherwise. To drop a month, stop the
service, delete its `events-YYYY-MM.jsonl` and start it again (the service loads the files at start).
The dashboard's CSV exports are another way to take a copy.

### What is collected

`js/telemetry.js` sends, to this site only: a random visitor id kept in the browser's localStorage, a
random id per page load, and events: `visit` (guest or code, phone/tablet/desktop, theme, new or
returning), `build` (uniform, cut, membership, grade, counts of ribbons, devices, badges, military
badges, patches and cords, uniform options changed from their defaults, whether a member report
import fed it), `png_download`, `import` (ok or failed, item counts), `remove_ribbons`, `templates`,
`shopping_open`, `feedback_sent`, `uniform_switch`, `setup_file` and `error` (message and file). It
never sends a name, CAPID, nameplate or duty-title text, a unit charter, member report contents or
file names. With Do Not Track or Global Privacy Control on, only `visit` and `build` go, without any
id. `CAPUB_CONFIG.metrics = false` in `config.js` turns it off; `CAPUB_CONFIG.feedback = false`
hides the Feedback link.
