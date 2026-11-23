"""
Gemeinsamer Animationssatz der Figuren (Blender-Kommandozeile, 30 fps).

Posen sind Schwenkwinkel in Grad, positiv = nach vorn (Arme, Beine), Beugung = Knie nach hinten bzw. Ellbogen nach
vorn, `out` = Arm seitlich abspreizen, `spine`/`head` = nach vorn neigen, `hips_z` = Becken heben (m).
Natürliche Geschwindigkeit der Gangarten (Schrittweite aus Beinlänge und Schwenkwinkel) steht in `CLIP_SPEEDS`
und gehört zu `apps/game/src/player/animation/clips.ts`.
"""
import math

from mathutils import Euler

# Aktionen: Name -> (Länge in Frames, Schleife, Schlüsselposen [(Frame, Pose)])
P0 = dict(out=6, fore=8)


def mirror(p):
    """Links/rechts tauschen (zweite Hälfte eines Schrittzyklus)."""
    q = dict(p)
    for a, b in (("legL", "legR"), ("kneeL", "kneeR"), ("armL", "armR"), ("foreL", "foreR"), ("outL", "outR")):
        q[a], q[b] = p.get(b, 0), p.get(a, 0)
    return q


WALK = dict(legL=25, legR=-25, kneeL=5, kneeR=15, armL=-20, armR=20, fore=15, out=6, spine=3, hips_z=-0.02)
WALK_PASS = dict(legL=-2, legR=2, kneeL=5, kneeR=42, armL=0, armR=0, fore=15, out=6, spine=3, hips_z=0.015)
RUN = dict(legL=45, legR=-30, kneeL=20, kneeR=60, armL=-45, armR=40, fore=75, out=8, spine=12, hips_z=-0.03)
RUN_PASS = dict(legL=8, legR=12, kneeL=10, kneeR=100, armL=0, armR=0, fore=75, out=8, spine=12, hips_z=0.04)
SIT = dict(legL=78, legR=78, kneeL=82, kneeR=82, armL=55, armR=55, fore=25, out=8, spine=18)
FALL_A = dict(outL=80, outR=70, armL=20, legL=20, kneeL=30, legR=-10, kneeR=20, spine=-5, fore=20)
FALL_B = dict(outL=60, outR=85, armR=20, armL=-10, legL=-10, kneeL=20, legR=25, kneeR=40, spine=-5, fore=20)

CLIPS = {
    "idle": (60, True, [(0, P0), (30, dict(out=8, fore=10, spine=2, head=-2, hips_z=-0.005)), (60, P0)]),
    "walk": (30, True, [(0, WALK), (8, WALK_PASS), (15, mirror(WALK)), (23, mirror(WALK_PASS)), (30, WALK)]),
    "run": (16, True, [(0, RUN), (4, RUN_PASS), (8, mirror(RUN)), (12, mirror(RUN_PASS)), (16, RUN)]),
    "jump": (12, False, [
        (0, dict(legL=35, legR=35, kneeL=60, kneeR=60, spine=15, armL=-30, armR=-30, fore=20, hips_z=-0.12)),
        (5, dict(legL=0, legR=0, kneeL=5, kneeR=5, armL=150, armR=150, out=10, spine=-5)),
        (12, dict(legL=30, legR=20, kneeL=50, kneeR=40, armL=120, armR=120, out=15, fore=20)),
    ]),
    "fall": (20, True, [(0, FALL_A), (10, FALL_B), (20, FALL_A)]),
    "enter": (18, False, [
        (0, P0),
        (8, dict(spine=20, legL=60, kneeL=70, armL=50, armR=50, fore=20, out=6, hips_z=-0.05)),
        (18, SIT),
    ]),
    "exit": (18, False, [
        (0, SIT),
        (10, dict(legR=40, kneeR=40, legL=0, kneeL=10, spine=10, armL=20, armR=20, fore=15, out=6)),
        (18, P0),
    ]),
    "sit": (2, True, [(0, SIT), (2, SIT)]),
}

