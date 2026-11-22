"""
Eigene Automodelle für Kandern Chaos (Low-Poly, europäische Grundformen, keine Marken), Blender-Kommandozeile:

    blender -b --python-exit-code 1 -P tools/asset-pipeline/blender/cars.py -- assets/own

Jeder Typ ist ein Maß-Wörterbuch für `carkit.car` (Profile in Metern, Vorderseite −y). Knoten: `body`
(Lackzone `paint`), `wheel-front-left` … `wheel-back-right`, `detach_*` (Stoßfänger, Türen, Spiegel).
"""
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from carkit import car  # noqa: E402
from kit import box, reset  # noqa: E402


def roof_rails(c):
    (y1, z1), (y2, z2) = c["cabin"][1], c["cabin"][2]
    for s in (1, -1):
        box(0.04, (y2 - y1) * 0.85, 0.05, (s * (c["cab_hw"][1] - 0.04), (y1 + y2) / 2, (z1 + z2) / 2 + 0.07), "plastic")


def roof_spoiler(c):
    y2, z2 = c["cabin"][2]
    box(1.1, 0.12, 0.04, (0, y2 + 0.04, z2 + 0.06), "paint")


def suv_extras(c):
    roof_rails(c)
    for wy in (-c["wb"], c["wb"]):  # Radlaufverbreiterungen
        for s in (1, -1):
            box(0.05, 2 * c["r"] + 0.25, 0.1, (s * (c["hw"] + 0.01), wy, 2 * c["r"] + 0.08), "plastic")
    box(0.5, 0.08, 0.12, (0, c["rear"] - 0.02, 0.95), "plastic")  # Ersatzradabdeckung angedeutet


def van_extras(c):
    for s in (1, -1):  # Schiebetürschiene und Hecktürfuge
        box(0.02, 1.6, 0.03, (s * (c["hw"] + 0.01), 0.75, 1.45), "plastic")
    box(0.02, 0.02, 1.6, (0, c["rear"] + 0.01, 1.25), "plastic")
    box(1.6, 1.8, 0.04, (0, 0.9, 2.34), "plastic")  # Dachträger-Platte


def pickup_extras(c):
    hw = c["hw"]
    box(2 * hw - 0.16, 1.85, 0.02, (0, 1.62, 1.16), "plastic")  # Ladeflächenabdeckung
    for s in (1, -1):
        box(0.08, 1.95, 0.1, (s * (hw - 0.05), 1.6, 1.18), "paint")
    box(2 * hw - 0.02, 0.08, 0.1, (0, 2.56, 1.18), "paint")
    box(1.4, 0.06, 0.25, (0, 0.6, 1.3), "plastic")  # Kabinenrückwand-Schutz


