import type { BuiltTile } from '../protocol.ts';
import type { TileState } from './TileState.ts';

/**
 * Eine Ebene der Welt, die sich an das Kachel-Streaming hängt (Gelände/Gebäude, Bäume, Kollision,
 * Kleinobjekte, Parkplätze …). Der TileManager kennt nur diese Schnittstelle – neue Features kommen
 * als weitere Layer dazu, statt den Manager zu vergrößern.
 */
export interface TileLayer {
  readonly name: string;
  /**
   * Upload-Schritte für eine frisch gebaute Kachel. Jeder Schritt läuft später einzeln im Zeitbudget.
   * Ressourcen in `tile.meshes` oder über `tile.onDispose` registrieren, damit das Entladen sie freigibt.
   */
  upload(tile: TileState, built: BuiltTile): (() => void)[];
  /** Kachel ist vollständig hochgeladen und sichtbar. */
  onTileReady?(tile: TileState): void;
  /** Kachel wird entladen oder durch eine andere Detailstufe ersetzt (vor dem Freigeben). */
  onTileUnload?(tile: TileState): void;
}

/** Verteilt Kachel-Ereignisse an alle Layer in Registrierungsreihenfolge (reine Logik). */
export class LayerRegistry<T = TileState> {
  private readonly layers: {
    name: string;
    onTileReady?(tile: T): void;
    onTileUnload?(tile: T): void;
  }[] = [];

  add(layer: { name: string; onTileReady?(tile: T): void; onTileUnload?(tile: T): void }): void {
    if (this.layers.some((l) => l.name === layer.name)) throw new Error(`Layer "${layer.name}" ist schon registriert`);
    this.layers.push(layer);
  }

  get names(): string[] {
    return this.layers.map((l) => l.name);
  }

  ready(tile: T): void {
    for (const l of this.layers) l.onTileReady?.(tile);
  }

  /** Entladen in umgekehrter Reihenfolge (später registrierte Layer hängen evtl. von früheren ab). */
  unload(tile: T): void {
    for (let i = this.layers.length - 1; i >= 0; i--) this.layers[i].onTileUnload?.(tile);
  }
}