# Zusätzlich für NPCs (gebackene Vertex-Animation): winken, umfallen, aufstehen
WAVE_A = dict(P0, armR=15, outR=150, foreR=35)
WAVE_B = dict(P0, armR=15, outR=135, foreR=0)
LYING = dict(root_pitch=-85, spine=-5, legL=5, legR=-5, kneeL=10, kneeR=5, outL=70, outR=70, armL=10, armR=10,
             hips_z=-0.64)
NPC_CLIPS = {
    "wave": (30, True, [(0, WAVE_A), (8, WAVE_B), (15, WAVE_A), (23, WAVE_B), (30, WAVE_A)]),
    "fallover": (24, False, [
        (0, P0),
        (8, dict(root_pitch=-30, spine=-20, armL=70, armR=70, outL=50, outR=50, legL=30, kneeL=40, hips_z=-0.2)),
        (24, LYING),
    ]),
    "getup": (30, False, [
        (0, LYING),
        (12, dict(spine=30, legL=90, legR=90, kneeL=100, kneeR=100, armL=-30, armR=-30, out=10, hips_z=-0.58)),
        (22, dict(spine=35, legL=60, legR=60, kneeL=110, kneeR=110, armL=20, armR=20, out=8, hips_z=-0.35)),
        (30, P0),
    ]),
}

# Natürliche Geschwindigkeit (m/s) bei speedRatio 1 für eine Figur der Größe 1,45 m: 2 Schritte je Zyklus,
# Schrittweite = 2 · Beinlänge · sin(Schwenkwinkel).
LEG = 0.68


def clip_speed(swing_deg, frames):
    return round(2 * (2 * LEG * math.sin(math.radians(swing_deg))) / (frames / 30), 2)


CLIP_SPEEDS = {"walk": clip_speed(25, 30), "run": clip_speed(45, 16)}


def bone_euler(p):
    """Pose -> Schwenk je Knochen (pitch, roll) in Grad im Armaturraum. Vorderseite −y."""
    out = p.get("out", 0)
    e = {
        "hips": (p.get("root_pitch", 0), 0),
        "spine": (p.get("spine", 0), 0),
        "head": (p.get("head", 0), 0),
    }
    for side, k in (("L", -1), ("R", 1)):
        fore = p.get(f"fore{side}", p.get("fore", 0))
        e[f"upper_arm.{side}"] = (-p.get(f"arm{side}", 0), k * p.get(f"out{side}", out))
        e[f"forearm.{side}"] = (-fore, 0)
        e[f"thigh.{side}"] = (-p.get(f"leg{side}", 0), 0)
        e[f"shin.{side}"] = (p.get(f"knee{side}", 0), 0)
    return e


def apply_pose(arm, p, scale=1.0):
    for name, (pitch, roll) in bone_euler(p).items():
        pb = arm.pose.bones[name]
        rest = pb.bone.matrix_local.to_quaternion()
        q = Euler((math.radians(pitch), math.radians(roll), 0), "XYZ").to_quaternion()
        pb.rotation_quaternion = rest.inverted() @ q @ rest
    # Becken: lokale y-Achse zeigt nach oben
    arm.pose.bones["hips"].location = (0, p.get("hips_z", 0) * scale, 0)


def bake_actions(arm, clips, scale=1.0):
    """Je Clip eine Aktion mit Schlüsseln für alle Knochen, als NLA-Spur abgelegt (Export aller Aktionen)."""
    import bpy

    arm.animation_data_create()
    for name, (length, _loop, keys) in clips.items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        for frame, pose in keys:
            apply_pose(arm, pose, scale)
            for pb in arm.pose.bones:
                pb.keyframe_insert("rotation_quaternion", frame=frame)
                pb.keyframe_insert("location", frame=frame)
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, act)
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
