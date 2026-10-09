# Deploying the builder (static site)

The builder is plain static files. `npm run build` copies just the files the page needs into
`dist/`; that directory is the web root. Nothing in it runs on the server.

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

## Publishing

Copy `dist/` to the web root (for example `rsync -a --delete dist/ server:/var/www/ebhq/dist/`).
Deploy as an unprivileged user that has write access to the web root only, and keep the web
server's own account read-only.

## Home-server notes

- Expose only port 443 (and 80 for the redirect). A Cloudflare Tunnel or similar keeps the home IP
  address out of public DNS and removes the need to open ports at all.
- Keep the OS, the web server and the certificate renewal job updated; check that renewal works
  before the first certificate expires.
- The site holds no user data and has no server-side code, so there is nothing to back up except
  the repository and the server configuration.
- Check headers after any change: `curl -sI https://ebhq.dev/ | grep -iE 'content-security|strict-transport|nosniff|referrer'`.
