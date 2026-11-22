"""
Eigene Zweirad-Modelle für Kandern Chaos (Low-Poly, europäischer Stil), gebaut mit der Blender-Kommandozeile:

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/vehicles.py -- assets/own

Aufbau je Modell (Knotennamen liest die Asset-Pipeline bzw. das Spiel):
- `body`: Rahmen/Karosserie (Material `paint` = Lackzone, wird im Spiel je Fahrzeug eingefärbt)
- `steer`: Gabel, Lenker, Lampe – dreht im Spiel um die senkrechte Achse durch das Vorderrad
- `wheel-front`, `wheel-back`: Räder (Mitte der Geometrie = Radmitte)
- `detach_*`: lösbare Teile für den Schaden (mindestens 2)
Boden bei z = 0. Kein Text, keine Logos.
"""
import math
import os
import sys

import bpy

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from kit import add, arc, ball, bar, box, export, reset, tube, wheel  # noqa: E402

# ---------------------------------------------------------------------------------------------------------------
# Fahrräder


def bike_frame_common(rear_y, front_y, r, bb, seat_top, head_top, head_bottom):
    """Hinterbau und Sitzrohr, Sattel, Gabel und Lenker (gemeinsam für beide Räder)."""
    ra = (0, rear_y, r)
    tube(bb, ra, 0.016, "paint")  # Kettenstreben
    tube((0, seat_top[1] - 0.02, seat_top[2] - 0.05), ra, 0.014, "paint")  # Sitzstreben
    tube(bb, seat_top, 0.02, "paint")  # Sitzrohr
    bar(0.1, bb, 0.04, "metal_dark", "body")  # Tretlager
    # Kettenblatt und Kurbeln
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.1, depth=0.01, location=(0.06, bb[1], bb[2]), rotation=(0, math.pi / 2, 0))
    add(bpy.context.object, "metal_dark", "body")
    tube((0.08, bb[1], bb[2]), (0.08, bb[1] + 0.06, bb[2] - 0.16), 0.012, "metal_dark")
    tube((-0.08, bb[1], bb[2]), (-0.08, bb[1] - 0.06, bb[2] + 0.16), 0.012, "metal_dark")
    box(0.1, 0.04, 0.02, (0.12, bb[1] + 0.06, bb[2] - 0.17), "grip")  # Pedale
    box(0.1, 0.04, 0.02, (-0.12, bb[1] - 0.06, bb[2] + 0.17), "grip")
    tube((0.04, bb[1], bb[2]), (0.04, rear_y, r), 0.006, "metal_dark")  # Kette
    # Sattelstütze und Sattel
    top = (0, seat_top[1] + 0.02, seat_top[2] + 0.12)
    tube(seat_top, top, 0.013, "chrome")
    box(0.14, 0.26, 0.05, (0, top[1] - 0.02, top[2] + 0.02), "seat", bevel=0.015)
    # Steuerrohr
    tube(head_bottom, head_top, 0.025, "paint")


def bike_steer(front_y, r, head_top, head_bottom, bar_width, flat_bar):
    fa = (0, front_y, r)
    for x in (-0.045, 0.045):
        tube((x, head_bottom[1], head_bottom[2]), (x, fa[1], fa[2]), 0.012, "chrome", "steer")
    stem_top = (0, head_top[1] + 0.02, head_top[2] + 0.1)
    tube(head_top, stem_top, 0.016, "chrome", "steer")
    by = stem_top[1] + (0.0 if flat_bar else 0.1)
    if not flat_bar:
        tube(stem_top, (0, by, stem_top[2] + 0.03), 0.012, "chrome", "steer")
    bar(bar_width, (0, by, stem_top[2] + 0.03), 0.013, "chrome", "steer")
    for x in (-bar_width / 2 + 0.05, bar_width / 2 - 0.05):
        bar(0.1, (x, by, stem_top[2] + 0.03), 0.018, "grip", "steer")
    return stem_top


