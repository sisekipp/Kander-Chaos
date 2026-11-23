import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

/** Sichtbares Fahrzeugmodell. `root` ist der Fahrzeugmittelpunkt (Mitte des Kollisionskörpers). */
export interface VehicleModel {
  root: TransformNode;
  body: Mesh;
  /** Radknoten in der Reihenfolge der Räder aus der Spezifikation. */
  wheels: TransformNode[];
  /** Lenker/Vorderbau (Zweiräder) – dreht mit der Lenkung. */
  steerNode: TransformNode | null;
  /** Teile, die bei Schaden abfallen können (Stoßstange, Spiegel, Schutzblech …). */
  detachable: Mesh[];
  material: StandardMaterial;
  /** Sitzpunkt der Figur relativ zu `root` (Zweiräder mit Sitzknoten), sonst null. */
  seat?: Vector3 | null;
  dispose(): void;
}
