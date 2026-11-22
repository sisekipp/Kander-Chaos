import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { VehicleSpec } from '../specs.ts';
import { CHROME, DARK, GLASS, LIGHT, PartKit, RIM, TIRE } from '../../engine/procedural/PartKit.ts';
import { darken, type RGB } from './palette.ts';
import type { VehicleModel } from './types.ts';

/** Kleines, rundliches Spielzeugauto (Low-Poly). Ursprung = Mitte des Kollisionskörpers. */
export function buildCar(scene: Scene, spec: VehicleSpec, paint: RGB, name: string): VehicleModel {
  const kit = new PartKit(scene, name);
  const root = new TransformNode(name, scene);
  const [w, h, l] = spec.box;
  const roof = darken(paint, 0.92);
  kit.box(w, h * 0.55, l, [0, -0.12, 0], paint); // Unterbau
  kit.box(w * 0.86, h * 0.45, l * 0.52, [0, 0.36, -0.15], roof); // Kabine
  kit.box(w * 0.8, h * 0.36, 0.05, [0, 0.36, l * 0.11 - 0.02], GLASS, { rotX: -0.35 }); // Frontscheibe
  kit.box(w * 0.8, h * 0.34, 0.05, [0, 0.36, -l * 0.41], GLASS, { rotX: 0.3 }); // Heckscheibe
  kit.box(w * 0.88, h * 0.3, l * 0.4, [0, 0.38, -0.15], GLASS); // Seitenfenster (durchgehend)
  kit.box(w * 0.86, h * 0.08, l * 0.5, [0, 0.6, -0.15], roof); // Dach über den Fenstern
  for (const s of [-1, 1]) kit.box(0.28, 0.12, 0.05, [s * w * 0.32, -0.02, l / 2 + 0.01], LIGHT); // Scheinwerfer
  const bumperF = kit.box(w * 1.02, 0.18, 0.22, [0, -0.32, l / 2 + 0.06], CHROME, { fixed: false });
  const bumperR = kit.box(w * 1.02, 0.18, 0.22, [0, -0.32, -l / 2 - 0.06], DARK, { fixed: false });
  const mirrors = [-1, 1].map((s) =>
    kit.box(0.18, 0.1, 0.08, [s * (w / 2 + 0.08), 0.2, l * 0.12], paint, { fixed: false }),
  );
  const body = kit.mergeFixed(`${name}-body`, root);
  const detachable = [bumperF, bumperR, ...mirrors];
  for (const d of detachable) d.parent = root;
  const wheels = spec.wheels.map((wh) =>
    kit.wheel(wh.radius, 0.26, [wh.x, wh.y - spec.suspension.rest + wh.radius, wh.z], TIRE, RIM, root),
  );
  return {
    root,
    body,
    wheels,
    steerNode: null,
    detachable,
    material: kit.material,
    dispose: () => {
      root.dispose(false, false);
      kit.material.dispose();
    },
  };
}
