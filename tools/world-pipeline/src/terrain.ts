import { quantizeHeight, type HeightLod, type HeightQuantization } from '@kandern/world-format';

/** Höhenquelle in Weltkoordinaten (m). */
export type HeightFn = (x: number, z: number) => number;

/**
 * Erzeugt die Höhen-LODs einer Kachel. Randwerte werden an exakt denselben Weltkoordinaten
 * abgetastet wie in der Nachbarkachel und mit der globalen Quantisierung gespeichert ->
 * bitgleiche Kanten.
 */
export function buildTerrainLods(
  height: HeightFn,
  tx: number,
  tz: number,
  size: number,
  lodSamples: number[],
  quant: HeightQuantization,
): HeightLod[] {
  return lodSamples.map((samples) => {
    const heights = new Uint16Array(samples * samples);
    const step = size / (samples - 1);
    for (let j = 0; j < samples; j++) {
      // j/i == samples-1 exakt auf die Kante legen (keine Rundungsdrift durch step * i)
      const z = j === samples - 1 ? (tz + 1) * size : tz * size + j * step;
      for (let i = 0; i < samples; i++) {
        const x = i === samples - 1 ? (tx + 1) * size : tx * size + i * step;
        heights[j * samples + i] = quantizeHeight(quant, height(x, z));
      }
    }
    return { samples, heights };
  });
}
