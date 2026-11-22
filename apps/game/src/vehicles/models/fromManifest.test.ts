import { describe, expect, it } from 'vite-plus/test';
import { VehicleKind } from '@kandern/world-format';
import { parseManifest } from '../../assets/manifest.ts';
import { restHeight } from '../placement.ts';
import { VEHICLE_SPECS } from '../specs.ts';
import { pickVehicleModel, specForModel } from './fromManifest.ts';

const car = (id: string, type: string) => ({
  id,
  kind: 'vehicle',
  file: `${id}.glb`,
  bytes: 1,
  triangles: 2000,
  zones: ['paint'],
  parts: ['detach_a', 'detach_b'],
  vehicle: {
    vehicleKind: 0,
    type,
    box: [1.75, 1.45, 4.2],
    center: [0, 0.9, 0.05],
    wheels: [
      { name: 'fl', x: 0.5, y: 0.38, z: 1.09, radius: 0.38 },
      { name: 'fr', x: -0.5, y: 0.38, z: 1.09, radius: 0.38 },
      { name: 'bl', x: 0.5, y: 0.38, z: -1.09, radius: 0.38 },
      { name: 'br', x: -0.5, y: 0.38, z: -1.09, radius: 0.38 },
    ],
  },
});
const twoWheeler = (id: string, kind: 1 | 2, type: string) => ({
  ...car(id, type),
  vehicle: {
    vehicleKind: kind,
    type,
    box: [0.72, 1.0, 1.8],
    center: [0, 0.7, 0],
    wheels: [
      { name: 'wheel-front', x: 0, y: 0.3, z: 0.65, radius: 0.3 },
      { name: 'wheel-back', x: 0, y: 0.3, z: -0.65, radius: 0.3 },
    ],
  },
});
const manifest = parseManifest({
  version: 1,
  models: [
    car('car-a', 'Kleinwagen'),
    car('car-b', 'Kombi'),
    car('van', 'Kleintransporter'),
    twoWheeler('scooter', 2, 'Roller'),
    twoWheeler('moto', 2, 'Motorrad'),
  ],
});

describe('Fahrzeugmodelle aus dem Manifest', () => {
  it('Modellwahl ist je Parkposition deterministisch und nutzt alle Modelle', () => {
    const ids = Array.from({ length: 300 }, (_, i) => 3e12 + i * 131);
    for (const id of ids.slice(0, 10))
      expect(pickVehicleModel(manifest, VehicleKind.Car, id)).toBe(pickVehicleModel(manifest, VehicleKind.Car, id));
    const used = new Set(ids.map((id) => pickVehicleModel(manifest, VehicleKind.Car, id)!.id));
    expect(used.size).toBe(3);
  });

  it('Zweiräder: schmale Box der Art, Vorderrad lenkt; Roller langsamer als Motorrad', () => {
    const base = VEHICLE_SPECS[VehicleKind.Motorbike];
    const roller = specForModel(base, manifest.models[3]);
    const moto = specForModel(base, manifest.models[4]);
    expect(roller.box[0]).toBe(base.box[0]);
    expect(roller.wheels.map((w) => w.steer)).toEqual([true, false]);
    expect(roller.maxSpeed).toBeCloseTo(45 / 3.6);
    expect(moto.maxSpeed).toBe(base.maxSpeed);
    expect(pickVehicleModel(manifest, VehicleKind.Motorbike, 5)?.vehicle?.vehicleKind).toBe(2);
  });

  it('ohne passendes Modell (z. B. Fahrrad) oder ohne Manifest: null (prozeduraler Rückfall)', () => {
    expect(pickVehicleModel(manifest, VehicleKind.Bike, 1)).toBeNull();
    expect(pickVehicleModel(null, VehicleKind.Car, 1)).toBeNull();
  });

  it('Spezifikation: Box und Räder aus dem Modell, Fahrverhalten der Art bleibt', () => {
    const base = VEHICLE_SPECS[VehicleKind.Car];
    const s = specForModel(base, manifest.models[0]);
    // Box unten um die Bodenfreiheit gekürzt
    expect(s.box[0]).toBe(1.75);
    expect(s.box[1]).toBeCloseTo(1.25);
    expect(s.box[2]).toBe(4.2);
    expect(s.maxSpeed).toBe(base.maxSpeed);
    expect(s.engineForce).toBe(base.engineForce);
    expect(s.name).toBe('Kleinwagen');
    // glTF rechtshändig -> Babylon: x gespiegelt; vorne lenkt, alle treiben an
    expect(s.wheels[0]).toMatchObject({ x: -0.5, z: 1.04, radius: 0.38, steer: true });
    expect(s.wheels[2]).toMatchObject({ x: -0.5, steer: false });
    expect(s.wheels[1].x).toBe(0.5);
  });

  it('in Ruhe sitzt das Rad an der Radmitte des Modells, die Räder stehen auf dem Boden', () => {
    const base = VEHICLE_SPECS[VehicleKind.Car];
    const s = specForModel(base, manifest.models[0]);
    const sag = (base.mass * 9.81) / 4 / base.suspension.stiffness;
    const visualY = s.wheels[0].y - (s.suspension.rest - sag) + s.wheels[0].radius;
    expect(visualY).toBeCloseTo(0.38 - (0.9 + 0.1));
    // Karosseriemitte steht so hoch, dass die Radunterkante auf dem Boden liegt
    expect(restHeight(s) + visualY - s.wheels[0].radius).toBeCloseTo(0, 2);
  });
});
