"""
Bauvorlagen für Wahrzeichen nach Gebäudeart (Kirche, Rathaus, Schule …). Jede Vorlage baut aus dem echten
Grundriss: Sockel, Wände, Fenster, Dach und typische Merkmale (Turm, Tore, Vordach). Kein Text, keine Logos.
"""
import math
import os
import sys
import zlib

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from lmkit import (  # noqa: E402
    bounds,
    box,
    color,
    corner_quoins,
    cyl,
    door,
    gable_roof,
    hip_roof,
    inset,
    prism,
    pyramid,
    to_blender,
    windows,
)

STONE = color("lm_stone", (0.55, 0.53, 0.5))
SLATE = color("lm_slate", (0.28, 0.3, 0.34))
TILE = color("lm_tile", (0.62, 0.3, 0.2))
GLASS = color("lm_glass", (0.2, 0.26, 0.32))
WHITE = color("lm_white", (0.93, 0.91, 0.86))
SAND = color("lm_sandstone", (0.74, 0.42, 0.33))
WOOD = color("lm_wood", (0.45, 0.3, 0.18))
GOLD = color("lm_gold", (0.9, 0.72, 0.25))
DARK = color("lm_dark", (0.18, 0.18, 0.2))
RED = color("lm_red", (0.78, 0.15, 0.12))
GREEN = color("lm_green", (0.2, 0.45, 0.3))
ROOF_FLAT = color("lm_flat", (0.45, 0.45, 0.46))

WALLS = [
    color("lm_wall_cream", (0.94, 0.9, 0.78)),
    color("lm_wall_ochre", (0.9, 0.78, 0.52)),
    color("lm_wall_rose", (0.92, 0.8, 0.74)),
    color("lm_wall_grey", (0.86, 0.86, 0.84)),
    color("lm_wall_yellow", (0.95, 0.86, 0.55)),
]


def pick(lm, options, salt=0):
    return options[zlib.crc32(f"{lm['id']}:{salt}".encode()) % len(options)]


def base(lm, wall, h):
    """Sockel (reicht 2 m in den Boden für Hanglagen) und Wände."""
    pts = to_blender(lm["footprint"])
    prism(pts, -2.0, 0.5, STONE)
    prism(pts, 0.5, h, wall)
    return pts


def dims(pts):
    x0, x1, y0, y1 = bounds(pts)
    return x0, x1, y0, y1, x1 - x0, y1 - y0


def level_windows(pts, levels, level_h, w=1.1, h=1.4, spacing=3.2, frame=None, z0=0.9):
    for k in range(levels):
        windows(pts, z0 + k * level_h, h, w, spacing, GLASS, frame)


def front_end(lm, x0, x1):
    """Blender-x der Schmalseite, die nach Westen zeigt (Kirchtürme stehen traditionell im Westen)."""
    # Weltrichtung von +lx ist (ux, uz); Blender-x = −lx
    return x1 if lm["ux"] > 0 else x0


def church(lm, tower=True, wall=None):
    h = max(9.0, lm["wallHeight"] * 0.75)
    wall = wall or pick(lm, [WHITE, WALLS[0], WALLS[3]])
    pts = base(lm, wall, h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    windows(pts, 2.2, h - 4.0, 1.4, 4.2, GLASS, SAND, margin=2.5)
    corner_quoins(pts, 0.5, h, SAND, 0.45)
    gable_roof(x0, x1, y0, y1, h, min(9.0, ly * 0.62), SLATE, over=0.5)
    if not tower:
        return
    fx = front_end(lm, x0, x1)
    s = max(4.0, min(7.0, ly * 0.45))
    tx = fx - math.copysign(s / 2 - 0.3, fx - (x0 + x1) / 2)
    ty = (y0 + y1) / 2
    th = h + min(9.0, ly * 0.62) + 8
    box(s, s, th, tx, ty, -2, wall)
    corner_quoins([(tx - s / 2, ty - s / 2), (tx + s / 2, ty - s / 2), (tx + s / 2, ty + s / 2), (tx - s / 2, ty + s / 2)], 0, th, SAND, 0.4)
    for k, (dx, dy) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1))):
        rot = 0 if dx else math.pi / 2
        box(1.0 if dx else 0.15, 0.15 if dx else 1.0, 2.4, tx + dx * (s / 2 + 0.02), ty + dy * (s / 2 + 0.02), th - 3.6, DARK, rot)
        cyl(0.7, 0.08, tx + dx * (s / 2 + 0.05), ty + dy * (s / 2 + 0.05), th - 6.5, WHITE, seg=12) if k < 2 else None
    pyramid(tx, ty, s, th, s * 1.8, SLATE, knick=0.3)
    cyl(0.25, 0.5, tx, ty, th + s * 1.8 - 0.1, GOLD, seg=8)
    door(pts, "short", 1.8, 3.2, WOOD, SAND)


