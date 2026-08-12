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
9. Click **Deploy** and authorize the script to send email.
10. Copy the deployed web-app URL. It will normally end in `/exec`.

When updating an existing deployment, use **Deploy → Manage deployments → Edit**, choose **New version**, and deploy it. Saving `Code.gs` alone does not update the live `/exec` endpoint. Run `testPatchEmail()` once after replacing the backend code so Google requests the required Gmail permission before testing the public form.

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
- Because the endpoint accepts public submissions, Apps Script email quotas still apply.