def bike_city():
    """Stadtrad mit tiefem Einstieg, Gepäckträger, Korb und Schutzblechen."""
    r, rear_y, front_y = 0.35, 0.56, -0.56
    bb = (0, 0.04, 0.3)
    seat_top = (0, 0.18, 0.82)
    head_top, head_bottom = (0, -0.4, 0.92), (0, -0.44, 0.74)
    bike_frame_common(rear_y, front_y, r, bb, seat_top, head_top, head_bottom)
    tube(head_bottom, bb, 0.024, "paint")  # Unterrohr
    tube((0, -0.42, 0.84), (0, 0.06, 0.42), 0.02, "paint")  # tiefes Oberrohr (Wave)
    # Kettenschutz
    box(0.02, 0.44, 0.05, (0.07, 0.28, 0.31), "paint", rot=(math.radians(-6), 0, 0))
    # Gepäckträger (lösbar)
    for x in (-0.07, 0.07):
        tube((x, rear_y, r), (x, rear_y + 0.05, 0.78), 0.008, "metal_dark", "detach_rack")
        tube((x, 0.2, 0.78), (x, rear_y + 0.14, 0.78), 0.009, "metal_dark", "detach_rack")
    box(0.16, 0.36, 0.015, (0, 0.4, 0.785), "metal_dark", "detach_rack")
    box(0.05, 0.02, 0.03, (0, rear_y + 0.15, 0.76), "taillight", "detach_rack")
    # Schutzbleche (lösbar)
    arc(rear_y, r, r + 0.04, 15, 165, 7, 0.06, 0.012, "paint", "detach_mudguard_back")
    arc(front_y, r, r + 0.04, 20, 140, 6, 0.06, 0.012, "paint", "detach_mudguard_front")
    # Lenker, Lampe, Korb
    stem = bike_steer(front_y, r, head_top, head_bottom, 0.58, flat_bar=False)
    box(0.07, 0.06, 0.06, (0, -0.52, 0.8), "lamp", "steer", bevel=0.01)
    bk = (0, -0.62, 0.88)
    box(0.32, 0.26, 0.2, bk, "basket", "detach_basket")
    tube((0, -0.44, 0.84), (0, bk[1] + 0.06, bk[2] - 0.08), 0.008, "metal_dark", "detach_basket")
    del stem
    wheel("wheel-back", rear_y, r, 0.022, 0.04, spokes=6)
    wheel("wheel-front", front_y, r, 0.022, 0.04, spokes=6)
    export("bike-city")


def bike_mtb():
    """Mountainbike: Diamantrahmen, Federgabel, breiter flacher Lenker, dicke Reifen, Trinkflasche."""
    r, rear_y, front_y = 0.35, 0.54, -0.6
    bb = (0, 0.03, 0.33)
    seat_top = (0, 0.16, 0.8)
    head_top, head_bottom = (0, -0.42, 0.86), (0, -0.46, 0.72)
    bike_frame_common(rear_y, front_y, r, bb, seat_top, head_top, head_bottom)
    tube(head_bottom, bb, 0.03, "paint")  # Unterrohr (dick)
    tube(head_top, (0, seat_top[1] - 0.01, seat_top[2] - 0.04), 0.025, "paint")  # Oberrohr
    # Federgabel: dicke Standrohre in dunklen Tauchrohren
    fa = (0, front_y, r)
    for x in (-0.055, 0.055):
        tube((x, head_bottom[1] - 0.02, head_bottom[2] - 0.02), (x, -0.52, 0.52), 0.02, "chrome", "steer")
        tube((x, -0.52, 0.54), (x, fa[1], fa[2]), 0.026, "metal_dark", "steer")
    bar(0.14, (0, head_bottom[1] - 0.01, head_bottom[2] - 0.02), 0.025, "metal_dark", "steer")  # Gabelkrone
    stem_top = (0, head_top[1] - 0.06, head_top[2] + 0.08)
    tube(head_top, stem_top, 0.018, "metal_dark", "steer")
    bar(0.72, stem_top, 0.014, "metal_dark", "steer")
    for x in (-0.31, 0.31):
        bar(0.1, (x, stem_top[1], stem_top[2]), 0.02, "grip", "steer")
    # Trinkflasche (lösbar) und Sattelstützen-Klemme
    tube((0, -0.12, 0.5), (0, -0.25, 0.64), 0.035, "bottle", "detach_bottle", seg=8)
    box(0.05, 0.05, 0.04, (0, 0.17, 0.81), "metal_dark", "detach_seatclamp")
    # Scheibenbremsen
    for y in (rear_y, front_y):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.08, depth=0.006, location=(-0.06, y, r), rotation=(0, math.pi / 2, 0))
        add(bpy.context.object, "chrome", "wheel-back" if y == rear_y else "wheel-front")
    wheel("wheel-back", rear_y, r, 0.034, 0.06, spokes=6)
    wheel("wheel-front", front_y, r, 0.034, 0.06, spokes=6)
    export("bike-mtb")


