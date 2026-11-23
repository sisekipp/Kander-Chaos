"""
Bausteine für Figuren (Spielfigur und NPCs, Blender-Kommandozeile): Low-Poly-Körper aus Grundformen, ein
gemeinsames Skelett (13 Knochen) und ein gemeinsamer Animationssatz.

- Starre Hautbindung: jedes Körperteil hängt mit Gewicht 1 an genau einem Knochen (wenige Dreiecke, kein Verziehen).
- Materialien: Farbzonen `shirt`, `pants`, `hair` (das Spiel färbt sie je Variante) und feste Farben
  (Haut, Schuhe, Augen …), die die Asset-Pipeline in Vertex-Farben einbackt.
- Animationen als Aktionen (30 fps): idle, walk, run, jump, fall, enter, exit, sit (+ wave, fallover, getup für NPCs).
  Posen werden als Schwenkwinkel im Armaturraum angegeben und in die Ruhelage jedes Knochens umgerechnet.
Blender ist z-oben, Vorderseite zeigt nach −y (im glTF +z). Füße stehen bei z = 0.
"""
import math

import bpy
from mathutils import Euler, Vector

FPS = 30

SKIN = (0.96, 0.78, 0.62)
COLORS = {
    "shirt": (0.95, 0.45, 0.20),
    "pants": (0.20, 0.32, 0.60),
    "hair": (0.35, 0.22, 0.12),
    "skin": SKIN,
    "shoes": (0.15, 0.15, 0.17),
    "eyes": (0.08, 0.08, 0.10),
    "cap": (0.85, 0.15, 0.15),
}


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for item in list(block):
            block.remove(item)
    bpy.context.scene.render.fps = FPS


