import { PropKind, SignVariant } from './types.ts';

/**
 * Sichtbare Formen der Kleinobjekte. Varianten einer Art können sich eine Form teilen; je Kachel kostet jede
 * vorkommende Form einen Draw Call. Pipeline (Prüfung „≤ 12 Formen je Kachel“) und Spiel (Instanzpuffer)
 * nutzen dieselbe Tabelle.
 */
export const enum PropShape {
  BushRound = 0,
  BushTall = 1,
  Bin = 2,
  Fence = 3,
  Sign = 4,
  TrafficLight = 5,
  Lamp = 6,
  Bench = 7,
  SignTriangle = 8,
  SignBlue = 9,
  BusStop = 10,
  PostBox = 11,
  Hydrant = 12,
  Bollard = 13,
  BikeRack = 14,
  AdColumn = 15,
  Planter = 16,
}

export const PROP_SHAPE_COUNT = 17;
/** Höchstzahl verschiedener Formen (= Draw Calls) je Kachel (Spec destructible-props). */
export const MAX_SHAPES_PER_TILE = 12;

/** Art jeder Form (für Kollisionsmaße, Regeln, Trümmerfarben). */
export const SHAPE_KIND: readonly PropKind[] = [
  PropKind.Bush,
  PropKind.Bush,
  PropKind.Bin,
  PropKind.Fence,
  PropKind.Sign,
  PropKind.Sign,
  PropKind.Lamp,
  PropKind.Bench,
  PropKind.Sign,
  PropKind.Sign,
  PropKind.Sign,
  PropKind.PostBox,
  PropKind.Hydrant,
  PropKind.Bollard,
  PropKind.BikeRack,
  PropKind.AdColumn,
  PropKind.Planter,
];

/**
 * Form je Art und Variante: Busch 1 = hoher Busch, sonst rund (3 = Heckenfeld, gestreckt); Schild nach
 * `SignVariant`; alle übrigen Arten haben genau eine Form.
 */
export function propShape(kind: PropKind, variant: number): PropShape {
  switch (kind) {
    case PropKind.Bush:
      return variant === 1 ? PropShape.BushTall : PropShape.BushRound;
    case PropKind.Bin:
      return PropShape.Bin;
    case PropKind.Fence:
      return PropShape.Fence;
    case PropKind.Sign:
      return variant === SignVariant.TrafficLight
        ? PropShape.TrafficLight
        : variant === SignVariant.BusStop
          ? PropShape.BusStop
          : variant === SignVariant.Triangle
            ? PropShape.SignTriangle
            : variant === SignVariant.BlueSquare
              ? PropShape.SignBlue
              : PropShape.Sign;
    case PropKind.Lamp:
      return PropShape.Lamp;
    case PropKind.Bench:
      return PropShape.Bench;
    case PropKind.PostBox:
      return PropShape.PostBox;
    case PropKind.Hydrant:
      return PropShape.Hydrant;
    case PropKind.Bollard:
      return PropShape.Bollard;
    case PropKind.BikeRack:
      return PropShape.BikeRack;
    case PropKind.AdColumn:
      return PropShape.AdColumn;
    default:
      return PropShape.Planter;
  }
}

/** Anzahl verschiedener Formen in einer Liste von Kleinobjekten (= Draw Calls der Kachel). */
export function countShapes(props: readonly { kind: PropKind; variant: number }[]): number {
  return new Set(props.map((p) => propShape(p.kind, p.variant))).size;
}
