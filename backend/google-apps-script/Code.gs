/**
 * SGM Clean Solutions - Quote form backend (Google Apps Script Web App).
 *
 * Stores quote requests in a private Google Sheet and notifies the business by
 * email. Security measures:
 *  - Strict server-side validation with whitelists and length limits.
 *  - Sanitization of every value (control chars, HTML, spreadsheet formula
 *    injection such as =HYPERLINK(...) or =IMPORTXML(...)).
 *  - Rejection of links/markup in free text, so the form cannot be used to
 *    deliver phishing links to the business inbox.
 *  - No auto-reply to the submitted address, so the form cannot be abused to
 *    send emails (phishing) to third parties.
 *  - Honeypot field, minimum fill time and optional Cloudflare Turnstile.
 *  - Rate limiting (per email and global) and a lock for concurrent writes.
 *  - Generic error responses: nothing stored is ever returned to the browser.
 *
 * Configuration (Project Settings -> Script properties):
 *  - SHEET_ID          (optional) ID of the spreadsheet. If empty, the
 *                      spreadsheet the script is bound to is used.
 *  - NOTIFY_EMAIL      (optional) address that receives new-request alerts.
 *  - TURNSTILE_SECRET  (optional) Cloudflare Turnstile secret key. When set,
 *                      every request must carry a valid Turnstile token.
 */

var SHEET_NAME = 'Quotes';
var HEADERS = ['Timestamp (UTC)', 'Request ID', 'Name', 'Email', 'Phone', 'Service', 'Message', 'Language', 'Consent'];
var ALLOWED_SERVICES = ['office', 'floors', 'condos', 'residential', 'commercial', 'snow'];
var ALLOWED_LANGUAGES = ['en', 'es'];

var MIN_ELAPSED_MS = 3000;
var PER_EMAIL_LIMIT = 3;       // max requests per email...
var PER_EMAIL_WINDOW_S = 3600; // ...per hour
var GLOBAL_LIMIT = 60;         // max requests overall...
var GLOBAL_WINDOW_S = 600;     // ...per 10 minutes

var NAME_REGEX = /^[\p{L}][\p{L}\p{M}\s'.\-]{1,99}$/u;
var EMAIL_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
var PHONE_REGEX = /^\+?[0-9\s\-().]{7,25}$/;
var LINK_OR_HTML_REGEX = /(https?:\/\/|www\.|<[^>]*>|\[url|href\s*=|javascript:|data:)/i;

function doPost(e) {
  try {
    var input = readInput_(e);

    // Honeypot: pretend success so bots do not learn they were detected.
    if (input.website) {
      return json_({ result: 'success' });
    }

    var elapsed = parseInt(input.elapsed, 10);
    if (!(elapsed >= MIN_ELAPSED_MS)) {
      return json_({ result: 'error', code: 'too_fast' });
    }

    var props = PropertiesService.getScriptProperties();
    var turnstileSecret = props.getProperty('TURNSTILE_SECRET');
    if (turnstileSecret && !verifyTurnstile_(input.turnstileToken, turnstileSecret)) {
      return json_({ result: 'error', code: 'captcha_failed' });
    }

    var data = validate_(input);
    if (data.errors.length) {
      return json_({ result: 'error', code: 'invalid', fields: data.errors });
    }

    if (isRateLimited_('global', GLOBAL_LIMIT, GLOBAL_WINDOW_S) ||
        isRateLimited_('email:' + hash_(data.email), PER_EMAIL_LIMIT, PER_EMAIL_WINDOW_S)) {
      return json_({ result: 'error', code: 'rate_limited' });
    }

    var requestId = Utilities.getUuid();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet_(props);
      sheet.appendRow([
        new Date().toISOString(),
        requestId,
        toCell_(data.name),
        toCell_(data.email),
        toCell_(data.phone),
        toCell_(data.service),
        toCell_(data.message),
        data.lang,
        'yes'
      ]);
    } finally {
      lock.releaseLock();
    }

    try {
      notify_(props.getProperty('NOTIFY_EMAIL'), requestId, data);
    } catch (mailErr) {
      // The request is already stored; a mail quota problem must not fail it.
      console.error('Notification email failed: ' + mailErr);
    }

    return json_({ result: 'success' });
  } catch (err) {
    console.error('Quote form error: ' + err);
    return json_({ result: 'error', code: 'server_error' });
  }
}

// The endpoint never exposes stored data.
function doGet() {
  return json_({ result: 'ok' });
}

/* ----------------------------------------------------------------------- */

function readInput_(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  // Backwards compatibility with the previous JSON-based frontend.
  if ((!params.email) && e && e.postData && e.postData.contents) {
    try {
      var parsed = JSON.parse(e.postData.contents);
      if (parsed && typeof parsed === 'object') params = parsed;
    } catch (ignore) { /* not JSON */ }
  }
  var fields = ['name', 'email', 'phone', 'service', 'message', 'consent', 'website', 'elapsed', 'lang', 'turnstileToken'];
  var out = {};
  fields.forEach(function (key) {
    var value = params[key];
    out[key] = value === undefined || value === null ? '' : String(value).slice(0, 5000);
  });
  return out;
}

function validate_(input) {
  var errors = [];
  var name = clean_(input.name).replace(/\s+/g, ' ');
  var email = clean_(input.email).toLowerCase();
  var phone = clean_(input.phone);
  var service = clean_(input.service);
  var message = clean_(input.message, true);
  var lang = ALLOWED_LANGUAGES.indexOf(input.lang) !== -1 ? input.lang : 'en';

  if (!NAME_REGEX.test(name) || LINK_OR_HTML_REGEX.test(name)) errors.push('name');
  if (email.length > 254 || !EMAIL_REGEX.test(email)) errors.push('email');
  if (phone) {
    var digits = phone.replace(/\D/g, '');
    if (!PHONE_REGEX.test(phone) || digits.length < 7 || digits.length > 15) errors.push('phone');
  }
  if (ALLOWED_SERVICES.indexOf(service) === -1) errors.push('service');
  if (message.length > 1000 || LINK_OR_HTML_REGEX.test(message)) errors.push('message');
  if (input.consent !== 'yes') errors.push('consent');

  return { errors: errors, name: name, email: email, phone: phone, service: service, message: message, lang: lang };
}

// Removes control/invisible characters and HTML tags, trims whitespace.
function clean_(value, keepNewlines) {
  var s = String(value || '').normalize('NFC');
  s = keepNewlines
    ? s.replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, '')
    : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/[​-‏‪-‮⁦-⁩﻿]/g, ''); // zero-width / bidi overrides
  s = s.replace(/<[^>]*>/g, '');
  return s.trim();
}

