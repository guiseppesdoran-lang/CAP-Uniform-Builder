# CAP Uniform Builder — Patch Submission Email Setup

The public GitHub Pages site cannot send email attachments by itself. The included Google Apps Script web app handles the email securely from your Google account.

## What is already in the repository

- `patch-submission.js` — the canonical user-facing upload form and confirmed transport.
- `patch-submission-v2.js` — a compatibility loader for browsers that cached the previous feature loader. Do not add it directly to the page.
- `google-apps-script/Code.gs` — the email handler.
- The handler emails each valid submission to:
  - guiseppe.s.doran@gmail.com
  - 658773@tncap.us

The form asks for:
- Patch name
- Unit/activity
- Submitter name (optional)
- Submitter email (optional)
- Patch image
- Notes (optional)

At least the patch name or unit/activity is required. Accepted files: PNG, JPG/JPEG, WEBP, SVG. Maximum 4 MB.

## One-time Google Apps Script deployment

1. Sign into the Google account that should send the patch-submission emails.
2. Go to Google Apps Script and create a new project.
3. Replace the default `Code.gs` contents with the contents of this repository's `google-apps-script/Code.gs`.
4. Save the project. A name such as `CAP Uniform Builder Patch Submission` is recommended.
5. Click **Deploy → New deployment**.
6. Choose **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone** so users of the public builder can submit patches.
9. In **Project Settings → Script properties**, add `CAPUB_ADMIN_PASSWORD_SHA256`. Set its value to the same SHA-256 hash used by `ADMIN_SHA256` in `admin-history.js`.
10. Click **Deploy** and authorize the script to send email and manage its shared-history spreadsheet.
11. Copy the deployed web-app URL. It will normally end in `/exec`.

When updating an existing deployment, use **Deploy → Manage deployments → Edit**, choose **New version**, and deploy it. Saving `Code.gs` alone does not update the live `/exec` endpoint. Run `testPatchEmail()` and `testSharedHistoryStorage()` once after replacing the backend code so Google requests the required Gmail and Sheets permissions before testing the public site.

## Shared uniform history

The same Apps Script deployment stores generated uniform profiles in a Google Sheet owned by the deployment account. The sheet is created automatically as **CAP Uniform Builder Shared History** when the first uniform is generated after deployment.

- Generating/downloading a uniform writes a shared record and a local fallback record.
- Opening the admin console merges records from all computers with the current browser's fallback history.
- Shared admin list, save, unsave, import, cleanup, and delete operations require the admin password.
- The raw admin password is never committed to this repository. Apps Script hashes the entered password and compares it with the `CAPUB_ADMIN_PASSWORD_SHA256` script property.
- Unsaved shared records expire after 24 hours. Saved records remain until unsaved or deleted.

After updating `Code.gs`, a **new deployment version is required** before cross-computer history will work. The admin console reports this explicitly if the website has updated but Apps Script is still running an older version.

## Connect the builder to the deployment

Open `purchase-feature.js` in the repository and add this line before the feature scripts are loaded:

```js
window.CAPUB_PATCH_SUBMISSION_ENDPOINT = 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE';
```

`index.html` loads `patch-submission.js` directly after the feature loader. Keep its version query current when the submission code changes; direct loading prevents a cached chained loader from silently restoring an older submission implementation.

The repository version is designed so the endpoint is kept in one configuration line. The recipients remain controlled by the Apps Script rather than by values submitted from the browser.

## Security notes

- Users cannot choose email recipients; the recipients are fixed in `Code.gs`.
- The script validates image MIME type and file size again server-side.
- A honeypot and short browser-side cooldown reduce simple automated spam.
- Do not place Google passwords, OAuth tokens, Gmail passwords, or API secrets in the GitHub repository.
- Treat the Apps Script project and generated history spreadsheet as private administrative data. Do not share edit access with public users.
- Because the endpoint accepts public submissions, Apps Script email quotas still apply.
