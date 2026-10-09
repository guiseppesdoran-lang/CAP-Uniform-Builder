# Submission endpoint setup (optional)

The builder runs entirely in the browser. Two optional features need a small server
to receive data, so they stay **off** until a deployment points the page at one:

- **Patch submissions** - a visitor uploads a patch image; it is emailed to the administrators.
- **Calibration submissions** - an administrator (in `?dev=1` mode) sends reviewed placement
  changes; they become a GitHub issue plus a backup email.

`google-apps-script/Code.gs` is a ready-made endpoint for Google Apps Script. Any other
server that accepts the same request shape would work too.

## Turning the features on

Set the endpoint in `config.js`:

```js
window.CAPUB_CONFIG = Object.freeze({
  submissionEndpoint: 'https://script.google.com/macros/s/.../exec'
});
```

Leave it empty and the page adds no submission UI and makes no outbound requests. The
calibration submit button additionally needs the page to be opened with `?dev=1`.

## Deploying `Code.gs`

1. Sign in to the Google account that should send the email, open Google Apps Script and
   create a project. Paste the contents of `google-apps-script/Code.gs`.
2. **Project Settings > Script properties**, add:

   | Property | Value |
   | --- | --- |
   | `CAPUB_PATCH_RECIPIENTS` | Comma-separated addresses that receive submissions |
   | `CAPUB_ADMIN_PASSWORD_SHA256` | SHA-256 hex of the admin key (below) |
   | `CAPUB_ADMIN_SALT` | Optional. If set, the stored hash is SHA-256(`salt:key`) |
   | `CAPUB_GITHUB_TOKEN` | Fine-grained token limited to one repository with **Issues: Read and write** |
   | `CAPUB_GITHUB_REPOSITORY` | `owner/repository` (optional if the default in `Code.gs` is right) |

3. **Admin key:** make it a long random passphrase (20+ characters). Compute its hash locally
   (for example `printf '%s' 'the passphrase' | shasum -a 256`) and store only the hash. The
   hash is never sent to or stored in the web page; the key is typed into the calibration
   submission form each time and checked on the server.
4. **Deploy > New deployment > Web app.** Execute as **Me**; access **Anyone**.
5. Run `testPatchEmail()` and `testCalibrationGitHubConfiguration()` once from the editor to
   authorise Gmail and `UrlFetchApp`.
6. Put the deployed `/exec` URL in `config.js`.

When updating an existing deployment use **Deploy > Manage deployments > Edit > New version**;
saving `Code.gs` alone does not change the live endpoint.

## What the endpoint enforces

- Only `calibration_submission` and patch submissions are accepted; any other action is refused.
- Recipients come from a script property, never from the request, and are not echoed back.
- Patch images must be PNG, JPEG or WebP, within 4 MB, and the file's leading bytes must match
  the declared type. SVG is not accepted.
- Patch submissions are rate limited (20 per hour across all callers) and a honeypot field
  discards simple bots.
- Calibration submissions require the admin key, compared in constant time. After 10 failed
  attempts in an hour every attempt is refused until the window passes.
- `GET` requests reveal nothing about the account or its configuration.

## Calibration workflow

1. Open the builder with `?dev=1`, open the **CAL** panel and enable Calibrate Mode.
2. Adjust an item and leave it selected (Ctrl/Shift-click selects several related items).
3. **Submit Calibration Update**, describe the correction, enter the admin key.
4. The browser sends the selected assets' coordinates, the uniform setup and a preview image.
5. The endpoint creates a `[Calibration]` GitHub issue with the machine-readable package and
   emails a backup copy.

## Security notes

- Never put the admin key, its hash, the GitHub token or email addresses in this repository,
  `index.html` or `config.js`.
- Revoke and replace the GitHub token immediately if it is ever exposed.
- Treat the Apps Script project as private administrative data. Do not share edit access.
- Apps Script email quotas still apply to a public endpoint.