def material(name, color=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    r, g, b = color or COLORS[name]
    bsdf.inputs[0].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    return m


def skeleton(h):
    """Knochen (Kopf, Ende, Elternteil) für eine Figur der Größe h (Anteile wie bei einem Kind ≈ 1,45 m)."""
    s = h / 1.45
    hip, chest, neck, top = 0.74 * s, 0.86 * s, 1.17 * s, 1.45 * s
    sh, el, wr = 1.13 * s, 0.89 * s, 0.66 * s
    kn, an = 0.40 * s, 0.06 * s
    b = {
        "hips": ((0, 0, hip), (0, 0, chest), None),
        "spine": ((0, 0, chest), (0, 0, neck), "hips"),
        "head": ((0, 0, neck), (0, 0, top), "spine"),
    }
    for side, k in (("L", 1), ("R", -1)):
        b[f"upper_arm.{side}"] = ((k * 0.19 * s, 0, sh), (k * 0.21 * s, 0, el), "spine")
        b[f"forearm.{side}"] = ((k * 0.21 * s, 0, el), (k * 0.22 * s, 0, wr), f"upper_arm.{side}")
        b[f"thigh.{side}"] = ((k * 0.085 * s, 0, hip), (k * 0.09 * s, 0, kn), "hips")
        b[f"shin.{side}"] = ((k * 0.09 * s, 0, kn), (k * 0.09 * s, 0, an), f"thigh.{side}")
    return b


class Body:
    """Sammelt Körperteile (Objekt, Material, Knochen) und verbindet sie zu einem gebundenen Mesh."""

    def __init__(self):
        self.parts = []

    def add(self, obj, mat, bone):
        obj.data.materials.clear()
        obj.data.materials.append(material(mat))
        vg = obj.vertex_groups.new(name=bone)
        vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        self.parts.append(obj)
        return obj

    def box(self, size, center, mat, bone, bevel=0.0, taper=None):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        o = bpy.context.object
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if taper:  # obere Fläche schmaler/breiter (Rumpf)
            for v in o.data.vertices:
                if v.co.z > 0:
                    v.co.x *= taper[0]
                    v.co.y *= taper[1]
        if bevel > 0:
            mod = o.modifiers.new("bevel", "BEVEL")
            mod.width = bevel
            mod.segments = 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return self.add(o, mat, bone)

    def limb(self, p1, p2, r1, r2, mat, bone, seg=7):
        """Glied von p1 nach p2 mit Radius r1 oben und r2 unten (Kegelstumpf)."""
        a, b = Vector(p1), Vector(p2)
        d = b - a
        bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r1, radius2=r2, depth=d.length, location=(a + b) / 2)
        o = bpy.context.object
        o.rotation_euler = Vector((0, 0, -1)).rotation_difference(d.normalized()).to_euler()
        return self.add(o, mat, bone)

    def ball(self, r, center, mat, bone, scale=(1, 1, 1), seg=(10, 7)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=r, location=center)
        o = bpy.context.object
        o.scale = scale
        return self.add(o, mat, bone)

    def cap(self, r, center, mat, bone, scale=(1, 1, 1), cut=0.0, seg=(10, 6)):
        """Halbkugel (Haare, Mütze): untere Hälfte bis z < cut·r entfernt."""
        o = self.ball(r, center, mat, bone, scale, seg)
        import bmesh

        bm = bmesh.new()
        bm.from_mesh(o.data)
        drop = [v for v in bm.verts if v.co.z < cut * r - 1e-4]
        bmesh.ops.delete(bm, geom=drop, context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
        return o


def build_body(p):
    """Körper nach Parametern: h (Größe), width (Breite), belly, legs ('long'|'shorts'|'skirt'), sleeves,
    hair ('short'|'long'|'bun'|'bald'|'pony'), cap (bool), beard (bool)."""
    h = p.get("h", 1.45)
    s = h / 1.45
    w = p.get("width", 1.0)
    bones = skeleton(h)
    body = Body()
    hip, chest, neck, top = (bones["hips"][0][2], bones["spine"][0][2], bones["head"][0][2], bones["head"][1][2])
    # Rumpf und Becken
    belly = p.get("belly", 0.0)
    body.box((0.34 * w * s, (0.19 + belly) * s, (neck - chest) + 0.04 * s), (0, 0, (chest + neck) / 2 - 0.01 * s),
             "shirt", "spine", bevel=0.03 * s, taper=(1.08, 0.9))
    body.box((0.30 * w * s, 0.18 * s, 0.16 * s), (0, 0, hip + 0.03 * s), "pants", "hips", bevel=0.02 * s)
    if p.get("legs") == "skirt":
        body.limb((0, 0, hip + 0.05 * s), (0, 0, hip - 0.24 * s), 0.17 * w * s, 0.23 * w * s, "pants", "hips", seg=8)
    body.limb((0, 0, neck - 0.03 * s), (0, 0, neck + 0.06 * s), 0.05 * s, 0.05 * s, "skin", "head", seg=6)
    # Kopf (Kinder: groß), Augen, Nase
    hr = 0.13 * s * p.get("head", 1.0)
    hc = (0, 0, neck + hr + 0.02 * s)
    body.ball(hr, hc, "skin", "head", scale=(0.95, 1.0, 1.05))
    for k in (1, -1):
        body.box((0.03 * s, 0.01 * s, 0.035 * s), (k * 0.045 * s, hc[1] - hr * 0.93, hc[2] + 0.01 * s), "eyes", "head")
    body.box((0.025 * s, 0.03 * s, 0.03 * s), (0, hc[1] - hr * 0.98, hc[2] - 0.025 * s), "skin", "head")
    hair = p.get("hair", "short")
    if hair != "bald":
        body.cap(hr * 1.07, (hc[0], hc[1] + 0.012 * s, hc[2] + 0.01 * s), "hair", "head", cut=-0.05)
    if hair == "long":
        body.box((hr * 1.9, hr * 0.5, hr * 1.5), (0, hc[1] + hr * 0.7, hc[2] - hr * 0.55), "hair", "head", bevel=0.02 * s)
    elif hair == "bun":
        body.ball(hr * 0.42, (0, hc[1] + hr * 0.75, hc[2] + hr * 0.75), "hair", "head", seg=(8, 5))
    elif hair == "pony":
        body.limb((0, hc[1] + hr * 0.95, hc[2] + hr * 0.3), (0, hc[1] + hr * 1.25, hc[2] - hr * 0.9),
                  hr * 0.25, hr * 0.12, "hair", "head", seg=6)
    if p.get("cap"):
        body.cap(hr * 1.12, (hc[0], hc[1], hc[2] + 0.03 * s), "cap", "head", cut=0.15, seg=(10, 5))
        body.box((hr * 1.4, hr * 0.9, 0.012 * s), (0, hc[1] - hr * 1.05, hc[2] + hr * 0.3), "cap", "head")
    if p.get("beard"):
        body.box((hr * 1.4, hr * 0.5, hr * 0.7), (0, hc[1] - hr * 0.7, hc[2] - hr * 0.55), "hair", "head", bevel=0.02 * s)
    # Arme und Beine
    sleeves = p.get("sleeves", "short")
    t = p.get("limb", 1.0)  # Dicke der Glieder
    for side, k in (("L", 1), ("R", -1)):
        sh, el = bones[f"upper_arm.{side}"][0], bones[f"upper_arm.{side}"][1]
        wr = bones[f"forearm.{side}"][1]
        ext = Vector((0, 0, 0.03 * s))
        body.limb(Vector(sh) + ext, el, 0.055 * s * w * t, 0.045 * s * t, "shirt" if sleeves != "none" else "skin",
                  f"upper_arm.{side}")
        body.limb(Vector(el) + ext, wr, 0.043 * s * t, 0.036 * s * t, "shirt" if sleeves == "long" else "skin",
                  f"forearm.{side}")
        body.ball(0.045 * s * t, (wr[0], wr[1], wr[2] - 0.035 * s), "skin", f"forearm.{side}", seg=(7, 5))
        hp, kn = bones[f"thigh.{side}"][0], bones[f"thigh.{side}"][1]
        an = bones[f"shin.{side}"][1]
        legs = p.get("legs", "long")
        body.limb(Vector(hp) + ext, kn, 0.075 * s * w * t, 0.058 * s * t, "pants" if legs != "skirt" else "skin",
                  f"thigh.{side}")
        body.limb(Vector(kn) + ext, an, 0.056 * s * t, 0.047 * s * t, "pants" if legs == "long" else "skin", f"shin.{side}")
        body.box((0.09 * s * t, 0.19 * s, 0.07 * s), (an[0], an[1] - 0.035 * s, 0.035 * s), "shoes", f"shin.{side}",
                 bevel=0.02 * s)
    return body, bones


def rig(body, bones, name):
    """Armatur aus den Knochen bauen, Körperteile zu einem Mesh verbinden und starr binden."""
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, (head, tail, parent) in bones.items():
        e = arm_data.edit_bones.new(bname)
        e.head, e.tail, e.roll = head, tail, 0.0
        if parent:
            e.parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for o in body.parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = body.parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = mesh.data.name = f"{name}-mesh"
    bpy.ops.object.shade_flat()
    mesh.parent = arm
    mod = mesh.modifiers.new("skin", "ARMATURE")
    mod.object = arm
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    tris = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
    return arm, mesh, tris
