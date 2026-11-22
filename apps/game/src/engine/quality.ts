export type QualityLevel = 'low' | 'high';

export interface QualitySettings {
  level: QualityLevel;
  /** Start-Renderauflösung relativ zu den physischen Pixeln (1 = nativ). */
  baseRenderScale: number;
  /** Untergrenze der adaptiven Absenkung. */
  minRenderScale: number;
  shadows: boolean;
  fxaa: boolean;
  fogStart: number;
  fogEnd: number;
  /** Radius von Ring 2 in m (Sichtgrenze für Kacheln). */
  viewDistance: number;
  /** Baumdichte-Faktor (1 = voll). */
  vegetationDensity: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  low: {
    level: 'low',
    baseRenderScale: 0.55,
    minRenderScale: 0.4,
    shadows: false,
    fxaa: false,
    fogStart: 350,
    fogEnd: 900,
    viewDistance: 900,
    vegetationDensity: 0.6,
  },
  high: {
    level: 'high',
    baseRenderScale: 0.85,
    minRenderScale: 0.5,
    shadows: true,
    fxaa: true,
    fogStart: 600,
    fogEnd: 1600,
    viewDistance: 1500,
    vegetationDensity: 1,
  },
};

export interface DeviceInfo {
  userAgent: string;
  maxTouchPoints: number;
  hardwareConcurrency: number;
}

/**
 * Wählt die Standard-Qualität. Das iPad Pro 1. Gen ist im Browser nicht eindeutig erkennbar
 * (Safari meldet nur "Apple GPU"); deshalb gilt: im Zweifel "Niedrig".
 * Nur Geräte ohne Touch mit mindestens 6 Kernen starten mit "Hoch".
 */
export function detectDefaultQuality(d: DeviceInfo): QualityLevel {
  const isIOS = /iPad|iPhone|iPod/.test(d.userAgent) || (/Macintosh/.test(d.userAgent) && d.maxTouchPoints > 1);
  const isTouch = d.maxTouchPoints > 0;
  if (isIOS || isTouch) return 'low';
  return d.hardwareConcurrency >= 6 ? 'high' : 'low';
}

const STORAGE_KEY = 'kc.quality';

export function loadQuality(): QualityLevel {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'low' || v === 'high') return v;
  } catch {
    /* privater Modus */
  }
  return detectDefaultQuality({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 2,
  });
}

export function saveQuality(level: QualityLevel): void {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* ignorieren */
  }
}
