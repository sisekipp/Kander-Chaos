/** Reine Rechnung der Flugkamera (Spec fly-mode): Bewegung, sanftes Beschleunigen, Grenzen. */

export const MIN_CLEARANCE = 2;
export const MAX_ALTITUDE = 400;
export const BASE_SPEED = 15;
export const FAST_SPEED = 50;
export const LOW_ALTITUDE = 120;
/** Höchstgeschwindigkeit unterhalb LOW_ALTITUDE (Ring 0 muss nachkommen, Spec-Grenze 80 km/h). */
export const LOW_MAX_SPEED = 25;
export const CLIMB_SPEED = 10;
/** Zeitkonstante der Annäherung an die Wunschgeschwindigkeit (s): nach ~1 s praktisch erreicht. */
const RESPONSE = 0.25;

export interface FlightState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface FlightInput {
  /** −1 … 1, rechts. */
  moveX: number;
  /** −1 … 1, vorwärts. */
  moveY: number;
  up: boolean;
  down: boolean;
  fast: boolean;
  /** Blickrichtung als Gierwinkel (0 = +z, wie Spielfigur/Fahrzeuge). */
  yaw: number;
}

export interface FlightEnv {
  /** Geländehöhe an (x, z). */
  groundAt: (x: number, z: number) => number;
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}

/** Höchstgeschwindigkeit nach Höhe über Gelände: tief langsam, hoch bis FAST_SPEED. */
export function maxSpeedAt(altitude: number, fast: boolean): number {
  const top = fast ? FAST_SPEED : BASE_SPEED;
  if (altitude <= LOW_ALTITUDE) return Math.min(top, LOW_MAX_SPEED);
  return top;
}

/**
 * Ein Flugschritt: Wunschgeschwindigkeit aus Joystick (waagerecht in Blickrichtung) und Hoch/Runter,
 * exponentielle Annäherung, dann Grenzen: Weltrand, Bodenabstand ≥ MIN_CLEARANCE (hebt an), Höhe
 * ≤ MAX_ALTITUDE über Gelände. Gibt einen neuen Zustand zurück.
 */
export function stepFlight(s: FlightState, input: FlightInput, dt: number, env: FlightEnv): FlightState {
  const t = Math.min(Math.max(dt, 0), 0.1);
  const ground = env.groundAt(s.x, s.z);
  const altitude = s.y - ground;
  const max = maxSpeedAt(altitude, input.fast);
  const len = Math.hypot(input.moveX, input.moveY);
  const k = len > 1 ? 1 / len : 1;
  const mx = input.moveX * k,
    my = input.moveY * k;
  // vorwärts = (sin yaw, cos yaw), rechts = (cos yaw, −sin yaw)
  const sin = Math.sin(input.yaw),
    cos = Math.cos(input.yaw);
  const wantX = (sin * my + cos * mx) * max;
  const wantZ = (cos * my - sin * mx) * max;
  const wantY = ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * CLIMB_SPEED * (input.fast ? 2 : 1);
  const a = 1 - Math.exp(-t / RESPONSE);
  let vx = s.vx + (wantX - s.vx) * a;
  let vz = s.vz + (wantZ - s.vz) * a;
  let vy = s.vy + (wantY - s.vy) * a;
  // Höchstgeschwindigkeit auch beim Sinken unter LOW_ALTITUDE durchsetzen
  const hv = Math.hypot(vx, vz);
  if (hv > max) {
    vx *= max / hv;
    vz *= max / hv;
  }
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
  if (y < g + MIN_CLEARANCE) {
    y = g + MIN_CLEARANCE;
    if (vy < 0) vy = 0;
  }
  if (y > g + MAX_ALTITUDE) {
    y = g + MAX_ALTITUDE;
    if (vy > 0) vy = 0;
  }
  return { x, y, z, vx, vy, vz };
}
