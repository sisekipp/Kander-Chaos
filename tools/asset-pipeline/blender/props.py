"""
Eigene Prop-Modelle für Kandern Chaos (Low-Poly, deutscher Stil), gebaut mit der Blender-Kommandozeile:

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/props.py -- assets/own

Jedes Modell: Fußpunkt im Ursprung, Maße passend zu PROP_EXTENTS im Spiel (Busch 1,4 × 1,1, Mülleimer
0,5 × 0,95, Zaunfeld 2,5 × 1,0, Schild 2,4 m, Laterne 4,6 m, Bank 1,7 × 0,85), wenige Materialien mit
Grundfarbe (die Asset-Pipeline backt sie in Vertex-Farben ein). Farbwerte sind Anzeigewerte (das Spiel rechnet
ohne Gammaumwandlung). Kein Text, keine Logos. Deterministisch (feste Zufallsstartwerte).
Blender ist z-oben; der glTF-Export dreht nach y-oben. Vorderseite (Schildfläche, Leuchte) zeigt nach −y.
"""
import math
import random
import sys

import bmesh
import bpy

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "assets/own"

COLORS = {
    "leaf": (0.30, 0.52, 0.22),
    "leaf_light": (0.40, 0.62, 0.28),
    "leaf_dark": (0.22, 0.40, 0.18),
    "wood": (0.58, 0.40, 0.24),
    "wood_light": (0.70, 0.52, 0.32),
    "metal": (0.42, 0.44, 0.46),
    "metal_dark": (0.20, 0.21, 0.22),
    "bin_green": (0.20, 0.34, 0.26),
    "concrete": (0.68, 0.67, 0.64),
    "sign_white": (0.95, 0.95, 0.93),
    "sign_red": (0.80, 0.12, 0.10),
    "light_red": (0.95, 0.20, 0.15),
    "light_yellow": (0.98, 0.75, 0.15),
    "light_green": (0.20, 0.85, 0.35),
    "lamp_glow": (1.00, 0.95, 0.75),
    "sign_blue": (0.10, 0.32, 0.68),
    "sign_yellow": (0.98, 0.80, 0.10),
    "sign_green": (0.12, 0.50, 0.26),
    "post_yellow": (0.98, 0.78, 0.12),
    "hydrant_red": (0.80, 0.14, 0.10),
    "reflect_white": (0.95, 0.95, 0.95),
    "column_green": (0.20, 0.34, 0.27),
    "poster_a": (0.90, 0.55, 0.20),
    "poster_b": (0.30, 0.55, 0.80),
    "poster_c": (0.92, 0.85, 0.60),
    "soil": (0.30, 0.22, 0.16),
    "flower_red": (0.86, 0.22, 0.25),
    "flower_white": (0.95, 0.93, 0.88),
}


def reset():
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


def finish(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(material(mat))
    return obj


def cylinder(r, h, x, y, z, mat, seg=10, r2=None, rot=None):
    """Zylinder/Kegelstumpf, Unterkante bei z (ohne Drehung)."""
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r if r2 is None else r2, depth=h, location=(x, y, z + h / 2))
    o = bpy.context.object
    if rot:
        o.rotation_euler = rot
    return finish(o, mat)


def disc(r, depth, x, y, z, mat, seg=24):
    """Scheibe mit der Fläche zur −y-Seite (Schilder, Ampellichter)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=(x, y, z), rotation=(math.pi / 2, 0, 0))
    return finish(bpy.context.object, mat)


def box(sx, sy, sz, x, y, z, mat, rot=None):
    """Quader mit Unterkante bei z (sx, sy, sz = volle Maße)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + sz / 2))
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    if rot:
        o.rotation_euler = rot
    return finish(o, mat)


