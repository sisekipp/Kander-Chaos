/**
 * Flugrechnung des Hubschraubers (Spec helicopter): kindgerecht, kann nicht abstürzen. Reine Logik ohne Babylon.
 * y ist die Unterkante der Kufen. Gierwinkel wie Spielfigur/Fahrzeuge: 0 = +z, vorwärts = (sin, cos).
 */

export const MIN_CLEARANCE = 1;
export const MAX_ALTITUDE = 600;
export const BASE_SPEED = 18;
/** Höchsttempo mit „Schnell“ unter bzw. über der Höhengrenze (Streaming muss nachkommen). */
export const FAST_LOW = 30;
export const FAST_HIGH = 60;
/** Hohes Tempo ab dieser Höhe, zurück unter HIGH_OFF (Hysterese wie die Detailregel). */
export const HIGH_ON = 120;
export const HIGH_OFF = 100;
export const CLIMB = 8;
export const CLIMB_FAST = 14;
/** Zeitkonstante der Annäherung (s): nach 2 s weniger als 2 % Restgeschwindigkeit. */
const RESPONSE = 0.45;
const TURN_RATE = 1.6; // rad/s
const MAX_PITCH = 0.3; // ca. 17°
const MAX_ROLL = 0.35;
const ROTOR_RESPONSE = 0.9;
/** Unter dieser Höhe beim Sinken automatisch abfangen (m). */
const FLARE_HEIGHT = 10;

export interface HeliState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  pitch: number;
  roll: number;
  /** Rotordrehzahl 0 … 1. */
  rotor: number;
  /** Hohes Tempo erlaubt (Hysterese). */
  high: boolean;
  grounded: boolean;
}

export interface HeliInput {
  /** Joystick −1 … 1 relativ zur Kamera (x = rechts, y = vorwärts). */
  moveX: number;
  moveY: number;
  up: boolean;
  down: boolean;
  fast: boolean;
  /** Blickrichtung der Kamera (Gierwinkel). */
  camYaw: number;
  /** Motor an (Spieler sitzt drin). */
  engine: boolean;
}

export interface HeliEnv {
  groundAt: (x: number, z: number) => number;
  /** Darf hier aufgesetzt werden (eben, kein Dach)? Sonst schwebt er knapp darüber. */
  canLand: (x: number, z: number) => boolean;
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}

export function initialHeli(x: number, y: number, z: number, heading: number): HeliState {
  return { x, y, z, vx: 0, vy: 0, vz: 0, heading, pitch: 0, roll: 0, rotor: 0, high: false, grounded: true };
}

/** Höchsttempo nach Höhe und Schnell-Knopf. */
export function maxSpeed(high: boolean, fast: boolean): number {
  if (!fast) return BASE_SPEED;
  return high ? FAST_HIGH : FAST_LOW;
}

export function highFor(current: boolean, altitude: number): boolean {
  if (!current && altitude > HIGH_ON) return true;
  if (current && altitude < HIGH_OFF) return false;
  return current;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (v: number, target: number, a: number) => v + (target - v) * a;

export function stepHeli(s: HeliState, input: HeliInput, dt: number, env: HeliEnv): HeliState {
  const t = Math.min(Math.max(dt, 0), 0.1);
  const rotor = approach(s.rotor, input.engine ? 1 : 0, 1 - Math.exp(-t / ROTOR_RESPONSE));
  const ground = env.groundAt(s.x, s.z);
  const altitude = s.y - ground;
  const high = highFor(s.high, altitude);
  // Ohne laufenden Rotor (Anlauf) kein Abheben
  const power = input.engine && rotor > 0.8 ? 1 : 0;
  const len = Math.hypot(input.moveX, input.moveY);
  const k = len > 1 ? 1 / len : 1;
  const mx = input.moveX * k * power,
    my = input.moveY * k * power;
  const max = maxSpeed(high, input.fast);
  const sin = Math.sin(input.camYaw),
    cos = Math.cos(input.camYaw);
  const wantX = (sin * my + cos * mx) * max;
  const wantZ = (cos * my - sin * mx) * max;
  let wantY = ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * (input.fast ? CLIMB_FAST : CLIMB) * power;
  // Abfangen kurz über dem Boden: Sinkrate wird proportional zur Höhe kleiner
  const flare = wantY < 0 && altitude < FLARE_HEIGHT;
  if (flare) wantY = Math.max(wantY, -(altitude * 0.6 + 0.3));
  const a = 1 - Math.exp(-t / RESPONSE);
  let vx = approach(s.vx, wantX, a),
    vz = approach(s.vz, wantZ, a),
    vy = approach(s.vy, wantY, flare ? 1 - Math.exp(-t / 0.2) : a);
  const hv = Math.hypot(vx, vz);
  if (hv > max) {
    vx *= max / hv;
    vz *= max / hv;
  }
  // Bug dreht in Flugrichtung, sobald er sich merklich bewegt
  let heading = s.heading;
  let turn = 0;
  if (hv > 1.5) {
    const d = wrap(Math.atan2(vx, vz) - s.heading);
    turn = Math.max(-TURN_RATE * t, Math.min(TURN_RATE * t, d));
    heading = wrap(s.heading + turn);
  }
  const fwd = vx * Math.sin(heading) + vz * Math.cos(heading);
  const pitch = approach(s.pitch, -MAX_PITCH * Math.max(-1, Math.min(1, (fwd / FAST_HIGH) * 2)), a);
  const roll = approach(s.roll, t > 0 ? -MAX_ROLL * Math.max(-1, Math.min(1, turn / t / TURN_RATE)) : 0, a);
  let x = s.x + vx * t,
    z = s.z + vz * t,
    y = s.y + vy * t;
  const b = env.bounds;
  if (x < b.minX || x > b.maxX) {
    x = Math.min(b.maxX, Math.max(b.minX, x));
    vx = 0;
  }
  if (z < b.minZ || z > b.maxZ) {
    z = Math.min(b.maxZ, Math.max(b.minZ, z));
    vz = 0;
  }
  const g = env.groundAt(x, z);
  const floor = env.canLand(x, z) ? g : g + MIN_CLEARANCE;
  let grounded = false;
  if (y <= floor + 0.05) {
    y = floor;
    if (vy < 0) vy = 0;
    grounded = floor === g;
    if (grounded && wantY <= 0) {
      vx *= 0.5;
      vz *= 0.5;
    }
  }
  if (y > g + MAX_ALTITUDE) {
    y = g + MAX_ALTITUDE;
    if (vy > 0) vy = 0;
  }
  return { x, y, z, vx, vy, vz, heading, pitch, roll, rotor, high, grounded };
}
