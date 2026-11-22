import { describe, expect, it } from 'vite-plus/test';
import { BuildingType, RoadKind, RoofShape, type Building, type Road } from '@kandern/world-format';
import { CHIMNEY_SHARE, SHUTTER_SHARE, ShutterColor, buildingDetails, doorWall } from './details.ts';

const road = (points: number[]): Road => ({
  id: 1,
  kind: RoadKind.Residential,
  width: 6,
  points: new Float32Array(points),
  startNode: 1,
  endNode: 2,
  name: '',
  bridge: false,
  tunnel: false,
});
const house = (id: number, type = BuildingType.Residential): Building => ({
  id,
  type,
  roof: RoofShape.Gabled,
  wallHeight: 6,
  roofHeight: 5,
  levels: 2,
  // CCW: Süd-, Ost-, Nord-, Westwand
  outline: new Float32Array([100, 100, 110, 100, 110, 108, 100, 108]),
  estimated: false,
});

describe('Gebäudedetails', () => {
  it('Haustür zeigt zur nächsten Straße', () => {
    const o = house(1).outline;
    expect(doorWall(o, [road([0, 90, 250, 90])])).toBe(0); // Straße im Süden
    expect(doorWall(o, [road([120, 0, 120, 250])])).toBe(1); // Osten
    expect(doorWall(o, [road([0, 120, 250, 120])])).toBe(2); // Norden
    expect(doorWall(o, [road([90, 0, 90, 250])])).toBe(3); // Westen
  });

  it('ohne Straße in der Nähe: Tür an der längsten Wand', () => {
    expect(doorWall(house(1).outline, [road([0, 240, 10, 240])])).toBe(0);
  });

  it('Scheunen, Garagen und Schuppen: Garage/Schuppen ohne Tür', () => {
    expect(buildingDetails(house(1, BuildingType.Garage), []).doorWall).toBeNull();
    expect(buildingDetails(house(1, BuildingType.Shed), []).doorWall).toBeNull();
  });

  it('deterministisch aus der Gebäude-ID', () => {
    const roads = [road([0, 90, 250, 90])];
    for (let id = 1; id < 50; id++)
      expect(buildingDetails(house(id), roads)).toEqual(buildingDetails(house(id), roads));
  });

  it('Fensterläden bei etwa der Hälfte, Schornsteine bei etwa 40 % der Wohnhäuser', () => {
    let shutters = 0,
      chimneys = 0;
    const N = 2000;
    for (let id = 1; id <= N; id++) {
      const d = buildingDetails(house(1e12 + id * 7919), []);
      if (d.shutters !== ShutterColor.None) shutters++;
      if (d.chimney) {
        chimneys++;
        expect(Math.abs(d.chimney.a)).toBeLessThanOrEqual(0.55);
      }
    }
    expect(shutters / N).toBeGreaterThan(SHUTTER_SHARE - 0.06);
    expect(shutters / N).toBeLessThan(SHUTTER_SHARE + 0.06);
    expect(chimneys / N).toBeGreaterThan(CHIMNEY_SHARE - 0.06);
    expect(chimneys / N).toBeLessThan(CHIMNEY_SHARE + 0.06);
  });

  it('Gewerbe ohne Läden, Flachdach ohne Schornstein', () => {
    expect(buildingDetails(house(3, BuildingType.Commercial), []).shutters).toBe(ShutterColor.None);
    expect(buildingDetails({ ...house(3), roof: RoofShape.Flat }, []).chimney).toBeNull();
  });
});
