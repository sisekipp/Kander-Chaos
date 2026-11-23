"""
Wahrzeichen für Kandern Chaos aus der Blender-Kommandozeile:

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/landmarks.py -- assets/landmarks

Liest `assets/landmarks/footprints.json` (Welt-Pipeline: Grundriss, Höhen, Art), baut je Wahrzeichen ein Modell
nach Bauvorlage (`landmark_styles.py`) oder als Handarbeit nach Fotos (Kanderner Wahrzeichen, unten) und schreibt
dazu `assets/recipes/landmarks.json` und die Einträge in `assets/registry.json`.
"""
import json
import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
from landmark_styles import (  # noqa: E402
    DARK,
    GLASS,
    GREEN,
    RED,
    SAND,
    SLATE,
    STYLES,
    WALLS,
    WHITE,
    WOOD,
    church,
    manor,
    museum,
    school,
    station,
    supermarket,
    townhall,
)
from lmkit import box, color, cyl, export, pyramid  # noqa: E402
from region_detail import REGION_DETAILS  # noqa: E402
from region_styles import REGION_STYLES  # noqa: E402

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "assets/landmarks"
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.."))


def south_end(lm, x0, x1):
    """Blender-x der Schmalseite mit der kleineren Welt-z (Süden): Welt-z von +lx ist uz, Blender-x = −lx."""
    return x1 if lm["uz"] > 0 else x0


def front_niche(fx, cy, z0, r, inward):
    """Monumentale Rundbogennische mit Thermenfenster (Stadtkirche, Weinbrenner-Klassizismus)."""
    for side in (-1, 1):  # Sandsteinpfeiler der Nische
        box(0.3, 0.5, z0 - 0.5, fx + inward * 0.05, cy + side * (r + 0.15), 0.5, SAND)
    bpy_cyl_x(r + 0.4, 0.3, fx + inward * 0.05, cy, z0, SAND)
    bpy_cyl_x(r, 0.34, fx + inward * 0.02, cy, z0, WHITE)
    bpy_cyl_x(r * 0.6, 0.38, fx, cy, z0, GLASS)
    for k in (-1, 0, 1):  # dreifach gekuppelte Fenster
        box(0.38, 1.0, 2.2, fx, cy + k * 1.4, z0 - 3.2, GLASS)


def bpy_cyl_x(r, depth, cx, cy, cz, mat):
    """Halbscheibe (Bogen) mit Achse entlang x, untere Hälfte steckt in der Wand darunter."""
    import bpy

    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r, depth=depth, location=(cx, cy, cz), rotation=(0, math.pi / 2, 0))
    return kit.add(bpy.context.object, mat, "building")


def stadtkirche(lm):
    """Ev. Stadtkirche St. Clemens: Saalkirche, Turmaufsatz über der Südfassade, Rundbogennische, Rote Sandsteinlisenen."""
    church(lm, tower=False, wall=WHITE)
    h = max(9.0, lm["wallHeight"] * 0.75)
    from lmkit import bounds, to_blender

    x0, x1, y0, y1 = bounds(to_blender(lm["footprint"]))
    ly = y1 - y0
    fx = south_end(lm, x0, x1)
    inward = 1 if fx == x0 else -1
    cy = (y0 + y1) / 2
    rh = min(9.0, ly * 0.62)
    front_niche(fx - inward * 0.15, cy, h - 1.0, 2.6, -inward)
    s = 6.0
    tx = fx + inward * (s / 2 - 0.2)
    th = h + rh + 7.5
    box(s, s, th - h - rh + 3, tx, cy, h + rh - 3, WHITE)
    for dz in (0.0, th - h - rh + 2.8):
        box(s + 0.25, s + 0.25, 0.35, tx, cy, h + rh - 3 + dz, SAND)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        box(0.9 if dy else 0.12, 0.12 if dy else 0.9, 2.0, tx + dx * (s / 2 + 0.02), cy + dy * (s / 2 + 0.02), th - 3.0, DARK)
        cyl(0.6, 0.08, tx + dx * (s / 2 + 0.06), cy + dy * (s / 2 + 0.06), th - 5.4, GOLD_CLOCK, seg=12) if dx else None
    pyramid(tx, cy, s, th, 7.5, SLATE, knick=0.35)
    cyl(0.3, 0.6, tx, cy, th + 7.4, GOLD_CLOCK, seg=8)
    box(1.8, 0.2, 3.0, fx - inward * 0.1, cy, 0.5, WOOD)  # Portal


GOLD_CLOCK = color("lm_clock_gold", (0.9, 0.72, 0.25))


