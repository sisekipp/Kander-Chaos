import type { PropKind, VehicleKind } from '@kandern/world-format';

/** Kleinobjekt in Weltkoordinaten (vor der Kachelzuordnung). */
export interface WorldProp {
  kind: PropKind;
  x: number;
  z: number;
  rot: number;
  variant: number;
}

export interface WorldParking {
  id: number;
  x: number;
  z: number;
  heading: number;
  kind: VehicleKind;
}

/** Fläche, auf der ein Parkplatz-Raster angelegt wird (amenity=parking). */
export interface ParkingLot {
  id: number;
  ring: number[];
}
