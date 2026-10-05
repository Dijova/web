// Builds social/mockup/index.html: self-contained Facebook + Instagram profile mockup.
// Run tools/build-social.mjs first so social/export/preview/*.jpg is up to date.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;

const vars = {
    'font-comfortaa': dataUri(join(root, 'assets/fonts/comfortaa-var-latin.woff2'), 'font/woff2'),
    'font-inter': dataUri(join(root, 'assets/fonts/inter-var-latin.woff2'), 'font/woff2'),
    'logo-horizontal-white': dataUri(join(root, 'assets/img/logo-horizontal-white.svg'), 'image/svg+xml')
};
const previews = join(root, 'social/export/preview');
for (const f of readdirSync(previews)) vars[f.replace(/\.jpg$/, '')] = dataUri(join(previews, f), 'image/jpeg');

const html = readFileSync(join(root, 'social/mockup/template.html'), 'utf8').replace(/\{\{([\w-]+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error('Missing asset: ' + k);
    return vars[k];
});
writeFileSync(join(root, 'social/mockup/index.html'), html);
console.log(`social/mockup/index.html built (${(html.length / 1048576).toFixed(1)} MB)`);