# ---------------------------------------------------------------------------------------------------------------
# Motorisierte Zweiräder


def scooter():
    """Roller: Trittbrett, Beinschild, runde Heckverkleidung mit Sitzbank, kleine Räder."""
    r, rear_y, front_y = 0.24, 0.6, -0.6
    box(0.34, 0.56, 0.07, (0, 0.0, 0.28), "paint", bevel=0.02)  # Trittbrett
    box(0.42, 0.74, 0.36, (0, 0.4, 0.46), "paint", bevel=0.1)  # Heckverkleidung
    box(0.3, 0.62, 0.12, (0, 0.38, 0.68), "seat", bevel=0.04)  # Sitzbank
    box(0.12, 0.05, 0.05, (0, 0.78, 0.6), "taillight", bevel=0.01)
    box(0.42, 0.08, 0.62, (0, -0.36, 0.58), "paint", rot=(math.radians(-12), 0, 0), bevel=0.04)  # Beinschild
    box(0.3, 0.3, 0.12, (0, rear_y - 0.12, 0.3), "engine", bevel=0.02)  # Motor/Schwinge
    tube((0.12, rear_y - 0.05, 0.22), (0.14, rear_y + 0.3, 0.3), 0.035, "chrome", "detach_exhaust")
    box(0.2, 0.18, 0.025, (0, 0.8, 0.75), "metal_dark", "detach_rack")  # kleiner Gepäckträger
    tube((0, 0.7, 0.66), (0, 0.8, 0.75), 0.01, "metal_dark", "detach_rack")
    # Lenkung: Lenksäule, Lenkerverkleidung mit Scheinwerfer, Lenker, Spiegel
    head = (0, -0.44, 0.98)
    tube((0, -0.5, 0.5), head, 0.03, "metal_dark", "steer")
    tube((0, -0.5, 0.5), (0, front_y, r), 0.03, "chrome", "steer")
    box(0.36, 0.18, 0.14, (0, -0.44, 1.0), "paint", "steer", bevel=0.04)
    box(0.14, 0.04, 0.08, (0, -0.54, 1.0), "lamp", "steer", bevel=0.015)
    bar(0.66, (0, -0.42, 1.04), 0.014, "chrome", "steer")
    for x in (-0.29, 0.29):
        bar(0.1, (x, -0.42, 1.04), 0.02, "grip", "steer")
    arc(front_y, r, r + 0.05, 30, 150, 5, 0.14, 0.02, "paint", "detach_fender")
    for x, name in ((-0.22, "detach_mirror_left"), (0.22, "detach_mirror_right")):
        tube((x * 0.8, -0.42, 1.05), (x, -0.42, 1.2), 0.008, "chrome", name)
        box(0.09, 0.02, 0.06, (x, -0.43, 1.22), "metal_dark", name)
    wheel("wheel-back", rear_y, r, 0.055, 0.1, spokes=3, rim_mat="chrome")
    wheel("wheel-front", front_y, r, 0.055, 0.1, spokes=3, rim_mat="chrome")
    export("scooter")


