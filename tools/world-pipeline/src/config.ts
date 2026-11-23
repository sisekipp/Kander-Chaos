import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DEFAULT_HEIGHT_QUANT } from '@kandern/world-format';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../../..');

export interface PipelineConfig {
  /** OSM-Relation der Gemeindegrenze (Kandern). */
  boundaryRelation: number;
  /** Randstreifen um die Gemeinde in m. */
  bufferM: number;
  tileSize: number;
  /** Weltursprung in UTM 32N; muss ein gerades ganzzahliges Vielfaches von 2 m sein (DGM-Raster). */
  origin: { epsg: 25832; easting: number; northing: number };
  quant: { base: number; step: number };
  /** Samples je Kachelseite pro LOD (inkl. beider Kanten). 126 -> 2 m bei 250 m. */
  lodSamples: number[];
  /** Kacheln je Regionspaket (pro Seite). */
  regionTiles: number;
  /** Budget der Kacheldaten in Bytes (Spec: 120 MB). */
  budgetBytes: number;
  overpassUrl: string;
  dgmUrl: (e: number, n: number) => string;
  userAgent: string;
  paths: { raw: string; work: string; out: string; remote: string };
  /** Bekannte Ortsteile, die Gebäude enthalten müssen (Abdeckungsprüfung). */
  requiredPlaces: string[];
}

/** Regionales Spielgebiet (Müllheim – Basel) statt nur Gemeinde Kandern; eigene Rohdaten-Dateien. */
export const REGIONAL = process.env.KC_REGIONAL === '1';

/** Basis-URL der Nachladeregionen im Index; die Pakete werden mit dem Spiel ausgeliefert (statische Dateien bei Cloudflare). */
export const REMOTE_BASE = process.env.KC_REMOTE_BASE ?? '../world-remote/';

export const config: PipelineConfig = {
  boundaryRelation: 1130283,
  bufferM: 500,
  tileSize: 250,
  origin: { epsg: 25832, easting: 399650, northing: 5285370 },
  quant: DEFAULT_HEIGHT_QUANT,
  lodSamples: [126, 33, 9],
  regionTiles: 8,
  budgetBytes: Number(process.env.KC_TILE_BUDGET_MB ?? 120) * 1024 * 1024,
  overpassUrl: 'https://overpass-api.de/api/interpreter',
  dgmUrl: (e, n) => `https://opengeodata.lgl-bw.de/data/dgm/dgm1_32_${e}_${n}_2_bw.zip`,
  userAgent: 'kandern-chaos-world-pipeline/0.1',
  paths: {
    raw: path.join(REPO_ROOT, 'data/raw'),
    work: path.join(REPO_ROOT, 'data/work'),
    out: path.join(REPO_ROOT, 'apps/game/public/world'),
    remote: path.join(REPO_ROOT, 'apps/game/public/world-remote'),
  },
  requiredPlaces: ['Kandern', 'Wollbach', 'Holzen', 'Riedlingen', 'Tannenkirch', 'Sitzenkirch', 'Feuerbach'],
};
