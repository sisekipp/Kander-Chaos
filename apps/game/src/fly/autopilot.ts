/** Autopilot der Messroute „Flug“ (Spec fly-mode, Leistung): reine Rechnung, erzeugt Flugeingaben. */
import type { FlightInput, FlightState } from './flyMath.ts';

export interface FlyWaypoint {
  x: number;
  z: number;
  /** Zielhöhe über Gelände in m. */
  altitude: number;
  fast: boolean;
}

export interface AutopilotStep {
  input: FlightInput;
  /** Index des nächsten anzufliegenden Wegpunkts. */
  index: number;
  done: boolean;
}

/** Wegpunkt gilt als erreicht unter diesem waagerechten Abstand (m). */
export const REACH = 15;
/** Höhentoleranz, innerhalb derer weder gestiegen noch gesunken wird (m). */
const ALT_TOLERANCE = 3;
/** Ab diesem Abstand vor dem letzten Wegpunkt wird abgebremst (m). */
const SLOW_DOWN = 40;

const idle = (yaw: number): FlightInput => ({ moveX: 0, moveY: 0, up: false, down: false, fast: false, yaw });

/** Steuert den nächsten Wegpunkt an: Gierwinkel zum Ziel, Steigen/Sinken auf die Zielhöhe. */
export function autopilot(s: FlightState, ground: number, route: FlyWaypoint[], index: number, yaw = 0): AutopilotStep {
  let i = index;
  while (i < route.length && Math.hypot(route[i].x - s.x, route[i].z - s.z) < REACH) i++;
  if (i >= route.length) return { input: idle(yaw), index: i, done: true };
  const t = route[i];
  const dx = t.x - s.x,
    dz = t.z - s.z;
  const d = Math.hypot(dx, dz);
  const err = t.altitude - (s.y - ground);
  const last = i === route.length - 1;
  return {
    input: {
      moveX: 0,
      moveY: last ? Math.min(1, Math.max(0.3, d / SLOW_DOWN)) : 1,
      up: err > ALT_TOLERANCE,
      down: err < -ALT_TOLERANCE,
      fast: t.fast,
      yaw: Math.atan2(dx, dz),
    },
    index: i,
    done: false,
  };
}

/**
 * Messroute „Flug“: Runde über der Kernstadt in 100 m Höhe (25 m/s), Schnellflug in 150 m nach Wollbach,
 * Tiefflug in 30 m zurück (dort begrenzt maxSpeedAt auf 25 m/s).
 */
export function flightRoute(town: { x: number; z: number }, village: { x: number; z: number }): FlyWaypoint[] {
  const r = 250;
  const loop: FlyWaypoint[] = [0, 1, 2, 3, 4].map((k) => {
    const a = (k / 4) * Math.PI * 2;
    return { x: town.x + Math.sin(a) * r, z: town.z + Math.cos(a) * r, altitude: 100, fast: true };
  });
  return [
    ...loop,
    { x: village.x, z: village.z, altitude: 150, fast: true },
    { x: town.x, z: town.z, altitude: 30, fast: true },
  ];
}
