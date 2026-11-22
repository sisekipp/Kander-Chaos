import { create } from 'zustand';

/** Leistungswerte, von der Engine gedrosselt (ca. 4 Hz) geschrieben. */
export interface PerfStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  loadedTiles: number;
  /** Speicher in MB, nur wenn der Browser ihn meldet (Safari: nein). */
  memoryMb: number | null;
  renderScale: number;
}

export type Screen = 'loading' | 'menu' | 'playing' | 'about';

export interface DownloadState {
  phase: 'checking' | 'downloading' | 'ready' | 'error' | 'needs-network';
  fraction: number;
  loadedMb: number;
  totalMb: number;
  message: string;
}

export interface GameState {
  screen: Screen;
  perfVisible: boolean;
  perf: PerfStats;
  setScreen(screen: Screen): void;
  togglePerf(): void;
  setPerf(perf: Partial<PerfStats>): void;
  download: DownloadState;
  setDownload(d: Partial<DownloadState>): void;
  /** Neue App- oder Weltversion bereit. */
  updateReady: boolean;
  setUpdateReady(v: boolean): void;
  storage: { persisted: boolean; usageMb: number | null; quotaMb: number | null } | null;
  /** „Einfach“-Fahrmodus: Auto-Gas beim Lenken (gespeichert). */
  simpleDriving: boolean;
  setSimpleDriving(v: boolean): void;
  /** Spielzustand für die UI (4 Hz aus der Welt). */
  play: { mode: 'walking' | 'driving'; canEnter: boolean; vehicleHealth: number; speedKmh: number };
  setPlay(p: Partial<GameState['play']>): void;
  /** Debug-Ansicht der Physik (Raycasts, Kräfte) im Testmodus. */
  debugPhysics: boolean;
  setDebugPhysics(v: boolean): void;
  setStorage(s: GameState['storage']): void;
}

function readSimple(): boolean {
  try {
    return localStorage.getItem('kc.simpleDriving') !== '0'; // Standard: an
  } catch {
    return true;
  }
}

export const useGameStore = create<GameState>((set) => ({
  screen: 'loading',
  perfVisible: false,
  perf: { fps: 0, frameMs: 0, drawCalls: 0, loadedTiles: 0, memoryMb: null, renderScale: 1 },
  setScreen: (screen) => set({ screen }),
  togglePerf: () => set((s) => ({ perfVisible: !s.perfVisible })),
  setPerf: (perf) => set((s) => ({ perf: { ...s.perf, ...perf } })),
  download: { phase: 'checking', fraction: 0, loadedMb: 0, totalMb: 0, message: '' },
  setDownload: (d) => set((s) => ({ download: { ...s.download, ...d } })),
  updateReady: false,
  setUpdateReady: (updateReady) => set({ updateReady }),
  storage: null,
  simpleDriving: readSimple(),
  setSimpleDriving: (simpleDriving) => {
    try {
      localStorage.setItem('kc.simpleDriving', simpleDriving ? '1' : '0');
    } catch {
      /* privater Modus */
    }
    set({ simpleDriving });
  },
  play: { mode: 'walking', canEnter: false, vehicleHealth: 1, speedKmh: 0 },
  setPlay: (p) =>
    set((s) => {
      const next = { ...s.play, ...p };
      const same = (Object.keys(next) as (keyof typeof next)[]).every((k) => next[k] === s.play[k]);
      return same ? s : { play: next };
    }),
  debugPhysics: false,
  setDebugPhysics: (debugPhysics) => set({ debugPhysics }),
  setStorage: (storage) => set({ storage }),
}));
