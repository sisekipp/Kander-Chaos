import { VehicleKind, type GroundVehicleKind } from '@kandern/world-format';

export interface WheelSpec {
  /** Lage relativ zum Fahrzeugmittelpunkt (x = rechts, z = vorne), Aufhängungspunkt auf Höhe `y`. */
  x: number;
  y: number;
  z: number;
  radius: number;
  steer: boolean;
  drive: boolean;
}

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  mass: number;
  /** Abmessungen des Kollisionskörpers (Breite, Höhe, Länge) in m. */
  box: [number, number, number];
  /** Schwerpunkt-Absenkung (m, relativ zur Boxmitte) für Kippstabilität. */
  comDrop: number;
  /** Höchstgeschwindigkeit in m/s (Spec: Richtwerte ±15 %). */
  maxSpeed: number;
  /** Antriebskraft im Stand in N; fällt bis maxSpeed auf 0. */
  engineForce: number;
  brakeForce: number;
  reverseSpeed: number;
  maxSteer: number;
  /** Seitenhalt (N je m/s Quergeschwindigkeit und je kg Radlast-Anteil). */
  grip: number;
  suspension: { rest: number; travel: number; stiffness: number; damping: number };
  /** Zusätzlicher Abtrieb (N je (m/s)²). */
  downforce: number;
  /** Maximale Kurvenneigung (rad) – nur Zweiräder. */
  maxLean: number;
  twoWheeler: boolean;
  wheels: WheelSpec[];
}

const kmh = (v: number) => v / 3.6;

export const VEHICLE_SPECS: Record<GroundVehicleKind, VehicleSpec> = {
  [VehicleKind.Car]: {
    kind: VehicleKind.Car,
    name: 'Auto',
    mass: 1000,
    box: [1.75, 1.0, 3.9],
    comDrop: 0.35,
    maxSpeed: kmh(80),
    engineForce: 7200,
    brakeForce: 9000,
    reverseSpeed: kmh(15),
    maxSteer: 0.6,
    grip: 9,
    suspension: { rest: 0.45, travel: 0.35, stiffness: 32000, damping: 3200 },
    downforce: 2.5,
    maxLean: 0,
    twoWheeler: false,
    wheels: [
      { x: -0.78, y: -0.25, z: 1.3, radius: 0.34, steer: true, drive: true },
      { x: 0.78, y: -0.25, z: 1.3, radius: 0.34, steer: true, drive: true },
      { x: -0.78, y: -0.25, z: -1.25, radius: 0.34, steer: false, drive: true },
      { x: 0.78, y: -0.25, z: -1.25, radius: 0.34, steer: false, drive: true },
    ],
  },
  [VehicleKind.Motorbike]: {
    kind: VehicleKind.Motorbike,
    name: 'Motorrad',
    mass: 250,
    box: [0.6, 0.7, 2.0],
    comDrop: 0.25,
    maxSpeed: kmh(90),
    engineForce: 3400,
    brakeForce: 3200,
    reverseSpeed: kmh(6),
    maxSteer: 0.45,
    grip: 10,
    suspension: { rest: 0.4, travel: 0.25, stiffness: 9000, damping: 900 },
    downforce: 0.6,
    maxLean: 0.6,
    twoWheeler: true,
    wheels: [
      { x: 0, y: -0.2, z: 0.75, radius: 0.32, steer: true, drive: false },
      { x: 0, y: -0.2, z: -0.7, radius: 0.32, steer: false, drive: true },
    ],
  },
  [VehicleKind.Bike]: {
    kind: VehicleKind.Bike,
    name: 'Fahrrad',
    mass: 90,
    box: [0.5, 0.65, 1.75],
    comDrop: 0.2,
    maxSpeed: kmh(30),
    engineForce: 520,
    brakeForce: 1100,
    reverseSpeed: kmh(4),
    maxSteer: 0.55,
    grip: 10,
    suspension: { rest: 0.38, travel: 0.15, stiffness: 3600, damping: 360 },
    downforce: 0.2,
    maxLean: 0.45,
    twoWheeler: true,
    wheels: [
      { x: 0, y: -0.2, z: 0.62, radius: 0.33, steer: true, drive: false },
      { x: 0, y: -0.2, z: -0.6, radius: 0.33, steer: false, drive: true },
    ],
  },
};
