/** Ausländische Höhen an einer UTM-Position: zuerst swissALTI3D, dann IGN; NaN ohne Daten. */
import { fromUtm, toLambert93, toLv95 } from './proj.ts';
import type { TileIndex } from './raster.ts';

export function foreignSampler(swiss: TileIndex, france: TileIndex): (e: number, n: number) => number {
  return (e, n) => {
    const p = fromUtm(e, n);
    const ch = toLv95(p.lat, p.lon);
    const h = swiss.sample(ch.e, ch.n);
    if (!Number.isNaN(h)) return h;
    const fr = toLambert93(p.lat, p.lon);
    return france.sample(fr.x, fr.y);
  };
}
