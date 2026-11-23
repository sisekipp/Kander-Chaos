import { describe, expect, it } from 'vite-plus/test';
import { initialAnim, nextAnim, speedRatio, type AnimInput, type AnimState } from './animState.ts';
import { CLIP_SPEEDS } from './clips.ts';

const foot = (speed: number, extra: Partial<AnimInput> = {}): AnimInput => ({
  speed,
  grounded: true,
  vy: 0,
  mode: 'foot',
  fast: false,
  ...extra,
});

const run = (s: AnimState, inp: AnimInput, seconds: number, dt = 1 / 30) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) s = nextAnim(s, inp, dt);
  return s;
};

describe('Animationszustand der Spielfigur', () => {
  it('steht, geht und rennt je nach Geschwindigkeit', () => {
    const s = initialAnim();
    expect(nextAnim(s, foot(0), 0.03).clip).toBe('idle');
    expect(nextAnim(s, foot(1.5), 0.03).clip).toBe('walk');
    expect(nextAnim(s, foot(4.5), 0.03).clip).toBe('run');
    expect(nextAnim(s, foot(1, { fast: true }), 0.03).clip).toBe('run');
  });

  it('Hysterese an der Grenze Gehen/Rennen', () => {
    const walking: AnimState = { clip: 'walk', lock: 0, air: 0 };
    const running: AnimState = { clip: 'run', lock: 0, air: 0 };
    expect(nextAnim(walking, foot(2.9), 0.03).clip).toBe('walk');
    expect(nextAnim(running, foot(2.7), 0.03).clip).toBe('run');
    expect(nextAnim(running, foot(2.5), 0.03).clip).toBe('walk');
  });

  it('fällt erst nach kurzer Zeit in der Luft, Sprung aufwärts', () => {
    let s = run(initialAnim(), foot(2, { grounded: false, vy: -3 }), 0.2);
    expect(s.clip).toBe('walk');
    s = run(s, foot(2, { grounded: false, vy: -3 }), 0.2);
    expect(s.clip).toBe('fall');
    expect(nextAnim({ ...s, air: 0.5 }, foot(2, { grounded: false, vy: 4 }), 0.03).clip).toBe('jump');
    expect(nextAnim(s, foot(0), 0.03).clip).toBe('idle');
  });

  it('Einsteigen läuft zu Ende, dann sitzen (Zweirad) bzw. ausgeblendet', () => {
    let s = nextAnim(initialAnim(), foot(0), 0.03, 'enter');
    expect(s.clip).toBe('enter');
    s = run(s, foot(0, { mode: 'ride' }), 0.5);
    expect(s.clip).toBe('enter');
    s = run(s, foot(0, { mode: 'ride' }), 0.2);
    expect(s.clip).toBe('sit');
    expect(run(nextAnim(initialAnim(), foot(0), 0.03, 'enter'), foot(0, { mode: 'hidden' }), 0.7).clip).toBe('idle');
  });

  it('Aussteigen, dann wieder nach Bewegung', () => {
    let s = nextAnim({ clip: 'sit', lock: 0, air: 0 }, foot(0), 0.03, 'exit');
    expect(s.clip).toBe('exit');
    s = run(s, foot(1.5), 0.7);
    expect(s.clip).toBe('walk');
  });

  it('Abspielgeschwindigkeit passt zur Bewegung', () => {
    expect(speedRatio('walk', CLIP_SPEEDS.walk)).toBeCloseTo(1);
    expect(speedRatio('walk', 2 * CLIP_SPEEDS.walk)).toBeCloseTo(2);
    expect(speedRatio('run', 5)).toBeCloseTo(5 / CLIP_SPEEDS.run);
    expect(speedRatio('run', 22)).toBe(2.2);
    expect(speedRatio('idle', 3)).toBe(1);
  });
});
