/**
 * CLAU Cleaning Corp — quote form backend (Google Apps Script).
 *
 * Stores each quote request in a private Google Sheet and emails a plain-text
 * notification to the business. See README.md in this folder for setup.
 *
 * Security measures:
 *  - Strict server-side validation and length limits on every field.
 *  - Spreadsheet formula-injection protection (values starting with = + - @ are escaped).
 *  - Honeypot field and minimum fill time to reject bots.
 *  - Rate limiting per email and globally (CacheService).
 *  - LockService to avoid concurrent write corruption.
 *  - Plain-text notification email: user input is never rendered as HTML or links.
 *  - The sheet is never exposed: the web app only accepts POST and returns a status.
 */

var CONFIG = {
  SHEET_NAME: 'Quote Requests',
  NOTIFY_EMAIL: 'claucleaningcorpc2@gmail.com',
  // Leave empty to accept any origin, or list the live site origins, e.g. ['https://claucleaning.com'].
  ALLOWED_PAGES: [],
  MIN_FILL_MS: 3000,
  PER_EMAIL_WINDOW_S: 600,   // 1 request per email every 10 minutes
  GLOBAL_LIMIT: 30,          // max requests per hour for the whole form
  SERVICES: ['medical', 'school', 'office', 'disinfection', 'deep', 'contract', 'other']
};

var HEADERS = ['Timestamp', 'Name', 'Email', 'Phone', 'Service', 'Message', 'Language', 'Consent', 'Page'];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 5000) {
      return respond_('error', 'invalid_request');
    }

    var data = JSON.parse(e.postData.contents);

    // Bot traps: silently "succeed" so bots get no signal.
    if (data.website || Number(data.elapsed) < CONFIG.MIN_FILL_MS) {
      return respond_('success');
    }

    var clean = {
      name: sanitize_(data.name, 100),
      email: sanitize_(data.email, 150).toLowerCase(),
      phone: sanitize_(data.phone, 25),
      service: sanitize_(data.service, 30),
      message: sanitize_(data.message, 1000),
      lang: data.lang === 'es' ? 'es' : 'en',
      consent: data.consent === 'yes' ? 'yes' : 'no',
      page: sanitize_(data.page, 200)
    };

    var errors = validate_(clean);
    if (errors.length) return respond_('error', errors.join(','));

    if (CONFIG.ALLOWED_PAGES.length && !CONFIG.ALLOWED_PAGES.some(function (o) { return clean.page.indexOf(o) === 0; })) {
      return respond_('error', 'origin');
    }

    if (isRateLimited_(clean.email)) return respond_('error', 'rate_limited');

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet_();
      sheet.appendRow([
        new Date(),
        escapeCell_(clean.name),
        escapeCell_(clean.email),
        escapeCell_(clean.phone),
        escapeCell_(clean.service),
        escapeCell_(clean.message),
        clean.lang,
        clean.consent,
        escapeCell_(clean.page)
      ]);
    } finally {
      lock.releaseLock();
    }

    notify_(clean);
    return respond_('success');
  } catch (err) {
    console.error(err);
    return respond_('error', 'server');
  }
}

// GET is intentionally disabled so nobody can read data through the web app URL.
function doGet() {
  return respond_('error', 'method_not_allowed');
}

function validate_(d) {
  var errors = [];
  if (d.name.length < 2) errors.push('name');
  if (!/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/.test(d.email)) errors.push('email');
  if (d.phone && !/^[+]?[0-9\s().-]{7,20}$/.test(d.phone)) errors.push('phone');
  if (CONFIG.SERVICES.indexOf(d.service) === -1) errors.push('service');
  if (d.consent !== 'yes') errors.push('consent');
  // Reject messages full of links (typical spam / phishing payloads).
  if ((d.message.match(/https?:\/\/|www\./gi) || []).length > 1) errors.push('links');
  return errors;
}

function sanitize_(value, max) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

// Prevents spreadsheet formula / CSV injection.
function escapeCell_(value) {
  return /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
}

function isRateLimited_(email) {
  var cache = CacheService.getScriptCache();
  var key = 'e_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email));
  if (cache.get(key)) return true;

  var hourKey = 'g_' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  var count = Number(cache.get(hourKey) || 0);
  if (count >= CONFIG.GLOBAL_LIMIT) return true;

  cache.put(key, '1', CONFIG.PER_EMAIL_WINDOW_S);
  cache.put(hourKey, String(count + 1), 3600);
  return false;
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function notify_(d) {
  if (!CONFIG.NOTIFY_EMAIL) return;
  var body = [
    'New quote request from the website',
    '',
    'Name:     ' + d.name,
    'Email:    ' + d.email,
    'Phone:    ' + (d.phone || '-'),
    'Service:  ' + d.service,
    'Language: ' + d.lang,
    '',
    'Message:',
    d.message || '-',
    '',
    '---',
    'Security reminder: CLAU Cleaning Corp will never ask for passwords or payments through this form.',
    'Do not open links or attachments from unknown senders. Reply only from your own email client.'
  ].join('\n');

  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: 'New quote request – ' + d.name.slice(0, 60),
    body: body,
    name: 'CLAU Cleaning Corp Website',
    noReply: true
  });
}

function respond_(result, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: result, code: code || null }))
    .setMimeType(ContentService.MimeType.JSON);
}
