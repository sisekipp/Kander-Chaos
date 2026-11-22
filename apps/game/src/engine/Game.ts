import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { configureLocalAssets } from './assets.ts';
import { PerfMonitor } from './perf/PerfMonitor.ts';
import { AdaptiveResolution } from './perf/AdaptiveResolution.ts';
import { loadUniformBuffersEnabled } from './renderFlags.ts';
import { createSkyDome } from '../world/sky/SkyDome.ts';
import { GROUND_LIGHT, HORIZON, SKY_LIGHT, SUN_COLOR, SUN_DIR } from '../world/sky/skyColors.ts';
import { QUALITY_PRESETS, loadQuality, saveQuality, type QualityLevel, type QualitySettings } from './quality.ts';

export interface GameOptions {
  canvas: HTMLCanvasElement;
}

/**
 * Besitzt Engine, Szene und Render-Schleife. Läuft vollständig außerhalb von React;
 * die UI spricht nur über den Store bzw. über öffentliche Methoden mit dem Spiel.
 */
export class Game {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  readonly sun: DirectionalLight;
  readonly perf: PerfMonitor;
  /** Uniform-Buffer aktiv (Testmodus-Schalter, wirksam nach Neuladen). */
  readonly uniformBuffers: boolean;
  quality: QualitySettings;
  readonly adaptive: AdaptiveResolution;
  private readonly qualityListeners = new Set<(q: QualitySettings) => void>();
  private readonly frameListeners = new Set<(dtMs: number) => void>();
  private disposed = false;

  constructor({ canvas }: GameOptions) {
    configureLocalAssets();
    this.uniformBuffers = loadUniformBuffersEnabled();
    // WebGL2 – Safari 16 hat kein WebGPU. Kein MSAA (Budget), Stencil für spätere Effekte.
    this.engine = new Engine(canvas, false, {
      stencil: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      disableWebGL2Support: false,
      adaptToDeviceRatio: false,
    });
    // Muss vor dem Erzeugen der Szene gesetzt werden (Szene/Materialien legen sonst UBOs an)
    this.engine.disableUniformBuffers = !this.uniformBuffers;
    this.scene = new Scene(this.engine);
    this.scene.skipPointerMovePicking = true;
    // Himmelskuppel deckt jedes Pixel ab -> kein Farb-Clear nötig (Tiefe wird weiter gelöscht)
    this.scene.clearColor = new Color4(HORIZON[0], HORIZON[1], HORIZON[2], 1);
    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = true;
    this.scene.ambientColor = new Color3(0.3, 0.3, 0.3);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(...HORIZON);
    this.scene.fogStart = 400;
    this.scene.fogEnd = 1500;

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.1, 40, Vector3.Zero(), this.scene);
    this.camera.minZ = 0.3;
    this.camera.maxZ = 2500;
    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 400;
    this.camera.attachControl(canvas, true);

    const hemi = new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene);
    // Babylon-Lichter nur noch für Figur, Fahrzeuge und Gegenstände; Welt-Shader haben eigenes Licht
    hemi.diffuse = new Color3(...SKY_LIGHT);
    hemi.groundColor = new Color3(...GROUND_LIGHT);
    this.sun = new DirectionalLight('sun', new Vector3(...SUN_DIR), this.scene);
    this.sun.diffuse = new Color3(...SUN_COLOR);
    createSkyDome(this.scene);

    this.quality = QUALITY_PRESETS[loadQuality()];
    this.adaptive = new AdaptiveResolution({ base: this.quality.baseRenderScale, min: this.quality.minRenderScale });
    this.applyQuality();
    this.perf = new PerfMonitor(this);

    this.engine.runRenderLoop(() => {
      const dt = this.engine.getDeltaTime();
      if (this.adaptive.update(dt)) this.applyRenderScale();
      for (const fn of this.frameListeners) fn(dt);
      this.scene.render();
    });
    window.addEventListener('resize', this.onResize);
  }

  /** Callback vor jedem gerenderten Bild (dt in ms). Gibt eine Abmelde-Funktion zurück. */
  onFrame(fn: (dtMs: number) => void): () => void {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  /** Wechselt die Qualitätsstufe (wird gespeichert). */
  setQuality(level: QualityLevel): void {
    saveQuality(level);
    this.quality = QUALITY_PRESETS[level];
    this.adaptive.reset(this.quality.baseRenderScale, this.quality.minRenderScale);
    this.applyQuality();
  }

  /** Meldet Qualitätswechsel (z. B. an Schatten, Streaming-Sichtweite). Ruft sofort einmal auf. */
  onQualityChange(fn: (q: QualitySettings) => void): () => void {
    this.qualityListeners.add(fn);
    fn(this.quality);
    return () => this.qualityListeners.delete(fn);
  }

  private applyQuality(): void {
    const q = this.quality;
    this.scene.fogStart = q.fogStart;
    this.scene.fogEnd = q.fogEnd;
    this.camera.maxZ = q.fogEnd + 100;
    this.applyRenderScale();
    for (const fn of this.qualityListeners) fn(q);
  }

  /**
   * Renderauflösung relativ zu physischen Pixeln. Das Canvas wird in CSS-Pixeln angelegt;
   * hardwareScalingLevel = 1 / (scale * dpr). Das DOM-UI bleibt davon unberührt und scharf.
   */
  private applyRenderScale(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.engine.setHardwareScalingLevel(1 / (this.adaptive.scale * dpr));
  }

  private onResize = () => this.engine.resize();

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.frameListeners.clear();
    this.perf.dispose();
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
