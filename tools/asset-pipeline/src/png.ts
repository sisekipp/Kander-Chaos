import { inflateSync } from 'node:zlib';

/** Dekodiertes Bild: RGBA, 8 Bit je Kanal, zeilenweise von oben. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Minimaler PNG-Dekoder für Paletten-Texturen der Modellpakete: 8 Bit, Farbtyp RGB (2), RGBA (6) oder
 * indiziert (3), ohne Zeilensprung. Reicht für `colormap.png` u. ä.; anderes wird mit Fehler abgelehnt.
 */
export function decodePng(bytes: Uint8Array): RgbaImage {
  if (!SIGNATURE.every((v, i) => bytes[i] === v)) throw new Error('keine PNG-Datei');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8,
    width = 0,
    height = 0,
    depth = 0,
    type = 0,
    interlace = 0;
  let palette: Uint8Array | null = null;
  let alpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const name = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const body = bytes.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = body[8];
      type = body[9];
      interlace = body[12];
    } else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') alpha = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || ![2, 3, 6].includes(type))
    throw new Error(`PNG nicht unterstützt (Tiefe ${depth}, Typ ${type}, Zeilensprung ${interlace})`);
  const channels = type === 2 ? 3 : type === 6 ? 4 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
      const v = src[x];
      px[y * stride + x] =
        (f === 0 ? v : f === 1 ? v + a : f === 2 ? v + b : f === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c)) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (type === 3) {
      const k = px[i];
      data.set(
        [palette![k * 3], palette![k * 3 + 1], palette![k * 3 + 2], alpha && k < alpha.length ? alpha[k] : 255],
        i * 4,
      );
    } else {
      data[i * 4] = px[i * channels];
      data[i * 4 + 1] = px[i * channels + 1];
      data[i * 4 + 2] = px[i * channels + 2];
      data[i * 4 + 3] = channels === 4 ? px[i * channels + 3] : 255;
    }
  }
  return { width, height, data };
}

/** Farbe am Texturpunkt (u, v) in glTF-Konvention (v = 0 oben), nächster Texel, 0 … 1. */
export function sampleRgb(img: RgbaImage, u: number, v: number): [number, number, number] {
  const x = Math.min(img.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * img.width)));
  const y = Math.min(img.height - 1, Math.max(0, Math.floor((v - Math.floor(v)) * img.height)));
  const i = (y * img.width + x) * 4;
  return [img.data[i] / 255, img.data[i + 1] / 255, img.data[i + 2] / 255];
}
