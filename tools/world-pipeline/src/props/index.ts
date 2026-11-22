import { tileId, type TileData } from '@kandern/world-format';
import { ConflictMap, isCarriageway } from './conflicts.ts';
import { fillProps } from './fill.ts';
import type { OsmProps } from './osm.ts';
import { placeParking } from './parking.ts';
import type { WorldParking, WorldProp } from './types.ts';

export { readOsmProps } from './osm.ts';
export type { OsmProps } from './osm.ts';

/**
 * Setzt Kleinobjekte und Parkpositionen in alle Kacheln (deterministisch, Reihenfolge nach Kachel-ID):
 * 1. echte OSM-Objekte (nicht auf Fahrbahnen), 2. Ergänzung nach Regeln, 3. Parkpositionen.
 * Konflikte werden gegen Straßen/Gebäude der Kachel und ihrer Nachbarn geprüft.
 */
export function addPropsToTiles(tiles: TileData[], osm: OsmProps): { props: number; parking: number } {
  const byId = new Map(tiles.map((t) => [tileId(t.tx, t.tz), t]));
  const size = tiles[0]?.size ?? 250;
  const osmByTile = new Map<string, WorldProp[]>();
  for (const p of osm.props) {
    const id = tileId(Math.floor(p.x / size), Math.floor(p.z / size));
    let l = osmByTile.get(id);
    if (!l) osmByTile.set(id, (l = []));
    l.push(p);
  }
  let nProps = 0,
    nParking = 0;
  for (const t of [...tiles].sort((a, b) => a.tz - b.tz || a.tx - b.tx)) {
    const map = new ConflictMap(t.tx, t.tz, t.size);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const n = byId.get(tileId(t.tx + dx, t.tz + dz));
        if (n) map.addTile(n);
      }
    const props: WorldProp[] = [];
    for (const p of osmByTile.get(tileId(t.tx, t.tz)) ?? []) {
      if (!map.isFree(p.x, p.z, 0.2, true)) continue; // OSM-Punkt liegt auf Fahrbahn/in Gebäude -> weglassen
      map.fillCircle(p.x, p.z, 0.6);
      props.push(p);
    }
    props.push(...fillProps({ tile: t, map, anchors: osm.anchors }));
    const parking: WorldParking[] = placeParking(t, map, osm.lots);
    const ox = t.tx * t.size,
      oz = t.tz * t.size;
    t.props = props.map((p) => ({ ...p, x: round2(p.x - ox), z: round2(p.z - oz), rot: round3(p.rot) }));
    t.parking = parking.map((p) => ({ ...p, x: round2(p.x - ox), z: round2(p.z - oz), heading: round3(p.heading) }));
    nProps += t.props.length;
    nParking += t.parking.length;
  }
  return { props: nProps, parking: nParking };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
export { isCarriageway };
