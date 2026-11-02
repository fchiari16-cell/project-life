// Generates PWA icons (PNG) without external image libraries.
// Design: indigo background with a light ring and centre dot ("life cycle" mark).
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../apps/web/public/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, { maskable }) {
  const bg = [0x43, 0x38, 0xca];
  const fg = [0xe8, 0xea, 0xf2];
  // Maskable icons keep the mark inside the central 80% safe zone.
  const scale = maskable ? 0.62 : 0.8;
  const cx = size / 2;
  const rOuter = (size / 2) * scale * 0.9;
  const rInner = rOuter * 0.78;
  const rDot = rOuter * 0.32;
  const cornerR = maskable ? 0 : size * 0.22;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cx);
      const inRing = d <= rOuter && d >= rInner;
      const inDot = d <= rDot;
      const col = inRing || inDot ? fg : bg;
      // rounded-corner alpha for non-maskable icons
      const dx = Math.max(cornerR - x - 0.5, x + 0.5 - (size - cornerR), 0);
      const dy = Math.max(cornerR - y - 0.5, y + 0.5 - (size - cornerR), 0);
      const alpha = cornerR > 0 && Math.hypot(dx, dy) > cornerR ? 0 : 255;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
      raw[o + 3] = alpha;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(new URL('icon-192.png', OUT), png(192, { maskable: false }));
writeFileSync(new URL('icon-512.png', OUT), png(512, { maskable: false }));
writeFileSync(new URL('icon-maskable-512.png', OUT), png(512, { maskable: true }));
writeFileSync(
  new URL('icon.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="113" fill="#4338ca"/><circle cx="256" cy="256" r="185" fill="none" stroke="#e8eaf2" stroke-width="40"/><circle cx="256" cy="256" r="58" fill="#e8eaf2"/></svg>\n`,
);
console.log('icons written to apps/web/public');
