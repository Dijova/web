// Generates the CLAU Cleaning Corp logo family as path-only SVGs (no font dependency).
// Typeface: Comfortaa (SIL Open Font License), the closest free match to the original logo.
// Run:  node tools/build-logo.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (name, svg) => writeFileSync(join(root, 'assets/img', name), svg.trim() + '\n');
const bold = opentype.loadSync(join(root, 'tools/fonts/Comfortaa-Bold.ttf'));
const medium = opentype.loadSync(join(root, 'tools/fonts/Comfortaa-Medium.ttf'));

// Brand colors sampled from the original logo and van lettering.
export const C = {
    forest: '#0F3D25',   // van lettering / dark backgrounds
    green: '#1F7F45',    // logo outline
    leaf: '#86BC42',     // logo fill
    silver: '#A3ABA7',   // broom handle in the original logo
    white: '#FFFFFF'
};

// Lays out a word; the letter "l" is skipped and its stem position returned (it becomes the broom handle).
function word(text, x, y, size, { skipL = false, font = bold } = {}) {
    const scale = size / font.unitsPerEm;
    let cx = x;
    let handleX = null;
    const parts = [];
    const glyphs = font.stringToGlyphs(text);
    glyphs.forEach((g, i) => {
        if (skipL && text[i] === 'l' && handleX === null) {
            handleX = cx + (font === bold ? 112 : 104) * scale; // centre of Comfortaa's "l" stem
        } else {
            parts.push(g.getPath(cx, y, size).toPathData(2));
        }
        cx += g.advanceWidth * scale;
        if (i < glyphs.length - 1) cx += font.getKerningValue(g, glyphs[i + 1]) * scale;
    });
    return { d: parts.join(''), width: cx - x, handleX };
}

function broom(hx, top, bottom, size, color, bristle, stemW = 8.6, handle = color, headWidth = 54) {
    const s = size / 100;
    const stem = stemW * s;            // matches the glyph stem weight
    const headW = headWidth * s, headH = 26 * s, neck = 7 * s;
    const hy = bottom;                 // top of the broom head
    const lines = [];
    for (let i = 1; i < 6; i++) {
        const x = hx - headW / 2 + (headW / 6) * i;
        lines.push(`<rect x="${(x - 0.9 * s).toFixed(2)}" y="${(hy + neck + 7 * s).toFixed(2)}" width="${(1.8 * s).toFixed(2)}" height="${(headH - 10 * s).toFixed(2)}" rx="${(0.9 * s).toFixed(2)}" fill="${bristle}"/>`);
    }
    return `
    <rect x="${(hx - stem / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${stem.toFixed(2)}" height="${(hy - top + neck).toFixed(2)}" rx="${(stem / 2).toFixed(2)}" fill="${handle}"/>
    <path d="M${(hx - headW * 0.36).toFixed(2)} ${(hy + neck).toFixed(2)}h${(headW * 0.72).toFixed(2)}l${(headW * 0.14).toFixed(2)} ${(6 * s).toFixed(2)}v${(headH - 6 * s).toFixed(2)}a${(3 * s).toFixed(2)} ${(3 * s).toFixed(2)} 0 0 1-${(3 * s).toFixed(2)} ${(3 * s).toFixed(2)}h-${(headW - 6 * s).toFixed(2)}a${(3 * s).toFixed(2)} ${(3 * s).toFixed(2)} 0 0 1-${(3 * s).toFixed(2)}-${(3 * s).toFixed(2)}v-${(headH - 6 * s).toFixed(2)}z" fill="${color}"/>
    ${lines.join('\n    ')}`;
}

// Stacked composition of the original logo: Clau / Cleaning / Corp, with the shared "l" as a broom.
function stacked(style) {
    const size = 100, x = 14;
    const font = style === 'classic' ? medium : bold;
    const l1 = word('Clau', x, 82, size, { skipL: true, font });
    const l2 = word('Cleaning', x, 172, size, { skipL: true, font });
    const corpSize = style === 'classic' ? 72 : 88;
    const corpW = word('Corp', 0, 0, corpSize, { font }).width;
    const l3 = word('Corp', x + l2.width - corpW - 4, 252, corpSize, { font });
    const hx = l1.handleX;
    const top = 82 - 78, broomTop = 200;
    const w = Math.ceil(x + l2.width + 14), h = 272;

    if (style === 'classic') {
        // As on the van and the Facebook avatar: outlined light-green letters, darker "Corp", silver handle.
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Clau Cleaning Corp">
  <g stroke="${C.green}" stroke-width="6" stroke-linejoin="round" paint-order="stroke" fill="${C.leaf}">
    <path d="${l1.d + l2.d}"/>
  </g>
  <path fill="${C.green}" d="${l3.d}"/>
  <g stroke="${C.green}" stroke-width="3" paint-order="stroke">${broom(hx, top, broomTop, size, C.leaf, C.white, 6.4, C.silver, 64)}
  </g>
</svg>`;
    }
    const dark = style === 'white' ? C.white : C.green;
    const accent = C.leaf;
    const bristle = style === 'white' ? C.forest : C.white;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Clau Cleaning Corp">
  <path fill="${dark}" d="${l1.d}"/>
  <path fill="${dark}" d="${l2.d}"/>
  <path fill="${accent}" d="${l3.d}"/>${broom(hx, top, broomTop, size, accent, bristle)}
</svg>`;
}

// One-line lockup for website headers: broom monogram + "Clau Cleaning Corp".
function horizontal(style) {
    const size = 100, x = 10;
    const l1 = word('Clau', x, 82, size, { skipL: true });
    const rest = word('Cleaning', x + l1.width + 26, 82, size);
    const corp = word('Corp', x + l1.width + 26 + rest.width + 22, 82, size);
    const w = Math.ceil(x + l1.width + 26 + rest.width + 22 + corp.width + 10);
    const dark = style === 'white' ? C.white : C.green;
    const bristle = style === 'white' ? C.forest : C.white;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 136" role="img" aria-label="Clau Cleaning Corp">
  <path fill="${dark}" d="${l1.d}${rest.d}"/>
  <path fill="${C.leaf}" d="${corp.d}"/>${broom(l1.handleX, 4, 92, size, C.leaf, bristle)}
</svg>`;
}

// App icon / favicon / social avatar: "C" + broom on a forest-green tile.
function icon() {
    const size = 84;
    const c = word('C', 0, 0, size);
    const ox = (128 - (c.width + 26)) / 2;
    const g = word('Cl', ox, 80, size, { skipL: true });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Clau Cleaning Corp">
  <rect width="128" height="128" rx="28" fill="${C.forest}"/>
  <path fill="${C.leaf}" d="${g.d}"/>${broom(g.handleX, 14, 78, size, C.white, C.forest)}
</svg>`;
}

out('logo-classic.svg', stacked('classic'));
out('logo.svg', stacked('refresh'));
out('logo-white.svg', stacked('white'));
out('logo-horizontal.svg', horizontal('refresh'));
out('logo-horizontal-white.svg', horizontal('white'));
out('favicon.svg', icon());
console.log('logos written to assets/img/');
