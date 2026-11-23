import { RoadKind, Surface, type RoadDetail } from '@kandern/world-format';

/** Belag-/Typ-Code je Vertex (uv2.x) – gleiche Werte im Straßen-Shader. */
export const enum RoadCode {
  AsphaltMain = 0,
  AsphaltMinor = 1,
  Track = 2,
  Footway = 3,
  Cycleway = 4,
  Curb = 5,
  Sidewalk = 6,
  Junction = 7,
  Zebra = 8,
  Guardrail = 9,
  Concrete = 10,
  Dirt = 11,
  Gravel = 12,
  Ballast = 13,
  Paving = 14,
  /** Gewässerband (bis der Wasser-Shader in Gruppe 7 übernimmt). */
  Water = 15,
  /** Rasen (Mittelinsel von Kreisverkehren). */
  Grass = 16,
  /** Start-/Landebahn: Beton, weiße Mittel- und Randlinien. */
  Runway = 17,
  /** Rollweg: Asphalt, gelbe Mittellinie. */
  Taxiway = 18,
}

/** Markierungsprofil (Teil von uv2.y). */
export const enum Marking {
  None = 0,
  CenterDashed = 1,
  CenterAndEdges = 2,
  MotorwayLanes = 3,
  /** Nur Randlinien (Kreisverkehr). */
  Edges = 4,
}

export const CURB_HEIGHT = 0.12;
export const SIDEWALK_WIDTH = 2;
const GUARDRAIL_HEIGHT = 0.75;
const RAILING_HEIGHT = 1.0;
const BARRIER_THICKNESS = 0.08;

/** Punkt im Querschnitt: Querlage c (m, + = rechts in Fahrtrichtung), Höhe h über Fahrbahn. */
export interface ProfilePoint {
  c: number;
  h: number;
}

/** Abschnitt zwischen zwei Querschnittspunkten mit Code; die Fläche liegt zwischen `a` und `b`. */
export interface ProfileSegment {
  a: ProfilePoint;
  b: ProfilePoint;
  code: RoadCode;
}

export interface RoadProfile {
  segments: ProfileSegment[];
  /** Halbe Fahrbahnbreite (für Randlinien im Shader). */
  halfCarriageway: number;
  marking: Marking;
  lanes: number;
  /** Gesamtbreite inkl. Gehwege/Schutzplanken. */
  totalWidth: number;
}

/**
 * uv2.y kodiert Markierung, Fahrstreifen und halbe Fahrbahnbreite:
 * (marking + 10 · lanes) · 100 + halfCarriageway. Der Shader dekodiert genauso.
 */
export function encodeMarking(p: Pick<RoadProfile, 'marking' | 'lanes' | 'halfCarriageway'>): number {
  return (p.marking + 10 * Math.min(p.lanes, 9)) * 100 + Math.min(p.halfCarriageway, 99);
}

export function decodeMarking(v: number): { marking: Marking; lanes: number; halfCarriageway: number } {
  const hi = Math.floor(v / 100);
  return { marking: hi % 10, lanes: Math.floor(hi / 10), halfCarriageway: v - hi * 100 };
}

function carriagewayCode(kind: RoadKind, surface: Surface): RoadCode {
  if (surface === Surface.Paving) return RoadCode.Paving;
  if (surface === Surface.Concrete) return RoadCode.Concrete;
  if (surface === Surface.Gravel) return RoadCode.Gravel;
  if (surface === Surface.Dirt || surface === Surface.Grass) return RoadCode.Dirt;
  return kind <= RoadKind.Tertiary ? RoadCode.AsphaltMain : RoadCode.AsphaltMinor;
}

function pathCode(kind: RoadKind, surface: Surface): RoadCode {
  if (kind === RoadKind.Rail) return RoadCode.Ballast;
  if (kind === RoadKind.Runway) return RoadCode.Runway;
  if (kind === RoadKind.Taxiway) return RoadCode.Taxiway;
  if (kind === RoadKind.Track) return surface === Surface.Asphalt ? RoadCode.AsphaltMinor : RoadCode.Track;
  if (kind === RoadKind.Cycleway) return surface === Surface.Asphalt ? RoadCode.Cycleway : RoadCode.Gravel;
  if (surface === Surface.Paving) return RoadCode.Footway;
  if (surface === Surface.Asphalt) return RoadCode.AsphaltMinor;
  if (surface === Surface.Gravel) return RoadCode.Gravel;
  return kind === RoadKind.Footway || kind === RoadKind.Steps ? RoadCode.Footway : RoadCode.Dirt;
}

