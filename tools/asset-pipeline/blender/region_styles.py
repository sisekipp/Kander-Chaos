"""
Bauvorlagen für die Wahrzeichen der Region (Change landmarks-region): Hochhaus, Bahnhofshalle, Terminal, Tower,
Hangar, Brücke, Stadion, Messehalle, Flugzeug. Alle bauen aus Grundriss bzw. Größe und Sollhöhe (`height`).
Kein Text, keine Logos; Fantasie-Lackierungen.
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from landmark_styles import DARK, GLASS, ROOF_FLAT, STONE, WHITE, dims, pick, station  # noqa: E402
from lmkit import box, color, cyl, inset, prism, to_blender  # noqa: E402

STEEL = color("lm_steel", (0.62, 0.64, 0.67))
CONCRETE = color("lm_concrete", (0.72, 0.71, 0.68))
LAWN = color("lm_lawn", (0.3, 0.58, 0.28))
SEATS = color("lm_seats", (0.75, 0.15, 0.15))
GLASS_BLUE = color("lm_glass_blue", (0.35, 0.5, 0.62))
PAINTS = [
    color("lm_paint_sky", (0.25, 0.55, 0.85)),
    color("lm_paint_sun", (0.95, 0.7, 0.15)),
    color("lm_paint_mint", (0.3, 0.75, 0.6)),
    color("lm_paint_berry", (0.75, 0.25, 0.45)),
    color("lm_paint_orange", (0.95, 0.45, 0.15)),
]


def height_of(lm, default):
    return lm.get("height") or max(default, (lm["wallHeight"] or 0) + (lm["roofHeight"] or 0))


def arch_x(r, depth, cx, cy, cz, mat, seg=16):
    """Halbzylinder (Tonnendach) mit Achse entlang x."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=(cx, cy, cz), rotation=(0, math.pi / 2, 0))
    return kit.add(bpy.context.object, mat, "building")


