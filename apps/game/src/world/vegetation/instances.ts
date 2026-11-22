/** Verschiebt die Translation aller 4x4-Instanzmatrizen (16 Floats je Instanz) um (dx, dz). */
export function offsetInstanceMatrices(m: Float32Array, dx: number, dz: number): void {
  for (let k = 0; k < m.length; k += 16) {
    m[k + 12] += dx;
    m[k + 14] += dz;
  }
}
