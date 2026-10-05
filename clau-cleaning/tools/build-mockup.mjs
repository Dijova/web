// Builds mockup/index.html: a single self-contained presentation page for the client.
// Screenshots live in mockup/screens/; fonts and the logo are embedded as data URIs.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const logo = (word, sub, id) => readFileSync(join(root, 'assets/img/logo.svg'), 'utf8')
    .replace(/<\?xml[^>]*>/, '')
    .replace(/id="g"/, `id="${id}"`).replace(/url\(#g\)/, `url(#${id})`)
    .replace(/<title id="t">[^<]*<\/title>/, '').replace(/ aria-labelledby="t"/, ' aria-label="CLAU Cleaning Corp"')
    .replace('fill="#0B2540">CLAU', `fill="${word}">CLAU`).replace('fill="#0E5AA7">CLEANING', `fill="${sub}">CLEANING`);

const vars = {
    'font-poppins-600': dataUri(join(root, 'assets/fonts/poppins-600-latin.woff2'), 'font/woff2'),
    'font-poppins-700': dataUri(join(root, 'assets/fonts/poppins-700-latin.woff2'), 'font/woff2'),
    'font-poppins-800': dataUri(join(root, 'assets/fonts/poppins-800-latin.woff2'), 'font/woff2'),
    'font-inter': dataUri(join(root, 'assets/fonts/inter-var-latin.woff2'), 'font/woff2'),
    'logo-light': logo('#0B2540', '#0E5AA7', 'lg1'),
    'logo-dark': logo('#FFFFFF', '#8CD3DD', 'lg2')
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
