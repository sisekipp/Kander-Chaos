"""
Bausteine für Automodelle (Blender-Kommandozeile): Karosserie aus Seitenprofilen, Radläufe, Räder, Kennzeichen
und ein allgemeiner Auto-Bauer `car(c)`, der aus wenigen Maßen ein vollständiges Auto mit Lichtern, Türen,
Spiegeln und Stoßfängern macht. Vorderseite −y, links = +x, Boden z = 0.
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from kit import add, box, export, tube  # noqa: E402


def prism(profile, hw_bottom, hw_top, mat, group="body", bevel=0.0):
    """Seitenprofil [(y, z), …] (geschlossen) über die Breite ziehen; halbe Breite wächst linear von unten nach oben."""
    zs = [z for _, z in profile]
    z0, z1 = min(zs), max(zs)
    hw = lambda z: hw_bottom + (hw_top - hw_bottom) * ((z - z0) / (z1 - z0) if z1 > z0 else 0)  # noqa: E731
    mesh = bpy.data.meshes.new("prism")
    bm = bmesh.new()
    left = [bm.verts.new((hw(z), y, z)) for y, z in profile]
    right = [bm.verts.new((-hw(z), y, z)) for y, z in profile]
    bm.faces.new(left)
    bm.faces.new(list(reversed(right)))
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[j], left[i], right[i], right[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    o = bpy.data.objects.new("prism", mesh)
    bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    if bevel > 0:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return add(o, mat, group)


def cut_arches(obj, axles, radius):
    """Radläufe: Zylinder entlang x von der Karosserie abziehen."""
    for y, z in axles:
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=3, location=(0, y, z), rotation=(0, math.pi / 2, 0))
        cutter = bpy.context.object
        mod = obj.modifiers.new("arch", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = cutter
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter)


def car_wheel(name, x, y, r, width):
    side = 1 if x > 0 else -1
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=width, location=(x, y, r), rotation=(0, math.pi / 2, 0))
    add(bpy.context.object, "tire", name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=r * 0.62, depth=0.02, location=(x + side * width / 2, y, r), rotation=(0, math.pi / 2, 0))
    add(bpy.context.object, "rim", name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=r * 0.18, depth=0.03, location=(x + side * (width / 2 + 0.01), y, r), rotation=(0, math.pi / 2, 0))
    add(bpy.context.object, "chrome", name)


def plate(y, z, group, facing):
    """Kennzeichen ohne Schrift mit blauem Euro-Streifen links."""
    box(0.52, 0.012, 0.12, (0, y, z), "plate", group)
    box(0.05, 0.014, 0.12, (-0.235 * facing, y + 0.001 * facing, z), "plate_blue", group)


def lerp(p, q, t):
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def car(c):
    """
    Auto aus einem Maß-Wörterbuch:
    lower: Seitenprofil der Karosserie [(y, z)], hw: halbe Breite, r: Radradius, wb: halber Radstand,
    track: halbe Spurweite, front/rear: y der Stirnflächen, cabin: Glasprofil [Basis vorn, Scheibe oben,
    Dach hinten, Basis hinten] (oder None), cab_hw: (unten, oben), b: y der B-/C-Säulen, doors: [(Mitte, Länge)],
    lamp_z/tail_z/bumper_z: Höhen, roof: Dach in Wagenfarbe (Standard ja), extras: Funktion für Sonderteile.
    """
    r, wb, hw = c["r"], c["wb"], c["hw"]
    body = prism(c["lower"], hw, hw - 0.03, "paint", bevel=c.get("bevel", 0.06))
    cut_arches(body, [(-wb, r), (wb, r)], r + 0.05)
    cab = c.get("cabin")
    belt = c.get("belt", cab[0][1] if cab else 0.9)
    if cab:
        cb, ct = c["cab_hw"]
        prism(cab, cb, ct, "glass")
        if c.get("roof", True):
            (y1, z1), (y2, z2) = cab[1], cab[2]
            prism([(y1 - 0.05, z1 - 0.01), (y2 + 0.04, z2 - 0.01), (y2 + 0.02, z2 + 0.05), (y1 + 0.04, z1 + 0.04)], ct + 0.02, ct + 0.02, "paint", bevel=0.015)
        for s in (1, -1):
            tube((s * (cb - 0.01), cab[0][0], cab[0][1]), (s * ct, cab[1][0], cab[1][1]), 0.035, "paint")  # A-Säule
            if c.get("roof", True):
                tube((s * (cb - 0.01), cab[3][0], cab[3][1]), (s * ct, cab[2][0], cab[2][1]), c.get("c_r", 0.06), "paint")
            for by in c.get("b", []):
                t0 = (by - cab[0][0]) / (cab[3][0] - cab[0][0])
                t1 = (by - cab[1][0]) / (cab[2][0] - cab[1][0])
                lo, hi = lerp(cab[0], cab[3], t0), lerp(cab[1], cab[2], t1)
                tube((s * (cb + 0.005), by, lo[1]), (s * (ct + 0.005), by, hi[1]), 0.04, "paint")
    fy, ry = c["front"], c["rear"]
    lz, tz, bz = c.get("lamp_z", 0.7), c.get("tail_z", 0.8), c.get("bumper_z", 0.42)
    for s in (1, -1):
        name = "left" if s > 0 else "right"
        box(0.3, 0.06, 0.13, (s * (hw - 0.28), fy + 0.04, lz), "lamp", rot=(math.radians(-15), 0, 0), bevel=0.02)
        box(0.08, 0.04, 0.05, (s * (hw - 0.06), fy + 0.06, lz - 0.08), "indicator")
        box(0.16, 0.05, 0.26, (s * (hw - 0.13), ry - 0.03, tz), "taillight", bevel=0.02)
        dz0, dz1 = bz + 0.04, belt - 0.03
        for k, (dy, dl) in enumerate(c.get("doors", [])):
            group = f"detach_door_{name}" if k == 0 else "body"
            box(0.02, dl, dz1 - dz0, (s * (hw + 0.005), dy, (dz0 + dz1) / 2), "paint", group)
            box(0.025, 0.12, 0.03, (s * (hw + 0.02), dy + dl / 2 - 0.15, dz1 - 0.07), "plastic", group)
        if cab:
            mirror = f"detach_mirror_{name}"
            my, mz = cab[0][0] + 0.12, cab[0][1] + 0.08
            tube((s * (hw - 0.04), my, mz), (s * (hw + 0.08), my, mz + 0.05), 0.02, "plastic", mirror)
            box(0.14, 0.07, 0.1, (s * (hw + 0.12), my + 0.01, mz + 0.07), "paint", mirror, bevel=0.02)
        box(0.03, 2 * wb - 2 * r - 0.25, 0.06, (s * (hw + 0.005), 0, bz - 0.04), "plastic")  # Schweller
    box(0.62, 0.04, 0.12, (0, fy + 0.02, lz - 0.1), "plastic", bevel=0.02)  # Kühlergrill
    bw = 2 * hw + 0.04
    box(bw, 0.24, 0.24, (0, fy + 0.08, bz), "plastic", "detach_bumper_front", bevel=0.06)
    plate(fy - 0.045, bz + 0.02, "detach_bumper_front", -1)
    box(bw, 0.24, 0.24, (0, ry - 0.08, bz), "plastic", "detach_bumper_back", bevel=0.06)
    plate(ry + 0.005, c.get("rear_plate_z", bz + 0.24), "body", 1)
    if c.get("extras"):
        c["extras"](c)
    for wy, fb in ((-wb, "front"), (wb, "back")):
        car_wheel(f"wheel-{fb}-left", c["track"], wy, r, c.get("tire_w", 0.19))
        car_wheel(f"wheel-{fb}-right", -c["track"], wy, r, c.get("tire_w", 0.19))
    export(c["id"])
