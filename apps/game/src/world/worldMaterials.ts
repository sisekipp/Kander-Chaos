import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { createBuildingMaterial } from './buildings/buildingMaterial.ts';
import { createLitMaterial } from './shaders/litMaterial.ts';
import { createTerrainMaterial } from './terrain/terrainMaterial.ts';
import { createRoadMaterial } from './roads/roadMaterial.ts';
import { createWaterMaterial } from './water/waterMaterial.ts';

/**
 * Alle Materialien der Welt an einer Stelle (die Materialien selbst liegen in ihren Feature-Ordnern).
 * Alle nutzen den gemeinsamen Licht-Baustein; nach dem Aufbau eingefroren (kein Neuprüfen je Bild).
 */
export interface WorldMaterials {
  terrain: ShaderMaterial;
  terrainSimple: ShaderMaterial;
  roads: ShaderMaterial;
  buildings: ShaderMaterial;
  buildingsSimple: ShaderMaterial;
  /** Ein Material für alle Baumformen (Farben aus Vertex- und Instanzfarben). */
  trees: ShaderMaterial;
  water: ShaderMaterial;
  /** Zeit für bewegte Materialien (Wasser), je Bild. */
  setTime(seconds: number): void;
  /** Nebelbereich setzen (nur bei Änderung, z. B. Qualitätswechsel). */
  setFog(fogStart: number, fogEnd: number): void;
  dispose(): void;
}

export function createWorldMaterials(scene: Scene): WorldMaterials {
  const terrain = createTerrainMaterial(scene, 'terrain', 1);
  const terrainSimple = createTerrainMaterial(scene, 'terrain-simple', 0);
  const roads = createRoadMaterial(scene);
  const buildings = createBuildingMaterial(scene, 'buildings', 1);
  const buildingsSimple = createBuildingMaterial(scene, 'buildings-simple', 0);
  const trees = createLitMaterial(scene, 'trees');
  const water = createWaterMaterial(scene);
  const all = [terrain, terrainSimple, roads, buildings, buildingsSimple, trees, water];
  let fogKey = '';
  const setFog = (fogStart: number, fogEnd: number) => {
    const key = `${fogStart}/${fogEnd}`;
    if (key === fogKey) return;
    fogKey = key;
    const v = new Vector2(fogStart, fogEnd);
    for (const m of all) m.setVector2('fogRange', v);
  };
  setFog(scene.fogStart, scene.fogEnd);
  for (const m of all) m.freeze();
  return {
    terrain,
    terrainSimple,
    roads,
    buildings,
    buildingsSimple,
    trees,
    water,
    setTime: (t) => water.setFloat('time', t % 1000),
    setFog,
    dispose() {
      for (const m of all) m.dispose();
    },
  };
}
