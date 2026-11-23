/**
 * Messroute „Hubschrauber Basel“ (Spec helicopter, Leistung): Start am Landeplatz Kandern, Steigflug, in 150 m
 * Höhe schnell über Lörrach und die Basler Innenstadt zum Landeplatz EuroAirport. Reine Rechnung.
 */
import type { FlyWaypoint } from '../../fly/autopilot.ts';

export interface RoutePoint {
  id: string;
  x: number;
  z: number;
}

export const HELI_ROUTE_IDS = ['kandern', 'loerrach', 'basel', 'euroairport'] as const;

/** Wegpunkte aus den Landeplätzen; null, wenn einer fehlt. */
export function heliBaselRoute(pads: RoutePoint[]): FlyWaypoint[] | null {
  const pts = HELI_ROUTE_IDS.map((id) => pads.find((p) => p.id === id));
  if (pts.some((p) => !p)) return null;
  const [start, ...rest] = pts as RoutePoint[];
  return [
    // erst senkrecht steigen (Wegpunkt direkt über dem Start)
    { x: start.x + 1, z: start.z + 1, altitude: 150, fast: false },
    ...rest.map((p, i) => ({ x: p.x, z: p.z, altitude: i === rest.length - 1 ? 40 : 150, fast: true })),
  ];
}
