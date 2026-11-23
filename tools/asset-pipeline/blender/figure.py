"""
Spielfigur für Kandern Chaos (freundliches Low-Poly-Kind, ≈ 1,45 m), Blender-Kommandozeile:

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/figure.py -- assets/own

Ein Mesh mit Skelett (`figkit.skeleton`) und den Animationen idle, walk, run, jump, fall, enter, exit, sit.
Farbzonen `shirt`, `pants`, `hair` färbt das Spiel je Variante (`player/figureVariants.ts`). Kein Text, keine Logos.
"""
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from figanim import CLIP_SPEEDS, CLIPS, bake_actions  # noqa: E402
from figkit import build_body, reset, rig  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "assets/own"


def export(arm, mesh, name):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    mesh.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=f"{OUT}/{name}.glb",
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=2,
        export_def_bones=True,
    )


def main():
    reset()
    body, bones = build_body(dict(h=1.45, hair="short", legs="long", sleeves="short", head=1.3, width=1.1, limb=1.3))
    arm, mesh, tris = rig(body, bones, "figure")
    bake_actions(arm, CLIPS)
    export(arm, mesh, "figure-kid")
    print(f"[modelle] figure-kid: {tris} Dreiecke, Animationen {sorted(CLIPS)}, Geschwindigkeiten {CLIP_SPEEDS}")


if __name__ == "__main__":
    main()