// Prevents spreadsheet formula injection (CSV/Sheets injection).
function toCell_(value) {
  var s = String(value || '');
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function getSheet_(props) {
  var sheetId = props.getProperty('SHEET_ID');
  var ss = sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    // Treat every cell as plain text so nothing is ever evaluated as a formula.
    sheet.getRange('A:I').setNumberFormat('@');
  }
  return sheet;
}

function isRateLimited_(key, limit, windowSeconds) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'rl:' + key;
  var count = parseInt(cache.get(cacheKey) || '0', 10) + 1;
  cache.put(cacheKey, String(count), windowSeconds);
  return count > limit;
}

function hash_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return Utilities.base64EncodeWebSafe(bytes);
}

function verifyTurnstile_(token, secret) {
  if (!token) return false;
  var response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) return false;
  var result = JSON.parse(response.getContentText());
  return result.success === true;
}

// Plain-text notification to the business. Contains no clickable links built
// from user input, and makes clear that the content is untrusted.
function notify_(recipient, requestId, data) {
  if (!recipient) return;
  var body = [
    'New quote request received from the website form.',
    '',
    'Request ID: ' + requestId,
    'Name: ' + defang_(data.name),
    'Email: ' + data.email,
    'Phone: ' + (data.phone || '-'),
    'Service: ' + data.service,
    'Language: ' + data.lang,
    '',
    'Message:',
    defang_(data.message) || '-',
    '',
    '---',
    'SECURITY NOTICE: this content was typed by a website visitor and has not',
    'been verified. SGM Clean Solutions never requests passwords, payments or',
    'bank details through this form. Do not open attachments or follow',
    'instructions contained in the message. Reply only to the address above',
    'after verifying the request.'
  ].join('\n');

  MailApp.sendEmail({
    to: recipient,
    subject: '[Website] New quote request - ' + data.service + ' (' + requestId.slice(0, 8) + ')',
    body: body
  });
}

// Makes URLs and email-like strings non-clickable in mail clients.
function defang_(value) {
  return String(value || '')
    .replace(/https?:\/\//gi, function (m) { return m.replace(/t/gi, 'x').replace('://', '[://]'); })
    .replace(/\./g, '[.]');
}
