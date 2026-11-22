export interface FrameSummary {
  frames: number;
  durationMs: number;
  avgFps: number;
  /** fps des 1-%-Perzentils der langsamsten Bilder (= 1000 / p99 der Bildzeit). */
  p1LowFps: number;
  avgFrameMs: number;
  p99FrameMs: number;
  maxFrameMs: number;
  /** Bilder über 100 ms (Spec: Nachladen ohne Ruckeln). */
  framesOver100ms: number;
}

/** Perzentil (0..100) per Nearest-Rank auf einer Kopie. */
export function percentile(values: ArrayLike<number>, p: number): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = Float64Array.from(values as ArrayLike<number>).sort();
  const rank = Math.ceil((p / 100) * n);
  return sorted[Math.min(n - 1, Math.max(0, rank - 1))];
}

export function summarizeFrames(frameMs: ArrayLike<number>): FrameSummary {
  const n = frameMs.length;
  if (n === 0) {
    return {
      frames: 0,
      durationMs: 0,
      avgFps: 0,
      p1LowFps: 0,
      avgFrameMs: 0,
      p99FrameMs: 0,
      maxFrameMs: 0,
      framesOver100ms: 0,
    };
  }
  let sum = 0;
  let max = 0;
  let over = 0;
  for (let i = 0; i < n; i++) {
    const v = frameMs[i];
    sum += v;
    if (v > max) max = v;
    if (v > 100) over++;
  }
  const p99 = percentile(frameMs, 99);
  return {
    frames: n,
    durationMs: sum,
    avgFps: (n * 1000) / sum,
    p1LowFps: p99 > 0 ? 1000 / p99 : 0,
    avgFrameMs: sum / n,
    p99FrameMs: p99,
    maxFrameMs: max,
    framesOver100ms: over,
  };
}