def tower(lm, core=WHITE, glass=GLASS_BLUE, band=3.6):
    """Hochhaus: Sockel, Fassade aus Glas- und Brüstungsbändern, Dachaufbau. Höhe = Sollhöhe."""
    h = height_of(lm, 40.0)
    pts = to_blender(lm["footprint"])
    prism(pts, -2.0, h, core)
    bands = min(60, int(h // band))
    outer = inset(pts, -0.15)
    for k in range(1, bands):
        prism(outer, k * band - 1.6, k * band - 0.2, glass)
    x0, x1, y0, y1, lx, ly = dims(pts)
    box(lx * 0.4, ly * 0.4, 4.0, (x0 + x1) / 2, (y0 + y1) / 2, h, ROOF_FLAT)  # Technikaufbau


def station_hall(lm):
    """Bahnhof mit Empfangsgebäude und Bahnsteighalle (Tonnendächer entlang der Längsachse)."""
    h = height_of(lm, 18.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    prism(pts, -2.0, h * 0.55, pick(lm, [WHITE, STONE]))
    for k in range(3):  # drei Hallenschiffe
        r = ly / 6
        arch_x(r, lx * 0.95, (x0 + x1) / 2, y0 + r * (2 * k + 1), h * 0.55, GLASS)
        box(lx * 0.95, 0.4, 0.6, (x0 + x1) / 2, y0 + r * 2 * k, h * 0.55, STEEL)


def terminal(lm, bridges=6):
    """Flughafen-Terminal: langer Glasbau mit Dachkante und Fluggastbrücken zur Luftseite (Westen)."""
    h = height_of(lm, 18.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    prism(pts, -2.0, h * 0.35, CONCRETE)
    prism(inset(pts, 0.6), h * 0.35, h * 0.9, GLASS_BLUE)
    prism(inset(pts, -0.8), h * 0.9, h, WHITE)
    # Luftseite: Blender +y zeigt in Weltrichtung (uz, −ux); Westen = negatives Welt-x
    side = -1 if lm["uz"] > 0 else 1
    edge = y1 if side > 0 else y0
    for k in range(bridges):
        bx = x0 + (k + 0.5) * lx / bridges
        box(3.0, 18.0, 3.2, bx, edge + side * 9.0, 4.0, STEEL)
        box(4.0, 4.0, 4.0, bx, edge + side * 18.5, 3.6, STEEL)
        cyl(0.4, 4.0, bx, edge + side * 14.0, 0, DARK, seg=6)


def control_tower(lm):
    """Tower: schlanker Schaft, verglaste Kanzel, Dach mit Antenne."""
    h = height_of(lm, 40.0)
    cyl(4.0, h - 8.0, 0, 0, -2.0, CONCRETE, seg=16)
    cyl(7.0, 1.2, 0, 0, h - 9.0, WHITE, seg=16)
    cyl(6.5, 5.0, 0, 0, h - 7.8, GLASS_BLUE, seg=16, r2=7.2)
    cyl(7.4, 1.0, 0, 0, h - 2.8, WHITE, seg=16)
    cyl(0.25, 5.0, 0, 0, h - 1.8, STEEL, seg=6)


def hangar(lm):
    """Hangar: Tonnendach über dem Grundriss-Rechteck, großes Tor an der Stirnseite."""
    h = height_of(lm, 18.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    box(lx, ly, h * 0.55, (x0 + x1) / 2, (y0 + y1) / 2, -2.0, STEEL)
    arch_x(ly / 2, lx, (x0 + x1) / 2, (y0 + y1) / 2, h * 0.55 - 2.0 + 0.01, ROOF_FLAT, seg=20)
    box(0.3, ly * 0.8, h * 0.5, x0 - 0.1, (y0 + y1) / 2, 0, DARK)


def bridge(lm, mat=STONE, arches=5):
    """Brücke: Fahrbahndeck entlang der Längsachse, Bögen und Pfeiler darunter, Brüstung oben."""
    h = height_of(lm, 10.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    deck = h * 0.7
    box(lx, ly, 1.2, (x0 + x1) / 2, (y0 + y1) / 2, deck - 1.2, mat)
    for s in (-1, 1):
        box(lx, 0.4, 1.0, (x0 + x1) / 2, (y0 + y1) / 2 + s * (ly / 2 - 0.2), deck, mat)
    span = lx / arches
    for k in range(arches + 1):
        px = x0 + k * span
        box(min(4.0, span * 0.25), ly, deck + 4.0, px, (y0 + y1) / 2, -4.0, mat)
    for k in range(arches):
        cx = x0 + (k + 0.5) * span
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=span * 0.45, depth=ly * 0.98, location=(cx, (y0 + y1) / 2, deck - 1.2 - span * 0.25), rotation=(math.pi / 2, 0, 0))
        kit.add(bpy.context.object, mat, "building")


def stadium(lm):
    """Stadion: vier Tribünen mit Dach um ein grünes Spielfeld."""
    h = height_of(lm, 30.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box(lx * 0.62, ly * 0.55, 0.3, cx, cy, 0, LAWN)
    t = min(lx, ly) * 0.18
    for sx, sy, w, d in ((0, 1, lx, t), (0, -1, lx, t), (1, 0, t, ly - 2 * t), (-1, 0, t, ly - 2 * t)):
        ox, oy = cx + sx * (lx - t) / 2, cy + sy * (ly - t) / 2
        box(w, d, h * 0.75, ox, oy, -2.0, CONCRETE)
        box(w * 0.98 if sy else w * 0.6, d * 0.6 if sy else d * 0.98, 0.4, ox - sx * t * 0.2, oy - sy * t * 0.2, h * 0.55, SEATS)
        box(w, d, 0.8, ox, oy, h - 0.8, WHITE)  # Dach


def fair_hall(lm):
    """Messehalle: großer Quader mit Metallfassade, darüber ein runder Lichthof-Ring."""
    h = height_of(lm, 30.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    prism(pts, -2.0, h, STEEL)
    r = min(lx, ly) * 0.25
    cyl(r + 3.0, 2.0, (x0 + x1) / 2, (y0 + y1) / 2, h, WHITE, seg=24)
    cyl(r, 2.2, (x0 + x1) / 2, (y0 + y1) / 2, h + 0.05, DARK, seg=24)


def airplane(lm):
    """Geparktes Flugzeug: Rumpf, gepfeilte Flügel, Leitwerk, zwei Triebwerke; Fantasie-Lackierung."""
    regional = (lm.get("detail") or "") == "regional"
    length = 30.0 if regional else 40.0
    span = 27.0 if regional else 36.0
    r = 1.6 if regional else 2.0
    paint = pick(lm, PAINTS)
    z = r + 1.6
    arch_x(r, length * 0.8, 0, 0, z, WHITE)  # Rumpf
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=r, location=(-length * 0.4, 0, z))
    kit.add(bpy.context.object, WHITE, "building")  # Bug (Blender −x = Welt +lx = vorne)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=r, radius2=0.4, depth=length * 0.2, location=(length * 0.5, 0, z + 0.3), rotation=(0, math.pi / 2, 0))
    kit.add(bpy.context.object, WHITE, "building")  # Heck
    box(length * 0.8, 0.25, r * 0.5, 0, 0, z - r * 0.15, paint)  # Zierstreifen (beidseitig sichtbar)
    for s in (-1, 1):
        box(6.0, span / 2, 0.5, 1.0, s * span / 4, z - r * 0.4, STEEL, s * 0.35)
        cyl(0.9 if regional else 1.2, 3.5, -2.0, s * span * 0.22, z - r - 0.6, paint, seg=10)
        box(3.0, span * 0.18, 0.3, length * 0.42, s * span * 0.09, z + 0.3, STEEL, s * 0.3)
    box(4.0, 0.4, 6.0 if not regional else 4.5, length * 0.45, 0, z + r * 0.6, paint)  # Seitenleitwerk
    for x in (-length * 0.3, 2.0):  # Fahrwerk
        cyl(0.5, 1.6, x, 0, 0, DARK, seg=8)


REGION_STYLES = {
    "tower": tower,
    "station_hall": station_hall,
    "station": station,
    "terminal": terminal,
    "control_tower": control_tower,
    "hangar": hangar,
    "bridge": bridge,
    "stadium": stadium,
    "fair_hall": fair_hall,
    "airplane": airplane,
}
