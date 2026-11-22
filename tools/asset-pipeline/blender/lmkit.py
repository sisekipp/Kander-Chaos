"""
Bausteine für Wahrzeichen (Blender-Kommandozeile): Körper aus dem echten Grundriss, Dächer über dem
Grundriss-Rechteck, Fensterreihen entlang der Wände, Türme. Alles landet in einer Gruppe (`building`).

Koordinaten: Der Grundriss kommt im Modellsystem der Welt-Pipeline (lx entlang der Längsachse, lz quer).
Babylon sieht ein Blender-Modell als (−bx, bz, −by); deshalb gilt hier bx = −lx, by = −lz. Boden bei z = 0.
"""
import math
import os
import sys

import bmesh
import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from kit import add  # noqa: E402

G = "building"


def color(name, rgb):
    """Farbe unter einem Namen anmelden (wird zur Vertex-Farbe eingebacken)."""
    kit.COLORS[name] = rgb
    return name


def to_blender(fp):
    """Grundriss [lx, lz, …] -> [(bx, by), …]."""
    return [(-fp[i], -fp[i + 1]) for i in range(0, len(fp), 2)]


def bounds(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), max(xs), min(ys), max(ys)


def area(pts):
    a = 0.0
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % len(pts)]
        a += x0 * y1 - x1 * y0
    return a / 2


def ccw(pts):
    return pts if area(pts) > 0 else list(reversed(pts))


def mesh_obj(verts, faces, mat):
    me = bpy.data.meshes.new("part")
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for f in faces:
        try:
            bm.faces.new([vs[i] for i in f])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("part", me)
    bpy.context.collection.objects.link(o)
    return add(o, mat, G)


def prism(pts, z0, z1, mat):
    """Senkrechter Körper aus einem Polygon (auch konkav)."""
    pts = ccw(pts)
    n = len(pts)
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    faces = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return mesh_obj(verts, faces, mat)


def inset(pts, d):
    """Polygon grob nach innen versetzen (zum Schwerpunkt hin skaliert)."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    x0, x1, y0, y1 = bounds(pts)
    s = max(0.2, 1 - 2 * d / max(0.5, min(x1 - x0, y1 - y0)))
    return [(cx + (x - cx) * s, cy + (y - cy) * s) for x, y in pts]


def box(sx, sy, sz, cx, cy, z0, mat, rot=0.0):
    """Quader mit Unterkante z0, gedreht um z."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, z0 + sz / 2))
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    o.rotation_euler = (0, 0, rot)
    return add(o, mat, G)


def cyl(r, h, cx, cy, z0, mat, seg=12, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=r, radius2=r if r2 is None else r2, depth=h, location=(cx, cy, z0 + h / 2))
    return add(bpy.context.object, mat, G)


def gable_roof(x0, x1, y0, y1, z, h, mat, over=0.4, hip=0.0):
    """Satteldach mit First entlang x; hip > 0 = Walm (0..1 Anteil der halben Breite) bzw. Krüppelwalm."""
    x0 -= over
    x1 += over
    y0 -= over
    y1 += over
    ym = (y0 + y1) / 2
    hx = hip * (y1 - y0) / 2
    hz = z + h * (1 - min(1.0, hip) * 0.0)
    verts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), (x0 + hx, ym, hz), (x1 - hx, ym, hz)]
    faces = [[0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4], [0, 3, 2, 1]]
    return mesh_obj(verts, faces, mat)


def hip_roof(x0, x1, y0, y1, z, h, mat, over=0.4):
    w = min(x1 - x0, y1 - y0)
    if x1 - x0 >= y1 - y0:
        return gable_roof(x0, x1, y0, y1, z, h, mat, over, hip=1.0)
    ym = (y0 + y1) / 2
    xm = (x0 + x1) / 2
    hy = w / 2
    x0 -= over
    x1 += over
    y0 -= over
    y1 += over
    verts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), (xm, y0 + hy, z + h), (xm, y1 - hy, z + h)]
    del ym
    faces = [[1, 2, 5, 4], [3, 0, 4, 5], [0, 1, 4], [2, 3, 5], [0, 3, 2, 1]]
    return mesh_obj(verts, faces, mat)


def pyramid(cx, cy, size, z, h, mat, seg=4, knick=0.0):
    """Pyramiden- bzw. Kegeldach; knick > 0 = geknickter Helm (unten flacher Kragen)."""
    if knick > 0:
        cyl(size * 0.75, h * knick, cx, cy, z, mat, seg=seg, r2=size * 0.45)
        return cyl(size * 0.45, h * (1 - knick), cx, cy, z + h * knick, mat, seg=seg, r2=0.02)
    return cyl(size * 0.72, h, cx, cy, z, mat, seg=seg, r2=0.02)


def edges(pts):
    pts = ccw(pts)
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        if ln > 1e-6:
            yield a, (dx / ln, dy / ln), ln, (dy / ln, -dx / ln)


def windows(pts, z, h, w, spacing, glass, frame=None, margin=1.2, depth=0.12, max_per_edge=40, skip=None):
    """Fensterreihe auf Höhe z entlang aller Wände (außen leicht vorstehend)."""
    for k, (a, d, ln, n) in enumerate(edges(pts)):
        if skip and skip(k, a, d, ln, n):
            continue
        count = min(max_per_edge, int((ln - 2 * margin) // spacing) + 1)
        if count < 1 or ln < w + 2 * margin * 0.5:
            continue
        step = (ln - 2 * margin) / max(1, count - 1) if count > 1 else 0
        start = margin if count > 1 else ln / 2
        rot = math.atan2(d[1], d[0])
        for i in range(count):
            t = start + i * step
            cx, cy = a[0] + d[0] * t + n[0] * 0.03, a[1] + d[1] * t + n[1] * 0.03
            if frame:
                box(w + 0.2, depth, h + 0.2, cx, cy, z - 0.1, frame, rot)
                cx, cy = cx + n[0] * 0.03, cy + n[1] * 0.03
            box(w, depth, h, cx, cy, z, glass, rot)


def corner_quoins(pts, z0, z1, mat, size=0.5):
    """Eckquader bzw. Ecklisenen an allen Ecken."""
    for (a, d, ln, n) in edges(pts):
        box(size, size, z1 - z0, a[0] + n[0] * 0.04, a[1] + n[1] * 0.04, z0, mat, math.atan2(d[1], d[0]))


def door(pts, which, w, h, mat, frame=None):
    """Tür in die Mitte der längsten (which='long') bzw. kürzesten Wand."""
    es = sorted(edges(pts), key=lambda e: e[2], reverse=(which == "long"))
    a, d, ln, n = es[0]
    cx, cy = a[0] + d[0] * ln / 2 + n[0] * 0.05, a[1] + d[1] * ln / 2 + n[1] * 0.05
    rot = math.atan2(d[1], d[0])
    if frame:
        box(w + 0.4, 0.14, h + 0.3, cx, cy, 0, frame, rot)
    box(w, 0.18, h, cx + n[0] * 0.03, cy + n[1] * 0.03, 0, mat, rot)
    return cx, cy, n, rot


def export(name, out):
    kit.OUT = out
    kit.export(name)