def blob(r, x, y, z, sx, sy, sz, mat, seed, sub=2, jitter=0.12):
    """Unregelmäßige Kugel (Busch): Ikosaeder mit deterministisch versetzten Ecken."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=(x, y, z))
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    rnd = random.Random(seed)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for v in bm.verts:
        v.co *= 1.0 + rnd.uniform(-jitter, jitter)
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, mat)


def export(name):
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    bpy.ops.object.shade_flat()
    bpy.ops.export_scene.gltf(filepath=f"{OUT}/{name}.glb", export_format="GLB", use_selection=True, export_apply=True)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f"[props] {name}: {tris} Dreiecke, {len(obj.data.materials)} Materialien")


def bush_round():
    blob(0.62, 0, 0, 0.55, 1.0, 1.0, 0.82, "leaf", 1)
    blob(0.40, 0.28, 0.16, 0.82, 1.0, 1.0, 0.85, "leaf_light", 2, sub=1)
    blob(0.36, -0.30, -0.12, 0.42, 1.0, 1.0, 0.8, "leaf_dark", 3, sub=1)
    export("bush-round")


def bush_tall():
    blob(0.46, 0, 0, 0.85, 1.0, 1.0, 1.75, "leaf_dark", 4)
    blob(0.32, 0.10, 0.08, 1.5, 1.0, 1.0, 1.4, "leaf", 5, sub=1)
    export("bush-tall")


def bin_street():
    cylinder(0.04, 0.42, 0, 0, 0, "metal_dark", seg=6)  # Pfosten
    cylinder(0.24, 0.55, 0, 0, 0.36, "bin_green", seg=12, r2=0.26)  # Behälter, leicht konisch
    cylinder(0.275, 0.05, 0, 0, 0.9, "metal_dark", seg=12)  # Deckelrand
    box(0.22, 0.05, 0.10, 0, -0.26, 0.76, "metal_dark")  # Einwurfklappe
    export("bin-street")


def fence_garden():
    """Holzlattenzaun entlang der Blender-y-Achse (im Spiel lokale z-Achse = Richtung der Zaunlinie):
    zwei Pfosten, zwei Riegel, elf Latten mit Spitze."""
    for y in (-1.2, 1.2):
        box(0.1, 0.1, 1.05, 0, y, 0, "wood")
    for z in (0.25, 0.75):
        box(0.04, 2.5, 0.08, 0.05, 0, z, "wood")
    for i in range(11):
        y = -1.1 + i * 0.22
        box(0.025, 0.09, 0.86, 0.085, y, 0.05, "wood_light")
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.064, radius2=0, depth=0.1, location=(0.085, y, 0.96), rotation=(0, 0, math.pi / 4))
        o = bpy.context.object
        o.scale = (0.28, 1, 1)
        finish(o, "wood_light")
    export("fence-garden")


def sign_stvo():
    """Rundes StVO-Schild (weiß mit rotem Rand, ohne Text) am grauen Rohrpfosten."""
    cylinder(0.035, 2.3, 0, 0, 0, "metal", seg=8)
    disc(0.3, 0.02, 0, -0.05, 2.0, "sign_red")
    disc(0.24, 0.02, 0, -0.062, 2.0, "sign_white")
    export("sign-stvo")


def traffic_light():
    cylinder(0.06, 2.4, 0, 0, 0, "metal_dark", seg=8)
    box(0.3, 0.22, 0.85, 0, -0.08, 2.15, "metal_dark")
    for i, mat in enumerate(("light_red", "light_yellow", "light_green")):
        disc(0.085, 0.03, 0, -0.2, 2.85 - i * 0.27, mat, seg=12)
    export("traffic-light")


def lamp_street():
    """Mastleuchte: konischer Mast, kurzer Ausleger, flaches Leuchtengehäuse mit hellem Leuchtfeld."""
    cylinder(0.09, 4.3, 0, 0, 0, "metal", seg=8, r2=0.055)
    box(0.06, 0.55, 0.06, 0, -0.25, 4.22, "metal")
    box(0.32, 0.62, 0.1, 0, -0.62, 4.2, "metal_dark")
    box(0.26, 0.52, 0.02, 0, -0.62, 4.18, "lamp_glow")
    export("lamp-street")


def bench_park():
    for x in (-0.7, 0.7):
        box(0.08, 0.5, 0.42, x, 0, 0, "concrete")  # Füße
        box(0.06, 0.06, 0.45, x, 0.24, 0.42, "metal_dark", rot=(-0.15, 0, 0))  # Lehnenstütze
    for i in range(3):
        box(1.7, 0.12, 0.04, 0, -0.15 + i * 0.15, 0.42, "wood")
    for i in range(2):
        box(1.7, 0.03, 0.11, 0, 0.26 + i * 0.03, 0.52 + i * 0.16, "wood", rot=(-0.15, 0, 0))
    export("bench-park")


def triangle_plate(r, x, y, z, mat, point_down=True, depth=0.02):
    """Dreieckige Schildplatte mit Fläche zur −y-Seite (r = Umkreisradius)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=r, depth=depth, location=(x, y, z), rotation=(math.pi / 2, math.pi if point_down else 0, 0))
    o = bpy.context.object
    # Dreieck so drehen, dass eine Spitze nach unten (bzw. oben) zeigt
    o.rotation_euler = (math.pi / 2, 0, 0)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    angle = (-math.pi / 2 if point_down else math.pi / 2) - math.pi / 2
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(angle, 3, "Z"))
    bm.to_mesh(o.data)
    bm.free()
    return finish(o, mat)


