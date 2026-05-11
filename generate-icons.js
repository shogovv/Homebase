#!/usr/bin/env node
// Generates icons/icon{16,48,128}.png using only Node.js built-ins.
// Icon design: indigo-to-purple gradient background, white "home" silhouette.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  return Buffer.concat([u32(data.length), t, data, u32(crc32(Buffer.concat([t, data])))]);
}

function makePNG(size, draw) {
  const px = new Uint8Array(size * size * 3).fill(255); // RGB, white init
  draw(px, size);

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0;
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      raw[off++] = px[i]; raw[off++] = px[i + 1]; raw[off++] = px[i + 2];
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([u32(size), u32(size), Buffer.from([8, 2, 0, 0, 0])]));
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function setpx(px, size, x, y, r, g, b) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 3;
  px[i] = r; px[i + 1] = g; px[i + 2] = b;
}

function fillRect(px, size, x0, y0, x1, y1, r, g, b) {
  for (let y = Math.max(0, y0); y <= Math.min(size - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(size - 1, x1); x++)
      setpx(px, size, x, y, r, g, b);
}

function fillCircle(px, size, cx, cy, radius, r, g, b) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++)
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius)
        setpx(px, size, x, y, r, g, b);
}

// Draws a filled convex polygon by scanline
function fillPoly(px, size, pts, r, g, b) {
  const ys = pts.map(p => p[1]);
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...ys)));
  const n = pts.length;
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      if ((y0 <= y && y < y1) || (y1 <= y && y < y0)) {
        xs.push(x0 + (y - y0) * (x1 - x0) / (y1 - y0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < xs.length - 1; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(size - 1, Math.floor(xs[k + 1]));
      for (let x = xa; x <= xb; x++) setpx(px, size, x, y, r, g, b);
    }
  }
}

function gradientColor(x, y, size) {
  const t = (x + y) / (size * 2);
  const r = Math.round(99 + (168 - 99) * t);   // #6366f1 → #a855f7
  const g = Math.round(102 + (85 - 102) * t);
  const b = Math.round(241 + (247 - 241) * t);
  return [r, g, b];
}

function fillRoundedRectGrad(px, size, pad, br) {
  for (let y = pad; y < size - pad; y++) {
    for (let x = pad; x < size - pad; x++) {
      const inCornerTL = x < pad + br && y < pad + br;
      const inCornerTR = x >= size - pad - br && y < pad + br;
      const inCornerBL = x < pad + br && y >= size - pad - br;
      const inCornerBR = x >= size - pad - br && y >= size - pad - br;

      let inside = true;
      if (inCornerTL) {
        inside = (x - (pad + br)) ** 2 + (y - (pad + br)) ** 2 <= br * br;
      } else if (inCornerTR) {
        inside = (x - (size - pad - br - 1)) ** 2 + (y - (pad + br)) ** 2 <= br * br;
      } else if (inCornerBL) {
        inside = (x - (pad + br)) ** 2 + (y - (size - pad - br - 1)) ** 2 <= br * br;
      } else if (inCornerBR) {
        inside = (x - (size - pad - br - 1)) ** 2 + (y - (size - pad - br - 1)) ** 2 <= br * br;
      }

      if (inside) {
        const [r, g, b] = gradientColor(x, y, size);
        setpx(px, size, x, y, r, g, b);
      }
    }
  }
}

function drawIcon(px, size) {
  const s = size / 16;
  const [R, G, B] = [255, 255, 255];

  const pad = 0;
  const br = 0;
  fillRoundedRectGrad(px, size, pad, br);

  // Home plate pentagon (baseball home base) — float coords for perfect symmetry
  const cx = size / 2;
  const top    = 2.5 * s;
  const bottom = 13.5 * s;
  const mid    = 9.5 * s;
  const left   = 3.5 * s;
  const right  = 12.5 * s;
  fillPoly(px, size, [
    [left,  top],
    [right, top],
    [right, mid],
    [cx,    bottom],
    [left,  mid],
  ], R, G, B);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

for (const size of [16, 48, 128]) {
  const png = makePNG(size, drawIcon);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath}`);
}