def chapel(lm):
    h = max(5.0, lm["wallHeight"] * 0.5)
    pts = base(lm, WHITE, h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    windows(pts, 1.8, 2.4, 0.9, 3.5, GLASS, SAND, margin=1.5)
    rh = min(6.0, ly * 0.6)
    gable_roof(x0, x1, y0, y1, h, rh, SLATE)
    fx = front_end(lm, x0, x1)
    rx = fx - math.copysign(1.5, fx - (x0 + x1) / 2)
    box(1.6, 1.6, 2.4, rx, (y0 + y1) / 2, h + rh - 0.6, SLATE)
    pyramid(rx, (y0 + y1) / 2, 1.6, h + rh + 1.8, 2.6, SLATE, seg=8)
    door(pts, "short", 1.4, 2.6, WOOD)


def townhall(lm):
    levels = max(2, min(3, lm["levels"] or 2))
    h = levels * 3.3 + 0.6
    wall = pick(lm, WALLS)
    pts = base(lm, wall, h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    level_windows(pts, levels, 3.3, frame=SAND)
    corner_quoins(pts, 0.5, h, SAND)
    hip_roof(x0, x1, y0, y1, h, min(7.0, ly * 0.5), TILE)
    cx, cy, n, rot = door(pts, "long", 1.8, 2.8, WOOD, SAND)
    cyl(0.6, 0.08, cx + n[0] * 0.2, cy + n[1] * 0.2, h - 1.4, WHITE)  # Uhr
    box(0.08, 0.08, 7, x0 - 1.5, y0 - 1.5, 0, WHITE)  # Fahnenmast


def school(lm, colorful=False):
    levels = max(1, min(4, lm["levels"] or 2))
    h = levels * 3.6 + 0.6
    wall = pick(lm, WALLS[3:] if not colorful else [WALLS[1], WALLS[4]])
    pts = base(lm, wall, h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    band = color("lm_band_blue", (0.3, 0.5, 0.75)) if not colorful else color("lm_band_orange", (0.95, 0.55, 0.2))
    level_windows(pts, levels, 3.6, w=2.4, h=1.6, spacing=3.0 if lx < 60 else 4.6, frame=band)
    if lm["roofHeight"] > 1 and lx < 70:
        gable_roof(x0, x1, y0, y1, h, min(8.0, ly * 0.45), TILE)
    else:
        prism(inset(pts, 0.3), h, h + 0.6, ROOF_FLAT)
    cx, cy, n, rot = door(pts, "long", 3.0, 2.6, GLASS, band)
    box(5.0, 2.5, 0.25, cx + n[0] * 1.2, cy + n[1] * 1.2, 3.0, DARK, rot)  # Vordach


def station(lm):
    h = 6.6
    pts = base(lm, WALLS[0], h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    level_windows(pts, 2, 3.2, w=1.0, h=1.5, frame=SAND)
    corner_quoins(pts, 0.5, h, SAND)
    gable_roof(x0, x1, y0, y1, h, min(5.0, ly * 0.5), SLATE, hip=0.35)
    box(lx + 4, 3.5, 0.2, (x0 + x1) / 2, y0 - 1.8, 3.4, WOOD)  # Bahnsteigdach
    for k in range(int(lx // 4) + 2):
        box(0.15, 0.15, 3.4, x0 - 2 + k * 4, y0 - 3.2, 0, DARK)


def goods_shed(lm):
    pts = base(lm, WOOD, 4.5)
    x0, x1, y0, y1, lx, ly = dims(pts)
    gable_roof(x0, x1, y0, y1, 4.5, 2.2, SLATE, over=0.8)
    box(2.6, 0.15, 3.0, (x0 + x1) / 2, y0 - 0.05, 0.5, DARK)
    box(lx, 1.5, 1.0, (x0 + x1) / 2, y0 - 0.8, -0.5, STONE)  # Laderampe


def supermarket(lm, accent):
    h = 6.0
    pts = base(lm, WALLS[3], h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    prism(inset(pts, 0.2), h, h + 0.8, ROOF_FLAT)
    box(lx * 0.6, 0.2, 3.0, (x0 + x1) / 2, y0 - 0.05, 0.5, GLASS)  # Glasfront
    box(lx + 0.4, 0.3, 1.2, (x0 + x1) / 2, y0 - 0.1, h - 1.2, accent)  # Farbband ohne Schrift
    box(lx * 0.7, 3.5, 0.3, (x0 + x1) / 2, y0 - 1.8, 3.6, accent)  # Vordach
    for k in range(5):
        box(0.2, 0.2, 3.6, x0 + lx * 0.15 + k * lx * 0.175, y0 - 3.4, 0, DARK)


def fire_station(lm):
    h = max(6.5, lm["wallHeight"] * 0.8)
    pts = base(lm, WALLS[3], h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    gates = max(1, min(5, int(lx // 4.5)))
    for k in range(gates):
        box(3.4, 0.2, 3.8, x0 + lx * (k + 0.5) / gates, y0 - 0.05, 0.5, RED)
    windows(pts, h - 2.4, 1.2, 1.0, 3.0, GLASS, skip=lambda k, a, d, ln, n: n[1] < -0.7)
    gable_roof(x0, x1, y0, y1, h, min(4.5, ly * 0.4), TILE)
    box(3.0, 3.0, h + 8, x1 - 1.5, y1 - 1.5, -2, WALLS[3])  # Schlauchturm
    pyramid(x1 - 1.5, y1 - 1.5, 3.0, h + 6, 2.0, TILE)
    box(3.1, 0.6, 0.6, x1 - 1.5, y1 - 1.5, h + 4.5, RED)


def museum(lm):
    levels = 3
    h = levels * 3.0 + 0.6
    pts = base(lm, WHITE, h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    shutter = color("lm_shutter_yellow", (0.9, 0.7, 0.25))
    level_windows(pts, levels, 3.0, w=1.0, h=1.4, spacing=2.6, frame=shutter)
    corner_quoins(pts, 0.5, h, SAND)
    rh = min(7.0, ly * 0.7)
    gable_roof(x0, x1, y0, y1, h, rh, TILE, over=0.1)
    for gx, s in ((x0, -1), (x1, 1)):  # Staffelgiebel an beiden Schmalseiten
        for k in range(5):
            w = ly * (1 - k / 5)
            box(0.5, w, rh / 5, gx + s * 0.1, (y0 + y1) / 2, h + k * rh / 5, WHITE)
    door(pts, "long", 1.4, 2.4, WOOD, SAND)


def manor(lm, mansard=False):
    levels = max(2, min(3, lm["levels"] or 2))
    h = levels * 3.4 + 0.6
    pts = base(lm, pick(lm, WALLS), h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    shutter = color("lm_shutter_green", (0.25, 0.45, 0.3))
    level_windows(pts, levels, 3.4, w=1.1, h=1.6, spacing=3.0, frame=shutter)
    corner_quoins(pts, 0.5, h, SAND)
    gable_roof(x0, x1, y0, y1, h, min(8.0, ly * 0.55), TILE if not mansard else SLATE, hip=0.45 if not mansard else 1.0)
    door(pts, "long", 1.8, 3.0, WOOD, SAND)


def hall(lm):
    h = max(7.0, lm["wallHeight"])
    pts = base(lm, pick(lm, WALLS[3:]), h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    windows(pts, h - 3.0, 2.0, 3.0, 3.6, GLASS)
    gable_roof(x0, x1, y0, y1, h, min(6.0, ly * 0.3), ROOF_FLAT, over=0.6)
    door(pts, "short", 3.0, 2.8, GLASS, DARK)


def civic(lm):
    levels = max(1, min(3, lm["levels"] or 2))
    h = levels * 3.3 + 0.6
    pts = base(lm, pick(lm, WALLS), h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    level_windows(pts, levels, 3.3, frame=WHITE)
    hip_roof(x0, x1, y0, y1, h, min(6.0, ly * 0.45), TILE)
    door(pts, "long", 2.0, 2.6, WOOD, WHITE)


def inn(lm):
    levels = max(2, min(3, lm["levels"] or 2))
    h = levels * 3.0 + 0.6
    pts = base(lm, WHITE, h)
    x0, x1, y0, y1, lx, ly = dims(pts)
    level_windows(pts, levels, 3.0, w=1.0, h=1.3, spacing=2.8, frame=GREEN)
    gable_roof(x0, x1, y0, y1, h, min(7.0, ly * 0.55), TILE, hip=0.3)
    cx, cy, n, rot = door(pts, "long", 1.4, 2.4, WOOD)
    box(0.08, 1.2, 0.08, cx + n[0] * 0.6, cy + n[1] * 0.6, 3.6, DARK, rot + math.pi / 2)  # Wirtshausausleger
    cyl(0.4, 0.06, cx + n[0] * 1.1, cy + n[1] * 1.1, 3.0, GOLD, seg=10)


STYLES = {
    "church": church,
    "chapel": chapel,
    "townhall": townhall,
    "school": school,
    "kindergarten": lambda lm: school(lm, colorful=True),
    "station": station,
    "goods_shed": goods_shed,
    "supermarket": lambda lm: supermarket(lm, RED),
    "fire_station": fire_station,
    "museum": museum,
    "manor": manor,
    "castle": lambda lm: manor(lm, mansard=True),
    "hall": hall,
    "civic": civic,
    "inn": inn,
}
