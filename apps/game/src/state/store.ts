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
  setStorage(s: GameState['storage']): void;
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
  setStorage: (storage) => set({ storage }),
}));