def st_franz(lm):
    """Kath. Kirche St. Franz von Sales: heller Giebel, schiefergedeckter Dachreiter mit geschwungenem Helm."""
    church(lm, tower=False)
    from lmkit import bounds, to_blender

    x0, x1, y0, y1 = bounds(to_blender(lm["footprint"]))
    h = max(9.0, lm["wallHeight"] * 0.75)
    rh = min(9.0, (y1 - y0) * 0.62)
    fx = x1 if lm["ux"] > 0 else x0
    rx = fx - math.copysign(2.2, fx - (x0 + x1) / 2)
    cy = (y0 + y1) / 2
    box(2.6, 2.6, 4.2, rx, cy, h + rh - 1.2, SLATE)
    for d in (-1, 1):
        box(0.1, 1.2, 1.8, rx + d * 1.32, cy, h + rh + 0.8, DARK)
    cyl(1.9, 1.2, rx, cy, h + rh + 3.0, SLATE, seg=8, r2=1.2)
    cyl(1.2, 3.2, rx, cy, h + rh + 4.2, SLATE, seg=8, r2=0.05)
    cyl(0.25, 0.5, rx, cy, h + rh + 7.3, GOLD_CLOCK, seg=8)
    box(0.08, 0.08, 1.4, rx, cy, h + rh + 7.8, GOLD_CLOCK)
    box(0.7, 0.08, 0.08, rx, cy, h + rh + 8.7, GOLD_CLOCK)


def rathaus_kandern(lm):
    """Altes Rathaus: langgestreckt, zweigeschossig, Laubengang mit Korbbögen über dem Gehweg."""
    townhall(lm)
    from lmkit import bounds, to_blender

    x0, x1, y0, y1 = bounds(to_blender(lm["footprint"]))
    bays = max(3, int((x1 - x0) // 3.2))
    for k in range(bays + 1):
        box(0.6, 0.7, 2.9, x0 + k * (x1 - x0) / bays, y0 - 0.2, 0.0, SAND)
    for k in range(bays):
        cx = x0 + (k + 0.5) * (x1 - x0) / bays
        import bpy

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=(x1 - x0) / bays / 2, depth=0.72, location=(cx, y0 - 0.2, 2.9), rotation=(math.pi / 2, 0, 0))
        kit.add(bpy.context.object, SAND, "building")


def bahnhof_kandern(lm):
    """Bahnhof der Kandertalbahn: Krüppelwalmdach, Turm mit Fachwerk-Obergeschoss und Walmdach."""
    station(lm)
    from lmkit import bounds, to_blender, hip_roof

    x0, x1, y0, y1 = bounds(to_blender(lm["footprint"]))
    s = 3.6
    tx, ty = x0 + s / 2, y1 - s / 2
    box(s, s, 9.5, tx, ty, -2, WALLS[0])
    box(s + 0.1, s + 0.1, 2.6, tx, ty, 7.5, color("lm_timber_fill", (0.95, 0.9, 0.8)))
    for k in range(4):  # Fachwerkbalken
        box(s + 0.14, 0.14, 2.6, tx, ty - s / 2 + k * s / 3, 7.5, WOOD)
        box(0.14, s + 0.14, 2.6, tx - s / 2 + k * s / 3, ty, 7.5, WOOD)
    box(s + 0.16, s + 0.16, 0.16, tx, ty, 8.7, WOOD)
    hip_roof(tx - s / 2, tx + s / 2, ty - s / 2, ty + s / 2, 10.1, 2.6, SLATE)
    windows_green = color("lm_shutter_green", (0.25, 0.45, 0.3))
    box(0.9, 0.16, 1.4, tx, ty - s / 2 - 0.05, 4.2, windows_green)


def sausenburg(lm):
    """Ruine Sausenburg: runder Bergfried aus Bruchstein mit zerbrochener Krone, Reste der Ringmauer mit Torbogen."""
    rub = color("lm_rubble", (0.55, 0.54, 0.5))
    moss = color("lm_moss", (0.35, 0.45, 0.25))
    cyl(4.2, 2.0, 0, -12, -2, rub, seg=16)
    cyl(4.0, 18.0, 0, -12, 0, rub, seg=16)
    import random

    rnd = random.Random(7)
    for k in range(10):  # zerbrochene Krone
        a = k * math.pi / 5
        box(1.6, 1.2, rnd.uniform(0.6, 2.6), math.cos(a) * 3.6, -12 + math.sin(a) * 3.6, 18.0, rub, a + math.pi / 2)
    box(1.2, 0.3, 2.0, 0, -15.9, 7.0, DARK)  # Hocheingang
    cyl(4.05, 5.0, 0, -12, 0, moss, seg=16, r2=4.02)  # Bewuchs unten
    ring = [(-12, -20), (10, -22), (15, -2), (11, 18), (-8, 20), (-16, 4)]
    for i in range(len(ring)):
        (ax, ay), (bx, by) = ring[i], ring[(i + 1) % len(ring)]
        ln = math.hypot(bx - ax, by - ay)
        rot = math.atan2(by - ay, bx - ax)
        parts = int(ln // 4)
        for k in range(parts):
            if rnd.random() < 0.25:
                continue
            t = (k + 0.5) / parts
            hgt = rnd.uniform(1.5, 6.5)
            box(ln / parts + 0.1, 1.4, hgt, ax + (bx - ax) * t, ay + (by - ay) * t, -1.0, rub, rot)
    box(2.0, 1.6, 4.0, 12.5, 8, -1, rub)
    box(2.0, 1.6, 4.0, 13.5, 4, -1, rub)
    import bpy

    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=2.0, depth=1.6, location=(13.0, 6, 3.0), rotation=(0, math.pi / 2, 0))
    kit.add(bpy.context.object, rub, "building")  # Torbogen


DETAILS = {
    "stadtkirche": stadtkirche,
    "st-franz": st_franz,
    "rathaus-kandern": rathaus_kandern,
    "bahnhof-kandern": bahnhof_kandern,
    "museum-kandern": museum,
    "forsthaus-kandern": manor,
    "bfa": school,
    "discounter": lambda lm: supermarket(lm, RED),
    "frischemarkt": lambda lm: supermarket(lm, GREEN),
    "sausenburg": sausenburg,
}


SILHOUETTES = {}


def silhouette(lm_id, max_boxes=8):
    """Vereinfachte Form für die Fernsicht: die größten Bauteile als Quader im Modellsystem (lx, y, lz)."""
    from mathutils import Vector

    parts = []
    for objs in kit.groups.values():
        for o in objs:
            pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
            xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
            sx, sy, sz = max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)
            if sz < 0.5 or max(zs) < 1.0:
                continue
            # Blender (bx, by, bz) -> Modell (lx = −bx, y = bz, lz = −by)
            cx, cy, cz = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2
            parts.append((sx * sy * sz, [round(-cx, 1), round(cz, 1), round(-cy, 1), round(sx, 1), round(sz, 1), round(sy, 1)]))
    parts.sort(key=lambda p: -p[0])
    SILHOUETTES[lm_id] = [p[1] for p in parts[:max_boxes]]


