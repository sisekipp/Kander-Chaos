"""
Hubschrauber für Kandern Chaos (ziviler Mehrzweck-Hubschrauber, stilisiert, ohne Logos und Kennungen):

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/helicopter.py -- assets/own

Knoten: `body` (Rumpf, Lackzonen `paint` und `stripe`), `rotor-main` (Rotorkopf + 4 Blätter, dreht um die
Senkrechte durch seine Mitte), `rotor-tail` (Heckrotor, dreht um die Querachse), `detach_door_left/right`,
`detach_step_left/right`. Vorderseite −y (im glTF +z), Kufen-Unterkante bei z = 0.
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from kit import add, box, export, reset, tube  # noqa: E402

kit.COLORS.update(
    {
        "stripe": (0.95, 0.95, 0.95),
        "canopy": (0.18, 0.28, 0.36),
        "rotor": (0.16, 0.16, 0.17),
        "skid": (0.42, 0.43, 0.45),
        "nav_red": (0.95, 0.15, 0.1),
        "nav_green": (0.15, 0.85, 0.3),
        "nav_white": (1.0, 1.0, 0.95),
        "intake": (0.12, 0.12, 0.13),
    }
)


def loft(sections, mat, group="body", seg=14):
    """Rumpf aus Querschnitten (y, Breite, Höhe, z-Mitte); Ellipsen, Enden geschlossen."""
    me = bpy.data.meshes.new("loft")
    bm = bmesh.new()
    rings = []
    for y, w, h, zc in sections:
        ring = []
        for k in range(seg):
            a = 2 * math.pi * k / seg
            ring.append(bm.verts.new((math.cos(a) * w / 2, y, zc + math.sin(a) * h / 2)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("loft", me)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("smooth", "SUBSURF")
    mod.levels = 1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return add(o, mat, group)


def blade(length, chord, cx, cy, cz, angle, mat, group, axis="z"):
    """Rotorblatt als flacher, leicht verwundener Quader, radial vom Mittelpunkt."""
    if axis == "z":
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + math.cos(angle) * length / 2, cy + math.sin(angle) * length / 2, cz))
        o = bpy.context.object
        o.scale = (length, chord, 0.05)
        o.rotation_euler = (0.04, 0, angle)
    else:  # Heckrotor in der y-z-Ebene
        bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy + math.cos(angle) * length / 2, cz + math.sin(angle) * length / 2))
        o = bpy.context.object
        o.scale = (0.04, length, chord)
        o.rotation_euler = (angle, 0, 0)
    return add(o, mat, group)


def helicopter():
    # Rumpf: Nase (−y) bis Kabinenende, dann Heckausleger
    loft(
        [
            (-2.75, 0.25, 0.35, 1.25),
            (-2.55, 0.95, 1.05, 1.3),
            (-2.1, 1.45, 1.55, 1.42),
            (-1.2, 1.65, 1.8, 1.5),
            (0.2, 1.68, 1.85, 1.52),
            (1.4, 1.5, 1.7, 1.6),
            (2.1, 1.0, 1.15, 1.75),
            (2.6, 0.55, 0.62, 1.88),
        ],
        "paint",
    )
    loft([(2.5, 0.5, 0.58, 1.9), (4.5, 0.36, 0.42, 2.0), (6.6, 0.24, 0.3, 2.1), (7.1, 0.2, 0.26, 2.15)], "paint")
    # Kabinenverglasung: größerer, angehobener Körper, untere Hälfte steckt im Rumpf
    loft(
        [
            (-2.62, 0.5, 0.45, 1.62),
            (-2.35, 1.2, 1.0, 1.72),
            (-1.7, 1.62, 1.25, 1.85),
            (-0.6, 1.7, 1.2, 1.92),
            (0.1, 1.66, 1.0, 1.95),
        ],
        "canopy",
    )
    # Zierstreifen (zweite Lackzone) und Seitenfenster hinten
    for s in (1, -1):
        box(0.04, 3.4, 0.14, (s * 0.85, -0.3, 1.5), "stripe")
        box(0.04, 2.6, 0.1, (s * 0.2, 4.2, 2.0), "stripe")
        box(0.03, 1.2, 0.55, (s * 0.83, 0.75, 1.55), "canopy", bevel=0.05)
    # Triebwerksverkleidung, Lufteinläufe, Auspuff
    box(1.0, 2.0, 0.55, (0, 0.6, 2.45), "paint", bevel=0.18)
    for s in (1, -1):
        box(0.05, 0.4, 0.3, (s * 0.5, 0.0, 2.45), "intake")
        tube((s * 0.3, 1.5, 2.55), (s * 0.45, 2.1, 2.6), 0.12, "skid", seg=8)
    # Mast
    tube((0, 0.3, 2.7), (0, 0.3, 3.15), 0.12, "rotor", seg=8)
    # Leitwerk: Seitenflosse, Höhenflosse mit Endscheiben
    box(0.1, 1.0, 1.3, (0, 6.8, 2.75), "paint", bevel=0.04)
    box(2.0, 0.55, 0.08, (0, 5.6, 2.08), "paint", bevel=0.02)
    for s in (1, -1):
        box(0.06, 0.5, 0.45, (s * 1.0, 5.6, 2.12), "stripe")
    # Kufen und Streben
    for s in (1, -1):
        tube((s * 1.0, -1.6, 0.06), (s * 1.0, 1.9, 0.06), 0.055, "skid", seg=8)
        tube((s * 1.0, -1.6, 0.06), (s * 1.0, -2.05, 0.32), 0.055, "skid", seg=8)
        for y in (-0.9, 1.1):
            tube((s * 1.0, y, 0.06), (s * 0.6, y, 0.85), 0.05, "skid", seg=8)
    for y in (-0.9, 1.1):
        tube((-0.62, y, 0.85), (0.62, y, 0.85), 0.05, "skid", seg=8)
    # Positionslichter, Blitzlicht, Landescheinwerfer
    box(0.12, 0.12, 0.08, (-0.85, -0.2, 1.65), "nav_red", bevel=0.03)
    box(0.12, 0.12, 0.08, (0.85, -0.2, 1.65), "nav_green", bevel=0.03)
    box(0.1, 0.1, 0.1, (0, 7.2, 2.2), "nav_white", bevel=0.03)
    box(0.18, 0.18, 0.12, (0, 1.4, 2.75), "nav_red", bevel=0.05)
    box(0.25, 0.12, 0.12, (0, -2.65, 0.85), "nav_white", bevel=0.04)
    # Türen und Trittstufen (lösbar)
    for s, name in ((1, "left"), (-1, "right")):
        box(0.04, 1.1, 0.8, (s * 0.86, -0.3, 1.2), "paint", f"detach_door_{name}")
        box(0.05, 0.12, 0.04, (s * 0.89, 0.1, 1.3), "skid", f"detach_door_{name}")
        box(0.35, 0.8, 0.05, (s * 1.05, -0.3, 0.45), "skid", f"detach_step_{name}")
    # Hauptrotor: Kopf und vier Blätter (eigener Knoten)
    tube((0, 0.3, 3.1), (0, 0.3, 3.35), 0.22, "rotor", "rotor-main", seg=10)
    for k in range(4):
        blade(5.0, 0.3, 0, 0.3, 3.25, k * math.pi / 2 + math.pi / 4, "rotor", "rotor-main")
    # Heckrotor rechts am Ausleger (eigener Knoten)
    tube((0.1, 7.0, 2.6), (0.28, 7.0, 2.6), 0.1, "rotor", "rotor-tail", seg=8)
    for k in range(2):
        blade(0.85, 0.16, 0.24, 7.0, 2.6, k * math.pi, "rotor", "rotor-tail", axis="x")
    export("helicopter")


def helipad():
    """Landeplatz: runde Betonplatte mit weißem Kreis und H, Randlichter."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=9, depth=0.3, location=(0, 0, 0.0))
    add(bpy.context.object, "skid", "pad")
    bpy.ops.mesh.primitive_torus_add(major_radius=7.0, minor_radius=0.25, major_segments=32, minor_segments=4, location=(0, 0, 0.16))
    o = bpy.context.object
    o.scale = (1, 1, 0.2)
    add(o, "stripe", "pad")
    box(0.7, 5.0, 0.04, (-1.6, 0, 0.15), "stripe", "pad")
    box(0.7, 5.0, 0.04, (1.6, 0, 0.15), "stripe", "pad")
    box(3.2, 0.7, 0.04, (0, 0, 0.15), "stripe", "pad")
    for k in range(12):
        a = 2 * math.pi * k / 12
        box(0.25, 0.25, 0.2, (math.cos(a) * 8.6, math.sin(a) * 8.6, 0.15), "nav_green" if k % 2 else "nav_white", "pad")
    export("helipad")


for build in (helicopter, helipad):
    reset()
    build()
print("[helicopter] fertig")
