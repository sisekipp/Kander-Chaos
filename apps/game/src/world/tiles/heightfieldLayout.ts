/**
 * Havok-Layout eines Höhenrasters wie Babylons Ground-Mesh-Konvertierung: Zeilen = z gespiegelt,
 * Spalten = x, Höhen relativ zum Minimum. Reine Funktion (testbar).
 */
export function toHavokHeightfield(heights: Float32Array, samples: number): { data: Float32Array; min: number } {
  let min = Infinity;
  for (let i = 0; i < heights.length; i++) min = Math.min(min, heights[i]);
  const n = samples;
  const data = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[(n - 1 - j) * n + i] = heights[j * n + i] - min;
  return { data, min };
}
