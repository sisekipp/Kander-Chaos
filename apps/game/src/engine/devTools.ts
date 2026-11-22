import type { Game } from './Game.ts';
import { downloadJson, type MeasurementReport } from './perf/FrameRecorder.ts';
import { StressScene } from './stress/StressScene.ts';

let stress: StressScene | null = null;

export function showStressScene(game: Game): StressScene {
  stress?.dispose();
  stress = new StressScene(game.scene);
  stress.build();
  game.camera.radius = 180;
  return stress;
}

export async function runPhysicsStress(game: Game): Promise<number> {
  const s = stress ?? showStressScene(game);
  const { wasmStartMs } = await s.dropPhysicsBodies(50);
  game.perf.recorder.extra.havokWasmStartMs = Math.round(wasmStartMs);
  return wasmStartMs;
}

export function hideStressScene(): void {
  stress?.dispose();
  stress = null;
}

function rendererName(game: Game): string {
  const gl = game.engine._gl as WebGL2RenderingContext | null;
  if (!gl) return 'unbekannt';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
}

/** Startet einen Messlauf über `seconds` Sekunden und lädt danach den Bericht als JSON herunter. */
export function runMeasurement(
  game: Game,
  label: string,
  seconds: number,
  onDone?: (r: MeasurementReport) => void,
  /** true = Aufzeichnung läuft bereits extern (z. B. Messfahrt), nur Bericht erzeugen. */
  alreadyRecorded = false,
) {
  const rec = game.perf.recorder;
  if (!alreadyRecorded) rec.start(label);
  window.setTimeout(() => {
    if (!alreadyRecorded) rec.stop();
    rec.extra.uniformBuffers = game.uniformBuffers ? 'an' : 'aus';
    const report = rec.report({
      userAgent: navigator.userAgent,
      renderer: rendererName(game),
      screen: { width: screen.width, height: screen.height, dpr: window.devicePixelRatio },
      renderScale: 1 / game.engine.getHardwareScalingLevel(),
      quality: game.quality.level,
    });
    downloadJson(`messung-${label}-${report.startedAt.replace(/[:.]/g, '-')}.json`, report);
    onDone?.(report);
  }, seconds * 1000);
}
