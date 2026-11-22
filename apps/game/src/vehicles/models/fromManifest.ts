import type { VehicleKind } from '@kandern/world-format';
import { pickFor } from '../../assets/palette.ts';
import type { ModelEntry, ModelManifest, VehicleInfo } from '../../assets/manifest.ts';
import { vehicleModels } from '../../assets/manifest.ts';
import type { VehicleSpec, WheelSpec } from '../specs.ts';

/** Bodenfreiheit der Kollisionsbox: sie beginnt so weit über der Karosserie-Unterkante (Schweller, Stoßfänger). */
export const BOX_CLEARANCE = 0.2;

/**
 * Kollisionsbox aus den Modellmaßen: unten um BOX_CLEARANCE gekürzt, damit Schweller und Stoßfänger am Hang
 * nicht im Gelände stecken. Liefert Größe und Mitte (glTF-Koordinaten); die Mitte ist der Fahrzeugursprung.
 */
export function physicsBox(info: VehicleInfo): { box: [number, number, number]; center: [number, number, number] } {
  const [w, h, l] = info.box;
  const [cx, cy, cz] = info.center;
  const clear = Math.min(BOX_CLEARANCE, h * 0.3);
  return { box: [w, h - clear, l], center: [cx, cy + clear / 2, cz] };
}

/** Deterministische Modellwahl je Fahrzeug-ID (gleiche Parkposition -> gleiches Modell). */
export function pickVehicleModel(manifest: ModelManifest | null, kind: VehicleKind, id: number): ModelEntry | null {
  const list = manifest ? vehicleModels(manifest, kind) : [];
  return list.length ? pickFor(id, list, 7) : null;
}

/**
 * Radlage im Spiel (Babylon, linkshändig) relativ zur Karosseriemitte. glTF ist rechtshändig: Babylons
 * Loader spiegelt x, deshalb wird x negiert. Die Aufhängungshöhe `y` ist so gewählt, dass das Rad in Ruhe
 * (Einfederung = Durchhang) genau an der Radmitte des Modells sitzt.
 */
export function wheelSpecs(base: VehicleSpec, info: VehicleInfo): WheelSpec[] {
  const [cx, cy, cz] = physicsBox(info).center;
  const sag = (base.mass * 9.81) / info.wheels.length / base.suspension.stiffness;
  return info.wheels.map((w, i) => {
    const front = w.z - cz > 0;
    const tmpl = base.wheels[Math.min(i, base.wheels.length - 1)];
    return {
      x: -(w.x - cx),
      y: w.y - cy + base.suspension.rest - sag - w.radius,
      z: w.z - cz,
      radius: w.radius,
      steer: base.twoWheeler ? front : front && tmpl.steer !== false,
      drive: tmpl.drive,
    };
  });
}

/** Spezifikation für ein Modell: Fahrverhalten der Art, Box und Räder aus den Modellmaßen. */
export function specForModel(base: VehicleSpec, entry: ModelEntry): VehicleSpec {
  const info = entry.vehicle!;
  return { ...base, name: info.type, box: physicsBox(info).box, wheels: wheelSpecs(base, info) };
}
