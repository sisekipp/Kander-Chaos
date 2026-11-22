import { describe, expect, it } from 'vite-plus/test';
import { PropKind, SignVariant } from '@kandern/world-format';
import { readOsmProps, signVariant } from './osm.ts';

const node = (id: number, tags: Record<string, string>) => ({ type: 'node', id, lat: 47.7, lon: 7.66, tags });
const project = () => [10, 20] as [number, number];

describe('weitere Kleinobjekte aus OSM', () => {
  it('Schildtyp aus traffic_sign', () => {
    expect(signVariant('DE:205')).toBe(SignVariant.Triangle);
    expect(signVariant('DE:206')).toBe(SignVariant.Triangle);
    expect(signVariant('DE:274[30];DE:350')).toBe(SignVariant.BlueSquare);
    expect(signVariant('de:350-10')).toBe(SignVariant.BlueSquare);
    expect(signVariant('DE:274[30]')).toBe(SignVariant.Round);
  });

  it('Briefkasten, Hydrant (nur überirdisch), Poller, Fahrradbügel, Litfaßsäule', () => {
    const r = readOsmProps(
      {
        elements: [
          node(1, { amenity: 'post_box' }),
          node(2, { emergency: 'fire_hydrant', 'fire_hydrant:type': 'pillar' }),
          node(3, { emergency: 'fire_hydrant', 'fire_hydrant:type': 'underground' }),
          node(4, { barrier: 'bollard' }),
          node(5, { amenity: 'bicycle_parking' }),
          node(6, { advertising: 'column' }),
          node(7, { traffic_sign: 'DE:205' }),
        ],
      } as never,
      project,
    );
    expect(r.props.map((p) => p.kind)).toEqual([
      PropKind.PostBox,
      PropKind.Hydrant,
      PropKind.Bollard,
      PropKind.BikeRack,
      PropKind.AdColumn,
      PropKind.Sign,
    ]);
    expect(r.props.at(-1)!.variant).toBe(SignVariant.Triangle);
  });
});
