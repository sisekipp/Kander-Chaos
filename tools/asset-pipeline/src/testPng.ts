import { deflateSync } from 'node:zlib';

/** Kleiner PNG-Kodierer für Tests (RGB, Filter je Zeile wählbar). */
export function encodePng(w: number, h: number, rgb: number[][], filter = 0): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (name: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, body.length);
    out.set(
      [...name].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(body, 8);
    dv.setUint32(8 + body.length, crc(out.subarray(4, 8 + body.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw: number[] = [];
  for (let y = 0; y < h; y++) {
    raw.push(filter);
    for (let x = 0; x < w; x++) {
      const p = rgb[y * w + x];
      for (let k = 0; k < 3; k++) {
        const left = x > 0 ? rgb[y * w + x - 1][k] : 0;
        raw.push(filter === 1 ? (p[k] - left) & 255 : p[k]);
      }
    }
  }
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(raw))),
    chunk('IEND', new Uint8Array()),
  ];
  return Uint8Array.from(parts.flatMap((p) => [...p]));
}
