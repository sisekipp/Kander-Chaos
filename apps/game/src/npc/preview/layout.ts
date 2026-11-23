import type { VatInfo } from '../../assets/manifest.ts';

/** Ein Platz in der NPC-Testansicht (Modellsystem der Ansicht: x quer, z in die Tiefe). */
export interface PreviewSlot {
  model: string;
  x: number;
  z: number;
  /** Animation dieses Platzes. */
  clip: string;
}

/**
 * Alle Figurmodelle nebeneinander (Abstand `spacing`), je Modell `rows` Reihen hintereinander:
 * vorne gehend, dahinter winkend bzw. stehend (Clips, die das Modell nicht hat, fallen auf „walk“ zurück).
 */
export function previewLayout(models: string[], rows = 2, spacing = 1.3): PreviewSlot[] {
  const clips = ['walk', 'wave', 'run', 'idle'];
  const out: PreviewSlot[] = [];
  const x0 = (-(models.length - 1) * spacing) / 2;
  models.forEach((model, i) => {
    for (let r = 0; r < rows; r++) out.push({ model, x: x0 + i * spacing, z: r * 2, clip: clips[r % clips.length] });
  });
  return out;
}

/**
 * Einstellungen je Instanz für Babylons `BakedVertexAnimationManager`: (erstes Bild, letztes Bild, Versatz, fps).
 * Der Versatz verteilt die Figuren über den Zyklus, damit sie nicht im Gleichschritt laufen (deterministisch).
 */
export function vatSettings(vat: VatInfo, clip: string, index: number): [number, number, number, number] {
  const c = vat.clips[clip] ?? vat.clips.walk ?? Object.values(vat.clips)[0];
  const len = c.to - c.from + 1;
  return [c.from, c.to, (index * 7) % len, vat.fps];
}
