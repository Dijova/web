# SGM Clean Solutions – Website

Static website for SGM Clean Solutions (floor maintenance and cleaning services).

- **Language:** English by default, with a Spanish translation available from the
  language selector in the header (the choice is remembered). A language can also
  be forced with `?lang=es` / `?lang=en`. All texts live in `translations.js`.
- **Quote form:** validated in the browser and sent to a Google Apps Script backend
  that stores requests in a private Google Sheet and emails the business.
  Setup and security details: [`backend/google-apps-script/README.md`](backend/google-apps-script/README.md).

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page markup (English). Translatable elements use `data-i18n*` attributes. |
| `translations.js` | English and Spanish texts. |
| `config.js` | Form endpoint URL and optional Cloudflare Turnstile site key. |
| `script.js` | Language switching, form validation/submission, UI behaviour. |
| `tawk.js` | Tawk.to live-chat loader. |
| `style.css` | Styles. |
| `backend/google-apps-script/Code.gs` | Secure form backend (paste into Apps Script). |

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
