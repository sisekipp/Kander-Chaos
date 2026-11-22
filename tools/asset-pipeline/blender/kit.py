"""
Gemeinsame Bausteine der Fahrzeug-Skripte (Blender-Kommandozeile): Materialien, Grundkörper, Räder, Export.
Objekte werden Gruppen zugeordnet; jede Gruppe wird beim Export zu einem Knoten gleichen Namens verbunden
(`body`, `steer`, `wheel-*`, `detach_*`). Blender ist z-oben, Vorderseite zeigt nach −y (im glTF +z).
"""
import math
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "assets/own"

COLORS = {
    "paint": (0.85, 0.85, 0.85),
    "tire": (0.10, 0.10, 0.11),
    "rim": (0.55, 0.57, 0.60),
    "chrome": (0.78, 0.79, 0.81),
    "metal_dark": (0.20, 0.21, 0.22),
    "seat": (0.16, 0.13, 0.11),
    "grip": (0.12, 0.12, 0.12),
    "basket": (0.55, 0.38, 0.22),
    "lamp": (1.00, 0.95, 0.75),
    "taillight": (0.90, 0.15, 0.12),
    "engine": (0.30, 0.31, 0.33),
    "bottle": (0.20, 0.55, 0.85),
    "glass": (0.16, 0.22, 0.28),
    "plastic": (0.18, 0.18, 0.19),
    "plate": (0.95, 0.95, 0.93),
    "plate_blue": (0.10, 0.25, 0.65),
    "indicator": (0.98, 0.60, 0.10),
}

groups = {}


def reset():
    groups.clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    r, g, b = COLORS[name]
    bsdf.inputs[0].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    return m


def add(obj, mat, group):
    obj.data.materials.clear()
    obj.data.materials.append(material(mat))
    groups.setdefault(group, []).append(obj)
    return obj


def box(sx, sy, sz, center, mat, group="body", rot=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    if rot:
        o.rotation_euler = rot
    if bevel > 0:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return add(o, mat, group)


def tube(p1, p2, r, mat, group="body", seg=6):
    """Rohr von p1 nach p2 (Rahmen, Gabel, Streben)."""
    a, b = Vector(p1), Vector(p2)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return add(o, mat, group)


def bar(width, center, r, mat, group):
    """Querrohr entlang x (Lenker, Achse)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=r, depth=width, location=center, rotation=(0, math.pi / 2, 0))
    return add(bpy.context.object, mat, group)


def ball(r, center, mat, group, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=center)
    o = bpy.context.object
    o.scale = scale
    return add(o, mat, group)


def wheel(name, y, radius, tire_r, width, spokes=4, hub="rim", rim_mat="rim"):
    """Rad um die x-Achse: Reifen (Torus), Felge, Nabe und einige Speichen."""
    z = radius
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius - tire_r,
        minor_radius=tire_r,
        major_segments=16,
        minor_segments=6,
        location=(0, y, z),
        rotation=(0, math.pi / 2, 0),
    )
    add(bpy.context.object, "tire", name)
    rim_r = radius - tire_r * 2
    bpy.ops.mesh.primitive_torus_add(
        major_radius=rim_r,
        minor_radius=min(0.018, tire_r * 0.5),
        major_segments=16,
        minor_segments=4,
        location=(0, y, z),
        rotation=(0, math.pi / 2, 0),
    )
    add(bpy.context.object, rim_mat, name)
    bar(width * 1.6, (0, y, z), 0.035, hub, name)
    for k in range(spokes):
        a = k * math.pi / spokes
        dy, dz = math.cos(a) * rim_r, math.sin(a) * rim_r
        tube((0, y - dy, z - dz), (0, y + dy, z + dz), 0.008 if spokes > 3 else 0.03, rim_mat, name, seg=4)


def arc(cy, cz, r, a0, a1, n, width, thick, mat, group):
    """Kotflügel: Bogen aus kurzen Quadern um die Radmitte (Winkel ab +y gegen den Uhrzeigersinn, Grad)."""
    for k in range(n):
        a = math.radians(a0 + (a1 - a0) * (k + 0.5) / n)
        seg = r * math.radians(abs(a1 - a0)) / n * 1.08
        box(width, seg, thick, (0, cy + math.cos(a) * r, cz + math.sin(a) * r), mat, group, rot=(a - math.pi / 2, 0, 0))


def export(name):
    """Gruppen zu je einem Objekt verbinden (Name = Knotenname) und als GLB schreiben."""
    bpy.ops.object.select_all(action="DESELECT")
    tris = 0
    for gname, objs in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if len(objs) > 1:
            bpy.ops.object.join()
        o = bpy.context.object
        o.name = gname
        o.data.name = gname
        bpy.ops.object.shade_flat()
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=f"{OUT}/{name}.glb", export_format="GLB", use_selection=True, export_apply=True)
    print(f"[modelle] {name}: {tris} Dreiecke, Knoten {sorted(groups)}")
