import { describe, expect, it } from 'vite-plus/test';
import { LandKind, PropKind } from '@kandern/world-format';
import { ConflictMap } from './conflicts.ts';
import { fillProps } from './fill.ts';
import { propTile } from './testFixtures.ts';

function run() {
  const tile = propTile();
  tile.land = [{ kind: LandKind.Residential, rings: [new Float32Array([0, 0, 250, 0, 250, 250, 0, 250])] }];
  const map = new ConflictMap(0, 0, 250);
  map.addTile(tile);
  const ref = new ConflictMap(0, 0, 250);
  ref.addTile(tile);
  return { props: fillProps({ tile, map, anchors: [{ x: 200, z: 200, kind: 'bus_stop' }] }), ref };
}

describe('Ergänzung von Kleinobjekten', () => {
  it('ist deterministisch', () => {
    expect(run().props).toEqual(run().props);
  });

  it('setzt Laternen, Büsche, Zäune und Bank/Mülleimer', () => {
    const kinds = new Set(run().props.map((p) => p.kind));
    for (const k of [PropKind.Lamp, PropKind.Bush, PropKind.Bench, PropKind.Bin]) expect(kinds.has(k)).toBe(true);
    const lamps = run().props.filter((p) => p.kind === PropKind.Lamp);
    expect(lamps.length).toBeGreaterThanOrEqual(6); // 250 m Straße / ~30 m
  });

  it('nichts auf der Fahrbahn oder im Gebäude', () => {
    const { props, ref } = run();
    for (const p of props) expect(ref.isFree(p.x, p.z, 0.2, true)).toBe(true);
  });
});
