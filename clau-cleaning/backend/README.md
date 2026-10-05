# Quote form backend — setup (≈10 min)

The website form stores requests in a **private Google Sheet** owned by CLAU Cleaning Corp
and sends a plain-text email alert. No server or paid hosting needed.

1. Sign in to the business Google account (`claucleaningcorpc2@gmail.com`).
2. Create a new Google Sheet named **CLAU – Quote Requests**. Do **not** share it publicly.
3. In the sheet: **Extensions → Apps Script**. Delete the sample code and paste `Code.gs`.
4. (Optional) In `CONFIG.ALLOWED_PAGES` add the live domain, e.g. `['https://claucleaning.com']`.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (required so the public form can post; the script only accepts
     validated POSTs and never returns sheet data).
6. Authorize the permissions and copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).
7. Paste that URL into `FORM_ENDPOINT` at the top of `assets/js/main.js`, then rebuild the
   Spanish page (`node tools/build-es.mjs`) and publish.

## What protects the data

| Threat | Protection |
| --- | --- |
| Bots / spam | Honeypot field, minimum fill time, link limit, per-email and hourly rate limits |
| Formula / CSV injection in the sheet | Values starting with `= + - @` are escaped |
| HTML / script injection | `<` `>` and control characters stripped on client and server; emails are plain text |
| Phishing through the form | Notification email contains no clickable user content and a security reminder; site CSP blocks third-party scripts and only allows posting to Google Apps Script |
| Data leaks | Sheet stays private; the web app has no read endpoint (`doGet` disabled) |
| Transport | HTTPS only (Apps Script + `upgrade-insecure-requests`) |

Turn on **2-Step Verification** for the Google account that owns the sheet.
