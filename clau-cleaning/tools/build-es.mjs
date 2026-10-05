// Generates es/index.html (Spanish) from index.html + tools/es.json.
// Run after any change to index.html:  npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dict = JSON.parse(readFileSync(join(root, 'tools/es.json'), 'utf8'));
const $ = cheerio.load(readFileSync(join(root, 'index.html'), 'utf8'), { decodeEntities: false });
const missing = new Set();
const t = (key) => {
    if (!(key in dict)) { missing.add(key); return null; }
    return dict[key];
};

$('html').attr('lang', 'es');

$('[data-i18n]').each((_, el) => {
    const v = t($(el).attr('data-i18n'));
    if (v !== null) $(el).text(v);
});
$('[data-i18n-html]').each((_, el) => {
    const v = t($(el).attr('data-i18n-html'));
    if (v !== null) $(el).html(v);
});
$('[data-i18n-attr]').each((_, el) => {
    for (const pair of $(el).attr('data-i18n-attr').split(';')) {
        const [attr, key] = pair.split(':');
        const v = t(key);
        if (v !== null) $(el).attr(attr, v);
    }
});

$('link[rel="canonical"]').attr('href', 'https://claucleaning.com/es/');

// Relative paths: the Spanish page lives one folder deeper.
const local = (v) => v && !/^(https?:|mailto:|tel:|#|data:|\.\.\/|\/)/.test(v);
$('[src], [href]').each((_, el) => {
    for (const attr of ['src', 'href']) {
        const v = $(el).attr(attr);
        if (local(v)) $(el).attr(attr, v === './' ? '../' : v === 'es/' ? './' : '../' + v);
    }
});
$('.lang-switch a').removeClass('is-active').removeAttr('aria-current');
$('.lang-switch a[hreflang="es"]').addClass('is-active').attr('aria-current', 'true');

mkdirSync(join(root, 'es'), { recursive: true });
writeFileSync(join(root, 'es/index.html'), $.html());

if (missing.size) {
    console.warn('Missing Spanish keys:', [...missing].join(', '));
    process.exitCode = 1;
} else {
    console.log('es/index.html generated');
}