def sign_triangle():
    """„Vorfahrt gewähren“: weißes Dreieck mit rotem Rand, auf der Spitze stehend (ohne Text)."""
    cylinder(0.035, 2.3, 0, 0, 0, "metal", seg=8)
    triangle_plate(0.42, 0, -0.05, 2.0, "sign_red")
    triangle_plate(0.30, 0, -0.062, 2.0, "sign_white")
    export("sign-triangle")


def sign_crossing():
    """„Fußgängerüberweg“: blaues Quadrat mit weißem Dreieck (vereinfachtes Symbol, ohne Text)."""
    cylinder(0.035, 2.3, 0, 0, 0, "metal", seg=8)
    box(0.56, 0.02, 0.56, 0, -0.05, 1.72, "sign_blue")
    triangle_plate(0.22, 0, -0.065, 1.98, "sign_white", point_down=False)
    export("sign-crossing")


def sign_busstop():
    """Haltestellenschild: gelbe Scheibe mit grünem Rand am Mast (ohne Buchstaben)."""
    cylinder(0.04, 2.6, 0, 0, 0, "metal", seg=8)
    disc(0.26, 0.02, 0, -0.05, 2.35, "sign_green")
    disc(0.2, 0.02, 0, -0.062, 2.35, "sign_yellow")
    box(0.35, 0.03, 0.22, 0, -0.04, 1.85, "sign_white")  # Fahrplantafel
    export("sign-busstop")


def postbox():
    """Gelber Briefkasten am Pfosten mit gewölbtem Dach (ohne Schriftzug/Logo)."""
    box(0.07, 0.07, 0.72, 0, 0, 0, "metal_dark")
    box(0.42, 0.32, 0.42, 0, 0, 0.7, "post_yellow")
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.21, depth=0.32, location=(0, 0, 1.12), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.scale = (1, 0.55, 1)
    finish(o, "post_yellow")
    box(0.26, 0.02, 0.03, 0, -0.17, 1.02, "metal_dark")  # Einwurfschlitz
    export("postbox")


def hydrant():
    """Überflurhydrant: roter Körper, Kappe, zwei seitliche Abgänge."""
    cylinder(0.16, 0.08, 0, 0, 0, "hydrant_red", seg=10)
    cylinder(0.12, 0.62, 0, 0, 0.08, "hydrant_red", seg=10)
    cylinder(0.14, 0.06, 0, 0, 0.68, "hydrant_red", seg=10)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=5, radius=0.12, location=(0, 0, 0.76))
    o = bpy.context.object
    o.scale = (1, 1, 0.8)
    finish(o, "hydrant_red")
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.05, depth=0.12, location=(sx * 0.15, 0, 0.5), rotation=(0, math.pi / 2, 0))
        finish(bpy.context.object, "metal")
    export("hydrant")