def existing_ids():
    """Bisher gebaute Kandern-Wahrzeichen (aus dem letzten Rezept); dieser Bestand bleibt fest."""
    path = os.path.join(ROOT, "assets/recipes/landmarks.json")
    if not os.path.exists(path):
        return None
    return {r["id"].removeprefix("landmark-") for r in json.load(open(path)) if not r.get("remote")}


KEEP = existing_ids()


def wanted(lm):
    """Modell bauen? Liste der Region (region.json) und der bisherige Kandern-Bestand."""
    if lm.get("region"):
        return True
    return (lm["id"] in KEEP) if KEEP is not None else not lm.get("remote")


def build(lm):
    if not wanted(lm):
        return False
    detail = lm.get("detail") or ""
    fn = DETAILS.get(detail) or REGION_DETAILS.get(detail) or STYLES.get(lm["style"]) or REGION_STYLES.get(lm["style"])
    if fn is None:
        print(f"[landmarks] {lm['id']}: keine Vorlage für {lm['style']}")
        return False
    kit.reset()
    fn(lm)
    if lm.get("region"):
        silhouette(lm["id"])
    export(lm["id"], OUT)
    return True


def write_recipes_and_registry(ids, by_id):
    recipes = []
    for i in ids:
        r = {"id": f"landmark-{i}", "kind": "landmark", "source": f"landmarks/{i}.glb"}
        if by_id[i].get("region"):
            r["remote"] = True  # Modell wird bei Bedarf nachgeladen (models-remote/)
        if by_id[i].get("large"):
            r["large"] = True  # höhere Dreiecksgrenze (Hochhaus, Terminal)
        recipes.append(r)
    with open(os.path.join(ROOT, "assets/recipes/landmarks.json"), "w") as f:
        f.write(json.dumps(recipes, indent=2, ensure_ascii=False) + "\n")
    path = os.path.join(ROOT, "assets/registry.json")
    reg = json.load(open(path))
    reg["entries"] = [e for e in reg["entries"] if not e["id"].startswith("landmark-")]
    for i in ids:
        reg["entries"].append(
            {
                "id": f"landmark-{i}",
                "kind": "landmark",
                "source": "eigenes Modell: tools/asset-pipeline/blender/landmarks.py nach OSM-Grundriss und Fotos",
                "package": "Kandern Chaos – eigene Modelle",
                "license": "own",
                "retrieved": "2026-11-22",
                "style": {"european": True, "noLogos": True, "notes": "Wahrzeichen, stilisiert, ohne Schrift und Logos"},
                "changes": "Grundfarben in Vertex-Farben eingebacken",
                "status": "accepted",
            }
        )
    with open(path, "w") as f:
        f.write(json.dumps(reg, indent=2, ensure_ascii=False) + "\n")


data = json.load(open(os.path.join(ROOT, "assets/landmarks/footprints.json")))
os.makedirs(OUT, exist_ok=True)
built = [lm["id"] for lm in data["landmarks"] if build(lm)]
write_recipes_and_registry(sorted(built), {lm["id"]: lm for lm in data["landmarks"]})
# Silhouetten der Wahrzeichen der Region für die Fernsicht (klein, gehört zum Kern)
with open(os.path.join(ROOT, "apps/game/public/world/silhouettes.json"), "w") as f:
    f.write(json.dumps({"version": 1, "silhouettes": SILHOUETTES}, separators=(",", ":")) + "\n")
print(f"[landmarks] fertig: {len(built)} Modelle")
