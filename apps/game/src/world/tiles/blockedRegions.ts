/**
 * Nachladeregionen (Spec regional-streaming), reine Logik ohne Babylon:
 * - `lookAheadTiles`: Kacheln entlang des Wegs der nächsten Sekunden (Vorausladen der Regionspakete)
 * - `borderPush`: weiche Grenze vor gesperrten Kacheln (abbremsen und sanft zurückschieben)
 */

/** Kachel-IDs auf dem Weg der nächsten `seconds` Sekunden, mit `radius` m Rand. Nächste zuerst. */
export function lookAheadTiles(
  x: number,
  z: number,
  vx: number,
  vz: number,
  opts: { seconds: number; radius: number; tileSize: number },
): string[] {
  const speed = Math.hypot(vx, vz);
  if (speed < 1) return [];
  const s = opts.tileSize;
  const dist = speed * opts.seconds;
  const steps = Math.max(1, Math.ceil(dist / s));
  const r = Math.ceil(opts.radius / s);
  const out = new Set<string>();
  for (let k = 1; k <= steps; k++) {
    const f = (k / steps) * opts.seconds;
    const tx = Math.floor((x + vx * f) / s),
      tz = Math.floor((z + vz * f) / s);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) out.add(`${tx + dx},${tz + dz}`);
  }
  return [...out];
}

export const BORDER_MARGIN = 60;

/**
 * Weiche Grenze: sucht gesperrte Kacheln im Umkreis von `margin` m und liefert die Schubrichtung weg davon
 * (Stärke 0..1 = wie tief man im Randstreifen steckt) oder null, wenn alles frei ist.
 */
export function borderPush(
  x: number,
  z: number,
  blocked: (tx: number, tz: number) => boolean,
  tileSize: number,
  margin = BORDER_MARGIN,
): { nx: number; nz: number; strength: number } | null {
  const tx0 = Math.floor((x - margin) / tileSize),
    tx1 = Math.floor((x + margin) / tileSize);
  const tz0 = Math.floor((z - margin) / tileSize),
    tz1 = Math.floor((z + margin) / tileSize);
  let px = 0,
    pz = 0,
    strength = 0;
  for (let tz = tz0; tz <= tz1; tz++)
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!blocked(tx, tz)) continue;
      // nächster Punkt der gesperrten Kachel
      const cx = Math.max(tx * tileSize, Math.min(x, (tx + 1) * tileSize));
      const cz = Math.max(tz * tileSize, Math.min(z, (tz + 1) * tileSize));
      const dx = x - cx,
        dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= margin) continue;
      const w = 1 - d / margin;
      // im gesperrten Gebiet selbst: Richtung zur Kachelmitte umkehren
      const ux = d > 1e-6 ? dx / d : x - (tx + 0.5) * tileSize,
        uz = d > 1e-6 ? dz / d : z - (tz + 0.5) * tileSize;
      const ul = Math.hypot(ux, uz) || 1;
      px += (ux / ul) * w;
      pz += (uz / ul) * w;
      strength = Math.max(strength, w);
    }
  const l = Math.hypot(px, pz);
  return strength > 0 && l > 1e-6 ? { nx: px / l, nz: pz / l, strength } : null;
}

/** Geschwindigkeit an der Grenze: Anteil Richtung Sperre abbauen, sanft nach außen schieben. */
export function applyBorder(
  vx: number,
  vz: number,
  push: { nx: number; nz: number; strength: number } | null,
): { vx: number; vz: number } {
  if (!push) return { vx, vz };
  const into = -(vx * push.nx + vz * push.nz); // > 0 = Bewegung auf die Sperre zu
  const cut = into > 0 ? into * Math.min(1, push.strength * 1.5) : 0;
  const shove = 4 * push.strength;
  return { vx: vx + push.nx * (cut + shove), vz: vz + push.nz * (cut + shove) };
}