CARS = [
    dict(
        id="car-mini", r=0.29, wb=0.88, track=0.64, hw=0.78, front=-1.34, rear=1.34,
        lower=[(-1.3, 0.3), (-1.36, 0.52), (-1.28, 0.7), (-0.95, 0.86), (1.2, 0.92), (1.32, 0.88), (1.36, 0.55), (1.32, 0.3)],
        cabin=[(-0.93, 0.86), (-0.32, 1.48), (1.02, 1.5), (1.24, 0.94)], cab_hw=(0.74, 0.62),
        doors=[(-0.05, 1.0)], c_r=0.08, tail_z=0.78, lamp_z=0.7,
    ),
    dict(
        id="car-small", r=0.32, wb=1.22, track=0.71, hw=0.84, front=-1.92, rear=1.88,
        lower=[(-1.88, 0.3), (-1.94, 0.5), (-1.86, 0.68), (-1.2, 0.86), (1.66, 0.94), (1.84, 0.92), (1.9, 0.55), (1.86, 0.3)],
        cabin=[(-1.18, 0.86), (-0.4, 1.4), (1.5, 1.44), (1.7, 0.95)], cab_hw=(0.79, 0.67),
        b=[0.35], doors=[(-0.45, 0.9), (0.6, 0.8)], c_r=0.09, extras=roof_spoiler,
    ),
    dict(
        id="car-compact", r=0.32, wb=1.33, track=0.75, hw=0.88, front=-2.12, rear=2.1,
        lower=[(-2.08, 0.3), (-2.14, 0.5), (-2.06, 0.68), (-1.3, 0.85), (1.85, 0.95), (2.06, 0.92), (2.12, 0.55), (2.07, 0.3)],
        cabin=[(-1.28, 0.85), (-0.45, 1.42), (1.55, 1.45), (1.95, 0.96)], cab_hw=(0.83, 0.7),
        b=[0.15], doors=[(-0.42, 1.0), (0.62, 0.95)], c_r=0.09, extras=roof_spoiler,
    ),
    dict(
        id="car-estate", r=0.33, wb=1.42, track=0.77, hw=0.9, front=-2.34, rear=2.34,
        lower=[(-2.3, 0.3), (-2.36, 0.5), (-2.28, 0.68), (-1.45, 0.86), (2.15, 0.95), (2.33, 0.92), (2.36, 0.55), (2.32, 0.3)],
        cabin=[(-1.42, 0.86), (-0.6, 1.42), (2.1, 1.44), (2.27, 0.98)], cab_hw=(0.85, 0.72),
        b=[0.05, 1.15], doors=[(-0.55, 1.05), (0.58, 1.0)], c_r=0.05, extras=roof_rails,
    ),
    dict(
        id="car-sedan", r=0.33, wb=1.42, track=0.77, hw=0.9, front=-2.34, rear=2.34,
        lower=[(-2.3, 0.3), (-2.36, 0.5), (-2.28, 0.68), (-1.42, 0.86), (1.6, 0.92), (2.25, 0.96), (2.36, 0.88), (2.36, 0.55), (2.32, 0.3)],
        cabin=[(-1.4, 0.86), (-0.55, 1.4), (0.95, 1.42), (1.65, 0.93)], cab_hw=(0.85, 0.72),
        b=[0.2], doors=[(-0.5, 1.05), (0.62, 1.0)], c_r=0.1, tail_z=0.84, rear_plate_z=0.66,
    ),
    dict(
        id="car-suv", r=0.37, wb=1.36, track=0.8, hw=0.93, front=-2.24, rear=2.24,
        lower=[(-2.2, 0.4), (-2.26, 0.65), (-2.18, 0.88), (-1.35, 1.05), (2.05, 1.12), (2.22, 1.1), (2.25, 0.65), (2.2, 0.4)],
        cabin=[(-1.32, 1.05), (-0.55, 1.62), (1.85, 1.64), (2.12, 1.14)], cab_hw=(0.88, 0.76),
        b=[0.2], doors=[(-0.45, 1.05), (0.7, 1.0)], c_r=0.08, lamp_z=0.9, tail_z=1.0, bumper_z=0.55,
        rear_plate_z=0.8, tire_w=0.23, extras=suv_extras,
    ),
    dict(
        id="car-mpv", r=0.32, wb=1.45, track=0.77, hw=0.9, front=-2.28, rear=2.28,
        lower=[(-2.25, 0.32), (-2.3, 0.52), (-2.2, 0.72), (-1.6, 0.9), (2.15, 0.98), (2.28, 0.95), (2.3, 0.55), (2.26, 0.32)],
        cabin=[(-1.58, 0.9), (-0.95, 1.68), (2.1, 1.72), (2.24, 1.0)], cab_hw=(0.86, 0.76),
        b=[-0.3, 1.0], doors=[(-0.9, 0.95), (0.35, 1.1)], c_r=0.05, tail_z=0.95, extras=roof_rails,
    ),
    dict(
        id="van-delivery", r=0.34, wb=1.75, track=0.85, hw=0.99, front=-2.58, rear=2.6, bevel=0.08,
        lower=[(-2.55, 0.36), (-2.6, 0.62), (-2.48, 0.98), (-1.95, 1.18), (-1.25, 2.2), (2.55, 2.32), (2.6, 2.2), (2.6, 0.62), (2.55, 0.36)],
        cabin=[(-1.99, 1.19), (-1.32, 2.12), (-0.78, 2.12), (-0.78, 1.22)], cab_hw=(1.0, 0.975), roof=False,
        belt=1.25, doors=[(-1.25, 0.85)], lamp_z=0.88, tail_z=1.05, bumper_z=0.46, rear_plate_z=0.75, tire_w=0.21,
        extras=van_extras,
    ),
    dict(
        id="car-pickup", r=0.38, wb=1.6, track=0.82, hw=0.95, front=-2.58, rear=2.58,
        lower=[(-2.55, 0.42), (-2.62, 0.68), (-2.5, 0.98), (-1.7, 1.12), (2.55, 1.15), (2.6, 1.1), (2.6, 0.68), (2.55, 0.42)],
        cabin=[(-1.68, 1.12), (-1.0, 1.78), (0.45, 1.8), (0.55, 1.14)], cab_hw=(0.9, 0.8),
        b=[-0.25], doors=[(-0.75, 1.0), (0.15, 0.7)], c_r=0.07, lamp_z=0.95, tail_z=0.95, bumper_z=0.58,
        rear_plate_z=0.82, tire_w=0.24, extras=pickup_extras,
    ),
]

for spec in CARS:
    reset()
    car(spec)
print("[cars] fertig")
