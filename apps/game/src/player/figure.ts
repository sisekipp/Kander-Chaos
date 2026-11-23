import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { getModels } from '../assets/ModelRegistry.ts';
import { FigureAnimator } from './animation/FigureAnimator.ts';
import { variantColors } from './figureVariants.ts';

export const FIGURE_MODEL = 'figure-kid';
/** Becken über den Fußsohlen minus halbe Beckenhöhe: so tief sitzt die Figur unter dem Sitzpunkt. */
export const SEAT_DROP = 0.69;

export interface Figure {
  /** Lage und Blickrichtung (vom Walker gesetzt). */
  root: TransformNode;
  /** Sichtbares Modell, Kind von `root` – auf dem Zweirad hängt es am Fahrzeug. */
  model: TransformNode;
  meshes: AbstractMesh[];
  /** Animationen (null beim Kapsel-Rückfall ohne Modell). */
  animator: FigureAnimator | null;
  variant: number;
  setVisible(v: boolean): void;
  setVariant(v: number): void;
  /** Modell an einen Sitzpunkt hängen (Zweirad) bzw. mit `null` zurück zur Figur. */
  attachTo(parent: TransformNode | null, x?: number, y?: number, z?: number): void;
  dispose(): void;
}

function material(scene: Scene, name: string, c: Color3, alpha = 1): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = c;
  m.specularColor = Color3.Black();
  m.alpha = alpha;
  return m;
}

/**
 * Spielfigur aus dem Modell `figure-kid` (Skelett, 8 Animationen, Farbzonen je Variante); ohne geladenes Modell
 * (Tests ohne Modelle) eine Kapsel. Blob-Schatten unter `root`.
 */
export function createFigure(scene: Scene, variant = 0): Figure {
  const root = new TransformNode('player', scene);
  const model = new TransformNode('player-model', scene);
  model.parent = root;
  const materials: StandardMaterial[] = [];
  const zones = new Map<string, StandardMaterial>();
  let animator: FigureAnimator | null = null;
  const meshes: AbstractMesh[] = [];
  const disposeSkeletons: (() => void)[] = [];

  const registry = getModels();
  if (registry?.isLoaded(FIGURE_MODEL)) {
    const inst = registry.instantiate(FIGURE_MODEL, 'player');
    for (const n of inst.rootNodes) n.parent = model;
    const fixed = material(scene, 'player-fixed', Color3.White());
    materials.push(fixed);
    for (const n of inst.rootNodes)
      for (const m of n.getChildMeshes(false)) {
        const zone = /zone_(\w+)/.exec(m.material?.name ?? '')?.[1];
        m.material?.dispose();
        if (zone) {
          let zm = zones.get(zone);
          if (!zm) {
            zm = material(scene, `player-${zone}`, Color3.White());
            zones.set(zone, zm);
            materials.push(zm);
          }
          m.material = zm;
        } else m.material = fixed;
        m.hasVertexAlpha = false; // RGBA ohne echtes Alpha
        m.isPickable = false;
        m.alwaysSelectAsActiveMesh = true; // Skelett bewegt die Glieder über die Ruhe-Box hinaus
        meshes.push(m);
      }
    animator = new FigureAnimator(inst.animationGroups);
    for (const sk of inst.skeletons) disposeSkeletons.push(() => sk.dispose());
  } else {
    const body = CreateCapsule('player-body', { height: 1.75, radius: 0.33, tessellation: 10 }, scene);
    body.position.y = 0.875;
    const bm = material(scene, 'player-shirt', new Color3(0.95, 0.45, 0.2));
    zones.set('shirt', bm);
    materials.push(bm);
    body.material = bm;
    body.parent = model;
    body.isPickable = false;
    meshes.push(body);
  }
  const shadow = CreateDisc('player-shadow', { radius: 0.45, tessellation: 16 }, scene);
  shadow.rotation.x = Math.PI / 2;
  shadow.position.y = 0.05;
  const sm = material(scene, 'player-shadow', Color3.Black(), 0.35); // Blob-Schatten (Qualität „Niedrig“)
  materials.push(sm);
  shadow.material = sm;
  shadow.parent = root;
  shadow.isPickable = false;

  const fig: Figure = {
    root,
    model,
    meshes,
    animator,
    variant,
    setVisible: (v) => {
      root.setEnabled(v);
      if (model.parent !== root) model.setEnabled(v);
    },
    setVariant: (v) => {
      const c = variantColors(v);
      fig.variant = v;
      for (const [zone, m] of zones) {
        const rgb = zone === 'shirt' ? c.shirt : zone === 'pants' ? c.pants : zone === 'hair' ? c.hair : null;
        if (rgb) m.diffuseColor = new Color3(...rgb);
      }
    },
    attachTo: (parent, x = 0, y = 0, z = 0) => {
      model.parent = parent ?? root;
      model.position.set(parent ? x : 0, parent ? y : 0, parent ? z : 0);
      model.rotationQuaternion = null;
      model.rotation.set(0, 0, 0);
      model.setEnabled(true);
    },
    dispose: () => {
      animator?.dispose();
      model.dispose(false, false);
      for (const d of disposeSkeletons) d();
      shadow.dispose();
      for (const m of materials) m.dispose();
      root.dispose();
    },
  };
  fig.setVariant(variant);
  return fig;
}
