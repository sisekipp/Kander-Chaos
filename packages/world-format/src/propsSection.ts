import type { ByteReader, ByteWriter } from './bytes.ts';
import type { ParkingSpot, Prop } from './types.ts';

/**
 * Abschnitt 6 „Props“: Kleinobjekte und Parkpositionen. Optional und hinten angehängt –
 * Leser ohne Kenntnis des Abschnitts überspringen ihn, daher keine neue Formatversion nötig.
 */
export function writeProps(s: ByteWriter, props: Prop[], parking: ParkingSpot[]): void {
  s.u32(props.length);
  for (const p of props) {
    s.u8v(p.kind);
    s.u8v(p.variant);
    s.f32(p.x);
    s.f32(p.z);
    s.f32(p.rot);
  }
  s.u32(parking.length);
  for (const p of parking) {
    s.f64(p.id);
    s.u8v(p.kind);
    s.f32(p.x);
    s.f32(p.z);
    s.f32(p.heading);
  }
}

export function readProps(r: ByteReader): { props: Prop[]; parking: ParkingSpot[] } {
  const props: Prop[] = [];
  const n = r.u32();
  for (let i = 0; i < n; i++) {
    const kind = r.u8v();
    const variant = r.u8v();
    props.push({ kind, variant, x: r.f32(), z: r.f32(), rot: r.f32() });
  }
  const parking: ParkingSpot[] = [];
  const m = r.u32();
  for (let i = 0; i < m; i++) {
    const id = r.f64();
    const kind = r.u8v();
    parking.push({ id, kind, x: r.f32(), z: r.f32(), heading: r.f32() });
  }
  return { props, parking };
}
