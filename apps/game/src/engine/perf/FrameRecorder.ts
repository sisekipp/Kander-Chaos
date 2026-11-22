import { summarizeFrames, type FrameSummary } from './frameStats.ts';

export interface MeasurementReport {
  label: string;
  startedAt: string;
  userAgent: string;
  renderer: string;
  screen: { width: number; height: number; dpr: number };
  renderScale: number;
  quality: string;
  summary: FrameSummary;
  /** Optionale Zusatzmessungen (z. B. Kachel-Erzeugungszeiten, WASM-Startzeit). */
  extra: Record<string, number | string>;
  frameMs: number[];
}

/** Zeichnet Bildzeiten über einen Messlauf auf und erzeugt einen JSON-Bericht. */
export class FrameRecorder {
  private samples: number[] = [];
  private recording = false;
  private startedAt = '';
  private label = '';
  readonly extra: Record<string, number | string> = {};

  get isRecording(): boolean {
    return this.recording;
  }

  start(label: string): void {
    this.samples = [];
    this.label = label;
    this.startedAt = new Date().toISOString();
    for (const k of Object.keys(this.extra)) delete this.extra[k];
    this.recording = true;
  }

  push(frameMs: number): void {
    if (this.recording && frameMs > 0) this.samples.push(frameMs);
  }

  stop(): FrameSummary {
    this.recording = false;
    return summarizeFrames(this.samples);
  }

  report(ctx: Omit<MeasurementReport, 'label' | 'startedAt' | 'summary' | 'frameMs' | 'extra'>): MeasurementReport {
    return {
      label: this.label,
      startedAt: this.startedAt,
      ...ctx,
      summary: summarizeFrames(this.samples),
      extra: { ...this.extra },
      frameMs: this.samples.map((v) => Math.round(v * 100) / 100),
    };
  }
}

/** Bietet einen Bericht als JSON-Datei zum Herunterladen an (funktioniert offline, auch auf dem iPad). */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
