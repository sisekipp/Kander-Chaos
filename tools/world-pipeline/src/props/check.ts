import type { TileData, WorldIndex } from '@kandern/world-format';

export interface PropsCheck {
  ok: boolean;
  messages: string[];
}

/** Spec-Prüfungen für Kleinobjekte und Parkpositionen rund um den Startpunkt (Blumenplatz). */
export function checkProps(index: WorldIndex, tiles: TileData[], radius = 300): PropsCheck {
  const { x: sx, z: sz } = index.spawn;
  let parking = 0;
  const kinds = new Set<number>();
  let total = 0;
  for (const t of tiles) {
    const ox = t.tx * t.size,
      oz = t.tz * t.size;
    total += t.props?.length ?? 0;
    for (const p of t.parking ?? []) if (Math.hypot(ox + p.x - sx, oz + p.z - sz) <= radius) parking++;
    for (const p of t.props ?? []) if (Math.hypot(ox + p.x - sx, oz + p.z - sz) <= radius) kinds.add(p.kind);
  }
  const messages: string[] = [];
  let ok = true;
  if (total === 0) {
    return { ok: false, messages: ['keine Kleinobjekte in den Kacheln (osm-props.json fehlt?)'] };
  }
  if (parking >= 10) messages.push(`✔ ${parking} Parkpositionen im Umkreis von ${radius} m um den Blumenplatz`);
  else {
    messages.push(`✘ nur ${parking} Parkpositionen um den Blumenplatz (< 10)`);
    ok = false;
  }
  if (kinds.size >= 3) messages.push(`✔ ${kinds.size} Arten von Kleinobjekten in der Kernstadt`);
  else {
    messages.push(`✘ nur ${kinds.size} Arten von Kleinobjekten in der Kernstadt (< 3)`);
    ok = false;
  }
  return { ok, messages };
}
