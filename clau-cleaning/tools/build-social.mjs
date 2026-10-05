// Renders every [data-export] element of social/src/assets.html to social/export/<name>.png
// at its real pixel size (profile pictures, Facebook cover, highlight covers, post templates).
// Run:  node tools/build-social.mjs   (uses the Playwright install available on the machine)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'social/export');
mkdirSync(outDir, { recursive: true });

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
await page.goto(pathToFileURL(join(root, 'social/src/assets.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);

const items = await page.$$('[data-export]');
for (const el of items) {
    const name = await el.getAttribute('data-export');
    await el.screenshot({ path: join(outDir, name) });
}
// Half-size JPEG previews, embedded in the profiles mockup (social/mockup).
const previewDir = join(outDir, 'preview');
mkdirSync(previewDir, { recursive: true });
const small = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 0.5 });
await small.goto(pathToFileURL(join(root, 'social/src/assets.html')).href);
await small.evaluate(() => document.fonts.ready);
await small.waitForTimeout(500);
for (const el of await small.$$('[data-export]')) {
    const name = (await el.getAttribute('data-export')).replace(/\.png$/, '.jpg');
    await el.screenshot({ path: join(previewDir, name), type: 'jpeg', quality: 82 });
}
await browser.close();
console.log(`${items.length} images (+ previews) written to social/export/`);