def bollard():
    """Poller: grauer Metallpfosten mit rot-weißen Reflexstreifen."""
    cylinder(0.08, 0.9, 0, 0, 0, "metal", seg=10)
    cylinder(0.083, 0.06, 0, 0, 0.62, "reflect_white", seg=10)
    cylinder(0.083, 0.06, 0, 0, 0.7, "sign_red", seg=10)
    cylinder(0.083, 0.06, 0, 0, 0.78, "reflect_white", seg=10)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=4, radius=0.08, location=(0, 0, 0.9))
    o = bpy.context.object
    o.scale = (1, 1, 0.5)
    finish(o, "metal")
    export("bollard")


def bike_rack():
    """Fahrradbügel (umgedrehtes U) entlang der Blender-y-Achse = lokale z-Achse im Spiel."""
    for y in (-0.38, 0.38):
        cylinder(0.025, 0.72, 0, y, 0, "metal", seg=6)
    for i in range(6):
        a0 = math.pi * i / 6
        a1 = math.pi * (i + 1) / 6
        y0, z0 = -math.cos(a0) * 0.38, 0.72 + math.sin(a0) * 0.12
        y1, z1 = -math.cos(a1) * 0.38, 0.72 + math.sin(a1) * 0.12
        length = math.hypot(y1 - y0, z1 - z0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.025, depth=length, location=(0, (y0 + y1) / 2, (z0 + z1) / 2), rotation=(math.atan2(-(y1 - y0), z1 - z0), 0, 0))
        finish(bpy.context.object, "metal")
    export("bike-rack")


def ad_column():
    """Litfaßsäule: grüner Sockel, bunte Plakatbänder (ohne Schrift), grüne Kuppel."""
    cylinder(0.62, 0.25, 0, 0, 0, "column_green", seg=16)
    for i, mat in enumerate(("poster_a", "poster_c", "poster_b", "poster_a", "poster_c")):
        cylinder(0.56, 0.5, 0, 0, 0.25 + i * 0.5, mat, seg=16)
    cylinder(0.64, 0.08, 0, 0, 2.75, "column_green", seg=16)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=6, radius=0.6, location=(0, 0, 2.83))
    o = bpy.context.object
    o.scale = (1, 1, 0.45)
    finish(o, "column_green")
    cylinder(0.04, 0.25, 0, 0, 3.05, "column_green", seg=6)
    export("ad-column")


def planter():
    """Blumenkübel: Betontrog mit Erde, Grün und Blüten."""
    box(1.0, 0.6, 0.5, 0, 0, 0, "concrete")
    box(0.88, 0.48, 0.04, 0, 0, 0.47, "soil")
    blob(0.38, -0.2, 0, 0.62, 1.3, 0.9, 0.55, "leaf", 11, sub=1)
    blob(0.32, 0.24, 0.02, 0.6, 1.1, 0.9, 0.55, "leaf_light", 12, sub=1)
    rnd = random.Random(13)
    for i in range(7):
        x, y = rnd.uniform(-0.38, 0.38), rnd.uniform(-0.18, 0.18)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.06, location=(x, y, 0.78 + rnd.uniform(-0.04, 0.05)))
        finish(bpy.context.object, "flower_red" if i % 2 else "flower_white")
    export("planter")


BUILDS = (
    bush_round,
    bush_tall,
    bin_street,
    fence_garden,
    sign_stvo,
    traffic_light,
    lamp_street,
    bench_park,
    sign_triangle,
    sign_crossing,
    sign_busstop,
    postbox,
    hydrant,
    bollard,
    bike_rack,
    ad_column,
    planter,
)
for build in BUILDS:
    reset()
    build()
print("[props] fertig")
