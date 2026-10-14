/*
 * Site configuration.
 *
 * FORM_ENDPOINT: URL of the Google Apps Script Web App that stores the quote
 * requests (see backend/google-apps-script/README.md). After pasting the new
 * Code.gs, redeploy as a *new version of the same deployment* to keep this URL.
 *
 * TURNSTILE_SITE_KEY: optional Cloudflare Turnstile site key (free anti-bot
 * check). Leave empty to disable. If you set it, also set the matching
 * TURNSTILE_SECRET in the Apps Script "Script properties".
 */
window.SGM_CONFIG = Object.freeze({
    FORM_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxFkXgFlGUfAVALmkDtQfR5ZlGQ8SBx6e-010a7GV09QYdRcfPN6ktocBHYGEtJtdHg/exec',
    TURNSTILE_SITE_KEY: '',
    DEFAULT_LANGUAGE: 'en',
    SUPPORTED_LANGUAGES: ['en', 'es']
});
