import { describe, expect, it } from 'vite-plus/test';
import { encodePng } from './testPng.ts';
import { decodePng, sampleRgb } from './png.ts';

describe('PNG-Dekoder', () => {
  const pixels = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 255],
  ];
  it('liest RGB ohne und mit Zeilenfilter', () => {
    for (const filter of [0, 1]) {
      const img = decodePng(encodePng(2, 2, pixels, filter));
      expect([img.width, img.height]).toEqual([2, 2]);
      expect(Array.from(img.data.subarray(0, 8))).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
      expect(Array.from(img.data.subarray(12, 16))).toEqual([255, 255, 255, 255]);
    }
  });

  it('Texturabfrage: v = 0 ist oben (glTF), nächster Texel', () => {
    const img = decodePng(encodePng(2, 2, pixels));
    expect(sampleRgb(img, 0.25, 0.25)).toEqual([1, 0, 0]);
    expect(sampleRgb(img, 0.75, 0.75)).toEqual([1, 1, 1]);
    expect(sampleRgb(img, 0.25, 0.75)).toEqual([0, 0, 1]);
  });

  it('lehnt andere Dateien ab', () => {
    expect(() => decodePng(new Uint8Array(20))).toThrow();
  });
});
