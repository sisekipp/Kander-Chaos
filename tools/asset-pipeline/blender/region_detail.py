"""
Handgebaute Wahrzeichen der Region nach Fotos (Change landmarks-region). Stilisiert, ohne Schrift und Logos:
markante Formen und Farben machen sie erkennbar (Stufen der Roche-Türme, rote Münstertürme, rotes Rathaus …).
"""
import math
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from landmark_styles import DARK, GLASS, GOLD, SAND, SLATE, STONE, WHITE, dims  # noqa: E402
from lmkit import box, color, cyl, gable_roof, hip_roof, prism, pyramid, to_blender, windows  # noqa: E402
from region_styles import CONCRETE, GLASS_BLUE, STEEL, arch_x, bridge, height_of, station_hall, terminal  # noqa: E402

RED_SANDSTONE = color("lm_red_sandstone", (0.66, 0.3, 0.25))
BASEL_RED = color("lm_basel_red", (0.72, 0.18, 0.14))
TILE_GREEN = color("lm_tile_green", (0.25, 0.5, 0.35))
TILE_YELLOW = color("lm_tile_yellow", (0.85, 0.7, 0.25))
BAND = color("lm_roche_band", (0.32, 0.34, 0.36))
RUBBLE = color("lm_rubble", (0.55, 0.54, 0.5))


