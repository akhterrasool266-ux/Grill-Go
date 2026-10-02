// Renders the PWA icons (PNG) without any image dependency: tiny rasteriser + zlib.
// Usage: node scripts/make-icons.mjs [#rrggbb]   (default brand green)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const brand = (process.argv[2] ?? '#0b6b5f').replace('#', '');
const BG = [0, 2, 4].map((i) => parseInt(brand.slice(i, i + 2), 16));

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const inPoly = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

// Shapes in a 512 design grid; `scale`/`offset` shrink the glyph for the maskable safe zone.
const cap = [[256, 120], [96, 196], [256, 272], [416, 196]];
const base = [[148, 246], [256, 298], [364, 246], [364, 322], [256, 372], [148, 322]];
const tassel = [[396, 200], [412, 200], [412, 304], [396, 304]];

function render(size, { rounded, glyphScale }) {
  const out = Buffer.alloc(size * size * 4), SS = 3, r = rounded ? 112 : 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let bg = 0, fg = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = ((x + (sx + 0.5) / SS) / size) * 512, py = ((y + (sy + 0.5) / SS) / size) * 512;
      const cx = Math.min(Math.max(px, r), 512 - r), cy = Math.min(Math.max(py, r), 512 - r);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) {
        bg++;
        const gx = (px - 256) / glyphScale + 256, gy = (py - 256) / glyphScale + 250;
        if (inPoly(cap, gx, gy) || inPoly(base, gx, gy) || inPoly(tassel, gx, gy)) fg++;
      }
    }
    const n = SS * SS, i = (y * size + x) * 4, a = bg / n, f = fg / Math.max(bg, 1);
    out[i] = Math.round(BG[0] * (1 - f) + 255 * f); out[i + 1] = Math.round(BG[1] * (1 - f) + 255 * f); out[i + 2] = Math.round(BG[2] * (1 - f) + 255 * f); out[i + 3] = Math.round(a * 255);
  }
  return out;
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size, opts] of [
  ['icon-192.png', 192, { rounded: true, glyphScale: 1 }],
  ['icon-512.png', 512, { rounded: true, glyphScale: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, glyphScale: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false, glyphScale: 0.85 }],
]) { writeFileSync(`public/icons/${name}`, png(size, render(size, opts))); console.log('wrote', name); }
