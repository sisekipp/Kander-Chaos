"""
NPC-Figuren für Kandern Chaos (Kinder, Erwachsene, Ältere; stilisiert, ohne Logos), Blender-Kommandozeile:

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/npcs.py -- assets/own

Alle teilen Skelett (`figkit.skeleton`) und Animationssatz: stehen, gehen, rennen, winken, umfallen, aufstehen.
Die Asset-Pipeline backt die Animationen in eine Animationstextur je Figur (`src/bakeVat.ts`) und entfernt sie
danach aus dem Modell; im Spiel laufen die Figuren über Babylons BakedVertexAnimationManager mit Thin Instances.
Farben sind fest (kein Farbzonen-Material): ein Material, ein Draw Call je Figurmodell.
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from figanim import CLIPS, NPC_CLIPS, bake_actions  # noqa: E402
from figkit import COLORS, build_body, material, reset, rig  # noqa: E402
from figure import export  # noqa: E402

# Kleidung je Figur: Materialnamen bleiben `shirt`/`pants`/`hair`, nur die Farben ändern sich
NPCS = [
    ("npc-kid-girl", dict(h=1.30, hair="pony", legs="skirt", head=1.3, limb=1.25),
     dict(shirt=(0.95, 0.55, 0.70), pants=(0.30, 0.45, 0.75), hair=(0.80, 0.60, 0.30))),
    ("npc-kid-boy", dict(h=1.35, hair="short", legs="shorts", head=1.3, limb=1.25, cap=True),
     dict(shirt=(0.30, 0.70, 0.40), pants=(0.25, 0.25, 0.30), hair=(0.20, 0.13, 0.08), cap=(0.20, 0.40, 0.85))),
    ("npc-teen", dict(h=1.62, hair="long", legs="long", sleeves="long", head=1.1, limb=1.1),
     dict(shirt=(0.15, 0.15, 0.18), pants=(0.35, 0.45, 0.65), hair=(0.12, 0.09, 0.07))),
    ("npc-woman", dict(h=1.68, hair="bun", legs="skirt", head=1.0, limb=1.05),
     dict(shirt=(0.85, 0.30, 0.25), pants=(0.20, 0.25, 0.40), hair=(0.55, 0.30, 0.15))),
    ("npc-man", dict(h=1.80, hair="short", legs="long", head=1.0, width=1.1, limb=1.1, beard=True),
     dict(shirt=(0.35, 0.50, 0.80), pants=(0.40, 0.33, 0.25), hair=(0.30, 0.20, 0.12))),
    ("npc-worker", dict(h=1.78, hair="short", legs="long", sleeves="long", head=1.0, width=1.15, limb=1.15, cap=True),
     dict(shirt=(0.98, 0.55, 0.10), pants=(0.20, 0.30, 0.45), hair=(0.15, 0.12, 0.10), cap=(0.95, 0.85, 0.20))),
    ("npc-grandma", dict(h=1.58, hair="bun", legs="skirt", sleeves="long", head=1.05, width=1.1, belly=0.03),
     dict(shirt=(0.55, 0.35, 0.60), pants=(0.35, 0.30, 0.40), hair=(0.85, 0.85, 0.88))),
    ("npc-grandpa", dict(h=1.70, hair="bald", legs="long", sleeves="long", head=1.05, width=1.15, belly=0.06,
                         beard=True, cap=True),
     dict(shirt=(0.45, 0.55, 0.40), pants=(0.30, 0.30, 0.32), hair=(0.80, 0.80, 0.82), cap=(0.35, 0.30, 0.25))),
]

NPC_SET = {k: CLIPS[k] for k in ("idle", "walk", "run")} | NPC_CLIPS


def main():
    for name, params, colors in NPCS:
        reset()
        for mat, c in {**COLORS, **colors}.items():
            material(mat, c)
        body, bones = build_body(params)
        arm, mesh, tris = rig(body, bones, "npc")
        bake_actions(arm, NPC_SET, scale=params["h"] / 1.45)
        export(arm, mesh, name)
        print(f"[modelle] {name}: {tris} Dreiecke, Animationen {sorted(NPC_SET)}")


main()
