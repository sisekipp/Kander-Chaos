/**
 * Animationen der Spielfigur (Aktionen im Modell `figure-kid`, Blender-Skript `figure.py`/`figanim.py`).
 * Natürliche Geschwindigkeiten aus `figanim.CLIP_SPEEDS`: bei dieser Geschwindigkeit rutschen die Füße nicht.
 */
export const CLIPS = ['idle', 'walk', 'run', 'jump', 'fall', 'enter', 'exit', 'sit'] as const;
export type ClipName = (typeof CLIPS)[number];

/** m/s bei speedRatio 1 (Figur 1,45 m). */
export const CLIP_SPEEDS = { walk: 1.15, run: 3.61 } as const;

/** Einmalige Animationen und ihre Dauer in s (danach entscheidet wieder die Bewegung). */
export const ONE_SHOT: Partial<Record<ClipName, number>> = { enter: 0.6, exit: 0.6, jump: 0.35 };

export const isLooping = (c: ClipName): boolean => ONE_SHOT[c] === undefined;
