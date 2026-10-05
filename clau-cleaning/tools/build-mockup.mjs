// Builds mockup/index.html: a single self-contained presentation page for the client.
// Screenshots live in mockup/screens/; fonts and logos are embedded as data URIs.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const svg = (name) => dataUri(join(root, 'assets/img', name), 'image/svg+xml');

const vars = {
    'font-comfortaa': dataUri(join(root, 'assets/fonts/comfortaa-var-latin.woff2'), 'font/woff2'),
    'font-inter': dataUri(join(root, 'assets/fonts/inter-var-latin.woff2'), 'font/woff2'),
    'logo-classic': svg('logo-classic.svg'),
    'logo': svg('logo.svg'),
    'logo-white': svg('logo-white.svg'),
    'logo-horizontal': svg('logo-horizontal.svg'),
    'logo-horizontal-white': svg('logo-horizontal-white.svg'),
    'favicon': svg('favicon.svg')
};
for (const f of readdirSync(join(root, 'mockup/screens'))) {
    vars[f.replace(/\.jpg$/, '')] = dataUri(join(root, 'mockup/screens', f), 'image/jpeg');
}
let n = 0;
let html = readFileSync(join(root, 'mockup/template.html'), 'utf8').replace(/\{\{([\w-]+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error('Missing mockup asset: ' + k);
    n++;
    return vars[k];
});
writeFileSync(join(root, 'mockup/index.html'), html);
console.log(`mockup/index.html built (${n} assets, ${(html.length / 1048576).toFixed(1)} MB)`);