def roche(lm, steps):
    """Roche-Türme: schlanker weißer Turm, dunkle Fensterbänder, an einer Schmalseite treppenförmig abgestuft."""
    h = height_of(lm, 150.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    cy = (y0 + y1) / 2
    for k in range(steps):  # Stufen: je höher, desto schmaler (Treppe zur Schmalseite x0 hin)
        top = h * (0.4 + 0.6 * (k + 1) / steps)
        xa = x0 + k * lx * 0.7 / steps
        box(x1 - xa, ly, top + 2.0, (xa + x1) / 2, cy, -2.0, WHITE)
        for b in range(1, int(top // 4.2)):
            box(x1 - xa + 0.3, ly + 0.3, 1.5, (xa + x1) / 2, cy, b * 4.2 - 1.6, BAND)
    box(lx * 0.3, ly * 0.6, 3.0, x1 - lx * 0.15, cy, h, CONCRETE)


def roche_bau_1(lm):
    roche(lm, 6)


def roche_bau_2(lm):
    roche(lm, 8)


def basler_muenster(lm):
    """Basler Münster: roter Sandstein, buntes Dachziegelmuster, zwei schlanke Westtürme (Georgs- und Martinsturm)."""
    h = 20.0
    pts = to_blender(lm["footprint"])
    prism(pts, -2.0, h, RED_SANDSTONE)
    x0, x1, y0, y1, lx, ly = dims(pts)
    windows(pts, 5.0, 9.0, 2.0, 6.0, GLASS, SAND, margin=4.0)
    gable_roof(x0, x1, y0, y1, h, min(14.0, ly * 0.5), TILE_GREEN, over=0.4)
    for k in range(5):  # Rautenmuster als Streifen auf dem Dach
        box(lx * 0.9, 0.4, 0.3, (x0 + x1) / 2, (y0 + y1) / 2 + (k - 2) * ly * 0.12, h + 3.0 + abs(k - 2) * -1.2, TILE_YELLOW)
    fx = x1 if lm["ux"] > 0 else x0  # Westseite
    inward = -1 if fx == x1 else 1
    th = height_of(lm, 65.0)
    for s in (-1, 1):
        tx, ty = fx + inward * 4.5, (y0 + y1) / 2 + s * (ly / 2 - 4.0)
        box(8.0, 8.0, th - 18.0, tx, ty, -2.0, RED_SANDSTONE)
        box(6.0, 6.0, 8.0, tx, ty, th - 20.0, RED_SANDSTONE)
        pyramid(tx, ty, 6.0, th - 12.0, 12.0, RED_SANDSTONE, seg=8)
        box(0.3, 2.0, 4.0, tx - inward * 4.1, ty, th - 30.0, DARK)


def rathaus_basel(lm):
    """Rathaus Basel: leuchtend rote Fassade, Zinnen, Uhrtürmchen mit goldener Spitze, Arkaden unten."""
    h = 18.0
    pts = to_blender(lm["footprint"])
    prism(pts, -2.0, h, BASEL_RED)
    x0, x1, y0, y1, lx, ly = dims(pts)
    windows(pts, 7.0, 2.4, 1.4, 3.0, GLASS, GOLD)
    windows(pts, 11.5, 2.4, 1.4, 3.0, GLASS, GOLD)
    for k in range(int(lx // 2.5)):  # Zinnen
        box(1.2, ly, 1.2, x0 + 1.25 + k * 2.5, (y0 + y1) / 2, h, BASEL_RED)
    for k in range(3):  # Arkaden
        arch_x(1.8, 0.5, x0 + lx * (k + 1) / 4, y0 - 0.2, 2.5, DARK)
    tx = x0 + lx * 0.8
    box(4.0, 4.0, 14.0, tx, (y0 + y1) / 2, h - 2.0, BASEL_RED)
    pyramid(tx, (y0 + y1) / 2, 4.0, h + 12.0, 9.0, TILE_GREEN, seg=8)
    cyl(0.3, 1.5, tx, (y0 + y1) / 2, h + 21.0, GOLD, seg=6)
    gable_roof(x0, x1, y0, y1, h + 1.2, 5.0, TILE_GREEN)


def spalentor(lm):
    """Spalentor: quadratischer Torturm mit steilem, buntem Ziegeldach, zwei runde Flankentürme mit Zinnen."""
    th = height_of(lm, 40.0)
    box(12.0, 12.0, th - 14.0, 0, 0, -2.0, SAND)
    arch_x(3.0, 12.4, 0, 0, 3.0, DARK)  # Tordurchfahrt (Querachse)
    pyramid(0, 0, 12.5, th - 16.0, 16.0, TILE_GREEN, seg=4)
    box(0.4, 9.0, 0.4, 0, 0, th - 9.0, TILE_YELLOW)
    for s in (-1, 1):
        cyl(3.2, th - 22.0, 0, s * 8.0, -2.0, SAND, seg=16)
        for k in range(8):
            a = k * math.pi / 4
            box(1.0, 0.8, 1.2, math.cos(a) * 2.8, s * 8.0 + math.sin(a) * 2.8, th - 24.0, SAND, a)


def vitra_feuerwehrhaus(lm):
    """Vitra-Feuerwehrhaus: scharfkantige, schräg auskragende Betonscheiben (Dekonstruktivismus)."""
    for k, (w, d, h, x, y, rot) in enumerate(((40, 3, 9, 0, 0, 0.0), (32, 2.5, 7, 4, 5, 0.12), (24, 2.5, 11, -6, -4, -0.1), (16, 6, 0.6, 14, 2, 0.25))):
        box(w, d, h, x, y, -1.0 if k < 3 else 9.5, CONCRETE, rot)
    box(18, 7, 6, 2, 1, -1.0, GLASS)


def vitra_museum(lm):
    """Vitra Design Museum: weiße, verdrehte Kuben mit schrägen Oberlichtern."""
    for w, d, h, x, y, rot in ((18, 14, 9, 0, 0, 0.0), (10, 8, 13, -8, 6, 0.4), (8, 6, 11, 9, -6, -0.3), (12, 4, 7, 4, 9, 0.8)):
        box(w, d, h, x, y, -1.0, WHITE, rot)
    box(6, 5, 2, -8, 6, 12.5, GLASS, 0.4)


def vitra_haus(lm):
    """Vitra Haus: gestapelte, gegeneinander verdrehte Satteldachhäuser in Dunkelgrau mit großen Glasgiebeln."""
    house = color("lm_vitra_anthracite", (0.22, 0.22, 0.24))
    for k, (x, y, z, rot) in enumerate(((0, 0, 0, 0.0), (6, 3, 4.5, 0.6), (-5, 2, 9, -0.5), (2, -4, 13.5, 0.3), (-3, -2, 18, 1.0))):
        box(18, 6, 4.5, x, y, z - (1.0 if k == 0 else 0), house, rot)
        box(0.3, 5.0, 3.5, x + math.cos(rot) * 9.1, y + math.sin(rot) * 9.1, z + 0.4, GLASS, rot)


def burg_roetteln(lm):
    """Burg Rötteln: hoher Bergfried mit Zinnen, Reste der Ober- und Vorburg aus Bruchstein."""
    th = height_of(lm, 25.0)
    box(9.0, 9.0, th, 0, 0, -2.0, RUBBLE)
    for k in range(8):
        a = k * math.pi / 4
        box(1.6, 1.0, 1.6, math.cos(a) * 4.0, math.sin(a) * 4.0, th - 2.0, RUBBLE, a)
    for x, y, w, d, h in ((14, 0, 22, 2, 9), (25, 10, 2, 22, 7), (10, 14, 26, 2, 6), (-8, 8, 2, 18, 5)):
        box(w, d, h, x, y, -2.0, RUBBLE)
    box(10, 8, 11, 18, 6, -2.0, STONE)


def basel_sbb(lm):
    """Bahnhof Basel SBB: neubarocke Front mit Mittelrisalit und Uhr, dahinter die Perronhalle."""
    station_hall(lm)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    box(lx, 8.0, 16.0, (x0 + x1) / 2, y0 + 4.0, -2.0, SAND)
    box(16.0, 9.0, 22.0, (x0 + x1) / 2, y0 + 4.5, -2.0, SAND)
    cyl(1.8, 0.3, (x0 + x1) / 2, y0 - 0.05, 15.0, WHITE, seg=16)
    hip_roof((x0 + x1) / 2 - 8, (x0 + x1) / 2 + 8, y0, y0 + 9, 20.0, 4.0, SLATE)


def badischer_bahnhof(lm):
    """Badischer Bahnhof: rötlicher Sandsteinbau mit hohem Uhrturm an der Ecke."""
    station_hall(lm)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    box(lx, 9.0, 14.0, (x0 + x1) / 2, y0 + 4.5, -2.0, RED_SANDSTONE)
    tx = x0 + 6.0
    box(7.0, 7.0, 38.0, tx, y0 + 4.0, -2.0, RED_SANDSTONE)
    cyl(1.6, 0.3, tx, y0 + 0.4, 30.0, WHITE, seg=16)
    pyramid(tx, y0 + 4.0, 7.2, 36.0, 7.0, SLATE)


def messe_halle_1(lm):
    """Messe Basel Halle 1: silbern geflochtene Metallfassade, darüber der runde Lichthof („City Lounge“)."""
    h = height_of(lm, 32.0)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    prism(pts, -2.0, h, STEEL)
    for k in range(int(h // 4)):
        prism([(x * 1.002, y * 1.002) for x, y in pts], k * 4.0 + 1.0, k * 4.0 + 1.5, CONCRETE)
    r = min(lx, ly) * 0.18
    cyl(r + 4.0, 3.0, (x0 + x1) / 2, (y0 + y1) / 2, h - 1.0, WHITE, seg=24)
    cyl(r, 3.2, (x0 + x1) / 2, (y0 + y1) / 2, h - 0.9, GLASS_BLUE, seg=24)


def mittlere_bruecke(lm):
    """Mittlere Brücke: Steinbögen, in der Mitte das kleine Käppelijoch (Kapelle mit spitzem Dach)."""
    bridge(lm, STONE, 6)
    h = height_of(lm, 12.0) * 0.7
    box(4.0, 3.0, 4.0, 0, 0, h, SAND)
    pyramid(0, 0, 4.2, h + 4.0, 4.0, BASEL_RED)


def dreilaenderbruecke(lm):
    """Dreiländerbrücke: schlanke Fußgängerbrücke mit einem flachen weißen Stahlbogen."""
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    deck = 9.0
    box(lx, ly, 0.8, 0, 0, deck, WHITE)
    for k in range(13):  # Bogen aus Segmenten
        t = k / 12
        x = x0 + t * lx
        z = deck + 15.0 * math.sin(t * math.pi)
        box(lx / 12 + 0.5, 1.2, 1.2, x, 0, z, WHITE, 0)
        box(0.2, 0.2, max(0.1, z - deck), x, 0, deck + 0.8, STEEL)
    for x in (x0, x1):
        box(4.0, ly + 2, deck + 4.0, x, 0, -4.0, CONCRETE)


def terminal_eap(lm):
    terminal(lm, bridges=7)
    pts = to_blender(lm["footprint"])
    x0, x1, y0, y1, lx, ly = dims(pts)
    box(lx * 0.3, ly * 0.4, 2.0, (x0 + x1) / 2, (y0 + y1) / 2, height_of(lm, 20.0), STEEL)


REGION_DETAILS = {
    "roche-bau-1": roche_bau_1,
    "roche-bau-2": roche_bau_2,
    "basler-muenster": basler_muenster,
    "rathaus-basel": rathaus_basel,
    "spalentor": spalentor,
    "vitra-feuerwehrhaus": vitra_feuerwehrhaus,
    "vitra-museum": vitra_museum,
    "vitra-haus": vitra_haus,
    "burg-roetteln": burg_roetteln,
    "basel-sbb": basel_sbb,
    "badischer-bahnhof": badischer_bahnhof,
    "messe-halle-1": messe_halle_1,
    "mittlere-bruecke": mittlere_bruecke,
    "dreilaenderbruecke": dreilaenderbruecke,
    "terminal-eap": terminal_eap,
}
