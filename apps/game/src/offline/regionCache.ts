/**
 * Zwischenspeicher für Nachladeregionen (Spec regional-streaming): Regionspakete aus Cloudflare bleiben auf dem
 * Gerät, bis das Budget (400 MB) erreicht ist; dann fliegt die am längsten nicht besuchte Region zuerst raus.
 * Pro Datenstand ein eigener Cache-Name, alte Stände werden verworfen. Speicher und Uhr sind injiziert (Tests).
 */

export const REGION_BUDGET = 400 * 1024 * 1024;
export const regionCacheName = (buildVersion: string): string => `kc-regions-${buildVersion}`;

export interface RegionEntry {
  file: string;
  bytes: number;
  lastVisit: number;
}

/** Welche Einträge müssen weichen, damit `incoming` Bytes ins Budget passen? Älteste zuerst. */
export function evictionPlan(entries: RegionEntry[], incoming: number, budget = REGION_BUDGET): string[] {
  let used = entries.reduce((s, e) => s + e.bytes, 0) + incoming;
  const out: string[] = [];
  for (const e of [...entries].sort((a, b) => a.lastVisit - b.lastVisit || a.file.localeCompare(b.file))) {
    if (used <= budget) break;
    out.push(e.file);
    used -= e.bytes;
  }
  return out;
}

/** Minimaler Ausschnitt der Cache-API (für Tests ersetzbar). */
export interface CacheLike {
  match(key: string): Promise<Response | undefined>;
  put(key: string, res: Response): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/** Ablage der Zeitstempel und Größen (z. B. localStorage), Schlüssel = Dateiname. */
export interface MetaStore {
  load(): RegionEntry[];
  save(entries: RegionEntry[]): void;
}

export class RegionCache {
  private entries: Map<string, RegionEntry>;

  constructor(
    private readonly cache: CacheLike,
    private readonly meta: MetaStore,
    private readonly budget = REGION_BUDGET,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.entries = new Map(meta.load().map((e) => [e.file, e]));
  }

  get usedBytes(): number {
    let n = 0;
    for (const e of this.entries.values()) n += e.bytes;
    return n;
  }

  get count(): number {
    return this.entries.size;
  }

  /** Paket aus dem Zwischenspeicher (Besuch wird vermerkt) oder null. */
  async get(file: string): Promise<ArrayBuffer | null> {
    const e = this.entries.get(file);
    if (!e) return null;
    const res = await this.cache.match(file);
    if (!res) {
      this.entries.delete(file);
      this.persist();
      return null;
    }
    e.lastVisit = this.now();
    this.persist();
    return res.arrayBuffer();
  }

  /** Paket ablegen; vorher ggf. älteste Regionen löschen, damit das Budget hält. */
  async put(file: string, data: ArrayBuffer): Promise<void> {
    if (data.byteLength > this.budget) return;
    const others = [...this.entries.values()].filter((e) => e.file !== file);
    for (const f of evictionPlan(others, data.byteLength, this.budget)) {
      await this.cache.delete(f);
      this.entries.delete(f);
    }
    await this.cache.put(file, new Response(data));
    this.entries.set(file, { file, bytes: data.byteLength, lastVisit: this.now() });
    this.persist();
  }

  /** Alle Nachladeregionen löschen (Einstellungen „Gespeicherte Regionen löschen“). */
  async clear(): Promise<void> {
    for (const f of this.entries.keys()) await this.cache.delete(f);
    this.entries.clear();
    this.persist();
  }

  private persist(): void {
    this.meta.save([...this.entries.values()]);
  }
}
