/** Geometriepuffer, die der Worker als Transferables an den Hauptthread schickt. */
export interface GeometryBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  uvs?: Float32Array;
  uvs2?: Float32Array;
}

export const transferablesOf = (g: GeometryBuffers | null | undefined): ArrayBuffer[] =>
  g
    ? ([g.positions, g.normals, g.colors, g.indices, g.uvs, g.uvs2]
        .filter(Boolean)
        .map((a) => a!.buffer) as ArrayBuffer[])
    : [];

type V3 = [number, number, number];
type RGB = [number, number, number];

/**
 * Sammelt Dreiecke mit flachen Normalen. Wickelreihenfolge wird automatisch an die gewünschte
 * Außennormale angepasst. Babylon (linkshändig, Standard-Seitenorientierung): Vorderseite ist,
 * wo cross(b-a, c-a) NICHT hinzeigt – im Browser verifiziert.
 */
export class GeoBuilder {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private uv: number[] = [];
  private uv2: number[] = [];
  private idx: number[] = [];
  constructor(private readonly withUv = false) {}

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  private vert(p: V3, n: V3, c: RGB, uv?: [number, number], uv2?: [number, number]): number {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2], 1);
    if (this.withUv) {
      this.uv.push(uv?.[0] ?? 0, uv?.[1] ?? 0);
      this.uv2.push(uv2?.[0] ?? 0, uv2?.[1] ?? 0);
    }
    return this.pos.length / 3 - 1;
  }

  /**
   * Dreieck mit flacher Normale. `outward` gibt die gewünschte Außenrichtung vor (z. B. nach oben).
   * Farben/UVs je Ecke optional.
   */
  tri(
    a: V3,
    b: V3,
    c: V3,
    outward: V3,
    cols: [RGB, RGB, RGB],
    uvs?: [[number, number], [number, number], [number, number]],
    uv2?: [number, number],
  ): void {
    let n = cross(sub(b, a), sub(c, a));
    if (dot(n, outward) > 0) {
      [b, c] = [c, b];
      cols = [cols[0], cols[2], cols[1]];
      if (uvs) uvs = [uvs[0], uvs[2], uvs[1]];
      n = [-n[0], -n[1], -n[2]];
    }
    // cross zeigt jetzt nach innen -> gespeicherte Normale = Außenrichtung
    const nn = normalize([-n[0], -n[1], -n[2]]);
    const i0 = this.vert(a, nn, cols[0], uvs?.[0], uv2);
    const i1 = this.vert(b, nn, cols[1], uvs?.[1], uv2);
    const i2 = this.vert(c, nn, cols[2], uvs?.[2], uv2);
    this.idx.push(i0, i1, i2);
  }

  /** Viereck a-b-c-d (Umlauf beliebig, aber planar), zerlegt in zwei Dreiecke. */
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    outward: V3,
    cols: [RGB, RGB, RGB, RGB],
    uvs?: [[number, number], [number, number], [number, number], [number, number]],
    uv2?: [number, number],
  ): void {
    this.tri(a, b, c, outward, [cols[0], cols[1], cols[2]], uvs && [uvs[0], uvs[1], uvs[2]], uv2);
    this.tri(a, c, d, outward, [cols[0], cols[2], cols[3]], uvs && [uvs[0], uvs[2], uvs[3]], uv2);
  }

  build(): GeometryBuffers | null {
    if (this.idx.length === 0) return null;
    const g: GeometryBuffers = {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nor),
      colors: new Float32Array(this.col),
      indices: new Uint32Array(this.idx),
    };
    if (this.withUv) {
      g.uvs = new Float32Array(this.uv);
      g.uvs2 = new Float32Array(this.uv2);
    }
    return g;
  }
}

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function normalize(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