def motorbike():
    """Motorrad (Naked Bike): Tank, Sitzbank, Motorblock, Auspuff rechts, Telegabel, Rundscheinwerfer."""
    r, rear_y, front_y = 0.32, 0.72, -0.72
    # Rahmen
    tube((0, -0.5, 0.92), (0, 0.15, 0.78), 0.03, "metal_dark")
    tube((0, -0.5, 0.88), (0, -0.05, 0.3), 0.028, "metal_dark")
    tube((0, -0.05, 0.3), (0, 0.18, 0.38), 0.028, "metal_dark")
    for x in (-0.09, 0.09):
        tube((x, 0.15, 0.45), (x, rear_y, r), 0.025, "chrome")  # Schwinge
        tube((x, 0.4, 0.8), (x, rear_y - 0.12, r + 0.12), 0.022, "chrome")  # Federbeine
    # Motor
    box(0.3, 0.42, 0.3, (0, -0.02, 0.45), "engine", bevel=0.03)
    box(0.36, 0.2, 0.16, (0, -0.18, 0.66), "engine", rot=(math.radians(15), 0, 0), bevel=0.03)  # Zylinder
    for k in range(3):
        box(0.38, 0.015, 0.14, (0, -0.24 + k * 0.04, 0.68), "metal_dark", rot=(math.radians(15), 0, 0))
    # Tank, Sitzbank, Heck
    box(0.36, 0.5, 0.22, (0, -0.2, 0.9), "paint", bevel=0.08)
    box(0.3, 0.55, 0.1, (0, 0.33, 0.86), "seat", bevel=0.035)
    box(0.24, 0.35, 0.12, (0, 0.68, 0.86), "paint", rot=(math.radians(-10), 0, 0), bevel=0.04)
    box(0.12, 0.04, 0.05, (0, 0.86, 0.87), "taillight", bevel=0.01)
    # Auspuff (lösbar)
    tube((0.1, -0.3, 0.42), (0.16, 0.2, 0.32), 0.03, "chrome", "detach_exhaust")
    tube((0.16, 0.2, 0.32), (0.18, 0.75, 0.5), 0.05, "chrome", "detach_exhaust", seg=8)
    # Hinterer Kotflügel mit Kennzeichenhalter (ohne Schrift)
    arc(rear_y, r, r + 0.05, 30, 120, 4, 0.16, 0.02, "metal_dark", "detach_fender_back")
    box(0.16, 0.01, 0.1, (0, 0.95, 0.66), "metal_dark", "detach_fender_back")
    # Lenkung
    for x in (-0.08, 0.08):
        tube((x, -0.56, 1.0), (x, front_y, r), 0.025, "chrome", "steer")
    bar(0.22, (0, -0.56, 0.95), 0.03, "metal_dark", "steer")
    bar(0.72, (0, -0.5, 1.08), 0.014, "chrome", "steer")
    for x in (-0.32, 0.32):
        bar(0.1, (x, -0.5, 1.08), 0.02, "grip", "steer")
    ball(0.09, (0, -0.66, 0.96), "chrome", "steer", scale=(1, 0.7, 1))
    box(0.13, 0.02, 0.13, (0, -0.72, 0.96), "lamp", "steer", bevel=0.03)
    arc(front_y, r, r + 0.04, 40, 140, 4, 0.14, 0.02, "paint", "detach_fender")
    wheel("wheel-back", rear_y, r, 0.065, 0.14, spokes=3, rim_mat="metal_dark")
    wheel("wheel-front", front_y, r, 0.055, 0.12, spokes=3, rim_mat="metal_dark")
    export("motorbike")


BUILDS = (bike_city, bike_mtb, scooter, motorbike)
for build in BUILDS:
    reset()
    build()
print("[vehicles] fertig")
