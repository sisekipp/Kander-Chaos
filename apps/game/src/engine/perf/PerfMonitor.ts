import { EngineInstrumentation } from '@babylonjs/core/Instrumentation/engineInstrumentation';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import type { Game } from '../Game.ts';
import { useGameStore } from '../../state/store.ts';
import { FrameRecorder } from './FrameRecorder.ts';

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number };
}

/**
 * Misst Bildzeiten jedes Bildes (für den Rekorder) und schreibt gedrosselt (4 Hz)
 * Kennzahlen in den Store. React rendert damit höchstens 4x pro Sekunde.
 */
export class PerfMonitor {
  readonly recorder = new FrameRecorder();
  private readonly sceneInstr: SceneInstrumentation;
  private readonly engineInstr: EngineInstrumentation;
  private acc = 0;
  private frames = 0;
  private lastPublish = performance.now();
  private lastFrame = performance.now();
  /** Von außen gesetzt (Streaming-Manager). */
  loadedTiles = 0;
  private readonly unsubscribe: () => void;

  constructor(private readonly game: Game) {
    this.sceneInstr = new SceneInstrumentation(game.scene);
    this.engineInstr = new EngineInstrumentation(game.engine);
    this.unsubscribe = game.onFrame(() => this.tick());
  }

  private tick(): void {
    const now = performance.now();
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    this.recorder.push(dt);
    this.acc += dt;
    this.frames++;
    if (now - this.lastPublish < 250) return;
    this.lastPublish = now;
    const mem = (performance as PerformanceWithMemory).memory;
    useGameStore.getState().setPerf({
      fps: this.frames > 0 ? (this.frames * 1000) / this.acc : 0,
      frameMs: this.frames > 0 ? this.acc / this.frames : 0,
      drawCalls: Math.round(this.sceneInstr.drawCallsCounter.current),
      loadedTiles: this.loadedTiles,
      memoryMb: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      renderScale: 1 / this.game.engine.getHardwareScalingLevel(),
    });
    this.acc = 0;
    this.frames = 0;
  }

  /** GPU-Bildzeit (nur wenn die Erweiterung verfügbar ist, Safari meist nicht). */
  get gpuFrameMs(): number {
    return this.engineInstr.gpuFrameTimeCounter.lastSecAverage * 1e-6;
  }

  dispose(): void {
    this.unsubscribe();
    this.sceneInstr.dispose();
    this.engineInstr.dispose();
  }
}