function markingFor(kind: RoadKind, d: RoadDetail, width: number): Marking {
  if (kind === RoadKind.Motorway) return Marking.MotorwayLanes;
  if (kind > RoadKind.Tertiary || width < 5.5 || d.surface !== Surface.Asphalt) return Marking.None;
  if (d.oneway) return d.lanes > 1 ? Marking.MotorwayLanes : Marking.None;
  return kind <= RoadKind.Secondary ? Marking.CenterAndEdges : Marking.CenterDashed;
}

/** Niedrige Schutzwand (Leitplanke, Geländer) als dünner Quader: außen hoch, oben, innen runter. */
function barrier(c: number, outward: 1 | -1, height: number, code: RoadCode): ProfileSegment[] {
  const outer = c + outward * BARRIER_THICKNESS;
  const pts: ProfilePoint[] =
    outward === 1
      ? [
          { c, h: 0 },
          { c, h: height },
          { c: outer, h: height },
          { c: outer, h: 0 },
        ]
      : [
          { c: outer, h: 0 },
          { c: outer, h: height },
          { c, h: height },
          { c, h: 0 },
        ];
  return [0, 1, 2].map((i) => ({ a: pts[i], b: pts[i + 1], code }));
}

/**
 * Querschnitt je Straßenart und Attributen. Fahrbahnen mit Bordstein und Gehweg (Ring 0),
 * Autobahn mit Leitplanken, Brücken mit Geländer. `simple` (Ring 1): nur flaches Band.
 */
export function roadProfile(
  kind: RoadKind,
  width: number,
  d: RoadDetail,
  opts: { bridge?: boolean; simple?: boolean } = {},
): RoadProfile {
  const half = width / 2;
  const isCarriageway = kind <= RoadKind.Service;
  const segs: ProfileSegment[] = [];
  const flat = (c0: number, c1: number, h: number, code: RoadCode) =>
    segs.push({ a: { c: c0, h }, b: { c: c1, h }, code });
  const marking = isCarriageway ? markingFor(kind, d, width) : Marking.None;
  let left = -half,
    right = half;
  if (!isCarriageway || opts.simple) {
    flat(-half, half, 0, isCarriageway ? carriagewayCode(kind, d.surface) : pathCode(kind, d.surface));
  } else {
    if (d.sidewalkLeft) {
      left = -half - SIDEWALK_WIDTH;
      flat(left, -half, CURB_HEIGHT, RoadCode.Sidewalk);
      segs.push({ a: { c: -half, h: CURB_HEIGHT }, b: { c: -half, h: 0 }, code: RoadCode.Curb });
    }
    flat(-half, half, 0, carriagewayCode(kind, d.surface));
    if (d.sidewalkRight) {
      right = half + SIDEWALK_WIDTH;
      segs.push({ a: { c: half, h: 0 }, b: { c: half, h: CURB_HEIGHT }, code: RoadCode.Curb });
      flat(half, right, CURB_HEIGHT, RoadCode.Sidewalk);
    }
  }
  if (!opts.simple) {
    const edgeH = (c: number) => (c === -half || c === half ? 0 : CURB_HEIGHT);
    if (opts.bridge) {
      for (const s of barrier(left, -1, RAILING_HEIGHT, RoadCode.Concrete))
        segs.unshift({ ...s, a: { ...s.a, h: s.a.h + edgeH(left) }, b: { ...s.b, h: s.b.h + edgeH(left) } });
      segs.push(
        ...barrier(right, 1, RAILING_HEIGHT, RoadCode.Concrete).map((s) => ({
          ...s,
          a: { ...s.a, h: s.a.h + edgeH(right) },
          b: { ...s.b, h: s.b.h + edgeH(right) },
        })),
      );
    } else if (kind === RoadKind.Motorway) {
      segs.unshift(...barrier(left - 0.5, -1, GUARDRAIL_HEIGHT, RoadCode.Guardrail));
      segs.push(...barrier(right + 0.5, 1, GUARDRAIL_HEIGHT, RoadCode.Guardrail));
    }
  }
  if (kind === RoadKind.Runway || kind === RoadKind.Taxiway) {
    // Markierungen brauchen keine Kanten: ein flaches Band in voller Breite
    segs.length = 0;
    flat(-half, half, 0, pathCode(kind, d.surface));
  }
  const cs = segs.flatMap((s) => [s.a.c, s.b.c]);
  return {
    segments: segs,
    halfCarriageway: half,
    marking,
    // Gleise: Anzahl Gleise (Schienenpaare im Shader)
    lanes: isCarriageway || kind === RoadKind.Rail ? Math.max(1, d.lanes) : 0,
    totalWidth: Math.max(...cs) - Math.min(...cs),
  };
}
